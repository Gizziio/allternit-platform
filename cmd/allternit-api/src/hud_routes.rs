//! Allternit HUD routes — live operational dashboard for the local platform.
//!
//! Mirrors the Hermes HUD pattern: read-only collectors that aggregate state
//! from the local runtime, computer-use gateway, Rails peers, and recordings.
//! All endpoints are nested under `/api/v1/hud` and protected by Clerk auth.

use axum::{
    extract::State,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, warn};

use crate::AppState;

/// Router exposing `/api/v1/hud/*`.
pub fn hud_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/hud/summary", get(hud_summary))
        .route("/hud/peers", get(hud_peers))
        .route("/hud/recordings", get(hud_recordings))
        .route("/hud/health", get(hud_health))
}

// ─── Shared response shapes ─────────────────────────────────────────────────

#[derive(Serialize)]
struct HudSummary {
    collected_at: String,
    gateway: GatewaySummary,
    peers: Vec<HudPeer>,
    recordings: Vec<HudRecording>,
    local_runtime: LocalRuntimeSummary,
}

#[derive(Serialize)]
struct GatewaySummary {
    url: String,
    reachable: bool,
    health: serde_json::Value,
    sessions: Vec<serde_json::Value>,
}

#[derive(Serialize)]
struct HudPeer {
    peer_id: String,
    name: String,
    vendor: String,
    status: String,
    registered_at: String,
    last_heartbeat_at: String,
}

#[derive(Serialize)]
struct HudRecording {
    id: String,
    recorded_at: String,
    size_bytes: u64,
    path: String,
}

#[derive(Serialize)]
struct LocalRuntimeSummary {
    api_port: u16,
    gizzi_url: String,
    gizzi_reachable: bool,
    acu_url: String,
}

#[derive(Serialize)]
struct HudHealth {
    platform: PlatformHealth,
    gateway: GatewayHealth,
}

#[derive(Serialize)]
struct PlatformHealth {
    status: &'static str,
    api_port: u16,
    gizzi_reachable: bool,
}

#[derive(Serialize)]
struct GatewayHealth {
    url: String,
    reachable: bool,
    health: serde_json::Value,
}

#[derive(Deserialize)]
struct PeerRegistry {
    peers: std::collections::HashMap<String, PeerEntry>,
}

#[derive(Deserialize)]
struct PeerEntry {
    peer_id: String,
    name: String,
    vendor: String,
    registered_at: String,
    last_heartbeat_at: String,
    status: String,
}

// ─── Summary ────────────────────────────────────────────────────────────────

async fn hud_summary(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let acu_url = state.config.acu_url();
    let gizzi_url = state.config.terminal_server_url();

    let (gateway_reachable, gateway_health, gateway_sessions) =
        tokio::join!(
            probe_acu_health(&acu_url),
            fetch_acu_health(&acu_url),
            fetch_acu_sessions(&acu_url),
        );

    let peers = tokio::task::spawn_blocking({
        let data_dir = state.data_dir.clone();
        move || collect_peers(&data_dir)
    })
    .await
    .unwrap_or_default();

    let recordings = tokio::task::spawn_blocking({
        let data_dir = state.data_dir.clone();
        move || collect_recordings(&data_dir)
    })
    .await
    .unwrap_or_default();

    let gizzi_reachable = probe_gizzi_health(&gizzi_url).await;

    Json(HudSummary {
        collected_at: chrono::Utc::now().to_rfc3339(),
        gateway: GatewaySummary {
            url: acu_url.clone(),
            reachable: gateway_reachable,
            health: gateway_health.unwrap_or_else(|_| json!({"status": "unknown"})),
            sessions: gateway_sessions.unwrap_or_default(),
        },
        peers,
        recordings,
        local_runtime: LocalRuntimeSummary {
            api_port: state.config.api_port(),
            gizzi_url: gizzi_url.clone(),
            gizzi_reachable,
            acu_url,
        },
    })
}

// ─── Peers ──────────────────────────────────────────────────────────────────

async fn hud_peers(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let peers = tokio::task::spawn_blocking({
        let data_dir = state.data_dir.clone();
        move || collect_peers(&data_dir)
    })
    .await
    .unwrap_or_default();

    Json(json!({ "peers": peers }))
}

