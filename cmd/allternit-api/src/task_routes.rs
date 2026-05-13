
//! Task Management Routes
//!
//! CRUD operations for tasks — supports personal and workspace-scoped tasks.

use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::error;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;

// ─── Request/Response Types ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub user_id: String,
    pub workspace_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub assignee_id: Option<String>,
    pub due_date: Option<String>,
    pub tags: Option<String>,
    pub metadata: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListTasksQuery {
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub offset: Option<usize>,
}

// ─── Router ─────────────────────────────────────────────────────────────────

pub fn task_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/tasks", get(list_tasks))
        .route("/tasks", post(create_task))
        .route("/tasks/:id", get(get_task))
        .route("/tasks/:id", put(update_task))
        .route("/tasks/:id", delete(delete_task))
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn list_tasks(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListTasksQuery>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            );
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("DB error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let mut sql = "SELECT * FROM tasks WHERE user_id = ?1".to_string();
    let mut param_count = 1;

    if query.workspace_id.is_some() {
        param_count += 1;
        sql.push_str(&format!(" AND workspace_id = ?{}", param_count));
    }
    if query.status.is_some() {
        param_count += 1;
        sql.push_str(&format!(" AND status = ?{}", param_count));
    }
    param_count += 1;
    sql.push_str(&format!(" ORDER BY created_at DESC LIMIT ?{}", param_count));
    param_count += 1;
    sql.push_str(&format!(" OFFSET ?{}", param_count));

    let limit = query.limit.unwrap_or(100) as i64;
    let offset = query.offset.unwrap_or(0) as i64;

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => {
            error!("SQL prepare error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Query error"})),
            );
        }
    };

    let tasks: Vec<Task> = match stmt.query_map(
        rusqlite::params![
            user.user_id,
            query.workspace_id.as_deref(),
            query.status.as_deref(),
            limit,
            offset,
        ],
        row_to_task,
    ) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(e) => {
            error!("Query error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Query error"})),
            );
        }
    };

    (StatusCode::OK, Json(json!({ "tasks": tasks, "count": tasks.len() })))
}

async fn create_task(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<CreateTaskRequest>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            );
        }
    };

    let id = uuid::Uuid::new_v4().to_string();
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("DB error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let result = conn.execute(
        "INSERT INTO tasks
         (id, user_id, workspace_id, title, description, status, priority, assignee_id, due_date, tags, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            &id,
            &user.user_id,
            body.workspace_id.as_deref().unwrap_or(""),
            &body.title,
            body.description.as_deref().unwrap_or(""),
            body.status.as_deref().unwrap_or("todo"),
            body.priority.as_deref().unwrap_or("medium"),
            body.assignee_id.as_deref().unwrap_or(""),
            body.due_date.as_deref().unwrap_or(""),
            body.tags.as_deref().unwrap_or(""),
            body.metadata.as_deref().unwrap_or(""),
        ],
    );

    match result {
        Ok(_) => {
            match get_task_by_id(&conn, &id) {
                Ok(Some(task)) => (StatusCode::CREATED, Json(json!({ "task": task }))),
                _ => (StatusCode::CREATED, Json(json!({ "id": id }))),
            }
        }
        Err(e) => {
            error!("Insert error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to create task"})),
            )
        }
    }
}

async fn get_task(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            );
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("DB error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    match get_task_by_id(&conn, &id) {
        Ok(Some(task)) => {
            if task.user_id != user.user_id {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Access denied"})),
                );
            }
            (StatusCode::OK, Json(json!({ "task": task })))
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Task not found"})),
        ),
        Err(e) => {
            error!("Query error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Query error"})),
            )
        }
    }
}

async fn update_task(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<UpdateTaskRequest>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            );
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("DB error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    // Verify ownership
    match get_task_by_id(&conn, &id) {
        Ok(Some(ref task)) if task.user_id != user.user_id => {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({"error": "Access denied"})),
            );
        }
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Task not found"})),
            );
        }
        _ => {}
    }

    let mut updates: Vec<String> = Vec::new();
    let mut param_count = 0;

    if body.title.is_some() {
        param_count += 1;
        updates.push(format!("title = ?{}", param_count));
    }
    if body.description.is_some() {
        param_count += 1;
        updates.push(format!("description = ?{}", param_count));
    }
    if body.status.is_some() {
        param_count += 1;
        updates.push(format!("status = ?{}", param_count));
    }
    if body.priority.is_some() {
        param_count += 1;
        updates.push(format!("priority = ?{}", param_count));
    }
    if body.assignee_id.is_some() {
        param_count += 1;
        updates.push(format!("assignee_id = ?{}", param_count));
    }
    if body.due_date.is_some() {
        param_count += 1;
        updates.push(format!("due_date = ?{}", param_count));
    }
    if body.tags.is_some() {
        param_count += 1;
        updates.push(format!("tags = ?{}", param_count));
    }
    if body.metadata.is_some() {
        param_count += 1;
        updates.push(format!("metadata = ?{}", param_count));
    }

    if updates.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "No fields to update"})),
        );
    }

    param_count += 1;
    updates.push(format!("updated_at = CURRENT_TIMESTAMP"));
    let sql = format!("UPDATE tasks SET {} WHERE id = ?{}", updates.join(", "), param_count);

    match conn.execute(
        &sql,
        rusqlite::params![
            body.title.as_deref(),
            body.description.as_deref(),
            body.status.as_deref(),
            body.priority.as_deref(),
            body.assignee_id.as_deref(),
            body.due_date.as_deref(),
            body.tags.as_deref(),
            body.metadata.as_deref(),
            &id,
        ],
    ) {
        Ok(0) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Task not found"})),
        ),
        Ok(_) => match get_task_by_id(&conn, &id) {
            Ok(Some(task)) => (StatusCode::OK, Json(json!({ "task": task }))),
            _ => (StatusCode::OK, Json(json!({ "updated": true }))),
        },
        Err(e) => {
            error!("Update error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to update task"})),
            )
        }
    }
}

async fn delete_task(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            );
        }
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("DB error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    // Verify ownership
    match get_task_by_id(&conn, &id) {
        Ok(Some(ref task)) if task.user_id != user.user_id => {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({"error": "Access denied"})),
            );
        }
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Task not found"})),
            );
        }
        _ => {}
    }

    match conn.execute("DELETE FROM tasks WHERE id = ?1", [&id]) {
        Ok(0) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Task not found"})),
        ),
        Ok(_) => (StatusCode::NO_CONTENT, Json(serde_json::Value::Null)),
        Err(e) => {
            error!("Delete error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to delete task"})),
            )
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn get_task_by_id(conn: &rusqlite::Connection, id: &str) -> rusqlite::Result<Option<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, workspace_id, title, description, status, priority,
                assignee_id, due_date, tags, metadata, created_at, updated_at
         FROM tasks WHERE id = ?1"
    )?;

    let mut rows = stmt.query_map([id], row_to_task)?;
    rows.next().transpose()
}

fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        user_id: row.get(1)?,
        workspace_id: row.get(2)?,
        title: row.get(3)?,
        description: row.get(4)?,
        status: row.get(5)?,
        priority: row.get(6)?,
        assignee_id: row.get(7)?,
        due_date: row.get(8)?,
        tags: row.get(9)?,
        metadata: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}
