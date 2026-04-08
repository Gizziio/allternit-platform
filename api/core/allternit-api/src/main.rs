//! Allternit API Server
//!
//! Bundled backend for Allternit Desktop. Provides:
//! - `/platform`      — Next.js platform UI (static file serving)
//! - `/viz`           — Visualization rendering (SVG/PNG/PDF)
//! - `/sandbox`       — Sandbox code execution (VM-based)
//! - `/vm-session`    — Persistent VM session management
//! - `/rails`         — Rails System (Ledger, Gate, Leases, Work)
//! - `/stream`        — WebSocket event streaming
//! - `/terminal`      — Interactive terminal (tmux-backed)
//! - `/health`        — Health check (no auth required)
//!
//! Configuration (env vars):
//!   ALLTERNIT_API_PORT          — listen port (default: 8013)
//!   ALLTERNIT_API_HOST          — listen host (default: 127.0.0.1)
//!   ALLTERNIT_OPERATOR_API_KEY  — bearer token required for all API routes
//!   ALLTERNIT_PLATFORM_STATIC   — path to Next.js static export (default: auto-detected)
//!   ALLTERNIT_DATA_DIR          — data directory (default: platform data dir / allternit)
//!   ALLTERNIT_TERMINAL_BACKEND  — terminal backend: "tmux" | "sidecar" (default: tmux)

mod auth;
mod platform_static;
mod pty;
mod rails;
mod sandbox_routes;
mod sidecar_protocol;
mod sidecar_runtime;
mod stream;
mod terminal_routes;
mod terminal_runtime;
mod terminal_sidecar_client;
mod viz_routes;
mod vm_session_routes;

use axum::{
    middleware,
    routing::get,
    Router,
};
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use platform_static::platform_router;
use rails::{rails_router, RailsState};
use sandbox_routes::sandbox_router;
use sidecar_runtime::SidecarTerminalRuntime;
use stream::stream_router;
use terminal_routes::terminal_router;
use terminal_runtime::{TerminalRuntime, TmuxTerminalRuntime};
use viz_routes::viz_router;
use vm_session_routes::{new_vm_session_store, vm_session_router, VmSessionStore};

// ─── Application state ────────────────────────────────────────────────────────

pub struct AppState {
    /// VM execution driver (Firecracker on Linux, Apple VF on macOS)
    pub vm_driver: Option<Box<dyn allternit_driver_interface::ExecutionDriver>>,
    /// Rails service state (Ledger, Gate, Leases, etc.)
    pub rails: RailsState,
    /// Persistent VM sessions — one VM per gizzi-code agent session
    pub vm_sessions: VmSessionStore,
    /// Interactive terminal runtime
    pub terminal_runtime: Arc<dyn TerminalRuntime>,
}

