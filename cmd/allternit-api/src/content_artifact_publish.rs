//! Content-artifact publish routes — A:// Artifacts API Phase 3
//! (docs/design/artifacts-api.md §6 publish tier).
//!
//! Hosted publish to the shared Cloudflare Pages project with per-user routes
//! (decision 1). A publish snapshots an immutable version (decision 2):
//! `published_version` is recorded and later version appends do NOT change
//! what is live. Deployments stay immutable (decision 3): unpublish removes
//! the route only. Publish is gated on the sandbox policy (decision 4):
//! artifacts whose policy requests network access are rejected at publish
//! with a clear 4xx naming the policy.
//!
//! Deploy plumbing sits behind a narrow `ArtifactPublisher` trait with two
//! real implementations, selected by `ALLTERNIT_ARTIFACT_PUBLISHER`:
//! - `wrangler` — WranglerPagesPublisher shells out to
//!   `npx wrangler pages deploy` against the shared project
//!   (`ALLTERNIT_ARTIFACT_PAGES_PROJECT`, default `allternit-artifacts`).
//!   Route removal re-deploys the staging tree without the artifact's route;
//!   the previous Pages deployment stays reachable at its own immutable URL.
//! - `fs` (default) — FsPublisher writes immutable deployments under
//!   `<data_dir>/artifact-publish/deployments/<id>/` and per-user routes as
//!   directories under `<artifact-publish>/routes/<user_prefix>/<artifact_id>/`.
//!   Unpublish removes the route directory only; the deployment file stays.
//!
//! Neither implementation is a fake: both write real, servable static-site
//! trees. The fs publisher is the dev/test default because Cloudflare
//! credentials are not reachable from every dev machine.

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
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::content_artifact_routes::{
    fetch_artifact_meta, now_rfc3339, read_version_body, sha256_hex,
};
use crate::AppState;

pub fn content_artifact_publish_router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/content-artifacts/:id/publish",
        get(publish_status).post(publish_artifact).delete(unpublish_artifact),
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sandbox-policy gate (§6 decision 4)
// ═══════════════════════════════════════════════════════════════════════════════

/// Policies that request network access. v1 has exactly one shipped policy
/// (`standard`, which does not), so the gate is expressed as a matcher over
/// the policy string: any policy whose name carries `network` is a
/// network-requesting policy. This stays a data decision (the policy column
/// codifies the iframe attribute set per §8) rather than a code change when
/// new policies land.
fn policy_requests_network(policy: &str) -> bool {
    policy.trim().to_ascii_lowercase().contains("network")
}

// ═══════════════════════════════════════════════════════════════════════════════
// Static-site export
// ═══════════════════════════════════════════════════════════════════════════════

