//! Compliance API scaffold — organization-scoped export/deletion requests and
//! per-app data retrieval/deletion for chats, projects, and artifacts.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/compliance/activity", get(list_activity))
        .route("/admin/compliance/requests", post(create_request))
        .route("/admin/compliance/requests/:id", get(get_request))
        .route("/admin/compliance/requests/:id/complete", post(complete_request))
        .route("/admin/compliance/requests/:id/export", get(download_export))
        .route("/admin/compliance/chats", get(list_chats).delete(delete_chat))
        .route("/admin/compliance/projects", get(list_projects).delete(delete_project))
        .route("/admin/compliance/artifacts", get(list_artifacts).delete(delete_artifact))
        .route("/admin/compliance/retention-policy", get(get_retention_policy).post(set_retention_policy))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "compliance operation failed");
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
            "Only organization owners/admins can access compliance endpoints.",
        ));
    }
    Ok(org.to_string())
}

// ─── Activity / Requests ────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateRequest {
    kind: String,
    #[serde(default)]
    app_filters: Vec<String>,
}

fn valid_kind(kind: &str) -> bool {
    matches!(kind, "export" | "delete")
}

fn valid_app(app: &str) -> bool {
    matches!(app, "chats" | "projects" | "artifacts")
}

fn request_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "kind": row.get::<_, String>(1)?,
        "status": row.get::<_, String>(2)?,
        "requested_by": row.get::<_, String>(3)?,
        "created_at": row.get::<_, String>(4)?,
        "updated_at": row.get::<_, String>(5)?,
    }))
}

async fn list_activity(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn.prepare(
            "SELECT id, kind, status, requested_by, created_at, updated_at FROM compliance_requests WHERE organization_id = ?1 ORDER BY created_at DESC"
        ).map_err(internal)?;
        let rows = stmt
            .query_map([org], request_json)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(json!({"requests": rows}))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn create_request(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateRequest>,
) -> Response {
    if !valid_kind(&body.kind) {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_kind",
            "kind must be one of export, delete.",
        )
        .into_response();
    }
    let apps: Vec<String> = body
        .app_filters
        .into_iter()
        .filter(|a| valid_app(a))
        .collect();
    let apps = if apps.is_empty() {
        vec!["chats".into(), "projects".into(), "artifacts".into()]
    } else {
        apps
    };
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let tx = conn.transaction().map_err(internal)?;
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO compliance_requests (id, organization_id, kind, requested_by) VALUES (?1, ?2, ?3, ?4)",
            params![id, org, body.kind, user.user_id],
        ).map_err(internal)?;

        // Scaffold: enumerate org-visible records as pending references.
        for app in apps {
            let record_ids = match app.as_str() {
                "chats" => org_record_ids(&tx, &org, "chats")?,
                "projects" => org_record_ids(&tx, &org, "projects")?,
                "artifacts" => org_record_ids(&tx, &org, "artifacts")?,
                _ => vec![],
            };
            for record_id in record_ids {
                tx.execute(
                    "INSERT INTO compliance_content_references (id, request_id, app, record_id) VALUES (?1, ?2, ?3, ?4)",
                    params![uuid::Uuid::new_v4().to_string(), id, app, record_id],
                ).map_err(internal)?;
            }
        }

        tx.execute(
            "UPDATE compliance_requests SET status = 'running' WHERE id = ?1",
            params![id],
        ).map_err(internal)?;
        tx.commit().map_err(internal)?;
        conn.query_row(
            "SELECT id, kind, status, requested_by, created_at, updated_at FROM compliance_requests WHERE id = ?1",
            params![id],
            request_json,
        )
        .map_err(internal)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

fn org_record_ids(
    conn: &rusqlite::Transaction,
    org: &str,
    app: &str,
) -> Result<Vec<String>, ApiError> {
    let sql = match app {
        "chats" => "SELECT c.id FROM conversations c
                    JOIN users u ON u.id = c.user_id
                    JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1",
        "projects" => "SELECT p.id FROM cowork_projects p
                       JOIN users u ON u.id = p.owner_id
                       JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1",
        "artifacts" => "SELECT a.id FROM artifacts a
                        JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
                        JOIN organization_members om ON om.user_id = wm.user_id AND om.organization_id = ?1",
        _ => return Ok(vec![]),
    };
    let mut stmt = conn.prepare(sql).map_err(internal)?;
    let ids = stmt
        .query_map([org], |row| row.get::<_, String>(0))
        .map_err(internal)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(internal)?;
    Ok(ids)
}

