//! Access Transparency audit feed — append-only organization-scoped events
//! with cursor pagination.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/audit", post(write_event).get(list_events))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "audit feed operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn admin_org(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = user.organization_id.as_deref().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })?;
    if !crate::rbac::is_org_admin(conn, org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can access the audit feed.",
        ));
    }
    Ok(org.to_string())
}

// ─── Write ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct WriteEvent {
    action: String,
    resource_type: String,
    resource_id: String,
    #[serde(default)]
    metadata: Option<Value>,
}

async fn write_event(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<WriteEvent>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO audit_events (id, organization_id, actor_id, action, resource_type, resource_id, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, org, user.user_id, body.action, body.resource_type, body.resource_id, body.metadata.map(|m| m.to_string())],
        ).map_err(internal)?;
        Ok::<_, ApiError>(id)
    }).await;
    match result {
        Ok(Ok(id)) => (StatusCode::CREATED, Json(json!({"id": id}))).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ─── List with cursor pagination ────────────────────────────────────────────

#[derive(Deserialize)]
struct ListQuery {
    #[serde(default)]
    cursor: Option<String>,
    #[serde(default)]
    limit: Option<usize>,
}

#[derive(Serialize)]
struct AuditEventRow {
    id: String,
    actor_id: String,
    action: String,
    resource_type: String,
    resource_id: String,
    metadata: Option<Value>,
    created_at: String,
}

fn event_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<AuditEventRow> {
    let metadata: Option<String> = row.get(5)?;
    Ok(AuditEventRow {
        id: row.get(0)?,
        actor_id: row.get(1)?,
        action: row.get(2)?,
        resource_type: row.get(3)?,
        resource_id: row.get(4)?,
        metadata: metadata.and_then(|s| serde_json::from_str(&s).ok()),
        created_at: row.get(6)?,
    })
}

async fn list_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Response {
    let limit = query.limit.unwrap_or(50).min(100);
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;

        let (rows, next_cursor) = if let Some(cursor) = query.cursor {
            let parts: Vec<&str> = cursor.split('|').collect();
            if parts.len() != 2 {
                return Err(error(StatusCode::BAD_REQUEST, "invalid_cursor", "cursor must be created_at|id."));
            }
            let created_at = parts[0];
            let id = parts[1];
            let mut stmt = conn.prepare(
                "SELECT id, actor_id, action, resource_type, resource_id, metadata, created_at FROM audit_events
                 WHERE organization_id = ?1 AND (created_at > ?2 OR (created_at = ?2 AND id > ?3))
                 ORDER BY created_at ASC, id ASC LIMIT ?4"
            ).map_err(internal)?;
            let rows = stmt
                .query_map(params![org, created_at, id, limit + 1], event_json)
                .map_err(internal)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(internal)?;
            build_page(rows, limit)
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, actor_id, action, resource_type, resource_id, metadata, created_at FROM audit_events
                 WHERE organization_id = ?1 ORDER BY created_at ASC, id ASC LIMIT ?2"
            ).map_err(internal)?;
            let rows = stmt
                .query_map(params![org, limit + 1], event_json)
                .map_err(internal)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(internal)?;
            build_page(rows, limit)
        };
        Ok(json!({
            "events": rows,
            "next_cursor": next_cursor,
            "limit": limit,
        }))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

fn build_page(mut rows: Vec<AuditEventRow>, limit: usize) -> (Vec<AuditEventRow>, Option<String>) {
    let has_more = rows.len() > limit;
    if has_more {
        rows.truncate(limit);
    }
    let next_cursor = if has_more {
        rows.last().map(|r| format!("{}|{}", r.created_at, r.id))
    } else {
        None
    };
    (rows, next_cursor)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-admin-audit-test-{}.db", id));
        let db = DbHandle::new(path.clone()).unwrap();
        (path.to_string_lossy().to_string(), db)
    }

    fn seed_org_user(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
            rusqlite::params![org_id],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            rusqlite::params![user_id, format!("{}@test.local", user_id)],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![format!("{}:{}", org_id, user_id), org_id, user_id, role],
        )
        .unwrap();
    }

    fn auth_user(org_id: Option<&str>, user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: Some(format!("{}@test.local", user_id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: None,
            organization_slug: None,
        }
    }

    #[test]
    fn admin_org_gates_non_admins() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");
        seed_org_user(&conn, "org-1", "member-1", "member");

        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "admin-1")).unwrap(), "org-1");
        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "member-1")).unwrap_err().0, StatusCode::FORBIDDEN);
        assert_eq!(admin_org(&conn, &auth_user(None, "admin-1")).unwrap_err().0, StatusCode::FORBIDDEN);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn audit_event_roundtrip() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");

        let event_id = "evt-1";
        conn.execute(
            "INSERT INTO audit_events (id, organization_id, actor_id, action, resource_type, resource_id, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![event_id, "org-1", "admin-1", "user.login", "user", "admin-1", r#"{"ip":"127.0.0.1"}"#],
        ).unwrap();

        let row = conn.query_row(
            "SELECT id, actor_id, action, resource_type, resource_id, metadata, created_at FROM audit_events WHERE id = ?1",
            rusqlite::params![event_id],
            event_json,
        ).unwrap();
        assert_eq!(row.action, "user.login");
        assert_eq!(row.metadata, Some(json!({"ip": "127.0.0.1"})));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn build_page_limits_and_cursor() {
        let rows = vec![
            AuditEventRow { id: "a".into(), actor_id: "u".into(), action: "x".into(), resource_type: "y".into(), resource_id: "z".into(), metadata: None, created_at: "2026-01-01T00:00:00Z".into() },
            AuditEventRow { id: "b".into(), actor_id: "u".into(), action: "x".into(), resource_type: "y".into(), resource_id: "z".into(), metadata: None, created_at: "2026-01-01T00:00:01Z".into() },
        ];
        let (page, cursor) = build_page(rows, 1);
        assert_eq!(page.len(), 1);
        assert_eq!(cursor, Some("2026-01-01T00:00:00Z|a".to_string()));
    }
}
