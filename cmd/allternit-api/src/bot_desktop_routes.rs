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
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::auth::AuthUser;
use crate::AppState;
use crate::{BotDesktopControlState, BotDesktopSession};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use allternit_agent_system_rails::core::types::{Actor, ActorType, AllternitEvent, EventScope};
use allternit_driver_interface::{
    DesktopEndpoint, DesktopProtocol, DriverError, EnvironmentSpec, ExecutionHandle, ExecutionId,
    NetworkPolicy, PolicySpec, ResourceSpec, SpawnSpec, TenantId,
};

pub fn bot_desktop_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/bots/:bot_id/desktop", get(get_desktop_status))
        .route("/bots/:bot_id/desktop", delete(destroy_desktop))
        .route("/bots/:bot_id/desktop/provision", post(provision_desktop))
        .route("/bots/:bot_id/desktop/observe", post(observe_desktop))
        .route("/bots/:bot_id/desktop/take-over", post(take_over_desktop))
        .route("/bots/:bot_id/desktop/hand-back", post(hand_back_desktop))
        .route("/bots/:bot_id/desktop/start", post(start_desktop))
        .route("/bots/:bot_id/desktop/stop", post(stop_desktop))
        .route("/bots/:bot_id/desktop/pause", post(pause_desktop))
        .route("/bots/:bot_id/desktop/resume", post(resume_desktop))
        .route("/bots/:bot_id/desktop/screenshot", post(screenshot_desktop))
}

#[derive(Debug, Deserialize)]
pub struct DesktopQuery {
    /// OpenSandbox sandbox id for the bot's persistent virtual computer.
    sandbox_id: String,
}

#[derive(Debug, Serialize)]
pub struct DesktopStatusResponse {
    pub status: String,
    pub control_state: String,
    pub ws_url: Option<String>,
    pub protocol: String,
    pub sandbox_id: String,
    pub provider: Option<String>,
    pub host: Option<String>,
    pub viewer_url: Option<String>,
    pub last_error: Option<String>,
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

/// Persistent mapping stored in SQLite.
#[derive(Debug, Clone)]
struct BotDesktopSandboxRecord {
    bot_id: String,
    sandbox_id: String,
    provider: String,
    host: Option<String>,
    status: String,
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

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) if r.sandbox_id == query.sandbox_id => Some(r),
        _ => None,
    };

    // The persisted record is the source of truth for lifecycle state. Only when
    // it says running do we try to resolve a live desktop endpoint.
    let (status, endpoint, last_error) = match record.as_ref().map(|r| r.status.as_str()) {
        Some("running") | Some("creating") => {
            match resolve_desktop_endpoint(&state, &bot_id, &query.sandbox_id).await {
                Ok(Some(ep)) => ("running".to_string(), Some(ep), None),
                Ok(None) => ("off".to_string(), None, Some("Desktop endpoint is not reachable".to_string())),
                Err(e) => {
                    warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to resolve desktop endpoint");
                    ("error".to_string(), None, Some(e.to_string()))
                }
            }
        }
        Some("stopped") => ("stopped".to_string(), None, None),
        Some("error") => ("error".to_string(), None, Some("Sandbox is in an error state".to_string())),
        _ => ("off".to_string(), None, None),
    };

    let (ws_url, protocol, viewer_url) = match endpoint {
        Some(ep) => {
            // Only the raw VNC protocol is proxied through the WebSocket handler.
            // noVNC HTTP endpoints are served directly by OpenSandbox and should
            // not be tunnelled through the platform API in v1.
            let ws_url = if matches!(ep.protocol, DesktopProtocol::Vnc) {
                Some(build_ws_url(&state, &bot_id, &query.sandbox_id, &user.user_id))
            } else {
                None
            };
            let viewer_url = if matches!(ep.protocol, DesktopProtocol::NoVncHttp) {
                Some(ep.url.clone())
            } else {
                None
            };
            (ws_url, Some(ep.protocol), viewer_url)
        }
        None => (None, None, None),
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
        provider: record.as_ref().map(|r| r.provider.clone()),
        host: record.as_ref().and_then(|r| r.host.clone()),
        viewer_url,
        last_error,
        taken_over_by_user_id: session.as_ref().and_then(|s| s.taken_over_by_user_id.clone()),
        taken_over_at: session.as_ref().and_then(|s| s.taken_over_at.map(|t| t.to_rfc3339())),
    };

    Json(response).into_response()
}

