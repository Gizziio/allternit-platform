//! # Allternit VM Executor
//!
//! Thin orchestrator that sits on top of the `allternit-driver-interface`
//! abstraction. It owns a [`DriverRegistry`], tracks active VMs, and exposes a
//! small, high-level lifecycle API (`create_vm`, `start_vm`, `stop_vm`,
//! `pause_vm`, `resume_vm`, `inspect_vm`) that downstream crates such as
//! `allternit-cowork-runtime` and `allternit-session-manager` can depend on
//! without binding to a concrete driver implementation.

use allternit_driver_interface::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, error, info, instrument, warn};

/// Errors returned by [`VmExecutor`].
#[derive(Debug, Error, Clone, PartialEq)]
pub enum ExecutorError {
    #[error("Driver not found: {0}")]
    DriverNotFound(DriverType),

    #[error("No driver registered in the executor")]
    NoDriver,

    #[error("VM not found: {0}")]
    VmNotFound(ExecutionId),

    #[error("Driver error: {0}")]
    Driver(#[from] DriverError),

    #[error("Invalid input: {field} - {reason}")]
    InvalidInput { field: String, reason: String },

    #[error("Operation failed: {0}")]
    OperationFailed(String),
}

/// Status of a VM tracked by the executor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VmStatus {
    Creating,
    Running,
    Paused,
    Stopped,
    Failed,
}

impl fmt::Display for VmStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VmStatus::Creating => write!(f, "creating"),
            VmStatus::Running => write!(f, "running"),
            VmStatus::Paused => write!(f, "paused"),
            VmStatus::Stopped => write!(f, "stopped"),
            VmStatus::Failed => write!(f, "failed"),
        }
    }
}

/// Lightweight summary of an active VM.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VmSummary {
    pub id: ExecutionId,
    pub tenant: TenantId,
    pub driver_type: DriverType,
    pub status: VmStatus,
    pub image: String,
}

/// Detailed inspection result for a VM.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VmInfo {
    pub id: ExecutionId,
    pub tenant: TenantId,
    pub driver_type: DriverType,
    pub status: VmStatus,
    pub handle: ExecutionHandle,
    pub consumption: Option<ResourceConsumption>,
}

/// Aggregate health reported by the executor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecutorHealth {
    pub healthy: bool,
    pub drivers: HashMap<DriverType, DriverHealth>,
    pub active_vms: usize,
    pub message: Option<String>,
}

/// Internal state tracked for each VM.
#[derive(Debug, Clone)]
struct TrackedVm {
    handle: ExecutionHandle,
    driver_type: DriverType,
    status: VmStatus,
}

/// High-level VM orchestrator.
///
/// Holds a [`DriverRegistry`] and routes lifecycle operations to the selected
/// driver. All active VMs are tracked in-memory so callers can inspect and
/// manage them by [`ExecutionId`] without keeping the original
/// [`ExecutionHandle`] around.
#[derive(Clone)]
pub struct VmExecutor {
    registry: Arc<RwLock<DriverRegistry>>,
    default_driver: DriverType,
    vms: Arc<RwLock<HashMap<ExecutionId, TrackedVm>>>,
}