fn escape_html_text(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

/// Export one version body as a servable `index.html`. Full documents pass
/// through unchanged; fragments get a minimal standards-mode shell.
fn static_index_html(title: &str, body: &str) -> String {
    if body.to_ascii_lowercase().contains("<html") {
        return body.to_string();
    }
    format!(
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>{}</title>\n</head>\n<body>\n{}\n</body>\n</html>\n",
        escape_html_text(title),
        body
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Publisher interface + implementations
// ═══════════════════════════════════════════════════════════════════════════════

pub struct PublishOutcome {
    pub deployment_id: String,
    pub deployment_url: String,
    /// URL the user opens to see the published artifact at its route.
    pub route_url: String,
}

pub trait ArtifactPublisher: Send + Sync {
    fn kind(&self) -> &'static str;
    fn publish(&self, route_path: &str, index_html: &str, title: &str) -> Result<PublishOutcome, String>;
    /// Remove the route only — the deployment itself stays (decision 3).
    fn unpublish(&self, route_path: &str) -> Result<(), String>;
}

/// Select the publisher from env. Default `fs`; `wrangler` for the shared
/// Cloudflare Pages project (requires `CLOUDFLARE_API_TOKEN` + the wrangler
/// CLI at deploy time).
pub(crate) fn publisher_for(data_dir: &FsPath) -> Arc<dyn ArtifactPublisher> {
    let kind = std::env::var("ALLTERNIT_ARTIFACT_PUBLISHER")
        .unwrap_or_else(|_| "fs".to_string());
    match kind.trim().to_ascii_lowercase().as_str() {
        "wrangler" => Arc::new(WranglerPagesPublisher::new(data_dir.to_path_buf())),
        other => {
            if other != "fs" {
                warn!(
                    "unknown ALLTERNIT_ARTIFACT_PUBLISHER '{other}', falling back to 'fs'"
                );
            }
            Arc::new(FsPublisher::new(data_dir.to_path_buf()))
        }
    }
}

fn wrangler_project() -> String {
    std::env::var("ALLTERNIT_ARTIFACT_PAGES_PROJECT")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "allternit-artifacts".to_string())
}

/// Filesystem publisher: real static-site trees on local disk, structured
/// exactly like the shared-project layout (per-user routes over immutable
/// deployments). This is what dev and tests exercise; it is also a usable
/// local-static-hosting publisher in its own right (point any file server at
/// the routes/ tree).
pub(crate) struct FsPublisher {
    root: PathBuf,
}

impl FsPublisher {
    pub(crate) fn new(data_dir: PathBuf) -> Self {
        Self {
            root: data_dir.join("artifact-publish"),
        }
    }

    fn deployments_dir(&self) -> PathBuf {
        self.root.join("deployments")
    }

    fn routes_dir(&self) -> PathBuf {
        self.root.join("routes")
    }

    /// Deterministic deployment id: same route + same body → same deployment,
    /// so a republished identical version converges instead of accumulating.
    fn deployment_id(route_path: &str, index_html: &str) -> String {
        let sha = sha256_hex(&format!("{route_path}\n{index_html}"));
        format!("d{}", &sha[..16])
    }

    /// `../` repeated for each component of `route_path` plus the `routes`
    /// segment itself, so a symlink inside `routes/<route>/` resolves into
    /// `deployments/` at the tree root.
    fn rel_up(route_path: &str) -> String {
        let depth = route_path.split('/').filter(|s| !s.is_empty()).count() + 1;
        "../".repeat(depth)
    }
}

fn file_url(path: &FsPath) -> String {
    format!("file://{}", path.display())
}

impl ArtifactPublisher for FsPublisher {
    fn kind(&self) -> &'static str {
        "fs"
    }

    fn publish(
        &self,
        route_path: &str,
        index_html: &str,
        _title: &str,
    ) -> Result<PublishOutcome, String> {
        let id = Self::deployment_id(route_path, index_html);
        let deployment_dir = self.deployments_dir().join(&id);
        let deployment_index = deployment_dir.join("index.html");
        // Immutable: write once. A redeploy of the same content keeps the
        // original deployment bytes (decision 3).
        if !deployment_index.exists() {
            std::fs::create_dir_all(&deployment_dir)
                .map_err(|e| format!("creating deployment dir: {e}"))?;
            std::fs::write(&deployment_index, index_html.as_bytes())
                .map_err(|e| format!("writing deployment index: {e}"))?;
        }

        // (Re)point the route at the deployment. The route directory is
        // rebuilt every publish; the symlink target is the immutable
        // deployment, so an unpublish removes the route only.
        let route_dir = self.routes_dir().join(route_path);
        if route_dir.exists() {
            std::fs::remove_dir_all(&route_dir)
                .map_err(|e| format!("clearing route dir: {e}"))?;
        }
        std::fs::create_dir_all(&route_dir).map_err(|e| format!("creating route dir: {e}"))?;
        let target = format!("{}deployments/{}/index.html", Self::rel_up(route_path), id);
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, route_dir.join("index.html"))
            .map_err(|e| format!("linking route: {e}"))?;
        #[cfg(not(unix))]
        std::fs::write(route_dir.join("index.html"), index_html.as_bytes())
            .map_err(|e| format!("writing route index: {e}"))?;

        Ok(PublishOutcome {
            deployment_url: file_url(&deployment_index),
            route_url: file_url(&route_dir.join("index.html")),
            deployment_id: id,
        })
    }

    fn unpublish(&self, route_path: &str) -> Result<(), String> {
        let route_dir = self.routes_dir().join(route_path);
        if route_dir.exists() {
            std::fs::remove_dir_all(&route_dir)
                .map_err(|e| format!("removing route dir: {e}"))?;
        }
        // The deployment directory under deployments/ is deliberately left
        // in place — deployments stay immutable (decision 3).
        Ok(())
    }
}

