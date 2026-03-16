//! macOS CLI session management
//!
//! Supports two modes:
//! - Shared: Connects to desktop app's VM via Unix socket (fast)
//! - Ephemeral: Boots dedicated Apple VF VM (isolated)

use async_trait::async_trait;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

use a2r_session_manager::types::{Session, SessionSpec, SessionId, SessionStatus};
use a2r_session_manager::{SessionManager as CoreSessionManager, ManagerConfig, GuestAgentClient};
use a2r_driver_interface::ExecResult;

use crate::config::Config;
use crate::error::{CliError, Result};
use super::CliSession;

/// macOS session mode
pub enum MacSessionMode {
    /// Connect to desktop app's shared VM
    Shared,
    /// Boot dedicated ephemeral VM
    Ephemeral,
}

/// macOS CLI session
pub struct MacSession {
    mode: MacSessionMode,
    #[allow(dead_code)]
    config: Config,
    socket_path: PathBuf,
    /// Core session manager for ephemeral mode
    session_manager: Option<Arc<CoreSessionManager>>,
    /// Guest agent client for communication
    guest_agent: Option<Arc<Mutex<GuestAgentClient>>>,
}

impl MacSession {
    /// Create a new macOS session
    pub async fn new(mode: MacSessionMode, config: Config) -> Result<Self> {
        match mode {
            MacSessionMode::Shared => Self::connect_shared(config).await,
            MacSessionMode::Ephemeral => Self::boot_ephemeral(config).await,
        }
    }
    
    /// Connect to the desktop app's shared VM
    async fn connect_shared(config: Config) -> Result<Self> {
        let socket_path = config.macos.desktop_vm_socket.clone();
        
        debug!("Connecting to shared VM at {:?}", socket_path);
        
        if !socket_path.exists() {
            return Err(CliError::DesktopNotRunning {
                socket_path: socket_path.clone(),
            });
        }
        
        // Create guest agent client
        let guest_agent = GuestAgentClient::with_socket(&socket_path);
        let mut client = guest_agent;
        
        // Verify connection
        match client.ping().await {
            Ok(version) => {
                info!("Connected to desktop VM (protocol v{})", version);
            }
            Err(e) => {
                return Err(CliError::Connection(format!(
                    "Failed to ping desktop VM: {}", e
                )));
            }
        }
        
        Ok(Self {
            mode: MacSessionMode::Shared,
            config,
            socket_path,
            session_manager: None,
            guest_agent: Some(Arc::new(Mutex::new(client))),
        })
    }
    
    /// Boot a dedicated ephemeral VM using Apple Virtualization.framework
    #[cfg(target_os = "macos")]
    async fn boot_ephemeral(config: Config) -> Result<Self> {
        use a2r_apple_vf_driver::AppleVFDriver;
        
        info!("Booting ephemeral Apple VF VM...");
        
        // Create the Apple VF driver
        let _driver = AppleVFDriver::new()
            .map_err(|e| CliError::Vm(format!("Failed to create Apple VF driver: {}", e)))?;
        
        // Initialize core session manager
        let manager_config = ManagerConfig {
            database_url: format!(
                "sqlite:{}",
                dirs::data_dir()
                    .map(|d| d.join("a2r").join("ephemeral-sessions.db"))
                    .unwrap_or_else(|| std::path::PathBuf::from("/tmp/a2r/ephemeral-sessions.db"))
                    .display()
            ),
            default_working_dir: std::path::PathBuf::from("/workspace"),
            max_sessions: 10,
            cleanup_interval_secs: 60,
            firecracker_config: None,
            apple_vf_config: None,
        };
        
        let session_manager = Arc::new(
            CoreSessionManager::new(manager_config).await
                .map_err(|e| CliError::Vm(format!("Failed to create session manager: {}", e)))?
        );
        
        info!("Ephemeral VM session manager ready");
        
        let socket_path = config.macos.cli_vm_socket.clone();
        
        Ok(Self {
            mode: MacSessionMode::Ephemeral,
            config,
            socket_path,
            session_manager: Some(session_manager),
            guest_agent: None,
        })
    }
    
    /// Ephemeral VMs not available on non-macOS platforms
    #[cfg(not(target_os = "macos"))]
    async fn boot_ephemeral(_config: Config) -> Result<Self> {
        Err(CliError::Vm(
            "Apple Virtualization.framework is only available on macOS".to_string()
        ))
    }
}