// ─── Entry point ─────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let port: u16 = std::env::var("ALLTERNIT_API_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8013);

    let host = std::env::var("ALLTERNIT_API_HOST")
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    let api_key = std::env::var("ALLTERNIT_OPERATOR_API_KEY").ok();

    info!("Allternit API Server starting…");
    info!("Version: {}", env!("CARGO_PKG_VERSION"));
    info!("Listening on {}:{}", host, port);

    if api_key.is_none() {
        tracing::warn!("ALLTERNIT_OPERATOR_API_KEY not set — API routes are unauthenticated");
    }

    // Data directory
    let data_dir = std::env::var("ALLTERNIT_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::data_dir()
                .map(|d| d.join("allternit"))
                .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"))
        });

    std::fs::create_dir_all(&data_dir).ok();

    // VM driver
    let vm_driver = initialize_vm_driver().await;

    // Rails state
    let rails = RailsState::new(data_dir.clone())
        .await
        .expect("Failed to initialize Rails service state");

    // Terminal runtime
    let terminal_runtime = build_terminal_runtime(data_dir.join("terminal-sessions"));

    let state = Arc::new(AppState {
        vm_driver,
        rails,
        vm_sessions: new_vm_session_store(),
        terminal_runtime,
    });

    // Background: cleanup expired terminal sessions
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(e) = cleanup_state.terminal_runtime.cleanup_expired_sessions().await {
                tracing::warn!("terminal cleanup failed: {}", e);
            }
        }
    });

    // CORS — tightened: only allow the local origin served by the desktop
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // ── Routes ──────────────────────────────────────────────────────────────

    // Public routes — no auth
    let public = Router::new()
        .route("/health", get(health_check))
        // Platform UI static files — auth not required (Electron loads this directly)
        .merge(platform_router());

    // Protected API routes — require bearer token
    let api = Router::new()
        .nest("/viz", viz_router())
        .nest("/sandbox", sandbox_router().with_state(state.clone()))
        .nest("/vm-session", vm_session_router().with_state(state.clone()))
        .nest("/rails", rails_router(state.rails.clone()))
        .nest("/stream", stream_router().with_state(state.rails.clone()))
        .nest("/terminal", terminal_router().with_state(state.clone()));

    // Apply bearer token auth to API routes only if key is configured
    let api = if let Some(key) = api_key {
        api.layer(middleware::from_fn(move |req, next| {
            let key = key.clone();
            auth::require_bearer(key, req, next)
        }))
    } else {
        api
    };

    let app = Router::new()
        .merge(public)
        .merge(api)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", host, port))
        .await
        .unwrap();

    info!("Routes:");
    info!("  GET  /health           — health check");
    info!("  GET  /platform/*       — Next.js platform UI");
    info!("  *    /viz/*            — visualization (auth required)");
    info!("  *    /sandbox/*        — sandbox execution (auth required)");
    info!("  *    /vm-session/*     — VM sessions (auth required)");
    info!("  *    /rails/*          — Rails system (auth required)");
    info!("  WS   /stream/ws/*      — event streaming (auth required)");
    info!("  *    /terminal/*       — terminal (auth required)");

    axum::serve(listener, app).await.unwrap();
}

// ─── Health check ─────────────────────────────────────────────────────────────

async fn health_check() -> impl axum::response::IntoResponse {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "service": "allternit-api",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn build_terminal_runtime(session_dir: PathBuf) -> Arc<dyn TerminalRuntime> {
    match std::env::var("ALLTERNIT_TERMINAL_BACKEND")
        .unwrap_or_else(|_| "tmux".to_string())
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "sidecar" | "node-pty-sidecar" => match SidecarTerminalRuntime::from_env() {
            Ok(runtime) => {
                info!("Using sidecar terminal runtime");
                Arc::new(runtime)
            }
            Err(e) => {
                tracing::warn!("Sidecar terminal runtime failed ({}), falling back to tmux", e);
                Arc::new(TmuxTerminalRuntime::new(pty::PtyManager::new(session_dir)))
            }
        },
        _ => {
            info!("Using tmux terminal runtime");
            Arc::new(TmuxTerminalRuntime::new(pty::PtyManager::new(session_dir)))
        }
    }
}

async fn initialize_vm_driver() -> Option<Box<dyn allternit_driver_interface::ExecutionDriver>> {
    #[cfg(target_os = "linux")]
    {
        use tracing::warn;
        // Firecracker driver — Linux only
        #[cfg(feature = "vm-driver")]
        {
            use allternit_firecracker_driver::{FirecrackerConfig, FirecrackerDriver};
            let config = FirecrackerConfig::default();
            match FirecrackerDriver::new(config).await {
                Ok(driver) => {
                    info!("Firecracker VM driver initialized");
                    return Some(Box::new(driver));
                }
                Err(e) => {
                    warn!("Firecracker driver unavailable: {} — running without VM execution", e);
                    return None;
                }
            }
        }
        #[cfg(not(feature = "vm-driver"))]
        {
            info!("VM driver feature disabled — running without VM execution");
            return None;
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: VM managed by the Swift AllternitVMManager sidecar via VSOCK.
        // The Rust API does not directly drive the VM on macOS.
        info!("macOS: VM managed by AllternitVMManager (Swift). Rust API running without direct VM driver.");
        return None;
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        info!("VM execution not supported on this platform");
        return None;
    }
}
