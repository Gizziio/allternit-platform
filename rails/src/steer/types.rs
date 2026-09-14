//! Steering types: checkpoints, consults, and gate verdicts.

use serde::{Deserialize, Serialize};

/// Parsed steering checkpoint from `.steering/checkpoint.md`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SteeringCheckpoint {
    pub goal: String,
    pub just_did: String,
    pub next_steps: String,
    pub open_questions: String,
    pub raw: String,
}

/// Verdict returned by a steering consult.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SteeringVerdict {
    Approve,
    RequestChanges,
    Block,
}

/// A consult request for the steering agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteeringConsult {
    pub consult_id: String,
    pub checkpoint: SteeringCheckpoint,
    pub thread_id: String,
}

/// Gate result for a commit/push mutation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteeringGateResult {
    pub allowed: bool,
    pub reason: Option<String>,
    pub pending_consult_ids: Vec<String>,
}
