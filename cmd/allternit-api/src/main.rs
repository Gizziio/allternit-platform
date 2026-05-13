//! Allternit API Server
//!
//! Provides endpoints for:
//! - Chat & Agents (agent chat, conversation, artifacts)
//! - Workspaces, Memory, Files, Inbox
//! - Visualization rendering (charts to SVG/PNG/PDF)
//! - Sandbox code execution (VM-based)
//! - Rails System integration (Ledger, Gate, Leases, Work)
//! - Cowork Runtime (persistent remote execution)
//! - Event streaming (WebSocket)
//! - SSH, Swarm, Workflows, Boards

use axum::Router;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[cfg(any(target_os = "linux", target_os = "macos"))]
use tracing::warn;

// Import from library
use allternit_api::AppState;
use allternit_api::auth::auth_middleware;
use allternit_api::db::DbHandle;
use allternit_api::aci_routes::aci_router;
use allternit_api::agent_routes::agent_router;
use allternit_api::agent_runtime_routes::agent_runtime_router;
use allternit_api::agent_session_routes::agent_session_router;
use allternit_api::agents_v1_routes::agents_v1_router;
use allternit_api::alabs_routes::alabs_router;
use allternit_api::analytics_routes::analytics_router;
use allternit_api::artifact_routes::artifact_router;
use allternit_api::audit_log_routes::audit_log_router;
use allternit_api::backend_install_routes::backend_install_router;
use allternit_api::board_routes::board_router;
use allternit_api::board_stream_routes::board_stream_router;
use allternit_api::chat_routes::chat_router;
use allternit_api::checkpoints_routes::checkpoints_router;
use allternit_api::conversation_routes::conversation_router;
use allternit_api::design_connector_routes::design_connector_router;
use allternit_api::cowork::background_service::CoworkBackgroundService;
use allternit_api::cowork::routes::{background_router, CoworkBgState};
use allternit_api::cowork_routes::cowork_router;
use allternit_api::cowork_team_routes::cowork_team_router;
use allternit_api::fallback_routes::fallback_router;
use allternit_api::file_routes::file_router;
use allternit_api::h5i_routes::h5i_router;
use allternit_api::inbox_routes::inbox_router;
use allternit_api::local_brain_routes::local_brain_router;
use allternit_api::me_routes::me_router;
use allternit_api::memory_routes::memory_router;
use allternit_api::metrics::metrics_router;
use allternit_api::mcp_routes::mcp_router;
use allternit_api::oauth_routes::oauth_router;
use allternit_api::onboarding_routes::onboarding_router;
use allternit_api::platform_static::platform_router;
use allternit_api::playground_routes::playground_router;
use allternit_api::provider_routes::provider_router;
use allternit_api::rails::{rails_router, RailsState};
use allternit_api::runtime_backend_routes::runtime_backend_router;
use allternit_api::runtime_discover_routes::runtime_discover_router;
use allternit_api::sandbox_routes::sandbox_router;
use allternit_api::ssh_key_routes::ssh_key_router;
use allternit_api::ssh_routes::ssh_router;
use allternit_api::status_routes::status_router;
use allternit_api::stream::stream_router;
use allternit_api::swarm_routes::swarm_router;
use allternit_api::task_routes;
use allternit_api::team_skill_routes::team_skill_router;
use allternit_api::terminal_routes::terminal_router;
use allternit_api::tool_routes;
use allternit_api::v1_routes::{agent_chat_router, v1_router};
use allternit_api::viz_routes::viz_router;
use allternit_api::vm_session_routes::{new_vm_session_store, vm_session_router};
use allternit_api::webhook_routes::webhook_router;
use allternit_api::workflow_routes::workflow_router;
use allternit_api::workspace_routes::workspace_router;
use allternit_cowork_scheduler::{Scheduler, api::ApiState as SchedulerApiState};
use tokio::sync::RwLock;

