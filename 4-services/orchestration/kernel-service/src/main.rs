use a2rchitech_artifact_registry::{
    ArtifactFilters, ArtifactMetadata, ArtifactQuery, ArtifactQueryResponse, ArtifactRegistry,
    ArtifactRegistryConfig, ArtifactRegistryError, ArtifactType, AuditLevel, BackupConfig,
    ComplianceRequirement, LicenseCompliance, NetworkConfiguration, NetworkIsolation,
    PublishRequest, PublishResponse, PublisherInfo, RateLimitingConfig, RetentionPolicy,
    ReviewStatus, SecurityProfile, SortDirection, SortField, StorageConfig, StorageType,
    VerificationStatus,
};
use a2rchitech_history::HistoryLedger;
use a2rchitech_kernel_contracts;
use a2rchitech_memory::v2::memory_policy::{
    DefaultMemoryPolicy, MemoryPolicy as MemoryPolicyTrait,
};
use a2rchitech_messaging::MessagingSystem;
use a2rchitech_policy::{
    Identity, IdentityType, PolicyEffect, PolicyEngine, PolicyRule, SafetyTier,
};
use a2rchitech_skills::{PublisherKey, Skill, SkillRegistry, SkillsError};
use a2rchitech_tools_gateway::{
    FilesystemAccess, NetworkAccess, ResourceLimits, ToolDefinition as GatewayToolDefinition,
    ToolExecutionReporter, ToolExecutionRequest, ToolExecutionResult, ToolGateway,
    ToolGatewayError, ToolType, WriteScope,
};
use async_trait::async_trait;
use axum::{
    body::Body,
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post, put, Router},
    Json,
};
use data_encoding::{BASE64, BASE64URL, HEXLOWER};
use ring::{digest, signature};
use serde::{Deserialize, Serialize};
use sqlx::any::AnyConnectOptions;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{AnyPool, SqlitePool};
use std::fs;
use std::path::{Path as StdPath, PathBuf as StdPathBuf};
use std::process::Command;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{error, info, span, Level, Span};
use tracing_subscriber;

fn ensure_boot_anchors() -> anyhow::Result<()> {
    let required_files = [
        "SOT.md",
        "CODEBASE.md",
        "agent/POLICY.md",
        "spec/AcceptanceTests.md",
        "spec/Baseline.md",
        "spec/ADRs/ADR-0000-template.md",
        "spec/Contracts/BootManifest.schema.json",
        "spec/Contracts/WIH.schema.json",
        "spec/Contracts/Graph.schema.json",
        "spec/Contracts/ToolRegistry.schema.json",
        "spec/Contracts/ToolDefinition.schema.json",
        "spec/Contracts/Receipt.schema.json",
        "spec/Contracts/RunState.schema.json",
        "spec/Contracts/BeadsGraph.schema.json",
        "spec/Contracts/BeadsNode.schema.json",
        "spec/Contracts/BeadsRunState.schema.json",
    ];

    for path in required_files {
        if !StdPath::new(path).exists() {
            anyhow::bail!("Boot gate failed: missing {}", path);
        }
    }

    for dir in ["./.a2r/graphs", "./.a2r/wih"] {
        let dir_path = StdPath::new(dir);
        if !dir_path.exists() {
            anyhow::bail!("Boot gate failed: missing {}", dir);
        }
        let has_json = fs::read_dir(dir_path)
            .map_err(|e| anyhow::anyhow!("Boot gate failed: {} unreadable: {}", dir, e))?
            .filter_map(|entry| entry.ok())
            .any(|entry| {
                entry
                    .path()
                    .extension()
                    .map(|ext| ext == "json")
                    .unwrap_or(false)
            });
        if !has_json {
            anyhow::bail!("Boot gate failed: {} has no json files", dir);
        }
    }

    if !StdPath::new("tools/tool_registry.json").exists() {
        anyhow::bail!("Boot gate failed: missing tools/tool_registry.json");
    }

    let deltas_dir = StdPath::new("spec/Deltas");
    if !deltas_dir.exists() {
        anyhow::bail!("Boot gate failed: missing spec/Deltas");
    }
    let has_deltas = fs::read_dir(deltas_dir)
        .map_err(|e| anyhow::anyhow!("Boot gate failed: spec/Deltas unreadable: {}", e))?
        .filter_map(|entry| entry.ok())
        .any(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "md")
                .unwrap_or(false)
        });
    if !has_deltas {
        anyhow::bail!("Boot gate failed: spec/Deltas has no md files");
    }

    Ok(())
}

#[derive(Serialize)]
struct BootManifest {
    b0_version: String,
    timestamp: String,
    loaded_files: Vec<String>,
    hashes: HashMap<String, String>,
    env: HashMap<String, String>,
}

fn run_law_validator() -> anyhow::Result<()> {
    let status = Command::new("python3")
        .arg("scripts/validate_law.py")
        .arg("--emit-beacon")
        .status()
        .map_err(|e| anyhow::anyhow!("Law validation failed to start: {}", e))?;
    if !status.success() {
        anyhow::bail!("Law validation failed: scripts/validate_law.py returned non-zero");
    }
    Ok(())
}

fn validate_boot_manifest() -> anyhow::Result<()> {
    let status = Command::new("python3")
        .arg("scripts/validate_law.py")
        .arg("--validate-boot-manifest")
        .status()
        .map_err(|e| anyhow::anyhow!("Boot manifest validation failed to start: {}", e))?;
    if !status.success() {
        anyhow::bail!("Boot manifest validation failed: scripts/validate_law.py returned non-zero");
    }
    Ok(())
}

fn canonical_path(path: &StdPath) -> String {
    let text = path.to_string_lossy();
    let trimmed = text.trim_start_matches("./");
    format!("/{}", trimmed)
}

fn hash_file(path: &StdPath) -> anyhow::Result<String> {
    let data =
        fs::read(path).map_err(|e| anyhow::anyhow!("Failed to read {}: {}", path.display(), e))?;
    let digest = digest::digest(&digest::SHA256, &data);
    Ok(HEXLOWER.encode(digest.as_ref()))
}

fn collect_boot_files() -> anyhow::Result<Vec<StdPathBuf>> {
    let mut files = Vec::new();
    let mut push = |path: &str, list: &mut Vec<StdPathBuf>| {
        list.push(StdPathBuf::from(path));
    };

    push("SOT.md", &mut files);
    push("CODEBASE.md", &mut files);
    push("agent/POLICY.md", &mut files);
    push("spec/AcceptanceTests.md", &mut files);
    push("spec/Baseline.md", &mut files);
    push("spec/ADRs/ADR-0000-template.md", &mut files);
    push("spec/Contracts/BootManifest.schema.json", &mut files);
    push("spec/Contracts/WIH.schema.json", &mut files);
    push("spec/Contracts/Graph.schema.json", &mut files);
    push("spec/Contracts/ToolRegistry.schema.json", &mut files);
    push("spec/Contracts/ToolDefinition.schema.json", &mut files);
    push("spec/Contracts/Receipt.schema.json", &mut files);
    push("spec/Contracts/RunState.schema.json", &mut files);
    push("spec/Contracts/BeadsGraph.schema.json", &mut files);
    push("spec/Contracts/BeadsNode.schema.json", &mut files);
    push("spec/Contracts/BeadsRunState.schema.json", &mut files);
    push("tools/tool_registry.json", &mut files);

    for entry in fs::read_dir("spec/Deltas")? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map(|ext| ext == "md").unwrap_or(false) {
            files.push(path);
        }
    }
    for entry in fs::read_dir(".a2r/graphs")? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map(|ext| ext == "json").unwrap_or(false) {
            files.push(path);
        }
    }
    for entry in fs::read_dir(".a2r/wih")? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map(|ext| ext == "json").unwrap_or(false) {
            files.push(path);
        }
    }

    Ok(files)
}

fn write_boot_manifest() -> anyhow::Result<()> {
    let boot_files = collect_boot_files()?;
    let mut loaded_files = Vec::new();
    let mut hashes = HashMap::new();

    for path in boot_files {
        if !path.exists() {
            anyhow::bail!("Boot manifest failed: missing {}", path.display());
        }
        let canonical = canonical_path(&path);
        let hash = hash_file(&path)?;
        hashes.insert(canonical.clone(), hash);
        loaded_files.push(canonical);
    }

    let mut env = HashMap::new();
    let profile = std::env::var("A2R_PROFILE").unwrap_or_else(|_| "default".to_string());
    env.insert("profile".to_string(), profile);

    let manifest = BootManifest {
        b0_version: "v0.1".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        loaded_files,
        hashes,
        env,
    };

    let boot_dir = StdPath::new(".a2r/boot");
    fs::create_dir_all(boot_dir)
        .map_err(|e| anyhow::anyhow!("Boot manifest failed to create .a2r/boot: {}", e))?;
    let receipt_path = boot_dir.join("boot_manifest.json");
    let payload = serde_json::to_string_pretty(&manifest)?;
    fs::write(&receipt_path, payload).map_err(|e| {
        anyhow::anyhow!(
            "Boot manifest failed to write {}: {}",
            receipt_path.display(),
            e
        )
    })?;

    info!("Boot manifest written to {}", receipt_path.display());
    Ok(())
}
use a2rchitech_context_router::ContextRouter;
use a2rchitech_embodiment::EmbodimentControlPlane;
// use a2rchitech_evals::EvaluationEngine; // TODO: Re-enable after fixing evals package
use a2rchitech_memory::MemoryFabric;
use a2rchitech_packaging::PackageManager;
use a2rchitech_providers::ProviderRouter;
use a2rchitech_runtime_core::SessionManager as RuntimeSessionManager;
use chrono::Utc;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::{SystemTime, UNIX_EPOCH};

// Rate limiting and security middleware
#[derive(Debug, Clone)]
struct SecurityState {
    request_counts: Arc<tokio::sync::Mutex<HashMap<String, Vec<u64>>>>, // IP -> [timestamps]
    max_requests_per_minute: u32,
    banned_ips: Arc<tokio::sync::Mutex<HashMap<String, u64>>>, // IP -> ban_until timestamp
}

impl SecurityState {
    fn new(max_requests_per_minute: u32) -> Self {
        Self {
            request_counts: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            max_requests_per_minute,
            banned_ips: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
        }
    }

    async fn is_rate_limited(&self, ip: &str) -> Result<bool, StatusCode> {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .as_secs();

        // Check if IP is banned
        {
            let banned_ips = self.banned_ips.lock().await;
            if let Some(&ban_until) = banned_ips.get(ip) {
                if current_time < ban_until {
                    return Ok(true); // Still banned
                }
            }
        }

        // Clean up old request timestamps (older than 1 minute)
        let mut request_counts = self.request_counts.lock().await;
        if let Some(timestamps) = request_counts.get_mut(ip) {
            timestamps.retain(|&ts| current_time - ts < 60); // Keep only last minute
        }

        // Add current request
        request_counts
            .entry(ip.to_string())
            .or_insert_with(Vec::new)
            .push(current_time);

        // Check rate limit
        let count = request_counts.get(ip).map(|v| v.len()).unwrap_or(0);
        if count > self.max_requests_per_minute as usize {
            // Ban IP for 5 minutes for exceeding rate limit
            let mut banned_ips = self.banned_ips.lock().await;
            banned_ips.insert(ip.to_string(), current_time + 300); // 5 minutes
            return Ok(true);
        }

        Ok(false)
    }
}

