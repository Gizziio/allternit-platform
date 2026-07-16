//! Runtime Discover API routes

use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
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

async fn discover_runtimes(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let port = state.config.api_port();
    let gateway_url = format!("http://127.0.0.1:{}", port);
    let gizzi_url = state.config.terminal_server_url();

    // Real probe: the local desktop runtime is only "ready" if the gizzi brain
    // runtime actually answers. No hardcoded status — curl-verifiable, flips to
    // "degraded" when gizzi is unreachable.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
        .ok();
    let (gizzi_reachable, gizzi_http) = match client {
        Some(c) => {
            let url = format!("{}/health", gizzi_url.trim_end_matches('/'));
            match c.get(&url).send().await {
                Ok(r) => {
                    let code = r.status().as_u16();
                    (r.status().is_success(), Some(code))
                }
                Err(_) => (false, None::<u16>),
            }
        }
        None => (false, None::<u16>),
    };

    let status = if gizzi_reachable { "ready" } else { "degraded" };

    Json(json!({
        "runtimes": [
            {
                "id": "local-desktop",
                "name": "Allternit Desktop (local)",
                "type": "local",
                "status": status,
                "gateway_url": gateway_url,
                "gizzi_url": gizzi_url,
                "gizzi_reachable": gizzi_reachable,
                "gizzi_http": gizzi_http,
                "version": env!("CARGO_PKG_VERSION"),
            }
        ],
        "discovered_at": chrono::Utc::now().to_rfc3339(),
    }))
}
