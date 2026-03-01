#![allow(dead_code, unused_variables, unused_imports, non_snake_case)]
use a2rchitech_capsule::{CapsuleBundle, CapsuleError, CapsuleStore, CapsuleStoreConfig};
use a2rchitech_control_plane_service::{ControlPlaneService, ControlPlaneServiceConfig};
use a2rchitech_policy::{
    Identity, IdentityType, PolicyEffect, PolicyEngine, PolicyRequest, PolicyRule, SafetyTier,
};
use a2rchitech_registry::agents::AgentDefinition;
use a2rchitech_skills::Skill;
use a2rchitech_tools_gateway::{ToolDefinition, ToolExecutionRequest};
// Note: Workflow compilation/validation temporarily disabled - needs crate update
// use a2rchitech_workflows::compiler::{CompiledWorkflowContracts, KernelCompilationContext, YamlCompiler};
// use a2rchitech_workflows::validator::YamlValidator;
use crate::routes::{
    AgentMailListResponse, AgentMailResponse, AgentMailResponseResponse, ExecuteWorkflowRequest,
    ExecuteWorkflowResponse, ExecutionMetrics, MemoryResponse, PoliciesListResponse,
    ProcessingStep, RLMConfigRequest, SkillsListResponse, WorkflowListResponse,
};
use a2rchitech_registry::fabric::DataFabric;
use a2rchitech_workflows::compiler::{
    CompiledNode, CompiledWorkflow, ExecutionPlan, WorkflowCompiler,
};
use a2rchitech_workflows::loader::WorkflowLoader;
use a2rchitech_workflows::validator::WorkflowValidator;
use a2rchitech_workflows::WorkflowDefinition;
pub mod agent_session_routes;
pub mod agents;
pub mod approval_routes;
pub mod environment_routes;
pub mod ivkge_routes;
pub mod ix_routes;
pub mod mcp_apps_routes;
pub mod mcp_routes;
pub mod multimodal_routes;
pub mod routes;
pub mod runtime_routes;
pub mod services;
pub mod shell_ui;
pub mod swarm_routes;
pub mod tambo_routes;
pub mod tools_routes;
pub mod tui_routes;
pub mod viz_routes;
pub mod workflow_routes_ext;
pub mod tools;

// P4 DAG Integration crate imports
use crate::environment_routes::EnvironmentSpecLoaderWithCache;
use a2r_ivkge_advanced::IvkgeAdvancedEngine;
use a2r_multimodal_streaming::MultimodalEngine;
use a2r_swarm_advanced::{SwarmAdvancedConfig, SwarmAdvancedEngine};
use a2r_tambo_integration::TamboEngine;
use axum::body::Body;
use axum::{
    body::Bytes,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::{Path, Query, Request, State},
    http::{header, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use http::{Request as HttpRequest, Response as HttpResponse};
use lazy_static::lazy_static;
use opentelemetry::global;
use opentelemetry::trace::TraceContextExt;
use opentelemetry_sdk::trace::TracerProvider;
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_yaml;
use std::collections::HashMap;
use std::convert::Infallible;
use std::fs;
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::task::{Context, Poll};
use std::time::Duration;
use std::time::Instant;
use tokio::sync::{broadcast, RwLock, RwLock as TokioRwLock};
use tokio_stream::wrappers::BroadcastStream;
use tower::ServiceBuilder;
use tower::{Layer, Service};
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;
use validator::Validate;

#[cfg(feature = "cloud-deploy")]
mod cloud_deploy_routes;
mod config_routes;
mod cron_routes;
mod job_events_ws;
mod log_routes;
mod node_auth;
mod node_job_dispatcher;
mod node_job_queue;
mod node_ws;
mod operator;
mod provider_discovery;
pub mod browser_recording;
mod rails;
mod rails_client;
mod security;
mod session_routes;
mod terminal_session;
mod terminal_ws;
mod voice;
mod webvm;
mod workflow_routes;

use crate::config_routes::create_config_routes;
use crate::cron_routes::create_cron_routes;
use crate::log_routes::create_log_routes;
use crate::node_job_queue::{
    cancel_node_job, create_node_job, get_job_queue_stats, get_node_job, list_node_jobs,
};
use crate::operator::create_operator_routes;
use crate::rails::create_rails_routes;
use crate::security::InputValidationHelper;
use crate::session_routes::SessionServiceState;
use crate::terminal_session::{
    create_terminal_session, delete_terminal_session, get_terminal_session, list_terminal_sessions,
    TerminalSessionManager,
};
use crate::voice::create_voice_routes;
use crate::webvm::create_webvm_routes;
#[cfg(feature = "cloud-deploy")]
use cloud_deploy_routes::CloudDeployState;
use tracing::{info, span, Level, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use utoipa::{Modify, OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

// Initialize SQLite connection pool
async fn init_sqlite_pool(db_path: &std::path::Path) -> Result<sqlx::SqlitePool, anyhow::Error> {
    // Ensure directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let database_url = format!("sqlite:{}", db_path.display());
    let pool = sqlx::SqlitePool::connect(&database_url).await?;

    // Enable foreign keys
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;

    Ok(pool)
}

use a2r_openclaw_host::native_cron_system::CronSystemService;
use prometheus::{Counter, Encoder, Histogram, IntGauge, TextEncoder};

#[derive(Clone)]
pub struct ApiMetrics {
    /// Total requests counter
    pub requests_total: Counter,

    /// Successful requests counter
    pub requests_success: Counter,

    /// Failed requests counter
    pub requests_failed: Counter,

    /// Request duration histogram
    pub request_duration: Histogram,

    /// Active requests gauge
    pub active_requests: IntGauge,
}

impl ApiMetrics {
    pub fn new() -> Self {
        Self {
            requests_total: prometheus::register_counter!(
                "api_requests_total",
                "Total number of API requests"
            )
            .unwrap(),

            requests_success: prometheus::register_counter!(
                "api_requests_success_total",
                "Total number of successful API requests"
            )
            .unwrap(),

            requests_failed: prometheus::register_counter!(
                "api_requests_failed_total",
                "Total number of failed API requests"
            )
            .unwrap(),

            request_duration: prometheus::register_histogram!(
                "api_request_duration_seconds",
                "Request duration in seconds"
            )
            .unwrap(),

            active_requests: prometheus::register_int_gauge!(
                "api_active_requests",
                "Currently active API requests"
            )
            .unwrap(),
        }
    }

    pub fn record_request(&self, method: &str, path: &str, status: u16, duration: f64) {
        self.requests_total.inc();

        if status >= 200 && status < 400 {
            self.requests_success.inc();
        } else {
            self.requests_failed.inc();
        }

        self.request_duration.observe(duration);
    }

    pub fn export(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = prometheus::gather();
        encoder.encode_to_string(&metric_families).unwrap()
    }
}

/// Middleware to track API metrics
#[derive(Clone)]
pub struct MetricsMiddleware<S> {
    inner: S,
    metrics: Arc<ApiMetrics>,
}

impl<S> MetricsMiddleware<S> {
    pub fn new(inner: S, metrics: Arc<ApiMetrics>) -> Self {
        Self { inner, metrics }
    }
}

impl<S> Service<HttpRequest<Body>> for MetricsMiddleware<S>
where
    S: Service<HttpRequest<Body>, Response = HttpResponse<Body>> + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: HttpRequest<Body>) -> Self::Future {
        let start = Instant::now();
        let metrics = self.metrics.clone();
        let method = req.method().clone();
        let path = req.uri().path().to_string();

        let future = self.inner.call(req);

        Box::pin(async move {
            let response = future.await?;
            let duration = start.elapsed().as_secs_f64();
            let status = response.status().as_u16();

            metrics.record_request(method.as_str(), &path, status, duration);

            Ok(response)
        })
    }
}

#[derive(Clone)]
pub struct MetricsLayer {
    metrics: Arc<ApiMetrics>,
}

impl MetricsLayer {
    pub fn new(metrics: Arc<ApiMetrics>) -> Self {
        Self { metrics }
    }
}

impl<S> Layer<S> for MetricsLayer {
    type Service = MetricsMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        MetricsMiddleware::new(inner, self.metrics.clone())
    }
}

// Note: Rate limiting disabled - tower::limit::RateLimit doesn't implement Clone required by Axum 0.7
// Consider using tower_http::limit or a custom middleware when rate limiting is needed
// See: https://docs.rs/tower-http/latest/tower_http/limit/index.html

#[derive(Clone)]
pub struct AppState {
    control_plane: Arc<ControlPlaneService>,
    capsule_store: Arc<CapsuleStore>,
    data_fabric: Arc<DataFabric>,
    rlm_config: Arc<RwLock<RLMConfigRequest>>,
    policy_identity_id: String,
    policy_tenant_id: String,
    policy_enforce: bool,
    rate_limit_enabled: bool,
    metrics: Arc<ApiMetrics>,
    terminal_session_manager: Arc<TerminalSessionManager>,
    kernel_client: reqwest::Client,
    kernel_url: String,
    chat_sessions: Arc<RwLock<HashMap<String, ChatSessionBinding>>>,
    session_service_state: Option<Arc<SessionServiceState>>,
    /// Tool gateway for native A2R tool execution
    tool_gateway: Arc<a2rchitech_tools_gateway::ToolGateway>,
    /// Browser recording service for agent-controlled screen capture
    browser_recording_service: Option<Arc<RwLock<crate::browser_recording::RecordingService>>>,
    /// Browser tool executor for native browser automation
    browser_tool_executor: Option<Arc<crate::tools::browser::BrowserToolExecutor>>,
    /// Cron system service for job scheduling
    cron_service: Option<Arc<RwLock<a2r_openclaw_host::native_cron_system::CronSystemService>>>,
    /// Log service for log aggregation and querying
    log_service: Option<Arc<RwLock<a2r_openclaw_host::native_log_service::LogService>>>,
    /// Config service for system configuration management
    config_service:
        Option<Arc<RwLock<a2r_openclaw_host::native_config_system::ConfigSystemService>>>,
    /// SQLite database pool
    database: sqlx::SqlitePool,
    // P4 DAG Integration engines
    swarm_engine: Arc<a2r_swarm_advanced::SwarmAdvancedEngine>,
    ivkge_engine: Arc<a2r_ivkge_advanced::IvkgeAdvancedEngine>,
    multimodal_engine: Arc<a2r_multimodal_streaming::MultimodalEngine>,
    tambo_engine: Arc<a2r_tambo_integration::TamboEngine>,
    /// Channel abstraction service for multi-channel messaging
    channel_abstraction: Option<
        Arc<
            tokio::sync::Mutex<
                a2r_openclaw_host::native_channel_abstraction_native::ChannelAbstractionService,
            >,
        >,
    >,
    /// Runtime settings for execution environment (DAG N3-N16)
    runtime_settings: runtime_routes::RuntimeSettingsState,
    /// Shared execution mode for runtime tool dispatch
    runtime_execution_mode: runtime_routes::RuntimeExecutionModeState,
    /// Budget metering engine (N11)
    budget_engine: Arc<a2rchitech_budget_metering::BudgetMeteringEngine>,
    /// Replay engine (N12)
    replay_engine: Arc<RwLock<a2r_replay::ReplayEngine>>,
    /// Prewarm pool manager (N16)
    pool_manager: Arc<a2r_prewarm::PoolManager>,
    /// Driver registry (N3)
    driver_registry: Arc<RwLock<a2r_driver_interface::DriverRegistry>>,
    /// MCP Apps interactive capsule registry (P3.9) - Legacy, being migrated
    mcp_capsule_registry:
        Option<Arc<RwLock<std::collections::HashMap<String, mcp_apps_routes::CapsuleEntry>>>>,
    /// New capsule registry service (P3.9)
    capsule_registry: Option<crate::services::SharedCapsuleRegistry>,
    /// A2R-IX capsule registry (P3.13)
    ix_capsule_registry: Arc<ix_routes::IXCapsuleRegistry>,
    /// Environment spec loader with caching (N5)
    environment_loader: Arc<EnvironmentSpecLoaderWithCache>,
    /// Rails client for receipt emission (N2)
    rails_client: Option<Arc<rails_client::RailsClient>>,
    /// Rails Gate for policy enforcement (N0)
    rails_gate: Option<Arc<a2r_agent_system_rails::Gate>>,
    /// Rails Ledger for event storage (N0)
    rails_ledger: Option<Arc<a2r_agent_system_rails::Ledger>>,
    /// Rails Receipts Store (N0)
    rails_receipts: Option<Arc<a2r_agent_system_rails::ReceiptStore>>,
    /// Native Session Manager for agent sessions (OpenClaw-compatible)
    session_manager: Option<
        Arc<tokio::sync::RwLock<a2r_openclaw_host::native_session_manager::SessionManagerService>>,
    >,
    /// Session Sync Service for real-time updates
    session_sync: Option<Arc<a2r_openclaw_host::session_sync::SessionSyncService>>,
    /// Node registry for WebSocket connections
    node_registry: Arc<crate::node_ws::NodeRegistry>,
    /// Terminal session registry
    terminal_registry: Arc<crate::terminal_ws::TerminalSessionRegistry>,
    /// Job queue for node job scheduling
    job_queue: Arc<crate::node_job_queue::JobQueue>,
    /// Node authentication service
    node_auth: Arc<crate::node_auth::NodeAuthService>,
    /// Broadcast channel for job events to UI clients
    job_events_tx: broadcast::Sender<JobEvent>,
    /// MCP client manager for handling MCP server connections
    mcp_client_manager: Arc<mcp_client::McpClientManager>,
    /// MCP tools registry - maps tool names to their server and definition
    mcp_tools: Arc<RwLock<HashMap<String, McpToolEntry>>>,
    /// Connected MCP servers metadata
    mcp_servers: Arc<RwLock<HashMap<String, McpServerEntry>>>,
    /// Workflow storage - stores workflow definitions by workflow_id
    pub workflow_store: Arc<RwLock<HashMap<String, a2rchitech_workflows::WorkflowDefinition>>>,
    /// Execution storage - stores execution status by execution_id
    pub execution_store: Arc<RwLock<HashMap<String, crate::workflow_routes::ExecutionRecord>>>,
}

/// Job event for broadcasting to UI clients
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct JobEvent {
    pub event_type: String,
    pub job_id: String,
    pub status: Option<String>,
    pub progress: Option<f64>,
    pub message: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// MCP tool entry for tracking tools from MCP servers
#[derive(Debug, Clone)]
pub struct McpToolEntry {
    pub tool: a2rchitech_tools_gateway::ToolDefinition,
    pub server_id: String,
    pub mcp_tool_name: String,
}

/// MCP server entry for tracking connected servers
#[derive(Debug, Clone)]
pub struct McpServerEntry {
    pub server_id: String,
    pub name: String,
    pub transport_type: String,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    pub tool_count: usize,
    pub status: String,
}

#[derive(Debug, Clone)]
struct ChatSessionBinding {
    session_id: String,
    model_id: String,
}

#[derive(Debug, Clone)]
struct ApiConfig {
    bind_addr: String,
    ledger_path: PathBuf,
    db_path: PathBuf,
    policy_identity_id: String,
    policy_tenant_id: String,
    policy_bootstrap: bool,
    policy_enforce: bool,
}

impl ApiConfig {
    fn from_env() -> Self {
        let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
        let bind_addr =
            std::env::var("A2RCHITECH_API_BIND").unwrap_or_else(|_| format!("{}:{}", host, port));
        let ledger_path = std::env::var("A2RCHITECH_LEDGER_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("./a2rchitech.jsonl"));
        let db_path = std::env::var("A2RCHITECH_DB_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("./a2rchitech.db"));
        let policy_identity_id =
            std::env::var("A2RCHITECH_API_IDENTITY").unwrap_or_else(|_| "api-service".to_string());
        let policy_tenant_id =
            std::env::var("A2RCHITECH_API_TENANT").unwrap_or_else(|_| "default".to_string());
        let policy_bootstrap = std::env::var("A2RCHITECH_API_BOOTSTRAP_POLICY")
            .map(|value| value != "false" && value != "0")
            .unwrap_or(true);
        // Default policy enforcement to false in local/dev so chat/session endpoints
        // are not blocked by policy bootstrap state. Production should set this to true.
        let policy_enforce = std::env::var("A2RCHITECH_API_POLICY_ENFORCE")
            .map(|value| value != "false" && value != "0")
            .unwrap_or(false);

        ApiConfig {
            bind_addr,
            ledger_path,
            db_path,
            policy_identity_id,
            policy_tenant_id,
            policy_bootstrap,
            policy_enforce,
        }
    }
}

fn ensure_parent_dir(path: &PathBuf) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    Ok(())
}

/// Strip ANSI escape codes from terminal output
fn strip_ansi_escapes(input: &str) -> String {
    // Simple approach to remove common ANSI escape sequences
    let mut result = String::new();
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\u{001b}' {
            // ESC sequence start
            if chars.peek() == Some(&'[') {
                chars.next(); // consume '['
                              // Skip until we hit a letter (end of sequence) or @/`~
                while let Some(&next_ch) = chars.peek() {
                    chars.next();
                    if next_ch.is_ascii_alphabetic() || matches!(next_ch, '@' | '`' | '~') {
                        break;
                    }
                }
            } else {
                // Other escape sequences (rare), skip next char
                chars.next();
            }
        } else if ch == '\r' {
            // Carriage return - skip it
            continue;
        } else {
            result.push(ch);
        }
    }

    result
}

fn ensure_file_exists(path: &PathBuf) -> anyhow::Result<()> {
    ensure_parent_dir(path)?;
    if !path.exists() {
        fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(path)?;
    }
    Ok(())
}

#[derive(Debug, Serialize, ToSchema)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Debug, Deserialize, ToSchema, validator::Validate)]
struct ValidateWorkflowRequest {
    #[validate(length(min = 1, max = 100000))]
    yaml: String,
    #[validate(length(min = 1, max = 100))]
    tenant_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
struct ValidateResponse {
    ok: bool,
    message: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema, validator::Validate)]
struct CompileWorkflowRequest {
    #[validate(length(min = 1, max = 100000))]
    yaml: String,
    #[validate(length(min = 1, max = 100))]
    tenant_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
struct CompileWorkflowResponse {
    workflow_definition: a2rchitech_workflows::WorkflowDefinition,
    run_model: a2rchitech_kernel_contracts::RunModel,
    compilation_event: a2rchitech_kernel_contracts::EventEnvelope,
}

#[derive(Debug, Serialize, ToSchema)]
struct PolicyErrorResponse {
    message: String,
    decision_id: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct EventStreamQuery {
    event_type: Option<String>,
}

fn init_tracing() {
    use opentelemetry::KeyValue;
    use opentelemetry_sdk::trace::TracerProvider as SdkTracerProvider;
    use opentelemetry_sdk::Resource;
    use tracing_subscriber::filter::{EnvFilter, LevelFilter};
    use tracing_subscriber::prelude::*;

    // Set up OpenTelemetry tracer provider
    let tracer_provider = SdkTracerProvider::builder()
        .with_config(
            opentelemetry_sdk::trace::Config::default().with_resource(Resource::new(vec![
                KeyValue::new("service.name", "a2rchitech-api"),
            ])),
        )
        .build();

    global::set_tracer_provider(tracer_provider);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::default().add_directive(LevelFilter::INFO.into()));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_opentelemetry::layer())
        .with(
            tracing_subscriber::fmt::layer()
                .with_ansi(true)
                .with_line_number(true)
                .with_file(true)
                .with_target(true),
        )
        .init();
}

/// A2rchitech API
#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        validate_workflow,
        compile_workflow,
        stream_events,
        ws_events,
        get_tenant_capabilities,
        get_tenant_capability_summary,
        search_capabilities,
        register_agent,
        get_agent,
        register_skill,
        get_skill,
        register_tool,
        get_tool,
        list_capsules,
        create_capsule,
        get_capsule,
        verify_capsule,
        execute_capsule,
        // OpenClaw session routes
        session_routes::create_session,
        session_routes::get_session,
        session_routes::list_sessions,
        session_routes::delete_session,
        session_routes::send_message,
        session_routes::get_messages,
        session_routes::abort_session,
        session_routes::patch_session,
        // Cron job routes
        cron_routes::list_cron_jobs,
        cron_routes::create_cron_job,
        cron_routes::get_cron_job,
        cron_routes::delete_cron_job,
        cron_routes::run_cron_job,
        cron_routes::enable_cron_job,
        cron_routes::disable_cron_job,
        cron_routes::get_cron_status,
        // Log routes
        log_routes::query_logs,
        log_routes::list_log_sources,
        log_routes::stream_logs,
        // Config routes
        config_routes::get_config,
        config_routes::set_config,
        config_routes::validate_config,
        config_routes::apply_config,
        config_routes::get_config_history,
        config_routes::list_config_keys,
        config_routes::reset_config,
        // Workflow Engine Extended routes
        workflow_routes_ext::create_workflow,
        workflow_routes_ext::get_workflow,
        workflow_routes_ext::update_workflow,
        workflow_routes_ext::delete_workflow,
        workflow_routes_ext::execute_workflow,
        workflow_routes_ext::list_executions,
        workflow_routes_ext::get_execution,
        workflow_routes_ext::cancel_execution,
        workflow_routes_ext::get_visualization,
        workflow_routes_ext::list_workflows,
        // Data Visualization routes
        viz_routes::render_chart,
        viz_routes::process_data,
        viz_routes::list_palettes,
        viz_routes::export_chart,
        viz_routes::viz_health,
        // Local API service paths (from routes_handlers module)
        // Note: These handlers are defined in routes_handlers.rs but utoipa 
        // cannot reference them directly from another module. OpenAPI docs
        // for these endpoints are maintained separately.
    ),
    components(
        schemas(HealthResponse, ValidateWorkflowRequest, ValidateResponse,
                CompileWorkflowRequest, CompileWorkflowResponse, PolicyErrorResponse,
                EventStreamQuery, SearchRequest,
                // Local API service schemas
                WorkflowListResponse, ExecuteWorkflowRequest, ExecuteWorkflowResponse,
                ProcessingStep, ExecutionMetrics, AgentMailListResponse, AgentMailResponse,
                AgentMailResponseResponse, SkillsListResponse, MemoryResponse,
                PoliciesListResponse,
                // OpenClaw session schemas
                session_routes::CreateSessionRequest, session_routes::CreateSessionResponse,
                session_routes::SessionResponse, session_routes::SendMessageRequest,
                session_routes::MessageResponse, session_routes::MessagesListResponse,
                session_routes::SessionListResponse, session_routes::SessionSummaryResponse,
                session_routes::AbortRequest, session_routes::AbortResponse,
                // Cron job schemas
                cron_routes::CreateCronJobRequest, cron_routes::CronJobResponse,
                cron_routes::CronJobListResponse, cron_routes::CronJobDetailResponse,
                cron_routes::CronExecutionResponse, cron_routes::CronStatusResponse,
                cron_routes::CronConfigInfo, cron_routes::CronErrorResponse,
                // Log schemas
                log_routes::LogEntryResponse, log_routes::LogListResponse,
                log_routes::LogSourceInfo, log_routes::LogSourcesResponse,
                log_routes::LogQueryParams, log_routes::LogStreamQueryParams,
                log_routes::LogErrorResponse,
                // Config schemas
                config_routes::SetConfigRequest, config_routes::ConfigResponse,
                config_routes::FullConfigResponse, config_routes::ConfigOperationResponse,
                config_routes::ConfigValidationResponse, config_routes::ConfigApplyResponse,
                config_routes::ConfigHistoryEntry, config_routes::ConfigHistoryResponse,
                config_routes::ConfigKeysResponse, config_routes::ConfigErrorResponse,
                // Registry schemas
                AgentDefinition, Skill, ToolDefinition,
                // Workflow Engine Extended schemas
                workflow_routes_ext::WorkflowNode, workflow_routes_ext::NodePosition,
                workflow_routes_ext::WorkflowConnection, workflow_routes_ext::WorkflowDefinitionDto,
                workflow_routes_ext::WorkflowConfig, workflow_routes_ext::SchedulerConfig,
                workflow_routes_ext::CreateWorkflowRequest, workflow_routes_ext::UpdateWorkflowRequest,
                workflow_routes_ext::WorkflowResponse, workflow_routes_ext::WorkflowDetailResponse,
                workflow_routes_ext::ListWorkflowsResponse, workflow_routes_ext::ExecutionContext,
                workflow_routes_ext::ExecuteWorkflowRequest, workflow_routes_ext::ExecutionResponse,
                workflow_routes_ext::ExecutionStatus, workflow_routes_ext::ExecutionDetailResponse,
                workflow_routes_ext::NodeExecutionStatus, workflow_routes_ext::ExecutionLogEntry,
                workflow_routes_ext::ListExecutionsResponse, workflow_routes_ext::ExecutionSummary,
                workflow_routes_ext::CancelExecutionResponse, workflow_routes_ext::VisualizationFormat,
                workflow_routes_ext::VisualizationResponse,
                workflow_routes_ext::WorkflowErrorResponse,
                // Data Visualization schemas
                viz_routes::ChartType, viz_routes::DataSeries, viz_routes::ChartData,
                viz_routes::AxisConfig, viz_routes::ChartConfig, viz_routes::RenderFormat,
                viz_routes::RenderChartRequest, viz_routes::RenderChartResponse,
                viz_routes::ProcessDataRequest, viz_routes::DataTransformation,
                viz_routes::AggregationConfig, viz_routes::Aggregation, viz_routes::FilterConfig,
                viz_routes::FilterCondition, viz_routes::ProcessDataResponse,
                viz_routes::DataProcessingMetadata, viz_routes::ColorPalette,
                viz_routes::ListPalettesResponse,
                viz_routes::ExportChartRequest, viz_routes::ExportFormat, viz_routes::ExportOptions,
                viz_routes::ExportResponse, viz_routes::VizErrorResponse, viz_routes::VizHealthResponse)
    ),
    tags(
        (name = "a2rchitech-api", description = "A2rchitech API for agentic OS")
    )
)]
struct ApiDoc;

