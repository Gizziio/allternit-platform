//! Desktop App Connector
//!
//! Connects the CLI to the A2R Desktop app via Unix socket.
//! This allows the CLI to execute commands in the VM managed by the Desktop app.
//!
//! # Architecture
//! ```
//! CLI Process
//!     │
//!     ├──► Check /var/run/a2r/desktop-vm.sock (or ~/.a2r/desktop-vm.sock)
//!     │
//!     ├──► Socket exists? ──► Connect via Unix socket
//!     │                           │
//!     │                           ▼
//!     │                       Desktop App (Electron)
//!     │                           │
//!     │                           ▼
//!     │                       a2r-vm-executor (in VM)
//!     │                           │
//!     │                           ▼
//!     │                       Command Execution
//!     │
//!     └──► Socket missing? ──► Fallback to HTTP API (direct kernel)
//! ```

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;
use tracing::{debug, error, info, warn};

/// Default socket path for Desktop app communication
const DEFAULT_SOCKET_PATH: &str = "/var/run/a2r/desktop-vm.sock";

/// Fallback socket path in user's home directory
fn fallback_socket_path() -> Option<PathBuf> {
    directories::UserDirs::new().map(|dirs| dirs.home_dir().join(".a2r/desktop-vm.sock"))
}

/// Desktop connector client
pub struct DesktopConnector {
    socket_path: PathBuf,
}

/// Protocol message for Desktop app communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DesktopMessage {
    /// Health check ping
    Ping,
    /// Health check response
    Pong { version: String },
    /// Execute a command
    Execute {
        request_id: String,
        command: String,
        args: Vec<String>,
        working_dir: Option<String>,
        env: Option<std::collections::HashMap<String, String>>,
        timeout_ms: Option<u64>,
    },
    /// Command execution response
    ExecuteResult {
        request_id: String,
        success: bool,
        stdout: String,
        stderr: String,
        exit_code: i32,
        execution_time_ms: u64,
    },
    /// Create a new session
    CreateSession {
        tenant_id: String,
    },
    /// Session created
    SessionCreated {
        session_id: String,
        tenant_id: String,
    },
    /// Destroy a session
    DestroySession {
        session_id: String,
    },
    /// Session destroyed
    SessionDestroyed {
        session_id: String,
    },
    /// Error response
    Error {
        request_id: Option<String>,
        error: String,
        code: Option<String>,
    },
}

/// Command execution result
#[derive(Debug, Clone)]
pub struct ExecuteResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub execution_time_ms: u64,
}

/// Desktop app information
#[derive(Debug, Clone)]
pub struct DesktopInfo {
    pub version: String,
    pub socket_path: PathBuf,
}

impl DesktopConnector {
    /// Create a new desktop connector
    pub fn new() -> Self {
        let socket_path = Self::detect_socket_path();
        Self { socket_path }
    }

    /// Create a connector with a specific socket path
    pub fn with_socket_path(path: PathBuf) -> Self {
        Self { socket_path: path }
    }

    /// Detect the socket path
    fn detect_socket_path() -> PathBuf {
        // Try default path first
        let default = PathBuf::from(DEFAULT_SOCKET_PATH);
        if std::fs::metadata(&default).is_ok() {
            return default;
        }

        // Try fallback path
        if let Some(fallback) = fallback_socket_path() {
            if std::fs::metadata(&fallback).is_ok() {
                return fallback;
            }
        }

        // Return default even if it doesn't exist (will fail on connect)
        default
    }

    /// Check if Desktop app is available
    pub fn is_available(&self) -> bool {
        std::fs::metadata(&self.socket_path).is_ok()
    }

    /// Get the socket path
    pub fn socket_path(&self) -> &PathBuf {
        &self.socket_path
    }

    /// Connect to Desktop app and check health
    pub async fn connect(&self) -> Result<DesktopInfo> {
        if !self.is_available() {
            anyhow::bail!(
                "Desktop app not available at {}. \
                 Make sure A2R Desktop is running.",
                self.socket_path.display()
            );
        }

        debug!("Connecting to Desktop app at {}", self.socket_path.display());

        let mut stream = UnixStream::connect(&self.socket_path)
            .await
            .with_context(|| {
                format!(
                    "Failed to connect to Desktop app at {}",
                    self.socket_path.display()
                )
            })?;

        // Send ping
        let ping = DesktopMessage::Ping;
        self.send_message(&mut stream, &ping).await?;

        // Wait for pong
        let response = self.receive_message(&mut stream).await?;

        match response {
            DesktopMessage::Pong { version } => {
                info!("Connected to Desktop app v{}", version);
                Ok(DesktopInfo {
                    version,
                    socket_path: self.socket_path.clone(),
                })
            }
            DesktopMessage::Error { error, .. } => {
                anyhow::bail!("Desktop app error: {}", error)
            }
            _ => {
                anyhow::bail!("Unexpected response from Desktop app")
            }
        }
    }

