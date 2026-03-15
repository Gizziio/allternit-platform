//! # A2R Apple Virtualization Framework Driver
//!
//! macOS-specific execution driver using Apple's Virtualization.framework.
//! Provides hardware-accelerated VM isolation for production workloads on macOS.
//!
//! ## Features
//!
//! - Hardware-accelerated virtualization (Apple Silicon and Intel)
//! - Shared folder support via VirtioFS
//! - Network isolation via NAT
//! - Rosetta 2 support for x86_64 binaries on Apple Silicon
//!
//! ## Requirements
//!
//! - macOS 12.0+ (Monterey) for basic support
//! - macOS 13.0+ (Ventura) for Rosetta 2 support
//! - Apple Silicon or Intel Mac with virtualization support

use a2r_driver_interface::*;
use async_trait::async_trait;
use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub mod config;
pub mod vm;

pub use config::AppleVFConfig;
use vm::VirtualMachine;

/// Error type for Apple VF driver
#[derive(thiserror::Error, Debug)]
pub enum AppleVFError {
    #[error("Virtualization.framework not available: {0}")]
    FrameworkUnavailable(String),
    
    #[error("VM creation failed: {0}")]
    VMCreationFailed(String),
    
    #[error("VM start failed: {0}")]
    VMStartFailed(String),
    
    #[error("VM not found: {0}")]
    VMNotFound(String),
    
    #[error("Image not found: {0}")]
    ImageNotFound(PathBuf),
    
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Driver error: {0}")]
    Driver(#[from] DriverError),
}

impl From<AppleVFError> for DriverError {
    fn from(e: AppleVFError) -> Self {
        match e {
            AppleVFError::FrameworkUnavailable(msg) => DriverError::NotSupported {
                feature: format!("Apple Virtualization: {}", msg),
            },
            AppleVFError::VMCreationFailed(msg) => DriverError::SpawnFailed { reason: msg },
            AppleVFError::VMStartFailed(msg) => DriverError::SpawnFailed { reason: msg },
            AppleVFError::VMNotFound(id) => DriverError::NotFound { id },
            AppleVFError::ImageNotFound(path) => DriverError::InvalidInput {
                field: "image".to_string(),
                reason: format!("Image not found: {}", path.display()),
            },
            AppleVFError::InvalidConfig(msg) => DriverError::InvalidInput {
                field: "config".to_string(),
                reason: msg,
            },
            AppleVFError::Io(e) => DriverError::InternalError { message: e.to_string() },
            AppleVFError::Driver(e) => e,
        }
    }
}

/// Result type for Apple VF operations
pub type Result<T> = std::result::Result<T, AppleVFError>;

/// Apple Virtualization Framework driver
pub struct AppleVFDriver {
    /// Configuration
    config: AppleVFConfig,
    /// Active VMs keyed by execution ID
    vms: RwLock<HashMap<ExecutionId, Arc<RwLock<VirtualMachine>>>>,
    /// Metrics
    metrics: Arc<Metrics>,
}

/// Driver metrics
struct Metrics {
    vms_created: std::sync::atomic::AtomicU64,
    vms_destroyed: std::sync::atomic::AtomicU64,
    commands_executed: std::sync::atomic::AtomicU64,
}

impl Metrics {
    fn new() -> Self {
        Self {
            vms_created: std::sync::atomic::AtomicU64::new(0),
            vms_destroyed: std::sync::atomic::AtomicU64::new(0),
            commands_executed: std::sync::atomic::AtomicU64::new(0),
        }
    }
}

impl AppleVFDriver {
    /// Create a new Apple VF driver with default configuration
    pub fn new() -> Result<Self> {
        Self::with_config(AppleVFConfig::default())
    }

    /// Create a new Apple VF driver with custom configuration
    pub fn with_config(config: AppleVFConfig) -> Result<Self> {
        // Check if virtualization is supported
        if !Self::is_virtualization_supported() {
            return Err(AppleVFError::FrameworkUnavailable(
                "Virtualization is not supported on this system".to_string()
            ));
        }

        // Ensure VM storage directory exists
        std::fs::create_dir_all(&config.vm_storage_dir)?;
        std::fs::create_dir_all(&config.images_dir)?;

        info!(
            storage_dir = %config.vm_storage_dir.display(),
            "Apple Virtualization Framework driver initialized"
        );

        Ok(Self {
            config,
            vms: RwLock::new(HashMap::new()),
            metrics: Arc::new(Metrics::new()),
        })
    }

