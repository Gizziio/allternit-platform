//! Executor session state and identifiers.

use serde::{Deserialize, Serialize};

use crate::orchestrator::spec::ExecutorSpec;

/// Lifecycle state of an executor session.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutorState {
    /// Session is being created on the mux backend.
    Spawning,
    /// Pane has been created and the executor process is running.
    Running,
    /// Executor created the notes sentinel; work is complete.
    Done,
    /// Executor process exited without creating the notes sentinel.
    Dead,
    /// User or orchestrator explicitly closed the pane.
    Killed,
}

/// A spawned executor session tracked by Rails.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorSession {
    pub spec: ExecutorSpec,
    pub state: ExecutorState,
    pub mux_session_id: String,
    pub mux_pane_id: String,
    pub peer_id: String,
    pub wih_id: String,
    pub spawned_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_state_at: Option<String>,
}

impl ExecutorSession {
    pub fn display_name(&self) -> String {
        format!("executor-{}", self.spec.slug)
    }
}
