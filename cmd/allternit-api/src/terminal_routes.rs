//! Terminal API routes for handling terminal messages from IDE extensions
//!
//! Handles requests from the Kimi For Coding extension and other IDE plugins

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, warn};

use crate::AppState;

/// Terminal message request from IDE extension
#[derive(Debug, Deserialize)]
pub struct TerminalMessageRequest {
    /// Message type (e.g., "input", "resize", "close")
    pub message_type: String,
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

/// Terminal input message request (backward compatibility)
#[derive(Debug, Deserialize)]
pub struct TerminalInputRequest {
    /// The input content - made optional with default
    #[serde(default)]
    pub content: Option<String>,
    /// Session identifier
    #[serde(default)]
    pub session_id: Option<String>,
}

/// Create terminal router
pub fn terminal_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/message", post(handle_terminal_message))
        .route("/input", post(handle_terminal_input))
}

/// Handle terminal message from IDE extension
async fn handle_terminal_message(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<TerminalMessageRequest>,
) -> impl IntoResponse {
    debug!(
        message_type = %request.message_type,
        has_content = request.content.is_some(),
        "Received terminal message"
    );

    // Handle the message based on type
    match request.message_type.as_str() {
        "input" => {
            let content = request.content.unwrap_or_default();
            debug!(content_len = content.len(), "Processing terminal input");
            // TODO: Forward to actual terminal/session handler
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: "Input received".to_string(),
                    data: Some(serde_json::json!({
                        "bytes_received": content.len(),
                    })),
                }),
            )
        }
        "resize" => {
            debug!("Processing terminal resize");
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: "Resize acknowledged".to_string(),
                    data: None,
                }),
            )
        }
        "close" => {
            debug!("Processing terminal close");
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: "Close acknowledged".to_string(),
                    data: None,
                }),
            )
        }
        unknown => {
            warn!(message_type = %unknown, "Unknown terminal message type");
            (
                StatusCode::OK,
                Json(TerminalMessageResponse {
                    success: true,
                    message: format!("Unknown message type '{}' accepted", unknown),
                    data: None,
                }),
            )
        }
    }
}

/// Handle terminal input (backward compatibility endpoint)
async fn handle_terminal_input(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<TerminalInputRequest>,
) -> impl IntoResponse {
    let content = request.content.unwrap_or_default();
    
    debug!(
        content_len = content.len(),
        session_id = ?request.session_id,
        "Received terminal input"
    );

    // TODO: Forward to actual terminal/session handler
    (
        StatusCode::OK,
        Json(TerminalMessageResponse {
            success: true,
            message: "Input received".to_string(),
            data: Some(serde_json::json!({
                "bytes_received": content.len(),
                "session_id": request.session_id,
            })),
        }),
    )
}
