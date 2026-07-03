//! Real Gizzi-backed chat streaming for `/api/agent-chat`.
//!
//! Replaces the previous `claude -p` subprocess placeholder. This module takes
//! the frontend's platform session id (which is already a Gizzi session id),
//! forwards the user message to the Gizzi runtime, subscribes to the Gizzi
//! event bus, and translates Gizzi events into the SSE format the frontend
//! expects.

use axum::{
    response::{IntoResponse, Response, sse::{Event, KeepAlive, Sse}},
};
use futures::StreamExt;
use reqwest::Client;
use serde_json::json;
use std::{convert::Infallible, time::Duration};
use tracing::{info, warn};

/// Parse a frontend model reference into a Gizzi `{ providerID, modelID }`
/// object. Accepts `provider/model`, `provider::model`, or a bare model id.
fn parse_model_ref(raw: Option<&str>) -> serde_json::Value {
    let raw = raw.unwrap_or_default().trim();
    if raw.is_empty() {
        let (provider, model) = crate::default_model();
        return json!({ "providerID": provider, "modelID": model });
    }

    let normalized = raw.replace("::", "/");
    if let Some((provider, model)) = normalized.rsplit_once('/') {
        return json!({ "providerID": provider, "modelID": model });
    }

    // Bare model id — try to inherit the default provider.
    let (provider, _) = crate::default_model();
    json!({ "providerID": provider, "modelID": normalized })
}

