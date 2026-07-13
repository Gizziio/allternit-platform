//! Library API routes — aggregated view of a user's generated artifacts.
//!
//! Flattens the `components` JSON stored in `agent_canvases` (written by the
//! SPA) into a single, user-scoped list of library items with source-session
//! provenance. Read-only: no new storage, no migrations.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn library_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/library", get(list_library))
        .route("/library/stats", get(library_stats))
}

// ─── Query params ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ListQuery {
    kind: Option<String>,
    search: Option<String>,
    limit: Option<i64>,
    cursor: Option<String>,
}

const DEFAULT_LIMIT: i64 = 60;
const MAX_LIMIT: i64 = 200;

// ─── Models ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
struct LibraryItem {
    id: String,
    /// Stable artifact identity shared across canvases the same artifact was
    /// persisted to. Used to dedupe so one artifact appears once. `None` for
    /// uploaded files (and legacy components without an `artifactId`).
    #[serde(skip_serializing_if = "Option::is_none")]
    artifact_id: Option<String>,
    /// Coarse bucket: image | document | code | artifact
    kind: String,
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    session_id: String,
    canvas_id: String,
    origin: &'static str,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct ListResponse {
    items: Vec<LibraryItem>,
    next_cursor: Option<String>,
    total: i64,
}

// ─── Handler: list ────────────────────────────────────────────────────────────

async fn list_library(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let limit = q
        .limit
        .unwrap_or(DEFAULT_LIMIT)
        .clamp(1, MAX_LIMIT);
    let offset = q
        .cursor
        .as_deref()
        .and_then(|c| c.parse::<i64>().ok())
        .unwrap_or(0)
        .max(0);
    let kind_filter = q.kind.map(|k| k.to_lowercase());
    let search_filter = q.search.map(|s| s.to_lowercase()).filter(|s| !s.is_empty());

    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let fs_user_id = user.user_id.clone();

    let result = tokio::task::spawn_blocking(move || -> Result<Vec<LibraryItem>, rusqlite::Error> {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, session_id, title, components, created_at
             FROM agent_canvases
             WHERE user_id = ?1
             ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map(params![user_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?;

        let mut items: Vec<LibraryItem> = Vec::new();
        for row in rows.flatten() {
            let (canvas_id, session_id, canvas_title, components_raw, created_at) = row;
            let components: Vec<serde_json::Value> =
                serde_json::from_str(&components_raw).unwrap_or_default();

            for (index, component) in components.iter().enumerate() {
                let raw_kind = component
                    .get("kind")
                    .and_then(|v| v.as_str())
                    .or_else(|| component.get("type").and_then(|v| v.as_str()))
                    .unwrap_or("artifact");
                let url = component
                    .get("url")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty());
                let content = component
                    .get("content")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty());
                let artifact_id = component
                    .get("artifactId")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty());
                let title = component
                    .get("title")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| canvas_title.clone())
                    .or_else(|| {
                        content.as_deref().and_then(|c| {
                            let first = c.trim().lines().next().unwrap_or("").trim();
                            if first.is_empty() {
                                return None;
                            }
                            const MAX: usize = 60;
                            if first.chars().count() > MAX {
                                let t: String = first.chars().take(MAX).collect();
                                Some(format!("{t}…"))
                            } else {
                                Some(first.to_string())
                            }
                        })
                    })
                    .unwrap_or_else(|| "Untitled".to_string());

                let bucket = classify(raw_kind, url.as_deref(), content.as_deref()).to_string();

                items.push(LibraryItem {
                    id: format!("{canvas_id}:{index}"),
                    artifact_id,
                    kind: bucket,
                    title,
                    url,
                    content,
                    session_id: session_id.clone(),
                    canvas_id: canvas_id.clone(),
                    origin: "generated",
                    created_at: created_at.clone(),
                });
            }
        }

        Ok(items)
    })
    .await;

    let mut items = match result {
        Ok(Ok(items)) => items,
        Ok(Err(e)) => {
            warn!(error = %e, "DB error listing library");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(error = %e, "DB task panicked listing library");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response();
        }
    };

    // Merge uploaded files (origin:"uploaded") as a second source, then sort
    // the combined list newest-first so pagination is stable across sources.
    let mut uploaded = collect_uploaded_items(&fs_user_id).await;
    items.append(&mut uploaded);
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Dedupe by artifact id (newest-first, so the kept occurrence is the newest
    // canvas the artifact was persisted to). Uploaded files key on their own id
    // and are never collapsed. Done before filters so `total` matches the page.
    dedupe_library_items(&mut items);

    // In-memory filters (post-flatten) — cheap for per-user canvas volumes.
    if let Some(ref kind) = kind_filter {
        items.retain(|it| matches_kind(it, kind));
    }
    if let Some(ref search) = search_filter {
        items.retain(|it| it.title.to_lowercase().contains(search));
    }

    let total = items.len() as i64;
    let start = offset as usize;
    let end = (start + limit as usize).min(items.len());
    let page: Vec<LibraryItem> = if start < items.len() {
        items[start..end].to_vec()
    } else {
        Vec::new()
    };
    let next_cursor = if end < items.len() {
        Some(end.to_string())
    } else {
        None
    };

    Json(ListResponse {
        items: page,
        next_cursor,
        total,
    })
    .into_response()
}

