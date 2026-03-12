//! A2R Protocol
//!
//! Shared types for communication between A2R Node and Control Plane.
//! This crate defines the WebSocket message protocol, job formats, and common types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ============================================================================
// Message Types
// ============================================================================

/// Top-level message envelope for WebSocket communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Unique message ID for tracking/acknowledgment
    pub id: String,
    /// Timestamp when message was created
    pub timestamp: DateTime<Utc>,
    /// The actual message payload
    #[serde(flatten)]
    pub payload: MessagePayload,
}

impl Message {
    pub fn new(payload: MessagePayload) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            payload,
        }
    }
}

/// All possible message types between node and control plane
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MessagePayload {
    // === Node → Control Plane ===
    /// Node registration (sent immediately after connection)
    NodeRegister {
        node_id: String,
        auth_token: String,
        hostname: String,
        version: String,
        capabilities: NodeCapabilities,
        labels: Vec<String>,
    },

    /// Periodic heartbeat
    Heartbeat {
        node_id: String,
        status: NodeStatus,
        resource_usage: ResourceUsage,
        running_jobs: u32,
    },

    /// Job execution started
    JobStarted { job_id: String, node_id: String },

    /// Job progress update
    JobProgress {
        job_id: String,
        progress: f64, // 0.0 to 1.0
        message: String,
        logs: Vec<String>,
    },

    /// Job completed (success or failure)
    JobCompleted {
        job_id: String,
        result: JobResult,
        duration_secs: u64,
    },

    /// Log entry from running job
    JobLog {
        job_id: String,
        level: LogLevel,
        message: String,
        timestamp: DateTime<Utc>,
    },

    /// Terminal output (for interactive sessions)
    TerminalOutput { session_id: String, data: String },

    /// File operation result
    FileOperationResult {
        operation_id: String,
        success: bool,
        error: Option<String>,
        data: Option<FileData>,
    },

    /// File download response (for binary data)
    FileDownload {
        path: String,
        data: Vec<u8>,
        total_size: u64,
        chunk_index: u32,
        total_chunks: u32,
    },

    /// File list response
    FileList {
        path: String,
        entries: Vec<FileEntry>,
    },

    /// File transfer progress
    FileTransferProgress {
        operation_id: String,
        bytes_transferred: u64,
        total_bytes: u64,
        percentage: f32,
    },

    /// ZMODEM file transfer notification
    ZmodemTransfer {
        session_id: String,
        direction: ZmodemDirection,
        filename: String,
        filesize: u64,
        status: ZmodemStatus,
    },

    // === Control Plane → Node ===
    /// Acknowledge node registration
    NodeRegistered { node_id: String, config: NodeConfig },

    /// Ping (keepalive check)
    Ping { timestamp: DateTime<Utc> },

    /// Assign a job to node
    AssignJob { job: JobSpec },

    /// Cancel a running job
    CancelJob { job_id: String },

    /// Request job status
    GetJobStatus { job_id: String },

    /// Create interactive terminal session
    CreateTerminal {
        session_id: String,
        shell: String,
        cols: u16,
        rows: u16,
        env: HashMap<String, String>,
        working_dir: Option<String>,
        sandbox: Option<SandboxConfig>,
    },

    /// Terminal input (from user)
    TerminalInput { session_id: String, data: String },

    /// Resize terminal
    ResizeTerminal {
        session_id: String,
        cols: u16,
        rows: u16,
    },

    /// Close terminal session
    CloseTerminal { session_id: String },

    /// File operation request
    FileOperation { operation: FileOperation },

    /// File upload request (chunked)
    FileUploadChunk {
        operation_id: String,
        path: String,
        data: Vec<u8>,
        chunk_index: u32,
        total_chunks: u32,
        is_last: bool,
    },

    /// Request file download
    RequestFileDownload {
        path: String,
        offset: u64,
        chunk_size: u32,
    },

    /// Request file list
    RequestFileList { path: String },

    /// Request file delete
    RequestFileDelete { path: String },

    /// Update node configuration
    UpdateConfig { config: NodeConfig },

    /// Request node to restart
    Restart,

    /// Request node to shutdown
    Shutdown,
    
    // === Run Lifecycle (Control Plane → Node) ===
    /// Start a new run
    StartRun { run_id: String, config: RunConfig },
    
    /// Stop/cancel a run
    StopRun { run_id: String },
    
    /// Attach client to run for events
    AttachRun { run_id: String, client_id: String },
    
    /// Detach client from run
    DetachRun { run_id: String, client_id: String },
    
    /// Get run status
    GetRunStatus { run_id: String },
    
    /// Send input to run
    RunInput { run_id: String, input: String },
    
    // === Run Lifecycle (Node → Control Plane) ===
    /// Run status response
    RunStatus { run_id: String, status: RunStatus, exit_code: Option<i32>, node_id: String },
    
    /// Run event (output, status change, etc.)
    RunEvent { run_id: String, event: RunEvent },
}

