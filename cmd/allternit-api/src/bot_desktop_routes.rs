//! Bot virtual-computer desktop API
//!
//! Provides REST endpoints for a human to inspect and take over the desktop of
//! a bot's running sandbox. Control state is persisted in memory so the bot
//! runtime can pause autonomous actions while the human is driving.
//!
//! Each bot may own one persistent desktop sandbox. The mapping is stored in
//! `bot_desktop_sandboxes` so the computer survives API restarts and chat
//! session boundaries.

use axum::extract::{Extension, Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::auth::AuthUser;
use crate::bot_desktop_input::desktop_display;
use crate::bot_desktop_stream::{desktop_ws_secret, sign_desktop_token};
use crate::bot_desktop_templates::ProvisionRequest;
use crate::bot_desktop_windows;
use crate::AppState;
use crate::{BotDesktopControlState, BotDesktopSession};
use allternit_agent_system_rails::core::types::{Actor, ActorType, AllternitEvent, EventScope};
use allternit_driver_interface::{
    CommandSpec, DesktopEndpoint, DesktopProtocol, DriverError, EnvironmentSpec, ExecutionHandle,
    ExecutionId, NetworkPolicy, PolicySpec, ResourceSpec, SpawnSpec, TenantId,
};

pub fn bot_desktop_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/bots/:bot_id/desktop", get(get_desktop_status))
        .route("/bots/:bot_id/desktop/screenshot", get(get_desktop_screenshot))
        .route(
            "/bots/:bot_id/desktop/mouse",
            post(crate::bot_desktop_input::send_desktop_mouse),
        )
        .route(
            "/bots/:bot_id/desktop/keyboard",
            post(crate::bot_desktop_input::send_desktop_keyboard),
        )
        .route(
            "/bots/:bot_id/desktop/shell",
            post(crate::bot_desktop_input::run_desktop_shell),
        )
        .route(
            "/bots/:bot_id/desktop/files/download",
            get(crate::bot_desktop_input::download_desktop_file),
        )
        .route(
            "/bots/:bot_id/desktop/files/upload",
            post(crate::bot_desktop_input::upload_desktop_file),
        )
        .route(
            "/bots/:bot_id/desktop/mux/run",
            post(crate::bot_desktop_mux::run_desktop_mux),
        )
        .route(
            "/bots/:bot_id/desktop/mesh/join",
            post(crate::bot_desktop_mesh::join_desktop_mesh),
        )
        .route(
            "/bots/:bot_id/desktop/mesh/status",
            get(crate::bot_desktop_mesh::desktop_mesh_status),
        )
        .route(
            "/bots/:bot_id/desktop/mesh/leave",
            post(crate::bot_desktop_mesh::leave_desktop_mesh),
        )
        .route(
            "/bots/:bot_id/desktop/snapshots",
            post(crate::bot_desktop_snapshots::create_desktop_snapshot)
                .get(crate::bot_desktop_snapshots::list_desktop_snapshots),
        )
        .route(
            "/bots/:bot_id/desktop/snapshots/:snapshot_id/restore",
            post(crate::bot_desktop_snapshots::restore_desktop_snapshot),
        )
        .route(
            "/bots/:bot_id/desktop/snapshots/:snapshot_id",
            delete(crate::bot_desktop_snapshots::delete_desktop_snapshot),
        )
        .route("/bots/:bot_id/desktop/provision", post(provision_desktop))
        .route("/bots/:bot_id/desktop/start", post(start_desktop))
        .route("/bots/:bot_id/desktop/stop", post(stop_desktop))
        .route("/bots/:bot_id/desktop/deprovision", post(deprovision_desktop))
        .route("/bots/:bot_id/desktop/observe", post(observe_desktop))
        .route("/bots/:bot_id/desktop/take-over", post(take_over_desktop))
        .route("/bots/:bot_id/desktop/hand-back", post(hand_back_desktop))
        .layer(axum::middleware::from_fn(
            crate::rate_limit::bot_desktop_rate_limit_middleware,
        ))
}

#[derive(Debug, Deserialize)]
pub(crate) struct DesktopQuery {
    /// OpenSandbox sandbox id for the bot's persistent virtual computer.
    pub(crate) sandbox_id: String,
}

