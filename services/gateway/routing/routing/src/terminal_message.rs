//! Terminal Message API Routes
//!
//! Handles HTTP POST requests for terminal messages from the frontend.
//! This fixes the "missing field `content`" error by making the content field optional.

use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use crate::AppState;

/// Terminal message request from frontend
/// The `content` field is optional with a default to fix deserialization errors
#[derive(Debug, Deserialize)]
pub struct TerminalMessageRequest {
    /// Message type (e.g., "input", "output", "resize", "close")
    #[serde(default)]
    pub message_type: Option<String>,
    
    /// Message content - made optional with default to fix 422 errors
    #[serde(default)]
    pub content: Option<String>,
    
    /// Session identifier
    #[serde(default)]
    pub session_id: Option<String>,
    
    /// Additional metadata
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

/// Terminal message response
#[derive(Debug, Serialize)]
pub struct TerminalMessageResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Create terminal message router
pub fn terminal_message_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/message", post(handle_terminal_message))
        .route("/send", post(handle_terminal_send))
}

/// Handle terminal message endpoint
/// POST /api/v1/terminal/:session_id/message
pub async fn handle_terminal_message(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(request): Json<TerminalMessageRequest>,
) -> impl IntoResponse {
    debug!(
        session_id = %session_id,
        message_type = ?request.message_type,
        has_content = request.content.is_some(),
        "Received terminal message"
    );

    // Get the content (empty string if not provided)
    let content = request.content.unwrap_or_default();
    let message_type = request.message_type.unwrap_or_else(|| "input".to_string());

    // Verify session exists using terminal_session_manager
    if state.terminal_session_manager.get_session(&session_id).await.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(TerminalMessageResponse {
                success: false,
                message: format!("Terminal session {} not found", session_id),
                data: None,
            }),
        );
    }

    // Handle based on message type
    match message_type.as_str() {
        "input" | "data" => {
            // Forward input to the terminal session
            debug!(
                session_id = %session_id,
                content_len = content.len(),
                "Forwarding terminal input"
            );

            // TODO: Forward to actual terminal input handler via terminal_session_manager
            // For now, just acknowledge receipt
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: "Input received".to_string(),
                    data: Some(serde_json::json!({
                        "session_id": session_id,
                        "bytes_received": content.len(),
                    })),
                }),
            )
        }
        "resize" => {
            debug!(session_id = %session_id, "Processing resize message");
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: "Resize acknowledged".to_string(),
                    data: Some(serde_json::json!({
                        "session_id": session_id,
                    })),
                }),
            )
        }
        "close" => {
            info!(session_id = %session_id, "Processing close message");
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: "Close acknowledged".to_string(),
                    data: Some(serde_json::json!({
                        "session_id": session_id,
                    })),
                }),
            )
        }
        unknown => {
            warn!(
                session_id = %session_id,
                message_type = %unknown,
                "Unknown terminal message type"
            );
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: format!("Unknown message type '{}' accepted", unknown),
                    data: Some(serde_json::json!({
                        "session_id": session_id,
                        "message_type": unknown,
                    })),
                }),
            )
        }
    }
}

/// Handle terminal send endpoint (simpler alternative)
/// POST /api/v1/terminal/:session_id/send
pub async fn handle_terminal_send(
    Path(session_id): Path<String>,
    State(_state): State<Arc<AppState>>,
    Json(request): Json<TerminalMessageRequest>,
) -> impl IntoResponse {
    let content = request.content.unwrap_or_default();
    
    debug!(
        session_id = %session_id,
        content_len = content.len(),
        "Received terminal send request"
    );

    (
        StatusCode::OK,
        Json(TerminalMessageResponse {
            success: true,
            message: "Message received".to_string(),
            data: Some(serde_json::json!({
                "session_id": session_id,
                "bytes_received": content.len(),
            })),
        }),
    )
}
