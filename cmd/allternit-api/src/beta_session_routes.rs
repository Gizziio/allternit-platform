//! Managed agent session API (`/beta/sessions`).
//!
//! This is intentionally separate from `agent_session_routes`: those routes
//! proxy interactive Gizzi sessions, while this module owns the durable API
//! contract for managed runs, child threads, events, and execution budgets.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Path, Query, State,
    },
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use futures::{SinkExt, Stream, StreamExt};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{convert::Infallible, sync::Arc, time::Duration};

use crate::{auth::AuthUser, error::ApiError, AppState};

const APPENDABLE_RUN_EVENT_TYPES: &[&str] = &[
    "thinking_delta",
    "content_block_delta",
    "tool_calls",
    "refusal",
];

const RESOURCE_KINDS: &[&str] = &["github_token", "vault_credential", "api_key"];

fn empty_object() -> Value {
    json!({})
}

pub fn beta_session_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/beta/sessions", get(list_sessions).post(create_session))
        .route(
            "/beta/sessions/:id",
            get(get_session)
                .patch(update_session)
                .delete(archive_session),
        )
        .route(
            "/beta/sessions/:id/events",
            get(stream_events).post(append_event),
        )
        .route("/beta/sessions/:id/events/ws", get(stream_events_ws))
        .route("/beta/sessions/:id/interrupt", post(interrupt_session))
        .route(
            "/beta/sessions/:id/resources",
            get(list_resources).post(attach_resource),
        )
        .route(
            "/beta/sessions/:id/resources/:resource_id",
            delete(delete_resource),
        )
}

#[derive(Debug, Default, Deserialize)]
struct BudgetInput {
    max_tokens: Option<u64>,
    max_turns: Option<u64>,
    max_tool_calls: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct CreateSessionBody {
    agent_id: Option<String>,
    name: Option<String>,
    parent_thread_id: Option<String>,
    #[serde(default = "empty_object")]
    metadata: Value,
    #[serde(default)]
    budget: BudgetInput,
}

#[derive(Debug, Deserialize)]
struct UpdateSessionBody {
    name: Option<String>,
    metadata: Option<Value>,
    budget: Option<BudgetInput>,
}

#[derive(Debug, Deserialize)]
struct AppendEventBody {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    data: Value,
    #[serde(default)]
    usage: UsageDelta,
}

#[derive(Debug, Deserialize)]
struct InterruptBody {
    #[serde(default)]
    data: Value,
}

#[derive(Debug, Deserialize)]
struct AttachResourceBody {
    name: String,
    kind: String,
    value: Option<String>,
    #[serde(rename = "ref")]
    resource_ref: Option<String>,
}

#[derive(Debug, Serialize)]
struct ResourceRow {
    id: String,
    name: String,
    kind: String,
    #[serde(rename = "ref", skip_serializing_if = "Option::is_none")]
    resource_ref: Option<String>,
    created_at: String,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize)]
struct UsageDelta {
    tokens: u64,
    turns: u64,
    tool_calls: u64,
}

#[derive(Clone, Copy, Debug)]
struct BudgetState {
    max_tokens: Option<u64>,
    max_turns: Option<u64>,
    max_tool_calls: Option<u64>,
    tokens_used: u64,
    turns_used: u64,
    tool_calls_used: u64,
}

#[derive(Debug, Serialize)]
struct SessionRow {
    id: String,
    agent_id: Option<String>,
    name: Option<String>,
    parent_thread_id: Option<String>,
    status: String,
    metadata: Value,
    budget: Value,
    created_at: String,
    updated_at: String,
    archived_at: Option<String>,
}

fn read_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<SessionRow> {
    let metadata: String = row.get(5)?;
    Ok(SessionRow {
        id: row.get(0)?,
        agent_id: row.get(1)?,
        name: row.get(2)?,
        parent_thread_id: row.get(3)?,
        status: row.get(4)?,
        metadata: serde_json::from_str(&metadata).unwrap_or_else(|_| json!({})),
        budget: json!({
            "max_tokens": row.get::<_, Option<u64>>(6)?,
            "max_turns": row.get::<_, Option<u64>>(7)?,
            "max_tool_calls": row.get::<_, Option<u64>>(8)?,
            "tokens_used": row.get::<_, u64>(9)?,
            "turns_used": row.get::<_, u64>(10)?,
            "tool_calls_used": row.get::<_, u64>(11)?,
        }),
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
        archived_at: row.get(14)?,
    })
}