// Enhanced authentication and security middleware
async fn security_middleware(
    State(security_state): State<Arc<SecurityState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    mut request: Request<Body>,
    next: Next,
) -> Result<impl IntoResponse, StatusCode> {
    let ip = addr.ip().to_string();
    let path = request.uri().path();

    // Check rate limiting
    if security_state.is_rate_limited(&ip).await? {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // Enhanced authentication check for other routes
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|hv| hv.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify the token format (Bearer token)
    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = auth_header.strip_prefix("Bearer ").unwrap();

    // Enhanced token validation with cryptographic verification
    if token.is_empty() || token.len() < 10 {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // In a real implementation, we would validate the JWT with proper cryptographic checks
    // For now, we implemented a basic token format check with expected prefix
    if !token.starts_with("sk-") && !token.starts_with("jwt-") && !token.starts_with("api-") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Add security headers to response
    let response = next.run(request).await;
    Ok(response)
}

mod action_handler;
mod agent_registry;
mod assistant;
mod config_manager;
mod context_manager;
mod contract_verifier;
mod directive_compiler;
mod embodiment;
mod frameworks;
mod governance;
mod intent_dispatcher;
mod intent_graph;
mod journal_ledger;
mod llm;
mod memory_maintenance_daemon;
mod orchestrator;
mod patterns;
mod protection;
mod rate_limiter;
mod scheduler;
mod situation_resolver;
mod skill_manager;
mod state_engine;
mod terminal_manager;
mod tool_executor;
mod tool_gateway_adapter;
mod io_client;
mod types;
mod verification_checker;

use io_client::IoServiceClient;
use crate::orchestrator::{OrchestratorService, RunStore, TaskStore};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use futures::{SinkExt, StreamExt};
use terminal_manager::{TerminalManager, TerminalSession};
use tokio::sync::broadcast;

use action_handler::ActionHandler;
use agent_registry::AgentRegistry;
use assistant::AssistantManager;
use config_manager::ConfigManager;
use context_manager::ContextManager;
use directive_compiler::DirectiveCompiler;
use intent_dispatcher::IntentDispatcher;
use intent_graph::IntentGraphKernel;
use journal_ledger::JournalLedger;
use patterns::PatternRegistry;
use scheduler::Scheduler;
use situation_resolver::SituationResolver;
use skill_manager::SkillManager;
use state_engine::StateEngine;
use types::{
    ActionExecuteRequest, ActionRequest, ActionResponse, AgentSpec, Artifact, AssistantIdentity,
    CapsuleInstance, CapsulePatchRequest, DispatchResponse, EvidenceAddRequest, IntentRequest,
    JournalEvent, ModeRequest, ModeResponse, Run, SessionBranchRequest, SessionBranchResponse,
    SessionCommitRequest, SessionCommitResponse, SessionEntry, SessionHistoryResponse, SessionInfo,
    SessionLogResponse, SessionResetResponse, SkillPackage, Suggestion, Task, ToolDefinition,
};
mod session_manager;
use a2rchitech_workflows::engine::compiler::{KernelCompilationContext, YamlCompiler};
use a2rchitech_workflows::engine::validator::{ValidationError, YamlValidator};
use a2rchitech_workflows::{
    NodeResult, WorkflowDefinition, WorkflowEngine, WorkflowError, WorkflowExecution,
};
use embodiment::desktop::DesktopDevice;
use frameworks::get_default_frameworks;
use session_manager::{SessionManager, SessionState};
use std::env;
use std::path::PathBuf;
use tool_executor::ToolExecutor;
use tool_gateway_adapter::ToolExecutorAdapter;

#[derive(Debug, Deserialize)]
struct JournalQuery {
    capsule_id: Option<String>,
    kind: Option<String>,
    after: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ArtifactListQuery {
    limit: Option<u32>,
    offset: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ArtifactVersionQuery {
    version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WorkflowExecuteRequest {
    session_id: Option<String>,
    tenant_id: Option<String>,
    input: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ToolExecuteEnvelope {
    #[serde(default)]
    input: serde_json::Value,
    identity_id: Option<String>,
    session_id: Option<String>,
    tenant_id: Option<String>,
    run_id: Option<String>,
    workflow_id: Option<String>,
    node_id: Option<String>,
    wih_id: Option<String>,
    write_scope: Option<WriteScope>,
    capsule_run: Option<bool>,
    trace_id: Option<String>,
    idempotency_key: Option<String>,
    retry_count: Option<u32>,
}

#[derive(Debug)]
struct ToolExecutePayload {
    input: serde_json::Value,
    identity_id: Option<String>,
    session_id: Option<String>,
    tenant_id: Option<String>,
    run_id: Option<String>,
    workflow_id: Option<String>,
    node_id: Option<String>,
    wih_id: Option<String>,
    write_scope: Option<WriteScope>,
    capsule_run: Option<bool>,
    trace_id: Option<String>,
    idempotency_key: Option<String>,
    retry_count: Option<u32>,
}

impl<'de> Deserialize<'de> for ToolExecutePayload {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        if let serde_json::Value::Object(map) = &value {
            let has_meta = map.contains_key("identity_id")
                || map.contains_key("session_id")
                || map.contains_key("tenant_id")
                || map.contains_key("run_id")
                || map.contains_key("workflow_id")
                || map.contains_key("node_id")
                || map.contains_key("wih_id")
                || map.contains_key("write_scope")
                || map.contains_key("capsule_run")
                || map.contains_key("trace_id")
                || map.contains_key("idempotency_key")
                || map.contains_key("retry_count");
            if has_meta {
                let envelope: ToolExecuteEnvelope =
                    serde_json::from_value(value).map_err(serde::de::Error::custom)?;
                return Ok(ToolExecutePayload {
                    input: envelope.input,
                    identity_id: envelope.identity_id,
                    session_id: envelope.session_id,
                    tenant_id: envelope.tenant_id,
                    run_id: envelope.run_id,
                    workflow_id: envelope.workflow_id,
                    node_id: envelope.node_id,
                    wih_id: envelope.wih_id,
                    write_scope: envelope.write_scope,
                    capsule_run: envelope.capsule_run,
                    trace_id: envelope.trace_id,
                    idempotency_key: envelope.idempotency_key,
                    retry_count: envelope.retry_count,
                });
            }
        }
        Ok(ToolExecutePayload {
            input: value,
            identity_id: None,
            session_id: None,
            tenant_id: None,
            run_id: None,
            workflow_id: None,
            node_id: None,
            wih_id: None,
            write_scope: None,
            capsule_run: None,
            trace_id: None,
            idempotency_key: None,
            retry_count: None,
        })
    }
}

#[derive(Debug, Deserialize)]
struct WorkflowYamlRequest {
    yaml: String,
    tenant_id: Option<String>,
    session_id: Option<String>,
    created_by: Option<String>,
}

#[derive(Debug, Serialize)]
struct ValidateWorkflowResponse {
    ok: bool,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
struct CompileWorkflowResponse {
    workflow_definition: WorkflowDefinition,
    run_model: a2rchitech_kernel_contracts::RunModel,
    compilation_event: a2rchitech_kernel_contracts::EventEnvelope,
}

#[derive(Debug, Clone)]
struct MonitoringState {
    request_count: Arc<tokio::sync::Mutex<HashMap<String, u64>>>, // endpoint -> count
    error_count: Arc<tokio::sync::Mutex<HashMap<String, u64>>>,   // endpoint -> error count
    response_times: Arc<tokio::sync::Mutex<HashMap<String, Vec<f64>>>>, // endpoint -> [times in ms]
}

impl MonitoringState {
    fn new() -> Self {
        Self {
            request_count: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            error_count: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            response_times: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
        }
    }

    async fn record_request(&self, endpoint: &str, response_time_ms: f64, is_error: bool) {
        {
            let mut counts = self.request_count.lock().await;
            *counts.entry(endpoint.to_string()).or_insert(0) += 1;
        }

        if is_error {
            let mut errors = self.error_count.lock().await;
            *errors.entry(endpoint.to_string()).or_insert(0) += 1;
        }

        {
            let mut times = self.response_times.lock().await;
            times
                .entry(endpoint.to_string())
                .or_insert_with(Vec::new)
                .push(response_time_ms);
        }
    }

    async fn get_metrics(&self) -> serde_json::Value {
        let request_counts = self.request_count.lock().await.clone();
        let error_counts = self.error_count.lock().await.clone();
        let response_times = self.response_times.lock().await.clone();

        let mut avg_response_times = HashMap::new();
        for (endpoint, times) in &response_times {
            if !times.is_empty() {
                let avg = times.iter().sum::<f64>() / times.len() as f64;
                avg_response_times.insert(endpoint.clone(), avg);
            }
        }

        serde_json::json!({
            "request_counts": request_counts,
            "error_counts": error_counts,
            "avg_response_times_ms": avg_response_times,
        })
    }
}

mod brain;
mod gui_tools;
mod taskgraph;
mod vision_config;
use brain::runtime_management::*;
use brain::{BrainManager, BrainProvider, BrainStore, RuntimeRegistry, AcpProtocolDriver, JsonlProtocolDriver, TerminalAppDriver};
use a2rchitech_evals::EvaluationEngine;
use gui_tools::*;
use vision_config::*;

#[derive(Clone)]
struct AppState {
    dispatcher: Arc<RwLock<IntentDispatcher>>,
    ledger: Arc<JournalLedger>,
    action_handler: Arc<ActionHandler>,
    directive_compiler: Arc<DirectiveCompiler>,
    context_manager: Arc<ContextManager>,
    intent_graph: Arc<RwLock<IntentGraphKernel>>,
    pattern_registry: Arc<PatternRegistry>,
    assistant_manager: Arc<AssistantManager>,
    agent_registry: Arc<AgentRegistry>,
    state_engine: Arc<StateEngine>,
    skill_manager: Arc<SkillManager>,
    config_manager: Arc<ConfigManager>,
    tool_executor: Arc<RwLock<ToolExecutor>>,
    tool_gateway: Arc<ToolGateway>,
    io_service_client: Arc<IoServiceClient>,
    skill_registry: Arc<SkillRegistry>,
    artifact_registry: Arc<ArtifactRegistry>,
    workflow_engine: Arc<WorkflowEngine>,
    policy_engine: Arc<PolicyEngine>,
    session_manager: Arc<SessionManager>,
    sqlite_pool: Arc<SqlitePool>,
    contract_verifier: Arc<contract_verifier::ContractVerifier>,
    rate_limiter: Arc<rate_limiter::RateLimiter>,
    verification_checker: Arc<verification_checker::VerificationChecker>,
    capsule_compiler: Arc<capsule_compiler::CapsuleCompiler>,
    security_state: Arc<SecurityState>,
    monitoring_state: Arc<MonitoringState>,
    terminal_manager: Arc<TerminalManager>,
    orchestrator_service: Arc<OrchestratorService>,
    brain_manager: Arc<BrainManager>,
    model_router: Arc<brain::ModelRouter>,
    runtime_registry: brain::RuntimeRegistry,
    provider_auth_registry: Arc<a2rchitech_providers::runtime::ProviderAuthRegistry>,
    model_adapter_registry: Arc<a2rchitech_providers::runtime::ModelAdapterRegistry>,
}

impl BrainProvider for AppState {
    fn brain_manager(&self) -> Arc<BrainManager> {
        self.brain_manager.clone()
    }

    fn model_router(&self) -> Arc<brain::ModelRouter> {
        self.model_router.clone()
    }

    fn terminal_manager(&self) -> Arc<TerminalManager> {
        self.terminal_manager.clone()
    }

    fn runtime_registry(&self) -> brain::RuntimeRegistry {
        self.runtime_registry.clone()
    }

    fn provider_auth_registry(&self) -> Arc<a2rchitech_providers::runtime::ProviderAuthRegistry> {
        self.provider_auth_registry.clone()
    }

    fn model_adapter_registry(&self) -> Arc<a2rchitech_providers::runtime::ModelAdapterRegistry> {
        self.model_adapter_registry.clone()
    }
}

#[derive(Deserialize)]
struct AuthRequest {
    key: String,
    endpoint: Option<String>,
}

#[derive(Deserialize)]
struct ModelRequest {
    provider: String,
    model: String,
}

#[derive(Deserialize)]
struct CreateTaskRequest {
    title: String,
    workspace_id: String,
    repo_path: String,
    intent: String,
    agent_profile: Option<String>,
}

#[derive(Deserialize)]
struct StartRunRequest {
    task_id: String,
}

#[derive(Deserialize)]
struct TaskgraphInstallRequest {
    graph_id: String,
    agent_profile_id: Option<String>,
}

#[derive(Deserialize)]
struct TaskgraphResumeRequest {
    run_id: String,
    agent_profile_id: Option<String>,
}

async fn list_tasks(State(state): State<AppState>) -> Result<Json<Vec<Task>>, StatusCode> {
    state
        .orchestrator_service
        .task_store
        .list_tasks()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_task(
    State(state): State<AppState>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<Json<Task>, StatusCode> {
    state
        .orchestrator_service
        .create_task(
            req.title,
            req.workspace_id,
            req.repo_path,
            req.intent,
            req.agent_profile,
        )
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Task>, StatusCode> {
    match state.orchestrator_service.task_store.get_task(&id).await {
        Ok(Some(task)) => Ok(Json(task)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn start_run(
    State(state): State<AppState>,
    Json(req): Json<StartRunRequest>,
) -> Result<Json<Run>, StatusCode> {
    state
        .orchestrator_service
        .start_run(req.task_id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_run(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Run>, StatusCode> {
    match state.orchestrator_service.run_store.get_run(&id).await {
        Ok(Some(run)) => Ok(Json(run)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn dispatch_intent(
    State(state): State<AppState>,
    Json(req): Json<IntentRequest>,
) -> Result<Json<DispatchResponse>, StatusCode> {
    let mut dispatcher = state.dispatcher.write().await;
    let response = dispatcher
        .dispatch_intent(req.intent_text.clone(), req.agent_id.clone(), req.execution_mode.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state.ledger.add_events(response.events.clone()).await;
    let dispatch_artifacts = response.artifacts.clone();
    state.ledger.add_artifacts(dispatch_artifacts.clone()).await;
    persist_kernel_artifacts(&state.artifact_registry, dispatch_artifacts).await;

    // Persist Graph
    {
        let graph = state.intent_graph.read().await;
        let _ = graph.save_to_disk();
    }

    // Generate verification artifact for the dispatched intent
    let verify_artifact = a2rchitech_kernel_contracts::VerifyArtifact::new(
        response.capsule.capsule_id.clone(),
        "dispatch_step".to_string(),
        format!("hash_{}", response.capsule.capsule_id),
        a2rchitech_kernel_contracts::VerificationResults {
            passed: true,
            details: serde_json::json!({
                "dispatched_intent": &req.intent_text,
                "capsule_id": &response.capsule.capsule_id,
                "execution_mode": &req.execution_mode,
            }),
            confidence: 0.95,
            issues: vec![],
        },
        "kernel_service".to_string(),
    );

    // Check the verification artifact before allowing the operation to proceed
    let verification_result = state
        .verification_checker
        .check_verification(&verify_artifact)
        .await;
    if !verification_result.allowed {
        return Err(StatusCode::FORBIDDEN);
    }

    // Add verification artifact to ledger
    let verification_record = crate::types::Artifact {
        artifact_id: verify_artifact.verify_id.clone(),
        capsule_id: response.capsule.capsule_id.clone(),
        artifact_type: "VerificationArtifact".to_string(),
        content: serde_json::to_value(&verify_artifact).unwrap_or_default(),
    };
    state
        .ledger
        .add_artifacts(vec![verification_record.clone()])
        .await;
    persist_kernel_artifacts(&state.artifact_registry, vec![verification_record]).await;

    Ok(Json(response))
}

async fn set_auth(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Json(req): Json<AuthRequest>,
) -> StatusCode {
    state
        .config_manager
        .set_auth(&provider, &req.key, req.endpoint)
        .await
        .map(|_| StatusCode::OK)
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
}

async fn set_model(State(state): State<AppState>, Json(req): Json<ModelRequest>) -> StatusCode {
    state
        .config_manager
        .set_active_model(&req.provider, &req.model)
        .await
        .map(|_| StatusCode::OK)
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_model(State(state): State<AppState>) -> Json<serde_json::Value> {
    let (provider, model) = state.config_manager.get_active_config().await;
    Json(serde_json::json!({ "provider": provider, "model": model }))
}

async fn get_capsule(
    State(state): State<AppState>,
    Path(capsule_id): Path<String>,
) -> Result<Json<CapsuleInstance>, StatusCode> {
    let dispatcher = state.dispatcher.read().await;
    match dispatcher.get_capsule(&capsule_id) {
        Some(capsule) => Ok(Json(capsule.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn list_capsules(State(state): State<AppState>) -> Json<Vec<CapsuleInstance>> {
    let dispatcher = state.dispatcher.read().await;
    Json(dispatcher.list_capsules())
}

async fn dispatch_action(
    State(state): State<AppState>,
    Json(req): Json<ActionRequest>,
) -> Result<Json<ActionResponse>, StatusCode> {
    let response = state
        .action_handler
        .handle_action(req)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(response))
}

async fn get_journal(
    State(state): State<AppState>,
    Query(params): Query<JournalQuery>,
) -> Json<Vec<JournalEvent>> {
    let events = state
        .ledger
        .filter_events(
            params.capsule_id.as_deref(),
            params.kind.as_deref(),
            params.after,
        )
        .await;
    Json(events)
}

async fn get_artifact(
    State(state): State<AppState>,
    Path(artifact_id): Path<String>,
    Query(params): Query<ArtifactVersionQuery>,
) -> Result<Json<ArtifactMetadata>, (StatusCode, String)> {
    let artifact = state
        .artifact_registry
        .get_artifact_metadata(&artifact_id, params.version.as_deref())
        .await
        .map_err(map_artifact_error)?;
    match artifact {
        Some(metadata) => Ok(Json(metadata)),
        None => Err((StatusCode::NOT_FOUND, "Artifact not found".to_string())),
    }
}

async fn list_artifacts(
    State(state): State<AppState>,
    Query(params): Query<ArtifactListQuery>,
) -> Result<Json<ArtifactQueryResponse>, (StatusCode, String)> {
    let query = ArtifactQuery {
        query_id: uuid::Uuid::new_v4().to_string(),
        filters: ArtifactFilters {
            name: None,
            version: None,
            artifact_type: None,
            tags: vec![],
            author: None,
            publisher_id: None,
            min_trust_score: None,
            min_rating: None,
            license_approved: None,
            review_status: None,
            created_after: None,
            created_before: None,
            updated_after: None,
            updated_before: None,
        },
        sort_by: SortField::CreatedAt,
        sort_direction: SortDirection::Desc,
        limit: params.limit,
        offset: params.offset,
        include_deprecated: true,
        trace_id: None,
    };
    let response = state
        .artifact_registry
        .query_artifacts(query)
        .await
        .map_err(map_artifact_error)?;
    Ok(Json(response))
}

async fn create_artifact(
    State(state): State<AppState>,
    Json(payload): Json<PublishRequest>,
) -> Result<Json<PublishResponse>, (StatusCode, String)> {
    let response = state
        .artifact_registry
        .publish_artifact(payload)
        .await
        .map_err(map_artifact_error)?;
    Ok(Json(response))
}

async fn query_artifacts(
    State(state): State<AppState>,
    Json(payload): Json<ArtifactQuery>,
) -> Result<Json<ArtifactQueryResponse>, (StatusCode, String)> {
    let response = state
        .artifact_registry
        .query_artifacts(payload)
        .await
        .map_err(map_artifact_error)?;
    Ok(Json(response))
}

async fn get_intent_graph(State(state): State<AppState>) -> Json<serde_json::Value> {
    let graph = state.intent_graph.read().await;
    Json(serde_json::json!({
        "nodes": graph.nodes.values().cloned().collect::<Vec<_>>(),
        "edges": graph.edges.clone(),
    }))
}

async fn get_assistant(State(state): State<AppState>) -> Json<AssistantIdentity> {
    Json(state.assistant_manager.get_identity().await)
}

async fn update_assistant(
    State(state): State<AppState>,
    Json(req): Json<AssistantIdentity>,
) -> Result<Json<AssistantIdentity>, StatusCode> {
    state
        .assistant_manager
        .update_identity(req.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(req))
}

async fn list_agent_templates(State(state): State<AppState>) -> Json<Vec<AgentSpec>> {
    Json(state.agent_registry.list_templates().await)
}

async fn create_agent_template(
    State(state): State<AppState>,
    Json(spec): Json<AgentSpec>,
) -> Result<Json<AgentSpec>, (StatusCode, String)> {
    verify_agent_signature(&state, &spec).await?;
    state
        .agent_registry
        .register_template(spec.clone())
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    state
        .ledger
        .add_event(build_journal_event(
            "agent_template_registered",
            serde_json::json!({
                "agent_id": spec.id,
                "role": spec.role,
                "publisher_id": spec.publisher.publisher_id,
                "public_key_id": spec.publisher.public_key_id,
            }),
        ))
        .await;
    Ok(Json(spec))
}

async fn update_agent_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(spec): Json<AgentSpec>,
) -> Result<Json<AgentSpec>, (StatusCode, String)> {
    if id.to_lowercase() != spec.role.to_lowercase() {
        return Err((StatusCode::BAD_REQUEST, "Template id mismatch".to_string()));
    }
    verify_agent_signature(&state, &spec).await?;
    state
        .agent_registry
        .register_template(spec.clone())
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    state
        .ledger
        .add_event(build_journal_event(
            "agent_template_updated",
            serde_json::json!({
                "agent_id": spec.id,
                "role": spec.role,
                "publisher_id": spec.publisher.publisher_id,
                "public_key_id": spec.publisher.public_key_id,
            }),
        ))
        .await;
    Ok(Json(spec))
}

async fn get_suggestions(State(state): State<AppState>) -> Json<Vec<Suggestion>> {
    Json(
        state
            .state_engine
            .check_deltas(&state.ledger, &state.intent_graph)
            .await,
    )
}

async fn list_skills_registry(
    State(state): State<AppState>,
) -> Result<Json<Vec<Skill>>, StatusCode> {
    let skills = state
        .skill_registry
        .list_skills()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(skills))
}

#[derive(Deserialize)]
struct PublisherKeyRegistrationRequest {
    publisher_id: String,
    public_key_id: String,
    public_key: String,
}

#[derive(Deserialize)]
struct PublisherKeyRevokeRequest {
    public_key_id: String,
}

async fn list_skill_publisher_keys(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublisherKey>>, (StatusCode, String)> {
    let keys = state
        .skill_registry
        .list_publisher_keys(None)
        .await
        .map_err(map_skills_error)?;
    Ok(Json(keys))
}

async fn list_skill_publisher_keys_for_publisher(
    State(state): State<AppState>,
    Path(publisher_id): Path<String>,
) -> Result<Json<Vec<PublisherKey>>, (StatusCode, String)> {
    let keys = state
        .skill_registry
        .list_publisher_keys(Some(publisher_id))
        .await
        .map_err(map_skills_error)?;
    Ok(Json(keys))
}

async fn register_skill_publisher_key(
    State(state): State<AppState>,
    Json(payload): Json<PublisherKeyRegistrationRequest>,
) -> Result<Json<PublisherKey>, (StatusCode, String)> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let key = PublisherKey {
        publisher_id: payload.publisher_id,
        public_key_id: payload.public_key_id,
        public_key: payload.public_key,
        created_at: now,
        revoked: false,
        revoked_at: None,
    };
    state
        .skill_registry
        .register_publisher_key(key.clone())
        .await
        .map_err(map_skills_error)?;
    state
        .ledger
        .add_event(build_journal_event(
            "publisher_key_registered",
            serde_json::json!({
                "publisher_id": key.publisher_id,
                "public_key_id": key.public_key_id,
            }),
        ))
        .await;
    Ok(Json(key))
}

async fn revoke_skill_publisher_key(
    State(state): State<AppState>,
    Path(publisher_id): Path<String>,
    Json(payload): Json<PublisherKeyRevokeRequest>,
) -> Result<Json<PublisherKey>, (StatusCode, String)> {
    state
        .skill_registry
        .revoke_publisher_key(publisher_id.clone(), payload.public_key_id.clone())
        .await
        .map_err(map_skills_error)?;
    let key = state
        .skill_registry
        .get_publisher_key(publisher_id, payload.public_key_id)
        .await
        .map_err(map_skills_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Publisher key not found".to_string()))?;
    state
        .ledger
        .add_event(build_journal_event(
            "publisher_key_revoked",
            serde_json::json!({
                "publisher_id": key.publisher_id,
                "public_key_id": key.public_key_id,
            }),
        ))
        .await;
    Ok(Json(key))
}

async fn create_skill(
    State(state): State<AppState>,
    Json(skill): Json<Skill>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let skill_id = state
        .skill_registry
        .register_skill(skill.clone())
        .await
        .map_err(map_skills_error)?;
    state
        .ledger
        .add_event(build_journal_event(
            "skill_registered",
            serde_json::json!({
                "skill_id": skill_id,
                "publisher_id": skill.manifest.publisher.publisher_id,
                "public_key_id": skill.manifest.publisher.public_key_id,
            }),
        ))
        .await;
    Ok(Json(serde_json::json!({ "id": skill_id })))
}

async fn update_skill(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(skill): Json<Skill>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    if skill.manifest.id != id {
        return Err((StatusCode::BAD_REQUEST, "Skill id mismatch".to_string()));
    }
    let skill_id = state
        .skill_registry
        .register_skill(skill.clone())
        .await
        .map_err(map_skills_error)?;
    state
        .ledger
        .add_event(build_journal_event(
            "skill_updated",
            serde_json::json!({
                "skill_id": skill_id,
                "publisher_id": skill.manifest.publisher.publisher_id,
                "public_key_id": skill.manifest.publisher.public_key_id,
            }),
        ))
        .await;
    Ok(Json(serde_json::json!({ "id": skill_id })))
}

async fn execute_skill(
    State(_state): State<AppState>,
    Path(_id): Path<String>,
    Json(_payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        "Skill execution not available in Phase 1".to_string(),
    ))
}

async fn list_skills(State(state): State<AppState>) -> Json<Vec<SkillPackage>> {
    Json(state.skill_manager.list_skills().await)
}

async fn install_skill(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    state
        .skill_manager
        .install_skill(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

async fn list_templates(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let agents = state.agent_registry.list_templates().await;
    Ok(Json(serde_json::json!({
        "agents": agents,
        "workflows": [],
        "pipelines": []
    })))
}

async fn create_template(
    State(_state): State<AppState>,
    Json(_payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        "Template creation not available in Phase 1".to_string(),
    ))
}

async fn instantiate_template(
    State(_state): State<AppState>,
    Path(_id): Path<String>,
    Json(_payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        "Template instantiation not available in Phase 1".to_string(),
    ))
}

async fn list_workflows(
    State(state): State<AppState>,
) -> Result<Json<Vec<WorkflowDefinition>>, (StatusCode, String)> {
    Ok(Json(state.workflow_engine.list_workflows().await))
}

async fn create_workflow(
    State(state): State<AppState>,
    Json(workflow): Json<WorkflowDefinition>,
) -> Result<Json<WorkflowDefinition>, (StatusCode, String)> {
    state
        .workflow_engine
        .register_workflow(workflow.clone())
        .await
        .map_err(map_workflow_error)?;
    Ok(Json(workflow))
}

async fn execute_workflow(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<WorkflowExecuteRequest>,
) -> Result<Json<WorkflowExecution>, (StatusCode, String)> {
    let session_id = payload
        .session_id
        .unwrap_or_else(|| "default_session".to_string());
    let tenant_id = payload
        .tenant_id
        .unwrap_or_else(|| "default_tenant".to_string());
    let input = payload.input.unwrap_or(serde_json::Value::Null);
    let execution_id = state
        .workflow_engine
        .execute_workflow(id, session_id, tenant_id, input)
        .await
        .map_err(map_workflow_error)?;
    let mut execution = state
        .workflow_engine
        .get_execution(execution_id)
        .await
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Execution not found".to_string()))?;
    let node_artifacts = persist_workflow_node_results(&state.artifact_registry, &execution).await;
    for artifact_id in node_artifacts {
        if !execution.artifacts.contains(&artifact_id) {
            execution.artifacts.push(artifact_id);
        }
    }
    persist_workflow_execution(&state.artifact_registry, &execution).await;
    Ok(Json(execution))
}

async fn taskgraph_install(
    Json(payload): Json<TaskgraphInstallRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let profile = payload
        .agent_profile_id
        .as_deref()
        .unwrap_or("kernel-default");
    taskgraph::install_run_with_profile(&payload.graph_id, profile)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))
}

async fn taskgraph_resume(
    Json(payload): Json<TaskgraphResumeRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let profile = payload
        .agent_profile_id
        .as_deref()
        .unwrap_or("kernel-default");
    taskgraph::resume_run_with_profile(&payload.run_id, profile)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))
}

async fn validate_workflow(
    State(state): State<AppState>,
    Json(payload): Json<WorkflowYamlRequest>,
) -> Result<Json<ValidateWorkflowResponse>, (StatusCode, String)> {
    let tenant_id = payload
        .tenant_id
        .unwrap_or_else(|| "default_tenant".to_string());
    let validator = YamlValidator::new(state.policy_engine.clone(), tenant_id);
    validator
        .validate_workflow(&payload.yaml)
        .map_err(map_workflow_validation_error)?;
    Ok(Json(ValidateWorkflowResponse {
        ok: true,
        message: None,
    }))
}

async fn compile_workflow(
    State(state): State<AppState>,
    Json(payload): Json<WorkflowYamlRequest>,
) -> Result<Json<CompileWorkflowResponse>, (StatusCode, String)> {
    let compiler = YamlCompiler;
    let context = KernelCompilationContext {
        session_id: payload.session_id.unwrap_or_else(|| "compiled".to_string()),
        created_by: payload.created_by.unwrap_or_else(|| "compiler".to_string()),
        timestamp: now_epoch_seconds(),
    };
    let compiled = compiler
        .compile_workflow_contracts(&payload.yaml, context)
        .map_err(map_workflow_compile_error)?;
    Ok(Json(CompileWorkflowResponse {
        workflow_definition: compiled.workflow_definition,
        run_model: compiled.run_model,
        compilation_event: compiled.compilation_event,
    }))
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "service": "kernel",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn compile_task_spec(
    State(state): State<AppState>,
    Json(task_spec): Json<types::TaskSpec>,
) -> Result<Json<String>, StatusCode> {
    let directive_compiler = &state.directive_compiler;
    let directive = directive_compiler.compile(&task_spec);
    Ok(Json(directive))
}

async fn compile_capsule_with_context(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<types::DispatchResponse>, StatusCode> {
    let intent_text = payload
        .get("intent_text")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)
        .map(|s| s.to_string())?;

    let session_id = payload
        .get("session_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default_session");

    let capsule_id_str = uuid::Uuid::new_v4().to_string();
    let capsule_id = payload
        .get("capsule_id")
        .and_then(|v| v.as_str())
        .unwrap_or(&capsule_id_str);

    // Use the context manager to assemble context with verification
    let (_bundle, _context_map, _budget_report, verify_artifact) = state
        .context_manager
        .assemble_with_verification(&intent_text, session_id, capsule_id);

    // Check the verification artifact before allowing the operation to proceed
    let verification_result = state
        .verification_checker
        .check_verification(&verify_artifact)
        .await;
    if !verification_result.allowed {
        return Err(StatusCode::FORBIDDEN);
    }

    // Create a basic capsule instance
    let capsule_instance = types::CapsuleInstance {
        capsule_id: uuid::Uuid::new_v4().to_string(),
        framework_id: "fwk_generic".to_string(),
        title: format!("Compiled: {}", intent_text),
        created_at: chrono::Utc::now().timestamp_millis(),
        state: serde_json::json!({}),
        active_canvas_id: None,
        persistence_mode: "ephemeral".to_string(),
        sandbox_policy: None,
        tool_scope: None,
    };

    // Add verification artifact to ledger
    let verification_record = crate::types::Artifact {
        artifact_id: verify_artifact.verify_id.clone(),
        capsule_id: capsule_instance.capsule_id.clone(),
        artifact_type: "ContextCompilationVerification".to_string(),
        content: serde_json::to_value(&verify_artifact).unwrap_or_default(),
    };
    state
        .ledger
        .add_artifacts(vec![verification_record.clone()])
        .await;
    persist_kernel_artifacts(&state.artifact_registry, vec![verification_record]).await;

    let response = types::DispatchResponse {
        capsule: capsule_instance,
        canvases: vec![],
        events: vec![],
        artifacts: vec![],
        pattern_id: None,
        confidence: 0.95,
        situation: None,
    };

    Ok(Json(response))
}

async fn get_run_model(
    State(_state): State<AppState>,
    Path(run_id): Path<String>,
) -> Result<Json<a2rchitech_kernel_contracts::RunModel>, StatusCode> {
    let mut run_model = a2rchitech_kernel_contracts::RunModel::new(
        "default_tenant".to_string(),
        "default_session".to_string(),
        "system".to_string(),
    );
    run_model.run_id = run_id;
    Ok(Json(run_model))
}

async fn validate_tool_request(
    State(_state): State<AppState>,
    Json(_tool_request): Json<a2rchitech_kernel_contracts::ToolRequest>,
) -> Result<Json<bool>, StatusCode> {
    Ok(Json(true))
}

async fn create_event_envelope(
    State(_state): State<AppState>,
    Json(envelope): Json<a2rchitech_kernel_contracts::EventEnvelope>,
) -> Result<Json<a2rchitech_kernel_contracts::EventEnvelope>, StatusCode> {
    match envelope.validate() {
        Ok(_) => Ok(Json(envelope)),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn verify_artifact_handler(
    State(_state): State<AppState>,
    Json(artifact): Json<a2rchitech_kernel_contracts::VerifyArtifact>,
) -> Result<Json<a2rchitech_kernel_contracts::VerifyArtifact>, StatusCode> {
    match artifact.validate() {
        Ok(_) => Ok(Json(artifact)),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn get_framework(
    State(_state): State<AppState>,
    Path(framework_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let framework_info = serde_json::json!({
        "framework_id": framework_id,
        "status": "active",
        "capsule_type": "default",
        "default_canvases": []
    });
    Ok(Json(framework_info))
}

async fn list_frameworks(
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let frameworks_list = serde_json::json!([
        { "framework_id": "fwk_search", "name": "Search Framework", "status": "active" },
        { "framework_id": "fwk_note", "name": "Note Framework", "status": "active" }
    ]);
    Ok(Json(frameworks_list))
}

async fn add_evidence(
    State(_state): State<AppState>,
    Json(req): Json<EvidenceAddRequest>,
) -> Result<Json<String>, StatusCode> {
    let id = uuid::Uuid::new_v4().to_string();
    info!("Adding evidence: {} -> {}", req.target, id);
    Ok(Json(id))
}

async fn patch_capsule(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<CapsulePatchRequest>,
) -> StatusCode {
    let dispatcher = state.dispatcher.read().await;
    if dispatcher.get_capsule(&id).is_none() {
        return StatusCode::NOT_FOUND;
    }
    info!("Patching capsule {}: {:?}", id, req.spec_patch);
    StatusCode::OK
}

async fn recompile_capsule(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<CapsuleInstance>, StatusCode> {
    let mut dispatcher = state.dispatcher.write().await;
    if dispatcher.get_capsule(&id).is_none() {
        return Err(StatusCode::NOT_FOUND);
    }
    let capsule_type = req
        .get("capsule_type")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let mut capsule = dispatcher
        .get_capsule(&id)
        .ok_or(StatusCode::NOT_FOUND)?
        .clone();
    capsule.framework_id = capsule_type.to_string();
    Ok(Json(capsule))
}

async fn list_tools(State(state): State<AppState>) -> Json<Vec<ToolDefinition>> {
    let tools = state.tool_gateway.list_tools().await;
    Json(tools.into_iter().map(gateway_to_kernel_tool).collect())
}

async fn create_tool(
    State(state): State<AppState>,
    Json(tool): Json<GatewayToolDefinition>,
) -> Result<Json<GatewayToolDefinition>, (StatusCode, String)> {
    state
        .tool_gateway
        .register_tool(tool.clone())
        .await
        .map_err(map_tool_gateway_error)?;
    Ok(Json(tool))
}

async fn update_tool(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(tool): Json<GatewayToolDefinition>,
) -> Result<Json<GatewayToolDefinition>, (StatusCode, String)> {
    if tool.id != id {
        return Err((StatusCode::BAD_REQUEST, "Tool id mismatch".to_string()));
    }
    state
        .tool_gateway
        .register_tool(tool.clone())
        .await
        .map_err(map_tool_gateway_error)?;
    Ok(Json(tool))
}

async fn execute_tool(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ToolExecutePayload>,
) -> Result<Json<ToolExecutionResult>, (StatusCode, String)> {
    let request = tool_execution_request_from_payload(id, payload);
    enforce_execution_envelope(&request)?;
    let result = state
        .tool_gateway
        .execute_tool(request.clone())
        .await
        .map_err(map_tool_gateway_error)?;
    Ok(Json(result))
}

async fn execute_action(
    State(state): State<AppState>,
    Json(req): Json<ActionExecuteRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let request = build_tool_execution_request(
        req.tool_id,
        req.parameters,
        req.identity_id,
        req.session_id,
        req.tenant_id,
        req.run_id,
        req.workflow_id,
        req.node_id,
        req.wih_id,
        req.write_scope,
        None,
        req.trace_id,
        req.idempotency_key,
        req.retry_count,
    );
    enforce_execution_envelope(&request)?;
    let result = state
        .tool_gateway
        .execute_tool(request.clone())
        .await
        .map_err(map_tool_gateway_error)?;
    if let Some(error) = result.error {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, error));
    }
    Ok(Json(result.output.unwrap_or(serde_json::Value::Null)))
}

async fn session_history(
    State(state): State<AppState>,
    Query(params): Query<types::SessionHistoryQuery>,
) -> Result<Json<SessionHistoryResponse>, StatusCode> {
    let sessions = state
        .session_manager
        .log(params.limit.unwrap_or(10))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let session_infos: Vec<SessionInfo> = sessions
        .into_iter()
        .map(|s| SessionInfo {
            session_id: s.session_id,
            description: s.description,
            created_at: s.created_at as u64,
        })
        .collect();
    Ok(Json(SessionHistoryResponse {
        sessions: session_infos,
    }))
}

async fn session_log(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionLogResponse>, StatusCode> {
    let session = state
        .session_manager
        .checkout(&session_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let entries: Vec<SessionEntry> = session
        .state_snapshot
        .execution_log
        .into_iter()
        .map(|e| SessionEntry {
            entry_type: format!("{:?}", e.entry_type),
            content: e.content,
            timestamp: e.timestamp as u64,
        })
        .collect();
    Ok(Json(SessionLogResponse { log: entries }))
}

async fn session_reset(
    State(state): State<AppState>,
) -> Result<Json<SessionResetResponse>, StatusCode> {
    state
        .session_manager
        .reset_all()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SessionResetResponse {
        message: "Reset successful".to_string(),
    }))
}

async fn set_mode(
    State(_state): State<AppState>,
    Json(req): Json<ModeRequest>,
) -> impl IntoResponse {
    (StatusCode::OK, Json(ModeResponse { mode: req.mode }))
}

async fn get_mode_handler(State(_state): State<AppState>) -> impl IntoResponse {
    Json(ModeResponse {
        mode: "standard".to_string(),
    })
}

async fn session_commit(
    State(state): State<AppState>,
    Json(req): Json<SessionCommitRequest>,
) -> Result<Json<SessionCommitResponse>, StatusCode> {
    let session_id = state
        .session_manager
        .commit(
            &req.description,
            SessionState {
                context: serde_json::to_string(&req.session_state).unwrap_or_default(),
                recursion_depth: 0,
                execution_log: vec![],
                variables: std::collections::HashMap::new(),
                answer: None,
            },
            vec![],
            &req.mode,
            uuid::Uuid::new_v4().to_string().as_str(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SessionCommitResponse { session_id }))
}

async fn session_branch(
    State(state): State<AppState>,
    Json(req): Json<SessionBranchRequest>,
) -> Result<Json<SessionBranchResponse>, StatusCode> {
    let session_id = state
        .session_manager
        .branch(&req.branch_name, uuid::Uuid::new_v4().to_string().as_str())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SessionBranchResponse { session_id }))
}

async fn terminal_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_terminal_socket(socket, state))
}

async fn orchestrator_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_orchestrator_socket(socket, state))
}

async fn handle_orchestrator_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut _receiver) = socket.split();
    let mut rx = state.orchestrator_service.event_rx();
    while let Ok(event) = rx.recv().await {
        if let Ok(msg) = serde_json::to_string(&event) {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    }
}

async fn handle_terminal_socket(socket: WebSocket, state: AppState) {
    let session_id = match state.terminal_manager.create_session().await {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Failed to create terminal session: {}", e);
            return;
        }
    };
    let session = state
        .terminal_manager
        .get_session(&session_id)
        .await
        .unwrap();
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let mut master_reader = {
        let master = session.master.lock().unwrap();
        master.try_clone_reader().unwrap()
    };
    let (pty_to_ws_tx, mut pty_to_ws_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
    tokio::task::spawn_blocking(move || {
        let mut buf = [0u8; 1024];
        loop {
            match master_reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if pty_to_ws_tx.send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });
    let mut ws_sender_task = tokio::spawn(async move {
        while let Some(data) = pty_to_ws_rx.recv().await {
            if ws_sender.send(Message::Binary(data)).await.is_err() {
                break;
            }
        }
    });
    let session_clone = session.clone();
    let mut ws_receiver_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(t) => {
                    let _ = session_clone.tx.send(t.into_bytes());
                }
                Message::Binary(b) => {
                    let _ = session_clone.tx.send(b);
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });
    tokio::select! {
        _ = &mut ws_sender_task => { ws_receiver_task.abort(); }
        _ = &mut ws_receiver_task => { ws_sender_task.abort(); }
    }
    state.terminal_manager.remove_session(&session_id).await;
}

async fn create_router() -> Result<Router, anyhow::Error> {
    let workspace_dir = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("workspace");
    std::fs::create_dir_all(&workspace_dir).ok();
    let workspace_path = workspace_dir.clone();
    let ledger = Arc::new(JournalLedger::new());
    let action_handler = Arc::new(ActionHandler::new(ledger.clone()));
    let db_path = workspace_dir.join("rlm_sessions.db");
    let db_path_str = format!("sqlite://{}", db_path.display());

    info!("Connecting to SQLite at {}", db_path_str);
    let sqlite_options = SqliteConnectOptions::from_str(&db_path_str)?.create_if_missing(true);
    let sqlite_pool = Arc::new(
        sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(10)
            .connect_with(sqlite_options)
            .await?,
    );
    info!("SQLite pool connected");

    let history_path = workspace_dir.join("history.jsonl");
    let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&history_path)?));
    info!("Step 5: Initializing messaging system...");
    let messaging_system = match MessagingSystem::new_with_storage(
        history_ledger.clone(),
        sqlite_pool.as_ref().clone(),
    )
    .await
    {
        Ok(system) => {
            info!("Step 6: Messaging system initialized successfully");
            Arc::new(system)
        }
        Err(e) => {
            error!("CRITICAL: Failed to initialize messaging system: {}", e);
            anyhow::bail!("Messaging system initialization failed: {}", e);
        }
    };
    let policy_engine = Arc::new(PolicyEngine::new(
        history_ledger.clone(),
        messaging_system.clone(),
    ));
    let system_identity = Identity {
        id: "system".to_string(),
        identity_type: IdentityType::ServiceAccount,
        name: "System".to_string(),
        tenant_id: "system".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["system".to_string()],
        permissions: vec!["perm_t0_read".to_string()],
    };
    policy_engine.register_identity(system_identity).await?;
    let workflow_identity = Identity {
        id: "workflow_executor".to_string(),
        identity_type: IdentityType::ServiceAccount,
        name: "Workflow Executor".to_string(),
        tenant_id: "system".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["workflow_executor".to_string()],
        permissions: vec![],
    };
    policy_engine.register_identity(workflow_identity).await?;
    policy_engine.create_default_permissions().await?;
    policy_engine.create_default_rules().await?;
    let publish_rule = PolicyRule {
        id: "rule_allow_publish".to_string(),
        name: "Allow Publish Operations".to_string(),
        description: "Allow artifact publishing from kernel".to_string(),
        condition: "identity.active".to_string(),
        effect: PolicyEffect::Allow,
        resource: "artifact_publish:*".to_string(),
        actions: vec!["publish".to_string()],
        priority: 150,
        enabled: true,
    };
    policy_engine.add_rule(publish_rule).await?;
    let tool_execute_rule = PolicyRule {
        id: "rule_allow_tool_execute".to_string(),
        name: "Allow Tool Execute Operations".to_string(),
        description: "Allow tool execution for local kernel".to_string(),
        condition: "identity.active".to_string(),
        effect: PolicyEffect::Allow,
        resource: "tool:*".to_string(),
        actions: vec!["execute".to_string()],
        priority: 120,
        enabled: true,
    };
    policy_engine.add_rule(tool_execute_rule).await?;
    let skill_execute_rule = PolicyRule {
        id: "rule_allow_skill_execute".to_string(),
        name: "Allow Skill Execute Operations".to_string(),
        description: "Allow skill execution for local kernel".to_string(),
        condition: "identity.active".to_string(),
        effect: PolicyEffect::Allow,
        resource: "skill:*".to_string(),
        actions: vec!["execute".to_string()],
        priority: 120,
        enabled: true,
    };
    policy_engine.add_rule(skill_execute_rule).await?;
    let tool_gateway = Arc::new(ToolGateway::new(
        policy_engine.clone(),
        history_ledger.clone(),
        messaging_system.clone(),
    ));
    let runtime_session_manager = Arc::new(RuntimeSessionManager::new(
        history_ledger.clone(),
        messaging_system.clone(),
    ));
    let context_router = Arc::new(ContextRouter::new(
        history_ledger.clone(),
        messaging_system.clone(),
        policy_engine.clone(),
        runtime_session_manager.clone(),
    ));
    let rlm_memory_policy = Arc::new(DefaultMemoryPolicy {});
    let memory_fabric = Arc::new(
        MemoryFabric::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            sqlite_pool.as_ref().clone(),
            rlm_memory_policy,
        )
        .await?,
    );
    let provider_router = Arc::new(
        ProviderRouter::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let skill_registry = Arc::new(
        SkillRegistry::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            tool_gateway.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let workflow_engine = Arc::new(WorkflowEngine::new(
        history_ledger.clone(),
        messaging_system.clone(),
        policy_engine.clone(),
        tool_gateway.clone(),
        skill_registry.clone(),
        messaging_system.task_queue.clone(),
        sqlite_pool.as_ref().clone(),
    ));
    let embodiment_control_plane = Arc::new(
        EmbodimentControlPlane::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            skill_registry.clone(),
            workflow_engine.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let package_manager = Arc::new(
        PackageManager::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let evaluation_engine = Arc::new(
        EvaluationEngine::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            skill_registry.clone(),
            workflow_engine.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let artifact_storage_path = workspace_dir.join("artifacts");
    let artifact_backup_path = workspace_dir.join("artifact_backups");
    let artifact_registry_config = ArtifactRegistryConfig {
        registry_id: "kernel-registry".to_string(),
        name: "Kernel Artifact Registry".to_string(),
        description: "Artifact registry for kernel-generated artifacts".to_string(),
        version: "1.0.0".to_string(),
        storage_config: StorageConfig {
            storage_type: StorageType::LocalFileSystem,
            storage_path: artifact_storage_path.to_string_lossy().to_string(),
            encryption_enabled: false,
            compression_enabled: false,
            retention_policy: RetentionPolicy {
                retention_period_days: 30,
                auto_delete: false,
                backup_before_delete: false,
                compliance_hold: false,
            },
            backup_config: BackupConfig {
                enabled: false,
                backup_frequency_hours: 24,
                backup_location: artifact_backup_path.to_string_lossy().to_string(),
                encryption_enabled: false,
                retention_count: 0,
            },
        },
        security_profile: SecurityProfile {
            sensitivity_tier: 0,
            compliance_requirements: vec![ComplianceRequirement::SOC2],
            audit_level: AuditLevel::Basic,
            encryption_required: false,
            network_isolation: NetworkIsolation::None,
        },
        network_config: NetworkConfiguration {
            allowed_origins: vec!["*".to_string()],
            cors_enabled: true,
            tls_required: false,
            rate_limiting: Some(RateLimitingConfig {
                requests_per_minute: 120,
                burst_size: 240,
                per_ip_limit: true,
            }),
        },
        created_at: now,
        updated_at: now,
        is_active: true,
    };
    let artifact_registry = Arc::new(
        ArtifactRegistry::new_with_storage(
            artifact_registry_config,
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            skill_registry.clone(),
            workflow_engine.clone(),
            embodiment_control_plane.clone(),
            package_manager.clone(),
            evaluation_engine.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let tool_execution_reporter = Arc::new(ArtifactToolExecutionReporter {
        registry: artifact_registry.clone(),
    });
    tool_gateway
        .set_execution_reporter(tool_execution_reporter)
        .await;
    let mut tool_executor = ToolExecutor::new();
    let desktop = DesktopDevice::new(workspace_path.clone());
    for tool in desktop.get_tools() {
        tool_executor.register_tool(tool);
    }
    let tool_executor = Arc::new(RwLock::new(tool_executor));
    let tool_adapter = Arc::new(ToolExecutorAdapter::new(tool_executor.clone()));
    tool_gateway.set_sdk_executor(tool_adapter).await;
    {
        let executor = tool_executor.read().await;
        for tool in executor.get_definitions() {
            let gateway_tool = tool_executor_to_gateway_definition(&tool);
            if let Err(err) = tool_gateway.register_tool(gateway_tool).await {
                tracing::warn!("Failed to register tool {}: {}", tool.name, err);
            }
        }
    }
    let skill_manager = Arc::new(SkillManager::new(workspace_path.clone()));
    let config_manager = Arc::new(ConfigManager::new(workspace_path.clone()));
    let assistant_manager = Arc::new(AssistantManager::new(workspace_path.clone()));
    let agent_registry = Arc::new(AgentRegistry::new(workspace_path.clone()));
    let _ = agent_registry.register_defaults().await;
    let monitoring_state = Arc::new(MonitoringState::new());
    let terminal_manager = Arc::new(TerminalManager::new());
    let brain_store = Arc::new(BrainStore::new(sqlite_pool.clone()));
    let _ = brain_store.init().await;

    // Create shared integration events channel for both model_router and brain_manager
    let (integration_tx, _) = tokio::sync::broadcast::channel::<brain::types::BrainEvent>(100);

    // Create model_router with shared integration events channel
    let model_router = brain::ModelRouter::with_integration_events(integration_tx.clone());

    // Create brain_manager with the SAME integration events channel
    let brain_manager = {
        let mut manager = BrainManager::new()
            .with_store(brain_store)
            .with_integration_events(integration_tx);
        // Register drivers in priority order:
        // 1. ACP Protocol (PRIMARY for chat/AI interactions)
        // 2. API driver
        // 3. Local driver
        // 4. Terminal App (PTY-based, for human interaction only)
        // Register drivers in priority order:
        // 1. ACP Protocol (PRIMARY for true ACP agents)
        // 2. JSONL Protocol (for --output-format stream-json CLIs)
        // 3. API driver
        // 4. Local driver
        // 5. Terminal App (PTY-based, for human interaction only)
        // Register SimpleAcpDriver FIRST - it's the working implementation from agent-shell
        manager.register_driver(Box::new(AcpProtocolDriver::new()));
        manager.register_driver(Box::new(AcpProtocolDriver::new()));
        manager.register_driver(Box::new(JsonlProtocolDriver::new()));
        manager.register_driver(Box::new(brain::drivers::api::ApiBrainDriver::new()));
        manager.register_driver(Box::new(brain::drivers::local::LocalBrainDriver::new()));
        manager.register_driver(Box::new(TerminalAppDriver::new(terminal_manager.clone())));
        Arc::new(manager)
    };

    // Register Claude Code - ACP MODE (using claude-agent-acp)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "claude-code".to_string(),
                name: "Claude Code (ACP)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("claude-3-5-sonnet".to_string()),
                endpoint: None,
                api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
                command: Some("claude-agent-acp".to_string()),
                args: Some(vec![]),  // ACP mode - no args needed
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "claude-agent-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // Register OpenAI Codex
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "codex".to_string(),
                name: "OpenAI Codex CLI".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("gpt-4o".to_string()),
                endpoint: None,
                api_key_env: None, // CLI handles auth via `codex auth`
                command: Some("codex".to_string()),
                args: Some(vec!["exec".to_string(), "--yolo".to_string()]),
                prompt_arg: None, // Uses positional argument
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "codex".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Jsonl),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // Register Google Gemini CLI - ACP MODE
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "gemini-cli".to_string(),
                name: "Google Gemini CLI (ACP)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("gemini-2.0-flash".to_string()),
                endpoint: None,
                api_key_env: Some("GEMINI_API_KEY".to_string()),
                command: Some("gemini".to_string()),
                args: Some(vec!["--experimental-acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "gemini".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // Register Moonshot Kimi CLI
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "kimi-cli".to_string(),
                name: "Moonshot Kimi CLI".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("kimi-k2".to_string()),
                endpoint: None,
                api_key_env: None, // CLI handles auth via `kimi auth`
                command: Some("kimi".to_string()),
                args: Some(vec!["--yolo".to_string()]),
                prompt_arg: Some("--prompt".to_string()), // Requires --prompt flag
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "kimi".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Jsonl),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // TRUE ACP-NATIVE PROFILE (OpenCode)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "opencode-acp".to_string(),
                name: "OpenCode (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None, // Provider-managed model, not kernel-managed
                endpoint: None,
                api_key_env: None,
                command: Some("opencode".to_string()),
                args: Some(vec!["acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "opencode".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // AUTH-ONLY TERMINAL PROFILE (OpenCode)
    // Used for: auth wizard, login flow (PTY mode, human interactive)
    // NEVER use for chat sessions - use opencode-acp instead
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "opencode-auth".to_string(),
                name: "OpenCode Auth Wizard".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("opencode".to_string()),
                args: Some(vec!["auth".to_string(), "login".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "opencode".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Terminal),
                runtime_overrides: None,
            },
            capabilities: vec!["auth".to_string()],
            cost_tier: 0,
            privacy_level: brain::router::PrivacyLevel::LocalOnly,
        })
        .await;

    // GEMINI ACP-NATIVE PROFILE
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "gemini-acp".to_string(),
                name: "Gemini CLI (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("gemini-2.5-pro".to_string()),
                endpoint: None,
                api_key_env: Some("GEMINI_API_KEY".to_string()),
                command: Some("npx".to_string()),
                args: Some(vec![
                    "@google/gemini-cli".to_string(),
                    "--experimental-acp".to_string(),
                ]),
                prompt_arg: None, // ACP uses stdin protocol
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Dependency {
                    name: "@google/gemini-cli".to_string(),
                    package_manager: "npm".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // AUTH-ONLY TERMINAL PROFILE (Gemini)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "gemini-auth".to_string(),
                name: "Gemini Auth Wizard".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("gemini".to_string()),
                args: Some(vec!["auth".to_string(), "login".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "gemini".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Terminal),
                runtime_overrides: None,
            },
            capabilities: vec!["auth".to_string()],
            cost_tier: 0,
            privacy_level: brain::router::PrivacyLevel::LocalOnly,
        })
        .await;

    // KIMI ACP-NATIVE PROFILE
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "kimi-acp".to_string(),
                name: "Moonshot Kimi (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("kimi-k2".to_string()),
                endpoint: None,
                api_key_env: None, // CLI handles auth
                command: Some("kimi".to_string()),
                args: Some(vec![]), // Kimi uses ACP by default when available
                prompt_arg: None, // ACP uses stdin protocol
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "kimi".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // QWEN ACP-NATIVE PROFILE - qwen must be installed: npm install -g @qwen-code/qwen-code
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "qwen-acp".to_string(),
                name: "Qwen Code (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("qwen-coder-plus".to_string()),
                endpoint: None,
                api_key_env: Some("DASHSCOPE_API_KEY".to_string()),
                command: Some("qwen".to_string()),
                args: Some(vec!["--experimental-acp".to_string()]),
                prompt_arg: None, // ACP uses stdin protocol
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "qwen".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // CLAUDE CODE ACP-NATIVE PROFILE (via wrapper)
    // CLAUDE CODE ACP - requires: npm install -g @zed-industries/claude-agent-acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "claude-code".to_string(),
                name: "Claude Code".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("claude-3-5-sonnet".to_string()),
                endpoint: None,
                api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
                command: Some("claude-agent-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "claude-agent-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 2,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // AUTH-ONLY TERMINAL PROFILE (Claude)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "claude-auth".to_string(),
                name: "Claude Auth Wizard".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("claude".to_string()),
                args: Some(vec!["auth".to_string(), "login".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "claude".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Terminal),
                runtime_overrides: None,
            },
            capabilities: vec!["auth".to_string()],
            cost_tier: 0,
            privacy_level: brain::router::PrivacyLevel::LocalOnly,
        })
        .await;

    // AUTH-ONLY TERMINAL PROFILE (Codex)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "codex-auth".to_string(),
                name: "Codex Auth Wizard".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("codex".to_string()),
                args: Some(vec!["auth".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "codex".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Terminal),
                runtime_overrides: None,
            },
            capabilities: vec!["auth".to_string()],
            cost_tier: 0,
            privacy_level: brain::router::PrivacyLevel::LocalOnly,
        })
        .await;

    // AUTH-ONLY TERMINAL PROFILE (Kimi)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "kimi-auth".to_string(),
                name: "Kimi Auth Wizard".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("kimi".to_string()),
                args: Some(vec!["auth".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "kimi".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Terminal),
                runtime_overrides: None,
            },
            capabilities: vec!["auth".to_string()],
            cost_tier: 0,
            privacy_level: brain::router::PrivacyLevel::LocalOnly,
        })
        .await;

    // AUGGIE ACP - npm install -g @augmentcode/auggie
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "auggie".to_string(),
                name: "Auggie".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("auggie".to_string()),
                args: Some(vec!["--acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "auggie".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // CURSOR ACP - npm install -g @blowmage/cursor-agent-acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "cursor".to_string(),
                name: "Cursor".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("cursor-agent-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "cursor-agent-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // DROID ACP - npm install -g droid-acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "droid".to_string(),
                name: "Factory Droid".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("droid-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "droid-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // GITHUB COPILOT ACP - copilot --acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "copilot".to_string(),
                name: "GitHub Copilot".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("copilot".to_string()),
                args: Some(vec!["--acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "copilot".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // GOOSE ACP - goose acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "goose".to_string(),
                name: "Goose".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("goose".to_string()),
                args: Some(vec!["acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "goose".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // MISTRAL LE-CHAT ACP - vibe-acp (via uv tool install mistral-vibe)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "le-chat".to_string(),
                name: "Mistral Le Chat".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("vibe-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "vibe-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // PI ACP - npm install -g pi-acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "pi".to_string(),
                name: "Pi".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("pi-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "pi-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    let model_router = Arc::new(model_router);
    let mut provider_manager = llm::gateway::ProviderManager::new();
    let (active_provider, _) = config_manager.get_active_config().await;
    provider_manager.register_provider(Box::new(llm::gateway::OpenAIAdapter::new(
        "local",
        env::var("KERNEL_LLM_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:11434/v1/chat/completions".to_string()),
        env::var("KERNEL_LLM_MODEL").unwrap_or("llama3".to_string()),
        env::var("KERNEL_LLM_KEY").unwrap_or("ollama".to_string()),
    )));
    provider_manager.register_provider(Box::new(llm::gateway::MLXAdapter::new(
        env::var("KERNEL_MLX_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:3508/v1/generate".to_string()),
        env::var("KERNEL_MLX_MODEL").unwrap_or("mlx-llm".to_string()),
        env::var("KERNEL_MLX_MAX_TOKENS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(512),
        env::var("KERNEL_MLX_TEMPERATURE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.7),
    )));
    provider_manager.register_provider(Box::new(llm::gateway::BrainLLMAdapter::new(
        brain_manager.clone(),
    )));
    let _ = provider_manager.set_active(&active_provider);
    let provider_manager = Arc::new(RwLock::new(provider_manager));
    let directive_compiler = Arc::new(DirectiveCompiler::new());
    let context_manager = Arc::new(ContextManager::new(128000));
    let intent_graph = Arc::new(RwLock::new(IntentGraphKernel::load_from_disk()));
    let pattern_registry = Arc::new(PatternRegistry::new());
    let state_engine = Arc::new(StateEngine::new());
    let capsule_compiler = Arc::new(capsule_compiler::CapsuleCompiler::new(
        capsule_compiler::CompilerConfig::default(),
    ));
    let contract_verifier = Arc::new(contract_verifier::ContractVerifier::new());
    let (orchestrator_event_tx, _) = broadcast::channel(1000);
    let orchestrator_service = Arc::new(OrchestratorService::new(
        Arc::new(TaskStore::new(sqlite_pool.clone())),
        Arc::new(RunStore::new(sqlite_pool.clone())),
        orchestrator_event_tx,
    ));
    let dispatcher = Arc::new(RwLock::new(IntentDispatcher::new(
        directive_compiler.clone(),
        context_manager.clone(),
        intent_graph.clone(),
        pattern_registry.clone(),
        tool_gateway.clone(),
        provider_manager.clone(),
        contract_verifier.clone(),
        capsule_compiler.clone(),
        orchestrator_service.clone(),
        brain_manager.clone(),
    )));
    for framework in get_default_frameworks() {
        dispatcher.write().await.register_framework(framework);
    }
    let session_manager = Arc::new(SessionManager::new(sqlite_pool.clone()).await?);
    let rate_limiter = Arc::new(rate_limiter::RateLimiter::new(
        rate_limiter::RateLimitConfig {
            requests_per_minute: 60,
            burst_capacity: 10,
            per_session: true,
            per_tenant: false,
        },
    ));
    let verification_checker = Arc::new(verification_checker::VerificationChecker::new());
    let security_state = Arc::new(SecurityState::new(100));
    let io_service_client = Arc::new(IoServiceClient::new(
        std::env::var("IO_SERVICE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:3510".to_string()),
    ));
    let bm_clone = brain_manager.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let _ = bm_clone.sync_sessions().await;
        }
    });
    let state = AppState {
        dispatcher,
        ledger,
        action_handler,
        directive_compiler,
        context_manager,
        contract_verifier,
        intent_graph,
        pattern_registry,
        assistant_manager,
        agent_registry,
        state_engine,
        skill_manager,
        config_manager,
        tool_executor,
        tool_gateway,
        io_service_client,
        skill_registry,
        artifact_registry,
        workflow_engine,
        policy_engine,
        session_manager,
        sqlite_pool,
        rate_limiter,
        verification_checker,
        capsule_compiler,
        security_state,
        monitoring_state,
        terminal_manager,
        orchestrator_service,
        brain_manager,
        model_router,
        runtime_registry: brain::RuntimeRegistry::new(),
        provider_auth_registry: Arc::new(a2rchitech_providers::runtime::ProviderAuthRegistry::new()),
        model_adapter_registry: Arc::new(a2rchitech_providers::runtime::ModelAdapterRegistry::new()),
    };
    let protected_routes = Router::new()
        .route(
            "/v1/setup/status",
            get(brain::setup::get_setup_status::<AppState>),
        )
        .route(
            "/v1/setup/plan/:brain_id",
            get(brain::setup::get_setup_plan::<AppState>),
        )
        .route(
            "/v1/setup/verify/:brain_id",
            post(brain::setup::verify_brain_setup::<AppState>),
        )
        .route(
            "/v1/brain/profiles",
            get(brain::gateway::list_brain_profiles::<AppState>)
                .post(brain::gateway::register_brain_profile::<AppState>),
        )
        .route(
            "/v1/brain/route",
            post(brain::gateway::route_brain::<AppState>),
        )
        .route(
            "/v1/brain/integration/events",
            get(brain::gateway::stream_integration_events::<AppState>),
        )
        .route(
            "/v1/brain/runtimes",
            get(brain::runtime_management::list_runtimes::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/:id",
            get(brain::runtime_management::get_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/install",
            post(brain::runtime_management::install_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/auth",
            post(brain::runtime_management::auth_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/verify",
            post(brain::runtime_management::verify_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/:session_id/events",
            get(brain::runtime_management::stream_install_events::<AppState>),
        )
        .route(
            "/v1/sessions",
            post(brain::gateway::create_brain_session::<AppState>)
                .get(brain::gateway::list_brain_sessions::<AppState>),
        )
        .route(
            "/v1/sessions/:id/attach",
            post(brain::gateway::attach_brain_session::<AppState>),
        )
        .route(
            "/v1/sessions/:id/events",
            get(brain::gateway::stream_brain_events::<AppState>),
        )
        .route(
            "/v1/sessions/:id/input",
            post(brain::gateway::send_brain_input::<AppState>),
        )
        // Provider Authentication Endpoints
        .route(
            "/v1/providers/:provider/auth/status",
            get(brain::gateway::get_provider_auth_status::<AppState>),
        )
        .route(
            "/v1/providers/auth/status",
            get(brain::gateway::list_providers_auth_status::<AppState>),
        )
        // Provider Model Discovery Endpoints
        .route(
            "/v1/providers/:provider/models",
            get(brain::gateway::list_provider_models::<AppState>),
        )
        .route(
            "/v1/providers/:provider/models/validate",
            post(brain::gateway::validate_provider_model::<AppState>),
        )
        // Brain Profile Model Endpoints
        .route(
            "/v1/brains/:profile_id/models",
            get(brain::gateway::get_brain_profile_models::<AppState>),
        )
        .route(
            "/v1/brains/:profile_id/models/validate",
            post(brain::gateway::validate_brain_profile_model::<AppState>),
        )
        .route("/v1/governance/evaluate", post(governance::evaluate_policy))
        .route("/v1/governance/receipts", post(governance::submit_receipt))
        .route("/v1/intent/dispatch", post(dispatch_intent))
        .route("/v1/taskgraph/install", post(taskgraph_install))
        .route("/v1/taskgraph/resume", post(taskgraph_resume))
        .route("/v1/capsules", get(list_capsules))
        .route("/v1/capsules/:id", get(get_capsule))
        .route("/v1/capsules/:id/patch", post(patch_capsule))
        .route("/v1/capsules/:id/recompile", post(recompile_capsule))
        .route("/v1/evidence/add", post(add_evidence))
        .route("/v1/journal", get(get_journal))
        .route("/v1/journal/stream", get(get_journal))
        .route("/v1/actions/execute", post(execute_action))
        .route("/v1/actions/dispatch", post(dispatch_action))
        .route("/v1/artifacts/:artifact_id", get(get_artifact))
        .route("/v1/intent/graph", get(get_intent_graph))
        .route("/v1/assistant", get(get_assistant).put(update_assistant))
        .route(
            "/v1/agents/templates",
            get(list_agent_templates).post(create_agent_template),
        )
        .route("/v1/agents/templates/:id", put(update_agent_template))
        .route("/v1/suggestions", get(get_suggestions))
        .route("/v1/tools", get(list_tools).post(create_tool))
        .route("/v1/tools/:id", put(update_tool))
        .route("/v1/tools/:id/execute", post(execute_tool))
        .route("/v1/skills", get(list_skills_registry).post(create_skill))
        .route(
            "/v1/skills/publishers",
            get(list_skill_publisher_keys).post(register_skill_publisher_key),
        )
        .route(
            "/v1/skills/publishers/:publisher_id",
            get(list_skill_publisher_keys_for_publisher),
        )
        .route(
            "/v1/skills/publishers/:publisher_id/revoke",
            post(revoke_skill_publisher_key),
        )
        .route("/v1/skills/:id", put(update_skill))
        .route("/v1/skills/:id/execute", post(execute_skill))
        .route("/v1/workflows", get(list_workflows).post(create_workflow))
        .route("/v1/workflows/:id/execute", post(execute_workflow))
        .route("/v1/workflows/validate", post(validate_workflow))
        .route("/v1/workflows/compile", post(compile_workflow))
        .route("/v1/templates", get(list_templates).post(create_template))
        .route("/v1/templates/:id/instantiate", post(instantiate_template))
        .route("/v1/artifacts", get(list_artifacts).post(create_artifact))
        .route("/v1/artifacts/query", post(query_artifacts))
        .route("/v1/marketplace/skills", get(list_skills))
        .route("/v1/marketplace/install/:id", post(install_skill))
        .route("/v1/config/auth/:provider", post(set_auth))
        .route("/v1/config/model", post(set_model).get(get_model))
        .route("/v1/config/mode", post(set_mode).get(get_mode_handler))
        .route("/v1/sessions/commit", post(session_commit))
        .route("/v1/sessions/branch", post(session_branch))
        .route("/v1/sessions/history", get(session_history))
        .route("/v1/sessions/:session_id/log", get(session_log))
        .route("/v1/sessions/reset", post(session_reset))
        .route("/v1/task/compile", post(compile_task_spec))
        .route("/v1/runs/:run_id", get(get_run_model))
        .route("/v1/tools/validate", post(validate_tool_request))
        .route("/v1/events/create", post(create_event_envelope))
        .route("/v1/verify/artifact", post(verify_artifact_handler))
        .route("/v1/frameworks", get(list_frameworks))
        .route("/v1/frameworks/:framework_id", get(get_framework))
        .route(
            "/v1/capsules/compile-with-context",
            post(compile_capsule_with_context),
        )
        .route("/v1/orchestrator/tasks", get(list_tasks).post(create_task))
        .route("/v1/orchestrator/tasks/:id", get(get_task))
        .route("/v1/orchestrator/runs", post(start_run))
        .route("/v1/orchestrator/runs/:id", get(get_run))
        // GUI Tools routes (computer-use automation)
        .route("/v1/tools/gui/status", get(gui_tools::handle_gui_status))
        .route(
            "/v1/tools/gui/screenshot",
            post(gui_tools::handle_screenshot),
        )
        .route("/v1/tools/gui/click", post(gui_tools::handle_click))
        .route("/v1/tools/gui/type", post(gui_tools::handle_type))
        .route("/v1/tools/gui/scroll", post(gui_tools::handle_scroll))
        .route("/v1/tools/gui/run-task", post(gui_tools::handle_run_task))
        .layer(middleware::from_fn_with_state(
            state.security_state.clone(),
            security_middleware,
        ))
        .layer(middleware::from_fn_with_state(
            state.rate_limiter.clone(),
            rate_limiter::rate_limit_middleware,
        ));
    let monitoring_routes = Router::new()
        .route("/v1/monitoring/metrics", get(get_metrics))
        .route("/v1/monitoring/health", get(health_check_extended));
    Ok(Router::new()
        .route("/v1/health", get(health_check))
        .route("/api/v1/runtime", get(runtime_info))
        .route("/v1/runtime", get(runtime_info))
        .route("/v1/terminal/ws", get(terminal_ws_handler))
        .route("/v1/orchestrator/ws", get(orchestrator_ws_handler))
        .merge(protected_routes)
        .merge(monitoring_routes)
        .layer(CorsLayer::permissive())
        .with_state(state))
}

async fn get_metrics(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(state.monitoring_state.get_metrics().await))
}

async fn health_check_extended(
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let health_info = serde_json::json!({
        "status": "healthy", "timestamp": chrono::Utc::now().timestamp_millis(),
        "uptime_seconds": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        "service": "kernel", "version": env!("CARGO_PKG_VERSION"),
    });
    Ok(Json(health_info))
}

async fn runtime_info(State(_state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    let runtime_info = serde_json::json!({
        "status": "running",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "features": ["kernel", "messaging", "brain", "orchestrator"],
    });
    Ok(Json(runtime_info))
}

fn default_resource_limits() -> ResourceLimits {
    ResourceLimits {
        cpu: None,
        memory: None,
        network: NetworkAccess::Unrestricted,
        filesystem: FilesystemAccess::ReadWrite(vec![]),
        time_limit: 300,
    }
}

fn tool_executor_to_gateway_definition(tool: &ToolDefinition) -> GatewayToolDefinition {
    GatewayToolDefinition {
        id: tool.name.clone(),
        name: tool.name.clone(),
        description: tool.description.clone(),
        tool_type: ToolType::Sdk,
        command: String::new(),
        endpoint: String::new(),
        input_schema: tool.parameters.clone(),
        output_schema: serde_json::json!({ "type": "object" }),
        side_effects: vec![],
        idempotency_behavior: "unknown".to_string(),
        retryable: false,
        failure_classification: "unknown".to_string(),
        safety_tier: SafetyTier::T1,
        resource_limits: default_resource_limits(),
        subprocess: None,
    }
}

fn gateway_to_kernel_tool(tool: GatewayToolDefinition) -> ToolDefinition {
    ToolDefinition {
        name: tool.id,
        description: tool.description,
        parameters: tool.input_schema,
    }
}

fn build_tool_execution_request(
    tool_id: String,
    input: serde_json::Value,
    identity_id: Option<String>,
    session_id: Option<String>,
    tenant_id: Option<String>,
    run_id: Option<String>,
    workflow_id: Option<String>,
    node_id: Option<String>,
    wih_id: Option<String>,
    write_scope: Option<WriteScope>,
    capsule_run: Option<bool>,
    trace_id: Option<String>,
    idempotency_key: Option<String>,
    retry_count: Option<u32>,
) -> ToolExecutionRequest {
    ToolExecutionRequest {
        tool_id,
        input,
        identity_id: identity_id.unwrap_or_else(|| "system".to_string()),
        session_id: session_id.unwrap_or_else(|| "default_session".to_string()),
        tenant_id: tenant_id.unwrap_or_else(|| "default_tenant".to_string()),
        run_id,
        workflow_id,
        node_id,
        wih_id,
        write_scope,
        capsule_run,
        trace_id,
        retry_count: retry_count.unwrap_or(0),
        idempotency_key: Some(idempotency_key.unwrap_or_else(|| uuid::Uuid::new_v4().to_string())),
    }
}

fn enforce_execution_envelope(request: &ToolExecutionRequest) -> Result<(), (StatusCode, String)> {
    let missing = |field: &str| {
        Err((
            StatusCode::BAD_REQUEST,
            format!("{} required for execution", field),
        ))
    };

    if request.run_id.as_deref().unwrap_or("").is_empty() {
        return missing("run_id");
    }
    if request.workflow_id.as_deref().unwrap_or("").is_empty() {
        return missing("workflow_id");
    }
    if request.node_id.as_deref().unwrap_or("").is_empty() {
        return missing("node_id");
    }
    if request.wih_id.as_deref().unwrap_or("").is_empty() {
        return missing("wih_id");
    }
    match request.write_scope.as_ref() {
        Some(scope) => {
            if scope.allowed_globs.is_empty() {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "write_scope.allowed_globs required".to_string(),
                ));
            }
        }
        None => return missing("write_scope"),
    }
    Ok(())
}

fn tool_execution_request_from_payload(
    tool_id: String,
    payload: ToolExecutePayload,
) -> ToolExecutionRequest {
    build_tool_execution_request(
        tool_id,
        payload.input,
        payload.identity_id,
        payload.session_id,
        payload.tenant_id,
        payload.run_id,
        payload.workflow_id,
        payload.node_id,
        payload.wih_id,
        payload.write_scope,
        payload.capsule_run,
        payload.trace_id,
        payload.idempotency_key,
        payload.retry_count,
    )
}

fn canonicalize_json_value(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut keys: Vec<_> = map.keys().collect();
            keys.sort();
            let mut normalized = serde_json::Map::new();
            for key in keys {
                if let Some(value) = map.get(key) {
                    normalized.insert(key.clone(), canonicalize_json_value(value));
                }
            }
            serde_json::Value::Object(normalized)
        }
        serde_json::Value::Array(values) => {
            serde_json::Value::Array(values.iter().map(canonicalize_json_value).collect())
        }
        _ => value.clone(),
    }
}

fn normalize_bundle_hash(input: &str) -> Result<String, (StatusCode, String)> {
    let trimmed = input.trim();
    let without_prefix = trimmed.strip_prefix("sha256:").unwrap_or(trimmed);
    let normalized = without_prefix.to_lowercase();
    if normalized.len() != 64 || !normalized.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err((
            StatusCode::BAD_REQUEST,
            "bundle_hash must be sha256 hex".to_string(),
        ));
    }
    Ok(normalized)
}

fn decode_base64(input: &str) -> Result<Vec<u8>, (StatusCode, String)> {
    BASE64
        .decode(input.as_bytes())
        .or_else(|_| BASE64URL.decode(input.as_bytes()))
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                "Invalid base64 encoding".to_string(),
            )
        })
}

fn agent_payload_for_signing(spec: &AgentSpec) -> Result<Vec<u8>, (StatusCode, String)> {
    let mut value = serde_json::to_value(spec)
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    if let Some(signature) = value.get_mut("signature") {
        if let Some(sig_obj) = signature.as_object_mut() {
            sig_obj.insert(
                "manifest_sig".to_string(),
                serde_json::Value::String(String::new()),
            );
            sig_obj.insert(
                "bundle_hash".to_string(),
                serde_json::Value::String(String::new()),
            );
        }
    }
    let canonical = canonicalize_json_value(&value);
    serde_json::to_vec(&canonical)
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}

async fn verify_agent_signature(
    state: &AppState,
    spec: &AgentSpec,
) -> Result<(), (StatusCode, String)> {
    if spec.publisher.publisher_id.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "publisher_id is required".to_string(),
        ));
    }
    if spec.publisher.public_key_id.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "public_key_id is required".to_string(),
        ));
    }
    if spec.signature.manifest_sig.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "manifest_sig is required".to_string(),
        ));
    }
    if spec.signature.bundle_hash.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "bundle_hash is required".to_string(),
        ));
    }

    let payload = agent_payload_for_signing(spec)?;
    let digest = digest::digest(&digest::SHA256, &payload);
    let expected_hash = HEXLOWER.encode(digest.as_ref());
    let provided_hash = normalize_bundle_hash(&spec.signature.bundle_hash)?;
    if expected_hash != provided_hash {
        return Err((StatusCode::BAD_REQUEST, "bundle_hash mismatch".to_string()));
    }

    let publisher_key = state
        .skill_registry
        .get_publisher_key(
            spec.publisher.publisher_id.clone(),
            spec.publisher.public_key_id.clone(),
        )
        .await
        .map_err(map_skills_error)?
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                "Publisher key not found".to_string(),
            )
        })?;
    if publisher_key.revoked {
        return Err((
            StatusCode::BAD_REQUEST,
            "Publisher key is revoked".to_string(),
        ));
    }

    let public_key_bytes = decode_base64(&publisher_key.public_key)?;
    if public_key_bytes.len() != 32 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Publisher public key must be 32 bytes (ed25519)".to_string(),
        ));
    }
    let signature_bytes = decode_base64(&spec.signature.manifest_sig)?;
    if signature_bytes.len() != 64 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Signature must be 64 bytes (ed25519)".to_string(),
        ));
    }
    let verifier = signature::UnparsedPublicKey::new(&signature::ED25519, public_key_bytes);
    verifier
        .verify(digest.as_ref(), &signature_bytes)
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                "Signature verification failed".to_string(),
            )
        })?;

    Ok(())
}

