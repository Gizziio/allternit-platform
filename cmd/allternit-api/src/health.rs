//! Health check endpoints for the Allternit API.
//!
//! Provides:
//! - `GET /health`       — overall health (200 when ready, 503 when degraded)
//! - `GET /health/live`  — liveness probe (always 200)
//! - `GET /health/ready` — readiness probe (checks DB + JWKS)

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

/// State required to perform readiness checks.
#[async_trait]
pub trait HealthState: Clone + Send + Sync + 'static {
    /// Returns `true` when the database is reachable.
    async fn db_healthy(&self) -> bool;
    /// Returns `true` when the JWKS cache is available.
    async fn jwks_ready(&self) -> bool;
}

#[async_trait]
impl HealthState for Arc<crate::AppState> {
    async fn db_healthy(&self) -> bool {
        self.db.connect().is_ok()
    }

    async fn jwks_ready(&self) -> bool {
        self.jwks.is_ready().await
    }
}

/// Router exposing `/health`, `/health/live`, and `/health/ready`.
pub fn health_router<S: HealthState>() -> Router<S> {
    Router::new()
        .route("/", get(health_handler::<S>))
        .route("/live", get(live_handler))
        .route("/ready", get(ready_handler::<S>))
}

#[derive(Serialize)]
struct Checks {
    db: bool,
    jwks: bool,
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

/// Overall health endpoint. Returns 200 when ready, 503 when degraded.
async fn health_handler<S: HealthState>(State(state): State<S>) -> impl IntoResponse {
    let db = state.db_healthy().await;
    let jwks = state.jwks_ready().await;
    let ready = db && jwks;

    let body = Json(HealthResponse {
        status: if ready { "healthy" } else { "degraded" },
        live: true,
        ready: Checks { db, jwks },
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

/// Readiness endpoint. Returns 200 when DB and JWKS are available.
async fn ready_handler<S: HealthState>(State(state): State<S>) -> impl IntoResponse {
    let db = state.db_healthy().await;
    let jwks = state.jwks_ready().await;
    let ready = db && jwks;

    let body = Json(ReadyResponse {
        status: if ready { "ready" } else { "not_ready" },
        checks: Checks { db, jwks },
    });

    if ready {
        (StatusCode::OK, body)
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, body)
    }
}