async fn get_request(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let request = conn
            .query_row(
                "SELECT id, kind, status, requested_by, created_at, updated_at FROM compliance_requests WHERE id = ?1 AND organization_id = ?2",
                params![id, org],
                request_json,
            )
            .optional()
            .map_err(internal)?
            .ok_or_else(|| error(StatusCode::NOT_FOUND, "request_not_found", "No such compliance request."))?;
        let mut stmt = conn.prepare(
            "SELECT id, app, record_id, status, processed_at, created_at FROM compliance_content_references WHERE request_id = ?1 ORDER BY app, created_at"
        ).map_err(internal)?;
        let refs = stmt
            .query_map([id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "app": row.get::<_, String>(1)?,
                    "record_id": row.get::<_, String>(2)?,
                    "status": row.get::<_, String>(3)?,
                    "processed_at": row.get::<_, Option<String>>(4)?,
                    "created_at": row.get::<_, String>(5)?,
                }))
            })
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(json!({"request": request, "references": refs}))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ─── Per-app data ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct DeleteQuery {
    id: String,
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(default)]
    limit: Option<usize>,
    #[serde(default)]
    offset: Option<usize>,
}

async fn list_chats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Response {
    list_app_records(state, user, "chats", query).await
}

async fn list_projects(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Response {
    list_app_records(state, user, "projects", query).await
}

async fn list_artifacts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Response {
    list_app_records(state, user, "artifacts", query).await
}

async fn list_app_records(
    state: Arc<AppState>,
    user: AuthUser,
    app: &'static str,
    query: ListQuery,
) -> Response {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let (sql, count_sql) = match app {
            "chats" => (
                "SELECT c.id, c.title, c.user_id, c.created_at FROM conversations c
                 JOIN users u ON u.id = c.user_id
                 JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1
                 ORDER BY c.created_at DESC LIMIT ?2 OFFSET ?3",
                "SELECT COUNT(*) FROM conversations c
                 JOIN users u ON u.id = c.user_id
                 JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1",
            ),
            "projects" => (
                "SELECT p.id, p.name, p.owner_id, p.created_at FROM cowork_projects p
                 JOIN users u ON u.id = p.owner_id
                 JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1
                 ORDER BY p.created_at DESC LIMIT ?2 OFFSET ?3",
                "SELECT COUNT(*) FROM cowork_projects p
                 JOIN users u ON u.id = p.owner_id
                 JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1",
            ),
            "artifacts" => (
                "SELECT a.id, a.title, a.user_id, a.created_at FROM artifacts a
                 JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
                 JOIN organization_members om ON om.user_id = wm.user_id AND om.organization_id = ?1
                 ORDER BY a.created_at DESC LIMIT ?2 OFFSET ?3",
                "SELECT COUNT(*) FROM artifacts a
                 JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
                 JOIN organization_members om ON om.user_id = wm.user_id AND om.organization_id = ?1",
            ),
            _ => return Err(error(StatusCode::BAD_REQUEST, "invalid_app", "Unknown app.")),
        };
        let mut stmt = conn.prepare(sql).map_err(internal)?;
        let rows = stmt
            .query_map(params![org, limit, offset], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, Option<String>>(1)?,
                    "owner_id": row.get::<_, String>(2)?,
                    "created_at": row.get::<_, String>(3)?,
                }))
            })
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        let total: i64 = conn.query_row(count_sql, params![org], |row| row.get(0)).map_err(internal)?;
        Ok(json!({ "app": app, "records": rows, "total": total, "limit": limit, "offset": offset }))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_chat(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<DeleteQuery>,
) -> Response {
    delete_app_record(state, user, "chats", query.id).await
}

async fn delete_project(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<DeleteQuery>,
) -> Response {
    delete_app_record(state, user, "projects", query.id).await
}

async fn delete_artifact(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<DeleteQuery>,
) -> Response {
    delete_app_record(state, user, "artifacts", query.id).await
}

