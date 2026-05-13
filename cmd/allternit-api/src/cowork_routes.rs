use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;

fn unauthorized() -> axum::response::Response {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))).into_response()
}

pub fn cowork_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/cowork", get(cowork_status))
        .route("/cowork/sessions", get(list_sessions).post(create_session))
        .route("/cowork/sessions/:id", get(get_session).put(update_session).patch(update_session).delete(delete_session))
        .route("/cowork/personas", get(list_personas).post(create_persona))
        .route("/cowork/personas/:id", get(get_persona).put(update_persona).patch(update_persona).delete(delete_persona))
        .route("/cowork/projects", get(list_projects).post(create_project))
        .route("/cowork/projects/:id", get(get_project).put(update_project).patch(update_project).delete(delete_project))
        .route("/cowork/memory", get(get_memory).post(store_memory))
        .route("/cowork/memory/search", post(search_memory))
        .route("/cowork/memory/health", get(memory_health))
        .route("/cowork/connectors", get(list_connectors))
        .route("/cowork/approvals", get(list_approvals))
        .route("/cowork/suggestions", get(list_suggestions).post(create_suggestion))
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
    created_at: String,
    updated_at: String,
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

// ─── Sessions ─────────────────────────────────────────────────────────────────

async fn list_sessions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, project_id, title, status, mode, checkpoint, metadata,
                    started_at, completed_at, created_at, updated_at
             FROM cowork_sessions WHERE user_id = ?1 ORDER BY updated_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "session": { "id": id } }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
             FROM cowork_sessions WHERE id = ?1 AND user_id = ?2"
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdateSessionBody {
    status: Option<String>,
    title: Option<String>,
    checkpoint: Option<String>,
    metadata: Option<String>,
    completed_at: Option<String>,
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
        conn.execute(
            "UPDATE cowork_sessions SET
                status = COALESCE(?1, status),
                title = COALESCE(?2, title),
                checkpoint = COALESCE(?3, checkpoint),
                metadata = COALESCE(?4, metadata),
                completed_at = COALESCE(?5, completed_at),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?6 AND user_id = ?7",
            params![body.status, body.title, body.checkpoint, body.metadata, body.completed_at, id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"ok": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Personas ─────────────────────────────────────────────────────────────────

async fn list_personas(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, system_prompt, tools, is_default, created_at, updated_at
             FROM cowork_personas WHERE user_id = ?1 ORDER BY updated_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "persona": { "id": id } }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating persona: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdatePersonaBody {
    name: Option<String>,
    description: Option<String>,
    system_prompt: Option<String>,
    tools: Option<String>,
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
        conn.execute(
            "UPDATE cowork_personas SET
                name = COALESCE(?1, name),
                description = COALESCE(?2, description),
                system_prompt = COALESCE(?3, system_prompt),
                tools = COALESCE(?4, tools),
                is_default = COALESCE(?5, is_default),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?6 AND user_id = ?7",
            params![
                body.name,
                body.description,
                body.system_prompt,
                body.tools,
                body.is_default.map(|b| if b { 1 } else { 0 }),
                id,
                user_id,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating persona: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Projects ─────────────────────────────────────────────────────────────────

async fn list_projects(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, title, description, instructions, metadata, created_at, updated_at
             FROM cowork_projects WHERE user_id = ?1 ORDER BY updated_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                instructions: row.get(4)?,
                metadata: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreateProjectBody {
    title: String,
    description: Option<String>,
    instructions: Option<String>,
    metadata: Option<String>,
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
            "INSERT INTO cowork_projects (id, user_id, title, description, instructions, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id2,
                user_id,
                body.title,
                body.description,
                body.instructions,
                body.metadata,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "project": { "id": id } }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating project: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
            "SELECT id, user_id, title, description, instructions, metadata, created_at, updated_at
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
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdateProjectBody {
    title: Option<String>,
    description: Option<String>,
    instructions: Option<String>,
    metadata: Option<String>,
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
        conn.execute(
            "UPDATE cowork_projects SET
                title = COALESCE(?1, title),
                description = COALESCE(?2, description),
                instructions = COALESCE(?3, instructions),
                metadata = COALESCE(?4, metadata),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?5 AND user_id = ?6",
            params![
                body.title,
                body.description,
                body.instructions,
                body.metadata,
                id,
                user_id,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating project: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Memory ───────────────────────────────────────────────────────────────────

async fn get_memory(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, project_id, session_id, content, type, tags, source, created_at
             FROM cowork_memory_entries WHERE user_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
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
        Ok(Ok(memories)) => Json(json!({ "memories": memories })).into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => {
            Json(json!({ "memories": Vec::<MemoryEntryRow>::new() })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting memories: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
}

async fn store_memory(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<StoreMemoryBody>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_memory_entries (id, user_id, project_id, session_id, content, type, tags, source)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id2,
                user_id,
                body.project_id,
                body.session_id,
                body.content,
                body.type_.unwrap_or_else(|| "fact".to_string()),
                body.tags,
                body.source,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "memory": { "id": id } }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error storing memory: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct SearchMemoryBody {
    query: String,
}

async fn search_memory(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<SearchMemoryBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let pattern = format!("%{}%", body.query.replace('%', "\\%").replace('_', "\\_"));

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, project_id, session_id, content, type, tags, source, created_at
             FROM cowork_memory_entries
             WHERE user_id = ?1 AND content LIKE ?2 ESCAPE '\\'
             ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id, pattern], |row| {
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
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
            Json(json!({"status": "unhealthy", "connected": false, "error": e.to_string()})).into_response()
        }
        Err(e) => {
            warn!("DB health task panicked: {}", e);
            Json(json!({"status": "unhealthy", "connected": false, "error": "internal error"})).into_response()
        }
    }
}

// ─── Connectors / Approvals / Suggestions ─────────────────────────────────────

async fn list_connectors(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, enabled, config, last_used, created_at, updated_at
             FROM cowork_connectors WHERE user_id = ?1 ORDER BY updated_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn list_approvals(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let db = state.db.clone();

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, content, source, dismissed, created_at
             FROM cowork_approvals ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
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
        Ok(Ok(approvals)) => Json(json!({ "approvals": approvals })).into_response(),
        Ok(Err(e)) if is_no_such_table(&e) => {
            Json(json!({ "approvals": Vec::<SuggestionRow>::new() })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing approvals: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn list_suggestions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, content, source, dismissed, created_at
             FROM cowork_suggestions
             WHERE (user_id = ?1 OR user_id IS NULL) AND dismissed = 0
             ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreateSuggestionBody {
    content: String,
    source: Option<String>,
    #[serde(alias = "userId")]
    user_id: Option<String>,
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
    let user_id = body.user_id.unwrap_or_else(|| user.user_id.clone());

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_suggestions (id, user_id, content, source, dismissed)
             VALUES (?1, ?2, ?3, ?4, 0)",
            params![id2, user_id, body.content, body.source.unwrap_or_else(|| "system".to_string())],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "id": id }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating suggestion: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO cowork_executions (id, user_id, kind, agent_id, command, prompt, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id2,
                user_id,
                "team",
                body.agent_id,
                body.command,
                body.prompt,
                "queued",
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"execution_id": id, "status": "queued"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating team execution: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
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
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let agent_id = body.agent_id
            .or_else(|| body.spec.as_ref().and_then(|s| s.get("id").and_then(|v| v.as_str()).map(|s| s.to_string())));
        let prompt = body.prompt
            .or_else(|| body.spec.as_ref().and_then(|s| s.get("prompt").and_then(|v| v.as_str()).map(|s| s.to_string())));
        let command = body.role
            .or_else(|| body.spec.as_ref().and_then(|s| s.get("role").and_then(|v| v.as_str()).map(|s| s.to_string())));
        conn.execute(
            "INSERT INTO cowork_executions (id, user_id, kind, agent_id, command, prompt, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id2,
                user_id,
                "agent",
                agent_id,
                command,
                prompt,
                "running",
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"execution_id": id, "status": "running"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating agent execution: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}


async fn cowork_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "cowork",
    }))
}