/// ZMODEM transfer direction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ZmodemDirection {
    Upload,   // rz (receive from terminal)
    Download, // sz (send to terminal)
}

/// ZMODEM transfer status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ZmodemStatus {
    Starting,
    InProgress,
    Completed,
    Error(String),
    Cancelled,
}

// ============================================================================
// Node Types
// ============================================================================

/// Node capabilities reported during registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeCapabilities {
    /// Docker is available
    pub docker: bool,
    /// GPU is available
    pub gpu: bool,
    /// Total CPU cores
    pub total_cpu: u32,
    /// Total memory in GB
    pub total_memory_gb: u64,
    /// Total disk in GB
    pub total_disk_gb: u64,
    /// Supported container runtimes
    pub container_runtimes: Vec<String>,
    /// Operating system
    pub os: String,
    /// Architecture (x86_64, aarch64, etc.)
    pub arch: String,
    /// File operations are supported
    pub file_operations: bool,
    /// Maximum file upload size in bytes (default: 100MB)
    pub max_file_upload_size: u64,
    /// ZMODEM support
    pub zmodem_support: bool,
}

impl Default for NodeCapabilities {
    fn default() -> Self {
        Self {
            docker: false,
            gpu: false,
            total_cpu: 1,
            total_memory_gb: 1,
            total_disk_gb: 10,
            container_runtimes: vec!["runc".to_string()],
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            file_operations: true,
            max_file_upload_size: 100 * 1024 * 1024, // 100MB
            zmodem_support: false,
        }
    }
}

/// Current status of a node
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Online,
    Busy,
    Maintenance,
    Offline,
    Error(String),
}

/// Resource usage metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub cpu_percent: f64,
    pub memory_percent: f64,
    pub disk_percent: f64,
    pub network_rx_mbps: f64,
    pub network_tx_mbps: f64,
}

/// Node configuration from control plane
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    /// How often to send heartbeat (seconds)
    pub heartbeat_interval_secs: u64,
    /// Maximum concurrent jobs
    pub max_concurrent_jobs: u32,
    /// Job timeout (seconds)
    pub job_timeout_secs: u64,
    /// Resource limits
    pub resource_limits: ResourceLimits,
    /// Allowed container images (empty = all)
    pub allowed_images: Vec<String>,
    /// Network policy
    pub network_policy: NetworkPolicy,
    /// Maximum file upload size in bytes
    pub max_file_upload_size: u64,
    /// Allowed paths for file operations (empty = any)
    pub allowed_file_paths: Vec<String>,
    /// Blocked file patterns (e.g., ["*.exe", "*.dll"])
    pub blocked_file_patterns: Vec<String>,
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            heartbeat_interval_secs: 30,
            max_concurrent_jobs: 10,
            job_timeout_secs: 3600,
            resource_limits: ResourceLimits::default(),
            allowed_images: vec![],
            network_policy: NetworkPolicy::default(),
            max_file_upload_size: 100 * 1024 * 1024, // 100MB
            allowed_file_paths: vec![],
            blocked_file_patterns: vec![],
        }
    }
}

/// Resource limits for job execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_cpu_cores: f64,
    pub max_memory_gb: f64,
    pub max_disk_gb: u64,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_cpu_cores: 2.0,
            max_memory_gb: 4.0,
            max_disk_gb: 50,
        }
    }
}

/// Network policy for containers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NetworkPolicy {
    /// No network access
    Isolated,
    /// Allow all outbound
    Unrestricted,
    /// Whitelist specific hosts
    Whitelist { hosts: Vec<String> },
    /// Custom policy (advanced)
    Custom {
        config: HashMap<String, serde_json::Value>,
    },
}

impl Default for NetworkPolicy {
    fn default() -> Self {
        NetworkPolicy::Isolated
    }
}

// ============================================================================
// Job Types
// ============================================================================

/// Job specification sent from control plane
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSpec {
    pub id: String,
    pub name: String,
    /// Work Item Handler definition
    pub wih: WIHDefinition,
    /// Resource requirements
    pub resources: ResourceRequirements,
    /// Environment variables
    pub env: HashMap<String, String>,
    /// Priority (higher = more urgent)
    pub priority: i32,
    /// Timeout in seconds
    pub timeout_secs: u64,
}

