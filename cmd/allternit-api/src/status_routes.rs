use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::AppState;

#[derive(Serialize)]
struct ServiceResult {
    name: String,
    slug: String,
    status: String,
    latency_ms: Option<u64>,
    checked_at: String,
}

#[derive(Serialize)]
struct StatusResponse {
    services: Vec<ServiceResult>,
    overall: String,
    checked_at: String,
}

pub fn status_router() -> Router<Arc<AppState>> {
    Router::new().route("/status", get(status_handler))
}

async fn status_handler(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    let checked_at = chrono::Utc::now().to_rfc3339();
    let mut services = Vec::new();

    // Probe Gateway (Rust API itself). Use 127.0.0.1 explicitly so the self-check
    // is independent of how `localhost` resolves (IPv4 vs IPv6) on the host.
    let port = state.config.api_port();
    services.push(
        probe_service(
            "Gateway",
            "gateway",
            &format!("http://127.0.0.1:{}/health/live", port),
        )
        .await,
    );

    // Probe Gizzi Runtime
    let gizzi_url = state.config.terminal_server_url();
    services.push(
        probe_service(
            "Gizzi Runtime",
            "gizzi-runtime",
            &format!("{}/v1/global/health", gizzi_url),
        )
        .await,
    );

    let overall = if services.iter().any(|s| s.status == "outage") {
        "outage"
    } else if services.iter().any(|s| s.status == "degraded") {
        "degraded"
    } else {
        "operational"
    }
    .to_string();

    Json(StatusResponse {
        services,
        overall,
        checked_at,
    })
}

async fn probe_service(name: &str, slug: &str, url: &str) -> ServiceResult {
    let start = Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    let (status, latency_ms) = match client.get(url).send().await {
        Ok(res) => {
            let latency = start.elapsed().as_millis() as u64;
            if res.status().is_success() || res.status() == reqwest::StatusCode::UNAUTHORIZED {
                if latency > 800 {
                    ("degraded".to_string(), Some(latency))
                } else {
                    ("operational".to_string(), Some(latency))
                }
            } else {
                ("outage".to_string(), Some(latency))
            }
        }
        Err(_) => ("outage".to_string(), None),
    };

    ServiceResult {
        name: name.to_string(),
        slug: slug.to_string(),
        status,
        latency_ms,
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}