/// Translate a Gizzi event-bus stream into frontend SSE events.
fn chat_event_stream(
    gizzi_events: reqwest::Response,
    session_id: String,
    message_id: String,
    model_id: String,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        let mut was_busy = false;
        let mut started = false;
        let mut buf = String::new();
        let mut byte_stream = gizzi_events.bytes_stream();
        let deadline = tokio::time::Instant::now() + Duration::from_secs(180);

        loop {
            if tokio::time::Instant::now() > deadline {
                warn!(session_id = %session_id, "Gizzi chat stream timed out");
                yield Ok(Event::default().data(json!({
                    "type": "error",
                    "messageId": message_id,
                    "error": "Response timed out"
                }).to_string()));
                break;
            }

            match tokio::time::timeout(Duration::from_secs(5), byte_stream.next()).await {
                Ok(Some(Ok(chunk))) => {
                    buf.push_str(&String::from_utf8_lossy(&chunk));

                    while let Some(block_end) = buf.find("\n\n") {
                        let block = buf[..block_end].to_string();
                        buf = buf[block_end + 2..].to_string();

                        let data = block
                            .lines()
                            .find(|l| l.starts_with("data:"))
                            .and_then(|l| l.strip_prefix("data:"))
                            .map(str::trim)
                            .unwrap_or("");

                        if data.is_empty() {
                            continue;
                        }

                        let Ok(event): Result<serde_json::Value, _> = serde_json::from_str(data) else {
                            continue;
                        };

                        let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        let props = &event["properties"];

                        let evt_session = props.get("sessionID").and_then(|v| v.as_str()).unwrap_or("");
                        if !evt_session.is_empty() && evt_session != session_id {
                            continue;
                        }

                        if !started {
                            started = true;
                            yield Ok(Event::default().data(json!({
                                "type": "message_start",
                                "messageId": message_id,
                                "modelId": model_id,
                                "runtimeModelId": model_id,
                            }).to_string()));
                        }

                        match event_type {
                            "message.part.delta" => {
                                let field = props.get("field").and_then(|v| v.as_str()).unwrap_or("text");
                                let delta = props.get("delta").and_then(|v| v.as_str()).unwrap_or("");
                                let part_id = props.get("partID").and_then(|v| v.as_str()).unwrap_or("p1");

                                if field == "thinking" {
                                    yield Ok(Event::default().data(json!({
                                        "type": "content_block_delta",
                                        "messageId": message_id,
                                        "partId": part_id,
                                        "delta": { "type": "thinking_delta", "thinking": delta }
                                    }).to_string()));
                                } else {
                                    yield Ok(Event::default().data(json!({
                                        "type": "content_block_delta",
                                        "messageId": message_id,
                                        "partId": part_id,
                                        "delta": { "type": "text_delta", "text": delta }
                                    }).to_string()));
                                }
                            }
                            "message.part.updated" => {
                                if let Some(part) = props.get("part").and_then(|p| p.as_object()) {
                                    let part_type = part.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                    if part_type == "tool_use" {
                                        let id = part.get("toolUseId").and_then(|v| v.as_str()).unwrap_or("");
                                        let name = part.get("name").and_then(|v| v.as_str()).unwrap_or("tool");
                                        let input = part.get("input").cloned().unwrap_or(json!({}));
                                        yield Ok(Event::default().data(json!({
                                            "type": "content_block_start",
                                            "messageId": message_id,
                                            "content_block": { "id": id, "type": "tool_use", "name": name, "input": input }
                                        }).to_string()));
                                    } else if part_type == "tool_result" {
                                        let id = part.get("toolUseId").and_then(|v| v.as_str()).unwrap_or("");
                                        let content = part.get("content").cloned().unwrap_or(json!(null));
                                        let is_error = part.get("isError").and_then(|v| v.as_bool()).unwrap_or(false);
                                        if is_error {
                                            yield Ok(Event::default().data(json!({
                                                "type": "tool_error",
                                                "toolCallId": id,
                                                "toolName": "Tool",
                                                "error": content
                                            }).to_string()));
                                        } else {
                                            yield Ok(Event::default().data(json!({
                                                "type": "tool_result",
                                                "toolCallId": id,
                                                "toolName": "Tool",
                                                "result": content
                                            }).to_string()));
                                        }
                                    }
                                }
                            }
                            "session.status" => {
                                let status_type = props
                                    .get("status")
                                    .and_then(|s| s.get("type"))
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("");
                                if status_type == "busy" {
                                    was_busy = true;
                                } else if status_type == "idle" && was_busy {
                                    yield Ok(Event::default().data(json!({
                                        "type": "finish",
                                        "messageId": message_id,
                                        "status": "complete",
                                        "metadata": { "status": "complete" }
                                    }).to_string()));
                                    return;
                                }
                            }
                            _ => {}
                        }
                    }
                }
                Ok(Some(Err(err))) => {
                    warn!(error = %err, session_id = %session_id, "Gizzi event stream read error");
                    yield Ok(Event::default().data(json!({
                        "type": "error",
                        "messageId": message_id,
                        "error": format!("Stream read error: {}", err)
                    }).to_string()));
                    break;
                }
                Ok(None) => {
                    // Stream closed. Emit finish if we ever started.
                    if started {
                        yield Ok(Event::default().data(json!({
                            "type": "finish",
                            "messageId": message_id,
                            "status": "complete",
                            "metadata": { "status": "complete" }
                        }).to_string()));
                    }
                    break;
                }
                Err(_) => continue,
            }
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}

/// Send a chat message to a Gizzi session and stream the response back.
pub async fn stream_chat_through_gizzi(
    gizzi_base: &str,
    session_id: &str,
    message: &str,
    runtime_model_id: Option<&str>,
) -> Response {
    let base = gizzi_base.trim_end_matches('/');
    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .unwrap_or_else(|_| Client::new());

    let model = parse_model_ref(runtime_model_id);
    let model_id = model
        .get("modelID")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            let (_, m) = crate::default_model();
            m
        });

    // Subscribe to events *before* sending the message so we don't miss deltas.
    let event_resp = match client
        .get(format!("{}/v1/event", base))
        .header("Accept", "text/event-stream")
        .send()
        .await
    {
        Ok(r) => r,
        Err(err) => {
            warn!(error = %err, "Failed to connect to Gizzi event stream");
            return stream_error(
                format!("msg_{}", uuid::Uuid::new_v4().simple()),
                model_id,
                format!("Gizzi event stream unreachable: {}", err),
            )
            .into_response();
        }
    };

    let message_payload = json!({
        "parts": [{ "type": "text", "text": message }],
        "model": model,
    });

    let message_url = format!("{}/v1/session/{}/message", base, urlencoding::encode(session_id));
    match client.post(&message_url).json(&message_payload).send().await {
        Ok(res) if res.status().is_success() => {
            info!(session_id = %session_id, "Forwarded chat message to Gizzi");
        }
        Ok(res) => {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            warn!(status = %status, body = %body, "Gizzi message endpoint failed");
            return stream_error(
                format!("msg_{}", uuid::Uuid::new_v4().simple()),
                model_id,
                format!("Gizzi session message failed ({}): {}", status, body),
            )
            .into_response();
        }
        Err(err) => {
            warn!(error = %err, "Failed to send message to Gizzi session");
            return stream_error(
                format!("msg_{}", uuid::Uuid::new_v4().simple()),
                model_id,
                format!("Failed to send message to Gizzi: {}", err),
            )
            .into_response();
        }
    }

    let assistant_message_id = format!("msg_{}", uuid::Uuid::new_v4().simple());
    chat_event_stream(event_resp, session_id.to_string(), assistant_message_id, model_id).into_response()
}

fn stream_error(
    message_id: String,
    model_id: String,
    error_text: String,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        yield Ok(Event::default().data(json!({
            "type": "message_start",
            "messageId": message_id,
            "modelId": model_id,
            "runtimeModelId": model_id,
        }).to_string()));

        yield Ok(Event::default().data(json!({
            "type": "error",
            "messageId": message_id,
            "error": error_text,
        }).to_string()));

        yield Ok(Event::default().data(json!({
            "type": "finish",
            "messageId": message_id,
            "status": "error",
            "metadata": { "status": "error" }
        }).to_string()));
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}
