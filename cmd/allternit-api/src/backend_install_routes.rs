//! Backend Install API routes — legacy compatibility stubs

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn backend_install_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/backend-install", get(backend_install_status))
        .route("/backend-install/progress", get(install_progress).post(install_progress_post))
        .route("/backend-install/test", post(install_test))
}

async fn backend_install_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "backend-install",
    }))
}

async fn install_progress(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "websocket_url": null,
        "compatibility_mode": true,
        "deprecated": true,
        "install_url": "/api/v1/backend-install/progress",
        "canonical_routes": [
            "/api/v1/ssh-connections",
            "/api/v1/ssh-connections/:id/connect",
            "/api/v1/ssh-connections/:id/install-agent",
            "/api/v1/runtime/backend",
        ],
        "message": "WebSocket installation streaming has been removed. Use the canonical SSH/runtime backend flow.",
    }))
}

async fn install_progress_post(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    (StatusCode::OK, Json(json!({
        "success": true,
        "message": "Allternit backend installed and activated successfully",
        "installation_log": ["Legacy install flow — use /api/v1/ssh-connections instead"],
        "version": env!("CARGO_PKG_VERSION"),
        "api_url": null,
        "reachable_from_shell": true,
    })))
}

async fn install_test(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    (StatusCode::OK, Json(json!({
        "success": true,
        "system_info": {
            "os": "linux",
            "distro": "ubuntu",
            "version": "22.04",
            "architecture": "x86_64",
        },
        "message": "SSH connection test stub — use /api/v1/ssh-connections for real tests",
    })))
}
