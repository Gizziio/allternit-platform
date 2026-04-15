//! Allternit Guest Agent Protocol
//!
//! Protocol version 1.1.0 for communication between the Allternit host (CLI/Desktop app)
//! and the VM executor running inside the Linux VM.
//!
//! # Naming Distinction
//! - **Allternit**: The AI agent system running on the host
//! - **allternit-vm-executor**: The daemon running INSIDE the VM (this protocol is for it)
//! - **allternit-guest-agent-protocol**: This crate - shared protocol definitions
//!
//! # Architecture
//! ```text
//! Host (macOS/Linux)
//!   └── Allternit / Allternit CLI
//!         └── VSOCK connection (or Unix socket for testing)
//!               └── Linux VM
//!                     └── allternit-vm-executor
//!                           └── bubblewrap sessions
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Protocol version (semver)
pub const PROTOCOL_VERSION: &str = "1.1.0";

/// Minimum compatible protocol version
pub const MIN_PROTOCOL_VERSION: &str = "1.0.0";

/// Maximum message size (10 MB)
pub const MAX_MESSAGE_SIZE: usize = 10 * 1024 * 1024;

/// Session identifier (UUID wrapper)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SessionId(pub Uuid);

impl Default for SessionId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }

}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Uuid> for SessionId {
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

/// Protocol message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ProtocolMessage {
    // === Connection & Health ===
    /// Health check ping
    Heartbeat,
    /// Health check response
    HeartbeatResponse { version: String },
    
    // === Session Management ===
    /// Create a new session
    CreateSession {
        tenant_id: String,
        spec: SpawnSpec,
    },
    /// Session created response
    SessionCreated {
        session_id: SessionId,
        tenant_id: String,
    },
    /// Destroy a session
    DestroySession {
        session_id: SessionId,
    },
    /// Session destroyed confirmation
    SessionDestroyed {
        session_id: SessionId,
    },
    /// List all sessions
    ListSessions,
    /// Session list response
    SessionList {
        sessions: Vec<SessionInfo>,
    },
    
    // === Command Execution ===
    /// Execute a command
    CommandRequest(CommandRequest),
    /// Command execution response
    CommandResponse(CommandResponse),
    
    // === Errors ===
    /// Error response
    Error {
        error: ProtocolError,
        message: String,
    },
}

/// Command execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandRequest {
    /// Unique request ID
    pub request_id: Uuid,
    /// Session to execute in (None = create temporary)
    pub session_id: Option<SessionId>,
    /// Command to execute
    pub command: String,
    /// Command arguments
    pub args: Vec<String>,
    /// Working directory (relative to session workspace)
    pub working_dir: Option<String>,
    /// Additional environment variables
    pub env: HashMap<String, String>,
    /// Timeout in milliseconds
    pub timeout_ms: Option<u64>,
}

/// Command execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResponse {
    /// Request ID (matches CommandRequest)
    pub request_id: Uuid,
    /// Whether execution succeeded (exit code 0)
    pub success: bool,
    /// Standard output
    pub stdout: String,
    /// Standard error
    pub stderr: String,
    /// Exit code
    pub exit_code: i32,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
}

/// Session spawn specification
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SpawnSpec {
    /// Working directory for the session
    pub working_dir: Option<String>,
    /// Environment variables
    pub environment: HashMap<String, String>,
    /// Mount points
    pub mounts: Vec<MountSpec>,
    /// Resource limits
    pub limits: Option<ResourceLimits>,
}

/// Mount specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountSpec {
    /// Source path on host
    pub source: String,
    /// Destination path in VM
    pub destination: String,
    /// Whether mount is read-only
    pub read_only: bool,
}

/// Resource limits for a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    /// Maximum memory in MB
    pub max_memory_mb: u64,
    /// Maximum CPU percentage (100 = 1 core)
    pub max_cpu_percent: u64,
    /// Maximum execution time in seconds
    pub max_execution_time_secs: u64,
    /// Maximum file size in MB
    pub max_file_size_mb: u64,
}

/// Session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    /// Session ID
    pub id: SessionId,
    /// Tenant ID
    pub tenant_id: String,
    /// Creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Last activity timestamp
    pub last_activity: chrono::DateTime<chrono::Utc>,
    /// Current status
    pub status: SessionStatus,
}

/// Session status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    /// Session is being created
    Creating,
    /// Session is ready for commands
    Ready,
    /// Session is executing a command
    Executing,
    /// Session is being destroyed
    Destroying,
    /// Session has been destroyed
    Destroyed,
}

/// Protocol error codes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProtocolError {
    /// Unknown error
    Unknown,
    /// Invalid message format
    InvalidMessage,
    /// Session not found
    SessionNotFound,
    /// Session already exists
    SessionAlreadyExists,
    /// Resource limit exceeded
    ResourceLimitExceeded,
    /// Execution timeout
    ExecutionTimeout,
    /// Execution failed
    ExecutionFailed,
    /// Protocol version mismatch
    VersionMismatch,
    /// Internal error
    InternalError,
    /// Not implemented
    NotImplemented,
}

/// Execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    /// Command is pending
    Pending,
    /// Command is running
    Running,
    /// Command completed successfully
    Completed,
    /// Command failed
    Failed,
    /// Command was cancelled
    Cancelled,
    /// Command timed out
    TimedOut,
}

