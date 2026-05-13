use axum::extract::Extension;
use axum::{
    extract::Query,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, head, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

use crate::AppState;
use crate::auth::AuthUser;

pub fn file_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/files/list", get(list_files))
        .route("/files/read", get(read_file))
        .route("/files/exists", head(file_exists))
        .route("/files/mkdir", post(mkdir))
        .route("/files/delete", delete(delete_file))
        .route("/files/write", post(write_file))
}

#[derive(Deserialize)]
struct PathQuery {
    path: String,
}

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    #[serde(rename = "type")]
    entry_type: String,
    size: Option<u64>,
    modified_at: Option<String>,
}

async fn list_files(
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &user.user_id);
    let _meta = match tokio::fs::metadata(&resolved).await {
        Ok(m) if m.is_dir() => m,
        _ => return (StatusCode::NOT_FOUND, Json(json!({"error": "Cannot list directory"}))),
    };

    let mut entries = vec![];
    let mut read_dir = match tokio::fs::read_dir(&resolved).await {
        Ok(d) => d,
        Err(_) => return (StatusCode::NOT_FOUND, Json(json!({"error": "Cannot list directory"}))),
    };

    while let Ok(Some(entry)) = read_dir.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path().to_string_lossy().to_string();
        let entry_type = if entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false) {
            "directory"
        } else {
            "file"
        };
        let (size, modified_at) = match tokio::fs::metadata(&entry.path()).await {
            Ok(m) => (
                Some(m.len()),
                m.modified().ok().map(|t| {
                    chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
                }),
            ),
            Err(_) => (None, None),
        };
        entries.push(FileEntry { name, path, entry_type: entry_type.to_string(), size, modified_at });
    }

    (StatusCode::OK, Json(json!({"path": resolved.to_string_lossy().to_string(), "entries": entries})))
}

async fn read_file(
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &user.user_id);
    match tokio::fs::read_to_string(&resolved).await {
        Ok(content) => (StatusCode::OK, Json(json!({"content": content}))),
        Err(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Cannot read file"}))),
    }
}

async fn file_exists(
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> Response {
    let resolved = resolve_path(&params.path, &user.user_id);
    if resolved.exists() {
        StatusCode::OK.into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

async fn mkdir(
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &user.user_id);
    match tokio::fs::create_dir_all(&resolved).await {
        Ok(_) => (StatusCode::OK, Json(json!({"ok": true}))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Cannot create directory"}))),
    }
}

async fn delete_file(
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &user.user_id);
    match tokio::fs::metadata(&resolved).await {
        Ok(m) if m.is_dir() => {
            match tokio::fs::remove_dir_all(&resolved).await {
                Ok(_) => (StatusCode::OK, Json(json!({"ok": true}))),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Cannot delete"}))),
            }
        }
        Ok(_) => {
            match tokio::fs::remove_file(&resolved).await {
                Ok(_) => (StatusCode::OK, Json(json!({"ok": true}))),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Cannot delete"}))),
            }
        }
        Err(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))),
    }
}

#[derive(Deserialize)]
struct WriteBody {
    path: Option<String>,
    content: String,
}

async fn write_file(
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<PathQuery>,
    Json(body): Json<WriteBody>,
) -> impl IntoResponse {
    let target = body.path.unwrap_or(params.path);
    let resolved = resolve_path(&target, &user.user_id);

    if let Some(parent) = resolved.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    match tokio::fs::write(&resolved, body.content).await {
        Ok(_) => (StatusCode::OK, Json(json!({"ok": true}))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Cannot write file"}))),
    }
}

fn resolve_path(raw: &str, user_id: &str) -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"))
        .join("allternit")
        .join("users")
        .join(user_id)
        .join("files");
    let _ = std::fs::create_dir_all(&base);

    if raw.starts_with('~') {
        base.join(&raw[1..].trim_start_matches('/'))
    } else if std::path::Path::new(raw).is_absolute() {
        base.join(raw.trim_start_matches('/'))
    } else {
        base.join(raw)
    }
}
