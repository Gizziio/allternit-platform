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

pub fn swarm_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/swarms", get(list_swarms).post(create_swarm))
        .route("/swarms/:id/execute", post(execute_swarm))
        .route("/swarm/threads", get(list_swarm_threads))
        .route("/swarm/health", get(swarm_health))
        .route("/swarm/executions/:id", get(get_execution))
}

// ─── Data models ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct SwarmRow {
    id: String,
    user_id: String,
    name: String,
    description: Option<String>,
    #[serde(rename = "type")]
    agent_type: String,
    config: Option<String>,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct ExecutionRow {
    id: String,
    workflow_id: String,
    status: String,
    started_at: Option<String>,
    completed_at: Option<String>,
    result: Option<String>,
    error: Option<String>,
    created_at: String,
    updated_at: String,
}

// ─── List swarms ──────────────────────────────────────────────────────────────

async fn list_swarms(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, type, config, status, created_at, updated_at
             FROM agents WHERE user_id = ?1 AND type = 'orchestrator'
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt
            .query_map(params![user_id], |row| {
                Ok(SwarmRow {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    agent_type: row.get(4)?,
                    config: row.get(5)?,
                    status: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(swarms)) => Json(json!({ "swarms": swarms })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing swarms: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
                .into_response()
        }
    }
}

// ─── Create swarm ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateSwarmBody {
    name: String,
    description: Option<String>,
    agents: Option<Vec<serde_json::Value>>,
    max_rounds: Option<i64>,
}

async fn create_swarm(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateSwarmBody>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;
    let resp_name = body.name.clone();
    let name = body.name;
    let description = body.description;
    let config = json!({
        "agents": body.agents.unwrap_or_default(),
        "max_rounds": body.max_rounds.unwrap_or(5),
    });
    let config_str = config.to_string();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO agents (id, user_id, name, description, type, model, provider, config, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id2,
                user_id,
                name,
                description,
                "orchestrator",
                "",
                "",
                config_str,
                "idle",
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => {
            (StatusCode::CREATED, Json(json!({ "id": id, "name": resp_name }))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error creating swarm: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
                .into_response()
        }
    }
}

// ─── Execute swarm ────────────────────────────────────────────────────────────

async fn execute_swarm(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let swarm_id = id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM agents WHERE id = ?1 AND user_id = ?2 AND type = 'orchestrator'",
                params![&swarm_id, &user_id],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !exists {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        let execution_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO workflow_executions (id, workflow_id, status, started_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)",
            params![&execution_id, &swarm_id, "running"],
        )?;
        Ok::<_, rusqlite::Error>(execution_id)
    })
    .await;

    match result {
        Ok(Ok(execution_id)) => {
            Json(json!({"execution_id": execution_id, "status": "running"})).into_response()
        }
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error executing swarm: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
                .into_response()
        }
    }
}

// ─── Get execution ────────────────────────────────────────────────────────────

async fn get_execution(
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
            "SELECT e.id, e.workflow_id, e.status, e.started_at, e.completed_at, e.result, e.error, e.created_at, e.updated_at
             FROM workflow_executions e
             JOIN agents a ON e.workflow_id = a.id AND a.type = 'orchestrator'
             WHERE e.id = ?1 AND a.user_id = ?2",
        )?;
        let row = stmt.query_row(params![id, user_id], |row| {
            Ok(ExecutionRow {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                status: row.get(2)?,
                started_at: row.get(3)?,
                completed_at: row.get(4)?,
                result: row.get(5)?,
                error: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(execution)) => Json(json!({ "execution": execution })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting execution: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
                .into_response()
        }
    }
}


// ─── Swarm threads (stub) ───────────────────────────────────────────────────

async fn list_swarm_threads() -> impl IntoResponse {
    Json(json!({
        "threads": [],
        "total": 0,
    }))
}

// ─── Swarm health (stub) ────────────────────────────────────────────────────

async fn swarm_health() -> impl IntoResponse {
    Json(json!({
        "status": "healthy",
        "swarm": "operational",
    }))
}