// ─── Handler: stats (per-kind counts) ─────────────────────────────────────────

async fn library_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let fs_user_id = user.user_id.clone();

    // Build the same canvas-derived items as `list_library` (real ids, artifact
    // ids and created_at) so the per-kind counts come from the exact same
    // deduped set the list renders.
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<LibraryItem>, rusqlite::Error> {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, session_id, title, components, created_at
             FROM agent_canvases
             WHERE user_id = ?1
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?;

        let mut items: Vec<LibraryItem> = Vec::new();
        for row in rows.flatten() {
            let (canvas_id, canvas_title, components_raw, created_at) = row;
            let components: Vec<serde_json::Value> =
                serde_json::from_str(&components_raw).unwrap_or_default();
            for (index, component) in components.iter().enumerate() {
                let raw_kind = component
                    .get("kind")
                    .and_then(|v| v.as_str())
                    .or_else(|| component.get("type").and_then(|v| v.as_str()))
                    .unwrap_or("artifact");
                let title = component
                    .get("title")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| canvas_title.clone())
                    .unwrap_or_else(|| "Untitled".to_string());
                let url = component
                    .get("url")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty());
                let content = component
                    .get("content")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty());
                let artifact_id = component
                    .get("artifactId")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty());

                items.push(LibraryItem {
                    id: format!("{canvas_id}:{index}"),
                    artifact_id,
                    kind: classify(raw_kind, url, content).to_string(),
                    title,
                    url: url.map(|s| s.to_string()),
                    content: content.map(|s| s.to_string()),
                    session_id: String::new(),
                    canvas_id: canvas_id.clone(),
                    origin: "generated",
                    created_at: created_at.clone(),
                });
            }
        }

        Ok(items)
    })
    .await;

    let mut items = match result {
        Ok(Ok(items)) => items,
        Ok(Err(e)) => {
            warn!(error = %e, "DB error computing library stats");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(error = %e, "DB task panicked computing library stats");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response();
        }
    };

    // Mirror `list_library`: merge uploaded files, sort newest-first, then
    // dedupe so the counts reflect exactly what the list renders.
    let mut uploaded = collect_uploaded_items(&fs_user_id).await;
    items.append(&mut uploaded);
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    dedupe_library_items(&mut items);

    let mut counts = serde_json::Map::new();
    for key in ["image", "document", "code", "artifact", "file"] {
        counts.insert(key.to_string(), json!(0));
    }
    let mut total = 0i64;
    for item in items.iter() {
        if let Some(c) = counts.get_mut(item.kind.as_str()) {
            *c = json!(c.as_i64().unwrap_or(0) + 1);
        }
        // Uploaded items always carry a downloadable URL, so each also
        // contributes to the virtual `file` bucket.
        if matches_kind(item, "file") {
            if let Some(c) = counts.get_mut("file") {
                *c = json!(c.as_i64().unwrap_or(0) + 1);
            }
        }
        total += 1;
    }
    counts.insert("total".to_string(), json!(total));

    Json(json!({ "stats": serde_json::Value::Object(counts) })).into_response()
}

// ─── Classification ───────────────────────────────────────────────────────────

