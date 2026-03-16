#![allow(dead_code, unused_variables, unused_imports)]
//! A2R Shell UI Routes
//!
//! Root-level routes that match the OpenCode SDK interface,
//! allowing the A2R Shell TUI to connect directly to A2R backend.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use futures_util::stream::{Stream, StreamExt};
use serde::Deserialize;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use uuid::Uuid;

use crate::AppState;
use a2r_openclaw_host::native_session_manager::{SessionId, SessionMessage};

/// Kernel session binding - maps shell session to kernel session
#[derive(Clone, Debug)]
pub struct KernelSessionBinding {
    pub kernel_session_id: String,
    pub model_id: String,
}

pub fn create_shell_ui_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/config", get(get_config))
        .route("/config/providers", get(get_config_providers))
        .route("/provider", get(list_providers))
        .route("/provider/auth", get(get_provider_auth))
        .route("/app/agents", get(get_app_agents))
        .route("/app/skills", get(get_app_skills))
        .route("/app/log", get(get_app_log))
        .route("/command/list", get(list_commands))
        .route("/project", get(get_projects))
        .route("/project/current", get(get_current_project))
        .route("/project/:project_id", get(get_project))
        .route("/lsp/status", get(get_lsp_status))
        .route("/mcp/status", get(get_mcp_status))
        .route("/mcp/connect", post(connect_mcp))
        .route("/mcp/disconnect", post(disconnect_mcp))
        .route("/formatter/status", get(get_formatter_status))
        .route("/vcs/get", get(get_vcs_info))
        .route("/path/get", get(get_path_info))
        .route("/session", get(list_sessions).post(create_session))
        .route("/session/status", get(get_session_status))
        .route("/session/:session_id", get(get_session))
        .route("/session/:session_id/message", post(send_message))
        .route("/session/:session_id/messages", get(get_messages))
        .route("/session/:session_id/todo", get(get_todos))
        .route("/session/:session_id/diff", get(get_diff))
        .route("/session/:session_id/a2r-native/state", get(get_a2r_native_state))
        .route("/event/subscribe", get(subscribe_events))
        .route("/global/config", get(get_global_config))
        .route("/global/health", get(global_health))
        .route("/global/event", get(global_event))
        .route("/experimental/resource", get(list_experimental_resources))
        .route("/experimental/session", get(list_experimental_sessions))
        .route("/tool/list", get(list_tools))
        .route("/auth/:provider_id", get(get_auth).post(set_auth))
        .route("/tui/open-sessions", get(get_open_sessions))
        .route("/tui/select-session", post(select_session))
}

async fn get_config(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "model": "claude-3-5-sonnet",
        "agent": "build",
        "theme": "dark"
    }))
}

async fn get_config_providers(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "providers": [{
            "id": "anthropic",
            "name": "Anthropic",
            "source": "env",
            "env": ["ANTHROPIC_API_KEY"],
            "options": {},
            "models": {
                "claude-3-5-sonnet": {
                    "id": "claude-3-5-sonnet",
                    "providerID": "anthropic",
                    "api": {"id": "anthropic", "url": "https://api.anthropic.com", "npm": "@ai-sdk/anthropic"},
                    "name": "Claude 3.5 Sonnet",
                    "family": "claude",
                    "capabilities": {
                        "temperature": true, "reasoning": false, "attachment": true, "toolcall": true,
                        "input": {"text": true, "audio": false, "image": true, "video": false, "pdf": true},
                        "output": {"text": true, "audio": false, "image": false, "video": false, "pdf": false}
                    },
                    "context": 200000,
                    "pricing": {"input": 3.0, "output": 15.0}
                }
            }
        }],
        "default": {"default": "anthropic"}
    }))
}

async fn list_providers(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "all": [{
            "id": "anthropic", "name": "Anthropic", "env": ["ANTHROPIC_API_KEY"],
            "models": {
                "claude-3-5-sonnet": {
                    "id": "claude-3-5-sonnet", "name": "Claude 3.5 Sonnet", "family": "claude",
                    "release_date": "2024-10-22", "attachment": true, "reasoning": false,
                    "temperature": true, "tool_call": true, "limit": {"context": 200000, "output": 8192}
                }
            }
        }],
        "default": {"default": "anthropic"},
        "connected": ["anthropic"]
    }))
}

