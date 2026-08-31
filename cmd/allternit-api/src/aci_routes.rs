//! ACI (Agent-Computer Interface) routes
//!
//! Proxy/adaptation layer over the ACU computer-use gateway
//! (`domains/computer-use/core`, FastAPI, default :8760, prefix
//! `/v1/computer-use`). Keeps the `/api/aci/*` contract the iOS and web
//! clients expect while the real planning loop runs in the ACU process.
//! Base URL: `AppConfig::acu_url()` (env `ALLTERNIT_ACU_URL`).

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post},
    Json, Router,
};
use futures::StreamExt;
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::warn;

use crate::{auth::AuthUser, AppState};

pub fn aci_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/aci/run", post(aci_run))
        .route("/aci/stream/:id", get(aci_stream))
        .route("/aci/stop/:id", post(aci_stop))
        .route("/aci/approve/:id", post(aci_approve))
}

fn acu_base(state: &AppState) -> String {
    state.config.acu_url().trim_end_matches('/').to_string()
}

/// ACU could not be reached at all — a real 502, never a decoy 200.
fn acu_unavailable(e: impl std::fmt::Display) -> Response {
    (
        StatusCode::BAD_GATEWAY,
        Json(json!({
            "error": "acu_unavailable",
            "message": format!("ACU computer-use gateway unavailable: {}", e),
        })),
    )
        .into_response()
}

/// Forward a non-success ACU response honestly (status + detail).
async fn forward_acu_error(resp: reqwest::Response) -> Response {
    let status =
        StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let text = resp.text().await.unwrap_or_default();
    (
        status,
        Json(json!({
            "error": "acu_error",
            "message": format!("ACU gateway returned {}: {}", status, text),
        })),
    )
        .into_response()
}

// ─── Per-run event buffer ─────────────────────────────────────────────────────

/// ACU keeps one asyncio.Queue per run as a single-consumer replay buffer:
/// `/execute?stream=true` and `/runs/:id/events` read from that same queue,
/// so whichever consumer attaches first eats the history — and a short run
/// can be entirely over before `/api/aci/stream` attaches. To keep the client
/// contract (attach any time, see the full history, end with `done`), the run
/// handler drains the execute stream into this in-process buffer and the
/// stream endpoint serves from it.
struct RunEventBuffer {
    /// Mapped frames (the `/api/aci/stream` envelope), in arrival order.
    frames: Vec<serde_json::Value>,
    /// True once run.ended arrived or the upstream stream closed.
    done: bool,
}

static ACI_RUN_EVENTS: Lazy<Mutex<HashMap<String, RunEventBuffer>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Cap buffered frames per run so a long loop can't grow memory without
/// bound; the oldest frames drop first.
const MAX_BUFFERED_FRAMES: usize = 1000;

fn buffer_create(run_id: &str) {
    if let Ok(mut store) = ACI_RUN_EVENTS.lock() {
        store.entry(run_id.to_string()).or_insert_with(|| RunEventBuffer {
            frames: Vec::new(),
            done: false,
        });
    }
}

fn buffer_push(run_id: &str, frame: serde_json::Value, done: bool) {
    if let Ok(mut store) = ACI_RUN_EVENTS.lock() {
        if let Some(buf) = store.get_mut(run_id) {
            if buf.frames.len() >= MAX_BUFFERED_FRAMES {
                buf.frames.remove(0);
            }
            buf.frames.push(frame);
            if done {
                buf.done = true;
            }
        }
    }
}

fn buffer_mark_done(run_id: &str) {
    if let Ok(mut store) = ACI_RUN_EVENTS.lock() {
        if let Some(buf) = store.get_mut(run_id) {
            buf.done = true;
        }
    }
}

/// Drain one ACU SSE response into the per-run buffer (runs detached).
async fn drain_acu_events(run_id: String, resp: reqwest::Response) {
    let mut byte_stream = resp.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = byte_stream.next().await {
        let bytes = match chunk {
            Ok(b) => b,
            Err(e) => {
                warn!("aci run {}: upstream read error: {}", run_id, e);
                break;
            }
        };
        buf.push_str(&String::from_utf8_lossy(&bytes));
        // SSE blocks are separated by double newlines.
        while let Some(end) = buf.find("\n\n") {
            let block = buf[..end].to_string();
            buf = buf[end + 2..].to_string();
            let data = block
                .lines()
                .find(|l| l.starts_with("data:"))
                .and_then(|l| l.strip_prefix("data:"))
                .map(str::trim)
                .unwrap_or("");
            if data.is_empty() {
                continue;
            }
            match serde_json::from_str::<serde_json::Value>(data)
                .ok()
                .and_then(|frame| map_acu_frame(&frame))
            {
                Some(mapped) => {
                    let done =
                        mapped.get("type").and_then(|t| t.as_str()) == Some("done");
                    buffer_push(&run_id, mapped, done);
                }
                None => warn!("aci run {}: unparseable frame skipped", run_id),
            }
        }
    }
    buffer_mark_done(&run_id);
}

