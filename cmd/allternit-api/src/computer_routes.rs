//! Unified computer API.
//!
//! This router exposes a single `/api/v1/computers` surface that abstracts
//! local, BYO-VPS, managed, BYOC, and cloud-desktop compute resources.  Phase 1
//! proxies cloud-desktop requests to the existing bot-desktop backend and reads
//! from the existing hosted-runtime tables; later phases add the remaining
//! substrates.

use axum::{
    body::Bytes,
    extract::{Extension, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::bot_desktop_input::{
    build_keyboard_command, build_mouse_command, desktop_display, FilePathQuery, KeyboardInput,
    MouseInput, ShellInput,
};
use crate::bot_desktop_routes::DesktopQuery;
use crate::AppState;
use allternit_driver_interface::CommandSpec;
use rusqlite::OptionalExtension;

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Persistence {
    Ephemeral,
    Session,
    Persistent,
}

#[derive(Debug, Deserialize)]
pub struct CreateComputerRequest {
    pub kind: ComputerKind,
    pub bot_id: Option<String>,
    pub name: Option<String>,
    pub os: Option<String>,
    pub template_id: Option<String>,
    pub session_id: Option<String>,
    pub persistence: Option<Persistence>,
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
        .route("/computers/:id/session-end", post(session_end_computer))
        .route("/computers/:id/screenshot", get(computer_screenshot))
        .route("/computers/:id/mouse", post(computer_mouse))
        .route("/computers/:id/keyboard", post(computer_keyboard))
        .route("/computers/:id/shell", post(computer_shell))
        .route("/computers/:id/files/upload", post(computer_upload_file))
        .route("/computers/:id/files/download", get(computer_download_file))
        .route("/computers/admin/credits", post(admin_credit_org))
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

pub(crate) fn status_from_str(s: &str) -> ComputerStatus {
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

pub(crate) fn error_response(status: StatusCode, message: impl Into<String>) -> Response {
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

fn resolve_org_id(user: &AuthUser) -> Option<String> {
    user.organization_id
        .clone()
        .or_else(|| user.tenant_id.clone())
        .filter(|s| !s.is_empty())
}

/// Check whether the user's organization has remaining spend capacity for a new
/// computer. This unifies LLM and computer usage under the org spend cap.
fn check_org_spend_limit(conn: &rusqlite::Connection, org_id: &str) -> Result<bool, rusqlite::Error> {
    let cap: Option<i64> = conn
        .query_row(
            "SELECT monthly_usd_cap FROM spend_limits WHERE org_id = ?1",
            [org_id],
            |r| r.get(0),
        )
        .optional()?;
    let Some(cap_cents) = cap else {
        return Ok(true);
    };
    if cap_cents <= 0 {
        return Ok(true);
    }
    let spent_micro = crate::admin_spend_limit_routes::org_month_spend_microdollars(conn, org_id)?;
    let spent_cents = spent_micro / 10_000;
    Ok(spent_cents < cap_cents)
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
             LEFT JOIN agents a ON a.id = c.bot_id \
             WHERE (c.owner_id = ?1 OR (c.kind = 'cloud_desktop' AND a.user_id = ?1)) AND c.status != 'deleted'"
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
             LEFT JOIN agents a ON a.id = c.bot_id \
             WHERE c.id = ?1 AND (c.owner_id = ?2 OR (c.kind = 'cloud_desktop' AND a.user_id = ?2)) AND c.status != 'deleted'"
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

    // Resolve the requested spec early so we know the OS/memory for pricing
    // and credit checks before asking the driver to spawn anything.
    let provision_req = crate::bot_desktop_templates::ProvisionRequest {
        os: req.os.clone(),
        template_id: req.template_id.clone(),
    };
    let spec = match crate::bot_desktop_templates::resolve_provision_spec(&state, &user, &provision_req).await {
        Ok(s) => s,
        Err(resp) => return resp.into_response(),
    };

    // Credit / spend-cap check.
    if let Some(ref org_id) = resolve_org_id(&user) {
        let org_id = org_id.clone();
        let db = state.db.clone();
        let memory_mib = spec.memory_mib;
        let os = spec.os.clone();
        let allowed = match tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            if !check_org_spend_limit(&conn, &org_id)? {
                return Ok::<_, rusqlite::Error>(false);
            }
            let hourly = crate::pricing::estimate_hourly_cost_cents(Some(memory_mib as i64), Some(&os));
            Ok(crate::credits::has_minimum_balance(&db, &org_id, hourly).unwrap_or(false))
        }).await {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => {
                warn!(error = %e, "failed to check org spend/credit limit");
                true
            }
            Err(e) => {
                warn!(error = %e, "task panicked checking org spend/credit limit");
                true
            }
        };
        if !allowed {
            return error_response(
                StatusCode::TOO_MANY_REQUESTS,
                "Insufficient credits or monthly spend limit reached. Add credits or request a limit increase.",
            );
        }
    }

    let query = crate::bot_desktop_routes::ProvisionDesktopQuery {
        os: req.os,
        template_id: req.template_id,
        provider: None,
    };

    match crate::bot_desktop_routes::provision_desktop_internal(&state, &user, &bot_id, &query).await {
        Ok(resp) => {
            // Sync the new/updated sandbox into computers table.
            let persistence = req.persistence.unwrap_or(Persistence::Session);
            if let Err(e) = sync_cloud_desktop_from_sandbox(
                &state.db,
                &bot_id,
                &resp.sandbox_id,
                &resp.provider,
                resp.host.as_deref(),
                &resp.status,
                Some(&spec.os),
                Some(spec.memory_mib as i64),
                req.session_id.as_deref(),
                &persistence,
            ) {
                warn!(bot_id, error = %e, "failed to sync computer record after provision");
            }
            (StatusCode::CREATED, Json(json!({
                "id": resp.sandbox_id,
                "sandbox_id": resp.sandbox_id,
                "status": resp.status,
                "provider": resp.provider,
                "host": resp.host,
                "persistence": serde_json::to_value(&persistence).unwrap_or(json!(null)),
            }))).into_response()
        }
        Err(resp) => resp,
    }
}

fn persistence_to_str(p: &Persistence) -> &'static str {
    match p {
        Persistence::Ephemeral => "ephemeral",
        Persistence::Session => "session",
        Persistence::Persistent => "persistent",
    }
}

fn sync_cloud_desktop_from_sandbox(
    db: &crate::DbHandle,
    bot_id: &str,
    sandbox_id: &str,
    provider: &str,
    host: Option<&str>,
    status: &str,
    os: Option<&str>,
    memory_mb: Option<i64>,
    session_id: Option<&str>,
    persistence: &Persistence,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    let name = format!("Bot desktop {}", sandbox_id);
    conn.execute(
        "INSERT INTO computers (id, kind, provider, status, owner_type, owner_id, bot_id, session_id, name, os, memory_mb, host, native_id, billing_source) \
         VALUES (?1, 'cloud_desktop', ?2, ?3, 'bot', ?4, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'credits') \
         ON CONFLICT(id) DO UPDATE SET \
             status = excluded.status, \
             host = excluded.host, \
             os = COALESCE(excluded.os, os), \
             memory_mb = COALESCE(excluded.memory_mb, memory_mb), \
             session_id = COALESCE(excluded.session_id, session_id), \
             updated_at = CURRENT_TIMESTAMP",
        rusqlite::params![sandbox_id, provider, status, session_id, name, os, memory_mb, host, sandbox_id],
    )?;
    conn.execute(
        "INSERT INTO computer_cloud_desktop (computer_id, sandbox_id, control_state, ws_url, protocol) \
         VALUES (?1, ?2, 'bot_controls', ?3, 'vnc') \
         ON CONFLICT(computer_id) DO UPDATE SET \
             sandbox_id = excluded.sandbox_id",
        rusqlite::params![sandbox_id, sandbox_id, format!("/ws/bots/{}/desktop/vnc?sandbox_id={}", bot_id, urlencoding::encode(sandbox_id))],
    )?;
    // Persist lifecycle policy in side-table metadata (non-schema storage).
    conn.execute(
        "UPDATE computer_cloud_desktop SET protocol = ?1 WHERE computer_id = ?2",
        rusqlite::params![persistence_to_str(persistence), sandbox_id],
    )?;
    Ok(())
}

async fn computer_screenshot(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };
    let bot_id = match computer.bot_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no bot_id"),
    };
    let sandbox_id = match computer.native_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no native_id"),
    };

    let driver = match require_driver(&state) {
        Ok(d) => d,
        Err(resp) => return resp,
    };

    let record = match crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "bot has no desktop sandbox"),
        Err(e) => {
            warn!(bot_id, error = %e, "failed to read bot sandbox for screenshot");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "database error");
        }
    };

    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os), Some(&record.provider));
    let capture_cmd = if record.os == "windows" {
        crate::bot_desktop_windows::screenshot_command()
    } else {
        let display = desktop_display(&record.provider);
        let mut env_vars = std::collections::HashMap::new();
        env_vars.insert("DISPLAY".to_string(), display.to_string());
        CommandSpec {
            command: vec![
                "sh".to_string(),
                "-c".to_string(),
                format!("DISPLAY={} scrot -z -o /tmp/allternit-screen.png && base64 -w0 /tmp/allternit-screen.png", display),
            ],
            env_vars,
            working_dir: None,
            stdin_data: None,
            capture_stdout: true,
            capture_stderr: true,
        }
    };

    let exec_result = match driver.exec(&handle, capture_cmd).await {
        Ok(r) => r,
        Err(e) => {
            warn!(bot_id, sandbox_id = %sandbox_id, error = %e, "failed to capture computer screenshot");
            return error_response(StatusCode::SERVICE_UNAVAILABLE, format!("failed to capture screenshot: {}", e));
        }
    };

    let stdout = exec_result.stdout.as_deref().unwrap_or(&[]);
    let stdout_str = String::from_utf8_lossy(stdout);
    let stdout_trimmed = stdout_str.trim();
    if stdout_trimmed.is_empty() {
        let stderr = String::from_utf8_lossy(exec_result.stderr.as_deref().unwrap_or(&[]));
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "screenshot command produced no output",
                "exit_code": exec_result.exit_code,
                "stderr": stderr.trim(),
            })),
        )
            .into_response();
    }

    let png = match BASE64_STANDARD.decode(stdout_trimmed) {
        Ok(bytes) => bytes,
        Err(e) => {
            warn!(bot_id, sandbox_id = %sandbox_id, error = %e, "screenshot output was not valid base64");
            return error_response(StatusCode::SERVICE_UNAVAILABLE, format!("invalid screenshot output: {}", e));
        }
    };

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "image/png")],
        Bytes::from(png),
    )
        .into_response()
}

