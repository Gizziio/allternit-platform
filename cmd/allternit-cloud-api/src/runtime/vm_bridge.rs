//! VM Bridge - Connects Rust Control Plane to TypeScript VM Runtime
//!
//! Uses Unix domain sockets for communication between the Rust control plane
//! and the TypeScript cowork runtime.

use crate::db::cowork_models::*;
use crate::error::ApiError;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

/// VM Bridge for communicating with the TypeScript runtime
pub struct VMBridge {
    /// Socket path for communication
    socket_path: std::path::PathBuf,
}

/// Bridge message protocol
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BridgeMessage {
    /// Start a VM
    StartVM {
        run_id: String,
        vm_id: String,
        config: serde_json::Value,
    },
    /// Stop a VM
    StopVM {
        vm_id: String,
    },
    /// Get VM status
    GetStatus {
        vm_id: String,
    },
    /// Execute command in VM
    Exec {
        vm_id: String,
        command: String,
        args: Vec<String>,
    },
    /// Attach to VM events
    Attach {
        vm_id: String,
        client_id: String,
    },
    /// Detach from VM
    Detach {
        vm_id: String,
        client_id: String,
    },
    /// Pause VM
    Pause {
        vm_id: String,
    },
    /// Resume VM
    Resume {
        vm_id: String,
    },
}

/// Bridge response protocol
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum BridgeResponse {
    Success {
        #[serde(flatten)]
        data: Option<serde_json::Value>,
    },
    Error {
        message: String,
        code: Option<String>,
    },
}

/// VM status from bridge
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VMBridgeStatus {
    pub vm_id: String,
    pub state: String,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub memory_mb: Option<u64>,
    pub cpu_percent: Option<f32>,
}

/// Exec result from bridge
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VMBridgeExecResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl VMBridge {
    /// Create a new VM bridge
    pub fn new(socket_path: std::path::PathBuf) -> Self {
        Self { socket_path }
    }
    
    /// Check if the bridge is available (runtime is running)
    pub async fn is_available(&self) -> bool {
        tokio::net::UnixStream::connect(&self.socket_path).await.is_ok()
    }
    
    /// Send a message and wait for response
    async fn send_message(&self, message: BridgeMessage) -> Result<BridgeResponse, ApiError> {
        let mut stream = UnixStream::connect(&self.socket_path)
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to connect to VM runtime: {}", e)))?;
        
        // Serialize message
        let message_json = serde_json::to_string(&message)
            .map_err(|e| ApiError::SerializationError(e))?;
        
        // Send message (with newline delimiter)
        stream
            .write_all(format!("{}\n", message_json).as_bytes())
            .await
            .map_err(|e| ApiError::IoError(e))?;
        
        // Read response
        let mut reader = BufReader::new(stream);
        let mut response_line = String::new();
        reader
            .read_line(&mut response_line)
            .await
            .map_err(|e| ApiError::IoError(e))?;
        
        // Parse response
        let response: BridgeResponse = serde_json::from_str(&response_line)
            .map_err(|e| ApiError::SerializationError(e))?;
        
        Ok(response)
    }
    
    /// Start a VM
    pub async fn start_vm(&self, run_id: &str, vm_id: &str, config: &RunConfig) -> Result<(), ApiError> {
        let config_json = serde_json::to_value(config)
            .map_err(|e| ApiError::SerializationError(e))?;
        
        let message = BridgeMessage::StartVM {
            run_id: run_id.to_string(),
            vm_id: vm_id.to_string(),
            config: config_json,
        };
        
        match self.send_message(message).await? {
            BridgeResponse::Success { .. } => Ok(()),
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to start VM: {}", message)))
            }
        }
    }
    
    /// Stop a VM
    pub async fn stop_vm(&self, vm_id: &str) -> Result<(), ApiError> {
        let message = BridgeMessage::StopVM {
            vm_id: vm_id.to_string(),
        };
        
        match self.send_message(message).await? {
            BridgeResponse::Success { .. } => Ok(()),
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to stop VM: {}", message)))
            }
        }
    }
    
    /// Get VM status
    pub async fn get_status(&self, vm_id: &str) -> Result<VMBridgeStatus, ApiError> {
        let message = BridgeMessage::GetStatus {
            vm_id: vm_id.to_string(),
        };
        
        match self.send_message(message).await? {
            BridgeResponse::Success { data } => {
                let status: VMBridgeStatus = serde_json::from_value(data.unwrap_or(serde_json::json!({})))
                    .map_err(|e| ApiError::SerializationError(e))?;
                Ok(status)
            }
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to get VM status: {}", message)))
            }
        }
    }
    
    /// Execute command in VM
    pub async fn exec(&self, vm_id: &str, command: &str, args: &[&str]) -> Result<VMBridgeExecResult, ApiError> {
        let message = BridgeMessage::Exec {
            vm_id: vm_id.to_string(),
            command: command.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
        };
        
        match self.send_message(message).await? {
            BridgeResponse::Success { data } => {
                let result: VMBridgeExecResult = serde_json::from_value(data.unwrap_or(serde_json::json!({})))
                    .map_err(|e| ApiError::SerializationError(e))?;
                Ok(result)
            }
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to exec in VM: {}", message)))
            }
        }
    }
    
    /// Attach to VM events
    pub async fn attach(&self, vm_id: &str, client_id: &str) -> Result<tokio::sync::mpsc::Receiver<BridgeEvent>, ApiError> {
        let message = BridgeMessage::Attach {
            vm_id: vm_id.to_string(),
            client_id: client_id.to_string(),
        };
        
        // Send attach request
        match self.send_message(message).await? {
            BridgeResponse::Success { .. } => {
                // Create event channel
                let (tx, rx) = tokio::sync::mpsc::channel(1000);
                
                // Spawn task to listen for events
                let socket_path = self.socket_path.clone();
                let vm_id = vm_id.to_string();
                let client_id = client_id.to_string();
                
                tokio::spawn(async move {
                    if let Err(e) = listen_for_events(&socket_path, &vm_id, &client_id, tx).await {
                        tracing::error!("Event listener error: {}", e);
                    }
                });
                
                Ok(rx)
            }
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to attach to VM: {}", message)))
            }
        }
    }
    
    /// Detach from VM
    pub async fn detach(&self, vm_id: &str, client_id: &str) -> Result<(), ApiError> {
        let message = BridgeMessage::Detach {
            vm_id: vm_id.to_string(),
            client_id: client_id.to_string(),
        };
        
        match self.send_message(message).await? {
            BridgeResponse::Success { .. } => Ok(()),
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to detach from VM: {}", message)))
            }
        }
    }
    
    /// Pause VM
    pub async fn pause(&self, vm_id: &str) -> Result<(), ApiError> {
        let message = BridgeMessage::Pause {
            vm_id: vm_id.to_string(),
        };
        
        match self.send_message(message).await? {
            BridgeResponse::Success { .. } => Ok(()),
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to pause VM: {}", message)))
            }
        }
    }
    
    /// Resume VM
    pub async fn resume(&self, vm_id: &str) -> Result<(), ApiError> {
        let message = BridgeMessage::Resume {
            vm_id: vm_id.to_string(),
        };
        
        match self.send_message(message).await? {
            BridgeResponse::Success { .. } => Ok(()),
            BridgeResponse::Error { message, .. } => {
                Err(ApiError::Internal(format!("Failed to resume VM: {}", message)))
            }
        }
    }
}