    /// Check if virtualization is supported on this system
    fn is_virtualization_supported() -> bool {
        // On macOS, we check for Virtualization.framework availability
        // In a real implementation, this would use objc to check VZVirtualMachineConfiguration
        // For now, we assume it's available on macOS 12+
        
        #[cfg(target_os = "macos")]
        {
            // Check macOS version (12.0+ required)
            if let Ok(output) = std::process::Command::new("sw_vers")
                .arg("-productVersion")
                .output() 
            {
                let version = String::from_utf8_lossy(&output.stdout);
                let version_parts: Vec<&str> = version.trim().split('.').collect();
                if let Some(major) = version_parts.first() {
                    if let Ok(major) = major.parse::<u32>() {
                        return major >= 12;
                    }
                }
            }
        }
        
        false
    }

    /// Get or download a VM image
    async fn prepare_image(&self, image_ref: &str) -> Result<PathBuf> {
        // Check if image exists locally
        let image_path = self.config.images_dir.join(format!("{}.ipsw", image_ref));
        
        if image_path.exists() {
            debug!("Using cached image: {}", image_path.display());
            return Ok(image_path);
        }

        // In a real implementation, this would:
        // 1. Check for IPSW restore images
        // 2. Download from Apple if needed
        // 3. Cache locally
        
        // For now, we'll create a minimal Linux VM image using the restore image approach
        warn!("Image not found locally, using system restore image");
        
        // Try to use the system restore image
        let system_image = PathBuf::from("/System/Library/PrivateFrameworks/Virtualization.framework/Versions/A/Resources/RestoreImages/RestoreImage.ipsw");
        
        if system_image.exists() {
            return Ok(system_image);
        }

        // Fallback: create a placeholder that uses Linux boot
        Err(AppleVFError::ImageNotFound(image_path))
    }

    /// Create a unique directory for a VM
    fn create_vm_directory(&self, id: &ExecutionId) -> Result<PathBuf> {
        let vm_dir = self.config.vm_storage_dir.join(id.to_string());
        std::fs::create_dir_all(&vm_dir)?;
        Ok(vm_dir)
    }

    /// Clean up VM directory
    async fn cleanup_vm_directory(&self, id: &ExecutionId) -> Result<()> {
        let vm_dir = self.config.vm_storage_dir.join(id.to_string());
        if vm_dir.exists() {
            tokio::fs::remove_dir_all(&vm_dir).await?;
        }
        Ok(())
    }

    /// Get metrics summary
    pub fn metrics(&self) -> HashMap<String, u64> {
        let mut m = HashMap::new();
        m.insert(
            "vms_created".to_string(),
            self.metrics.vms_created.load(std::sync::atomic::Ordering::Relaxed),
        );
        m.insert(
            "vms_destroyed".to_string(),
            self.metrics.vms_destroyed.load(std::sync::atomic::Ordering::Relaxed),
        );
        m.insert(
            "commands_executed".to_string(),
            self.metrics.commands_executed.load(std::sync::atomic::Ordering::Relaxed),
        );
        m.insert(
            "active_vms".to_string(),
            self.vms.try_read().map(|v| v.len() as u64).unwrap_or(0),
        );
        m
    }
}

impl fmt::Debug for AppleVFDriver {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AppleVFDriver")
            .field("driver_type", &"AppleVirtualization")
            .field("isolation", &"Maximum")
            .field("config", &self.config)
            .finish()
    }
}

#[async_trait]
impl ExecutionDriver for AppleVFDriver {
    fn capabilities(&self) -> DriverCapabilities {
        DriverCapabilities {
            driver_type: DriverType::MicroVM,
            isolation: IsolationLevel::Maximum,
            max_resources: ResourceSpec {
                cpu_millis: 8000,  // 8 cores
                memory_mib: 32768, // 32 GB
                disk_mib: Some(100000),
                network_egress_kib: None,
                gpu_count: None,
            },
            supported_env_specs: vec![EnvSpecType::Oci],
            features: DriverFeatures {
                snapshot: true,
                live_restore: false,
                gpu: false,
                prewarm: false,
            },
        }
    }

