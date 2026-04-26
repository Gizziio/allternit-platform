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
use allternit_api::rails::{rails_router, RailsState};
use allternit_api::sandbox_routes::sandbox_router;
use allternit_api::stream::stream_router;
use allternit_api::terminal_routes::terminal_router;
use allternit_api::viz_routes::viz_router;
use allternit_api::vm_session_routes::{new_vm_session_store, vm_session_router};

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

    // Create application state
    let state = Arc::new(AppState {
        vm_driver,
        rails,
        vm_sessions: new_vm_session_store(),
    });

    // Build router
    let app = Router::new()
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
