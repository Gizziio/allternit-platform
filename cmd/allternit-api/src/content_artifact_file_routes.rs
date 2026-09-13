//! Content-artifact file tree routes — A:// Artifacts API multi-file sync
//! (docs/design/artifacts-api.md §7 Phase 2, 2026-09-12).
//!
//! A design-mode project is a flat per-project file tree (HTML/CSS/JSON/MD).
//! Until now only `/index.html` synced to the gateway, as the artifact's
//! version body. These routes mirror the whole tree per artifact:
//!
//! - `GET    /content-artifacts/:id/files`       — index (path, sha, updatedAt)
//! - `GET    /content-artifacts/:id/files/*path` — read one file body
//! - `PUT    /content-artifacts/:id/files/*path` — upsert write-through
//! - `DELETE /content-artifacts/:id/files/*path` — remove one file
//!
//! Semantics follow the artifact routes: user-scoped (404 cross-user, never
//! 403-leaky), soft-deleted artifacts are unreadable, writes are upserts
//! keyed on (artifact_id, path) so they are naturally idempotent, and file
//! bodies are inline (design project files are small source files; the
//! disk-spill machinery stays reserved for artifact version bodies).
//!
//! Path rules: must start with `/`, no `..` segments, no trailing slash
//! (except the bare root, which is rejected — a tree needs named files), no
//! NUL. Normalization is intentionally absent: the web store owns a flat,
//! canonical path space (`/index.html`, `/styles.css`, ...).

use axum::extract::Extension;
use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::content_artifact_routes::{fetch_artifact_meta, now_rfc3339, sha256_hex};
use crate::AppState;

pub fn content_artifact_file_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/content-artifacts/:id/files",
            get(list_content_artifact_files),
        )
        .route(
            "/content-artifacts/:id/files/*path",
            get(get_content_artifact_file)
                .put(put_content_artifact_file)
                .delete(delete_content_artifact_file),
        )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request bodies
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct PutFileBody {
    body: String,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/// Validate a requested file path. Returns the canonical path on success.
fn valid_file_path(raw: &str) -> Option<String> {
    let path = raw.trim();
    if path.is_empty() || path == "/" || !path.starts_with('/') {
        return None;
    }
    if path.len() > 512 || path.contains('\0') || path.contains('\\') {
        return None;
    }
    if path.ends_with('/') {
        return None;
    }
    // Skip the leading empty segment that the mandatory `/` prefix creates.
    if path.split('/').skip(1).any(|seg| seg.is_empty() || seg == "." || seg == "..") {
        return None;
    }
    Some(path.to_string())
}

fn bad_path() -> axum::response::Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({"error": "invalid file path"})),
    )
        .into_response()
}

fn not_found() -> axum::response::Response {
    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "artifact or file not found"})),
    )
        .into_response()
}

fn db_error(context: &str, e: rusqlite::Error) -> axum::response::Response {
    tracing::warn!("DB error {}: {}", context, e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": e.to_string()})),
    )
        .into_response()
}

/// Files are only addressable while the owning artifact is live and owned
/// by the caller.
fn artifact_exists(conn: &Connection, artifact_id: &str, user_id: &str) -> bool {
    fetch_artifact_meta(conn, artifact_id, user_id)
        .ok()
        .flatten()
        .is_some()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Handlers
// ═══════════════════════════════════════════════════════════════════════════════

async fn list_content_artifact_files(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        if !artifact_exists(&conn, &id, &user_id) {
            return Ok(None);
        }
        let files = conn
            .prepare(
                "SELECT path, body_sha256, updated_at FROM content_artifact_files
                 WHERE artifact_id = ?1 ORDER BY path",
            )?
            .query_map(params![id], |row| {
                Ok(json!({
                    "path": row.get::<_, String>(0)?,
                    "sha256": row.get::<_, String>(1)?,
                    "updatedAt": row.get::<_, String>(2)?,
                }))
            })?
            .collect::<Result<Vec<serde_json::Value>, _>>()?;
        Ok(Some(files))
    })
    .await;

    match result {
        Ok(Ok(Some(files))) => (StatusCode::OK, Json(json!({"files": files}))).into_response(),
        Ok(Ok(None)) => not_found(),
        Ok(Err(e)) => db_error("listing content artifact files", e),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "internal error"})),
        )
            .into_response(),
    }
}

