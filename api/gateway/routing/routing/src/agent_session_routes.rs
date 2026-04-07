//! Agent Session Routes
//!
//! Provides REST API endpoints for agent session management.
//! Compatible with OpenClaw agent mode for long-lived sessions with state.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::AppState;
use allternit_openclaw_host::{
    native_session_manager::{SessionId, SessionManagerError, SessionMessage, SessionState},
    session_sync::SessionChanges,
};

/// Agent session routes
pub fn create_agent_session_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Session CRUD
        .route(
            "/api/v1/agent-sessions",
            get(list_sessions).post(create_session),
        )
        .route(
            "/api/v1/agent-sessions/:id",
            get(get_session)
                .patch(update_session)
                .delete(delete_session),
        )
        // Session messages
        .route(
            "/api/v1/agent-sessions/:id/messages",
            get(list_messages).post(send_message),
        )
        // Session control
        .route("/api/v1/agent-sessions/:id/abort", post(abort_session))
        // Session sync (SSE for real-time updates)
        .route("/api/v1/agent-sessions/sync", get(sync_sessions))
}

// ============================================================================
// Types
// ============================================================================

/// Agent session surface (origin UI)
#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
#[serde(rename_all = "snake_case")]
pub enum AgentSessionSurface {
    Chat,
    Cowork,
    Code,
    Browser,
}

/// Agent session mode
#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
#[serde(rename_all = "lowercase")]
pub enum AgentSessionMode {
    Regular,
    Agent,
}

