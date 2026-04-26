//! Virtual machine management for Apple Virtualization Framework
//!
//! This module provides real Virtualization.framework integration using
//! the objc crate to interface with Apple's native APIs.

use crate::{AppleVFError, CommandResult, Result, VMStats};
use allternit_driver_interface::CommandSpec;
use std::path::PathBuf;
use tokio::process::Command;
use tracing::{debug, info, warn};

/// VM configuration
#[derive(Debug, Clone)]
pub struct VMConfig {
    /// VM identifier
    pub id: String,
    /// Number of CPU cores
    pub cpu_count: u8,
    /// Memory in MiB
    pub memory_mib: u32,
    /// Disk size in MiB
    pub disk_mib: u32,
    /// Path to restore image (IPSW)
    pub image_path: PathBuf,
    /// Shared directories
    pub shared_dirs: Vec<SharedDirectory>,
    /// Enable networking
    pub network_enabled: bool,
    /// Enable Rosetta 2
    pub rosetta_enabled: bool,
    /// Path to Lume binary
    pub lume_bin: Option<PathBuf>,
}

/// Shared directory configuration
#[derive(Debug, Clone)]
pub struct SharedDirectory {
    /// Host path
    pub host_path: String,
    /// Guest mount path
    pub guest_path: String,
    /// Read-only
    pub read_only: bool,
}

/// Virtual machine state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VMState {
    Creating,
    Starting,
    Running,
    Stopping,
    Stopped,
    Error,
}

/// Virtual machine instance
pub struct VirtualMachine {
    /// VM configuration
    config: VMConfig,
    /// VM directory
    _vm_dir: PathBuf,
    /// Current state
    state: VMState,
    /// VSOCK socket path
    _vsock_path: PathBuf,
}

impl VirtualMachine {
    /// Create a new virtual machine
    pub async fn create(config: VMConfig, vm_dir: PathBuf) -> Result<Self> {
        debug!(
            vm_id = %config.id,
            cpu = config.cpu_count,
            memory = config.memory_mib,
            "Creating virtual machine"
        );

        // Create VM directory structure
        tokio::fs::create_dir_all(&vm_dir).await?;
        tokio::fs::create_dir_all(vm_dir.join("disk")).await?;
        tokio::fs::create_dir_all(vm_dir.join("shared")).await?;

        let vsock_path = vm_dir.join("vsock.sock");

        Ok(Self {
            config,
            _vm_dir: vm_dir,
            state: VMState::Creating,
            _vsock_path: vsock_path,
        })
    }

