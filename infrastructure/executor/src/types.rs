// OWNER: T1-A3

//! Executor Types
//!
//! Type definitions for the Selfhosted Executor.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use thiserror::Error;
use uuid::Uuid;

// ============================================================================
// Error Types
// ============================================================================

/// Main error type for executor operations
#[derive(Debug, Error)]
pub enum ExecutorError {
    #[error("Job not found: {0}")]
    JobNotFound(JobId),

    #[error("Job already exists: {0}")]
    JobAlreadyExists(JobId),

    #[error("Invalid job state transition: {from:?} -> {to:?}")]
    InvalidStateTransition { from: JobStatus, to: JobStatus },

    #[error("Container error: {0}")]
    ContainerError(#[from] ContainerError),

    #[error("Resource error: {0}")]
    ResourceError(#[from] ResourceError),

    #[error("Queue error: {0}")]
    QueueError(#[from] QueueError),

    #[error("Runtime error: {0}")]
    RuntimeError(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Result type alias for executor operations
pub type Result<T> = std::result::Result<T, ExecutorError>;

/// Container-specific errors
#[derive(Debug, Error)]
pub enum ContainerError {
    #[error("Container not found: {0}")]
    NotFound(String),

    #[error("Container already exists: {0}")]
    AlreadyExists(String),

    #[error("Image pull failed: {0}")]
    ImagePullFailed(String),

    #[error("Container creation failed: {0}")]
    CreationFailed(String),

    #[error("Container start failed: {0}")]
    StartFailed(String),

    #[error("Container stop failed: {0}")]
    StopFailed(String),

    #[error("Container removal failed: {0}")]
    RemovalFailed(String),

    #[error("Invalid container configuration: {0}")]
    InvalidConfig(String),

    #[error("Docker daemon error: {0}")]
    DaemonError(String),

    #[error("Container timeout: {0}")]
    Timeout(String),
}

/// Resource management errors
#[derive(Debug, Error)]
pub enum ResourceError {
    #[error("Insufficient resources: requested {requested:?}, available {available:?}")]
    InsufficientResources {
        requested: ResourceRequest,
        available: SystemResources,
    },

    #[error("Resource allocation not found: {0}")]
    AllocationNotFound(AllocationId),

    #[error("Resource already allocated: {0}")]
    AlreadyAllocated(JobId),

    #[error("Invalid resource request: {0}")]
    InvalidRequest(String),

    #[error("Resource quota exceeded: {0}")]
    QuotaExceeded(String),

    #[error("Resource release failed: {0}")]
    ReleaseFailed(String),
}

/// Job queue errors
#[derive(Debug, Error)]
pub enum QueueError {
    #[error("Queue is full")]
    QueueFull,

    #[error("Job not in queue: {0}")]
    JobNotInQueue(JobId),

    #[error("Invalid queue operation: {0}")]
    InvalidOperation(String),

    #[error("Queue is empty")]
    Empty,

    #[error("Priority not found: {0}")]
    PriorityNotFound(JobId),
}

// ============================================================================
// Job ID Types
// ============================================================================

/// Unique identifier for a job
pub type JobId = Uuid;

/// Unique identifier for a container
pub type ContainerId = String;

/// Unique identifier for a resource allocation
pub type AllocationId = String;

// ============================================================================
// Job Types
// ============================================================================

/// A job to be executed in a container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: JobId,
    pub name: String,
    pub image: String,
    pub command: Vec<String>,
    pub env: HashMap<String, String>,
    pub volumes: Vec<VolumeMount>,
    pub resources: ResourceRequest,
    pub priority: Priority,
    pub timeout: Option<Duration>,
    pub created_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

impl Job {
    pub fn new(name: &str, image: &str) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            image: image.to_string(),
            command: vec![],
            env: HashMap::new(),
            volumes: vec![],
            resources: ResourceRequest::default(),
            priority: Priority::Normal,
            timeout: None,
            created_at: Utc::now(),
            metadata: HashMap::new(),
        }
    }

    pub fn with_command(mut self, command: Vec<String>) -> Self {
        self.command = command;
        self
    }

    pub fn with_env(mut self, env: HashMap<String, String>) -> Self {
        self.env = env;
        self
    }

    pub fn with_volumes(mut self, volumes: Vec<VolumeMount>) -> Self {
        self.volumes = volumes;
        self
    }

    pub fn with_resources(mut self, resources: ResourceRequest) -> Self {
        self.resources = resources;
        self
    }

    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }
}

/// Job execution status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", content = "details")]
pub enum JobStatus {
    Pending,
    Queued { position: usize },
    Starting,
    Running { container_id: ContainerId },
    Completed { exit_code: i32 },
    Failed { error: String },
    Cancelled,
    Terminated,
}

impl JobStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            JobStatus::Completed { .. }
                | JobStatus::Failed { .. }
                | JobStatus::Cancelled
                | JobStatus::Terminated
        )
    }
}

