//! Docker Orchestration
//!
//! Docker container lifecycle management for job execution.
//! Handles container creation, start, stop, remove, image pulling,
//! volume mounts, and environment variables.
//!
//! // OWNER: T1-A2

use anyhow::{Context, Result};
use bollard::container::{
    Config, CreateContainerOptions, InspectContainerOptions, ListContainersOptions, LogsOptions,
    RemoveContainerOptions, StartContainerOptions, StopContainerOptions, WaitContainerOptions,
};
use bollard::errors::Error as DockerError;
use bollard::image::{CreateImageOptions, ListImagesOptions};
use bollard::models::{ContainerSummary, HostConfig, Mount, MountTypeEnum};
use bollard::Docker;
use futures::StreamExt;
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

use crate::types::{
    ContainerConfig, ContainerId, ContainerInfo, ContainerResult, ContainerStatus,
    DockerCapabilities, LogLine,
};

/// Docker orchestration manager
///
/// Provides container lifecycle management using the bollard Docker client.
pub struct DockerOrchestrator {
    client: Option<Docker>,
    socket_path: String,
    timeout_secs: u64,
}

impl DockerOrchestrator {
    /// Create a new Docker orchestrator with default socket path
    pub fn new() -> Self {
        Self {
            client: None,
            socket_path: "/var/run/docker.sock".to_string(),
            timeout_secs: 120,
        }
    }

    /// Create a new Docker orchestrator with custom socket path
    pub fn with_socket(socket_path: &str) -> Self {
        Self {
            client: None,
            socket_path: socket_path.to_string(),
            timeout_secs: 120,
        }
    }

    /// Create a new Docker orchestrator with custom timeout
    pub fn with_timeout(socket_path: &str, timeout_secs: u64) -> Self {
        Self {
            client: None,
            socket_path: socket_path.to_string(),
            timeout_secs,
        }
    }

    /// Connect to Docker daemon
    ///
    /// Attempts to connect to the Docker daemon and verifies the connection
    /// by fetching the Docker version.
    pub async fn connect(&mut self) -> Result<()> {
        let docker =
            if self.socket_path.starts_with("tcp://") || self.socket_path.starts_with("http://") {
                Docker::connect_with_http(
                    &self.socket_path,
                    self.timeout_secs,
                    bollard::API_DEFAULT_VERSION,
                )
                .context("Failed to connect to Docker via HTTP")?
            } else {
                Docker::connect_with_socket(
                    &self.socket_path,
                    self.timeout_secs,
                    bollard::API_DEFAULT_VERSION,
                )
                .context("Failed to connect to Docker via socket")?
            };

        // Test connection by getting Docker version
        match docker.version().await {
            Ok(version) => {
                info!(
                    "🐳 Docker connected: {} (API {})",
                    version.version.as_deref().unwrap_or("unknown"),
                    version.api_version.as_deref().unwrap_or("unknown")
                );
                self.client = Some(docker);
                Ok(())
            }
            Err(e) => {
                warn!("Docker not available: {}", e);
                Err(e.into())
            }
        }
    }

    /// Check if Docker is connected and available
    pub fn is_connected(&self) -> bool {
        self.client.is_some()
    }

    /// Get Docker system info
    pub async fn info(&self) -> Result<bollard::models::SystemInfo> {
        let client = self.get_client()?;
        Ok(client.info().await?)
    }

    // ========================================================================
    // Image Management
    // ========================================================================

    /// Pull a Docker image
    ///
    /// Pulls the specified image from the registry. Supports authentication
    /// via the auth_config parameter for private registries.
    pub async fn pull_image(
        &self,
        image: &str,
        auth_config: Option<&bollard::auth::DockerCredentials>,
    ) -> Result<()> {
        let client = self.get_client()?;

        info!("📥 Pulling image: {}", image);

        let options = CreateImageOptions {
            from_image: image,
            ..Default::default()
        };

        let mut stream = client.create_image(Some(options), None, auth_config.cloned());

        while let Some(result) = stream.next().await {
            match result {
                Ok(progress) => {
                    if let Some(status) = progress.status {
                        debug!("Pull progress: {}", status);
                    }
                    if let Some(error) = progress.error {
                        return Err(anyhow::anyhow!("Failed to pull image: {}", error));
                    }
                }
                Err(e) => {
                    return Err(e.into());
                }
            }
        }

        info!("✅ Image pulled: {}", image);
        Ok(())
    }

