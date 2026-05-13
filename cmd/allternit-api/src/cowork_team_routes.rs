
//! Cowork Team API routes

use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
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

fn forbidden() -> axum::response::Response {
    (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
}

pub fn cowork_team_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/cowork-team", get(cowork_team_status))
        .route("/cowork-team/workspaces", get(list_team_workspaces).post(create_team_workspace))
        .route("/cowork-team/workspaces/:id", get(get_team_workspace).put(update_team_workspace).delete(delete_team_workspace))
        .route("/cowork-team/workspaces/:id/members", get(list_workspace_members).post(add_workspace_member))
        .route("/cowork-team/skills", get(list_team_skills2).post(create_team_skill2))
        .route("/cowork-team/skills/:id", get(get_team_skill2).put(update_team_skill2).delete(delete_team_skill2))
        .route("/cowork-team/agents", get(list_team_agents))
        .route("/cowork-team/board/:id/assign", post(assign_board_item).delete(unassign_board_item))
        .route("/cowork-team/runtimes", get(list_team_runtimes).post(create_team_runtime))
        .route("/cowork-team/parse-prd", post(parse_prd))
}

// ─── Team Workspaces ───────────────────────────────────────────────────────────

#[derive(Serialize)]
struct TeamWorkspaceRow {
    id: String,
    name: String,
    slug: String,
    owner_id: String,
    description: Option<String>,
    created_at: String,
    updated_at: String,
}

async fn list_team_workspaces(
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
             WHERE owner_id = ?1 OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?1)
             ORDER BY updated_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(TeamWorkspaceRow {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                owner_id: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"workspaces": data})).into_response(),
        _ => Json(json!({"workspaces": []})).into_response(),
    }
}

#[derive(Deserialize)]
struct CreateTeamWorkspaceBody {
    name: String,
    description: Option<String>,
}