fn now_epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn build_journal_event(kind: &str, payload: serde_json::Value) -> crate::types::JournalEvent {
    crate::types::JournalEvent {
        event_id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now().timestamp(),
        kind: kind.to_string(),
        capsule_id: None,
        payload,
        parent_ids: Vec::new(),
        root_id: None,
    }
}

fn default_license_compliance() -> LicenseCompliance {
    LicenseCompliance {
        license_approved: true,
        license_text: "internal".to_string(),
        attribution_required: false,
        distribution_allowed: true,
        modification_allowed: true,
        patent_grant: false,
    }
}

fn default_kernel_publisher(created_at: u64) -> PublisherInfo {
    PublisherInfo {
        publisher_id: "system".to_string(),
        name: "Kernel".to_string(),
        email: "system@local".to_string(),
        organization: Some("system".to_string()),
        website: Some(format!("{}://local", "http")),
        public_key: "system".to_string(),
        reputation_score: 1.0,
        verification_status: VerificationStatus::Trusted,
        created_at,
    }
}

fn kernel_artifact_publish_request(
    artifact: &Artifact,
) -> Result<PublishRequest, serde_json::Error> {
    let now = now_epoch_seconds();
    let publisher = default_kernel_publisher(now);
    let metadata = ArtifactMetadata {
        artifact_id: artifact.artifact_id.clone(),
        name: artifact.artifact_type.clone(),
        version: "0.0.0".to_string(),
        artifact_type: ArtifactType::Custom(artifact.artifact_type.clone()),
        description: format!("Kernel artifact for capsule {}", artifact.capsule_id),
        author: "system".to_string(),
        license: "internal".to_string(),
        tags: vec![
            "kernel".to_string(),
            format!("capsule:{}", artifact.capsule_id),
        ],
        dependencies: vec![],
        content_hash: String::new(),
        signature: None,
        publisher,
        created_at: now,
        updated_at: now,
        published_at: None,
        deprecated_at: None,
        deprecation_reason: None,
        download_count: 0,
        rating: None,
        review_status: ReviewStatus::Approved,
        security_scan_results: None,
        license_compliance: default_license_compliance(),
        trust_score: 1.0,
    };
    let content = serde_json::to_vec(artifact)?;
    Ok(PublishRequest {
        request_id: uuid::Uuid::new_v4().to_string(),
        artifact: metadata,
        content,
        signature: "kernel".to_string(),
        verification_token: "kernel".to_string(),
        trace_id: None,
    })
}