#[tokio::main]
async fn main() {
    // Initialize tracing with filter to suppress noisy cron-scheduler errors
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| {
            tracing_subscriber::EnvFilter::new("info,tokio_cron_scheduler=off")
        });
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .init();

    info!("Allternit API Server starting...");
    info!("Version: 0.1.0");

    // Data directory for local state
    let data_dir = dirs::data_dir()
        .map(|d| d.join("allternit"))
        .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"));
    std::fs::create_dir_all(&data_dir).ok();

    // Initialize SQLite database
    let db_path = data_dir.join("allternit.db");
    let db = DbHandle::new(db_path.clone())
        .expect("Failed to initialize SQLite database");
    info!("Database ready at {}", db_path.display());

    // Initialize JWKS manager for Clerk JWT verification
    let jwks = allternit_api::auth::JwksManager::new();
    info!("JWKS manager initialized");

    // Webhook secret for Clerk webhook verification
    let webhook_secret = std::env::var("CLERK_WEBHOOK_SECRET").ok();

    // Initialize VM driver (platform-specific)
    let vm_driver = initialize_vm_driver().await;

    // Initialize Rails service state
    let rails = RailsState::new(data_dir.clone())
        .await
        .expect("Failed to initialize Rails service state");

    // Initialize cowork scheduler (optional — no-op if DB path is unset)
    let cowork_scheduler = initialize_cowork_scheduler(&data_dir).await;
    let scheduler_state = cowork_scheduler.clone().map(|s| {
        Arc::new(SchedulerApiState { scheduler: s })
    });

    // Initialize cowork background service
    let (cowork_background, bg_state) = initialize_cowork_background(&data_dir).await;

    // Create application state
    let state = Arc::new(AppState {
        db,
        jwks,
        vm_driver,
        rails,
        vm_sessions: new_vm_session_store(),
        cowork_scheduler,
        cowork_background,
        webhook_secret,
    });

    // ── Build V1 API routes (all merged, then nested under /api/v1) ───────────
    let v1_routes = provider_router()
        .merge(inbox_router())
        .merge(file_router())
        .merge(memory_router())
        .merge(me_router())
        .merge(local_brain_router())
        .merge(workflow_router())
        .merge(ssh_router())
        .merge(swarm_router())
        .merge(board_router())
        .merge(cowork_router())
        .merge(agent_router())
        .merge(agent_session_router())
        .merge(v1_router())
        .merge(task_routes::task_router())
        .merge(audit_log_router())
        .merge(ssh_key_router())
        .merge(team_skill_router())
        .merge(agent_runtime_router())
        .merge(backend_install_router())
        .merge(runtime_discover_router())
        .merge(cowork_team_router())
        .merge(board_stream_router())
        .merge(runtime_backend_router())
        .merge(agents_v1_router())
        .merge(workspace_router())
        .merge(artifact_router())
        .merge(conversation_router())
        .merge(alabs_router());

    // ── Protected routes (require authentication) ─────────────────────────────
    let protected = Router::new()
        .nest("/api/v1", v1_routes)
        // API routes (not under /v1)
        .nest("/api", chat_router())
        .nest("/api", agent_chat_router())
        .nest("/api", tool_routes::tool_router())
        .nest("/api", local_brain_router())
        // Feature routes
        .nest("/viz", viz_router())
        .nest("/sandbox", sandbox_router())
        .nest("/vm-session", vm_session_router())
        .nest("/rails", rails_router())
        .nest("/api/rails", rails_router())
        .nest("/stream", stream_router())
        .nest("/terminal", terminal_router())
        .nest("/mcp", mcp_router())
        .nest("/platform", platform_router())
        .nest("/metrics", metrics_router())
        .nest("/api", h5i_router())
        .nest("/api", oauth_router())
        .nest("/api", onboarding_router())
        .nest("/api", aci_router())
        .nest("/api", analytics_router())
        .nest("/api", playground_router())
        .nest("/api", checkpoints_router())
        .nest("/api", design_connector_router())
        .nest("/api", provider_router())
        // Auth middleware applied to everything above
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    // ── Public routes (no authentication required) ────────────────────────────
    let public = Router::new()
        .route("/health", axum::routing::get(health_check))
        .merge(status_router())
        .merge(webhook_router())
        .merge(fallback_router());

    // Combine protected + public, then apply state
    let mut app = protected.merge(public).with_state(state.clone());

    // Mount cowork scheduler routes if scheduler is active
    if let Some(sstate) = scheduler_state {
        app = app.nest("/cowork/scheduler", allternit_cowork_scheduler::api::api_router(sstate));
    }

    // Mount cowork background service routes if service is active
    if let Some(bstate) = bg_state {
        app = app.merge(background_router(Arc::new(bstate)));
    }

    // Apply CORS for local dev
    let app = app.layer(
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any),
    );

    // Start server — port from ALLTERNIT_API_PORT env var, default 8013
    let port: u16 = std::env::var("ALLTERNIT_API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8013);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await.unwrap();
    info!("Server listening on {}", listener.local_addr().unwrap());
    info!("API Documentation:");
    info!("  - Health:         GET /health");
    info!("  - Status:         GET /status");
    info!("  - Chat:           POST /api/agent-chat");
    info!("  - Agents:         GET|POST /api/v1/agents");
    info!("  - Workspaces:     GET|POST /api/workspaces");
    info!("  - Memory:         GET|POST /api/v1/memory");
    info!("  - Files:          GET|POST /api/v1/files");
    info!("  - Inbox:          GET|POST /api/v1/inbox");
    info!("  - Visualization:  GET /viz/*");
    info!("  - Sandbox:        POST /sandbox/*");
    info!("  - VM Sessions:    POST|GET|DELETE /vm-session/*");
    info!("  - Rails System:   GET|POST /rails/*");
    info!("  - Event Stream:   WS /stream/ws/*");
    info!("  - Terminal:       POST /terminal/*");
    info!("  - Webhooks:       POST /webhooks/clerk/*");

    axum::serve(listener, app).await.unwrap();
}

