//! Public Cloud Agents API (`/sessions`).
//!
//! Phase 1 facade over the durable beta session layer (`beta_session_routes`).
//! Both surfaces read and write the same `beta_sessions` /
//! `beta_session_events` / `beta_work_tasks` tables; the public surface
//! differs in three ways:
//!
//! 1. Routes live directly under `/api/v1/sessions` (no `/beta` prefix).
//! 2. Session JSON uses public status names (`idle`, `running`, `waiting`,
//!    `failed`, `archived`) derived from the row status plus in-flight work,
//!    rather than the stored `active`/`archived` vocabulary.
//! 3. Events are emitted with Allternit type names (`session.created`,
//!    `user.message`, `agent.message`, …). The stored history keeps the
//!    legacy vocabulary; translation happens on read.
//!
//! Completions/Responses (`agents_v1_routes`) are a separate Layer A surface
//! and are untouched here. There is deliberately no public `/runtimes`
//! resource and no `OpenAI-Beta` header requirement.

use axum::{
    extract::{Extension, Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures::Stream;
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{HashSet, VecDeque};
use std::{convert::Infallible, sync::Arc, time::Duration};

use crate::{
    auth::AuthUser,
    beta_session_routes as beta, error::ApiError, webhook_subscription_routes, AppState,
};

pub fn cloud_agents_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/sessions", get(list_cloud_sessions).post(create_cloud_session))
        .route("/sessions/:id", get(get_cloud_session))
        .route("/sessions/:id/archive", post(archive_cloud_session))
        .route(
            "/sessions/:id/events",
            get(list_cloud_events).post(send_cloud_events),
        )
        .route("/sessions/:id/events/stream", get(stream_cloud_events))
}

// ─── Request bodies ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum AgentRef {
    Id(String),
    Ref {
        id: String,
        version: Option<i64>,
    },
    Inline(InlineAgent),
}