/// Job summary for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSummary {
    pub id: JobId,
    pub name: String,
    pub status: JobStatus,
    pub image: String,
    pub priority: Priority,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Priority levels for job scheduling
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Critical = 100,
    High = 75,
    Normal = 50,
    Low = 25,
    Batch = 10,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Normal
    }
}

impl Priority {
    /// Get the numeric value for priority comparison
    pub fn value(self) -> i32 {
        self as i32
    }
}

// ============================================================================
// Container Configuration
// ============================================================================

/// Container configuration for job execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerConfig {
    /// Docker image to use
    pub image: String,

    /// Command to execute
    pub command: Vec<String>,

    /// Environment variables
    pub env: HashMap<String, String>,

    /// Volume mounts
    pub volumes: Vec<VolumeMount>,

    /// Resource limits
    pub resources: ResourceLimits,

    /// Network mode
    pub network_mode: NetworkMode,

    /// Working directory inside container
    pub working_dir: Option<String>,

    /// User ID to run as
    pub user: Option<String>,

    /// Container labels
    pub labels: HashMap<String, String>,

    /// Execution timeout
    pub timeout: Option<Duration>,
}

impl Default for ContainerConfig {
    fn default() -> Self {
        Self {
            image: "alpine:latest".to_string(),
            command: vec![],
            env: HashMap::new(),
            volumes: vec![],
            resources: ResourceLimits::default(),
            network_mode: NetworkMode::default(),
            working_dir: None,
            user: None,
            labels: HashMap::new(),
            timeout: Some(Duration::from_secs(3600)),
        }
    }
}

impl ContainerConfig {
    pub fn new(image: &str) -> Self {
        Self {
            image: image.to_string(),
            ..Default::default()
        }
    }

    pub fn with_command(mut self, command: Vec<String>) -> Self {
        self.command = command;
        self
    }

    pub fn with_env(mut self, env: HashMap<String, String>) -> Self {
        self.env = env;
        self
    }

    pub fn with_volumes(mut self, volumes: Vec<VolumeMount>) -> Self {
        self.volumes = volumes;
        self
    }

    pub fn with_resources(mut self, resources: ResourceLimits) -> Self {
        self.resources = resources;
        self
    }

    pub fn with_working_dir(mut self, working_dir: &str) -> Self {
        self.working_dir = Some(working_dir.to_string());
        self
    }

    pub fn with_user(mut self, user: &str) -> Self {
        self.user = Some(user.to_string());
        self
    }
}

/// Volume mount configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeMount {
    /// Host path or named volume
    pub source: String,

    /// Container path
    pub target: String,

    /// Mount options (ro, rw, etc.)
    pub options: Vec<String>,
}

impl VolumeMount {
    pub fn new(source: &str, target: &str) -> Self {
        Self {
            source: source.to_string(),
            target: target.to_string(),
            options: vec![],
        }
    }

    pub fn read_only(mut self) -> Self {
        self.options.push("ro".to_string());
        self
    }

    pub fn with_options(mut self, options: Vec<String>) -> Self {
        self.options = options;
        self
    }
}

/// Resource limits for containers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    /// CPU limit in cores
    pub cpu_limit: Option<f64>,

    /// Memory limit in bytes
    pub memory_limit: Option<u64>,

    /// Disk quota in bytes
    pub disk_quota: Option<u64>,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            cpu_limit: None,
            memory_limit: None,
            disk_quota: None,
        }
    }
}

impl ResourceLimits {
    pub fn with_cpu(mut self, cores: f64) -> Self {
        self.cpu_limit = Some(cores);
        self
    }

    pub fn with_memory(mut self, bytes: u64) -> Self {
        self.memory_limit = Some(bytes);
        self
    }

    pub fn with_disk(mut self, bytes: u64) -> Self {
        self.disk_quota = Some(bytes);
        self
    }
}

