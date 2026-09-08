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
        .route("/aci/handoff/:id", get(aci_handoff_status))
        .route("/aci/handoff/:id/approve", post(aci_handoff_approve))
        .route("/aci/handoff/:id/deny", post(aci_handoff_deny))
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

#[derive(Deserialize, Clone)]
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
    /// Grant id from a prior `handoff_required` response. When the safety
    /// policy flags the goal as sensitive, presenting a valid grant bound to
    /// this exact action payload (same hash) authorizes the run; a missing,
    /// expired, consumed, or hash-mismatched grant is denied.
    approval_id: Option<String>,
}

/// Canonical action descriptor for the ACU loop route. Ephemeral ids
/// (session/run) are excluded so a client retrying the same body after a
/// handoff approval hashes identically. `approval_id` is never part of the
/// descriptor — it rides alongside, not inside, the hashed payload.
fn aci_action_descriptor(body: &AciRunBody, goal: &str) -> serde_json::Value {
    json!({
        "route": "aci.run",
        "goal": goal,
        "model": body.model,
        "allowedSites": body.allowed_sites,
        "openLinksInBrowser": body.open_links_in_browser,
        "autoVerify": body.auto_verify,
        "sessionPersistence": body.session_persistence,
    })
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
    let mut granted = false;
    if !decision.allowed {
        crate::aci_safety::record_aci_error(&actor_key);

        if decision.handoff_required {
            // The action payload the grant is bound to: the goal the client
            // actually submitted, not the (possibly masked) variant.
            let action_hash =
                crate::aci_approvals::hash_action_payload(&aci_action_descriptor(&body, &goal));

            // A client retrying after a handoff approval presents the grant
            // id. Redemption enforces approval state, ownership, expiry,
            // single-use, and — critically — that this payload hashes to the
            // granted action hash.
            if let Some(ref approval_id) = body.approval_id {
                match crate::aci_approvals::GRANTS.redeem(&user.user_id, approval_id, &action_hash)
                {
                    Ok(_) => granted = true,
                    Err(denial) => {
                        return (
                            StatusCode::FORBIDDEN,
                            Json(json!({
                                "error": "approval_denied",
                                "approval_id": approval_id,
                                "action_hash": action_hash,
                                "reason": denial.reason(),
                            })),
                        )
                            .into_response();
                    }
                }
            }

            if !granted {
                let approval_id = state.approval_store.create(
                    &user.user_id,
                    "aci.sensitive_action",
                    &json!({
                        "goal": decision.sanitized_goal,
                        "sensitive_actions": decision.sensitive_actions,
                        "reason": decision.reason,
                    }),
                );
                // Bind the grant to the same id and action hash so approving
                // the handoff authorizes exactly this payload — and only it.
                crate::aci_approvals::GRANTS.issue_with_id(
                    &approval_id,
                    &user.user_id,
                    &action_hash,
                    crate::aci_approvals::grant_ttl_secs(),
                );
                return (
                    StatusCode::ACCEPTED,
                    Json(json!({
                        "status": "handoff_required",
                        "approval_id": approval_id,
                        "action_hash": action_hash,
                        "message": decision.reason,
                        "sensitive_actions": decision.sensitive_actions,
                    })),
                )
                    .into_response();
            }
        } else {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "aci_safety_violation",
                    "message": decision.reason.unwrap_or_else(|| "request blocked by safety policy".to_string()),
                })),
            )
                .into_response();
        }
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