async fn get_provider_auth(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "anthropic": [{"provider_id": "anthropic", "method": "api_key", "configured": true}]
    }))
}

async fn get_app_agents(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!([
        {
            "id": "build",
            "name": "Build",
            "description": "Full-access agent for development work",
            "mode": "primary",
            "native": true,
            "hidden": false,
            "permission": {
                "allow": ["**/*"],
                "deny": []
            },
            "options": {}
        },
        {
            "id": "plan",
            "name": "Plan",
            "description": "Read-only agent for analysis and code exploration",
            "mode": "primary",
            "native": true,
            "hidden": false,
            "permission": {
                "allow": [],
                "deny": ["**/edit/**", "**/write/**", "**/delete/**"]
            },
            "options": {}
        }
    ]))
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

async fn get_app_log() -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

async fn list_commands(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!([
        {
            "name": "/init",
            "description": "Initialize project with AGENTS.md",
            "template": "/init",
            "hints": ["init", "initialize"],
            "source": "command"
        },
        {
            "name": "/commit",
            "description": "Create a git commit",
            "template": "/commit",
            "hints": ["commit", "git"],
            "source": "command"
        }
    ]))
}

async fn get_projects(_state: State<Arc<AppState>>) -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

async fn get_current_project(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "id": "default",
        "worktree": "/workspace",
        "vcs": "git",
        "name": "A2R Workspace",
        "time": {
            "created": 1700000000,
            "updated": 1700000000
        },
        "sandboxes": []
    }))
}

async fn get_project(Path(project_id): Path<String>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "id": project_id,
        "worktree": "/workspace",
        "vcs": "git",
        "time": {
            "created": 1700000000,
            "updated": 1700000000
        },
        "sandboxes": []
    }))
}

#[derive(Deserialize)]
struct McpConnectRequest {
    name: String,
}

async fn get_lsp_status(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!([]))
}

async fn get_mcp_status(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({}))
}

async fn connect_mcp(
    _state: State<Arc<AppState>>,
    Json(_req): Json<McpConnectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({"status": "connected"})))
}

async fn disconnect_mcp(
    _state: State<Arc<AppState>>,
    Json(_req): Json<McpConnectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({"status": "disconnected"})))
}

async fn get_formatter_status(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!([]))
}

async fn get_vcs_info(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "branch": "main"
    }))
}

async fn get_path_info(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "home": "/root",
        "state": "/workspace/.a2r/state",
        "config": "/workspace/.a2r/config.json",
        "worktree": "/workspace",
        "directory": "/workspace"
    }))
}

#[derive(Deserialize)]
struct SessionListQuery {
    start: Option<i64>,
}

async fn list_sessions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SessionListQuery>,
) -> Json<Vec<serde_json::Value>> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Json(vec![]),
    };

    let manager = session_state.session_manager.read().await;
    match manager.list_sessions().await {
        Ok(sessions) => {
            let start_time = query.start.unwrap_or(0);
            let result: Vec<serde_json::Value> = sessions
                .into_iter()
                .filter(|s| s.created_at.timestamp() >= start_time)
                .map(|s| serde_json::json!({
                    "id": s.id.as_str(),
                    "slug": s.name.clone().unwrap_or_else(|| "session".to_string()).to_lowercase().replace(' ', "-"),
                    "project_id": "default",
                    "directory": "/workspace",
                    "parent_id": serde_json::Value::Null,
                    "title": s.name.unwrap_or_else(|| "Session".to_string()),
                    "version": "1.0",
                    "time": {"created": s.created_at.timestamp(), "updated": s.updated_at.timestamp()}
                }))
                .collect();
            Json(result)
        }
        Err(_) => Json(vec![]),
    }
}

#[derive(Deserialize)]
struct CreateSessionRequest {
    project_id: Option<String>,
    directory: Option<String>,
}

