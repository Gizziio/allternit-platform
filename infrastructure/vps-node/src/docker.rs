//! Docker runtime integration
//!
//! Manages container lifecycle for job execution.

use anyhow::{Context, Result};
use bollard::container::{Config, CreateContainerOptions, LogsOptions, StartContainerOptions, StopContainerOptions, WaitContainerOptions, RemoveContainerOptions};
use bollard::models::{ResourcesUlimits, HostConfig};
use bollard::Docker;
use futures::StreamExt;
use std::collections::HashMap;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

/// Container configuration for job execution
#[derive(Debug, Clone)]
pub struct ContainerConfig {
    pub image: String,
    pub command: Vec<String>,
    pub env: HashMap<String, String>,
    pub working_dir: Option<String>,
    pub cpu_limit: Option<f64>,      // CPU limit (cores)
    pub memory_limit: Option<u64>,   // Memory limit (bytes)
    pub timeout_secs: Option<u64>,   // Execution timeout
    pub labels: HashMap<String, String>,
}

impl Default for ContainerConfig {
    fn default() -> Self {
        Self {
            image: "alpine:latest".to_string(),
            command: vec![],
            env: HashMap::new(),
            working_dir: None,
            cpu_limit: None,
            memory_limit: None,
            timeout_secs: Some(3600),
            labels: HashMap::new(),
        }
    }
}

/// Docker runtime wrapper
pub struct DockerRuntime {
    client: Option<Docker>,
    socket_path: String,
}

impl DockerRuntime {
    pub fn new() -> Self {
        Self {
            client: None,
            socket_path: "/var/run/docker.sock".to_string(),
        }
    }
    
    pub fn with_socket(socket_path: &str) -> Self {
        Self {
            client: None,
            socket_path: socket_path.to_string(),
        }
    }
    
