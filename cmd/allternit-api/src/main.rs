//! A2R API Server
//!
//! Provides endpoints for:
//! - Visualization rendering (charts to SVG/PNG/PDF)
//! - Sandbox code execution (VM-based)
//! - Rails System integration (Ledger, Gate, Leases, Work)
//! - Cowork Runtime (persistent remote execution)
//! - Event streaming (WebSocket)

mod rails;
mod sandbox_routes;
mod stream;
mod terminal_routes;
mod viz_routes;
mod vm_session_routes;

use axum::Router;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::info;

use rails::{rails_router, RailsState};
use sandbox_routes::sandbox_router;
use stream::stream_router;
use terminal_routes::terminal_router;
use viz_routes::viz_router;
use vm_session_routes::{new_vm_session_store, vm_session_router, VmSessionStore};

/// Application state
pub struct AppState {
    /// VM execution driver (Firecracker on Linux, Apple VF on macOS)
    pub vm_driver: Option<Box<dyn a2r_driver_interface::ExecutionDriver>>,
    /// Rails service state (Ledger, Gate, Leases, etc.)
    pub rails: RailsState,
    /// Persistent VM sessions — each gizzi-code session gets one VM that stays
    /// alive for the entire session lifetime (not torn down between exec calls).
    pub vm_sessions: VmSessionStore,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("A2R API Server starting...");
    info!("Version: 0.1.0");

    // Initialize VM driver (platform-specific)
    let vm_driver = initialize_vm_driver().await;

    // Initialize Rails service state
    let data_dir = dirs::data_dir()
        .map(|d| d.join("a2r"))
        .unwrap_or_else(|| PathBuf::from("/var/lib/a2r"));
    
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

    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
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
        "service": "a2r-api",
        "version": "0.1.0",
    }))
}

/// Initialize the appropriate VM driver for the platform
async fn initialize_vm_driver() -> Option<Box<dyn a2r_driver_interface::ExecutionDriver>> {
    #[cfg(target_os = "linux")]
    {
        use a2r_firecracker_driver::{FirecrackerConfig, FirecrackerDriver};
        use tracing::warn;

        let config = FirecrackerConfig::default();

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
        // Apple VF driver not yet implemented
        info!("Apple VF driver not yet implemented");
        return None;
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        info!("VM execution not supported on this platform");
        return None;
    }
}