/// Initialize the cowork background service (autonomous loop) backed by SQLite.
async fn initialize_cowork_background(
    data_dir: &std::path::Path,
) -> (
    Option<allternit_api::cowork::background_service::BackgroundServiceHandle>,
    Option<CoworkBgState>,
) {
    let db_path = data_dir.join("cowork-background.db");
    match CoworkBackgroundService::new(&db_path) {
        Ok(svc) => {
            let handle = svc.handle();
            let shared = Arc::new(svc);
            CoworkBackgroundService::start(shared);
            info!("Cowork background service started (db: {})", db_path.display());
            let bg_state = CoworkBgState { handle: handle.clone() };
            (Some(handle), Some(bg_state))
        }
        Err(e) => {
            tracing::warn!("Cowork background service init failed: {e}");
            (None, None)
        }
    }
}

/// Initialize the cowork task scheduler backed by SQLite.
async fn initialize_cowork_scheduler(data_dir: &std::path::Path) -> Option<Arc<RwLock<Scheduler>>> {
    let db_path = data_dir.join("cowork-schedules.db");
    let api_url = format!(
        "http://localhost:{}",
        std::env::var("ALLTERNIT_API_PORT").unwrap_or_else(|_| "8013".to_string())
    );

    match Scheduler::new(&db_path, api_url).await {
        Ok(scheduler) => {
            let shared = Arc::new(RwLock::new(scheduler));
            let s = shared.clone();
            if let Err(e) = s.read().await.start().await {
                tracing::warn!("Cowork scheduler start failed: {e}");
                return None;
            }
            info!("Cowork scheduler started (db: {})", db_path.display());
            Some(shared)
        }
        Err(e) => {
            tracing::warn!("Cowork scheduler init failed: {e}");
            None
        }
    }
}

/// Health check endpoint
async fn health_check() -> impl axum::response::IntoResponse {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "service": "allternit-api",
        "version": "0.1.0",
    }))
}

/// Initialize the appropriate VM driver for the platform
async fn initialize_vm_driver() -> Option<Box<dyn allternit_driver_interface::ExecutionDriver>> {
    // Get packaged VM directory from desktop app (if available)
    let vm_dir = std::env::var("ALLTERNIT_VM_DIR").ok().filter(|s| !s.is_empty());
    if let Some(ref dir) = vm_dir {
        info!("Using packaged VM directory: {}", dir);
    }

    #[cfg(target_os = "linux")]
    {
        use allternit_firecracker_driver::{FirecrackerConfig, FirecrackerDriver};

        let mut config = FirecrackerConfig::default();
        
        // Use packaged VM directory if available
        if let Some(dir) = vm_dir {
            config.images_dir = std::path::PathBuf::from(dir);
        }

        match FirecrackerDriver::new(config).await {
            Ok(driver) => {
                info!("Firecracker driver initialized");
                return Some(Box::new(driver));
            }
            Err(e) => {
                warn!("Failed to initialize Firecracker driver: {}", e);
                info!("Running without VM execution (visualization only)");
                return None;
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use allternit_apple_vf_driver::{AppleVFConfig, AppleVFDriver};

        let mut config = AppleVFConfig::default();
        
        // Use packaged VM directory if available
        if let Some(dir) = vm_dir {
            config.vm_storage_dir = std::path::PathBuf::from(&dir).join("vms");
            config.images_dir = std::path::PathBuf::from(&dir).join("images");
        }

        // Detect lume binary next to current executable
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let lume_path = exe_dir.join("lume");
                if lume_path.exists() {
                    info!("Found Lume binary at: {}", lume_path.display());
                    config = config.with_lume_bin(lume_path);
                }
            }
        }

        match AppleVFDriver::with_config(config) {
            Ok(driver) => {
                info!("Apple VF driver initialized (powered by Lume)");
                return Some(Box::new(driver));
            }
            Err(e) => {
                warn!("Failed to initialize Apple VF driver: {}", e);
                info!("Running without VM execution (visualization only)");
                return None;
            }
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        info!("VM execution not supported on this platform");
        return None;
    }
}