// ─── POST /api/aci/run ────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AciRunBody {
    goal: String,
    model: Option<String>,
    allowed_sites: Option<serde_json::Value>,
    open_links_in_browser: Option<bool>,
    auto_verify: Option<bool>,
    /// The deleted TS route + both clients send a STRING ("dont-keep");
    /// accept any JSON and pass it through verbatim (contract fidelity —
    /// a bool here 422'd every real client).
    session_persistence: Option<serde_json::Value>,
}

async fn aci_run(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<AciRunBody>,
) -> impl IntoResponse {
    let goal = body.goal.trim().to_string();
    if goal.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "goal is required"})),
        )
            .into_response();
    }

    // Backend safety policy enforcement: host allowlist, sensitive-data
    // masking, and circuit-breaker rate limits. This mirrors the extension's
    // `browser-agent/safety/` layer so a rogue client cannot bypass it.
    let actor_key = format!(
        "{}:{}",
        user.organization_id.as_deref().unwrap_or("no-org"),
        &user.user_id
    );
    let decision = crate::aci_safety::evaluate_request(&goal, &actor_key);
    if !decision.allowed {
        crate::aci_safety::record_aci_error(&actor_key);
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "aci_safety_violation",
                "message": decision.reason.unwrap_or_else(|| "request blocked by safety policy".to_string()),
            })),
        )
            .into_response();
    }

    let run_id = uuid::Uuid::new_v4().to_string();
    let acu = acu_base(&state);

    // Start the run in ACU's streaming mode: the planning loop launches in
    // the gateway's background and the HTTP response is an SSE stream of
    // progress. We drain that stream into ACI_RUN_EVENTS (see the buffer
    // comment) so /api/aci/stream/:id can replay it to any number of clients
    // regardless of when they attach.
    let payload = json!({
        "mode": "intent",
        "task": decision.sanitized_goal,
        "session_id": run_id,
        "run_id": run_id,
        "target_scope": "browser",
        "options": {
            "model": body.model,
            "allowedSites": body.allowed_sites,
            "autoVerify": body.auto_verify,
            "sessionPersistence": body.session_persistence,
            "openLinksInBrowser": body.open_links_in_browser,
        },
    });

    let client = reqwest::Client::new();
    let resp = match client
        .post(format!("{}/v1/computer-use/execute?stream=true", acu))
        .json(&payload)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            crate::aci_safety::record_aci_error(&actor_key);
            return acu_unavailable(e);
        }
    };
    if !resp.status().is_success() {
        crate::aci_safety::record_aci_error(&actor_key);
        return forward_acu_error(resp).await;
    }
    crate::aci_safety::record_aci_success(&actor_key);
    buffer_create(&run_id);
    tokio::spawn(drain_acu_events(run_id.clone(), resp));

    (
        StatusCode::OK,
        Json(json!({
            "sessionId": run_id,
            "adapterId": "browser",
        })),
    )
        .into_response()
}

// ─── GET /api/aci/stream/:id ──────────────────────────────────────────────────

/// Map one ACU SSE frame (`{event_type, run_id, message, data}`) to the
/// `/api/aci/stream` envelope the clients decode. Lossy notes: ACU has no
/// screenshot frames, so `type:"screenshot"` never occurs here; any event
/// with a human-readable `message` is surfaced as a `trace` row (preserving
/// the original `event_type` inside `data`), everything else is a `state`
/// update with the frame's `data` passed through unchanged.
fn map_acu_frame(frame: &serde_json::Value) -> Option<serde_json::Value> {
    let event_type = frame.get("event_type").and_then(|v| v.as_str())?;
    let data = frame.get("data").cloned().unwrap_or(serde_json::Value::Null);
    let ts = chrono::Utc::now().timestamp_millis();

    let mapped = if event_type == "run.ended" {
        json!({ "type": "done", "data": data, "ts": ts })
    } else {
        let message = frame
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if !message.is_empty() {
            json!({
                "type": "trace",
                "data": { "message": message, "event_type": event_type, "data": data },
                "ts": ts,
            })
        } else {
            json!({ "type": "state", "data": data, "ts": ts })
        }
    };
    Some(mapped)
}