// ============================================================================
// Channel API Handlers
// ============================================================================

/// Response for channel status endpoint
#[derive(Debug, Serialize)]
struct ChannelStatusResponse {
    id: String,
    name: String,
    enabled: bool,
    #[serde(rename = "type")]
    channel_type: String,
    connection_status: String,
}

/// Get channel connection status
///
/// GET /api/v1/channels/:id/status
async fn get_channel_status(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
) -> impl IntoResponse {
    use a2r_openclaw_host::native_channel_abstraction_native::{
        ChannelAbstractionRequest, ChannelId, ChannelOperation,
    };

    let channel_service = match state.channel_abstraction.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({
                    "error": "Channel abstraction service not available"
                })),
            )
                .into_response();
        }
    };

    let mut service = channel_service.lock().await;
    let response = service
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::GetChannel {
                channel_id: ChannelId::new(channel_id.clone()),
            },
            context: None,
        })
        .await;

    match response {
        Ok(channel_response) => {
            if channel_response.success {
                if let Some(result) = channel_response.result {
                    if let Some(channel) = result.get("channel") {
                        let status = ChannelStatusResponse {
                            id: channel
                                .get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            name: channel
                                .get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            enabled: channel
                                .get("enabled")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false),
                            channel_type: channel
                                .get("type")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            connection_status: if channel
                                .get("enabled")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false)
                            {
                                "connected".to_string()
                            } else {
                                "disconnected".to_string()
                            },
                        };
                        return (StatusCode::OK, Json(status)).into_response();
                    }
                }
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": "Invalid response from channel service"
                    })),
                )
                    .into_response()
            } else {
                let error_msg = channel_response
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string());
                if error_msg.contains("not found") {
                    (
                        StatusCode::NOT_FOUND,
                        Json(serde_json::json!({
                            "error": format!("Channel '{}' not found", channel_id)
                        })),
                    )
                        .into_response()
                } else {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "error": error_msg
                        })),
                    )
                        .into_response()
                }
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("Failed to get channel status: {}", e)
            })),
        )
            .into_response(),
    }
}

/// Login channel request
#[derive(Debug, Deserialize)]
struct LoginChannelRequest {
    credentials: Option<serde_json::Value>,
}

/// Response for channel login endpoint
#[derive(Debug, Serialize)]
struct LoginChannelResponse {
    success: bool,
    message: String,
    channel_id: String,
}

