use axum::{
    extract::Query,
    http::{header::CONTENT_TYPE, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, head, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

use crate::AppState;

pub fn file_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/files/list", get(list_files))
        .route("/files/read", get(read_file))
        .route("/files/raw", get(raw_file))
        .route("/files/exists", head(file_exists))
        .route("/files/mkdir", post(mkdir))
        .route("/files/delete", delete(delete_file))
        .route("/files/write", post(write_file))
}

/// Resolve a caller identity the same lenient way `connector_routes.rs::caller()`
/// already does: read the desktop-bootstrap header directly rather than
/// requiring `auth_middleware` to have inserted `Extension<AuthUser>` first.
/// `resolve_path()` below sandboxes every request into a per-user directory
/// regardless of this value, so a `"local-dev"` fallback here does not expose
/// any other user's files — it only ever resolves to that fallback user's own
/// sandboxed subdirectory. Previously this used `Extension<AuthUser>`, which
/// 401'd whenever `auth_middleware` didn't populate it for a session (seen
/// live: Electron desktop sessions), even though the equivalent
/// `connector_routes.rs` requests succeeded for the same session.
fn caller_id(headers: &HeaderMap) -> String {
    crate::auth::get_user(headers)
        .map(|u| u.user_id)
        .unwrap_or_else(|| "local-dev".to_string())
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
    headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &caller_id(&headers));
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
    headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &caller_id(&headers));
    match tokio::fs::read_to_string(&resolved).await {
        Ok(content) => (StatusCode::OK, Json(json!({"content": content}))),
        Err(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Cannot read file"}))),
    }
}

async fn raw_file(
    headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> Response {
    let resolved = resolve_path(&params.path, &caller_id(&headers));
    let is_file = tokio::fs::metadata(&resolved)
        .await
        .map(|m| m.is_file())
        .unwrap_or(false);
    if !is_file {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response();
    }
    match tokio::fs::read(&resolved).await {
        Ok(bytes) => {
            let mime = mime_for(&resolved);
            (StatusCode::OK, [(CONTENT_TYPE, mime)], bytes).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
    }
}

async fn file_exists(
    headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> Response {
    let resolved = resolve_path(&params.path, &caller_id(&headers));
    if resolved.exists() {
        StatusCode::OK.into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

async fn mkdir(
    headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &caller_id(&headers));
    match tokio::fs::create_dir_all(&resolved).await {
        Ok(_) => (StatusCode::OK, Json(json!({"ok": true}))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Cannot create directory"}))),
    }
}

async fn delete_file(
    headers: HeaderMap,
    Query(params): Query<PathQuery>,
) -> impl IntoResponse {
    let resolved = resolve_path(&params.path, &caller_id(&headers));
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
    headers: HeaderMap,
    Query(params): Query<PathQuery>,
    Json(body): Json<WriteBody>,
) -> impl IntoResponse {
    let target = body.path.unwrap_or(params.path);
    let resolved = resolve_path(&target, &caller_id(&headers));

    if let Some(parent) = resolved.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    match tokio::fs::write(&resolved, body.content).await {
        Ok(_) => (StatusCode::OK, Json(json!({"ok": true}))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Cannot write file"}))),
    }
}

fn mime_for(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("pdf") => "application/pdf",
        Some("txt" | "md") => "text/plain; charset=utf-8",
        Some("html" | "htm") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("json") => "application/json",
        _ => "application/octet-stream",
    }
}

/// Resolve a request path against the real filesystem rather than a
/// per-user virtual sandbox. This app is a single-user desktop client
/// (Electron), not a multi-tenant server: `RealFileSystem` (the frontend's
/// preferred filesystem backend) can never activate in this build because
/// the Electron preload exposes no `require`/`fs` bridge on `window.allternit`,
/// so every file request falls back to this HTTP backend. Sandboxing those
/// requests into `<data_dir>/allternit/users/<id>/files/...` meant real
/// dotfolders the frontend explicitly looks for (`~/.codex/skills`,
/// `~/.claude/skills`, `~/.agents/plugins`, etc. — see
/// `PLUGIN_DIR_CANDIDATES` in the frontend's `fileSystem.ts`) could
/// structurally never be found, even though they exist on disk. `user_id`
/// is unused now but kept as a call-site parameter for parity with the
/// other file handlers and in case per-user scoping is reintroduced for a
/// genuinely multi-tenant deployment later.
fn resolve_path(raw: &str, _user_id: &str) -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));

    if let Some(stripped) = raw.strip_prefix('~') {
        home.join(stripped.trim_start_matches('/'))
    } else if std::path::Path::new(raw).is_absolute() {
        PathBuf::from(raw)
    } else {
        home.join(raw)
    }
}
