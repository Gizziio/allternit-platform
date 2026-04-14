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
use tokio::time::Duration;
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
    use async_stream::stream;

    // Store the user message first
    let user_msg = crate::native_session_manager::SessionMessage {
        id: Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: req.message.clone(),
        timestamp: Utc::now(),
        metadata: None,
    };

    {
        let mut sessions = state.session_manager.write().await;
        if let Some(session) = sessions.get_session_mut_api(&session_id).await {
            session.messages.push(user_msg);
        } else {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
            ));
        }
    }

    // Generate response based on user input
    let response = generate_mock_response(&req.message);
    let message_id = Uuid::new_v4().to_string();
    let session_id_clone = session_id.clone();
    let state_clone = state.clone();

    let s = stream! {
        let timestamp = Utc::now().to_rfc3339();

        // Send message_start event
        yield Ok(StreamEvent::MessageStart {
            message_id: message_id.clone(),
            session_id: session_id_clone.clone(),
            timestamp: timestamp.clone(),
        }.to_sse_event());

        // Stream the response word by word
        let words: Vec<&str> = response.text.split_whitespace().collect();
        for (i, word) in words.iter().enumerate() {
            tokio::time::sleep(Duration::from_millis(50)).await;

            let content = if i == words.len() - 1 {
                word.to_string()
            } else {
                format!("{} ", word)
            };

            yield Ok(StreamEvent::MessageDelta {
                message_id: message_id.clone(),
                session_id: session_id_clone.clone(),
                delta: Delta {
                    content: Some(content),
                    reasoning: None,
                },
                timestamp: Utc::now().to_rfc3339(),
            }.to_sse_event());
        }

        // Send any tool calls (clone to avoid move)
        let tool_calls = response.tool_calls.clone();
        for tool_call in tool_calls {
            yield Ok(StreamEvent::ToolCall {
                session_id: session_id_clone.clone(),
                tool_call: tool_call.clone(),
                timestamp: Utc::now().to_rfc3339(),
            }.to_sse_event());

            tokio::time::sleep(Duration::from_millis(200)).await;

            // Send tool result
            yield Ok(StreamEvent::ToolResult {
                session_id: session_id_clone.clone(),
                tool_result: ToolResult {
                    tool_call_id: tool_call.id.clone(),
                    result: serde_json::json!({"status": "success", "data": "Tool executed successfully"}),
                    error: None,
                },
                timestamp: Utc::now().to_rfc3339(),
            }.to_sse_event());
        }

        // Send message_complete
        yield Ok(StreamEvent::MessageComplete {
            message_id: message_id.clone(),
            session_id: session_id_clone.clone(),
            timestamp: Utc::now().to_rfc3339(),
        }.to_sse_event());

        // Store the assistant message
        let assistant_msg = crate::native_session_manager::SessionMessage {
            id: message_id.clone(),
            role: "assistant".to_string(),
            content: response.text,
            timestamp: Utc::now(),
            metadata: Some({
                let mut meta = std::collections::HashMap::new();
                meta.insert("tool_calls".to_string(), serde_json::to_value(&response.tool_calls).unwrap_or_default());
                meta
            }),
        };

        {
            let mut sessions = state_clone.session_manager.write().await;
            if let Some(session) = sessions.get_session_mut_api(&session_id_clone).await {
                session.messages.push(assistant_msg);
            }
        }

        // Send done event
        yield Ok(StreamEvent::Done {
            session_id: session_id_clone,
            timestamp: Utc::now().to_rfc3339(),
        }.to_sse_event());
    };

    Ok(Sse::new(s))
}

/// Mock response structure
struct MockResponse {
    text: String,
    tool_calls: Vec<ToolCall>,
}

/// Generate a mock response based on user input
fn generate_mock_response(input: &str) -> MockResponse {
    let lower = input.to_lowercase();

    // Check for tool-related keywords
    if lower.contains("weather") {
        MockResponse {
            text: "I'll check the weather for you.".to_string(),
            tool_calls: vec![ToolCall {
                id: Uuid::new_v4().to_string(),
                name: "get_weather".to_string(),
                arguments: serde_json::json!({"location": "current"}),
            }],
        }
    } else if lower.contains("time") || lower.contains("date") {
        MockResponse {
            text: format!("The current time is {}.", Utc::now().format("%H:%M:%S")),
            tool_calls: vec![],
        }
    } else if lower.contains("code") || lower.contains("function") {
        MockResponse {
            text: "Here's a simple function for you:\n\n```rust\nfn hello() -> String {\n    \"Hello, World!\".to_string()\n}\n```".to_string(),
            tool_calls: vec![],
        }
    } else if lower.contains("canvas") || lower.contains("draw") {
        MockResponse {
            text: "I'll create a canvas for you with some visualization.".to_string(),
            tool_calls: vec![ToolCall {
                id: Uuid::new_v4().to_string(),
                name: "create_canvas".to_string(),
                arguments: serde_json::json!({"type": "visualization", "title": "Demo Canvas"}),
            }],
        }
    } else {
        MockResponse {
            text: format!(
                "Hello! I'm the N20 Native OpenClaw Agent. You said: \"{}\"\n\n\
                I can help you with:\n\
                - Answering questions\n\
                - Running tools\n\
                - Creating canvas visualizations\n\
                - Writing code\n\n\
                Try asking about the weather, time, or ask me to write some code!",
                input
            ),
            tool_calls: vec![],
        }
    }
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
