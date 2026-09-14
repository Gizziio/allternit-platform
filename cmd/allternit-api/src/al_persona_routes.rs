//! Al persona runtime v0.1 (A:// P-T5).
//!
//! The conversational surface over the orchestrator: a user talks to Al; Al
//! normalizes the request into a canonical intent, resolves the execution
//! target through the workspace delegation rules (the same resolution the
//! deterministic orchestrator uses), submits the intent under its own
//! principal (`a://principal/al`, delegator attribution), narrates status,
//! and reports against canonical run state.
//!
//! Posture (AL_IMPLEMENTATION_SPEC §5 never-inherit list): Al plans and
//! delegates only. Zero capabilities: this module never claims jobs, never
//! completes work, and never holds connector secrets. Model assistance uses
//! the existing model router/gateway (`run_completion`) — no new LLM path.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response, sse::{Event, KeepAlive, Sse}},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

use allternit_cowork_runtime::sqlite_store;
use allternit_cowork_runtime::{
    IntentAction, IntentEnvelope,
};

use crate::auth::{get_user, AuthUser};
use crate::AppState;

pub fn al_persona_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/cowork/al/chat", post(al_chat))
        // Consumer-packaged Cowork P2: chat drives A:// — the same Al
        // delegation, streamed (delegation → run state → approvals → result)
        // so the chat surface narrates the canonical run instead of direct
        // model relay.
        .route("/cowork/al/chat/stream", post(al_chat_stream))
        .route("/cowork/al/sessions/:session_id", get(get_al_session))
}

#[derive(Debug)]
struct AlError {
    status: StatusCode,
    body: Json<Value>,
}

impl AlError {
    fn new(status: StatusCode, code: &str, message: impl Into<String>) -> Self {
        Self {
            status,
            body: Json(json!({"error": code, "message": message.into()})),
        }
    }
}

impl IntoResponse for AlError {
    fn into_response(self) -> Response {
        (self.status, self.body).into_response()
    }
}

#[derive(Debug, Deserialize)]
pub struct AlChatRequest {
    /// Conversation id; a new one is minted when absent.
    pub session_id: Option<String>,
    pub message: String,
    /// Workspace scope (default `default`), e.g. "acme".
    pub workspace: Option<String>,
}

/// Shared Al delegation outcome — used by both the JSON chat surface and the
/// P2 SSE stream so both narrate identically.
enum AlDelegation {
    NoRule {
        extracted: ExtractedIntent,
        reply: String,
    },
    Delegated {
        target_principal: String,
        intent_id: String,
        run_id: String,
        action_type: String,
        description: String,
    },
}

/// Steps 1–3 of an Al turn: normalize the request, resolve the delegation
/// target through the workspace rules, and submit the canonical intent
/// (initiator = user, delegator = Al, chain [user, al]). Al never executes.
async fn prepare_delegation(
    state: &AppState,
    user: &AuthUser,
    session_id: &str,
    workspace: &str,
    message: &str,
) -> Result<AlDelegation, AlError> {
    let extracted = match model_extract(state, user, message).await {
        Some(intent) => intent,
        None => fallback_extract(message),
    };
    let mut conn = state.db.connect().map_err(db_error)?;
    let target =
        sqlite_store::resolve_delegation_rule(&conn, workspace, &extracted.action_type)
            .map_err(transport_error)?;
    let Some(target) = target else {
        let reply = format!(
            "I can take this on, but no delegation rule in workspace `{workspace}` matches \
             action type `{}`. Add one (action_type prefix → target principal) and ask again.",
            extracted.action_type
        );
        return Ok(AlDelegation::NoRule { extracted, reply });
    };
    let al_principal = format!("a://workspace/{workspace}/principal/al");
    let target_principal = canonicalize_target(workspace, &target);
    let envelope = IntentEnvelope {
        version: "a/0.1".to_string(),
        intent_id: format!("al_{}", uuid::Uuid::new_v4()),
        workspace: format!("a://workspace/{workspace}"),
        initiator: user.user_id.clone(),
        delegator: Some(al_principal.clone()),
        target: Some(target_principal.clone()),
        action: IntentAction {
            action_type: extracted.action_type.clone(),
            description: extracted.description.clone(),
            // P2.2: Al-driven turns carry the agentic job kind — the worker
            // runs a bounded model-agent loop (existing model router) with
            // file/bash tools confined to the granted folders.
            payload: Some(json!({
                "message": message,
                "via": "al_persona",
                "agentic": { "task": message },
            })),
        },
        permissions: vec![],
        compute: if crate::cowork_preferences_routes::cloud_continuation_enabled(&conn, &user.user_id) {
            Some(json!({ "policy": "cloud" }))
        } else {
            None
        },
        model: None,
        approval: None,
        return_channel: Some(json!({ "channel": "cowork", "session_id": session_id })),
        causation_chain: vec![user.user_id.clone(), al_principal.clone()],
    };
    let submission = sqlite_store::submit_intent(&mut conn, &envelope).map_err(transport_error)?;
    sqlite_store::set_run_owner(&mut conn, &submission.run_id, &user.user_id)
        .map_err(transport_error)?;
    info!(
        user = %user.user_id,
        intent = %submission.intent_id,
        run = %submission.run_id,
        target = %target_principal,
        "Al persona delegated a request"
    );
    Ok(AlDelegation::Delegated {
        target_principal,
        intent_id: submission.intent_id,
        run_id: submission.run_id,
        action_type: extracted.action_type.clone(),
        description: extracted.description.clone(),
    })
}