    /// Check if an image exists locally
    pub async fn image_exists(&self, image: &str) -> Result<bool> {
        let client = self.get_client()?;

        match client.inspect_image(image).await {
            Ok(_) => Ok(true),
            Err(DockerError::DockerResponseServerError {
                status_code: 404, ..
            }) => Ok(false),
            Err(e) => Err(e.into()),
        }
    }

    /// List local images
    pub async fn list_images(&self) -> Result<Vec<bollard::models::ImageSummary>> {
        let client = self.get_client()?;
        Ok(client.list_images(None::<ListImagesOptions<&str>>).await?)
    }

    /// Ensure image exists, pulling if necessary
    pub async fn ensure_image(
        &self,
        image: &str,
        auth_config: Option<&bollard::auth::DockerCredentials>,
    ) -> Result<()> {
        if !self.image_exists(image).await? {
            self.pull_image(image, auth_config).await?;
        }
        Ok(())
    }

    // ========================================================================
    // Container Lifecycle - Create
    // ========================================================================

    /// Create a container from the given configuration
    ///
    /// Creates a container but does not start it. Use `start_container`
    /// to begin execution.
    pub async fn create_container(&self, config: &ContainerConfig) -> Result<ContainerId> {
        let client = self.get_client()?;

        // Ensure image exists
        self.ensure_image(&config.image, None).await?;

        // Build container name
        let container_name = format!(
            "allternit-exec-{}",
            uuid::Uuid::new_v4().to_string()[..8].to_string()
        );

        // Build labels
        let mut labels = config.labels.clone();
        labels.insert("allternit.managed".to_string(), "true".to_string());
        labels.insert(
            "allternit.created_at".to_string(),
            chrono::Utc::now().to_rfc3339(),
        );

        // Build environment variables
        let env_vars: Vec<String> = config
            .env
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect();

        // Build volume mounts
        let mounts: Vec<Mount> = config
            .volumes
            .iter()
            .map(|vol| Mount {
                target: Some(vol.target.clone()),
                source: Some(vol.source.clone()),
                typ: Some(MountTypeEnum::BIND),
                read_only: Some(vol.options.iter().any(|o| o == "ro")),
                bind_options: None,
                volume_options: None,
                tmpfs_options: None,
                consistency: None,
            })
            .collect();

        // Build host config with resource limits
        let host_config = HostConfig {
            cpu_quota: config.resources.cpu_limit.map(|c| (c * 100000.0) as i64),
            memory: config.resources.memory_limit.map(|m| m as i64),
            mounts: if mounts.is_empty() {
                None
            } else {
                Some(mounts)
            },
            auto_remove: Some(false),
            ..Default::default()
        };

        // Build container configuration
        let container_config = Config {
            image: Some(config.image.clone()),
            cmd: Some(config.command.clone()),
            env: if env_vars.is_empty() {
                None
            } else {
                Some(env_vars)
            },
            working_dir: config.working_dir.clone(),
            user: config.user.clone(),
            labels: Some(labels),
            host_config: Some(host_config),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        };

        // Create container
        let create_options = CreateContainerOptions {
            name: &container_name,
            platform: None,
        };

        let container = client
            .create_container(Some(create_options), container_config)
            .await
            .with_context(|| format!("Failed to create container for image {}", config.image))?;

        info!(
            "🚀 Container created: {} ({})",
            &container.id[..12].to_string(),
            config.image
        );

        Ok(container.id)
    }

    // ========================================================================
    // Container Lifecycle - Start
    // ========================================================================

    /// Start a created container
    pub async fn start_container(&self, container_id: &ContainerId) -> Result<()> {
        let client = self.get_client()?;

        client
            .start_container::<String>(container_id, None::<StartContainerOptions<String>>)
            .await
            .with_context(|| format!("Failed to start container {}", container_id))?;

        info!("▶️ Container started: {}", &container_id[..12].to_string());

        Ok(())
    }

    /// Create and start a container in one operation
    pub async fn create_and_start(&self, config: &ContainerConfig) -> Result<ContainerId> {
        let container_id = self.create_container(config).await?;
        self.start_container(&container_id).await?;
        Ok(container_id)
    }

    // ========================================================================
    // Container Lifecycle - Stop
    // ========================================================================