/// Protocol version information
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProtocolVersion {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
}

impl ProtocolVersion {
    /// Get current protocol version
    pub fn current() -> Self {
        Self::parse(PROTOCOL_VERSION).expect("Invalid PROTOCOL_VERSION constant")
    }

    /// Parse version string
    pub fn parse(version: &str) -> Option<Self> {
        let parts: Vec<&str> = version.split('.').collect();
        if parts.len() != 3 {
            return None;
        }

        Some(Self {
            major: parts[0].parse().ok()?,
            minor: parts[1].parse().ok()?,
            patch: parts[2].parse().ok()?,
        })
    }

    /// Check if this version is compatible with another
    /// Major versions must match, minor must be >= required
    pub fn is_compatible_with(&self, required: &ProtocolVersion) -> bool {
        if self.major != required.major {
            return false;
        }
        self.minor >= required.minor
    }
}

impl Default for ProtocolVersion {
    fn default() -> Self {
        Self::current()
    }
}

impl std::fmt::Display for ProtocolVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

/// Serialize a message to bytes with length prefix
pub fn serialize_message(msg: &ProtocolMessage) -> Result<Vec<u8>, serde_json::Error> {
    let payload = serde_json::to_vec(msg)?;
    let len = payload.len() as u32;
    
    let mut result = Vec::with_capacity(4 + payload.len());
    result.extend_from_slice(&len.to_be_bytes());
    result.extend_from_slice(&payload);
    
    Ok(result)
}

/// Deserialize a message from bytes
pub fn deserialize_message(data: &[u8]) -> Result<ProtocolMessage, ProtocolDeserializeError> {
    if data.len() < 4 {
        return Err(ProtocolDeserializeError::Incomplete);
    }
    
    let len = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    
    if len > MAX_MESSAGE_SIZE {
        return Err(ProtocolDeserializeError::TooLarge(len));
    }
    
    if data.len() < 4 + len {
        return Err(ProtocolDeserializeError::Incomplete);
    }
    
    let msg = serde_json::from_slice(&data[4..4 + len])?;
    Ok(msg)
}

/// Deserialization errors
#[derive(Debug, thiserror::Error)]
pub enum ProtocolDeserializeError {
    #[error("Incomplete message")]
    Incomplete,
    #[error("Message too large: {0} bytes")]
    TooLarge(usize),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_id_display() {
        let id = SessionId(Uuid::nil());
        assert_eq!(id.to_string(), "00000000-0000-0000-0000-000000000000");
    }

    #[test]
    fn test_protocol_version_parsing() {
        let v = ProtocolVersion::parse("1.2.3").unwrap();
        assert_eq!(v.major, 1);
        assert_eq!(v.minor, 2);
        assert_eq!(v.patch, 3);
    }

    #[test]
    fn test_protocol_version_compatibility() {
        let v1_0 = ProtocolVersion::parse("1.0.0").unwrap();
        let v1_1 = ProtocolVersion::parse("1.1.0").unwrap();
        let v2_0 = ProtocolVersion::parse("2.0.0").unwrap();

        assert!(v1_1.is_compatible_with(&v1_0));
        assert!(!v1_0.is_compatible_with(&v1_1));
        assert!(!v2_0.is_compatible_with(&v1_0));
    }

    #[test]
    fn test_message_serialization() {
        let msg = ProtocolMessage::Heartbeat;
        let bytes = serialize_message(&msg).unwrap();
        
        // Check length prefix
        let len = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
        assert_eq!(len, bytes.len() - 4);
        
        // Deserialize
        let decoded = deserialize_message(&bytes).unwrap();
        assert!(matches!(decoded, ProtocolMessage::Heartbeat));
    }

    #[test]
    fn test_deserialize_incomplete() {
        let result = deserialize_message(&[0, 0, 0, 100]); // Says 100 bytes but only 4 provided
        assert!(matches!(result, Err(ProtocolDeserializeError::Incomplete)));
    }

    #[test]
    fn test_deserialize_too_large() {
        let mut data = vec![0u8; 4];
        let huge_size = (MAX_MESSAGE_SIZE + 1) as u32;
        data[0..4].copy_from_slice(&huge_size.to_be_bytes());
        
        let result = deserialize_message(&data);
        assert!(matches!(result, Err(ProtocolDeserializeError::TooLarge(_))));
    }

    #[test]
    fn test_command_request_response_roundtrip() {
        let request = CommandRequest {
            request_id: Uuid::new_v4(),
            session_id: Some(SessionId::default()),
            command: "echo".to_string(),
            args: vec!["hello".to_string()],
            working_dir: Some("/workspace".to_string()),
            env: HashMap::new(),
            timeout_ms: Some(30000),
        };

        let msg = ProtocolMessage::CommandRequest(request.clone());
        let bytes = serialize_message(&msg).unwrap();
        let decoded = deserialize_message(&bytes).unwrap();

        match decoded {
            ProtocolMessage::CommandRequest(decoded_req) => {
                assert_eq!(decoded_req.request_id, request.request_id);
                assert_eq!(decoded_req.command, request.command);
                assert_eq!(decoded_req.args, request.args);
            }
            _ => panic!("Wrong message type"),
        }
    }
}