#[derive(Debug, Deserialize)]
struct InlineAgent {
    model: String,
    #[serde(default)]
    instructions: Option<String>,
    #[serde(default)]
    tools: Option<Value>,
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ComputerSpec {
    #[serde(default = "default_computer_kind")]
    kind: String,
}

fn default_computer_kind() -> String {
    "none".to_string()
}

#[derive(Debug, Deserialize)]
struct CloudBudget {
    max_tokens: Option<u64>,
    max_turns: Option<u64>,
    max_tool_calls: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct CreateCloudSessionBody {
    #[serde(default)]
    agent: Option<AgentRef>,
    #[serde(default)]
    computer: Option<ComputerSpec>,
    #[serde(default)]
    input: Option<Value>,
    #[serde(default)]
    stream: bool,
    #[serde(default)]
    vault_ids: Option<Value>,
    #[serde(default)]
    budget: Option<CloudBudget>,
    #[serde(default = "empty_object")]
    metadata: Value,
    #[serde(default)]
    brain_id: Option<Value>,
}

fn empty_object() -> Value {
    json!({})
}

#[derive(Debug, Deserialize)]
struct SendEvent {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    content: Option<Value>,
    #[serde(default)]
    data: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct SendEventsBody {
    events: Vec<SendEvent>,
}

#[derive(Debug, Deserialize)]
struct EventQuery {
    after: Option<i64>,
}

// ─── Public shape mapping ────────────────────────────────────────────────────

/// Public status names. Stored rows keep the legacy `active`/`archived`
/// vocabulary (so the beta alias keeps working byte-for-byte); the public
/// surface derives `idle`/`running` from in-flight work on the session.
fn public_status(db_status: &str, in_flight: bool) -> &'static str {
    match db_status {
        "archived" => "archived",
        "failed" => "failed",
        "waiting" => "waiting",
        "idle" => "idle",
        "running" => "running",
        // Legacy `active` rows: running only while work is actually queued.
        _ => {
            if in_flight {
                "running"
            } else {
                "idle"
            }
        }
    }
}

fn public_session(session: &beta::SessionRow, in_flight: bool) -> Value {
    json!({
        "id": session.id,
        "agent_id": session.agent_id,
        "name": session.name,
        "status": public_status(&session.status, in_flight),
        "metadata": session.metadata,
        "budget": session.budget,
        "computer": {
            "kind": session.computer_kind.clone().unwrap_or_else(|| "none".to_string()),
            "id": session.computer_id,
        },
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "archived_at": session.archived_at,
    })
}

/// Translate one stored (legacy) event row into zero or more public events.
/// Stored `session_archived`, budget/context bookkeeping, and token deltas
/// are intentionally omitted from the public stream.
fn translate_event(
    event_id: &str,
    sequence: i64,
    session_id: &str,
    event_type: &str,
    data: Value,
    created_at: &str,
) -> Vec<Value> {
    let base = |ty: &str, data: Value, public_id: String| {
        json!({
            "id": public_id,
            "sequence": sequence,
            "type": ty,
            "session_id": session_id,
            "created_at": created_at,
            "data": data,
        })
    };
    match event_type {
        "session_created" => vec![base("session.created", data, event_id.to_string())],
        "computer_ready" => vec![base("computer.ready", data, event_id.to_string())],
        "computer_pending" => vec![base("computer.pending", data, event_id.to_string())],
        "computer_failed" => vec![base("computer.failed", data, event_id.to_string())],
        "run_requested" => vec![
            base(
                "turn.started",
                data.clone(),
                format!("{event_id}:turn.started"),
            ),
            base(
                "session.running",
                data,
                format!("{event_id}:session.running"),
            ),
        ],
        "user_interrupt" => vec![base("user.interrupt", data, event_id.to_string())],
        "tool_calls" => vec![base("agent.tool_use", data, event_id.to_string())],
        _ => vec![],
    }
}

fn parse_public_events(
    session_id: &str,
    rows: Vec<(i64, String, String, String, String)>,
) -> Vec<Value> {
    // (sequence, event_id, event_type, data, created_at), ascending.
    rows.into_iter()
        .flat_map(|(sequence, event_id, event_type, data, created_at)| {
            let data = serde_json::from_str(&data).unwrap_or_else(|_| json!({}));
            translate_event(&event_id, sequence, session_id, &event_type, data, &created_at)
        })
        .collect()
}

/// Session ids with queued/leased/running work tasks, scoped to one user.
async fn sessions_with_in_flight_work(state: Arc<AppState>, user_id: String) -> HashSet<String> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT DISTINCT session_id FROM beta_work_tasks
             WHERE user_id = ?1 AND session_id IS NOT NULL
             AND status IN ('queued', 'leased', 'running')",
        )?;
        let ids = stmt
            .query_map(params![user_id], |row| row.get::<_, String>(0))?
            .collect::<Result<HashSet<String>, _>>()?;
        Ok::<HashSet<String>, rusqlite::Error>(ids)
    })
    .await
    .ok()
    .and_then(Result::ok)
    .unwrap_or_default()
}

// ─── Create / list / get / archive ───────────────────────────────────────────

async fn list_cloud_sessions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    let in_flight = sessions_with_in_flight_work(state.clone(), user.user_id.clone()).await;
    let db = state.db.clone();
    let user_id = user.user_id;
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(&format!(
            "{} WHERE user_id = ?1 ORDER BY created_at DESC",
            beta::SESSION_SELECT
        ))?;
        let rows = stmt
            .query_map(params![user_id], beta::read_session)?
            .collect::<Result<Vec<beta::SessionRow>, _>>()?;
        Ok::<Vec<beta::SessionRow>, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    let sessions = rows
        .iter()
        .map(|session| public_session(session, in_flight.contains(&session.id)))
        .collect::<Vec<Value>>();
    Ok(Json(json!({ "sessions": sessions })))
}

