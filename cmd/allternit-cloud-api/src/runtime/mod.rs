//! Runtime abstraction for Cowork
//!
//! Provides a unified interface for local VM and remote VPS execution.

pub mod local_runtime;
pub mod remote_runtime;
pub mod cloud_runtime;
pub mod vm_bridge;
pub mod session_manager;

use crate::db::cowork_models::*;
use crate::error::ApiError;
use async_trait::async_trait;

/// Runtime handle - returned when a run is started
#[derive(Debug, Clone)]
pub struct RuntimeHandle {
    /// Runtime-specific ID (VM ID, container ID, etc.)
    pub runtime_id: String,
    /// Runtime type
    pub runtime_type: String,
    /// Connection info for attaching
    pub connection_info: ConnectionInfo,
}

/// Connection info for attaching to a runtime
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    /// Host to connect to
    pub host: String,
    /// Port for connection
    pub port: u16,
    /// Path for socket connections (if applicable)
    pub socket_path: Option<String>,
    /// Authentication token
    pub token: Option<String>,
}

/// Runtime trait - implemented by LocalRuntime and RemoteRuntime
#[async_trait]
pub trait Runtime: Send + Sync {
    /// Start a run on this runtime
    async fn start(&self, run_id: &str, config: &RunConfig) -> Result<RuntimeHandle, ApiError>;
    
    /// Stop a run
    async fn stop(&self, runtime_id: &str) -> Result<(), ApiError>;
    
    /// Get status of a run
    async fn status(&self, runtime_id: &str) -> Result<RuntimeStatus, ApiError>;
    
    /// Attach to a running run (returns event stream)
    async fn attach(&self, runtime_id: &str, client: ClientInfo) -> Result<EventStream, ApiError>;
    
    /// Detach a client
    async fn detach(&self, runtime_id: &str, client_id: &str) -> Result<(), ApiError>;
    
    /// Execute a command on the runtime
    async fn exec(&self, runtime_id: &str, command: &str, args: &[&str]) -> Result<ExecResult, ApiError>;
    
    /// Pause execution
    async fn pause(&self, runtime_id: &str) -> Result<(), ApiError>;
    
    /// Resume execution
    async fn resume(&self, runtime_id: &str) -> Result<(), ApiError>;
}

/// Client information for attachment
#[derive(Debug, Clone)]
pub struct ClientInfo {
    pub client_id: String,
    pub client_type: ClientType,
    pub user_id: Option<String>,
}

/// Event stream from runtime
#[derive(Debug)]
pub struct EventStream {
    /// Channel receiver for events
    pub rx: tokio::sync::mpsc::Receiver<RuntimeEvent>,
}

/// Runtime event
#[derive(Debug, Clone)]
pub struct RuntimeEvent {
    pub event_type: RuntimeEventType,
    pub payload: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Runtime event types
#[derive(Debug, Clone)]
pub enum RuntimeEventType {
    Output,
    Error,
    StatusChange,
    StepStarted,
    StepCompleted,
    Heartbeat,
}

/// Runtime status
#[derive(Debug, Clone)]
pub struct RuntimeStatus {
    pub state: RuntimeState,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub resource_usage: Option<ResourceUsage>,
}

/// Runtime state
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeState {
    Starting,
    Running,
    Paused,
    Stopped,
    Failed,
}

/// Resource usage
#[derive(Debug, Clone)]
pub struct ResourceUsage {
    pub memory_mb: u64,
    pub cpu_percent: f32,
    pub disk_mb: u64,
}

/// Command execution result
#[derive(Debug, Clone)]
pub struct ExecResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Runtime factory - creates appropriate runtime based on mode
pub struct RuntimeFactory;

impl RuntimeFactory {
    /// Create a runtime for the given mode
    pub async fn create(mode: RunMode) -> Result<Box<dyn Runtime>, ApiError> {
        match mode {
            RunMode::Local => {
                let runtime = local_runtime::LocalRuntime::new().await?;
                Ok(Box::new(runtime))
            }
            RunMode::Remote => {
                let runtime = remote_runtime::RemoteRuntime::new().await?;
                Ok(Box::new(runtime))
            }
            RunMode::Cloud => {
                // For cloud, we need provider configuration
                // Default to Hetzner if HETZNER_API_TOKEN is set
                if let Ok(token) = std::env::var("HETZNER_API_TOKEN") {
                    let runtime = cloud_runtime::CloudRuntime::new_hetzner(token).await?;
                    Ok(Box::new(runtime))
                } else {
                    Err(ApiError::Internal(
                        "Cloud runtime requires HETZNER_API_TOKEN environment variable".to_string()
                    ))
                }
            }
        }
    }
}

// ============================================================================
// Approval Hook Integration
// ============================================================================

/// Result of an approval request
#[derive(Debug, Clone)]
pub enum ApprovalResult {
    /// Action was approved, may include modified parameters
    Approved { modified_params: Option<serde_json::Value> },
    /// Action was denied
    Denied { reason: Option<String> },
    /// Approval request timed out
    TimedOut,
    /// Approval was cancelled (e.g., run was stopped)
    Cancelled,
}

/// Approval hook trait - implemented by RunService for requesting human approval
///
/// This trait allows the runtime to request approval before executing sensitive actions.
/// It integrates with the Allternit kernel hooks to provide human-in-the-loop decision making
/// for autonomous agents.
#[async_trait]
pub trait ApprovalHook: Send + Sync {
    /// Request approval before executing an action
    ///
    /// This method:
    /// 1. Creates an approval_request record in the database
    /// 2. Emits an ApprovalNeeded event to the event ledger
    /// 3. Notifies connected clients via the session manager
    /// 4. Waits for a response (blocking until approved/denied/timeout)
    ///
    /// # Arguments
    /// * `run_id` - The ID of the run requesting approval
    /// * `action_type` - The type of action being requested (e.g., "shell", "file_write", "api_call")
    /// * `action_params` - JSON payload with action-specific parameters
    /// * `reasoning` - Optional explanation of why the action is being taken
    ///
    /// # Returns
    /// * `ApprovalResult` indicating the outcome of the approval request
    async fn request_approval(
        &self,
        run_id: &str,
        action_type: &str,
        action_params: serde_json::Value,
        reasoning: Option<String>,
    ) -> Result<ApprovalResult, ApiError>;

