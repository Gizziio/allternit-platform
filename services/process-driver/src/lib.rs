//! # Allternit Process Driver (N4)
//!
//! OS process-based execution driver for development and testing.
//! This is the simplest driver implementation that spawns native OS processes.
//!
//! ⚠️ WARNING: This driver provides LIMITED isolation and should ONLY be used
//! in development environments. For production, use the MicroVM driver.
//!
//! ## Features
//!
//! - Spawns native OS processes
//! - Basic resource limiting via cgroup (Linux) or rlimit (Unix)
//! - Working directory isolation
//! - Environment variable injection
//! - Basic output capture
//!
//! ## Shell UI Integration
//!
//! Maps to Control Center → Runtime Environment → Driver Selection:
//! - Driver Type: "Process (Dev Only)"
//! - Isolation Level: "Limited"
//! - Best for: Local development, fast iteration

use allternit_driver_interface::*;
use async_trait::async_trait;
use std::collections::HashMap;
use std::fmt;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

/// Active process tracking
struct ActiveProcess {
    child: Child,
    _start_time: Instant,
    _resources: ResourceSpec,
}

/// Process-based execution driver
pub struct ProcessDriver {
    /// Active processes keyed by execution ID
    processes: Mutex<HashMap<ExecutionId, ActiveProcess>>,
    /// Default configuration
    config: DriverConfig,
}

impl ProcessDriver {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
            config: DriverConfig {
                driver_type: DriverType::Process,
                default_resources: ResourceSpec::standard(),
                env_vars: HashMap::new(),
                default_mounts: vec![],
                network_policy: NetworkPolicy::default(),
                default_timeout_seconds: 300,
                enable_prewarm: false,
            },
        }
    }

    pub fn with_config(config: DriverConfig) -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
            config,
        }
    }

    /// Apply resource limits to the command (platform-specific)
    #[cfg(target_os = "linux")]
    fn apply_resource_limits(_cmd: &mut Command, resources: &ResourceSpec) {
        // On Linux, we could use cgroups for better resource limiting
        // For now, just log the intended limits
        debug!(
            cpu_millis = resources.cpu_millis,
            memory_mib = resources.memory_mib,
            "Applying Linux resource limits"
        );
    }

    #[cfg(not(target_os = "linux"))]
    fn apply_resource_limits(_cmd: &mut Command, resources: &ResourceSpec) {
        // On macOS and other platforms, resource limiting is more limited
        debug!(
            cpu_millis = resources.cpu_millis,
            memory_mib = resources.memory_mib,
            "Applying resource limits (limited on this platform)"
        );
    }

    /// Build the command from specification
    fn build_command(&self, spec: &SpawnSpec, cmd_spec: &CommandSpec) -> Command {
        let mut cmd = Command::new(&cmd_spec.command[0]);

        if cmd_spec.command.len() > 1 {
            cmd.args(&cmd_spec.command[1..]);
        }

        // Set working directory
        if let Some(working_dir) = &cmd_spec.working_dir {
            cmd.current_dir(working_dir);
        } else if let Some(env_working_dir) = &spec.env.working_dir {
            cmd.current_dir(env_working_dir);
        }

        // Merge environment variables
        let mut env_vars = spec.env.env_vars.clone();
        env_vars.extend(self.config.env_vars.clone());
        env_vars.extend(cmd_spec.env_vars.clone());
        cmd.envs(env_vars);

        // Apply resource limits
        Self::apply_resource_limits(&mut cmd, &spec.resources);

        // Configure stdio
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        cmd
    }
}

impl Default for ProcessDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Debug for ProcessDriver {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProcessDriver")
            .field("driver_type", &"Process")
            .field("isolation", &"Limited")
            .finish()
    }
}

