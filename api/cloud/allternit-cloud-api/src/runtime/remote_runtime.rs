//! Remote Runtime Implementation
//!
//! Production runtime for VPS/remote server execution via SSH.

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

use crate::db::cowork_models::*;
use crate::error::ApiError;
use crate::runtime::*;

/// Remote runtime for SSH-based execution
pub struct RemoteRuntime {
    /// SSH executor for remote commands
    ssh_executor: allternit_cloud_ssh::SshExecutor,
    /// Active connections
    connections: Arc<RwLock<HashMap<String, RemoteConnection>>>,
    /// Event streams for each runtime
    streams: Arc<RwLock<HashMap<String, mpsc::Sender<RuntimeEvent>>>>,
}

/// Remote connection state
#[derive(Clone)]
struct RemoteConnection {
    host: String,
    port: u16,
    username: String,
    private_key: String,
    runtime_id: String,
    status: RuntimeState,
    ssh_conn: Option<Arc<tokio::sync::Mutex<allternit_cloud_ssh::SshConnection>>>,
}

impl RemoteRuntime {
    /// Create a new remote runtime
    pub async fn new() -> Result<Self, ApiError> {
        Ok(Self {
            ssh_executor: allternit_cloud_ssh::SshExecutor::new(),
            connections: Arc::new(RwLock::new(HashMap::new())),
            streams: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Generate a unique runtime ID
    fn generate_runtime_id(&self) -> String {
        format!("remote-{}", uuid::Uuid::new_v4())
    }

    /// Get SSH private key from environment or config
    fn get_ssh_key(&self) -> Result<String, ApiError> {
        // First try environment variable
        if let Ok(key) = std::env::var("REMOTE_SSH_PRIVATE_KEY") {
            return Ok(key);
        }
        
        // Try to read from default location
        let home = std::env::var("HOME")
            .map_err(|_| ApiError::Internal("HOME environment variable not set".to_string()))?;
        let key_path = format!("{}/.ssh/id_rsa", home);
        
        if std::path::Path::new(&key_path).exists() {
            return std::fs::read_to_string(&key_path)
                .map_err(|e| ApiError::Internal(format!("Failed to read SSH key: {}", e)));
        }
        
        // Generate a new keypair if none exists
        self.ssh_executor.generate_keypair()
            .map(|k| k.private_key)
            .map_err(|e| ApiError::Internal(format!("Failed to generate SSH key: {}", e)))
    }

    /// Stream events from remote host
    async fn stream_events(
        runtime_id: String,
        conn: Arc<tokio::sync::Mutex<allternit_cloud_ssh::SshConnection>>,
        tx: mpsc::Sender<RuntimeEvent>,
        connections: Arc<RwLock<HashMap<String, RemoteConnection>>>,
    ) {
        // Stream events via SSH tailing remote log
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));
        
        loop {
            interval.tick().await;
            
            // Check if connection still exists
            let conn_exists = {
                let conns = connections.read().await;
                conns.contains_key(&runtime_id)
            };
            
            if !conn_exists {
                break;
            }
            
            // Try to get status from remote
            let result = {
                let ssh = conn.lock().await;
                ssh.execute("cat /var/log/a2r/run.status 2>/dev/null || echo '{}'").await
            };
            
            match result {
                Ok(output) if output.exit_code == 0 => {
                    let event = RuntimeEvent {
                        event_type: RuntimeEventType::Heartbeat,
                        payload: serde_json::json!({
                            "runtime_id": runtime_id,
                            "status": output.stdout.trim(),
                        }),
                        timestamp: chrono::Utc::now(),
                    };
                    
                    if tx.send(event).await.is_err() {
                        break;
                    }
                }
                _ => {
                    // Connection lost
                    let event = RuntimeEvent {
                        event_type: RuntimeEventType::Error,
                        payload: serde_json::json!({
                            "runtime_id": runtime_id,
                            "error": "Failed to get remote status",
                        }),
                        timestamp: chrono::Utc::now(),
                    };
                    
                    let _ = tx.send(event).await;
                    break;
                }
            }
        }
        
        // Update connection status
        let mut conns = connections.write().await;
        if let Some(conn) = conns.get_mut(&runtime_id) {
            conn.status = RuntimeState::Stopped;
        }
    }
}

#[async_trait]
impl Runtime for RemoteRuntime {
    async fn start(&self, run_id: &str, config: &RunConfig) -> Result<RuntimeHandle, ApiError> {
        let runtime_id = self.generate_runtime_id();
        
        // Extract connection info from config.extra
        let host = config.extra
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::BadRequest("Remote host required in config.extra.host".to_string()))?;
        