/// Work Item Handler definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WIHDefinition {
    /// Handler type (e.g., "codex", "shell", "docker")
    pub handler: String,
    /// Handler version
    pub version: String,
    /// The actual work to do
    pub task: TaskDefinition,
    /// Tool configurations
    pub tools: Vec<ToolConfig>,
}

/// Task definition varies by handler
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TaskDefinition {
    Shell {
        command: String,
        working_dir: Option<String>,
    },
    Docker {
        image: String,
        command: Vec<String>,
        volumes: Vec<VolumeMount>,
    },
    Codex {
        prompt: String,
        files: Vec<String>,
        mode: CodexMode,
    },
    Custom {
        handler: String,
        params: serde_json::Value,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CodexMode {
    Ask,
    Edit,
    Agent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    pub name: String,
    pub enabled: bool,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeMount {
    pub source: String,
    pub target: String,
    pub read_only: bool,
}

/// Sandbox configuration for containerized terminal sessions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// Docker image to use
    pub image: String,
    /// CPU limit (number of cores, e.g., 0.5, 1.0, 2.0)
    pub cpus: Option<f64>,
    /// Memory limit in MB
    pub memory_mb: Option<u64>,
    /// Volume mounts
    pub volumes: Vec<VolumeMount>,
    /// Run with read-only root filesystem
    #[serde(default)]
    pub read_only_root: bool,
    /// Drop all Linux capabilities
    #[serde(default = "default_true")]
    pub drop_capabilities: bool,
    /// Disable host network access
    #[serde(default = "default_true")]
    pub no_host_network: bool,
    /// Additional security options
    #[serde(default)]
    pub security_opts: Vec<String>,
}

fn default_true() -> bool {
    true
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            image: "alpine:latest".to_string(),
            cpus: None,
            memory_mb: None,
            volumes: vec![],
            read_only_root: false,
            drop_capabilities: true,
            no_host_network: true,
            security_opts: vec![],
        }
    }
}

/// Resource requirements for a job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRequirements {
    pub cpu_cores: f64,
    pub memory_gb: f64,
    pub disk_gb: u64,
    pub gpu: bool,
}

impl Default for ResourceRequirements {
    fn default() -> Self {
        Self {
            cpu_cores: 1.0,
            memory_gb: 1.0,
            disk_gb: 10,
            gpu: false,
        }
    }
}

impl From<ResourceRequirements> for NodeCapabilities {
    fn from(reqs: ResourceRequirements) -> Self {
        Self {
            docker: false, // Not specified in requirements
            gpu: reqs.gpu,
            total_cpu: reqs.cpu_cores as u32,
            total_memory_gb: reqs.memory_gb as u64,
            total_disk_gb: reqs.disk_gb,
            container_runtimes: vec![],
            os: String::new(),
            arch: String::new(),
            file_operations: false,
            max_file_upload_size: 0,
            zmodem_support: false,
        }
    }
}

/// Job execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub artifacts: Vec<Artifact>,
}

/// Output artifact from job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub content_type: String,
}

// ============================================================================
// File Types
// ============================================================================

/// File operation types for remote file management
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FileOperation {
    /// Upload a file to the node
    Upload { path: String, data: Vec<u8> },
    /// Download a file from the node
    Download { path: String },
    /// List directory contents
    List { path: String },
    /// Delete a file or directory
    Delete { path: String },
    /// Create a directory
    Mkdir { path: String },
    /// Get file information
    Stat { path: String },
    /// Move/rename a file
    Move { from: String, to: String },
    /// Copy a file
    Copy { from: String, to: String },
}

/// File entry in a directory listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// File or directory name
    pub name: String,
    /// Full path
    pub path: String,
    /// Whether this is a directory
    pub is_dir: bool,
    /// File size in bytes
    pub size: u64,
    /// Last modification time
    pub modified: DateTime<Utc>,
    /// Unix permissions (e.g., 0o644)
    pub permissions: Option<u32>,
    /// MIME type (for files)
    pub mime_type: Option<String>,
}

/// File data response (metadata + optional content)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileData {
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: DateTime<Utc>,
    pub content: Option<Vec<u8>>,
    pub children: Option<Vec<FileInfo>>,
    pub permissions: Option<u32>,
}

/// File information (simplified metadata)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: DateTime<Utc>,
    pub permissions: Option<u32>,
}

/// File upload request with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUploadRequest {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub mime_type: Option<String>,
    pub overwrite: bool,
}

/// File download request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDownloadRequest {
    pub path: String,
    pub chunk_size: Option<u32>,
}

// ============================================================================
// Run Types
// ============================================================================

