//! Unified computer API.
//!
//! This router exposes a single `/api/v1/computers` surface that abstracts
//! local, BYO-VPS, managed, BYOC, and cloud-desktop compute resources.  Phase 1
//! proxies cloud-desktop requests to the existing bot-desktop backend and reads
//! from the existing hosted-runtime tables; later phases add the remaining
//! substrates.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::AppState;

// ---------------------------------------------------------------------------
// Domain types.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ComputerKind {
    Local,
    ByoVps,
    Managed,
    Byoc,
    CloudDesktop,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ComputerStatus {
    Creating,
    Running,
    Stopped,
    Error,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputerResponse {
    pub id: String,
    pub kind: ComputerKind,
    pub provider: String,
    pub status: ComputerStatus,
    pub owner_type: String,
    pub owner_id: String,
    pub bot_id: Option<String>,
    pub session_id: Option<String>,
    pub name: String,
    pub os: Option<String>,
    pub cpu_cores: Option<i64>,
    pub memory_mb: Option<i64>,
    pub disk_mb: Option<i64>,
    pub region: Option<String>,
    pub host: Option<String>,
    pub native_id: Option<String>,
    pub template_id: Option<String>,
    pub billing_source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateComputerRequest {
    pub kind: ComputerKind,
    pub bot_id: Option<String>,
    pub name: Option<String>,
    pub os: Option<String>,
    pub template_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListComputersQuery {
    pub bot_id: Option<String>,
    pub kind: Option<ComputerKind>,
}

#[derive(Debug, Serialize)]
pub struct ComputersListResponse {
    pub computers: Vec<ComputerResponse>,
}

// ---------------------------------------------------------------------------
// Router.
// ---------------------------------------------------------------------------

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/computers", get(list_computers).post(create_computer))
        .route("/computers/:id", get(get_computer))
        .route("/computers/:id/start", post(start_computer))
        .route("/computers/:id/stop", post(stop_computer))
        .route("/computers/:id/delete", post(delete_computer))
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

fn status_from_str(s: &str) -> ComputerStatus {
    match s {
        "running" => ComputerStatus::Running,
        "stopped" => ComputerStatus::Stopped,
        "creating" => ComputerStatus::Creating,
        "error" => ComputerStatus::Error,
        _ => ComputerStatus::Error,
    }
}

fn kind_to_str(k: &ComputerKind) -> &'static str {
    match k {
        ComputerKind::Local => "local",
        ComputerKind::ByoVps => "byo_vps",
        ComputerKind::Managed => "managed",
        ComputerKind::Byoc => "byoc",
        ComputerKind::CloudDesktop => "cloud_desktop",
    }
}

fn error_response(status: StatusCode, message: impl Into<String>) -> Response {
    (status, Json(json!({ "error": message.into() }))).into_response()
}

fn require_driver(state: &AppState) -> Result<Arc<dyn allternit_driver_interface::ExecutionDriver>, Response> {
    match state.vm_driver.as_ref() {
        Some(d) => Ok(d.clone()),
        None => Err(error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "No VM driver is configured on this host",
        )),
    }
}

// ---------------------------------------------------------------------------
// Handlers.
// ---------------------------------------------------------------------------

async fn list_computers(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListComputersQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let bot_id_filter = query.bot_id.clone();
    let kind_filter = query.kind.map(|k| kind_to_str(&k).to_string());

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql = String::from(
            "SELECT c.id, c.kind, c.provider, c.status, c.owner_type, c.owner_id, \
             c.bot_id, c.session_id, c.name, c.os, c.cpu_cores, c.memory_mb, c.disk_mb, \
             c.region, c.host, c.native_id, c.template_id, c.billing_source, \
             c.created_at, c.updated_at \
             FROM computers c \
             WHERE c.owner_id = ?1 AND c.status != 'deleted'"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user_id)];
        if let Some(bot_id) = bot_id_filter {
            sql.push_str(&format!(" AND c.bot_id = ?{}", params.len() + 1));
            params.push(Box::new(bot_id));
        }
        if let Some(kind) = kind_filter {
            sql.push_str(&format!(" AND c.kind = ?{}", params.len() + 1));
            params.push(Box::new(kind));
        }
        sql.push_str(" ORDER BY c.updated_at DESC, c.created_at DESC");

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(rusqlite::params_from_iter(param_refs), |row| {
            Ok(ComputerResponse {
                id: row.get(0)?,
                kind: match row.get::<_, String>(1)?.as_str() {
                    "cloud_desktop" => ComputerKind::CloudDesktop,
                    "managed" => ComputerKind::Managed,
                    "byo_vps" => ComputerKind::ByoVps,
                    "byoc" => ComputerKind::Byoc,
                    _ => ComputerKind::Local,
                },
                provider: row.get(2)?,
                status: status_from_str(&row.get::<_, String>(3)?),
                owner_type: row.get(4)?,
                owner_id: row.get(5)?,
                bot_id: row.get(6)?,
                session_id: row.get(7)?,
                name: row.get(8)?,
                os: row.get(9)?,
                cpu_cores: row.get(10)?,
                memory_mb: row.get(11)?,
                disk_mb: row.get(12)?,
                region: row.get(13)?,
                host: row.get(14)?,
                native_id: row.get(15)?,
                template_id: row.get(16)?,
                billing_source: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
            })
        })?;

        let mut computers = Vec::new();
        for row in rows {
            computers.push(row?);
        }
        Ok::<_, rusqlite::Error>(computers)
    })
    .await;

    match result {
        Ok(Ok(computers)) => (StatusCode::OK, Json(ComputersListResponse { computers })).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to list computers");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("database error: {}", e))
        }
        Err(e) => {
            warn!(error = %e, "task panicked listing computers");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "internal error")
        }
    }
}

