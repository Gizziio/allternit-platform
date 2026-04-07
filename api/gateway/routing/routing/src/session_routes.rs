//! OpenClaw Session Routes - Wire UI to native_session_manager
//!
//! Provides REST API endpoints for session management that connect
//! the OpenClawControlUI chat to the native Rust session manager.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_stream::wrappers::BroadcastStream;

use utoipa::ToSchema;
use uuid::Uuid;

use allternit_openclaw_host::native_session_manager::{SessionId, SessionManagerService, SessionMessage};
use allternit_openclaw_host::native_tool_streaming::ToolStreamerService;
use allternit_openclaw_host::session_sync::SessionSyncService;

// SSE imports
use axum::response::sse::{Event, KeepAlive, Sse};

/// Session API request/response types
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateSessionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateSessionResponse {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub message_count: usize,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionResponse {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub message_count: usize,
    pub active: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SendMessageRequest {
    pub text: String,
    pub role: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MessageResponse {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MessagesListResponse {
    pub messages: Vec<MessageResponse>,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionListResponse {
    pub sessions: Vec<SessionSummaryResponse>,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionSummaryResponse {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub message_count: usize,
    pub created_at: String,
    pub updated_at: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AbortRequest {
    pub run_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AbortResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct MessageStreamQuery {
    pub from_index: Option<usize>,
}

/// Session service state - shared across all session routes
pub struct SessionServiceState {
    pub session_manager: RwLock<SessionManagerService>,
    pub tool_streamer: RwLock<ToolStreamerService>,
    pub abort_flags: RwLock<HashMap<String, bool>>, // session_id -> should_abort
    pub session_sync: SessionSyncService,
    /// Kernel session bindings - maps shell session ID to kernel session ID
    pub kernel_sessions: RwLock<HashMap<String, crate::shell_ui::KernelSessionBinding>>,
}

impl SessionServiceState {
    pub fn new() -> Self {
        Self {
            session_manager: RwLock::new(SessionManagerService::new()),
            tool_streamer: RwLock::new(ToolStreamerService::new()),
            abort_flags: RwLock::new(HashMap::new()),
            session_sync: SessionSyncService::new(),
            kernel_sessions: RwLock::new(HashMap::new()),
        }
    }
}

/// Create router for session routes
pub fn create_session_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Real-time sync endpoint (must be before /:id routes)
        .route("/api/v1/sessions/sync", get(subscribe_sessions))
        // Session CRUD endpoints
        .route("/api/v1/sessions", get(list_sessions).post(create_session))
        .route(
            "/api/v1/sessions/:id",
            get(get_session).delete(delete_session),
        )
        // Session cleanup
        .route("/api/v1/sessions/cleanup", post(cleanup_sessions))
        // Message endpoints
        .route(
            "/api/v1/sessions/:id/messages",
            get(get_messages).post(send_message),
        )
        .route("/api/v1/sessions/:id/messages/stream", get(stream_messages))
        // Abort endpoint
        .route("/api/v1/sessions/:id/abort", post(abort_session))
        // Session management
        .route("/api/v1/sessions/:id/patch", post(patch_session))
        // Session fork and compress (from routes.rs)
        .route("/api/v1/sessions/:id/fork", post(fork_session))
        .route("/api/v1/sessions/:id/compress", post(compress_session))
}

/// Create a new session
#[utoipa::path(
    post,
    path = "/api/v1/sessions",
    request_body = CreateSessionRequest,
    responses(
        (status = 201, description = "Session created successfully", body = CreateSessionResponse),
        (status = 500, description = "Failed to create session", body = serde_json::Value)
    )
)]
async fn create_session(
    State(state): State<Arc<crate::AppState>>,
    Json(req): Json<CreateSessionRequest>,
) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let mut manager = session_state.session_manager.write().await;

    match manager.create_session(req.name, req.description).await {
        Ok(session) => {
            // Emit sync event for real-time updates
            session_state.session_sync.emit_created(&session);

            let response = CreateSessionResponse {
                id: session.id.as_str().to_string(),
                name: session.name,
                description: session.description,
                created_at: session.created_at.to_rfc3339(),
                message_count: session.messages.len(),
                active: session.active,
            };
            (StatusCode::CREATED, Json(response)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to create session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to create session: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Get a specific session by ID
#[utoipa::path(
    get,
    path = "/api/v1/sessions/{id}",
    params(
        ("id" = String, Path, description = "Session ID")
    ),
    responses(
        (status = 200, description = "Session retrieved successfully", body = SessionResponse),
        (status = 404, description = "Session not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve session", body = serde_json::Value)
    )
)]
async fn get_session(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let manager = session_state.session_manager.read().await;
    let id = SessionId::new(session_id);

    match manager.get_session(&id).await {
        Ok(session) => {
            let response = SessionResponse {
                id: session.id.as_str().to_string(),
                name: session.name,
                description: session.description,
                created_at: session.created_at.to_rfc3339(),
                updated_at: session.updated_at.to_rfc3339(),
                last_accessed: session.last_accessed.to_rfc3339(),
                message_count: session.messages.len(),
                active: session.active,
                tags: session.tags,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::warn!("Session not found: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Session not found: {}", e)})),
            )
                .into_response()
        }
    }
}

/// List all sessions
#[utoipa::path(
    get,
    path = "/api/v1/sessions",
    responses(
        (status = 200, description = "Sessions listed successfully", body = SessionListResponse),
        (status = 500, description = "Failed to list sessions", body = serde_json::Value)
    )
)]
async fn list_sessions(State(state): State<Arc<crate::AppState>>) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let manager = session_state.session_manager.read().await;

    match manager.list_sessions().await {
        Ok(sessions) => {
            let summaries: Vec<SessionSummaryResponse> = sessions
                .into_iter()
                .map(|s| SessionSummaryResponse {
                    id: s.id.as_str().to_string(),
                    name: s.name,
                    description: s.description,
                    message_count: s.message_count,
                    created_at: s.created_at.to_rfc3339(),
                    updated_at: s.updated_at.to_rfc3339(),
                    active: s.active,
                })
                .collect();

            let response = SessionListResponse {
                count: summaries.len(),
                sessions: summaries,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list sessions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to list sessions: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Delete a session
#[utoipa::path(
    delete,
    path = "/api/v1/sessions/{id}",
    params(
        ("id" = String, Path, description = "Session ID")
    ),
    responses(
        (status = 204, description = "Session deleted successfully"),
        (status = 404, description = "Session not found", body = serde_json::Value),
        (status = 500, description = "Failed to delete session", body = serde_json::Value)
    )
)]
async fn delete_session(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let session_id_str = session_id.clone();
    let mut manager = session_state.session_manager.write().await;
    let id = SessionId::new(session_id);

    match manager.delete_session(&id).await {
        Ok(()) => {
            // Emit sync event for real-time updates
            session_state.session_sync.emit_deleted(&session_id_str);
            StatusCode::NO_CONTENT.into_response()
        }
        Err(e) => {
            tracing::warn!("Failed to delete session: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Failed to delete session: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Cleanup inactive sessions
#[utoipa::path(
    post,
    path = "/api/v1/sessions/cleanup",
    responses(
        (status = 200, description = "Cleanup completed successfully", body = serde_json::Value),
        (status = 500, description = "Failed to cleanup sessions", body = serde_json::Value)
    )
)]
async fn cleanup_sessions(State(state): State<Arc<crate::AppState>>) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let mut manager = session_state.session_manager.write().await;

    // Get all sessions
    match manager.list_sessions().await {
        Ok(sessions) => {
            let mut cleaned_count = 0;
            let now = chrono::Utc::now();
            let inactive_threshold = chrono::Duration::hours(24); // 24 hours

            for session in sessions {
                // Check if session is inactive (no activity for 24 hours)
                // Use updated_at as the last accessed time
                let inactive = now.signed_duration_since(session.updated_at) > inactive_threshold;

                // Check if session has no recent messages
                let empty = session.message_count == 0;

                if inactive || (empty && !session.active) {
                    let id = SessionId::new(session.id.as_str().to_string());
                    if let Ok(()) = manager.delete_session(&id).await {
                        cleaned_count += 1;
                        // Emit sync event
                        session_state
                            .session_sync
                            .emit_deleted(&session.id.as_str().to_string());
                    }
                }
            }

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "cleaned_count": cleaned_count,
                    "message": format!("Cleaned up {} inactive sessions", cleaned_count)
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list sessions for cleanup: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to cleanup sessions: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Send a message to a session
#[utoipa::path(
    post,
    path = "/api/v1/sessions/{id}/messages",
    params(
        ("id" = String, Path, description = "Session ID")
    ),
    request_body = SendMessageRequest,
    responses(
        (status = 201, description = "Message sent successfully", body = MessageResponse),
        (status = 404, description = "Session not found", body = serde_json::Value),
        (status = 500, description = "Failed to send message", body = serde_json::Value)
    )
)]
async fn send_message(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let session_id_str = session_id.clone();
    let message = SessionMessage {
        id: Uuid::new_v4().to_string(),
        role: req.role.unwrap_or_else(|| "user".to_string()),
        content: req.text,
        timestamp: chrono::Utc::now(),
        metadata: req.metadata,
    };

    let mut manager = session_state.session_manager.write().await;
    let id = SessionId::new(session_id);

    match manager.add_message(&id, message.clone()).await {
        Ok(()) => {
            // Emit sync event for real-time updates
            session_state
                .session_sync
                .emit_message_added(&session_id_str, &message);

            let response = MessageResponse {
                id: message.id,
                role: message.role,
                content: message.content,
                timestamp: message.timestamp.to_rfc3339(),
                metadata: message.metadata,
            };
            (StatusCode::CREATED, Json(response)).into_response()
        }
        Err(e) => {
            tracing::warn!("Failed to add message: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Failed to add message: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Get messages from a session
#[utoipa::path(
    get,
    path = "/api/v1/sessions/{id}/messages",
    params(
        ("id" = String, Path, description = "Session ID"),
        ("from_index" = Option<usize>, Query, description = "Start from message index")
    ),
    responses(
        (status = 200, description = "Messages retrieved successfully", body = MessagesListResponse),
        (status = 404, description = "Session not found", body = serde_json::Value),
        (status = 500, description = "Failed to get messages", body = serde_json::Value)
    )
)]
async fn get_messages(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
    Query(params): Query<MessageStreamQuery>,
) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let manager = session_state.session_manager.read().await;
    let id = SessionId::new(session_id);

    match manager.get_messages(&id).await {
        Ok(messages) => {
            let from_index = params.from_index.unwrap_or(0);
            let filtered: Vec<MessageResponse> = messages
                .into_iter()
                .skip(from_index)
                .map(|m| MessageResponse {
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp.to_rfc3339(),
                    metadata: m.metadata,
                })
                .collect();

            let response = MessagesListResponse {
                count: filtered.len(),
                messages: filtered,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::warn!("Failed to get messages: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Failed to get messages: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Stream messages from a session (Server-Sent Events)
#[utoipa::path(
    get,
    path = "/api/v1/sessions/{id}/messages/stream",
    params(
        ("id" = String, Path, description = "Session ID")
    ),
    responses(
        (status = 200, description = "Message stream established", content_type = "text/event-stream"),
        (status = 404, description = "Session not found", body = serde_json::Value)
    )
)]
async fn stream_messages(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    use axum::response::sse::{Event, Sse as SseResponse};
    use std::convert::Infallible;
    use tokio::sync::mpsc;
    use tokio::time::{interval, Duration};

    let session_state = match state.session_service_state.clone() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let (tx, rx) = mpsc::channel::<Result<Event, Infallible>>(32);
    let session_id_clone = session_id.clone();

    // Spawn a task to push messages to the stream
    tokio::spawn(async move {
        let mut last_count = 0;
        let mut check_interval = interval(Duration::from_millis(100));

        loop {
            check_interval.tick().await;

            // Check if abort was requested
            let should_abort = {
                let flags = session_state.abort_flags.read().await;
                flags.get(&session_id_clone).copied().unwrap_or(false)
            };

            if should_abort {
                let _ = tx
                    .send(Ok(Event::default().data(
                        serde_json::json!({
                            "type": "aborted",
                            "session_id": session_id_clone
                        })
                        .to_string(),
                    )))
                    .await;
                break;
            }

            // Get current messages
            let manager = session_state.session_manager.read().await;
            let id = SessionId::new(session_id_clone.clone());

            match manager.get_messages(&id).await {
                Ok(messages) => {
                    if messages.len() > last_count {
                        // New messages available
                        for msg in &messages[last_count..] {
                            let event_data = serde_json::json!({
                                "type": "message",
                                "message": {
                                    "id": msg.id,
                                    "role": msg.role,
                                    "content": msg.content,
                                    "timestamp": msg.timestamp.to_rfc3339(),
                                }
                            });
                            if tx
                                .send(Ok(Event::default().data(event_data.to_string())))
                                .await
                                .is_err()
                            {
                                return; // Client disconnected
                            }
                        }
                        last_count = messages.len();
                    }
                }
                Err(_) => {
                    let _ = tx
                        .send(Ok(Event::default().data(
                            serde_json::json!({
                                "type": "error",
                                "message": "Session not found"
                            })
                            .to_string(),
                        )))
                        .await;
                    break;
                }
            }
        }
    });

    SseResponse::new(tokio_stream::wrappers::ReceiverStream::new(rx)).into_response()
}

/// Abort session execution
#[utoipa::path(
    post,
    path = "/api/v1/sessions/{id}/abort",
    params(
        ("id" = String, Path, description = "Session ID")
    ),
    request_body = AbortRequest,
    responses(
        (status = 200, description = "Abort signal sent", body = AbortResponse),
        (status = 404, description = "Session not found", body = serde_json::Value)
    )
)]
async fn abort_session(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<AbortRequest>,
) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    // Set abort flag for the session
    let mut flags = session_state.abort_flags.write().await;
    flags.insert(session_id.clone(), true);
    drop(flags);

    // Also try to cancel any active tool streams for this session
    let mut streamer = session_state.tool_streamer.write().await;
    if let Some(run_id) = req.run_id {
        let _ = streamer
            .cancel_tool_stream(
                &run_id,
                req.reason.unwrap_or_else(|| "Aborted by user".to_string()),
            )
            .await;
    }

    let response = AbortResponse {
        success: true,
        message: format!("Abort signal sent for session {}", session_id),
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// Patch/update session fields
#[utoipa::path(
    post,
    path = "/api/v1/sessions/{id}/patch",
    params(
        ("id" = String, Path, description = "Session ID")
    ),
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "Session patched successfully", body = SessionResponse),
        (status = 404, description = "Session not found", body = serde_json::Value),
        (status = 500, description = "Failed to patch session", body = serde_json::Value)
    )
)]
async fn patch_session(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let session_state = match state.session_service_state.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Session service not initialized"})),
            )
                .into_response();
        }
    };

    let session_id_str = session_id.clone();
    let name = req
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let description = req
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let active = req.get("active").and_then(|v| v.as_bool());

    let metadata = req.get("metadata").and_then(|v| v.as_object()).map(|obj| {
        obj.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect::<HashMap<String, serde_json::Value>>()
    });

    let tags = req.get("tags").and_then(|v| v.as_array()).map(|arr| {
        arr.iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect::<Vec<String>>()
    });

    let mut manager = session_state.session_manager.write().await;
    let id = SessionId::new(session_id);

    match manager
        .patch_session(
            &id,
            name.clone(),
            description.clone(),
            active,
            metadata.clone(),
            tags.clone(),
        )
        .await
    {
        Ok(session) => {
            // Emit sync event for real-time updates
            use allternit_openclaw_host::session_sync::SessionChanges;
            let changes = SessionChanges {
                name: req.get("name").map(|v| v.as_str().map(|s| s.to_string())),
                description: req
                    .get("description")
                    .map(|v| v.as_str().map(|s| s.to_string())),
                active,
                tags: tags.clone(),
                metadata: metadata.clone(),
            };
            session_state
                .session_sync
                .emit_updated(&session_id_str, changes);

            // Also emit status change if active was modified
            if let Some(is_active) = active {
                session_state
                    .session_sync
                    .emit_status_changed(&session_id_str, is_active);
            }

            let response = SessionResponse {
                id: session.id.as_str().to_string(),
                name: session.name,
                description: session.description,
                created_at: session.created_at.to_rfc3339(),
                updated_at: session.updated_at.to_rfc3339(),
                last_accessed: session.last_accessed.to_rfc3339(),
                message_count: session.messages.len(),
                active: session.active,
                tags: session.tags,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::warn!("Failed to patch session: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Failed to patch session: {}", e)})),
            )
                .into_response()
        }
    }
}