/// The normalized work item Al extracts from a user message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedIntent {
    pub action_type: String,
    pub description: String,
}

/// Deterministic normalization, used whenever model assistance is
/// unavailable (no OS control plane) or returns unparseable output. The
/// first word becomes the action-type prefix (matching delegation rules by
/// prefix); the full message is the description.
pub fn fallback_extract(message: &str) -> ExtractedIntent {
    let first = message.split_whitespace().next().unwrap_or("chat");
    let action_type: String = first
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '.' {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .take(32)
        .collect();
    let action_type = if action_type.is_empty() {
        "chat".to_string()
    } else {
        action_type
    };
    ExtractedIntent {
        action_type,
        description: message.trim().to_string(),
    }
}

/// Parse the model's extraction reply: the first `{ ... }` JSON object with
/// string `action_type`/`description` fields.
pub fn parse_model_extraction(text: &str) -> Option<ExtractedIntent> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    let parsed: Value = serde_json::from_str(text.get(start..=end)?).ok()?;
    let action_type = parsed.get("action_type")?.as_str()?.trim().to_string();
    let description = parsed
        .get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| action_type.clone());
    if action_type.is_empty() || action_type.len() > 64 {
        return None;
    }
    Some(ExtractedIntent {
        action_type,
        description,
    })
}

/// Canonicalize a delegation-rule target into a full principal id (same
/// rules as the orchestrator loop).
pub fn canonicalize_target(workspace: &str, target: &str) -> String {
    if target.contains("://") {
        target.to_string()
    } else if target.starts_with("bot/") || target.contains('/') {
        format!("a://workspace/{workspace}/{target}")
    } else {
        format!("a://workspace/{workspace}/principal/{target}")
    }
}

fn db_error(e: rusqlite::Error) -> AlError {
    AlError::new(StatusCode::INTERNAL_SERVER_ERROR, "store_error", e.to_string())
}

fn transport_error(e: allternit_cowork_runtime::transport::TransportError) -> AlError {
    AlError::new(
        StatusCode::from_u16(e.http_status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        e.wire(),
        e.message,
    )
}

fn append_al_message(
    conn: &rusqlite::Connection,
    user_id: &str,
    session_id: &str,
    role: &str,
    content: &str,
    intent_id: Option<&str>,
    run_id: Option<&str>,
) -> Result<(), AlError> {
    conn.execute(
        "INSERT INTO cowork_al_messages (id, user_id, session_id, role, content, intent_id, run_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            format!("almsg_{}", uuid::Uuid::new_v4()),
            user_id,
            session_id,
            role,
            content,
            intent_id,
            run_id,
        ],
    )
    .map_err(db_error)?;
    Ok(())
}