/// Wrangler-backed publisher for the shared Cloudflare Pages project
/// (decision 1). The staging tree under `<data_dir>/artifact-publish/
/// wrangler-stage/` mirrors the per-user route layout; `wrangler pages
/// deploy` publishes it. Because each deploy snapshots the whole tree,
/// unpublish removes the artifact's route directory and redeploys — the
/// previous deployment remains reachable at its own immutable URL (decision
/// 3, the only honest mapping of "remove the route only" onto Pages).
pub(crate) struct WranglerPagesPublisher {
    stage_root: PathBuf,
}

impl WranglerPagesPublisher {
    pub(crate) fn new(data_dir: PathBuf) -> Self {
        Self {
            stage_root: data_dir.join("artifact-publish").join("wrangler-stage"),
        }
    }

    fn run_wrangler(&self) -> Result<String, String> {
        let project = wrangler_project();
        let output = std::process::Command::new("npx")
            .args([
                "wrangler",
                "pages",
                "deploy",
                self.stage_root.to_str().unwrap_or("."),
                "--project-name",
                &project,
                "--branch",
                "main",
                "--commit-dirty=true",
            ])
            .env_remove("CI")
            .output()
            .map_err(|e| format!("spawning wrangler pages deploy: {e}"))?;
        if !output.status.success() {
            return Err(format!(
                "wrangler pages deploy failed ({}): {}",
                output.status,
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

impl ArtifactPublisher for WranglerPagesPublisher {
    fn kind(&self) -> &'static str {
        "wrangler"
    }

    fn publish(
        &self,
        route_path: &str,
        index_html: &str,
        _title: &str,
    ) -> Result<PublishOutcome, String> {
        let route_dir = self.stage_root.join(route_path);
        std::fs::create_dir_all(&route_dir)
            .map_err(|e| format!("creating staged route dir: {e}"))?;
        std::fs::write(route_dir.join("index.html"), index_html.as_bytes())
            .map_err(|e| format!("writing staged index: {e}"))?;

        let stdout = self.run_wrangler()?;
        // wrangler prints the deployment URL (https://<hash>.<project>.pages.dev)
        // on success; the deployment id is the hash subdomain.
        let url = stdout
            .split_whitespace()
            .find(|tok| tok.starts_with("https://") && tok.contains("pages.dev"))
            .map(|s| s.trim_matches(|c: char| !c.is_ascii_graphic() || c == ')').to_string());
        let url = url.ok_or_else(|| {
            format!("wrangler deploy succeeded but no pages.dev URL found in output: {stdout}")
        })?;
        let deployment_id = url
            .trim_start_matches("https://")
            .split('.')
            .next()
            .unwrap_or("unknown")
            .to_string();
        let route_url = format!("{url}/{}/", route_path.trim_matches('/'));
        Ok(PublishOutcome {
            deployment_id,
            deployment_url: url,
            route_url,
        })
    }

    fn unpublish(&self, route_path: &str) -> Result<(), String> {
        let route_dir = self.stage_root.join(route_path);
        if route_dir.exists() {
            std::fs::remove_dir_all(&route_dir)
                .map_err(|e| format!("removing staged route dir: {e}"))?;
        }
        // Redeploy the tree without this route. The deployment that used to
        // serve it is not deleted — it stays at its own pages.dev URL.
        self.run_wrangler().map(|_| ())
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Per-user route mapping
// ═══════════════════════════════════════════════════════════════════════════════

/// Deterministic per-user route prefix (`u-<sha12>`) in the shared Pages
/// project. Deriving it from the user id means the mapping converges
/// idempotently; the table records it (INSERT OR IGNORE) so the mapping is
/// auditable and stable even if the derivation scheme ever changes.
fn user_route_prefix(conn: &Connection, user_id: &str) -> Result<String, rusqlite::Error> {
    if let Some(existing) = conn
        .query_row(
            "SELECT route_prefix FROM content_artifact_publish_routes WHERE user_id = ?1",
            params![user_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?
    {
        return Ok(existing);
    }
    let prefix = format!("u-{}", &sha256_hex(user_id)[..12]);
    conn.execute(
        "INSERT OR IGNORE INTO content_artifact_publish_routes (user_id, route_prefix, created_at)
         VALUES (?1, ?2, ?3)",
        params![user_id, &prefix, now_rfc3339()],
    )?;
    Ok(prefix)
}

struct PublishRow {
    published_version: i64,
    route_path: String,
    deployment_id: Option<String>,
    deployment_url: Option<String>,
    publisher_kind: String,
    published_at: String,
    unpublished_at: Option<String>,
}

fn read_publish_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PublishRow> {
    Ok(PublishRow {
        published_version: row.get(0)?,
        route_path: row.get(1)?,
        deployment_id: row.get(2)?,
        deployment_url: row.get(3)?,
        publisher_kind: row.get(4)?,
        published_at: row.get(5)?,
        unpublished_at: row.get(6)?,
    })
}

const PUBLISH_SELECT: &str = "SELECT published_version, route_path, deployment_id,
    deployment_url, publisher_kind, published_at, unpublished_at
    FROM content_artifact_publishes";

fn fetch_publish_row(
    conn: &Connection,
    artifact_id: &str,
) -> Result<Option<PublishRow>, rusqlite::Error> {
    conn.query_row(
        &format!("{PUBLISH_SELECT} WHERE artifact_id = ?1"),
        params![artifact_id],
        read_publish_row,
    )
    .optional()
}

/// A publish row is "live" when it has not been unpublished (decision 3).
fn status_json(artifact_id: &str, row: Option<&PublishRow>) -> serde_json::Value {
    match row {
        Some(r) if r.unpublished_at.is_none() => json!({
            "published": true,
            "artifactId": artifact_id,
            "version": r.published_version,
            "routePath": r.route_path,
            "deploymentId": r.deployment_id,
            "deploymentUrl": r.deployment_url,
            "url": r.deployment_url,
            "publisher": r.publisher_kind,
            "publishedAt": r.published_at,
        }),
        Some(r) => json!({
            "published": false,
            "artifactId": artifact_id,
            "unpublishedAt": r.unpublished_at,
        }),
        None => json!({
            "published": false,
            "artifactId": artifact_id,
        }),
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /content-artifacts/:id/publish
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct PublishBody {
    version: Option<i64>,
}

async fn publish_artifact(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    body: Option<Json<PublishBody>>,
) -> impl IntoResponse {
    let requested_version = body.and_then(|Json(b)| b.version);
    let db = state.db.clone();
    let data_dir = state.data_dir.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || -> Result<PublishResult, rusqlite::Error> {
        let mut conn = db.connect()?;
        let meta = match fetch_artifact_meta(&conn, &id, &user_id)? {
            Some(m) => m,
            None => return Ok(PublishResult::NotFound),
        };

        // §6 decision 4: publish is gated on the sandbox policy. A policy
        // that requests network access is rejected with a clear error naming
        // the policy.
        if policy_requests_network(&meta.sandbox_policy) {
            return Ok(PublishResult::PolicyGate {
                policy: meta.sandbox_policy,
            });
        }

        let version = requested_version.unwrap_or(meta.current_version);
        let (body_text, _, _, _) =
            match read_version_body(&conn, &data_dir, &id, version)? {
                Some(b) => b,
                None => return Ok(PublishResult::VersionMissing(version)),
            };

        let route_prefix = user_route_prefix(&conn, &user_id)?;
        let route_path = format!("{}/{}", route_prefix, id);
        let index_html = static_index_html(&meta.title, &body_text);

        // Idempotent replay: the same version already live → return the
        // current publish state without redeploying.
        if let Some(row) = fetch_publish_row(&conn, &id)? {
            if row.unpublished_at.is_none() && row.published_version == version {
                return Ok(PublishResult::Replay(status_json(&id, Some(&row))));
            }
        }

        let publisher = publisher_for(&data_dir);
        let outcome = match publisher.publish(&route_path, &index_html, &meta.title) {
            Ok(o) => o,
            Err(e) => return Ok(PublishResult::DeployFailed(e)),
        };
        let now = now_rfc3339();
        conn.execute(
            "INSERT INTO content_artifact_publishes
                 (artifact_id, user_id, published_version, route_path, deployment_id,
                  deployment_url, publisher_kind, published_at, unpublished_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL)
             ON CONFLICT(artifact_id) DO UPDATE SET
                 user_id = excluded.user_id,
                 published_version = excluded.published_version,
                 route_path = excluded.route_path,
                 deployment_id = excluded.deployment_id,
                 deployment_url = excluded.deployment_url,
                 publisher_kind = excluded.publisher_kind,
                 published_at = excluded.published_at,
                 unpublished_at = NULL",
            params![
                id,
                user_id,
                version,
                route_path,
                outcome.deployment_id,
                outcome.deployment_url,
                publisher.kind(),
                now,
            ],
        )?;
        let row = fetch_publish_row(&conn, &id)?;
        Ok(PublishResult::Published(status_json(&id, row.as_ref())))
    })
    .await;

    match result {
        Ok(Ok(PublishResult::Published(status))) => {
            (StatusCode::CREATED, Json(status)).into_response()
        }
        Ok(Ok(PublishResult::Replay(status))) => (StatusCode::OK, Json(status)).into_response(),
        Ok(Ok(PublishResult::NotFound)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "not found"})),
        )
            .into_response(),
        Ok(Ok(PublishResult::PolicyGate { policy })) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "error": format!(
                    "publish rejected: sandbox_policy '{policy}' requests network access; \
                     artifacts with a network sandbox policy cannot be published (design §6, decision 4)"
                )
            })),
        )
            .into_response(),
        Ok(Ok(PublishResult::VersionMissing(version))) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("version {version} not found")})),
        )
            .into_response(),
        Ok(Ok(PublishResult::DeployFailed(e))) => {
            warn!("content-artifact publish deploy failed: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("publish failed: {e}")})),
            )
                .into_response()
        }
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "internal error"})),
        )
            .into_response(),
    }
}

