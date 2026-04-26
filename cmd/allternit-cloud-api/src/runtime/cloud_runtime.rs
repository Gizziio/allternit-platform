//! Cloud Runtime Implementation
//!
//! Production managed cloud execution using Hetzner Cloud API.

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

use crate::db::cowork_models::*;
use crate::error::ApiError;
use crate::runtime::*;

/// Cloud runtime for managed cloud execution
pub struct CloudRuntime {
    /// Hetzner provider client
    hetzner: allternit_cloud_hetzner::HetznerProvider,
    /// Active cloud instances
    instances: Arc<RwLock<HashMap<String, CloudInstance>>>,
    /// Event streams
    streams: Arc<RwLock<HashMap<String, mpsc::Sender<RuntimeEvent>>>>,
}

/// Cloud instance state
#[derive(Debug, Clone)]
struct CloudInstance {
    server_id: i64,
    status: RuntimeState,
    public_ip: String,
    ssh_key: String,
}

impl CloudRuntime {
    /// Create a new cloud runtime with Hetzner provider
    pub async fn new_hetzner(api_token: String) -> Result<Self, ApiError> {
        Ok(Self {
            hetzner: allternit_cloud_hetzner::HetznerProvider::new(&api_token),
            instances: Arc::new(RwLock::new(HashMap::new())),
            streams: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Generate a unique runtime ID
    fn generate_runtime_id(&self) -> String {
        format!("cloud-{}", uuid::Uuid::new_v4())
    }

    /// Stream events from cloud instance
    async fn stream_events(
        runtime_id: String,
        instance_ip: String,
        ssh_key: String,
        tx: mpsc::Sender<RuntimeEvent>,
        instances: Arc<RwLock<HashMap<String, CloudInstance>>>,
    ) {
        // Establish SSH connection to cloud instance for event streaming
        let ssh_conn = match allternit_cloud_ssh::SshConnection::connect(
            &instance_ip,
            22,
            "root",
            &ssh_key,
        ).await {
            Ok(conn) => Arc::new(tokio::sync::Mutex::new(conn)),
            Err(e) => {
                tracing::error!("Failed to connect to cloud instance {}: {}", runtime_id, e);
                return;
            }
        };

        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));
        
        loop {
            interval.tick().await;
            
            // Check if instance still exists
            let instance_exists = {
                let insts = instances.read().await;
                insts.contains_key(&runtime_id)
            };
            
            if !instance_exists {
                break;
            }
            
            // Get status from cloud instance
            let ssh = ssh_conn.lock().await;
            let result = ssh.execute("systemctl is-active allternit-agent 2>/dev/null || echo 'inactive'").await;
            drop(ssh);
            
            match result {
                Ok(output) => {
                    let status = if output.stdout.trim() == "active" {
                        RuntimeState::Running
                    } else {
                        RuntimeState::Stopped
                    };
                    
                    let event = RuntimeEvent {
                        event_type: RuntimeEventType::Heartbeat,
                        payload: serde_json::json!({
                            "runtime_id": runtime_id,
                            "status": format!("{:?}", status),
                            "agent_status": output.stdout.trim(),
                        }),
                        timestamp: chrono::Utc::now(),
                    };
                    
                    if tx.send(event).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to get status from {}: {}", runtime_id, e);
                    let event = RuntimeEvent {
                        event_type: RuntimeEventType::Error,
                        payload: serde_json::json!({
                            "runtime_id": runtime_id,
                            "error": format!("SSH error: {}", e),
                        }),
                        timestamp: chrono::Utc::now(),
                    };
                    
                    if tx.send(event).await.is_err() {
                        break;
                    }
                }
            }
        }
    }
}

#[async_trait]
impl Runtime for CloudRuntime {
    async fn start(&self, run_id: &str, config: &RunConfig) -> Result<RuntimeHandle, ApiError> {
        let runtime_id = self.generate_runtime_id();

        // Extract cloud configuration from config.extra
        let instance_type = config.extra
            .get("instance_type")
            .and_then(|v| v.as_str())
            .unwrap_or("cx11");

        let region = config.extra
            .get("region")
            .and_then(|v| v.as_str())
            .unwrap_or("nbg1");

        let control_plane_url = std::env::var("CONTROL_PLANE_URL")
            .unwrap_or_else(|_| "http://localhost:3001".to_string());
        
        let deployment_token = std::env::var("DEPLOYMENT_TOKEN")
            .unwrap_or_else(|_| "dev-token".to_string());

        // Deploy to Hetzner Cloud
        let deploy_config = allternit_cloud_hetzner::DeploymentConfig {
            instance_name: format!("allternit-run-{}", &runtime_id[..8]),
            instance_type_id: instance_type.to_string(),
            region_id: region.to_string(),
            storage_gb: config.extra
                .get("storage_gb")
                .and_then(|v| v.as_i64())
                .unwrap_or(20) as i32,
            control_plane_url,
            deployment_token,
        };

        tracing::info!(
            "Deploying cloud instance for run {}: type={}, region={}",
            run_id, instance_type, region
        );

        // Actually deploy to Hetzner
        let result = self.hetzner.deploy(&deploy_config)
            .await
            .map_err(|e| ApiError::Internal(format!("Hetzner deployment failed: {}", e)))?;

        tracing::info!(
            "Cloud instance deployed: id={}, ip={}, name={}",
            result.instance_id, result.instance_ip, result.server_name
        );

        // Create instance record
        let instance = CloudInstance {
            server_id: result.instance_id.parse::<i64>()
                .map_err(|e| ApiError::Internal(format!("Invalid server ID: {}", e)))?,
            status: RuntimeState::Running,
            public_ip: result.instance_ip.clone(),
            ssh_key: result.ssh_key.clone(),
        };

        {
            let mut instances = self.instances.write().await;
            instances.insert(runtime_id.clone(), instance);
        }

        // Start the actual run on the cloud instance via SSH
        let ssh_conn = allternit_cloud_ssh::SshConnection::connect(
            &result.instance_ip,
            22,
            "root",
            &result.ssh_key,
        ).await
        .map_err(|e| ApiError::Internal(format!("SSH connection to cloud instance failed: {}", e)))?;

        // Execute the run command
        let cmd = if let Some(command) = &config.command {
            format!(
                "cd {} && {}",
                config.working_dir.as_deref().unwrap_or("/opt/allternit"),
                command
            )
        } else {
            format!("echo 'Run {} started on cloud instance'", run_id)
        };

        let output = ssh_conn.execute(&cmd)
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to execute on cloud instance: {}", e)))?;

        if output.exit_code != 0 {
            return Err(ApiError::Internal(
                format!("Cloud command failed: {}", output.stderr)
            ));
        }

        tracing::info!("Run {} started on cloud instance {} (output: {})", 
            run_id, runtime_id, output.stdout.trim());

        Ok(RuntimeHandle {
            runtime_id: runtime_id.clone(),
            runtime_type: "cloud".to_string(),
            connection_info: ConnectionInfo {
                host: result.instance_ip,
                port: 22,
                socket_path: None,
                token: None,
            },
        })
    }

