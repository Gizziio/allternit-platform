//! Long-running autonomous tasks.
//!
//! Tasks are started through the ACI/computer-use gateway but persist in SQLite
//! so they survive sidepanel closures, browser restarts, and process restarts.
//! The extension background script polls `/api/v1/long-tasks/:id` for status
//! and receives `chrome.runtime` messages when state changes.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn long_running_task_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/long-tasks", get(list_tasks).post(create_task))
        .route("/long-tasks/:id", get(get_task).delete(delete_task))
        .route("/long-tasks/:id/cancel", post(cancel_task))
}

type ApiError = (StatusCode, Json<serde_json::Value>);

fn err(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (status, Json(json!({"error": code, "message": message.into()})))
}

fn internal(e: impl std::fmt::Display) -> ApiError {
    err(
        StatusCode::INTERNAL_SERVER_ERROR,
        "long_running_task_error",
        e.to_string(),
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize)]
struct LongRunningTask {
    id: String,
    user_id: String,
    organization_id: Option<String>,
    title: String,
    goal: String,
    status: TaskStatus,
    progress: i64,
    result: Option<String>,
    error: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct CreateTaskRequest {
    title: String,
    goal: String,
}

#[derive(Debug, Deserialize)]
struct UpdateTaskRequest {
    status: Option<TaskStatus>,
    progress: Option<i64>,
    result: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListTasksQuery {
    status: Option<String>,
}

fn row_to_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<LongRunningTask> {
    let status_str: String = row.get(5)?;
    let status = status_str.parse().unwrap_or(TaskStatus::Pending);
    Ok(LongRunningTask {
        id: row.get(0)?,
        user_id: row.get(1)?,
        organization_id: row.get(2)?,
        title: row.get(3)?,
        goal: row.get(4)?,
        status,
        progress: row.get(6)?,
        result: row.get(7)?,
        error: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

impl std::str::FromStr for TaskStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(TaskStatus::Pending),
            "running" => Ok(TaskStatus::Running),
            "paused" => Ok(TaskStatus::Paused),
            "completed" => Ok(TaskStatus::Completed),
            "failed" => Ok(TaskStatus::Failed),
            "cancelled" => Ok(TaskStatus::Cancelled),
            _ => Err(format!("unknown task status: {}", s)),
        }
    }
}

async fn list_tasks(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListTasksQuery>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let mut sql = "SELECT id, user_id, organization_id, title, goal, status, progress, result, error, created_at, updated_at FROM long_running_tasks WHERE user_id = ?1".to_string();
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user.user_id.clone())];

        if let Some(ref status) = query.status {
            sql.push_str(" AND status = ?");
            args.push(Box::new(status.clone()));
        }
        sql.push_str(" ORDER BY updated_at DESC");

        let arg_refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
        let mut stmt = conn.prepare(&sql).map_err(internal)?;
        let tasks = stmt
            .query_map(arg_refs.as_slice(), row_to_task)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({"tasks": tasks})))
    })
    .await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let task = conn
            .query_row(
                "SELECT id, user_id, organization_id, title, goal, status, progress, result, error, created_at, updated_at FROM long_running_tasks WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
                row_to_task,
            )
            .optional()
            .map_err(internal)?;
        match task {
            Some(t) => Ok::<_, ApiError>(Json(json!(t))),
            None => Err(err(StatusCode::NOT_FOUND, "task_not_found", "No such task.")),
        }
    })
    .await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn create_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateTaskRequest>,
) -> Response {
    if body.title.trim().is_empty() || body.goal.trim().is_empty() {
        return err(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "title and goal are required.",
        )
        .into_response();
    }

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let id = format!("lrt_{}", uuid::Uuid::new_v4().simple());
        conn.execute(
            "INSERT INTO long_running_tasks (id, user_id, organization_id, title, goal, status, progress) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', 0)",
            params![
                id,
                user.user_id,
                user.organization_id,
                body.title.trim(),
                body.goal.trim(),
            ],
        ).map_err(internal)?;
        Ok::<_, ApiError>((StatusCode::CREATED, Json(json!({"id": id, "status": "pending"}))))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn cancel_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let affected = conn
            .execute(
                "UPDATE long_running_tasks SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
            )
            .map_err(internal)?;
        if affected == 0 {
            return Err(err(StatusCode::NOT_FOUND, "task_not_found", "No such task."));
        }
        Ok::<_, ApiError>(Json(json!({"id": id, "status": "cancelled"})))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let affected = conn
            .execute(
                "DELETE FROM long_running_tasks WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
            )
            .map_err(internal)?;
        if affected == 0 {
            return Err(err(StatusCode::NOT_FOUND, "task_not_found", "No such task."));
        }
        Ok::<_, ApiError>(StatusCode::NO_CONTENT.into_response())
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

/// Internal helper used by other routes to update task progress/result.
pub fn update_task_state(
    db: &crate::db::DbHandle,
    task_id: &str,
    status: TaskStatus,
    progress: Option<i64>,
    result: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    let conn = db.connect().map_err(|e| e.to_string())?;
    let status_str = serde_json::to_string(&status)
        .map_err(|e| e.to_string())?
        .trim_matches('"')
        .to_string();
    conn.execute(
        "UPDATE long_running_tasks SET status = ?1, progress = COALESCE(?2, progress), result = COALESCE(?3, result), error = COALESCE(?4, error), updated_at = CURRENT_TIMESTAMP WHERE id = ?5",
        params![status_str, progress, result, error, task_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
