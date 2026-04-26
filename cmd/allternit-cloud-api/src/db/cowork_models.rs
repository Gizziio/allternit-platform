//! Cowork Runtime database models
//!
//! Provides data structures for run orchestration, job queue,
//! scheduling, events, and checkpoints.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::cmp::Ordering;

// ============================================================================
// Run Models
// ============================================================================

/// Run execution mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RunMode {
    /// Local VM execution (Apple VF/Firecracker)
    Local,
    /// Remote VPS execution (allternit-node)
    Remote,
    /// Cloud-managed execution (Kubernetes, etc.)
    Cloud,
}

impl Default for RunMode {
    fn default() -> Self {
        RunMode::Local
    }
}

/// Run status in the lifecycle
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RunStatus {
    /// Created but not started
    Pending,
    /// Planning execution steps
    Planning,
    /// Waiting for execution slot
    Queued,
    /// Actively executing
    Running,
    /// Paused (approval needed or manual)
    Paused,
    /// Successfully finished
    Completed,
    /// Failed with error
    Failed,
    /// Cancelled by user
    Cancelled,
}

impl Default for RunStatus {
    fn default() -> Self {
        RunStatus::Pending
    }
}

impl RunStatus {
    /// Check if the run is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, RunStatus::Completed | RunStatus::Failed | RunStatus::Cancelled)
    }

    /// Check if the run is active (can be paused/cancelled)
    pub fn is_active(&self) -> bool {
        matches!(self, RunStatus::Running | RunStatus::Paused)
    }

    /// Check if the run can transition to the target state
    pub fn can_transition_to(&self, target: RunStatus) -> bool {
        use RunStatus::*;
        match (self, target) {
            // From Pending
            (Pending, Planning) => true,
            (Pending, Queued) => true,
            (Pending, Cancelled) => true,
            
            // From Planning
            (Planning, Queued) => true,
            (Planning, Running) => true,
            (Planning, Failed) => true,
            (Planning, Cancelled) => true,
            
            // From Queued
            (Queued, Running) => true,
            (Queued, Failed) => true,
            (Queued, Cancelled) => true,
            
            // From Running
            (Running, Paused) => true,
            (Running, Completed) => true,
            (Running, Failed) => true,
            (Running, Cancelled) => true,
            
            // From Paused
            (Paused, Running) => true,
            (Paused, Failed) => true,
            (Paused, Cancelled) => true,
            
            // Terminal states - no transitions
            (Completed, _) => false,
            (Failed, _) => false,
            (Cancelled, _) => false,
            
            _ => false,
        }
    }
}

/// Run configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RunConfig {
    /// Working directory
    pub working_dir: Option<String>,
    /// Environment variables
    pub env: Option<std::collections::HashMap<String, String>>,
    /// Command to execute
    pub command: Option<String>,
    /// Arguments
    pub args: Option<Vec<String>>,
    /// Resource limits (memory, CPU, etc.)
    pub resource_limits: Option<ResourceLimits>,
    /// File sync configuration
    pub sync: Option<SyncConfig>,
    /// Additional runtime-specific config
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

/// Resource limits for a run
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceLimits {
    pub memory_mb: Option<i32>,
    pub cpu_cores: Option<f32>,
    pub disk_gb: Option<i32>,
    pub timeout_seconds: Option<i32>,
}

/// File sync configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncConfig {
    pub enabled: bool,
    pub watch_patterns: Vec<String>,
    pub ignore_patterns: Vec<String>,
    pub bidirectional: bool,
}

/// Run record - core execution unit
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Run {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub mode: RunMode,
    pub status: RunStatus,
    pub step_cursor: Option<String>,
    pub total_steps: Option<i32>,
    pub completed_steps: i32,
    pub config: sqlx::types::Json<RunConfig>,
    pub owner_id: Option<String>,
    pub tenant_id: Option<String>,
    pub runtime_id: Option<String>,
    pub runtime_type: Option<String>,
    pub schedule_id: Option<String>,
    pub region_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub error_details: Option<sqlx::types::Json<serde_json::Value>>,
}

/// Summary of a run for list views
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct RunSummary {
    pub id: String,
    pub name: String,
    pub mode: RunMode,
    pub status: RunStatus,
    pub completed_steps: i32,
    pub total_steps: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Job Models
// ============================================================================

/// Job status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
    Retrying,
}