    async fn stop(&self, runtime_id: &str) -> Result<(), ApiError> {
        let instances = self.instances.write().await;

        if let Some(instance) = instances.get(runtime_id) {
            // Actually delete the Hetzner server
            self.hetzner.delete_server(instance.server_id)
                .await
                .map_err(|e| ApiError::Internal(format!("Failed to delete server: {}", e)))?;

            tracing::info!("Deleted cloud instance {} (server_id: {})", runtime_id, instance.server_id);
            Ok(())
        } else {
            Err(ApiError::NotFound(format!("Instance {} not found", runtime_id)))
        }
    }

    async fn status(&self, runtime_id: &str) -> Result<RuntimeStatus, ApiError> {
        let instances = self.instances.read().await;

        if let Some(instance) = instances.get(runtime_id) {
            // Check SSH connectivity
            let ssh_result = allternit_cloud_ssh::SshConnection::connect(
                &instance.public_ip,
                22,
                "root",
                &instance.ssh_key,
            ).await;

            let state = if ssh_result.is_ok() {
                instance.status.clone()
            } else {
                RuntimeState::Failed
            };

            Ok(RuntimeStatus {
                state,
                pid: None,
                exit_code: None,
                resource_usage: None,
            })
        } else {
            Err(ApiError::NotFound(format!("Instance {} not found", runtime_id)))
        }
    }

