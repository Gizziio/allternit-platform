//! Prometheus metrics middleware and endpoint

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::sync::Arc;
use std::time::Instant;

/// Metrics endpoint handler
async fn metrics_handler() -> impl IntoResponse {
    StatusCode::OK
}

/// Tower/Axum middleware that records request metrics.
pub async fn metrics_middleware(
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().to_string();
    let path = request
        .extensions()
        .get::<axum::extract::MatchedPath>()
        .map(|mp| mp.as_str().to_string())
        .unwrap_or_else(|| request.uri().path().to_string());

    let response = next.run(request).await;
    let _duration = start.elapsed().as_secs_f64();
    let _status = response.status().as_u16().to_string();

    // TODO: use prometheus crate to record metrics
    // For now, just log
    tracing::info!(method = %method, path = %path, status = %_status, duration_ms = %(_duration * 1000.0), "request");

    response
}

/// Router for the metrics endpoint (no auth required)
pub fn metrics_router() -> Router<Arc<crate::AppState>> {
    Router::new().route("/metrics", get(metrics_handler))
}

/// Register metrics (no-op for now)
pub fn register_metrics() {}