/// Bridge event from VM
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BridgeEvent {
    pub vm_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Listen for events from the runtime
async fn listen_for_events(
    socket_path: &std::path::Path,
    vm_id: &str,
    client_id: &str,
    tx: tokio::sync::mpsc::Sender<BridgeEvent>,
) -> Result<(), ApiError> {
    let mut stream = UnixStream::connect(socket_path)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to connect for events: {}", e)))?;
    
    // Subscribe to events for this VM
    let subscribe_msg = serde_json::json!({
        "type": "subscribe_events",
        "vm_id": vm_id,
        "client_id": client_id,
    });
    
    stream
        .write_all(format!("{}\n", subscribe_msg).as_bytes())
        .await
        .map_err(|e| ApiError::IoError(e))?;
    
    // Read events
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                // EOF - connection closed
                break;
            }
            Ok(_) => {
                if let Ok(event) = serde_json::from_str::<BridgeEvent>(&line) {
                    if tx.send(event).await.is_err() {
                        // Channel closed
                        break;
                    }
                }
            }
            Err(e) => {
                tracing::error!("Error reading event: {}", e);
                break;
            }
        }
    }
    
    Ok(())
}

/// VM Bridge Manager - manages the connection to the TypeScript runtime
pub struct VMBridgeManager {
    /// Bridge to the VM runtime
    bridge: VMBridge,
    /// Whether the runtime is available
    available: std::sync::atomic::AtomicBool,
}

impl VMBridgeManager {
    /// Create a new bridge manager
    pub fn new(data_dir: &std::path::Path) -> Self {
        let socket_path = data_dir.join("runtime.sock");
        Self {
            bridge: VMBridge::new(socket_path),
            available: std::sync::atomic::AtomicBool::new(false),
        }
    }
    
    /// Check if runtime is available
    pub async fn check_availability(&self) -> bool {
        let available = self.bridge.is_available().await;
        self.available.store(available, std::sync::atomic::Ordering::Relaxed);
        available
    }
    
    /// Get the bridge (checking availability first)
    pub async fn get_bridge(&self) -> Result<&VMBridge, ApiError> {
        if !self.available.load(std::sync::atomic::Ordering::Relaxed) {
            if !self.check_availability().await {
                return Err(ApiError::Internal(
                    "VM runtime not available. Is the TypeScript runtime running?".to_string()
                ));
            }
        }
        Ok(&self.bridge)
    }
}