/// Run configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunConfig {
    pub name: String,
    pub job_id: Option<String>,
    pub image: String,
    pub command: Vec<String>,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub working_dir: String,
    pub resources: ResourceRequirements,
    pub timeout_secs: u64,
}

/// Run status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus {
    Starting,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Run event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunEvent {
    pub event_type: RunEventType,
    pub timestamp: DateTime<Utc>,
    pub data: serde_json::Value,
}

/// Run event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunEventType {
    Started,
    Completed,
    Failed,
    Cancelled,
    StatusChange,
    Output,
    StepStarted,
    StepCompleted,
}

// ============================================================================
// Utility Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    #[error("Invalid message format: {0}")]
    InvalidFormat(String),

    #[error("Unknown message type: {0}")]
    UnknownType(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("File operation not allowed: {0}")]
    FileOperationNotAllowed(String),

    #[error("File too large: {size} bytes (max: {max} bytes)")]
    FileTooLarge { size: u64, max: u64 },

    #[error("Path not allowed: {0}")]
    PathNotAllowed(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_serialization() {
        let msg = Message::new(MessagePayload::Ping {
            timestamp: Utc::now(),
        });
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: Message = serde_json::from_str(&json).unwrap();

        match decoded.payload {
            MessagePayload::Ping { .. } => {}
            _ => panic!("Wrong message type"),
        }
    }

    #[test]
    fn test_node_register() {
        let payload = MessagePayload::NodeRegister {
            node_id: "node-123".to_string(),
            auth_token: "secret".to_string(),
            hostname: "test-node".to_string(),
            version: "1.0.0".to_string(),
            capabilities: NodeCapabilities::default(),
            labels: vec!["test".to_string()],
        };

        let msg = Message::new(payload);
        let json = serde_json::to_string_pretty(&msg).unwrap();

        // Verify it serializes correctly
        assert!(json.contains("node_register"));
        assert!(json.contains("node-123"));
    }

    #[test]
    fn test_file_operation_variants() {
        let ops = vec![
            FileOperation::Upload {
                path: "/test.txt".to_string(),
                data: vec![1, 2, 3],
            },
            FileOperation::Download {
                path: "/test.txt".to_string(),
            },
            FileOperation::List {
                path: "/".to_string(),
            },
            FileOperation::Delete {
                path: "/test.txt".to_string(),
            },
            FileOperation::Mkdir {
                path: "/newdir".to_string(),
            },
            FileOperation::Stat {
                path: "/test.txt".to_string(),
            },
            FileOperation::Move {
                from: "/a".to_string(),
                to: "/b".to_string(),
            },
            FileOperation::Copy {
                from: "/a".to_string(),
                to: "/b".to_string(),
            },
        ];

        for op in ops {
            let json = serde_json::to_string(&op).unwrap();
            let decoded: FileOperation = serde_json::from_str(&json).unwrap();
            assert!(matches!(
                (op, decoded),
                (FileOperation::Upload { .. }, FileOperation::Upload { .. })
                    | (
                        FileOperation::Download { .. },
                        FileOperation::Download { .. }
                    )
                    | (FileOperation::List { .. }, FileOperation::List { .. })
                    | (FileOperation::Delete { .. }, FileOperation::Delete { .. })
                    | (FileOperation::Mkdir { .. }, FileOperation::Mkdir { .. })
                    | (FileOperation::Stat { .. }, FileOperation::Stat { .. })
                    | (FileOperation::Move { .. }, FileOperation::Move { .. })
                    | (FileOperation::Copy { .. }, FileOperation::Copy { .. })
            ));
        }
    }

    #[test]
    fn test_file_entry_serialization() {
        let entry = FileEntry {
            name: "test.txt".to_string(),
            path: "/home/user/test.txt".to_string(),
            is_dir: false,
            size: 1024,
            modified: Utc::now(),
            permissions: Some(0o644),
            mime_type: Some("text/plain".to_string()),
        };

        let json = serde_json::to_string(&entry).unwrap();
        let decoded: FileEntry = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.name, "test.txt");
        assert_eq!(decoded.path, "/home/user/test.txt");
        assert!(!decoded.is_dir);
        assert_eq!(decoded.size, 1024);
    }

    #[test]
    fn test_zmodem_types() {
        let msg = MessagePayload::ZmodemTransfer {
            session_id: "session-123".to_string(),
            direction: ZmodemDirection::Upload,
            filename: "test.txt".to_string(),
            filesize: 1024,
            status: ZmodemStatus::InProgress,
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("zmodem_transfer"));
        assert!(json.contains("upload"));
        assert!(json.contains("in_progress"));
    }
}
