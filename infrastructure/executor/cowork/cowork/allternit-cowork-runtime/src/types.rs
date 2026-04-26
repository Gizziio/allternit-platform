//! Core types for the cowork runtime

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a cowork run
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RunId(pub Uuid);

impl RunId {
    /// Create a new unique run identifier
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Create a nil run identifier (all zeros)
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
    /// Create a new unique job identifier
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
    /// Unique identifier for this run
    pub id: RunId,
    /// Tenant that owns this run
    pub tenant_id: String,
    /// Workspace context
    pub workspace_id: String,
    /// Actor that initiated the run
    pub initiator: String,
    /// Execution mode
    pub mode: RunMode,
    /// Current execution state
    pub state: RunState,
    /// Command or script to execute
    pub entrypoint: String,
    /// Rails DAG reference
    pub dag_id: String,
    /// Currently active job (if any)
    pub current_job_id: Option<JobId>,
    /// Most recent checkpoint ID (if any)
    pub current_checkpoint_id: Option<String>,
    /// Policy profile to enforce
    pub policy_profile: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Completion timestamp (if terminal)
    pub completed_at: Option<DateTime<Utc>>,
}

/// A job within a run (maps to Rails DagNode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    /// Unique identifier for this job
    pub id: JobId,
    /// Parent run ID
    pub run_id: RunId,
    /// Rails node reference
    pub dag_node_id: String,
    /// Type/kind of job
    pub job_type: String,
    /// Execution priority
    pub priority: i32,
    /// Current job state
    pub state: JobState,
    /// Worker that currently holds the lease
    pub lease_owner: Option<String>,
    /// Lease expiration timestamp
    pub lease_expires_at: Option<DateTime<Utc>>,
    /// Number of failed attempts
    pub retry_count: i32,
    /// Maximum number of retries allowed
    pub max_retries: i32,
    /// Execution timeout in seconds
    pub timeout_sec: i32,
    /// Input parameters/payload
    pub payload: serde_json::Value,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Actual start timestamp
    pub started_at: Option<DateTime<Utc>>,
    /// Completion timestamp
    pub completed_at: Option<DateTime<Utc>>,
}

/// Checkpoint (maps to Rails ContextPack)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    /// Checkpoint identifier
    pub id: String,
    /// Parent run ID
    pub run_id: RunId,
    /// Associated job ID
    pub job_id: Option<JobId>,
    /// Step index within execution
    pub step_index: i32,
    /// Rails ContextPack reference
    pub pack_id: String,
    /// Serialized agent cursor/memory state
    pub cursor_state: serde_json::Value,
    /// Policy approvals currently pending
    pub pending_approvals: Vec<String>,
    /// References to artifacts produced by this step
    pub artifact_refs: Vec<String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Client attachment to a run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    /// Unique attachment ID
    pub id: Uuid,
    /// Parent run ID
    pub run_id: RunId,
    /// Type of client (terminal, web, etc.)
    pub client_type: ClientType,
    /// Client-provided session identifier
    pub client_session_id: String,
    /// Current attachment state
    pub state: AttachmentState,
    /// Granted permissions
    pub permissions: PermissionSet,
    /// Last heartbeat timestamp
    pub last_seen_at: DateTime<Utc>,
    /// Ledger event cursor for replay
    pub replay_cursor: String,
    /// Token used for reconnection
    pub reconnect_token: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Type of client attached to a run
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientType {
    /// IDE terminal extension
    Terminal,
    /// Web browser interface
    Web,
    /// Desktop shell application
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
    /// Allow reading state and events
    pub read: bool,
    /// Allow sending input and modifying state
    pub write: bool,
    /// Allow approving policy gates
    pub approve: bool,
    /// Administrative control
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
    /// Tenant identifier
    pub tenant_id: String,
    /// Workspace identifier
    pub workspace_id: String,
    /// Initiating actor
    pub initiator: String,
    /// Execution mode
    pub mode: RunMode,
    /// Command or entrypoint script
    pub entrypoint: String,
    /// Optional policy profile
    pub policy_profile: Option<String>,
}

/// Specification for creating a job
#[derive(Debug, Clone, Deserialize)]
pub struct CreateJobSpec {
    /// Parent run ID
    pub run_id: RunId,
    /// Job type identifier
    pub job_type: String,
    /// Execution priority
    pub priority: i32,
    /// Input parameters
    pub payload: serde_json::Value,
    /// Maximum retries
    pub max_retries: i32,
    /// Timeout in seconds
    pub timeout_sec: i32,
}

/// Event emitted by the cowork runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CoworkEvent {
    /// Run has been created
    #[serde(rename = "run.created")]
    RunCreated { 
        /// Run ID
        run_id: RunId, 
        /// Selected mode
        mode: RunMode 
    },
    
    /// Run execution state has transitioned
    #[serde(rename = "run.state_changed")]
    RunStateChanged { 
        /// Run ID
        run_id: RunId, 
        /// Previous state
        from: RunState, 
        /// New state
        to: RunState 
    },
    
    /// Run has finished
    #[serde(rename = "run.completed")]
    RunCompleted { 
        /// Run ID
        run_id: RunId, 
        /// Whether completion was successful
        success: bool 
    },
    
    /// New job has been spawned
    #[serde(rename = "job.created")]
    JobCreated { 
        /// Run ID
        run_id: RunId, 
        /// Job ID
        job_id: JobId 
    },
    
    /// Job execution state has transitioned
    #[serde(rename = "job.state_changed")]
    JobStateChanged { 
        /// Run ID
        run_id: RunId, 
        /// Job ID
        job_id: JobId, 
        /// Previous state
        from: JobState, 
        /// New state
        to: JobState 
    },
    
    /// Checkpoint has been persisted
    #[serde(rename = "checkpoint.created")]
    CheckpointCreated { 
        /// Run ID
        run_id: RunId, 
        /// Checkpoint identifier
        checkpoint_id: String 
    },
    
    /// Client has attached to a run
    #[serde(rename = "attachment.attached")]
    Attached { 
        /// Run ID
        run_id: RunId, 
        /// Attachment ID
        attachment_id: Uuid, 
        /// Client type
        client_type: ClientType 
    },
    
    /// Client has detached from a run
    #[serde(rename = "attachment.detached")]
    Detached { 
        /// Run ID
        run_id: RunId, 
        /// Attachment ID
        attachment_id: Uuid 
    },
}
