//! Local session management - executes commands directly on host
//!
//! This is a fallback mode when no VM is available (e.g., desktop app not running).
//! It provides minimal isolation using bubblewrap if available, or direct execution.

use async_trait::async_trait;
use tracing::{debug, info, warn};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

use a2r_session_manager::types::{Session, SessionSpec, SessionId, SessionStatus};
use a2r_session_manager::{SessionManager as CoreSessionManager, ManagerConfig};
use a2r_driver_interface::ExecResult;

use crate::config::Config;
use crate::error::{CliError, Result};
use super::CliSession;

/// Local session - executes commands directly on host using SessionManager
pub struct LocalSession {
    #[allow(dead_code)]
    config: Config,
    use_bwrap: bool,
    /// Core session manager for persistence
    session_manager: Arc<CoreSessionManager>,
}

impl LocalSession {
    /// Create a new local session
    pub async fn new(config: Config) -> Result<Self> {
        // Check if bubblewrap is available
        let bwrap_check = Command::new("which")
            .arg("bwrap")
            .output()
            .await;
        
        let use_bwrap = matches!(bwrap_check, Ok(output) if output.status.success());
        
        if use_bwrap {
            info!("Local session using bubblewrap for isolation");
        } else {
            warn!("Local session without bubblewrap (limited isolation)");
        }
        
        // Initialize the core session manager
        let data_dir = dirs::data_dir()
            .map(|d| d.join("a2r"))
            .unwrap_or_else(|| std::path::PathBuf::from("/tmp/a2r"));
        
        // Ensure data directory exists
        tokio::fs::create_dir_all(&data_dir).await
            .map_err(|e| CliError::Internal(format!("Failed to create data dir: {}", e)))?;
        
        let db_path = data_dir.join("sessions.db");
        // Use file:// URL format for paths with spaces
        let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
        
        let manager_config = ManagerConfig {
            database_url: db_url,
            default_working_dir: std::path::PathBuf::from("/workspace"),
            max_sessions: 100,
            cleanup_interval_secs: 60,
            firecracker_config: None,
            #[cfg(target_os = "macos")]
            apple_vf_config: None,
        };
        
        let session_manager = Arc::new(
            CoreSessionManager::new(manager_config).await
                .map_err(|e| CliError::Internal(format!("Failed to create session manager: {}", e)))?
        );
        
        Ok(Self {
            config,
            use_bwrap,
            session_manager,
        })
    }
    
    /// Execute command with optional bubblewrap isolation
    async fn execute_command(
        &self,
        command: Vec<String>,
        env: HashMap<String, String>,
        timeout_secs: Option<u64>,
    ) -> Result<ExecResult> {
        if command.is_empty() {
            return Err(CliError::ExecutionFailed {
                message: "Empty command".to_string(),
                exit_code: -1,
            });
        }
        
        let start = std::time::Instant::now();
        
        let output = if self.use_bwrap {
            // Use bubblewrap for isolation
            let mut cmd = Command::new("bwrap");
            cmd.arg("--unshare-user")
                .arg("--unshare-pid")
                .arg("--unshare-ipc")
                .arg("--uid").arg("1000")
                .arg("--gid").arg("1000")
                .arg("--proc").arg("/proc")
                .arg("--dev").arg("/dev")
                .arg("--tmpfs").arg("/tmp")
                .arg("--ro-bind").arg("/bin").arg("/bin")
                .arg("--ro-bind").arg("/lib").arg("/lib")
                .arg("--ro-bind").arg("/usr").arg("/usr")
                .arg("--ro-bind").arg("/etc").arg("/etc")
                .arg("--bind").arg(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/"))).arg("/workspace")
                .arg("--chdir").arg("/workspace");
            
            for (key, value) in &env {
                cmd.arg("--setenv").arg(key).arg(value);
            }
            
            cmd.arg(&command[0])
                .args(&command[1..])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true);
            
            if let Some(secs) = timeout_secs {
                match timeout(Duration::from_secs(secs), cmd.output()).await {
                    Ok(Ok(output)) => output,
                    Ok(Err(e)) => {
                        return Err(CliError::ExecutionFailed {
                            message: format!("Failed to execute: {}", e),
                            exit_code: -1,
                        });
                    }
                    Err(_) => {
                        return Err(CliError::ExecutionFailed {
                            message: "Command timed out".to_string(),
                            exit_code: 124,
                        });
                    }
                }
            } else {
                cmd.output().await
                    .map_err(|e| CliError::ExecutionFailed {
                        message: format!("Failed to execute: {}", e),
                        exit_code: -1,
                    })?
            }
        } else {
            // Direct execution without isolation
            let mut cmd = Command::new(&command[0]);
            cmd.args(&command[1..])
                .envs(&env)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true);
            
            if let Some(secs) = timeout_secs {
                match timeout(Duration::from_secs(secs), cmd.output()).await {
                    Ok(Ok(output)) => output,
                    Ok(Err(e)) => {
                        return Err(CliError::ExecutionFailed {
                            message: format!("Failed to execute: {}", e),
                            exit_code: -1,
                        });
                    }
                    Err(_) => {
                        return Err(CliError::ExecutionFailed {
                            message: "Command timed out".to_string(),
                            exit_code: 124,
                        });
                    }
                }
            } else {
                cmd.output().await
                    .map_err(|e| CliError::ExecutionFailed {
                        message: format!("Failed to execute: {}", e),
                        exit_code: -1,
                    })?
            }
        };
        
        let duration_ms = start.elapsed().as_millis() as u64;
        
        Ok(ExecResult {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: Some(output.stdout),
            stderr: Some(output.stderr),
            duration_ms,
            resource_usage: a2r_driver_interface::ResourceConsumption::default(),
        })
    }
}

#[async_trait]
impl CliSession for LocalSession {
    async fn create_session(&self, spec: SessionSpec) -> Result<Session> {
        debug!("Creating local session with spec: {:?}", spec);
        
        // Use the core session manager for persistence
        let session = self.session_manager.create_session(spec).await
            .map_err(|e| CliError::Session(format!("Failed to create session: {}", e)))?;
        
        Ok(session)
    }
    
    async fn exec(
        &self,
        session: &Session,
        command: Vec<String>,
        env: HashMap<String, String>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecResult> {
        debug!("Executing command locally: {:?}", command);
        
        // Execute the command
        let timeout_secs = timeout_ms.map(|ms| ms / 1000);
        let result = self.execute_command(command, env, timeout_secs).await;
        
        // Update session activity
        if result.is_ok() {
            // Session manager automatically updates on exec
        }
        
        result
    }
    
    async fn list_sessions(&self) -> Result<Vec<Session>> {
        // Query the core session manager
        self.session_manager.list_sessions().await
            .map_err(|e| CliError::Session(format!("Failed to list sessions: {}", e)))
    }
    
    async fn destroy_session(&self, session_id: SessionId) -> Result<()> {
        debug!("Destroying session {}", session_id);
        
        self.session_manager.destroy_session(session_id, false).await
            .map_err(|e| CliError::Session(format!("Failed to destroy session: {}", e)))
    }
    
    async fn cleanup(&self) -> Result<()> {
        debug!("Local session cleanup (nothing to do)");
        Ok(())
    }
}