impl Default for JobStatus {
    fn default() -> Self {
        JobStatus::Pending
    }
}

/// Job configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JobConfig {
    pub command: String,
    pub args: Option<Vec<String>>,
    pub env: Option<std::collections::HashMap<String, String>>,
    pub working_dir: Option<String>,
    pub timeout_seconds: Option<i32>,
}

/// Job record - individual task within a run
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub run_id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: JobStatus,
    pub priority: i32,
    pub queue_position: Option<i32>,
    pub config: sqlx::types::Json<JobConfig>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub exit_code: Option<i32>,
    pub result: Option<sqlx::types::Json<serde_json::Value>>,
    pub error_message: Option<String>,
    pub retry_count: i32,
    pub max_retries: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Job with run information (for queue views)
#[derive(Debug, Clone, FromRow)]
pub struct QueuedJob {
    pub id: String,
    pub run_id: String,
    pub name: String,
    pub priority: i32,
    pub config: sqlx::types::Json<JobConfig>,
    pub created_at: DateTime<Utc>,
}

impl QueuedJob {
    /// Create a new queued job wrapper for priority ordering
    pub fn new(job: Job) -> Self {
        Self {
            id: job.id,
            run_id: job.run_id,
            name: job.name,
            priority: job.priority,
            config: job.config,
            created_at: job.created_at,
        }
    }
}

impl Ord for QueuedJob {
    fn cmp(&self, other: &Self) -> Ordering {
        // Higher priority comes first
        other.priority.cmp(&self.priority)
            // Then earlier creation time
            .then_with(|| self.created_at.cmp(&other.created_at))
    }
}

impl PartialOrd for QueuedJob {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl PartialEq for QueuedJob {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority && self.created_at == other.created_at
    }
}

impl Eq for QueuedJob {}

// ============================================================================
// Schedule Models
// ============================================================================

/// Misfire policy for schedules
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum MisfirePolicy {
    Ignore,
    FireOnce,
    FireAll,
}

impl Default for MisfirePolicy {
    fn default() -> Self {
        MisfirePolicy::FireOnce
    }
}

/// Schedule record - cron-based job scheduling
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Schedule {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cron_expr: String,
    pub natural_lang: Option<String>,
    pub timezone: String,
    pub job_template: sqlx::types::Json<JobConfig>,
    pub enabled: bool,
    pub misfire_policy: MisfirePolicy,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub run_count: i32,
    pub misfire_count: i32,
    pub owner_id: Option<String>,
    pub tenant_id: Option<String>,
    pub region_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Schedule summary for list views
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ScheduleSummary {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub cron_expr: String,
    pub natural_lang: Option<String>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub run_count: i32,
}

// ============================================================================
// Event Models
// ============================================================================

/// Event types for the event ledger
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    // Lifecycle events
    RunCreated,
    RunStarted,
    RunCompleted,
    RunFailed,
    RunCancelled,
    RunPaused,
    RunResumed,
    
    // Step events
    StepStarted,
    StepCompleted,
    StepFailed,
    StepSkipped,
    
    // Output events
    Stdout,
    Stderr,
    Output,
    
    // Tool events
    ToolCall,
    ToolResult,
    
    // Approval events
    ApprovalNeeded,
    ApprovalGiven,
    ApprovalDenied,
    ApprovalTimeout,
    
    // Checkpoint events
    CheckpointCreated,
    CheckpointRestored,
    
    // Job events
    JobQueued,
    JobStarted,
    JobCompleted,
    JobFailed,
    JobCancelled,
    
    // System events
    Heartbeat,
    Warning,
    Error,
}