/// Best-effort model-assisted intent extraction through the existing model
/// router/gateway. Returns `None` when no OS control plane is configured or
/// the model output does not parse — callers use `fallback_extract`.
async fn model_extract(
    state: &AppState,
    user: &AuthUser,
    message: &str,
) -> Option<ExtractedIntent> {
    // Model assistance requires the OS control plane (the same condition
    // under which /v1/responses runs real inference); otherwise the caller's
    // deterministic fallback applies.
    state.os_control_plane.as_ref()?;
    let org = user.organization_id.clone()?;
    let model_full_id =
        std::env::var("ALLTERNIT_AL_MODEL").unwrap_or_else(|_| "openai/gpt-4o-mini".to_string());

    let db = state.db.clone();
    let lookup_id = model_full_id.clone();
    let model = tokio::task::spawn_blocking(move || {
        let catalog = crate::fabric::model_catalog::ModelCatalog::new(db);
        catalog.seed_builtin().ok()?;
        catalog.get_by_full_id(&lookup_id).ok()?
    })
    .await
    .ok()??;

    let req = crate::fabric_model_routes::ResponsesRequest {
        model: model_full_id,
        messages: vec![
            crate::fabric_model_routes::Message {
                role: "system".to_string(),
                content: "You normalize a user request into a canonical work intent. \
                          Reply with ONLY a JSON object: \
                          {\"action_type\": \"<snake_case prefix, e.g. shell_steps, research>\", \
                           \"description\": \"<one sentence>\"}."
                    .to_string(),
            },
            crate::fabric_model_routes::Message {
                role: "user".to_string(),
                content: message.to_string(),
            },
        ],
        max_tokens: Some(150),
        temperature: Some(0.0),
    };
    let request_id = uuid::Uuid::new_v4().to_string();
    let completion = crate::fabric_model_routes::run_completion(
        state,
        &org,
        user,
        &request_id,
        &model,
        &req,
    )
    .await
    .map_err(|e| {
        warn!(error = ?e.body.0, "Al model-assisted extraction failed; falling back");
    })
    .ok()?;
    parse_model_extraction(&completion.1)
}

/// Talk to Al. Al normalizes the request, resolves the delegation target
/// from the workspace rules, submits a canonical intent under its own
/// principal, and narrates the result. Al claims nothing and executes
/// nothing.
async fn al_chat(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(req): Json<AlChatRequest>,
) -> Result<Json<Value>, AlError> {
    let user = get_user(&headers).ok_or_else(|| {
        AlError::new(StatusCode::UNAUTHORIZED, "unauthorized", "authentication required")
    })?;
    let message = req.message.trim().to_string();
    if message.is_empty() {
        return Err(AlError::new(
            StatusCode::BAD_REQUEST,
            "empty_message",
            "message must not be empty",
        ));
    }
    let session_id = req
        .session_id
        .clone()
        .unwrap_or_else(|| format!("als_{}", uuid::Uuid::new_v4()));
    let workspace = req.workspace.clone().unwrap_or_else(|| "default".to_string());
    let workspace = workspace
        .strip_prefix("a://workspace/")
        .unwrap_or(&workspace)
        .to_string();

    // Record the user's turn.
    let conn = state.db.connect().map_err(db_error)?;
    append_al_message(&conn, &user.user_id, &session_id, "user", &message, None, None)?;

    // Steps 1–3 (extract → resolve → submit) are shared with the SSE stream
    // so both surfaces narrate identically.
    match prepare_delegation(&state, &user, &session_id, &workspace, &message).await? {
        AlDelegation::NoRule { extracted, reply } => {
            let conn = state.db.connect().map_err(db_error)?;
            append_al_message(&conn, &user.user_id, &session_id, "assistant", &reply, None, None)?;
            Ok(Json(json!({
                "session_id": session_id,
                "reply": reply,
                "delegated": false,
                "reason": "no delegation rule matched",
                "extracted": { "action_type": extracted.action_type, "description": extracted.description },
            })))
        }
        AlDelegation::Delegated {
            target_principal,
            intent_id,
            run_id,
            action_type,
            description,
        } => {
            // 4. Narrate against canonical state: run state + pending approvals.
            let conn = state.db.connect().map_err(db_error)?;
            let run_state: Option<String> = conn
                .query_row(
                    "SELECT state FROM cowork_runs WHERE id = ?1",
                    rusqlite::params![run_id],
                    |r| r.get(0),
                )
                .ok();
            let pending_approvals: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM cowork_approval_bindings WHERE run_id = ?1 AND status = 'pending'",
                    rusqlite::params![run_id],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            let run_state_str = run_state.clone().unwrap_or_else(|| "queued".to_string());
            let reply = format!(
                "Delegated to {target_principal} (run {run_id}, state {run_state_str}). {pending_approvals} approval(s) pending.",
            );
            append_al_message(
                &conn,
                &user.user_id,
                &session_id,
                "assistant",
                &reply,
                Some(&intent_id),
                Some(&run_id),
            )?;

            info!(
                user = %user.user_id,
                session = %session_id,
                intent = %intent_id,
                run = %run_id,
                target = %target_principal,
                "Al persona delegated a request"
            );

            Ok(Json(json!({
                "session_id": session_id,
                "reply": reply,
                "delegated": true,
                "intent_id": intent_id,
                "run_id": run_id,
                "target": target_principal,
                "run_state": run_state,
                "pending_approvals": pending_approvals,
                "extracted": { "action_type": action_type, "description": description },
            })))
        }
    }
}