enum PublishResult {
    Published(serde_json::Value),
    Replay(serde_json::Value),
    NotFound,
    PolicyGate {
        policy: String,
    },
    VersionMissing(i64),
    DeployFailed(String),
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /content-artifacts/:id/publish — status
// ═══════════════════════════════════════════════════════════════════════════════

async fn publish_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(
        move || -> Result<Option<serde_json::Value>, rusqlite::Error> {
        let conn = db.connect()?;
        if fetch_artifact_meta(&conn, &id, &user_id)?.is_none() {
            return Ok(None);
        }
        let row = fetch_publish_row(&conn, &id)?;
        Ok(Some(status_json(&id, row.as_ref())))
    })
    .await;

    match result {
        Ok(Ok(Some(status))) => Json(status).into_response(),
        Ok(Ok(None)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "not found"})),
        )
            .into_response(),
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "internal error"})),
        )
            .into_response(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /content-artifacts/:id/publish — unpublish (route removal only)
// ═══════════════════════════════════════════════════════════════════════════════

async fn unpublish_artifact(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let data_dir = state.data_dir.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(
        move || -> Result<UnpublishResult, rusqlite::Error> {
        let conn = db.connect()?;
        if fetch_artifact_meta(&conn, &id, &user_id)?.is_none() {
            return Ok(UnpublishResult::NotFound);
        }
        let row = match fetch_publish_row(&conn, &id)? {
            Some(r) if r.unpublished_at.is_none() => r,
            _ => return Ok(UnpublishResult::NotPublished),
        };
        let publisher = publisher_for(&data_dir);
        match publisher.unpublish(&row.route_path) {
            Ok(()) => {}
            Err(e) => return Ok(UnpublishResult::DeployFailed(e)),
        }
        conn.execute(
            "UPDATE content_artifact_publishes SET unpublished_at = ?2 WHERE artifact_id = ?1",
            params![id, now_rfc3339()],
        )?;
        Ok(UnpublishResult::Ok(row.route_path))
    })
    .await;

    match result {
        Ok(Ok(UnpublishResult::Ok(route_path))) => {
            Json(json!({"ok": true, "routePath": route_path})).into_response()
        }
        Ok(Ok(UnpublishResult::NotFound)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "not found"})),
        )
            .into_response(),
        Ok(Ok(UnpublishResult::NotPublished)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "not published"})),
        )
            .into_response(),
        Ok(Ok(UnpublishResult::DeployFailed(e))) => {
            warn!("content-artifact unpublish failed: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("unpublish failed: {e}")})),
            )
                .into_response()
        }
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "internal error"})),
        )
            .into_response(),
    }
}