/// Agent session features
#[derive(Debug, Deserialize, Serialize, ToSchema, Clone, Default)]
pub struct AgentSessionFeatures {
    #[serde(default)]
    pub workspace: Option<bool>,
    #[serde(default)]
    pub tools: Option<bool>,
    #[serde(default)]
    pub automation: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSessionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub agent_id: Option<String>,
    pub agent_name: Option<String>,
    pub model: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// Origin surface (chat, cowork, code, browser)
    pub origin_surface: Option<AgentSessionSurface>,
    /// Session mode (regular or agent)
    pub session_mode: Option<AgentSessionMode>,
    /// Project identifier
    pub project_id: Option<String>,
    /// Workspace scope path
    pub workspace_scope: Option<String>,
    /// Agent-specific features
    pub agent_features: Option<AgentSessionFeatures>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionResponse {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub active: bool,
    pub message_count: usize,
    pub tags: Vec<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SendMessageRequest {
    pub text: String,
    pub role: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSessionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub active: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// Update origin surface
    pub origin_surface: Option<AgentSessionSurface>,
    /// Update session mode
    pub session_mode: Option<AgentSessionMode>,
    /// Update project id
    pub project_id: Option<String>,
    /// Update workspace scope
    pub workspace_scope: Option<String>,
    /// Update agent features
    pub agent_features: Option<AgentSessionFeatures>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MessageResponse {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionsListResponse {
    pub sessions: Vec<SessionResponse>,
    pub count: usize,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AbortRequest {
    pub reason: Option<String>,
}

fn map_session_error(error: SessionManagerError) -> StatusCode {
    match error {
        SessionManagerError::SessionNotFound(_) => StatusCode::NOT_FOUND,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

fn parse_session_id(value: &str) -> SessionId {
    SessionId::new(value.to_string())
}

fn build_session_response(session: SessionState) -> SessionResponse {
    SessionResponse {
        id: session.id.as_str().to_string(),
        name: session.name,
        description: session.description,
        created_at: session.created_at.to_rfc3339(),
        updated_at: session.updated_at.to_rfc3339(),
        last_accessed: session.last_accessed.to_rfc3339(),
        active: session.active,
        message_count: session.messages.len(),
        tags: session.tags,
        metadata: session.metadata,
    }
}

fn build_message_response(message: SessionMessage) -> MessageResponse {
    MessageResponse {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.to_rfc3339(),
    }
}

// ============================================================================
// Handlers
// ============================================================================

/// List all agent sessions
#[utoipa::path(
    get,
    path = "/api/v1/agent-sessions",
    responses(
        (status = 200, description = "List of sessions", body = SessionsListResponse),
    ),
)]
async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SessionsListResponse>, StatusCode> {
    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let manager = session_manager.read().await;
    let summaries = manager.list_sessions().await.map_err(map_session_error)?;
    let mut session_responses = Vec::with_capacity(summaries.len());

    for summary in summaries {
        let session = manager
            .get_session(&summary.id)
            .await
            .map_err(map_session_error)?;
        session_responses.push(build_session_response(session));
    }

    let count = session_responses.len();

    Ok(Json(SessionsListResponse {
        sessions: session_responses,
        count,
    }))
}

/// Create a new agent session
#[utoipa::path(
    post,
    path = "/api/v1/agent-sessions",
    request_body = CreateSessionRequest,
    responses(
        (status = 201, description = "Session created", body = SessionResponse),
    ),
)]
async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<SessionResponse>, StatusCode> {
    let CreateSessionRequest {
        name,
        description,
        agent_id,
        agent_name,
        model,
        tags,
        metadata,
        origin_surface,
        session_mode,
        project_id,
        workspace_scope,
        agent_features,
    } = request;

    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let mut manager = session_manager.write().await;
    let mut session = manager
        .create_session(name, description)
        .await
        .map_err(map_session_error)?;

    // Build metadata with all agent session fields
    let mut metadata_patch = metadata.unwrap_or_default();
    
    // Core agent identity
    if let Some(agent_id) = agent_id {
        metadata_patch.insert("allternit_agent_id".to_string(), serde_json::Value::String(agent_id));
    }
    if let Some(agent_name) = agent_name {
        metadata_patch.insert("allternit_agent_name".to_string(), serde_json::Value::String(agent_name));
    }
    
    // Runtime model
    if let Some(model) = model {
        metadata_patch.insert(
            "allternit_runtime_model".to_string(),
            serde_json::Value::String(model),
        );
    }
    
    // Session origin and mode
    if let Some(surface) = origin_surface {
        let surface_str = match surface {
            AgentSessionSurface::Chat => "chat",
            AgentSessionSurface::Cowork => "cowork",
            AgentSessionSurface::Code => "code",
            AgentSessionSurface::Browser => "browser",
        };
        metadata_patch.insert(
            "allternit_origin_surface".to_string(),
            serde_json::Value::String(surface_str.to_string()),
        );
    }
    
    if let Some(mode) = session_mode {
        let mode_str = match mode {
            AgentSessionMode::Regular => "regular",
            AgentSessionMode::Agent => "agent",
        };
        metadata_patch.insert(
            "allternit_session_mode".to_string(),
            serde_json::Value::String(mode_str.to_string()),
        );
    }
    
    // Project and workspace context
    if let Some(pid) = project_id {
        metadata_patch.insert("allternit_project_id".to_string(), serde_json::Value::String(pid));
    }
    if let Some(scope) = workspace_scope {
        metadata_patch.insert("allternit_workspace_scope".to_string(), serde_json::Value::String(scope));
    }
    
    // Agent features
    if let Some(features) = agent_features {
        let features_obj = serde_json::json!({
            "workspace": features.workspace.unwrap_or(false),
            "tools": features.tools.unwrap_or(false),
            "automation": features.automation.unwrap_or(false),
        });
        metadata_patch.insert("allternit_agent_features".to_string(), features_obj);
    }

    if !metadata_patch.is_empty() || tags.is_some() {
        session = manager
            .patch_session(
                &session.id,
                None,
                None,
                None,
                if metadata_patch.is_empty() {
                    None
                } else {
                    Some(metadata_patch)
                },
                tags,
            )
            .await
            .map_err(map_session_error)?;
    }

    // Emit session created event
    if let Some(ref sync) = state.session_sync {
        sync.emit_created(&session);
    }

    Ok(Json(build_session_response(session)))
}

/// Get a specific session
async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionResponse>, StatusCode> {
    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let manager = session_manager.read().await;
    let session = manager
        .get_session(&parse_session_id(&session_id))
        .await
        .map_err(map_session_error)?;

    Ok(Json(build_session_response(session)))
}

async fn update_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(request): Json<UpdateSessionRequest>,
) -> Result<Json<SessionResponse>, StatusCode> {
    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let mut manager = session_manager.write().await;
    
    // Merge metadata with agent session fields
    let mut metadata_patch = request.metadata.clone().unwrap_or_default();
    
    // Update origin surface if provided
    if let Some(surface) = &request.origin_surface {
        let surface_str = match surface {
            AgentSessionSurface::Chat => "chat",
            AgentSessionSurface::Cowork => "cowork",
            AgentSessionSurface::Code => "code",
            AgentSessionSurface::Browser => "browser",
        };
        metadata_patch.insert(
            "allternit_origin_surface".to_string(),
            serde_json::Value::String(surface_str.to_string()),
        );
    }
    
    // Update session mode if provided
    if let Some(mode) = &request.session_mode {
        let mode_str = match mode {
            AgentSessionMode::Regular => "regular",
            AgentSessionMode::Agent => "agent",
        };
        metadata_patch.insert(
            "allternit_session_mode".to_string(),
            serde_json::Value::String(mode_str.to_string()),
        );
    }
    
    // Update project id if provided
    if let Some(pid) = &request.project_id {
        metadata_patch.insert("allternit_project_id".to_string(), serde_json::Value::String(pid.clone()));
    }
    
    // Update workspace scope if provided
    if let Some(scope) = &request.workspace_scope {
        metadata_patch.insert("allternit_workspace_scope".to_string(), serde_json::Value::String(scope.clone()));
    }
    
    // Update agent features if provided
    if let Some(features) = &request.agent_features {
        let features_obj = serde_json::json!({
            "workspace": features.workspace.unwrap_or(false),
            "tools": features.tools.unwrap_or(false),
            "automation": features.automation.unwrap_or(false),
        });
        metadata_patch.insert("allternit_agent_features".to_string(), features_obj);
    }
    
    // Use merged metadata or None if empty
    let final_metadata = if metadata_patch.is_empty() {
        request.metadata.clone()
    } else {
        Some(metadata_patch)
    };
    
    let session = manager
        .patch_session(
            &parse_session_id(&session_id),
            request.name.clone(),
            request.description.clone(),
            request.active,
            final_metadata,
            request.tags.clone(),
        )
        .await
        .map_err(map_session_error)?;

    if let Some(ref sync) = state.session_sync {
        sync.emit_updated(
            &session_id,
            SessionChanges {
                name: request.name.as_ref().map(|_| session.name.clone()),
                description: request
                    .description
                    .as_ref()
                    .map(|_| session.description.clone()),
                active: request.active,
                tags: request.tags.as_ref().map(|_| session.tags.clone()),
                metadata: request.metadata.as_ref().and(session.metadata.clone()),
            },
        );

        if request.active.is_some() {
            sync.emit_status_changed(&session_id, session.active);
        }
    }

    Ok(Json(build_session_response(session)))
}

/// Delete a session
async fn delete_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let mut manager = session_manager.write().await;
    manager
        .delete_session(&parse_session_id(&session_id))
        .await
        .map_err(map_session_error)?;

    // Emit session deleted event
    if let Some(ref sync) = state.session_sync {
        sync.emit_deleted(&session_id);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// List messages in a session
async fn list_messages(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<Vec<MessageResponse>>, StatusCode> {
    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let manager = session_manager.read().await;
    let messages = manager
        .get_messages(&parse_session_id(&session_id))
        .await
        .map_err(map_session_error)?;

    let message_responses = messages.into_iter().map(build_message_response).collect();

    Ok(Json(message_responses))
}

/// Send a message to a session
async fn send_message(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(request): Json<SendMessageRequest>,
) -> Result<Json<MessageResponse>, StatusCode> {
    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let mut manager = session_manager.write().await;
    let message = SessionMessage {
        id: Uuid::new_v4().to_string(),
        role: request.role.unwrap_or_else(|| "user".to_string()),
        content: request.text,
        timestamp: Utc::now(),
        metadata: None,
    };
    manager
        .add_message(&parse_session_id(&session_id), message.clone())
        .await
        .map_err(map_session_error)?;

    // Emit message added event
    if let Some(ref sync) = state.session_sync {
        sync.emit_message_added(&session_id, &message);
    }

    Ok(Json(build_message_response(message)))
}

/// Abort a session
async fn abort_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(request): Json<AbortRequest>,
) -> Result<StatusCode, StatusCode> {
    let session_manager = state
        .session_manager
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let mut manager = session_manager.write().await;
    let metadata = request.reason.clone().map(|reason| {
        let mut patch = HashMap::new();
        patch.insert(
            "last_abort_reason".to_string(),
            serde_json::Value::String(reason),
        );
        patch
    });
    let session = manager
        .patch_session(
            &parse_session_id(&session_id),
            None,
            None,
            Some(false),
            metadata.clone(),
            None,
        )
        .await
        .map_err(map_session_error)?;

    if let Some(ref sync) = state.session_sync {
        sync.emit_updated(
            &session_id,
            SessionChanges {
                active: Some(false),
                metadata,
                ..SessionChanges::default()
            },
        );
        sync.emit_status_changed(&session_id, session.active);
    }

    Ok(StatusCode::OK)
}

/// Sync sessions via SSE
async fn sync_sessions(
    State(state): State<Arc<AppState>>,
) -> Result<
    axum::response::sse::Sse<
        impl futures_util::Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>,
    >,
    StatusCode,
> {
    use axum::response::sse::Event;
    use futures_util::StreamExt;
    use tokio_stream::wrappers::BroadcastStream;

    let session_sync = state
        .session_sync
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let rx = session_sync.subscribe();

    let stream = BroadcastStream::new(rx).map(|result| match result {
        Ok(event) => {
            let json = serde_json::to_string(&event).unwrap_or_default();
            Ok(Event::default().data(json))
        }
        Err(_) => Ok(Event::default().event("error").data("stream error")),
    });

    Ok(axum::response::sse::Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}
