//! Capacity-driven provision queue for bot desktops.
//!
//! When the fleet is at capacity, new provision requests are stored in
//! `desktop_provision_queue` instead of failing. A background worker drains
//! the queue as capacity frees up, and callers can poll the queue status
//! endpoint to discover when their desktop is ready.

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::bot_desktop_capacity::CAPACITY_MONITOR;
use crate::bot_desktop_quotas::check_quota;
use crate::bot_desktop_routes::{
    provision_desktop_internal, verify_bot_ownership, ProvisionDesktopQuery,
};
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/bots/:bot_id/desktop/queue",
        get(get_queue_status).delete(cancel_pending_queue_item),
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueEntry {
    pub id: String,
    pub bot_id: String,
    pub user_id: String,
    pub org_id: Option<String>,
    pub status: String,
    pub os: Option<String>,
    pub template_id: Option<String>,
    pub sandbox_id: Option<String>,
    pub provider: Option<String>,
    pub host: Option<String>,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct QueueStatusResponse {
    pub queued: bool,
    pub entry: Option<QueueEntry>,
    pub position: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct EnqueueResponse {
    pub queue_id: String,
    pub status: String,
    pub position: i64,
}

/// True when the capacity monitor has observed the fleet and reports no room.
pub async fn is_fleet_at_capacity() -> bool {
    match CAPACITY_MONITOR.get() {
        Some(m) => m.is_at_capacity().await,
        None => false,
    }
}

/// Insert a provision request into the queue. Returns the queue entry and its
/// position among pending items. Fails immediately if the caller is already
/// over quota.
pub async fn enqueue(
    state: &Arc<AppState>,
    user: &AuthUser,
    bot_id: &str,
    query: &ProvisionDesktopQuery,
) -> Result<(QueueEntry, i64), String> {
    match check_quota(state, user).await {
        Ok(check) if !check.allowed => {
            return Err(check.reason.unwrap_or_else(|| "quota exceeded".to_string()));
        }
        Err(e) => {
            return Err(format!("quota check failed: {}", e));
        }
        _ => {}
    }

    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let org_id = user.organization_id.clone();
    let bot_id = bot_id.to_string();
    let os = query.os.clone();
    let template_id = query.template_id.clone();
    let id = format!("dpq-{}", uuid::Uuid::new_v4().simple());

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // One pending request per bot to avoid duplicate work.
        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM desktop_provision_queue WHERE bot_id = ?1 AND status = 'pending' LIMIT 1",
                rusqlite::params![&bot_id],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(existing) = existing {
            return Ok::<_, rusqlite::Error>(existing);
        }

        conn.execute(
            "INSERT INTO desktop_provision_queue \
             (id, user_id, org_id, bot_id, os, template_id, status) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')",
            rusqlite::params![&id, &user_id, &org_id, &bot_id, &os, &template_id],
        )?;
        Ok(id)
    })
    .await;

    let id = match result {
        Ok(Ok(id)) => id,
        Ok(Err(e)) => return Err(format!("database error: {}", e)),
        Err(e) => return Err(format!("task panicked: {}", e)),
    };

    let entry = match get_entry(state, &id).await {
        Some(e) => e,
        None => return Err("failed to read queued entry".to_string()),
    };
    let position = pending_position(state, &id).await.unwrap_or(1);
    Ok((entry, position))
}

/// Fetch the oldest pending queue entry, if any.
pub async fn next_pending(state: &Arc<AppState>) -> Option<QueueEntry> {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, org_id, bot_id, os, template_id, status, \
             sandbox_id, provider, host, error, created_at, updated_at \
             FROM desktop_provision_queue \
             WHERE status = 'pending' \
             ORDER BY created_at ASC LIMIT 1",
        )?;
        let row = stmt.query_row([], row_to_entry).optional()?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match result {
        Ok(Ok(entry)) => entry,
        Ok(Err(e)) => {
            warn!(error = %e, "failed to read next pending queue entry");
            None
        }
        Err(e) => {
            warn!(error = %e, "task panicked reading next pending queue entry");
            None
        }
    }
}

/// Mark a queue entry as completed after a successful provision.
pub async fn mark_completed(
    state: &Arc<AppState>,
    id: &str,
    sandbox_id: &str,
    provider: &str,
    host: Option<&str>,
) {
    let db = state.db.clone();
    let id = id.to_string();
    let sandbox_id = sandbox_id.to_string();
    let provider = provider.to_string();
    let host = host.map(|s| s.to_string());
    let _ = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE desktop_provision_queue \
             SET status = 'completed', sandbox_id = ?1, provider = ?2, host = ?3, updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?4",
            rusqlite::params![&sandbox_id, &provider, &host, &id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;
}

/// Mark a queue entry as failed.
pub async fn mark_failed(state: &Arc<AppState>, id: &str, error: &str) {
    let db = state.db.clone();
    let id = id.to_string();
    let error = error.to_string();
    let _ = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE desktop_provision_queue \
             SET status = 'failed', error = ?1, updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?2",
            rusqlite::params![&error, &id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;
}

async fn get_entry(state: &Arc<AppState>, id: &str) -> Option<QueueEntry> {
    let db = state.db.clone();
    let id = id.to_string();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, org_id, bot_id, os, template_id, status, \
             sandbox_id, provider, host, error, created_at, updated_at \
             FROM desktop_provision_queue WHERE id = ?1",
        )?;
        let row = stmt.query_row(rusqlite::params![&id], row_to_entry).optional()?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match result {
        Ok(Ok(entry)) => entry,
        _ => None,
    }
}

async fn pending_position(state: &Arc<AppState>, id: &str) -> Option<i64> {
    let db = state.db.clone();
    let id = id.to_string();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let pos: i64 = conn.query_row(
            "SELECT COUNT(*) FROM desktop_provision_queue \
             WHERE status = 'pending' AND created_at <= (SELECT created_at FROM desktop_provision_queue WHERE id = ?1)",
            rusqlite::params![&id],
            |row| row.get(0),
        )?;
        Ok::<_, rusqlite::Error>(pos)
    })
    .await;

    match result {
        Ok(Ok(pos)) => Some(pos),
        _ => None,
    }
}