const SESSION_SELECT: &str = "SELECT id, agent_id, name, parent_thread_id, status, metadata,
    max_tokens, max_turns, max_tool_calls, tokens_used, turns_used, tool_calls_used,
    created_at, updated_at, archived_at FROM beta_sessions";

async fn create_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateSessionBody>,
) -> Result<(axum::http::StatusCode, Json<Value>), ApiError> {
    if !body.metadata.is_object() {
        return Err(ApiError::BadRequest("metadata must be an object".into()));
    }
    let db = state.db.clone();
    let user_id = user.user_id;
    let id = uuid::Uuid::new_v4().to_string();
    let result_id = id.clone();
    let session = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;
        if let Some(parent_id) = body.parent_thread_id.as_deref() {
            let parent_exists = tx.query_row(
                "SELECT EXISTS(SELECT 1 FROM beta_sessions WHERE id = ?1 AND user_id = ?2)",
                params![parent_id, user_id],
                |row| row.get::<_, bool>(0),
            )?;
            if !parent_exists {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }
        }
        tx.execute(
            "INSERT INTO beta_sessions
             (id, user_id, agent_id, name, parent_thread_id, metadata, max_tokens, max_turns, max_tool_calls)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, user_id, body.agent_id, body.name, body.parent_thread_id,
                body.metadata.to_string(), body.budget.max_tokens, body.budget.max_turns,
                body.budget.max_tool_calls],
        )?;
        insert_event(&tx, &id, "session_created", &json!({}))?;
        insert_event(&tx, &id, "budget_updated", &budget_limits_json(&body.budget))?;
        let session = tx.query_row(
            &format!("{SESSION_SELECT} WHERE id = ?1"),
            params![id],
            read_session,
        )?;
        tx.commit()?;
        Ok::<SessionRow, rusqlite::Error>(session)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => ApiError::BadRequest("parent_thread_id not found".into()),
        other => ApiError::DbError(other.to_string()),
    })?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({"session": session, "id": result_id})),
    ))
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    status: Option<String>,
    parent_thread_id: Option<String>,
}

async fn list_sessions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(&format!(
            "{SESSION_SELECT} WHERE user_id = ?1
             AND (?2 IS NULL OR status = ?2)
             AND (?3 IS NULL OR parent_thread_id = ?3)
             ORDER BY created_at DESC"
        ))?;
        let rows = stmt
            .query_map(
                params![user.user_id, query.status, query.parent_thread_id],
                read_session,
            )?
            .collect::<Result<Vec<SessionRow>, _>>()?;
        Ok::<Vec<SessionRow>, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    Ok(Json(json!({"sessions": rows})))
}

async fn get_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let session = load_session(state, user.user_id, id).await?;
    Ok(Json(json!({"session": session})))
}

async fn load_session(
    state: Arc<AppState>,
    user_id: String,
    id: String,
) -> Result<SessionRow, ApiError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            &format!("{SESSION_SELECT} WHERE id = ?1 AND user_id = ?2"),
            params![id, user_id],
            read_session,
        )
        .optional()
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??
    .ok_or_else(|| ApiError::NotFound("session not found".into()))
}

async fn update_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSessionBody>,
) -> Result<Json<Value>, ApiError> {
    if body.name.is_none() && body.metadata.is_none() && body.budget.is_none() {
        return Err(ApiError::BadRequest("no fields to update".into()));
    }
    if body
        .metadata
        .as_ref()
        .is_some_and(|value| !value.is_object())
    {
        return Err(ApiError::BadRequest("metadata must be an object".into()));
    }
    let db = state.db.clone();
    let user_id = user.user_id;
    let update_user_id = user_id.clone();
    let lookup_id = id.clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;
        let affected = tx.execute(
            "UPDATE beta_sessions SET
                name = COALESCE(?1, name), metadata = COALESCE(?2, metadata),
                max_tokens = CASE WHEN ?3 THEN ?4 ELSE max_tokens END,
                max_turns = CASE WHEN ?3 THEN ?5 ELSE max_turns END,
                max_tool_calls = CASE WHEN ?3 THEN ?6 ELSE max_tool_calls END,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?7 AND user_id = ?8",
            params![
                body.name,
                body.metadata.map(|v| v.to_string()),
                body.budget.is_some(),
                body.budget.as_ref().and_then(|b| b.max_tokens),
                body.budget.as_ref().and_then(|b| b.max_turns),
                body.budget.as_ref().and_then(|b| b.max_tool_calls),
                id,
                update_user_id
            ],
        )?;
        if affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        if let Some(budget) = body.budget {
            insert_event(&tx, &id, "budget_updated", &budget_limits_json(&budget))?;
        }
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
    let session = load_session(state, user_id, lookup_id).await?;
    Ok(Json(json!({"session": session})))
}
async fn archive_session(
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
        insert_event(&tx, &id, "session_archived", &json!({}))?;
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
    Ok(Json(json!({"archived": true})))
}

