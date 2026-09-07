//! Metrics middleware for tracking API request counts and latencies.

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Shared metrics counters.
#[derive(Clone, Default)]
pub struct MetricsState {
    pub requests_total: Arc<AtomicU64>,
    pub requests_errors: Arc<AtomicU64>,
    pub request_duration_micros_total: Arc<AtomicU64>,
}

impl MetricsState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_request(&self, duration_micros: u64, is_error: bool) {
        self.requests_total.fetch_add(1, Ordering::Relaxed);
        self.request_duration_micros_total
            .fetch_add(duration_micros, Ordering::Relaxed);
        if is_error {
            self.requests_errors.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn snapshot(&self) -> (u64, u64, u64) {
        (
            self.requests_total.load(Ordering::Relaxed),
            self.requests_errors.load(Ordering::Relaxed),
            self.request_duration_micros_total.load(Ordering::Relaxed),
        )
    }
}

/// Metrics middleware that records request counts and durations.
pub async fn metrics_middleware(
    State(metrics): State<Arc<MetricsState>>,
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let response = next.run(request).await;
    let duration = start.elapsed();
    let is_error = response.status().is_server_error() || response.status().is_client_error();
    metrics.record_request(duration.as_micros() as u64, is_error);
    response
}
