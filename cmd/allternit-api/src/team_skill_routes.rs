
//! Team Skill API routes

use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::get,
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

pub fn team_skill_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/team-skills", get(list_team_skills).post(create_team_skill))
        .route("/team-skills/:id", get(get_team_skill).delete(delete_team_skill))
}

#[derive(Deserialize)]
struct ListTeamSkillsQuery {
    workspace_id: Option<String>,
}

async fn list_team_skills(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(query): Query<ListTeamSkillsQuery>,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let ws_id = query.workspace_id;
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let mut stmt;
        let rows: Vec<TeamSkillRow>;

        if let Some(ref ws) = ws_id {
            // Verify workspace access
            let has_access: bool = conn.query_row(
                "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (
                    SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2
                ))",
                params![ws, user_id],
                |_| Ok(true),
            ).unwrap_or(false);

            if !has_access {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            stmt = conn.prepare(
                "SELECT id, workspace_id, name, description, manifest, source_repo, version, installed_by, installed_at
                 FROM team_skills WHERE workspace_id = ?1 ORDER BY installed_at DESC"
            )?;
            rows = stmt.query_map(params![ws], |row| {
                Ok(TeamSkillRow {
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
            })?
            .collect::<Result<Vec<_>, _>>()?;
        } else {
            // No workspace filter — return skills from all accessible workspaces
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
            rows = stmt.query_map(params![user_id], |row| {
                Ok(TeamSkillRow {
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
            })?
            .collect::<Result<Vec<_>, _>>()?;
        }

        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => (StatusCode::OK, Json(json!({"skills": data}))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"})))
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))),
    }
}

#[derive(Deserialize)]
struct CreateTeamSkill {
    #[serde(alias = "workspaceId")]
    workspace_id: String,
    name: String,
    description: Option<String>,
    manifest: Option<serde_json::Value>,
    #[serde(alias = "sourceRepo")]
    source_repo: Option<String>,
    version: Option<String>,
}

async fn create_team_skill(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateTeamSkill>,
) -> impl axum::response::IntoResponse {

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "name is required"})));
    }

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let ws_id = body.workspace_id;
    let manifest_str = body.manifest.map(|m| m.to_string());
    let description = body.description;
    let source_repo = body.source_repo;
    let version = body.version.unwrap_or_else(|| "0.0.1".to_string());
    let name2 = name.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workspace admin access
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
                name2,
                description,
                manifest_str,
                source_repo,
                version,
                user_id,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"skill": { "id": id, "name": name }}))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Workspace not found or access denied"})))
        }
        Ok(Err(e)) => {
            warn!("DB error creating team skill: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

async fn get_team_skill(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, name, description, manifest, source_repo, version, installed_by, installed_at
             FROM team_skills WHERE id = ?1"
        )?;
        let row = stmt.query_row(params![id2], |row| {
            Ok(TeamSkillRow {
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
        })?;
        
        // Verify workspace access
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
        Ok(Ok(data)) => (StatusCode::OK, Json(json!({"skill": data}))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"})))
        }
        _ => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))),
    }
}

async fn delete_team_skill(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        
        // Get workspace_id for the skill
        let ws_id: String = conn.query_row(
            "SELECT workspace_id FROM team_skills WHERE id = ?1",
            params![id2],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        // Verify workspace admin access
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
            "DELETE FROM team_skills WHERE id = ?1",
            params![id2],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"success": true}))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"})))
        }
        Ok(Err(e)) => {
            warn!("DB error deleting team skill: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

#[derive(Serialize)]
struct TeamSkillRow {
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