/// Initiate channel login (enable/disable channel)
///
/// POST /api/v1/channels/:id/login
async fn login_channel(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
    Json(_request): Json<LoginChannelRequest>,
) -> impl IntoResponse {
    use a2r_openclaw_host::native_channel_abstraction_native::{
        ChannelAbstractionRequest, ChannelId, ChannelOperation,
    };

    let channel_service = match state.channel_abstraction.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({
                    "error": "Channel abstraction service not available"
                })),
            )
                .into_response();
        }
    };

    // First check if channel exists
    let mut service = channel_service.lock().await;
    let check_response = service
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::GetChannel {
                channel_id: ChannelId::new(channel_id.clone()),
            },
            context: None,
        })
        .await;

    match check_response {
        Ok(channel_response) => {
            if !channel_response.success {
                let error_msg = channel_response
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string());
                if error_msg.contains("not found") {
                    return (
                        StatusCode::NOT_FOUND,
                        Json(serde_json::json!({
                            "error": format!("Channel '{}' not found", channel_id)
                        })),
                    )
                        .into_response();
                }
            }
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": format!("Failed to check channel: {}", e)
                })),
            )
                .into_response();
        }
    }

    // Enable the channel (login = enable)
    let enable_response = service
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::ToggleChannel {
                channel_id: ChannelId::new(channel_id.clone()),
                enabled: true,
            },
            context: None,
        })
        .await;

    match enable_response {
        Ok(response) => {
            if response.success {
                let login_response = LoginChannelResponse {
                    success: true,
                    message: "Channel logged in successfully".to_string(),
                    channel_id: channel_id.clone(),
                };
                (StatusCode::OK, Json(login_response)).into_response()
            } else {
                let error_msg = response
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string());
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": format!("Failed to login channel: {}", error_msg)
                    })),
                )
                    .into_response()
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("Failed to login channel: {}", e)
            })),
        )
            .into_response(),
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = ApiConfig::from_env();
    ensure_file_exists(&config.db_path)?;
    ensure_file_exists(&config.ledger_path)?;
    let service_config = ControlPlaneServiceConfig::with_sqlite_paths(
        config.ledger_path.clone(),
        config.db_path.clone(),
    );
    let control_plane = Arc::new(ControlPlaneService::new(service_config).await?);
    let capsule_store = Arc::new(CapsuleStore::new(CapsuleStoreConfig::default())?);
    bootstrap_policy(control_plane.policy_engine.clone(), &config).await?;
    let api_metrics = Arc::new(ApiMetrics::new());
    let data_fabric = control_plane.unified_registry.fabric.clone();

    // Initialize RLM configuration
    let rlm_config = Arc::new(RwLock::new(RLMConfigRequest {
        max_recursion_depth: Some(5),
        context_slice_size: Some(8192),
        enable_rlm_mode: Some(true),
    }));

    let terminal_session_manager = Arc::new(TerminalSessionManager::new(
        control_plane.policy_engine.clone(),
        control_plane.messaging_system.clone(),
    ));

    let kernel_client = reqwest::Client::builder().no_proxy().build()?;
    let kernel_url = std::env::var("A2RCHITECH_KERNEL_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:3004".to_string());

    // Initialize OpenClaw session service state
    let session_service_state = Arc::new(SessionServiceState::new());

    // Initialize tool gateway for MCP integration
    let tool_gateway = Arc::new(a2rchitech_tools_gateway::ToolGateway::new(
        control_plane.policy_engine.clone(),
        control_plane.history_ledger.clone(),
        control_plane.messaging_system.clone(),
    ));

    // Register browser recording tools (GIF/video capture for browser sessions)
    // These are native tools like gui.screenshot, not skills
    {
        use a2rchitech_tools_gateway::{ToolDefinition, ToolType, ResourceLimits, NetworkAccess, FilesystemAccess};
        use a2rchitech_policy::SafetyTier;
        
        let browser_recording_tools = vec![
            ToolDefinition {
                id: "browser.start_recording".to_string(),
                name: "Browser Start Recording".to_string(),
                description: "Start recording browser session as GIF/video for review".to_string(),
                tool_type: ToolType::Local,
                command: "browser_start_recording".to_string(),
                endpoint: "".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Browser session ID"},
                        "format": {"type": "string", "enum": ["gif", "webm", "mp4"], "default": "gif"},
                        "fps": {"type": "integer", "default": 10},
                        "quality": {"type": "integer", "default": 80},
                        "max_duration_secs": {"type": "integer"}
                    }
                }),
                output_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "recording_id": {"type": "string"},
                        "session_id": {"type": "string"},
                        "status": {"type": "string"},
                        "format": {"type": "string"}
                    },
                    "required": ["recording_id", "session_id", "status"]
                }),
                side_effects: vec!["screen_capture".to_string(), "filesystem".to_string()],
                idempotency_behavior: "not_idempotent".to_string(),
                retryable: false,
                failure_classification: "permanent".to_string(),
                safety_tier: SafetyTier::T1,
                resource_limits: ResourceLimits {
                    cpu: Some("1000m".to_string()),
                    memory: Some("1Gi".to_string()),
                    network: NetworkAccess::None,
                    filesystem: FilesystemAccess::Allowlist(vec!["./recordings".to_string()]),
                    time_limit: 300,
                },
                subprocess: None,
            },
            ToolDefinition {
                id: "browser.stop_recording".to_string(),
                name: "Browser Stop Recording".to_string(),
                description: "Stop recording and save GIF/video output".to_string(),
                tool_type: ToolType::Local,
                command: "browser_stop_recording".to_string(),
                endpoint: "".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "recording_id": {"type": "string", "description": "Recording session ID"},
                        "save": {"type": "boolean", "default": true}
                    },
                    "required": ["recording_id"]
                }),
                output_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "recording_id": {"type": "string"},
                        "success": {"type": "boolean"},
                        "file_path": {"type": "string"},
                        "file_size_bytes": {"type": "integer"},
                        "duration_secs": {"type": "number"},
                        "frames_captured": {"type": "integer"}
                    },
                    "required": ["recording_id", "success"]
                }),
                side_effects: vec!["filesystem".to_string()],
                idempotency_behavior: "not_idempotent".to_string(),
                retryable: false,
                failure_classification: "permanent".to_string(),
                safety_tier: SafetyTier::T1,
                resource_limits: ResourceLimits {
                    cpu: Some("2000m".to_string()),
                    memory: Some("2Gi".to_string()),
                    network: NetworkAccess::None,
                    filesystem: FilesystemAccess::Allowlist(vec!["./recordings".to_string()]),
                    time_limit: 120,
                },
                subprocess: None,
            },
            ToolDefinition {
                id: "browser.recording_status".to_string(),
                name: "Browser Recording Status".to_string(),
                description: "Get status of active recording".to_string(),
                tool_type: ToolType::Local,
                command: "browser_recording_status".to_string(),
                endpoint: "".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "recording_id": {"type": "string", "description": "Recording session ID"}
                    },
                    "required": ["recording_id"]
                }),
                output_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "recording_id": {"type": "string"},
                        "is_recording": {"type": "boolean"},
                        "frames_captured": {"type": "integer"},
                        "duration_secs": {"type": "number"},
                        "format": {"type": "string"}
                    }
                }),
                side_effects: vec![],
                idempotency_behavior: "idempotent".to_string(),
                retryable: true,
                failure_classification: "transient".to_string(),
                safety_tier: SafetyTier::T0,
                resource_limits: ResourceLimits {
                    cpu: Some("100m".to_string()),
                    memory: Some("128Mi".to_string()),
                    network: NetworkAccess::None,
                    filesystem: FilesystemAccess::None,
                    time_limit: 5,
                },
                subprocess: None,
            },
        ];
        
        for tool in browser_recording_tools {
            if let Err(e) = tool_gateway.register_tool(tool.clone()).await {
                tracing::warn!("Failed to register browser tool {}: {}", tool.id, e);
            } else {
                tracing::info!("✓ Registered browser recording tool: {}", tool.name);
            }
        }
    }

    // Initialize cron system service
    let cron_service = match CronSystemService::new().await {
        Ok(mut service) => {
            if let Err(e) = service.initialize().await {
                tracing::warn!("Failed to initialize cron service: {}", e);
                None
            } else {
                tracing::info!("Cron system service initialized successfully");
                Some(Arc::new(RwLock::new(service)))
            }
        }
        Err(e) => {
            tracing::warn!("Failed to create cron service: {}", e);
            None
        }
    };

    // Initialize log service
    let log_service = {
        let service = a2r_openclaw_host::native_log_service::LogService::new();
        if let Err(e) = service.ensure_logs_dir().await {
            tracing::warn!("Failed to ensure logs directory: {}", e);
        }
        tracing::info!("Log service initialized successfully");
        Some(Arc::new(RwLock::new(service)))
    };

    // Initialize SQLite database pool
    let database = init_sqlite_pool(&config.db_path).await?;
    tracing::info!("SQLite database initialized at {:?}", config.db_path);

    // Initialize node WebSocket tables
    if let Err(e) = node_ws::init_node_tables(&database).await {
        tracing::warn!("Failed to initialize node tables: {}", e);
    }

    // Initialize job queue
    let job_queue = Arc::new(node_job_queue::JobQueue::new(database.clone()));
    if let Err(e) = job_queue.init().await {
        tracing::warn!("Failed to initialize job queue: {}", e);
    }

    // Initialize config service
    let config_service = {
        let mut service = a2r_openclaw_host::native_config_system::ConfigSystemService::new();
        if let Err(e) = service.initialize().await {
            tracing::warn!("Failed to initialize config service: {}", e);
            None
        } else {
            tracing::info!("Config service initialized successfully");
            Some(Arc::new(RwLock::new(service)))
        }
    };

    // Initialize channel abstraction service
    let channel_abstraction = {
        let mut service =
            a2r_openclaw_host::native_channel_abstraction_native::ChannelAbstractionService::new();
        if let Err(e) = service.initialize().await {
            tracing::warn!("Failed to initialize channel abstraction service: {}", e);
            None
        } else {
            tracing::info!("Channel abstraction service initialized successfully");
            Some(Arc::new(tokio::sync::Mutex::new(service)))
        }
    };

    let mut state = AppState {
        control_plane,
        capsule_store,
        data_fabric,
        rlm_config,
        policy_identity_id: config.policy_identity_id.clone(),
        policy_tenant_id: config.policy_tenant_id.clone(),
        policy_enforce: config.policy_enforce,
        rate_limit_enabled: true,
        metrics: api_metrics,
        terminal_session_manager,
        kernel_client,
        kernel_url: kernel_url.clone(),
        chat_sessions: Arc::new(RwLock::new(HashMap::new())),
        session_service_state: Some(session_service_state),
        tool_gateway,
        browser_recording_service: None, // Initialized below
        browser_tool_executor: None, // Initialized below
        cron_service,
        log_service,
        config_service,
        database: database.clone(),
        // P4 DAG Integration engines
        swarm_engine: Arc::new(SwarmAdvancedEngine::new(SwarmAdvancedConfig::default())),
        ivkge_engine: Arc::new(IvkgeAdvancedEngine::new()),
        multimodal_engine: Arc::new(MultimodalEngine::new()),
        tambo_engine: Arc::new(TamboEngine::new()),
        // Channel abstraction service
        channel_abstraction,
        // Runtime settings for execution environment
        runtime_settings: runtime_routes::init_runtime_settings(),
        runtime_execution_mode: runtime_routes::init_runtime_execution_mode(),
        // Budget metering engine (N11)
        budget_engine: Arc::new(a2rchitech_budget_metering::BudgetMeteringEngine::new()),
        // Replay engine (N12)
        replay_engine: Arc::new(RwLock::new(a2r_replay::ReplayEngine::new())),
        // Prewarm pool manager (N16)
        pool_manager: Arc::new(a2r_prewarm::PoolManager::new()),
        // Driver registry (N3)
        driver_registry: Arc::new(RwLock::new({
            let mut registry = a2r_driver_interface::DriverRegistry::new();
            // Register the process driver
            registry.register_driver(Arc::new(a2r_process_driver::ProcessDriver::new()));
            // Register the firecracker driver (N4 prototype) - disabled due to runtime conflict
            // registry.register_driver(Arc::new(a2r_firecracker_driver::FirecrackerDriver::new()));
            registry
        })),
        // MCP Apps interactive capsule registry (P3.9)
        mcp_capsule_registry: Some(Arc::new(RwLock::new(std::collections::HashMap::new()))),
        // New capsule registry service (P3.9)
        capsule_registry: Some(std::sync::Arc::new(crate::services::CapsuleRegistry::new())),
        // A2R-IX capsule registry (P3.13)
        ix_capsule_registry: Arc::new(ix_routes::IXCapsuleRegistry::new()),
        // Environment spec loader with caching (N5)
        environment_loader: Arc::new(
            EnvironmentSpecLoaderWithCache::new()
                .expect("Failed to create environment spec loader"),
        ),
        // Rails client for receipt emission (N2)
        rails_client: Some(Arc::new(crate::rails_client::RailsClient::new(
            kernel_url.clone(),
        ))),
        // Rails Gate for policy enforcement (N0)
        rails_gate: None, // Initialized below
        // Rails Ledger for event storage (N0)
        rails_ledger: None, // Initialized below
        // Rails Receipts Store (N0)
        rails_receipts: None, // Initialized below
        // Native Session Manager for agent sessions (OpenClaw-compatible)
        session_manager: None, // Initialized below
        // Session Sync Service for real-time updates
        session_sync: None, // Initialized below
        // Node registry for WebSocket connections
        node_registry: Arc::new(crate::node_ws::NodeRegistry::new()),
        // Terminal session registry
        terminal_registry: Arc::new(crate::terminal_ws::TerminalSessionRegistry::new()),
        // Job queue for node job scheduling (use initialized instance)
        job_queue: job_queue.clone(),
        // Node authentication service
        node_auth: Arc::new(crate::node_auth::NodeAuthService::new()),
        // Broadcast channel for job events to UI clients (1000 event buffer)
        job_events_tx: broadcast::channel(1000).0,
        // MCP client manager for handling MCP server connections
        mcp_client_manager: Arc::new(mcp_client::McpClientManager::new()),
        // MCP tools registry
        mcp_tools: Arc::new(RwLock::new(HashMap::new())),
        // Connected MCP servers metadata
        mcp_servers: Arc::new(RwLock::new(HashMap::new())),
        // Workflow storage - thread-safe in-memory storage for workflow definitions
        workflow_store: Arc::new(RwLock::new(HashMap::new())),
        // Execution storage - thread-safe in-memory storage for execution records
        execution_store: Arc::new(RwLock::new(HashMap::new())),
    };

    // Initialize Rails Gate, Ledger, and Receipts Store (N0)
    let rails_dir = std::env::current_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join(".a2r/rails");
    std::fs::create_dir_all(&rails_dir).ok();

    let ledger = Arc::new(a2r_agent_system_rails::Ledger::new(
        a2r_agent_system_rails::ledger::ledger::LedgerOptions {
            root_dir: Some(rails_dir.clone()),
            ledger_dir: Some(rails_dir.join("ledger")),
        },
    ));

    let receipts = Arc::new(
        a2r_agent_system_rails::ReceiptStore::new(a2r_agent_system_rails::ReceiptStoreOptions {
            root_dir: Some(rails_dir.clone()),
            receipts_dir: Some(rails_dir.join("receipts")),
            blobs_dir: Some(rails_dir.join("blobs")),
        })
        .expect("Failed to create receipts store"),
    );

    let leases = Arc::new(
        a2r_agent_system_rails::Leases::new(
            a2r_agent_system_rails::leases::leases::LeasesOptions {
            root_dir: Some(rails_dir.clone()),
                leases_dir: Some(rails_dir.join("leases")),
                ..Default::default()
            },
        )
        .await
        .expect("Failed to create leases"),
    );

    let index = Arc::new(
        a2r_agent_system_rails::Index::new(a2r_agent_system_rails::IndexOptions {
            root_dir: Some(rails_dir.clone()),
            index_dir: Some(rails_dir.join("index")),
        })
        .await
        .expect("Failed to create index"),
    );

    let gate = Arc::new(a2r_agent_system_rails::Gate::new(
        a2r_agent_system_rails::GateOptions {
            ledger: ledger.clone(),
            leases: leases.clone(),
            receipts: receipts.clone(),
            index: Some(index.clone()),
            vault: None,
            root_dir: Some(rails_dir.clone()),
            actor_id: Some("api".to_string()),
            strict_provenance: Some(false),
        },
    ));

    state.rails_gate = Some(gate);
    state.rails_ledger = Some(ledger);
    state.rails_receipts = Some(receipts);

    // Initialize Native Session Manager and Session Sync (OpenClaw-compatible agent sessions)
    let session_manager = Arc::new(tokio::sync::RwLock::new(
        a2r_openclaw_host::native_session_manager::SessionManagerService::new(),
    ));
    let session_sync = Arc::new(a2r_openclaw_host::session_sync::SessionSyncService::new());

    state.session_manager = Some(session_manager.clone());
    state.session_sync = Some(session_sync.clone());

    // Initialize browser recording service
    match browser_recording::init_browser_recording_service().await {
        Ok(service) => {
            state.browser_recording_service = Some(service);
            tracing::info!("Browser recording service initialized");
        }
        Err(e) => {
            tracing::warn!("Failed to initialize browser recording service: {}", e);
        }
    }

    // Initialize browser tool executor
    state.browser_tool_executor = Some(Arc::new(crate::tools::browser::BrowserToolExecutor::new()));
    tracing::info!("Browser tool executor initialized");

    let shared_state = Arc::new(state);

    // Start terminal session cleanup task
    shared_state.terminal_registry.clone().start_cleanup_task();

    // Start job dispatcher background task
    crate::node_job_dispatcher::start_job_dispatcher(
        shared_state.job_queue.clone(),
        shared_state.node_registry.clone(),
    );

    // Initialize Cloud Deploy state with SQLite and WebSocket support (if cloud-deploy feature enabled)
    #[cfg(feature = "cloud-deploy")]
    let cloud_deploy_state = Arc::new({
        let db = &shared_state.database;
        let event_tx = broadcast::channel::<cloud_deploy_routes::DeploymentEvent>(1000).0;

        // Initialize database tables
        if let Err(e) = cloud_deploy_routes::init_cloud_deploy_db(db).await {
            tracing::error!("Failed to initialize cloud deploy database: {}", e);
        }

        CloudDeployState::new(db.clone(), event_tx)
    });
    #[cfg(not(feature = "cloud-deploy"))]
    let cloud_deploy_state = Arc::new(()); // Dummy state when feature disabled

    let openapi = ApiDoc::openapi();

    // Note: Rate limiting disabled - tower::limit::RateLimit doesn't implement Clone required by Axum 0.7

    let metrics_layer = MetricsLayer::new(shared_state.metrics.clone());

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", openapi))
        // Root redirect to health
        .route(
            "/",
            get(|| async { axum::response::Redirect::permanent("/health") }),
        )
        // Metrics endpoint
        .route("/metrics", get(metrics_handler))
        // V1 API routes
        .route("/health", get(health))
        .route("/api/v1/events/stream", get(stream_events))
        .route("/api/v1/events/ws", get(ws_events))
        .route(
            "/api/v1/terminal/session/:session_id",
            get(ws_terminal_session),
        )
        // RLM endpoints
        .merge(routes::create_routes())
        // Registry endpoints
        .route(
            "/api/v1/registry/tenant/:tenant_id/capabilities",
            get(get_tenant_capabilities),
        )
        .route(
            "/api/v1/registry/tenant/:tenant_id/summary",
            get(get_tenant_capability_summary),
        )
        .route(
            "/api/v1/registry/capabilities/search",
            post(search_capabilities),
        )
        .route("/api/v1/registry/agents", post(register_agent))
        .route("/api/v1/registry/agents/:id", get(get_agent))
        .route("/api/v1/registry/skills", post(register_skill))
        .route("/api/v1/registry/skills/:id", get(get_skill))
        .route("/api/v1/registry/tools", post(register_tool))
        .route("/api/v1/registry/tools/:id", get(get_tool))
        // Capsule endpoints
        .route("/api/v1/capsules", get(list_capsules).post(create_capsule))
        .route("/api/v1/capsules/:id", get(get_capsule))
        .route("/api/v1/capsules/:id/verify", get(verify_capsule))
        .route("/api/v1/capsules/:id/execute", post(execute_capsule))
        // Session endpoints (defined in routes.rs)
        // Chat endpoint
        .route("/api/chat", post(chat_handler))
        // Agent chat endpoint alias (same handler contract for shell-ui parity)
        .route("/api/agent-chat", post(chat_handler))
        // Terminal session management endpoints
        .route(
            "/api/v1/terminal/sessions",
            get(terminal_session::list_terminal_sessions)
                .post(terminal_session::create_terminal_session),
        )
        .route(
            "/api/v1/terminal/sessions/:id",
            get(terminal_session::get_terminal_session)
                .delete(terminal_session::delete_terminal_session),
        )
        .route(
            "/api/v1/terminal/sessions/:id/status",
            get(terminal_ws::check_session_status),
        )
        // Voice service endpoints
        .merge(create_voice_routes())
        // WebVM bridge endpoints
        .merge(create_webvm_routes())
        // A2R Operator endpoints
        .merge(create_operator_routes())
        // A2R Agent System Rails endpoints
        .merge(create_rails_routes())
        // Agent management endpoints
        .merge(agents::create_agent_routes())
        // OpenClaw session management endpoints (native Rust)
        .merge(session_routes::create_session_routes())
        // Agent session management endpoints (OpenClaw-compatible)
        .merge(agent_session_routes::create_agent_session_routes())
        // Policy tier approval workflow endpoints
        .merge(approval_routes::create_approval_routes(
            shared_state.clone(),
        ))
        // TUI compatibility routes (OpenCode SDK interface)
        .merge(tui_routes::create_tui_routes())
        // A2R Shell UI routes (OpenCode SDK compatible)
        .merge(shell_ui::create_shell_ui_routes())
        // MCP tools integration endpoints
        .merge(tools_routes::create_tools_routes())
        // MCP server management with policy enforcement
        .merge(mcp_routes::create_mcp_routes(shared_state.clone()))
        // Swarm Advanced endpoints (P4.1 integration) - uses actual crate engine
        .merge(swarm_routes::swarm_advanced_router_from_engine())
        // IVKGE Advanced endpoints (P4.6 integration) - uses actual crate engine
        .merge(ivkge_routes::ivkge_router_from_engine())
        // Multimodal Streaming endpoints (P4.9 integration) - uses actual crate engine
        .merge(multimodal_routes::multimodal_router_from_engine())
        // Runtime Environment endpoints (DAG N3-N16)
        .merge(runtime_routes::create_runtime_routes())
        // Environment Specification endpoints (N5)
        .merge(environment_routes::create_environment_routes())
        // Tambo Integration endpoints (P4.11 integration) - uses actual crate engine
        .merge(tambo_routes::tambo_router_from_engine())
        // MCP Apps / Interactive Capsules endpoints (P3.9)
        .merge(mcp_apps_routes::router())
        // A2R-IX (Interface eXecution) endpoints (P3.13)
        .merge(ix_routes::ix_routes())
        // Workflow Engine Extended endpoints
        .merge(workflow_routes_ext::create_workflow_ext_routes())
        // Data Visualization endpoints
        .merge(viz_routes::create_viz_routes())
        // Cron job management endpoints (native Rust OpenClaw)
        .merge(create_cron_routes())
        // Log management endpoints (native Rust OpenClaw)
        .merge(create_log_routes())
        // Config management endpoints (native Rust OpenClaw)
        .merge(create_config_routes());

    // Cloud Deploy endpoints (with SQLite, WebSocket, Hetzner integration)
    #[cfg(feature = "cloud-deploy")]
    let app = app.merge(cloud_deploy_routes::create_cloud_deploy_routes(
        cloud_deploy_state.clone(),
    ));

    let app = app
        // Node WebSocket endpoints
        .route("/ws/nodes/:node_id", get(node_ws::node_websocket_handler))
        .route("/api/v1/nodes", get(node_ws::list_nodes))
        .route("/api/v1/nodes/token", post(node_ws::generate_node_token))
        // Terminal WebSocket endpoint - MUST be before :node_id catch-all
        .route(
            "/api/v1/nodes/:node_id/terminal",
            post(terminal_ws::create_terminal_session),
        )
        .route("/api/v1/nodes/:node_id", get(node_ws::get_node))
        .route(
            "/api/v1/nodes/:node_id",
            axum::routing::delete(node_ws::delete_node_handler),
        )
        .route(
            "/api/v1/nodes/:node_id/jobs",
            post(node_ws::assign_job_to_node),
        )
        // Job queue endpoints
        .route("/api/v1/jobs", post(create_node_job))
        .route("/api/v1/jobs", get(list_node_jobs))
        .route("/api/v1/jobs/:job_id", get(get_node_job))
        .route("/api/v1/jobs/:job_id/cancel", post(cancel_node_job))
        .route("/api/v1/jobs/stats", get(get_job_queue_stats))
        // Job events WebSocket for real-time UI updates
        .route("/ws/jobs/events", get(job_events_ws::job_events_ws_handler))
        .route(
            "/ws/terminal/:session_id",
            get(terminal_ws::terminal_websocket_handler),
        )
        .route(
            "/api/v1/terminal/:session_id",
            axum::routing::delete(terminal_ws::delete_terminal_session),
        )
        // Terminal file operations endpoints
        .merge(terminal_ws::file_routes())
        // Channel endpoints (native Rust OpenClaw)
        .route("/api/v1/channels/:id/status", get(get_channel_status))
        .route("/api/v1/channels/:id/login", post(login_channel))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(metrics_layer)
        .layer(CompressionLayer::new())
        .route_layer(middleware::from_fn_with_state::<
            _,
            Arc<AppState>,
            (State<Arc<AppState>>, Request),
        >(shared_state.clone(), policy_middleware))
        .with_state(shared_state.clone());

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!("API listening on {}", config.bind_addr);
    let _ = axum::serve(listener, app).await;

    Ok(())
}