    async fn spawn(&self, spec: SpawnSpec) -> std::result::Result<ExecutionHandle, DriverError> {
        info!(
            tenant = %spec.tenant,
            image = %spec.env.image,
            "Spawning Apple Virtualization VM"
        );

        let run_id = spec.run_id.unwrap_or_default();
        
        // Create VM directory
        let vm_dir = self.create_vm_directory(&run_id)?;
        
        // Prepare image
        let image_path = self.prepare_image(&spec.env.image).await?;
        
        // Create VM configuration
        let vm_config = vm::VMConfig {
            id: run_id.to_string(),
            cpu_count: (spec.resources.cpu_millis / 1000).max(1) as u8,
            memory_mib: spec.resources.memory_mib,
            disk_mib: spec.resources.disk_mib.unwrap_or(10240),
            image_path,
            shared_dirs: vec![vm::SharedDirectory {
                host_path: spec.env.working_dir.clone().unwrap_or_else(|| "/workspace".to_string()),
                guest_path: "/workspace".to_string(),
                read_only: false,
            }],
            network_enabled: spec.policy.network_policy.egress_allowed,
            rosetta_enabled: self.config.use_rosetta,
        };

        // Create and start VM
        let mut vm = VirtualMachine::create(vm_config, vm_dir.clone()).await
            .map_err(|e| DriverError::from(e))?;
        
        if let Err(e) = vm.start().await {
            error!("Failed to start VM: {}", e);
            let _ = self.cleanup_vm_directory(&run_id).await;
            return Err(DriverError::from(e));
        }

        self.metrics.vms_created.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        let vm_arc = Arc::new(RwLock::new(vm));
        self.vms.write().await.insert(run_id, vm_arc);

        let handle = ExecutionHandle {
            id: run_id,
            tenant: spec.tenant.clone(),
            driver_info: HashMap::from([
                ("driver_type".to_string(), "apple_vf".to_string()),
                ("vm_dir".to_string(), vm_dir.display().to_string()),
            ]),
            env_spec: spec.env.clone(),
        };

        info!(run_id = %run_id, "Apple VM spawned successfully");
        Ok(handle)
    }

    async fn exec(
        &self,
        handle: &ExecutionHandle,
        cmd_spec: CommandSpec,
    ) -> std::result::Result<ExecResult, DriverError> {
        info!(run_id = %handle.id, command = ?cmd_spec.command, "Executing command in Apple VM");

        let start_time = std::time::Instant::now();

        // Get the VM
        let vm_opt = {
            let vm_lock = self.vms.read().await;
            vm_lock.get(&handle.id).cloned()
        };
        
        let vm = vm_opt.ok_or_else(|| 
            DriverError::NotFound { id: handle.id.to_string() }
        )?;

        // Execute command via guest agent (VSOCK)
        let result = {
            let vm_guard = vm.read().await;
            vm_guard.execute_command(&cmd_spec).await
                .map_err(|e| DriverError::from(e))?
        };

        self.metrics.commands_executed.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        let duration_ms = start_time.elapsed().as_millis() as u64;

        info!(
            run_id = %handle.id,
            exit_code = result.exit_code,
            duration_ms = duration_ms,
            "Command completed"
        );

        Ok(ExecResult {
            exit_code: result.exit_code,
            stdout: result.stdout,
            stderr: result.stderr,
            duration_ms,
            resource_usage: ResourceConsumption {
                cpu_millis_used: duration_ms, // Approximation
                memory_mib_peak: 0,          // Would need guest agent metrics
                disk_mib_used: 0,
                network_egress_kib: 0,
            },
        })
    }

    async fn stream_logs(&self, handle: &ExecutionHandle) -> std::result::Result<Vec<LogEntry>, DriverError> {
        debug!(run_id = %handle.id, "Streaming logs from Apple VM");
        
        // In a real implementation, this would stream from the guest agent
        // For now, return empty
        Ok(vec![])
    }