fn collect_peers(data_dir: &std::path::Path) -> Vec<HudPeer> {
    let registry_path = data_dir.join("peers").join("registry.json");
    let contents = match std::fs::read_to_string(&registry_path) {
        Ok(c) => c,
        Err(error) => {
            debug!(path = %registry_path.display(), %error, "peer registry not readable");
            return Vec::new();
        }
    };

    let registry: PeerRegistry = match serde_json::from_str(&contents) {
        Ok(r) => r,
        Err(error) => {
            warn!(path = %registry_path.display(), %error, "failed to parse peer registry");
            return Vec::new();
        }
    };

    registry
        .peers
        .into_values()
        .map(|p| HudPeer {
            peer_id: p.peer_id,
            name: p.name,
            vendor: p.vendor,
            status: p.status,
            registered_at: p.registered_at,
            last_heartbeat_at: p.last_heartbeat_at,
        })
        .collect()
}

// ─── Recordings ─────────────────────────────────────────────────────────────

async fn hud_recordings(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let recordings = tokio::task::spawn_blocking({
        let data_dir = state.data_dir.clone();
        move || collect_recordings(&data_dir)
    })
    .await
    .unwrap_or_default();

    Json(json!({ "recordings": recordings }))
}

fn collect_recordings(data_dir: &std::path::Path) -> Vec<HudRecording> {
    let recordings_dir = data_dir.join("recordings");
    let mut recordings = Vec::new();

    let entries = match std::fs::read_dir(&recordings_dir) {
        Ok(entries) => entries,
        Err(error) => {
            debug!(path = %recordings_dir.display(), %error, "recordings directory not readable");
            return recordings;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        let recorded_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0))
            .flatten()
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default();

        recordings.push(HudRecording {
            id,
            recorded_at,
            size_bytes: metadata.len(),
            path: path.display().to_string(),
        });
    }

    recordings.sort_by(|a, b| b.recorded_at.cmp(&a.recorded_at));
    recordings.truncate(50);
    recordings
}

// ─── Health ─────────────────────────────────────────────────────────────────

async fn hud_health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let acu_url = state.config.acu_url();
    let gizzi_url = state.config.terminal_server_url();

    let (gateway_reachable, gateway_health) = tokio::join!(
        probe_acu_health(&acu_url),
        fetch_acu_health(&acu_url),
    );

    let gizzi_reachable = probe_gizzi_health(&gizzi_url).await;

    Json(HudHealth {
        platform: PlatformHealth {
            status: if gizzi_reachable { "healthy" } else { "degraded" },
            api_port: state.config.api_port(),
            gizzi_reachable,
        },
        gateway: GatewayHealth {
            url: acu_url,
            reachable: gateway_reachable,
            health: gateway_health.unwrap_or_else(|_| json!({"status": "unknown"})),
        },
    })
}

// ─── Gateway helpers ────────────────────────────────────────────────────────

async fn probe_acu_health(acu_url: &str) -> bool {
    match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(client) => match client.get(format!("{}/health", acu_url.trim_end_matches('/'))).send().await {
            Ok(res) => res.status().is_success(),
            Err(_) => false,
        },
        Err(_) => false,
    }
}

async fn fetch_acu_health(acu_url: &str) -> Result<serde_json::Value, ()> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|_| ())?;
    let res = client
        .get(format!("{}/health", acu_url.trim_end_matches('/')))
        .send()
        .await
        .map_err(|_| ())?;
    if !res.status().is_success() {
        return Err(());
    }
    res.json().await.map_err(|_| ())
}

async fn fetch_acu_sessions(acu_url: &str) -> Result<Vec<serde_json::Value>, ()> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|_| ())?;
    let res = client
        .get(format!(
            "{}/v1/computer-use/sessions",
            acu_url.trim_end_matches('/')
        ))
        .send()
        .await
        .map_err(|_| ())?;
    if !res.status().is_success() {
        return Err(());
    }
    let body: serde_json::Value = res.json().await.map_err(|_| ())?;
    Ok(body
        .get("sessions")
        .and_then(|s| s.as_array())
        .cloned()
        .unwrap_or_default())
}

async fn probe_gizzi_health(gizzi_url: &str) -> bool {
    match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(client) => match client
            .get(format!("{}/health", gizzi_url.trim_end_matches('/')))
            .send()
            .await
        {
            Ok(res) => res.status().is_success() || res.status() == reqwest::StatusCode::UNAUTHORIZED,
            Err(_) => false,
        },
        Err(_) => false,
    }
}
