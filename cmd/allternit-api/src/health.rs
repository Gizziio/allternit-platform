//! Health check endpoints for the Allternit API.
//!
//! Provides:
//! - `GET /health`       — overall health (200 when ready, 503 when degraded)
//! - `GET /health/live`  — liveness probe (always 200)
//! - `GET /health/ready` — readiness probe (checks DB + JWKS + Gizzi runtime)

use async_trait::async_trait;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;

/// State required to perform readiness checks.
#[async_trait]
pub trait HealthState: Clone + Send + Sync + 'static {
    /// Returns `true` when the database is reachable.
    async fn db_healthy(&self) -> bool;
    /// Returns `true` when the JWKS cache is available.
    async fn jwks_ready(&self) -> bool;
    /// Returns `true` when the configured Gizzi runtime is reachable.
    async fn gizzi_healthy(&self) -> bool;
}

#[async_trait]
impl HealthState for Arc<crate::AppState> {
    async fn db_healthy(&self) -> bool {
        self.db.connect().is_ok()
    }

    async fn jwks_ready(&self) -> bool {
        // In self-hosted mode the app does not rely on Clerk JWKS.
        if self.config.self_hosted() {
            return true;
        }
        self.jwks.is_ready().await
    }

    async fn gizzi_healthy(&self) -> bool {
        let url = self.config.terminal_server_url();
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()
        {
            Ok(c) => c,
            Err(_) => return false,
        };
        match client.get(format!("{}/v1/global/health", url)).send().await {
            Ok(res) => res.status().is_success() || res.status() == reqwest::StatusCode::UNAUTHORIZED,
            Err(_) => false,
        }
    }
}

/// Router exposing `/health`, `/health/live`, and `/health/ready`.
pub fn health_router<S: HealthState>() -> Router<S> {
    Router::new()
        .route("/", get(health_handler::<S>))
        .route("/live", get(live_handler))
        .route("/ready", get(ready_handler::<S>))
}

#[derive(Serialize, Clone)]
struct Checks {
    db: bool,
    jwks: bool,
    gizzi: bool,
}

#[derive(Serialize)]
struct LiveResponse {
    status: &'static str,
}

#[derive(Serialize)]
struct ReadyResponse {
    status: &'static str,
    checks: Checks,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    live: bool,
    ready: Checks,
}

fn readiness(ready: Checks) -> bool {
    ready.db && ready.jwks && ready.gizzi
}

/// Overall health endpoint. Returns 200 when ready, 503 when degraded.
async fn health_handler<S: HealthState>(State(state): State<S>) -> impl IntoResponse {
    let checks = Checks {
        db: state.db_healthy().await,
        jwks: state.jwks_ready().await,
        gizzi: state.gizzi_healthy().await,
    };
    let ready = readiness(checks.clone());

    let body = Json(HealthResponse {
        status: if ready { "healthy" } else { "degraded" },
        live: true,
        ready: checks,
    });

    if ready {
        (StatusCode::OK, body)
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, body)
    }
}

/// Liveness endpoint. Always returns 200.
async fn live_handler() -> impl IntoResponse {
    (StatusCode::OK, Json(LiveResponse { status: "alive" }))
}

/// Readiness endpoint. Returns 200 when DB, JWKS, and Gizzi runtime are available.
async fn ready_handler<S: HealthState>(State(state): State<S>) -> impl IntoResponse {
    let checks = Checks {
        db: state.db_healthy().await,
        jwks: state.jwks_ready().await,
        gizzi: state.gizzi_healthy().await,
    };
    let ready = readiness(checks.clone());

    let body = Json(ReadyResponse {
        status: if ready { "ready" } else { "not_ready" },
        checks,
    });

    if ready {
        (StatusCode::OK, body)
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, body)
    }
}
