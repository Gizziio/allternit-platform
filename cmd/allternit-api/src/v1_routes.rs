use axum::{
    body::Body,
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{any, get, post},
    Json, Router,
};
use futures::StreamExt;
use once_cell::sync::Lazy;
use serde_json::json;
use std::{collections::HashMap, convert::Infallible, sync::Arc, sync::Mutex};
use tracing::{info, warn};
use uuid::Uuid;

use crate::{AppState, default_model};
use crate::config::build_gizzi_harness_for_provider;
use crate::gizzi_chat_stream::configure_harness_on_gizzi;

/// In-memory map from platform chatId → Gizzi session ID. Gizzi generates its
/// own session IDs, so we cache the mapping for the lifetime of the API process.
static GIZZI_CHAT_SESSIONS: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

async fn get_or_create_gizzi_session(
    client: &reqwest::Client,
    gizzi: &str,
    chat_id: &str,
) -> Result<String, String> {
    {
        let lock = GIZZI_CHAT_SESSIONS.lock().map_err(|e| e.to_string())?;
        if let Some(id) = lock.get(chat_id) {
            return Ok(id.clone());
        }
    }

    // Sessions created via /api/v1/agent-sessions already exist in Gizzi (that
    // router proxies creation there). If chat_id is such a session, use it
    // directly — forking a second Gizzi session here made streamed messages land
    // in a different session than the one GET /agent-sessions/:id/messages reads,
    // so threads looked empty and history vanished on reload.
    if chat_id.starts_with("ses") {
        if let Ok(resp) = client
            .get(format!("{}/session/{}", gizzi, chat_id))
            .send()
            .await
        {
            if resp.status().is_success() {
                let mut lock = GIZZI_CHAT_SESSIONS.lock().map_err(|e| e.to_string())?;
                lock.insert(chat_id.to_string(), chat_id.to_string());
                return Ok(chat_id.to_string());
            }
        }
    }

    let resp = client
        .post(format!("{}/session", gizzi))
        .json(&json!({ "title": format!("Allternit chat {}", chat_id) }))
        .send()
        .await
        .map_err(|e| format!("failed to create gizzi session: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("gizzi session creation failed: {}", resp.status()));
    }

    let body = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("failed to parse gizzi session response: {}", e))?;
    let session_id = body
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "gizzi session response missing id".to_string())?
        .to_string();

    let mut lock = GIZZI_CHAT_SESSIONS.lock().map_err(|e| e.to_string())?;
    lock.insert(chat_id.to_string(), session_id.clone());
    Ok(session_id)
}

fn gizzi_base() -> String {
    crate::APP_CONFIG
        .get()
        .map(|c| c.terminal_server_url())
        .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
        .trim_end_matches('/')
        .to_string()
}

pub fn v1_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/ai/chat", post(agent_chat_bridge))
        .route("/health", get(health))
}

pub fn agent_chat_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agent-chat", any(agent_chat_bridge))
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

