//! Guest Agent Client
//!
//! Client for communicating with the guest agent running inside VMs.

use super::{frame_message, parse_response_frame, Message, ProtocolError, Request, Response, Result, PROTOCOL_VERSION};
use crate::types::{Session, SessionId, SessionSpec};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Execution result from guest agent
#[derive(Debug, Clone)]
pub struct ExecResult {
    pub exit_code: i32,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub duration_ms: u64,
}

/// Guest agent client
pub struct GuestAgentClient {
    socket_path: Option<PathBuf>,
}

impl GuestAgentClient {
    /// Create a new guest agent client
    pub fn new() -> Self {
        Self {
            socket_path: None,
        }
    }
    
    /// Create a new client with socket path
    pub fn with_socket(socket_path: impl Into<PathBuf>) -> Self {
        Self {
            socket_path: Some(socket_path.into()),
        }
    }
    
    /// Connect to the guest agent
    async fn connect(&self) -> Result<UnixStream> {
        if let Some(ref path) = self.socket_path {
            debug!("Connecting to guest agent at {:?}", path);
            let stream = UnixStream::connect(path).await?;
            Ok(stream)
        } else {
            Err(ProtocolError::Connection(
                "No socket path configured".to_string()
            ))
        }
    }
    
    /// Send a request and wait for response
    async fn send_request(&self, request: Request) -> Result<Response> {
        let mut stream = self.connect().await?;
        
        let msg = Message {
            id: Uuid::new_v4(),
            payload: request,
        };
        
        // Frame and send
        let framed = frame_message(&msg)?;
        stream.write_all(&framed).await?;
        stream.flush().await?;
        
        debug!("Sent request {}", msg.id);
        
        // Read response
        let mut buffer = vec![0u8; 8192];
        let mut read_buf = Vec::new();
        
        loop {
            match stream.read(&mut buffer).await {
                Ok(0) => break,
                Ok(n) => {
                    read_buf.extend_from_slice(&buffer[..n]);
                    
                    // Try to parse
                    if let Some((response, consumed)) = parse_response_frame(&read_buf)? {
                        if response.id == msg.id {
                            return Ok(response.payload);
                        } else {
                            warn!("Received response with mismatched ID");
                        }
                        read_buf.drain(..consumed);
                    }
                }
                Err(e) => return Err(e.into()),
            }
        }
        
        Err(ProtocolError::InvalidResponse)
    }
    
    /// Ping the guest agent to check connectivity
    pub async fn ping(&mut self) -> Result<u32> {
        debug!("Pinging guest agent");
        
        match self.send_request(Request::Ping).await? {
            Response::Pong { version } => {
                if version != PROTOCOL_VERSION {
                    return Err(ProtocolError::VersionMismatch {
                        expected: PROTOCOL_VERSION,
                        actual: version,
                    });
                }
                info!("Guest agent responded with protocol version {}", version);
                Ok(version)
            }
            Response::Error { message, .. } => {
                Err(ProtocolError::GuestAgent(message))
            }
            _ => Err(ProtocolError::InvalidResponse),
        }
    }
    
    /// Create a new session in the guest
    pub async fn create_session(&mut self, spec: SessionSpec) -> Result<Session> {
        debug!("Creating session via guest agent");
        
        match self.send_request(Request::CreateSession { spec }).await? {
            Response::SessionCreated { session } => {
                info!("Created session {} in guest", session.id);
                Ok(session)
            }
            Response::Error { message, .. } => {
                Err(ProtocolError::GuestAgent(message))
            }
            _ => Err(ProtocolError::InvalidResponse),
        }
    }
    
    /// Destroy a session in the guest
    pub async fn destroy_session(&mut self, session_id: SessionId) -> Result<()> {
        debug!("Destroying session {} via guest agent", session_id);
        
        match self.send_request(Request::DestroySession { session_id }).await? {
            Response::SessionDestroyed { .. } => {
                info!("Destroyed session in guest");
                Ok(())
            }
            Response::Error { message, .. } => {
                Err(ProtocolError::GuestAgent(message))
            }
            _ => Err(ProtocolError::InvalidResponse),
        }
    }
    
    /// List sessions in the guest
    pub async fn list_sessions(&mut self) -> Result<Vec<Session>> {
        debug!("Listing sessions via guest agent");
        
        match self.send_request(Request::ListSessions).await? {
            Response::SessionList { sessions } => {
                debug!("Found {} sessions in guest", sessions.len());
                Ok(sessions)
            }
            Response::Error { message, .. } => {
                Err(ProtocolError::GuestAgent(message))
            }
            _ => Err(ProtocolError::InvalidResponse),
        }
    }
    
    /// Execute a command in a session
    pub async fn exec_in_session(
        &mut self,
        session_id: SessionId,
        command: Vec<String>,
        env: HashMap<String, String>,
        working_dir: Option<String>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecResult> {
        debug!("Executing command in session {} via guest agent", session_id);
        
        match self.send_request(Request::ExecInSession {
            session_id,
            command,
            env,
            working_dir,
            timeout_ms,
        }).await? {
            Response::ExecResult {
                exit_code,
                stdout,
                stderr,
                duration_ms,
            } => {
                debug!("Command completed with exit code {} in {}ms", exit_code, duration_ms);
                Ok(ExecResult {
                    exit_code,
                    stdout,
                    stderr,
                    duration_ms,
                })
            }
            Response::Error { message, .. } => {
                Err(ProtocolError::GuestAgent(message))
            }
            _ => Err(ProtocolError::InvalidResponse),
        }
    }
    
    /// Get session info
    pub async fn get_session_info(&mut self, session_id: SessionId) -> Result<Session> {
        debug!("Getting session info for {} via guest agent", session_id);
        
        match self.send_request(Request::GetSessionInfo { session_id }).await? {
            Response::SessionInfo { session } => Ok(session),
            Response::Error { message, .. } => {
                Err(ProtocolError::GuestAgent(message))
            }
            _ => Err(ProtocolError::InvalidResponse),
        }
    }
    
    /// Set the socket path
    pub fn set_socket_path(&mut self, path: impl Into<PathBuf>) {
        self.socket_path = Some(path.into());
    }
}

impl Default for GuestAgentClient {
    fn default() -> Self {
        Self::new()
    }
}