        let port = config.extra
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(22) as u16;
        
        let username = config.extra
            .get("username")
            .and_then(|v| v.as_str())
            .unwrap_or("root");
        
        // Get SSH key
        let private_key = self.get_ssh_key()?;

        // Establish SSH connection
        let ssh_conn = allternit_cloud_ssh::SshConnection::connect(host, port, username, &private_key)
            .await
            .map_err(|e| ApiError::Internal(format!("SSH connection failed: {}", e)))?;

        // Start the run on remote host
        let cmd = if let Some(command) = &config.command {
            format!(
                "cd {} && {}",
                config.working_dir.as_deref().unwrap_or("/tmp"),
                command
            )
        } else {
            format!("echo 'Run {} started on remote host'", run_id)
        };
        
        let output = ssh_conn.execute(&cmd)
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to start remote run: {}", e)))?;
        
        if output.exit_code != 0 {
            return Err(ApiError::Internal(
                format!("Remote command failed: {}", output.stderr)
            ));
        }

        // Store connection info
        let connection = RemoteConnection {
            host: host.to_string(),
            port,
            username: username.to_string(),
            private_key,
            runtime_id: runtime_id.clone(),
            status: RuntimeState::Running,
            ssh_conn: Some(Arc::new(tokio::sync::Mutex::new(ssh_conn))),
        };

        {
            let mut conns = self.connections.write().await;
            conns.insert(runtime_id.clone(), connection);
        }

        tracing::info!(
            "Remote run {} started on {}:{} as {} (output: {})",
            run_id, host, port, username, output.stdout.trim()
        );

        Ok(RuntimeHandle {
            runtime_id,
            runtime_type: "remote".to_string(),
            connection_info: ConnectionInfo {
                host: host.to_string(),
                port,
                socket_path: None,
                token: None,
            },
        })
    }

    async fn stop(&self, runtime_id: &str) -> Result<(), ApiError> {
        let mut conns = self.connections.write().await;
        
        if let Some(conn) = conns.get_mut(runtime_id) {
            if let Some(ssh_conn) = &conn.ssh_conn {
                let ssh = ssh_conn.lock().await;
                // Send stop signal to remote process
                let _ = ssh.execute("pkill -f 'a2r-run'").await;
            }
            
            conn.status = RuntimeState::Stopped;
            tracing::info!("Stopped remote runtime {}", runtime_id);
            Ok(())
        } else {
            Err(ApiError::NotFound(format!("Runtime {} not found", runtime_id)))
        }
    }

    async fn status(&self, runtime_id: &str) -> Result<RuntimeStatus, ApiError> {
        let conns = self.connections.read().await;
        
        if let Some(conn) = conns.get(runtime_id) {
            // If we have an active connection, check remote status
            if let Some(ssh_conn) = &conn.ssh_conn {
                let ssh = ssh_conn.lock().await;
                let output = ssh.execute("echo 'status check'").await;
                
                if output.is_err() {
                    return Ok(RuntimeStatus {
                        state: RuntimeState::Failed,
                        pid: None,
                        exit_code: Some(1),
                        resource_usage: None,
                    });
                }
            }
            
            Ok(RuntimeStatus {
                state: conn.status.clone(),
                pid: None,
                exit_code: None,
                resource_usage: None,
            })
        } else {
            Err(ApiError::NotFound(format!("Runtime {} not found", runtime_id)))
        }
    }