async fn provision_desktop(
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

    if !driver.supports_desktop() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "The configured VM driver does not expose a remote desktop stream. \
                          Set OPEN_SANDBOX_URL to use OpenSandbox for bot desktops."
            })),
        )
            .into_response();
    }

    let tenant_id = match TenantId::new(format!("bot-{}", bot_id)) {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("invalid bot tenant id: {}", e)})),
            )
                .into_response();
        }
    };

    let desktop_image = std::env::var("BOT_DESKTOP_IMAGE")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "ubuntu-24.04-desktop".to_string());

    let env = EnvironmentSpec {
        spec_type: allternit_driver_interface::EnvSpecType::Oci,
        image: desktop_image,
        version: None,
        packages: vec![],
        env_vars: {
            let mut env = std::collections::HashMap::new();
            env.insert("ALLTERNIT_BOT_ID".to_string(), bot_id.clone());
            env.insert("ALLTERNIT_USER_ID".to_string(), user.user_id.clone());
            env
        },
        working_dir: Some("/workspace".to_string()),
        mounts: vec![],
    };

    let network_policy = NetworkPolicy {
        egress_allowed: true,
        allowed_hosts: vec![],
        allowed_ports: vec![],
        dns_allowed: true,
    };

    let mut policy = PolicySpec::default_permissive();
    policy.network_policy = network_policy;

    let resources = ResourceSpec {
        cpu_millis: 2000,
        memory_mib: 4096,
        disk_mib: Some(20480),
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
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to provision desktop sandbox: {}", e)})),
            )
                .into_response();
        }
    };

    let driver_info = handle.driver_info;
    let sandbox_id = driver_info
        .get("native_id")
        .cloned()
        .unwrap_or_else(|| handle.id.to_string());
    let host = driver_info.get("host").cloned();
    let provider = "opensandbox".to_string();

    if let Err(e) = upsert_bot_sandbox(
        &state.db,
        &bot_id,
        &sandbox_id,
        &provider,
        host.as_deref(),
        "creating",
    ) {
        warn!(bot_id, sandbox_id, error = %e, "Failed to persist bot desktop sandbox");
    }

    info!(bot_id, sandbox_id, provider, "Bot desktop sandbox provisioned");

    Json(ProvisionDesktopResponse {
        sandbox_id,
        status: "creating".to_string(),
        provider,
        host,
    })
    .into_response()
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

async fn start_desktop(
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

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) if r.sandbox_id == query.sandbox_id => r,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "desktop sandbox not found"})),
            )
                .into_response();
        }
    };

    if let Some(driver) = state.vm_driver.as_ref() {
        let handle = build_handle_from_record(&record, &bot_id);
        if let Err(e) = driver.resume_vm(&handle).await {
            warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to resume desktop sandbox");
        }
    }

    if let Err(e) = upsert_bot_sandbox(
        &state.db,
        &bot_id,
        &record.sandbox_id,
        &record.provider,
        record.host.as_deref(),
        "running",
    ) {
        warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to update desktop sandbox status");
    }

    publish_desktop_event(&state, &bot_id, "bot.desktop.started", &user.user_id).await;

    Json(json!({ "status": "running", "sandbox_id": query.sandbox_id })).into_response()
}

async fn stop_desktop(
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

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) if r.sandbox_id == query.sandbox_id => r,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "desktop sandbox not found"})),
            )
                .into_response();
        }
    };

    if let Some(driver) = state.vm_driver.as_ref() {
        let handle = build_handle_from_record(&record, &bot_id);
        if let Err(e) = driver.pause_vm(&handle).await {
            warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to pause desktop sandbox");
        }
    }

    if let Err(e) = upsert_bot_sandbox(
        &state.db,
        &bot_id,
        &record.sandbox_id,
        &record.provider,
        record.host.as_deref(),
        "stopped",
    ) {
        warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to update desktop sandbox status");
    }

    publish_desktop_event(&state, &bot_id, "bot.desktop.stopped", &user.user_id).await;

    Json(json!({ "status": "stopped", "sandbox_id": query.sandbox_id })).into_response()
}

async fn pause_desktop(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopQuery>,
) -> impl IntoResponse {
    // Pause is the same lifecycle action as stop for bot desktops; the difference
    // is semantic in the UI (pause keeps the sandbox around, stop powers it down).
    stop_desktop(State(state), Extension(user), Path(bot_id), Query(query)).await
}

async fn resume_desktop(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopQuery>,
) -> impl IntoResponse {
    // Resume is the same lifecycle action as start.
    start_desktop(State(state), Extension(user), Path(bot_id), Query(query)).await
}

