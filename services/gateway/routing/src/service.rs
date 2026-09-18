//! Allternit IO Service - HTTP service layer
//!
//! Implements SYSTEM_LAW.md:
//! - LAW-ONT-002: Only IO can execute side effects
//! - LAW-ONT-003: Deterministic execution with policy enforcement
//! - LAW-ONT-008: IO Idempotency & Replay
//!
//! Port: 3510
//! Bind: 127.0.0.1 (internal only)

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;

use crate::{ToolDefinition, ToolExecutionRequest, ToolGateway, WriteScope};

/// IO Service state shared across handlers
#[derive(Clone)]
pub struct IoServiceState {
    pub gateway: Arc<RwLock<ToolGateway>>,
}

impl IoServiceState {
    /// Create a new service state using the default data directory
    /// (`./.allternit/io-service`).
    pub async fn new() -> anyhow::Result<Self> {
        Self::new_with_data_dir(Path::new("./.allternit/io-service")).await
    }

    /// Create a new service state with a configurable data directory.
    ///
    /// This is useful for integration tests that need an isolated filesystem
    /// location so that parallel test runs do not contend on the same history
    /// journal.
    pub async fn new_with_data_dir(data_dir: &Path) -> anyhow::Result<Self> {
        use allternit_history::HistoryLedger;
        use allternit_messaging::MessagingSystem;
        use allternit_policy::{Identity, IdentityType, PolicyEngine};
        use sqlx::SqlitePool;
        use std::sync::Mutex;

        std::fs::create_dir_all(data_dir)?;

        let history_path = data_dir.join("history.jsonl");
        let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&history_path)?));

        // Create in-memory SQLite pool for messaging system
        let sqlite_pool = SqlitePool::connect("sqlite::memory:").await?;

        let messaging_system =
            Arc::new(MessagingSystem::new_with_storage(history_ledger.clone(), sqlite_pool).await?);

        let policy_engine = Arc::new(PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Register IO Service identity
        let io_identity = Identity {
            id: "io-service".to_string(),
            identity_type: IdentityType::ServiceAccount,
            name: "IO Service".to_string(),
            tenant_id: "system".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["io-executor".to_string()],
            permissions: vec!["tool:execute".to_string()],
        };
        policy_engine.register_identity(io_identity).await?;

        let gateway = ToolGateway::new(policy_engine, history_ledger, messaging_system);

        Ok(Self {
            gateway: Arc::new(RwLock::new(gateway)),
        })
    }
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub ontology_compliance: bool, // LAW-ONT-002: Only IO executes side effects
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteToolRequest {
    pub tool_id: String,
    pub input: serde_json::Value,
    pub correlation_id: String,
    pub run_id: String,
    pub wih_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteToolResponse {
    pub success: bool,
    pub output: Option<serde_json::Value>,
    pub error: Option<ToolError>,
    pub io_captured: bool,
    pub policy_enforced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

// ============================================================================
// Health endpoint
// ============================================================================

async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "allternit-io-service".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        ontology_compliance: true, // LAW-ONT-002 compliance
    })
}

// ============================================================================
// Tool Execution endpoints (LAW-ONT-002: Only IO executes side effects)
// ============================================================================

/// Execute a tool through the IO Service
///
/// This is the ONLY permitted path for side-effect execution in Allternit.
/// All tool calls MUST go through this endpoint.
///
/// LAW-ONT-002: "Only IO can execute side effects"
async fn execute_tool(
    State(state): State<Arc<IoServiceState>>,
    Json(req): Json<ExecuteToolRequest>,
) -> impl IntoResponse {
    tracing::info!(
        "Executing tool: {} (run: {}, wih: {}, correlation: {})",
        req.tool_id,
        req.run_id,
        req.wih_id,
        req.correlation_id
    );

    // Get gateway lock
    let gateway = state.gateway.read().await;

    // Create ToolExecutionRequest with all required fields per LAW-ONT-002
    let write_scope = WriteScope {
        root: "/.allternit/".to_string(),
        allowed_globs: vec![
            format!("/.allternit/artifacts/{}/**", req.run_id),
            format!("/.allternit/receipts/{}/**", req.run_id),
        ],
    };

    let tool_request = ToolExecutionRequest {
        tool_id: req.tool_id,
        input: req.input,
        identity_id: "io-service".to_string(),
        session_id: req.run_id.clone(),
        tenant_id: "default".to_string(),
        run_id: Some(req.run_id),
        workflow_id: Some("io-execution".to_string()),
        node_id: Some("io-node".to_string()),
        wih_id: Some(req.wih_id),
        write_scope: Some(write_scope),
        capsule_run: Some(false),
        trace_id: Some(req.correlation_id.clone()),
        retry_count: 0,
        idempotency_key: Some(req.correlation_id),
    };

    // Execute tool (policy enforcement happens inside gateway per LAW-ONT-002)
    match gateway.execute_tool(tool_request).await {
        Ok(result) => Json(ExecuteToolResponse {
            success: result.error.is_none(),
            output: result.output,
            error: result.error.map(|msg| ToolError {
                code: "TOOL_EXECUTION_FAILED".to_string(),
                message: msg,
                details: None,
            }),
            io_captured: true,
            policy_enforced: true,
        })
        .into_response(),

        Err(e) => Json(ExecuteToolResponse {
            success: false,
            output: None,
            error: Some(ToolError {
                code: "TOOL_EXECUTION_FAILED".to_string(),
                message: e.to_string(),
                details: None,
            }),
            io_captured: false,
            policy_enforced: false,
        })
        .into_response(),
    }
}

// ============================================================================
// Tool Management endpoints
// ============================================================================

/// List all registered tools
async fn list_tools(State(_state): State<Arc<IoServiceState>>) -> impl IntoResponse {
    // ToolGateway stores tools internally - would need to add a list_tools method
    // For now, return empty list
    Json::<Vec<ToolDefinition>>(vec![]).into_response()
}

/// Register a new tool via ToolGateway
async fn register_tool(
    State(state): State<Arc<IoServiceState>>,
    Json(tool): Json<ToolDefinition>,
) -> impl IntoResponse {
    let gateway = state.gateway.read().await;
    match gateway.register_tool(tool).await {
        Ok(tool_id) => {
            (StatusCode::CREATED, format!("Tool registered: {}", tool_id)).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to register tool: {}", e),
        )
            .into_response(),
    }
}

// ============================================================================
// Router
// ============================================================================

/// Build the Axum application router.
pub fn create_router(state: Arc<IoServiceState>) -> Router {
    Router::new()
        // Health
        .route("/health", get(health_check))
        // Tool Execution (LAW-ONT-002: Only IO executes side effects)
        .route("/v1/tools/execute", post(execute_tool))
        // Tool Management
        .route("/v1/tools", get(list_tools))
        .route("/v1/tools", post(register_tool))
        // State
        .with_state(state)
        // Add tracing layer
        .layer(TraceLayer::new_for_http())
}

