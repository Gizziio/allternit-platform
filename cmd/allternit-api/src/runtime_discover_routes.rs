//! Runtime Discover API routes

use axum::{
    extract::State,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn runtime_discover_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/runtime-discover", get(runtime_discover_status))
        .route("/runtime/discover", get(discover_runtimes))
}

async fn runtime_discover_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "runtime-discover",
    }))
}

async fn discover_runtimes(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    let port = std::env::var("ALLTERNIT_API_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8013);

    Json(json!({
        "runtimes": [
            {
                "id": "local-desktop",
                "name": "Allternit Desktop (local)",
                "type": "local",
                "status": "ready",
                "gateway_url": format!("http://127.0.0.1:{}", port),
                "version": env!("CARGO_PKG_VERSION"),
            }
        ],
        "discovered_at": chrono::Utc::now().to_rfc3339(),
    }))
}