async fn computer_mouse(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<MouseInput>,
) -> Response {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };
    let bot_id = match computer.bot_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no bot_id"),
    };
    let sandbox_id = match computer.native_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no native_id"),
    };
    crate::bot_desktop_input::send_desktop_mouse(
        State(state),
        Extension(user),
        Path(bot_id),
        Query(DesktopQuery { sandbox_id }),
        Json(input),
    )
    .await
    .into_response()
}

async fn computer_keyboard(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<KeyboardInput>,
) -> Response {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };
    let bot_id = match computer.bot_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no bot_id"),
    };
    let sandbox_id = match computer.native_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no native_id"),
    };
    crate::bot_desktop_input::send_desktop_keyboard(
        State(state),
        Extension(user),
        Path(bot_id),
        Query(DesktopQuery { sandbox_id }),
        Json(input),
    )
    .await
    .into_response()
}

async fn computer_shell(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<ShellInput>,
) -> Response {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };
    let bot_id = match computer.bot_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no bot_id"),
    };
    let sandbox_id = match computer.native_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no native_id"),
    };
    crate::bot_desktop_input::run_desktop_shell(
        State(state),
        Extension(user),
        Path(bot_id),
        Query(DesktopQuery { sandbox_id }),
        Json(input),
    )
    .await
    .into_response()
}