/// Extract the user-message text from the `input` field of a create body.
fn parse_input(input: &Option<Value>) -> Result<Option<String>, ApiError> {
    match input {
        None => Ok(None),
        Some(Value::String(text)) => {
            if text.trim().is_empty() {
                return Err(ApiError::BadRequest("input must not be empty".into()));
            }
            Ok(Some(text.clone()))
        }
        Some(Value::Object(map)) => {
            let ty = map.get("type").and_then(Value::as_str).unwrap_or("");
            if ty != "user.message" {
                return Err(ApiError::BadRequest(format!(
                    "unsupported input event type: {ty}"
                )));
            }
            match map.get("content").and_then(Value::as_str) {
                Some(text) if !text.trim().is_empty() => Ok(Some(text.to_string())),
                _ => Err(ApiError::BadRequest(
                    "input.content must be a non-empty string".into(),
                )),
            }
        }
        Some(_) => Err(ApiError::BadRequest(
            "input must be a string or a user.message object".into(),
        )),
    }
}

async fn create_cloud_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateCloudSessionBody>,
) -> Result<Response, ApiError> {
    if !body.metadata.is_object() {
        return Err(ApiError::BadRequest("metadata must be an object".into()));
    }
    let computer_kind = body
        .computer
        .as_ref()
        .map(|computer| computer.kind.clone())
        .unwrap_or_else(default_computer_kind);
    match computer_kind.as_str() {
        "none" | "local" => {}
        "sandbox" => {
            // Hosted sandbox provisioning is not wired to entitlements in this
            // release. Per the product contract this is a hard 400 — never a
            // silent downgrade to `none`.
            return Err(ApiError::BadRequest(
                "computer.kind \"sandbox\" requires a hosted computer entitlement that is not available on this account"
                    .into(),
            ));
        }
        other => {
            return Err(ApiError::BadRequest(format!(
                "unsupported computer.kind: {other}"
            )))
        }
    }
    let input_text = parse_input(&body.input)?;

    let db = state.db.clone();
    let organization_id = user.organization_id.clone();
    let user_id = user.user_id;
    let session_id = uuid::Uuid::new_v4().to_string();
    let result_session_id = session_id.clone();
    let webhook_session_id = session_id.clone();
    let run_input = input_text.is_some();
    let metadata = {
        let mut metadata = body.metadata.clone();
        if let Some(vault_ids) = &body.vault_ids {
            metadata
                .as_object_mut()
                .expect("metadata validated as object")
                .insert("vault_ids".to_string(), vault_ids.clone());
        }
        if let Some(brain_id) = &body.brain_id {
            metadata
                .as_object_mut()
                .expect("metadata validated as object")
                .insert("brain_id".to_string(), brain_id.clone());
        }
        metadata
    };
    let budget = body.budget;
    let agent_ref = body.agent;

    let session = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;

        // Resolve the agent reference to an agents-row id.
        let agent_id = match &agent_ref {
            None => None,
            Some(AgentRef::Id(id)) => {
                let exists = tx.query_row(
                    "SELECT EXISTS(SELECT 1 FROM agents WHERE id = ?1 AND user_id = ?2)",
                    params![id, user_id],
                    |row| row.get::<_, bool>(0),
                )?;
                if !exists {
                    return Err(rusqlite::Error::QueryReturnedNoRows);
                }
                Some(id.clone())
            }
            Some(AgentRef::Ref { id, version }) => {
                let row_version = tx
                    .query_row(
                        "SELECT version FROM agents WHERE id = ?1 AND user_id = ?2",
                        params![id, user_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .optional()?;
                let row_version = match row_version {
                    Some(version) => version,
                    None => return Err(rusqlite::Error::QueryReturnedNoRows),
                };
                if let Some(expected) = version {
                    if *expected != row_version {
                        return Err(rusqlite::Error::IntegralValueOutOfRange(0, *expected));
                    }
                }
                Some(id.clone())
            }
            Some(AgentRef::Inline(inline)) => {
                if inline.model.trim().is_empty() {
                    return Err(rusqlite::Error::InvalidParameterName(
                        "agent.model must be a non-empty string".to_string(),
                    ));
                }
                let agent_id = uuid::Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO agents (id, user_id, name, model, provider, system_prompt,
                                         tools, status, type)
                     VALUES (?1, ?2, ?3, ?4, 'allternit', ?5, ?6, 'idle', 'worker')",
                    params![
                        agent_id,
                        user_id,
                        inline.name.clone().unwrap_or_else(|| "cloud-agent".to_string()),
                        inline.model.as_str(),
                        inline.instructions.clone(),
                        inline.tools.as_ref().map(Value::to_string),
                    ],
                )?;
                Some(agent_id)
            }
        };

        tx.execute(
            "INSERT INTO beta_sessions
             (id, user_id, agent_id, metadata, max_tokens, max_turns, max_tool_calls,
              status, computer_kind)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'active', ?8)",
            params![
                session_id,
                user_id,
                agent_id,
                metadata.to_string(),
                budget.as_ref().and_then(|b| b.max_tokens),
                budget.as_ref().and_then(|b| b.max_turns),
                budget.as_ref().and_then(|b| b.max_tool_calls),
                computer_kind,
            ],
        )?;
        beta::insert_event(&tx, &session_id, "session_created", &json!({}))?;
        match computer_kind.as_str() {
            // `none`: nothing to provision; the computer is immediately ready.
            "none" => {
                beta::insert_event(
                    &tx,
                    &session_id,
                    "computer_ready",
                    &json!({"kind": "none"}),
                )?;
            }
            // `local`: descriptor only this release — no worker is awaited.
            "local" => {
                beta::insert_event(
                    &tx,
                    &session_id,
                    "computer_pending",
                    &json!({"kind": "local"}),
                )?;
            }
            _ => {}
        }
        if let Some(text) = input_text {
            let task_id = uuid::Uuid::new_v4().to_string();
            let payload = json!({
                "messages": [{"role": "user", "content": text}],
                "tools": Value::Null,
            });
            tx.execute(
                "INSERT INTO beta_work_tasks (id, user_id, session_id, payload)
                 VALUES (?1, ?2, ?3, ?4)",
                params![task_id, user_id, session_id, payload.to_string()],
            )?;
            beta::insert_event(
                &tx,
                &session_id,
                "run_requested",
                &json!({"task_id": task_id, "message_count": 1}),
            )?;
        }
        let session = tx.query_row(
            &format!("{} WHERE id = ?1", beta::SESSION_SELECT),
            params![session_id],
            beta::read_session,
        )?;
        tx.commit()?;
        Ok::<beta::SessionRow, rusqlite::Error>(session)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            ApiError::BadRequest("agent not found".into())
        }
        rusqlite::Error::IntegralValueOutOfRange(_, expected) => ApiError::BadRequest(format!(
            "agent version mismatch: expected version {expected}"
        )),
        rusqlite::Error::InvalidParameterName(msg) => ApiError::BadRequest(msg),
        other => ApiError::DbError(other.to_string()),
    })?;

    let public = public_session(&session, run_input);
    webhook_subscription_routes::deliver_session_event(
        state.clone(),
        organization_id.as_deref(),
        &webhook_session_id,
        &json!({"type": "session.created", "session_id": result_session_id}),
    )
    .await;

    if body.stream {
        // SSE of this session's events, replayed from the beginning so the
        // first frames include session.created.
        let stream = public_event_stream(state, result_session_id.clone(), 0);
        return Ok(stream.into_response());
    }
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "session": public }))).into_response())
}

