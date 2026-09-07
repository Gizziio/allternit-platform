//! Persist bot group rooms (membership + recent log) per user.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct BotGroupRecord {
    pub id: String,
    pub name: String,
    pub image: Option<String>,
    pub members_json: String,
    pub log_json: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/bot-groups", get(list_groups).put(upsert_group))
        .route("/bot-groups/:id", delete(delete_group))
}

async fn list_groups(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Vec<BotGroupRecord>>, StatusCode> {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let rows = tokio::task::spawn_blocking(move || -> Result<Vec<BotGroupRecord>, rusqlite::Error> {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, image, members_json, log_json, created_at, updated_at
             FROM bot_groups WHERE user_id = ?1 ORDER BY updated_at DESC",
        )?;
        let rows = stmt
            .query_map(rusqlite::params![user_id], |row| {
                Ok(BotGroupRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    image: row.get(2)?,
                    members_json: row.get(3)?,
                    log_json: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(rows))
}

async fn upsert_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(group): Json<BotGroupRecord>,
) -> Result<StatusCode, StatusCode> {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO bot_groups (id, user_id, name, image, members_json, log_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               image = excluded.image,
               members_json = excluded.members_json,
               log_json = excluded.log_json,
               updated_at = CURRENT_TIMESTAMP
             WHERE bot_groups.user_id = ?2",
            rusqlite::params![
                group.id,
                user_id,
                group.name,
                group.image,
                group.members_json,
                group.log_json
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM bot_groups WHERE id = ?1 AND user_id = ?2",
            rusqlite::params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
