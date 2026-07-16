//! Cowork Agent Queue Routes
//!
//! Handles claiming, starting, and completing agent tasks in the queue.

use axum::extract::State;
use axum::{
    extract::{Path, Query},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::auth::get_user;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueItem {
    pub id: String,
    pub task_id: String,
    pub agent_id: Option<String>,
    pub agent_role: Option<String>,
    pub status: String,
    pub claimed_at: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub result: Option<String>,
    pub error: Option<String>,
    pub retry_count: i64,
    pub max_retries: i64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ListQueueQuery {
    pub workspace_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClaimQueueRequest {
    pub agent_id: String,
    pub agent_role: Option<String>,
    pub workspace_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQueueRequest {
    pub id: Option<String>,
    pub task_id: String,
    pub agent_id: Option<String>,
    pub agent_role: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CompleteQueueRequest {
    pub result: Option<String>,
    pub error: Option<String>,
}

pub fn queue_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/queue", get(list_queue).post(create_queue))
        .route("/queue/claim", post(claim_queue))
        .route("/queue/:id/start", post(start_queue))
        .route("/queue/:id/complete", post(complete_queue))
}

async fn list_queue(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListQueueQuery>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
                .into_response()
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
                .into_response()
        }
    };

    let mut sql = "SELECT id, task_id, agent_id, agent_role, status, claimed_at, started_at, completed_at, result, error, retry_count, max_retries, created_at FROM cowork_queue WHERE 1=1".to_string();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_count = 0;

    if let Some(ref status) = query.status {
        param_count += 1;
        sql.push_str(&format!(" AND status = ?{}", param_count));
        params.push(Box::new(status.clone()));
    }

    if let Some(ref workspace_id) = query.workspace_id {
        param_count += 1;
        sql.push_str(&format!(
            " AND task_id IN (SELECT id FROM tasks WHERE workspace_id = ?{})",
            param_count
        ));
        params.push(Box::new(workspace_id.clone()));
    }

    sql.push_str(" ORDER BY created_at DESC");

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
    };

    let items: Vec<QueueItem> = match stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(QueueItem {
            id: row.get(0)?,
            task_id: row.get(1)?,
            agent_id: row.get(2)?,
            agent_role: row.get(3)?,
            status: row.get(4)?,
            claimed_at: row.get(5)?,
            started_at: row.get(6)?,
            completed_at: row.get(7)?,
            result: row.get(8)?,
            error: row.get(9)?,
            retry_count: row.get(10)?,
            max_retries: row.get(11)?,
            created_at: row.get(12)?,
        })
    }) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
    };

    (StatusCode::OK, Json(items)).into_response()
}

async fn claim_queue(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ClaimQueueRequest>,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
                .into_response()
        }
    };

    let mut conn = match state.db.connect() {
        Ok(c) => c,
        Err(_e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
                .into_response()
        }
    };

    // Find the next pending queue item
    let tx = match conn.transaction() {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
    };

    let mut sql = "SELECT id, task_id FROM cowork_queue WHERE status = 'pending'".to_string();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_count = 0;

    if let Some(ref workspace_id) = body.workspace_id {
        param_count += 1;
        sql.push_str(&format!(
            " AND task_id IN (SELECT id FROM tasks WHERE workspace_id = ?{})",
            param_count
        ));
        params.push(Box::new(workspace_id.clone()));
    }
    sql.push_str(" ORDER BY created_at ASC LIMIT 1");

    let next_item: Option<(String, String)> =
        match tx.query_row(&sql, rusqlite::params_from_iter(params), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }) {
            Ok(row) => Some(row),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": e.to_string()})),
                )
                    .into_response()
            }
        };

    let (id, task_id) = match next_item {
        Some(item) => item,
        None => return (StatusCode::OK, Json(serde_json::Value::Null)).into_response(),
    };

    // Update status to claimed
    let result = tx.execute(
        "UPDATE cowork_queue 
         SET status = 'claimed', agent_id = ?1, agent_role = ?2, claimed_at = CURRENT_TIMESTAMP 
         WHERE id = ?3",
        rusqlite::params![
            &body.agent_id,
            body.agent_role.as_deref().unwrap_or(""),
            &id
        ],
    );

    if let Err(e) = result {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response();
    }

    if let Err(e) = tx.commit() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response();
    }

    (
        StatusCode::OK,
        Json(json!({
            "id": id,
            "task_id": task_id,
            "status": "claimed",
        })),
    )
        .into_response()
}

async fn start_queue(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
                .into_response()
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
                .into_response()
        }
    };

    let result = conn.execute(
        "UPDATE cowork_queue 
         SET status = 'running', started_at = CURRENT_TIMESTAMP 
         WHERE id = ?1",
        [&id],
    );

    match result {
        Ok(0) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Queue item not found"})),
        )
            .into_response(),
        Ok(_) => (StatusCode::OK, Json(json!({"id": id, "status": "running"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn complete_queue(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<CompleteQueueRequest>,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
                .into_response()
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
                .into_response()
        }
    };

    let status = if body.error.is_some() {
        "failed"
    } else {
        "completed"
    };

    let result = conn.execute(
        "UPDATE cowork_queue 
         SET status = ?1, result = ?2, error = ?3, completed_at = CURRENT_TIMESTAMP 
         WHERE id = ?4",
        rusqlite::params![
            status,
            body.result.as_deref().unwrap_or(""),
            body.error.as_deref().unwrap_or(""),
            &id
        ],
    );

    match result {
        Ok(0) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Queue item not found"})),
        )
            .into_response(),
        Ok(_) => (StatusCode::OK, Json(json!({"id": id, "status": status}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn create_queue(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateQueueRequest>,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
                .into_response()
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
    };

    let queue_id = payload
        .id
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let status = payload.status.unwrap_or_else(|| "pending".to_string());

    match conn.execute(
        "INSERT INTO cowork_queue (id, task_id, agent_id, agent_role, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)",
        rusqlite::params![
            &queue_id,
            &payload.task_id,
            &payload.agent_id,
            &payload.agent_role,
            &status,
        ],
    ) {
        Ok(_) => (
            StatusCode::CREATED,
            Json(json!({
                "id": queue_id,
                "task_id": payload.task_id,
                "agent_id": payload.agent_id,
                "agent_role": payload.agent_role,
                "status": status,
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}
