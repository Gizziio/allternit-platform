//! Session management for different platforms and contexts

pub mod linux;
pub mod local;
pub mod macos;
pub mod remote;

use async_trait::async_trait;
use a2r_session_manager::types::{Session, SessionSpec};
use a2r_driver_interface::{ExecResult, ExecutionHandle, SpawnSpec};

use crate::error::Result;

/// Trait for CLI session management
#[async_trait]
pub trait CliSession: Send + Sync {
    /// Create a new execution session
    async fn create_session(&self, spec: SessionSpec) -> Result<Session>;
    
    /// Execute a command in a session
    async fn exec(
        &self,
        session: &Session,
        command: Vec<String>,
        env: std::collections::HashMap<String, String>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecResult>;
    
    /// List active sessions
    async fn list_sessions(&self) -> Result<Vec<Session>>;
    
    /// Destroy a session
    async fn destroy_session(&self, session_id: a2r_session_manager::types::SessionId) -> Result<()>;
    
    /// Cleanup resources
    async fn cleanup(&self) -> Result<()>;
}

/// Platform-specific session manager
pub enum SessionManager {
    /// macOS - connects to desktop VM or boots ephemeral
    #[cfg(target_os = "macos")]
    MacOS(macos::MacSession),
    
    /// Linux - uses process driver or Firecracker
    #[cfg(target_os = "linux")]
    Linux(linux::LinuxSession),
    
    /// Local execution - direct host execution (fallback)
    Local(local::LocalSession),
    
    /// Remote SSH session - always uses Firecracker
    Remote(remote::RemoteSession),
}

impl SessionManager {
    /// Create appropriate session manager for current context
    /// 
    /// On macOS without --vm flag: tries shared VM first, falls back to local execution
    pub async fn new(use_vm: bool) -> Result<Self> {
        let config = crate::config::load_config().await?;
        
        // Detect context
        if crate::config::is_ssh_session() {
            // SSH sessions always use remote/Firecracker
            return Ok(SessionManager::Remote(
                remote::RemoteSession::new(config).await?
            ));
        }
        
        #[cfg(target_os = "macos")]
        {
            if use_vm {
                // User explicitly requested VM mode
                return Ok(SessionManager::MacOS(
                    macos::MacSession::new(macos::MacSessionMode::Ephemeral, config).await?
                ));
            } else {
                // Try shared VM first, fall back to local execution
                match macos::MacSession::new(macos::MacSessionMode::Shared, config.clone()).await {
                    Ok(session) => return Ok(SessionManager::MacOS(session)),
                    Err(e) => {
                        tracing::warn!("Desktop VM not available ({}), falling back to local execution", e);
                        return Ok(SessionManager::Local(
                            local::LocalSession::new(config).await?
                        ));
                    }
                }
            }
        }
        
        #[cfg(target_os = "linux")]
        {
            let mode = if use_vm {
                linux::LinuxSessionMode::Vm
            } else {
                linux::LinuxSessionMode::Process
            };
            
            return Ok(SessionManager::Linux(
                linux::LinuxSession::new(mode, config).await?
            ));
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            // Fallback to local execution for unknown platforms
            tracing::warn!("Unknown platform '{}', using local execution", std::env::consts::OS);
            Ok(SessionManager::Local(
                local::LocalSession::new(config).await?
            ))
        }
    }
}

#[async_trait]
impl CliSession for SessionManager {
    async fn create_session(&self, spec: SessionSpec) -> Result<Session> {
        match self {
            #[cfg(target_os = "macos")]
            SessionManager::MacOS(s) => s.create_session(spec).await,
            
            #[cfg(target_os = "linux")]
            SessionManager::Linux(s) => s.create_session(spec).await,
            
            SessionManager::Local(s) => s.create_session(spec).await,
            
            SessionManager::Remote(s) => s.create_session(spec).await,
        }
    }
    
    async fn exec(
        &self,
        session: &Session,
        command: Vec<String>,
        env: std::collections::HashMap<String, String>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecResult> {
        match self {
            #[cfg(target_os = "macos")]
            SessionManager::MacOS(s) => s.exec(session, command, env, timeout_ms).await,
            
            #[cfg(target_os = "linux")]
            SessionManager::Linux(s) => s.exec(session, command, env, timeout_ms).await,
            
            SessionManager::Local(s) => s.exec(session, command, env, timeout_ms).await,
            
            SessionManager::Remote(s) => s.exec(session, command, env, timeout_ms).await,
        }
    }
    
    async fn list_sessions(&self) -> Result<Vec<Session>> {
        match self {
            #[cfg(target_os = "macos")]
            SessionManager::MacOS(s) => s.list_sessions().await,
            
            #[cfg(target_os = "linux")]
            SessionManager::Linux(s) => s.list_sessions().await,
            
            SessionManager::Local(s) => s.list_sessions().await,
            
            SessionManager::Remote(s) => s.list_sessions().await,
        }
    }
    
    async fn destroy_session(&self, session_id: a2r_session_manager::types::SessionId) -> Result<()> {
        match self {
            #[cfg(target_os = "macos")]
            SessionManager::MacOS(s) => s.destroy_session(session_id).await,
            
            #[cfg(target_os = "linux")]
            SessionManager::Linux(s) => s.destroy_session(session_id).await,
            
            SessionManager::Local(s) => s.destroy_session(session_id).await,
            
            SessionManager::Remote(s) => s.destroy_session(session_id).await,
        }
    }
    
    async fn cleanup(&self) -> Result<()> {
        match self {
            #[cfg(target_os = "macos")]
            SessionManager::MacOS(s) => s.cleanup().await,
            
            #[cfg(target_os = "linux")]
            SessionManager::Linux(s) => s.cleanup().await,
            
            SessionManager::Local(s) => s.cleanup().await,
            
            SessionManager::Remote(s) => s.cleanup().await,
        }
    }
}