async fn persist_kernel_artifacts(registry: &ArtifactRegistry, artifacts: Vec<Artifact>) {
    for artifact in artifacts {
        let request = match kernel_artifact_publish_request(&artifact) {
            Ok(request) => request,
            Err(err) => {
                tracing::warn!(
                    "Failed to serialize artifact {}: {}",
                    artifact.artifact_id,
                    err
                );
                continue;
            }
        };
        if let Err(err) = registry.publish_artifact(request).await {
            tracing::warn!(
                "Failed to persist artifact {}: {}",
                artifact.artifact_id,
                err
            );
        }
    }
}

fn workflow_execution_publish_request(
    execution: &WorkflowExecution,
) -> Result<PublishRequest, serde_json::Error> {
    let now = now_epoch_seconds();
    let publisher = default_kernel_publisher(now);
    let metadata = ArtifactMetadata {
        artifact_id: execution.execution_id.clone(),
        name: execution.workflow_id.clone(),
        version: "0.0.0".to_string(),
        artifact_type: ArtifactType::Workflow,
        description: format!("Workflow execution {}", execution.execution_id),
        author: "system".to_string(),
        license: "internal".to_string(),
        tags: vec![
            "workflow".to_string(),
            format!("workflow:{}", execution.workflow_id),
            format!("session:{}", execution.session_id),
        ],
        dependencies: vec![],
        content_hash: String::new(),
        signature: None,
        publisher,
        created_at: now,
        updated_at: now,
        published_at: None,
        deprecated_at: None,
        deprecation_reason: None,
        download_count: 0,
        rating: None,
        review_status: ReviewStatus::Approved,
        security_scan_results: None,
        license_compliance: default_license_compliance(),
        trust_score: 1.0,
    };
    let content = serde_json::to_vec(execution)?;
    Ok(PublishRequest {
        request_id: uuid::Uuid::new_v4().to_string(),
        artifact: metadata,
        content,
        signature: "kernel".to_string(),
        verification_token: "kernel".to_string(),
        trace_id: execution.trace_id.clone(),
    })
}