async fn computer_upload_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Query(file_query): Query<FilePathQuery>,
    body: Bytes,
) -> Response {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };
    let bot_id = match computer.bot_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no bot_id"),
    };
    let sandbox_id = match computer.native_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no native_id"),
    };
    crate::bot_desktop_input::upload_desktop_file(
        State(state),
        Extension(user),
        Path(bot_id),
        Query(DesktopQuery { sandbox_id }),
        Query(file_query),
        body,
    )
    .await
    .into_response()
}

async fn computer_download_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Query(file_query): Query<FilePathQuery>,
) -> Response {
    let computer = match fetch_computer(&state, &user.user_id, &id).await {
        Ok(Some(c)) => c,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "computer not found"),
        Err(resp) => return resp,
    };
    let bot_id = match computer.bot_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no bot_id"),
    };
    let sandbox_id = match computer.native_id {
        Some(id) => id,
        None => return error_response(StatusCode::BAD_REQUEST, "computer has no native_id"),
    };
    crate::bot_desktop_input::download_desktop_file(
        State(state),
        Extension(user),
        Path(bot_id),
        Query(DesktopQuery { sandbox_id }),
        Query(file_query),
    )
    .await
    .into_response()
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

    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os), Some(&record.provider));
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

    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os), Some(&record.provider));
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
    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os), Some(&record.provider));
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

async fn session_end_computer(
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
        ComputerKind::CloudDesktop => session_end_cloud_desktop(&state, &computer).await,
        _ => error_response(StatusCode::NO_CONTENT, ""),
    }
}