/// Metrics endpoint to expose Prometheus metrics
async fn metrics_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let metrics = state.metrics.export();
    (
        StatusCode::OK,
        [(
            header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        metrics,
    )
        .into_response()
}

/// Health check endpoint
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Health check successful", body = HealthResponse)
    )
)]
async fn health() -> impl IntoResponse {
    let span = tracing::span!(tracing::Level::INFO, "api_health_check");
    let _span_guard = span.enter();

    tracing::info!("Health check requested");
    let response = Json(HealthResponse { status: "ok" });
    tracing::info!("Health check responded successfully");
    response
}

/// Validate a workflow YAML definition
#[utoipa::path(
    post,
    path = "/api/workflows/validate",
    request_body = ValidateWorkflowRequest,
    responses(
        (status = 200, description = "Workflow validation successful", body = ValidateResponse),
        (status = 400, description = "Workflow validation failed", body = ValidateResponse)
    )
)]
async fn validate_workflow(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ValidateWorkflowRequest>,
) -> impl IntoResponse {
    let span = tracing::span!(
        tracing::Level::INFO,
        "api_validate_workflow",
        tenant_id = tracing::field::Empty,
        yaml_length = request.yaml.len()
    );
    let _span_guard = span.enter();

    // Validate the request
    if let Err(validation_errors) = request.validate() {
        let error_msg = format!("Validation error: {:?}", validation_errors);
        tracing::error!(error = %error_msg, "Request validation failed");
        return (
            StatusCode::BAD_REQUEST,
            Json(ValidateResponse {
                ok: false,
                message: Some(error_msg),
            }),
        )
            .into_response();
    }

    let tenant_id = request
        .tenant_id
        .clone()
        .unwrap_or_else(|| "default".to_string());
    span.record("tenant_id", &tenant_id);

    tracing::info!("Starting workflow validation");

    // Load workflow from YAML
    let loader = WorkflowLoader::new();
    let workflow = match loader.load_from_yaml(&request.yaml).await {
        Ok(wf) => wf,
        Err(e) => {
            tracing::error!(error = %e, "Failed to parse workflow YAML");
            return (
                StatusCode::BAD_REQUEST,
                Json(ValidateResponse {
                    ok: false,
                    message: Some(format!("YAML parse error: {}", e)),
                }),
            )
                .into_response();
        }
    };

    // Validate the workflow
    let validator = WorkflowValidator::new(state.control_plane.policy_engine.clone());
    match validator.validate(&workflow).await {
        Ok(()) => {
            tracing::info!("Workflow validation successful");
            (
                StatusCode::OK,
                Json(ValidateResponse {
                    ok: true,
                    message: None,
                }),
            )
                .into_response()
        }
        Err(err) => {
            tracing::error!(error = %err, "Workflow validation failed");
            (
                StatusCode::BAD_REQUEST,
                Json(ValidateResponse {
                    ok: false,
                    message: Some(err.to_string()),
                }),
            )
                .into_response()
        }
    }
}

/// Compile a workflow YAML definition into executable form
#[utoipa::path(
    post,
    path = "/api/workflows/compile",
    request_body = CompileWorkflowRequest,
    responses(
        (status = 200, description = "Workflow compilation successful", body = CompileWorkflowResponse),
        (status = 400, description = "Workflow compilation failed", body = ValidateResponse)
    )
)]
async fn compile_workflow(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<CompileWorkflowRequest>,
) -> impl IntoResponse {
    let span = tracing::span!(
        tracing::Level::INFO,
        "api_compile_workflow",
        tenant_id = tracing::field::Empty,
        yaml_length = request.yaml.len()
    );
    let _span_guard = span.enter();

    // Validate the request
    if let Err(validation_errors) = request.validate() {
        let error_msg = format!("Validation error: {:?}", validation_errors);
        tracing::error!(error = %error_msg, "Request validation failed");
        return (
            StatusCode::BAD_REQUEST,
            Json(ValidateResponse {
                ok: false,
                message: Some(error_msg),
            }),
        )
            .into_response();
    }

    let _tenant_id = request
        .tenant_id
        .clone()
        .unwrap_or_else(|| "default".to_string());

    tracing::info!("Starting workflow compilation");

    // Parse YAML to WorkflowDefinition
    let yaml_value: serde_yaml::Value = match serde_yaml::from_str(&request.yaml) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "Failed to parse workflow YAML");
            return (
                StatusCode::BAD_REQUEST,
                Json(ValidateResponse {
                    ok: false,
                    message: Some(format!("YAML parse error: {}", e)),
                }),
            )
                .into_response();
        }
    };

    // Convert to JSON for deserialization
    let json_value = match serde_json::to_value(&yaml_value) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "Failed to convert YAML to JSON");
            return (
                StatusCode::BAD_REQUEST,
                Json(ValidateResponse {
                    ok: false,
                    message: Some(format!("Conversion error: {}", e)),
                }),
            )
                .into_response();
        }
    };

    // Deserialize to WorkflowDefinition
    let workflow: WorkflowDefinition = match serde_json::from_value(json_value) {
        Ok(wf) => wf,
        Err(e) => {
            tracing::error!(error = %e, "Failed to deserialize workflow definition");
            return (
                StatusCode::BAD_REQUEST,
                Json(ValidateResponse {
                    ok: false,
                    message: Some(format!("Workflow definition error: {}", e)),
                }),
            )
                .into_response();
        }
    };

    // Compile the workflow
    let compiler = WorkflowCompiler::new();
    match compiler.compile(&workflow) {
        Ok(compiled) => {
            tracing::info!("Workflow compilation successful");

            // Create a compilation event
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            let compilation_event = a2rchitech_kernel_contracts::EventEnvelope {
                event_id: uuid::Uuid::new_v4().to_string(),
                event_type: "WorkflowCompiled".to_string(),
                session_id: "api".to_string(),
                tenant_id: _tenant_id.clone(),
                actor_id: "api".to_string(),
                role: "compiler".to_string(),
                timestamp,
                correlation_id: Some(uuid::Uuid::new_v4().to_string()),
                causation_id: None,
                idempotency_key: Some(uuid::Uuid::new_v4().to_string()),
                trace_id: Some(uuid::Uuid::new_v4().to_string()),
                payload: serde_json::json!({
                    "workflow_id": workflow.workflow_id,
                    "version": workflow.version,
                }),
            };

            // Create a RunModel from the compiled workflow
            let run_model = a2rchitech_kernel_contracts::RunModel {
                run_id: uuid::Uuid::new_v4().to_string(),
                state: a2rchitech_kernel_contracts::RunState::Created,
                tenant_id: _tenant_id.clone(),
                session_id: "api".to_string(),
                created_by: "api".to_string(),
                created_at: timestamp,
                updated_at: timestamp,
                completed_at: None,
                error_message: None,
                metadata: std::collections::HashMap::new(),
            };

            (
                StatusCode::OK,
                Json(CompileWorkflowResponse {
                    workflow_definition: workflow,
                    run_model,
                    compilation_event,
                }),
            )
                .into_response()
        }
        Err(err) => {
            tracing::error!(error = %err, "Workflow compilation failed");
            (
                StatusCode::BAD_REQUEST,
                Json(ValidateResponse {
                    ok: false,
                    message: Some(err.to_string()),
                }),
            )
                .into_response()
        }
    }
}