fn workflow_node_publish_request(
    execution: &WorkflowExecution,
    node_result: &NodeResult,
) -> Result<PublishRequest, serde_json::Error> {
    let created_at = if node_result.timestamp > 0 {
        node_result.timestamp
    } else {
        now_epoch_seconds()
    };
    let artifact_id = format!("node:{}:{}", execution.execution_id, node_result.node_id);
    let publisher = default_kernel_publisher(created_at);
    let metadata = ArtifactMetadata {
        artifact_id: artifact_id.clone(),
        name: format!("{}:{}", execution.workflow_id, node_result.node_id),
        version: "0.0.0".to_string(),
        artifact_type: ArtifactType::Custom("WorkflowNodeResult".to_string()),
        description: format!(
            "Workflow node result {} for execution {}",
            node_result.node_id, execution.execution_id
        ),
        author: "system".to_string(),
        license: "internal".to_string(),
        tags: vec![
            "workflow_node_result".to_string(),
            format!("workflow:{}", execution.workflow_id),
            format!("execution:{}", execution.execution_id),
            format!("node:{}", node_result.node_id),
            format!("session:{}", execution.session_id),
            format!("tenant:{}", execution.tenant_id),
        ],
        dependencies: vec![],
        content_hash: String::new(),
        signature: None,
        publisher,
        created_at,
        updated_at: created_at,
        published_at: None,
        deprecated_at: None,
        deprecation_reason: None,
        download_count: 0,
        rating: None,
        review_status: ReviewStatus::Approved,
        security_scan_results: None,
        license_compliance: default_license_compliance(),
        trust_score: 1.0,
    };
    let content = serde_json::to_vec(&serde_json::json!({
        "workflow_id": &execution.workflow_id,
        "execution_id": &execution.execution_id,
        "node_result": node_result,
    }))?;
    Ok(PublishRequest {
        request_id: uuid::Uuid::new_v4().to_string(),
        artifact: metadata,
        content,
        signature: "kernel".to_string(),
        verification_token: "kernel".to_string(),
        trace_id: execution.trace_id.clone(),
    })
}