async fn get_queue_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let db = state.db.clone();
    let bot_id2 = bot_id.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, org_id, bot_id, os, template_id, status, \
             sandbox_id, provider, host, error, created_at, updated_at \
             FROM desktop_provision_queue \
             WHERE bot_id = ?1 AND status IN ('pending', 'completed', 'failed') \
             ORDER BY created_at DESC LIMIT 1",
        )?;
        let row = stmt.query_row(rusqlite::params![&bot_id2], row_to_entry).optional()?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match result {
        Ok(Ok(Some(entry))) => {
            let position = if entry.status == "pending" {
                pending_position(&state, &entry.id).await
            } else {
                None
            };
            (
                StatusCode::OK,
                Json(json!(QueueStatusResponse {
                    queued: entry.status == "pending",
                    entry: Some(entry),
                    position,
                })),
            )
                .into_response()
        }
        Ok(Ok(None)) => (
            StatusCode::OK,
            Json(json!(QueueStatusResponse {
                queued: false,
                entry: None,
                position: None,
            })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!(bot_id, error = %e, "failed to read queue status");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "database error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(bot_id, error = %e, "task panicked reading queue status");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn cancel_pending_queue_item(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let db = state.db.clone();
    let bot_id2 = bot_id.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let changed = conn.execute(
            "UPDATE desktop_provision_queue \
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP \
             WHERE bot_id = ?1 AND status = 'pending'",
            rusqlite::params![&bot_id2],
        )?;
        Ok::<_, rusqlite::Error>(changed)
    })
    .await;

    match result {
        Ok(Ok(0)) => (StatusCode::NOT_FOUND, Json(json!({"cancelled": false}))).into_response(),
        Ok(Ok(_)) => (StatusCode::OK, Json(json!({"cancelled": true}))).into_response(),
        Ok(Err(e)) => {
            warn!(bot_id, error = %e, "failed to cancel queue item");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "database error"})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(bot_id, error = %e, "task panicked cancelling queue item");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

fn row_to_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<QueueEntry> {
    Ok(QueueEntry {
        id: row.get(0)?,
        user_id: row.get(1)?,
        org_id: row.get(2)?,
        bot_id: row.get(3)?,
        os: row.get(4)?,
        template_id: row.get(5)?,
        status: row.get(6)?,
        sandbox_id: row.get(7)?,
        provider: row.get(8)?,
        host: row.get(9)?,
        error: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

/// Spawn the background worker that drains the provision queue when capacity
/// becomes available.
pub fn spawn_provision_queue_worker(state: Arc<AppState>, period: Duration) {
    tokio::spawn(async move {
        let mut ticker = interval(period);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            ticker.tick().await;
            let monitor: Arc<crate::bot_desktop_capacity::CapacityMonitor> = match CAPACITY_MONITOR.get() {
                Some(m) => m.clone(),
                None => continue,
            };
            let mut slots = monitor.available_slots().await.max(0i64) as usize;
            while slots > 0 {
                let entry = match next_pending(&state).await {
                    Some(e) => e,
                    None => break,
                };
                slots = slots.saturating_sub(1);
                let user = AuthUser {
                    user_id: entry.user_id.clone(),
                    email: None,
                    name: None,
                    avatar_url: None,
                    tenant_id: None,
                    organization_id: entry.org_id.clone(),
                    organization_role: None,
                    organization_slug: None,
                };
                let query = ProvisionDesktopQuery {
                    os: entry.os.clone(),
                    template_id: entry.template_id.clone(),
                };
                match provision_desktop_internal(&state, &user, &entry.bot_id, &query).await {
                    Ok(resp) => {
                        mark_completed(
                            &state,
                            &entry.id,
                            &resp.sandbox_id,
                            &resp.provider,
                            resp.host.as_deref(),
                        )
                        .await;
                        info!(
                            queue_id = %entry.id,
                            bot_id = %entry.bot_id,
                            sandbox_id = %resp.sandbox_id,
                            "provision queue item completed"
                        );
                    }
                    Err(resp) => {
                        let body_bytes = axum::body::to_bytes(resp.into_body(), 4096)
                            .await
                            .unwrap_or_default();
                        let msg = String::from_utf8_lossy(&body_bytes).to_string();
                        warn!(
                            queue_id = %entry.id,
                            bot_id = %entry.bot_id,
                            error = %msg,
                            "provision queue item failed"
                        );
                        mark_failed(&state, &entry.id, &msg).await;
                    }
                }
            }
        }
    });
}