/// Pull a screenshot payload out of an ACU frame or nested `data`.
/// Planning-loop events use `screenshot_b64`; some adapters use `screenshot`
/// or an artifacts array.
fn screenshot_from_value(value: &serde_json::Value) -> Option<String> {
    if let Some(s) = value
        .get("screenshot_b64")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    {
        return Some(s.to_string());
    }
    if let Some(s) = value
        .get("screenshot")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    {
        return Some(s.to_string());
    }
    if let Some(s) = value
        .get("data_url")
        .and_then(|v| v.as_str())
        .filter(|s| s.starts_with("data:image"))
    {
        return Some(s.to_string());
    }
    if let Some(arr) = value.get("artifacts").and_then(|v| v.as_array()) {
        for art in arr {
            let ty = art.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if ty != "screenshot" {
                continue;
            }
            if let Some(c) = art
                .get("content")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
            {
                return Some(c.to_string());
            }
        }
    }
    value
        .get("data")
        .and_then(|inner| inner.is_object().then_some(inner))
        .and_then(screenshot_from_value)
}

/// Map one ACU SSE frame (`{event_type, run_id, message, data}`) to the
/// `/api/aci/stream` envelope the clients decode.
///
/// ACU planning-loop emits `screenshot.captured` with `screenshot_b64`. That
/// must become `type:"screenshot"` so Fabric Transport can show the live
/// computer. Other events with a human-readable `message` are `trace`; the
/// rest are `state`.
fn map_acu_frame(frame: &serde_json::Value) -> Option<serde_json::Value> {
    let event_type = frame.get("event_type").and_then(|v| v.as_str())?;
    let data = frame.get("data").cloned().unwrap_or(serde_json::Value::Null);
    let ts = chrono::Utc::now().timestamp_millis();

    if event_type == "run.ended" {
        return Some(json!({ "type": "done", "data": data, "ts": ts }));
    }

    if let Some(screenshot) = screenshot_from_value(frame).or_else(|| screenshot_from_value(&data))
    {
        return Some(json!({
            "type": "screenshot",
            "data": { "screenshot": screenshot },
            "ts": ts,
        }));
    }

    let message = frame
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let mapped = if !message.is_empty() {
        json!({
            "type": "trace",
            "data": { "message": message, "event_type": event_type, "data": data },
            "ts": ts,
        })
    } else {
        json!({ "type": "state", "data": data, "ts": ts })
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

// ─── Handoff endpoints for sensitive actions ──────────────────────────────────

async fn aci_handoff_status(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> Response {
    match state.approval_store.get(&id) {
        Some(req) => Json(req).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "handoff_not_found", "message": "No such handoff request."})),
        )
            .into_response(),
    }
}

async fn aci_handoff_approve(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Response {
    if state.approval_store.approve(&id) {
        // Mirror the human decision into the action-hash grant so a
        // subsequent run carrying this approval_id can redeem it.
        crate::aci_approvals::GRANTS.approve(&id);
        Json(json!({"approval_id": id, "status": "approved"})).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "handoff_not_found", "message": "No such handoff request."})),
        )
            .into_response()
    }
}