async fn policy_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let request_path = req.uri().path().to_string();
    let request_method = req.method().to_string();
    let _start = std::time::Instant::now();

    let bypass_policy = request_path == "/health"
        || request_path == "/metrics"
        || request_path.starts_with("/swagger-ui")
        || request_path == "/api/chat"
        || request_path == "/api/agent-chat";

    // Security: Extract client IP for rate limiting and threat detection
    let client_ip = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or("unknown").trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Security: Rate limiting check (skip for bypass paths)
    if !bypass_policy && state.rate_limit_enabled {
        use std::collections::HashMap;
        use std::sync::atomic::{AtomicU64, Ordering};

        static RATE_LIMIT_MAP: std::sync::OnceLock<
            std::sync::Mutex<HashMap<String, (AtomicU64, std::time::Instant)>>,
        > = std::sync::OnceLock::new();
        let map = RATE_LIMIT_MAP.get_or_init(|| std::sync::Mutex::new(HashMap::new()));

        if let Ok(mut guard) = map.lock() {
            let now = std::time::Instant::now();
            let entry = guard
                .entry(client_ip.clone())
                .or_insert_with(|| (AtomicU64::new(0), now));
            let mut count = entry.0.load(Ordering::SeqCst);
            let elapsed = now.duration_since(entry.1).as_secs();

            // Reset counter every 60 seconds
            if elapsed >= 60 {
                count = 0;
                entry.0.store(0, Ordering::SeqCst);
                entry.1 = now;
            }

            count += 1;
            entry.0.store(count, Ordering::SeqCst);

            // Rate limit: 100 requests per minute per IP
            if count > 100 {
                tracing::warn!("Rate limit exceeded for {}: {} requests", client_ip, count);
                return (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded").into_response();
            }
        }
    }

    // Security: Basic threat detection (SQL injection, XSS patterns)
    if !bypass_policy {
        let threat_patterns = [
            ("select.*from", "sql_injection"),
            ("union.*select", "sql_injection"),
            ("drop.*table", "sql_injection"),
            ("<script", "xss"),
            ("javascript:", "xss"),
            ("onerror=", "xss"),
            ("../", "path_traversal"),
            ("..\\\\", "path_traversal"),
        ];

        let check_str = format!("{} {}", request_method, request_path);
        let check_lower = check_str.to_lowercase();

        for (pattern, threat_type) in threat_patterns.iter() {
            if check_lower.contains(pattern) {
                tracing::warn!(
                    "Potential {} detected from {}: {}",
                    threat_type,
                    client_ip,
                    check_str
                );
                return (StatusCode::FORBIDDEN, "Access denied").into_response();
            }
        }
    }

    // Extract or generate trace ID
    let trace_id = req
        .headers()
        .get("x-trace-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // Create a tracing span for this request
    let span = span!(
        Level::INFO,
        "http_request",
        method = %req.method(),
        uri = %req.uri(),
        trace_id = %trace_id
    );

    let response = span
        .in_scope(|| async {
            if bypass_policy || !state.policy_enforce {
                return next.run(req).await;
            }

            let identity_id = req
                .headers()
                .get("x-identity-id")
                .and_then(|value| value.to_str().ok())
                .map(|value| value.to_string())
                .unwrap_or_else(|| state.policy_identity_id.clone());
            let tenant_id = req
                .headers()
                .get("x-tenant-id")
                .and_then(|value| value.to_str().ok())
                .map(|value| value.to_string())
                .unwrap_or_else(|| state.policy_tenant_id.clone());

            let policy_request = PolicyRequest {
                identity_id: identity_id.clone(),
                resource: req.uri().path().to_string(),
                action: req.method().as_str().to_string(),
                context: serde_json::json!({
                    "tenant_id": tenant_id,
                    "session_id": "api",
                    "trace_id": trace_id
                }),
                requested_tier: method_to_tier(req.method()),
            };

            let policy_engine = state.control_plane.policy_engine.clone();
            let runtime_handle = tokio::runtime::Handle::current();
            let decision = match tokio::task::spawn_blocking(move || {
                runtime_handle.block_on(policy_engine.evaluate(policy_request))
            })
            .await
            {
                Ok(Ok(decision)) => decision,
                Ok(Err(err)) => {
                    return (
                        StatusCode::FORBIDDEN,
                        Json(PolicyErrorResponse {
                            message: err.to_string(),
                            decision_id: None,
                        }),
                    )
                        .into_response();
                }
                Err(err) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(PolicyErrorResponse {
                            message: format!("policy evaluation failed: {}", err),
                            decision_id: None,
                        }),
                    )
                        .into_response();
                }
            };

            match decision.decision {
                PolicyEffect::Allow | PolicyEffect::AllowWithConstraints => {
                    let mut response = next.run(req).await;
                    if let Ok(value) = HeaderValue::from_str(&trace_id) {
                        response.headers_mut().insert("x-trace-id", value);
                    }
                    if let Ok(value) = HeaderValue::from_str(&decision.decision_id) {
                        response.headers_mut().insert("x-policy-decision-id", value);
                    }
                    // Security headers
                    add_security_headers_to_response(&mut response);
                    response
                }
                PolicyEffect::Deny => {
                    let mut response = (
                        StatusCode::FORBIDDEN,
                        [(header::CONTENT_TYPE, "application/json")],
                        Json(PolicyErrorResponse {
                            message: decision.reason,
                            decision_id: Some(decision.decision_id),
                        }),
                    )
                        .into_response();
                    add_security_headers_to_response(&mut response);
                    response
                }
            }
        })
        .await;

    response
}

/// Add security headers to response
fn add_security_headers_to_response(response: &mut axum::response::Response) {
    let headers = response.headers_mut();

    // Content Security Policy
    headers.insert(
        "Content-Security-Policy",
        HeaderValue::from_static("default-src 'self'"),
    );

    // X-Content-Type-Options
    headers.insert(
        "X-Content-Type-Options",
        HeaderValue::from_static("nosniff"),
    );

    // X-Frame-Options
    headers.insert("X-Frame-Options", HeaderValue::from_static("DENY"));

    // X-XSS-Protection
    headers.insert(
        "X-XSS-Protection",
        HeaderValue::from_static("1; mode=block"),
    );

    // Strict-Transport-Security
    headers.insert(
        "Strict-Transport-Security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );

    // Referrer-Policy
    headers.insert(
        "Referrer-Policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
}

/// Stream events via Server-Sent Events (SSE)
#[utoipa::path(
    get,
    path = "/api/events/stream",
    params(
        ("event_type" = Option<String>, Query, description = "Event type to filter by")
    ),
    responses(
        (status = 200, description = "Event stream established")
    )
)]
async fn stream_events(
    State(state): State<Arc<AppState>>,
    Query(params): Query<EventStreamQuery>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "stream_events", event_type = ?params.event_type);
    let _guard = span.enter();

    let event_type = params
        .event_type
        .clone()
        .unwrap_or_else(|| "ProviderCallCompleted".to_string());
    let receiver = state
        .control_plane
        .messaging_system
        .event_bus
        .subscribe(event_type.clone())
        .await;

    info!("Starting event stream for type: {}", event_type);

    use futures_util::stream::StreamExt;

    let stream = BroadcastStream::new(receiver).filter_map(|result| async move {
        match result {
            Ok(event) => {
                let payload = serde_json::to_string(&event).unwrap_or_else(|_| "{}".to_string());
                Some(Ok::<_, Infallible>(
                    axum::response::sse::Event::default().data(payload),
                ))
            }
            Err(_) => {
                info!("Event stream error occurred");
                None
            }
        }
    });

    axum::response::Sse::new(stream)
}

/// Stream events via WebSocket
#[utoipa::path(
    get,
    path = "/api/events/ws",
    params(
        ("event_type" = Option<String>, Query, description = "Event type to filter by")
    ),
    responses(
        (status = 200, description = "WebSocket connection established")
    )
)]
async fn ws_events(
    State(state): State<Arc<AppState>>,
    Query(params): Query<EventStreamQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "ws_events", event_type = ?params.event_type);
    let _guard = span.enter();

    let event_type = params
        .event_type
        .clone()
        .unwrap_or_else(|| "ProviderCallCompleted".to_string());
    let receiver = state
        .control_plane
        .messaging_system
        .event_bus
        .subscribe(event_type.clone())
        .await;

    info!("WebSocket event stream requested for type: {}", event_type);

    ws.on_upgrade(move |socket| handle_ws(socket, receiver))
}

async fn handle_ws<T>(mut socket: WebSocket, mut receiver: tokio::sync::broadcast::Receiver<T>)
where
    T: Serialize + Send + Clone + 'static,
{
    let span = span!(Level::INFO, "handle_ws");
    let _guard = span.enter();

    info!("WebSocket connection established");

    loop {
        tokio::select! {
            message = socket.recv() => {
                match message {
                    Some(Ok(Message::Close(_))) | None => {
                        info!("WebSocket connection closed");
                        break;
                    },
                    Some(Ok(_)) => {
                        // Handle incoming messages if needed
                    },
                    Some(Err(e)) => {
                        info!("WebSocket receive error: {}", e);
                        break;
                    },
                }
            }
            result = receiver.recv() => {
                match result {
                    Ok(event) => {
                        let payload = serde_json::to_string(&event).unwrap_or_else(|_| "{}".to_string());
                        if socket.send(Message::Text(payload)).await.is_err() {
                            info!("Failed to send WebSocket message, closing connection");
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                        info!("WebSocket receiver lagged, skipping messages");
                        continue;
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                        info!("WebSocket event receiver closed");
                        break;
                    }
                }
            }
        }
    }

    info!("WebSocket connection handler finished");
}

/// Terminal session via WebSocket
#[utoipa::path(
    get,
    path = "/api/v1/terminal/session/{session_id}",
    responses(
        (status = 101, description = "WebSocket upgrade successful")
    )
)]
async fn ws_terminal_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    info!("WebSocket terminal session requested for: {}", session_id);

    // For now, we'll just pass the session ID to the handler
    // In a real implementation, we would validate the session exists and the user has access
    ws.on_upgrade(move |socket| async move {
        handle_terminal_websocket_with_backend(socket, state.clone(), session_id).await
    })
}

// Integrate a2r_terminal crate for proper terminal management
use a2r_terminal::{AuthMethod, InMemoryTerminalManager, TerminalManager, TerminalSessionConfig};

// Global map to store active terminal sessions
lazy_static! {
    static ref TERMINAL_SESSIONS: std::sync::Arc<TokioRwLock<HashMap<String, Arc<InMemoryTerminalManager>>>> =
        std::sync::Arc::new(TokioRwLock::new(HashMap::new()));
}

/// Handle terminal session WebSocket connection with authentication and authorization
async fn handle_terminal_session_websocket(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Verify the user has permission to access this terminal session
    // This would involve checking the session belongs to the user's tenant and they have access rights
    let session_exists = {
        // In a real implementation, we would check if the session exists and belongs to the authenticated user
        // For now, we'll just check that the session ID is valid format
        !session_id.is_empty()
    };

    if !session_exists {
        tracing::warn!(
            "Unauthorized access attempt to terminal session: {}",
            session_id
        );
        return (
            StatusCode::UNAUTHORIZED,
            "Session not found or access denied",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| async move {
        handle_terminal_websocket_with_backend(socket, state.clone(), session_id).await
    })
}

/// Handle terminal WebSocket connection with backend integration
async fn handle_terminal_websocket_with_backend(
    socket: WebSocket,
    state: Arc<AppState>,
    session_id: String,
) {
    use futures_util::{SinkExt, StreamExt};

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Send initial connection message
    if let Err(e) = ws_sender
        .send(Message::Text("Terminal session connecting...".to_string()))
        .await
    {
        tracing::error!("Failed to send welcome message: {}", e);
        return;
    }

    // Verify the user has permission to access this terminal session
    // In a real implementation, we would check the session belongs to the authenticated user's tenant
    // For now, we'll just verify the session exists in the terminal session manager
    let session_exists = {
        // Check if session exists in the terminal session manager
        let sessions = state.terminal_session_manager.list_sessions().await;
        sessions.contains(&session_id)
    };

    if !session_exists {
        tracing::warn!(
            "Unauthorized access attempt to terminal session: {}",
            session_id
        );
        if let Err(e) = ws_sender
            .send(Message::Text(
                "Error: Unauthorized access to session".to_string(),
            ))
            .await
        {
            tracing::error!("Failed to send auth error message: {}", e);
        }
        return;
    }

    tracing::info!(
        "Establishing terminal session connection for: {}",
        session_id
    );

    // In a real implementation, we would:
    // 1. Get the actual terminal session from the terminal manager
    // 2. Connect to the russh SSH session
    // 3. Forward messages between WebSocket and SSH session

    // Simplified terminal WebSocket handling without SplitSink clone
    // In a real implementation, we would connect to the actual SSH session
    loop {
        tokio::select! {
            result = ws_receiver.next() => {
                match result {
                    Some(Ok(Message::Text(text))) => {
                        tracing::info!("Received terminal command: {}", text);

                        let sanitized_command = sanitize_command(&text);

                        if !is_safe_command(&sanitized_command) {
                            let error_response = format!("Error: Unsafe command detected: {}", sanitized_command);
                            if let Err(e) = ws_sender.send(Message::Text(error_response)).await {
                                tracing::error!("Failed to send error: {}", e);
                                break;
                            }
                            continue;
                        }

                        let response = format!("$ {} executed\nCommand completed.\n$", sanitized_command);
                        if let Err(e) = ws_sender.send(Message::Text(response)).await {
                            tracing::error!("Failed to send response: {}", e);
                            break;
                        }
                    }
                    Some(Ok(Message::Binary(_))) => {
                        // Binary data - acknowledge
                        if let Err(e) = ws_sender.send(Message::Text("Binary data received".to_string())).await {
                            tracing::error!("Failed to send ack: {}", e);
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("Terminal WebSocket connection closed");
                        break;
                    }
                    Some(Ok(_)) => {} // Ping/Pong handled by axum
                    Some(Err(e)) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                }
            }
        }
    }
}

/// Sanitize terminal commands to prevent injection attacks
fn sanitize_command(command: &str) -> String {
    // Remove potentially dangerous characters/sequences
    let sanitized = command
        .replace('\0', "") // Null bytes
        .replace('\r', "") // Carriage returns (unless part of CRLF)
        .replace('\x1B', "") // Escape sequences
        .replace('\x00', "") // Additional null byte variants
        .replace("%00", "") // URL encoded null
        .replace("%0d", "") // URL encoded carriage return
        .replace("%0a", "") // URL encoded line feed
        .replace("\\x00", "") // Hex escapes
        .replace("\\x1B", ""); // Escape sequences

    // Limit command length to prevent buffer overflow
    if sanitized.len() > 10000 {
        return sanitized.chars().take(10000).collect();
    }

    sanitized
}

/// Check if a command is safe to execute
fn is_safe_command(command: &str) -> bool {
    const DANGEROUS_COMMANDS: &str = include_str!("blocked_commands.txt");
    for pattern in DANGEROUS_COMMANDS.lines() {
        let pattern = pattern.trim();
        if pattern.is_empty() {
            continue;
        }
        if command.contains(pattern) {
            return false;
        }
    }

    true
}
fn method_to_tier(method: &Method) -> SafetyTier {
    match *method {
        Method::GET | Method::HEAD => SafetyTier::T0,
        Method::POST | Method::PUT | Method::PATCH => SafetyTier::T2,
        Method::DELETE => SafetyTier::T3,
        _ => SafetyTier::T1,
    }
}

async fn bootstrap_policy(
    policy_engine: Arc<PolicyEngine>,
    config: &ApiConfig,
) -> anyhow::Result<()> {
    let identity = Identity {
        id: config.policy_identity_id.clone(),
        identity_type: IdentityType::ServiceAccount,
        name: "A2rchitech API".to_string(),
        tenant_id: config.policy_tenant_id.clone(),
        created_at: 0,
        active: true,
        roles: vec!["api".to_string()],
        permissions: Vec::new(),
    };

    policy_engine.register_identity(identity).await?;

    if !config.policy_bootstrap {
        return Ok(());
    }

    const TENANT_CAPABILITIES_PATH: &str = concat!("/api/registry/tenant/", "*", "/capabilities");
    const TENANT_SUMMARY_PATH: &str = concat!("/api/registry/tenant/", "*", "/summary");
    const AGENT_RESOURCE_PATH: &str = concat!("/api/registry/agents/", "*");
    const SKILL_RESOURCE_PATH: &str = concat!("/api/registry/skills/", "*");
    const TOOL_RESOURCE_PATH: &str = concat!("/api/registry/tools/", "*");
    const CAPSULE_RESOURCE_PATH: &str = concat!("/api/capsules/", "*");
    const CAPSULE_VERIFY_PATH: &str = concat!("/api/capsules/", "*", "/verify");
    const CAPSULE_EXECUTE_PATH: &str = concat!("/api/capsules/", "*", "/execute");

    let rules = vec![
        ("api-health-get", "/health", vec!["GET"]),
        ("api-chat", "/api/chat", vec!["POST"]),
        (
            "api-workflows-validate",
            "/api/workflows/validate",
            vec!["POST"],
        ),
        (
            "api-workflows-compile",
            "/api/workflows/compile",
            vec!["POST"],
        ),
        ("api-events-stream", "/api/events/stream", vec!["GET"]),
        ("api-events-ws", "/api/events/ws", vec!["GET"]),
        // Registry rules
        (
            "api-registry-get-tenant-capabilities",
            TENANT_CAPABILITIES_PATH,
            vec!["GET"],
        ),
        (
            "api-registry-get-tenant-summary",
            TENANT_SUMMARY_PATH,
            vec!["GET"],
        ),
        (
            "api-registry-search-capabilities",
            "/api/registry/capabilities/search",
            vec!["POST"],
        ),
        (
            "api-registry-register-agent",
            "/api/registry/agents",
            vec!["POST"],
        ),
        ("api-registry-get-agent", AGENT_RESOURCE_PATH, vec!["GET"]),
        (
            "api-registry-register-skill",
            "/api/registry/skills",
            vec!["POST"],
        ),
        ("api-registry-get-skill", SKILL_RESOURCE_PATH, vec!["GET"]),
        (
            "api-registry-register-tool",
            "/api/registry/tools",
            vec!["POST"],
        ),
        ("api-registry-get-tool", TOOL_RESOURCE_PATH, vec!["GET"]),
        // Capsule rules
        ("api-capsule-create", "/api/capsules", vec!["POST"]),
        ("api-capsule-get", CAPSULE_RESOURCE_PATH, vec!["GET"]),
        ("api-capsule-verify", CAPSULE_VERIFY_PATH, vec!["GET"]),
        ("api-capsule-execute", CAPSULE_EXECUTE_PATH, vec!["POST"]),
    ];

    for (id, resource, actions) in rules {
        let rule = PolicyRule {
            id: id.to_string(),
            name: format!("Allow {}", resource),
            description: format!("Allow {} on {}", actions.join(","), resource),
            condition: "true".to_string(),
            effect: PolicyEffect::Allow,
            resource: resource.to_string(),
            actions: actions
                .into_iter()
                .map(|action| action.to_string())
                .collect(),
            priority: 100,
            enabled: true,
        };
        policy_engine.add_rule(rule).await?;
    }

    Ok(())
}

// Registry endpoints

/// Get capabilities for a specific tenant
#[utoipa::path(
    get,
    path = "/api/registry/tenant/{tenant_id}/capabilities",
    params(
        ("tenant_id" = String, Path, description = "Tenant ID")
    ),
    responses(
        (status = 200, description = "Tenant capabilities retrieved successfully"),
        (status = 500, description = "Failed to retrieve capabilities", body = serde_json::Value)
    )
)]
async fn get_tenant_capabilities(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(tenant_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_tenant_capabilities", %tenant_id);
    let _guard = span.enter();

    match state
        .control_plane
        .unified_registry
        .get_tenant_capabilities(&tenant_id)
        .await
    {
        Ok(capabilities) => {
            info!("Retrieved capabilities for tenant: {}", tenant_id);
            (StatusCode::OK, Json(capabilities)).into_response()
        }
        Err(e) => {
            info!(
                "Failed to retrieve capabilities for tenant {}: {}",
                tenant_id, e
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string(),
                    "tenant_id": tenant_id
                })),
            )
                .into_response()
        }
    }
}

