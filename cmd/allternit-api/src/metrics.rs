//! Prometheus metrics middleware and endpoint.
//!
//! Registers a histogram (`http_request_duration_seconds`) and a counter
//! (`http_requests_total`) labelled by method, status, and matched path.

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use once_cell::sync::Lazy;
use prometheus::{CounterVec, Encoder, HistogramOpts, HistogramVec, Opts, Registry, TextEncoder};
use std::time::Instant;

struct Metrics {
    registry: Registry,
    http_request_duration_seconds: HistogramVec,
    http_requests_total: CounterVec,
}

impl Metrics {
    fn new() -> Self {
        let registry = Registry::new();

        let http_request_duration_seconds = HistogramVec::new(
            HistogramOpts::new(
                "http_request_duration_seconds",
                "HTTP request duration in seconds",
            )
            .buckets(vec![
                0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
            ]),
            &["method", "status", "path"],
        )
        .expect("invalid http_request_duration_seconds metric");

        let http_requests_total = CounterVec::new(
            Opts::new("http_requests_total", "Total HTTP requests"),
            &["method", "status", "path"],
        )
        .expect("invalid http_requests_total metric");

        registry
            .register(Box::new(http_request_duration_seconds.clone()))
            .expect("failed to register http_request_duration_seconds");
        registry
            .register(Box::new(http_requests_total.clone()))
            .expect("failed to register http_requests_total");

        Self {
            registry,
            http_request_duration_seconds,
            http_requests_total,
        }
    }
}

static METRICS: Lazy<Metrics> = Lazy::new(Metrics::new);

/// Metrics endpoint handler — renders all registered metrics in Prometheus text format.
async fn metrics_handler() -> impl IntoResponse {
    let encoder = TextEncoder::new();
    let metric_families = METRICS.registry.gather();
    let mut buffer = Vec::new();

    if let Err(e) = encoder.encode(&metric_families, &mut buffer) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to encode metrics: {e}"),
        )
            .into_response();
    }

    match String::from_utf8(buffer) {
        Ok(text) => (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, encoder.format_type())],
            text,
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Metrics output is not valid UTF-8: {e}"),
        )
            .into_response(),
    }
}

/// Tower/Axum middleware that records request duration and count per method/status/path.
pub async fn metrics_middleware(request: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = request.method().to_string();
    let path = request
        .extensions()
        .get::<axum::extract::MatchedPath>()
        .map(|mp| mp.as_str().to_string())
        .unwrap_or_else(|| request.uri().path().to_string());

    let response = next.run(request).await;
    let duration = start.elapsed().as_secs_f64();
    let status = response.status().as_u16().to_string();

    METRICS
        .http_request_duration_seconds
        .with_label_values(&[&method, &status, &path])
        .observe(duration);
    METRICS
        .http_requests_total
        .with_label_values(&[&method, &status, &path])
        .inc();

    tracing::debug!(
        method = %method,
        path = %path,
        status = %status,
        duration_ms = %(duration * 1000.0),
        "request"
    );

    response
}

/// Router for the metrics endpoint (no auth required).
pub fn metrics_router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new().route("/metrics", get(metrics_handler))
}

/// Register metrics — a no-op because metrics are initialized lazily on first use.
pub fn register_metrics() {}