async fn aci_handoff_deny(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Response {
    if state.approval_store.deny(&id) {
        crate::aci_approvals::GRANTS.deny(&id);
        Json(json!({"approval_id": id, "status": "denied"})).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "handoff_not_found", "message": "No such handoff request."})),
        )
            .into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_acu_frame_emits_screenshot_from_planning_loop() {
        let frame = json!({
            "event_type": "screenshot.captured",
            "run_id": "run-1",
            "message": "screenshot.captured",
            "data": {
                "type": "screenshot.captured",
                "run_id": "run-1",
                "step": 0,
                "phase": "initial",
                "screenshot_b64": "iVBORw0KGgo="
            }
        });
        let mapped = map_acu_frame(&frame).expect("mapped");
        assert_eq!(mapped["type"], "screenshot");
        assert_eq!(mapped["data"]["screenshot"], "iVBORw0KGgo=");
    }

    #[test]
    fn map_acu_frame_ends_on_run_ended() {
        let frame = json!({
            "event_type": "run.ended",
            "run_id": "run-1",
            "message": "completed",
            "data": { "status": "completed" }
        });
        let mapped = map_acu_frame(&frame).expect("mapped");
        assert_eq!(mapped["type"], "done");
    }

    #[test]
    fn map_acu_frame_keeps_trace_when_no_screenshot() {
        let frame = json!({
            "event_type": "plan.created",
            "run_id": "run-1",
            "message": "plan.created",
            "data": { "step": 1 }
        });
        let mapped = map_acu_frame(&frame).expect("mapped");
        assert_eq!(mapped["type"], "trace");
        assert_eq!(mapped["data"]["event_type"], "plan.created");
    }

    #[test]
    fn aci_action_descriptor_is_deterministic_and_excludes_ephemeral_ids() {
        let body = AciRunBody {
            goal: "buy tickets example.com".to_string(),
            model: Some("claude-sonnet-4-6".to_string()),
            allowed_sites: Some(json!(["example.com"])),
            open_links_in_browser: Some(true),
            auto_verify: Some(false),
            session_persistence: Some(json!("dont-keep")),
            approval_id: Some("grant-from-a-prior-attempt".to_string()),
        };
        let h1 = crate::aci_approvals::hash_action_payload(&aci_action_descriptor(&body, &body.goal));

        // Same body re-submitted after a handoff decision, with a different
        // (or absent) approval_id, must hash identically.
        let mut retry = AciRunBody {
            goal: "buy tickets example.com".to_string(),
            model: Some("claude-sonnet-4-6".to_string()),
            allowed_sites: Some(json!(["example.com"])),
            open_links_in_browser: Some(true),
            auto_verify: Some(false),
            session_persistence: Some(json!("dont-keep")),
            approval_id: None,
        };
        let h2 = crate::aci_approvals::hash_action_payload(&aci_action_descriptor(&retry, &retry.goal));
        assert_eq!(h1, h2);

        // Any payload change changes the hash.
        retry.goal = "buy tickets evil-example.com".to_string();
        let h3 = crate::aci_approvals::hash_action_payload(&aci_action_descriptor(&retry, &retry.goal));
        assert_ne!(h1, h3);
    }

    #[test]
    fn handoff_grant_redeems_once_for_matching_hash_only() {
        // Issue a grant exactly as aci_run does when flagging a sensitive
        // goal, then exercise the redemption contract the run handler relies
        // on: approved + same hash → ok; repeat → single-use denial; other
        // payload → hash-mismatch denial.
        let store = crate::permission_policy::ApprovalStore::new();
        let body = AciRunBody {
            goal: "checkout with credit card on example.com".to_string(),
            model: None,
            allowed_sites: None,
            open_links_in_browser: None,
            auto_verify: None,
            session_persistence: None,
            approval_id: None,
        };
        let action_hash = crate::aci_approvals::hash_action_payload(&aci_action_descriptor(&body, &body.goal));
        let approval_id = store.create("user-1", "aci.sensitive_action", &json!({}));
        crate::aci_approvals::GRANTS.issue_with_id(
            &approval_id,
            "user-1",
            &action_hash,
            crate::aci_approvals::grant_ttl_secs(),
        );

        // Not yet approved by the human.
        assert_eq!(
            crate::aci_approvals::GRANTS.redeem("user-1", &approval_id, &action_hash),
            Err(crate::aci_approvals::GrantDenial::NotApproved)
        );

        crate::aci_approvals::GRANTS.approve(&approval_id);
        assert!(crate::aci_approvals::GRANTS
            .redeem("user-1", &approval_id, &action_hash)
            .is_ok());
        assert_eq!(
            crate::aci_approvals::GRANTS.redeem("user-1", &approval_id, &action_hash),
            Err(crate::aci_approvals::GrantDenial::AlreadyConsumed)
        );

        let mut tampered = body.clone();
        tampered.goal = "checkout with credit card on evil.com".to_string();
        let other_hash =
            crate::aci_approvals::hash_action_payload(&aci_action_descriptor(&tampered, &tampered.goal));
        assert_eq!(
            crate::aci_approvals::GRANTS.redeem("user-1", &approval_id, &other_hash),
            Err(crate::aci_approvals::GrantDenial::AlreadyConsumed)
        );
    }
}
