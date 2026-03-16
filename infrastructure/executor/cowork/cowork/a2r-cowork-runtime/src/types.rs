//! Core types for the cowork runtime

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a cowork run
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RunId(pub Uuid);

impl RunId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn nil() -> Self {
        Self(Uuid::nil())
    }
}

impl Default for RunId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for RunId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Unique identifier for a job
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct JobId(pub Uuid);

impl JobId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for JobId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for JobId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Run execution mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunMode {
    /// Interactive session (UI-connected)
    Interactive,
    /// Cowork mode (persistent, detachable)
    Cowork,
    /// Scheduled execution (cron-triggered)
    Scheduled,
}

impl std::fmt::Display for RunMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RunMode::Interactive => write!(f, "interactive"),
            RunMode::Cowork => write!(f, "cowork"),
            RunMode::Scheduled => write!(f, "scheduled"),
        }
    }
}

/// Run state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunState {
    /// Run created but not yet started
    Created,
    /// Planning phase
    Planned,
    /// Queued for execution
    Queued,
    /// Actively running
    Running,
    /// Paused waiting for user input
    Paused,
    /// Waiting for policy approval
    AwaitingApproval,
    /// Recovering from checkpoint
    Recovering,
    /// Successfully completed
    Completed,
    /// Failed
    Failed,
    /// Cancelled by user
    Cancelled,
}

impl RunState {
    /// Check if the run is in a terminal state
    pub fn is_terminal(self) -> bool {
        matches!(self, RunState::Completed | RunState::Failed | RunState::Cancelled)
    }

    /// Check if the run can be attached to
    pub fn is_attachable(self) -> bool {
        matches!(
            self,
            RunState::Running | RunState::Paused | RunState::AwaitingApproval
        )
    }
}

impl std::fmt::Display for RunState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RunState::Created => write!(f, "created"),
            RunState::Planned => write!(f, "planned"),
            RunState::Queued => write!(f, "queued"),
            RunState::Running => write!(f, "running"),
            RunState::Paused => write!(f, "paused"),
            RunState::AwaitingApproval => write!(f, "awaiting_approval"),
            RunState::Recovering => write!(f, "recovering"),
            RunState::Completed => write!(f, "completed"),
            RunState::Failed => write!(f, "failed"),
            RunState::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Job state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    /// Job scheduled but not queued
    Scheduled,
    /// Queued for execution
    Queued,
    /// Leased by a worker
    Leased,
    /// Starting execution
    Starting,
    /// Actively running
    Running,
    /// Creating checkpoint
    Checkpointing,
    /// Waiting for approval
    AwaitingApproval,
    /// In retry backoff
    RetryBackoff,
    /// Successfully completed
    Completed,
    /// Failed
    Failed,
    /// Dead letter (max retries exceeded)
    DeadLetter,
    /// Cancelled
    Cancelled,
}

impl JobState {
    /// Check if the job is in a terminal state
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            JobState::Completed | JobState::Failed | JobState::DeadLetter | JobState::Cancelled
        )
    }
}

/// A cowork run (maps to Rails DAG)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Run {
    pub id: RunId,
    pub tenant_id: String,
    pub workspace_id: String,
    pub initiator: String,
    pub mode: RunMode,
    pub state: RunState,
    pub entrypoint: String,
    pub dag_id: String, // Rails DAG reference
    pub current_job_id: Option<JobId>,
    pub current_checkpoint_id: Option<String>,
    pub policy_profile: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// A job within a run (maps to Rails DagNode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: JobId,
    pub run_id: RunId,
    pub dag_node_id: String, // Rails node reference
    pub job_type: String,
    pub priority: i32,
    pub state: JobState,
    pub lease_owner: Option<String>,
    pub lease_expires_at: Option<DateTime<Utc>>,
    pub retry_count: i32,
    pub max_retries: i32,
    pub timeout_sec: i32,
    pub payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Checkpoint (maps to Rails ContextPack)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub run_id: RunId,
    pub job_id: Option<JobId>,
    pub step_index: i32,
    pub pack_id: String, // Rails ContextPack reference
    pub cursor_state: serde_json::Value,
    pub pending_approvals: Vec<String>,
    pub artifact_refs: Vec<String>,
    pub created_at: DateTime<Utc>,
}

