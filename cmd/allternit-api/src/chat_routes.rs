//! Chat API routes for AI interactions
//!
//! Proxies chat requests to the Gizzi terminal server or underlying AI drivers.

use axum::{
    body::Body,
    extract::{Json, State},
    http::{header, StatusCode},
    response::Response,
    routing::post,
    Router,
};
use futures::StreamExt;
use serde::Deserialize;
use std::sync::Arc;
use tracing::{error, info};

use crate::AppState;

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
}

/// Handle agent chat request by proxying to Gizzi terminal server
async fn handle_agent_chat(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> Response {
    info!(chat_id = %request.chat_id, "Received chat request, proxying to Gizzi");

    // Gizzi terminal server is running on port 4096
    let gizzi_port = std::env::var("GIZZI_PORT").unwrap_or_else(|_| "4096".to_string());
    
    // Resolve gizzi session ID:
    // If it starts with 'ses_', it's already a gizzi ID.
    // Otherwise, we'll try to use it directly as the session identifier.
    let gizzi_session_id = request.chat_id.clone();
    
    let message_url = format!("http://127.0.0.1:{}/v1/session/{}/message", gizzi_port, urlencoding::encode(&gizzi_session_id));
    let event_url = format!("http://127.0.0.1:{}/v1/event", gizzi_port);

    let client = reqwest::Client::new();

    // 1. Open the gizzi bus event stream to catch real-time updates
    let event_stream_res = client
        .get(&event_url)
        .header("Accept", "text/event-stream")
        .send()
        .await;

    // 2. Fire the message POST
    let gizzi_request_body = serde_json::json!({
        "sessionID": gizzi_session_id,
        "parts": [{ "type": "text", "text": request.message }],
        "model": { 
            "providerID": "claude-cli", 
            "modelID": "claude-sonnet-4-6" 
        },
    });

    let post_handle = tokio::spawn({
        let client = client.clone();
        let message_url = message_url.clone();
        async move {
            client.post(&message_url)
                .json(&gizzi_request_body)
                .send()
                .await
        }
    });

    match event_stream_res {
        Ok(res) if res.status().is_success() => {
            // We have a live event stream from the bus.
            // Wrap the body stream and forward it.
            let stream = res.bytes_stream().map(|result| {
                result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
            });

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/event-stream")
                .header(header::CACHE_CONTROL, "no-cache")
                .header(header::CONNECTION, "keep-alive")
                .header("X-Agent-Backend", "gizzi-kernel-proxy")
                .body(Body::from_stream(stream))
                .unwrap()
        }
        _ => {
            // Fallback: if event stream fails, wait for the POST and return its body
            match post_handle.await {
                Ok(Ok(res)) => {
                    let stream = res.bytes_stream().map(|result| {
                        result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
                    });
                    
                    Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, "text/event-stream")
                        .header(header::CACHE_CONTROL, "no-cache")
                        .header("X-Agent-Backend", "gizzi-kernel-post-fallback")
                        .body(Body::from_stream(stream))
                        .unwrap()
                }
                _ => {
                    error!("Failed to connect to Gizzi AI runtime");
                    Response::builder()
                        .status(StatusCode::SERVICE_UNAVAILABLE)
                        .body(Body::from("Gizzi AI runtime unavailable"))
                        .unwrap()
                }
            }
        }
    }
}
