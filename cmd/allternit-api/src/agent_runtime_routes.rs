
//! Agent Runtime API routes

use axum::extract::Extension;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
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

pub fn agent_runtime_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agent-runtimes", get(list_runtimes).post(create_runtime))
}

#[derive(Serialize)]
struct RuntimeRow {
    id: String,
    name: String,
    host: String,
    agent_clis: Option<String>,
    status: String,
    last_heartbeat: Option<String>,
    workspace_id: Option<String>,
    created_at: String,
}

#[derive(Deserialize)]
struct CreateRuntimeBody {
    name: String,
    host: String,
    #[serde(alias = "agentClis")]
    agent_clis: Option<Vec<String>>,
    #[serde(alias = "workspaceId")]
    workspace_id: Option<String>,
}

async fn list_runtimes(
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
            Ok(RuntimeRow {
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

async fn create_runtime(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateRuntimeBody>,
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
            warn!("DB error creating runtime: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}