    /// Stop a running container
    ///
    /// Sends SIGTERM and waits for graceful shutdown. If the container
    /// doesn't stop within the timeout, sends SIGKILL.
    pub async fn stop_container(
        &self,
        container_id: &ContainerId,
        timeout: Option<Duration>,
    ) -> Result<()> {
        let client = self.get_client()?;

        let timeout_secs = timeout.map(|t| t.as_secs() as i64).unwrap_or(30);

        let options = StopContainerOptions { t: timeout_secs };

        client
            .stop_container(container_id, Some(options))
            .await
            .with_context(|| format!("Failed to stop container {}", container_id))?;

        info!("🛑 Container stopped: {}", &container_id[..12].to_string());

        Ok(())
    }

    /// Force kill a running container
    pub async fn kill_container(&self, container_id: &ContainerId) -> Result<()> {
        let client = self.get_client()?;

        client
            .kill_container::<String>(container_id, None)
            .await
            .with_context(|| format!("Failed to kill container {}", container_id))?;

        info!("💀 Container killed: {}", &container_id[..12].to_string());

        Ok(())
    }

    /// Restart a container
    pub async fn restart_container(&self, container_id: &ContainerId) -> Result<()> {
        let client = self.get_client()?;

        client
            .restart_container(container_id, None)
            .await
            .with_context(|| format!("Failed to restart container {}", container_id))?;

        info!(
            "🔄 Container restarted: {}",
            &container_id[..12].to_string()
        );

        Ok(())
    }

    // ========================================================================
    // Container Lifecycle - Remove
    // ========================================================================

    /// Remove a container
    ///
    /// If force is true, the container will be killed before removal.
    pub async fn remove_container(&self, container_id: &ContainerId, force: bool) -> Result<()> {
        let client = self.get_client()?;

        let options = RemoveContainerOptions {
            force,
            ..Default::default()
        };

        client
            .remove_container(container_id, Some(options))
            .await
            .with_context(|| format!("Failed to remove container {}", container_id))?;

        info!("🗑️ Container removed: {}", &container_id[..12].to_string());

        Ok(())
    }

    // ========================================================================
    // Container Operations - Wait & Logs
    // ========================================================================

    /// Wait for a container to finish and get exit code
    pub async fn wait_container(&self, container_id: &ContainerId) -> Result<i32> {
        let client = self.get_client()?;

        let options = WaitContainerOptions {
            condition: "not-running",
        };

        let mut wait_stream = client.wait_container(container_id, Some(options));

        while let Some(result) = wait_stream.next().await {
            match result {
                Ok(response) => {
                    return Ok(response.status_code as i32);
                }
                Err(e) => {
                    return Err(e.into());
                }
            }
        }

        Err(anyhow::anyhow!("Wait stream ended without exit code"))
    }

    /// Get container logs
    pub async fn get_logs(
        &self,
        container_id: &ContainerId,
        follow: bool,
        tail: Option<usize>,
    ) -> Result<Vec<LogLine>> {
        let client = self.get_client()?;

        let tail_str = match tail {
            Some(n) => n.to_string(),
            None => "all".to_string(),
        };

        let options = LogsOptions {
            stdout: true,
            stderr: true,
            follow,
            tail: tail_str,
            ..Default::default()
        };

        let mut logs = Vec::new();
        let mut log_stream = client.logs::<String>(container_id, Some(options));

        while let Some(result) = log_stream.next().await {
            match result {
                Ok(log) => {
                    // Bollard logs include a header with stream type
                    // For simplicity, we treat all as stdout here
                    logs.push(LogLine {
                        is_stderr: false,
                        content: log.to_string(),
                        timestamp: Some(chrono::Utc::now()),
                    });
                }
                Err(e) => {
                    warn!("Error reading log: {}", e);
                }
            }
        }

        Ok(logs)
    }

