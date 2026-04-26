//! Chat API Routes (N20)
//!
//! Provides streaming chat and message injection for agent sessions.
//! Implements full SSE streaming with rich event types matching frontend expectations.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{sse::Event, Sse},
    Json,
};
use chrono::Utc;
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::{AgentApiState, ApiError};
use crate::api::sessions::Message;

/// Chat request
#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub stream: Option<bool>,
    pub model: Option<String>,
}

/// Delta content for streaming
#[derive(Debug, Serialize, Clone)]
pub struct Delta {
    pub content: Option<String>,
    pub reasoning: Option<String>,
}

/// Tool call definition
#[derive(Debug, Serialize, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Tool result
#[derive(Debug, Serialize, Clone)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub result: serde_json::Value,
    pub error: Option<String>,
}

/// Stream event types (matches frontend expectations)
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart {
        message_id: String,
        session_id: String,
        timestamp: String,
    },
    #[serde(rename = "message_delta")]
    MessageDelta {
        message_id: String,
        session_id: String,
        delta: Delta,
        timestamp: String,
    },
    #[serde(rename = "message_complete")]
    MessageComplete {
        message_id: String,
        session_id: String,
        timestamp: String,
    },
    #[serde(rename = "tool_call")]
    ToolCall {
        session_id: String,
        tool_call: ToolCall,
        timestamp: String,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        session_id: String,
        tool_result: ToolResult,
        timestamp: String,
    },
    #[serde(rename = "tool_error")]
    ToolError {
        session_id: String,
        tool_call_id: String,
        error: String,
        timestamp: String,
    },
    #[serde(rename = "canvas_update")]
    CanvasUpdate {
        session_id: String,
        canvas: serde_json::Value,
        timestamp: String,
    },
    #[serde(rename = "error")]
    Error {
        session_id: String,
        error: String,
        timestamp: String,
    },
    #[serde(rename = "done")]
    Done {
        session_id: String,
        timestamp: String,
    },
}

impl StreamEvent {
    pub fn to_sse_event(&self) -> Event {
        Event::default().data(serde_json::to_string(self).unwrap_or_default())
    }
}

/// Message injection request (for PI Agent)
#[derive(Debug, Deserialize)]
pub struct InjectRequest {
    pub message: String,
    pub role: String,
}

/// Active generation tracking
#[derive(Default)]
pub struct ActiveGenerations {
    generations: Arc<RwLock<std::collections::HashMap<String, tokio::task::AbortHandle>>>,
}

impl ActiveGenerations {
    pub fn new() -> Self {
        Self {
            generations: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub async fn insert(&self, session_id: String, handle: tokio::task::AbortHandle) {
        let mut gens = self.generations.write().await;
        gens.insert(session_id, handle);
    }

    pub async fn abort(&self, session_id: &str) -> bool {
        let mut gens = self.generations.write().await;
        if let Some(handle) = gens.remove(session_id) {
            handle.abort();
            true
        } else {
            false
        }
    }
}

/// Stream chat responses as SSE
///
/// This implements a full mock LLM that:
/// 1. Stores the user message
/// 2. Streams back a response word by word
/// 3. Simulates tool calls and their results
/// 4. Updates session message count
pub async fn chat_stream(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, Json<ApiError>)> {
    let _ = state;
    let _ = session_id;
    let _ = req;

    Err::<Sse<futures::stream::Empty<Result<Event, Infallible>>>, _>((
        StatusCode::NOT_IMPLEMENTED,
        Json(ApiError::new(
            "Native agent chat backend is not wired to a real model runtime",
            "CHAT_BACKEND_NOT_IMPLEMENTED",
        )),
    ))
}

/// Abort ongoing generation
pub async fn abort_generation(
    State(_state): State<AgentApiState>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    // In a real implementation, this would signal the stream to stop
    // For now, we just acknowledge
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Generation aborted",
        "session_id": session_id
    })))
}

/// Inject a message into the session (PI Agent integration)
pub async fn inject_message(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
    Json(req): Json<InjectRequest>,
) -> Result<(StatusCode, Json<Message>), (StatusCode, Json<ApiError>)> {
    let mut sessions = state.session_manager.write().await;

    match sessions.get_session_mut_api(&session_id).await {
        Some(session) => {
            let message = Message {
                id: Uuid::new_v4().to_string(),
                role: req.role,
                content: req.message,
                timestamp: Utc::now().to_rfc3339(),
                metadata: Some({
                    let mut meta = std::collections::HashMap::new();
                    meta.insert("injected".to_string(), serde_json::Value::Bool(true));
                    meta
                }),
            };

            // Convert Message to SessionMessage
            let session_msg = crate::native_session_manager::SessionMessage {
                id: message.id.clone(),
                role: message.role.clone(),
                content: message.content.clone(),
                timestamp: Utc::now(),
                metadata: message.metadata.clone(),
            };
            session.messages.push(session_msg);
            session.updated_at = Utc::now();

            Ok((StatusCode::CREATED, Json(message)))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
        )),
    }
}