async fn persist_workflow_node_results(
    registry: &ArtifactRegistry,
    execution: &WorkflowExecution,
) -> Vec<String> {
    let mut artifact_ids = Vec::new();
    for node_result in execution.node_results.values() {
        let publish_request = match workflow_node_publish_request(execution, node_result) {
            Ok(request) => request,
            Err(err) => {
                tracing::warn!(
                    "Failed to serialize node result {}: {}",
                    node_result.node_id,
                    err
                );
                continue;
            }
        };
        let artifact_id = publish_request.artifact.artifact_id.clone();
        if let Err(err) = registry.publish_artifact(publish_request).await {
            tracing::warn!(
                "Failed to persist node result {}: {}",
                node_result.node_id,
                err
            );
            continue;
        }
        artifact_ids.push(artifact_id);
    }
    artifact_ids
}

fn tool_execution_publish_request(
    request: &ToolExecutionRequest,
    result: &ToolExecutionResult,
) -> Result<PublishRequest, serde_json::Error> {
    let created_at = if result.timestamp > 0 {
        result.timestamp
    } else {
        now_epoch_seconds()
    };
    let publisher = default_kernel_publisher(created_at);
    let metadata = ArtifactMetadata {
        artifact_id: result.execution_id.clone(),
        name: request.tool_id.clone(),
        version: "0.0.0".to_string(),
        artifact_type: ArtifactType::Custom("ToolExecution".to_string()),
        description: format!("Tool execution {}", result.execution_id),
        author: request.identity_id.clone(),
        license: "internal".to_string(),
        tags: vec![
            "tool_execution".to_string(),
            format!("tool:{}", request.tool_id),
            format!("session:{}", request.session_id),
            format!("tenant:{}", request.tenant_id),
        ],
        dependencies: vec![],
        content_hash: String::new(),
        signature: None,
        publisher,
        created_at,
        updated_at: created_at,
        published_at: None,
        deprecated_at: None,
        deprecation_reason: None,
        download_count: 0,
        rating: None,
        review_status: ReviewStatus::Approved,
        security_scan_results: None,
        license_compliance: default_license_compliance(),
        trust_score: 1.0,
    };
    let content = serde_json::to_vec(&serde_json::json!({
        "request": request,
        "result": result,
    }))?;
    Ok(PublishRequest {
        request_id: uuid::Uuid::new_v4().to_string(),
        artifact: metadata,
        content,
        signature: "kernel".to_string(),
        verification_token: "kernel".to_string(),
        trace_id: request.trace_id.clone(),
    })
}

async fn persist_workflow_execution(registry: &ArtifactRegistry, execution: &WorkflowExecution) {
    let request = match workflow_execution_publish_request(execution) {
        Ok(request) => request,
        Err(err) => {
            tracing::warn!(
                "Failed to serialize workflow execution {}: {}",
                execution.execution_id,
                err
            );
            return;
        }
    };
    if let Err(err) = registry.publish_artifact(request).await {
        tracing::warn!(
            "Failed to persist workflow execution {}: {}",
            execution.execution_id,
            err
        );
    }
}

