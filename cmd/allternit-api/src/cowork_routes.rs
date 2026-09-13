use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::get_user;
use crate::auth::AuthUser;
use crate::AppState;

fn unauthorized() -> axum::response::Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "Unauthorized"})),
    )
        .into_response()
}

pub fn cowork_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/cowork", get(cowork_status))
        .route("/cowork/sessions", get(list_sessions).post(create_session))
        .route(
            "/cowork/sessions/:id",
            get(get_session)
                .put(update_session)
                .patch(update_session)
                .delete(delete_session),
        )
        .route("/cowork/personas", get(list_personas).post(create_persona))
        .route(
            "/cowork/personas/:id",
            get(get_persona)
                .put(update_persona)
                .patch(update_persona)
                .delete(delete_persona),
        )
        .route("/cowork/projects", get(list_projects).post(create_project))
        .route(
            "/cowork/projects/:id",
            get(get_project)
                .put(update_project)
                .patch(update_project)
                .delete(delete_project),
        )
        .route(
            "/cowork/projects/:id/files",
            get(list_project_files).post(create_project_file),
        )
        .route(
            "/cowork/projects/:id/files/:file_id",
            delete(delete_project_file),
        )
        .route("/cowork/memory", get(get_memory).post(store_memory))
        .route(
            "/cowork/memory/search",
            get(search_memory_get).post(search_memory),
        )
        .route("/cowork/memory/health", get(memory_health))
        .route("/cowork/connectors", get(list_connectors))
        .route("/cowork/approvals", get(list_approvals).post(decide_approval))
        .route(
            "/cowork/suggestions",
            get(list_suggestions).post(create_suggestion),
        )
        .route("/cowork/team-execute", post(team_execute))
        .route("/cowork/run-agent", post(run_agent))
}

