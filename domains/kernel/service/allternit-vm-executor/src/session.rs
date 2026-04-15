//! Session management inside the VM
//!
//! A session represents an isolated execution context for a tenant.
//! Multiple commands can be executed within the same session, sharing
/// state like environment variables and working directory.

use allternit_guest_agent_protocol::{SessionId, SpawnSpec};
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::sandbox::{ExecutionResult, Sandbox};

/// An active execution session
pub struct Session {
    /// Unique session identifier
    pub id: SessionId,
    /// Tenant that owns this session
    pub tenant_id: String,
    /// Current working directory
    working_dir: Arc<Mutex<PathBuf>>,
    /// Environment variables
    environment: Arc<Mutex<HashMap<String, String>>>,
    /// Sandbox for execution
    sandbox: Arc<Sandbox>,
    /// Active child processes (for cleanup)
    active_processes: Arc<Mutex<Vec<Child>>>,
    /// Spawn specification
    spec: SpawnSpec,
}

impl Session {
    /// Create a new session
    pub async fn new(
        id: SessionId,
        tenant_id: String,
        spec: SpawnSpec,
        sandbox: Arc<Sandbox>,
    ) -> Result<Self> {
        info!(
            "Creating session {} for tenant {} (working_dir: {:?})",
            id.0, tenant_id, spec.working_dir
        );

        // Set up working directory
        let working_dir = spec
            .working_dir
            .clone()
            .unwrap_or_else(|| "/workspace".into());

        // Ensure working directory exists
        tokio::fs::create_dir_all(&working_dir)
            .await
            .with_context(|| format!("Failed to create working directory: {}", working_dir))?;

        // Set up environment variables
        let mut environment = HashMap::new();
        environment.insert("HOME".to_string(), "/tmp".to_string());
        environment.insert(
            "PATH".to_string(),
            "/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin".to_string(),
        );
        environment.insert("TERM".to_string(), "xterm-256color".to_string());
        environment.insert("Allternit_SESSION_ID".to_string(), id.0.to_string());
        environment.insert("Allternit_TENANT_ID".to_string(), tenant_id.clone());
        
        // Add user-specified environment
        for (key, value) in &spec.environment {
            environment.insert(key.clone(), value.clone());
        }

        // Set up mounts
        for mount in &spec.mounts {
            let dest = PathBuf::from(&mount.destination);
            tokio::fs::create_dir_all(&dest)
                .await
                .with_context(|| format!("Failed to create mount point: {}", mount.destination))?;
            
            debug!("Session {} mount: {} -> {}", id.0, mount.source, mount.destination);
        }

        Ok(Self {
            id,
            tenant_id,
            working_dir: Arc::new(Mutex::new(working_dir.into())),
            environment: Arc::new(Mutex::new(environment)),
            sandbox,
            active_processes: Arc::new(Mutex::new(Vec::new())),
            spec,
        })
    }

    /// Execute a command in this session
    pub async fn execute(&self, command: &str, args: &[String]) -> Result<ExecutionResult> {
        debug!(
            "Session {} executing: {} {:?}",
            self.id.0, command, args
        );

        let working_dir = self.working_dir.lock().await.clone();

        // Execute through sandbox
        let result = self
            .sandbox
            .execute(command, args, Some(&working_dir))
            .await
            .with_context(|| format!("Failed to execute command in session {}: {}", self.id.0, command))?;

        Ok(result)
    }

    /// Execute a command with shell (for complex commands)
    pub async fn execute_shell(&self, command: &str) -> Result<ExecutionResult> {
        self.execute("/bin/sh", &["-c".to_string(), command.to_string()]).await
    }

    /// Change working directory
    pub async fn set_working_dir(&self, path: PathBuf) -> Result<()> {
        // Validate path exists
        if !path.exists() {
            anyhow::bail!("Working directory does not exist: {}", path.display());
        }

        let mut working_dir = self.working_dir.lock().await;
        *working_dir = path;
        
        debug!("Session {} working directory changed to {}", self.id.0, working_dir.display());
        
        Ok(())
    }

    /// Get current working directory
    pub async fn working_dir(&self) -> PathBuf {
        self.working_dir.lock().await.clone()
    }

    /// Set environment variable
    pub async fn set_env(&self, key: String, value: String) {
        let mut env = self.environment.lock().await;
        env.insert(key, value);
    }

    /// Get environment variable
    pub async fn get_env(&self, key: &str) -> Option<String> {
        let env = self.environment.lock().await;
        env.get(key).cloned()
    }

    /// Get all environment variables
    pub async fn env(&self) -> HashMap<String, String> {
        self.environment.lock().await.clone()
    }

    /// Get session information
    pub fn info(&self) -> SessionInfo {
        SessionInfo {
            id: self.id.clone(),
            tenant_id: self.tenant_id.clone(),
            created_at: std::time::SystemTime::now(), // Would track actual creation time
        }
    }

    /// Clean up session resources
    pub async fn cleanup(&self) -> Result<()> {
        info!("Cleaning up session {}", self.id.0);

        // Kill any active processes
        let mut processes = self.active_processes.lock().await;
        for mut child in processes.drain(..) {
            if let Ok(Some(_)) = child.try_wait() {
                // Already exited
            } else {
                if let Err(e) = child.kill().await {
                    warn!("Failed to kill process in session {}: {}", self.id.0, e);
                }
            }
        }

        // Clean up temporary files if needed
        // (depends on sandbox configuration)

        Ok(())
    }
}

/// Session information (serializable)
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: SessionId,
    pub tenant_id: String,
    pub created_at: std::time::SystemTime,
}

#[cfg(test)]
mod tests {
    use super::*;

    // These tests would need a running VM environment
    // Marked as ignored for CI

    #[tokio::test]
    #[ignore]
    async fn test_session_creation() {
        // Test implementation would go here
    }
}