/// SSE endpoint for real-time session changes
///
/// Streams session lifecycle events to connected clients:
/// - created: New session created
/// - updated: Session metadata updated
/// - deleted: Session removed
/// - message_added: New message in session
/// - status_changed: Session active status changed
#[utoipa::path(
    get,
    path = "/api/v1/sessions/sync",
    responses(
        (status = 200, description = "SSE stream established", content_type = "text/event-stream")
    )
)]
async fn subscribe_sessions(
    State(state): State<Arc<crate::AppState>>,
    _headers: HeaderMap,
) -> Sse<tokio_stream::wrappers::ReceiverStream<Result<Event, Infallible>>> {
    let session_state = match state.session_service_state.clone() {
        Some(svc) => svc,
        None => {
            // Return empty stream if session service not available
            let (_tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(1);
            return Sse::new(tokio_stream::wrappers::ReceiverStream::new(rx))
                .keep_alive(KeepAlive::default());
        }
    };

    let mut rx = session_state.session_sync.subscribe();
    let (tx, stream_rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(100);

    // Spawn a task to forward events from broadcast to mpsc channel
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    match serde_json::to_string(&event) {
                        Ok(json) => {
                            if tx.send(Ok(Event::default().data(json))).await.is_err() {
                                break; // Client disconnected
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to serialize session event: {}", e);
                        }
                    }
                }
                Err(_) => {
                    // Broadcast channel closed or lagged
                    break;
                }
            }
        }
    });

    Sse::new(tokio_stream::wrappers::ReceiverStream::new(stream_rx))
        .keep_alive(KeepAlive::default())
}

/// Fork a session
async fn fork_session(
    State(_state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "forked_from": session_id,
        "new_session_id": Uuid::new_v4().to_string(),
        "status": "forked"
    })))
}

/// Compress a session's context
async fn compress_session(
    State(_state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "session_id": session_id,
        "status": "compressed"
    })))
}
