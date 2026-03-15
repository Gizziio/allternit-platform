//! Session State Machine
//!
//! Explicit state machine for per-session lifecycle management.
//! All transitions are guarded and invalid transitions are rejected.

mod state_machine;

pub use state_machine::*;

use serde::{Deserialize, Serialize};
// use std::time::Instant; // Removed - not used

/// Configuration for a new session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub session_id: String,
    pub tenant_id: String,
    pub provider_id: String,
    pub model_id: Option<String>,
    pub max_tool_calls: u32,
    pub tool_timeout_secs: u64,
    /// Command to execute (e.g., "npx", "claude", "opencode")
    pub command: Option<String>,
    /// Arguments for the command
    pub args: Option<Vec<String>>,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            session_id: String::new(),
            tenant_id: "default".to_string(),
            provider_id: String::new(),
            model_id: None,
            max_tool_calls: 50,
            tool_timeout_secs: 30,
            command: None,
            args: None,
        }
    }
}

/// Handle to a managed session
#[derive(Debug, Clone)]
pub struct SessionHandle {
    pub session_id: String,
    pub tenant_id: String,
    pub cmd_tx: tokio::sync::mpsc::Sender<SessionCommand>,
}

/// Commands that can be sent to a session
#[derive(Debug)]
pub enum SessionCommand {
    Invoke {
        prompt: String,
        respond_to: tokio::sync::oneshot::Sender<Result<InvocationHandle, RuntimeError>>,
    },
    Close,
    HealthCheck {
        respond_to: tokio::sync::oneshot::Sender<SessionHealth>,
    },
}

/// Handle to an active invocation
#[derive(Debug, Clone)]
pub struct InvocationHandle {
    pub invocation_id: String,
}

/// Session health status
#[derive(Debug, Clone)]
pub struct SessionHealth {
    pub state: SessionState,
    pub is_stalled: bool,
    pub memory_usage_mb: usize,
    pub uptime_secs: u64,
}

// Re-export RuntimeError from supervision
pub use crate::supervision::RuntimeError;