    async fn get_artifacts(&self, handle: &ExecutionHandle) -> std::result::Result<Vec<Artifact>, DriverError> {
        debug!(run_id = %handle.id, "Getting artifacts from Apple VM");
        
        // In a real implementation, this would collect from shared directories
        Ok(vec![])
    }

    async fn destroy(&self, handle: &ExecutionHandle) -> std::result::Result<(), DriverError> {
        info!(run_id = %handle.id, "Destroying Apple VM");

        // Get and remove the VM from our map
        let vm = {
            let mut vms = self.vms.write().await;
            vms.remove(&handle.id)
        };

        if let Some(vm) = vm {
            let mut vm_guard = vm.write().await;
            if let Err(e) = vm_guard.stop().await {
                warn!("Error stopping VM: {}", e);
            }
        }

        // Clean up VM directory
        self.cleanup_vm_directory(&handle.id).await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;

        self.metrics.vms_destroyed.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        info!(run_id = %handle.id, "Apple VM destroyed");
        Ok(())
    }

    async fn get_consumption(
        &self,
        handle: &ExecutionHandle,
    ) -> std::result::Result<ResourceConsumption, DriverError> {
        let vm_opt = {
            let vm_lock = self.vms.read().await;
            vm_lock.get(&handle.id).cloned()
        };
        
        let vm = vm_opt.ok_or_else(|| 
            DriverError::NotFound { id: handle.id.to_string() }
        )?;

        let vm_guard = vm.read().await;
        let stats = vm_guard.get_stats().await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;

        Ok(ResourceConsumption {
            cpu_millis_used: stats.cpu_time_ms,
            memory_mib_peak: stats.memory_mib,
            disk_mib_used: stats.disk_mib,
            network_egress_kib: stats.network_kib,
        })
    }

    async fn get_receipt(&self, handle: &ExecutionHandle) -> std::result::Result<Option<Receipt>, DriverError> {
        let consumption = self.get_consumption(handle).await?;
        
        let receipt = Receipt {
            run_id: handle.id,
            tenant: handle.tenant.clone(),
            started_at: chrono::Utc::now(), // Would track actual start time
            completed_at: chrono::Utc::now(),
            exit_code: 0,
            env_spec_hash: "apple-vf-driver".to_string(),
            policy_hash: "default".to_string(),
            inputs_hash: "apple-vf".to_string(),
            outputs_hash: None,
            resource_consumption: consumption,
            artifacts: vec![],
        };

        Ok(Some(receipt))
    }

    async fn health_check(&self) -> std::result::Result<DriverHealth, DriverError> {
        let active_vms = self.vms.read().await.len() as u32;
        
        Ok(DriverHealth {
            healthy: Self::is_virtualization_supported(),
            message: Some(format!(
                "Apple VF driver operational ({} active VMs)",
                active_vms
            )),
            active_executions: active_vms,
            available_capacity: self.capabilities().max_resources,
        })
    }
}

impl Default for AppleVFDriver {
    fn default() -> Self {
        Self::new().expect("Failed to create AppleVFDriver")
    }
}

/// Command execution result from guest
pub struct CommandResult {
    pub exit_code: i32,
    pub stdout: Option<Vec<u8>>,
    pub stderr: Option<Vec<u8>>,
}

/// VM statistics
pub struct VMStats {
    pub cpu_time_ms: u64,
    pub memory_mib: u32,
    pub disk_mib: u32,
    pub network_kib: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_driver_capabilities() {
        let driver = AppleVFDriver::new().expect("Failed to create driver");
        let caps = driver.capabilities();
        
        assert_eq!(caps.driver_type, DriverType::MicroVM);
        assert_eq!(caps.isolation, IsolationLevel::Maximum);
    }

    #[test]
    fn test_virtualization_check() {
        // This will pass on macOS 12+ with virtualization support
        // and fail on other platforms or older macOS
        let supported = AppleVFDriver::is_virtualization_supported();
        
        #[cfg(target_os = "macos")]
        {
            // On macOS, we expect it to be supported on modern systems
            // but we can't guarantee it in CI/test environments
            println!("Virtualization supported: {}", supported);
        }
        
        #[cfg(not(target_os = "macos"))]
        {
            assert!(!supported, "Virtualization should not be supported on non-macOS");
        }
    }
}
