//! bb-compatible Axum routes mounted under `/api/v1/bb`.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use super::contracts::*;
use super::db::BbDb;
use super::models::*;
use crate::auth::AuthUser;
use crate::AppState;
use axum::Extension;

pub fn bb_router() -> Router<Arc<AppState>> {
    Router::new()
        // Projects
        .route("/bb/projects", get(list_projects).post(create_project))
        .route(
            "/bb/projects/:id",
            get(get_project).patch(update_project).delete(delete_project),
        )
        .route("/bb/projects/:id/sources", post(add_project_source))
        // Hosts
        .route("/bb/hosts", get(list_hosts).post(create_host))
        .route(
            "/bb/hosts/:id",
            get(get_host).patch(update_host),
        )
        // Environments
        .route("/bb/environments/:id", get(get_environment))
        // Threads
        .route("/bb/threads", get(list_threads).post(create_thread))
        .route(
            "/bb/threads/:id",
            get(get_thread).patch(update_thread).delete(delete_thread),
        )
        .route("/bb/threads/:id/send", post(send_message))
        .route("/bb/threads/:id/events", get(list_events))
}

fn bb_db(state: &AppState) -> BbDb {
    BbDb::new(Arc::new(state.db.clone()))
}

// Projects

async fn list_projects(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).list_projects(&user_id) {
        Ok(items) => (StatusCode::OK, Json(json!({ "items": items }))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn create_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateProjectRequest>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    let kind = req.kind.as_deref().unwrap_or("standard");
    match bb_db(&state).create_project(&user_id, &req.name, kind, req.git_remote_url.as_deref()) {
        Ok(project) => (StatusCode::CREATED, Json(project)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn get_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).get_project(&user_id, &id) {
        Ok(Some(project)) => (StatusCode::OK, Json(project)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn update_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(req): Json<UpdateProjectRequest>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).update_project(&user_id, &id, req.name.as_deref(), req.sort_key.as_deref()) {
        Ok(Some(project)) => (StatusCode::OK, Json(project)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn delete_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).delete_project(&user_id, &id) {
        Ok(true) => (StatusCode::NO_CONTENT, ()).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn add_project_source(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(req): Json<CreateProjectSourceRequest>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).add_project_source(&user_id, &id, &req) {
        Ok(source) => (StatusCode::CREATED, Json(source)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

// Hosts

async fn list_hosts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).list_hosts(&user_id) {
        Ok(items) => (StatusCode::OK, Json(json!({ "items": items }))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn create_host(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateHostRequest>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    let host_type = req.host_type.as_deref().unwrap_or("persistent");
    let max_permission_mode = req.max_permission_mode.as_deref().unwrap_or("full");
    match bb_db(&state).create_host(&user_id, &req.name, host_type, max_permission_mode) {
        Ok(host) => (StatusCode::CREATED, Json(host)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn get_host(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).get_host(&user_id, &id) {
        Ok(Some(host)) => (StatusCode::OK, Json(host)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn update_host(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(req): Json<UpdateHostRequest>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    match bb_db(&state).update_host(&user_id, &id, req.name.as_deref(), req.max_permission_mode.as_deref()) {
        Ok(Some(host)) => (StatusCode::OK, Json(host)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

// Environments

async fn get_environment(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match bb_db(&state).get_environment(&id) {
        Ok(Some(env)) => (StatusCode::OK, Json(env)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

// Threads

async fn list_threads(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    // For simplicity, list across all user projects. In production this should scope by project_id query param.
    match bb_db(&state).list_projects(&user_id) {
        Ok(projects) => {
            let mut all_threads: Vec<BbThread> = Vec::new();
            for project in projects {
                match bb_db(&state).list_threads(&project.id) {
                    Ok(mut threads) => all_threads.append(&mut threads),
                    Err(e) => {
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": e.to_string() })),
                        )
                            .into_response()
                    }
                }
            }
            (StatusCode::OK, Json(json!({ "items": all_threads }))).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn create_thread(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateThreadRequest>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    let provider_id = req.provider_id.as_deref().unwrap_or("codex");
    let title = req.title.as_deref();
    match bb_db(&state).create_thread(&req.project_id, req.environment_id.as_deref(), provider_id, title) {
        Ok(thread) => {
            // Append a user message event from input
            if !req.input.is_empty() {
                let data = json!({
                    "role": "user",
                    "content": req.input.iter().map(|i| i.content.clone()).collect::<Vec<_>>().join("\n\n")
                });
                let _ = bb_db(&state).append_event(&thread.id, req.environment_id.as_deref(), "turn", "message", data);
            }
            (StatusCode::CREATED, Json(thread)).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn get_thread(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match bb_db(&state).get_thread(&id) {
        Ok(Some(thread)) => (StatusCode::OK, Json(thread)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn update_thread(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(req): Json<UpdateThreadRequest>,
) -> impl IntoResponse {
    match bb_db(&state).update_thread(&id, &req) {
        Ok(Some(thread)) => (StatusCode::OK, Json(thread)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn delete_thread(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    match bb_db(&state).update_thread(&id, &UpdateThreadRequest {
        title: None,
        status: None,
        archived_at: None,
        pinned_at: None,
        deleted_at: Some(now),
    }) {
        Ok(Some(_)) => (StatusCode::NO_CONTENT, ()).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn send_message(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let content = req.input.iter().map(|i| i.content.clone()).collect::<Vec<String>>().join("\n\n");
    let data = json!({"role": "user", "content": content});
    match bb_db(&state).append_event(&id, None, "turn", "message", data) {
        Ok(_) => (StatusCode::OK, Json(SendMessageResponse { ok: true, delivery: "sent".to_string() })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn list_events(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match bb_db(&state).list_events(&id, None) {
        Ok(items) => (StatusCode::OK, Json(json!({ "items": items }))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
