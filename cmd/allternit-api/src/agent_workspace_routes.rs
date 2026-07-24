//! Agent Workspace file read/write API routes.
//!
//! Complements the write-only `POST /agents/:id/workspace/initialize` in
//! `agent_routes.rs` with per-file list/read/write endpoints. All paths are
//! relative to the agent's workspace directory and are guarded against
//! traversal (absolute paths, `..`, backslashes, NUL bytes are rejected).

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Component;
use std::sync::Arc;
use tracing::warn;

use crate::agent_workspace_paths::workspace_dir_for;
use crate::auth::AuthUser;
use crate::AppState;

pub fn agent_workspace_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agents/:id/workspace/files", get(list_workspace_files))
        .route(
            "/agents/:id/workspace/file",
            get(read_workspace_file).put(write_workspace_file),
        )
}

/// Reject anything that could escape the workspace dir: absolute paths,
/// `..` components, backslashes, and NUL bytes.
fn is_safe_relative_path(path: &str) -> bool {
    if path.is_empty() || path.contains(['\\', '\0']) {
        return false;
    }
    let rel = std::path::Path::new(path);
    !rel.is_absolute()
        && rel
            .components()
            .all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

fn invalid_path() -> axum::response::Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({"error": "invalid_path"})),
    )
        .into_response()
}

/// Verify the agent exists and belongs to the user. Returns None when
/// authorized, otherwise the error response to return.
async fn authorize_agent(
    db: &crate::db::DbHandle,
    user_id: String,
    agent_id: String,
) -> Option<axum::response::Response> {
    let db = db.clone();
    let authorized = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM agents WHERE id = ?1 AND user_id = ?2",
            params![agent_id, user_id],
            |row| row.get(0),
        )?;
        Ok::<_, rusqlite::Error>(count > 0)
    })
    .await;

    match authorized {
        Ok(Ok(true)) => None,
        Ok(Ok(false)) | Ok(Err(_)) => Some(
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Agent not found"})),
            )
                .into_response(),
        ),
        Err(_) => Some(
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response(),
        ),
    }
}

// ─── GET /agents/:id/workspace/files ──────────────────────────────────────────

#[derive(Serialize)]
struct WorkspaceFileEntry {
    path: String,
    size_bytes: u64,
    modified_at: Option<String>,
}

async fn list_workspace_files(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(resp) = authorize_agent(&state.db, user.user_id, id.clone()).await {
        return resp;
    }

    let workspace_dir = workspace_dir_for(&id);
    let result = tokio::task::spawn_blocking(move || {
        let mut files = Vec::new();
        if workspace_dir.is_dir() {
            collect_files(&workspace_dir, &workspace_dir, &mut files)?;
        }
        files.sort_by(|a: &WorkspaceFileEntry, b| a.path.cmp(&b.path));
        Ok::<_, std::io::Error>(files)
    })
    .await;

    match result {
        Ok(Ok(files)) => Json(json!({ "files": files })).into_response(),
        Ok(Err(e)) => {
            warn!("Workspace file listing failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("Workspace task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

fn collect_files(
    base: &std::path::Path,
    dir: &std::path::Path,
    out: &mut Vec<WorkspaceFileEntry>,
) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(base, &path, out)?;
        } else if path.is_file() {
            let meta = entry.metadata()?;
            let rel = path
                .strip_prefix(base)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let modified_at = meta
                .modified()
                .ok()
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
            out.push(WorkspaceFileEntry {
                path: rel,
                size_bytes: meta.len(),
                modified_at,
            });
        }
    }
    Ok(())
}

// ─── GET /agents/:id/workspace/file?path=… ────────────────────────────────────

#[derive(Deserialize)]
struct WorkspaceFileQuery {
    path: String,
}

async fn read_workspace_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Query(query): Query<WorkspaceFileQuery>,
) -> impl IntoResponse {
    if !is_safe_relative_path(&query.path) {
        return invalid_path();
    }
    if let Some(resp) = authorize_agent(&state.db, user.user_id, id.clone()).await {
        return resp;
    }

    let file_path = workspace_dir_for(&id).join(&query.path);
    let rel_path = query.path.clone();
    let result = tokio::task::spawn_blocking(move || std::fs::read_to_string(&file_path)).await;

    match result {
        Ok(Ok(content)) => Json(json!({
            "path": rel_path,
            "content": content,
        }))
        .into_response(),
        Ok(Err(e)) if e.kind() == std::io::ErrorKind::NotFound => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "File not found"})),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("Workspace file read failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("Workspace task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── PUT /agents/:id/workspace/file ───────────────────────────────────────────

#[derive(Deserialize)]
struct WriteWorkspaceFileBody {
    path: String,
    content: String,
}

async fn write_workspace_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<WriteWorkspaceFileBody>,
) -> impl IntoResponse {
    if !is_safe_relative_path(&body.path) {
        return invalid_path();
    }
    if let Some(resp) = authorize_agent(&state.db, user.user_id, id.clone()).await {
        return resp;
    }

    let file_path = workspace_dir_for(&id).join(&body.path);
    let rel_path = body.path.clone();
    let result = tokio::task::spawn_blocking(move || {
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&file_path, body.content.as_bytes())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({
            "success": true,
            "path": rel_path,
        }))
        .into_response(),
        Ok(Err(e)) => {
            warn!("Workspace file write failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("Workspace task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}
