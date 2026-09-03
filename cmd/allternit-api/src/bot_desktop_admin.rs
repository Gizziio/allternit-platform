//! Bot desktop admin endpoints.
//!
//! Global, user-scoped management surface for desktop sandboxes independent
//! of per-bot desktop routes.

use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/desktop-sandboxes", get(list_user_desktop_sandboxes))
        .route("/desktop-health", get(get_desktop_health))
}

#[derive(Debug, Serialize)]
pub struct DesktopSandboxSummary {
    pub bot_id: String,
    pub sandbox_id: String,
    pub provider: String,
    pub host: Option<String>,
    pub status: String,
    pub os: String,
}

async fn list_user_desktop_sandboxes(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT s.bot_id, s.sandbox_id, s.provider, s.host, s.status, s.os \
             FROM bot_desktop_sandboxes s \
             JOIN agents a ON a.id = s.bot_id \
             WHERE a.user_id = ?1 \
             ORDER BY s.updated_at DESC, s.created_at DESC"
        )?;
        let rows = stmt.query_map(rusqlite::params![user_id], |row| {
            Ok(DesktopSandboxSummary {
                bot_id: row.get(0)?,
                sandbox_id: row.get(1)?,
                provider: row.get(2)?,
                host: row.get(3)?,
                status: row.get(4)?,
                os: row.get(5)?,
            })
        })?;

        let mut sandboxes = Vec::new();
        for row in rows {
            sandboxes.push(row?);
        }
        Ok::<_, rusqlite::Error>(sandboxes)
    })
    .await;

    match result {
        Ok(Ok(sandboxes)) => (StatusCode::OK, Json(json!({ "sandboxes": sandboxes }))).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to list user desktop sandboxes");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("database error: {}", e)})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked listing user desktop sandboxes");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn get_desktop_health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let driver = match state.vm_driver.as_ref() {
        Some(d) => d.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"healthy": false, "error": "no VM driver configured"})),
            )
                .into_response();
        }
    };

    match driver.health_check().await {
        Ok(health) => {
            let status = if health.healthy {
                StatusCode::OK
            } else {
                StatusCode::SERVICE_UNAVAILABLE
            };
            (
                status,
                Json(json!({
                    "healthy": health.healthy,
                    "message": health.message,
                    "capabilities": health.capabilities,
                })),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "desktop health check failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"healthy": false, "error": e.to_string()})),
            )
                .into_response()
        }
    }
}