async fn delete_app_record(
    state: Arc<AppState>,
    user: AuthUser,
    app: &'static str,
    id: String,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<(), ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let guard_sql = match app {
            "chats" => "SELECT 1 FROM conversations c
                        JOIN users u ON u.id = c.user_id
                        JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1
                        WHERE c.id = ?2",
            "projects" => "SELECT 1 FROM cowork_projects p
                           JOIN users u ON u.id = p.owner_id
                           JOIN organization_members om ON om.user_id = u.id AND om.organization_id = ?1
                           WHERE p.id = ?2",
            "artifacts" => "SELECT 1 FROM artifacts a
                            JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
                            JOIN organization_members om ON om.user_id = wm.user_id AND om.organization_id = ?1
                            WHERE a.id = ?2",
            _ => return Err(error(StatusCode::BAD_REQUEST, "invalid_app", "Unknown app.")),
        };
        let exists: bool = conn
            .query_row(guard_sql, params![org, id], |_| Ok(true))
            .optional()
            .map_err(internal)?
            .unwrap_or(false);
        if !exists {
            return Err(error(StatusCode::NOT_FOUND, "record_not_found", "No such record in this organization."));
        }
        match app {
            "chats" => {
                conn.execute("DELETE FROM conversation_messages WHERE conversation_id = ?1", params![id]).map_err(internal)?;
                conn.execute("DELETE FROM replies WHERE conversation_id = ?1", params![id]).map_err(internal)?;
                conn.execute("DELETE FROM conversations WHERE id = ?1", params![id]).map_err(internal)?;
            }
            "projects" => {
                conn.execute("DELETE FROM cowork_project_files WHERE project_id = ?1", params![id]).map_err(internal)?;
                conn.execute("DELETE FROM cowork_projects WHERE id = ?1", params![id]).map_err(internal)?;
            }
            "artifacts" => {
                conn.execute("DELETE FROM artifact_sections WHERE artifact_id = ?1", params![id]).map_err(internal)?;
                conn.execute("DELETE FROM artifact_revisions WHERE artifact_id = ?1", params![id]).map_err(internal)?;
                conn.execute("DELETE FROM artifacts WHERE id = ?1", params![id]).map_err(internal)?;
            }
            _ => unreachable!(),
        }
        Ok(())
    }).await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ─── Request lifecycle ──────────────────────────────────────────────────────

async fn complete_request(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let tx = conn.transaction().map_err(internal)?;
        let changed = tx.execute(
            "UPDATE compliance_requests SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND organization_id = ?2 AND status IN ('pending', 'running')",
            params![id, org],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(StatusCode::NOT_FOUND, "request_not_found", "No such pending or running compliance request."));
        }
        tx.execute(
            "UPDATE compliance_content_references SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE request_id = ?1 AND status = 'pending'",
            params![id],
        ).map_err(internal)?;
        tx.commit().map_err(internal)?;
        conn.query_row(
            "SELECT id, kind, status, requested_by, created_at, updated_at FROM compliance_requests WHERE id = ?1",
            params![id],
            request_json,
        )
        .map_err(internal)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn download_export(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let request = conn
            .query_row(
                "SELECT id, kind, status, requested_by, created_at, updated_at FROM compliance_requests WHERE id = ?1 AND organization_id = ?2 AND kind = 'export'",
                params![id, org],
                request_json,
            )
            .optional()
            .map_err(internal)?
            .ok_or_else(|| error(StatusCode::NOT_FOUND, "export_not_found", "No such export request."))?;
        let mut stmt = conn.prepare(
            "SELECT app, record_id, status, processed_at FROM compliance_content_references WHERE request_id = ?1 ORDER BY app, created_at"
        ).map_err(internal)?;
        let refs = stmt
            .query_map(params![id], |row| {
                Ok(json!({
                    "app": row.get::<_, String>(0)?,
                    "record_id": row.get::<_, String>(1)?,
                    "status": row.get::<_, String>(2)?,
                    "processed_at": row.get::<_, Option<String>>(3)?,
                }))
            })
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(json!({
            "request": request,
            "export": {
                "format": "json",
                "references": refs,
            },
        }))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ─── Retention & zero data residence ────────────────────────────────────────

#[derive(Deserialize)]
struct SetRetentionPolicy {
    chat_retention_days: Option<i64>,
    project_retention_days: Option<i64>,
    artifact_retention_days: Option<i64>,
    #[serde(default)]
    zero_data_residence: bool,
    #[serde(default)]
    zdr_regions: Vec<String>,
}

fn retention_policy_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let zdr_raw: String = row.get(4)?;
    let zdr_regions: Vec<String> = serde_json::from_str(&zdr_raw).unwrap_or_default();
    Ok(json!({
        "org_id": row.get::<_, String>(0)?,
        "chat_retention_days": row.get::<_, Option<i64>>(1)?,
        "project_retention_days": row.get::<_, Option<i64>>(2)?,
        "artifact_retention_days": row.get::<_, Option<i64>>(3)?,
        "zero_data_residence": row.get::<_, i64>(5)? != 0,
        "zdr_regions": zdr_regions,
        "created_at": row.get::<_, String>(6)?,
        "updated_at": row.get::<_, String>(7)?,
    }))
}