async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut manager = session_state.session_manager.write().await;
    let title = req.project_id.clone();
    match manager.create_session(title, None).await {
        Ok(session) => {
            session_state.session_sync.emit_created(&session);
            Ok(Json(serde_json::json!({
                "id": session.id.as_str(),
                "slug": session.name.clone().unwrap_or_else(|| "session".to_string()).to_lowercase().replace(' ', "-"),
                "project_id": "default",
                "directory": req.directory.unwrap_or_else(|| "/workspace".to_string()),
                "parent_id": serde_json::Value::Null,
                "title": session.name.unwrap_or_else(|| "New Session".to_string()),
                "version": "1.0",
                "time": {"created": session.created_at.timestamp(), "updated": session.updated_at.timestamp()}
            })))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let manager = session_state.session_manager.read().await;
    let id = SessionId::new(session_id);

    match manager.get_session(&id).await {
        Ok(session) => Ok(Json(serde_json::json!({
            "id": session.id.as_str(),
            "slug": session.name.clone().unwrap_or_else(|| "session".to_string()).to_lowercase().replace(' ', "-"),
            "project_id": "default",
            "directory": "/workspace",
            "parent_id": serde_json::Value::Null,
            "title": session.name.unwrap_or_else(|| "Session".to_string()),
            "version": "1.0",
            "time": {"created": session.created_at.timestamp(), "updated": session.updated_at.timestamp()}
        }))),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

async fn get_session_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Ok(Json(serde_json::json!({}))),
    };

    let manager = session_state.session_manager.read().await;
    match manager.list_sessions().await {
        Ok(sessions) => {
            let mut result = serde_json::Map::new();
            for session in sessions {
                result.insert(
                    session.id.as_str().to_string(),
                    serde_json::json!({
                        "session_id": session.id.as_str(),
                        "status": if session.active { "active" } else { "idle" },
                        "message_count": session.message_count
                    }),
                );
            }
            Ok(Json(serde_json::Value::Object(result)))
        }
        Err(_) => Ok(Json(serde_json::json!({}))),
    }
}

#[derive(Deserialize)]
struct SendMessageRequest {
    content: String,
    role: Option<String>,
}

async fn send_message(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut manager = session_state.session_manager.write().await;
    let id = SessionId::new(session_id.clone());

    let message = SessionMessage {
        id: Uuid::new_v4().to_string(),
        role: req.role.unwrap_or_else(|| "user".to_string()),
        content: req.content.clone(),
        timestamp: Utc::now(),
        metadata: None,
    };
    let msg_id = message.id.clone();

    // Add message to session
    match manager.add_message(&id, message).await {
        Ok(()) => {}
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    }

    // Trigger kernel execution - get or create kernel session
    let kernel_url = state.kernel_url.clone();
    let kernel_auth_token = std::env::var("A2R_KERNEL_AUTH_TOKEN")
        .or_else(|_| std::env::var("A2R_KERNEL_TOKEN"))
        .or_else(|_| std::env::var("A2R_GATEWAY_TOKEN"))
        .or_else(|_| std::env::var("OPENCLAW_GATEWAY_TOKEN"))
        .unwrap_or_else(|_| "api-a2r-local-dev".to_string());

    let model_id = "claude-3-5-sonnet"; // Default model for shell

    // Check if we have an existing kernel session binding
    let kernel_session_id = {
        let bindings = session_state.kernel_sessions.read().await;
        bindings
            .get(&session_id)
            .map(|b| b.kernel_session_id.clone())
    };

    let session_id_to_use = match kernel_session_id {
        Some(kid) => kid,
        None => {
            // Create new kernel session
            let create_url = format!("{}/v1/sessions", kernel_url);
            let create_body = serde_json::json!({
                "config": {
                    "id": "claude-sonnet",
                    "name": "Claude Sonnet",
                    "brain_type": "anthropic",
                    "model": "claude-3-5-sonnet-20241022",
                    "provider": "anthropic",
                    "api_key_env": "ANTHROPIC_API_KEY"
                },
                "profile_id": "claude-sonnet",
                "workspace_dir": null,
                "source": "shell"
            });

            match state
                .kernel_client
                .post(&create_url)
                .bearer_auth(&kernel_auth_token)
                .json(&create_body)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    match response.json::<serde_json::Value>().await {
                        Ok(payload) => {
                            match payload.get("id").and_then(|v| v.as_str()) {
                                Some(kid) => {
                                    // Store the binding
                                    let mut bindings = session_state.kernel_sessions.write().await;
                                    bindings.insert(
                                        session_id.clone(),
                                        KernelSessionBinding {
                                            kernel_session_id: kid.to_string(),
                                            model_id: model_id.to_string(),
                                        },
                                    );
                                    kid.to_string()
                                }
                                None => {
                                    tracing::warn!("Kernel session create response missing id");
                                    return Ok(Json(
                                        serde_json::json!({ "status": "sent", "message_id": msg_id, "warning": "kernel_session_pending" }),
                                    ));
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse kernel session response: {}", e);
                            return Ok(Json(
                                serde_json::json!({ "status": "sent", "message_id": msg_id, "warning": "kernel_session_pending" }),
                            ));
                        }
                    }
                }
                Ok(response) => {
                    tracing::warn!("Kernel session create failed: {}", response.status());
                    return Ok(Json(
                        serde_json::json!({ "status": "sent", "message_id": msg_id, "warning": "kernel_unavailable" }),
                    ));
                }
                Err(e) => {
                    tracing::warn!("Failed to create kernel session: {}", e);
                    return Ok(Json(
                        serde_json::json!({ "status": "sent", "message_id": msg_id, "warning": "kernel_unavailable" }),
                    ));
                }
            }
        }
    };

    // Send input to kernel session
    let input_url = format!("{}/v1/sessions/{}/input", kernel_url, session_id_to_use);
    let input_text = format!("{}\n", req.content);

    match state
        .kernel_client
        .post(&input_url)
        .bearer_auth(&kernel_auth_token)
        .json(&input_text)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => Ok(Json(
            serde_json::json!({ "status": "sent", "message_id": msg_id, "kernel_session_id": session_id_to_use }),
        )),
        Ok(response) => {
            tracing::warn!("Kernel input failed: {}", response.status());
            Ok(Json(
                serde_json::json!({ "status": "sent", "message_id": msg_id, "warning": "input_pending" }),
            ))
        }
        Err(e) => {
            tracing::warn!("Failed to send input to kernel: {}", e);
            Ok(Json(
                serde_json::json!({ "status": "sent", "message_id": msg_id, "warning": "input_pending" }),
            ))
        }
    }
}