impl VmExecutor {
    /// Create a new executor with an empty registry and the requested default
    /// driver type.
    pub fn new(default_driver: DriverType) -> Self {
        Self {
            registry: Arc::new(RwLock::new(DriverRegistry::new())),
            default_driver,
            vms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new executor backed by an existing registry.
    pub fn with_registry(registry: DriverRegistry, default_driver: DriverType) -> Self {
        Self {
            registry: Arc::new(RwLock::new(registry)),
            default_driver,
            vms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Return the configured default driver type.
    pub fn default_driver(&self) -> DriverType {
        self.default_driver
    }

    /// Register a driver implementation.
    pub async fn register_driver(&self, driver: Arc<dyn ExecutionDriver>) {
        self.registry.write().await.register_driver(driver);
    }

    /// Select a driver for the given spec.
    ///
    /// Honors an explicit driver hint in the spec via the (currently unused)
    /// `envelope` field when possible, otherwise falls back to the default
    /// driver configured for the executor.
    async fn select_driver(&self, _spec: &SpawnSpec) -> Result<(DriverType, Arc<dyn ExecutionDriver>), ExecutorError> {
        let registry = self.registry.read().await;

        // If the registry is empty there is nothing to drive execution.
        if registry.get_driver(self.default_driver).is_none() {
            return Err(ExecutorError::NoDriver);
        }

        // Use the default driver. Callers can pre-populate the registry with
        // any driver they want; the executor intentionally does not hard-code
        // platform-specific logic.
        registry
            .get_driver_arc(self.default_driver)
            .map(|d| (self.default_driver, d))
            .ok_or(ExecutorError::DriverNotFound(self.default_driver))
    }

    /// Create (spawn) a new VM from `spec`.
    ///
    /// If `spec.run_id` is `None`, a fresh [`ExecutionId`] is generated.
    #[instrument(skip(self, spec), fields(tenant = %spec.tenant))]
    pub async fn create_vm(&self, mut spec: SpawnSpec) -> Result<ExecutionHandle, ExecutorError> {
        let (driver_type, driver) = self.select_driver(&spec).await?;

        if spec.run_id.is_none() {
            spec.run_id = Some(ExecutionId::new());
        }

        info!(
            run_id = %spec.run_id.unwrap(),
            driver = %driver_type,
            "Creating VM"
        );

        let handle = driver.spawn(spec).await?;

        let tracked = TrackedVm {
            handle: handle.clone(),
            driver_type,
            status: VmStatus::Running,
        };

        self.vms.write().await.insert(handle.id, tracked);

        info!(run_id = %handle.id, "VM created");
        Ok(handle)
    }

    /// Start a VM. For drivers where `spawn` already starts the environment
    /// this is a no-op resume; otherwise it transitions a paused/stopped VM
    /// back into `Running`.
    #[instrument(skip(self), fields(run_id = %id))]
    pub async fn start_vm(&self, id: ExecutionId) -> Result<(), ExecutorError> {
        let driver = self.driver_for_vm(id).await?;
        let handle = self.handle_for_vm(id).await?;

        info!(run_id = %id, "Starting VM");
        driver.resume_vm(&handle).await?;

        self.set_status(id, VmStatus::Running).await;
        Ok(())
    }

    /// Stop (destroy) a VM and remove it from tracking.
    #[instrument(skip(self), fields(run_id = %id))]
    pub async fn stop_vm(&self, id: ExecutionId) -> Result<(), ExecutorError> {
        let driver = self.driver_for_vm(id).await?;
        let handle = self.handle_for_vm(id).await?;

        info!(run_id = %id, "Stopping VM");
        driver.destroy(&handle).await?;

        self.vms.write().await.remove(&id);
        info!(run_id = %id, "VM stopped");
        Ok(())
    }

    /// Pause a running VM.
    #[instrument(skip(self), fields(run_id = %id))]
    pub async fn pause_vm(&self, id: ExecutionId) -> Result<(), ExecutorError> {
        let driver = self.driver_for_vm(id).await?;
        let handle = self.handle_for_vm(id).await?;

        info!(run_id = %id, "Pausing VM");
        driver.pause_vm(&handle).await?;

        self.set_status(id, VmStatus::Paused).await;
        Ok(())
    }

    /// Resume a paused VM.
    #[instrument(skip(self), fields(run_id = %id))]
    pub async fn resume_vm(&self, id: ExecutionId) -> Result<(), ExecutorError> {
        let driver = self.driver_for_vm(id).await?;
        let handle = self.handle_for_vm(id).await?;

        info!(run_id = %id, "Resuming VM");
        driver.resume_vm(&handle).await?;

        self.set_status(id, VmStatus::Running).await;
        Ok(())
    }

    /// Execute a command inside a VM.
    #[instrument(skip(self, cmd), fields(run_id = %id))]
    pub async fn exec(&self, id: ExecutionId, cmd: CommandSpec) -> Result<ExecResult, ExecutorError> {
        let driver = self.driver_for_vm(id).await?;
        let handle = self.handle_for_vm(id).await?;

        debug!(run_id = %id, command = ?cmd.command, "Executing command in VM");
        let result = driver.exec(&handle, cmd).await?;

        // If the VM was paused, execution implicitly resumed it.
        self.set_status(id, VmStatus::Running).await;
        Ok(result)
    }

    /// Inspect a VM, returning its handle, driver type and current resource
    /// consumption if available.
    #[instrument(skip(self), fields(run_id = %id))]
    pub async fn inspect_vm(&self, id: ExecutionId) -> Result<VmInfo, ExecutorError> {
        let driver = self.driver_for_vm(id).await?;
        let handle = self.handle_for_vm(id).await?;
        let (driver_type, status) = {
            let vms = self.vms.read().await;
            let vm = vms.get(&id).ok_or(ExecutorError::VmNotFound(id))?;
            (vm.driver_type, vm.status)
        };

        let consumption = driver.get_consumption(&handle).await.ok();

        Ok(VmInfo {
            id,
            tenant: handle.tenant.clone(),
            driver_type,
            status,
            handle,
            consumption,
        })
    }

    /// List all VMs currently tracked by the executor.
    pub async fn list_vms(&self) -> Vec<VmSummary> {
        self.vms
            .read()
            .await
            .values()
            .map(|vm| VmSummary {
                id: vm.handle.id,
                tenant: vm.handle.tenant.clone(),
                driver_type: vm.driver_type,
                status: vm.status,
                image: vm.handle.env_spec.image.clone(),
            })
            .collect()
    }

    /// Run health checks against every registered driver.
    pub async fn health_check(&self) -> Result<ExecutorHealth, ExecutorError> {
        let registry = self.registry.read().await;
        let mut drivers = HashMap::new();
        let mut healthy = true;

        // Enumerate driver types by querying the default; in practice the
        // registry should expose a way to iterate over registered drivers.
        // We approximate by checking known driver types.
        for driver_type in [
            DriverType::MicroVM,
            DriverType::Container,
            DriverType::Process,
            DriverType::Wasm,
        ] {
            if let Some(driver) = registry.get_driver_arc(driver_type) {
                match driver.health_check().await {
                    Ok(h) => {
                        if !h.healthy {
                            healthy = false;
                        }
                        drivers.insert(driver_type, h);
                    }
                    Err(e) => {
                        healthy = false;
                        warn!(driver = %driver_type, error = %e, "Driver health check failed");
                        drivers.insert(
                            driver_type,
                            DriverHealth {
                                healthy: false,
                                message: Some(e.to_string()),
                                active_executions: 0,
                                available_capacity: driver.capabilities().max_resources,
                                capabilities: vec![],
                            },
                        );
                    }
                }
            }
        }

        let active_vms = self.vms.read().await.len();
        let message = if healthy {
            Some(format!("Executor healthy ({} active VMs)", active_vms))
        } else {
            Some("One or more drivers reported unhealthy".to_string())
        };

        Ok(ExecutorHealth {
            healthy,
            drivers,
            active_vms,
            message,
        })
    }

    /// Look up the driver associated with a tracked VM.
    async fn driver_for_vm(&self, id: ExecutionId) -> Result<Arc<dyn ExecutionDriver>, ExecutorError> {
        let driver_type = {
            let vms = self.vms.read().await;
            let vm = vms.get(&id).ok_or(ExecutorError::VmNotFound(id))?;
            vm.driver_type
        };

        self.registry
            .read()
            .await
            .get_driver_arc(driver_type)
            .ok_or(ExecutorError::DriverNotFound(driver_type))
    }

    /// Look up the execution handle for a tracked VM.
    async fn handle_for_vm(&self, id: ExecutionId) -> Result<ExecutionHandle, ExecutorError> {
        let vms = self.vms.read().await;
        let vm = vms.get(&id).ok_or(ExecutorError::VmNotFound(id))?;
        Ok(vm.handle.clone())
    }

    /// Update the tracked status of a VM.
    async fn set_status(&self, id: ExecutionId, status: VmStatus) {
        let mut vms = self.vms.write().await;
        if let Some(vm) = vms.get_mut(&id) {
            vm.status = status;
        }
    }
}

impl Default for VmExecutor {
    /// Defaults to the process driver with an empty registry.
    fn default() -> Self {
        Self::new(DriverType::Process)
    }
}

impl fmt::Debug for VmExecutor {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("VmExecutor")
            .field("default_driver", &self.default_driver)
            .finish_non_exhaustive()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    /// A minimal in-memory driver for unit testing the executor.
    #[derive(Debug)]
    struct MockDriver {
        driver_type: DriverType,
    }

    #[async_trait]
    impl ExecutionDriver for MockDriver {
        fn capabilities(&self) -> DriverCapabilities {
            DriverCapabilities {
                driver_type: self.driver_type,
                isolation: IsolationLevel::Limited,
                max_resources: ResourceSpec::standard(),
                supported_env_specs: vec![EnvSpecType::Oci],
                features: DriverFeatures::default(),
            }
        }

        async fn spawn(&self, spec: SpawnSpec) -> std::result::Result<ExecutionHandle, DriverError> {
            Ok(ExecutionHandle {
                id: spec.run_id.unwrap_or_default(),
                tenant: spec.tenant,
                driver_info: HashMap::from([("mock".to_string(), "true".to_string())]),
                env_spec: spec.env,
            })
        }

        async fn pause_vm(&self, _handle: &ExecutionHandle) -> std::result::Result<(), DriverError> {
            Ok(())
        }

        async fn resume_vm(&self, _handle: &ExecutionHandle) -> std::result::Result<(), DriverError> {
            Ok(())
        }

        async fn exec(
            &self,
            _handle: &ExecutionHandle,
            cmd: CommandSpec,
        ) -> std::result::Result<ExecResult, DriverError> {
            Ok(ExecResult {
                exit_code: 0,
                stdout: Some(cmd.command.join(" ").into_bytes()),
                stderr: None,
                duration_ms: 1,
                resource_usage: ResourceConsumption::default(),
            })
        }

        async fn stream_logs(&self, _handle: &ExecutionHandle) -> std::result::Result<Vec<LogEntry>, DriverError> {
            Ok(vec![])
        }

        async fn get_artifacts(&self, _handle: &ExecutionHandle) -> std::result::Result<Vec<Artifact>, DriverError> {
            Ok(vec![])
        }

        async fn destroy(&self, _handle: &ExecutionHandle) -> std::result::Result<(), DriverError> {
            Ok(())
        }

        async fn get_consumption(
            &self,
            _handle: &ExecutionHandle,
        ) -> std::result::Result<ResourceConsumption, DriverError> {
            Ok(ResourceConsumption::default())
        }

        async fn get_receipt(&self, _handle: &ExecutionHandle) -> std::result::Result<Option<Receipt>, DriverError> {
            Ok(None)
        }

        async fn health_check(&self) -> std::result::Result<DriverHealth, DriverError> {
            Ok(DriverHealth {
                healthy: true,
                message: Some("mock driver healthy".to_string()),
                active_executions: 0,
                available_capacity: ResourceSpec::standard(),
                capabilities: vec![],
            })
        }
    }

    fn test_spawn_spec(tenant: &str, image: &str) -> SpawnSpec {
        SpawnSpec {
            tenant: TenantId::new(tenant).unwrap(),
            project: None,
            workspace: None,
            run_id: None,
            env: EnvironmentSpec {
                spec_type: EnvSpecType::Oci,
                image: image.to_string(),
                version: None,
                packages: vec![],
                env_vars: HashMap::new(),
                working_dir: None,
                mounts: vec![],
            },
            policy: PolicySpec::default_permissive(),
            resources: ResourceSpec::minimal(),
            envelope: None,
            prewarm_pool: None,
        }
    }

    async fn test_executor() -> VmExecutor {
        let executor = VmExecutor::new(DriverType::Process);
        executor
            .register_driver(Arc::new(MockDriver {
                driver_type: DriverType::Process,
            }))
            .await;
        executor
    }

    #[tokio::test]
    async fn test_create_vm_assigns_id() {
        let executor = test_executor().await;
        let spec = test_spawn_spec("test-tenant", "alpine:latest");

        let handle = executor.create_vm(spec).await.unwrap();
        assert!(!handle.id.to_string().is_empty());
        assert_eq!(handle.env_spec.image, "alpine:latest");

        let vms = executor.list_vms().await;
        assert_eq!(vms.len(), 1);
    }

    #[tokio::test]
    async fn test_create_vm_without_driver_fails() {
        let executor = VmExecutor::new(DriverType::MicroVM);
        let spec = test_spawn_spec("test-tenant", "alpine:latest");

        let err = executor.create_vm(spec).await.unwrap_err();
        assert!(matches!(err, ExecutorError::NoDriver));
    }

    #[tokio::test]
    async fn test_pause_resume_and_stop_vm() {
        let executor = test_executor().await;
        let spec = test_spawn_spec("test-tenant", "alpine:latest");
        let handle = executor.create_vm(spec).await.unwrap();

        executor.pause_vm(handle.id).await.unwrap();
        let info = executor.inspect_vm(handle.id).await.unwrap();
        assert_eq!(info.status, VmStatus::Paused);

        executor.resume_vm(handle.id).await.unwrap();
        let info = executor.inspect_vm(handle.id).await.unwrap();
        assert_eq!(info.status, VmStatus::Running);

        executor.stop_vm(handle.id).await.unwrap();
        assert!(executor.inspect_vm(handle.id).await.is_err());
        assert!(executor.list_vms().await.is_empty());
    }

    #[tokio::test]
    async fn test_exec_in_vm() {
        let executor = test_executor().await;
        let spec = test_spawn_spec("test-tenant", "alpine:latest");
        let handle = executor.create_vm(spec).await.unwrap();

        let result = executor
            .exec(
                handle.id,
                CommandSpec {
                    command: vec!["echo".to_string(), "hello".to_string()],
                    env_vars: HashMap::new(),
                    working_dir: None,
                    stdin_data: None,
                    capture_stdout: true,
                    capture_stderr: true,
                },
            )
            .await
            .unwrap();

        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout.as_ref().unwrap().as_slice(), b"echo hello");
    }

    #[tokio::test]
    async fn test_health_check() {
        let executor = test_executor().await;
        let health = executor.health_check().await.unwrap();
        assert!(health.healthy);
        assert!(health.drivers.contains_key(&DriverType::Process));
        assert!(!health.drivers.contains_key(&DriverType::MicroVM));
    }
}