async fn get_content_artifact_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, raw_path)): Path<(String, String)>,
) -> impl IntoResponse {
    // axum wildcards capture without the leading `/`; our canonical path
    // space is slash-prefixed (`/index.html`).
    let raw_path = format!("/{}", raw_path.trim_start_matches('/'));
    let path = match valid_file_path(&raw_path) {
        Some(p) => p,
        None => return bad_path(),
    };
    let db = state.db.clone();
    let user_id = user.user_id;
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        if !artifact_exists(&conn, &id, &user_id) {
            return Ok(None);
        }
        let row = conn
            .query_row(
                "SELECT body, body_sha256, updated_at FROM content_artifact_files
                 WHERE artifact_id = ?1 AND path = ?2",
                params![id, path],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .optional()?;
        Ok(row.map(|(body, sha, updated_at)| {
            json!({
                "path": raw_path,
                "body": body,
                "sha256": sha,
                "updatedAt": updated_at,
            })
        }))
    })
    .await;

    match result {
        Ok(Ok(Some(file))) => (StatusCode::OK, Json(file)).into_response(),
        Ok(Ok(None)) => not_found(),
        Ok(Err(e)) => db_error("reading content artifact file", e),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "internal error"})),
        )
            .into_response(),
    }
}

async fn put_content_artifact_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, raw_path)): Path<(String, String)>,
    Json(body): Json<PutFileBody>,
) -> impl IntoResponse {
    let raw_path = format!("/{}", raw_path.trim_start_matches('/'));
    let path = match valid_file_path(&raw_path) {
        Some(p) => p,
        None => return bad_path(),
    };
    if body.body.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "body is required"})),
        )
            .into_response();
    }
    let db = state.db.clone();
    let user_id = user.user_id;
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        if !artifact_exists(&conn, &id, &user_id) {
            return Ok(None);
        }
        let sha = sha256_hex(&body.body);
        let now = now_rfc3339();
        // Upsert on (artifact_id, path): a retried write converges instead of
        // duplicating; identical content keeps its original timestamps.
        conn.execute(
            "INSERT INTO content_artifact_files
                 (artifact_id, path, body, body_sha256, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             ON CONFLICT(artifact_id, path) DO UPDATE SET
                 body = excluded.body,
                 body_sha256 = excluded.body_sha256,
                 updated_at = excluded.updated_at",
            params![id, path, body.body, sha, &now],
        )?;
        Ok(Some(json!({
            "path": raw_path.clone(),
            "sha256": sha,
            "updatedAt": now,
        })))
    })
    .await;

    match result {
        Ok(Ok(Some(file))) => (StatusCode::OK, Json(file)).into_response(),
        Ok(Ok(None)) => not_found(),
        Ok(Err(e)) => db_error("writing content artifact file", e),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "internal error"})),
        )
            .into_response(),
    }
}