    /// Stream container logs to a channel
    pub async fn stream_logs(
        &self,
        container_id: &ContainerId,
        tx: mpsc::Sender<LogLine>,
    ) -> Result<()> {
        let client = self.get_client()?;

        let options = LogsOptions {
            stdout: true,
            stderr: true,
            follow: true,
            tail: "all".to_string(),
            ..Default::default()
        };

        let mut log_stream = client.logs::<String>(container_id, Some(options));

        while let Some(result) = log_stream.next().await {
            match result {
                Ok(log) => {
                    let log_line = LogLine {
                        is_stderr: false,
                        content: log.to_string(),
                        timestamp: Some(chrono::Utc::now()),
                    };

                    if tx.send(log_line).await.is_err() {
                        debug!("Log receiver disconnected");
                        break;
                    }
                }
                Err(e) => {
                    debug!("Log stream ended: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    // ========================================================================
    // Container Inspection
    // ========================================================================

    /// Get detailed container information
    pub async fn inspect_container(&self, container_id: &ContainerId) -> Result<ContainerInfo> {
        let client = self.get_client()?;

        let options = InspectContainerOptions { size: false };
        let inspect = client
            .inspect_container(container_id, Some(options))
            .await?;

        let status = match inspect.state.as_ref().and_then(|s| s.status.as_ref()) {
            Some(status) => match status {
                bollard::models::ContainerStateStatusEnum::CREATED => ContainerStatus::Created,
                bollard::models::ContainerStateStatusEnum::RUNNING => ContainerStatus::Running,
                bollard::models::ContainerStateStatusEnum::PAUSED => ContainerStatus::Paused,
                bollard::models::ContainerStateStatusEnum::RESTARTING => {
                    ContainerStatus::Restarting
                }
                bollard::models::ContainerStateStatusEnum::REMOVING => ContainerStatus::Removing,
                bollard::models::ContainerStateStatusEnum::EXITED => ContainerStatus::Exited,
                bollard::models::ContainerStateStatusEnum::DEAD => ContainerStatus::Dead,
                _ => ContainerStatus::Exited,
            },
            None => ContainerStatus::Exited,
        };

        let name = inspect
            .name
            .unwrap_or_default()
            .trim_start_matches('/')
            .to_string();
        let config_ref = inspect.config.as_ref();
        let image = config_ref.and_then(|c| c.image.clone()).unwrap_or_default();

        Ok(ContainerInfo {
            id: container_id.clone(),
            name,
            image,
            status,
            created_at: inspect
                .created
                .and_then(|d| chrono::DateTime::parse_from_rfc3339(&d).ok())
                .map(|d| d.with_timezone(&chrono::Utc))
                .unwrap_or_else(chrono::Utc::now),
            started_at: inspect
                .state
                .as_ref()
                .and_then(|s| s.started_at.as_ref())
                .and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok())
                .map(|d| d.with_timezone(&chrono::Utc)),
            finished_at: inspect
                .state
                .as_ref()
                .and_then(|s| s.finished_at.as_ref())
                .and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok())
                .map(|d| d.with_timezone(&chrono::Utc)),
            exit_code: inspect
                .state
                .as_ref()
                .and_then(|s| s.exit_code)
                .map(|c| c as i32),
            labels: config_ref
                .and_then(|c| c.labels.clone())
                .unwrap_or_default(),
        })
    }

    /// Check if a container exists
    pub async fn container_exists(&self, container_id: &ContainerId) -> Result<bool> {
        match self.inspect_container(container_id).await {
            Ok(_) => Ok(true),
            Err(e) => {
                if let Some(docker_err) = e.downcast_ref::<DockerError>() {
                    if let DockerError::DockerResponseServerError {
                        status_code: 404, ..
                    } = docker_err
                    {
                        return Ok(false);
                    }
                }
                Err(e)
            }
        }
    }

    /// List containers
    pub async fn list_containers(&self, all: bool) -> Result<Vec<ContainerSummary>> {
        let client = self.get_client()?;

        let mut filters = HashMap::new();
        filters.insert("label".to_string(), vec!["allternit.managed=true".to_string()]);

        let options = ListContainersOptions {
            all,
            filters,
            ..Default::default()
        };

        Ok(client.list_containers(Some(options)).await?)
    }

    // ========================================================================
    // Run Container (Full Lifecycle)
    // ========================================================================

    /// Run a container to completion
    ///
    /// Creates, starts, waits for completion, collects logs, and removes
    /// the container. Returns the execution result.
    pub async fn run_container(&self, config: &ContainerConfig) -> Result<ContainerResult> {
        let start_time = std::time::Instant::now();

        // Create container
        let container_id = self.create_container(config).await?;

        // Start container
        self.start_container(&container_id).await?;

        // Wait for completion
        let exit_code = self.wait_container(&container_id).await?;

        // Get logs
        let logs = self.get_logs(&container_id, false, None).await?;
        let stdout = logs
            .iter()
            .filter(|l| !l.is_stderr)
            .map(|l| l.content.clone())
            .collect::<Vec<_>>()
            .join("\n");
        let stderr = logs
            .iter()
            .filter(|l| l.is_stderr)
            .map(|l| l.content.clone())
            .collect::<Vec<_>>()
            .join("\n");

        // Remove container
        let _ = self.remove_container(&container_id, true).await;

        let duration = start_time.elapsed();

        Ok(ContainerResult {
            container_id,
            exit_code,
            stdout,
            stderr,
            duration,
        })
    }

    /// Run a container with streaming logs
    ///
    /// Creates, starts, streams logs to the provided channel, waits for
    /// completion, and removes the container.
    pub async fn run_container_streaming(
        &self,
        config: &ContainerConfig,
        log_tx: mpsc::Sender<LogLine>,
    ) -> Result<ContainerResult> {
        let start_time = std::time::Instant::now();

        // Create container
        let container_id = self.create_container(config).await?;

        // Start container
        self.start_container(&container_id).await?;

        // Stream logs in background
        let log_container_id = container_id.clone();
        let client_clone = self.client.clone();
        let log_handle = tokio::spawn(async move {
            if let Some(client) = client_clone {
                let options = LogsOptions {
                    stdout: true,
                    stderr: true,
                    follow: true,
                    tail: "all".to_string(),
                    ..Default::default()
                };

                let mut log_stream = client.logs::<String>(&log_container_id, Some(options));

                while let Some(result) = log_stream.next().await {
                    match result {
                        Ok(log) => {
                            let _ = log_tx
                                .send(LogLine {
                                    is_stderr: false,
                                    content: log.to_string(),
                                    timestamp: Some(chrono::Utc::now()),
                                })
                                .await;
                        }
                        Err(_) => break,
                    }
                }
            }
        });

        // Wait for completion
        let exit_code = self.wait_container(&container_id).await?;

        // Give log stream time to finish
        tokio::time::sleep(Duration::from_millis(100)).await;
        log_handle.abort();

        // Remove container
        let _ = self.remove_container(&container_id, true).await;

        let duration = start_time.elapsed();

        Ok(ContainerResult {
            container_id,
            exit_code,
            stdout: String::new(),
            stderr: String::new(),
            duration,
        })
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /// Get the Docker client or return an error if not connected
    fn get_client(&self) -> Result<&Docker> {
        self.client
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Docker not connected. Call connect() first."))
    }

    /// Detect Docker capabilities on this system
    pub async fn detect_capabilities() -> DockerCapabilities {
        let mut caps = DockerCapabilities::default();

        let mut orchestrator = DockerOrchestrator::new();
        if let Err(e) = orchestrator.connect().await {
            warn!("Docker not available: {}", e);
            return caps;
        }

        caps.available = true;

        if let Ok(info) = orchestrator.info().await {
            caps.version = info.server_version.unwrap_or_default();
            caps.api_version = info.os_version.unwrap_or_default();

            caps.swarm_enabled = info
                .swarm
                .as_ref()
                .map(|s| s.node_id.is_some())
                .unwrap_or(false);

            caps.gpu_support = info
                .runtimes
                .as_ref()
                .map(|r| r.contains_key("nvidia"))
                .unwrap_or(false);

            caps.rootless = info
                .security_options
                .as_ref()
                .map(|opts| opts.iter().any(|o| o.contains("rootless")))
                .unwrap_or(false);
        }

        caps
    }
}

impl Default for DockerOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for DockerOrchestrator {
    fn clone(&self) -> Self {
        Self {
            client: None,
            socket_path: self.socket_path.clone(),
            timeout_secs: self.timeout_secs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_orchestrator_creation() {
        let orchestrator = DockerOrchestrator::new();
        assert!(!orchestrator.is_connected());
    }

    #[test]
    fn test_orchestrator_with_socket() {
        let orchestrator = DockerOrchestrator::with_socket("/var/run/docker.sock");
        assert_eq!(orchestrator.socket_path, "/var/run/docker.sock");
    }

    #[tokio::test]
    async fn test_capabilities_detection() {
        let caps = DockerOrchestrator::detect_capabilities().await;
        // This will return available=false if Docker is not running
        // which is expected in test environments without Docker
        assert!(!caps.available || !caps.version.is_empty());
    }
}