    async fn attach(&self, runtime_id: &str, client: ClientInfo) -> Result<EventStream, ApiError> {
        let conns = self.connections.read().await;
        
        let conn = conns.get(runtime_id)
            .ok_or_else(|| ApiError::NotFound(format!("Runtime {} not found", runtime_id)))?;
        
        let ssh_conn = conn.ssh_conn.clone()
            .ok_or_else(|| ApiError::Internal("No SSH connection available".to_string()))?;
        
        drop(conns);

        // Create event channel
        let (tx, rx) = mpsc::channel(100);
        
        // Store the sender
        {
            let mut streams = self.streams.write().await;
            streams.insert(runtime_id.to_string(), tx.clone());
        }

        // Spawn event streaming task
        let runtime_id_clone = runtime_id.to_string();
        let connections = self.connections.clone();
        tokio::spawn(async move {
            RemoteRuntime::stream_events(
                runtime_id_clone,
                ssh_conn,
                tx,
                connections,
            ).await;
        });

        tracing::info!(
            "Client {} attached to remote runtime {}",
            client.client_id,
            runtime_id
        );

        Ok(EventStream { rx })
    }

    async fn detach(&self, runtime_id: &str, client_id: &str) -> Result<(), ApiError> {
        // Remove stream
        {
            let mut streams = self.streams.write().await;
            streams.remove(runtime_id);
        }
        
        tracing::info!(
            "Client {} detached from remote runtime {}",
            client_id,
            runtime_id
        );
        Ok(())
    }

    async fn exec(&self, runtime_id: &str, command: &str, args: &[&str]) -> Result<ExecResult, ApiError> {
        let conns = self.connections.read().await;
        
        let conn = conns
            .get(runtime_id)
            .ok_or_else(|| ApiError::NotFound(format!("Runtime {} not found", runtime_id)))?;
        
        let ssh_conn = conn.ssh_conn.clone()
            .ok_or_else(|| ApiError::Internal("No SSH connection available".to_string()))?;
        
        // Build full command
        let full_command = if args.is_empty() {
            command.to_string()
        } else {
            format!("{} {}", command, args.join(" "))
        };

        // Execute via SSH
        let ssh = ssh_conn.lock().await;
        let output = ssh.execute(&full_command)
            .await
            .map_err(|e| ApiError::Internal(format!("SSH execution failed: {}", e)))?;

        tracing::info!(
            "Executed on {}: {} (exit_code: {})",
            conn.host,
            full_command,
            output.exit_code
        );

        Ok(ExecResult {
            exit_code: output.exit_code,
            stdout: output.stdout,
            stderr: output.stderr,
        })
    }

    async fn pause(&self, runtime_id: &str) -> Result<(), ApiError> {
        let mut conns = self.connections.write().await;
        
        if let Some(conn) = conns.get_mut(runtime_id) {
            if let Some(ssh_conn) = &conn.ssh_conn {
                let ssh = ssh_conn.lock().await;
                let _ = ssh.execute("kill -STOP $(pgrep -f 'a2r-run')").await;
            }
            conn.status = RuntimeState::Paused;
            tracing::info!("Paused remote runtime {}", runtime_id);
            Ok(())
        } else {
            Err(ApiError::NotFound(format!("Runtime {} not found", runtime_id)))
        }
    }

    async fn resume(&self, runtime_id: &str) -> Result<(), ApiError> {
        let mut conns = self.connections.write().await;
        
        if let Some(conn) = conns.get_mut(runtime_id) {
            if let Some(ssh_conn) = &conn.ssh_conn {
                let ssh = ssh_conn.lock().await;
                let _ = ssh.execute("kill -CONT $(pgrep -f 'a2r-run')").await;
            }
            conn.status = RuntimeState::Running;
            tracing::info!("Resumed remote runtime {}", runtime_id);
            Ok(())
        } else {
            Err(ApiError::NotFound(format!("Runtime {} not found", runtime_id)))
        }
    }
}
