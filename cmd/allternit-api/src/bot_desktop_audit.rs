//! Audit logging for bot-desktop control-plane operations.
//!
//! A lightweight middleware records every request that reaches the desktop
//! router, and a small read endpoint lets admins/operators inspect the history
//! for a given bot.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct DesktopAuditLogEntry {
    pub id: String,
    pub bot_id: String,
    pub user_id: String,
    pub method: String,
    pub path: String,
    pub action: Option<String>,
    pub success: bool,
    pub error: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ListDesktopAuditQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Middleware that records every bot-desktop request to SQLite.
pub async fn desktop_audit_middleware(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    request: Request,
    next: Next,
) -> impl IntoResponse {
    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    let bot_id = extract_bot_id_from_path(&path);
    let action = bot_id.as_ref().and_then(|_| classify_action(&path));
    let user_id = user.user_id.clone();

    let response = next.run(request).await;
    let success = response.status().is_success();
    let error = if success {
        None
    } else {
        Some(response.status().to_string())
    };

    if let Some(bot_id) = bot_id {
        let db = state.db.clone();
        let record = AuditInsert {
            bot_id,
            user_id,
            method,
            path,
            action,
            success,
            error,
        };
        tokio::task::spawn_blocking(move || {
            if let Err(e) = insert_audit_record(&db, record) {
                warn!(error = %e, "Failed to write desktop audit log");
            }
        })
        .await
        .ok();
    }

    response
}

struct AuditInsert {
    bot_id: String,
    user_id: String,
    method: String,
    path: String,
    action: Option<String>,
    success: bool,
    error: Option<String>,
}

fn insert_audit_record(db: &crate::db::DbHandle, record: AuditInsert) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO desktop_audit_logs (id, bot_id, user_id, method, path, action, success, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            format!("desktop-audit-{}", Uuid::new_v4().simple()),
            record.bot_id,
            record.user_id,
            record.method,
            record.path,
            record.action,
            if record.success { 1 } else { 0 },
            record.error,
        ],
    )?;
    Ok(())
}

fn extract_bot_id_from_path(path: &str) -> Option<String> {
    // Paths are nested under /api/v1/bots/:bot_id/desktop/...
    let parts: Vec<&str> = path.split('/').collect();
    if let Some(idx) = parts.iter().position(|&p| p == "bots") {
        if let Some(bot_id) = parts.get(idx + 1) {
            if !bot_id.is_empty() && *bot_id != ":bot_id" {
                return Some(bot_id.to_string());
            }
        }
    }
    None
}

fn classify_action(path: &str) -> Option<String> {
    let suffix = path.rsplit('/').next()?;
    if suffix == "desktop" {
        return Some("status".to_string());
    }
    // The last segment is usually the action name; strip numeric ids.
    if suffix.chars().all(|c| c.is_alphanumeric() || c == '-') && !suffix.starts_with("snap-") {
        Some(suffix.to_string())
    } else {
        None
    }
}

/// GET /api/v1/bots/:bot_id/desktop/audit-logs
pub async fn list_desktop_audit_logs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    axum::extract::Path(bot_id): axum::extract::Path<String>,
    axum::extract::Query(query): axum::extract::Query<ListDesktopAuditQuery>,
) -> impl IntoResponse {
    // Reuse the same ownership check as the rest of the desktop router.
    if !crate::bot_desktop_routes::verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);
    let db = state.db.clone();
    let bot_id_for_query = bot_id.clone();

    match tokio::task::spawn_blocking(move || fetch_audit_logs(&db, &bot_id_for_query, limit, offset)).await {
        Ok(Ok(logs)) => Json(json!({
            "bot_id": bot_id,
            "logs": logs,
            "limit": limit,
            "offset": offset,
        }))
        .into_response(),
        Ok(Err(e)) => {
            warn!(bot_id, error = %e, "Failed to list desktop audit logs");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to list audit logs"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Audit log task panicked");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to list audit logs"})),
            )
                .into_response()
        }
    }
}

fn fetch_audit_logs(
    db: &crate::db::DbHandle,
    bot_id: &str,
    limit: usize,
    offset: usize,
) -> Result<Vec<DesktopAuditLogEntry>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, bot_id, user_id, method, path, action, success, error, created_at
         FROM desktop_audit_logs
         WHERE bot_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2 OFFSET ?3",
    )?;
    let rows = stmt.query_map(params![bot_id, limit, offset], |row| {
        Ok(DesktopAuditLogEntry {
            id: row.get(0)?,
            bot_id: row.get(1)?,
            user_id: row.get(2)?,
            method: row.get(3)?,
            path: row.get(4)?,
            action: row.get(5)?,
            success: row.get::<_, i32>(6)? != 0,
            error: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;
    rows.collect()
}

pub fn bot_desktop_audit_router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/bots/:bot_id/desktop/audit-logs",
        get(list_desktop_audit_logs),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_bot_id_from_desktop_path() {
        assert_eq!(
            extract_bot_id_from_path("/api/v1/bots/abc-123/desktop/snapshots"),
            Some("abc-123".to_string())
        );
        assert_eq!(
            extract_bot_id_from_path("/api/v1/bots/abc-123/desktop"),
            Some("abc-123".to_string())
        );
        assert_eq!(extract_bot_id_from_path("/api/v1/agents"), None);
    }

    #[test]
    fn classifies_common_actions() {
        assert_eq!(
            classify_action("/api/v1/bots/b/desktop/screenshot"),
            Some("screenshot".to_string())
        );
        assert_eq!(
            classify_action("/api/v1/bots/b/desktop/snapshots"),
            Some("snapshots".to_string())
        );
        assert_eq!(
            classify_action("/api/v1/bots/b/desktop/shell"),
            Some("shell".to_string())
        );
        assert_eq!(
            classify_action("/api/v1/bots/b/desktop"),
            Some("status".to_string())
        );
    }
}