async fn aci_stream(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> Response {
    // Runs started through this API process are served from the in-process
    // buffer (replay + live tail, ending at done). Anything else — a run
    // created before this process booted, or by another ACU client — falls
    // back to proxying ACU's own events endpoint, which shares ACU's
    // single-consumer queue (see the RunEventBuffer comment).
    let known = ACI_RUN_EVENTS
        .lock()
        .map(|store| store.contains_key(&id))
        .unwrap_or(false);
    if !known {
        return aci_stream_passthrough(state, id).await;
    }

    let stream = async_stream::stream! {
        let mut cursor = 0usize;
        loop {
            let (batch, done) = match ACI_RUN_EVENTS.lock() {
                Ok(store) => match store.get(&id) {
                    Some(buf) => (buf.frames[cursor.min(buf.frames.len())..].to_vec(), buf.done),
                    None => (Vec::new(), true),
                },
                Err(_) => (Vec::new(), true),
            };
            cursor += batch.len();
            for frame in batch {
                yield Ok::<Event, std::convert::Infallible>(
                    Event::default().data(frame.to_string()),
                );
            }
            if done {
                return;
            }
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }
    };

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

/// Direct proxy of ACU's `/runs/:id/events` for runs this process did not
/// start. Only one consumer can ever see such a run's history (ACU's queue is
/// single-consumer) — first attached client wins.
async fn aci_stream_passthrough(state: Arc<AppState>, id: String) -> Response {
    let acu = acu_base(&state);
    let client = reqwest::Client::new();
    let resp = match client
        .get(format!("{}/v1/computer-use/runs/{}/events", acu, id))
        .header("Accept", "text/event-stream")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return acu_unavailable(e),
    };
    if !resp.status().is_success() {
        return forward_acu_error(resp).await;
    }

    let stream = async_stream::stream! {
        let mut byte_stream = resp.bytes_stream();
        let mut buf = String::new();
        while let Some(chunk) = byte_stream.next().await {
            match chunk {
                Ok(bytes) => {
                    buf.push_str(&String::from_utf8_lossy(&bytes));
                    // SSE blocks are separated by double newlines.
                    while let Some(end) = buf.find("\n\n") {
                        let block = buf[..end].to_string();
                        buf = buf[end + 2..].to_string();
                        let data = block
                            .lines()
                            .find(|l| l.starts_with("data:"))
                            .and_then(|l| l.strip_prefix("data:"))
                            .map(str::trim)
                            .unwrap_or("");
                        if data.is_empty() {
                            continue;
                        }
                        match serde_json::from_str::<serde_json::Value>(data)
                            .ok()
                            .and_then(|frame| map_acu_frame(&frame))
                        {
                            Some(mapped) => {
                                let is_done = mapped.get("type").and_then(|t| t.as_str()) == Some("done");
                                yield Ok::<Event, std::convert::Infallible>(
                                    Event::default().data(mapped.to_string()),
                                );
                                if is_done {
                                    return;
                                }
                            }
                            None => warn!("aci stream: unparseable frame skipped"),
                        }
                    }
                }
                Err(e) => {
                    warn!("aci stream: upstream read error: {}", e);
                    break;
                }
            }
        }
    };

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

// ─── POST /api/aci/stop/:id ───────────────────────────────────────────────────

async fn aci_stop(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> Response {
    let acu = acu_base(&state);
    let client = reqwest::Client::new();
    match client
        .post(format!("{}/v1/computer-use/runs/{}/cancel", acu, id))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => match r.json::<serde_json::Value>().await {
            Ok(v) => Json(v).into_response(),
            Err(_) => Json(json!({"run_id": id, "status": "cancelled"})).into_response(),
        },
        Ok(r) => forward_acu_error(r).await,
        Err(e) => acu_unavailable(e),
    }
}

// ─── POST /api/aci/approve/:id[?deny=true] ────────────────────────────────────

#[derive(Deserialize)]
struct AciApproveQuery {
    deny: Option<bool>,
}

async fn aci_approve(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<AciApproveQuery>,
) -> Response {
    let decision = if query.deny.unwrap_or(false) {
        "deny"
    } else {
        "approve"
    };
    let acu = acu_base(&state);
    let client = reqwest::Client::new();
    match client
        .post(format!("{}/v1/computer-use/runs/{}/approve", acu, id))
        .json(&json!({ "decision": decision, "comment": "" }))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => match r.json::<serde_json::Value>().await {
            Ok(v) => Json(v).into_response(),
            Err(_) => Json(json!({"run_id": id, "decision": decision})).into_response(),
        },
        Ok(r) => forward_acu_error(r).await,
        Err(e) => acu_unavailable(e),
    }
}