/// Consumer-packaged Cowork P2 — chat drives A://. The same Al delegation
/// as `al_chat`, streamed: `delegation` → `run_state` → `approval` /
/// `approval_decision` → `result` → `finish`, with narration as
/// `content_block_delta` text (the frame family the chat client already
/// parses). Every request becomes a canonical intent → orchestrator
/// delegation → leased worker run; nothing here bypasses Fabric Transport.
async fn al_chat_stream(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(req): Json<AlChatRequest>,
) -> Result<Response, AlError> {
    let user = get_user(&headers).ok_or_else(|| {
        AlError::new(StatusCode::UNAUTHORIZED, "unauthorized", "authentication required")
    })?;
    let message = req.message.trim().to_string();
    if message.is_empty() {
        return Err(AlError::new(
            StatusCode::BAD_REQUEST,
            "empty_message",
            "message must not be empty",
        ));
    }
    let session_id = req
        .session_id
        .clone()
        .unwrap_or_else(|| format!("als_{}", uuid::Uuid::new_v4()));
    let workspace = req.workspace.clone().unwrap_or_else(|| "default".to_string());
    let workspace = workspace
        .strip_prefix("a://workspace/")
        .unwrap_or(&workspace)
        .to_string();

    {
        let conn = state.db.connect().map_err(db_error)?;
        append_al_message(&conn, &user.user_id, &session_id, "user", &message, None, None)?;
    }

    let delegation =
        prepare_delegation(&state, &user, &session_id, &workspace, &message).await?;

    let db = state.db.clone();
    let uid = user.user_id.clone();
    let stream = async_stream::stream! {
        match delegation {
            AlDelegation::NoRule { reply, .. } => {
                yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                    "type": "content_block_delta",
                    "delta": { "type": "text_delta", "text": reply },
                }).to_string()));
                if let Ok(conn) = db.connect() {
                    let _ = append_al_message(&conn, &uid, &session_id, "assistant", &reply, None, None);
                }
                yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                    "type": "finish", "status": "complete", "metadata": { "status": "complete" },
                }).to_string()));
                return;
            }
            AlDelegation::Delegated {
                target_principal,
                intent_id,
                run_id,
                action_type,
                description,
            } => {
                let narration = format!("Delegated to {target_principal} (run {run_id}).");
                yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                    "type": "delegation",
                    "intent_id": intent_id,
                    "run_id": run_id,
                    "target": target_principal,
                    "action_type": action_type,
                    "description": description,
                }).to_string()));
                yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                    "type": "content_block_delta",
                    "delta": { "type": "text_delta", "text": narration.clone() },
                }).to_string()));
                if let Ok(conn) = db.connect() {
                    let _ = append_al_message(&conn, &uid, &session_id, "assistant", &narration, Some(&intent_id), Some(&run_id));
                }

                // Poll canonical state until the run is terminal (or the
                // client disconnects, which drops the stream).
                let mut last_state = String::new();
                let mut seen_approvals: std::collections::HashSet<String> = Default::default();
                let deadline = std::time::Instant::now() + Duration::from_secs(15 * 60);
                loop {
                    if std::time::Instant::now() > deadline {
                        yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                            "type": "error", "message": "narration timed out waiting for the run to finish",
                        }).to_string()));
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(900)).await;

                    #[derive(Default)]
                    struct Snapshot {
                        state: String,
                        terminal: bool,
                        result: Option<Value>,
                        approvals: Vec<(String, String, String, String, Option<String>)>, // id, capability, target, status, decided_by
                    }
                    let snap = (|| -> Snapshot {
                        let mut snap = Snapshot::default();
                        let Ok(conn) = db.connect() else { return snap };
                        let row: Option<(String, Option<String>)> = conn
                            .query_row(
                                "SELECT state, completed_at FROM cowork_runs WHERE id = ?1",
                                rusqlite::params![run_id],
                                |r| Ok((r.get(0)?, r.get(1)?)),
                            )
                            .ok();
                        if let Some((state, completed)) = row {
                            snap.state = state.clone();
                            snap.terminal = completed.is_some()
                                || matches!(state.as_str(), "completed" | "failed" | "cancelled");
                        }
                        if snap.terminal {
                            snap.result = conn
                                .query_row(
                                    "SELECT result FROM cowork_jobs WHERE run_id = ?1 AND result IS NOT NULL ORDER BY completed_at DESC LIMIT 1",
                                    rusqlite::params![run_id],
                                    |r| r.get::<_, Option<String>>(0),
                                )
                                .ok()
                                .flatten()
                                .and_then(|raw| serde_json::from_str(&raw).ok());
                        }
                        let mut stmt = match conn.prepare(
                            "SELECT id, capability, target, status, decided_by FROM cowork_approval_bindings WHERE run_id = ?1 ORDER BY created_at ASC",
                        ) {
                            Ok(stmt) => stmt,
                            Err(_) => return snap,
                        };
                        if let Ok(rows) = stmt.query_map(rusqlite::params![run_id], |r| {
                            Ok((
                                r.get::<_, String>(0)?,
                                r.get::<_, String>(1)?,
                                r.get::<_, String>(2)?,
                                r.get::<_, String>(3)?,
                                r.get::<_, Option<String>>(4)?,
                            ))
                        }) {
                            snap.approvals = rows.filter_map(|r| r.ok()).collect();
                        }
                        snap
                    })();

                    if snap.state != last_state {
                        last_state = snap.state.clone();
                        yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                            "type": "run_state", "run_id": run_id, "state": snap.state,
                        }).to_string()));
                    }
                    for (id, capability, target, status, decided_by) in &snap.approvals {
                        if status == "pending" && seen_approvals.insert(id.clone()) {
                            yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                                "type": "approval",
                                "approval_id": id,
                                "run_id": run_id,
                                "capability": capability,
                                "target": target,
                            }).to_string()));
                        } else if status != "pending" && seen_approvals.contains(id) {
                            seen_approvals.remove(id);
                            yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                                "type": "approval_decision",
                                "approval_id": id,
                                "status": status,
                                "decided_by": decided_by,
                            }).to_string()));
                        }
                    }
                    if snap.terminal {
                        let summary = snap
                            .result
                            .as_ref()
                            .and_then(|r| r.get("summary").and_then(|v| v.as_str()).map(str::to_string))
                            .unwrap_or_else(|| format!("run {run_id} finished ({})", snap.state));
                        yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                            "type": "result", "run_id": run_id, "state": snap.state, "result": snap.result,
                        }).to_string()));
                        yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                            "type": "content_block_delta",
                            "delta": { "type": "text_delta", "text": format!("Done: {summary}") },
                        }).to_string()));
                        if let Ok(conn) = db.connect() {
                            let _ = append_al_message(&conn, &uid, &session_id, "assistant", &format!("Done: {summary}"), Some(&intent_id), Some(&run_id));
                        }
                        yield Ok::<axum::response::sse::Event, std::convert::Infallible>(Event::default().data(json!({
                            "type": "finish", "status": snap.state, "metadata": { "status": snap.state },
                        }).to_string()));
                        break;
                    }
                }
            }
        }
    };

    Ok(Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response())
}