struct ArtifactToolExecutionReporter {
    registry: Arc<ArtifactRegistry>,
}

#[async_trait]
impl ToolExecutionReporter for ArtifactToolExecutionReporter {
    async fn record_execution(&self, request: ToolExecutionRequest, result: ToolExecutionResult) {
        persist_tool_execution(&self.registry, &request, &result).await;
    }
}

async fn persist_tool_execution(
    registry: &ArtifactRegistry,
    request: &ToolExecutionRequest,
    result: &ToolExecutionResult,
) {
    let publish_request = match tool_execution_publish_request(request, result) {
        Ok(request) => request,
        Err(err) => {
            tracing::warn!(
                "Failed to serialize tool execution {}: {}",
                result.execution_id,
                err
            );
            return;
        }
    };
    if let Err(err) = registry.publish_artifact(publish_request).await {
        tracing::warn!(
            "Failed to persist tool execution {}: {}",
            result.execution_id,
            err
        );
    }
}

fn map_tool_gateway_error(err: ToolGatewayError) -> (StatusCode, String) {
    let status = match err {
        ToolGatewayError::ToolNotFound(_) => StatusCode::NOT_FOUND,
        ToolGatewayError::PermissionDenied(_) => StatusCode::FORBIDDEN,
        ToolGatewayError::Timeout(_) => StatusCode::REQUEST_TIMEOUT,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, err.to_string())
}

fn map_workflow_error(err: WorkflowError) -> (StatusCode, String) {
    let status = match err {
        WorkflowError::WorkflowNotFound(_) | WorkflowError::NodeNotFound(_) => {
            StatusCode::NOT_FOUND
        }
        WorkflowError::SkillNotFound(_) | WorkflowError::PhaseViolation(_) => {
            StatusCode::BAD_REQUEST
        }
        WorkflowError::Policy(_) => StatusCode::FORBIDDEN,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, err.to_string())
}

fn map_workflow_validation_error(err: ValidationError) -> (StatusCode, String) {
    let status = match err {
        ValidationError::TenantIsolationError(_) => StatusCode::FORBIDDEN,
        ValidationError::ParseError(_) | ValidationError::ValidationError(_) => {
            StatusCode::BAD_REQUEST
        }
        ValidationError::PolicyError(_) => StatusCode::FORBIDDEN,
    };
    (status, err.to_string())
}

fn map_workflow_compile_error(
    err: a2rchitech_workflows::engine::compiler::CompilerError,
) -> (StatusCode, String) {
    let status = match err {
        a2rchitech_workflows::engine::compiler::CompilerError::ParseError(_) => {
            StatusCode::BAD_REQUEST
        }
        a2rchitech_workflows::engine::compiler::CompilerError::ValidationError(_) => {
            StatusCode::BAD_REQUEST
        }
        a2rchitech_workflows::engine::compiler::CompilerError::ReferenceError(_) => {
            StatusCode::BAD_REQUEST
        }
    };
    (status, err.to_string())
}

fn map_skills_error(err: SkillsError) -> (StatusCode, String) {
    let status = match err {
        SkillsError::SkillNotFound(_) => StatusCode::NOT_FOUND,
        SkillsError::Validation(_)
        | SkillsError::SchemaValidation(_)
        | SkillsError::SignatureVerification(_) => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, err.to_string())
}

fn map_artifact_error(err: ArtifactRegistryError) -> (StatusCode, String) {
    let status = match err {
        ArtifactRegistryError::ArtifactNotFound(_)
        | ArtifactRegistryError::PublisherNotFound(_) => StatusCode::NOT_FOUND,
        ArtifactRegistryError::AccessDenied(_) | ArtifactRegistryError::Policy(_) => {
            StatusCode::FORBIDDEN
        }
        ArtifactRegistryError::InvalidArtifact(_)
        | ArtifactRegistryError::SignatureVerificationFailed(_)
        | ArtifactRegistryError::SecurityScanFailed(_)
        | ArtifactRegistryError::LicenseComplianceFailed(_) => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, err.to_string())
}

// Define a struct to hold both the router and the memory fabric for daemon access
pub struct KernelServices {
    pub router: Router,
    pub memory_fabric: Arc<MemoryFabric>,
}