async fn get_retention_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let policy = conn
            .query_row(
                "SELECT org_id, chat_retention_days, project_retention_days, artifact_retention_days, zdr_regions, zero_data_residence, created_at, updated_at FROM retention_policies WHERE org_id = ?1",
                [&org],
                retention_policy_json,
            )
            .optional()
            .map_err(internal)?
            .unwrap_or_else(|| {
                json!({
                    "org_id": org,
                    "chat_retention_days": serde_json::Value::Null,
                    "project_retention_days": serde_json::Value::Null,
                    "artifact_retention_days": serde_json::Value::Null,
                    "zero_data_residence": false,
                    "zdr_regions": Vec::<String>::new(),
                    "created_at": serde_json::Value::Null,
                    "updated_at": serde_json::Value::Null,
                })
            });
        Ok(policy)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn set_retention_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<SetRetentionPolicy>,
) -> Response {
    if body.chat_retention_days.map(|d| d < 0).unwrap_or(false)
        || body.project_retention_days.map(|d| d < 0).unwrap_or(false)
        || body.artifact_retention_days.map(|d| d < 0).unwrap_or(false)
    {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_retention_days",
            "Retention days must be non-negative.",
        )
        .into_response();
    }
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let zdr_json = serde_json::to_string(&body.zdr_regions).unwrap_or_else(|_| "[]".into());
        let zdr = if body.zero_data_residence { 1 } else { 0 };
        conn.execute(
            "INSERT INTO retention_policies (org_id, chat_retention_days, project_retention_days, artifact_retention_days, zdr_regions, zero_data_residence)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(org_id) DO UPDATE SET
                 chat_retention_days = excluded.chat_retention_days,
                 project_retention_days = excluded.project_retention_days,
                 artifact_retention_days = excluded.artifact_retention_days,
                 zdr_regions = excluded.zdr_regions,
                 zero_data_residence = excluded.zero_data_residence,
                 updated_at = CURRENT_TIMESTAMP",
            params![org, body.chat_retention_days, body.project_retention_days, body.artifact_retention_days, zdr_json, zdr],
        ).map_err(internal)?;
        conn.query_row(
            "SELECT org_id, chat_retention_days, project_retention_days, artifact_retention_days, zdr_regions, zero_data_residence, created_at, updated_at FROM retention_policies WHERE org_id = ?1",
            [&org],
            retention_policy_json,
        )
        .map_err(internal)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    #[test]
    fn kind_and_app_validation() {
        assert!(valid_kind("export"));
        assert!(valid_kind("delete"));
        assert!(!valid_kind("purge"));
        assert!(valid_app("chats"));
        assert!(valid_app("projects"));
        assert!(valid_app("artifacts"));
        assert!(!valid_app("users"));
    }

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-compliance-test-{}.db", id));
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
    fn compliance_request_roundtrip() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");

        let req_id = "req-1";
        conn.execute(
            "INSERT INTO compliance_requests (id, organization_id, kind, status, requested_by) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![req_id, "org-1", "export", "pending", "admin-1"],
        ).unwrap();

        let req = conn.query_row(
            "SELECT id, kind, status, requested_by, created_at, updated_at FROM compliance_requests WHERE id = ?1",
            rusqlite::params![req_id],
            request_json,
        ).unwrap();
        assert_eq!(req["kind"], "export");
        assert_eq!(req["status"], "pending");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn retention_policy_roundtrip() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");

        conn.execute(
            "INSERT INTO retention_policies (org_id, chat_retention_days, project_retention_days, artifact_retention_days, zdr_regions, zero_data_residence)
             VALUES ('org-1', 30, 60, 90, '[]', 0)",
            [],
        ).unwrap();

        let policy = conn
            .query_row(
                "SELECT org_id, chat_retention_days, project_retention_days, artifact_retention_days, zdr_regions, zero_data_residence, created_at, updated_at FROM retention_policies WHERE org_id = ?1",
                rusqlite::params!["org-1"],
                retention_policy_json,
            )
            .unwrap();
        assert_eq!(policy["chat_retention_days"], 30);
        assert_eq!(policy["artifact_retention_days"], 90);
        assert_eq!(policy["zero_data_residence"], false);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn completing_request_updates_references() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");

        conn.execute(
            "INSERT INTO compliance_requests (id, organization_id, kind, status, requested_by) VALUES ('req-1', 'org-1', 'export', 'running', 'admin-1')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO compliance_content_references (id, request_id, app, record_id, status) VALUES ('ref-1', 'req-1', 'chats', 'chat-1', 'pending')",
            [],
        ).unwrap();

        conn.execute(
            "UPDATE compliance_requests SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = 'req-1' AND organization_id = 'org-1' AND status IN ('pending', 'running')",
            [],
        ).unwrap();
        conn.execute(
            "UPDATE compliance_content_references SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE request_id = 'req-1' AND status = 'pending'",
            [],
        ).unwrap();

        let status: String = conn
            .query_row(
                "SELECT status FROM compliance_requests WHERE id = 'req-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "completed");

        let ref_status: String = conn
            .query_row(
                "SELECT status FROM compliance_content_references WHERE id = 'ref-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(ref_status, "processed");

        let _ = std::fs::remove_file(&path);
    }
}
