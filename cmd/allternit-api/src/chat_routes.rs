//! Chat API routes for AI interactions
//!
//! Proxies chat requests to the Gizzi terminal server or underlying AI drivers.

use axum::{
    body::Body,
    extract::{Json, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response, sse::{Event, KeepAlive, Sse}},
    routing::post,
    Router,
};
use serde::Deserialize;
use std::{convert::Infallible, path::PathBuf, sync::Arc};
use tokio::process::Command;
use tracing::{error, info};
use uuid::Uuid;

use crate::{AppState, default_model};

/// Chat request from frontend
#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    #[serde(rename = "chatId")]
    pub chat_id: String,
    pub message: String,
    #[serde(rename = "runtimeModelId")]
    pub model_id: Option<String>,
    #[serde(flatten)]
    pub context: serde_json::Value,
}

/// Create chat router
pub fn chat_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agent-chat", post(handle_agent_chat))
        .route("/chat/action", post(handle_chat_action))
}

/// Handle agent chat request by proxying to Gizzi terminal server
async fn handle_agent_chat(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> Response {
    info!(chat_id = %request.chat_id, "Received chat request, running subprocess agent");

    let assistant_message_id = format!("msg_{}", Uuid::new_v4().simple());
    let (_default_provider, default_model_id) = default_model();
    let raw_model_id = request
        .model_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(&default_model_id);
    // Strip provider prefix (e.g. "claude-cli/claude-sonnet-4-6" → "claude-sonnet-4-6")
    let model_id = raw_model_id
        .rsplit_once('/')
        .map(|(_, model)| model)
        .unwrap_or(raw_model_id)
        .to_string();

    match run_claude_print(&request.message, &model_id, &state.config).await {
        Ok(output) => stream_subprocess_reply(assistant_message_id, model_id, output).into_response(),
        Err(err) => {
            error!(error = %err, "Claude subprocess failed");
            stream_subprocess_error(assistant_message_id, model_id, err).into_response()
        }
    }
}

fn workspace_root(app_config: &crate::config::AppConfig) -> PathBuf {
    if let Some(explicit) = app_config.agent_workdir() {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return path;
        }
    }

    if let Ok(current) = std::env::current_dir() {
        if let Some(root) = current.parent().and_then(|parent| parent.parent()) {
            return root.to_path_buf();
        }
        return current;
    }

    PathBuf::from(".")
}

async fn run_claude_print(prompt: &str, model_id: &str, app_config: &crate::config::AppConfig) -> Result<String, String> {
    let output = Command::new("claude")
        .arg("-p")
        .arg(prompt)
        .arg("--model")
        .arg(model_id)
        .current_dir(workspace_root(app_config))
        .output()
        .await
        .map_err(|error| format!("failed to spawn claude subprocess: {}", error))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if detail.is_empty() {
            format!("claude subprocess exited with status {}", output.status)
        } else {
            detail
        });
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Err("claude subprocess returned no output".to_string());
    }

    Ok(text)
}

fn stream_subprocess_reply(
    message_id: String,
    model_id: String,
    output: String,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        yield Ok(Event::default().data(serde_json::json!({
            "type": "message_start",
            "messageId": message_id,
            "modelId": model_id,
            "runtimeModelId": model_id,
        }).to_string()));

        yield Ok(Event::default().data(serde_json::json!({
            "type": "content_block_delta",
            "messageId": message_id,
            "partId": "text-1",
            "delta": {
                "type": "text_delta",
                "text": output,
            }
        }).to_string()));

        yield Ok(Event::default().data(serde_json::json!({
            "type": "finish",
            "messageId": message_id,
            "status": "complete",
            "metadata": {
                "status": "complete",
            }
        }).to_string()));
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}

fn stream_subprocess_error(
    message_id: String,
    model_id: String,
    error_text: String,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        yield Ok(Event::default().data(serde_json::json!({
            "type": "message_start",
            "messageId": message_id,
            "modelId": model_id,
            "runtimeModelId": model_id,
        }).to_string()));

        yield Ok(Event::default().data(serde_json::json!({
            "type": "error",
            "messageId": message_id,
            "error": error_text,
        }).to_string()));

        yield Ok(Event::default().data(serde_json::json!({
            "type": "finish",
            "messageId": message_id,
            "status": "error",
            "metadata": {
                "status": "error",
            }
        }).to_string()));
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}


/// Handle chat action requests (e.g. regenerate, stop, etc.)
async fn handle_chat_action(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Response {
    info!("Received chat action: {:?}", body);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(r#"{"status":"ok"}"#))
        .unwrap()
}
