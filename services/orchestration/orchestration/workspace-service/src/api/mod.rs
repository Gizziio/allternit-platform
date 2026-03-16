//! HTTP API routes for the workspace service

mod sessions;
mod panes;
mod logs;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;

use crate::state::AppState;

/// Create the API router
pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Health check
        .route("/health", get(health_check))
        // Sessions
        .route("/sessions", get(sessions::list_sessions).post(sessions::create_session))
        .route("/sessions/:id", get(sessions::get_session).delete(sessions::delete_session))
        .route("/sessions/:id/attach", post(sessions::attach_session))
        // Panes
        .route("/sessions/:id/panes", get(panes::list_panes).post(panes::create_pane))
        .route("/panes/:id", get(panes::get_pane).delete(panes::delete_pane))
        .route("/panes/:id/capture", get(panes::capture_pane))
        .route("/panes/:id/send", post(panes::send_keys))
        // Logs (WebSocket)
        .route("/panes/:id/logs", get(logs::stream_logs))
        // State
        .with_state(state)
        // CORS
        .layer(CorsLayer::permissive())
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