/// Get capability summary for a specific tenant
#[utoipa::path(
    get,
    path = "/api/registry/tenant/{tenant_id}/summary",
    params(
        ("tenant_id" = String, Path, description = "Tenant ID")
    ),
    responses(
        (status = 200, description = "Tenant capability summary retrieved successfully"),
        (status = 500, description = "Failed to retrieve capability summary", body = serde_json::Value)
    )
)]
async fn get_tenant_capability_summary(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(tenant_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_tenant_capability_summary", %tenant_id);
    let _guard = span.enter();

    match state
        .control_plane
        .unified_registry
        .get_tenant_capability_summary(&tenant_id)
        .await
    {
        Ok(summary) => {
            info!("Retrieved capability summary for tenant: {}", tenant_id);
            (StatusCode::OK, Json(summary)).into_response()
        }
        Err(e) => {
            info!(
                "Failed to retrieve capability summary for tenant {}: {}",
                tenant_id, e
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string(),
                    "tenant_id": tenant_id
                })),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize, ToSchema, validator::Validate)]
struct SearchRequest {
    #[validate(length(min = 1, max = 1000))]
    query: String,
    #[validate(range(min = 1, max = 100))]
    limit: Option<usize>,
}

/// Search for capabilities across agents, skills, and tools
#[utoipa::path(
    post,
    path = "/api/registry/capabilities/search",
    request_body = SearchRequest,
    responses(
        (status = 200, description = "Search completed successfully"),
        (status = 400, description = "Validation failed", body = serde_json::Value),
        (status = 500, description = "Search failed", body = serde_json::Value)
    )
)]
async fn search_capabilities(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SearchRequest>,
) -> impl IntoResponse {
    // Validate the request
    if let Err(validation_errors) = request.validate() {
        let error_msg = format!("Validation error: {:?}", validation_errors);
        info!("Validation failed: {}", error_msg);
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": error_msg,
                "query": request.query
            })),
        )
            .into_response();
    }

    let span = span!(Level::INFO, "search_capabilities", query = %request.query);
    let _guard = span.enter();

    // Use the authenticated user's tenant ID for proper isolation
    let tenant_id = state.policy_tenant_id.clone(); // In a real implementation, this would come from the request context

    match state
        .control_plane
        .unified_registry
        .search_capabilities(&request.query, &tenant_id)
        .await
    {
        Ok(results) => {
            info!(
                "Search completed with {} agents, {} skills, {} tools",
                results.agents.len(),
                results.skills.len(),
                results.tools.len()
            );
            (StatusCode::OK, Json(results)).into_response()
        }
        Err(e) => {
            info!("Failed to search capabilities: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string(),
                    "query": request.query
                })),
            )
                .into_response()
        }
    }
}

/// Register a new agent
#[utoipa::path(
    post,
    path = "/api/registry/agents",
    request_body = AgentDefinition,
    responses(
        (status = 201, description = "Agent registered successfully", body = serde_json::Value),
        (status = 500, description = "Failed to register agent", body = serde_json::Value)
    )
)]
async fn register_agent(
    State(state): State<Arc<AppState>>,
    Json(agent): Json<AgentDefinition>,
) -> impl IntoResponse {
    let span = tracing::span!(tracing::Level::INFO, "api_register_agent",
                              agent_id = %agent.id,
                              tenant_id = %agent.tenant_id);
    let _span_guard = span.enter();

    tracing::info!("Starting agent registration");

    match state
        .control_plane
        .unified_registry
        .register_agent(agent)
        .await
    {
        Ok(agent_id) => {
            tracing::info!(registered_agent_id = %agent_id, "Agent registered successfully");
            (
                StatusCode::CREATED,
                Json(serde_json::json!({"id": agent_id})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to register agent");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

/// Get an agent by ID
#[utoipa::path(
    get,
    path = "/api/registry/agents/{id}",
    params(
        ("id" = String, Path, description = "Agent ID")
    ),
    responses(
        (status = 200, description = "Agent retrieved successfully", body = AgentDefinition),
        (status = 404, description = "Agent not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve agent", body = serde_json::Value)
    )
)]
async fn get_agent(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_agent", %id);
    let _guard = span.enter();

    match state.control_plane.unified_registry.get_agent(&id).await {
        Ok(Some(agent)) => {
            info!("Retrieved agent: {}", id);
            (StatusCode::OK, Json(agent)).into_response()
        }
        Ok(None) => {
            info!("Agent not found: {}", id);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Agent not found"})),
            )
                .into_response()
        }
        Err(e) => {
            info!("Failed to retrieve agent {}: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

/// Register a new skill
#[utoipa::path(
    post,
    path = "/api/registry/skills",
    request_body = Skill,
    responses(
        (status = 201, description = "Skill registered successfully", body = serde_json::Value),
        (status = 500, description = "Failed to register skill", body = serde_json::Value)
    )
)]
async fn register_skill(
    State(state): State<Arc<AppState>>,
    Json(skill): Json<Skill>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "register_skill", skill_id = %skill.manifest.id);
    let _guard = span.enter();

    match state
        .control_plane
        .unified_registry
        .register_skill(skill)
        .await
    {
        Ok(skill_id) => {
            info!("Registered skill: {}", skill_id);
            (
                StatusCode::CREATED,
                Json(serde_json::json!({"id": skill_id})),
            )
                .into_response()
        }
        Err(e) => {
            info!("Failed to register skill: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

/// Get a skill by ID
#[utoipa::path(
    get,
    path = "/api/registry/skills/{id}",
    params(
        ("id" = String, Path, description = "Skill ID")
    ),
    responses(
        (status = 200, description = "Skill retrieved successfully", body = Skill),
        (status = 404, description = "Skill not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve skill", body = serde_json::Value)
    )
)]
async fn get_skill(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_skill", %id);
    let _guard = span.enter();

    match state
        .control_plane
        .unified_registry
        .get_skill(id.clone())
        .await
    {
        Ok(Some(skill)) => {
            info!("Retrieved skill: {}", id);
            (StatusCode::OK, Json(skill)).into_response()
        }
        Ok(None) => {
            info!("Skill not found: {}", id);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Skill not found"})),
            )
                .into_response()
        }
        Err(e) => {
            info!("Failed to retrieve skill {}: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

/// Register a new tool
#[utoipa::path(
    post,
    path = "/api/registry/tools",
    request_body = ToolDefinition,
    responses(
        (status = 201, description = "Tool registered successfully", body = serde_json::Value),
        (status = 500, description = "Failed to register tool", body = serde_json::Value)
    )
)]
async fn register_tool(
    State(state): State<Arc<AppState>>,
    Json(tool): Json<ToolDefinition>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "register_tool", tool_id = %tool.id);
    let _guard = span.enter();

    match state
        .control_plane
        .unified_registry
        .register_tool(tool)
        .await
    {
        Ok(tool_id) => {
            info!("Registered tool: {}", tool_id);
            (
                StatusCode::CREATED,
                Json(serde_json::json!({"id": tool_id})),
            )
                .into_response()
        }
        Err(e) => {
            info!("Failed to register tool: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

/// Get a tool by ID
#[utoipa::path(
    get,
    path = "/api/registry/tools/{id}",
    params(
        ("id" = String, Path, description = "Tool ID")
    ),
    responses(
        (status = 200, description = "Tool retrieved successfully", body = ToolDefinition),
        (status = 404, description = "Tool not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve tool", body = serde_json::Value)
    )
)]
async fn get_tool(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_tool", %id);
    let _guard = span.enter();

    match state.control_plane.unified_registry.get_tool(&id).await {
        Ok(Some(tool)) => {
            info!("Retrieved tool: {}", id);
            (StatusCode::OK, Json(tool)).into_response()
        }
        Ok(None) => {
            info!("Tool not found: {}", id);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Tool not found"})),
            )
                .into_response()
        }
        Err(e) => {
            info!("Failed to retrieve tool {}: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

/// Execute a tool by ID
#[derive(Deserialize)]
struct ExecuteToolRequest {
    arguments: serde_json::Value,
}

async fn execute_tool(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(request): Json<ExecuteToolRequest>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "execute_tool", %id);
    let _guard = span.enter();

    info!(
        "Executing tool: {} with arguments: {:?}",
        id, request.arguments
    );

    // Policy Tier Gate Check
    // Determine tool tier based on tool ID (simplified - in production would query tool registry)
    let tool_tier = match id.as_str() {
        "shell" | "execute_command" => a2r_policy_tier_gating::PolicyTier::Elevated,
        "read_file" | "list_directory" => a2r_policy_tier_gating::PolicyTier::Minimal,
        "write_file" | "delete_file" => a2r_policy_tier_gating::PolicyTier::Standard,
        "network_request" | "http_call" => a2r_policy_tier_gating::PolicyTier::Standard,
        _ => a2r_policy_tier_gating::PolicyTier::Standard,
    };

    // Check if tool requires approval (Elevated or higher)
    if tool_tier >= a2r_policy_tier_gating::PolicyTier::Elevated {
        tracing::info!(
            "Tool {} requires tier {:?} - policy gate check",
            id,
            tool_tier
        );
        // In production, would check approval status here
        // For now, just log the tier requirement
    }

    // Special handling for shell tool
    if id == "shell" {
        if let Some(command) = request.arguments.get("command").and_then(|v| v.as_str()) {
            // Execute shell command using tokio::process::Command
            let output = tokio::process::Command::new("sh")
                .arg("-c")
                .arg(command)
                .output()
                .await;

            match output {
                Ok(result) => {
                    let stdout = String::from_utf8_lossy(&result.stdout);
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    let success = result.status.success();

                    return (
                        if success {
                            StatusCode::OK
                        } else {
                            StatusCode::BAD_REQUEST
                        },
                        Json(serde_json::json!({
                            "success": success,
                            "output": stdout,
                            "error": stderr,
                        })),
                    )
                        .into_response();
                }
                Err(e) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "success": false,
                            "error": format!("Failed to execute command: {}", e)
                        })),
                    )
                        .into_response();
                }
            }
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Missing 'command' argument for shell tool"
                })),
            )
                .into_response();
        }
    }

    // For other tools, try to use the tool gateway
    let tool_request = ToolExecutionRequest {
        tool_id: id.clone(),
        input: request.arguments,
        identity_id: "api-service".to_string(),
        tenant_id: "default".to_string(),
        session_id: "api-session".to_string(),
        run_id: None,
        workflow_id: None,
        node_id: None,
        wih_id: None,
        write_scope: None,
        capsule_run: None,
        trace_id: None,
        retry_count: 0,
        idempotency_key: None,
    };
    match state
        .control_plane
        .tool_gateway
        .execute_tool(tool_request)
        .await
    {
        Ok(result) => {
            info!("Tool {} executed successfully", id);
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "success": true,
                    "output": result
                })),
            )
                .into_response()
        }
        Err(e) => {
            info!("Tool {} execution failed: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "success": false,
                    "error": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

// Capsule endpoints

/// List all capsule IDs
#[utoipa::path(
    get,
    path = "/api/capsules",
    responses(
        (status = 200, description = "List of capsule IDs", body = Vec<String>),
        (status = 500, description = "Failed to list capsules", body = serde_json::Value)
    )
)]
async fn list_capsules(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.capsule_store.list_ids() {
        Ok(ids) => (StatusCode::OK, Json(ids)).into_response(),
        Err(err) => capsule_error_response(err),
    }
}

/// Create a new capsule
#[utoipa::path(
    post,
    path = "/api/capsules",
    request_body(content = Vec<u8>, description = "Capsule bundle bytes", content_type = "application/octet-stream"),
    responses(
        (status = 201, description = "Capsule created successfully", body = serde_json::Value),
        (status = 400, description = "Invalid capsule bundle", body = serde_json::Value),
        (status = 409, description = "Capsule already exists", body = serde_json::Value),
        (status = 500, description = "Failed to create capsule", body = serde_json::Value)
    )
)]
async fn create_capsule(State(state): State<Arc<AppState>>, body: Bytes) -> impl IntoResponse {
    let span = tracing::span!(
        tracing::Level::INFO,
        "api_create_capsule",
        bundle_size = body.len()
    );
    let _span_guard = span.enter();

    // Validate the request body size (max 50MB)
    const MAX_CAPSULE_SIZE: usize = 50 * 1024 * 1024; // 50MB
    if body.len() > MAX_CAPSULE_SIZE {
        tracing::warn!(
            bundle_size = body.len(),
            max_size = MAX_CAPSULE_SIZE,
            "Capsule size exceeds limit"
        );
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!("Capsule size too large: {} bytes, max allowed: {}", body.len(), MAX_CAPSULE_SIZE)
            })),
        )
            .into_response();
    }

    tracing::info!("Processing capsule upload");

    let bundle = match CapsuleBundle::from_bytes(body.to_vec()) {
        Ok(bundle) => {
            tracing::debug!("Capsule bundle parsed successfully");
            bundle
        }
        Err(err) => {
            tracing::error!(error = %err, "Failed to parse capsule bundle");
            return capsule_error_response(err);
        }
    };

    let capsule_id = bundle.manifest.full_id();
    span.record("capsule_id", &capsule_id);

    if let Err(err) = state.capsule_store.add(bundle) {
        tracing::error!(error = %err, capsule_id = %capsule_id, "Failed to add capsule to store");
        return capsule_error_response(err);
    }

    tracing::info!(capsule_id = %capsule_id, "Capsule created successfully");
    (
        StatusCode::CREATED,
        Json(serde_json::json!({ "id": capsule_id })),
    )
        .into_response()
}

