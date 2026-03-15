//! Remote SSH/VPS session management
//!
//! For SSH connections to VPS nodes, each session gets a dedicated Firecracker VM
//! This provides true isolation between SSH sessions

use async_trait::async_trait;
use tracing::{debug, info};
use std::collections::HashMap;
use std::sync::Arc;

use a2r_session_manager::types::{Session, SessionSpec, SessionId, SessionStatus};
use a2r_session_manager::{SessionManager as CoreSessionManager, ManagerConfig};
use a2r_driver_interface::ExecResult;

use crate::config::Config;
use crate::error::{CliError, Result};
use super::CliSession;

/// Remote SSH session
pub struct RemoteSession {
    #[allow(dead_code)]
    config: Config,
    /// Core session manager
    session_manager: Arc<CoreSessionManager>,
}

impl RemoteSession {
    /// Create a new remote session
    pub async fn new(config: Config) -> Result<Self> {
        info!("Creating remote SSH session");
        
        // Initialize session manager with Firecracker for VM isolation
        let manager_config = ManagerConfig {
            database_url: format!(
                "sqlite:{}",
                dirs::data_dir()
                    .map(|d| d.join("a2r").join("remote-sessions.db"))
                    .unwrap_or_else(|| std::path::PathBuf::from("/tmp/a2r/remote-sessions.db"))
                    .display()
            ),
            default_working_dir: std::path::PathBuf::from("/workspace"),
            max_sessions: 50,
            cleanup_interval_secs: 60,
            #[cfg(target_os = "linux")]
            firecracker_config: Some(a2r_firecracker_driver::FirecrackerConfig::default()),
            #[cfg(not(target_os = "linux"))]
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
            session_manager,
        })
    }
}

#[async_trait]
impl CliSession for RemoteSession {
    async fn create_session(&self, spec: SessionSpec) -> Result<Session> {
        debug!("Creating remote session with spec: {:?}", spec);
        
        self.session_manager.create_session(spec).await
            .map_err(|e| CliError::Session(format!("Failed to create session: {}", e)))
    }
    
    async fn exec(
        &self,
        session: &Session,
        command: Vec<String>,
        env: HashMap<String, String>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecResult> {
        debug!(
            "Executing remote command in session {}: {:?}",
            session.id, command
        );
        
        self.session_manager.exec(session.id, command, env, timeout_ms).await
            .map_err(|e| CliError::ExecutionFailed {
                message: format!("Remote execution failed: {}", e),
                exit_code: -1,
            })
    }
    
    async fn list_sessions(&self) -> Result<Vec<Session>> {
        self.session_manager.list_sessions().await
            .map_err(|e| CliError::Session(format!("Failed to list sessions: {}", e)))
    }
    
    async fn destroy_session(&self, session_id: SessionId) -> Result<()> {
        debug!("Destroying remote session {}", session_id);
        
        self.session_manager.destroy_session(session_id, false).await
            .map_err(|e| CliError::Session(format!("Failed to destroy session: {}", e)))
    }
    
    async fn cleanup(&self) -> Result<()> {
        info!("Cleaning up remote session");
        Ok(())
    }
}