async fn session_end_cloud_desktop(state: &Arc<AppState>, computer: &ComputerResponse) -> Response {
    let bot_id = match computer.bot_id.as_ref() {
        Some(id) => id.clone(),
        None => return StatusCode::NO_CONTENT.into_response(),
    };

    // Look up the persisted persistence policy for this computer.
    let policy = {
        let db = state.db.clone();
        let computer_id = computer.id.clone();
        match tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            let row: Option<String> = conn
                .query_row(
                    "SELECT protocol FROM computer_cloud_desktop WHERE computer_id = ?1",
                    [&computer_id],
                    |r| r.get(0),
                )
                .optional()?;
            Ok::<_, rusqlite::Error>(row)
        })
        .await
        {
            Ok(Ok(v)) => v,
            _ => None,
        }
    };

    match policy.as_deref() {
        Some("ephemeral") => delete_cloud_desktop(state, computer).await,
        Some("session") => stop_cloud_desktop(state, computer).await,
        _ => {
            // Default to session-scoped stop for unknown/missing policies.
            stop_cloud_desktop(state, computer).await
        }
    }
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
// Admin credits top-up.
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct AdminCreditRequest {
    org_id: String,
    amount_cents: i64,
    #[serde(default)]
    description: Option<String>,
}

fn verify_internal_token(state: &AppState, headers: &axum::http::HeaderMap) -> bool {
    let expected = match state.config.internal_service_token() {
        Some(t) => t,
        None => return false,
    };
    let provided = headers
        .get("x-allternit-internal-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    crate::auth::constant_time_eq(&expected, provided)
}

async fn admin_credit_org(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(req): Json<AdminCreditRequest>,
) -> impl IntoResponse {
    if !verify_internal_token(&state, &headers) {
        return error_response(StatusCode::UNAUTHORIZED, "invalid internal token");
    }
    if req.amount_cents <= 0 {
        return error_response(StatusCode::BAD_REQUEST, "amount_cents must be positive");
    }

    let db = state.db.clone();
    let amount = req.amount_cents;
    let org_id = req.org_id;
    let description = req.description.unwrap_or_else(|| "admin top-up".to_string());

    match tokio::task::spawn_blocking(move || {
        crate::credits::credit(
            &db,
            &org_id,
            amount,
            crate::credits::CreditTransactionKind::ManualGrant,
            Some(&description),
            None,
        )
    })
    .await
    {
        Ok(Ok(balance)) => (
            StatusCode::OK,
            Json(json!({
                "org_id": balance.org_id,
                "balance_cents": balance.balance_cents,
                "lifetime_purchased_cents": balance.lifetime_purchased_cents,
                "lifetime_consumed_cents": balance.lifetime_consumed_cents,
            })),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to credit org");
            error_response(StatusCode::BAD_REQUEST, format!("credit failed: {}", e))
        }
        Err(e) => {
            warn!(error = %e, "task panicked crediting org");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "internal error")
        }
    }
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

    #[test]
    fn persistence_to_str_matches_db_values() {
        assert_eq!(persistence_to_str(&Persistence::Ephemeral), "ephemeral");
        assert_eq!(persistence_to_str(&Persistence::Session), "session");
        assert_eq!(persistence_to_str(&Persistence::Persistent), "persistent");
    }

    #[test]
    fn check_org_spend_limit_allows_when_under_cap() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE spend_limits (org_id TEXT PRIMARY KEY, monthly_usd_cap INTEGER NOT NULL DEFAULT 0, current_month_spend INTEGER NOT NULL DEFAULT 0);
             CREATE TABLE llm_usage_events (id TEXT PRIMARY KEY, tenant_id TEXT, cost_microdollars INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
             CREATE TABLE usage_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, environment_id TEXT NOT NULL, resource_type TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, computed_cost_cents INTEGER NOT NULL DEFAULT 0, started_at DATETIME NOT NULL, ended_at DATETIME NOT NULL);
             INSERT INTO spend_limits (org_id, monthly_usd_cap, current_month_spend) VALUES ('org-1', 10000, 0);",
        )
        .unwrap();
        assert!(check_org_spend_limit(&conn, "org-1").unwrap());
    }

    #[test]
    fn check_org_spend_limit_blocks_when_over_cap() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE spend_limits (org_id TEXT PRIMARY KEY, monthly_usd_cap INTEGER NOT NULL DEFAULT 0, current_month_spend INTEGER NOT NULL DEFAULT 0);
             CREATE TABLE llm_usage_events (id TEXT PRIMARY KEY, tenant_id TEXT, cost_microdollars INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
             CREATE TABLE usage_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, environment_id TEXT NOT NULL, resource_type TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, computed_cost_cents INTEGER NOT NULL DEFAULT 0, started_at DATETIME NOT NULL, ended_at DATETIME NOT NULL);
             INSERT INTO spend_limits (org_id, monthly_usd_cap, current_month_spend) VALUES ('org-1', 100, 0);
             INSERT INTO usage_events (id, organization_id, environment_id, resource_type, quantity, unit, computed_cost_cents, started_at, ended_at) VALUES ('evt-1', 'org-1', 'env-1', 'computer_minute', 10, 'minutes', 500, datetime('now'), datetime('now'));",
        )
        .unwrap();
        assert!(!check_org_spend_limit(&conn, "org-1").unwrap());
    }
}