#[derive(Debug, Serialize)]
pub struct DesktopStatusResponse {
    pub status: String,
    pub control_state: String,
    pub ws_url: Option<String>,
    pub protocol: String,
    pub sandbox_id: String,
    pub taken_over_by_user_id: Option<String>,
    pub taken_over_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProvisionDesktopResponse {
    pub sandbox_id: String,
    pub status: String,
    pub provider: String,
    pub host: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LifecycleDesktopResponse {
    pub sandbox_id: String,
    pub status: String,
}

/// Persistent mapping stored in SQLite.
#[derive(Debug, Clone)]
pub(crate) struct BotDesktopSandboxRecord {
    pub(crate) bot_id: String,
    pub(crate) sandbox_id: String,
    pub(crate) provider: String,
    pub(crate) host: Option<String>,
    pub(crate) status: String,
    pub(crate) os: String,
}

async fn get_desktop_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopQuery>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let control_state = read_control_state(&state, &bot_id, &query.sandbox_id).await;

    let endpoint = match resolve_desktop_endpoint(&state, &bot_id, &query.sandbox_id).await {
        Ok(ep) => ep,
        Err(e) => {
            warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to resolve desktop endpoint");
            None
        }
    };

    let (status, ws_url, protocol) = match endpoint {
        Some(ep) => {
            // Only the raw VNC protocol is proxied through the WebSocket handler.
            // noVNC HTTP endpoints are served directly by OpenSandbox and should
            // not be tunnelled through the platform API in v1.
            let ws_url = if matches!(ep.protocol, DesktopProtocol::Vnc) {
                Some(build_ws_url(&state, &bot_id, &query.sandbox_id, &user.user_id))
            } else {
                None
            };
            ("running".to_string(), ws_url, Some(ep.protocol))
        }
        None => ("off".to_string(), None, None),
    };

    let session = {
        let sessions = state.bot_desktop_sessions.read().await;
        sessions.get(&bot_id).filter(|s| s.sandbox_id == query.sandbox_id).cloned()
    };

    let response = DesktopStatusResponse {
        status,
        control_state: control_state_to_string(&control_state),
        ws_url,
        protocol: protocol
            .map(|p| match p {
                DesktopProtocol::Vnc => "vnc".to_string(),
                DesktopProtocol::NoVncHttp => "novnc".to_string(),
            })
            .unwrap_or_else(|| "none".to_string()),
        sandbox_id: query.sandbox_id,
        taken_over_by_user_id: session.as_ref().and_then(|s| s.taken_over_by_user_id.clone()),
        taken_over_at: session.as_ref().and_then(|s| s.taken_over_at.map(|t| t.to_rfc3339())),
    };

    Json(response).into_response()
}

async fn get_desktop_screenshot(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopQuery>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "No VM driver is configured on this host"})),
            )
                .into_response();
        }
    };

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "bot has no desktop sandbox"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot sandbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to read sandbox record"})),
            )
                .into_response();
        }
    };

    let handle = build_handle(&record.sandbox_id, Some(&record.os));
    let capture_cmd = if record.os == "windows" {
        bot_desktop_windows::screenshot_command()
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
            warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to capture desktop screenshot");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to capture screenshot: {}", e)})),
            )
                .into_response();
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
            warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Screenshot output was not valid base64");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("invalid screenshot output: {}", e)})),
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "image/png")],
        Bytes::from(png),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
pub(crate) struct ProvisionDesktopQuery {
    pub os: Option<String>,
    pub template_id: Option<String>,
    /// Force a specific substrate provider, e.g. "incus" or "tart".
    pub provider: Option<String>,
}