async fn append_event(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<AppendEventBody>,
) -> Result<Json<Value>, ApiError> {
    if !APPENDABLE_RUN_EVENT_TYPES.contains(&body.event_type.as_str()) {
        return Err(ApiError::BadRequest(
            "unsupported or reserved event type".into(),
        ));
    }
    let db = state.db.clone();
    let result =
        tokio::task::spawn_blocking(move || {
            let mut conn = db.connect()?;
            let tx = conn.transaction()?;
            let budget = tx.query_row(
            "SELECT max_tokens, max_turns, max_tool_calls, tokens_used, turns_used, tool_calls_used
             FROM beta_sessions WHERE id = ?1 AND user_id = ?2 AND status = 'active'",
            params![id, user.user_id],
            |row| Ok(BudgetState { max_tokens: row.get(0)?, max_turns: row.get(1)?,
                max_tool_calls: row.get(2)?, tokens_used: row.get(3)?, turns_used: row.get(4)?,
                tool_calls_used: row.get(5)? }),
        )?;
            if let Some(resource) = exceeded_budget(budget, body.usage) {
                let event = insert_event(
                    &tx,
                    &id,
                    "budget_exceeded",
                    &json!({
                        "resource": resource, "usage": body.usage, "budget": budget_json(budget)
                    }),
                )?;
                tx.commit()?;
                return Ok((false, event));
            }
            tx.execute(
            "UPDATE beta_sessions SET tokens_used = tokens_used + ?1, turns_used = turns_used + ?2,
             tool_calls_used = tool_calls_used + ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?4",
            params![body.usage.tokens, body.usage.turns, body.usage.tool_calls, id],
        )?;
            let event = insert_event(&tx, &id, &body.event_type, &body.data)?;
            tx.commit()?;
            Ok::<_, rusqlite::Error>((true, event))
        })
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .map_err(|e| {
            if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                ApiError::NotFound("active session not found".into())
            } else {
                ApiError::DbError(e.to_string())
            }
        })?;
    Ok(Json(json!({"accepted": result.0, "event": result.1})))
}

async fn interrupt_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<InterruptBody>,
) -> Result<Json<Value>, ApiError> {
    if !body.data.is_object() {
        return Err(ApiError::BadRequest("data must be an object".into()));
    }
    let session = load_session(state.clone(), user.user_id.clone(), id.clone()).await?;
    if session.status == "archived" {
        return Err(ApiError::BadRequest(
            "archived sessions cannot be interrupted".into(),
        ));
    }
    let db = state.db.clone();
    let event = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;
        let active = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM beta_sessions WHERE id = ?1 AND user_id = ?2 AND status = 'active')",
            params![id, user.user_id],
            |row| row.get::<_, bool>(0),
        )?;
        if !active {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        let event = insert_event(&tx, &id, "user_interrupt", &body.data)?;
        tx.commit()?;
        Ok::<Value, rusqlite::Error>(event)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e| {
        if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            ApiError::BadRequest("archived sessions cannot be interrupted".into())
        } else {
            ApiError::DbError(e.to_string())
        }
    })?;
    Ok(Json(json!({"event": event})))
}

