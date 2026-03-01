//! Session API routes

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};

use crate::state::AppState;
use crate::tmux::TmuxClient;
use crate::types::{ErrorResponse, Session, SessionConfig};

/// List all sessions
pub async fn list_sessions(
    State(state): State<AppState>,
) -> Result<Json<Vec<Session>>, (StatusCode, Json<ErrorResponse>)> {
    let client = TmuxClient::new();

    match client.list_sessions().await {
        Ok(sessions) => {
            // Update state
            for session in &sessions {
                state.register_session(session.clone()).await;
            }
            Ok(Json(sessions))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Get a specific session
pub async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Session>, (StatusCode, Json<ErrorResponse>)> {
    // Check state first
    if let Some(session) = state.get_session(&id).await {
        return Ok(Json(session));
    }

    // Fallback to tmux
    let client = TmuxClient::new();
    match client.get_session(&id).await {
        Ok(session) => {
            state.register_session(session.clone()).await;
            Ok(Json(session))
        }
        Err(e) => Err((StatusCode::NOT_FOUND, Json(e))),
    }
}

/// Create a new session
pub async fn create_session(
    State(state): State<AppState>,
    Json(config): Json<SessionConfig>,
) -> Result<Json<Session>, (StatusCode, Json<ErrorResponse>)> {
    let client = TmuxClient::new();

    match client.create_session(config).await {
        Ok(session) => {
            state.register_session(session.clone()).await;
            Ok(Json(session))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Delete a session
pub async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let client = TmuxClient::new();

    match client.kill_session(&id).await {
        Ok(_) => {
            state.remove_session(&id).await;
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Attach to a session (placeholder for future implementation)
pub async fn attach_session(
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    // In a real implementation, this might set up WebSocket for interaction
    Ok(Json(serde_json::json!({
        "message": "Use 'tmux attach -t {id}' to attach to the session",
        "session_id": id,
    })))
}