/// Internal provision path used both by the HTTP handler and the capacity-driven
/// queue worker. Returns `Ok` on success or `Err(response)` on any failure that
/// should be surfaced to the caller.
pub(crate) async fn provision_desktop_internal(
    state: &Arc<AppState>,
    user: &AuthUser,
    bot_id: &str,
    query: &ProvisionDesktopQuery,
) -> Result<ProvisionDesktopResponse, axum::response::Response> {
    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "No VM driver is configured on this host"})),
            )
                .into_response());
        }
    };

    if !driver.supports_desktop() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "The configured VM driver does not expose a remote desktop stream. \
                          Set OPEN_SANDBOX_URL to use OpenSandbox for bot desktops."
            })),
        )
            .into_response());
    }

    match crate::bot_desktop_quotas::check_quota(state, user).await {
        Ok(check) if !check.allowed => {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({"error": check.reason.unwrap_or_else(|| "quota exceeded".to_string())})),
            )
                .into_response());
        }
        Err(e) => {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({"error": e.to_string()})),
            )
                .into_response());
        }
        _ => {}
    }

    let req = ProvisionRequest {
        os: query.os.clone(),
        template_id: query.template_id.clone(),
    };
    let spec = match crate::bot_desktop_templates::resolve_provision_spec(state, user, &req).await {
        Ok(s) => s,
        Err(resp) => return Err(resp.into_response()),
    };

    let tenant_id = match TenantId::new(format!("bot-{}", bot_id)) {
        Ok(t) => t,
        Err(e) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("invalid bot tenant id: {}", e)})),
            )
                .into_response());
        }
    };

    let mut env_vars = spec.env.clone();
    env_vars.insert("ALLTERNIT_BOT_ID".to_string(), bot_id.to_string());
    env_vars.insert("ALLTERNIT_USER_ID".to_string(), user.user_id.clone());
    env_vars.insert("ALLTERNIT_DESKTOP_OS".to_string(), spec.os.clone());
    if let Some(ref provider) = query.provider {
        env_vars.insert("ALLTERNIT_DESKTOP_PROVIDER".to_string(), provider.clone());
    }

    let env = EnvironmentSpec {
        spec_type: allternit_driver_interface::EnvSpecType::Oci,
        image: spec.image.clone(),
        version: None,
        packages: vec![],
        env_vars,
        working_dir: Some("/workspace".to_string()),
        mounts: vec![],
    };

    let network_policy = NetworkPolicy {
        egress_allowed: spec.network_enabled,
        allowed_hosts: vec![],
        allowed_ports: vec![],
        dns_allowed: spec.network_enabled,
    };

    let mut policy = PolicySpec::default_permissive();
    policy.network_policy = network_policy;

    let resources = ResourceSpec {
        cpu_millis: spec.cpu_millis,
        memory_mib: spec.memory_mib,
        disk_mib: spec.disk_mib,
        network_egress_kib: None,
        gpu_count: None,
    };

    let spawn_spec = SpawnSpec {
        tenant: tenant_id,
        project: None,
        workspace: None,
        run_id: None,
        env,
        policy,
        resources,
        envelope: None,
        prewarm_pool: None,
    };

    let handle = match driver.spawn(spawn_spec).await {
        Ok(h) => h,
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to spawn bot desktop sandbox");
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to provision desktop sandbox: {}", e)})),
            )
                .into_response());
        }
    };

    let driver_info = handle.driver_info;
    let sandbox_id = driver_info
        .get("native_id")
        .cloned()
        .unwrap_or_else(|| handle.id.to_string());
    let host = driver_info.get("host").cloned();
    let provider = driver_info
        .get("provider")
        .cloned()
        .unwrap_or_else(|| "incus".to_string());

    // Both Incus and Tart drivers now block in spawn() until the guest reports
    // Running/running, so we can truthfully store the sandbox as active.
    if let Err(e) = upsert_bot_sandbox(
        &state.db,
        bot_id,
        &sandbox_id,
        &provider,
        host.as_deref(),
        "running",
        &spec.os,
    ) {
        warn!(bot_id, sandbox_id, error = %e, "Failed to persist bot desktop sandbox");
    }

    crate::bot_desktop_quotas::record_start(state, user, bot_id, &sandbox_id, &provider, &spec.os).await;

    info!(bot_id, sandbox_id, provider, "Bot desktop sandbox provisioned");

    Ok(ProvisionDesktopResponse {
        sandbox_id,
        status: "running".to_string(),
        provider,
        host,
    })
}

async fn provision_desktop(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<ProvisionDesktopQuery>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    // Idempotent: if the bot already has an active sandbox, return it.
    if let Ok(Some(record)) = read_bot_sandbox(&state.db, &bot_id) {
        if record.status == "running" || record.status == "creating" {
            return Json(ProvisionDesktopResponse {
                sandbox_id: record.sandbox_id,
                status: record.status,
                provider: record.provider,
                host: record.host,
            })
            .into_response();
        }
    }

    // When the target substrate is full, queue the request instead of failing.
    if crate::bot_desktop_queue::is_os_at_capacity(query.os.as_deref(), query.provider.as_deref()).await {
        match crate::bot_desktop_queue::enqueue(&state, &user, &bot_id, &query).await {
            Ok((entry, position)) => {
                return (
                    StatusCode::ACCEPTED,
                    Json(json!({
                        "status": "queued",
                        "queue_id": entry.id,
                        "position": position,
                    })),
                )
                    .into_response();
            }
            Err(reason) => {
                return (
                    StatusCode::TOO_MANY_REQUESTS,
                    Json(json!({"error": reason})),
                )
                    .into_response();
            }
        }
    }

    match provision_desktop_internal(&state, &user, &bot_id, &query).await {
        Ok(resp) => Json(resp).into_response(),
        Err(resp) => resp,
    }
}

async fn start_desktop(
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

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "no desktop sandbox found for this bot"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot desktop sandbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    let driver = match require_driver(&state).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };

    let handle = build_handle(&record.sandbox_id, Some(&record.os));
    match driver.resume_vm(&handle).await {
        Ok(()) => {
            let _ = update_bot_sandbox_status(&state.db, &bot_id, "running");
            Json(LifecycleDesktopResponse {
                sandbox_id: record.sandbox_id,
                status: "running".to_string(),
            })
            .into_response()
        }
        Err(e) => {
            warn!(bot_id, sandbox_id = %record.sandbox_id, error = %e, "Failed to start bot desktop");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to start desktop sandbox: {}", e)})),
            )
                .into_response()
        }
    }
}

