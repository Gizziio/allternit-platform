
//! Workspace API routes — local SQLite persistence.

use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{delete, get},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

pub fn workspace_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/workspaces", get(list_workspaces).post(create_workspace))
        .route("/workspaces/:id", get(get_workspace).put(update_workspace).delete(delete_workspace))
        .route("/workspaces/:id/members", get(list_members).post(add_member))
        .route("/workspaces/:id/members/:member_id", delete(remove_member))
        .route("/workspaces/:id/invites", get(list_invites).post(create_invite))
        .route("/workspaces/:id/invites/:invite_id", delete(delete_invite))
}

// ─── List workspaces ────────────────────────────────────────────────────────────

async fn list_workspaces(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, slug, owner_id, description, created_at, updated_at
             FROM workspaces
             WHERE owner_id = ?1
                OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?1)
             ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(WorkspaceRow {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                owner_id: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(data)) => Json(json!({ "workspaces": data })).into_response(),
        _ => Json(json!({ "workspaces": vec![] as Vec<WorkspaceRow> })).into_response(),
    }
}

// ─── Create workspace ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateWorkspaceBody {
    name: String,
    slug: Option<String>,
    description: Option<String>,
}

async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateWorkspaceBody>,
) -> impl IntoResponse {

    let id = uuid::Uuid::new_v4().to_string();
    let slug = body.slug.unwrap_or_else(|| {
        body.name.to_lowercase().replace(" ", "-")
    });
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO workspaces (id, name, slug, owner_id, description)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id2, body.name, slug, user_id, body.description],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "workspace": { "id": id } }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating workspace: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Get workspace ──────────────────────────────────────────────────────────────

async fn get_workspace(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, slug, owner_id, description, created_at, updated_at
             FROM workspaces WHERE id = ?1 AND (
                owner_id = ?2
                OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2)
             )"
        )?;
        let row = stmt.query_row(params![id2, user_id], |row| {
            Ok(WorkspaceRow {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                owner_id: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(ws)) => Json(json!({ "workspace": ws })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

// ─── List members ───────────────────────────────────────────────────────────────

async fn list_members(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = workspace_id.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workspace ownership
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND owner_id = ?2",
            params![ws_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, user_id, agent_id, role, joined_at
             FROM workspace_members WHERE workspace_id = ?1"
        )?;
        let rows = stmt.query_map(params![ws_id], |row| {
            Ok(MemberRow {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                user_id: row.get(2)?,
                agent_id: row.get(3)?,
                role: row.get(4)?,
                joined_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(data)) => Json(json!({ "members": data })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        _ => Json(json!({ "members": vec![] as Vec<MemberRow> })).into_response(),
    }
}

// ─── Add member ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct AddMemberBody {
    user_id: Option<String>,
    agent_id: Option<String>,
    role: Option<String>,
}

async fn add_member(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<AddMemberBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = workspace_id.clone();
    let user_id = user.user_id;
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workspace ownership
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND owner_id = ?2",
            params![ws_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        conn.execute(
            "INSERT INTO workspace_members (id, workspace_id, user_id, agent_id, role)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id2,
                ws_id,
                body.user_id,
                body.agent_id,
                body.role.unwrap_or_else(|| "member".to_string()),
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "member": { "id": id } }))).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error adding member: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Remove member ──────────────────────────────────────────────────────────────

async fn remove_member(
    State(state): State<Arc<AppState>>,
    Path((workspace_id, member_id)): Path<(String, String)>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = workspace_id.clone();
    let member_id2 = member_id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workspace ownership
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND owner_id = ?2",
            params![ws_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        conn.execute(
            "DELETE FROM workspace_members WHERE id = ?1 AND workspace_id = ?2",
            params![member_id2, ws_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error removing member: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Update workspace ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct UpdateWorkspaceBody {
    name: Option<String>,
    description: Option<String>,
}

async fn update_workspace(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<UpdateWorkspaceBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let name = body.name;
    let description = body.description;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify ownership or admin membership
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (
                owner_id = ?2
                OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2 AND role IN ('owner','admin'))
            )",
            params![id2, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        match (name, description) {
            (Some(n), Some(d)) => {
                conn.execute("UPDATE workspaces SET name = ?1, description = ?2 WHERE id = ?3", params![n, d, id2])?;
            }
            (Some(n), None) => {
                conn.execute("UPDATE workspaces SET name = ?1 WHERE id = ?2", params![n, id2])?;
            }
            (None, Some(d)) => {
                conn.execute("UPDATE workspaces SET description = ?1 WHERE id = ?2", params![d, id2])?;
            }
            (None, None) => {}
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error updating workspace: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Delete workspace ───────────────────────────────────────────────────────────

async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify ownership
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND owner_id = ?2",
            params![id2, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        conn.execute("DELETE FROM workspace_members WHERE workspace_id = ?1", params![id2])?;
        conn.execute("DELETE FROM workspace_invitations WHERE workspace_id = ?1", params![id2])?;
        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id2])?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error deleting workspace: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── List invites ───────────────────────────────────────────────────────────────

async fn list_invites(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = workspace_id.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify access
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (
                owner_id = ?2
                OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2)
            )",
            params![ws_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, email, role, token, expires_at, created_at
             FROM workspace_invitations WHERE workspace_id = ?1"
        )?;
        let rows = stmt.query_map(params![ws_id], |row| {
            Ok(InviteRow {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                email: row.get(2)?,
                role: row.get(3)?,
                token: row.get(4)?,
                expires_at: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(data)) => Json(json!({ "invitations": data })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        _ => Json(json!({ "invitations": vec![] as Vec<InviteRow> })).into_response(),
    }
}

// ─── Create invite ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateInviteBody {
    email: String,
    role: Option<String>,
}

async fn create_invite(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateInviteBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = workspace_id.clone();
    let user_id = user.user_id;
    let id = uuid::Uuid::new_v4().to_string();
    let token = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify ownership or admin
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (
                owner_id = ?2
                OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2 AND role IN ('owner','admin'))
            )",
            params![ws_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        conn.execute(
            "INSERT INTO workspace_invitations (id, workspace_id, email, role, token, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now', '+7 days'))",
            params![id2, ws_id, body.email, body.role.unwrap_or_else(|| "member".to_string()), token],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "invitation": { "id": id } }))).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error creating invite: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Delete invite ──────────────────────────────────────────────────────────────

async fn delete_invite(
    State(state): State<Arc<AppState>>,
    Path((workspace_id, invite_id)): Path<(String, String)>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = workspace_id.clone();
    let invite_id2 = invite_id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify ownership or admin
        let _ = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (
                owner_id = ?2
                OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2 AND role IN ('owner','admin'))
            )",
            params![ws_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        conn.execute(
            "DELETE FROM workspace_invitations WHERE id = ?1 AND workspace_id = ?2",
            params![invite_id2, ws_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error deleting invite: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Data models ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct WorkspaceRow {
    id: String,
    name: String,
    slug: String,
    owner_id: String,
    description: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct MemberRow {
    id: String,
    workspace_id: String,
    user_id: Option<String>,
    agent_id: Option<String>,
    role: String,
    joined_at: String,
}

#[derive(Serialize)]
struct InviteRow {
    id: String,
    workspace_id: String,
    email: String,
    role: String,
    token: String,
    expires_at: String,
    created_at: String,
}