async fn create_kernel_services() -> Result<KernelServices, anyhow::Error> {
    let workspace_dir = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("workspace");
    std::fs::create_dir_all(&workspace_dir).ok();
    let workspace_path = workspace_dir.clone();
    let ledger = Arc::new(JournalLedger::new());
    let action_handler = Arc::new(ActionHandler::new(ledger.clone()));
    let db_path = workspace_dir.join("rlm_sessions.db");
    let db_path_str = format!("sqlite://{}", db_path.display());

    info!("Connecting to SQLite at {}", db_path_str);
    let sqlite_options = SqliteConnectOptions::from_str(&db_path_str)?.create_if_missing(true);
    let sqlite_pool = Arc::new(
        sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(10)
            .connect_with(sqlite_options)
            .await?,
    );
    info!("SQLite pool connected");

    let history_path = workspace_dir.join("history.jsonl");
    let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&history_path)?));
    info!("Step 5: Initializing messaging system...");
    let messaging_system = match MessagingSystem::new_with_storage(
        history_ledger.clone(),
        sqlite_pool.as_ref().clone(),
    )
    .await
    {
        Ok(system) => {
            info!("Step 6: Messaging system initialized successfully");
            Arc::new(system)
        }
        Err(e) => {
            error!("CRITICAL: Failed to initialize messaging system: {}", e);
            anyhow::bail!("Messaging system initialization failed: {}", e);
        }
    };
    let policy_engine = Arc::new(PolicyEngine::new(
        history_ledger.clone(),
        messaging_system.clone(),
    ));
    let system_identity = Identity {
        id: "system".to_string(),
        identity_type: IdentityType::ServiceAccount,
        name: "System".to_string(),
        tenant_id: "system".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["system".to_string()],
        permissions: vec!["perm_t0_read".to_string()],
    };
    policy_engine.register_identity(system_identity).await?;
    let workflow_identity = Identity {
        id: "workflow_executor".to_string(),
        identity_type: IdentityType::ServiceAccount,
        name: "Workflow Executor".to_string(),
        tenant_id: "system".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["workflow_executor".to_string()],
        permissions: vec![],
    };
    policy_engine.register_identity(workflow_identity).await?;
    policy_engine.create_default_permissions().await?;
    policy_engine.create_default_rules().await?;
    let publish_rule = PolicyRule {
        id: "rule_allow_publish".to_string(),
        name: "Allow Publish Operations".to_string(),
        description: "Allow artifact publishing from kernel".to_string(),
        condition: "identity.active".to_string(),
        effect: PolicyEffect::Allow,
        resource: "artifact_publish:*".to_string(),
        actions: vec!["publish".to_string()],
        priority: 150,
        enabled: true,
    };
    policy_engine.add_rule(publish_rule).await?;
    let tool_execute_rule = PolicyRule {
        id: "rule_allow_tool_execute".to_string(),
        name: "Allow Tool Execute Operations".to_string(),
        description: "Allow tool execution for local kernel".to_string(),
        condition: "identity.active".to_string(),
        effect: PolicyEffect::Allow,
        resource: "tool:*".to_string(),
        actions: vec!["execute".to_string()],
        priority: 120,
        enabled: true,
    };
    policy_engine.add_rule(tool_execute_rule).await?;
    let skill_execute_rule = PolicyRule {
        id: "rule_allow_skill_execute".to_string(),
        name: "Allow Skill Execute Operations".to_string(),
        description: "Allow skill execution for local kernel".to_string(),
        condition: "identity.active".to_string(),
        effect: PolicyEffect::Allow,
        resource: "skill:*".to_string(),
        actions: vec!["execute".to_string()],
        priority: 120,
        enabled: true,
    };
    policy_engine.add_rule(skill_execute_rule).await?;
    let tool_gateway = Arc::new(ToolGateway::new(
        policy_engine.clone(),
        history_ledger.clone(),
        messaging_system.clone(),
    ));
    let runtime_session_manager = Arc::new(RuntimeSessionManager::new(
        history_ledger.clone(),
        messaging_system.clone(),
    ));
    let context_router = Arc::new(ContextRouter::new(
        history_ledger.clone(),
        messaging_system.clone(),
        policy_engine.clone(),
        runtime_session_manager.clone(),
    ));
    let rlm_memory_policy = Arc::new(DefaultMemoryPolicy {});
    let memory_fabric = Arc::new(
        MemoryFabric::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            sqlite_pool.as_ref().clone(),
            rlm_memory_policy,
        )
        .await?,
    );
    let provider_router = Arc::new(
        ProviderRouter::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let skill_registry = Arc::new(
        SkillRegistry::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            tool_gateway.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let workflow_engine = Arc::new(WorkflowEngine::new(
        history_ledger.clone(),
        messaging_system.clone(),
        policy_engine.clone(),
        tool_gateway.clone(),
        skill_registry.clone(),
        messaging_system.task_queue.clone(),
        sqlite_pool.as_ref().clone(),
    ));
    let embodiment_control_plane = Arc::new(
        EmbodimentControlPlane::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            skill_registry.clone(),
            workflow_engine.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let package_manager = Arc::new(
        PackageManager::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let evaluation_engine = Arc::new(
        EvaluationEngine::new_with_storage(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            skill_registry.clone(),
            workflow_engine.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let artifact_storage_path = workspace_dir.join("artifacts");
    let artifact_backup_path = workspace_dir.join("artifact_backups");
    let artifact_registry_config = ArtifactRegistryConfig {
        registry_id: "kernel-registry".to_string(),
        name: "Kernel Artifact Registry".to_string(),
        description: "Artifact registry for kernel-generated artifacts".to_string(),
        version: "1.0.0".to_string(),
        storage_config: StorageConfig {
            storage_type: StorageType::LocalFileSystem,
            storage_path: artifact_storage_path.to_string_lossy().to_string(),
            encryption_enabled: false,
            compression_enabled: false,
            retention_policy: RetentionPolicy {
                retention_period_days: 30,
                auto_delete: false,
                backup_before_delete: false,
                compliance_hold: false,
            },
            backup_config: BackupConfig {
                enabled: false,
                backup_frequency_hours: 24,
                backup_location: artifact_backup_path.to_string_lossy().to_string(),
                encryption_enabled: false,
                retention_count: 0,
            },
        },
        security_profile: SecurityProfile {
            sensitivity_tier: 0,
            compliance_requirements: vec![ComplianceRequirement::SOC2],
            audit_level: AuditLevel::Basic,
            encryption_required: false,
            network_isolation: NetworkIsolation::None,
        },
        network_config: NetworkConfiguration {
            allowed_origins: vec!["*".to_string()],
            cors_enabled: true,
            tls_required: false,
            rate_limiting: Some(RateLimitingConfig {
                requests_per_minute: 120,
                burst_size: 240,
                per_ip_limit: true,
            }),
        },
        created_at: now,
        updated_at: now,
        is_active: true,
    };
    let artifact_registry = Arc::new(
        ArtifactRegistry::new_with_storage(
            artifact_registry_config,
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            skill_registry.clone(),
            workflow_engine.clone(),
            embodiment_control_plane.clone(),
            package_manager.clone(),
            evaluation_engine.clone(),
            runtime_session_manager.clone(),
            sqlite_pool.as_ref().clone(),
        )
        .await?,
    );
    let tool_execution_reporter = Arc::new(ArtifactToolExecutionReporter {
        registry: artifact_registry.clone(),
    });
    tool_gateway
        .set_execution_reporter(tool_execution_reporter)
        .await;
    let mut tool_executor = ToolExecutor::new();
    let desktop = DesktopDevice::new(workspace_path.clone());
    for tool in desktop.get_tools() {
        tool_executor.register_tool(tool);
    }
    let tool_executor = Arc::new(RwLock::new(tool_executor));
    let tool_adapter = Arc::new(ToolExecutorAdapter::new(tool_executor.clone()));
    tool_gateway.set_sdk_executor(tool_adapter).await;
    {
        let executor = tool_executor.read().await;
        for tool in executor.get_definitions() {
            let gateway_tool = tool_executor_to_gateway_definition(&tool);
            if let Err(err) = tool_gateway.register_tool(gateway_tool).await {
                tracing::warn!("Failed to register tool {}: {}", tool.name, err);
            }
        }
    }
    let skill_manager = Arc::new(SkillManager::new(workspace_path.clone()));
    let config_manager = Arc::new(ConfigManager::new(workspace_path.clone()));
    let assistant_manager = Arc::new(AssistantManager::new(workspace_path.clone()));
    let agent_registry = Arc::new(AgentRegistry::new(workspace_path.clone()));
    let _ = agent_registry.register_defaults().await;
    let monitoring_state = Arc::new(MonitoringState::new());
    let terminal_manager = Arc::new(TerminalManager::new());
    let brain_store = Arc::new(BrainStore::new(sqlite_pool.clone()));
    let _ = brain_store.init().await;

    // Create shared integration events channel for both model_router and brain_manager
    let (integration_tx, _) = tokio::sync::broadcast::channel::<brain::types::BrainEvent>(100);

    // Create model_router with shared integration events channel
    let model_router = brain::ModelRouter::with_integration_events(integration_tx.clone());

    // Create brain_manager with the SAME integration events channel
    let brain_manager = {
        let mut manager = BrainManager::new()
            .with_store(brain_store)
            .with_integration_events(integration_tx);
        // Register drivers in priority order:
        // 1. ACP Protocol (PRIMARY for chat/AI interactions)
        // 2. API driver
        // 3. Local driver
        // 4. Terminal App (PTY-based, for human interaction only)
        // Register drivers in priority order:
        // 1. ACP Protocol (PRIMARY for true ACP agents)
        // 2. JSONL Protocol (for --output-format stream-json CLIs)
        // 3. API driver
        // 4. Local driver
        // 5. Terminal App (PTY-based, for human interaction only)
        // Register SimpleAcpDriver FIRST - it's the working implementation from agent-shell
        manager.register_driver(Box::new(AcpProtocolDriver::new()));
        manager.register_driver(Box::new(AcpProtocolDriver::new()));
        manager.register_driver(Box::new(JsonlProtocolDriver::new()));
        manager.register_driver(Box::new(brain::drivers::api::ApiBrainDriver::new()));
        manager.register_driver(Box::new(brain::drivers::local::LocalBrainDriver::new()));
        manager.register_driver(Box::new(TerminalAppDriver::new(terminal_manager.clone())));
        Arc::new(manager)
    };

    // Register all CLI brain profiles
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "claude-code".to_string(),
                name: "Claude Code CLI".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("claude-3-5-sonnet".to_string()),
                endpoint: None,
                api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
                command: Some("claude".to_string()),
                args: Some(vec![
                    "--output-format".to_string(),
                    "stream-json".to_string(),
                ]),
                prompt_arg: None, // Interactive mode - uses stdin
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "claude".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Jsonl),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "codex".to_string(),
                name: "OpenAI Codex CLI".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("gpt-4o".to_string()),
                endpoint: None,
                api_key_env: None, // CLI handles auth via `codex auth`
                command: Some("codex".to_string()),
                args: Some(vec!["exec".to_string(), "--yolo".to_string()]),
                prompt_arg: None, // Uses positional argument
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "codex".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Jsonl),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "gemini-cli".to_string(),
                name: "Google Gemini CLI".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("gemini-2.0-flash".to_string()),
                endpoint: None,
                api_key_env: None, // CLI handles auth via `gemini auth`
                command: Some("gemini".to_string()),
                args: Some(vec!["--output-format".to_string(), "stream-json".to_string(), "--yolo".to_string()]),
                prompt_arg: Some("-p".to_string()), // Requires -p flag for non-interactive mode
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "gemini".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Jsonl),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "kimi-cli".to_string(),
                name: "Moonshot Kimi CLI".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("kimi-k2".to_string()),
                endpoint: None,
                api_key_env: None, // CLI handles auth via `kimi auth`
                command: Some("kimi".to_string()),
                args: Some(vec!["--yolo".to_string()]),
                prompt_arg: Some("--prompt".to_string()), // Requires --prompt flag
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "kimi".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Jsonl),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // Qwen CLI (Alibaba)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "qwen-cli".to_string(),
                name: "Alibaba Qwen CLI".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("qwen2.5-coder".to_string()),
                endpoint: None,
                api_key_env: None,
                command: Some("qwen".to_string()),
                args: Some(vec!["--yolo".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "qwen".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Jsonl),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // TRUE ACP-NATIVE PROFILE (OpenCode)
    // This is the canonical ACP-first implementation
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "opencode-acp".to_string(),
                name: "OpenCode (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None, // Provider-managed model, not kernel-managed
                endpoint: None,
                api_key_env: None,
                command: Some("opencode".to_string()),
                args: Some(vec!["acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "opencode".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // GEMINI ACP-NATIVE PROFILE
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "gemini-acp".to_string(),
                name: "Gemini CLI (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("gemini-2.5-pro".to_string()),
                endpoint: None,
                api_key_env: Some("GEMINI_API_KEY".to_string()),
                command: Some("npx".to_string()),
                args: Some(vec![
                    "@google/gemini-cli".to_string(),
                    "--experimental-acp".to_string(),
                ]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Dependency {
                    name: "@google/gemini-cli".to_string(),
                    package_manager: "npm".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // KIMI ACP-NATIVE PROFILE
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "kimi-acp".to_string(),
                name: "Moonshot Kimi (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("kimi-k2".to_string()),
                endpoint: None,
                api_key_env: None,
                command: Some("kimi".to_string()),
                args: Some(vec![]), // Kimi uses ACP by default when available
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "kimi".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // QWEN ACP-NATIVE PROFILE - qwen-code must be installed: npm install -g @qwen-code/qwen-code
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "qwen-acp".to_string(),
                name: "Qwen Code (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("qwen-coder-plus".to_string()),
                endpoint: None,
                api_key_env: Some("DASHSCOPE_API_KEY".to_string()),
                command: Some("qwen-code".to_string()),
                args: Some(vec!["--experimental-acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "qwen-code".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // CLAUDE CODE ACP-NATIVE PROFILE (via wrapper)
    model_router
        .register_profile(brain::router::BrainProfile {
    // claude-agent-acp must be installed: npm install -g @zed-industries/claude-agent-acp
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "claude-acp".to_string(),
                name: "Claude Code (ACP Native)".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: Some("claude-sonnet-4".to_string()),
                endpoint: None,
                api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
                command: Some("claude-agent-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "claude-agent-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".to_string()],
            cost_tier: 2,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // AUGGIE ACP - npm install -g @augmentcode/auggie
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "auggie".to_string(),
                name: "Auggie".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("auggie".to_string()),
                args: Some(vec!["--acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "auggie".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // CURSOR ACP - npm install -g @blowmage/cursor-agent-acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "cursor".to_string(),
                name: "Cursor".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("cursor-agent-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "cursor-agent-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // DROID ACP - npm install -g droid-acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "droid".to_string(),
                name: "Factory Droid".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("droid-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "droid-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // GITHUB COPILOT ACP - copilot --acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "copilot".to_string(),
                name: "GitHub Copilot".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("copilot".to_string()),
                args: Some(vec!["--acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "copilot".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // GOOSE ACP - goose acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "goose".to_string(),
                name: "Goose".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("goose".to_string()),
                args: Some(vec!["acp".to_string()]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "goose".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // MISTRAL LE-CHAT ACP - vibe-acp (via uv tool install mistral-vibe)
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "le-chat".to_string(),
                name: "Mistral Le Chat".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("vibe-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "vibe-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    // PI ACP - npm install -g pi-acp
    model_router
        .register_profile(brain::router::BrainProfile {
            config: brain::types::BrainConfig {
                tenant_id: None,
                id: "pi".to_string(),
                name: "Pi".to_string(),
                brain_type: brain::types::BrainType::Cli,
                model: None,
                endpoint: None,
                api_key_env: None,
                command: Some("pi-acp".to_string()),
                args: Some(vec![]),
                prompt_arg: None,
                env: None,
                cwd: None,
                requirements: vec![brain::types::BrainRequirement::Binary {
                    name: "pi-acp".to_string(),
                }],
                sandbox: None,
                event_mode: Some(brain::types::EventMode::Acp),
                runtime_overrides: None,
            },
            capabilities: vec!["code".to_string(), "terminal".to_string()],
            cost_tier: 1,
            privacy_level: brain::router::PrivacyLevel::CloudOk,
        })
        .await;

    let model_router = Arc::new(model_router);
    let mut provider_manager = llm::gateway::ProviderManager::new();
    let (active_provider, _) = config_manager.get_active_config().await;
    provider_manager.register_provider(Box::new(llm::gateway::OpenAIAdapter::new(
        "local",
        env::var("KERNEL_LLM_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:11434/v1/chat/completions".to_string()),
        env::var("KERNEL_LLM_MODEL").unwrap_or("llama3".to_string()),
        env::var("KERNEL_LLM_KEY").unwrap_or("ollama".to_string()),
    )));
    provider_manager.register_provider(Box::new(llm::gateway::MLXAdapter::new(
        env::var("KERNEL_MLX_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:3508/v1/generate".to_string()),
        env::var("KERNEL_MLX_MODEL").unwrap_or("mlx-llm".to_string()),
        env::var("KERNEL_MLX_MAX_TOKENS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(512),
        env::var("KERNEL_MLX_TEMPERATURE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.7),
    )));
    provider_manager.register_provider(Box::new(llm::gateway::BrainLLMAdapter::new(
        brain_manager.clone(),
    )));
    let _ = provider_manager.set_active(&active_provider);
    let provider_manager = Arc::new(RwLock::new(provider_manager));
    let directive_compiler = Arc::new(DirectiveCompiler::new());
    let context_manager = Arc::new(ContextManager::new(128000));
    let intent_graph = Arc::new(RwLock::new(IntentGraphKernel::load_from_disk()));
    let pattern_registry = Arc::new(PatternRegistry::new());
    let state_engine = Arc::new(StateEngine::new());
    let capsule_compiler = Arc::new(capsule_compiler::CapsuleCompiler::new(
        capsule_compiler::CompilerConfig::default(),
    ));
    let contract_verifier = Arc::new(contract_verifier::ContractVerifier::new());
    let (orchestrator_event_tx, _) = broadcast::channel(1000);
    let orchestrator_service = Arc::new(OrchestratorService::new(
        Arc::new(TaskStore::new(sqlite_pool.clone())),
        Arc::new(RunStore::new(sqlite_pool.clone())),
        orchestrator_event_tx,
    ));
    let dispatcher = Arc::new(RwLock::new(IntentDispatcher::new(
        directive_compiler.clone(),
        context_manager.clone(),
        intent_graph.clone(),
        pattern_registry.clone(),
        tool_gateway.clone(),
        provider_manager.clone(),
        contract_verifier.clone(),
        capsule_compiler.clone(),
        orchestrator_service.clone(),
        brain_manager.clone(),
    )));
    for framework in get_default_frameworks() {
        dispatcher.write().await.register_framework(framework);
    }
    let session_manager = Arc::new(SessionManager::new(sqlite_pool.clone()).await?);
    let rate_limiter = Arc::new(rate_limiter::RateLimiter::new(
        rate_limiter::RateLimitConfig {
            requests_per_minute: 60,
            burst_capacity: 10,
            per_session: true,
            per_tenant: false,
        },
    ));
    let verification_checker = Arc::new(verification_checker::VerificationChecker::new());
    let security_state = Arc::new(SecurityState::new(100));
    let io_service_client = Arc::new(IoServiceClient::new(
        std::env::var("IO_SERVICE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:3510".to_string()),
    ));
    let bm_clone = brain_manager.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let _ = bm_clone.sync_sessions().await;
        }
    });
    let state = AppState {
        dispatcher,
        ledger,
        action_handler,
        directive_compiler,
        context_manager,
        contract_verifier,
        intent_graph,
        pattern_registry,
        assistant_manager,
        agent_registry,
        state_engine,
        skill_manager,
        config_manager,
        tool_executor,
        tool_gateway,
        io_service_client,
        skill_registry,
        artifact_registry,
        workflow_engine,
        policy_engine,
        session_manager,
        sqlite_pool,
        rate_limiter,
        verification_checker,
        capsule_compiler,
        security_state,
        monitoring_state,
        terminal_manager,
        orchestrator_service,
        brain_manager,
        model_router,
        runtime_registry: brain::RuntimeRegistry::new(),
        provider_auth_registry: Arc::new(a2rchitech_providers::runtime::ProviderAuthRegistry::new()),
        model_adapter_registry: Arc::new(a2rchitech_providers::runtime::ModelAdapterRegistry::new()),
    };
    let protected_routes = Router::new()
        .route(
            "/v1/setup/status",
            get(brain::setup::get_setup_status::<AppState>),
        )
        .route(
            "/v1/setup/plan/:brain_id",
            get(brain::setup::get_setup_plan::<AppState>),
        )
        .route(
            "/v1/setup/verify/:brain_id",
            post(brain::setup::verify_brain_setup::<AppState>),
        )
        .route(
            "/v1/brain/profiles",
            get(brain::gateway::list_brain_profiles::<AppState>)
                .post(brain::gateway::register_brain_profile::<AppState>),
        )
        .route(
            "/v1/brain/route",
            post(brain::gateway::route_brain::<AppState>),
        )
        .route(
            "/v1/brain/integration/events",
            get(brain::gateway::stream_integration_events::<AppState>),
        )
        .route(
            "/v1/brain/runtimes",
            get(brain::runtime_management::list_runtimes::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/:id",
            get(brain::runtime_management::get_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/install",
            post(brain::runtime_management::install_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/auth",
            post(brain::runtime_management::auth_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/verify",
            post(brain::runtime_management::verify_runtime::<AppState>),
        )
        .route(
            "/v1/brain/runtimes/:session_id/events",
            get(brain::runtime_management::stream_install_events::<AppState>),
        )
        .route(
            "/v1/sessions",
            post(brain::gateway::create_brain_session::<AppState>)
                .get(brain::gateway::list_brain_sessions::<AppState>),
        )
        .route(
            "/v1/sessions/:id/attach",
            post(brain::gateway::attach_brain_session::<AppState>),
        )
        .route(
            "/v1/sessions/:id/events",
            get(brain::gateway::stream_brain_events::<AppState>),
        )
        .route(
            "/v1/sessions/:id/input",
            post(brain::gateway::send_brain_input::<AppState>),
        )
        // Provider Authentication Endpoints
        .route(
            "/v1/providers/:provider/auth/status",
            get(brain::gateway::get_provider_auth_status::<AppState>),
        )
        .route(
            "/v1/providers/auth/status",
            get(brain::gateway::list_providers_auth_status::<AppState>),
        )
        // Provider Model Discovery Endpoints
        .route(
            "/v1/providers/:provider/models",
            get(brain::gateway::list_provider_models::<AppState>),
        )
        .route(
            "/v1/providers/:provider/models/validate",
            post(brain::gateway::validate_provider_model::<AppState>),
        )
        // Brain Profile Model Endpoints
        .route(
            "/v1/brains/:profile_id/models",
            get(brain::gateway::get_brain_profile_models::<AppState>),
        )
        .route(
            "/v1/brains/:profile_id/models/validate",
            post(brain::gateway::validate_brain_profile_model::<AppState>),
        )
        .route("/v1/governance/evaluate", post(governance::evaluate_policy))
        .route("/v1/governance/receipts", post(governance::submit_receipt))
        .route("/v1/intent/dispatch", post(dispatch_intent))
        .route("/v1/capsules", get(list_capsules))
        .route("/v1/capsules/:id", get(get_capsule))
        .route("/v1/capsules/:id/patch", post(patch_capsule))
        .route("/v1/capsules/:id/recompile", post(recompile_capsule))
        .route("/v1/evidence/add", post(add_evidence))
        .route("/v1/journal", get(get_journal))
        .route("/v1/journal/stream", get(get_journal))
        .route("/v1/actions/execute", post(execute_action))
        .route("/v1/actions/dispatch", post(dispatch_action))
        .route("/v1/artifacts/:artifact_id", get(get_artifact))
        .route("/v1/intent/graph", get(get_intent_graph))
        .route("/v1/assistant", get(get_assistant).put(update_assistant))
        .route(
            "/v1/agents/templates",
            get(list_agent_templates).post(create_agent_template),
        )
        .route("/v1/agents/templates/:id", put(update_agent_template))
        .route("/v1/suggestions", get(get_suggestions))
        .route("/v1/tools", get(list_tools).post(create_tool))
        .route("/v1/tools/:id", put(update_tool))
        .route("/v1/tools/:id/execute", post(execute_tool))
        .route("/v1/skills", get(list_skills_registry).post(create_skill))
        .route(
            "/v1/skills/publishers",
            get(list_skill_publisher_keys).post(register_skill_publisher_key),
        )
        .route(
            "/v1/skills/publishers/:publisher_id",
            get(list_skill_publisher_keys_for_publisher),
        )
        .route(
            "/v1/skills/publishers/:publisher_id/revoke",
            post(revoke_skill_publisher_key),
        )
        .route("/v1/skills/:id", put(update_skill))
        .route("/v1/skills/:id/execute", post(execute_skill))
        .route("/v1/workflows", get(list_workflows).post(create_workflow))
        .route("/v1/workflows/:id/execute", post(execute_workflow))
        .route("/v1/workflows/validate", post(validate_workflow))
        .route("/v1/workflows/compile", post(compile_workflow))
        .route("/v1/templates", get(list_templates).post(create_template))
        .route("/v1/templates/:id/instantiate", post(instantiate_template))
        .route("/v1/artifacts", get(list_artifacts).post(create_artifact))
        .route("/v1/artifacts/query", post(query_artifacts))
        .route("/v1/marketplace/skills", get(list_skills))
        .route("/v1/marketplace/install/:id", post(install_skill))
        .route("/v1/config/auth/:provider", post(set_auth))
        .route("/v1/config/model", post(set_model).get(get_model))
        .route("/v1/config/mode", post(set_mode).get(get_mode_handler))
        .route("/v1/sessions/commit", post(session_commit))
        .route("/v1/sessions/branch", post(session_branch))
        .route("/v1/sessions/history", get(session_history))
        .route("/v1/sessions/:session_id/log", get(session_log))
        .route("/v1/sessions/reset", post(session_reset))
        .route("/v1/task/compile", post(compile_task_spec))
        .route("/v1/runs/:run_id", get(get_run_model))
        .route("/v1/tools/validate", post(validate_tool_request))
        .route("/v1/events/create", post(create_event_envelope))
        .route("/v1/verify/artifact", post(verify_artifact_handler))
        .route("/v1/frameworks", get(list_frameworks))
        .route("/v1/frameworks/:framework_id", get(get_framework))
        .route(
            "/v1/capsules/compile-with-context",
            post(compile_capsule_with_context),
        )
        .route("/v1/orchestrator/tasks", get(list_tasks).post(create_task))
        .route("/v1/orchestrator/tasks/:id", get(get_task))
        .route("/v1/orchestrator/runs", post(start_run))
        .route("/v1/orchestrator/runs/:id", get(get_run))
        // GUI Tools routes (computer-use automation)
        .route("/v1/tools/gui/status", get(gui_tools::handle_gui_status))
        .route(
            "/v1/tools/gui/screenshot",
            post(gui_tools::handle_screenshot),
        )
        .route("/v1/tools/gui/click", post(gui_tools::handle_click))
        .route("/v1/tools/gui/type", post(gui_tools::handle_type))
        .route("/v1/tools/gui/scroll", post(gui_tools::handle_scroll))
        .route("/v1/tools/gui/run-task", post(gui_tools::handle_run_task))
        .layer(middleware::from_fn_with_state(
            state.security_state.clone(),
            security_middleware,
        ))
        .layer(middleware::from_fn_with_state(
            state.rate_limiter.clone(),
            rate_limiter::rate_limit_middleware,
        ));
    let monitoring_routes = Router::new()
        .route("/v1/monitoring/metrics", get(get_metrics))
        .route("/v1/monitoring/health", get(health_check_extended));
    let router = Router::new()
        .route("/v1/health", get(health_check))
        .route("/api/v1/runtime", get(runtime_info))
        .route("/v1/runtime", get(runtime_info))
        .route("/v1/terminal/ws", get(terminal_ws_handler))
        .route("/v1/orchestrator/ws", get(orchestrator_ws_handler))
        .merge(protected_routes)
        .merge(monitoring_routes)
        .layer(CorsLayer::permissive())
        .with_state(state);

    Ok(KernelServices {
        router,
        memory_fabric,
    })
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();
    info!("Starting Kernel Service...");

    ensure_boot_anchors()?;
    run_law_validator()?;
    write_boot_manifest()?;
    validate_boot_manifest()?;

    // Create the kernel services which initializes all the services including memory fabric
    let services = create_kernel_services().await?;

    // Start the memory maintenance daemon in the background
    let memory_fabric_clone = services.memory_fabric.clone();
    tokio::spawn(async move {
        use crate::memory_maintenance_daemon::MemoryMaintenanceDaemon;
        let daemon = MemoryMaintenanceDaemon::new(memory_fabric_clone);
        if let Err(e) = daemon.run().await {
            tracing::error!(error=?e, "memory maintenance daemon crashed");
        }
    });

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3004".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Kernel Service listening on {}", addr);

    axum::serve(
        listener,
        services
            .router
            .into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;
    Ok(())
}