async fn stop_desktop(
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

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "no desktop sandbox found for this bot"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot desktop sandbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    let driver = match require_driver(&state).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };

    let handle = build_handle(&record.sandbox_id, Some(&record.os));
    match driver.pause_vm(&handle).await {
        Ok(()) => {
            let _ = update_bot_sandbox_status(&state.db, &bot_id, "stopped");
            Json(LifecycleDesktopResponse {
                sandbox_id: record.sandbox_id,
                status: "stopped".to_string(),
            })
            .into_response()
        }
        Err(e) => {
            warn!(bot_id, sandbox_id = %record.sandbox_id, error = %e, "Failed to stop bot desktop");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to stop desktop sandbox: {}", e)})),
            )
                .into_response()
        }
    }
}

async fn deprovision_desktop(
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

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => return StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot desktop sandbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    let driver = match require_driver(&state).await {
        Ok(d) => d,
        Err(resp) => return resp,
    };

    // Remove the database record immediately so the UI reflects the action.
    // VM destruction can take tens of seconds on some substrates, so we run it
    // in the background and rely on the driver's idempotent destroy to clean up.
    if let Err(e) = delete_bot_sandbox(&state.db, &bot_id) {
        warn!(bot_id, error = %e, "Failed to delete bot desktop sandbox record");
    }

    crate::bot_desktop_quotas::record_end(&state, &bot_id).await;

    {
        let mut sessions = state.bot_desktop_sessions.write().await;
        sessions.remove(&bot_id);
    }

    let sandbox_id = record.sandbox_id.clone();
    let handle = build_handle(&record.sandbox_id, Some(&record.os));
    tokio::spawn(async move {
        match driver.destroy(&handle).await {
            Ok(()) => info!(bot_id, sandbox_id, "Bot desktop sandbox destroyed"),
            Err(DriverError::NotFound { .. }) => {
                info!(bot_id, sandbox_id, "Bot desktop sandbox already destroyed");
            }
            Err(e) => {
                warn!(bot_id, sandbox_id, error = %e, "Failed to destroy bot desktop sandbox");
            }
        }
    });

    StatusCode::NO_CONTENT.into_response()
}

async fn observe_desktop(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopQuery>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let now = chrono::Utc::now();
    {
        let mut sessions = state.bot_desktop_sessions.write().await;
        sessions.insert(
            bot_id.clone(),
            BotDesktopSession {
                bot_id: bot_id.clone(),
                sandbox_id: query.sandbox_id.clone(),
                control_state: BotDesktopControlState::HumanObserving,
                taken_over_by_user_id: Some(user.user_id.clone()),
                taken_over_at: Some(now),
                handed_back_at: None,
            },
        );
    }

    publish_desktop_event(&state, &bot_id, "bot.desktop.observed", &user.user_id).await;

    Json(json!({
        "control_state": "human_observing",
        "sandbox_id": query.sandbox_id,
    }))
    .into_response()
}

async fn take_over_desktop(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopQuery>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let now = chrono::Utc::now();
    {
        let mut sessions = state.bot_desktop_sessions.write().await;
        sessions.insert(
            bot_id.clone(),
            BotDesktopSession {
                bot_id: bot_id.clone(),
                sandbox_id: query.sandbox_id.clone(),
                control_state: BotDesktopControlState::HumanControls,
                taken_over_by_user_id: Some(user.user_id.clone()),
                taken_over_at: Some(now),
                handed_back_at: None,
            },
        );
    }

    publish_desktop_event(&state, &bot_id, "bot.desktop.taken_over", &user.user_id).await;

    Json(json!({
        "control_state": "human_controls",
        "sandbox_id": query.sandbox_id,
    }))
    .into_response()
}

async fn hand_back_desktop(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopQuery>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let now = chrono::Utc::now();
    {
        let mut sessions = state.bot_desktop_sessions.write().await;
        sessions.insert(
            bot_id.clone(),
            BotDesktopSession {
                bot_id: bot_id.clone(),
                sandbox_id: query.sandbox_id.clone(),
                control_state: BotDesktopControlState::BotControls,
                taken_over_by_user_id: None,
                taken_over_at: None,
                handed_back_at: Some(now),
            },
        );
    }

    publish_desktop_event(&state, &bot_id, "bot.desktop.handed_back", &user.user_id).await;

    Json(json!({
        "control_state": "bot_controls",
        "sandbox_id": query.sandbox_id,
    }))
    .into_response()
}