impl EventType {
    /// Get display name for the event type
    pub fn display_name(&self) -> &'static str {
        match self {
            EventType::RunCreated => "Run Created",
            EventType::RunStarted => "Run Started",
            EventType::RunCompleted => "Run Completed",
            EventType::RunFailed => "Run Failed",
            EventType::RunCancelled => "Run Cancelled",
            EventType::RunPaused => "Run Paused",
            EventType::RunResumed => "Run Resumed",
            EventType::StepStarted => "Step Started",
            EventType::StepCompleted => "Step Completed",
            EventType::StepFailed => "Step Failed",
            EventType::StepSkipped => "Step Skipped",
            EventType::Stdout => "Stdout",
            EventType::Stderr => "Stderr",
            EventType::Output => "Output",
            EventType::ToolCall => "Tool Call",
            EventType::ToolResult => "Tool Result",
            EventType::ApprovalNeeded => "Approval Needed",
            EventType::ApprovalGiven => "Approval Given",
            EventType::ApprovalDenied => "Approval Denied",
            EventType::ApprovalTimeout => "Approval Timeout",
            EventType::CheckpointCreated => "Checkpoint Created",
            EventType::CheckpointRestored => "Checkpoint Restored",
            EventType::JobQueued => "Job Queued",
            EventType::JobStarted => "Job Started",
            EventType::JobCompleted => "Job Completed",
            EventType::JobFailed => "Job Failed",
            EventType::JobCancelled => "Job Cancelled",
            EventType::Heartbeat => "Heartbeat",
            EventType::Warning => "Warning",
            EventType::Error => "Error",
        }
    }
}

/// Event payload - flexible JSON structure
pub type EventPayload = serde_json::Value;

/// Event record - append-only ledger entry
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub run_id: String,
    pub sequence: i64,
    pub event_type: EventType,
    pub payload: sqlx::types::Json<EventPayload>,
    pub source_client_id: Option<String>,
    pub source_client_type: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Event for streaming (without full payload for efficiency)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventSummary {
    pub id: String,
    pub run_id: String,
    pub sequence: i64,
    pub event_type: EventType,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Attachment Models
// ============================================================================

/// Client type for attachments
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ClientType {
    Terminal,
    Web,
    Desktop,
    Mobile,
    Api,
}

/// Attachment record - tracks clients watching a run
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub run_id: String,
    pub client_id: String,
    pub client_type: ClientType,
    pub user_id: Option<String>,
    pub cursor_sequence: i64,
    pub attached_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub detached_at: Option<DateTime<Utc>>,
}

/// Attachment with run summary
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AttachmentWithRun {
    pub id: String,
    pub run_id: String,
    pub client_id: String,
    pub client_type: ClientType,
    pub cursor_sequence: i64,
    pub attached_at: DateTime<Utc>,
    pub run_name: String,
    pub run_status: RunStatus,
}

// ============================================================================
// Checkpoint Models
// ============================================================================

/// Checkpoint record - execution snapshot
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub run_id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub step_cursor: String,
    pub workspace_state: Option<sqlx::types::Json<serde_json::Value>>,
    pub approval_state: Option<sqlx::types::Json<serde_json::Value>>,
    pub context: Option<sqlx::types::Json<serde_json::Value>>,
    pub resumable: bool,
    pub created_at: DateTime<Utc>,
    pub restored_at: Option<DateTime<Utc>>,
}

/// Checkpoint summary for list views
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct CheckpointSummary {
    pub id: String,
    pub name: Option<String>,
    pub step_cursor: String,
    pub resumable: bool,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Request/Response Models (for API)
// ============================================================================

/// Create run request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRunRequest {
    pub name: String,
    pub description: Option<String>,
    pub mode: RunMode,
    pub config: RunConfig,
    #[serde(default)]
    pub auto_start: bool,
    /// Optional region preference for the run
    pub region_id: Option<String>,
}

/// Update run request
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateRunRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Create schedule request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateScheduleRequest {
    pub name: String,
    pub description: Option<String>,
    pub cron_expr: String,
    pub natural_lang: Option<String>,
    pub timezone: Option<String>,
    pub job_template: JobConfig,
    pub enabled: Option<bool>,
    /// Optional region preference for scheduled runs
    pub region_id: Option<String>,
}

/// Create checkpoint request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCheckpointRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub step_cursor: String,
    pub workspace_state: Option<serde_json::Value>,
    pub approval_state: Option<serde_json::Value>,
    pub context: Option<serde_json::Value>,
}

/// Event filter for querying
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EventFilter {
    pub event_types: Option<Vec<EventType>>,
    pub since: Option<DateTime<Utc>>,
    pub until: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
    pub cursor: Option<i64>,
}

// ============================================================================
// Approval Models
// ============================================================================

/// Approval request status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ApprovalStatus {
    /// Waiting for approval
    Pending,
    /// Approved, run can continue
    Approved,
    /// Denied, run should stop or change course
    Denied,
    /// Timed out waiting for response
    TimedOut,
    /// Cancelled by the run
    Cancelled,
}

