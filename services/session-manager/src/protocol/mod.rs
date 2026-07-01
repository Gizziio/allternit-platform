//! Guest Agent Protocol
//!
//! This module defines the protocol for communication between the host
//! and guest VMs via VSOCK or Unix sockets.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use uuid::Uuid;

pub mod client;

pub use client::GuestAgentClient;

/// Protocol version
pub const PROTOCOL_VERSION: u32 = 1;

/// Protocol errors
#[derive(Error, Debug)]
pub enum ProtocolError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Connection error: {0}")]
    Connection(String),
    
    #[error("Request timeout")]
    Timeout,
    
    #[error("Guest agent error: {0}")]
    GuestAgent(String),
    
    #[error("Invalid response")]
    InvalidResponse,
    
    #[error("Protocol version mismatch: expected {expected}, got {actual}")]
    VersionMismatch { expected: u32, actual: u32 },
}

/// Result type for protocol operations
pub type Result<T> = std::result::Result<T, ProtocolError>;

/// Request types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Request {
    #[serde(rename = "ping")]
    Ping,
    
    #[serde(rename = "create_session")]
    CreateSession {
        spec: crate::types::SessionSpec,
    },
    
    #[serde(rename = "destroy_session")]
    DestroySession {
        session_id: crate::types::SessionId,
    },
    
    #[serde(rename = "list_sessions")]
    ListSessions,
    
    #[serde(rename = "exec_in_session")]
    ExecInSession {
        session_id: crate::types::SessionId,
        command: Vec<String>,
        env: HashMap<String, String>,
        working_dir: Option<String>,
        timeout_ms: Option<u64>,
    },
    
    #[serde(rename = "get_session_info")]
    GetSessionInfo {
        session_id: crate::types::SessionId,
    },
}

/// Response types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Response {
    #[serde(rename = "pong")]
    Pong {
        version: u32,
    },
    
    #[serde(rename = "session_created")]
    SessionCreated {
        session: crate::types::Session,
    },
    
    #[serde(rename = "session_destroyed")]
    SessionDestroyed {
        session_id: crate::types::SessionId,
    },
    
    #[serde(rename = "session_list")]
    SessionList {
        sessions: Vec<crate::types::Session>,
    },
    
    #[serde(rename = "exec_result")]
    ExecResult {
        exit_code: i32,
        stdout: Vec<u8>,
        stderr: Vec<u8>,
        duration_ms: u64,
    },
    
    #[serde(rename = "session_info")]
    SessionInfo {
        session: crate::types::Session,
    },
    
    #[serde(rename = "error")]
    Error {
        message: String,
        code: Option<String>,
    },
}

/// Protocol message wrapper (for requests)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: Uuid,
    pub payload: Request,
}

/// Protocol message wrapper (for responses)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMessage {
    pub id: Uuid,
    pub payload: Response,
}

/// Frame a message for transmission
pub fn frame_message(msg: &Message) -> Result<Vec<u8>> {
    let json = serde_json::to_vec(msg)?;
    let len = json.len() as u32;
    let mut framed = Vec::with_capacity(4 + json.len());
    framed.extend_from_slice(&len.to_be_bytes());
    framed.extend_from_slice(&json);
    Ok(framed)
}

/// Frame a response for transmission
pub fn frame_response(msg: &ResponseMessage) -> Result<Vec<u8>> {
    let json = serde_json::to_vec(msg)?;
    let len = json.len() as u32;
    let mut framed = Vec::with_capacity(4 + json.len());
    framed.extend_from_slice(&len.to_be_bytes());
    framed.extend_from_slice(&json);
    Ok(framed)
}

/// Parse a framed request
pub fn parse_frame(data: &[u8]) -> Result<Option<(Message, usize)>> {
    if data.len() < 4 {
        return Ok(None);
    }
    
    let len = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    
    if data.len() < 4 + len {
        return Ok(None);
    }
    
    let msg: Message = serde_json::from_slice(&data[4..4 + len])?;
    Ok(Some((msg, 4 + len)))
}

/// Parse a framed response
pub fn parse_response_frame(data: &[u8]) -> Result<Option<(ResponseMessage, usize)>> {
    if data.len() < 4 {
        return Ok(None);
    }
    
    let len = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    
    if data.len() < 4 + len {
        return Ok(None);
    }
    
    let msg: ResponseMessage = serde_json::from_slice(&data[4..4 + len])?;
    Ok(Some((msg, 4 + len)))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_frame_roundtrip() {
        let msg = Message {
            id: Uuid::new_v4(),
            payload: Request::Ping,
        };
        
        let framed = frame_message(&msg).unwrap();
        let (parsed, consumed) = parse_frame(&framed).unwrap().unwrap();
        
        assert_eq!(consumed, framed.len());
        assert_eq!(parsed.id, msg.id);
    }
}
