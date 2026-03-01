#![allow(dead_code, unused_variables, unused_imports)]
//! TUI Compatibility Routes - OpenCode TUI SDK compatibility layer
//!
//! Provides REST API endpoints that match the OpenCode SDK interface,
//! allowing the OpenCode TUI to connect to A2R backend.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::AppState;

// ============================================================================
// Types matching OpenCode SDK
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub models: Vec<ModelInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_window: Option<usize>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CommandInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LspStatus {
    pub language: String,
    pub status: String,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct McpStatus {
    pub name: String,
    pub status: String,
    pub connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormatterStatus {
    pub language: String,
    pub formatter: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VcsInfo {
    pub branch: Option<String>,
    pub status: Option<String>,
    pub root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PathInfo {
    pub state: String,
    pub config: String,
    pub worktree: String,
    pub directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PermissionRequest {
    pub id: String,
    pub session_id: String,
    pub resource: String,
    pub action: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QuestionRequest {
    pub id: String,
    pub session_id: String,
    pub question: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TodoItem {
    pub id: String,
    pub content: String,
    pub status: String,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionStatus {
    pub session_id: String,
    pub status: String,
    pub message_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FileDiff {
    pub path: String,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProvidersResponse {
    pub providers: Vec<ProviderInfo>,
    pub default: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderListResponse {
    pub all: Vec<ProviderInfo>,
    pub default: HashMap<String, String>,
    pub connected: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderAuthMethod {
    pub provider_id: String,
    pub method: String,
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConfigResponse {
    pub model: Option<String>,
    pub agent: Option<String>,
    pub theme: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

// Internal Terminal Models Cache Structure
// Models and loader moved to main.rs for shared use with gateway routing
use crate::{load_real_models, CachedProvider};

// ============================================================================
// Route Registration
// ============================================================================

pub fn create_tui_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Provider endpoints (config moved to config_routes.rs)
        .route("/api/v1/providers", get(list_providers))
        .route("/api/v1/providers/auth", get(get_provider_auth))
        // App endpoints
        .route("/api/v1/app/agents", get(get_app_agents))
        .route("/api/v1/app/skills", get(get_app_skills))
        // Command endpoints
        .route("/api/v1/command/list", get(list_commands))
        // LSP endpoints
        .route("/api/v1/lsp/status", get(get_lsp_status))
        // MCP endpoints
        .route("/api/v1/mcp/status", get(get_mcp_status))
        .route("/api/v1/mcp/connect", post(connect_mcp))
        .route("/api/v1/mcp/disconnect", post(disconnect_mcp))
        // Formatter endpoints
        .route("/api/v1/formatter/status", get(get_formatter_status))
        // VCS endpoints
        .route("/api/v1/vcs/get", get(get_vcs_info))
        // Path endpoints
        .route("/api/v1/path/get", get(get_path_info))
        // Permission endpoints
        .route("/api/v1/permission", get(list_permissions))
        .route("/api/v1/permission/:id/reply", post(reply_permission))
        // Question endpoints
        .route("/api/v1/question", get(list_questions))
        .route("/api/v1/question/:id/reply", post(reply_question))
        .route("/api/v1/question/:id/reject", post(reject_question))
        // Instance endpoints
        .route("/api/v1/instance/dispose", post(dispose_instance))
        // Session extended endpoints
        .route("/api/v1/session/status", get(get_session_status))
        // Experimental endpoints
        .route(
            "/api/v1/experimental/resource",
            get(list_experimental_resources),
        )
        // Find endpoints
        .route("/api/v1/find/files", post(find_files))
        // File endpoints
        .route("/api/v1/file/list", get(list_files))
        .route("/api/v1/file/read", get(read_file))
        .route("/api/v1/file/status", get(get_file_status))
}

// ============================================================================
// Config Handlers
// ============================================================================

async fn get_config(State(_state): State<Arc<AppState>>) -> Json<ConfigResponse> {
    Json(ConfigResponse {
        model: Some("claude-3-5-sonnet".to_string()),
        agent: Some("build".to_string()),
        theme: Some("dark".to_string()),
        extra: HashMap::new(),
    })
}

// ============================================================================
// Provider Handlers
// ============================================================================

async fn list_providers(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<ProviderListResponse>, StatusCode> {
    let mut all_providers = Vec::new();
    let mut defaults = HashMap::new();
    let mut connected = Vec::new();

    if let Some(cached) = load_real_models() {
        for (provider_id, provider_data) in cached {
            let mut models = Vec::new();
            for (model_id, model_data) in provider_data.models {
                models.push(ModelInfo {
                    id: format!("{}/{}", provider_id, model_id),
                    name: model_data.name,
                    context_window: model_data.limit.and_then(|l| l.context),
                    description: None,
                });
            }

            // Sort models by name
            models.sort_by(|a, b| a.name.cmp(&b.name));

            if !models.is_empty() {
                defaults.insert(provider_id.clone(), models[0].id.clone());
            }

            all_providers.push(ProviderInfo {
                id: provider_id.clone(),
                name: provider_data.name,
                models,
            });
            connected.push(provider_id);
        }
    } else {
        // Fallback to minimal static list if cache is missing
        all_providers.push(ProviderInfo {
            id: "anthropic".to_string(),
            name: "Anthropic".to_string(),
            models: vec![ModelInfo {
                id: "anthropic/claude-3-5-sonnet".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                context_window: Some(200000),
                description: None,
            }],
        });
        defaults.insert(
            "anthropic".to_string(),
            "anthropic/claude-3-5-sonnet".to_string(),
        );
        connected.push("anthropic".to_string());
    }

    // Sort providers by name
    all_providers.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(Json(ProviderListResponse {
        all: all_providers,
        default: defaults,
        connected,
    }))
}

async fn get_provider_auth(
    State(_state): State<Arc<AppState>>,
) -> Json<HashMap<String, Vec<ProviderAuthMethod>>> {
    let mut result = HashMap::new();
    // In a real implementation, we'd check auth status for each provider
    result.insert(
        "anthropic".to_string(),
        vec![ProviderAuthMethod {
            provider_id: "anthropic".to_string(),
            method: "api_key".to_string(),
            configured: true,
        }],
    );
    Json(result)
}

// ============================================================================
// App Handlers
// ============================================================================

async fn get_app_agents(State(_state): State<Arc<AppState>>) -> Json<Vec<AgentInfo>> {
    Json(vec![
        AgentInfo {
            id: "build".to_string(),
            name: "Build".to_string(),
            description: Some("Full-access agent for development work".to_string()),
        },
        AgentInfo {
            id: "plan".to_string(),
            name: "Plan".to_string(),
            description: Some("Read-only agent for analysis and code exploration".to_string()),
        },
    ])
}

async fn get_app_skills(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let skills = state
        .control_plane
        .skill_registry
        .list_skills()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let values: Vec<serde_json::Value> = skills
        .into_iter()
        .filter_map(|s| serde_json::to_value(s).ok())
        .collect();
    Ok(Json(values))
}

// ============================================================================
// Command Handlers
// ============================================================================

async fn list_commands(State(_state): State<Arc<AppState>>) -> Json<Vec<CommandInfo>> {
    Json(vec![
        CommandInfo {
            id: "init".to_string(),
            name: "/init".to_string(),
            description: Some("Initialize project with AGENTS.md".to_string()),
        },
        CommandInfo {
            id: "commit".to_string(),
            name: "/commit".to_string(),
            description: Some("Create a git commit".to_string()),
        },
    ])
}

// ============================================================================
// LSP Handlers
// ============================================================================

async fn get_lsp_status(State(_state): State<Arc<AppState>>) -> Json<Vec<LspStatus>> {
    Json(vec![
        LspStatus {
            language: "rust".to_string(),
            status: "running".to_string(),
            version: Some("rust-analyzer 2024.1".to_string()),
        },
        LspStatus {
            language: "typescript".to_string(),
            status: "running".to_string(),
            version: Some("typescript 5.3".to_string()),
        },
    ])
}

// ============================================================================
// MCP Handlers
// ============================================================================

#[derive(Deserialize)]
struct McpConnectRequest {
    name: String,
}

async fn get_mcp_status(State(_state): State<Arc<AppState>>) -> Json<HashMap<String, McpStatus>> {
    let mut result = HashMap::new();
    result.insert(
        "filesystem".to_string(),
        McpStatus {
            name: "filesystem".to_string(),
            status: "connected".to_string(),
            connected: true,
        },
    );
    Json(result)
}

async fn connect_mcp(
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<McpConnectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({ "status": "connected" })))
}

async fn disconnect_mcp(
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<McpConnectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({ "status": "disconnected" })))
}

// ============================================================================
// Formatter Handlers
// ============================================================================

async fn get_formatter_status(State(_state): State<Arc<AppState>>) -> Json<Vec<FormatterStatus>> {
    Json(vec![
        FormatterStatus {
            language: "rust".to_string(),
            formatter: "rustfmt".to_string(),
            available: true,
        },
        FormatterStatus {
            language: "typescript".to_string(),
            formatter: "prettier".to_string(),
            available: true,
        },
    ])
}

// ============================================================================
// VCS Handlers
// ============================================================================

async fn get_vcs_info(State(_state): State<Arc<AppState>>) -> Json<VcsInfo> {
    Json(VcsInfo {
        branch: Some("main".to_string()),
        status: Some("clean".to_string()),
        root: Some("/workspace".to_string()),
    })
}

// ============================================================================
// Path Handlers
// ============================================================================

async fn get_path_info(State(_state): State<Arc<AppState>>) -> Json<PathInfo> {
    Json(PathInfo {
        state: "/workspace/.a2r/state".to_string(),
        config: "/workspace/.a2r/config.json".to_string(),
        worktree: "/workspace".to_string(),
        directory: "/workspace".to_string(),
    })
}

// ============================================================================
// Permission Handlers
// ============================================================================

async fn list_permissions(State(_state): State<Arc<AppState>>) -> Json<Vec<PermissionRequest>> {
    Json(vec![])
}

#[derive(Deserialize)]
struct PermissionReplyRequest {
    reply: String,
    message: Option<String>,
}

async fn reply_permission(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<String>,
    Json(_req): Json<PermissionReplyRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({ "status": "replied" })))
}

// ============================================================================
// Question Handlers
// ============================================================================

async fn list_questions(State(_state): State<Arc<AppState>>) -> Json<Vec<QuestionRequest>> {
    Json(vec![])
}

#[derive(Deserialize)]
struct QuestionReplyRequest {
    answer: String,
}

async fn reply_question(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<String>,
    Json(_req): Json<QuestionReplyRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({ "status": "replied" })))
}

async fn reject_question(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({ "status": "rejected" })))
}

// ============================================================================
// Instance Handlers
// ============================================================================

async fn dispose_instance(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({ "status": "disposed" })))
}

// ============================================================================
// Session Status Handler
// ============================================================================

async fn get_session_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HashMap<String, SessionStatus>>, StatusCode> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Ok(Json(HashMap::new())),
    };

    let manager = session_state.session_manager.read().await;
    let sessions = manager
        .list_sessions()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut result = HashMap::new();
    for session in sessions {
        result.insert(
            session.id.as_str().to_string(),
            SessionStatus {
                session_id: session.id.as_str().to_string(),
                status: if session.active { "active" } else { "idle" }.to_string(),
                message_count: session.message_count,
            },
        );
    }

    Ok(Json(result))
}

// ============================================================================
// Experimental Resource Handlers
// ============================================================================

async fn list_experimental_resources(
    State(_state): State<Arc<AppState>>,
) -> Json<HashMap<String, McpResource>> {
    Json(HashMap::new())
}

// ============================================================================
// Find Handlers
// ============================================================================

#[derive(Deserialize)]
struct FindFilesRequest {
    pattern: Option<String>,
    path: Option<String>,
}

async fn find_files(
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<FindFilesRequest>,
) -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

// ============================================================================
// File Handlers
// ============================================================================

#[derive(Deserialize)]
struct FileListQuery {
    path: Option<String>,
}

async fn list_files(
    State(_state): State<Arc<AppState>>,
    Query(_query): Query<FileListQuery>,
) -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

#[derive(Deserialize)]
struct FileReadQuery {
    path: String,
}

async fn read_file(
    State(_state): State<Arc<AppState>>,
    Query(_query): Query<FileReadQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

async fn get_file_status(State(_state): State<Arc<AppState>>) -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}