enum UnpublishResult {
    Ok(String),
    NotFound,
    NotPublished,
    DeployFailed(String),
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content_artifact_routes::tests::{
        body_json, create_artifact, test_app_state, test_user,
    };
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    async fn app(temp: &FsPath) -> axum::Router {
        let state = test_app_state(temp).await;
        content_artifact_publish_router()
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

    #[test]
    fn network_policies_are_gated() {
        assert!(policy_requests_network("allow-network"));
        assert!(policy_requests_network("Network"));
        assert!(policy_requests_network(" standard-with-network "));
        assert!(!policy_requests_network("standard"));
        assert!(!policy_requests_network("strict"));
        assert!(!policy_requests_network("isolated"));
    }

    #[test]
    fn fragment_body_gets_standards_shell() {
        let html = static_index_html("Q3 deck", "<h1>Hi</h1>");
        assert!(html.contains("<!DOCTYPE html>"));
        assert!(html.contains("<h1>Hi</h1>"));
        assert!(html.contains("<title>Q3 deck</title>"));
        let full = static_index_html("x", "<HTML><body>full</body></HTML>");
        assert_eq!(full, "<HTML><body>full</body></HTML>");
    }

    #[tokio::test]
    async fn publish_rejects_network_requesting_sandbox_policy() {
        let temp = std::env::temp_dir().join(format!("art-pub-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);

        let (_, created) = create_artifact(
            &app,
            &user,
            "Deck",
            "<html>v1</html>",
            json!({"sandboxPolicy": "allow-network"}),
        )
        .await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();

        let resp = app
            .clone()
            .oneshot(req("POST", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let err = body_json(resp.into_body()).await;
        let msg = err["error"].as_str().unwrap();
        assert!(msg.contains("allow-network"), "error names the policy: {msg}");
        assert!(msg.contains("network"), "error explains the network gate: {msg}");

        // Never published.
        let resp = app
            .oneshot(req("GET", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        let status = body_json(resp.into_body()).await;
        assert_eq!(status["published"], false);

        std::fs::remove_dir_all(&temp).ok();
    }

    #[tokio::test]
    async fn publish_snapshots_version_and_appends_do_not_change_live() {
        let temp = std::env::temp_dir().join(format!("art-pub-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);

        let (_, created) = create_artifact(&app, &user, "Deck", "<html>v1 body</html>", json!({})).await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();

        // Publish current version (v1) → 201, fs publisher on by default.
        let resp = app
            .clone()
            .oneshot(req("POST", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let published = body_json(resp.into_body()).await;
        assert_eq!(published["published"], true);
        assert_eq!(published["version"], 1);
        assert_eq!(published["publisher"], "fs");
        let route_path = published["routePath"].as_str().unwrap().to_string();
        assert!(route_path.starts_with("u-"), "per-user route prefix: {route_path}");
        assert!(route_path.contains(&id));

        // Append v2 — the live publish must not change.
        let resp = app
            .clone()
            .oneshot(req(
                "PUT",
                &format!("/content-artifacts/{id}/versions"),
                &user,
                Some(json!({"body": "<html>v2 body</html>"})),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);

        let resp = app
            .clone()
            .oneshot(req("GET", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        let status = body_json(resp.into_body()).await;
        assert_eq!(status["published"], true);
        assert_eq!(status["version"], 1, "snapshot stays pinned to v1");
        assert_eq!(status["routePath"], route_path);

        // The deployed static site still serves the v1 snapshot…
        let deployment_dir = temp
            .join("artifact-publish")
            .join("deployments")
            .join(status["deploymentId"].as_str().unwrap());
        let deployed = std::fs::read_to_string(deployment_dir.join("index.html")).unwrap();
        assert!(deployed.contains("v1 body"));
        assert!(!deployed.contains("v2 body"));

        // …and the route resolves to it on disk.
        let route_index = temp.join("artifact-publish").join("routes").join(&route_path);
        let served = std::fs::read_to_string(route_index.join("index.html")).unwrap();
        assert!(served.contains("v1 body"));

        std::fs::remove_dir_all(&temp).ok();
    }

    #[tokio::test]
    async fn republish_same_version_is_idempotent_republish_new_version_updates() {
        let temp = std::env::temp_dir().join(format!("art-pub-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);

        let (_, created) = create_artifact(&app, &user, "Deck", "<html>v1</html>", json!({})).await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();

        let resp = app
            .clone()
            .oneshot(req("POST", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let first = body_json(resp.into_body()).await;

        // Same version again → 200 replay, same deployment.
        let resp = app
            .clone()
            .oneshot(req("POST", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK, "same-version republish replays");
        let replay = body_json(resp.into_body()).await;
        assert_eq!(replay["deploymentId"], first["deploymentId"]);

        // Publish v2 explicitly → 201, new deployment.
        let resp = app
            .clone()
            .oneshot(req(
                "PUT",
                &format!("/content-artifacts/{id}/versions"),
                &user,
                Some(json!({"body": "<html>v2</html>"})),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);

        let resp = app
            .clone()
            .oneshot(req(
                "POST",
                &format!("/content-artifacts/{id}/publish"),
                &user,
                Some(json!({"version": 2})),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let second = body_json(resp.into_body()).await;
        assert_eq!(second["version"], 2);
        assert_ne!(second["deploymentId"], first["deploymentId"]);

        std::fs::remove_dir_all(&temp).ok();
    }

    #[tokio::test]
    async fn unpublish_removes_route_keeps_deployment() {
        let temp = std::env::temp_dir().join(format!("art-pub-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);

        let (_, created) = create_artifact(&app, &user, "Deck", "<html>v1</html>", json!({})).await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();

        let resp = app
            .clone()
            .oneshot(req("POST", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        let published = body_json(resp.into_body()).await;
        let route_path = published["routePath"].as_str().unwrap().to_string();
        let deployment_id = published["deploymentId"].as_str().unwrap().to_string();

        let resp = app
            .clone()
            .oneshot(req("DELETE", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let ok = body_json(resp.into_body()).await;
        assert_eq!(ok["ok"], true);

        // Status flips to unpublished, keeping history.
        let resp = app
            .clone()
            .oneshot(req("GET", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        let status = body_json(resp.into_body()).await;
        assert_eq!(status["published"], false);
        assert!(status["unpublishedAt"].is_string());

        // Route is gone; the deployment file stays (decision 3).
        let route_dir = temp.join("artifact-publish").join("routes").join(&route_path);
        assert!(!route_dir.exists(), "route removed");
        let deployment_index = temp
            .join("artifact-publish")
            .join("deployments")
            .join(&deployment_id)
            .join("index.html");
        assert!(deployment_index.exists(), "deployment kept immutable");

        // Second unpublish → 404.
        let resp = app
            .oneshot(req("DELETE", &format!("/content-artifacts/{id}/publish"), &user, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        std::fs::remove_dir_all(&temp).ok();
    }

    #[tokio::test]
    async fn publish_missing_version_and_user_scoping() {
        let temp = std::env::temp_dir().join(format!("art-pub-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let app = app(&temp).await;
        let user = test_user("user-1", None);
        let other = test_user("user-2", None);

        let (_, created) = create_artifact(&app, &user, "Deck", "<html>v1</html>", json!({})).await;
        let id = created["artifact"]["id"].as_str().unwrap().to_string();

        // Version that doesn't exist → 400.
        let resp = app
            .clone()
            .oneshot(req(
                "POST",
                &format!("/content-artifacts/{id}/publish"),
                &user,
                Some(json!({"version": 99})),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // Other user: publish + status both 404 (scoped like every route).
        for method in ["POST", "GET", "DELETE"] {
            let resp = app
                .clone()
                .oneshot(req(
                    method,
                    &format!("/content-artifacts/{id}/publish"),
                    &other,
                    None,
                ))
                .await
                .unwrap();
            assert_eq!(resp.status(), StatusCode::NOT_FOUND, "{method} scoped to owner");
        }

        std::fs::remove_dir_all(&temp).ok();
    }

    #[tokio::test]
    async fn fs_publisher_lifecycle_direct() {
        let temp = std::env::temp_dir().join(format!("art-pub-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let publisher = FsPublisher::new(temp.clone());

        let out = publisher
            .publish("u-abc/art_1", "<html>hi</html>", "t")
            .unwrap();
        assert_eq!(publisher.kind(), "fs");
        assert!(out.deployment_id.starts_with('d'));
        let served = std::fs::read_to_string(
            temp.join("artifact-publish/routes/u-abc/art_1/index.html"),
        )
        .unwrap();
        assert_eq!(served, "<html>hi</html>");

        publisher.unpublish("u-abc/art_1").unwrap();
        assert!(!temp.join("artifact-publish/routes/u-abc/art_1").exists());
        assert!(
            temp.join("artifact-publish/deployments")
                .join(&out.deployment_id)
                .join("index.html")
                .exists()
        );

        std::fs::remove_dir_all(&temp).ok();
    }
}