async fn get_cloud_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let session = beta::load_session(state.clone(), user.user_id.clone(), id.clone()).await?;
    let in_flight = sessions_with_in_flight_work(state, user.user_id).await;
    Ok(Json(json!({ "session": public_session(&session, in_flight.contains(&id)) })))
}

async fn archive_cloud_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;
        let affected = tx.execute(
            "UPDATE beta_sessions SET status = 'archived', archived_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2",
            params![id, user.user_id],
        )?;
        if affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        beta::insert_event(&tx, &id, "session_archived", &json!({}))?;
        tx.commit()
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e| {
        if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            ApiError::NotFound("session not found".into())
        } else {
            ApiError::DbError(e.to_string())
        }
    })?;
    Ok(Json(json!({ "archived": true })))
}

// ─── Events ──────────────────────────────────────────────────────────────────

async fn list_cloud_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    beta::load_session(state.clone(), user.user_id.clone(), id.clone()).await?;
    let db = state.db.clone();
    let user_id = user.user_id;
    let session_id = id.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT e.sequence, e.id, e.event_type, e.data, e.created_at
             FROM beta_session_events e
             JOIN beta_sessions s ON s.id = e.session_id
             WHERE e.session_id = ?1 AND s.user_id = ?2
             ORDER BY e.sequence ASC",
        )?;
        let rows = stmt
            .query_map(params![session_id, user_id], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<Vec<(i64, String, String, String, String)>, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e| ApiError::DbError(e.to_string()))?;
    Ok(Json(json!({ "events": parse_public_events(&id, rows) })))
}