async fn get_messages(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<Vec<serde_json::Value>> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Json(vec![]),
    };

    let manager = session_state.session_manager.read().await;
    let id = SessionId::new(session_id.clone());

    match manager.get_session(&id).await {
        Ok(session) => {
            let messages: Vec<serde_json::Value> = session.messages
                .into_iter()
                .enumerate()
                .map(|(i, m)| serde_json::json!({
                    "info": {
                        "id": m.id,
                        "sessionID": session_id,
                        "role": m.role,
                        "time": {"created": m.timestamp.timestamp(), "updated": m.timestamp.timestamp(), "completed": m.timestamp.timestamp()}
                    },
                    "parts": [{"id": format!("part-{}", i), "type": "text", "text": m.content}]
                }))
                .collect();
            Json(messages)
        }
        _ => Json(vec![]),
    }
}

async fn get_todos(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<Vec<serde_json::Value>> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Json(vec![]),
    };

    let manager = session_state.session_manager.read().await;
    let id = SessionId::new(session_id.clone());

    match manager.get_session(&id).await {
        Ok(session) => {
            // Extract tasks from messages that look like tasks
            // Messages with "task:" prefix or type="task" in metadata
            let todos: Vec<serde_json::Value> = session
                .messages
                .iter()
                .filter(|m| {
                    // Check if message content looks like a task
                    m.content.starts_with("task:")
                        || m.content.to_lowercase().contains("create task")
                        || m.metadata
                            .as_ref()
                            .map(|meta| meta.get("type").and_then(|t| t.as_str()) == Some("task"))
                            .unwrap_or(false)
                })
                .enumerate()
                .map(|(i, m)| {
                    // Parse task content
                    let title = m
                        .content
                        .strip_prefix("task:")
                        .or_else(|| m.content.split("Create task:").nth(1))
                        .unwrap_or(&m.content)
                        .trim()
                        .to_string();

                    serde_json::json!({
                        "id": m.id.clone(),
                        "title": title.split("-").next().unwrap_or(&title).trim(),
                        "description": title.split("-").nth(1).map(|s| s.trim()),
                        "status": m.metadata.as_ref()
                            .and_then(|meta| meta.get("status"))
                            .and_then(|s| s.as_str())
                            .unwrap_or("pending"),
                        "priority": m.metadata.as_ref()
                            .and_then(|meta| meta.get("priority"))
                            .and_then(|p| p.as_str())
                            .unwrap_or("medium"),
                        "created_at": m.timestamp.to_rfc3339(),
                        "updated_at": m.timestamp.to_rfc3339(),
                    })
                })
                .collect();
            Json(todos)
        }
        _ => Json(vec![]),
    }
}

