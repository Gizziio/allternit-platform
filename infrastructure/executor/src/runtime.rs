// OWNER: T1-A4

//! Runtime Manager
//!
//! Handles Docker container operations and lifecycle management.

use crate::docker::DockerOrchestrator;
use crate::types::LogLine;
use crate::types::{ContainerConfig, ContainerId, ContainerInfo, Result};
use async_trait::async_trait;
use std::time::Duration;
use tokio::sync::mpsc;

/// Authentication configuration for private registries
pub type AuthConfig = bollard::auth::DockerCredentials;

/// Log stream type
pub type LogStream = mpsc::Receiver<LogLine>;

/// Runtime manager trait for container operations
#[async_trait]
pub trait RuntimeManager {
    /// Pull Docker image if not present
    async fn pull_image(&self, image: &str, auth: Option<AuthConfig>) -> Result<()>;

    /// Create container from image
    async fn create_container(&self, config: ContainerConfig) -> Result<ContainerId>;

    /// Start a created container
    async fn start_container(&self, container_id: ContainerId) -> Result<()>;

    /// Stop a running container
    async fn stop_container(
        &self,
        container_id: ContainerId,
        timeout: Option<Duration>,
    ) -> Result<()>;

    /// Remove a container
    async fn remove_container(&self, container_id: ContainerId, force: bool) -> Result<()>;

    /// Stream container logs
    async fn logs(&self, container_id: ContainerId, follow: bool) -> Result<LogStream>;

    /// Get container status
    async fn inspect(&self, container_id: ContainerId) -> Result<ContainerInfo>;
}

/// Runtime manager implementation using Docker orchestrator
pub struct RuntimeManagerImpl {
    orchestrator: DockerOrchestrator,
}

impl RuntimeManagerImpl {
    pub fn new() -> Self {
        Self {
            orchestrator: DockerOrchestrator::new(),
        }
    }

    pub fn with_socket(socket_path: &str) -> Self {
        Self {
            orchestrator: DockerOrchestrator::with_socket(socket_path),
        }
    }

    pub async fn connect(&mut self) -> Result<()> {
        self.orchestrator
            .connect()
            .await
            .map_err(|e| crate::types::ExecutorError::RuntimeError(e.to_string()))?;
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.orchestrator.is_connected()
    }
}

#[async_trait]
impl RuntimeManager for RuntimeManagerImpl {
    async fn pull_image(&self, image: &str, auth: Option<AuthConfig>) -> Result<()> {
        self.orchestrator
            .pull_image(image, auth.as_ref())
            .await
            .map_err(|e| crate::types::ExecutorError::RuntimeError(e.to_string()))
    }

    async fn create_container(&self, config: ContainerConfig) -> Result<ContainerId> {
        self.orchestrator
            .create_container(&config)
            .await
            .map_err(|e| crate::types::ExecutorError::RuntimeError(e.to_string()))
    }

    async fn start_container(&self, container_id: ContainerId) -> Result<()> {
        self.orchestrator
            .start_container(&container_id)
            .await
            .map_err(|e| crate::types::ExecutorError::RuntimeError(e.to_string()))
    }

    async fn stop_container(
        &self,
        container_id: ContainerId,
        timeout: Option<Duration>,
    ) -> Result<()> {
        self.orchestrator
            .stop_container(&container_id, timeout)
            .await
            .map_err(|e| crate::types::ExecutorError::RuntimeError(e.to_string()))
    }

    async fn remove_container(&self, container_id: ContainerId, force: bool) -> Result<()> {
        self.orchestrator
            .remove_container(&container_id, force)
            .await
            .map_err(|e| crate::types::ExecutorError::RuntimeError(e.to_string()))
    }

    async fn logs(&self, container_id: ContainerId, follow: bool) -> Result<LogStream> {
        let (tx, rx) = mpsc::channel(100);

        // Clone orchestrator reference for the spawned task
        let orchestrator = self.orchestrator.clone();
        let container_id_str = container_id.to_string();

        // Spawn task to stream logs
        tokio::spawn(async move {
            match orchestrator.get_logs(&container_id_str, follow, None).await {
                Ok(log_lines) => {
                    for line in log_lines {
                        if tx.send(line).await.is_err() {
                            break; // Receiver dropped
                        }
                    }
                }
                Err(e) => {
                    let error_line = LogLine {
                        timestamp: Some(chrono::Utc::now()),
                        is_stderr: true,
                        content: format!("Error fetching logs: {}", e),
                    };
                    let _ = tx.send(error_line).await;
                }
            }
        });

        Ok(rx)
    }

    async fn inspect(&self, container_id: ContainerId) -> Result<ContainerInfo> {
        self.orchestrator
            .inspect_container(&container_id)
            .await
            .map_err(|e| crate::types::ExecutorError::RuntimeError(e.to_string()))
    }
}

impl Default for RuntimeManagerImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_creation() {
        let runtime = RuntimeManagerImpl::new();
        assert!(!runtime.is_connected());
    }

    #[test]
    fn test_runtime_with_socket() {
        let runtime = RuntimeManagerImpl::with_socket("/var/run/docker.sock");
        assert!(!runtime.is_connected());
    }
}