/// Transcript + observed canonical run states for a session (the control
/// surface renders canonical state, never model recollection).
async fn get_al_session(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(session_id): Path<String>,
) -> Result<Json<Value>, AlError> {
    let user = get_user(&headers).ok_or_else(|| {
        AlError::new(StatusCode::UNAUTHORIZED, "unauthorized", "authentication required")
    })?;
    let conn = state.db.connect().map_err(db_error)?;
    let mut stmt = conn
        .prepare(
            "SELECT m.role, m.content, m.intent_id, m.run_id, m.created_at,
                    COALESCE(r.state, '')
             FROM cowork_al_messages m
             LEFT JOIN cowork_runs r ON r.id = m.run_id
             WHERE m.session_id = ?1 AND m.user_id = ?2
             ORDER BY m.created_at ASC",
        )
        .map_err(db_error)?;
    let messages: Vec<Value> = stmt
        .query_map(rusqlite::params![session_id, user.user_id], |r| {
            Ok(json!({
                "role": r.get::<_, String>(0)?,
                "content": r.get::<_, String>(1)?,
                "intent_id": r.get::<_, Option<String>>(2)?,
                "run_id": r.get::<_, Option<String>>(3)?,
                "created_at": r.get::<_, String>(4)?,
                "run_state": r.get::<_, String>(5)?,
            }))
        })
        .map_err(db_error)?
        .collect::<Result<_, _>>()
        .map_err(db_error)?;
    Ok(Json(json!({ "session_id": session_id, "messages": messages })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_extract_first_word_action_type() {
        let intent = fallback_extract("shell_steps run the build and report");
        assert_eq!(intent.action_type, "shell_steps");
        assert_eq!(intent.description, "shell_steps run the build and report");

        let punct = fallback_extract("git-sync please reconcile branches");
        assert_eq!(punct.action_type, "git_sync");

        let empty = fallback_extract("   ");
        assert_eq!(empty.action_type, "chat");
    }

    #[test]
    fn parse_model_extraction_strict_json() {
        let text = "Here you go: {\"action_type\": \"research\", \"description\": \"Compare vendors.\"} hope that helps";
        let parsed = parse_model_extraction(text).unwrap();
        assert_eq!(parsed.action_type, "research");
        assert_eq!(parsed.description, "Compare vendors.");

        assert!(parse_model_extraction("no json here").is_none());
        assert!(parse_model_extraction("{\"action_type\": \"\"}").is_none());
        // description defaults to action_type when absent
        let nodesc = parse_model_extraction("{\"action_type\": \"shell\"}").unwrap();
        assert_eq!(nodesc.description, "shell");
    }

    #[test]
    fn canonicalize_target_matches_orchestrator_rules() {
        assert_eq!(
            canonicalize_target("acme", "gizzi"),
            "a://workspace/acme/principal/gizzi"
        );
        assert_eq!(
            canonicalize_target("acme", "bot/research"),
            "a://workspace/acme/bot/research"
        );
        assert_eq!(
            canonicalize_target("acme", "a://workspace/acme/principal/x"),
            "a://workspace/acme/principal/x"
        );
    }

    #[test]
    fn al_envelope_posture_delegates_without_executing() {
        // Al's envelope: delegator = al, chain [user, al], target = worker.
        // Al never claims, so executor attribution stays with the worker —
        // the envelope carries no executor field at all.
        let envelope = IntentEnvelope {
            version: "a/0.1".to_string(),
            intent_id: "al_test".to_string(),
            workspace: "a://workspace/acme".to_string(),
            initiator: "user_1".to_string(),
            delegator: Some("a://workspace/acme/principal/al".to_string()),
            target: Some("a://workspace/acme/principal/gizzi".to_string()),
            action: IntentAction {
                action_type: "shell_steps".to_string(),
                description: "do the thing".to_string(),
                payload: None,
            },
            permissions: vec![],
            compute: None,
            model: None,
            approval: None,
            return_channel: None,
            causation_chain: vec![
                "user_1".to_string(),
                "a://workspace/acme/principal/al".to_string(),
            ],
        };
        assert!(envelope.delegator.as_ref().unwrap().ends_with("/principal/al"));
        assert_eq!(envelope.causation_chain.len(), 2);
        assert!(!envelope.target.as_ref().unwrap().ends_with("/principal/al"));
    }
}
