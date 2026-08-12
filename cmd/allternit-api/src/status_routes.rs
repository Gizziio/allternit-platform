use axum::{extract::State, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
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
    Router::new()
        .route("/status", get(status_handler))
        .route("/regions", get(regions_handler))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Region {
    id: String,
    name: String,
    location: String,
    #[serde(default)]
    egress_ips: Vec<String>,
}

fn load_regions() -> Vec<Region> {
    std::env::var("ALLTERNIT_REGIONS")
        .ok()
        .and_then(|value| serde_json::from_str::<Vec<Region>>(&value).ok())
        .unwrap_or_default()
}

async fn regions_handler() -> Json<Value> {
    let regions = load_regions();
    Json(json!({
        "object": "list",
        "data": regions,
    }))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn region_json_parses() {
        let raw = r#"[{"id":"us-east","name":"US East","location":"Virginia","egress_ips":["192.0.2.0/24"]}]"#;
        let regions: Vec<Region> = serde_json::from_str(raw).unwrap();
        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0].id, "us-east");
        assert_eq!(regions[0].egress_ips, vec!["192.0.2.0/24"]);
    }

    #[test]
    fn region_missing_ips_defaults_empty() {
        let raw = r#"[{"id":"eu-west","name":"EU West","location":"Ireland"}]"#;
        let regions: Vec<Region> = serde_json::from_str(raw).unwrap();
        assert!(regions[0].egress_ips.is_empty());
    }
}