async fn get_computer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(computer)) => (StatusCode::OK, Json(computer)).into_response(),
        Ok(None) => error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => resp,
    }
}

async fn fetch_computer(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
) -> Result<Option<ComputerResponse>, Response> {
    let db = state.db.clone();
    let user_id = user_id.to_string();
    let id_owned = id.to_string();
    let id_for_error = id.to_string();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT c.id, c.kind, c.provider, c.status, c.owner_type, c.owner_id, \
             c.bot_id, c.session_id, c.name, c.os, c.cpu_cores, c.memory_mb, c.disk_mb, \
             c.region, c.host, c.native_id, c.template_id, c.billing_source, \
             c.created_at, c.updated_at \
             FROM computers c \
             WHERE c.id = ?1 AND c.owner_id = ?2 AND c.status != 'deleted'"
        )?;
        let row = stmt.query_row(rusqlite::params![id_owned, user_id], |row| {
            Ok(ComputerResponse {
                id: row.get(0)?,
                kind: match row.get::<_, String>(1)?.as_str() {
                    "cloud_desktop" => ComputerKind::CloudDesktop,
                    "managed" => ComputerKind::Managed,
                    "byo_vps" => ComputerKind::ByoVps,
                    "byoc" => ComputerKind::Byoc,
                    _ => ComputerKind::Local,
                },
                provider: row.get(2)?,
                status: status_from_str(&row.get::<_, String>(3)?),
                owner_type: row.get(4)?,
                owner_id: row.get(5)?,
                bot_id: row.get(6)?,
                session_id: row.get(7)?,
                name: row.get(8)?,
                os: row.get(9)?,
                cpu_cores: row.get(10)?,
                memory_mb: row.get(11)?,
                disk_mb: row.get(12)?,
                region: row.get(13)?,
                host: row.get(14)?,
                native_id: row.get(15)?,
                template_id: row.get(16)?,
                billing_source: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
            })
        });
        match row {
            Ok(c) => Ok(Some(c)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    })
    .await;

    match result {
        Ok(Ok(computer)) => Ok(computer),
        Ok(Err(e)) => {
            warn!(computer_id = %id_for_error, error = %e, "failed to fetch computer");
            Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("database error: {}", e)))
        }
        Err(e) => {
            warn!(computer_id = %id_for_error, error = %e, "task panicked fetching computer");
            Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, "internal error"))
        }
    }
}

async fn create_computer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateComputerRequest>,
) -> impl IntoResponse {
    match req.kind {
        ComputerKind::CloudDesktop => create_cloud_desktop(state, user, req).await,
        _ => error_response(StatusCode::NOT_IMPLEMENTED, "this computer kind is not yet supported via the unified API"),
    }
}