    /// Connect to Docker daemon
    pub async fn connect(&mut self) -> Result<()> {
        let docker = if self.socket_path.starts_with("tcp://") || 
                        self.socket_path.starts_with("http://") {
            Docker::connect_with_http(&self.socket_path, 120, bollard::API_DEFAULT_VERSION)?
        } else {
            Docker::connect_with_socket(&self.socket_path, 120, bollard::API_DEFAULT_VERSION)?
        };
        
        // Test connection
        match docker.version().await {
            Ok(version) => {
                info!("🐳 Docker connected: {} (API {})", 
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
    
    /// Check if Docker is available
    pub async fn available(&self) -> bool {
        self.client.is_some()
    }
    
    /// Get Docker info
    pub async fn info(&self) -> Result<bollard::models::SystemInfo> {
        let client = self.client.as_ref().ok_or_else(|| anyhow::anyhow!("Docker not connected"))?;
        Ok(client.info().await?)
    }
    
    /// Pull an image
    pub async fn pull_image(&self, image: &str) -> Result<()> {
        let client = self.client.as_ref().ok_or_else(|| anyhow::anyhow!("Docker not connected"))?;
        
        info!("📥 Pulling image: {}", image);
        
        let options = bollard::image::CreateImageOptions {
            from_image: image,
            ..Default::default()
        };
        
        let mut stream = client.create_image(Some(options), None, None);
        
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
    
    /// Run a container and wait for completion
    pub async fn run_container(
        &self,
        job_id: &str,
        config: ContainerConfig,
    ) -> Result<ContainerResult> {
        let client = self.client.as_ref().ok_or_else(|| anyhow::anyhow!("Docker not connected"))?;
        
        // Ensure image exists
        if !self.image_exists(&config.image).await? {
            self.pull_image(&config.image).await?;
        }
        
        // Build container config
        let container_name = format!("allternit-job-{}", job_id);
        
        let mut labels = config.labels.clone();
        labels.insert("allternit.job_id".to_string(), job_id.to_string());
        labels.insert("allternit.managed".to_string(), "true".to_string());
        
        let env_vars: Vec<String> = config.env
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect();
        
        // Build host config with resource limits
        let host_config = HostConfig {
            cpu_quota: config.cpu_limit.map(|c| (c * 100000.0) as i64),
            memory: config.memory_limit.map(|m| m as i64),
            auto_remove: Some(true),
            ..Default::default()
        };
        
        let container_config = Config {
            image: Some(config.image.clone()),
            cmd: Some(config.command.clone()),
            env: Some(env_vars),
            working_dir: config.working_dir.clone(),
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
        
        let container = client.create_container(Some(create_options), container_config).await
            .with_context(|| format!("Failed to create container for job {}", job_id))?;
        
        let container_id = container.id;
        info!("🚀 Container created: {} (job: {})", container_id[..12].to_string(), job_id);
        
        // Start container
        client.start_container::<String>(&container_id, None::<StartContainerOptions<String>>).await
            .with_context(|| format!("Failed to start container {}", container_id))?;
        
        info!("▶️ Container started: {} (job: {})", &container_id[..12], job_id);
        
        // Wait for container to finish
        let wait_options = WaitContainerOptions {
            condition: "not-running",
        };
        
        let mut exit_code = 0i64;
        let mut wait_stream = client.wait_container(&container_id, Some(wait_options));
        
        if let Some(result) = wait_stream.next().await {
            match result {
                Ok(response) => {
                    exit_code = response.status_code;
                    info!("🏁 Container exited with code: {} (job: {})", exit_code, job_id);
                }
                Err(e) => {
                    error!("Error waiting for container: {}", e);
                    exit_code = -1;
                }
            }
        }
        
        // Get container logs
        let logs_options = LogsOptions::<String> {
            stdout: true,
            stderr: true,
            ..Default::default()
        };
        
        let mut stdout = String::new();
        let mut stderr = String::new();
        
        let mut logs_stream = client.logs::<String>(&container_id, Some(logs_options));
        
        while let Some(log_result) = logs_stream.next().await {
            match log_result {
                Ok(log) => {
                    let log_str = log.to_string();
                    stdout.push_str(&log_str);
                }
                Err(e) => {
                    error!("Error reading logs: {}", e);
                }
            }
        }
        
        // Clean up container if still exists
        let remove_options = RemoveContainerOptions {
            force: true,
            ..Default::default()
        };
        
        if let Err(e) = client.remove_container(&container_id, Some(remove_options)).await {
            warn!("Failed to remove container {}: {}", container_id, e);
        }
        
        Ok(ContainerResult {
            container_id,
            exit_code,
            stdout,
            stderr,
        })
    }
    
    /// Run a container with streaming logs
    pub async fn run_container_streaming(
        &self,
        job_id: &str,
        config: ContainerConfig,
        log_tx: mpsc::Sender<LogLine>,
    ) -> Result<ContainerResult> {
        let client = self.client.as_ref().ok_or_else(|| anyhow::anyhow!("Docker not connected"))?;
        
        // Ensure image exists
        if !self.image_exists(&config.image).await? {
            self.pull_image(&config.image).await?;
        }
        
        // Build container config
        let container_name = format!("allternit-job-{}", job_id);
        
        let mut labels = config.labels.clone();
        labels.insert("allternit.job_id".to_string(), job_id.to_string());
        labels.insert("allternit.managed".to_string(), "true".to_string());
        
        let env_vars: Vec<String> = config.env
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect();
        
        let host_config = HostConfig {
            cpu_quota: config.cpu_limit.map(|c| (c * 100000.0) as i64),
            memory: config.memory_limit.map(|m| m as i64),
            auto_remove: Some(true),
            ..Default::default()
        };
        
        let container_config = Config {
            image: Some(config.image.clone()),
            cmd: Some(config.command.clone()),
            env: Some(env_vars),
            working_dir: config.working_dir.clone(),
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
        
        let container = client.create_container(Some(create_options), container_config).await
            .with_context(|| format!("Failed to create container for job {}", job_id))?;
        
        let container_id = container.id;
        info!("🚀 Container created: {} (job: {})", &container_id[..12], job_id);
        
        // Start container
        client.start_container::<String>(&container_id, None::<StartContainerOptions<String>>).await
            .with_context(|| format!("Failed to start container {}", container_id))?;
        
        info!("▶️ Container started: {} (job: {})", &container_id[..12], job_id);
        
        // Stream logs concurrently with waiting
        let log_container_id = container_id.clone();
        let client_clone = client.clone();
        let log_task = tokio::spawn(async move {
            let logs_options = LogsOptions::<String> {
                stdout: true,
                stderr: true,
                follow: true,
                tail: "all".to_string(),
                ..Default::default()
            };
            
            let mut logs_stream = client_clone.logs::<String>(&log_container_id, Some(logs_options));
            
            while let Some(log_result) = logs_stream.next().await {
                match log_result {
                    Ok(log) => {
                        let is_stderr = false; // TODO: detect stderr from log output
                        let log_str = log.to_string();
                        let _ = log_tx.send(LogLine {
                            is_stderr,
                            content: log_str,
                        }).await;
                    }
                    Err(e) => {
                        debug!("Log stream ended: {}", e);
                        break;
                    }
                }
            }
        });
        
        // Wait for container to finish
        let wait_options = WaitContainerOptions {
            condition: "not-running",
        };
        
        let mut exit_code = 0i64;
        let mut wait_stream = client.wait_container(&container_id, Some(wait_options));
        
        if let Some(result) = wait_stream.next().await {
            match result {
                Ok(response) => {
                    exit_code = response.status_code;
                    info!("🏁 Container exited with code: {} (job: {})", exit_code, job_id);
                }
                Err(e) => {
                    error!("Error waiting for container: {}", e);
                    exit_code = -1;
                }
            }
        }
        
        // Give log stream a moment to finish
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        log_task.abort();
        
        // Clean up container
        let remove_options = RemoveContainerOptions {
            force: true,
            ..Default::default()
        };
        
        if let Err(e) = client.remove_container(&container_id, Some(remove_options)).await {
            warn!("Failed to remove container {}: {}", container_id, e);
        }
        
        Ok(ContainerResult {
            container_id,
            exit_code,
            stdout: String::new(), // Logs were streamed
            stderr: String::new(),
        })
    }
    
    /// Stop a running container
    pub async fn stop_container(&self, container_id: &str, timeout_secs: i64) -> Result<()> {
        let client = self.client.as_ref().ok_or_else(|| anyhow::anyhow!("Docker not connected"))?;
        
        let options = StopContainerOptions {
            t: timeout_secs,
        };
        
        client.stop_container(container_id, Some(options)).await?;
        info!("🛑 Container stopped: {}", container_id);
        
        Ok(())
    }
    
    /// Check if an image exists locally
    async fn image_exists(&self, image: &str) -> Result<bool> {
        let client = self.client.as_ref().ok_or_else(|| anyhow::anyhow!("Docker not connected"))?;
        
        match client.inspect_image(image).await {
            Ok(_) => Ok(true),
            Err(bollard::errors::Error::DockerResponseServerError { status_code: 404, .. }) => Ok(false),
            Err(e) => Err(e.into()),
        }
    }
    
    /// List containers with Allternit labels
    pub async fn list_containers(&self) -> Result<Vec<bollard::models::ContainerSummary>> {
        let client = self.client.as_ref().ok_or_else(|| anyhow::anyhow!("Docker not connected"))?;
        
        let mut filters = HashMap::new();
        filters.insert("label".to_string(), vec!["allternit.managed=true".to_string()]);
        
        let options = bollard::container::ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };
        
        Ok(client.list_containers(Some(options)).await?)
    }
}

impl Default for DockerRuntime {
    fn default() -> Self {
        Self::new()
    }
}

/// Result from running a container
#[derive(Debug, Clone)]
pub struct ContainerResult {
    pub container_id: String,
    pub exit_code: i64,
    pub stdout: String,
    pub stderr: String,
}

/// A single log line from container output
#[derive(Debug, Clone)]
pub struct LogLine {
    pub is_stderr: bool,
    pub content: String,
}

/// Detect Docker capabilities on this system
pub async fn detect_docker_capabilities() -> DockerCapabilities {
    let mut caps = DockerCapabilities::default();
    
    // Try to connect to Docker
    let mut runtime = DockerRuntime::new();
    if let Err(e) = runtime.connect().await {
        warn!("Docker not available: {}", e);
        return caps;
    }
    
    caps.available = true;
    
    // Get Docker info
    match runtime.info().await {
        Ok(info) => {
            caps.version = info.server_version.clone().unwrap_or_default();
            caps.api_version = info.os_version.clone().unwrap_or_default();
            
            // Check for swarm mode
            caps.swarm_enabled = info.swarm.as_ref()
                .map(|s| s.node_id.is_some())
                .unwrap_or(false);
            
            // Check for GPU support (nvidia runtime)
            caps.gpu_support = info.runtimes.as_ref()
                .map(|r| r.contains_key("nvidia"))
                .unwrap_or(false);
            
            caps.rootless = info.security_options.as_ref()
                .map(|opts| opts.iter().any(|o| o.contains("rootless")))
                .unwrap_or(false);
        }
        Err(e) => {
            warn!("Failed to get Docker info: {}", e);
        }
    }
    
    caps
}

/// Docker capabilities detected on the system
#[derive(Debug, Clone, Default)]
pub struct DockerCapabilities {
    pub available: bool,
    pub version: String,
    pub api_version: String,
    pub swarm_enabled: bool,
    pub gpu_support: bool,
    pub rootless: bool,
}
