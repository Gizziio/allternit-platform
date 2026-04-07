#![allow(dead_code, unused_variables, unused_imports)]
//! TUI Compatibility Routes - OpenCode TUI SDK compatibility layer
//!
//! Provides REST API endpoints that match the OpenCode SDK interface,
//! allowing the OpenCode TUI to connect to A2R backend.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, head, post},
    Json, Router,
};
use mcp_client::{McpClient, SseConfig, SseTransport, StdioConfig, StdioTransport};
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
    pub request_id: String,
    pub session_id: String,
    pub permission: String,
    pub patterns: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub always: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QuestionOptionSchema {
    pub label: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QuestionItemSchema {
    pub header: String,
    pub question: String,
    pub options: Vec<QuestionOptionSchema>,
    #[serde(default)]
    pub custom: bool,
    #[serde(default)]
    pub multiple: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QuestionRequest {
    pub request_id: String,
    pub session_id: String,
    pub questions: Vec<QuestionItemSchema>,
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
        // Extended filesystem endpoints (Plugin Manager)
        .route("/api/v1/files/list", get(list_files_v2))
        .route("/api/v1/files/read", get(read_file_v2))
        .route("/api/v1/files/write", post(write_file_v2))
        .route("/api/v1/files/delete", delete(delete_file_v2))
        .route("/api/v1/files/exists", head(exists_file_v2).get(exists_file_v2))
        .route("/api/v1/files/mkdir", post(mkdir_v2))
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
    // Each entry: (language, process_name, version_flag)
    let checks: &[(&str, &str, &[&str])] = &[
        ("rust", "rust-analyzer", &["--version"]),
        ("typescript", "typescript-language-server", &["--version"]),
        ("python", "pylsp", &["--version"]),
        ("go", "gopls", &["version"]),
        ("lua", "lua-language-server", &["--version"]),
    ];

    let mut result = Vec::new();

    for (language, binary, version_args) in checks {
        // Check if process is currently running via pgrep
        let running = tokio::process::Command::new("pgrep")
            .arg("-x")
            .arg(binary)
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);

        // Get version by invoking the binary if it's on PATH
        let version = if running || {
            tokio::process::Command::new("which")
                .arg(binary)
                .output()
                .await
                .map(|o| o.status.success())
                .unwrap_or(false)
        } {
            tokio::process::Command::new(binary)
                .args(*version_args)
                .output()
                .await
                .ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .filter(|s| !s.is_empty())
        } else {
            None
        };

        let status = if running {
            "running"
        } else if version.is_some() {
            "installed"
        } else {
            "unavailable"
        };

        result.push(LspStatus {
            language: language.to_string(),
            status: status.to_string(),
            version,
        });
    }

    Json(result)
}

// ============================================================================
// MCP Handlers
// ============================================================================

#[derive(Deserialize)]
struct McpConnectRequest {
    /// Human-readable name for the server (also used as the registry key)
    name: String,
    /// Transport type: "stdio" or "sse"
    #[serde(default)]
    transport: Option<String>,
    /// Command to spawn (stdio transport)
    #[serde(default)]
    command: Option<String>,
    /// Args for the command (stdio transport)
    #[serde(default)]
    args: Option<Vec<String>>,
    /// SSE URL (sse transport)
    #[serde(default)]
    url: Option<String>,
}

#[derive(Deserialize)]
struct McpDisconnectRequest {
    name: String,
}

async fn get_mcp_status(State(state): State<Arc<AppState>>) -> Json<HashMap<String, McpStatus>> {
    let connected_names = state.mcp_client_manager.list_clients().await;
    let servers = state.mcp_servers.read().await;

    let mut result: HashMap<String, McpStatus> = HashMap::new();

    // Emit status for everything in the servers registry
    for (id, entry) in servers.iter() {
        let is_connected = connected_names.contains(&entry.name);
        result.insert(
            id.clone(),
            McpStatus {
                name: entry.name.clone(),
                status: if is_connected {
                    "connected".to_string()
                } else {
                    "disconnected".to_string()
                },
                connected: is_connected,
            },
        );
    }

    // Also surface anything in the manager that doesn't have a server entry yet
    for name in &connected_names {
        if !result.values().any(|s| &s.name == name) {
            result.insert(
                name.clone(),
                McpStatus {
                    name: name.clone(),
                    status: "connected".to_string(),
                    connected: true,
                },
            );
        }
    }

    Json(result)
}

async fn connect_mcp(
    State(state): State<Arc<AppState>>,
    Json(req): Json<McpConnectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let transport_type = req.transport.as_deref().unwrap_or("stdio");

    let transport: Arc<dyn mcp_client::McpTransport> = match transport_type {
        "sse" => {
            let url = req.url.ok_or(StatusCode::BAD_REQUEST)?;
            let config = SseConfig {
                url,
                reconnect: Default::default(),
                timeout_secs: 30,
            };
            SseTransport::new(config).map_err(|_| StatusCode::BAD_GATEWAY)? as Arc<dyn mcp_client::McpTransport>
        }
        _ => {
            // stdio (default)
            let command = req.command.ok_or(StatusCode::BAD_REQUEST)?;
            let config = StdioConfig {
                command,
                args: req.args.unwrap_or_default(),
                env: std::collections::HashMap::new(),
                cwd: None,
                timeout_secs: 30,
            };
            StdioTransport::spawn(config)
                .await
                .map_err(|_| StatusCode::BAD_GATEWAY)? as Arc<dyn mcp_client::McpTransport>
        }
    };

    let mut client = McpClient::new(transport);
    let init_result = client.initialize().await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    let tool_count = client
        .list_tools()
        .await
        .map(|t| t.len())
        .unwrap_or(0);

    state
        .mcp_client_manager
        .add_client(req.name.clone(), client)
        .await;

    // Register in mcp_servers for status tracking
    {
        let server_id = uuid::Uuid::new_v4().to_string();
        let entry = crate::McpServerEntry {
            server_id: server_id.clone(),
            name: req.name.clone(),
            transport_type: transport_type.to_string(),
            connected_at: chrono::Utc::now(),
            tool_count,
            status: "connected".to_string(),
        };
        let mut servers = state.mcp_servers.write().await;
        servers.insert(server_id, entry);
    }

    Ok(Json(serde_json::json!({
        "status": "connected",
        "name": req.name,
        "tool_count": tool_count,
        "server_version": init_result.server_info.version,
    })))
}

async fn disconnect_mcp(
    State(state): State<Arc<AppState>>,
    Json(req): Json<McpDisconnectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let removed = state.mcp_client_manager.remove_client(&req.name).await;
    if removed.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Remove from mcp_servers registry
    {
        let mut servers = state.mcp_servers.write().await;
        servers.retain(|_, entry| entry.name != req.name);
    }

    Ok(Json(serde_json::json!({ "status": "disconnected", "name": req.name })))
}

// ============================================================================
// Formatter Handlers
// ============================================================================

async fn get_formatter_status(State(_state): State<Arc<AppState>>) -> Json<Vec<FormatterStatus>> {
    let checks: &[(&str, &str)] = &[
        ("rust", "rustfmt"),
        ("typescript", "prettier"),
        ("javascript", "prettier"),
        ("python", "black"),
        ("go", "gofmt"),
    ];

    let mut result = Vec::new();
    for (language, formatter) in checks {
        let available = tokio::process::Command::new("which")
            .arg(formatter)
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);

        result.push(FormatterStatus {
            language: language.to_string(),
            formatter: formatter.to_string(),
            available,
        });
    }
    Json(result)
}