/// Map a raw component `kind` (plus optional url/content hints) into a coarse
/// bucket used for filtering and renderer selection.
fn classify(raw_kind: &str, url: Option<&str>, content: Option<&str>) -> &'static str {
    let k = raw_kind.to_lowercase();
    let u = url.unwrap_or("").to_lowercase();
    let c = content.unwrap_or("").to_lowercase();

    if k.contains("image")
        || matches!(k.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp")
        || u.starts_with("data:image/")
        || c.starts_with("data:image/")
        || ext_kind(&u) == Some("image")
    {
        return "image";
    }

    if k.contains("document")
        || k.contains("pdf")
        || matches!(k.as_str(), "text" | "markdown" | "md" | "doc" | "docx" | "txt")
        || u.starts_with("data:application/pdf")
        || u.starts_with("data:text/")
        || c.starts_with("data:text/")
        || ext_kind(&u) == Some("document")
    {
        return "document";
    }

    if k.contains("code")
        || matches!(k.as_str(), "html" | "jsx" | "javascript" | "typescript" | "mermaid")
        || u.starts_with("data:text/html")
        || ext_kind(&u) == Some("code")
    {
        return "code";
    }

    "artifact"
}

/// Classify a file name/path purely by its extension. Returns `None` for
/// unrecognised extensions so callers can pick their own default bucket.
fn ext_kind(name: &str) -> Option<&'static str> {
    let ext = std::path::Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" => Some("image"),
        "pdf" | "txt" | "md" | "doc" | "docx" => Some("document"),
        "html" | "js" | "ts" | "jsx" | "tsx" | "css" | "json" => Some("code"),
        _ => None,
    }
}

/// Whether an item matches a filter `kind`. `file` is a virtual bucket that
/// matches any item carrying a downloadable URL regardless of its real bucket.
fn matches_kind(item: &LibraryItem, kind: &str) -> bool {
    match kind {
        "file" => item.url.as_deref().map(|u| !u.is_empty()).unwrap_or(false),
        other => item.kind == other,
    }
}

/// Drop duplicate artifacts in place, keeping the FIRST occurrence per key.
///
/// The key is the artifact id when present, otherwise the item id (so uploaded
/// files and legacy components without an `artifactId` are never collapsed).
/// Callers must sort newest-first beforehand so the kept occurrence is the
/// newest canvas the artifact was persisted to.
fn dedupe_library_items(items: &mut Vec<LibraryItem>) {
    let mut seen: HashSet<String> = HashSet::new();
    items.retain(|it| {
        let key = it.artifact_id.clone().unwrap_or_else(|| it.id.clone());
        seen.insert(key)
    });
}

// ─── Uploaded files source ────────────────────────────────────────────────────

/// Base directory for a user's uploaded files. Mirrors
/// `file_routes::resolve_path` (same `dirs::data_dir()/allternit/users/{id}/files`).
fn files_base(user_id: &str) -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"))
        .join("allternit")
        .join("users")
        .join(user_id)
        .join("files")
}

/// Walk the user's uploaded-files directory recursively and emit a `LibraryItem`
/// per file. Directories are skipped. Best-effort: unreadable entries are
/// ignored rather than failing the whole request.
async fn collect_uploaded_items(user_id: &str) -> Vec<LibraryItem> {
    let base = files_base(user_id);
    let mut items: Vec<LibraryItem> = Vec::new();
    let mut stack: Vec<PathBuf> = vec![base.clone()];

    while let Some(dir) = stack.pop() {
        let mut read_dir = match tokio::fs::read_dir(&dir).await {
            Ok(r) => r,
            Err(_) => continue,
        };
        while let Ok(Some(entry)) = read_dir.next_entry().await {
            let path = entry.path();
            let meta = match tokio::fs::metadata(&path).await {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.is_dir() {
                stack.push(path);
                continue;
            }
            if !meta.is_file() {
                continue;
            }
            let rel = match path.strip_prefix(&base) {
                Ok(r) => r,
                Err(_) => continue,
            };
            let rel_path = rel.to_string_lossy().replace('\\', "/");
            let title = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| rel_path.clone());
            let kind = ext_kind(&rel_path).unwrap_or("file").to_string();
            let url = Some(format!(
                "/api/v1/files/raw?path={}",
                urlencoding::encode(&rel_path)
            ));
            let created_at = meta
                .modified()
                .or_else(|_| meta.created())
                .ok()
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
                .unwrap_or_default();

            items.push(LibraryItem {
                id: format!("file:{rel_path}"),
                artifact_id: None,
                kind,
                title,
                url,
                content: None,
                session_id: String::new(),
                canvas_id: String::new(),
                origin: "uploaded",
                created_at,
            });
        }
    }

    items
}