    async fn attach(&self, runtime_id: &str, client: ClientInfo) -> Result<EventStream, ApiError> {
        let instances = self.instances.read().await;

        let instance = instances.get(runtime_id)
            .ok_or_else(|| ApiError::NotFound(format!("Instance {} not found", runtime_id)))?;
        
        let public_ip = instance.public_ip.clone();
        let ssh_key = instance.ssh_key.clone();
        
        drop(instances);

        let (tx, rx) = mpsc::channel(100);
        
        // Store the sender
        {
            let mut streams = self.streams.write().await;
            streams.insert(runtime_id.to_string(), tx.clone());
        }

        // Spawn event streaming task
        let runtime_id_clone = runtime_id.to_string();
        let instances = self.instances.clone();
        tokio::spawn(async move {
            CloudRuntime::stream_events(
                runtime_id_clone,
                public_ip,
                ssh_key,
                tx,
                instances,
            ).await;
        });

        tracing::info!(
            "Client {} attached to cloud instance {}",
            client.client_id,
            runtime_id
        );

        Ok(EventStream { rx })
    }

    async fn detach(&self, runtime_id: &str, client_id: &str) -> Result<(), ApiError> {
        {
            let mut streams = self.streams.write().await;
            streams.remove(runtime_id);
        }
        
        tracing::info!(
            "Client {} detached from cloud instance {}",
            client_id,
            runtime_id
        );
        Ok(())
    }

    async fn exec(&self, runtime_id: &str, command: &str, args: &[&str]) -> Result<ExecResult, ApiError> {
        let instances = self.instances.read().await;

        let instance = instances
            .get(runtime_id)
            .ok_or_else(|| ApiError::NotFound(format!("Instance {} not found", runtime_id)))?;

        if instance.status != RuntimeState::Running {
            return Err(ApiError::BadRequest("Instance is not running".to_string()));
        }

        let full_command = if args.is_empty() {
            command.to_string()
        } else {
            format!("{} {}", command, args.join(" "))
        };

        // Execute via SSH
        let ssh_conn = allternit_cloud_ssh::SshConnection::connect(
            &instance.public_ip,
            22,
            "root",
            &instance.ssh_key,
        ).await
        .map_err(|e| ApiError::Internal(format!("SSH connection failed: {}", e)))?;

        let output = ssh_conn.execute(&full_command)
            .await
            .map_err(|e| ApiError::Internal(format!("Command execution failed: {}", e)))?;

        tracing::info!(
            "Executed on cloud instance {}: {} (exit_code: {})",
            runtime_id, full_command, output.exit_code
        );

        Ok(ExecResult {
            exit_code: output.exit_code,
            stdout: output.stdout,
            stderr: output.stderr,
        })
    }

    async fn pause(&self, runtime_id: &str) -> Result<(), ApiError> {
        let mut instances = self.instances.write().await;

        if let Some(instance) = instances.get_mut(runtime_id) {
            // Connect via SSH and pause the agent
            let ssh_conn = allternit_cloud_ssh::SshConnection::connect(
                &instance.public_ip,
                22,
                "root",
                &instance.ssh_key,
            ).await
            .map_err(|e| ApiError::Internal(format!("SSH connection failed: {}", e)))?;

            let _ = ssh_conn.execute("systemctl stop allternit-agent").await;
            
            instance.status = RuntimeState::Paused;
            tracing::info!("Paused cloud instance {}", runtime_id);
            Ok(())
        } else {
            Err(ApiError::NotFound(format!("Instance {} not found", runtime_id)))
        }
    }

    async fn resume(&self, runtime_id: &str) -> Result<(), ApiError> {
        let mut instances = self.instances.write().await;

        if let Some(instance) = instances.get_mut(runtime_id) {
            // Connect via SSH and resume the agent
            let ssh_conn = allternit_cloud_ssh::SshConnection::connect(
                &instance.public_ip,
                22,
                "root",
                &instance.ssh_key,
            ).await
            .map_err(|e| ApiError::Internal(format!("SSH connection failed: {}", e)))?;

            let _ = ssh_conn.execute("systemctl start allternit-agent").await;
            
            instance.status = RuntimeState::Running;
            tracing::info!("Resumed cloud instance {}", runtime_id);
            Ok(())
        } else {
            Err(ApiError::NotFound(format!("Instance {} not found", runtime_id)))
        }
    }
}