async fn get_diff(
    Path(_session_id): Path<String>,
    State(_state): State<Arc<AppState>>,
) -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

async fn get_a2r_native_state(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let kernel_session_id = {
        let bindings = session_state.kernel_sessions.read().await;
        bindings
            .get(&session_id)
            .map(|b| b.kernel_session_id.clone())
    };

    let Some(kid) = kernel_session_id else {
        return Err(StatusCode::NOT_FOUND);
    };

    let kernel_url = state.kernel_url.clone();
    let kernel_auth_token = std::env::var("A2R_KERNEL_AUTH_TOKEN")
        .or_else(|_| std::env::var("A2R_KERNEL_TOKEN"))
        .or_else(|_| std::env::var("A2R_GATEWAY_TOKEN"))
        .or_else(|_| std::env::var("OPENCLAW_GATEWAY_TOKEN"))
        .unwrap_or_else(|_| "api-a2r-local-dev".to_string());

    let url = format!("{}/v1/sessions/{}/a2r-native/state", kernel_url, kid);

    match state
        .kernel_client
        .get(&url)
        .bearer_auth(&kernel_auth_token)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            match response.json::<serde_json::Value>().await {
                Ok(data) => Ok(Json(data)),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        Ok(response) => {
            tracing::warn!("Kernel A2R Native state fetch failed: {}", response.status());
            Err(StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR))
        }
        Err(e) => {
            tracing::error!("Failed to fetch A2R Native state from kernel: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
struct SubscribeQuery {
    session_id: Option<String>,
}

async fn subscribe_events(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SubscribeQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // Get kernel auth token
    let kernel_auth_token = std::env::var("A2R_KERNEL_AUTH_TOKEN")
        .or_else(|_| std::env::var("A2R_KERNEL_TOKEN"))
        .or_else(|_| std::env::var("A2R_GATEWAY_TOKEN"))
        .or_else(|_| std::env::var("OPENCLAW_GATEWAY_TOKEN"))
        .unwrap_or_else(|_| "api-a2r-local-dev".to_string());

    // Create channel for streaming - both paths need to return same type
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(32);

    // If no session_id provided, just send connection event and close
    if query.session_id.is_none() {
        let _ = tx
            .send(Ok(Event::default().data(
                serde_json::json!({"type": "server.connected", "properties": {}}).to_string(),
            )))
            .await;
        return Sse::new(tokio_stream::wrappers::ReceiverStream::new(rx));
    }

    let session_id = query.session_id.unwrap();
    let kernel_url = state.kernel_url.clone();

    // Get kernel session ID from bindings
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            // Send error and close
            let _ = tx.send(Ok(Event::default()
                .data(serde_json::json!({"type": "error", "message": "session service not initialized"}).to_string()))).await;
            return Sse::new(tokio_stream::wrappers::ReceiverStream::new(rx));
        }
    };

    let kernel_session_id = {
        let bindings = session_state.kernel_sessions.read().await;
        bindings
            .get(&session_id)
            .map(|b| b.kernel_session_id.clone())
    };

    let Some(kernel_session_id) = kernel_session_id else {
        // Send error and close
        let _ = tx.send(Ok(Event::default()
            .data(serde_json::json!({"type": "error", "message": "no kernel session for this shell session"}).to_string()))).await;
        return Sse::new(tokio_stream::wrappers::ReceiverStream::new(rx));
    };

    // Connect to kernel events stream
    let events_url = format!("{}/v1/sessions/{}/events", kernel_url, kernel_session_id);
    let client = state.kernel_client.clone();

    // Create channel for streaming
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(32);

    // Spawn task to forward kernel events to SSE
    tokio::spawn(async move {
        // Send initial connected event
        let _ = tx.send(Ok(Event::default()
            .data(serde_json::json!({"type": "server.connected", "session_id": session_id, "kernel_session_id": kernel_session_id}).to_string()))).await;

        // Connect to kernel events
        match client
            .get(&events_url)
            .bearer_auth(&kernel_auth_token)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                let mut stream = response.bytes_stream();
                let mut buffer = String::new();

                loop {
                    match tokio::time::timeout(tokio::time::Duration::from_secs(60), stream.next())
                        .await
                    {
                        Ok(Some(Ok(chunk))) => {
                            buffer.push_str(&String::from_utf8_lossy(&chunk));
                            let mut lines: Vec<String> =
                                buffer.split('\n').map(|s| s.to_string()).collect();
                            buffer = lines.pop().unwrap_or_default();

                            for line in lines {
                                let line = line.trim();
                                if line.is_empty() || !line.starts_with("data:") {
                                    continue;
                                }
                                let data = line.trim_start_matches("data:").trim();
                                if data.is_empty() || data == "[DONE]" {
                                    if data == "[DONE]" {
                                        let _ = tx
                                            .send(Ok(Event::default().data(
                                                serde_json::json!({"type": "done"}).to_string(),
                                            )))
                                            .await;
                                        break;
                                    }
                                    continue;
                                }
                                // Forward kernel event to SSE
                                let _ = tx.send(Ok(Event::default().data(data.to_string()))).await;
                            }
                        }
                        Ok(Some(Err(e))) => {
                            tracing::error!("Kernel event stream error: {}", e);
                            let _ = tx
                                .send(Ok(Event::default().data(
                                    serde_json::json!({"type": "error", "message": e.to_string()})
                                        .to_string(),
                                )))
                                .await;
                            break;
                        }
                        Ok(None) => {
                            // Stream ended
                            let _ = tx
                                .send(Ok(Event::default()
                                    .data(serde_json::json!({"type": "done"}).to_string())))
                                .await;
                            break;
                        }
                        Err(_) => {
                            // Timeout - keep connection alive with heartbeat
                            let _ = tx
                                .send(Ok(Event::default()
                                    .data(serde_json::json!({"type": "heartbeat"}).to_string())))
                                .await;
                        }
                    }
                }
            }
            Ok(response) => {
                tracing::warn!("Kernel event stream failed: {}", response.status());
                let _ = tx.send(Ok(Event::default()
                    .data(serde_json::json!({"type": "error", "message": format!("kernel stream failed: {}", response.status())}).to_string()))).await;
            }
            Err(e) => {
                tracing::warn!("Failed to connect to kernel events: {}", e);
                let _ = tx
                    .send(Ok(Event::default().data(
                        serde_json::json!({"type": "error", "message": e.to_string()}).to_string(),
                    )))
                    .await;
            }
        }
    });

    Sse::new(tokio_stream::wrappers::ReceiverStream::new(rx))
}

async fn get_global_config(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({"model": "claude-3-5-sonnet", "agent": "build"}))
}

async fn global_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({"status": "healthy"}))
}

async fn global_event() -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

async fn list_experimental_resources(_state: State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({}))
}

async fn list_experimental_sessions(_state: State<Arc<AppState>>) -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

async fn list_tools(_state: State<Arc<AppState>>) -> Json<Vec<serde_json::Value>> {
    Json(vec![])
}

async fn get_auth(Path(provider_id): Path<String>) -> Json<serde_json::Value> {
    Json(serde_json::json!({"provider_id": provider_id, "configured": false}))
}

#[derive(Deserialize)]
struct SetAuthRequest {
    api_key: Option<String>,
}

async fn set_auth(
    Path(provider_id): Path<String>,
    Json(_req): Json<SetAuthRequest>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({"provider_id": provider_id, "status": "configured"}))
}

async fn get_open_sessions(_state: State<Arc<AppState>>) -> Json<Vec<String>> {
    Json(vec![])
}

#[derive(Deserialize)]
struct SelectSessionRequest {
    session_id: String,
}

async fn select_session(Json(_req): Json<SelectSessionRequest>) -> Json<serde_json::Value> {
    Json(serde_json::json!({"status": "selected"}))
}