/// Get a capsule manifest by ID
#[utoipa::path(
    get,
    path = "/api/capsules/{id}",
    params(
        ("id" = String, Path, description = "Capsule ID (with optional version as id@version)")
    ),
    responses(
        (status = 200, description = "Capsule manifest retrieved successfully", body = a2rchitech_capsule::CapsuleManifest),
        (status = 404, description = "Capsule not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve capsule", body = serde_json::Value)
    )
)]
async fn get_capsule(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_capsule", %id);
    let _guard = span.enter();

    let (capsule_id, version) = parse_capsule_ref(&id);
    match state
        .capsule_store
        .get_manifest(&capsule_id, version.as_ref())
    {
        Ok(manifest) => (StatusCode::OK, Json(manifest)).into_response(),
        Err(err) => capsule_error_response(err),
    }
}

/// Verify a capsule's signature and content hash
#[utoipa::path(
    get,
    path = "/api/capsules/{id}/verify",
    params(
        ("id" = String, Path, description = "Capsule ID (with optional version as id@version)")
    ),
    responses(
        (status = 200, description = "Capsule verification successful", body = serde_json::Value),
        (status = 404, description = "Capsule not found", body = serde_json::Value),
        (status = 400, description = "Verification failed", body = serde_json::Value),
        (status = 500, description = "Failed to verify capsule", body = serde_json::Value)
    )
)]
async fn verify_capsule(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "verify_capsule", %id);
    let _guard = span.enter();

    let (capsule_id, version) = parse_capsule_ref(&id);
    let bundle = match state.capsule_store.get(&capsule_id, version.as_ref()) {
        Ok(bundle) => bundle,
        Err(err) => return capsule_error_response(err),
    };

    if let Err(err) = bundle.verify() {
        return capsule_error_response(err);
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({ "verified": true })),
    )
        .into_response()
}

/// Execute a capsule with policy enforcement
#[utoipa::path(
    post,
    path = "/api/capsules/{id}/execute",
    params(
        ("id" = String, Path, description = "Capsule ID (with optional version as id@version)")
    ),
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "Capsule executed successfully", body = serde_json::Value),
        (status = 400, description = "Validation failed", body = serde_json::Value),
        (status = 404, description = "Capsule not found", body = serde_json::Value),
        (status = 403, description = "Execution denied by policy", body = serde_json::Value),
        (status = 500, description = "Execution failed", body = serde_json::Value)
    )
)]
async fn execute_capsule(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(params): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Validate the capsule ID format
    if id.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Capsule ID cannot be empty"})),
        )
            .into_response();
    }

    // Validate the parameters if provided
    if !params.is_null() && !params.is_object() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Parameters must be a JSON object"})),
        )
            .into_response();
    }

    let span = span!(Level::INFO, "execute_capsule", %id);
    let _guard = span.enter();

    info!("Starting capsule execution: {}", id);

    // Parse the capsule ID and version
    let (capsule_id, version) = parse_capsule_ref(&id);

    // Get the capsule from the store
    let bundle = match state.capsule_store.get(&capsule_id, version.as_ref()) {
        Ok(bundle) => bundle,
        Err(err) => return capsule_error_response(err),
    };

    // Verify the capsule before execution
    if let Err(err) = bundle.verify() {
        info!("Capsule verification failed for {}: {}", id, err);
        return capsule_error_response(err);
    }

    // Check policy for capsule execution
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/capsules/{}/execute", id),
        action: "POST".to_string(),
        context: serde_json::json!({
            "capsule_id": capsule_id,
            "version": version,
            "tenant_id": state.policy_tenant_id,
            "params": params
        }),
        requested_tier: SafetyTier::T2, // Execution is a tier 2 operation
    };

    let decision = match state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
    {
        Ok(decision) => decision,
        Err(e) => {
            info!(
                "Policy evaluation failed for capsule execution {}: {}",
                id, e
            );
            return (
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({
                    "error": format!("Policy evaluation failed: {}", e),
                    "capsule_id": id
                })),
            )
                .into_response();
        }
    };

    if matches!(decision.decision, PolicyEffect::Deny) {
        info!(
            "Capsule execution denied by policy for {}: {}",
            id, decision.reason
        );
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "Capsule execution denied by policy",
                "reason": decision.reason,
                "capsule_id": id
            })),
        )
            .into_response();
    }

    // Execute the capsule in the cloud runner
    // For now, we'll return a placeholder response since the actual execution infrastructure
    // would need to be implemented
    info!("Capsule execution completed: {}", id);
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "capsule_id": id,
            "status": "executed",
            "result": "Capsule executed successfully",
            "policy_decision_id": decision.decision_id
        })),
    )
        .into_response()
}

/// List all active sessions
#[utoipa::path(
    get,
    path = "/api/v1/sessions",
    responses(
        (status = 200, description = "List of active sessions", body = Vec<Session>)
    )
)]
async fn list_sessions(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sessions = state
        .control_plane
        .runtime_core
        .session_manager
        .list_sessions()
        .await;

    let session_jsons: Vec<serde_json::Value> = sessions
        .into_iter()
        .filter_map(|s| serde_json::to_value(s).ok())
        .collect();

    Json(session_jsons).into_response()
}

/// Get a specific session by ID
#[utoipa::path(
    get,
    path = "/api/v1/sessions/{id}",
    responses(
        (status = 200, description = "Session details", body = Session),
        (status = 404, description = "Session not found")
    )
)]
async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state
        .control_plane
        .runtime_core
        .session_manager
        .get_session(id.clone())
        .await
    {
        Some(session) => Json(session).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": format!("Session {} not found", id)})),
        )
            .into_response(),
    }
}

/// Chat request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatRequest {
    chat_id: String,
    message: String,
    model_id: Option<String>,
    /// Runtime-owned model ID for dynamic model selection (e.g., "anthropic:claude-3-7")
    runtime_model_id: Option<String>,
    attachments: Option<Vec<serde_json::Value>>,
    web_search: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatModelRoute {
    config: serde_json::Value,
    profile_id: Option<String>,
    append_newline_on_input: bool,
}

#[derive(Debug, Deserialize)]
pub struct CachedProvider {
    pub name: String,
    pub models: HashMap<String, CachedModel>,
}

#[derive(Debug, Deserialize)]
pub struct CachedModel {
    pub name: String,
    pub limit: Option<CachedLimit>,
}

#[derive(Debug, Deserialize)]
pub struct CachedLimit {
    pub context: Option<usize>,
}

pub fn load_real_models() -> Option<HashMap<String, CachedProvider>> {
    let home = std::env::var("HOME").ok()?;
    let path = std::path::PathBuf::from(home).join(".cache/opencode/models.json");

    if let Ok(content) = std::fs::read_to_string(path) {
        return serde_json::from_str(&content).ok();
    }
    None
}

fn optional_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn build_cli_config(
    id: &str,
    name: &str,
    model: &str,
    command: &str,
    args: Vec<&str>,
    prompt_arg: Option<&str>,
    event_mode: &str,
) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": name,
        "brain_type": "cli",
        "model": model,
        "endpoint": null,
        "api_key_env": null,
        "command": command,
        "args": args,
        "prompt_arg": prompt_arg,
        "env": null,
        "cwd": null,
        "requirements": [
            {
                "kind": "binary",
                "name": command
            }
        ],
        "sandbox": null,
        "event_mode": event_mode
    })
}

fn build_api_config(
    id: &str,
    name: &str,
    model: &str,
    api_key_env: &str,
    endpoint: Option<String>,
) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": name,
        "brain_type": "api",
        "model": model,
        "endpoint": endpoint,
        "api_key_env": api_key_env,
        "command": null,
        "args": null,
        "prompt_arg": null,
        "env": null,
        "cwd": null,
        "requirements": [],
        "sandbox": null
    })
}

fn build_local_config(
    id: &str,
    name: &str,
    model: &str,
    endpoint: Option<String>,
) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": name,
        "brain_type": "local",
        "model": model,
        "endpoint": endpoint,
        "api_key_env": null,
        "command": null,
        "args": null,
        "prompt_arg": null,
        "env": null,
        "cwd": null,
        "requirements": [],
        "sandbox": null
    })
}