async fn attach_resource(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<AttachResourceBody>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    if !RESOURCE_KINDS.contains(&body.kind.as_str()) {
        return Err(ApiError::BadRequest("unsupported resource kind".into()));
    }
    if body.value.as_ref().is_some_and(String::is_empty)
        || body.resource_ref.as_ref().is_some_and(String::is_empty)
        || (body.value.is_some() == body.resource_ref.is_some())
    {
        return Err(ApiError::BadRequest(
            "exactly one non-empty value or ref is required".into(),
        ));
    }
    load_session(state.clone(), user.user_id, id.clone()).await?;
    let db = state.db.clone();
    let resource_id = uuid::Uuid::new_v4().to_string();
    let result_id = resource_id.clone();
    let name = name.to_string();
    let resource = tokio::task::spawn_blocking(move || {
        let encrypted_value = match body.value {
            Some(value) => {
                if !crate::token_crypto::ensure_platform_key() {
                    return Err(rusqlite::Error::InvalidParameterName(
                        "session resource encryption key unavailable".into(),
                    ));
                }
                Some(crate::token_crypto::seal(&value))
            }
            None => None,
        };
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO beta_session_resources
             (id, session_id, name, kind, encrypted_value, resource_ref)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                resource_id,
                id,
                name,
                body.kind,
                encrypted_value,
                body.resource_ref
            ],
        )?;
        conn.query_row(
            "SELECT id, name, kind, resource_ref, created_at
             FROM beta_session_resources WHERE id = ?1",
            params![result_id],
            read_resource,
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    Ok((StatusCode::CREATED, Json(json!({"resource": resource}))))
}

async fn list_resources(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    load_session(state.clone(), user.user_id, id.clone()).await?;
    let db = state.db.clone();
    let resources = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, kind, resource_ref, created_at
             FROM beta_session_resources WHERE session_id = ?1 ORDER BY created_at, id",
        )?;
        let rows = stmt
            .query_map(params![id], read_resource)?
            .collect::<Result<Vec<ResourceRow>, _>>()?;
        Ok::<Vec<ResourceRow>, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    Ok(Json(json!({"resources": resources})))
}