// ─── Data models ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct SessionRow {
    id: String,
    user_id: String,
    project_id: Option<String>,
    title: Option<String>,
    status: String,
    mode: String,
    checkpoint: Option<String>,
    metadata: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct ProjectRow {
    id: String,
    user_id: String,
    title: String,
    description: Option<String>,
    instructions: Option<String>,
    metadata: Option<String>,
    git_remote: Option<String>,
    default_branch: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct ProjectFileRow {
    id: String,
    project_id: String,
    user_id: String,
    name: String,
    url: Option<String>,
    upload_id: Option<String>,
    media_type: Option<String>,
    created_at: String,
}

#[derive(Serialize)]
struct PersonaRow {
    id: String,
    user_id: String,
    name: String,
    description: Option<String>,
    system_prompt: String,
    tools: Option<String>,
    #[serde(rename = "isDefault")]
    is_default: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct MemoryEntryRow {
    id: String,
    user_id: String,
    project_id: Option<String>,
    session_id: Option<String>,
    content: String,
    #[serde(rename = "type")]
    type_: String,
    tags: Option<String>,
    source: Option<String>,
    created_at: String,
}

#[derive(Serialize)]
struct ConnectorRow {
    id: String,
    user_id: String,
    name: String,
    enabled: i64,
    config: Option<String>,
    last_used: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct SuggestionRow {
    id: String,
    user_id: Option<String>,
    content: String,
    source: String,
    dismissed: i64,
    created_at: String,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn is_no_such_table(err: &rusqlite::Error) -> bool {
    if let rusqlite::Error::SqliteFailure(_, Some(msg)) = err {
        msg.contains("no such table")
    } else {
        false
    }
}

// ─── List window (pagination) ────────────────────────────────────────────────

const LIST_DEFAULT_LIMIT: i64 = 100;
const LIST_MAX_LIMIT: i64 = 1000;

#[derive(Debug, Deserialize)]
struct ListQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

/// Bound an unbounded list query: caller-provided limit wins when under the
/// cap, otherwise the default; offset is clamped non-negative.
fn clamp_list_window(q: &ListQuery) -> (i64, i64) {
    let limit = q
        .limit
        .unwrap_or(LIST_DEFAULT_LIMIT)
        .clamp(1, LIST_MAX_LIMIT);
    let offset = q.offset.unwrap_or(0).max(0);
    (limit, offset)
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

async fn list_sessions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let (limit, offset) = clamp_list_window(&q);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, project_id, title, status, mode, checkpoint, metadata,
                    started_at, completed_at, created_at, updated_at
             FROM cowork_sessions WHERE user_id = ?1 ORDER BY updated_at DESC
             LIMIT ?2 OFFSET ?3",
        )?;
        let rows = stmt
            .query_map(params![user_id, limit, offset], |row| {
                Ok(SessionRow {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    project_id: row.get(2)?,
                    title: row.get(3)?,
                    status: row.get(4)?,
                    mode: row.get(5)?,
                    checkpoint: row.get(6)?,
                    metadata: row.get(7)?,
                    started_at: row.get(8)?,
                    completed_at: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(sessions)) => Json(json!({ "sessions": sessions })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing sessions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreateSessionBody {
    project_id: Option<String>,
    title: Option<String>,
    status: Option<String>,
    mode: Option<String>,
    checkpoint: Option<String>,
    metadata: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
}

async fn create_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateSessionBody>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_sessions (id, user_id, project_id, title, status, mode,
                                          checkpoint, metadata, started_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                id2,
                user_id,
                body.project_id,
                body.title,
                body.status.unwrap_or_else(|| "idle".to_string()),
                body.mode.unwrap_or_else(|| "agent".to_string()),
                body.checkpoint,
                body.metadata,
                body.started_at,
                body.completed_at,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (
            StatusCode::CREATED,
            Json(json!({ "session": { "id": id } })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn get_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, project_id, title, status, mode, checkpoint, metadata,
                    started_at, completed_at, created_at, updated_at
             FROM cowork_sessions WHERE id = ?1 AND user_id = ?2",
        )?;
        let row = stmt.query_row(params![id, user_id], |row| {
            Ok(SessionRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                status: row.get(4)?,
                mode: row.get(5)?,
                checkpoint: row.get(6)?,
                metadata: row.get(7)?,
                started_at: row.get(8)?,
                completed_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(session)) => Json(json!({ "session": session })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdateSessionBody {
    // Option<Option<T>> patch semantics: outer None = field absent from the
    // request (skip), inner Some(v) = set column to v, where v may be an
    // explicit null that CLEARS the column. Plain values still deserialize as
    // Some(Some(v)), so existing clients are unaffected.
    status: Option<Option<String>>,
    title: Option<Option<String>>,
    checkpoint: Option<Option<String>>,
    metadata: Option<Option<String>>,
    completed_at: Option<Option<String>>,
}

/// Build the SET-clause pieces for update_session from the fields present in
/// the request. Outer None = field absent (skip); inner Some(v) sets the
/// column, where v may be an explicit null that CLEARS the column.
fn session_update_sets(body: &UpdateSessionBody) -> Vec<(&'static str, Option<String>)> {
    let mut sets = Vec::new();
    if let Some(v) = &body.status {
        sets.push(("status = ?", v.clone()));
    }
    if let Some(v) = &body.title {
        sets.push(("title = ?", v.clone()));
    }
    if let Some(v) = &body.checkpoint {
        sets.push(("checkpoint = ?", v.clone()));
    }
    if let Some(v) = &body.metadata {
        sets.push(("metadata = ?", v.clone()));
    }
    if let Some(v) = &body.completed_at {
        sets.push(("completed_at = ?", v.clone()));
    }
    sets
}

async fn update_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateSessionBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Build the SET clause only from fields present in the request so an
        // explicit null can clear a column (COALESCE(?, col) made that
        // impossible before).
        let sets = session_update_sets(&body);
        if !sets.is_empty() {
            let clause = sets
                .iter()
                .map(|(column, _)| *column)
                .collect::<Vec<_>>()
                .join(", ");
            let sql = format!(
                "UPDATE cowork_sessions SET {}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                clause
            );
            let mut all: Vec<&dyn rusqlite::ToSql> = sets
                .iter()
                .map(|(_, value)| value as &dyn rusqlite::ToSql)
                .collect();
            all.push(&id);
            all.push(&user_id);
            conn.execute(&sql, rusqlite::params_from_iter(all))?;
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"ok": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn delete_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM cowork_sessions WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── Personas ─────────────────────────────────────────────────────────────────

async fn list_personas(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let (limit, offset) = clamp_list_window(&q);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, system_prompt, tools, is_default, created_at, updated_at
             FROM cowork_personas WHERE user_id = ?1 ORDER BY updated_at DESC
             LIMIT ?2 OFFSET ?3"
        )?;
        let rows = stmt.query_map(params![user_id, limit, offset], |row| {
            Ok(PersonaRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                system_prompt: row.get(4)?,
                tools: row.get(5)?,
                is_default: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(personas)) => Json(json!({ "personas": personas })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing personas: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreatePersonaBody {
    name: String,
    description: Option<String>,
    system_prompt: String,
    tools: Option<String>,
    #[serde(rename = "isDefault")]
    is_default: Option<bool>,
}

async fn create_persona(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreatePersonaBody>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_personas (id, user_id, name, description, system_prompt, tools, is_default)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id2,
                user_id,
                body.name,
                body.description,
                body.system_prompt,
                body.tools,
                body.is_default.map(|b| if b { 1 } else { 0 }).unwrap_or(0),
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (
            StatusCode::CREATED,
            Json(json!({ "persona": { "id": id } })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating persona: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn get_persona(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, system_prompt, tools, is_default, created_at, updated_at
             FROM cowork_personas WHERE id = ?1 AND user_id = ?2"
        )?;
        let row = stmt.query_row(params![id, user_id], |row| {
            Ok(PersonaRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                system_prompt: row.get(4)?,
                tools: row.get(5)?,
                is_default: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(persona)) => Json(json!({ "persona": persona })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting persona: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdatePersonaBody {
    // Option<Option<T>> patch semantics: outer None = absent (skip), inner
    // Some(v) = set (explicit null clears the column).
    name: Option<Option<String>>,
    description: Option<Option<String>>,
    system_prompt: Option<Option<String>>,
    tools: Option<Option<String>>,
    #[serde(rename = "isDefault")]
    is_default: Option<bool>,
}

async fn update_persona(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdatePersonaBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Build the SET clause only from fields present in the request so an
        // explicit null can clear a column (COALESCE(?, col) made that
        // impossible before). is_default stays plain Option<bool> since the
        // column is NOT NULL; present = set, absent = skip.
        let mut sets: Vec<&str> = Vec::new();
        let mut vals: Vec<Option<String>> = Vec::new();
        if let Some(v) = body.name {
            sets.push("name = ?");
            vals.push(v);
        }
        if let Some(v) = body.description {
            sets.push("description = ?");
            vals.push(v);
        }
        if let Some(v) = body.system_prompt {
            sets.push("system_prompt = ?");
            vals.push(v);
        }
        if let Some(v) = body.tools {
            sets.push("tools = ?");
            vals.push(v);
        }
        let flag: Option<i64> = body.is_default.map(|b| if b { 1 } else { 0 });
        if flag.is_some() {
            sets.push("is_default = ?");
        }
        if !sets.is_empty() {
            let sql = format!(
                "UPDATE cowork_personas SET {}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                sets.join(", ")
            );
            let mut all: Vec<&dyn rusqlite::ToSql> =
                vals.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
            if let Some(ref f) = flag {
                all.push(f);
            }
            all.push(&id);
            all.push(&user_id);
            conn.execute(&sql, rusqlite::params_from_iter(all))?;
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating persona: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn delete_persona(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM cowork_personas WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting persona: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── Projects ─────────────────────────────────────────────────────────────────

async fn list_projects(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let (limit, offset) = clamp_list_window(&q);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, title, description, instructions, metadata, git_remote, default_branch, created_at, updated_at
             FROM cowork_projects WHERE user_id = ?1 ORDER BY updated_at DESC
             LIMIT ?2 OFFSET ?3"
        )?;
        let rows = stmt.query_map(params![user_id, limit, offset], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                instructions: row.get(4)?,
                metadata: row.get(5)?,
                git_remote: row.get(6)?,
                default_branch: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(projects)) => Json(json!({ "projects": projects })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing projects: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreateProjectBody {
    title: String,
    description: Option<String>,
    instructions: Option<String>,
    metadata: Option<String>,
    git_remote: Option<String>,
    default_branch: Option<String>,
}

async fn create_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateProjectBody>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_projects (id, user_id, title, description, instructions, metadata, git_remote, default_branch)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id2,
                user_id,
                body.title,
                body.description,
                body.instructions,
                body.metadata,
                body.git_remote,
                body.default_branch,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (
            StatusCode::CREATED,
            Json(json!({ "project": { "id": id } })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating project: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn get_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, title, description, instructions, metadata, git_remote, default_branch, created_at, updated_at
             FROM cowork_projects WHERE id = ?1 AND user_id = ?2"
        )?;
        let row = stmt.query_row(params![id, user_id], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                instructions: row.get(4)?,
                metadata: row.get(5)?,
                git_remote: row.get(6)?,
                default_branch: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(project)) => Json(json!({ "project": project })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting project: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdateProjectBody {
    // Option<Option<T>> patch semantics: outer None = absent (skip), inner
    // Some(v) = set (explicit null clears the column).
    title: Option<Option<String>>,
    description: Option<Option<String>>,
    instructions: Option<Option<String>>,
    metadata: Option<Option<String>>,
    git_remote: Option<Option<String>>,
    default_branch: Option<Option<String>>,
}

async fn update_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateProjectBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Build the SET clause only from fields present in the request so an
        // explicit null can clear a column (COALESCE(?, col) made that
        // impossible before).
        let mut sets: Vec<&str> = Vec::new();
        let mut vals: Vec<Option<String>> = Vec::new();
        if let Some(v) = body.title {
            sets.push("title = ?");
            vals.push(v);
        }
        if let Some(v) = body.description {
            sets.push("description = ?");
            vals.push(v);
        }
        if let Some(v) = body.instructions {
            sets.push("instructions = ?");
            vals.push(v);
        }
        if let Some(v) = body.metadata {
            sets.push("metadata = ?");
            vals.push(v);
        }
        if let Some(v) = body.git_remote {
            sets.push("git_remote = ?");
            vals.push(v);
        }
        if let Some(v) = body.default_branch {
            sets.push("default_branch = ?");
            vals.push(v);
        }
        if !sets.is_empty() {
            let sql = format!(
                "UPDATE cowork_projects SET {}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                sets.join(", ")
            );
            let mut all: Vec<&dyn rusqlite::ToSql> =
                vals.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
            all.push(&id);
            all.push(&user_id);
            conn.execute(&sql, rusqlite::params_from_iter(all))?;
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating project: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn delete_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM cowork_projects WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting project: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── Project files ────────────────────────────────────────────────────────────
//
// Metadata rows for files attached to a project (Claude-style project
// knowledge). Blobs live behind /api/v1/uploads (`upload_id`) or external
// URLs (`url`); these rows only record what belongs to which project.

async fn list_project_files(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let (limit, offset) = clamp_list_window(&q);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, user_id, name, url, upload_id, media_type, created_at
             FROM cowork_project_files WHERE project_id = ?1 AND user_id = ?2 ORDER BY created_at DESC
             LIMIT ?3 OFFSET ?4",
        )?;
        let rows = stmt
            .query_map(params![id, user_id, limit, offset], |row| {
                Ok(ProjectFileRow {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    user_id: row.get(2)?,
                    name: row.get(3)?,
                    url: row.get(4)?,
                    upload_id: row.get(5)?,
                    media_type: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(files)) => Json(json!({ "files": files })).into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => {
            // Backend predates the V28 migration — report an empty list rather
            // than 500ing so clients can render their normal empty state.
            Json(json!({ "files": [] })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing project files: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreateProjectFileBody {
    name: String,
    url: Option<String>,
    upload_id: Option<String>,
    media_type: Option<String>,
}

async fn create_project_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(project_id): Path<String>,
    Json(body): Json<CreateProjectFileBody>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_project_files (id, project_id, user_id, name, url, upload_id, media_type)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id2,
                project_id,
                user_id,
                body.name,
                body.url,
                body.upload_id,
                body.media_type,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (
            StatusCode::CREATED,
            Json(json!({ "file": { "id": id } })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating project file: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn delete_project_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path((project_id, file_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM cowork_project_files WHERE id = ?1 AND project_id = ?2 AND user_id = ?3",
            params![file_id, project_id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting project file: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── Memory ───────────────────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct MemoryPrincipalQuery {
    /// Principal scope (A-T2): when set, only entries owned by or granted to
    /// this principal are returned (default-deny cross-principal).
    pub principal: Option<String>,
    /// List window bounds, clamped the same way as every other list endpoint.
    #[serde(flatten)]
    pub window: ListQuery,
}

async fn get_memory(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(query): Query<MemoryPrincipalQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let principal = query.principal;
    let (limit, offset) = clamp_list_window(&query.window);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Principal-scoped path enforces owner+grants (A-T2); unscoped keeps
        // the legacy user-filtered behavior.
        let memories = allternit_cowork_runtime::sqlite_store::search_memory_entries(
            &conn,
            &user_id,
            principal.as_deref(),
            None,
            limit,
            offset,
        )
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        Ok::<_, rusqlite::Error>(memories)
    })
    .await;

    match rows {
        Ok(Ok(memories)) => Json(json!({ "memories": memories })).into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => {
            Json(json!({ "memories": Vec::<MemoryEntryRow>::new() })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting memories: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct StoreMemoryBody {
    project_id: Option<String>,
    session_id: Option<String>,
    content: String,
    #[serde(rename = "type")]
    type_: Option<String>,
    tags: Option<String>,
    source: Option<String>,
    /// Owning principal (A-T2); writes are attributed to this principal.
    principal: Option<String>,
    /// Principals explicitly granted access (default-deny otherwise).
    grants: Option<Vec<String>>,
}

async fn store_memory(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<StoreMemoryBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let type_ = body.type_.clone().unwrap_or_else(|| "fact".to_string());

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        allternit_cowork_runtime::sqlite_store::store_memory_entry(
            &mut conn,
            &user_id,
            body.project_id.as_deref(),
            body.session_id.as_deref(),
            &body.content,
            &type_,
            body.tags.as_deref(),
            body.source.as_deref(),
            body.principal.as_deref(),
            &body.grants.clone().unwrap_or_default(),
        )
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
    })
    .await;

    match result {
        Ok(Ok(id)) => {
            (StatusCode::CREATED, Json(json!({ "memory": { "id": id } }))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error storing memory: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct SearchMemoryBody {
    query: String,
    limit: Option<i64>,
}

async fn search_memory(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<SearchMemoryBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let limit = body
        .limit
        .unwrap_or(LIST_DEFAULT_LIMIT)
        .clamp(1, LIST_MAX_LIMIT);
    let pattern = format!("%{}%", body.query.replace('%', "\\%").replace('_', "\\_"));

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, project_id, session_id, content, type, tags, source, created_at
             FROM cowork_memory_entries
             WHERE user_id = ?1 AND content LIKE ?2 ESCAPE '\\'
             ORDER BY created_at DESC
             LIMIT ?3",
        )?;
        let rows = stmt
            .query_map(params![user_id, pattern, limit], |row| {
                Ok(MemoryEntryRow {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    project_id: row.get(2)?,
                    session_id: row.get(3)?,
                    content: row.get(4)?,
                    type_: row.get(5)?,
                    tags: row.get(6)?,
                    source: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(memories)) => Json(json!({ "results": memories })).into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => {
            Json(json!({ "results": Vec::<MemoryEntryRow>::new() })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error searching memories: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct SearchMemoryQuery {
    query: Option<String>,
    limit: Option<i64>,
}

async fn search_memory_get(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(params): Query<SearchMemoryQuery>,
) -> impl IntoResponse {
    let query = params.query.unwrap_or_default();
    let body = SearchMemoryBody {
        query,
        limit: params.limit,
    };
    search_memory(State(state), Extension(user), HeaderMap::new(), Json(body)).await
}

async fn memory_health(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let db = state.db.clone();

    let healthy = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute("SELECT 1", [])?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match healthy {
        Ok(Ok(())) => Json(json!({"status": "healthy", "connected": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB health check failed: {}", e);
            Json(json!({"status": "unhealthy", "connected": false, "error": e.to_string()}))
                .into_response()
        }
        Err(e) => {
            warn!("DB health task panicked: {}", e);
            Json(json!({"status": "unhealthy", "connected": false, "error": "internal error"}))
                .into_response()
        }
    }
}

// ─── Connectors / Approvals / Suggestions ─────────────────────────────────────

async fn list_connectors(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let (limit, offset) = clamp_list_window(&q);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, enabled, config, last_used, created_at, updated_at
             FROM cowork_connectors WHERE user_id = ?1 ORDER BY updated_at DESC
             LIMIT ?2 OFFSET ?3",
        )?;
        let rows = stmt
            .query_map(params![user_id, limit, offset], |row| {
                Ok(ConnectorRow {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    name: row.get(2)?,
                    enabled: row.get(3)?,
                    config: row.get(4)?,
                    last_used: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(connectors)) => Json(json!({ "connectors": connectors })).into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => {
            Json(json!({ "connectors": Vec::<ConnectorRow>::new() })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing connectors: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

/// Prepare the approvals list statement, filtering out decided rows.
///
/// Prefers the V143+ filter (`dismissed = 0`) so decided/dismissed approvals
/// leave the pending set; on schemas where the dismissed column does not
/// exist yet, degrades to the unfiltered select rather than erroring. A
/// missing table surfaces as a prepare error and is handled by the caller's
/// is_no_such_table fallback.
fn prepare_approvals_list_stmt(
    conn: &rusqlite::Connection,
) -> rusqlite::Result<rusqlite::Statement<'_>> {
    conn.prepare(
        "SELECT id, user_id, content, source, dismissed, created_at
         FROM cowork_approvals
         WHERE (user_id = ?1 OR user_id IS NULL) AND dismissed = 0
         ORDER BY created_at DESC
         LIMIT ?2 OFFSET ?3",
    )
    .or_else(|e| {
        if e.to_string().contains("no such column") {
            // The fallback cannot project `dismissed` either on a pre-V143
            // schema; substitute a literal 0 (never dismissed) instead.
            conn.prepare(
                "SELECT id, user_id, content, source, 0 AS dismissed, created_at
                 FROM cowork_approvals
                 WHERE (user_id = ?1 OR user_id IS NULL)
                 ORDER BY created_at DESC
                 LIMIT ?2 OFFSET ?3",
            )
        } else {
            Err(e)
        }
    })
}

async fn list_approvals(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let db = state.db.clone();
    let user_id = _user.user_id;
    let (limit, offset) = clamp_list_window(&q);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // A:// §8.18 / §16: approvals are per-user; never return other users' rows.
        let mut stmt = prepare_approvals_list_stmt(&conn)?;
        let rows = stmt
            .query_map(params![user_id, limit, offset], |row| {
                Ok(SuggestionRow {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    content: row.get(2)?,
                    source: row.get(3)?,
                    dismissed: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(approvals)) => Json(json!({
            "approvals": &approvals,
            "pending": &approvals,
        }))
            .into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => Json(json!({
            "approvals": Vec::<SuggestionRow>::new(),
            "pending": Vec::<SuggestionRow>::new(),
        }))
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing approvals: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── Approval decisions ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ApprovalDecisionBody {
    /// Frontend sends `actionId` (the cowork_approvals row id).
    #[serde(rename = "actionId")]
    action_id: Option<String>,
    /// Tolerated alias for non-gate callers.
    id: Option<String>,
    /// Frontend sends `decision`; `action` is accepted as an alias.
    decision: Option<String>,
    action: Option<String>,
}

enum ApprovalOutcome {
    Approved,
    Rejected,
    Dismissed,
}

fn normalize_approval_decision(raw: &str) -> Option<ApprovalOutcome> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "approved" | "approve" | "allow" | "grant" => Some(ApprovalOutcome::Approved),
        "rejected" | "reject" | "deny" | "denied" => Some(ApprovalOutcome::Rejected),
        "dismissed" | "dismiss" => Some(ApprovalOutcome::Dismissed),
        _ => None,
    }
}

/// Apply an approval decision to a cowork_approvals row, scoped to the
/// requesting user (NULL-user rows are global and match anyone). Returns the
/// number of rows updated — 0 means the row is missing or owned by someone
/// else, which the caller maps to 404.
fn apply_approval_decision(
    conn: &rusqlite::Connection,
    approval_id: &str,
    outcome: &ApprovalOutcome,
    user_id: &str,
) -> rusqlite::Result<usize> {
    let stored: Option<&str> = match outcome {
        ApprovalOutcome::Approved => Some("approved"),
        ApprovalOutcome::Rejected => Some("rejected"),
        ApprovalOutcome::Dismissed => None,
    };
    conn.execute(
        "UPDATE cowork_approvals
         SET dismissed = 1, decision = ?2, decided_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND (user_id = ?3 OR user_id IS NULL)",
        params![approval_id, stored, user_id],
    )
    .or_else(|e| {
        // Schema predating V144 has no decision/decided_at columns;
        // degrade to a plain dismiss so the endpoint still resolves.
        if e.to_string().contains("no such column") {
            conn.execute(
                "UPDATE cowork_approvals
                 SET dismissed = 1
                 WHERE id = ?1 AND (user_id = ?2 OR user_id IS NULL)",
                params![approval_id, user_id],
            )
        } else {
            Err(e)
        }
    })
}

async fn decide_approval(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    body: Result<Json<ApprovalDecisionBody>, axum::extract::rejection::JsonRejection>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let Json(body) = match body {
        Ok(b) => b,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid request body"})),
            )
                .into_response()
        }
    };
    let raw_decision = body
        .decision
        .as_deref()
        .or(body.action.as_deref())
        .unwrap_or("");
    let outcome = match normalize_approval_decision(raw_decision) {
        Some(o) => o,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid decision"})),
            )
                .into_response()
        }
    };
    let approval_id = match body.action_id.as_deref().or(body.id.as_deref()) {
        Some(id) if !id.trim().is_empty() => id.to_string(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "actionId is required"})),
            )
                .into_response()
        }
    };

    let decision_label = match outcome {
        ApprovalOutcome::Approved => "approved",
        ApprovalOutcome::Rejected => "rejected",
        ApprovalOutcome::Dismissed => "dismissed",
    };
    let db = state.db.clone();
    let user_id = user.user_id;
    let id_for_response = approval_id.clone();
    let label_for_response = decision_label.to_string();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let updated = apply_approval_decision(&conn, &approval_id, &outcome, &user_id)?;
        Ok::<_, rusqlite::Error>(updated)
    })
    .await;

    match result {
        Ok(Ok(0)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "approval not found"})),
        )
            .into_response(),
        Ok(Ok(_)) => Json(json!({
            "ok": true,
            "id": id_for_response,
            "decision": label_for_response,
        }))
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error deciding approval: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn list_suggestions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let (limit, offset) = clamp_list_window(&q);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, content, source, dismissed, created_at
             FROM cowork_suggestions
             WHERE (user_id = ?1 OR user_id IS NULL) AND dismissed = 0
             ORDER BY created_at DESC
             LIMIT ?2 OFFSET ?3",
        )?;
        let rows = stmt
            .query_map(params![user_id, limit, offset], |row| {
                Ok(SuggestionRow {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    content: row.get(2)?,
                    source: row.get(3)?,
                    dismissed: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(suggestions)) => Json(json!({ "suggestions": suggestions })).into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => {
            Json(json!({ "suggestions": Vec::<SuggestionRow>::new() })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing suggestions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreateSuggestionBody {
    content: String,
    source: Option<String>,
    // NOTE: a client-supplied user_id used to be accepted here and allowed
    // forging the owning user. It was removed; the owner always comes from
    // the authenticated AuthUser extension.
}

async fn create_suggestion(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateSuggestionBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_suggestions (id, user_id, content, source, dismissed)
             VALUES (?1, ?2, ?3, ?4, 0)",
            params![
                id2,
                user_id,
                body.content,
                body.source.unwrap_or_else(|| "system".to_string())
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "id": id }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating suggestion: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── Execution ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct TeamExecuteBody {
    command: Option<String>,
    agent_id: Option<String>,
    prompt: Option<String>,
}

async fn team_execute(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<TeamExecuteBody>,
) -> impl IntoResponse {
    // A:// §5: this endpoint now submits a canonical IntentEnvelope instead
    // of the dead-end cowork_executions insert (the table was written and
    // never read). The intent resolves to a real queued run.
    let intent_id = format!("intent_{}", uuid::Uuid::new_v4());
    let db = state.db.clone();
    let user_id = user.user_id;
    let description = body
        .prompt
        .clone()
        .or_else(|| body.command.clone())
        .unwrap_or_else(|| "team execution".to_string());
    let envelope = allternit_cowork_runtime::IntentEnvelope {
        version: "a/0.1".to_string(),
        intent_id: intent_id.clone(),
        workspace: "a://workspace/default".to_string(),
        initiator: user_id.clone(),
        delegator: None,
        target: body.agent_id.clone(),
        action: allternit_cowork_runtime::IntentAction {
            action_type: "team_execute".to_string(),
            description,
            payload: Some(json!({
                "command": body.command,
                "prompt": body.prompt,
            })),
        },
        permissions: vec![],
        compute: None,
        model: None,
        approval: None,
        return_channel: None,
        causation_chain: body
            .agent_id
            .clone()
            .map(|a| vec![user_id.clone(), a])
            .unwrap_or_default(),
    };

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        allternit_cowork_runtime::sqlite_store::submit_intent(&mut conn, &envelope)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
    })
    .await;

    match result {
        Ok(Ok(submission)) => (
            StatusCode::OK,
            Json(json!({
                "intent_id": submission.intent_id,
                "run_id": submission.run_id,
                "created": submission.created,
                "status": "queued",
            })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating team execution: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct RunAgentBody {
    agent_id: Option<String>,
    role: Option<String>,
    prompt: Option<String>,
    spec: Option<serde_json::Value>,
}

async fn run_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<RunAgentBody>,
) -> impl IntoResponse {
    // A:// §5: canonical intent submission replaces the dead-end
    // cowork_executions insert.
    let intent_id = format!("intent_{}", uuid::Uuid::new_v4());
    let db = state.db.clone();
    let user_id = user.user_id;
    let agent_id = body.agent_id.or_else(|| {
        body.spec
            .as_ref()
            .and_then(|s| s.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
    });
    let prompt = body.prompt.or_else(|| {
        body.spec.as_ref().and_then(|s| {
            s.get("prompt")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
    });
    let command = body.role.or_else(|| {
        body.spec.as_ref().and_then(|s| {
            s.get("role")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
    });
    let description = prompt.clone().or_else(|| command.clone()).unwrap_or_else(|| "agent run".to_string());
    let envelope = allternit_cowork_runtime::IntentEnvelope {
        version: "a/0.1".to_string(),
        intent_id: intent_id.clone(),
        workspace: "a://workspace/default".to_string(),
        initiator: user_id.clone(),
        delegator: None,
        target: agent_id.clone(),
        action: allternit_cowork_runtime::IntentAction {
            action_type: "agent_run".to_string(),
            description,
            payload: Some(json!({ "command": command, "prompt": prompt })),
        },
        permissions: vec![],
        compute: None,
        model: None,
        approval: None,
        return_channel: None,
        causation_chain: agent_id
            .clone()
            .map(|a| vec![user_id.clone(), a])
            .unwrap_or_default(),
    };

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        allternit_cowork_runtime::sqlite_store::submit_intent(&mut conn, &envelope)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
    })
    .await;

    match result {
        Ok(Ok(submission)) => (
            StatusCode::OK,
            Json(json!({
                "intent_id": submission.intent_id,
                "run_id": submission.run_id,
                "created": submission.created,
                "status": "queued",
            })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating agent execution: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn cowork_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "cowork",
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn normalize(s: &str) -> Option<ApprovalOutcome> {
        normalize_approval_decision(s)
    }

    #[test]
    fn normalize_approval_decision_frontend_values() {
        assert!(matches!(normalize("approved"), Some(ApprovalOutcome::Approved)));
        assert!(matches!(normalize("rejected"), Some(ApprovalOutcome::Rejected)));
    }

    #[test]
    fn normalize_approval_decision_aliases_and_case() {
        assert!(matches!(normalize("Approve"), Some(ApprovalOutcome::Approved)));
        assert!(matches!(normalize(" deny "), Some(ApprovalOutcome::Rejected)));
        assert!(matches!(normalize("dismiss"), Some(ApprovalOutcome::Dismissed)));
    }

    #[test]
    fn normalize_approval_decision_approved_aliases() {
        for alias in ["approve", "allow", "grant", "APPROVED", " Allow "] {
            assert!(
                matches!(normalize(alias), Some(ApprovalOutcome::Approved)),
                "expected {alias:?} to normalize to Approved"
            );
        }
    }

    #[test]
    fn normalize_approval_decision_rejected_aliases() {
        for alias in ["reject", "deny", "denied", "REJECTED", " Deny "] {
            assert!(
                matches!(normalize(alias), Some(ApprovalOutcome::Rejected)),
                "expected {alias:?} to normalize to Rejected"
            );
        }
    }

    #[test]
    fn normalize_approval_decision_dismissed_aliases() {
        for alias in ["dismissed", "DISMISS"] {
            assert!(
                matches!(normalize(alias), Some(ApprovalOutcome::Dismissed)),
                "expected {alias:?} to normalize to Dismissed"
            );
        }
    }

    #[test]
    fn normalize_approval_decision_rejects_unknown() {
        assert!(normalize("").is_none());
        assert!(normalize("maybe").is_none());
        assert!(normalize("approved!").is_none());
    }

    // ── Scratch-DB tests over the cowork_approvals table ─────────────────────
    //
    // V143 DDL + the V144 decision columns, matching the production schema a
    // migrated node ends up with.

    const APPROVALS_DDL_V144: &str = "
        CREATE TABLE cowork_approvals (
            id         TEXT PRIMARY KEY,
            user_id    TEXT,
            content    TEXT NOT NULL,
            source     TEXT NOT NULL DEFAULT 'system',
            dismissed  INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            decision   TEXT,
            decided_at DATETIME
        );
    ";

    fn scratch_approvals_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(APPROVALS_DDL_V144).expect("ddl");
        conn
    }

    fn insert_approval(conn: &rusqlite::Connection, id: &str, user_id: Option<&str>, content: &str) {
        conn.execute(
            "INSERT INTO cowork_approvals (id, user_id, content) VALUES (?1, ?2, ?3)",
            params![id, user_id, content],
        )
        .expect("insert");
    }

    /// Mirror of list_approvals' row mapping, fed by prepare_approvals_list_stmt.
    fn list_pending_ids(
        conn: &rusqlite::Connection,
        user_id: &str,
    ) -> Vec<(String, Option<String>)> {
        let mut stmt = prepare_approvals_list_stmt(conn).expect("prepare");
        stmt.query_map(params![user_id, 100, 0], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .expect("query")
        .collect::<Result<Vec<_>, _>>()
        .expect("rows")
    }

    #[test]
    fn list_approvals_excludes_decided_rows_from_pending() {
        let conn = scratch_approvals_db();
        insert_approval(&conn, "a-pending", Some("user-a"), "still pending");
        insert_approval(&conn, "a-decided", Some("user-a"), "decided");
        apply_approval_decision(&conn, "a-decided", &ApprovalOutcome::Approved, "user-a")
            .expect("decide");

        let ids = list_pending_ids(&conn, "user-a");
        assert_eq!(ids.len(), 1, "decided rows must leave the pending set");
        assert_eq!(ids[0].0, "a-pending");
    }

    #[test]
    fn list_approvals_scopes_to_user_and_null_rows() {
        let conn = scratch_approvals_db();
        insert_approval(&conn, "own", Some("user-a"), "own");
        insert_approval(&conn, "global", None, "global");
        insert_approval(&conn, "other", Some("user-b"), "other user");

        let ids = list_pending_ids(&conn, "user-a");
        let keys: Vec<String> = ids.iter().map(|(id, _)| id.clone()).collect();
        assert!(keys.contains(&"own".to_string()));
        assert!(keys.contains(&"global".to_string()));
        assert!(!keys.contains(&"other".to_string()));
    }

    #[test]
    fn list_approvals_falls_back_when_dismissed_column_missing() {
        // Pre-V143 schema: no dismissed column. The statement builder must
        // degrade to the unfiltered select instead of erroring.
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE cowork_approvals (
                id         TEXT PRIMARY KEY,
                user_id    TEXT,
                content    TEXT NOT NULL,
                source     TEXT NOT NULL DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .expect("ddl");
        insert_approval(&conn, "legacy-1", Some("user-a"), "legacy");
        insert_approval(&conn, "legacy-2", Some("user-a"), "legacy");

        let ids = list_pending_ids(&conn, "user-a");
        assert_eq!(ids.len(), 2, "fallback select must still return rows");
    }

    #[test]
    fn list_approvals_missing_table_errors_for_caller_fallback() {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory db");
        let err = prepare_approvals_list_stmt(&conn).unwrap_err();
        assert!(is_no_such_table(&err));
    }

    #[test]
    fn decide_approval_does_not_touch_another_users_row() {
        let conn = scratch_approvals_db();
        insert_approval(&conn, "row-a", Some("user-a"), "A");
        insert_approval(&conn, "row-b", Some("user-b"), "B");

        // user-b tries to decide user-a's row: 0 rows updated, row untouched.
        let updated = apply_approval_decision(&conn, "row-a", &ApprovalOutcome::Approved, "user-b")
            .expect("update");
        assert_eq!(updated, 0, "cross-user decide must update nothing");

        let dismissed: i64 = conn
            .query_row(
                "SELECT dismissed FROM cowork_approvals WHERE id = 'row-a'",
                [],
                |row| row.get(0),
            )
            .expect("select");
        assert_eq!(dismissed, 0, "row-a must remain pending");
    }

    #[test]
    fn decide_approval_null_user_row_is_global() {
        let conn = scratch_approvals_db();
        insert_approval(&conn, "global", None, "global");
        let updated = apply_approval_decision(&conn, "global", &ApprovalOutcome::Rejected, "user-a")
            .expect("update");
        assert_eq!(updated, 1);
        let (dismissed, decision): (i64, Option<String>) = conn
            .query_row(
                "SELECT dismissed, decision FROM cowork_approvals WHERE id = 'global'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("select");
        assert_eq!(dismissed, 1);
        assert_eq!(decision.as_deref(), Some("rejected"));
    }

    #[test]
    fn decide_approval_records_decision_columns() {
        let conn = scratch_approvals_db();
        insert_approval(&conn, "own", Some("user-a"), "A");
        apply_approval_decision(&conn, "own", &ApprovalOutcome::Approved, "user-a").expect("update");
        let (dismissed, decision): (i64, Option<String>) = conn
            .query_row(
                "SELECT dismissed, decision FROM cowork_approvals WHERE id = 'own'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("select");
        assert_eq!(dismissed, 1);
        assert_eq!(decision.as_deref(), Some("approved"));
    }

    #[test]
    fn decide_approval_falls_back_without_decision_columns() {
        // Pre-V144 schema: no decision/decided_at columns.
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE cowork_approvals (
                id         TEXT PRIMARY KEY,
                user_id    TEXT,
                content    TEXT NOT NULL,
                source     TEXT NOT NULL DEFAULT 'system',
                dismissed  INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .expect("ddl");
        insert_approval(&conn, "own", Some("user-a"), "A");
        insert_approval(&conn, "other", Some("user-b"), "B");

        let updated = apply_approval_decision(&conn, "own", &ApprovalOutcome::Approved, "user-a")
            .expect("fallback update");
        assert_eq!(updated, 1);
        let cross = apply_approval_decision(&conn, "other", &ApprovalOutcome::Approved, "user-a")
            .expect("cross update");
        assert_eq!(cross, 0, "fallback path must keep user scoping");
    }

    // ── update_session SET-clause semantics (scratch DB over V1 DDL) ─────────

    const SESSIONS_DDL_V1: &str = "
        CREATE TABLE cowork_sessions (
            id           TEXT PRIMARY KEY,
            user_id      TEXT NOT NULL,
            project_id   TEXT,
            title        TEXT,
            status       TEXT NOT NULL DEFAULT 'idle',
            mode         TEXT NOT NULL DEFAULT 'agent',
            checkpoint   TEXT,
            metadata     TEXT,
            started_at   DATETIME,
            completed_at DATETIME,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ";

    fn scratch_sessions_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(SESSIONS_DDL_V1).expect("ddl");
        conn
    }

    fn insert_session(conn: &rusqlite::Connection, id: &str, user_id: &str) {
        conn.execute(
            "INSERT INTO cowork_sessions (id, user_id, title, status, checkpoint)
             VALUES (?1, ?2, 'orig-title', 'idle', 'cp-1')",
            params![id, user_id],
        )
        .expect("insert");
    }

    /// Apply update_session's SET-clause builder + UPDATE to a scratch DB,
    /// exactly as the handler does.
    fn apply_session_update(
        conn: &rusqlite::Connection,
        id: &str,
        user_id: &str,
        body: &UpdateSessionBody,
    ) {
        let sets = session_update_sets(body);
        if sets.is_empty() {
            return;
        }
        let clause = sets
            .iter()
            .map(|(column, _)| *column)
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "UPDATE cowork_sessions SET {}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            clause
        );
        let mut all: Vec<&dyn rusqlite::ToSql> = sets
            .iter()
            .map(|(_, value)| value as &dyn rusqlite::ToSql)
            .collect();
        all.push(&id);
        all.push(&user_id);
        conn.execute(&sql, rusqlite::params_from_iter(all))
            .expect("update");
    }

    fn session_field(conn: &rusqlite::Connection, id: &str, column: &str) -> Option<String> {
        conn.query_row(
            &format!("SELECT {column} FROM cowork_sessions WHERE id = ?1"),
            params![id],
            |row| row.get(0),
        )
        .expect("select")
    }

    #[test]
    fn update_session_absent_field_leaves_value() {
        let conn = scratch_sessions_db();
        insert_session(&conn, "s1", "user-a");
        // Only title present: status and checkpoint must be untouched.
        let body = UpdateSessionBody {
            status: None,
            title: Some(Some("new-title".to_string())),
            checkpoint: None,
            metadata: None,
            completed_at: None,
        };
        apply_session_update(&conn, "s1", "user-a", &body);

        assert_eq!(session_field(&conn, "s1", "title").as_deref(), Some("new-title"));
        assert_eq!(session_field(&conn, "s1", "status").as_deref(), Some("idle"));
        assert_eq!(session_field(&conn, "s1", "checkpoint").as_deref(), Some("cp-1"));
    }

    #[test]
    fn update_session_explicit_null_clears_value() {
        let conn = scratch_sessions_db();
        insert_session(&conn, "s1", "user-a");
        let body = UpdateSessionBody {
            status: None,
            title: Some(None),
            checkpoint: Some(None),
            metadata: None,
            completed_at: None,
        };
        apply_session_update(&conn, "s1", "user-a", &body);

        assert_eq!(session_field(&conn, "s1", "title"), None);
        assert_eq!(session_field(&conn, "s1", "checkpoint"), None);
        assert_eq!(session_field(&conn, "s1", "status").as_deref(), Some("idle"));
    }

    #[test]
    fn update_session_plain_value_sets_and_scopes_to_user() {
        let conn = scratch_sessions_db();
        insert_session(&conn, "s1", "user-a");
        insert_session(&conn, "s2", "user-b");

        // user-b attempts to update user-a's session: WHERE clause blocks it.
        let body = UpdateSessionBody {
            status: Some(Some("running".to_string())),
            title: None,
            checkpoint: None,
            metadata: None,
            completed_at: None,
        };
        apply_session_update(&conn, "s1", "user-b", &body);
        assert_eq!(session_field(&conn, "s1", "status").as_deref(), Some("idle"));

        // Own session updates fine.
        apply_session_update(&conn, "s1", "user-a", &body);
        assert_eq!(session_field(&conn, "s1", "status").as_deref(), Some("running"));
        assert_eq!(session_field(&conn, "s2", "status").as_deref(), Some("idle"));
    }
}