// ============================================================================
// VCS Handlers
// ============================================================================

async fn get_vcs_info(State(_state): State<Arc<AppState>>) -> Json<VcsInfo> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    // git rev-parse --abbrev-ref HEAD → branch name
    let branch = tokio::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&cwd)
        .output()
        .await
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    // git status --porcelain → empty = clean
    let status = tokio::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&cwd)
        .output()
        .await
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            if o.stdout.is_empty() {
                "clean".to_string()
            } else {
                "dirty".to_string()
            }
        });

    // git rev-parse --show-toplevel → repo root
    let root = tokio::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(&cwd)
        .output()
        .await
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    Json(VcsInfo { branch, status, root })
}

// ============================================================================
// Path Handlers
// ============================================================================

async fn get_path_info(State(_state): State<Arc<AppState>>) -> Json<PathInfo> {
    let cwd = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .to_string_lossy()
        .to_string();

    let home = std::env::var("HOME").unwrap_or_else(|_| cwd.clone());
    let allternit_dir = format!("{}/.a2r", home);

    Json(PathInfo {
        state: format!("{}/state", allternit_dir),
        config: format!("{}/config.json", allternit_dir),
        worktree: cwd.clone(),
        directory: cwd,
    })
}

// ============================================================================
// Permission Handlers
// ============================================================================

