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
    if let Some(session) = state.sessions.delete_session(&id) {
        // Close the backing mux session (real PTYs) if one was provisioned.
        if let Some(mux_id) = session.mux_session_id {
            let _ = crate::mux::mux_call("session.close", json!({ "session_id": mux_id })).await;
        }
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
    let Some(session) = state.sessions.get_session(&session_id) else {
        return (StatusCode::NOT_FOUND, Json(json!({ "error": "Session not found" }))).into_response();
    };

    // Provision the backing mux session lazily (first pane for this session).
    let mux_session_id = match &session.mux_session_id {
        Some(id) => Some(id.clone()),
        None => {
            let created = crate::mux::mux_call(
                "session.create",
                json!({
                    "label": format!("ws-{}", session.id),
                    "cwd": session.working_dir,
                }),
            )
            .await;
            match created {
                Ok(v) => v["session"]["session_id"].as_str().map(|s| {
                    state.sessions.set_mux_session_id(&session.id, s.to_string());
                    s.to_string()
                }),
                Err(err) => {
                    tracing::warn!(%err, "mux unavailable; pane will be metadata-only");
                    None
                }
            }
        }
    };

    let Some(pane) = state.sessions.create_pane(&session_id, body.name, body.metadata) else {
        return (StatusCode::NOT_FOUND, Json(json!({ "error": "Session not found" }))).into_response();
    };

    // Back the pane with a real mux PTY (command or default shell).
    if let Some(mux_sid) = mux_session_id {
        let argv: Vec<String> = match &body.command {
            Some(cmd) if !cmd.trim().is_empty() => vec!["/bin/sh".into(), "-c".into(), cmd.clone()],
            _ => vec![std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into())],
        };
        let created = crate::mux::mux_call(
            "pane.create",
            json!({
                "session_id": mux_sid,
                "command": argv,
                "env": session.env,
            }),
        )
        .await;
        match created {
            Ok(v) => {
                if let Some(pid) = v["pane"]["pane_id"].as_str() {
                    state.sessions.set_mux_pane_id(&pane.id, pid.to_string());
                }
            }
            Err(err) => tracing::warn!(%err, "failed to provision mux pane"),
        }
    }

    (
        StatusCode::CREATED,
        Json(json!({ "id": pane.id, "session_id": pane.session_id, "title": pane.title })),
    ).into_response()
}

pub async fn delete_pane(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let mux_pane_id = state.sessions.get_pane(&id).and_then(|p| p.mux_pane_id);
    if state.sessions.delete_pane(&id) {
        if let Some(mux_pid) = mux_pane_id {
            let _ = crate::mux::mux_call("pane.close", json!({ "pane_id": mux_pid })).await;
        }
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn capture_pane(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    let Some(pane) = state.sessions.get_pane(&id) else {
        return (StatusCode::NOT_FOUND, Json(json!({ "error": "Pane not found" }))).into_response();
    };
    // Real PTY scrollback from mux when provisioned; legacy buffer otherwise.
    if let Some(mux_pid) = &pane.mux_pane_id {
        if let Ok(v) = crate::mux::mux_call("pane.read", json!({ "pane_id": mux_pid })).await {
            if let Some(output) = v["output"].as_str() {
                return Json(json!({ "output": output })).into_response();
            }
        }
    }
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
    let Some(pane) = state.sessions.get_pane(&id) else {
        return (StatusCode::NOT_FOUND, Json(json!({ "error": "Pane not found" }))).into_response();
    };
    if let Some(mux_pid) = &pane.mux_pane_id {
        // Real PTY input: keys + Enter (send-keys semantics).
        let data = if body.keys.ends_with('\n') {
            body.keys.clone()
        } else {
            format!("{}\n", body.keys)
        };
        return match crate::mux::mux_call(
            "pane.send_input",
            json!({ "pane_id": mux_pid, "data": data }),
        )
        .await
        {
            Ok(_) => Json(json!({ "ok": true })).into_response(),
            Err(err) => (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "ok": false, "error": err })),
            )
                .into_response(),
        };
    }
    // Metadata-only fallback (mux unavailable at pane creation time).
    state.sessions.append_pane_output(&id, format!("$ {}", body.keys));
    Json(json!({ "ok": true })).into_response()
}

pub async fn stream_pane_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    let Some(pane) = state.sessions.get_pane(&id) else {
        return (StatusCode::NOT_FOUND, Json(json!({ "error": "Pane not found" }))).into_response();
    };
    if let Some(mux_pid) = &pane.mux_pane_id {
        if let Ok(v) = crate::mux::mux_call("pane.read", json!({ "pane_id": mux_pid })).await {
            if let Some(logs) = v["output"].as_str() {
                return Json(json!({ "logs": logs })).into_response();
            }
        }
    }
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