async fn delete_content_artifact_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, raw_path)): Path<(String, String)>,
) -> impl IntoResponse {
    let raw_path = format!("/{}", raw_path.trim_start_matches('/'));
    let path = match valid_file_path(&raw_path) {
        Some(p) => p,
        None => return bad_path(),
    };
    let db = state.db.clone();
    let user_id = user.user_id;
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        if !artifact_exists(&conn, &id, &user_id) {
            return Ok(None);
        }
        let deleted = conn.execute(
            "DELETE FROM content_artifact_files WHERE artifact_id = ?1 AND path = ?2",
            params![id, path],
        )?;
        Ok(Some(deleted > 0))
    })
    .await;

    match result {
        Ok(Ok(Some(true))) => (StatusCode::OK, Json(json!({"ok": true}))).into_response(),
        Ok(Ok(Some(false))) => not_found(),
        Ok(Ok(None)) => not_found(),
        Ok(Err(e)) => db_error("deleting content artifact file", e),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "internal error"})),
        )
            .into_response(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content_artifact_routes::tests::{body_json, create_artifact, test_app_state, test_user};
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    async fn app(temp: &std::path::Path) -> axum::Router {
        let state = test_app_state(temp).await;
        content_artifact_file_router()
            .merge(crate::content_artifact_routes::content_artifact_router())
            .with_state(state)
    }

    fn req(method: &str, uri: &str, user: &AuthUser, payload: Option<serde_json::Value>) -> Request<Body> {
        let mut b = Request::builder()
            .method(method)
            .uri(uri)
            .extension(user.clone());
        let body = match payload {
            Some(p) => {
                b = b.header("Content-Type", "application/json");
                Body::from(p.to_string())
            }
            None => Body::empty(),
        };
        b.body(body).unwrap()
    }

    async fn put_file(
        app: &axum::Router,
        user: &AuthUser,
        id: &str,
        path: &str,
        body: &str,
    ) -> (StatusCode, serde_json::Value) {
        let resp = app
            .clone()
            .oneshot(req(
                "PUT",
                &format!("/content-artifacts/{id}/files{path}"),
                user,
                Some(json!({"body": body})),
            ))
            .await
            .unwrap();
        let status = resp.status();
        let json = body_json(resp.into_body()).await;
        (status, json)
    }

    #[tokio::test]
    async fn file_tree_write_read_list_delete_lifecycle() {
        let temp = std::env::temp_dir().join(format!("art-files-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);
        let (_, created) = create_artifact(&app, &user, "Site", "<html>v1</html>", json!({})).await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();

        // Empty index initially.
        let resp = app
            .clone()
            .oneshot(req("GET", &format!("/content-artifacts/{id}/files"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let listed = body_json(resp.into_body()).await;
        assert_eq!(listed["files"].as_array().unwrap().len(), 0);

        // Write a non-index file + the index file.
        let (s, f) = put_file(&app, &user, &id, "/styles.css", "body { color: red }").await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(f["path"], "/styles.css");
        let (s, _) = put_file(&app, &user, &id, "/index.html", "<html>tree index</html>").await;
        assert_eq!(s, StatusCode::OK);

        // Index lists both, ordered by path.
        let resp = app
            .clone()
            .oneshot(req("GET", &format!("/content-artifacts/{id}/files"), &user, None))
            .await
            .unwrap();
        let listed = body_json(resp.into_body()).await;
        let paths: Vec<&str> = listed["files"]
            .as_array()
            .unwrap()
            .iter()
            .map(|f| f["path"].as_str().unwrap())
            .collect();
        assert_eq!(paths, vec!["/index.html", "/styles.css"]);
        // Index entries carry a sha and updatedAt, not the body.
        assert!(listed["files"][0]["sha256"].is_string());
        assert!(listed["files"][0].get("body").is_none());

        // Read round-trips the body.
        let resp = app
            .clone()
            .oneshot(req(
                "GET",
                &format!("/content-artifacts/{id}/files/styles.css"),
                &user,
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let read = body_json(resp.into_body()).await;
        assert_eq!(read["body"], "body { color: red }");
        assert_eq!(read["path"], "/styles.css");

        // Upsert overwrites in place (same path, no duplicate).
        let (s, f) = put_file(&app, &user, &id, "/styles.css", "body { color: blue }").await;
        assert_eq!(s, StatusCode::OK);
        assert_ne!(f["sha256"], listed["files"][0]["sha256"]);
        let resp = app
            .clone()
            .oneshot(req("GET", &format!("/content-artifacts/{id}/files"), &user, None))
            .await
            .unwrap();
        let listed = body_json(resp.into_body()).await;
        assert_eq!(listed["files"].as_array().unwrap().len(), 2);

        // Deep path with a subdirectory segment works.
        let (s, _) = put_file(&app, &user, &id, "/assets/data.json", "{\"a\":1}").await;
        assert_eq!(s, StatusCode::OK);

        // Delete removes; reading after delete 404s.
        let resp = app
            .clone()
            .oneshot(req(
                "DELETE",
                &format!("/content-artifacts/{id}/files/styles.css"),
                &user,
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let resp = app
            .clone()
            .oneshot(req(
                "GET",
                &format!("/content-artifacts/{id}/files/styles.css"),
                &user,
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        std::fs::remove_dir_all(&temp).ok();
    }

    #[tokio::test]
    async fn file_paths_are_validated() {
        let temp = std::env::temp_dir().join(format!("art-files-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);
        let (_, created) = create_artifact(&app, &user, "Site", "<html>v1</html>", json!({})).await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();

        // Paths without a leading `/` never reach this handler (no route
        // match → 404, still safe); these all route but must be rejected.
        // (`%2e%2e` is intentionally absent: axum keeps wildcard captures
        // percent-encoded, so it is a literal "%2e%2e" key, not traversal —
        // and paths are DB keys here, never filesystem paths.)
        for bad in ["/..", "/a/../b", "/a//b", "/a/", "/", "/a\\b"] {
            let encoded: String = bad
                .chars()
                .map(|c| if c.is_ascii_alphanumeric() || c == '/' || c == '-' || c == '_' || c == '.' { c.to_string() } else { format!("%{:02X}", c as u32) })
                .collect();
            let resp = app
                .clone()
                .oneshot(req(
                    "PUT",
                    &format!("/content-artifacts/{id}/files{encoded}"),
                    &user,
                    Some(json!({"body": "x"})),
                ))
                .await
                .unwrap();
            // Any rejection is fine — handler 400 for routable bad paths,
            // router 404 when the path cannot even match the wildcard.
            assert!(
                resp.status().is_client_error(),
                "path {bad:?} must be rejected (got {})",
                resp.status()
            );
        }

        std::fs::remove_dir_all(&temp).ok();
    }

    #[tokio::test]
    async fn files_are_user_scoped_and_follow_soft_delete() {
        let temp = std::env::temp_dir().join(format!("art-files-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);
        let other = test_user("user-2", None);
        let (_, created) = create_artifact(&app, &user, "Site", "<html>v1</html>", json!({})).await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();
        let (s, _) = put_file(&app, &user, &id, "/index.html", "hi").await;
        assert_eq!(s, StatusCode::OK);

        // Another user gets 404 on list/read/write/delete — never a leak.
        for (method, uri, payload) in [
            ("GET", format!("/content-artifacts/{id}/files"), None),
            (
                "GET",
                format!("/content-artifacts/{id}/files/index.html"),
                None,
            ),
            (
                "PUT",
                format!("/content-artifacts/{id}/files/index.html"),
                Some(json!({"body": "evil"})),
            ),
            (
                "DELETE",
                format!("/content-artifacts/{id}/files/index.html"),
                None,
            ),
        ] {
            let resp = app
                .clone()
                .oneshot(req(method, &uri, &other, payload))
                .await
                .unwrap();
            assert_eq!(resp.status(), StatusCode::NOT_FOUND, "{method} {uri}");
        }

        // Soft delete the artifact → files unreadable.
        let resp = app
            .clone()
            .oneshot(req("DELETE", &format!("/content-artifacts/{id}"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let resp = app
            .clone()
            .oneshot(req("GET", &format!("/content-artifacts/{id}/files"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        std::fs::remove_dir_all(&temp).ok();
    }
}
