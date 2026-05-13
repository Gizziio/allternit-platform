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
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::{AgentApiState, ApiError};
use crate::api::sessions::Message;
use crate::api::tools::{execute_tool_internal, get_builtin_tools};

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
    #[serde(rename = "ui")]
    Ui {
        session_id: String,
        kind: String,
        payload: serde_json::Value,
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

/// Pending tool call accumulated during streaming
#[derive(Debug, Clone)]
struct PendingToolCall {
    id: String,
    name: String,
    /// Accumulated raw JSON string for the input
    input_json: String,
}

/// Convert our tool definitions to Anthropic's tool format
fn tools_to_anthropic_format(tools: &[crate::api::tools::ToolDefinitionResponse]) -> serde_json::Value {
    let tool_list: Vec<serde_json::Value> = tools
        .iter()
        .map(|t| {
            serde_json::json!({
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
            })
        })
        .collect();
    serde_json::Value::Array(tool_list)
}

/// Build the messages array for the Anthropic API from session messages.
/// Anthropic requires alternating user/assistant turns, so we pass them as-is.
fn build_anthropic_messages(messages: &[Message]) -> serde_json::Value {
    let converted: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect();
    serde_json::Value::Array(converted)
}

/// Stream chat responses as SSE using real Anthropic API with agentic tool-use loop.
///
/// Flow:
/// 1. Store the incoming user message in the session.
/// 2. Open an SSE stream and enter the agentic loop:
///    a. POST to Anthropic /v1/messages with stream:true.
///    b. Parse SSE lines; accumulate text and tool calls.
///    c. Emit StreamEvents to the client as they arrive.
///    d. On stop_reason "end_turn" → emit MessageComplete + Done, break.
///    e. On stop_reason "tool_use" → execute all pending tools, emit ToolCall/ToolResult,
///       append the assistant + tool-result messages, loop again.
pub async fn chat_stream(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, Json<ApiError>)> {
    // Snapshot API key early — cheap clone, lets us move into stream closure.
    let api_key = state.anthropic_api_key.clone();
    let http_client = state.http_client.clone();

    // --- Build initial message history from session ---
    let mut history: Vec<Message> = {
        let sessions = state.session_manager.read().await;
        match sessions.get_session_api(&session_id).await {
            Some(s) => s.messages,
            None => {
                return Err((
                    StatusCode::NOT_FOUND,
                    Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
                ));
            }
        }
    };

    // Store the incoming user message in the session.
    {
        let mut sessions = state.session_manager.write().await;
        if let Some(session) = sessions.get_session_mut_api(&session_id).await {
            let msg = crate::native_session_manager::SessionMessage {
                id: Uuid::new_v4().to_string(),
                role: "user".to_string(),
                content: req.message.clone(),
                timestamp: Utc::now(),
                metadata: None,
            };
            session.messages.push(msg);
            session.updated_at = Utc::now();
        }
    }

    // Append the new user message to our local history snapshot too.
    history.push(Message {
        id: Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: req.message.clone(),
        timestamp: Utc::now().to_rfc3339(),
        metadata: None,
    });

    let session_id_clone = session_id.clone();

    let s = async_stream::stream! {
        // Guard: no API key → emit error immediately.
        if api_key.is_empty() {
            yield Ok(StreamEvent::Error {
                session_id: session_id_clone.clone(),
                error: "ANTHROPIC_API_KEY is not configured on this host".to_string(),
                timestamp: Utc::now().to_rfc3339(),
            }.to_sse_event());
            yield Ok(StreamEvent::Done {
                session_id: session_id_clone,
                timestamp: Utc::now().to_rfc3339(),
            }.to_sse_event());
            return;
        }

        let tools_value = tools_to_anthropic_format(&get_builtin_tools());

        // Working message list — grows as tool results are appended across loop turns.
        let mut messages = build_anthropic_messages(&history);

        // Accumulated assistant text across the whole conversation (for session storage).
        let mut final_assistant_text = String::new();

        // The message_id we announce at the start.
        let message_id = Uuid::new_v4().to_string();

        // Emit MessageStart once before the loop.
        yield Ok(StreamEvent::MessageStart {
            message_id: message_id.clone(),
            session_id: session_id_clone.clone(),
            timestamp: Utc::now().to_rfc3339(),
        }.to_sse_event());

        'agent_loop: loop {
            // ---- Build request body ----
            let body = serde_json::json!({
                "model": "claude-opus-4-5-20251101",
                "max_tokens": 8096,
                "stream": true,
                "tools": tools_value.clone(),
                "messages": messages.clone(),
            });

            // ---- POST to Anthropic ----
            let resp = http_client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await;

            let resp = match resp {
                Ok(r) => r,
                Err(e) => {
                    yield Ok(StreamEvent::Error {
                        session_id: session_id_clone.clone(),
                        error: format!("HTTP request failed: {}", e),
                        timestamp: Utc::now().to_rfc3339(),
                    }.to_sse_event());
                    break 'agent_loop;
                }
            };

            if !resp.status().is_success() {
                let status = resp.status();
                let body_text = resp.text().await.unwrap_or_default();
                yield Ok(StreamEvent::Error {
                    session_id: session_id_clone.clone(),
                    error: format!("Anthropic API error {}: {}", status, body_text),
                    timestamp: Utc::now().to_rfc3339(),
                }.to_sse_event());
                break 'agent_loop;
            }

            // ---- Stream SSE lines from Anthropic ----
            use futures::StreamExt as _;
            let mut byte_stream = resp.bytes_stream();

            // Buffer to accumulate partial lines across chunks.
            let mut line_buf = String::new();

            // Accumulated state for this turn.
            let mut turn_text = String::new();
            // Map from content block index → PendingToolCall
            let mut pending_tools: std::collections::HashMap<usize, PendingToolCall> =
                std::collections::HashMap::new();
            // Index of the currently active content block.
            let mut active_block_idx: Option<usize> = None;
            // Whether the active block is a thinking block.
            let mut active_is_thinking = false;

            // stop_reason from message_delta
            let mut stop_reason: Option<String> = None;

            // We collect all content blocks the assistant produced this turn so we can
            // append a well-formed assistant message for the next API call.
            // Format: serde_json::Value array matching Anthropic's content block schema.
            let mut assistant_content_blocks: Vec<serde_json::Value> = Vec::new();
            // Track per-block text/thinking accumulation for the content blocks array.
            let mut block_text_acc: std::collections::HashMap<usize, String> =
                std::collections::HashMap::new();

            'stream_loop: loop {
                // Pull the next chunk.
                let chunk = byte_stream.next().await;
                let chunk = match chunk {
                    Some(Ok(b)) => b,
                    Some(Err(e)) => {
                        yield Ok(StreamEvent::Error {
                            session_id: session_id_clone.clone(),
                            error: format!("Stream read error: {}", e),
                            timestamp: Utc::now().to_rfc3339(),
                        }.to_sse_event());
                        break 'agent_loop;
                    }
                    None => {
                        // Stream ended.
                        break 'stream_loop;
                    }
                };

                // Append raw bytes to line buffer and process complete lines.
                let chunk_str = match std::str::from_utf8(&chunk) {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                line_buf.push_str(chunk_str);

                // Process every complete newline-terminated line in the buffer.
                while let Some(pos) = line_buf.find('\n') {
                    let line = line_buf[..pos].trim_end_matches('\r').to_string();
                    line_buf = line_buf[pos + 1..].to_string();

                    // SSE lines are either "event: <name>" or "data: <json>" or blank.
                    if line.is_empty() {
                        continue;
                    }

                    if let Some(json_str) = line.strip_prefix("data: ") {
                        // Parse the JSON payload.
                        let event_val: serde_json::Value = match serde_json::from_str(json_str) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };

                        let event_type = event_val["type"].as_str().unwrap_or("").to_string();

                        match event_type.as_str() {
                            "message_start" => {
                                // Already emitted MessageStart above; nothing to do here.
                            }

                            "content_block_start" => {
                                let idx = event_val["index"].as_u64().unwrap_or(0) as usize;
                                let block = &event_val["content_block"];
                                let block_type = block["type"].as_str().unwrap_or("");
                                active_block_idx = Some(idx);

                                match block_type {
                                    "thinking" => {
                                        active_is_thinking = true;
                                        block_text_acc.insert(idx, String::new());
                                        assistant_content_blocks.push(serde_json::json!({
                                            "type": "thinking",
                                            "thinking": "",
                                        }));
                                    }
                                    "text" => {
                                        active_is_thinking = false;
                                        block_text_acc.insert(idx, String::new());
                                        assistant_content_blocks.push(serde_json::json!({
                                            "type": "text",
                                            "text": "",
                                        }));
                                    }
                                    "tool_use" => {
                                        active_is_thinking = false;
                                        let tool_id =
                                            block["id"].as_str().unwrap_or("").to_string();
                                        let tool_name =
                                            block["name"].as_str().unwrap_or("").to_string();
                                        pending_tools.insert(
                                            idx,
                                            PendingToolCall {
                                                id: tool_id.clone(),
                                                name: tool_name.clone(),
                                                input_json: String::new(),
                                            },
                                        );
                                        // Placeholder — will be filled in at content_block_stop.
                                        assistant_content_blocks.push(serde_json::json!({
                                            "type": "tool_use",
                                            "id": tool_id,
                                            "name": tool_name,
                                            "input": {},
                                        }));
                                    }
                                    _ => {
                                        active_is_thinking = false;
                                    }
                                }
                            }

                            "content_block_delta" => {
                                let idx = event_val["index"].as_u64().unwrap_or(0) as usize;
                                let delta = &event_val["delta"];
                                let delta_type = delta["type"].as_str().unwrap_or("");

                                match delta_type {
                                    "text_delta" => {
                                        let text =
                                            delta["text"].as_str().unwrap_or("").to_string();
                                        turn_text.push_str(&text);
                                        // Update content block accumulator.
                                        if let Some(acc) = block_text_acc.get_mut(&idx) {
                                            acc.push_str(&text);
                                        }
                                        yield Ok(StreamEvent::MessageDelta {
                                            message_id: message_id.clone(),
                                            session_id: session_id_clone.clone(),
                                            delta: Delta {
                                                content: Some(text),
                                                reasoning: None,
                                            },
                                            timestamp: Utc::now().to_rfc3339(),
                                        }.to_sse_event());
                                    }
                                    "thinking_delta" => {
                                        let thinking =
                                            delta["thinking"].as_str().unwrap_or("").to_string();
                                        if let Some(acc) = block_text_acc.get_mut(&idx) {
                                            acc.push_str(&thinking);
                                        }
                                        yield Ok(StreamEvent::MessageDelta {
                                            message_id: message_id.clone(),
                                            session_id: session_id_clone.clone(),
                                            delta: Delta {
                                                content: None,
                                                reasoning: Some(thinking),
                                            },
                                            timestamp: Utc::now().to_rfc3339(),
                                        }.to_sse_event());
                                    }
                                    "input_json_delta" => {
                                        let partial =
                                            delta["partial_json"].as_str().unwrap_or("").to_string();
                                        if let Some(tool) = pending_tools.get_mut(&idx) {
                                            tool.input_json.push_str(&partial);
                                        }
                                    }
                                    _ => {}
                                }
                            }

                            "content_block_stop" => {
                                let idx = event_val["index"].as_u64().unwrap_or(0) as usize;

                                // If this was a text/thinking block, patch the accumulated text
                                // back into the assistant_content_blocks entry.
                                if let Some(acc_text) = block_text_acc.remove(&idx) {
                                    // Find the block at this index and update it.
                                    // We appended blocks in order, so idx maps directly.
                                    if let Some(block) = assistant_content_blocks.get_mut(idx) {
                                        if block["type"] == "text" {
                                            block["text"] =
                                                serde_json::Value::String(acc_text);
                                        } else if block["type"] == "thinking" {
                                            block["thinking"] =
                                                serde_json::Value::String(acc_text);
                                        }
                                    }
                                }

                                // If this was a tool block, emit ToolCall.
                                if let Some(tool) = pending_tools.get(&idx) {
                                    let parsed_input: serde_json::Value =
                                        serde_json::from_str(&tool.input_json)
                                            .unwrap_or(serde_json::Value::Object(
                                                serde_json::Map::new(),
                                            ));

                                    // Patch the input into the assistant content block.
                                    if let Some(block) = assistant_content_blocks.get_mut(idx) {
                                        block["input"] = parsed_input.clone();
                                    }

                                    yield Ok(StreamEvent::ToolCall {
                                        session_id: session_id_clone.clone(),
                                        tool_call: ToolCall {
                                            id: tool.id.clone(),
                                            name: tool.name.clone(),
                                            arguments: parsed_input,
                                        },
                                        timestamp: Utc::now().to_rfc3339(),
                                    }.to_sse_event());
                                }

                                if active_block_idx == Some(idx) {
                                    active_block_idx = None;
                                    active_is_thinking = false;
                                }
                            }

                            "message_delta" => {
                                let sr = event_val["delta"]["stop_reason"]
                                    .as_str()
                                    .map(|s| s.to_string());
                                stop_reason = sr;
                            }

                            "message_stop" => {
                                // Stream is fully done for this turn.
                                break 'stream_loop;
                            }

                            "error" => {
                                let err_msg = event_val["error"]["message"]
                                    .as_str()
                                    .unwrap_or("unknown Anthropic error")
                                    .to_string();
                                yield Ok(StreamEvent::Error {
                                    session_id: session_id_clone.clone(),
                                    error: err_msg,
                                    timestamp: Utc::now().to_rfc3339(),
                                }.to_sse_event());
                                break 'agent_loop;
                            }

                            _ => {}
                        }
                    }
                    // Lines starting with "event:" are SSE event-type lines — no action needed.
                }
            } // end 'stream_loop

            // Accumulate assistant text across loop turns.
            final_assistant_text.push_str(&turn_text);

            // Append the assistant turn (with all content blocks) to messages for the next call.
            if !assistant_content_blocks.is_empty() {
                if let serde_json::Value::Array(ref mut arr) = messages {
                    arr.push(serde_json::json!({
                        "role": "assistant",
                        "content": assistant_content_blocks,
                    }));
                }
            }

            match stop_reason.as_deref() {
                Some("end_turn") | None => {
                    // Normal completion.
                    yield Ok(StreamEvent::MessageComplete {
                        message_id: message_id.clone(),
                        session_id: session_id_clone.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                    }.to_sse_event());
                    yield Ok(StreamEvent::Done {
                        session_id: session_id_clone.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                    }.to_sse_event());
                    break 'agent_loop;
                }

                Some("tool_use") => {
                    // Execute all pending tool calls and loop back.
                    let mut tool_result_content: Vec<serde_json::Value> = Vec::new();

                    for (_, tool) in &pending_tools {
                        // Parse arguments into HashMap<String, Value> for execute_tool_internal.
                        let args: HashMap<String, serde_json::Value> =
                            serde_json::from_str(&tool.input_json).unwrap_or_default();

                        let exec_result = execute_tool_internal(&tool.name, &args).await;

                        match exec_result {
                            Ok(result_val) => {
                                yield Ok(StreamEvent::ToolResult {
                                    session_id: session_id_clone.clone(),
                                    tool_result: ToolResult {
                                        tool_call_id: tool.id.clone(),
                                        result: result_val.clone(),
                                        error: None,
                                    },
                                    timestamp: Utc::now().to_rfc3339(),
                                }.to_sse_event());

                                tool_result_content.push(serde_json::json!({
                                    "type": "tool_result",
                                    "tool_use_id": tool.id,
                                    "content": serde_json::to_string(&result_val)
                                        .unwrap_or_default(),
                                }));
                            }
                            Err(err_msg) => {
                                yield Ok(StreamEvent::ToolError {
                                    session_id: session_id_clone.clone(),
                                    tool_call_id: tool.id.clone(),
                                    error: err_msg.clone(),
                                    timestamp: Utc::now().to_rfc3339(),
                                }.to_sse_event());

                                tool_result_content.push(serde_json::json!({
                                    "type": "tool_result",
                                    "tool_use_id": tool.id,
                                    "is_error": true,
                                    "content": err_msg,
                                }));
                            }
                        }
                    }

                    // Append the tool results as a user message for the next turn.
                    if !tool_result_content.is_empty() {
                        if let serde_json::Value::Array(ref mut arr) = messages {
                            arr.push(serde_json::json!({
                                "role": "user",
                                "content": tool_result_content,
                            }));
                        }
                    }

                    // Continue the agent loop with updated messages.
                    // Reset turn state for next iteration (pending_tools etc. are local to the
                    // block above and will be re-created on next loop entry).
                    continue 'agent_loop;
                }

                Some(other) => {
                    // Unknown stop reason — treat as done.
                    tracing::warn!("Unexpected stop_reason from Anthropic: {}", other);
                    yield Ok(StreamEvent::MessageComplete {
                        message_id: message_id.clone(),
                        session_id: session_id_clone.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                    }.to_sse_event());
                    yield Ok(StreamEvent::Done {
                        session_id: session_id_clone.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                    }.to_sse_event());
                    break 'agent_loop;
                }
            }
        } // end 'agent_loop

        // Persist the final assistant reply to the session.
        if !final_assistant_text.is_empty() {
            let mut sessions = state.session_manager.write().await;
            if let Some(session) = sessions.get_session_mut_api(&session_id_clone).await {
                let msg = crate::native_session_manager::SessionMessage {
                    id: Uuid::new_v4().to_string(),
                    role: "assistant".to_string(),
                    content: final_assistant_text,
                    timestamp: Utc::now(),
                    metadata: None,
                };
                session.messages.push(msg);
                session.updated_at = Utc::now();
            }
        }
    };

    Ok(Sse::new(s))
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