/// Network mode for containers
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum NetworkMode {
    #[default]
    Bridge,
    Host,
    None,
    Container(String),
    Custom(String),
}

// ============================================================================
// Container Runtime Types
// ============================================================================

/// Result from running a container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerResult {
    pub container_id: ContainerId,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration: Duration,
}

/// Container information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: ContainerId,
    pub name: String,
    pub image: String,
    pub status: ContainerStatus,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub exit_code: Option<i32>,
    pub labels: HashMap<String, String>,
}

/// Container status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContainerStatus {
    Created,
    Running,
    Paused,
    Restarting,
    Removing,
    Exited,
    Dead,
}

/// A single log line from container output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogLine {
    pub is_stderr: bool,
    pub content: String,
    pub timestamp: Option<DateTime<Utc>>,
}

// ============================================================================
// Resource Management Types
// ============================================================================

/// System resources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemResources {
    pub cpu_cores: f64,
    pub memory_bytes: u64,
    pub disk_bytes: u64,
}

impl Default for SystemResources {
    fn default() -> Self {
        Self {
            cpu_cores: 0.0,
            memory_bytes: 0,
            disk_bytes: 0,
        }
    }
}

/// Resource request for a job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRequest {
    pub cpu_cores: Option<f64>,
    pub memory_bytes: Option<u64>,
    pub disk_bytes: Option<u64>,
}

impl Default for ResourceRequest {
    fn default() -> Self {
        Self {
            cpu_cores: None,
            memory_bytes: None,
            disk_bytes: None,
        }
    }
}

impl ResourceRequest {
    pub fn with_cpu(mut self, cores: f64) -> Self {
        self.cpu_cores = Some(cores);
        self
    }

    pub fn with_memory(mut self, bytes: u64) -> Self {
        self.memory_bytes = Some(bytes);
        self
    }

    pub fn with_disk(mut self, bytes: u64) -> Self {
        self.disk_bytes = Some(bytes);
        self
    }
}

/// Resource allocation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Allocation {
    pub allocation_id: AllocationId,
    pub job_id: JobId,
    pub resources: SystemResources,
    pub created_at: DateTime<Utc>,
}

/// Resource metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceMetrics {
    pub cpu_used: f64,
    pub cpu_total: f64,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub active_allocations: usize,
    pub queued_requests: usize,
}

// ============================================================================
// Events
// ============================================================================

/// Executor events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type", content = "data")]
pub enum ExecutorEvent {
    JobSubmitted {
        job_id: JobId,
    },
    JobQueued {
        job_id: JobId,
        position: usize,
    },
    JobStarted {
        job_id: JobId,
        container_id: ContainerId,
    },
    JobCompleted {
        job_id: JobId,
        exit_code: i32,
    },
    JobFailed {
        job_id: JobId,
        error: String,
    },
    JobCancelled {
        job_id: JobId,
    },
    JobTerminated {
        job_id: JobId,
    },
    ResourceAllocated {
        job_id: JobId,
        allocation: Allocation,
    },
    ResourceReleased {
        job_id: JobId,
    },
}

impl ExecutorEvent {
    pub fn job_id(&self) -> JobId {
        match self {
            ExecutorEvent::JobSubmitted { job_id } => *job_id,
            ExecutorEvent::JobQueued { job_id, .. } => *job_id,
            ExecutorEvent::JobStarted { job_id, .. } => *job_id,
            ExecutorEvent::JobCompleted { job_id, .. } => *job_id,
            ExecutorEvent::JobFailed { job_id, .. } => *job_id,
            ExecutorEvent::JobCancelled { job_id } => *job_id,
            ExecutorEvent::JobTerminated { job_id } => *job_id,
            ExecutorEvent::ResourceAllocated { job_id, .. } => *job_id,
            ExecutorEvent::ResourceReleased { job_id } => *job_id,
        }
    }
}

// ============================================================================
// Docker Capabilities
// ============================================================================

/// Docker capabilities detected on the system
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DockerCapabilities {
    pub available: bool,
    pub version: String,
    pub api_version: String,
    pub swarm_enabled: bool,
    pub gpu_support: bool,
    pub rootless: bool,
}

// ============================================================================
// Filter Types
// ============================================================================

/// Filter for job listing
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JobFilter {
    pub status: Option<JobStatus>,
    pub priority: Option<Priority>,
    pub image: Option<String>,
    pub created_after: Option<DateTime<Utc>>,
    pub created_before: Option<DateTime<Utc>>,
}