pub(crate) async fn verify_bot_ownership(state: &AppState, user_id: &str, bot_id: &str) -> bool {
    let db = state.db.clone();
    let bot_id = bot_id.to_string();
    let user_id = user_id.to_string();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare("SELECT 1 FROM agents WHERE id = ?1 AND user_id = ?2 LIMIT 1")?;
        let exists: Option<i64> = stmt.query_row(rusqlite::params![bot_id, user_id], |row| {
            row.get(0)
        }).ok();
        Ok::<_, rusqlite::Error>(exists.is_some())
    })
    .await;

    match result {
        Ok(Ok(true)) => true,
        Ok(Ok(false)) => false,
        Ok(Err(e)) => {
            warn!(error = %e, "DB error verifying bot ownership");
            false
        }
        Err(e) => {
            warn!(error = %e, "DB task panicked verifying bot ownership");
            false
        }
    }
}

async fn read_control_state(
    state: &AppState,
    bot_id: &str,
    sandbox_id: &str,
) -> BotDesktopControlState {
    let sessions = state.bot_desktop_sessions.read().await;
    sessions
        .get(bot_id)
        .filter(|s| s.sandbox_id == sandbox_id)
        .map(|s| s.control_state)
        .unwrap_or(BotDesktopControlState::BotControls)
}

fn control_state_to_string(state: &BotDesktopControlState) -> String {
    match state {
        BotDesktopControlState::BotControls => "bot_controls".to_string(),
        BotDesktopControlState::HumanControls => "human_controls".to_string(),
        BotDesktopControlState::HumanObserving => "human_observing".to_string(),
    }
}

async fn require_driver(state: &AppState) -> Result<Arc<dyn allternit_driver_interface::ExecutionDriver>, axum::response::Response> {
    match &state.vm_driver {
        Some(d) => Ok(d.clone()),
        None => Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "No VM driver is configured on this host"})),
        )
            .into_response()),
    }
}

pub(crate) fn build_handle(native_id: &str, os: Option<&str>) -> ExecutionHandle {
    let mut driver_info = std::collections::HashMap::new();
    driver_info.insert("native_id".to_string(), native_id.to_string());

    let mut env_vars = std::collections::HashMap::new();
    if let Some(os) = os {
        env_vars.insert("ALLTERNIT_DESKTOP_OS".to_string(), os.to_string());
        let provider = match os {
            "macos" => "tart",
            _ => "incus",
        };
        driver_info.insert("provider".to_string(), provider.to_string());
    }

    ExecutionHandle {
        id: ExecutionId::new(),
        tenant: TenantId::new("lifecycle".to_string()).expect("lifecycle is a valid tenant id"),
        driver_info,
        env_spec: EnvironmentSpec {
            spec_type: allternit_driver_interface::EnvSpecType::Oci,
            image: "unused".to_string(),
            version: None,
            packages: vec![],
            env_vars,
            working_dir: None,
            mounts: vec![],
        },
    }
}

fn build_ws_url(state: &AppState, bot_id: &str, sandbox_id: &str, user_id: &str) -> String {
    let token = match desktop_ws_secret(state) {
        Some(secret) => sign_desktop_token(&secret, bot_id, sandbox_id, user_id, 300),
        None => {
            // Fallback to the old unsigned user_id param only when no secret is
            // configured. This path exists for legacy/test setups and should not
            // be used in production.
            return format!(
                "/ws/bots/{}/desktop/vnc?sandbox_id={}&user_id={}",
                bot_id,
                urlencoding::encode(sandbox_id),
                urlencoding::encode(user_id)
            );
        }
    };

    format!(
        "/ws/bots/{}/desktop/vnc?sandbox_id={}&token={}",
        bot_id,
        urlencoding::encode(sandbox_id),
        urlencoding::encode(&token)
    )
}

async fn publish_desktop_event(state: &AppState, bot_id: &str, event_type: &str, user_id: &str) {
    let now = chrono::Utc::now();
    let event = AllternitEvent {
        event_id: String::new(),
        ts: now.to_rfc3339(),
        actor: Actor {
            r#type: ActorType::User,
            id: user_id.to_string(),
        },
        scope: Some(EventScope {
            project_id: None,
            dag_id: None,
            node_id: None,
            wih_id: None,
            run_id: Some(bot_id.to_string()),
            team_workspace_id: None,
            team_name: None,
        }),
        r#type: event_type.to_string(),
        payload: json!({
            "bot_id": bot_id,
            "user_id": user_id,
            "timestamp": now.to_rfc3339(),
        }),
        provenance: None,
    };

    if let Err(e) = state.rails.ledger.append(event).await {
        debug!(error = %e, "Failed to publish desktop event to ledger");
    }
}

