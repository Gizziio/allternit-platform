//! Inbound Slack Events API webhook — lets allternit-api *serve* an agent
//! through Slack. Previously the platform only went the other direction: the
//! 181-entry connector catalog lets an agent *call* Slack as a tool, but
//! nothing handled Slack calling in (no Events API webhook existed at all).
//!
//! A channel message is routed to a Gizzi agent session — reusing the
//! session already mapped to that channel+thread in
//! `slack_channel_sessions` (migration V30), or creating one on first
//! contact — and the assistant's reply is posted back via
//! `chat.postMessage`.
//!
//! Scope limits, stated rather than silently assumed: text-only (no
//! file/image attachments), one default agent/model for every channel (no
//! per-channel agent selection), and the reply is fetched by bounded polling
//! rather than subscribing to Gizzi's event bus — this is a one-shot
//! background task per inbound message, not a held connection, so polling is
//! the simpler correct tool here (see `wait_for_reply`).

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use hmac::{Hmac, Mac};
use rusqlite::params;
use serde_json::{json, Value};
use sha2::Sha256;
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

use crate::agent_session_routes::gizzi_client;
use crate::config::AppConfig;
use crate::AppState;

type HmacSha256 = Hmac<Sha256>;

pub fn slack_webhook_router() -> Router<Arc<AppState>> {
    Router::new().route("/webhooks/slack/events", post(handle_event))
}

fn gizzi_base() -> String {
    AppConfig::load()
        .terminal_server_url()
        .trim_end_matches('/')
        .to_string()
}

/// Verify Slack's request signature: `X-Slack-Signature: v0=<hex hmac>` over
/// `v0:{timestamp}:{raw_body}`, `X-Slack-Request-Timestamp` within 5 minutes
/// — same HMAC-and-replay-window shape as `webhook_routes.rs`'s Svix check,
/// different vendor scheme.
fn verify_slack_signature(secret: &str, headers: &HeaderMap, body: &[u8]) -> Result<(), String> {
    let timestamp = headers
        .get("x-slack-request-timestamp")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-slack-request-timestamp header")?;
    let signature = headers
        .get("x-slack-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-slack-signature header")?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system time error: {e}"))?
        .as_secs() as i64;
    let ts: i64 = timestamp.parse().map_err(|_| "invalid x-slack-request-timestamp")?;
    if (now - ts).abs() > 300 {
        return Err("timestamp outside tolerance (+/-5 min)".to_string());
    }

    let basestring = format!("v0:{timestamp}:{}", String::from_utf8_lossy(body));
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| "invalid secret length")?;
    mac.update(basestring.as_bytes());
    let expected = format!("v0={}", hex::encode(mac.finalize().into_bytes()));

    if expected == signature {
        Ok(())
    } else {
        Err("x-slack-signature mismatch".to_string())
    }
}

async fn handle_event(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    let secret = match AppConfig::load().slack_signing_secret() {
        Some(s) => s,
        None => {
            warn!(
                "Slack event received but ALLTERNIT_SLACK_SIGNING_SECRET is not configured; rejecting"
            );
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "slack_not_configured"})),
            );
        }
    };

    if let Err(e) = verify_slack_signature(&secret, &headers, &body) {
        warn!("Slack signature verification failed: {e}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "invalid_signature"})),
        );
    }

    let payload: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            warn!("Slack event JSON parse error: {e}");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid_json"})),
            );
        }
    };

    // URL verification handshake — Slack sends this once, when the Events
    // Subscriptions URL is first configured or changed.
    if payload.get("type").and_then(|v| v.as_str()) == Some("url_verification") {
        let challenge = payload.get("challenge").cloned().unwrap_or(Value::Null);
        return (StatusCode::OK, Json(json!({ "challenge": challenge })));
    }

    if payload.get("type").and_then(|v| v.as_str()) == Some("event_callback") {
        if let Some(event) = payload.get("event") {
            let is_bot = event.get("bot_id").is_some();
            let is_message = event.get("type").and_then(|v| v.as_str()) == Some("message");
            // Skip subtyped messages (edits, joins, etc.) — only plain new
            // messages should reach the agent.
            let is_plain = event.get("subtype").is_none();

            if is_message && is_plain && !is_bot {
                let state = state.clone();
                let event = event.clone();
                // Slack requires a 200 within 3s or it retries the same
                // event; do the actual agent round-trip in the background.
                tokio::spawn(async move {
                    if let Err(e) = handle_message_event(&state, &event).await {
                        warn!("Slack message handling failed: {e}");
                    }
                });
            }
        }
    }

    (StatusCode::OK, Json(json!({ "ok": true })))
}