async fn destroy_desktop(
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

    let record = match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) if r.sandbox_id == query.sandbox_id => Some(r),
        _ => None,
    };

    if let Some(record) = record {
        if let Some(driver) = state.vm_driver.as_ref() {
            let handle = build_handle_from_record(&record, &bot_id);
            if let Err(e) = driver.destroy(&handle).await {
                warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to destroy desktop sandbox");
            }
        }
    }

    if let Err(e) = delete_bot_sandbox(&state.db, &bot_id) {
        warn!(bot_id, sandbox_id = %query.sandbox_id, error = %e, "Failed to delete desktop sandbox record");
    }

    {
        let mut sessions = state.bot_desktop_sessions.write().await;
        sessions.remove(&bot_id);
    }

    publish_desktop_event(&state, &bot_id, "bot.desktop.destroyed", &user.user_id).await;

    StatusCode::NO_CONTENT.into_response()
}

async fn screenshot_desktop(
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

    // Only OpenSandbox-backed sandboxes currently expose a screenshot endpoint.
    // In other configurations we return 204 so the UI can show a placeholder.
    match read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(r)) if r.sandbox_id == query.sandbox_id && r.provider == "opensandbox" => {}
        _ => {
            return StatusCode::NO_CONTENT.into_response();
        }
    }

    let Some(base_url) = std::env::var("OPEN_SANDBOX_URL")
        .ok()
        .filter(|s| !s.is_empty())
    else {
        return StatusCode::NO_CONTENT.into_response();
    };

    let url = format!(
        "{}/sandboxes/{}/screenshot",
        base_url.trim_end_matches('/'),
        urlencoding::encode(&query.sandbox_id)
    );

    let client = reqwest::Client::new();
    match client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(resp) if resp.status().is_success() => {
            match resp.bytes().await {
                Ok(bytes) => {
                    let png = STANDARD.encode(&bytes);
                    let mime = "image/png";
                    Json(json!({ "png": png, "mime": mime })).into_response()
                }
                Err(e) => {
                    warn!(bot_id, error = %e, "Failed to read screenshot bytes");
                    StatusCode::NO_CONTENT.into_response()
                }
            }
        }
        Ok(resp) => {
            debug!(bot_id, status = %resp.status(), "OpenSandbox screenshot endpoint returned non-success");
            StatusCode::NO_CONTENT.into_response()
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to request screenshot from OpenSandbox");
            StatusCode::NO_CONTENT.into_response()
        }
    }
}

fn build_handle_from_record(record: &BotDesktopSandboxRecord, bot_id: &str) -> ExecutionHandle {
    let mut driver_info = std::collections::HashMap::new();
    driver_info.insert("native_id".to_string(), record.sandbox_id.clone());
    if let Some(host) = &record.host {
        driver_info.insert("host".to_string(), host.clone());
    }
    ExecutionHandle {
        id: ExecutionId::new(),
        tenant: TenantId::new(format!("bot-{}", bot_id)).unwrap_or_else(|_| TenantId::new("bot-unknown".to_string()).unwrap()),
        driver_info,
        env_spec: EnvironmentSpec {
            spec_type: allternit_driver_interface::EnvSpecType::Oci,
            image: "ubuntu-24.04-desktop".to_string(),
            version: None,
            packages: vec![],
            env_vars: std::collections::HashMap::new(),
            working_dir: Some("/workspace".to_string()),
            mounts: vec![],
        },
    }
}

async fn verify_bot_ownership(state: &AppState, user_id: &str, bot_id: &str) -> bool {
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

fn build_ws_url(_state: &AppState, bot_id: &str, sandbox_id: &str, user_id: &str) -> String {
    // In production this should be a short-lived signed token. For v1 we pass
    // the user id in a simple signed-style query param; the WebSocket handler
    // re-verifies bot ownership before proxying.
    format!(
        "/ws/bots/{}/desktop/vnc?sandbox_id={}&user_id={}",
        bot_id,
        urlencoding::encode(sandbox_id),
        urlencoding::encode(user_id)
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

fn read_bot_sandbox(
    db: &crate::db::DbHandle,
    bot_id: &str,
) -> Result<Option<BotDesktopSandboxRecord>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT bot_id, sandbox_id, provider, host, status
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
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO bot_desktop_sandboxes (bot_id, sandbox_id, provider, host, status)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(bot_id) DO UPDATE SET
             sandbox_id = excluded.sandbox_id,
             provider = excluded.provider,
             host = excluded.host,
             status = excluded.status",
        rusqlite::params![bot_id, sandbox_id, provider, host, status],
    )?;
    Ok(())
}

fn delete_bot_sandbox(db: &crate::db::DbHandle, bot_id: &str) -> Result<(), rusqlite::Error> {
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