/// Bridge /api/agent-chat → gizzi session/event architecture.
///
/// 1. Parse chatId and message from the request body.
/// 2. Subscribe to gizzi's SSE event stream.
/// 3. POST the message to gizzi /v1/session/:id/message.
/// 4. Filter message.part.delta events for this session and convert to
///    the content_block_delta SSE format the frontend expects.
/// 5. Close the stream when session.status becomes idle.
async fn agent_chat_bridge(_headers: HeaderMap, body: Body) -> Response {
    let body_bytes = match body_to_bytes(body).await {
        Ok(b) => b,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "bad request body"}))).into_response();
        }
    };

    let body_json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap_or(serde_json::Value::Null);

    let chat_id = body_json.get("chatId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let message = body_json.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // Parse model from runtimeModelId or modelId — strip provider prefix if present.
    // When nothing is supplied, use the environment-configurable default so the
    // packaged app can target any Gizzi provider/model without recompiling.
    let (default_provider, default_model_id) = default_model();
    let default_label = format!("{}/{}", default_provider, default_model_id);
    let raw_model = body_json.get("runtimeModelId")
        .or_else(|| body_json.get("modelId"))
        .and_then(|v| v.as_str())
        .unwrap_or(&default_label)
        // Frontend model ids use the `provider::model` convention; the runtime
        // expects `provider/model`. Normalize so both forms route.
        .replace("::", "/");

    let (provider_id, model_id) = if let Some((p, m)) = raw_model.split_once('/') {
        (p.to_string(), m.to_string())
    } else {
        (default_provider, raw_model.clone())
    };

    if chat_id.is_empty() || message.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "chatId and message are required"})),
        ).into_response();
    }

    let gizzi = gizzi_base();
    let assistant_message_id = format!("msg_{}", Uuid::new_v4().simple());
    let model_label = format!("{}/{}", provider_id, model_id);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap_or_default();

    // For non-cloud harness modes (subprocess, local, BYOK), push credentials
    // and config to Gizzi before creating the session so the chosen brain is
    // authenticated. This is what makes Claude CLI / local brains work through
    // the /api/agent-chat bridge.
    let harness = build_gizzi_harness_for_provider(&provider_id);
    let model_ref = json!({ "providerID": provider_id, "modelID": model_id });
    configure_harness_on_gizzi(&client, &gizzi, harness.as_ref(), &model_ref).await;

    let gizzi_session_id = match get_or_create_gizzi_session(&client, &gizzi, &chat_id).await {
        Ok(id) => id,
        Err(err) => {
            warn!(error = %err, "Failed to get or create Gizzi session");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err })),
            )
                .into_response();
        }
    };

    info!(session_id = %chat_id, gizzi_session_id = %gizzi_session_id, model = %model_label, "agent-chat bridge → gizzi");

    let stream = async_stream::stream! {
        let msg_id = assistant_message_id.clone();
        let session_id = gizzi_session_id.clone();

        yield Ok::<Event, Infallible>(Event::default().data(
            json!({
                "type": "message_start",
                "messageId": msg_id,
                "modelId": model_label,
                "runtimeModelId": model_label,
            }).to_string()
        ));

        // Subscribe to the gizzi event stream BEFORE sending the message so we
        // don't miss any events that fire immediately after the POST.
        let event_resp = match client
            .get(format!("{}/event", gizzi))
            .header("Accept", "text/event-stream")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to connect to gizzi event stream: {}", e);
                yield Ok(Event::default().data(json!({
                    "type": "finish",
                    "messageId": msg_id,
                    "status": "error",
                    "metadata": { "status": "error", "error": format!("gizzi event stream unavailable: {}", e) },
                }).to_string()));
                return;
            }
        };

        // POST message to gizzi
        let gizzi_payload = json!({
            "parts": [{ "type": "text", "text": message }],
            "model": { "providerID": provider_id, "modelID": model_id },
        });

        let _message_resp = match client
            .post(format!("{}/session/{}/message", gizzi, session_id))
            .json(&gizzi_payload)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => r,
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                warn!(status = %status, body = %body, "Gizzi message endpoint failed");
                yield Ok(Event::default().data(json!({
                    "type": "finish",
                    "messageId": msg_id,
                    "status": "error",
                    "metadata": { "status": "error", "error": format!("gizzi message failed ({}): {}", status, body) },
                }).to_string()));
                return;
            }
            Err(e) => {
                warn!("Failed to send message to gizzi session: {}", e);
                yield Ok(Event::default().data(json!({
                    "type": "finish",
                    "messageId": msg_id,
                    "status": "error",
                    "metadata": { "status": "error", "error": format!("gizzi unavailable: {}", e) },
                }).to_string()));
                return;
            }
        };

        // If the message endpoint returned a body with an agent response, ignore
        // it; we rely on the event stream for streaming replies.

        // Stream events from gizzi, forwarding text deltas for our session
        let mut buf = String::new();
        let mut byte_stream = event_resp.bytes_stream();
        let mut was_busy = false;

        'event_loop: while let Some(chunk_result) = byte_stream.next().await {
            let chunk = match chunk_result {
                Ok(b) => b,
                Err(e) => { warn!("Gizzi stream read error: {}", e); break; }
            };

            buf.push_str(&String::from_utf8_lossy(&chunk));

            // SSE blocks are separated by double newlines
            loop {
                let Some(block_end) = buf.find("\n\n") else { break };
                let block = buf[..block_end].to_string();
                buf = buf[block_end + 2..].to_string();

                // Extract the data line from the SSE block
                let data = block.lines()
                    .find(|l| l.starts_with("data:"))
                    .and_then(|l| l.strip_prefix("data:"))
                    .map(str::trim)
                    .unwrap_or("");

                if data.is_empty() { continue; }

                let Ok(event) = serde_json::from_str::<serde_json::Value>(data) else { continue };
                let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
                let props = &event["properties"];

                let evt_session = props.get("sessionID").and_then(|v| v.as_str()).unwrap_or("");
                if !evt_session.is_empty() && evt_session != session_id {
                    continue; // different session — ignore
                }

                match event_type {
                    "message.part.delta" => {
                        let delta_text = props.get("delta").and_then(|v| v.as_str()).unwrap_or("");
                        let part_id = props.get("partID").and_then(|v| v.as_str()).unwrap_or("text-1");

                        yield Ok(Event::default().data(json!({
                            "type": "content_block_delta",
                            "messageId": msg_id,
                            "partId": part_id,
                            "delta": { "type": "text_delta", "text": delta_text },
                        }).to_string()));
                    }
                    "session.status" => {
                        let status_type = props.get("status")
                            .and_then(|s| s.get("type"))
                            .and_then(|t| t.as_str())
                            .unwrap_or("");

                        if status_type == "busy" {
                            was_busy = true;
                        } else if status_type == "idle" && was_busy {
                            break 'event_loop;
                        }
                    }
                    _ => {}
                }
            }
        }

        yield Ok(Event::default().data(json!({
            "type": "finish",
            "messageId": msg_id,
            "status": "complete",
            "metadata": { "status": "complete" },
        }).to_string()));
    };

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

async fn body_to_bytes(body: Body) -> Result<axum::body::Bytes, Box<dyn std::error::Error + Send + Sync>> {
    use http_body_util::BodyExt;
    let collected = body.collect().await?;
    Ok(collected.to_bytes())
}
