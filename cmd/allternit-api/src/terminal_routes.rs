//! Terminal API routes — forwards IDE extension input to Gizzi session message API.

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, warn};

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct TerminalMessageRequest {
    pub message_type: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct TerminalMessageResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct TerminalInputRequest {
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
}

pub fn terminal_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/message", post(handle_terminal_message))
        .route("/input", post(handle_terminal_input))
        .route("/create", post(create_terminal))
        .route("/close", post(close_terminal))
        .route("/resize", post(resize_terminal))
}

fn gizzi_base_url() -> String {
    let port = std::env::var("GIZZI_PORT").unwrap_or_else(|_| "4096".to_string());
    format!("http://127.0.0.1:{}", port)
}

async fn forward_to_gizzi(
    session_id: &str,
    part_type: &str,
    content: Option<&str>,
    extra: Option<serde_json::Value>,
) -> Result<(), String> {
    let url = format!(
        "{}/v1/session/{}/message",
        gizzi_base_url(),
        urlencoding::encode(session_id)
    );

    let mut part = serde_json::json!({ "type": part_type });
    if let Some(text) = content {
        part["text"] = serde_json::Value::String(text.to_string());
    }
    if let Some(ext) = extra {
        if let (Some(obj), Some(ext_obj)) = (part.as_object_mut(), ext.as_object()) {
            for (k, v) in ext_obj {
                obj.insert(k.clone(), v.clone());
            }
        }
    }

    let body = serde_json::json!({
        "sessionID": session_id,
        "parts": [part],
    });

    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Gizzi unreachable: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Gizzi returned {}", res.status()));
    }
    Ok(())
}

async fn handle_terminal_message(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<TerminalMessageRequest>,
) -> impl IntoResponse {
    let session_id = match &request.session_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => {
            warn!("Terminal message missing session_id");
            return (
                StatusCode::BAD_REQUEST,
                Json(TerminalMessageResponse {
                    success: false,
                    message: "session_id is required".to_string(),
                    data: None,
                }),
            );
        }
    };

    debug!(
        message_type = %request.message_type,
        session_id = %session_id,
        "Forwarding terminal message to Gizzi"
    );

    let (part_type, extra) = match request.message_type.as_str() {
        "input" => ("terminal_input", None),
        "resize" => {
            let dims = request.metadata.clone().unwrap_or(serde_json::json!({}));
            ("terminal_resize", Some(dims))
        }
        "close" => ("terminal_close", None),
        unknown => {
            warn!(message_type = %unknown, "Unknown terminal message type");
            ("terminal_unknown", None)
        }
    };

    match forward_to_gizzi(&session_id, part_type, request.content.as_deref(), extra).await {
        Ok(()) => (
            StatusCode::OK,
            Json(TerminalMessageResponse {
                success: true,
                message: format!("{} forwarded to session {}", request.message_type, session_id),
                data: None,
            }),
        ),
        Err(e) => {
            error!(error = %e, session_id = %session_id, "Failed to forward to Gizzi");
            (
                StatusCode::BAD_GATEWAY,
                Json(TerminalMessageResponse {
                    success: false,
                    message: e,
                    data: None,
                }),
            )
        }
    }
}

async fn handle_terminal_input(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<TerminalInputRequest>,
) -> impl IntoResponse {
    let session_id = match &request.session_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => {
            warn!("Terminal input missing session_id");
            return (
                StatusCode::BAD_REQUEST,
                Json(TerminalMessageResponse {
                    success: false,
                    message: "session_id is required".to_string(),
                    data: None,
                }),
            );
        }
    };

    let content = request.content.as_deref();
    debug!(
        content_len = content.map(|c| c.len()).unwrap_or(0),
        session_id = %session_id,
        "Forwarding terminal input to Gizzi"
    );

    match forward_to_gizzi(&session_id, "terminal_input", content, None).await {
        Ok(()) => (
            StatusCode::OK,
            Json(TerminalMessageResponse {
                success: true,
                message: format!("Input forwarded to session {}", session_id),
                data: None,
            }),
        ),
        Err(e) => {
            error!(error = %e, session_id = %session_id, "Failed to forward terminal input to Gizzi");
            (
                StatusCode::BAD_GATEWAY,
                Json(TerminalMessageResponse {
                    success: false,
                    message: e,
                    data: None,
                }),
            )
        }
    }
}


// ─── Terminal lifecycle stubs ────────────────────────────────────────────────

async fn create_terminal(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(TerminalMessageResponse {
        success: true,
        message: "Terminal created (stub)".to_string(),
        data: Some(serde_json::json!({ "session_id": "stub-session" })),
    })
}

async fn close_terminal(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(TerminalMessageResponse {
        success: true,
        message: "Terminal closed (stub)".to_string(),
        data: None,
    })
}

async fn resize_terminal(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(TerminalMessageResponse {
        success: true,
        message: "Terminal resized (stub)".to_string(),
        data: None,
    })
}