/// Client attachment to a run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: Uuid,
    pub run_id: RunId,
    pub client_type: ClientType,
    pub client_session_id: String,
    pub state: AttachmentState,
    pub permissions: PermissionSet,
    pub last_seen_at: DateTime<Utc>,
    pub replay_cursor: String, // Ledger event cursor
    pub reconnect_token: String,
    pub created_at: DateTime<Utc>,
}

/// Type of client attached to a run
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientType {
    Terminal,
    Web,
    Desktop,
}

impl std::fmt::Display for ClientType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClientType::Terminal => write!(f, "terminal"),
            ClientType::Web => write!(f, "web"),
            ClientType::Desktop => write!(f, "desktop"),
        }
    }
}

/// Attachment state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentState {
    /// Actively connected
    Attached,
    /// Detached but may reconnect
    Detached,
    /// Timed out (stale)
    Stale,
    /// Permanently revoked
    Revoked,
}

impl std::fmt::Display for AttachmentState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AttachmentState::Attached => write!(f, "attached"),
            AttachmentState::Detached => write!(f, "detached"),
            AttachmentState::Stale => write!(f, "stale"),
            AttachmentState::Revoked => write!(f, "revoked"),
        }
    }
}

/// Permission set for an attachment
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct PermissionSet {
    pub read: bool,
    pub write: bool,
    pub approve: bool,
    pub admin: bool,
}

impl PermissionSet {
    /// Read-only permissions
    pub fn read_only() -> Self {
        Self {
            read: true,
            ..Default::default()
        }
    }

    /// Operator permissions (read, write, approve)
    pub fn operator() -> Self {
        Self {
            read: true,
            write: true,
            approve: true,
            ..Default::default()
        }
    }

    /// Full admin permissions
    pub fn admin() -> Self {
        Self {
            read: true,
            write: true,
            approve: true,
            admin: true,
        }
    }
}

/// Specification for creating a new run
#[derive(Debug, Clone, Deserialize)]
pub struct CreateRunSpec {
    pub tenant_id: String,
    pub workspace_id: String,
    pub initiator: String,
    pub mode: RunMode,
    pub entrypoint: String,
    pub policy_profile: Option<String>,
}

/// Specification for creating a job
#[derive(Debug, Clone, Deserialize)]
pub struct CreateJobSpec {
    pub run_id: RunId,
    pub job_type: String,
    pub priority: i32,
    pub payload: serde_json::Value,
    pub max_retries: i32,
    pub timeout_sec: i32,
}

/// Event emitted by the cowork runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CoworkEvent {
    #[serde(rename = "run.created")]
    RunCreated { run_id: RunId, mode: RunMode },
    
    #[serde(rename = "run.state_changed")]
    RunStateChanged { 
        run_id: RunId, 
        from: RunState, 
        to: RunState 
    },
    
    #[serde(rename = "run.completed")]
    RunCompleted { run_id: RunId, success: bool },
    
    #[serde(rename = "job.created")]
    JobCreated { run_id: RunId, job_id: JobId },
    
    #[serde(rename = "job.state_changed")]
    JobStateChanged { 
        run_id: RunId, 
        job_id: JobId, 
        from: JobState, 
        to: JobState 
    },
    
    #[serde(rename = "checkpoint.created")]
    CheckpointCreated { 
        run_id: RunId, 
        checkpoint_id: String 
    },
    
    #[serde(rename = "attachment.attached")]
    Attached { 
        run_id: RunId, 
        attachment_id: Uuid, 
        client_type: ClientType 
    },
    
    #[serde(rename = "attachment.detached")]
    Detached { 
        run_id: RunId, 
        attachment_id: Uuid 
    },
}