#[tracing::instrument(skip_all, name = "slack_webhook.handle_message_event")]
async fn handle_message_event(state: &Arc<AppState>, event: &Value) -> Result<(), String> {
    let channel = event
        .get("channel")
        .and_then(|v| v.as_str())
        .ok_or("missing channel")?
        .to_string();
    let text = event
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let thread_ts = event
        .get("thread_ts")
        .and_then(|v| v.as_str())
        .or_else(|| event.get("ts").and_then(|v| v.as_str()))
        .ok_or("missing ts")?
        .to_string();

    if text.trim().is_empty() {
        return Ok(());
    }

    let session_id = get_or_create_session(state, &channel, &thread_ts).await?;
    info!(channel = %channel, session_id = %session_id, "routing Slack message to agent session");

    let client = gizzi_client(&HeaderMap::new());
    let msg_path = format!("/v1/session/{}/message", urlencoding::encode(&session_id));
    let msg_payload = json!({ "parts": [{ "type": "text", "text": text }] });
    send_json(&client, reqwest::Method::POST, &msg_path, Some(msg_payload)).await?;

    let reply = wait_for_reply(&client, &session_id).await?;
    post_slack_message(&channel, &thread_ts, &reply).await
}

/// Reuses the session mapped to this channel+thread, or creates a new Gizzi
/// session (surface `"slack"`) and remembers the mapping.
async fn get_or_create_session(
    state: &Arc<AppState>,
    channel: &str,
    thread_ts: &str,
) -> Result<String, String> {
    {
        let conn = state.db.connect().map_err(|e| e.to_string())?;
        let existing: Option<String> = conn
            .query_row(
                "SELECT session_id FROM slack_channel_sessions \
                 WHERE slack_channel_id = ?1 AND slack_thread_ts = ?2",
                params![channel, thread_ts],
                |row| row.get(0),
            )
            .ok();
        if let Some(session_id) = existing {
            return Ok(session_id);
        }
    }

    let client = gizzi_client(&HeaderMap::new());
    let (provider_id, model_id) = AppConfig::load().default_model();
    let create_payload = json!({
        "title": format!("Slack: {channel}"),
        "surface": "slack",
        "model": { "providerID": provider_id, "modelID": model_id },
    });
    let session = send_json(
        &client,
        reqwest::Method::POST,
        "/v1/session",
        Some(create_payload),
    )
    .await?;
    let session_id = session
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("Gizzi session creation returned no id")?
        .to_string();

    let conn = state.db.connect().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO slack_channel_sessions \
         (slack_channel_id, slack_thread_ts, session_id) VALUES (?1, ?2, ?3)",
        params![channel, thread_ts, session_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(session_id)
}

/// Polls for the assistant's completed reply — bounded to ~60s, checking
/// once a second. No bus subscription: this runs inside a `tokio::spawn`ed
/// background task per inbound message, not a held client connection, so
/// there's nothing for a push-based subscription to attach to here.
async fn wait_for_reply(client: &reqwest::Client, session_id: &str) -> Result<String, String> {
    let path = format!("/v1/session/{}/messages", urlencoding::encode(session_id));
    for _ in 0..60 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let messages = fetch_json_array(client, &path).await?;
        let reply = messages.iter().rev().find(|m| {
            let role_is_assistant = m
                .get("info")
                .and_then(|i| i.get("role"))
                .and_then(|v| v.as_str())
                == Some("assistant");
            let is_completed = m
                .get("info")
                .and_then(|i| i.get("time"))
                .and_then(|t| t.get("completed"))
                .is_some();
            role_is_assistant && is_completed
        });

        if let Some(reply) = reply {
            let text = reply
                .get("parts")
                .and_then(|p| p.as_array())
                .map(|parts| {
                    parts
                        .iter()
                        .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default();
            if !text.trim().is_empty() {
                return Ok(text);
            }
        }
    }
    Err("timed out waiting for assistant reply".to_string())
}

async fn post_slack_message(channel: &str, thread_ts: &str, text: &str) -> Result<(), String> {
    let token = AppConfig::load()
        .slack_bot_token()
        .ok_or("ALLTERNIT_SLACK_BOT_TOKEN is not configured")?;

    let client = reqwest::Client::new();
    let resp = client
        .post("https://slack.com/api/chat.postMessage")
        .bearer_auth(token)
        .json(&json!({ "channel": channel, "thread_ts": thread_ts, "text": text }))
        .send()
        .await
        .map_err(|e| format!("chat.postMessage request failed: {e}"))?;

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("chat.postMessage response parse failed: {e}"))?;

    if body.get("ok").and_then(|v| v.as_bool()) == Some(true) {
        Ok(())
    } else {
        Err(format!("chat.postMessage failed: {body}"))
    }
}

async fn send_json(
    client: &reqwest::Client,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = format!("{}{}", gizzi_base(), path);
    let mut req = client.request(method, &url);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Gizzi request failed: {e}"))?;
    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gizzi request failed: {text}"));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("Gizzi response parse failed: {e}"))
}

async fn fetch_json_array(client: &reqwest::Client, path: &str) -> Result<Vec<Value>, String> {
    let url = format!("{}{}", gizzi_base(), path);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Gizzi request failed: {e}"))?;
    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gizzi request failed: {text}"));
    }
    resp.json::<Vec<Value>>()
        .await
        .map_err(|e| format!("Gizzi response parse failed: {e}"))
}
