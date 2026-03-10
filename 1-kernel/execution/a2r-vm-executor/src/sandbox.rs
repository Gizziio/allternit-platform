//! Sandbox environment for command execution
//!
//! Uses bubblewrap (bwrap) to create isolated execution environments.
//! This provides namespace isolation, filesystem restrictions, and resource limits.

use crate::config::SandboxConfig;
use anyhow::{Context, Result};
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, info, warn};

/// Sandbox environment manager
pub struct Sandbox {
    config: SandboxConfig,
}

/// Result of command execution
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

impl Sandbox {
    /// Create new sandbox environment
    pub async fn new(config: SandboxConfig) -> Result<Self> {
        // Verify bubblewrap is available
        if config.use_bubblewrap {
            let bwrap_check = Command::new(&config.bwrap_path)
                .arg("--version")
                .output()
                .await;

            match bwrap_check {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    info!("Bubblewrap available: {}", version.trim());
                }
                _ => {
                    warn!(
                        "Bubblewrap not found at {:?}, falling back to direct execution",
                        config.bwrap_path
                    );
                }
            }
        }

        Ok(Self { config })
    }

    /// Execute a command in the sandbox
    pub async fn execute(
        &self,
        command: &str,
        args: &[String],
        working_dir: Option<&PathBuf>,
    ) -> Result<ExecutionResult> {
        if self.config.use_bubblewrap {
            self.execute_with_bwrap(command, args, working_dir).await
        } else {
            self.execute_direct(command, args, working_dir).await
        }
    }

    /// Execute command with bubblewrap sandboxing
    async fn execute_with_bwrap(
        &self,
        command: &str,
        args: &[String],
        working_dir: Option<&PathBuf>,
    ) -> Result<ExecutionResult> {
        let mut cmd = Command::new(&self.config.bwrap_path);

        // Set up sandbox environment
        
        // Create new namespaces
        cmd.arg("--unshare-all");
        
        // Share network if needed
        match self.config.network {
            crate::config::NetworkMode::Host => {
                // Don't unshare network
            }
            crate::config::NetworkMode::None => {
                cmd.arg("--unshare-net");
            }
            crate::config::NetworkMode::Isolated => {
                // Create network namespace but set up basic connectivity
                cmd.arg("--unshare-net");
                // Could add --share-net with specific interface here
            }
        }

        // Set up /proc and /dev
        cmd.arg("--proc").arg("/proc");
        cmd.arg("--dev").arg("/dev");

        // Set up /tmp
        cmd.arg("--tmpfs").arg("/tmp");

        // Bind mounts
        for mount in &self.config.default_mounts {
            let arg = if mount.read_only {
                "--ro-bind"
            } else {
                "--bind"
            };
            cmd.arg(arg)
                .arg(&mount.source)
                .arg(&mount.destination);
        }

        // Set up working directory
        let work_dir = working_dir
            .cloned()
            .or_else(|| Some(self.config.default_mounts.first()?.destination.clone()))
            .unwrap_or_else(|| "/workspace".into());
        
        cmd.arg("--chdir").arg(&work_dir);

        // Set resource limits
        if self.config.max_memory_mb > 0 {
            // Note: bubblewrap doesn't directly support memory limits
            // This would need to be combined with cgroups
            cmd.arg("--die-with-parent");
        }

        // Read-only root if configured
        if self.config.read_only_root {
            cmd.arg("--remount-ro").arg("/");
        }

        // Clear environment and set safe defaults
        cmd.arg("--clearenv");
        cmd.arg("--setenv").arg("HOME").arg("/tmp");
        cmd.arg("--setenv").arg("PATH").arg("/usr/local/bin:/usr/bin:/bin");
        cmd.arg("--setenv").arg("TERM").arg("xterm-256color");

        // Add any additional environment variables
        if let Ok(lang) = std::env::var("LANG") {
            cmd.arg("--setenv").arg("LANG").arg(lang);
        }

        // Set the command to execute
        cmd.arg(command);
        cmd.args(args);

        debug!("Running bubblewrap command: {:?}", cmd);

        // Execute
        let output = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .with_context(|| format!("Failed to execute bubblewrap for command: {}", command))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        debug!(
            "Command '{}' completed with exit code {} (stdout: {} bytes, stderr: {} bytes)",
            command,
            exit_code,
            stdout.len(),
            stderr.len()
        );

        Ok(ExecutionResult {
            stdout,
            stderr,
            exit_code,
        })
    }

    /// Execute command directly without sandboxing (fallback)
    async fn execute_direct(
        &self,
        command: &str,
        args: &[String],
        working_dir: Option<&PathBuf>,
    ) -> Result<ExecutionResult> {
        warn!("Executing command without sandbox: {}", command);

        let mut cmd = Command::new(command);
        cmd.args(args);

        if let Some(dir) = working_dir {
            cmd.current_dir(dir);
        }

        let output = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .with_context(|| format!("Failed to execute command: {}", command))?;

        Ok(ExecutionResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
        })
    }

    /// Get the sandbox configuration
    pub fn config(&self) -> &SandboxConfig {
        &self.config
    }
}

impl From<&crate::config::ExecutorConfig> for SandboxConfig {
    fn from(config: &crate::config::ExecutorConfig) -> Self {
        config.sandbox.clone()
    }
}