impl Default for ApprovalStatus {
    fn default() -> Self {
        ApprovalStatus::Pending
    }
}

/// Priority level for approval requests
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ApprovalPriority {
    Low,
    Normal,
    High,
    Critical,
}

impl Default for ApprovalPriority {
    fn default() -> Self {
        ApprovalPriority::Normal
    }
}

/// Approval request record - human-in-the-loop checkpoint
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub id: String,
    pub run_id: String,
    pub step_cursor: Option<String>,
    pub status: ApprovalStatus,
    pub priority: ApprovalPriority,
    /// Short title for the approval
    pub title: String,
    /// Detailed description of what needs approval
    pub description: Option<String>,
    /// The action/tool being requested
    pub action_type: Option<String>,
    /// Arguments/parameters for the action (JSON)
    pub action_params: Option<sqlx::types::Json<serde_json::Value>>,
    /// Why this action is being taken
    pub reasoning: Option<String>,
    /// User who requested the approval (if manually triggered)
    pub requested_by: Option<String>,
    /// User who responded to the approval
    pub responded_by: Option<String>,
    /// Response message/notes
    pub response_message: Option<String>,
    /// Timeout in seconds (null = no timeout)
    pub timeout_seconds: Option<i32>,
    /// When the approval was created
    pub created_at: DateTime<Utc>,
    /// When the approval was responded to
    pub responded_at: Option<DateTime<Utc>>,}

/// Summary of approval request for list views
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ApprovalRequestSummary {
    pub id: String,
    pub run_id: String,
    pub status: ApprovalStatus,
    pub priority: ApprovalPriority,
    pub title: String,
    pub action_type: Option<String>,
    pub created_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
}

/// Create approval request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApprovalRequest {
    pub run_id: String,
    pub step_cursor: Option<String>,
    pub priority: Option<ApprovalPriority>,
    pub title: String,
    pub description: Option<String>,
    pub action_type: Option<String>,
    pub action_params: Option<serde_json::Value>,
    pub reasoning: Option<String>,
    pub requested_by: Option<String>,
    pub timeout_seconds: Option<i32>,
}

/// Response to an approval request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalResponse {
    pub approved: bool,
    pub message: Option<String>,
    pub modified_params: Option<serde_json::Value>,
}

// ============================================================================
// Task Models
// ============================================================================

/// Task status in the workflow
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "kebab-case")]
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    Backlog,
    Todo,
    InProgress,
    InReview,
    Done,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Backlog
    }
}

/// Assignee type for tasks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum AssigneeType {
    Human,
    Agent,
}

impl Default for AssigneeType {
    fn default() -> Self {
        AssigneeType::Human
    }
}

/// Risk level for tasks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TaskRisk {
    Low,
    Medium,
    High,
}

impl Default for TaskRisk {
    fn default() -> Self {
        TaskRisk::Low
    }
}

