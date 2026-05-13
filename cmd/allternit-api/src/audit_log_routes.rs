
//! Task Audit Log API routes

use axum::extract::Extension;
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

pub fn audit_log_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/audit-log", get(audit_log_status))
        .route("/audit-logs", get(list_audit_logs).post(create_audit_log))
}

async fn audit_log_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "audit-log",
    }))
}

#[derive(Deserialize)]
struct ListAuditLogsQuery {
    task_id: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
}

async fn list_audit_logs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(query): Query<ListAuditLogsQuery>,
) -> impl axum::response::IntoResponse {

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = (page - 1) * limit;

    let db = state.db.clone();
    let task_id = query.task_id;
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        
        if let Some(ref tid) = task_id {
            // Verify user has access to the task (via task ownership or workspace membership)
            let task_owner: Option<String> = conn.query_row(
                "SELECT user_id FROM tasks WHERE id = ?1 LIMIT 1",
                params![tid],
                |row| row.get(0),
            ).ok();
            
            if let Some(owner) = task_owner {
                if owner != user_id {
                    // Check workspace membership
                    let has_access: bool = conn.query_row(
                        "SELECT 1 FROM workspace_members wm 
                         JOIN tasks t ON t.workspace_id = wm.workspace_id 
                         WHERE t.id = ?1 AND wm.user_id = ?2 LIMIT 1",
                        params![tid, user_id],
                        |_| Ok(true),
                    ).unwrap_or(false);
                    if !has_access {
                        return Err(rusqlite::Error::QueryReturnedNoRows);
                    }
                }
            }
        }

        let (rows, total) = if let Some(ref tid) = task_id {
            let mut stmt = conn.prepare(
                "SELECT id, task_id, action, actor_type, actor_id, payload, created_at
                 FROM task_audit_logs WHERE task_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
            )?;
            let rows = stmt.query_map(params![tid, limit, offset], |row| {
                Ok(AuditLogRow {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    action: row.get(2)?,
                    actor_type: row.get(3)?,
                    actor_id: row.get(4)?,
                    payload: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

            let total: i64 = conn.query_row(
                "SELECT COUNT(*) FROM task_audit_logs WHERE task_id = ?1",
                params![tid],
                |row| row.get(0),
            )?;
            (rows, total)
        } else {
            // No task_id filter — return all audit logs for tasks the user can access
            let mut stmt = conn.prepare(
                "SELECT id, task_id, action, actor_type, actor_id, payload, created_at
                 FROM task_audit_logs
                 WHERE task_id IN (
                     SELECT id FROM tasks WHERE user_id = ?1
                     UNION
                     SELECT t.id FROM tasks t
                     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
                     WHERE wm.user_id = ?1
                 )
                 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
            )?;
            let rows = stmt.query_map(params![user_id, limit, offset], |row| {
                Ok(AuditLogRow {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    action: row.get(2)?,
                    actor_type: row.get(3)?,
                    actor_id: row.get(4)?,
                    payload: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

            let total: i64 = conn.query_row(
                "SELECT COUNT(*) FROM task_audit_logs
                 WHERE task_id IN (
                     SELECT id FROM tasks WHERE user_id = ?1
                     UNION
                     SELECT t.id FROM tasks t
                     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
                     WHERE wm.user_id = ?1
                 )",
                params![user_id],
                |row| row.get(0),
            )?;
            (rows, total)
        };

        Ok::<_, rusqlite::Error>((rows, total))
    }).await;

    match result {
        Ok(Ok((logs, total))) => {
            let pages = ((total as f64) / (limit as f64)).ceil() as i64;
            (StatusCode::OK, Json(json!({
                "logs": logs,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": pages,
                }
            })))
        }
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"})))
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))),
    }
}

#[derive(Deserialize)]
struct CreateAuditLog {
    #[serde(alias = "taskId")]
    task_id: String,
    action: String,
    actor_type: Option<String>,
    actor_id: Option<String>,
    payload: Option<serde_json::Value>,
}

async fn create_audit_log(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateAuditLog>,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let payload_str = body.payload.map(|p| p.to_string());
        conn.execute(
            "INSERT INTO task_audit_logs (id, task_id, action, actor_type, actor_id, payload)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id2,
                body.task_id,
                body.action,
                body.actor_type.unwrap_or_else(|| "user".to_string()),
                body.actor_id.unwrap_or_else(|| user_id),
                payload_str,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "id": id }))),
        Ok(Err(e)) => {
            warn!("DB error creating audit log: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

#[derive(Serialize)]
struct AuditLogRow {
    id: String,
    task_id: String,
    action: String,
    actor_type: String,
    actor_id: String,
    payload: Option<String>,
    created_at: String,
}