async fn create_cloud_desktop(
    state: Arc<AppState>,
    user: AuthUser,
    req: CreateComputerRequest,
) -> Response {
    let bot_id = match req.bot_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "bot_id is required for cloud_desktop"),
    };

    if !crate::bot_desktop_routes::verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return error_response(StatusCode::FORBIDDEN, "bot not found or access denied");
    }

    let query = crate::bot_desktop_routes::ProvisionDesktopQuery {
        os: req.os,
        template_id: req.template_id,
    };

    match crate::bot_desktop_routes::provision_desktop_internal(&state, &user, &bot_id, &query).await {
        Ok(resp) => {
            // Sync the new/updated sandbox into computers table.
            if let Err(e) = sync_cloud_desktop_from_sandbox(&state.db, &bot_id, &resp.sandbox_id, &resp.provider, resp.host.as_deref(), &resp.status) {
                warn!(bot_id, error = %e, "failed to sync computer record after provision");
            }
            (StatusCode::CREATED, Json(json!({
                "id": resp.sandbox_id,
                "sandbox_id": resp.sandbox_id,
                "status": resp.status,
                "provider": resp.provider,
                "host": resp.host,
            }))).into_response()
        }
        Err(resp) => resp,
    }
}

fn sync_cloud_desktop_from_sandbox(
    db: &crate::DbHandle,
    bot_id: &str,
    sandbox_id: &str,
    provider: &str,
    host: Option<&str>,
    status: &str,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    let name = format!("Bot desktop {}", sandbox_id);
    conn.execute(
        "INSERT INTO computers (id, kind, provider, status, owner_type, owner_id, bot_id, name, host, native_id, billing_source) \
         VALUES (?1, 'cloud_desktop', ?2, ?3, 'bot', ?4, ?4, ?5, ?6, ?7, 'credits') \
         ON CONFLICT(id) DO UPDATE SET \
             status = excluded.status, \
             host = excluded.host, \
             updated_at = CURRENT_TIMESTAMP",
        rusqlite::params![sandbox_id, provider, status, bot_id, name, host, sandbox_id],
    )?;
    conn.execute(
        "INSERT INTO computer_cloud_desktop (computer_id, sandbox_id, control_state) \
         VALUES (?1, ?2, 'bot_controls') \
         ON CONFLICT(computer_id) DO UPDATE SET \
             sandbox_id = excluded.sandbox_id",
        rusqlite::params![sandbox_id, sandbox_id],
    )?;
    Ok(())
}

async fn start_computer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };

    match computer.kind {
        ComputerKind::CloudDesktop => start_cloud_desktop(&state, &computer).await,
        _ => error_response(StatusCode::NOT_IMPLEMENTED, "start not supported for this kind"),
    }
}

async fn start_cloud_desktop(state: &Arc<AppState>, computer: &ComputerResponse) -> Response {
    let bot_id = match computer.bot_id.as_ref() {
        Some(id) => id.clone(),
        None => return error_response(StatusCode::BAD_REQUEST, "cloud_desktop computer has no bot_id"),
    };

    let record = match crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "no desktop sandbox found for this bot"),
        Err(e) => {
            warn!(bot_id, error = %e, "failed to read bot desktop sandbox");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "database error");
        }
    };

    let driver = match require_driver(state) {
        Ok(d) => d,
        Err(resp) => return resp,
    };

    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os));
    match driver.resume_vm(&handle).await {
        Ok(()) => {
            let _ = update_computer_status(&state.db, &computer.id, "running");
            Json(json!({
                "id": computer.id,
                "status": "running",
                "sandbox_id": record.sandbox_id,
            }))
            .into_response()
        }
        Err(e) => {
            warn!(bot_id, sandbox_id = %record.sandbox_id, error = %e, "failed to start cloud desktop");
            error_response(StatusCode::SERVICE_UNAVAILABLE, format!("failed to start desktop: {}", e))
        }
    }
}

async fn stop_computer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };

    match computer.kind {
        ComputerKind::CloudDesktop => stop_cloud_desktop(&state, &computer).await,
        _ => error_response(StatusCode::NOT_IMPLEMENTED, "stop not supported for this kind"),
    }
}

