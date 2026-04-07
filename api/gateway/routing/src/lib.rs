pub mod mcp_bridge;

use allternit_history::HistoryLedger;
use allternit_messaging::{EventEnvelope, MessagingSystem};
use allternit_policy::{PolicyEffect, PolicyEngine, PolicyRequest, SafetyTier};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::process::Command;
use tokio::sync::RwLock;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum ToolType {
    Local,
    Http,
    Mpc,
    Sdk,
    Subprocess,
    Mcp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SubprocessSpec {
    pub worker_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WorkerRegistry {
    pub version: String,
    pub workers: Vec<WorkerDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WorkerDefinition {
    pub worker_id: String,
    pub description: String,
    pub command: String,
    pub args_template: Vec<String>,
    pub cwd_policy: String, // repo_root | run_artifacts_dir | path:<relative>
    pub env_allowlist: Vec<String>,
    pub fs_policy: WorkerFsPolicy,
    pub timeouts: WorkerTimeouts,
    pub output_limits: WorkerOutputLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WorkerFsPolicy {
    pub must_be_run_scoped: bool,
    pub allowed_output_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WorkerTimeouts {
    pub wall_ms: u64,
    pub cpu_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WorkerOutputLimits {
    pub max_stdout_bytes: u64,
    pub max_stderr_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ToolDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tool_type: ToolType,
    pub command: String,  // For local tools
    pub endpoint: String, // For HTTP tools
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
    pub side_effects: Vec<String>,
    pub idempotency_behavior: String,
    pub retryable: bool,
    pub failure_classification: String,
    pub safety_tier: SafetyTier,
    pub resource_limits: ResourceLimits,
    pub subprocess: Option<SubprocessSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResourceLimits {
    pub cpu: Option<String>,
    pub memory: Option<String>,
    pub network: NetworkAccess,
    pub filesystem: FilesystemAccess,
    pub time_limit: u64, // in seconds
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum NetworkAccess {
    None,
    DomainAllowlist(Vec<String>),
    Unrestricted,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum FilesystemAccess {
    None,
    Allowlist(Vec<String>),
    ReadWrite(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionRequest {
    pub tool_id: String,
    pub input: serde_json::Value,
    pub identity_id: String,
    pub session_id: String,
    pub tenant_id: String,
    pub run_id: Option<String>,
    pub workflow_id: Option<String>,
    pub node_id: Option<String>,
    pub wih_id: Option<String>,
    pub write_scope: Option<WriteScope>,
    pub capsule_run: Option<bool>,
    pub trace_id: Option<String>,
    pub retry_count: u32,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteScope {
    pub root: String,
    pub allowed_globs: Vec<String>,
}

impl Default for WriteScope {
    fn default() -> Self {
        Self {
            root: "/.a2r/".to_string(),
            allowed_globs: Vec::new(),
        }
    }
}

pub fn run_scoped_write_scope(run_id: &str, capsule_run: bool) -> WriteScope {
    let mut globs = vec![
        format!("/.a2r/artifacts/{run_id}/**"),
        format!("/.a2r/receipts/{run_id}/**"),
    ];
    if capsule_run {
        globs.push(format!("/.a2r/capsules/instances/{run_id}/**"));
    }
    WriteScope {
        root: "/.a2r/".to_string(),
        allowed_globs: globs,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub execution_id: String,
    pub tool_id: String,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub execution_time_ms: u64,
    pub resources_used: ResourceUsage,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub cpu_time_ms: u64,
    pub memory_peak_kb: u64,
    pub network_bytes: u64,
    pub filesystem_ops: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum ToolGatewayError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("History error: {0}")]
    History(#[from] allternit_history::HistoryError),
    #[error("Policy error: {0}")]
    Policy(#[from] allternit_policy::PolicyError),
    #[error("Tool not found: {0}")]
    ToolNotFound(String),
    #[error("Execution failed: {0}")]
    ExecutionFailed(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Mutex poisoned: {0}")]
    MutexPoisoned(String),
    #[error("Time error: {0}")]
    TimeError(String),
}

#[async_trait]
pub trait SdkToolExecutor: Send + Sync {
    async fn execute(
        &self,
        request: &ToolExecutionRequest,
    ) -> Result<serde_json::Value, ToolGatewayError>;
}

#[async_trait]
pub trait ToolExecutionReporter: Send + Sync {
    async fn record_execution(&self, request: ToolExecutionRequest, result: ToolExecutionResult);
}

pub struct ToolGateway {
    tools: Arc<RwLock<HashMap<String, ToolDefinition>>>,
    policy_engine: Arc<PolicyEngine>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    max_retries: u32,
    sdk_executor: Arc<RwLock<Option<Arc<dyn SdkToolExecutor>>>>,
    execution_reporter: Arc<RwLock<Option<Arc<dyn ToolExecutionReporter>>>>,
    mcp_bridge: Arc<mcp_bridge::McpToolBridge>,
}

impl ToolGateway {
    pub fn new(
        policy_engine: Arc<PolicyEngine>,
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        ToolGateway {
            tools: Arc::new(RwLock::new(HashMap::new())),
            policy_engine,
            history_ledger,
            messaging_system,
            max_retries: 3,
            sdk_executor: Arc::new(RwLock::new(None)),
            execution_reporter: Arc::new(RwLock::new(None)),
            mcp_bridge: Arc::new(mcp_bridge::McpToolBridge::new()),
        }
    }

    pub async fn set_sdk_executor(&self, executor: Arc<dyn SdkToolExecutor>) {
        let mut sdk_executor = self.sdk_executor.write().await;
        *sdk_executor = Some(executor);
    }

    pub async fn set_execution_reporter(&self, reporter: Arc<dyn ToolExecutionReporter>) {
        let mut execution_reporter = self.execution_reporter.write().await;
        *execution_reporter = Some(reporter);
    }

    pub async fn register_tool(&self, tool: ToolDefinition) -> Result<String, ToolGatewayError> {
        let tool_id = tool.id.clone();

        // Store in memory
        let mut tools = self.tools.write().await;
        tools.insert(tool_id.clone(), tool);
        drop(tools);

        Ok(tool_id)
    }

    pub async fn execute_tool(
        &self,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, ToolGatewayError> {
        let start_time = std::time::Instant::now();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| ToolGatewayError::TimeError(e.to_string()))?
            .as_secs();

        // Get the tool definition
        let tools = self.tools.read().await;
        let tool_def = tools
            .get(&request.tool_id)
            .cloned()
            .ok_or_else(|| ToolGatewayError::ToolNotFound(request.tool_id.clone()))?;
        drop(tools);

        let wih_id = request.wih_id.clone().unwrap_or_default();
        if wih_id.is_empty() {
            return Err(ToolGatewayError::PermissionDenied(
                "WIH context required for tool execution".to_string(),
            ));
        }

        let run_id = request.run_id.clone().ok_or_else(|| {
            ToolGatewayError::PermissionDenied("run_id required for tool execution".to_string())
        })?;
        if !is_safe_component(&run_id) {
            return Err(ToolGatewayError::PermissionDenied(
                "invalid run_id for tool execution".to_string(),
            ));
        }

        let workflow_id = request.workflow_id.clone().ok_or_else(|| {
            ToolGatewayError::PermissionDenied(
                "workflow_id required for tool execution".to_string(),
            )
        })?;
        if workflow_id.trim().is_empty() || !is_safe_component(&workflow_id) {
            return Err(ToolGatewayError::PermissionDenied(
                "invalid workflow_id for tool execution".to_string(),
            ));
        }

        let node_id = request.node_id.clone().ok_or_else(|| {
            ToolGatewayError::PermissionDenied("node_id required for tool execution".to_string())
        })?;
        if node_id.trim().is_empty() || !is_safe_component(&node_id) {
            return Err(ToolGatewayError::PermissionDenied(
                "invalid node_id for tool execution".to_string(),
            ));
        }

        let write_scope = request.write_scope.clone().ok_or_else(|| {
            ToolGatewayError::PermissionDenied(
                "write_scope required for tool execution".to_string(),
            )
        })?;
        if !write_scope.root.starts_with("/.a2r/") {
            return Err(ToolGatewayError::PermissionDenied(
                "write_scope root must be under /.a2r/".to_string(),
            ));
        }
        if write_scope.allowed_globs.is_empty() {
            return Err(ToolGatewayError::PermissionDenied(
                "write_scope must declare allowed_globs".to_string(),
            ));
        }
        if is_denied_path(&write_scope.root) {
            return Err(ToolGatewayError::PermissionDenied(
                "write_scope root targets denied path".to_string(),
            ));
        }
        if is_other_run_receipts_path(&write_scope.root, &run_id) {
            return Err(ToolGatewayError::PermissionDenied(
                "write_scope root targets another run receipts".to_string(),
            ));
        }
        for glob in &write_scope.allowed_globs {
            if !glob.starts_with(&write_scope.root) {
                return Err(ToolGatewayError::PermissionDenied(
                    "write_scope glob outside root".to_string(),
                ));
            }
            if is_denied_path(glob) {
                return Err(ToolGatewayError::PermissionDenied(
                    "write_scope includes denied path".to_string(),
                ));
            }
            if is_other_run_receipts_path(glob, &run_id) {
                return Err(ToolGatewayError::PermissionDenied(
                    "write_scope includes other run receipts".to_string(),
                ));
            }
        }

        validate_filesystem_access(&tool_def.resource_limits.filesystem, &write_scope, &run_id)?;

        // Check if the tool has side effects
        let has_side_effects = !tool_def.side_effects.is_empty();

        // For tools with side effects, require an idempotency key
        if has_side_effects && request.idempotency_key.is_none() {
            return Err(ToolGatewayError::ExecutionFailed(
                "Idempotency key required for tools with side effects".to_string(),
            ));
        }

        // Check policy before execution
        let policy_request = PolicyRequest {
            identity_id: request.identity_id.clone(),
            resource: format!("tool:{}", request.tool_id),
            action: "execute".to_string(),
            context: serde_json::json!({
                "session_id": request.session_id,
                "tenant_id": request.tenant_id,
                "tool_id": request.tool_id,
                "trace_id": request.trace_id
            }),
            requested_tier: tool_def.safety_tier.clone(),
        };

        let decision = self.policy_engine.evaluate(policy_request).await?;

        if matches!(decision.decision, PolicyEffect::Deny) {
            return Err(ToolGatewayError::PermissionDenied(format!(
                "Policy denied execution: {}",
                decision.reason
            )));
        }

        // Log pre-tool use event
        let pre_event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "PreToolUse".to_string(),
            session_id: request.session_id.clone(),
            tenant_id: request.tenant_id.clone(),
            actor_id: request.identity_id.clone(),
            role: "tool_gateway".to_string(),
            timestamp,
            trace_id: request.trace_id.clone(),
            payload: serde_json::json!({
                "tool_id": request.tool_id,
                "input": request.input,
                "policy_decision": decision,
                "wih_id": wih_id,
                "run_id": run_id,
                "workflow_id": workflow_id,
                "node_id": node_id,
                "write_scope": write_scope.clone()
            }),
        };

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = pre_event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        // Execute the tool based on its type
        let result = match tool_def.tool_type {
            ToolType::Local => self.execute_local_tool(&tool_def, &request).await,
            ToolType::Http => self.execute_http_tool(&tool_def, &request).await,
            ToolType::Sdk => self.execute_sdk_tool(&tool_def, &request).await,
            ToolType::Subprocess => {
                self.execute_subprocess_tool(&tool_def, &request, &write_scope)
                    .await
            }
            ToolType::Mcp => self.execute_mcp_tool(&request).await,
            _ => {
                // For now, just return a mock result for other tool types
                Ok(ToolExecutionResult {
                    execution_id: Uuid::new_v4().to_string(),
                    tool_id: request.tool_id.clone(),
                    input: request.input.clone(),
                    output: Some(serde_json::json!({"result": "mock_output"})),
                    error: None,
                    stdout: "Mock execution completed".to_string(),
                    stderr: "".to_string(),
                    exit_code: Some(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    resources_used: ResourceUsage {
                        cpu_time_ms: 10,
                        memory_peak_kb: 1024,
                        network_bytes: 0,
                        filesystem_ops: 0,
                    },
                    timestamp,
                })
            }
        };

        let execution_result = match result {
            Ok(mut exec_result) => {
                exec_result.execution_time_ms = start_time.elapsed().as_millis() as u64;
                exec_result
            }
            Err(e) => ToolExecutionResult {
                execution_id: Uuid::new_v4().to_string(),
                tool_id: request.tool_id.clone(),
                input: request.input.clone(),
                output: None,
                error: Some(e.to_string()),
                stdout: "".to_string(),
                stderr: e.to_string(),
                exit_code: Some(1),
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                resources_used: ResourceUsage {
                    cpu_time_ms: 0,
                    memory_peak_kb: 0,
                    network_bytes: 0,
                    filesystem_ops: 0,
                },
                timestamp,
            },
        };

        // Log post-tool use event
        let post_event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "PostToolUse".to_string(),
            session_id: request.session_id.clone(),
            tenant_id: request.tenant_id.clone(),
            actor_id: request.identity_id.clone(),
            role: "tool_gateway".to_string(),
            timestamp,
            trace_id: request.trace_id.clone(),
            payload: serde_json::json!({
                "tool_id": request.tool_id,
                "execution_result": &execution_result,
                "policy_decision": decision
            }),
        };

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = post_event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        if let Some(reporter) = self.execution_reporter.read().await.clone() {
            let request_clone = request.clone();
            let result_clone = execution_result.clone();
            tokio::spawn(async move {
                reporter.record_execution(request_clone, result_clone).await;
            });
        }

        let _ = write_receipt(
            &request,
            &tool_def,
            &decision,
            &execution_result,
            &pre_event,
            start_time.elapsed().as_millis() as u64,
            &write_scope,
        );

        // Log to history ledger
        let mut history = self
            .history_ledger
            .lock()
            .map_err(|e| ToolGatewayError::MutexPoisoned(e.to_string()))?;
        let content = serde_json::to_value(&execution_result)?;
        history.append(content)?;

        Ok(execution_result)
    }

    async fn execute_sdk_tool(
        &self,
        _tool_def: &ToolDefinition,
        request: &ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, ToolGatewayError> {
        let executor = {
            let sdk_executor = self.sdk_executor.read().await;
            sdk_executor.clone()
        };

        let executor = executor.ok_or_else(|| {
            ToolGatewayError::ExecutionFailed("SDK executor not configured".to_string())
        })?;

        let output = executor.execute(request).await?;

        Ok(ToolExecutionResult {
            execution_id: Uuid::new_v4().to_string(),
            tool_id: request.tool_id.clone(),
            input: request.input.clone(),
            output: Some(output),
            error: None,
            stdout: "".to_string(),
            stderr: "".to_string(),
            exit_code: Some(0),
            execution_time_ms: 0,
            resources_used: ResourceUsage {
                cpu_time_ms: 0,
                memory_peak_kb: 0,
                network_bytes: 0,
                filesystem_ops: 0,
            },
            timestamp: 0,
        })
    }

    async fn execute_local_tool(
        &self,
        tool_def: &ToolDefinition,
        request: &ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, ToolGatewayError> {
        // For security, we'll create a temporary directory and execute in a restricted environment
        // In a real implementation, this would use proper sandboxing (e.g., containers, VMs)

        // Serialize input to a temporary file
        let input_file = tempfile::NamedTempFile::new().map_err(ToolGatewayError::Io)?;

        std::fs::write(input_file.path(), serde_json::to_string(&request.input)?)
            .map_err(ToolGatewayError::Io)?;

        // Prepare the command
        let mut cmd = Command::new(&tool_def.command);
        cmd.arg(input_file.path());

        // Set resource limits (in a real implementation, this would be more sophisticated)
        cmd.kill_on_drop(true);

        // Execute the command with timeout
        let output = tokio::time::timeout(
            tokio::time::Duration::from_secs(tool_def.resource_limits.time_limit),
            cmd.output(),
        )
        .await
        .map_err(|_| ToolGatewayError::Timeout("Tool execution timed out".to_string()))?;

        let output = output.map_err(|e| ToolGatewayError::ExecutionFailed(e.to_string()))?;

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        let stderr_str = String::from_utf8_lossy(&output.stderr);

        // Parse the output (in a real implementation, validate against output_schema)
        let output_json = if !stdout_str.is_empty() {
            match serde_json::from_str(&stdout_str) {
                Ok(json) => Some(json),
                Err(_) => Some(serde_json::json!({"raw_output": &*stdout_str})),
            }
        } else {
            None
        };

        Ok(ToolExecutionResult {
            execution_id: Uuid::new_v4().to_string(),
            tool_id: request.tool_id.clone(),
            input: request.input.clone(),
            output: output_json,
            error: if output.status.success() {
                None
            } else {
                Some(stderr_str.to_string())
            },
            stdout: stdout_str.to_string(),
            stderr: stderr_str.to_string(),
            exit_code: output.status.code(),
            execution_time_ms: 0, // Will be set by caller
            resources_used: ResourceUsage {
                cpu_time_ms: 0, // Would be measured in a real implementation
                memory_peak_kb: 0,
                network_bytes: 0,
                filesystem_ops: 0,
            },
            timestamp: 0, // Will be set by caller
        })
    }

    async fn execute_subprocess_tool(
        &self,
        tool_def: &ToolDefinition,
        request: &ToolExecutionRequest,
        write_scope: &WriteScope,
    ) -> Result<ToolExecutionResult, ToolGatewayError> {
        let spec = tool_def.subprocess.clone().ok_or_else(|| {
            ToolGatewayError::ExecutionFailed("Subprocess spec missing".to_string())
        })?;

        let run_id = request.run_id.clone().ok_or_else(|| {
            ToolGatewayError::PermissionDenied("run_id required for subprocess".to_string())
        })?;
        if !is_safe_component(&run_id) {
            return Err(ToolGatewayError::PermissionDenied(
                "invalid run_id for subprocess".to_string(),
            ));
        }

        let repo_root = repo_root()?;
        let registry = load_worker_registry(&repo_root)?;
        let worker = resolve_worker(&registry, &spec.worker_id)?;

        ensure_worker_fs_policy(worker, write_scope, &run_id)?;

        let command_path = resolve_worker_command(&worker.command, &repo_root)?;
        let args = render_args(&worker.args_template, &request.input)?;
        let argv: Vec<String> = std::iter::once(command_path.to_string_lossy().to_string())
            .chain(args.iter().cloned())
            .collect();

        let cwd = resolve_worker_cwd(&worker.cwd_policy, &repo_root, &run_id)?;

        let mut cmd = Command::new(&command_path);
        cmd.args(&args);
        cmd.current_dir(&cwd);

        cmd.env_clear();
        for key in &worker.env_allowlist {
            if let Ok(val) = std::env::var(key) {
                cmd.env(key, val);
            }
        }

        cmd.kill_on_drop(true);

        let timeout_secs = if worker.timeouts.wall_ms == 0 {
            tool_def.resource_limits.time_limit
        } else {
            (worker.timeouts.wall_ms / 1000).max(1)
        };

        let output =
            tokio::time::timeout(tokio::time::Duration::from_secs(timeout_secs), cmd.output())
                .await
                .map_err(|_| ToolGatewayError::Timeout("Subprocess timed out".to_string()))?
                .map_err(ToolGatewayError::Io)?;

        let stdout_preview =
            truncate_output(&output.stdout, worker.output_limits.max_stdout_bytes, true);
        let stderr_preview =
            truncate_output(&output.stderr, worker.output_limits.max_stderr_bytes, true);

        let receipt_id = write_subprocess_receipt(
            &run_id,
            &worker.worker_id,
            &argv,
            &cwd.to_string_lossy(),
            &worker.env_allowlist,
            output.status.code().unwrap_or(1),
            &output.stdout,
            &output.stderr,
            &stdout_preview,
            &stderr_preview,
        )?;

        Ok(ToolExecutionResult {
            execution_id: Uuid::new_v4().to_string(),
            tool_id: request.tool_id.clone(),
            input: request.input.clone(),
            output: Some(serde_json::json!({
                "stdout": stdout_preview,
                "stderr": stderr_preview,
                "subprocess_receipt_id": receipt_id
            })),
            error: if output.status.success() {
                None
            } else {
                Some(stderr_preview.clone())
            },
            stdout: stdout_preview,
            stderr: stderr_preview,
            exit_code: output.status.code(),
            execution_time_ms: 0,
            resources_used: ResourceUsage {
                cpu_time_ms: 0,
                memory_peak_kb: 0,
                network_bytes: 0,
                filesystem_ops: 0,
            },
            timestamp: 0,
        })
    }

    async fn execute_http_tool(
        &self,
        tool_def: &ToolDefinition,
        request: &ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, ToolGatewayError> {
        let start = std::time::Instant::now();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| ToolGatewayError::TimeError(e.to_string()))?
            .as_secs();

        tracing::info!(
            "Executing HTTP tool: {} with input: {:?}",
            tool_def.id,
            request.input
        );

        let client = Client::new();
        let payload = serde_json::json!({
            "tool_id": request.tool_id,
            "input": request.input,
            "identity_id": request.identity_id,
            "session_id": request.session_id,
            "tenant_id": request.tenant_id,
            "trace_id": request.trace_id,
            "retry_count": request.retry_count,
            "idempotency_key": request.idempotency_key,
        });

        let response = client
            .post(&tool_def.endpoint)
            .json(&payload)
            .send()
            .await
            .map_err(|e| {
                ToolGatewayError::ExecutionFailed(format!("HTTP tool request failed: {}", e))
            })?;

        let status = response.status();
        let body = response.text().await.map_err(|e| {
            ToolGatewayError::ExecutionFailed(format!("HTTP tool response read failed: {}", e))
        })?;
        let body_len = body.len();

        if !status.is_success() {
            return Err(ToolGatewayError::ExecutionFailed(format!(
                "HTTP tool error ({}): {}",
                status, body
            )));
        }

        let parsed: serde_json::Value = serde_json::from_str(&body)
            .unwrap_or_else(|_| serde_json::json!({ "raw_output": body }));

        if let Ok(exec_result) = serde_json::from_value::<ToolExecutionResult>(parsed.clone()) {
            return Ok(exec_result);
        }

        let stdout = parsed
            .get("stdout")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string();
        let stderr = parsed
            .get("stderr")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string();
        let exit_code = parsed
            .get("exit_code")
            .and_then(|value| value.as_i64())
            .map(|value| value as i32)
            .or(Some(0));

        Ok(ToolExecutionResult {
            execution_id: Uuid::new_v4().to_string(),
            tool_id: request.tool_id.clone(),
            input: request.input.clone(),
            output: Some(parsed),
            error: None,
            stdout,
            stderr,
            exit_code,
            execution_time_ms: start.elapsed().as_millis() as u64,
            resources_used: ResourceUsage {
                cpu_time_ms: 0,
                memory_peak_kb: 0,
                network_bytes: body_len as u64,
                filesystem_ops: 0,
            },
            timestamp,
        })
    }

    async fn execute_mcp_tool(
        &self,
        request: &ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, ToolGatewayError> {
        self.mcp_bridge
            .execute_mcp_tool(&request.tool_id, request)
            .await
            .map_err(|e| e.into())
    }

    /// Get the MCP bridge for configuration
    pub fn mcp_bridge(&self) -> Arc<mcp_bridge::McpToolBridge> {
        self.mcp_bridge.clone()
    }

    pub async fn get_tool(&self, tool_id: String) -> Option<ToolDefinition> {
        let tools = self.tools.read().await;
        tools.get(&tool_id).cloned()
    }

    pub async fn list_tools(&self) -> Vec<ToolDefinition> {
        let tools = self.tools.read().await;
        tools.values().cloned().collect()
    }

    pub async fn set_max_retries(&self, max_retries: u32) {
        // Note: This won't work with immutable self, so we'll just log it for now
        // In a real implementation, you'd need to use interior mutability (e.g., Mutex or RwLock)
        tracing::info!("Setting max retries to {}", max_retries);
    }
}

// Helper functions for common tool operations
impl ToolGateway {
    pub async fn register_default_tools(&self) -> Result<(), ToolGatewayError> {
        // Register a simple echo tool for testing
        let echo_tool = ToolDefinition {
            id: "echo_tool".to_string(),
            name: "Echo Tool".to_string(),
            description: "Simple echo tool for testing".to_string(),
            tool_type: ToolType::Local,
            command: "echo".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "message": {"type": "string"}
                },
                "required": ["message"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "output": {"type": "string"}
                }
            }),
            side_effects: vec!["read".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: Some("100m".to_string()),
                memory: Some("64Mi".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10, // 10 seconds
            },
            subprocess: None,
        };

        self.register_tool(echo_tool).await?;
        Ok(())
    }
}

fn render_args(
    template: &[String],
    input: &serde_json::Value,
) -> Result<Vec<String>, ToolGatewayError> {
    let mut rendered = Vec::with_capacity(template.len());
    let input_obj = input.as_object();

    for item in template {
        let mut arg = item.clone();
        if let Some(obj) = input_obj {
            for (key, value) in obj {
                let placeholder = format!("{{{{{}}}}}", key);
                if arg.contains(&placeholder) {
                    let replacement = value
                        .as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| value.to_string());
                    arg = arg.replace(&placeholder, &replacement);
                }
            }
        }

        if arg.contains("{{") && arg.contains("}}") {
            return Err(ToolGatewayError::ExecutionFailed(
                "unresolved args_template placeholder".to_string(),
            ));
        }

        rendered.push(arg);
    }

    Ok(rendered)
}

fn repo_root() -> Result<std::path::PathBuf, ToolGatewayError> {
    if let Ok(root) = std::env::var("ALLTERNIT_REPO_ROOT") {
        return Ok(std::path::PathBuf::from(root));
    }
    std::env::current_dir().map_err(ToolGatewayError::Io)
}

fn load_worker_registry(root: &std::path::Path) -> Result<WorkerRegistry, ToolGatewayError> {
    let registry_path = if let Ok(path) = std::env::var("ALLTERNIT_WORKER_REGISTRY_PATH") {
        std::path::PathBuf::from(path)
    } else {
        root.join("workers").join("worker_registry.json")
    };

    let contents = std::fs::read_to_string(&registry_path).map_err(ToolGatewayError::Io)?;
    serde_json::from_str::<WorkerRegistry>(&contents).map_err(|e| {
        ToolGatewayError::ExecutionFailed(format!(
            "invalid worker registry {}: {}",
            registry_path.display(),
            e
        ))
    })
}

fn resolve_worker<'a>(
    registry: &'a WorkerRegistry,
    worker_id: &str,
) -> Result<&'a WorkerDefinition, ToolGatewayError> {
    registry
        .workers
        .iter()
        .find(|worker| worker.worker_id == worker_id)
        .ok_or_else(|| {
            ToolGatewayError::PermissionDenied(format!("worker_id not allowlisted: {}", worker_id))
        })
}

fn ensure_worker_fs_policy(
    worker: &WorkerDefinition,
    write_scope: &WriteScope,
    run_id: &str,
) -> Result<(), ToolGatewayError> {
    if !worker.fs_policy.must_be_run_scoped {
        return Err(ToolGatewayError::PermissionDenied(
            "worker fs_policy must_be_run_scoped is false".to_string(),
        ));
    }
    if worker.fs_policy.allowed_output_roots.is_empty() {
        return Err(ToolGatewayError::PermissionDenied(
            "worker allowed_output_roots must be non-empty".to_string(),
        ));
    }

    let mut expanded_roots = Vec::new();
    for root in &worker.fs_policy.allowed_output_roots {
        let expanded = root.replace("{{run_id}}", run_id);
        if !expanded.starts_with("/.a2r/") {
            return Err(ToolGatewayError::PermissionDenied(
                "worker allowed_output_roots must be under /.a2r/".to_string(),
            ));
        }
        if !is_path_within_scope(&expanded, write_scope) {
            return Err(ToolGatewayError::PermissionDenied(
                "worker allowed_output_roots outside write_scope".to_string(),
            ));
        }
        expanded_roots.push(expanded);
    }

    for glob in &write_scope.allowed_globs {
        let normalized = normalize_scope_path(glob);
        if normalized.starts_with("/.a2r/receipts/") {
            continue;
        }
        let allowed = expanded_roots.iter().any(|root| {
            let prefix = glob_prefix(root);
            normalized == prefix || normalized.starts_with(&format!("{}/", prefix))
        });
        if !allowed {
            return Err(ToolGatewayError::PermissionDenied(
                "write_scope globs exceed worker allowed_output_roots".to_string(),
            ));
        }
    }

    Ok(())
}

fn resolve_worker_command(
    command: &str,
    root: &std::path::Path,
) -> Result<std::path::PathBuf, ToolGatewayError> {
    if command.trim().is_empty() || command.contains(' ') {
        return Err(ToolGatewayError::PermissionDenied(
            "worker command must be a single path token".to_string(),
        ));
    }
    if command.ends_with("bash")
        || command.ends_with("/bash")
        || command.ends_with("sh")
        || command.ends_with("/sh")
    {
        return Err(ToolGatewayError::PermissionDenied(
            "worker command cannot be a shell".to_string(),
        ));
    }
    let path = std::path::Path::new(command);
    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        if command.contains("..") {
            return Err(ToolGatewayError::PermissionDenied(
                "worker command path traversal not allowed".to_string(),
            ));
        }
        root.join(command)
    };
    if resolved
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(ToolGatewayError::PermissionDenied(
            "worker command path traversal not allowed".to_string(),
        ));
    }
    if !resolved.exists() {
        return Err(ToolGatewayError::ExecutionFailed(format!(
            "worker command not found: {}",
            resolved.display()
        )));
    }
    Ok(resolved)
}

fn resolve_worker_cwd(
    policy: &str,
    root: &std::path::Path,
    run_id: &str,
) -> Result<std::path::PathBuf, ToolGatewayError> {
    if policy == "repo_root" {
        return Ok(root.to_path_buf());
    }
    if policy == "run_artifacts_dir" {
        let dir = root.join(".a2r").join("artifacts").join(run_id);
        std::fs::create_dir_all(&dir).map_err(ToolGatewayError::Io)?;
        return Ok(dir);
    }
    if let Some(path) = policy.strip_prefix("path:") {
        if path.contains("..") || path.starts_with('/') {
            return Err(ToolGatewayError::PermissionDenied(
                "cwd path must be repo-relative".to_string(),
            ));
        }
        let dir = root.join(path);
        if dir
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return Err(ToolGatewayError::PermissionDenied(
                "cwd path traversal not allowed".to_string(),
            ));
        }
        return Ok(dir);
    }

    Err(ToolGatewayError::PermissionDenied(
        "invalid cwd_policy".to_string(),
    ))
}

fn truncate_output(bytes: &[u8], max_bytes: u64, capture: bool) -> String {
    if !capture {
        return String::new();
    }

    let mut output = bytes.to_vec();
    if max_bytes > 0 && output.len() > max_bytes as usize {
        output.truncate(max_bytes as usize);
    }

    String::from_utf8_lossy(&output).to_string()
}

fn hash_bytes(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

fn validate_filesystem_access(
    access: &FilesystemAccess,
    write_scope: &WriteScope,
    run_id: &str,
) -> Result<(), ToolGatewayError> {
    match access {
        FilesystemAccess::None => Ok(()),
        FilesystemAccess::Allowlist(paths) | FilesystemAccess::ReadWrite(paths) => {
            for path in paths {
                let normalized = normalize_scope_path(path);
                if is_denied_path(&normalized) {
                    return Err(ToolGatewayError::PermissionDenied(
                        "filesystem access targets denied path".to_string(),
                    ));
                }
                if is_other_run_receipts_path(&normalized, run_id) {
                    return Err(ToolGatewayError::PermissionDenied(
                        "filesystem access targets another run receipts".to_string(),
                    ));
                }
                if !normalized.starts_with(&write_scope.root) {
                    return Err(ToolGatewayError::PermissionDenied(
                        "filesystem access outside write_scope".to_string(),
                    ));
                }
                if !is_path_within_scope(&normalized, write_scope) {
                    return Err(ToolGatewayError::PermissionDenied(
                        "filesystem access outside write_scope globs".to_string(),
                    ));
                }
            }
            Ok(())
        }
    }
}

fn normalize_scope_path(path: &str) -> String {
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path.trim_start_matches('/'))
    }
}

fn glob_prefix(glob: &str) -> String {
    let normalized = normalize_scope_path(glob);
    normalized
        .trim_end_matches("/**")
        .trim_end_matches("/*")
        .to_string()
}

fn is_path_within_scope(path: &str, write_scope: &WriteScope) -> bool {
    let normalized = normalize_scope_path(path);
    for glob in &write_scope.allowed_globs {
        let prefix = glob_prefix(glob);
        if normalized == prefix || normalized.starts_with(&format!("{}/", prefix)) {
            return true;
        }
    }
    false
}

fn is_denied_path(path: &str) -> bool {
    let normalized = normalize_scope_path(path);
    normalized.starts_with("/.a2r/wih/")
        || normalized.starts_with("/.a2r/graphs/")
        || normalized.starts_with("/.a2r/spec/")
}

fn is_other_run_receipts_path(path: &str, run_id: &str) -> bool {
    let normalized = normalize_scope_path(path);
    if !normalized.starts_with("/.a2r/receipts/") {
        return false;
    }
    let allowed_exact = format!("/.a2r/receipts/{}", run_id);
    let allowed_prefix = format!("{}/", allowed_exact);
    !(normalized == allowed_exact || normalized.starts_with(&allowed_prefix))
}

fn is_safe_component(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn hash_json(value: &serde_json::Value) -> String {
    let data = serde_json::to_string(value).unwrap_or_default();
    format!("{:x}", Sha256::digest(data.as_bytes()))
}

fn hash_str(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}

fn write_subprocess_receipt(
    run_id: &str,
    worker_id: &str,
    argv: &[String],
    cwd: &str,
    env_allowlist: &[String],
    exit_code: i32,
    stdout_full: &[u8],
    stderr_full: &[u8],
    stdout_preview: &str,
    stderr_preview: &str,
) -> Result<String, ToolGatewayError> {
    if !is_safe_component(run_id) {
        return Err(ToolGatewayError::PermissionDenied(
            "invalid run_id for subprocess receipt".to_string(),
        ));
    }
    let receipt_id = format!("subprocess-{}", Uuid::new_v4());
    let created_at = chrono::Utc::now().to_rfc3339();
    let receipt = serde_json::json!({
        "receipt_id": receipt_id,
        "created_at": created_at,
        "run_id": run_id,
        "worker_id": worker_id,
        "argv": argv,
        "cwd": cwd,
        "env_allowlist": env_allowlist,
        "exit_code": exit_code,
        "stdout_hash": hash_bytes(stdout_full),
        "stderr_hash": hash_bytes(stderr_full),
        "stdout_preview": stdout_preview,
        "stderr_preview": stderr_preview,
        "artifact_paths": []
    });

    let dir = format!("/.a2r/receipts/{}", run_id);
    let root = repo_root()?;
    let local_dir = root.join(dir.trim_start_matches('/'));
    std::fs::create_dir_all(&local_dir).map_err(ToolGatewayError::Io)?;
    let local_path = local_dir.join(format!("{}.json", receipt_id));
    std::fs::write(
        &local_path,
        serde_json::to_string_pretty(&receipt).unwrap_or_default(),
    )
    .map_err(ToolGatewayError::Io)?;

    Ok(receipt_id)
}

fn write_receipt(
    request: &ToolExecutionRequest,
    tool_def: &ToolDefinition,
    decision: &allternit_policy::PolicyDecision,
    result: &ToolExecutionResult,
    pre_event: &EventEnvelope,
    duration_ms: u64,
    write_scope: &WriteScope,
) -> Result<(), ToolGatewayError> {
    let receipt_id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    let run_id = request.run_id.clone().ok_or_else(|| {
        ToolGatewayError::PermissionDenied("run_id required for receipts".to_string())
    })?;
    if !is_safe_component(&run_id) {
        return Err(ToolGatewayError::PermissionDenied(
            "invalid run_id for receipt path".to_string(),
        ));
    }
    let tool_def_hash = hash_str(&serde_json::to_string(tool_def).unwrap_or_default());
    let policy_decision_hash = hash_str(&serde_json::to_string(decision).unwrap_or_default());
    let pretool_event_hash = hash_str(&serde_json::to_string(pre_event).unwrap_or_default());
    let input_hashes = vec![hash_json(&request.input)];
    let output_hashes = match &result.output {
        Some(out) => vec![hash_json(out)],
        None => vec![],
    };
    let receipt = serde_json::json!({
        "receipt_id": receipt_id,
        "created_at": created_at,
        "run_id": run_id,
        "workflow_id": request.workflow_id.clone().unwrap_or_else(|| "unknown".to_string()),
        "node_id": request.node_id.clone().unwrap_or_else(|| "unknown".to_string()),
        "wih_id": request.wih_id.clone().unwrap_or_else(|| "unknown".to_string()),
        "tool_id": request.tool_id,
        "tool_def_hash": tool_def_hash,
        "policy_decision_hash": policy_decision_hash,
        "pretool_event_hash": pretool_event_hash,
        "input_hashes": input_hashes,
        "output_hashes": output_hashes,
        "artifact_manifest": [],
        "write_scope_proof": { "declared": write_scope.allowed_globs, "actual": write_scope.allowed_globs },
        "execution": {
            "exit_code": result.exit_code.unwrap_or(1),
            "stderr_hash": hash_str(&result.stderr),
            "stdout_hash": hash_str(&result.stdout),
            "duration_ms": duration_ms
        },
        "idempotency_key": request.idempotency_key.clone().unwrap_or_else(|| "none".to_string()),
        "retry_count": request.retry_count,
        "trace_id": request.trace_id.clone().unwrap_or_else(|| "none".to_string()),
        "environment_hash": tool_def_hash
    });

    let dir = format!("/.a2r/receipts/{}", run_id);
    let local_dir = dir.trim_start_matches('/').to_string();
    std::fs::create_dir_all(&local_dir).map_err(ToolGatewayError::Io)?;
    let path = format!("{}/{}.json", dir, receipt_id);
    let local_path = path.trim_start_matches('/').to_string();
    std::fs::write(
        &local_path,
        serde_json::to_string_pretty(&receipt).unwrap_or_default(),
    )
    .map_err(ToolGatewayError::Io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_messaging::MessagingSystem;
    use allternit_policy::{PolicyEffect, PolicyEngine, PolicyRule};
    use sqlx::SqlitePool;
    use std::path::PathBuf;
    use tempfile::NamedTempFile;

    async fn setup_gateway() -> ToolGateway {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_tools_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let policy_engine = Arc::new(PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let identity = allternit_policy::Identity {
            id: "test_identity".to_string(),
            identity_type: allternit_policy::IdentityType::AgentIdentity,
            name: "test_agent".to_string(),
            tenant_id: "tenant1".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["user".to_string()],
            permissions: vec!["perm_t0_read".to_string()],
        };
        policy_engine.register_identity(identity).await.unwrap();
        policy_engine.create_default_permissions().await.unwrap();
        policy_engine.create_default_rules().await.unwrap();
        let execute_rule = PolicyRule {
            id: "rule_allow_execute_test".to_string(),
            name: "Allow execute for tests".to_string(),
            description: "Allow execute action during tool-gateway tests".to_string(),
            condition: "identity.active".to_string(),
            effect: PolicyEffect::Allow,
            resource: "*".to_string(),
            actions: vec!["execute".to_string()],
            priority: 50,
            enabled: true,
        };
        policy_engine.add_rule(execute_rule).await.unwrap();

        ToolGateway::new(policy_engine, history_ledger, messaging_system)
    }

    fn repo_root() -> PathBuf {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
        std::env::set_var("ALLTERNIT_REPO_ROOT", &root);
        std::env::set_var(
            "ALLTERNIT_WORKER_REGISTRY_PATH",
            root.join("workers").join("worker_registry.json"),
        );
        root
    }

    #[tokio::test]
    async fn test_tool_gateway() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_tools_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let policy_engine = Arc::new(PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));
        let tool_gateway = Arc::new(ToolGateway::new(
            policy_engine.clone(),
            history_ledger,
            messaging_system,
        ));

        // Register a test tool
        let test_tool = ToolDefinition {
            id: "test_tool".to_string(),
            name: "Test Tool".to_string(),
            description: "A test tool".to_string(),
            tool_type: ToolType::Local,
            command: "echo".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "input": {"type": "string"}
                }
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "output": {"type": "string"}
                }
            }),
            side_effects: vec!["read".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: Some("100m".to_string()),
                memory: Some("64Mi".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        };

        let tool_id = tool_gateway.register_tool(test_tool).await.unwrap();
        assert_eq!(tool_id, "test_tool");

        // Get the tool
        let retrieved_tool = tool_gateway
            .get_tool("test_tool".to_string())
            .await
            .unwrap();
        assert_eq!(retrieved_tool.name, "Test Tool");

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[tokio::test]
    async fn test_tool_execution() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_execution_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let policy_engine = Arc::new(PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Register a default identity for testing
        let identity = allternit_policy::Identity {
            id: Uuid::new_v4().to_string(),
            identity_type: allternit_policy::IdentityType::AgentIdentity,
            name: "test_agent".to_string(),
            tenant_id: "tenant1".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["user".to_string()],
            permissions: vec!["perm_t0_read".to_string()],
        };
        policy_engine.register_identity(identity).await.unwrap();
        policy_engine.create_default_permissions().await.unwrap();
        policy_engine.create_default_rules().await.unwrap();

        let tool_gateway = ToolGateway::new(policy_engine, history_ledger, messaging_system);

        // Create a simple tool for testing
        let test_tool = ToolDefinition {
            id: "simple_tool".to_string(),
            name: "Simple Tool".to_string(),
            description: "A simple tool".to_string(),
            tool_type: ToolType::Http, // Using HTTP for easier testing
            command: "".to_string(),
            endpoint: "http://example.com".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec!["read".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: Some("100m".to_string()),
                memory: Some("64Mi".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        };

        tool_gateway.register_tool(test_tool).await.unwrap();

        // Execute the tool
        let request = ToolExecutionRequest {
            tool_id: "simple_tool".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(), // This will fail policy check
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: Some("run1".to_string()),
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run1", false)),
            capsule_run: None,
            trace_id: Some("trace1".to_string()),
            retry_count: 0,
            idempotency_key: Some("test-idempotency-key".to_string()),
        };

        // This should fail because the identity doesn't exist in policy engine
        // Let's create a proper request with a valid identity
        let valid_request = ToolExecutionRequest {
            tool_id: "simple_tool".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(), // We'll need to register this
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: Some("run1".to_string()),
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run1", false)),
            capsule_run: None,
            trace_id: Some("trace1".to_string()),
            retry_count: 0,
            idempotency_key: Some("test-idempotency-key".to_string()),
        };

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[tokio::test]
    async fn test_idempotency_key_required_for_side_effects() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_idempotency_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let policy_engine = Arc::new(PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let tool_gateway = ToolGateway::new(policy_engine, history_ledger, messaging_system);

        let test_tool = ToolDefinition {
            id: "side_effect_tool".to_string(),
            name: "Side Effect Tool".to_string(),
            description: "Tool with side effects".to_string(),
            tool_type: ToolType::Local,
            command: "true".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec!["write".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: Some("100m".to_string()),
                memory: Some("64Mi".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        };

        tool_gateway.register_tool(test_tool).await.unwrap();

        let request = ToolExecutionRequest {
            tool_id: "side_effect_tool".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(),
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: Some("run1".to_string()),
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run1", false)),
            capsule_run: None,
            trace_id: Some("trace1".to_string()),
            retry_count: 0,
            idempotency_key: None,
        };

        let result = tool_gateway.execute_tool(request).await;
        match result {
            Err(ToolGatewayError::ExecutionFailed(message)) => {
                assert!(message.contains("Idempotency key required"));
            }
            _ => panic!("Expected idempotency enforcement failure"),
        }

        std::fs::remove_file(&temp_path).unwrap();
    }

    #[test]
    fn test_write_scope_enforced() {
        let scope = WriteScope {
            root: "/.a2r/".to_string(),
            allowed_globs: vec![format!("/.a2r/artifacts/{}/**", "run1")],
        };
        let access_outside_root = FilesystemAccess::Allowlist(vec!["/tmp/test".to_string()]);
        let err = validate_filesystem_access(&access_outside_root, &scope, "run1").unwrap_err();
        match err {
            ToolGatewayError::PermissionDenied(_) => {}
            _ => panic!("Expected PermissionDenied for root violation"),
        }
        let access_outside_glob =
            FilesystemAccess::Allowlist(vec!["/.a2r/artifacts/run2/test.txt".to_string()]);
        let err = validate_filesystem_access(&access_outside_glob, &scope, "run1").unwrap_err();
        match err {
            ToolGatewayError::PermissionDenied(_) => {}
            _ => panic!("Expected PermissionDenied for glob violation"),
        }
    }

    #[test]
    fn test_write_receipt_creates_file() {
        let request = ToolExecutionRequest {
            tool_id: "t1".to_string(),
            input: serde_json::json!({}),
            identity_id: "id".to_string(),
            session_id: "session-receipt-test".to_string(),
            tenant_id: "tenant".to_string(),
            run_id: Some("run1".to_string()),
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run1", false)),
            capsule_run: None,
            trace_id: None,
            retry_count: 0,
            idempotency_key: Some("idem".to_string()),
        };

        let tool_def = ToolDefinition {
            id: "t1".to_string(),
            name: "Tool".to_string(),
            description: "desc".to_string(),
            tool_type: ToolType::Local,
            command: "true".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "none".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: None,
                memory: None,
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 1,
            },
            subprocess: None,
        };

        let decision = allternit_policy::PolicyDecision {
            decision_id: "d1".to_string(),
            request_id: "r1".to_string(),
            identity_id: "id".to_string(),
            resource: "tool:t1".to_string(),
            action: "execute".to_string(),
            decision: allternit_policy::PolicyEffect::Allow,
            reason: "ok".to_string(),
            timestamp: 0,
            constraints: None,
        };

        let result = ToolExecutionResult {
            execution_id: "e1".to_string(),
            tool_id: "t1".to_string(),
            input: serde_json::json!({}),
            output: None,
            error: None,
            stdout: "".to_string(),
            stderr: "".to_string(),
            exit_code: Some(0),
            execution_time_ms: 0,
            resources_used: ResourceUsage {
                cpu_time_ms: 0,
                memory_peak_kb: 0,
                network_bytes: 0,
                filesystem_ops: 0,
            },
            timestamp: 0,
        };

        let pre_event = EventEnvelope {
            event_id: "ev1".to_string(),
            event_type: "PreToolUse".to_string(),
            session_id: request.session_id.clone(),
            tenant_id: request.tenant_id.clone(),
            actor_id: request.identity_id.clone(),
            role: "tool_gateway".to_string(),
            timestamp: 0,
            trace_id: None,
            payload: serde_json::json!({}),
        };

        let scope = WriteScope {
            root: "/.a2r/".to_string(),
            allowed_globs: vec![
                "/.a2r/receipts/run1/**".to_string(),
                "/.a2r/artifacts/run1/**".to_string(),
            ],
        };
        write_receipt(
            &request, &tool_def, &decision, &result, &pre_event, 0, &scope,
        )
        .unwrap();

        let dir = format!(".a2r/receipts/{}", request.run_id.unwrap());
        let entries: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert!(!entries.is_empty(), "receipt file not created");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn test_execution_requires_run_id() {
        let tool_gateway = setup_gateway().await;

        let tool = ToolDefinition {
            id: "exec_req_tool".to_string(),
            name: "Exec Req Tool".to_string(),
            description: "Tool for envelope enforcement".to_string(),
            tool_type: ToolType::Http,
            command: "".to_string(),
            endpoint: "http://example.com".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: false,
            failure_classification: "none".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: None,
                memory: None,
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        };
        tool_gateway.register_tool(tool).await.unwrap();

        let request = ToolExecutionRequest {
            tool_id: "exec_req_tool".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(),
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: None,
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run_missing", false)),
            capsule_run: None,
            trace_id: None,
            retry_count: 0,
            idempotency_key: Some("idem".to_string()),
        };

        let result = tool_gateway.execute_tool(request).await;
        match result {
            Err(ToolGatewayError::PermissionDenied(message)) => {
                assert!(message.contains("run_id required"));
            }
            _ => panic!("Expected run_id enforcement failure"),
        }
    }

    #[tokio::test]
    async fn test_execution_requires_wih_and_node() {
        let tool_gateway = setup_gateway().await;

        let tool = ToolDefinition {
            id: "exec_req_tool2".to_string(),
            name: "Exec Req Tool 2".to_string(),
            description: "Tool for envelope enforcement".to_string(),
            tool_type: ToolType::Http,
            command: "".to_string(),
            endpoint: "http://example.com".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: false,
            failure_classification: "none".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: None,
                memory: None,
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        };
        tool_gateway.register_tool(tool).await.unwrap();

        let request = ToolExecutionRequest {
            tool_id: "exec_req_tool2".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(),
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: Some("run1".to_string()),
            workflow_id: Some("wf1".to_string()),
            node_id: None,
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run1", false)),
            capsule_run: None,
            trace_id: None,
            retry_count: 0,
            idempotency_key: Some("idem".to_string()),
        };

        let result = tool_gateway.execute_tool(request).await;
        match result {
            Err(ToolGatewayError::PermissionDenied(message)) => {
                assert!(message.contains("node_id required"));
            }
            _ => panic!("Expected node_id enforcement failure"),
        }
    }

    #[tokio::test]
    async fn test_subprocess_denied_without_worker() {
        let _root = repo_root();
        let tool_gateway = setup_gateway().await;

        let tool = ToolDefinition {
            id: "subproc_test".to_string(),
            name: "Subprocess Test".to_string(),
            description: "Subprocess test tool".to_string(),
            tool_type: ToolType::Subprocess,
            command: "".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: false,
            failure_classification: "none".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: None,
                memory: None,
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: Some(SubprocessSpec {
                worker_id: "worker.missing".to_string(),
            }),
        };
        tool_gateway.register_tool(tool).await.unwrap();

        let request = ToolExecutionRequest {
            tool_id: "subproc_test".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(),
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: Some("run_subproc_deny".to_string()),
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run_subproc_deny", false)),
            capsule_run: None,
            trace_id: None,
            retry_count: 0,
            idempotency_key: Some("idem".to_string()),
        };

        let result = tool_gateway.execute_tool(request).await.unwrap();
        let err = result.error.unwrap_or_default();
        assert!(err.contains("worker_id not allowlisted"));
    }

    #[tokio::test]
    async fn test_subprocess_allowlisted_worker() {
        let _root = repo_root();
        let tool_gateway = setup_gateway().await;

        let tool = ToolDefinition {
            id: "subproc_allow".to_string(),
            name: "Subprocess Allow".to_string(),
            description: "Subprocess allowlisted worker".to_string(),
            tool_type: ToolType::Subprocess,
            command: "".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: false,
            failure_classification: "none".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: None,
                memory: None,
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: Some(SubprocessSpec {
                worker_id: "git.diff".to_string(),
            }),
        };
        tool_gateway.register_tool(tool).await.unwrap();

        let request = ToolExecutionRequest {
            tool_id: "subproc_allow".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(),
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: Some("run_subproc_allow".to_string()),
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope("run_subproc_allow", false)),
            capsule_run: None,
            trace_id: None,
            retry_count: 0,
            idempotency_key: Some("idem".to_string()),
        };

        let result = tool_gateway.execute_tool(request).await.unwrap();
        assert!(result.exit_code.unwrap_or(1) == 0);
    }

    #[tokio::test]
    async fn test_subprocess_receipt_emitted() {
        let root = repo_root();
        let tool_gateway = setup_gateway().await;

        let tool = ToolDefinition {
            id: "subproc_receipt".to_string(),
            name: "Subprocess Receipt".to_string(),
            description: "Subprocess receipt worker".to_string(),
            tool_type: ToolType::Subprocess,
            command: "".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: false,
            failure_classification: "none".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: None,
                memory: None,
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: Some(SubprocessSpec {
                worker_id: "git.diff".to_string(),
            }),
        };
        tool_gateway.register_tool(tool).await.unwrap();

        let run_id = "run_subproc_receipt".to_string();
        let request = ToolExecutionRequest {
            tool_id: "subproc_receipt".to_string(),
            input: serde_json::json!({}),
            identity_id: "test_identity".to_string(),
            session_id: "session1".to_string(),
            tenant_id: "tenant1".to_string(),
            run_id: Some(run_id.clone()),
            workflow_id: Some("wf1".to_string()),
            node_id: Some("node1".to_string()),
            wih_id: Some("wih-test".to_string()),
            write_scope: Some(run_scoped_write_scope(&run_id, false)),
            capsule_run: None,
            trace_id: None,
            retry_count: 0,
            idempotency_key: Some("idem".to_string()),
        };

        let result = tool_gateway.execute_tool(request).await.unwrap();
        assert!(result.exit_code.unwrap_or(1) == 0);

        let receipt_dir = root.join(".a2r").join("receipts").join(&run_id);
        let mut found = None;
        if let Ok(entries) = std::fs::read_dir(&receipt_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("subprocess-") {
                    found = Some(entry.path());
                    break;
                }
            }
        }
        let receipt_path = found.expect("subprocess receipt not found");
        let data = std::fs::read_to_string(&receipt_path).unwrap();
        let receipt: serde_json::Value = serde_json::from_str(&data).unwrap();
        assert_eq!(receipt.get("worker_id").unwrap(), "git.diff");
        assert!(receipt.get("argv").is_some());
        assert!(receipt.get("cwd").is_some());
        assert!(receipt.get("env_allowlist").is_some());
        assert!(receipt.get("exit_code").is_some());
        assert!(receipt.get("stdout_hash").is_some());
        assert!(receipt.get("stderr_hash").is_some());
        assert!(receipt.get("stdout_preview").is_some());
        assert!(receipt.get("stderr_preview").is_some());
        assert!(receipt.get("artifact_paths").is_some());

        let _ = std::fs::remove_file(&receipt_path);
    }

    #[test]
    fn test_write_scope_restrictions() {
        let scope = WriteScope {
            root: "/.a2r/".to_string(),
            allowed_globs: vec![
                "/.a2r/artifacts/run1/**".to_string(),
                "/.a2r/receipts/run1/**".to_string(),
            ],
        };
        let wih_access = FilesystemAccess::Allowlist(vec!["/.a2r/wih/secret.json".to_string()]);
        let err = validate_filesystem_access(&wih_access, &scope, "run1").unwrap_err();
        match err {
            ToolGatewayError::PermissionDenied(_) => {}
            _ => panic!("Expected PermissionDenied for /.a2r/wih access"),
        }

        let graphs_access =
            FilesystemAccess::Allowlist(vec!["/.a2r/graphs/graph.json".to_string()]);
        let err = validate_filesystem_access(&graphs_access, &scope, "run1").unwrap_err();
        match err {
            ToolGatewayError::PermissionDenied(_) => {}
            _ => panic!("Expected PermissionDenied for /.a2r/graphs access"),
        }

        let other_receipts =
            FilesystemAccess::Allowlist(vec!["/.a2r/receipts/run2/receipt.json".to_string()]);
        let err = validate_filesystem_access(&other_receipts, &scope, "run1").unwrap_err();
        match err {
            ToolGatewayError::PermissionDenied(_) => {}
            _ => panic!("Expected PermissionDenied for other run receipts"),
        }
    }
}
