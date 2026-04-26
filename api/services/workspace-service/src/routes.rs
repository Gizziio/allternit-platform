//! HTTP route handlers for the workspace service.

use crate::{AppState, sessions::{PaneMetadata, SessionMetadata}, skills::RegisterSkillRequest};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;

// ─── Health ──────────────────────────────────────────────────────────────────

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "ok",
        "sessions": state.sessions.session_count(),
        "panes": state.sessions.pane_count(),
        "skills": state.skills.count(),
    }))
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateSessionBody {
    pub name: String,
    pub working_dir: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub metadata: SessionMetadata,
    pub workspace_id: Option<String>,
}

pub async fn create_session(
    State(state): State<AppState>,
    Json(body): Json<CreateSessionBody>,
) -> impl IntoResponse {
    let session = state.sessions.create_session(
        body.name,
        body.metadata,
        body.working_dir,
        body.env,
        body.workspace_id,
    );
    (StatusCode::CREATED, Json(json!({ "session": to_session_response(&session) })))
}

pub async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    match state.sessions.get_session(&id) {
        Some(session) => Json(json!({ "session": to_session_response(&session) })).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({ "error": "Session not found" }))).into_response(),
    }
}

pub async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if state.sessions.delete_session(&id) {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

fn to_session_response(s: &crate::sessions::SessionRecord) -> Value {
    json!({
        "id": s.id,
        "name": s.name,
        "status": s.status,
        "windows": 1,
        "panes": s.pane_ids.len(),
        "attached": false,
        "workspace_id": s.workspace_id,
        "created_at": s.created_at,
    })
}

// ─── Panes ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreatePaneBody {
    pub name: String,
    pub command: Option<String>,
    #[serde(default)]
    pub metadata: PaneMetadata,
}

pub async fn create_pane(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(body): Json<CreatePaneBody>,
) -> Response {
    match state.sessions.create_pane(&session_id, body.name, body.metadata) {
        Some(pane) => (
            StatusCode::CREATED,
            Json(json!({ "id": pane.id, "session_id": pane.session_id, "title": pane.title })),
        ).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({ "error": "Session not found" }))).into_response(),
    }
}

pub async fn delete_pane(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if state.sessions.delete_pane(&id) {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn capture_pane(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    match state.sessions.capture_pane_output(&id) {
        Some(output) => Json(json!({ "output": output })).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({ "error": "Pane not found" }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct SendKeysBody {
    pub keys: String,
}

pub async fn send_keys(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<SendKeysBody>,
) -> Response {
    // Append the sent keys as output (simulated — real impl would write to pty)
    state.sessions.append_pane_output(&id, format!("$ {}", body.keys));
    Json(json!({ "ok": true })).into_response()
}

pub async fn stream_pane_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    match state.sessions.capture_pane_output(&id) {
        Some(output) => Json(json!({ "logs": output })).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({ "error": "Pane not found" }))).into_response(),
    }
}

// ─── Skills ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SkillsQuery {
    pub workspace_id: Option<String>,
}

pub async fn list_skills(
    State(state): State<AppState>,
    Query(query): Query<SkillsQuery>,
) -> Json<Value> {
    let workspace_id = query.workspace_id.as_deref().unwrap_or("");
    let skills = state.skills.list_by_workspace(workspace_id);
    Json(json!({ "skills": skills }))
}

pub async fn register_skill(
    State(state): State<AppState>,
    Json(body): Json<RegisterSkillRequest>,
) -> impl IntoResponse {
    let skill = state.skills.register(body);
    (StatusCode::CREATED, Json(json!({ "skill": skill })))
}

pub async fn get_skill(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    match state.skills.get(&id) {
        Some(skill) => Json(json!({ "skill": skill })).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({ "error": "Skill not found" }))).into_response(),
    }
}

pub async fn delete_skill(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if state.skills.delete(&id) {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}