async fn create_team_workspace(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateTeamWorkspaceBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let name = body.name.clone();
    let slug = name.to_lowercase().replace(" ", "-").replace(|c: char| !c.is_alphanumeric() && c != '-', "");
    let name_for_db = name.clone();
    let slug_for_db = slug.clone();
    let description = body.description;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO workspaces (id, name, slug, owner_id, description) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id2, name_for_db, slug_for_db, user_id, description],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"workspace": {"id": id, "name": name, "slug": slug}}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating team workspace: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn get_team_workspace(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = id.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let row = conn.query_row(
            "SELECT id, name, slug, owner_id, description, created_at, updated_at
             FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2))",
            params![ws_id, user_id],
            |row| {
                Ok(TeamWorkspaceRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    slug: row.get(2)?,
                    owner_id: row.get(3)?,
                    description: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )?;
        Ok::<_, rusqlite::Error>(row)
    }).await;

    match row {
        Ok(Ok(ws)) => Json(json!({"workspace": ws})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateTeamWorkspaceBody {
    name: Option<String>,
    description: Option<String>,
}

async fn update_team_workspace(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<UpdateTeamWorkspaceBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE workspaces SET name = COALESCE(?1, name), description = COALESCE(?2, description), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3 AND owner_id = ?4",
            params![body.name, body.description, id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

async fn delete_team_workspace(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM workspaces WHERE id = ?1 AND owner_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => Json(json!({"ok": true})).into_response(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

// ─── Workspace Members ─────────────────────────────────────────────────────────

#[derive(Serialize)]
struct MemberRow {
    id: String,
    workspace_id: String,
    user_id: String,
    role: String,
    joined_at: String,
}

async fn list_workspace_members(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = id.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify access
        let _: String = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2))",
            params![ws_id, user_id],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, user_id, role, joined_at
             FROM workspace_members WHERE workspace_id = ?1 ORDER BY joined_at DESC"
        )?;
        let rows = stmt.query_map(params![ws_id], |row| {
            Ok(MemberRow {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                user_id: row.get(2)?,
                role: row.get(3)?,
                joined_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"members": data})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => forbidden().into_response(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

#[derive(Deserialize)]
struct AddMemberBody {
    #[serde(alias = "userId")]
    user_id: Option<String>,
    #[serde(alias = "agentId")]
    _agent_id: Option<String>,
    role: Option<String>,
}

async fn add_workspace_member(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<AddMemberBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let ws_id = id.clone();
    let user_id = user.user_id.clone();
    let member_user_id = body.user_id.unwrap_or_else(|| user.user_id.clone());
    let role = body.role.unwrap_or_else(|| "member".to_string());
    let role_for_db = role.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify owner/admin access
        let has_access: bool = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND owner_id = ?2",
            params![ws_id, user_id],
            |_| Ok(true),
        ).unwrap_or(false) || conn.query_row(
            "SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2 AND role IN ('owner', 'admin')",
            params![ws_id, user_id],
            |_| Ok(true),
        ).unwrap_or(false);

        if !has_access {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        let mid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
            params![mid, ws_id, member_user_id, role_for_db],
        )?;
        Ok::<_, rusqlite::Error>(mid)
    }).await;

    match result {
        Ok(Ok(mid)) => (StatusCode::CREATED, Json(json!({"member": {"id": mid, "role": role}}))).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => forbidden(),
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

// ─── Team Skills ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct TeamSkillRow2 {
    id: String,
    workspace_id: String,
    name: String,
    description: Option<String>,
    manifest: Option<String>,
    source_repo: Option<String>,
    version: String,
    installed_by: String,
    installed_at: String,
}

async fn list_team_skills2(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let ws_id = params.get("workspaceId").cloned().or_else(|| params.get("workspace_id").cloned());

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt;
        let rows: Vec<TeamSkillRow2>;
        if let Some(ref ws) = ws_id {
            stmt = conn.prepare(
                "SELECT id, workspace_id, name, description, manifest, source_repo, version, installed_by, installed_at
                 FROM team_skills WHERE workspace_id = ?1 ORDER BY installed_at DESC"
            )?;
            rows = stmt.query_map(params![ws], row_to_skill2)?.collect::<Result<Vec<_>, _>>()?;
        } else {
            stmt = conn.prepare(
                "SELECT id, workspace_id, name, description, manifest, source_repo, version, installed_by, installed_at
                 FROM team_skills
                 WHERE workspace_id IN (
                     SELECT id FROM workspaces WHERE owner_id = ?1
                     UNION
                     SELECT workspace_id FROM workspace_members WHERE user_id = ?1
                 )
                 ORDER BY installed_at DESC"
            )?;
            rows = stmt.query_map(params![user_id], row_to_skill2)?.collect::<Result<Vec<_>, _>>()?;
        }
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"skills": data})).into_response(),
        _ => Json(json!({"skills": []})).into_response(),
    }
}

fn row_to_skill2(row: &rusqlite::Row) -> Result<TeamSkillRow2, rusqlite::Error> {
    Ok(TeamSkillRow2 {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        manifest: row.get(4)?,
        source_repo: row.get(5)?,
        version: row.get(6)?,
        installed_by: row.get(7)?,
        installed_at: row.get(8)?,
    })
}

#[derive(Deserialize)]
struct CreateTeamSkillBody2 {
    #[serde(alias = "workspaceId")]
    workspace_id: String,
    name: String,
    description: Option<String>,
    manifest: Option<serde_json::Value>,
    #[serde(alias = "sourceRepo")]
    source_repo: Option<String>,
    version: Option<String>,
}

async fn create_team_skill2(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateTeamSkillBody2>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let ws_id = body.workspace_id.clone();
    let skill_name = body.name.clone();
    let description = body.description;
    let manifest = body.manifest;
    let source_repo = body.source_repo;
    let version = body.version;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let has_access: bool = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (
                SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2 AND role IN ('owner', 'admin')
            ))",
            params![ws_id, user_id],
            |_| Ok(true),
        ).unwrap_or(false);

        if !has_access {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        conn.execute(
            "INSERT INTO team_skills (id, workspace_id, name, description, manifest, source_repo, version, installed_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id2,
                ws_id,
                skill_name,
                description,
                manifest.map(|m| m.to_string()),
                source_repo,
                version.unwrap_or_else(|| "0.0.1".to_string()),
                user_id,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"skill": {"id": id, "name": body.name}}))).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => forbidden(),
        Ok(Err(e)) => {
            warn!("DB error creating team skill: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn get_team_skill2(
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
            "SELECT id, workspace_id, name, description, manifest, source_repo, version, installed_by, installed_at
             FROM team_skills WHERE id = ?1"
        )?;
        let row = stmt.query_row(params![id2], row_to_skill2)?;

        let has_access: bool = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (
                SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2
            ))",
            params![row.workspace_id, user_id],
            |_| Ok(true),
        ).unwrap_or(false);

        if !has_access {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        Ok::<_, rusqlite::Error>(row)
    }).await;

    match row {
        Ok(Ok(data)) => Json(json!({"skill": data})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => forbidden(),
        _ => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateTeamSkillBody2 {
    name: Option<String>,
    description: Option<String>,
    version: Option<String>,
}

async fn update_team_skill2(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<UpdateTeamSkillBody2>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let ws_id: String = conn.query_row(
            "SELECT workspace_id FROM team_skills WHERE id = ?1",
            params![id2],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let has_access: bool = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (
                SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2 AND role IN ('owner', 'admin')
            ))",
            params![ws_id, user_id],
            |_| Ok(true),
        ).unwrap_or(false);

        if !has_access {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        conn.execute(
            "UPDATE team_skills SET name = COALESCE(?1, name), description = COALESCE(?2, description), version = COALESCE(?3, version)
             WHERE id = ?4",
            params![body.name, body.description, body.version, id2],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => forbidden(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

async fn delete_team_skill2(
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
        let ws_id: String = conn.query_row(
            "SELECT workspace_id FROM team_skills WHERE id = ?1",
            params![id2],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let has_access: bool = conn.query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (
                SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2 AND role IN ('owner', 'admin')
            ))",
            params![ws_id, user_id],
            |_| Ok(true),
        ).unwrap_or(false);

        if !has_access {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        conn.execute("DELETE FROM team_skills WHERE id = ?1", params![id2])?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => Json(json!({"ok": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => forbidden(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

// ─── Team Agents ───────────────────────────────────────────────────────────────

async fn list_team_agents(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let ws_id = params.get("workspaceId").cloned();

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt;
        let rows: Vec<serde_json::Value>;
        if let Some(ref ws) = ws_id {
            stmt = conn.prepare(
                "SELECT id, name, description, type, model, provider, capabilities, status, workspace_id, created_at
                 FROM agents WHERE workspace_id = ?1 ORDER BY created_at DESC"
            )?;
            rows = stmt.query_map(params![ws], |row| {
                let caps: Option<String> = row.get(6)?;
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "type": row.get::<_, String>(3)?,
                    "model": row.get::<_, String>(4)?,
                    "provider": row.get::<_, String>(5)?,
                    "capabilities": caps.as_ref().and_then(|s| serde_json::from_str(s).ok()).unwrap_or(serde_json::Value::Null),
                    "status": row.get::<_, String>(7)?,
                    "workspace_id": row.get::<_, Option<String>>(8)?,
                    "created_at": row.get::<_, String>(9)?,
                }))
            })?.collect::<Result<Vec<_>, _>>()?;
        } else {
            stmt = conn.prepare(
                "SELECT id, name, description, type, model, provider, capabilities, status, workspace_id, created_at
                 FROM agents WHERE user_id = ?1 ORDER BY created_at DESC"
            )?;
            rows = stmt.query_map(params![user_id], |row| {
                let caps: Option<String> = row.get(6)?;
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "type": row.get::<_, String>(3)?,
                    "model": row.get::<_, String>(4)?,
                    "provider": row.get::<_, String>(5)?,
                    "capabilities": caps.as_ref().and_then(|s| serde_json::from_str(s).ok()).unwrap_or(serde_json::Value::Null),
                    "status": row.get::<_, String>(7)?,
                    "workspace_id": row.get::<_, Option<String>>(8)?,
                    "created_at": row.get::<_, String>(9)?,
                }))
            })?.collect::<Result<Vec<_>, _>>()?;
        }
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"agents": data})).into_response(),
        _ => Json(json!({"agents": []})).into_response(),
    }
}