    /// Request approval with additional options
    ///
    /// Extended version that allows specifying priority, timeout, and step context
    async fn request_approval_with_options(
        &self,
        run_id: &str,
        action_type: &str,
        action_params: serde_json::Value,
        reasoning: Option<String>,
        options: ApprovalOptions,
    ) -> Result<ApprovalResult, ApiError>;

    /// Check if an approval request has been resolved (non-blocking)
    ///
    /// This is useful for polling-based implementations or checking status
    /// without waiting.
    async fn check_approval_status(
        &self,
        approval_id: &str,
    ) -> Result<Option<ApprovalResult>, ApiError>;

    /// Cancel a pending approval request
    ///
    /// Called when a run is stopped or the action is no longer needed.
    async fn cancel_approval(
        &self,
        approval_id: &str,
    ) -> Result<(), ApiError>;
}

/// Options for approval requests
#[derive(Debug, Clone)]
pub struct ApprovalOptions {
    /// Priority level for the approval request
    pub priority: ApprovalPriority,
    /// Timeout in seconds (None = no timeout)
    pub timeout_seconds: Option<u32>,
    /// Current step cursor (for tracking progress context)
    pub step_cursor: Option<String>,
    /// Custom title for the approval request
    pub title: Option<String>,
    /// Detailed description
    pub description: Option<String>,
    /// User who initiated the request (if manually triggered)
    pub requested_by: Option<String>,
}

impl Default for ApprovalOptions {
    fn default() -> Self {
        Self {
            priority: ApprovalPriority::Normal,
            timeout_seconds: Some(300), // 5 minute default timeout
            step_cursor: None,
            title: None,
            description: None,
            requested_by: None,
        }
    }
}

/// Wrapper for runtime that includes approval hooks
///
/// This provides a higher-level interface that automatically checks for
/// required approvals before executing sensitive operations.
pub struct ApprovalAwareRuntime {
    /// The underlying runtime
    runtime: Box<dyn Runtime>,
    /// Approval hook for requesting human approval
    approval_hook: Arc<dyn ApprovalHook>,
    /// Run ID for context
    run_id: String,
}

use std::sync::Arc;

impl ApprovalAwareRuntime {
    /// Create a new approval-aware runtime wrapper
    pub fn new(
        runtime: Box<dyn Runtime>,
        approval_hook: Arc<dyn ApprovalHook>,
        run_id: String,
    ) -> Self {
        Self {
            runtime,
            approval_hook,
            run_id,
        }
    }