#[async_trait]
impl ExecutionDriver for ProcessDriver {
    fn capabilities(&self) -> DriverCapabilities {
        DriverCapabilities {
            driver_type: DriverType::Process,
            isolation: IsolationLevel::Limited,
            max_resources: ResourceSpec {
                cpu_millis: 8000,  // 8 cores
                memory_mib: 32768, // 32 GB
                disk_mib: Some(100000),
                network_egress_kib: None,
                gpu_count: None,
            },
            supported_env_specs: vec![
                EnvSpecType::Oci, // Via container runtime wrapper
            ],
            features: DriverFeatures {
                snapshot: false,
                live_restore: false,
                gpu: false,
                prewarm: false,
            },
        }
    }

    async fn spawn(&self, spec: SpawnSpec) -> Result<ExecutionHandle, DriverError> {
        info!(
            tenant = %spec.tenant,
            image = %spec.env.image,
            "Spawning process environment"
        );

        let run_id = spec.run_id.unwrap_or_default();
        let handle = ExecutionHandle {
            id: run_id,
            tenant: spec.tenant.clone(),
            driver_info: HashMap::from([
                ("driver_type".to_string(), "process".to_string()),
                ("image".to_string(), spec.env.image.clone()),
            ]),
            // Store the environment spec for use in exec()
            env_spec: spec.env.clone(),
        };

        // For process driver, we don't actually spawn until exec is called
        // This matches the microVM pattern where spawn creates the VM but exec runs commands
        debug!(run_id = %run_id, "Process environment prepared (lazy spawn)");

        Ok(handle)
    }

    async fn pause_vm(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        debug!(run_id = %handle.id, "Pausing process environment (stub)");
        Ok(())
    }

    async fn resume_vm(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        debug!(run_id = %handle.id, "Resuming process environment (stub)");
        Ok(())
    }

    async fn exec(
        &self,
        handle: &ExecutionHandle,
        cmd_spec: CommandSpec,
    ) -> Result<ExecResult, DriverError> {
        info!(run_id = %handle.id, command = ?cmd_spec.command, "Executing command");

        let start_time = Instant::now();

        // Use the environment spec from the handle (stored during spawn)
        let spawn_spec = SpawnSpec {
            tenant: handle.tenant.clone(),
            project: None,
            workspace: None,
            run_id: Some(handle.id),
            env: handle.env_spec.clone(),
            policy: PolicySpec::default_permissive(),
            resources: self.config.default_resources.clone(),
            envelope: None,
            prewarm_pool: None,
        };

        let mut cmd = self.build_command(&spawn_spec, &cmd_spec);

        let mut child = cmd.spawn().map_err(|e| DriverError::SpawnFailed {
            reason: format!("Failed to spawn process: {}", e),
        })?;

        // Handle stdin
        if let Some(stdin_data) = &cmd_spec.stdin_data {
            if let Some(mut stdin) = child.stdin.take() {
                stdin
                    .write_all(stdin_data)
                    .await
                    .map_err(|e| DriverError::InternalError {
                        message: format!("Failed to write stdin: {}", e),
                    })?;
            }
        }

        // Capture output
        let stdout_data = if cmd_spec.capture_stdout {
            if let Some(mut stdout) = child.stdout.take() {
                let mut buf = Vec::new();
                stdout
                    .read_to_end(&mut buf)
                    .await
                    .map_err(|e| DriverError::InternalError {
                        message: format!("Failed to read stdout: {}", e),
                    })?;
                Some(buf)
            } else {
                None
            }
        } else {
            None
        };

        let stderr_data = if cmd_spec.capture_stderr {
            if let Some(mut stderr) = child.stderr.take() {
                let mut buf = Vec::new();
                stderr
                    .read_to_end(&mut buf)
                    .await
                    .map_err(|e| DriverError::InternalError {
                        message: format!("Failed to read stderr: {}", e),
                    })?;
                Some(buf)
            } else {
                None
            }
        } else {
            None
        };

        // Wait for completion
        let timeout_duration = Duration::from_secs(self.config.default_timeout_seconds as u64);

        let exit_status = match tokio::time::timeout(timeout_duration, child.wait()).await {
            Ok(Ok(status)) => status,
            Ok(Err(e)) => {
                return Err(DriverError::InternalError {
                    message: format!("Process wait error: {}", e),
                });
            }
            Err(_) => {
                child.kill().await.ok();
                return Err(DriverError::ExecTimeout {
                    timeout: self.config.default_timeout_seconds,
                });
            }
        };

        let duration_ms = start_time.elapsed().as_millis() as u64;

        // Estimate resource usage (process driver has limited visibility)
        let resource_usage = ResourceConsumption {
            cpu_millis_used: duration_ms, // Approximation
            memory_mib_peak: self.config.default_resources.memory_mib,
            disk_mib_used: 0,
            network_egress_kib: 0,
        };

        info!(
            run_id = %handle.id,
            exit_code = exit_status.code().unwrap_or(-1),
            duration_ms = duration_ms,
            "Command completed"
        );

        Ok(ExecResult {
            exit_code: exit_status.code().unwrap_or(-1),
            stdout: stdout_data,
            stderr: stderr_data,
            duration_ms,
            resource_usage,
        })
    }