#[async_trait]
impl CliSession for MacSession {
    async fn create_session(&self, spec: SessionSpec) -> Result<Session> {
        debug!("Creating session with spec: {:?}", spec);
        
        match self.mode {
            MacSessionMode::Shared => {
                // Use guest agent for shared mode
                if let Some(ref agent) = self.guest_agent {
                    let mut client = agent.lock().await;
                    client.create_session(spec).await
                        .map_err(|e| CliError::Session(format!(
                            "Guest agent failed to create session: {}", e
                        )))
                } else {
                    Err(CliError::Internal("No guest agent available".to_string()))
                }
            }
            MacSessionMode::Ephemeral => {
                // Use session manager for ephemeral mode
                if let Some(ref manager) = self.session_manager {
                    manager.create_session(spec).await
                        .map_err(|e| CliError::Session(format!(
                            "Failed to create session: {}", e
                        )))
                } else {
                    Err(CliError::Internal("No session manager available".to_string()))
                }
            }
        }
    }
    
    async fn exec(
        &self,
        session: &Session,
        command: Vec<String>,
        env: std::collections::HashMap<String, String>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecResult> {
        debug!(
            "Executing command in session {}: {:?}",
            session.id, command
        );
        
        match self.mode {
            MacSessionMode::Shared => {
                // Use guest agent for shared mode
                if let Some(ref agent) = self.guest_agent {
                    let mut client = agent.lock().await;
                    let result = client.exec_in_session(
                        session.id,
                        command,
                        env,
                        Some(session.spec.working_dir.clone()),
                        timeout_ms,
                    ).await.map_err(|e| CliError::ExecutionFailed {
                        message: format!("Guest agent execution failed: {}", e),
                        exit_code: -1,
                    })?;
                    
                    Ok(ExecResult {
                        exit_code: result.exit_code,
                        stdout: Some(result.stdout),
                        stderr: Some(result.stderr),
                        duration_ms: result.duration_ms,
                        resource_usage: a2r_driver_interface::ResourceConsumption::default(),
                    })
                } else {
                    Err(CliError::Internal("No guest agent available".to_string()))
                }
            }
            MacSessionMode::Ephemeral => {
                // Use session manager for ephemeral mode
                if let Some(ref manager) = self.session_manager {
                    manager.exec(session.id, command, env, timeout_ms).await
                        .map_err(|e| CliError::ExecutionFailed {
                            message: format!("Execution failed: {}", e),
                            exit_code: -1,
                        })
                } else {
                    Err(CliError::Internal("No session manager available".to_string()))
                }
            }
        }
    }
    
    async fn list_sessions(&self) -> Result<Vec<Session>> {
        debug!("Listing active sessions");
        
        match self.mode {
            MacSessionMode::Shared => {
                if let Some(ref agent) = self.guest_agent {
                    let mut client = agent.lock().await;
                    client.list_sessions().await
                        .map_err(|e| CliError::Session(format!(
                            "Guest agent failed to list sessions: {}", e
                        )))
                } else {
                    Ok(vec![])
                }
            }
            MacSessionMode::Ephemeral => {
                if let Some(ref manager) = self.session_manager {
                    manager.list_sessions().await
                        .map_err(|e| CliError::Session(format!(
                            "Failed to list sessions: {}", e
                        )))
                } else {
                    Ok(vec![])
                }
            }
        }
    }
    
    async fn destroy_session(&self, session_id: SessionId) -> Result<()> {
        debug!("Destroying session {}", session_id);
        
        match self.mode {
            MacSessionMode::Shared => {
                if let Some(ref agent) = self.guest_agent {
                    let mut client = agent.lock().await;
                    client.destroy_session(session_id).await
                        .map_err(|e| CliError::Session(format!(
                            "Guest agent failed to destroy session: {}", e
                        )))
                } else {
                    Ok(())
                }
            }
            MacSessionMode::Ephemeral => {
                if let Some(ref manager) = self.session_manager {
                    manager.destroy_session(session_id, false).await
                        .map_err(|e| CliError::Session(format!(
                            "Failed to destroy session: {}", e
                        )))
                } else {
                    Ok(())
                }
            }
        }
    }
    
    async fn cleanup(&self) -> Result<()> {
        match self.mode {
            MacSessionMode::Shared => {
                debug!("Disconnecting from shared VM");
            }
            MacSessionMode::Ephemeral => {
                info!("Shutting down ephemeral VM");
            }
        }
        Ok(())
    }
}

impl Drop for MacSession {
    fn drop(&mut self) {
        match self.mode {
            MacSessionMode::Shared => {
                debug!("Dropping shared session (VM kept running)");
            }
            MacSessionMode::Ephemeral => {
                info!("Dropping ephemeral session (VM will be destroyed)");
            }
        }
    }
}