// ─── Board Assign ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct AssignBody {
    #[serde(alias = "assigneeType")]
    assignee_type: Option<String>,
    #[serde(alias = "assigneeId")]
    assignee_id: String,
}

async fn assign_board_item(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<AssignBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let item_id = id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE board_items SET assignee_type = ?1, assignee_id = ?2 WHERE id = ?3 AND EXISTS (
                SELECT 1 FROM workspaces w WHERE w.id = board_items.workspace_id AND (w.owner_id = ?4 OR EXISTS (
                    SELECT 1 FROM workspace_members WHERE workspace_id = w.id AND user_id = ?4
                ))
            )",
            params![body.assignee_type, body.assignee_id, item_id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => Json(json!({"item": {"id": id}})).into_response(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

async fn unassign_board_item(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let item_id = id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE board_items SET assignee_type = NULL, assignee_id = NULL WHERE id = ?1 AND EXISTS (
                SELECT 1 FROM workspaces w WHERE w.id = board_items.workspace_id AND (w.owner_id = ?2 OR EXISTS (
                    SELECT 1 FROM workspace_members WHERE workspace_id = w.id AND user_id = ?2
                ))
            )",
            params![item_id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => Json(json!({"item": {"id": id}})).into_response(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response(),
    }
}

// ─── Team Runtimes ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct TeamRuntimeRow {
    id: String,
    name: String,
    host: String,
    agent_clis: Option<String>,
    status: String,
    last_heartbeat: Option<String>,
    workspace_id: Option<String>,
    created_at: String,
}

async fn list_team_runtimes(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, host, agent_clis, status, last_heartbeat, workspace_id, created_at
             FROM agent_runtimes WHERE user_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(TeamRuntimeRow {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                agent_clis: row.get(3)?,
                status: row.get(4)?,
                last_heartbeat: row.get(5)?,
                workspace_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"runtimes": data})).into_response(),
        _ => Json(json!({"runtimes": []})).into_response(),
    }
}

#[derive(Deserialize)]
struct CreateTeamRuntimeBody {
    name: String,
    host: String,
    #[serde(alias = "agentClis")]
    agent_clis: Option<Vec<String>>,
    #[serde(alias = "workspaceId")]
    workspace_id: Option<String>,
}

async fn create_team_runtime(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateTeamRuntimeBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let name = body.name.clone();
    let clis = body.agent_clis.map(|c| serde_json::to_string(&c).unwrap_or_default());

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO agent_runtimes (id, user_id, name, host, agent_clis, status, workspace_id)
             VALUES (?1, ?2, ?3, ?4, ?5, 'online', ?6)",
            params![id2, user_id, body.name, body.host, clis, body.workspace_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"runtime": {"id": id, "name": name, "status": "online"}}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating team runtime: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Parse PRD ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ParsePRDBody {
    description: String,
    #[serde(alias = "existingTitles")]
    _existing_titles: Option<Vec<String>>,
    #[serde(alias = "maxTasks")]
    max_tasks: Option<i64>,
    #[serde(alias = "modelId")]
    _model_id: Option<String>,
}

async fn parse_prd(
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<ParsePRDBody>,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    // Stub: return mock parsed tasks
    let max = body.max_tasks.unwrap_or(5).max(1).min(20);
    let items: Vec<serde_json::Value> = (1..=max).map(|i| {
        json!({
            "title": format!("Task {} from PRD", i),
            "description": format!("Auto-generated task based on PRD description: {}...", &body.description[..body.description.len().min(50)]),
            "priority": if i == 1 { "high" } else { "medium" },
        })
    }).collect();

    Json(json!({
        "items": items,
        "summary": format!("Parsed {} tasks from PRD description", max),
        "task_count": max,
    })).into_response()
}


async fn cowork_team_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "cowork-team",
    }))
}