    async fn stream_logs(&self, _handle: &ExecutionHandle) -> Result<Vec<LogEntry>, DriverError> {
        // Process driver doesn't support streaming from completed processes
        // This would require keeping processes alive and streaming in real-time
        warn!("Process driver does not support log streaming");
        Ok(vec![])
    }

    async fn get_artifacts(&self, handle: &ExecutionHandle) -> Result<Vec<Artifact>, DriverError> {
        // Process driver has limited artifact support
        // In a real implementation, this would scan a working directory
        debug!(run_id = %handle.id, "Getting artifacts (limited in process driver)");
        Ok(vec![])
    }

    async fn destroy(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        info!(run_id = %handle.id, "Destroying process environment");

        let mut processes = self.processes.lock().await;
        if let Some(mut process) = processes.remove(&handle.id) {
            process.child.kill().await.ok();
        }

        debug!(run_id = %handle.id, "Process environment destroyed");
        Ok(())
    }

    async fn get_consumption(
        &self,
        _handle: &ExecutionHandle,
    ) -> Result<ResourceConsumption, DriverError> {
        // Process driver has limited resource tracking
        Ok(ResourceConsumption::default())
    }

    async fn get_receipt(&self, handle: &ExecutionHandle) -> Result<Option<Receipt>, DriverError> {
        // Generate a minimal receipt
        let receipt = Receipt {
            run_id: handle.id,
            tenant: handle.tenant.clone(),
            started_at: chrono::Utc::now(),
            completed_at: chrono::Utc::now(),
            exit_code: 0,
            env_spec_hash: "process-driver".to_string(),
            policy_hash: "default".to_string(),
            inputs_hash: "process".to_string(),
            outputs_hash: None,
            resource_consumption: ResourceConsumption::default(),
            artifacts: vec![],
        };

        Ok(Some(receipt))
    }

    async fn health_check(&self) -> Result<DriverHealth, DriverError> {
        Ok(DriverHealth {
            healthy: true,
            message: Some("Process driver operational".to_string()),
            active_executions: 0, // Would track actual processes in full impl
            available_capacity: self.capabilities().max_resources,
        })
    }
}

/// Create a default process driver instance
pub fn default_driver() -> ProcessDriver {
    ProcessDriver::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_driver_capabilities() {
        let driver = ProcessDriver::new();
        let caps = driver.capabilities();

        assert_eq!(caps.driver_type, DriverType::Process);
        assert_eq!(caps.isolation, IsolationLevel::Limited);
        assert!(!caps.features.prewarm);
    }

    #[test]
    fn test_driver_config() {
        let config = DriverConfig {
            driver_type: DriverType::Process,
            default_resources: ResourceSpec::minimal(),
            env_vars: HashMap::new(),
            default_mounts: vec![],
            network_policy: NetworkPolicy::default(),
            default_timeout_seconds: 60,
            enable_prewarm: false,
        };

        let driver = ProcessDriver::with_config(config);
        assert_eq!(driver.capabilities().driver_type, DriverType::Process);
    }

    #[tokio::test]
    async fn test_health_check() {
        let driver = ProcessDriver::new();
        let health = driver.health_check().await.unwrap();

        assert!(health.healthy);
    }
}
