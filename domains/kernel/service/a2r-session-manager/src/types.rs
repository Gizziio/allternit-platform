//! Core types for session management

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Unique session identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SessionId(pub Uuid);

impl SessionId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn nil() -> Self {
        Self(Uuid::nil())
    }
}

impl Default for SessionId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Session status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    /// Session is being created
    Creating,
    /// Session is ready but not running
    Ready,
    /// Session has active processes
    Running,
    /// Session is paused
    Paused,
    /// Session has stopped
    Stopped,
    /// Session encountered an error
    Error,
    /// Session is being destroyed
    Destroying,
    /// Session has been destroyed
    Destroyed,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionStatus::Creating => write!(f, "creating"),
            SessionStatus::Ready => write!(f, "ready"),
            SessionStatus::Running => write!(f, "running"),
            SessionStatus::Paused => write!(f, "paused"),
            SessionStatus::Stopped => write!(f, "stopped"),
            SessionStatus::Error => write!(f, "error"),
            SessionStatus::Destroying => write!(f, "destroying"),
            SessionStatus::Destroyed => write!(f, "destroyed"),
        }
    }
}

/// Session specification for creation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSpec {
    /// Session name (optional - auto-generated if not provided)
    pub name: Option<String>,
    /// Working directory for the session
    pub working_dir: String,
    /// Environment variables
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    /// Resource limits
    pub resources: ResourceLimits,
    /// Use VM isolation (vs process isolation)
    #[serde(default)]
    pub use_vm: bool,
    /// Container/VM image to use
    pub image: String,
    /// Session timeout in seconds (0 = no timeout)
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

fn default_timeout() -> u64 {
    3600 // 1 hour default
}

impl SessionSpec {
    /// Create a specification for a code execution session
    pub fn code_session(working_dir: impl Into<String>) -> Self {
        Self {
            name: None,
            working_dir: working_dir.into(),
            env_vars: HashMap::new(),
            resources: ResourceLimits::default(),
            use_vm: false,
            image: "default".to_string(),
            timeout_secs: 3600,
        }
    }

    /// Create a specification with VM isolation
    pub fn vm_session(working_dir: impl Into<String>, image: impl Into<String>) -> Self {
        Self {
            name: None,
            working_dir: working_dir.into(),
            env_vars: HashMap::new(),
            resources: ResourceLimits::default(),
            use_vm: true,
            image: image.into(),
            timeout_secs: 3600,
        }
    }

    /// Set the session name
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Set environment variables
    pub fn with_env(mut self, env: HashMap<String, String>) -> Self {
        self.env_vars = env;
        self
    }

    /// Set resource limits
    pub fn with_resources(mut self, resources: ResourceLimits) -> Self {
        self.resources = resources;
        self
    }
}

/// Resource limits for a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    /// CPU cores (floating point for fractional cores)
    pub cpu_cores: f32,
    /// Memory limit in MiB
    pub memory_mib: u32,
    /// Disk limit in MiB
    pub disk_mib: u32,
    /// Network egress limit in MiB
    pub network_egress_mib: Option<u32>,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            cpu_cores: 1.0,
            memory_mib: 512,
            disk_mib: 1024,
            network_egress_mib: None,
        }
    }
}

/// Session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Unique session ID
    pub id: SessionId,
    /// Human-readable name
    pub name: String,
    /// Current status
    pub status: SessionStatus,
    /// Session specification
    pub spec: SessionSpec,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last activity timestamp
    pub last_activity_at: DateTime<Utc>,
    /// Process/VM ID (driver-specific)
    pub driver_handle_id: Option<String>,
    /// Driver type used
    pub driver_type: String,
    /// Exit code (if session has ended)
    pub exit_code: Option<i32>,
    /// Error message (if status is Error)
    pub error_message: Option<String>,
}

impl Session {
    /// Create a new session from a specification
    pub fn new(spec: SessionSpec) -> Self {
        let id = SessionId::new();
        let name = spec.name.clone().unwrap_or_else(|| {
            format!("session-{}", id.0.to_string().split('-').next().unwrap_or("unknown"))
        });
        let now = Utc::now();

        Self {
            id,
            name,
            status: SessionStatus::Creating,
            spec,
            created_at: now,
            last_activity_at: now,
            driver_handle_id: None,
            driver_type: String::new(),
            exit_code: None,
            error_message: None,
        }
    }

    /// Check if the session is active (can execute commands)
    pub fn is_active(&self) -> bool {
        matches!(
            self.status,
            SessionStatus::Ready | SessionStatus::Running | SessionStatus::Paused
        )
    }

    /// Check if the session has ended
    pub fn is_ended(&self) -> bool {
        matches!(
            self.status,
            SessionStatus::Stopped | SessionStatus::Error | SessionStatus::Destroyed
        )
    }

    /// Update the last activity timestamp
    pub fn touch(&mut self) {
        self.last_activity_at = Utc::now();
    }

    /// Set an error state
    pub fn set_error(&mut self, message: impl Into<String>) {
        self.status = SessionStatus::Error;
        self.error_message = Some(message.into());
        self.touch();
    }
}

/// Session creation request
#[derive(Debug, Clone, Deserialize)]
pub struct CreateSessionRequest {
    pub spec: SessionSpec,
}

/// Session creation response
#[derive(Debug, Clone, Serialize)]
pub struct CreateSessionResponse {
    pub session: Session,
}

/// List sessions request
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListSessionsRequest {
    /// Filter by status
    pub status: Option<SessionStatus>,
    /// Limit number of results
    pub limit: Option<usize>,
}

/// List sessions response
#[derive(Debug, Clone, Serialize)]
pub struct ListSessionsResponse {
    pub sessions: Vec<Session>,
    pub total: usize,
}

/// Execute command request
#[derive(Debug, Clone, Deserialize)]
pub struct ExecuteRequest {
    pub session_id: SessionId,
    pub command: Vec<String>,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    pub timeout_ms: Option<u64>,
}

/// Execute command response
#[derive(Debug, Clone, Serialize)]
pub struct ExecuteResponse {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

/// Destroy session request
#[derive(Debug, Clone, Deserialize)]
pub struct DestroySessionRequest {
    pub session_id: SessionId,
    #[serde(default)]
    pub force: bool,
}