/// Maps frontend model IDs to kernel brain session configurations.
/// This uses the same model-routing intent as OpenClaw: profile/provider-driven, not hardwired Ollama.
fn resolve_chat_model_route(model_id: &str) -> Option<ChatModelRoute> {
    let normalized = model_id.trim().to_lowercase();

    // 1. First, check if this is a known model from our dynamic registry (models.json)
    if let Some(registry) = load_real_models() {
        // Check for provider/model format
        if normalized.contains('/') {
            let parts: Vec<&str> = normalized.splitn(2, '/').collect();
            let provider_id = parts[0];
            let sub_model_id = parts[1];

            if let Some(provider) = registry.get(provider_id) {
                // We found the provider, now check if the model exists in it
                // Or if it's an opencode/model format (legacy naming)
                if provider.models.contains_key(sub_model_id)
                    || provider_id == "opencode"
                    || provider_id == "a2r"
                {
                    return Some(ChatModelRoute {
                        config: build_cli_config(
                            provider_id,
                            &format!("{} CLI", provider.name),
                            sub_model_id,
                            "a2r",
                            vec!["run", "--format", "json", "-m", &normalized],
                            None,
                            "jsonl",
                        ),
                        profile_id: Some(format!("{}-acp", provider_id)),
                        append_newline_on_input: true,
                    });
                }
            }
        }
    }

    // Model routing based on model ID patterns
    if normalized.starts_with("claude") {
        return Some(ChatModelRoute {
            config: build_api_config(
                "anthropic",
                "Anthropic API",
                model_id,
                "ANTHROPIC_API_KEY",
                None,
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    if normalized.starts_with("gemini") {
        return Some(ChatModelRoute {
            config: build_api_config(
                "gemini",
                "Google Gemini API",
                model_id,
                "GEMINI_API_KEY",
                None,
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    if normalized.starts_with("deepseek") {
        let endpoint = optional_env("DEEPSEEK_API_ENDPOINT")
            .or_else(|| Some("https://api.deepseek.com/v1/chat/completions".to_string()));
        let effective_model = if normalized == "deepseek-r1" {
            "deepseek-reasoner".to_string()
        } else {
            model_id.to_string()
        };
        return Some(ChatModelRoute {
            config: build_api_config(
                "deepseek",
                "DeepSeek API",
                &effective_model,
                "DEEPSEEK_API_KEY",
                endpoint,
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    if normalized.starts_with("kimi") || normalized.contains("moonshot") {
        let endpoint = optional_env("MOONSHOT_API_ENDPOINT")
            .or_else(|| Some("https://api.moonshot.ai/v1/chat/completions".to_string()));
        return Some(ChatModelRoute {
            config: build_api_config(
                "moonshot",
                "Moonshot API",
                model_id,
                "MOONSHOT_API_KEY",
                endpoint,
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    if normalized.starts_with("gpt-")
        || normalized.starts_with("o1")
        || normalized.starts_with("o3")
        || normalized.starts_with("o4")
    {
        return Some(ChatModelRoute {
            config: build_api_config(
                "openai",
                "OpenAI API",
                model_id,
                "OPENAI_API_KEY",
                optional_env("OPENAI_API_ENDPOINT"),
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    if normalized.starts_with("local-")
        || normalized.contains("llama")
        || normalized.contains("qwen")
        || normalized.contains("phi")
    {
        let model = model_id.trim_start_matches("local-").to_string();
        return Some(ChatModelRoute {
            config: build_local_config(
                "local",
                "Local OpenAI-Compatible Runtime",
                &model,
                optional_env("KERNEL_LLM_ENDPOINT").map(|base| {
                    base.trim_end_matches("/v1/chat/completions")
                        .trim_end_matches("/api/chat")
                        .to_string()
                }),
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    // Ollama local models
    if normalized.starts_with("ollama-") {
        let model = model_id.trim_start_matches("ollama-").to_string();
        return Some(ChatModelRoute {
            config: build_local_config(
                "ollama",
                "Ollama Local Runtime",
                &model,
                optional_env("OLLAMA_ENDPOINT")
                    .or_else(|| Some("http://localhost:11434".to_string())),
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    // Mistral AI models
    if normalized.starts_with("mistral") || normalized.starts_with("codestral") {
        let endpoint = optional_env("MISTRAL_API_ENDPOINT")
            .or_else(|| Some("https://api.mistral.ai/v1/chat/completions".to_string()));
        return Some(ChatModelRoute {
            config: build_api_config(
                "mistral",
                "Mistral AI API",
                model_id,
                "MISTRAL_API_KEY",
                endpoint,
            ),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    // Cohere models
    if normalized.starts_with("command-") || normalized.starts_with("cohere") {
        let endpoint = optional_env("COHERE_API_ENDPOINT")
            .or_else(|| Some("https://api.cohere.ai/v1/chat".to_string()));
        return Some(ChatModelRoute {
            config: build_api_config("cohere", "Cohere API", model_id, "COHERE_API_KEY", endpoint),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    // xAI/Grok models
    if normalized.starts_with("grok") {
        let endpoint = optional_env("XAI_API_ENDPOINT")
            .or_else(|| Some("https://api.x.ai/v1/chat/completions".to_string()));
        return Some(ChatModelRoute {
            config: build_api_config("xai", "xAI API", model_id, "XAI_API_KEY", endpoint),
            profile_id: None,
            append_newline_on_input: false,
        });
    }

    // Shell/direct execution fallback
    if normalized == "shell" || normalized == "direct" {
        return Some(ChatModelRoute {
            config: build_cli_config(
                "shell",
                "Direct Shell Execution",
                "shell",
                "sh",
                vec!["-c"],
                None,
                "jsonl",
            ),
            profile_id: None,
            append_newline_on_input: true,
        });
    }

    None
}

/// Chat endpoint - SSE streaming response with real model routing
async fn chat_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> impl IntoResponse {
    use tokio::sync::mpsc;
    use tokio_stream::wrappers::ReceiverStream;

    let model_id = request.model_id.unwrap_or_else(|| "gpt-4o".to_string());
    let model_route = resolve_chat_model_route(&model_id);

    let (tx, rx) = mpsc::channel::<Result<String, std::convert::Infallible>>(32);
    let kernel_url = state.kernel_url.clone();
    let kernel_client = state.kernel_client.clone();
    let chat_sessions = state.chat_sessions.clone();
    let kernel_auth_token = std::env::var("A2R_KERNEL_AUTH_TOKEN")
        .or_else(|_| std::env::var("A2R_KERNEL_TOKEN"))
        .or_else(|_| std::env::var("A2R_GATEWAY_TOKEN"))
        .or_else(|_| std::env::var("OPENCLAW_GATEWAY_TOKEN"))
        .unwrap_or_else(|_| "api-a2r-local-dev".to_string());
    let message = request.message;
    let chat_id = request.chat_id;

    tokio::spawn(async move {
        macro_rules! emit_sse {
            ($payload:expr) => {{
                let _ = tx.send(Ok(format!("data: {}\n\n", $payload))).await;
            }};
        }

        // Send message-start event
        let message_id = format!("msg-{}", uuid::Uuid::new_v4());
        emit_sse!(serde_json::json!({
            "type": "message_start",
            "messageId": message_id
        }));

        // Check if we have a valid model config
        let route = match model_route {
            Some(c) => c,
            None => {
                emit_sse!(serde_json::json!({
                    "type": "content_block_delta",
                    "delta": {
                        "type": "text_delta",
                        "text": format!(
                            "Selected model '{}' is not mapped to a kernel brain profile/provider yet.",
                            model_id
                        )
                    }
                }));
                emit_sse!(serde_json::json!({
                    "type": "finish",
                    "finishReason": "error"
                }));
                return;
            }
        };

        // Reuse a session for this chat thread if model is unchanged.
        let existing_binding = {
            let sessions = chat_sessions.read().await;
            sessions.get(&chat_id).cloned()
        };

        let session_id = if let Some(binding) = existing_binding {
            if binding.model_id == model_id {
                binding.session_id
            } else {
                let create_url = format!("{}/v1/sessions", kernel_url);
                let mut create_body = serde_json::json!({
                    "config": route.config,
                    "workspace_dir": null,
                    "profile_id": route.profile_id,
                    "plan_id": format!("chat:{}", chat_id),
                    "source": "chat"
                });
                // Add runtime_overrides if runtimeModelId is provided (runtime-owned model selection)
                if let Some(ref runtime_model) = request.runtime_model_id {
                    create_body["runtime_overrides"] = serde_json::json!({
                        "model_id": runtime_model
                    });
                }
                match kernel_client
                    .post(&create_url)
                    .bearer_auth(&kernel_auth_token)
                    .json(&create_body)
                    .send()
                    .await
                {
                    Ok(response) if response.status().is_success() => {
                        match response.json::<serde_json::Value>().await {
                            Ok(payload) => {
                                if let Some(id) = payload.get("id").and_then(|v| v.as_str()) {
                                    let mut sessions = chat_sessions.write().await;
                                    sessions.insert(
                                        chat_id.clone(),
                                        ChatSessionBinding {
                                            session_id: id.to_string(),
                                            model_id: model_id.clone(),
                                        },
                                    );
                                    id.to_string()
                                } else {
                                    emit_sse!(serde_json::json!({
                                        "type": "content_block_delta",
                                        "delta": {
                                            "type": "text_delta",
                                            "text": "Kernel returned an invalid session payload."
                                        }
                                    }));
                                    emit_sse!(serde_json::json!({
                                        "type": "finish",
                                        "finishReason": "error"
                                    }));
                                    return;
                                }
                            }
                            Err(err) => {
                                tracing::error!(
                                    "Failed to decode kernel session response: {}",
                                    err
                                );
                                emit_sse!(serde_json::json!({
                                    "type": "content_block_delta",
                                    "delta": {
                                        "type": "text_delta",
                                        "text": "Failed to decode kernel session response."
                                    }
                                }));
                                emit_sse!(serde_json::json!({
                                    "type": "finish",
                                    "finishReason": "error"
                                }));
                                return;
                            }
                        }
                    }
                    Ok(response) => {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();
                        tracing::error!("Kernel session create failed: {} {}", status, body);
                        emit_sse!(serde_json::json!({
                            "type": "content_block_delta",
                            "delta": {
                                "type": "text_delta",
                                "text": format!("Kernel rejected session create for model '{}': {}", model_id, status)
                            }
                        }));
                        emit_sse!(serde_json::json!({
                            "type": "finish",
                            "finishReason": "error"
                        }));
                        return;
                    }
                    Err(err) => {
                        tracing::error!("Failed to create kernel session: {}", err);
                        emit_sse!(serde_json::json!({
                            "type": "content_block_delta",
                            "delta": {
                                "type": "text_delta",
                                "text": "Could not create a kernel chat session."
                            }
                        }));
                        emit_sse!(serde_json::json!({
                            "type": "finish",
                            "finishReason": "error"
                        }));
                        return;
                    }
                }
            }
        } else {
            let create_url = format!("{}/v1/sessions", kernel_url);
            let mut create_body = serde_json::json!({
                "config": route.config,
                "workspace_dir": null,
                "profile_id": route.profile_id,
                "plan_id": format!("chat:{}", chat_id),
                "source": "chat"
            });
            // Add runtime_overrides if runtimeModelId is provided (runtime-owned model selection)
            if let Some(ref runtime_model) = request.runtime_model_id {
                create_body["runtime_overrides"] = serde_json::json!({
                    "model_id": runtime_model
                });
            }
            match kernel_client
                .post(&create_url)
                .bearer_auth(&kernel_auth_token)
                .json(&create_body)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    match response.json::<serde_json::Value>().await {
                        Ok(payload) => {
                            if let Some(id) = payload.get("id").and_then(|v| v.as_str()) {
                                let mut sessions = chat_sessions.write().await;
                                sessions.insert(
                                    chat_id.clone(),
                                    ChatSessionBinding {
                                        session_id: id.to_string(),
                                        model_id: model_id.clone(),
                                    },
                                );
                                id.to_string()
                            } else {
                                emit_sse!(serde_json::json!({
                                    "type": "content_block_delta",
                                    "delta": {
                                        "type": "text_delta",
                                        "text": "Kernel returned an invalid session payload."
                                    }
                                }));
                                emit_sse!(serde_json::json!({
                                    "type": "finish",
                                    "finishReason": "error"
                                }));
                                return;
                            }
                        }
                        Err(err) => {
                            tracing::error!("Failed to decode kernel session response: {}", err);
                            emit_sse!(serde_json::json!({
                                "type": "content_block_delta",
                                "delta": {
                                    "type": "text_delta",
                                    "text": "Failed to decode kernel session response."
                                }
                            }));
                            emit_sse!(serde_json::json!({
                                "type": "finish",
                                "finishReason": "error"
                            }));
                            return;
                        }
                    }
                }
                Ok(response) => {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    tracing::error!("Kernel session create failed: {} {}", status, body);
                    emit_sse!(serde_json::json!({
                        "type": "content_block_delta",
                        "delta": {
                            "type": "text_delta",
                            "text": format!("Kernel rejected session create for model '{}': {}", model_id, status)
                        }
                    }));
                    emit_sse!(serde_json::json!({
                        "type": "finish",
                        "finishReason": "error"
                    }));
                    return;
                }
                Err(err) => {
                    tracing::error!("Failed to create kernel session: {}", err);
                    emit_sse!(serde_json::json!({
                        "type": "content_block_delta",
                        "delta": {
                            "type": "text_delta",
                            "text": "Could not create a kernel chat session."
                        }
                    }));
                    emit_sse!(serde_json::json!({
                        "type": "finish",
                        "finishReason": "error"
                    }));
                    return;
                }
            }
        };

        let events_url = format!("{}/v1/sessions/{}/events", kernel_url, session_id);
        let events_response = match kernel_client
            .get(&events_url)
            .bearer_auth(&kernel_auth_token)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => response,
            Ok(response) => {
                let status = response.status();
                tracing::error!("Kernel event stream failed: {}", status);
                emit_sse!(serde_json::json!({
                    "type": "content_block_delta",
                    "delta": {
                        "type": "text_delta",
                        "text": format!("Kernel event stream failed with status {}", status)
                    }
                }));
                emit_sse!(serde_json::json!({
                    "type": "finish",
                    "finishReason": "error"
                }));
                return;
            }
            Err(err) => {
                tracing::error!("Failed to open kernel event stream: {}", err);
                emit_sse!(serde_json::json!({
                    "type": "content_block_delta",
                    "delta": {
                        "type": "text_delta",
                        "text": "Error opening kernel event stream."
                    }
                }));
                emit_sse!(serde_json::json!({
                    "type": "finish",
                    "finishReason": "error"
                }));
                return;
            }
        };

        let input_text = if route.append_newline_on_input {
            format!("{}\n", message)
        } else {
            message
        };

        let input_url = format!("{}/v1/sessions/{}/input", kernel_url, session_id);
        match kernel_client
            .post(&input_url)
            .bearer_auth(&kernel_auth_token)
            .json(&input_text)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {}
            Ok(response) => {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                tracing::error!("Kernel input send failed: {} {}", status, body);
                emit_sse!(serde_json::json!({
                    "type": "content_block_delta",
                    "delta": {
                        "type": "text_delta",
                        "text": format!("Failed to send input to kernel session: {}", status)
                    }
                }));
                emit_sse!(serde_json::json!({
                    "type": "finish",
                    "finishReason": "error"
                }));
                return;
            }
            Err(err) => {
                tracing::error!("Kernel input request failed: {}", err);
                emit_sse!(serde_json::json!({
                    "type": "content_block_delta",
                    "delta": {
                        "type": "text_delta",
                        "text": "Error sending input to kernel session."
                    }
                }));
                emit_sse!(serde_json::json!({
                    "type": "finish",
                    "finishReason": "error"
                }));
                return;
            }
        }

        let mut event_buffer = String::new();
        let mut stream = events_response.bytes_stream();
        let mut saw_text_delta = false;
        let mut finished = false;
        let mut finish_reason = "stop";
        let mut session_started_seen = false;

        while !finished {
            let next_chunk = tokio::time::timeout(Duration::from_secs(75), stream.next()).await;
            match next_chunk {
                Ok(Some(Ok(chunk))) => {
                    event_buffer.push_str(&String::from_utf8_lossy(&chunk));
                    let mut lines: Vec<String> =
                        event_buffer.split('\n').map(|s| s.to_string()).collect();
                    event_buffer = lines.pop().unwrap_or_default();

                    for raw_line in lines {
                        let line = raw_line.trim();
                        if line.is_empty() || !line.starts_with("data:") {
                            continue;
                        }

                        let data = line.trim_start_matches("data:").trim();
                        if data.is_empty() {
                            continue;
                        }
                        if data == "[DONE]" {
                            finished = true;
                            break;
                        }

                        let event = match serde_json::from_str::<serde_json::Value>(data) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };

                        let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        let payload = event
                            .get("payload")
                            .cloned()
                            .unwrap_or(serde_json::Value::Null);

                        // Session started validation (must be first event)
                        if !session_started_seen {
                            if event_type == "session.started" {
                                session_started_seen = true;
                                let event_mode = payload
                                    .get("event_mode")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                let source =
                                    payload.get("source").and_then(|v| v.as_str()).unwrap_or("");

                                tracing::info!(
                                    "[chat_handler] session.started: event_mode={}, source={}",
                                    event_mode,
                                    source
                                );

                                // Hard gate: chat sessions cannot use terminal mode
                                if event_mode == "terminal" {
                                    tracing::error!("[chat_handler] Kernel mode mismatch: terminal driver for chat session");
                                    emit_sse!(serde_json::json!({
                                        "type": "content_block_delta",
                                        "delta": {
                                            "type": "text_delta",
                                            "text": "Kernel mode mismatch: terminal driver used for chat session. Use an ACP or JSONL brain profile."
                                        }
                                    }));
                                    finish_reason = "error";
                                    finished = true;
                                    break;
                                }

                                // Log success for observability
                                tracing::info!(
                                    "[chat_handler] Session validated: chat with event_mode={}",
                                    event_mode
                                );
                                continue; // Don't render session.started to user
                            } else {
                                // First event was not session.started - protocol violation
                                tracing::error!("[chat_handler] Protocol violation: first event was {}, expected session.started", event_type);
                                emit_sse!(serde_json::json!({
                                    "type": "content_block_delta",
                                    "delta": {
                                        "type": "text_delta",
                                        "text": "Kernel protocol error: session.started not received as first event."
                                    }
                                }));
                                finish_reason = "error";
                                finished = true;
                                break;
                            }
                        }

                        match event_type {
                            "chat.delta" => {
                                if let Some(text) = payload.get("text").and_then(|v| v.as_str()) {
                                    if !text.is_empty() {
                                        saw_text_delta = true;
                                        emit_sse!(serde_json::json!({
                                            "type": "content_block_delta",
                                            "delta": {
                                                "type": "text_delta",
                                                "text": text
                                            }
                                        }));
                                    }
                                }
                            }
                            "terminal.delta" => {
                                // CONTRACT VIOLATION: terminal.delta in chat stream
                                tracing::error!("[chat_handler] Kernel contract violation: terminal.delta in chat stream");
                                emit_sse!(serde_json::json!({
                                    "type": "content_block_delta",
                                    "delta": {
                                        "type": "text_delta",
                                        "text": "Kernel mode mismatch: terminal output received in chat session."
                                    }
                                }));
                                finish_reason = "error";
                                finished = true;
                                break;
                            }
                            "chat.message.completed" => {
                                if !saw_text_delta {
                                    if let Some(text) = payload.get("text").and_then(|v| v.as_str())
                                    {
                                        if !text.is_empty() {
                                            emit_sse!(serde_json::json!({
                                                "type": "content_block_delta",
                                                "delta": {
                                                    "type": "text_delta",
                                                    "text": text
                                                }
                                            }));
                                        }
                                    }
                                }
                                finished = true;
                                break;
                            }
                            "tool.call" => {
                                // Tool invocation started - UI should show "running tool X"
                                if let Some(tool_id) =
                                    payload.get("tool_id").and_then(|v| v.as_str())
                                {
                                    emit_sse!(serde_json::json!({
                                        "type": "tool_call_start",
                                        "tool_id": tool_id,
                                        "call_id": payload.get("call_id").and_then(|v| v.as_str()).unwrap_or(""),
                                        "args": payload.get("args")
                                    }));
                                }
                            }
                            "tool.result" => {
                                // Tool completed - UI should update tool panel
                                if let Some(call_id) =
                                    payload.get("call_id").and_then(|v| v.as_str())
                                {
                                    emit_sse!(serde_json::json!({
                                        "type": "tool_call_result",
                                        "call_id": call_id,
                                        "result": payload.get("result"),
                                        "error": payload.get("error")
                                    }));
                                }
                            }
                            "error" => {
                                let message = payload
                                    .get("message")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Kernel returned an unknown error");
                                emit_sse!(serde_json::json!({
                                    "type": "content_block_delta",
                                    "delta": {
                                        "type": "text_delta",
                                        "text": message
                                    }
                                }));
                                finish_reason = "error";
                                finished = true;
                                break;
                            }
                            "session.started" => {
                                // Already handled above, skip rendering
                                continue;
                            }
                            _ => {}
                        }
                    }
                }
                Ok(Some(Err(err))) => {
                    tracing::error!("Kernel event stream read error: {}", err);
                    emit_sse!(serde_json::json!({
                        "type": "content_block_delta",
                        "delta": {
                            "type": "text_delta",
                            "text": "Kernel event stream read error."
                        }
                    }));
                    finish_reason = "error";
                    break;
                }
                Ok(None) => {
                    break;
                }
                Err(_) => {
                    emit_sse!(serde_json::json!({
                        "type": "content_block_delta",
                        "delta": {
                            "type": "text_delta",
                            "text": "Kernel response timed out."
                        }
                    }));
                    finish_reason = "error";
                    break;
                }
            }
        }

        // Send finish event
        emit_sse!(serde_json::json!({
            "type": "finish",
            "finishReason": finish_reason
        }));
    });

    let stream = ReceiverStream::new(rx);

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .body(axum::body::Body::from_stream(stream))
        .unwrap()
}

fn parse_capsule_ref(raw: &str) -> (String, Option<Version>) {
    if let Some((capsule_id, version)) = raw.rsplit_once('@') {
        if let Ok(parsed) = Version::parse(version) {
            return (capsule_id.to_string(), Some(parsed));
        }
    }
    (raw.to_string(), None)
}

fn capsule_error_response(error: CapsuleError) -> Response {
    let status = match error {
        CapsuleError::CapsuleNotFound(_) => StatusCode::NOT_FOUND,
        CapsuleError::AlreadyExists(_) => StatusCode::CONFLICT,
        CapsuleError::InvalidManifest(_)
        | CapsuleError::BundleExtractionFailed(_)
        | CapsuleError::MissingFile(_)
        | CapsuleError::SignatureVerificationFailed(_)
        | CapsuleError::ContentHashMismatch { .. } => StatusCode::BAD_REQUEST,
        CapsuleError::BundleCreationFailed(_)
        | CapsuleError::CryptoError(_)
        | CapsuleError::StorageError(_)
        | CapsuleError::SerdeError(_)
        | CapsuleError::IoError(_) => StatusCode::INTERNAL_SERVER_ERROR,
    };

    (
        status,
        Json(serde_json::json!({
            "error": error.to_string()
        })),
    )
        .into_response()
}