async fn delete_resource(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, resource_id)): Path<(String, String)>,
) -> Result<StatusCode, ApiError> {
    let db = state.db.clone();
    let deleted = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM beta_session_resources WHERE id = ?1 AND session_id = ?2
             AND EXISTS(SELECT 1 FROM beta_sessions
                        WHERE id = ?2 AND user_id = ?3)",
            params![resource_id, id, user.user_id],
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    if deleted == 0 {
        return Err(ApiError::NotFound("resource not found".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

fn read_resource(row: &rusqlite::Row<'_>) -> rusqlite::Result<ResourceRow> {
    Ok(ResourceRow {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        resource_ref: row.get(3)?,
        created_at: row.get(4)?,
    })
}

#[derive(Debug, Deserialize)]
struct EventQuery {
    after: Option<i64>,
}

async fn stream_events_ws(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Query(query): Query<EventQuery>,
) -> Result<impl IntoResponse, ApiError> {
    load_session(state.clone(), user.user_id, id.clone()).await?;
    Ok(ws.on_upgrade(move |socket| {
        stream_events_to_websocket(socket, state.db.clone(), id, query.after.unwrap_or(0))
    }))
}

async fn stream_events_to_websocket(
    mut socket: WebSocket,
    db: crate::db::DbHandle,
    id: String,
    mut cursor: i64,
) {
    loop {
        if let Some((sequence, event_type, data)) = next_event(db.clone(), id.clone(), cursor).await
        {
            let data = serde_json::from_str::<Value>(&data).unwrap_or(Value::Null);
            let message = json!({"sequence": sequence, "type": event_type, "data": data});
            if socket
                .send(Message::Text(message.to_string()))
                .await
                .is_err()
            {
                break;
            }
            cursor = sequence;
        } else {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_millis(250)) => {},
                message = socket.recv() => {
                    if message.is_none() || message.is_some_and(|item| item.is_err()) {
                        break;
                    }
                }
            }
        }
    }
}

async fn next_event(
    db: crate::db::DbHandle,
    id: String,
    cursor: i64,
) -> Option<(i64, String, String)> {
    tokio::task::spawn_blocking(move || -> rusqlite::Result<Option<(i64, String, String)>> {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT sequence, event_type, data FROM beta_session_events
             WHERE session_id = ?1 AND sequence > ?2 ORDER BY sequence LIMIT 1",
            params![id, cursor],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
    })
    .await
    .ok()
    .and_then(Result::ok)
    .flatten()
}

async fn stream_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Query(query): Query<EventQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    load_session(state.clone(), user.user_id.clone(), id.clone()).await?;
    let db = state.db.clone();
    let stream = futures::stream::unfold(
        (db, id, query.after.unwrap_or(0)),
        |(db, id, cursor)| async move {
            loop {
                let next = next_event(db.clone(), id.clone(), cursor).await;
                if let Some((sequence, event_type, data)) = next {
                    let event = Event::default()
                        .id(sequence.to_string())
                        .event(event_type)
                        .data(data);
                    return Some((Ok(event), (db, id, sequence)));
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
        },
    );
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

fn insert_event(
    conn: &rusqlite::Connection,
    session_id: &str,
    event_type: &str,
    data: &Value,
) -> rusqlite::Result<Value> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO beta_session_events (id, session_id, event_type, data) VALUES (?1, ?2, ?3, ?4)",
        params![id, session_id, event_type, data.to_string()],
    )?;
    let sequence = conn.last_insert_rowid();
    Ok(
        json!({"id": id, "sequence": sequence, "session_id": session_id, "type": event_type, "data": data}),
    )
}

fn exceeded_budget(state: BudgetState, delta: UsageDelta) -> Option<&'static str> {
    if state
        .max_tokens
        .is_some_and(|limit| state.tokens_used.saturating_add(delta.tokens) > limit)
    {
        Some("tokens")
    } else if state
        .max_turns
        .is_some_and(|limit| state.turns_used.saturating_add(delta.turns) > limit)
    {
        Some("turns")
    } else if state
        .max_tool_calls
        .is_some_and(|limit| state.tool_calls_used.saturating_add(delta.tool_calls) > limit)
    {
        Some("tool_calls")
    } else {
        None
    }
}

fn budget_limits_json(budget: &BudgetInput) -> Value {
    json!({"max_tokens": budget.max_tokens, "max_turns": budget.max_turns,
        "max_tool_calls": budget.max_tool_calls})
}

fn budget_json(state: BudgetState) -> Value {
    json!({"max_tokens": state.max_tokens, "max_turns": state.max_turns,
        "max_tool_calls": state.max_tool_calls, "tokens_used": state.tokens_used,
        "turns_used": state.turns_used, "tool_calls_used": state.tool_calls_used})
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use std::collections::HashMap;
    use std::path::Path as FsPath;
    use std::sync::Once;
    use tokio::sync::RwLock;
    use tower::ServiceExt;

    fn test_user(id: &str) -> AuthUser {
        AuthUser {
            user_id: id.to_string(),
            email: Some(format!("{}@example.test", id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: None,
            organization_role: None,
            organization_slug: None,
        }
    }

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "allternit-beta-session-{}-{}",
            tag,
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    static TEST_KEY_INIT: Once = Once::new();

    fn init_test_encryption_key() {
        TEST_KEY_INIT.call_once(|| {
            std::env::set_var(
                "ALLTERNIT_ENCRYPTION_KEY",
                "test-session-resource-key-32bytes!",
            );
        });
    }

    async fn test_app_state(temp: &FsPath) -> Arc<AppState> {
        init_test_encryption_key();
        let config = crate::AppConfig {
            company: Default::default(),
            user: Default::default(),
        };
        let db = crate::db::DbHandle::new(temp.join("test.db")).expect("test db");
        let auth_config = crate::auth::AuthConfig::from_app_config(&config);
        let jwks = crate::auth::JwksManager::new(&auth_config);
        let rails = crate::rails::RailsState::new(temp.join("rails"))
            .await
            .expect("test rails");
        Arc::new(AppState {
            config,
            db,
            jwks,
            auth_config,
            vm_driver: None,
            rails,
            vm_sessions: crate::vm_session_routes::new_vm_session_store(),
            cowork_scheduler: None,
            cowork_background: None,
            cowork_run_manager: None,
            webhook_secret: None,
            office_runtime: Arc::new(RwLock::new(
                crate::office_routes::OfficeRuntimeFile::default(),
            )),
            design_skill_cache: crate::design_connector_routes::DesignSkillCache::new(),
            terminal_sessions: crate::terminal_routes::TerminalSessionStore::new(),
            office_cli_docs: Arc::new(RwLock::new(HashMap::new())),
            office_cli_watches: Arc::new(RwLock::new(HashMap::new())),
            office_cli_mcp_sessions: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    fn json_body(value: &Value) -> Body {
        Body::from(value.to_string())
    }

    #[test]
    fn accepts_standard_runtime_event_types() {
        for event_type in [
            "thinking_delta",
            "content_block_delta",
            "tool_calls",
            "refusal",
        ] {
            assert!(APPENDABLE_RUN_EVENT_TYPES.contains(&event_type));
        }
    }

    #[test]
    fn accepts_only_supported_session_resource_kinds() {
        for kind in ["github_token", "vault_credential", "api_key"] {
            assert!(RESOURCE_KINDS.contains(&kind));
        }
        assert!(!RESOURCE_KINDS.contains(&"env_var"));
        assert!(!RESOURCE_KINDS.contains(&"raw_secret"));
    }

    #[test]
    fn reports_the_first_exceeded_budget_without_counting_rejected_usage() {
        let state = BudgetState {
            max_tokens: Some(100),
            max_turns: Some(4),
            max_tool_calls: Some(2),
            tokens_used: 90,
            turns_used: 4,
            tool_calls_used: 1,
        };
        assert_eq!(
            exceeded_budget(
                state,
                UsageDelta {
                    tokens: 11,
                    turns: 0,
                    tool_calls: 0
                }
            ),
            Some("tokens")
        );
        assert_eq!(
            exceeded_budget(
                state,
                UsageDelta {
                    tokens: 10,
                    turns: 0,
                    tool_calls: 1
                }
            ),
            None
        );
        assert_eq!(
            exceeded_budget(
                state,
                UsageDelta {
                    tokens: 0,
                    turns: 1,
                    tool_calls: 0
                }
            ),
            Some("turns")
        );
    }

    #[tokio::test]
    async fn session_resource_validation_rejects_bad_input() {
        let temp = temp_dir("validation");
        let state = test_app_state(&temp).await;
        let app = beta_session_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/sessions")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let session_id = body["session"]["id"].as_str().unwrap();

        let uri = format!("/beta/sessions/{}/resources", session_id);

        // Unsupported kind.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&uri)
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "name": "bad",
                        "kind": "env_var",
                        "value": "x"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // Empty name.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&uri)
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "name": "  ",
                        "kind": "api_key",
                        "value": "x"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // Both value and ref.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&uri)
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "name": "both",
                        "kind": "api_key",
                        "value": "x",
                        "ref": "ref"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // Neither value nor ref.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&uri)
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "name": "neither",
                        "kind": "api_key"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn session_resource_lifecycle_with_encryption() {
        let temp = temp_dir("lifecycle");
        let state = test_app_state(&temp).await;
        let app = beta_session_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/sessions")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"name": "test-session"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let session_id = body["session"]["id"].as_str().unwrap().to_string();

        // Attach an encrypted value resource.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/sessions/{}/resources", session_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "name": "github",
                        "kind": "github_token",
                        "value": "ghp_secret"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let resource_1_id = body["resource"]["id"].as_str().unwrap().to_string();
        assert_eq!(body["resource"]["name"], "github");
        assert_eq!(body["resource"]["kind"], "github_token");
        assert!(body["resource"]["value"].is_null());
        assert!(body["resource"]["encrypted_value"].is_null());

        // Attach a reference resource.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/sessions/{}/resources", session_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "name": "vault",
                        "kind": "vault_credential",
                        "ref": "vault://prod/credential"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let resource_2_id = body["resource"]["id"].as_str().unwrap().to_string();
        assert_eq!(body["resource"]["ref"], "vault://prod/credential");

        // List resources ordered by created_at, id.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/beta/sessions/{}/resources", session_id))
                    .extension(test_user("user-a"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let resources = body["resources"].as_array().unwrap();
        assert_eq!(resources.len(), 2);
        assert_eq!(resources[0]["id"], resource_1_id);
        assert_eq!(resources[1]["id"], resource_2_id);

        // Delete the first resource.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!(
                        "/beta/sessions/{}/resources/{}",
                        session_id, resource_1_id
                    ))
                    .extension(test_user("user-a"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);

        // List again shows only the reference resource.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/beta/sessions/{}/resources", session_id))
                    .extension(test_user("user-a"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let resources = body["resources"].as_array().unwrap();
        assert_eq!(resources.len(), 1);
        assert_eq!(resources[0]["id"], resource_2_id);

        // Deleting the same resource again is a 404.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!(
                        "/beta/sessions/{}/resources/{}",
                        session_id, resource_1_id
                    ))
                    .extension(test_user("user-a"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn session_resources_are_isolated_by_user() {
        let temp = temp_dir("isolation");
        let state = test_app_state(&temp).await;
        let app = beta_session_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/sessions")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let session_id = body["session"]["id"].as_str().unwrap().to_string();

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/sessions/{}/resources", session_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "name": "secret",
                        "kind": "api_key",
                        "value": "secret"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let resource_id = body["resource"]["id"].as_str().unwrap().to_string();

        // Another user cannot list the session's resources.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/beta/sessions/{}/resources", session_id))
                    .extension(test_user("user-b"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        // Another user cannot delete the resource.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!(
                        "/beta/sessions/{}/resources/{}",
                        session_id, resource_id
                    ))
                    .extension(test_user("user-b"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
