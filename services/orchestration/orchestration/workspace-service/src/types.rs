//! Core types for workspace service

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unique identifier for a session
pub type SessionId = String;

/// Unique identifier for a pane
pub type PaneId = String;

/// Session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Session name
    pub name: String,
    /// Working directory
    pub working_dir: Option<String>,
    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Session metadata
    #[serde(default)]
    pub metadata: SessionMetadata,
}

impl SessionConfig {
    /// Create a new session config with the given name
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            working_dir: None,
            env: HashMap::new(),
            metadata: SessionMetadata::default(),
        }
    }

    /// Set the working directory
    pub fn with_working_dir(mut self, dir: impl Into<String>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }

    /// Add an environment variable
    pub fn with_env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.insert(key.into(), value.into());
        self
    }
}

/// Session metadata
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SessionMetadata {
    /// Associated DAG ID (if any)
    pub dag_id: Option<String>,
    /// Associated WIH ID (if any)
    pub wih_id: Option<String>,
    /// Owner/agent name
    pub owner: Option<String>,
    /// Custom labels
    #[serde(default)]
    pub labels: Vec<String>,
}

/// Session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Session ID
    pub id: SessionId,
    /// Session name
    pub name: String,
    /// Session status
    pub status: SessionStatus,
    /// Number of windows
    pub windows: u32,
    /// Number of panes
    pub panes: u32,
    /// Whether session has attached clients
    pub attached: bool,
    /// Working directory
    pub working_dir: Option<String>,
    /// Session metadata
    pub metadata: SessionMetadata,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last activity timestamp
    pub last_activity: DateTime<Utc>,
}

/// Session status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    /// Session is being created
    Creating,
    /// Session is active
    Active,
    /// Session is attached by a client
    Attached,
    /// Session is detached but running
    Detached,
    /// Session is being terminated
    Terminating,
    /// Session has ended
    Ended,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionStatus::Creating => write!(f, "creating"),
            SessionStatus::Active => write!(f, "active"),
            SessionStatus::Attached => write!(f, "attached"),
            SessionStatus::Detached => write!(f, "detached"),
            SessionStatus::Terminating => write!(f, "terminating"),
            SessionStatus::Ended => write!(f, "ended"),
        }
    }
}

/// Pane configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneConfig {
    /// Pane name/type
    pub name: String,
    /// Command to run in the pane
    pub command: Option<String>,
    /// Working directory for the pane
    pub working_dir: Option<String>,
    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Pane metadata
    #[serde(default)]
    pub metadata: PaneMetadata,
}

/// Pane metadata
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PaneMetadata {
    /// Associated agent ID
    pub agent_id: Option<String>,
    /// Associated WIH ID
    pub wih_id: Option<String>,
    /// Pane type (agent, shell, etc.)
    pub pane_type: Option<String>,
}

/// Pane information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pane {
    /// Pane ID
    pub id: PaneId,
    /// Session ID
    pub session_id: SessionId,
    /// Window index
    pub window_index: u32,
    /// Pane index
    pub pane_index: u32,
    /// Pane title
    pub title: String,
    /// Current command
    pub current_command: Option<String>,
    /// Pane metadata
    pub metadata: PaneMetadata,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Layout configuration for arranging panes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Layout {
    /// Even horizontal split
    EvenHorizontal,
    /// Even vertical split
    EvenVertical,
    /// Main horizontal (one large pane at top)
    MainHorizontal,
    /// Main vertical (one large pane at left)
    MainVertical,
    /// Tiled layout
    Tiled,
    /// Custom layout string (tmux format)
    Custom(String),
}

/// Grid layout configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridConfig {
    /// Grid name
    pub name: String,
    /// Number of columns
    pub columns: u32,
    /// Number of rows
    pub rows: u32,
    /// Pane configurations
    pub panes: Vec<GridPane>,
}

/// Pane position in a grid
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridPane {
    /// Pane name
    pub name: String,
    /// Column position (0-indexed)
    pub col: u32,
    /// Row position (0-indexed)
    pub row: u32,
    /// Column span
    #[serde(default = "default_span")]
    pub col_span: u32,
    /// Row span
    #[serde(default = "default_span")]
    pub row_span: u32,
    /// Pane configuration
    #[serde(flatten)]
    pub config: PaneConfig,
}

fn default_span() -> u32 {
    1
}

/// Log stream configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogStreamConfig {
    /// Pane ID to stream
    pub pane_id: PaneId,
    /// Number of historical lines to send
    #[serde(default = "default_history_lines")]
    pub history_lines: usize,
    /// Whether to follow new output
    #[serde(default = "default_follow")]
    pub follow: bool,
}

fn default_history_lines() -> usize {
    100
}

fn default_follow() -> bool {
    true
}

/// Log line from a pane
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogLine {
    /// Line number
    pub line_number: usize,
    /// Timestamp (if available)
    pub timestamp: Option<DateTime<Utc>>,
    /// Line content
    pub content: String,
    /// Whether this is stderr
    #[serde(default)]
    pub is_stderr: bool,
}

/// API error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    /// Error code
    pub code: String,
    /// Error message
    pub message: String,
    /// Additional details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl ErrorResponse {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

/// Service configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    /// Service port
    pub port: u16,
    /// Bind address
    pub bind_address: String,
    /// CORS origins
    pub cors_origins: Vec<String>,
    /// Log level
    pub log_level: String,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            port: 3021,
            bind_address: "127.0.0.1".to_string(),
            cors_origins: vec!["*".to_string()],
            log_level: "info".to_string(),
        }
    }
}

impl ServiceConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Self {
        Self {
            port: std::env::var("WORKSPACE_SERVICE_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3021),
            bind_address: std::env::var("WORKSPACE_SERVICE_BIND")
                .unwrap_or_else(|_| "127.0.0.1".to_string()),
            cors_origins: std::env::var("WORKSPACE_SERVICE_CORS")
                .map(|s| s.split(',').map(|s| s.to_string()).collect())
                .unwrap_or_else(|_| vec!["*".to_string()]),
            log_level: std::env::var("WORKSPACE_SERVICE_LOG_LEVEL")
                .unwrap_or_else(|_| "info".to_string()),
        }
    }
}