    /// Execute a command with automatic approval checking
    ///
    /// This will request approval before executing the command if the command
    /// matches sensitive patterns.
    pub async fn exec_with_approval(
        &self,
        command: &str,
        args: &[&str],
    ) -> Result<ExecResult, ApiError> {
        // Determine if this command requires approval
        let action_type = Self::classify_command(command, args);
        
        // Build action params
        let action_params = serde_json::json!({
            "command": command,
            "args": args,
        });

        // Request approval for sensitive commands
        if Self::requires_approval(&action_type) {
            let result = self.approval_hook
                .request_approval(
                    &self.run_id,
                    &action_type,
                    action_params,
                    Some(format!("Executing command: {} {}", command, args.join(" "))),
                )
                .await?;

            match result {
                ApprovalResult::Approved { modified_params } => {
                    // Use modified params if provided
                    let (cmd, args) = if let Some(params) = modified_params {
                        let cmd = params.get("command").and_then(|c| c.as_str()).map(|s| s.to_string()).unwrap_or_else(|| command.to_string());
                        let args: Vec<String> = params.get("args")
                            .and_then(|a| a.as_array())
                            .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
                            .unwrap_or_else(|| args.iter().map(|&s| s.to_string()).collect());
                        (cmd, args)
                    } else {
                        (command.to_string(), args.iter().map(|&s| s.to_string()).collect())
                    };
                    
                    // Execute with the (possibly modified) command
                    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
                    self.runtime.exec(&self.run_id, &cmd, &args_refs).await
                }
                ApprovalResult::Denied { reason } => {
                    Err(ApiError::BadRequest(
                        format!("Command denied: {}", reason.unwrap_or_default())
                    ))
                }
                ApprovalResult::TimedOut => {
                    Err(ApiError::BadRequest(
                        "Approval request timed out".to_string()
                    ))
                }
                ApprovalResult::Cancelled => {
                    Err(ApiError::BadRequest(
                        "Approval request was cancelled".to_string()
                    ))
                }
            }
        } else {
            // No approval needed, execute directly
            self.runtime.exec(&self.run_id, command, args).await
        }
    }

    /// Classify a command into an action type
    fn classify_command(command: &str, args: &[&str]) -> String {
        let cmd_lower = command.to_lowercase();
        
        // Check for file operations
        if cmd_lower.contains("rm") || 
           (cmd_lower.contains("del") && args.iter().any(|a| !a.starts_with("/"))) {
            return "file_delete".to_string();
        }
        
        if cmd_lower.contains("mv") || cmd_lower.contains("move") {
            return "file_move".to_string();
        }
        
        if cmd_lower.contains("cp") || cmd_lower.contains("copy") {
            return "file_copy".to_string();
        }
        
        // Check for write operations
        if cmd_lower.contains(">") || 
           cmd_lower.contains("tee") ||
           cmd_lower.contains("write") {
            return "file_write".to_string();
        }
        
        // Check for network operations
        if cmd_lower.contains("curl") || 
           cmd_lower.contains("wget") ||
           cmd_lower.contains("http") {
            return "network_request".to_string();
        }
        
        // Check for package management
        if cmd_lower.contains("npm") || 
           cmd_lower.contains("pip") ||
           cmd_lower.contains("cargo") ||
           cmd_lower.contains("apt") ||
           cmd_lower.contains("yum") {
            return "package_install".to_string();
        }
        
        // Check for git operations
        if cmd_lower.contains("git") && 
           (args.iter().any(|a| *a == "push" || *a == "force" || *a == "reset")) {
            return "git_destructive".to_string();
        }
        
        // Default to shell for general commands
        "shell".to_string()
    }

    /// Check if an action type requires approval
    fn requires_approval(action_type: &str) -> bool {
        matches!(
            action_type,
            "file_delete" | "file_write" | "git_destructive" | 
            "package_install" | "network_request"
        )
    }
}

#[async_trait]
impl Runtime for ApprovalAwareRuntime {
    async fn start(&self, run_id: &str, config: &RunConfig) -> Result<RuntimeHandle, ApiError> {
        self.runtime.start(run_id, config).await
    }

    async fn stop(&self, runtime_id: &str) -> Result<(), ApiError> {
        self.runtime.stop(runtime_id).await
    }

    async fn status(&self, runtime_id: &str) -> Result<RuntimeStatus, ApiError> {
        self.runtime.status(runtime_id).await
    }

    async fn attach(&self, runtime_id: &str, client: ClientInfo) -> Result<EventStream, ApiError> {
        self.runtime.attach(runtime_id, client).await
    }

    async fn detach(&self, runtime_id: &str, client_id: &str) -> Result<(), ApiError> {
        self.runtime.detach(runtime_id, client_id).await
    }

    async fn exec(&self, _runtime_id: &str, command: &str, args: &[&str]) -> Result<ExecResult, ApiError> {
        self.exec_with_approval(command, args).await
    }

    async fn pause(&self, runtime_id: &str) -> Result<(), ApiError> {
        self.runtime.pause(runtime_id).await
    }

    async fn resume(&self, runtime_id: &str) -> Result<(), ApiError> {
        self.runtime.resume(runtime_id).await
    }
}