async fn stop_cloud_desktop(state: &Arc<AppState>, computer: &ComputerResponse) -> Response {
    let bot_id = match computer.bot_id.as_ref() {
        Some(id) => id.clone(),
        None => return error_response(StatusCode::BAD_REQUEST, "cloud_desktop computer has no bot_id"),
    };

    let record = match crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "no desktop sandbox found for this bot"),
        Err(e) => {
            warn!(bot_id, error = %e, "failed to read bot desktop sandbox");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "database error");
        }
    };

    let driver = match require_driver(state) {
        Ok(d) => d,
        Err(resp) => return resp,
    };

    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os));
    match driver.pause_vm(&handle).await {
        Ok(()) => {
            let _ = update_computer_status(&state.db, &computer.id, "stopped");
            Json(json!({
                "id": computer.id,
                "status": "stopped",
                "sandbox_id": record.sandbox_id,
            }))
            .into_response()
        }
        Err(e) => {
            warn!(bot_id, sandbox_id = %record.sandbox_id, error = %e, "failed to stop cloud desktop");
            error_response(StatusCode::SERVICE_UNAVAILABLE, format!("failed to stop desktop: {}", e))
        }
    }
}

async fn delete_computer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return StatusCode::NO_CONTENT.into_response(),
        Err(resp) => return resp,
    };

    match computer.kind {
        ComputerKind::CloudDesktop => delete_cloud_desktop(&state, &computer).await,
        _ => error_response(StatusCode::NOT_IMPLEMENTED, "delete not supported for this kind"),
    }
}

async fn delete_cloud_desktop(state: &Arc<AppState>, computer: &ComputerResponse) -> Response {
    let bot_id = match computer.bot_id.as_ref() {
        Some(id) => id.clone(),
        None => return error_response(StatusCode::BAD_REQUEST, "cloud_desktop computer has no bot_id"),
    };

    let record = match crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            let _ = mark_computer_deleted(&state.db, &computer.id);
            return StatusCode::NO_CONTENT.into_response();
        }
        Err(e) => {
            warn!(bot_id, error = %e, "failed to read bot desktop sandbox");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "database error");
        }
    };

    let driver = match require_driver(state) {
        Ok(d) => d,
        Err(resp) => return resp,
    };

    // Mark deleted immediately; destroy in the background.
    let _ = crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id)
        .ok()
        .and_then(|r| r)
        .map(|_| delete_bot_sandbox_and_computer(state.clone(), &bot_id, &computer.id));

    let sandbox_id = record.sandbox_id.clone();
    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os));
    tokio::spawn(async move {
        match driver.destroy(&handle).await {
            Ok(()) => info!(bot_id, sandbox_id, "cloud desktop destroyed"),
            Err(allternit_driver_interface::DriverError::NotFound { .. }) => {
                info!(bot_id, sandbox_id, "cloud desktop already destroyed");
            }
            Err(e) => {
                warn!(bot_id, sandbox_id, error = %e, "failed to destroy cloud desktop");
            }
        }
    });

    StatusCode::NO_CONTENT.into_response()
}

fn delete_bot_sandbox_and_computer(state: Arc<AppState>, bot_id: &str, computer_id: &str) {
    let db = state.db.clone();
    let bot_id = bot_id.to_string();
    let computer_id = computer_id.to_string();
    tokio::spawn(async move {
        let _ = crate::bot_desktop_routes::delete_bot_sandbox(&db, &bot_id);
        let _ = mark_computer_deleted(&db, &computer_id);
        crate::bot_desktop_quotas::record_end(&state, &bot_id).await;
        let mut sessions = state.bot_desktop_sessions.write().await;
        sessions.remove(&bot_id);
    });
}

fn update_computer_status(db: &crate::DbHandle, id: &str, status: &str) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE computers SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![status, id],
    )?;
    Ok(())
}

fn mark_computer_deleted(db: &crate::DbHandle, id: &str) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE computers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_from_str_maps_correctly() {
        assert!(matches!(status_from_str("running"), ComputerStatus::Running));
        assert!(matches!(status_from_str("stopped"), ComputerStatus::Stopped));
        assert!(matches!(status_from_str("creating"), ComputerStatus::Creating));
        assert!(matches!(status_from_str("error"), ComputerStatus::Error));
        assert!(matches!(status_from_str("unknown"), ComputerStatus::Error));
    }

    #[test]
    fn kind_to_str_matches_db_values() {
        assert_eq!(kind_to_str(&ComputerKind::Local), "local");
        assert_eq!(kind_to_str(&ComputerKind::ByoVps), "byo_vps");
        assert_eq!(kind_to_str(&ComputerKind::Managed), "managed");
        assert_eq!(kind_to_str(&ComputerKind::Byoc), "byoc");
        assert_eq!(kind_to_str(&ComputerKind::CloudDesktop), "cloud_desktop");
    }
}