/// Task queue status for agent worker queue
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TaskQueueStatus {
    Pending,
    Claimed,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl Default for TaskQueueStatus {
    fn default() -> Self {
        TaskQueueStatus::Pending
    }
}

/// Task record - core work item
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub workspace_id: String,
    pub tenant_id: Option<String>,
    pub owner_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: i32,
    pub estimated_minutes: Option<i32>,
    pub deadline: Option<DateTime<Utc>>,
    pub assignee_type: Option<AssigneeType>,
    pub assignee_id: Option<String>,
    pub assignee_name: Option<String>,
    pub assignee_avatar: Option<String>,
    pub dependencies: Option<sqlx::types::Json<Vec<String>>>,
    pub optimize_rank: Option<i32>,
    pub risk: Option<TaskRisk>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Task comment record
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskComment {
    pub id: String,
    pub task_id: String,
    pub author: String,
    pub author_avatar: Option<String>,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

/// Task assignment audit record
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TaskAssignment {
    pub id: String,
    pub task_id: String,
    pub assignee_type: AssigneeType,
    pub assignee_id: String,
    pub assignee_name: Option<String>,
    pub assigned_by: Option<String>,
    pub assigned_at: DateTime<Utc>,
}

/// Task queue entry for agent worker queue
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TaskQueueEntry {
    pub id: String,
    pub task_id: String,
    pub agent_id: Option<String>,
    pub agent_role: Option<String>,
    pub status: TaskQueueStatus,
    pub claimed_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: Option<sqlx::types::Json<serde_json::Value>>,
    pub error: Option<String>,
    pub retry_count: i32,
    pub max_retries: i32,
    pub created_at: DateTime<Utc>,
}

/// Task event audit record (append-only)
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TaskEvent {
    pub id: i64,
    pub task_id: String,
    pub event_type: String,
    pub payload: Option<sqlx::types::Json<serde_json::Value>>,
    pub source_client: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Task Request/Response DTOs
// ============================================================================

/// Create task request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub workspace_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<i32>,
    pub estimated_minutes: Option<i32>,
    pub deadline: Option<DateTime<Utc>>,
    pub assignee_type: Option<AssigneeType>,
    pub assignee_id: Option<String>,
    pub assignee_name: Option<String>,
    pub assignee_avatar: Option<String>,
    pub dependencies: Option<Vec<String>>,
    pub risk: Option<TaskRisk>,
}

/// Update task request
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<i32>,
    pub estimated_minutes: Option<i32>,
    pub deadline: Option<DateTime<Utc>>,
    pub assignee_type: Option<AssigneeType>,
    pub assignee_id: Option<String>,
    pub assignee_name: Option<String>,
    pub assignee_avatar: Option<String>,
    pub dependencies: Option<Vec<String>>,
    pub risk: Option<TaskRisk>,
}

/// Assign task request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignTaskRequest {
    pub assignee_type: AssigneeType,
    pub assignee_id: String,
    pub assignee_name: Option<String>,
    pub assignee_avatar: Option<String>,
}

/// Create comment request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCommentRequest {
    pub author: String,
    pub author_avatar: Option<String>,
    pub body: String,
}

/// Task response DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResponse {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: i32,
    pub estimated_minutes: Option<i32>,
    pub deadline: Option<String>,
    pub assignee_type: Option<String>,
    pub assignee_id: Option<String>,
    pub assignee_name: Option<String>,
    pub assignee_avatar: Option<String>,
    pub dependencies: Vec<String>,
    pub optimize_rank: Option<i32>,
    pub risk: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Comment response DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentResponse {
    pub id: String,
    pub task_id: String,
    pub author: String,
    pub author_avatar: Option<String>,
    pub body: String,
    pub created_at: String,
}

/// Filter options for listing tasks
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaskListFilter {
    pub tenant_id: Option<String>,
    pub workspace_id: Option<String>,
    pub status: Option<Vec<TaskStatus>>,
    pub assignee_id: Option<String>,
    pub priority_min: Option<i32>,
    pub priority_max: Option<i32>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl From<Task> for TaskResponse {
    fn from(task: Task) -> Self {
        Self {
            id: task.id,
            workspace_id: task.workspace_id,
            title: task.title,
            description: task.description,
            status: serde_json::to_value(&task.status)
                .ok()
                .and_then(|v| v.as_str().map(|s| s.to_string()))
                .unwrap_or_else(|| "backlog".to_string()),
            priority: task.priority,
            estimated_minutes: task.estimated_minutes,
            deadline: task.deadline.map(|d| d.to_rfc3339()),
            assignee_type: task.assignee_type
                .and_then(|a| serde_json::to_value(&a).ok())
                .and_then(|v| v.as_str().map(|s| s.to_string())),
            assignee_id: task.assignee_id,
            assignee_name: task.assignee_name,
            assignee_avatar: task.assignee_avatar,
            dependencies: task.dependencies.map(|d| d.0).unwrap_or_default(),
            optimize_rank: task.optimize_rank,
            risk: task.risk
                .and_then(|r| serde_json::to_value(&r).ok())
                .and_then(|v| v.as_str().map(|s| s.to_string())),
            created_at: task.created_at.to_rfc3339(),
            updated_at: task.updated_at.to_rfc3339(),
        }
    }
}

impl From<TaskComment> for CommentResponse {
    fn from(comment: TaskComment) -> Self {
        Self {
            id: comment.id,
            task_id: comment.task_id,
            author: comment.author,
            author_avatar: comment.author_avatar,
            body: comment.body,
            created_at: comment.created_at.to_rfc3339(),
        }
    }
}
