//! Ultrabrowse deep-research task API (`/beta/research`).

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::{auth::get_user, AppState};

type ApiError = (StatusCode, Json<serde_json::Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (status, Json(json!({"error": code, "message": message.into()})))
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "research task operation failed");
    error(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", err.to_string())
}

pub fn research_task_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/beta/research", post(create_research_task).get(list_research_tasks))
        .route("/beta/research/:id", get(get_research_task).post(update_research_task).delete(delete_research_task))
}

async fn create_research_task(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<crate::research_task_service::CreateResearchTaskRequest>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return error(StatusCode::UNAUTHORIZED, "unauthorized", "Unauthorized"),
    };

    match crate::research_task_service::create_research_task(&state.db, &user.user_id, &payload) {
        Ok(task) => (StatusCode::CREATED, Json(json!({"task": task}))),
        Err(crate::research_task_service::ResearchTaskError::InvalidRequest(msg)) => {
            error(StatusCode::BAD_REQUEST, "invalid_request", msg)
        }
        Err(e) => {
            tracing::warn!("Research task create error: {}", e);
            error(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", e.to_string())
        }
    }
}

#[derive(Deserialize)]
struct ListResearchTasksQuery {
    limit: Option<usize>,
}

async fn list_research_tasks(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<ListResearchTasksQuery>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return error(StatusCode::UNAUTHORIZED, "unauthorized", "Unauthorized"),
    };

    let limit = params.limit.unwrap_or(50);
    match crate::research_task_service::list_research_tasks(&state.db, &user.user_id, limit) {
        Ok(tasks) => (StatusCode::OK, Json(json!({"tasks": tasks, "count": tasks.len()}))),
        Err(e) => {
            tracing::warn!("Research task list error: {}", e);
            error(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", e.to_string())
        }
    }
}

async fn get_research_task(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return error(StatusCode::UNAUTHORIZED, "unauthorized", "Unauthorized"),
    };

    match crate::research_task_service::get_research_task_by_id(&state.db, &user.user_id, &id) {
        Ok(Some(task)) => (StatusCode::OK, Json(json!({"task": task}))),
        Ok(None) => error(StatusCode::NOT_FOUND, "not_found", "No such research task."),
        Err(e) => {
            tracing::warn!("Research task get error: {}", e);
            error(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", e.to_string())
        }
    }
}

async fn update_research_task(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<crate::research_task_service::UpdateResearchTaskRequest>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return error(StatusCode::UNAUTHORIZED, "unauthorized", "Unauthorized"),
    };

    match crate::research_task_service::update_research_task(&state.db, &user.user_id, &id, &payload) {
        Ok(task) => (StatusCode::OK, Json(json!({"task": task}))),
        Err(crate::research_task_service::ResearchTaskError::NotFound) => {
            error(StatusCode::NOT_FOUND, "not_found", "No such research task.")
        }
        Err(e) => {
            tracing::warn!("Research task update error: {}", e);
            error(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", e.to_string())
        }
    }
}

async fn delete_research_task(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return error(StatusCode::UNAUTHORIZED, "unauthorized", "Unauthorized"),
    };

    match crate::research_task_service::delete_research_task(&state.db, &user.user_id, &id) {
        Ok(true) => (StatusCode::OK, Json(json!({"deleted": true}))),
        Ok(false) => error(StatusCode::NOT_FOUND, "not_found", "No such research task."),
        Err(e) => {
            tracing::warn!("Research task delete error: {}", e);
            error(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", e.to_string())
        }
    }
}