/// `POST /sessions/:id/events` — accept `user.message`, `user.interrupt`,
/// and `user.tool_result`. `user.message` enqueues a run on the node's work
/// queue exactly like `POST /beta/sessions/:id/run`; `user.interrupt`
/// cancels queued/leased work and returns the session to `idle`.
async fn send_cloud_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<SendEventsBody>,
) -> Result<Json<Value>, ApiError> {
    if body.events.is_empty() {
        return Err(ApiError::BadRequest("events must be a non-empty array".into()));
    }
    for event in &body.events {
        if !matches!(
            event.kind.as_str(),
            "user.message" | "user.interrupt" | "user.tool_result"
        ) {
            return Err(ApiError::BadRequest(format!(
                "unsupported event type: {}",
                event.kind
            )));
        }
        if event.kind == "user.message" {
            match event.content.as_ref().and_then(Value::as_str) {
                Some(text) if !text.trim().is_empty() => {}
                _ => {
                    return Err(ApiError::BadRequest(
                        "user.message content must be a non-empty string".into(),
                    ))
                }
            }
        }
    }
    let session = beta::load_session(state.clone(), user.user_id.clone(), id.clone()).await?;
    if session.status == "archived" {
        return Err(ApiError::BadRequest(
            "archived sessions cannot accept events".into(),
        ));
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let organization_id = user.organization_id.clone();
    let mut delivered: Vec<Value> = Vec::new();
    for event in body.events {
        let db = db.clone();
        let session_id = id.clone();
        let user_id = user_id.clone();
        let accepted = tokio::task::spawn_blocking(move || {
            let mut conn = db.connect()?;
            let tx = conn.transaction()?;
            match event.kind.as_str() {
                "user.message" => {
                    let text = event
                        .content
                        .as_ref()
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string();
                    let task_id = uuid::Uuid::new_v4().to_string();
                    let payload = json!({
                        "messages": [{"role": "user", "content": text}],
                        "tools": Value::Null,
                    });
                    tx.execute(
                        "INSERT INTO beta_work_tasks (id, user_id, session_id, payload)
                         VALUES (?1, ?2, ?3, ?4)",
                        params![task_id, user_id, session_id, payload.to_string()],
                    )?;
                    let event = beta::insert_event(
                        &tx,
                        &session_id,
                        "run_requested",
                        &json!({"task_id": task_id, "message_count": 1}),
                    )?;
                    tx.commit()?;
                    Ok::<Value, rusqlite::Error>(event)
                }
                "user.interrupt" => {
                    tx.execute(
                        "UPDATE beta_work_tasks SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                         WHERE session_id = ?1 AND user_id = ?2
                         AND status IN ('queued', 'leased', 'running')",
                        params![session_id, user_id],
                    )?;
                    let event = beta::insert_event(
                        &tx,
                        &session_id,
                        "user_interrupt",
                        &event.data.clone().unwrap_or_else(|| json!({})),
                    )?;
                    tx.commit()?;
                    Ok::<Value, rusqlite::Error>(event)
                }
                // user.tool_result: accepted for forward compatibility; there is
                // no in-line consumer in Phase 1, so it is recorded for the
                // record and skipped by the public event projection.
                _ => {
                    let event = beta::insert_event(
                        &tx,
                        &session_id,
                        "user_tool_result",
                        &event
                            .data
                            .clone()
                            .or_else(|| event.content.clone())
                            .unwrap_or_else(|| json!({})),
                    )?;
                    tx.commit()?;
                    Ok::<Value, rusqlite::Error>(event)
                }
            }
        })
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .map_err(|e| ApiError::DbError(e.to_string()))?;
        delivered.push(accepted);
    }
    for event in &delivered {
        webhook_subscription_routes::deliver_session_event(
            state.clone(),
            organization_id.as_deref(),
            &id,
            event,
        )
        .await;
    }
    Ok(Json(json!({ "accepted": true })))
}

/// SSE stream of public (Allternit-named) events. Stored rows are translated
/// on read, so legacy history replayed on connect already uses public names.
fn public_event_stream(
    state: Arc<AppState>,
    id: String,
    after: i64,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let db = state.db.clone();
    let session_id = id.clone();
    let stream = futures::stream::unfold(
        (db, id, after, VecDeque::new()),
        move |(db, id, mut cursor, mut pending)| {
            let session_id = session_id.clone();
            async move {
                loop {
                    if let Some(event) = pending.pop_front() {
                        return Some((Ok(event), (db, id, cursor, pending)));
                    }
                    match beta::next_event(db.clone(), id.clone(), cursor).await {
                        Some((sequence, event_id, event_type, data, created_at)) => {
                            let data = serde_json::from_str(&data).unwrap_or_else(|_| json!({}));
                            for translated in
                                translate_event(&event_id, sequence, &session_id, &event_type, data, &created_at)
                            {
                                let ty = translated
                                    .get("type")
                                    .and_then(Value::as_str)
                                    .unwrap_or_default()
                                    .to_string();
                                pending.push_back(
                                    Event::default()
                                        .id(sequence.to_string())
                                        .event(ty)
                                        .data(translated.to_string()),
                                );
                            }
                            cursor = sequence;
                        }
                        None => tokio::time::sleep(Duration::from_millis(250)).await,
                    }
                }
            }
        },
    );
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn stream_cloud_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Query(query): Query<EventQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    beta::load_session(state.clone(), user.user_id, id.clone()).await?;
    Ok(public_event_stream(state, id, query.after.unwrap_or(0)))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use crate::beta_session_routes::tests as beta_test;

    fn request(path: &str, method: &str, body: &Value, user: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(path)
            .header("content-type", "application/json")
            .extension(beta_test::test_user(user))
            .body(Body::from(body.to_string()))
            .unwrap()
    }

    async fn post_json(
        router: &Router,
        path: &str,
        body: &Value,
        user: &str,
    ) -> (StatusCode, Value) {
        let response = router
            .clone()
            .oneshot(request(path, "POST", body, user))
            .await
            .unwrap();
        let status = response.status();
        let payload: Value = serde_json::from_slice(
            &response.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap_or_else(|_| json!({}));
        (status, payload)
    }

    async fn get_json(router: &Router, path: &str, user: &str) -> (StatusCode, Value) {
        let response = router
            .clone()
            .oneshot(request(path, "GET", &json!({}), user))
            .await
            .unwrap();
        let status = response.status();
        let payload: Value = serde_json::from_slice(
            &response.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap_or_else(|_| json!({}));
        (status, payload)
    }

    #[tokio::test]
    async fn create_with_inline_agent_none_computer_and_input() {
        let temp = beta_test::temp_dir("cloud-create");
        let state = beta_test::test_app_state(&temp).await;
        let router = cloud_agents_router().with_state(state.clone());

        let body = json!({
            "agent": {"model": "kimi-k2", "instructions": "Be terse.", "name": "helper"},
            "computer": {"kind": "none"},
            "input": "hello agent",
            "metadata": {"origin": "test"}
        });
        let (status, payload) = post_json(&router, "/sessions", &body, "user-a").await;
        assert_eq!(status, StatusCode::CREATED);
        let session = &payload["session"];
        assert_eq!(session["status"], "running");
        assert_eq!(session["computer"]["kind"], "none");
        assert!(session["agent_id"].is_string());

        // The inline agent became a real agents row; instructions → system_prompt.
        let conn = state.db.connect().unwrap();
        let (name, prompt): (String, Option<String>) = conn
            .query_row(
                "SELECT name, system_prompt FROM agents WHERE id = ?1",
                params![session["agent_id"].as_str().unwrap()],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(name, "helper");
        assert_eq!(prompt.as_deref(), Some("Be terse."));

        // Public event list uses Allternit type names.
        let session_id = session["id"].as_str().unwrap();
        let (status, events_payload) =
            get_json(&router, &format!("/sessions/{session_id}/events"), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        let types: Vec<&str> = events_payload["events"]
            .as_array()
            .unwrap()
            .iter()
            .map(|event| event["type"].as_str().unwrap())
            .collect();
        assert_eq!(types, vec!["session.created", "computer.ready", "turn.started", "session.running"]);
    }

    #[tokio::test]
    async fn sandbox_computer_without_entitlement_is_400() {
        let temp = beta_test::temp_dir("cloud-sandbox");
        let state = beta_test::test_app_state(&temp).await;
        let router = cloud_agents_router().with_state(state);

        let body = json!({
            "agent": {"model": "kimi-k2", "instructions": "hi"},
            "computer": {"kind": "sandbox"}
        });
        let (status, _) = post_json(&router, "/sessions", &body, "user-a").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn local_computer_emits_pending() {
        let temp = beta_test::temp_dir("cloud-local");
        let state = beta_test::test_app_state(&temp).await;
        let router = cloud_agents_router().with_state(state);

        let body = json!({
            "agent": {"model": "kimi-k2", "instructions": "hi"},
            "computer": {"kind": "local"}
        });
        let (status, payload) = post_json(&router, "/sessions", &body, "user-a").await;
        assert_eq!(status, StatusCode::CREATED);
        assert_eq!(payload["session"]["computer"]["kind"], "local");
        assert_eq!(payload["session"]["status"], "idle");

        let id = payload["session"]["id"].as_str().unwrap();
        let (status, events_payload) =
            get_json(&router, &format!("/sessions/{id}/events"), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        let types: Vec<&str> = events_payload["events"]
            .as_array()
            .unwrap()
            .iter()
            .map(|event| event["type"].as_str().unwrap())
            .collect();
        assert_eq!(types, vec!["session.created", "computer.pending"]);
    }

    #[tokio::test]
    async fn archive_blocks_send() {
        let temp = beta_test::temp_dir("cloud-archive");
        let state = beta_test::test_app_state(&temp).await;
        let router = cloud_agents_router().with_state(state);

        let create = json!({
            "agent": {"model": "kimi-k2", "instructions": "hi"},
            "computer": {"kind": "none"}
        });
        let (status, payload) = post_json(&router, "/sessions", &create, "user-a").await;
        assert_eq!(status, StatusCode::CREATED);
        let id = payload["session"]["id"].as_str().unwrap().to_string();

        let (status, _) = post_json(&router, &format!("/sessions/{id}/archive"), &json!({}), "user-a").await;
        assert_eq!(status, StatusCode::OK);

        let (status, payload) = get_json(&router, &format!("/sessions/{id}"), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["session"]["status"], "archived");

        let send = json!({"events": [{"type": "user.message", "content": "still there?"}]});
        let (status, _) = post_json(&router, &format!("/sessions/{id}/events"), &send, "user-a").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn interrupt_returns_session_to_idle() {
        let temp = beta_test::temp_dir("cloud-interrupt");
        let state = beta_test::test_app_state(&temp).await;
        let router = cloud_agents_router().with_state(state);

        let create = json!({
            "agent": {"model": "kimi-k2", "instructions": "hi"},
            "computer": {"kind": "none"},
            "input": "do a thing"
        });
        let (status, payload) = post_json(&router, "/sessions", &create, "user-a").await;
        assert_eq!(status, StatusCode::CREATED);
        let id = payload["session"]["id"].as_str().unwrap().to_string();
        assert_eq!(payload["session"]["status"], "running");

        let send = json!({"events": [{"type": "user.interrupt"}]});
        let (status, _) = post_json(&router, &format!("/sessions/{id}/events"), &send, "user-a").await;
        assert_eq!(status, StatusCode::OK);

        let (status, payload) = get_json(&router, &format!("/sessions/{id}"), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["session"]["status"], "idle");

        let (status, events_payload) =
            get_json(&router, &format!("/sessions/{id}/events"), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        let types: Vec<&str> = events_payload["events"]
            .as_array()
            .unwrap()
            .iter()
            .map(|event| event["type"].as_str().unwrap())
            .collect();
        assert!(types.contains(&"user.interrupt"));
    }

    #[tokio::test]
    async fn legacy_event_types_translate_to_allternit_names() {
        let temp = beta_test::temp_dir("cloud-translate");
        let state = beta_test::test_app_state(&temp).await;
        let router = cloud_agents_router().with_state(state.clone());

        let create = json!({
            "agent": {"model": "kimi-k2", "instructions": "hi"},
            "computer": {"kind": "none"}
        });
        let (status, payload) = post_json(&router, "/sessions", &create, "user-a").await;
        assert_eq!(status, StatusCode::CREATED);
        let id = payload["session"]["id"].as_str().unwrap().to_string();

        // Simulate history written by the legacy beta surface.
        let conn = state.db.connect().unwrap();
        beta::insert_event(&conn, &id, "run_requested", &json!({"task_id": "t1", "message_count": 1})).unwrap();
        beta::insert_event(&conn, &id, "user_interrupt", &json!({})).unwrap();
        beta::insert_event(&conn, &id, "budget_updated", &json!({"max_tokens": 5})).unwrap();
        beta::insert_event(&conn, &id, "session_archived", &json!({})).unwrap();
        beta::insert_event(&conn, &id, "content_block_delta", &json!({"delta": "x"})).unwrap();
        beta::insert_event(&conn, &id, "tool_calls", &json!([{"name": "bash"}])).unwrap();
        drop(conn);

        let (status, events_payload) =
            get_json(&router, &format!("/sessions/{id}/events"), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        let types: Vec<&str> = events_payload["events"]
            .as_array()
            .unwrap()
            .iter()
            .map(|event| event["type"].as_str().unwrap())
            .collect();
        assert_eq!(
            types,
            vec![
                "session.created",
                "computer.ready",
                "turn.started",
                "session.running",
                "user.interrupt",
                "agent.tool_use",
            ]
        );
        // Stored snake_case names must not leak. `agent.tool_use` is a public
        // Allternit type (underscore in the action, not a legacy separator).
        assert!(!types.iter().any(|ty| {
            matches!(
                *ty,
                "session_created"
                    | "run_requested"
                    | "user_interrupt"
                    | "budget_updated"
                    | "session_archived"
                    | "content_block_delta"
                    | "tool_calls"
                    | "computer_ready"
                    | "computer_pending"
            )
        }));
    }

    #[tokio::test]
    async fn beta_alias_still_works_on_same_table() {
        let temp = beta_test::temp_dir("cloud-alias");
        let state = beta_test::test_app_state(&temp).await;
        let router = beta::beta_session_router()
            .merge(cloud_agents_router())
            .with_state(state);

        // Legacy create is still 201.
        let (status, payload) = post_json(
            &router,
            "/beta/sessions",
            &json!({"name": "legacy", "metadata": {}}),
            "user-a",
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
        let id = payload["id"].as_str().unwrap().to_string();

        // Legacy retrieve is still 200.
        let (status, _) = get_json(&router, &format!("/beta/sessions/{id}"), "user-a").await;
        assert_eq!(status, StatusCode::OK);

        // The same row is visible through the public facade, status mapped.
        let (status, payload) = get_json(&router, &format!("/sessions/{id}"), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["session"]["status"], "idle");
        assert_eq!(payload["session"]["name"], "legacy");
    }
}