    /// Execute a command in the VM
    pub async fn execute(
        &self,
        command: &str,
        args: &[String],
        working_dir: Option<&str>,
        env: Option<std::collections::HashMap<String, String>>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecuteResult> {
        let mut stream = UnixStream::connect(&self.socket_path)
            .await
            .with_context(|| {
                format!(
                    "Failed to connect to Desktop app at {}",
                    self.socket_path.display()
                )
            })?;

        let request_id = uuid::Uuid::new_v4().to_string();

        let msg = DesktopMessage::Execute {
            request_id: request_id.clone(),
            command: command.to_string(),
            args: args.to_vec(),
            working_dir: working_dir.map(|s| s.to_string()),
            env,
            timeout_ms,
        };

        self.send_message(&mut stream, &msg).await?;

        // Wait for response
        let response = self.receive_message(&mut stream).await?;

        match response {
            DesktopMessage::ExecuteResult {
                request_id: resp_id,
                success,
                stdout,
                stderr,
                exit_code,
                execution_time_ms,
            } => {
                if resp_id != request_id {
                    anyhow::bail!("Request ID mismatch in response");
                }

                Ok(ExecuteResult {
                    success,
                    stdout,
                    stderr,
                    exit_code,
                    execution_time_ms,
                })
            }
            DesktopMessage::Error { error, .. } => {
                anyhow::bail!("Command execution error: {}", error)
            }
            _ => {
                anyhow::bail!("Unexpected response from Desktop app")
            }
        }
    }

    /// Create a new VM session
    pub async fn create_session(&self, tenant_id: &str) -> Result<String> {
        let mut stream = UnixStream::connect(&self.socket_path).await?;

        let msg = DesktopMessage::CreateSession {
            tenant_id: tenant_id.to_string(),
        };

        self.send_message(&mut stream, &msg).await?;

        let response = self.receive_message(&mut stream).await?;

        match response {
            DesktopMessage::SessionCreated { session_id, .. } => Ok(session_id),
            DesktopMessage::Error { error, .. } => anyhow::bail!("Failed to create session: {}", error),
            _ => anyhow::bail!("Unexpected response"),
        }
    }

    /// Destroy a VM session
    pub async fn destroy_session(&self, session_id: &str) -> Result<()> {
        let mut stream = UnixStream::connect(&self.socket_path).await?;

        let msg = DesktopMessage::DestroySession {
            session_id: session_id.to_string(),
        };

        self.send_message(&mut stream, &msg).await?;

        let response = self.receive_message(&mut stream).await?;

        match response {
            DesktopMessage::SessionDestroyed { .. } => Ok(()),
            DesktopMessage::Error { error, .. } => anyhow::bail!("Failed to destroy session: {}", error),
            _ => anyhow::bail!("Unexpected response"),
        }
    }

    /// Send a message over the stream
    async fn send_message(
        &self,
        stream: &mut UnixStream,
        msg: &DesktopMessage,
    ) -> Result<()> {
        let json = serde_json::to_string(msg)?;
        let bytes = json.as_bytes();
        let len = bytes.len() as u32;

        // Send length prefix (4 bytes, big-endian)
        stream.write_all(&len.to_be_bytes()).await?;
        // Send message
        stream.write_all(bytes).await?;
        stream.flush().await?;

        debug!("Sent message: {:?}", msg);
        Ok(())
    }

    /// Receive a message from the stream
    async fn receive_message(&self, stream: &mut UnixStream) -> Result<DesktopMessage> {
        // Read length prefix
        let mut len_bytes = [0u8; 4];
        stream.read_exact(&mut len_bytes).await?;
        let len = u32::from_be_bytes(len_bytes) as usize;

        if len > 10 * 1024 * 1024 {
            // 10 MB limit
            anyhow::bail!("Message too large: {} bytes", len);
        }

        // Read message body
        let mut buffer = vec![0u8; len];
        stream.read_exact(&mut buffer).await?;

        let msg: DesktopMessage = serde_json::from_slice(&buffer)?;
        debug!("Received message: {:?}", msg);

        Ok(msg)
    }
}

impl Default for DesktopConnector {
    fn default() -> Self {
        Self::new()
    }
}

/// Find the Desktop app socket path
pub fn find_desktop_socket() -> Option<PathBuf> {
    // Try default path
    let default = PathBuf::from(DEFAULT_SOCKET_PATH);
    if std::fs::metadata(&default).is_ok() {
        return Some(default);
    }

    // Try fallback path
    if let Some(fallback) = fallback_socket_path() {
        if std::fs::metadata(&fallback).is_ok() {
            return Some(fallback);
        }
    }

    None
}

/// Check if Desktop app is running
pub fn is_desktop_app_running() -> bool {
    find_desktop_socket().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_desktop_message_serialization() {
        let msg = DesktopMessage::Ping;
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("ping"));

        let decoded: DesktopMessage = serde_json::from_str(&json).unwrap();
        assert!(matches!(decoded, DesktopMessage::Ping));
    }

    #[test]
    fn test_desktop_message_execute() {
        let msg = DesktopMessage::Execute {
            request_id: "test-123".to_string(),
            command: "echo".to_string(),
            args: vec!["hello".to_string()],
            working_dir: None,
            env: None,
            timeout_ms: Some(30000),
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("execute"));
        assert!(json.contains("test-123"));
    }
}