// ── Persistence helpers ──────────────────────────────────────────────────────

pub(crate) fn read_bot_sandbox(
    db: &crate::db::DbHandle,
    bot_id: &str,
) -> Result<Option<BotDesktopSandboxRecord>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT bot_id, sandbox_id, provider, host, status, os
         FROM bot_desktop_sandboxes
         WHERE bot_id = ?1
         LIMIT 1",
    )?;
    let result = stmt.query_row(rusqlite::params![bot_id], |row| {
        Ok(BotDesktopSandboxRecord {
            bot_id: row.get(0)?,
            sandbox_id: row.get(1)?,
            provider: row.get(2)?,
            host: row.get(3)?,
            status: row.get(4)?,
            os: row.get(5)?,
        })
    });
    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

fn upsert_bot_sandbox(
    db: &crate::db::DbHandle,
    bot_id: &str,
    sandbox_id: &str,
    provider: &str,
    host: Option<&str>,
    status: &str,
    os: &str,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO bot_desktop_sandboxes (bot_id, sandbox_id, provider, host, status, os)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(bot_id) DO UPDATE SET
             sandbox_id = excluded.sandbox_id,
             provider = excluded.provider,
             host = excluded.host,
             status = excluded.status,
             os = excluded.os",
        rusqlite::params![bot_id, sandbox_id, provider, host, status, os],
    )?;
    Ok(())
}

fn update_bot_sandbox_status(
    db: &crate::db::DbHandle,
    bot_id: &str,
    status: &str,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE bot_desktop_sandboxes SET status = ?2 WHERE bot_id = ?1",
        rusqlite::params![bot_id, status],
    )?;
    Ok(())
}

fn delete_bot_sandbox(
    db: &crate::db::DbHandle,
    bot_id: &str,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "DELETE FROM bot_desktop_sandboxes WHERE bot_id = ?1",
        rusqlite::params![bot_id],
    )?;
    Ok(())
}