async fn list_permissions(State(state): State<Arc<AppState>>) -> Json<Vec<PermissionRequest>> {
    let pending = state.permission_gate.list_permissions().await;
    let result = pending
        .into_iter()
        .map(|p| PermissionRequest {
            request_id: p.request_id,
            session_id: p.session_id,
            permission: p.permission,
            patterns: p.patterns,
            metadata: p.metadata,
            always: p.always,
        })
        .collect();
    Json(result)
}

#[derive(Deserialize)]
struct PermissionReplyRequest {
    reply: String,
    #[allow(dead_code)]
    message: Option<String>,
}

async fn reply_permission(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<PermissionReplyRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let reply: allternit_openclaw_host::PermissionReply = req
        .reply
        .parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if state.permission_gate.reply_permission(&id, reply).await {
        Ok(Json(serde_json::json!({ "status": "replied" })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// ============================================================================
// Question Handlers
// ============================================================================

async fn list_questions(State(state): State<Arc<AppState>>) -> Json<Vec<QuestionRequest>> {
    let pending = state.permission_gate.list_questions().await;
    let result = pending
        .into_iter()
        .map(|q| QuestionRequest {
            request_id: q.request_id,
            session_id: q.session_id,
            questions: q
                .questions
                .into_iter()
                .map(|qi| QuestionItemSchema {
                    header: qi.header,
                    question: qi.question,
                    options: qi
                        .options
                        .into_iter()
                        .map(|o| QuestionOptionSchema {
                            label: o.label,
                            description: o.description,
                        })
                        .collect(),
                    custom: qi.custom,
                    multiple: qi.multiple,
                })
                .collect(),
        })
        .collect();
    Json(result)
}

#[derive(Deserialize)]
struct QuestionAnswerItem {
    question_index: usize,
    answer: serde_json::Value,
}

#[derive(Deserialize)]
struct QuestionReplyRequest {
    answers: Vec<QuestionAnswerItem>,
}

async fn reply_question(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<QuestionReplyRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let answers = req
        .answers
        .into_iter()
        .map(|a| allternit_openclaw_host::QuestionAnswer {
            question_index: a.question_index,
            answer: a.answer,
        })
        .collect();

    if state.permission_gate.reply_question(&id, answers).await {
        Ok(Json(serde_json::json!({ "status": "replied" })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

async fn reject_question(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if state.permission_gate.reject_question(&id).await {
        Ok(Json(serde_json::json!({ "status": "rejected" })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// ============================================================================
// Instance Handlers
// ============================================================================

async fn dispose_instance(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Drain all pending permissions and questions (reject them all)
    let permission_ids: Vec<String> = state
        .permission_gate
        .list_permissions()
        .await
        .into_iter()
        .map(|p| p.request_id)
        .collect();
    for id in permission_ids {
        state
            .permission_gate
            .reply_permission(&id, allternit_openclaw_host::PermissionReply::Reject)
            .await;
    }

    let question_ids: Vec<String> = state
        .permission_gate
        .list_questions()
        .await
        .into_iter()
        .map(|q| q.request_id)
        .collect();
    for id in question_ids {
        state.permission_gate.reject_question(&id).await;
    }

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
    Json(req): Json<FindFilesRequest>,
) -> Json<Vec<serde_json::Value>> {
    let base = req
        .path
        .map(|p| resolve_input_path(&p))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    let pattern = req.pattern.unwrap_or_else(|| "*".to_string());

    let mut matches = Vec::new();
    collect_matching_files(&base, &pattern, &mut matches, 0, 6);

    Json(
        matches
            .into_iter()
            .map(|p| {
                serde_json::json!({
                    "path": p.to_string_lossy(),
                    "name": p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                    "type": if p.is_dir() { "directory" } else { "file" },
                })
            })
            .collect(),
    )
}

fn collect_matching_files(
    dir: &PathBuf,
    pattern: &str,
    results: &mut Vec<PathBuf>,
    depth: usize,
    max_depth: usize,
) {
    if depth > max_depth || results.len() >= 200 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip hidden dirs
        if name.starts_with('.') {
            continue;
        }
        if glob_match(&name, pattern) {
            results.push(path.clone());
        }
        if path.is_dir() {
            collect_matching_files(&path, pattern, results, depth + 1, max_depth);
        }
    }
}

/// Simple glob matcher: supports `*` (any segment) and `?` (single char)
fn glob_match(name: &str, pattern: &str) -> bool {
    let name = name.as_bytes();
    let pat = pattern.as_bytes();
    glob_match_bytes(name, pat)
}

fn glob_match_bytes(s: &[u8], p: &[u8]) -> bool {
    match (s, p) {
        (_, b"*") => true,
        ([], []) => true,
        ([], _) | (_, []) => false,
        ([_, s_rest @ ..], [b'*', p_rest @ ..]) => {
            glob_match_bytes(s, p_rest) || glob_match_bytes(s_rest, p)
        }
        ([sc, s_rest @ ..], [b'?', p_rest @ ..]) => glob_match_bytes(s_rest, p_rest) || { let _ = sc; false },
        ([sc, s_rest @ ..], [pc, p_rest @ ..]) => {
            sc.eq_ignore_ascii_case(pc) && glob_match_bytes(s_rest, p_rest)
        }
    }
}

// ============================================================================
// File Handlers
// ============================================================================

#[derive(Deserialize)]
struct FileListQuery {
    path: Option<String>,
    details: Option<bool>,
}

async fn list_files(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<FileListQuery>,
) -> Json<Vec<serde_json::Value>> {
    let requested = query.path.unwrap_or_else(|| ".".to_string());
    let dir_path = resolve_input_path(&requested);

    let entries = match collect_directory_entries(&dir_path, query.details.unwrap_or(false)) {
        Ok(items) => items,
        Err(_) => return Json(vec![]),
    };

    Json(
        entries
            .into_iter()
            .map(|entry| {
                serde_json::json!({
                    "name": entry.name,
                    "path": entry.path,
                    "type": entry.kind,
                })
            })
            .collect(),
    )
}

#[derive(Deserialize)]
struct FileReadQuery {
    path: String,
}

async fn read_file(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<FileReadQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let requested = resolve_input_path(&query.path);
    let content = read_file_content(&requested)?;

    Ok(Json(serde_json::json!({
      "path": requested.to_string_lossy(),
      "content": content,
    })))
}

async fn get_file_status(State(_state): State<Arc<AppState>>) -> Json<Vec<serde_json::Value>> {
    Json(vec![
        serde_json::json!({
            "endpoint": "/api/v1/file/list",
            "status": "ready"
        }),
        serde_json::json!({
            "endpoint": "/api/v1/file/read",
            "status": "ready"
        }),
        serde_json::json!({
            "endpoint": "/api/v1/files/*",
            "status": "ready"
        }),
    ])
}

#[derive(Debug, Serialize)]
struct FileListEntry {
    name: String,
    path: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<u64>,
    #[serde(rename = "modifiedAt", skip_serializing_if = "Option::is_none")]
    modified_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct FileListResponse {
    path: String,
    entries: Vec<FileListEntry>,
}

#[derive(Debug, Deserialize)]
struct FileWriteRequest {
    path: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct FilePathQuery {
    path: String,
}

fn expand_tilde(input: &str) -> String {
    if input == "~" {
        if let Ok(home) = std::env::var("HOME") {
            return home;
        }
        return input.to_string();
    }

    if let Some(rest) = input.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(rest).to_string_lossy().to_string();
        }
    }

    input.to_string()
}

fn resolve_input_path(input: &str) -> PathBuf {
    let trimmed = input.trim();
    let raw = if trimmed.is_empty() { "." } else { trimmed };
    let expanded = expand_tilde(raw);
    let path = PathBuf::from(expanded);

    if path.is_absolute() {
        path
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    }
}

fn collect_directory_entries(
    dir_path: &PathBuf,
    include_details: bool,
) -> Result<Vec<FileListEntry>, StatusCode> {
    let metadata = fs::metadata(dir_path).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    })?;

    if !metadata.is_dir() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut entries = Vec::new();
    let iter = fs::read_dir(dir_path).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    })?;

    for item in iter {
        let entry = item.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_metadata = entry.metadata().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let is_dir = entry_metadata.is_dir();
        let modified_at = if include_details {
            entry_metadata
                .modified()
                .ok()
                .map(|time| chrono::DateTime::<chrono::Utc>::from(time).to_rfc3339())
        } else {
            None
        };

        entries.push(FileListEntry {
            name,
            path: path.to_string_lossy().to_string(),
            kind: if is_dir { "directory" } else { "file" }.to_string(),
            size: if include_details && !is_dir {
                Some(entry_metadata.len())
            } else {
                None
            },
            modified_at,
        });
    }

    entries.sort_by(|a, b| match (a.kind.as_str(), b.kind.as_str()) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

fn read_file_content(path: &PathBuf) -> Result<String, StatusCode> {
    let metadata = fs::metadata(path).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    })?;

    if metadata.is_dir() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let bytes = fs::read(path).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    })?;

    Ok(String::from_utf8_lossy(&bytes).to_string())
}

async fn list_files_v2(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<FileListQuery>,
) -> Result<Json<FileListResponse>, StatusCode> {
    let requested = query.path.unwrap_or_else(|| ".".to_string());
    let dir_path = resolve_input_path(&requested);
    let entries = collect_directory_entries(&dir_path, query.details.unwrap_or(true))?;

    Ok(Json(FileListResponse {
        path: dir_path.to_string_lossy().to_string(),
        entries,
    }))
}

async fn read_file_v2(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<FileReadQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let requested = resolve_input_path(&query.path);
    let content = read_file_content(&requested)?;

    Ok(Json(serde_json::json!({
      "path": requested.to_string_lossy(),
      "content": content,
    })))
}

async fn write_file_v2(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<FileWriteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let target_path = resolve_input_path(&body.path);
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    fs::write(&target_path, body.content).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
      "ok": true,
      "path": target_path.to_string_lossy(),
    })))
}

async fn delete_file_v2(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<FilePathQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let target_path = resolve_input_path(&query.path);
    let metadata = fs::metadata(&target_path).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    })?;

    if metadata.is_dir() {
        fs::remove_dir_all(&target_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        fs::remove_file(&target_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(Json(serde_json::json!({
      "ok": true,
      "path": target_path.to_string_lossy(),
    })))
}

async fn mkdir_v2(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<FilePathQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let target_path = resolve_input_path(&query.path);
    fs::create_dir_all(&target_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
      "ok": true,
      "path": target_path.to_string_lossy(),
    })))
}

async fn exists_file_v2(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<FilePathQuery>,
) -> Result<StatusCode, StatusCode> {
    let target_path = resolve_input_path(&query.path);
    if target_path.exists() {
        Ok(StatusCode::OK)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