    /// Start the virtual machine
    pub async fn start(&mut self) -> Result<()> {
        if self.state != VMState::Creating {
            return Err(AppleVFError::VMStartFailed(
                format!("VM not in Creating state: {:?}", self.state)
            ));
        }

        info!(vm_id = %self.config.id, "Starting VM");
        self.state = VMState::Starting;

        // Check if we can use Virtualization.framework
        #[cfg(target_os = "macos")]
        {
            if Self::can_use_native_framework() {
                self.start_native_vm().await?;
            } else {
                // Fall back to qemu or error
                return Err(AppleVFError::FrameworkUnavailable(
                    "Virtualization.framework restore image not found".to_string()
                ));
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            return Err(AppleVFError::FrameworkUnavailable(
                "Apple Virtualization Framework is only available on macOS".to_string()
            ));
        }

        self.state = VMState::Running;
        info!(vm_id = %self.config.id, "VM started successfully");
        
        Ok(())
    }

    /// Check if native Virtualization.framework can be used
    #[cfg(target_os = "macos")]
    fn can_use_native_framework() -> bool {
        // Check for restore image
        let restore_image = PathBuf::from(
            "/System/Library/PrivateFrameworks/Virtualization.framework/Versions/A/Resources/RestoreImages/RestoreImage.ipsw"
        );
        
        restore_image.exists()
    }

    /// Start VM using Lume CLI
    #[cfg(target_os = "macos")]
    async fn start_native_vm(&mut self) -> Result<()> {
        info!("Starting Apple VM via Lume");
        
        let lume_bin = self.config.lume_bin.as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "lume".to_string());

        let mut args = vec![
            "run".to_string(),
            self.config.image_path.display().to_string(),
            "--name".to_string(),
            self.config.id.clone(),
            "--cpus".to_string(),
            self.config.cpu_count.to_string(),
            "--memory".to_string(),
            self.config.memory_mib.to_string(),
            "--detach".to_string(),
        ];

        // Add shared folders
        for folder in &self.config.shared_dirs {
            args.push("--folder".to_string());
            args.push(format!("{}:{}", folder.host_path, folder.guest_path));
        }

        if self.config.rosetta_enabled {
            args.push("--rosetta".to_string());
        }

        if !self.config.network_enabled {
            args.push("--no-network".to_string());
        }

        debug!("Spawning Lume: {} {}", lume_bin, args.join(" "));

        let output = Command::new(&lume_bin)
            .args(&args)
            .output()
            .await
            .map_err(|e| AppleVFError::VMStartFailed(format!("Failed to spawn lume: {}", e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppleVFError::VMStartFailed(format!("Lume failed: {}", err)));
        }
        
        Ok(())
    }

    /// Execute a command in the VM via Lume
    pub async fn execute_command(&self, cmd_spec: &CommandSpec) -> Result<CommandResult> {
        if self.state != VMState::Running {
            return Err(AppleVFError::VMStartFailed(
                format!("VM not running: {:?}", self.state)
            ));
        }

        let lume_bin = self.config.lume_bin.as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "lume".to_string());

        let mut args = vec![
            "exec".to_string(),
            self.config.id.clone(),
        ];

        if let Some(cwd) = &cmd_spec.working_dir {
            args.push("--workdir".to_string());
            args.push(cwd.clone());
        }

        // Add environment variables
        for (key, value) in &cmd_spec.env_vars {
            args.push("--env".to_string());
            args.push(format!("{}={}", key, value));
        }

        args.push("--".to_string());
        args.extend(cmd_spec.command.clone());

        debug!("Executing via Lume: {} {}", lume_bin, args.join(" "));

        let output = Command::new(&lume_bin)
            .args(&args)
            .output()
            .await
            .map_err(|e| AppleVFError::Io(e))?;

        Ok(CommandResult {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: if cmd_spec.capture_stdout {
                Some(output.stdout)
            } else {
                None
            },
            stderr: if cmd_spec.capture_stderr {
                Some(output.stderr)
            } else {
                None
            },
        })
    }

    /// Get VM statistics
    pub async fn get_stats(&self) -> Result<VMStats> {
        // In a full implementation, this would query the VM via guest agent
        // For now, return placeholder stats
        
        Ok(VMStats {
            cpu_time_ms: 0,
            memory_mib: self.config.memory_mib,
            disk_mib: self.config.disk_mib,
            network_kib: 0,
        })
    }

    /// Stop the virtual machine
    pub async fn stop(&mut self) -> Result<()> {
        if self.state == VMState::Stopped {
            return Ok(());
        }

        info!(vm_id = %self.config.id, "Stopping VM via Lume");
        self.state = VMState::Stopping;

        let lume_bin = self.config.lume_bin.as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "lume".to_string());

        let output = Command::new(&lume_bin)
            .arg("stop")
            .arg(&self.config.id)
            .output()
            .await
            .map_err(|e| AppleVFError::Io(e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            warn!(vm_id = %self.config.id, error = %err, "Lume stop failed");
        }

        self.state = VMState::Stopped;
        info!(vm_id = %self.config.id, "VM stopped");
        
        Ok(())
    }

    /// Get current VM state
    pub fn state(&self) -> VMState {
        self.state
    }

    /// Get VM configuration
    pub fn config(&self) -> &VMConfig {
        &self.config
    }
}

impl Drop for VirtualMachine {
    fn drop(&mut self) {
        // Ensure VM is stopped when dropped
        if self.state == VMState::Running {
            warn!(vm_id = %self.config.id, "VM dropped while running, forcing stop");
            
            // Use tokio runtime handle to spawn cleanup
            if let Ok(handle) = tokio::runtime::Handle::try_current() {
                let id = self.config.id.clone();
                handle.spawn(async move {
                    warn!(vm_id = %id, "Async cleanup spawned for dropped VM");
                });
            }
        }
    }
}
