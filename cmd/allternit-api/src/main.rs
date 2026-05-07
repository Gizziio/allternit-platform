//! Allternit API Server
//!
//! Provides endpoints for:
//! - Visualization rendering (charts to SVG/PNG/PDF)
//! - Sandbox code execution (VM-based)
//! - Rails System integration (Ledger, Gate, Leases, Work)
//! - Cowork Runtime (persistent remote execution)
//! - Event streaming (WebSocket)

use axum::Router;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::info;

#[cfg(any(target_os = "linux", target_os = "macos"))]
use tracing::warn;

// Import from library
use allternit_api::AppState;
use allternit_api::chat_routes::chat_router;
use allternit_api::cowork::background_service::CoworkBackgroundService;
use allternit_api::cowork::routes::{background_router, CoworkBgState};
use allternit_api::rails::{rails_router, RailsState};
use allternit_api::sandbox_routes::sandbox_router;
use allternit_api::stream::stream_router;
use allternit_api::terminal_routes::terminal_router;
use allternit_api::viz_routes::viz_router;
use allternit_api::vm_session_routes::{new_vm_session_store, vm_session_router};
use allternit_cowork_scheduler::{Scheduler, api::ApiState};
use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("Allternit API Server starting...");
    info!("Version: 0.1.0");

    // Initialize VM driver (platform-specific)
    let vm_driver = initialize_vm_driver().await;

    // Initialize Rails service state
    let data_dir = dirs::data_dir()
        .map(|d| d.join("allternit"))
        .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"));
    
    let rails = RailsState::new(data_dir)
        .await
        .expect("Failed to initialize Rails service state");

    // Initialize cowork scheduler (optional — no-op if DB path is unset)
    let cowork_scheduler = initialize_cowork_scheduler(&data_dir).await;
    let scheduler_state = cowork_scheduler.clone().map(|s| {
        Arc::new(ApiState { scheduler: s })
    });

    // Initialize cowork background service
    let (cowork_background, bg_state) = initialize_cowork_background(&data_dir).await;

    // Create application state
    let state = Arc::new(AppState {
        vm_driver,
        rails,
        vm_sessions: new_vm_session_store(),
        cowork_scheduler,
        cowork_background,
    });

    // Build router
    let mut app = Router::new()
        // Core API routes
        .nest("/api", chat_router())
        .nest("/viz", viz_router())
        .nest("/sandbox", sandbox_router())
        // Persistent VM session API (one VM per gizzi-code agent session)
        .nest("/vm-session", vm_session_router())
        // Rails System routes
        .nest("/rails", rails_router())
        // Event streaming
        .nest("/stream", stream_router())
        // Terminal routes (for IDE extensions like Kimi For Coding)
        .nest("/terminal", terminal_router())
        // Health check
        .route("/health", axum::routing::get(health_check))
        .with_state(state);

    // Mount cowork scheduler routes if scheduler is active
    if let Some(sstate) = scheduler_state {
        app = app.nest("/cowork/scheduler", allternit_cowork_scheduler::api::api_router(sstate));
    }

    // Mount cowork background service routes if service is active
    if let Some(bstate) = bg_state {
        app = app.merge(background_router(Arc::new(bstate)));
    }

    let app = app;

    // Start server — port from ALLTERNIT_API_PORT env var, default 8013
    let port: u16 = std::env::var("ALLTERNIT_API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8013);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await.unwrap();
    info!("Server listening on {}", listener.local_addr().unwrap());
    info!("API Documentation:");
    info!("  - Visualization:  GET /viz/*");
    info!("  - Sandbox:        POST /sandbox/*");
    info!("  - VM Sessions:    POST|GET|DELETE /vm-session/*");
    info!("  - Rails System:   GET|POST /rails/*");
    info!("  - Event Stream:   WS /stream/ws/*");
    info!("  - Terminal:       POST /terminal/*");
    info!("  - Health:         GET /health");

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