/// Resolve a desktop endpoint for the bot's sandbox, recovering from API
/// restarts by re-registering the sandbox with the driver when needed.
async fn resolve_desktop_endpoint(
    state: &AppState,
    bot_id: &str,
    sandbox_id: &str,
) -> Result<Option<DesktopEndpoint>, DriverError> {
    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => return Ok(None),
    };

    match driver.get_desktop_endpoint_by_native_id(sandbox_id).await {
        Ok(ep) => return Ok(ep),
        Err(DriverError::NotFound { .. }) => {
            // The driver lost its in-memory map (likely an API restart).
            // Re-register from persistence and retry once.
            if let Ok(Some(record)) = read_bot_sandbox(&state.db, bot_id) {
                if record.sandbox_id == sandbox_id {
                    if let Some(host) = record.host {
                        let _ = driver
                            .register_native_sandbox(&record.sandbox_id, bot_id, &host)
                            .await;
                        return driver.get_desktop_endpoint_by_native_id(sandbox_id).await;
                    }
                }
            }
            Ok(None)
        }
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_driver_interface::ResourceConsumption;
    use async_trait::async_trait;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use std::path::Path;
    use std::sync::{Arc, Mutex};
    use tower::ServiceExt;

    #[derive(Debug)]
    struct MockExecutionDriver {
        calls: Arc<Mutex<Vec<String>>>,
        exec_result: Arc<Mutex<Option<std::result::Result<allternit_driver_interface::ExecResult, DriverError>>>>,
    }

    impl MockExecutionDriver {
        fn new() -> Self {
            Self {
                calls: Arc::new(Mutex::new(Vec::new())),
                exec_result: Arc::new(Mutex::new(None)),
            }
        }

        fn recorded(&self) -> Vec<String> {
            self.calls.lock().unwrap().clone()
        }

        fn set_exec_result(
            &self,
            result: std::result::Result<allternit_driver_interface::ExecResult, DriverError>,
        ) {
            *self.exec_result.lock().unwrap() = Some(result);
        }
    }

    #[async_trait]
    impl allternit_driver_interface::ExecutionDriver for MockExecutionDriver {
        fn capabilities(&self) -> allternit_driver_interface::DriverCapabilities {
            allternit_driver_interface::DriverCapabilities {
                driver_type: allternit_driver_interface::DriverType::Container,
                isolation: allternit_driver_interface::IsolationLevel::Standard,
                max_resources: ResourceSpec {
                    cpu_millis: 2000,
                    memory_mib: 4096,
                    disk_mib: Some(20480),
                    network_egress_kib: None,
                    gpu_count: None,
                },
                supported_env_specs: vec![allternit_driver_interface::EnvSpecType::Oci],
                features: allternit_driver_interface::DriverFeatures {
                    snapshot: false,
                    live_restore: false,
                    gpu: false,
                    prewarm: false,
                },
            }
        }

        async fn spawn(
            &self,
            _spec: SpawnSpec,
        ) -> std::result::Result<ExecutionHandle, DriverError> {
            self.calls.lock().unwrap().push("spawn".to_string());
            Err(DriverError::NotSupported {
                feature: "spawn".to_string(),
            })
        }

        async fn pause_vm(&self, handle: &ExecutionHandle) -> std::result::Result<(), DriverError> {
            self.calls.lock().unwrap().push(format!(
                "pause_vm:{}",
                handle.driver_info.get("native_id").unwrap_or(&"?".to_string())
            ));
            Ok(())
        }

        async fn resume_vm(&self, handle: &ExecutionHandle) -> std::result::Result<(), DriverError> {
            self.calls.lock().unwrap().push(format!(
                "resume_vm:{}",
                handle.driver_info.get("native_id").unwrap_or(&"?".to_string())
            ));
            Ok(())
        }

        async fn exec(
            &self,
            handle: &ExecutionHandle,
            _cmd: allternit_driver_interface::CommandSpec,
        ) -> std::result::Result<allternit_driver_interface::ExecResult, DriverError> {
            self.calls.lock().unwrap().push(format!(
                "exec:{}",
                handle.driver_info.get("native_id").unwrap_or(&"?".to_string())
            ));
            match self.exec_result.lock().unwrap().take() {
                Some(result) => result,
                None => Err(DriverError::NotSupported {
                    feature: "exec".to_string(),
                }),
            }
        }

        async fn stream_logs(
            &self,
            _handle: &ExecutionHandle,
        ) -> std::result::Result<Vec<allternit_driver_interface::LogEntry>, DriverError> {
            Err(DriverError::NotSupported {
                feature: "stream_logs".to_string(),
            })
        }

        async fn get_artifacts(
            &self,
            _handle: &ExecutionHandle,
        ) -> std::result::Result<Vec<allternit_driver_interface::Artifact>, DriverError> {
            Ok(vec![])
        }

        async fn destroy(
            &self,
            handle: &ExecutionHandle,
        ) -> std::result::Result<(), DriverError> {
            self.calls.lock().unwrap().push(format!(
                "destroy:{}",
                handle.driver_info.get("native_id").unwrap_or(&"?".to_string())
            ));
            Ok(())
        }

        async fn get_consumption(
            &self,
            _handle: &ExecutionHandle,
        ) -> std::result::Result<ResourceConsumption, DriverError> {
            Ok(ResourceConsumption::default())
        }

        async fn get_receipt(
            &self,
            _handle: &ExecutionHandle,
        ) -> std::result::Result<Option<allternit_driver_interface::Receipt>, DriverError> {
            Ok(None)
        }

        async fn health_check(
            &self,
        ) -> std::result::Result<allternit_driver_interface::DriverHealth, DriverError> {
            Ok(allternit_driver_interface::DriverHealth {
                healthy: true,
                message: Some("mock".to_string()),
                active_executions: 0,
                available_capacity: self.capabilities().max_resources,
                capabilities: vec![],
            })
        }
    }

    fn test_user(user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: None,
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: None,
            organization_role: None,
            organization_slug: None,
        }
    }

    async fn test_app_state(temp: &Path, driver: Arc<MockExecutionDriver>) -> Arc<AppState> {
        let state = crate::test_helpers::app_state_with_driver(temp, Some(driver)).await;
        let conn = state.db.connect().expect("test db conn");
        conn.execute(
            "INSERT OR IGNORE INTO agents (id, user_id, name, type, model, provider)
             VALUES (?1, ?2, 'Test Bot', 'worker', 'gpt-4', 'openai')",
            rusqlite::params!["bot-1", "user-1"],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO bot_desktop_sandboxes (bot_id, sandbox_id, provider, host, status, os)
             VALUES (?1, ?2, 'incus', 'mail', 'running', 'linux')",
            rusqlite::params!["bot-1", "sandbox-abc"],
        )
        .unwrap();
        drop(conn);
        state
    }

    async fn body_json(body: Body) -> serde_json::Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap_or_else(|_| serde_json::Value::Null)
    }

    #[tokio::test]
    async fn stop_desktop_calls_pause_vm_and_updates_status() {
        let temp = tempfile::tempdir().unwrap().keep();
        let driver = Arc::new(MockExecutionDriver::new());
        let state = test_app_state(&temp, driver.clone()).await;
        let app = bot_desktop_router().with_state(state.clone());

        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/bots/bot-1/desktop/stop")
                    .extension(test_user("user-1"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["sandbox_id"], "sandbox-abc");
        assert_eq!(body["status"], "stopped");
        assert!(driver.recorded().contains(&"pause_vm:sandbox-abc".to_string()));

        let record = read_bot_sandbox(&state.db, "bot-1").unwrap().unwrap();
        assert_eq!(record.status, "stopped");
    }

    #[tokio::test]
    async fn start_desktop_calls_resume_vm_and_updates_status() {
        let temp = tempfile::tempdir().unwrap().keep();
        let driver = Arc::new(MockExecutionDriver::new());
        let state = test_app_state(&temp, driver.clone()).await;
        let app = bot_desktop_router().with_state(state.clone());

        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/bots/bot-1/desktop/start")
                    .extension(test_user("user-1"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["sandbox_id"], "sandbox-abc");
        assert_eq!(body["status"], "running");
        assert!(driver.recorded().contains(&"resume_vm:sandbox-abc".to_string()));

        let record = read_bot_sandbox(&state.db, "bot-1").unwrap().unwrap();
        assert_eq!(record.status, "running");
    }

    #[tokio::test]
    async fn deprovision_desktop_calls_destroy_and_deletes_record() {
        let temp = tempfile::tempdir().unwrap().keep();
        let driver = Arc::new(MockExecutionDriver::new());
        let state = test_app_state(&temp, driver.clone()).await;
        let app = bot_desktop_router().with_state(state.clone());

        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/bots/bot-1/desktop/deprovision")
                    .extension(test_user("user-1"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::NO_CONTENT);
        assert!(read_bot_sandbox(&state.db, "bot-1").unwrap().is_none());

        // VM destruction now happens in a background task so the endpoint can
        // return quickly. Poll the mock driver until the destroy call is recorded.
        let mut seen_destroy = false;
        for _ in 0..50 {
            if driver.recorded().contains(&"destroy:sandbox-abc".to_string()) {
                seen_destroy = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        assert!(seen_destroy, "destroy:sandbox-abc was not recorded in time");

        let sessions = state.bot_desktop_sessions.read().await;
        assert!(!sessions.contains_key("bot-1"));
    }

    #[tokio::test]
    async fn lifecycle_endpoints_forbid_non_owner() {
        let temp = tempfile::tempdir().unwrap().keep();
        let driver = Arc::new(MockExecutionDriver::new());
        let state = test_app_state(&temp, driver.clone()).await;
        let app = bot_desktop_router().with_state(state);

        for uri in [
            "/bots/bot-1/desktop/start",
            "/bots/bot-1/desktop/stop",
            "/bots/bot-1/desktop/deprovision",
        ] {
            let resp = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(uri)
                        .extension(test_user("other-user"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        }
        assert!(driver.recorded().is_empty());
    }

    #[tokio::test]
    async fn lifecycle_endpoints_return_404_when_no_sandbox() {
        let temp = tempfile::tempdir().unwrap().keep();
        let driver = Arc::new(MockExecutionDriver::new());
        let state = crate::test_helpers::app_state_with_driver(temp.as_path(), Some(driver.clone())).await;
        let conn = state.db.connect().expect("test db conn");
        conn.execute(
            "INSERT OR IGNORE INTO agents (id, user_id, name, type, model, provider)
             VALUES (?1, ?2, 'Test Bot', 'worker', 'gpt-4', 'openai')",
            rusqlite::params!["bot-empty", "user-1"],
        )
        .unwrap();
        drop(conn);
        let app = bot_desktop_router().with_state(state);

        for uri in [
            "/bots/bot-empty/desktop/start",
            "/bots/bot-empty/desktop/stop",
        ] {
            let resp = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(uri)
                        .extension(test_user("user-1"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        }

        // Deprovision is idempotent: no sandbox -> 204.
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/bots/bot-empty/desktop/deprovision")
                    .extension(test_user("user-1"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn screenshot_endpoint_returns_png_from_driver_exec() {
        let temp = tempfile::tempdir().unwrap().keep();
        let driver = Arc::new(MockExecutionDriver::new());
        let state = test_app_state(&temp, driver.clone()).await;
        let app = bot_desktop_router().with_state(state);

        // 1x1 transparent PNG encoded as base64.
        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        driver.set_exec_result(Ok(allternit_driver_interface::ExecResult {
            exit_code: 0,
            stdout: Some(png_b64.as_bytes().to_vec()),
            stderr: None,
            duration_ms: 12,
            resource_usage: ResourceConsumption::default(),
        }));

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/bots/bot-1/desktop/screenshot?sandbox_id=sandbox-abc")
                    .extension(test_user("user-1"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );
        let body = resp.into_body().collect().await.unwrap().to_bytes();
        assert!(!body.is_empty());
        assert!(driver.recorded().contains(&"exec:sandbox-abc".to_string()));
    }
}
