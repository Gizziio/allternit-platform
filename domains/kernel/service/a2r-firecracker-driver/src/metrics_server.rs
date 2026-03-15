//! # Metrics Server
//!
//! Prometheus HTTP endpoint for exposing Firecracker driver metrics.
//! Provides `/metrics` and `/health` endpoints for observability.

use axum::{http::StatusCode, routing::get, Router};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::{error, info, warn};

/// Shared state for the metrics server
#[derive(Clone)]
pub struct MetricsState {
    /// Function to render Prometheus metrics
    render_fn: Arc<dyn Fn() -> String + Send + Sync>,
}

impl MetricsState {
    /// Create new metrics state with the given render function
    pub fn new<F>(render_fn: F) -> Self
    where
        F: Fn() -> String + Send + Sync + 'static,
    {
        Self {
            render_fn: Arc::new(render_fn),
        }
    }

    /// Create new metrics state from an existing Arc<dyn Fn()>
    pub fn from_arc(render_fn: Arc<dyn Fn() -> String + Send + Sync>) -> Self {
        Self { render_fn }
    }
}

/// HTTP server for exposing Prometheus metrics
pub struct MetricsServer {
    addr: SocketAddr,
    state: MetricsState,
}

impl MetricsServer {
    /// Create a new metrics server bound to the given port
    pub fn new<F>(port: u16, render_fn: F) -> Self
    where
        F: Fn() -> String + Send + Sync + 'static,
    {
        Self {
            addr: SocketAddr::from(([0, 0, 0, 0], port)),
            state: MetricsState::new(render_fn),
        }
    }

    /// Create a new metrics server with an Arc<dyn Fn()>
    pub fn new_with_arc(port: u16, render_fn: Arc<dyn Fn() -> String + Send + Sync>) -> Self {
        Self {
            addr: SocketAddr::from(([0, 0, 0, 0], port)),
            state: MetricsState::from_arc(render_fn),
        }
    }

    /// Start the metrics server
    ///
    /// This method spawns the server as a background task and returns immediately.
    /// The server runs until the application shuts down.
    pub fn start(self) {
        tokio::spawn(async move {
            if let Err(e) = self.run().await {
                error!(error = %e, "Metrics server failed");
            }
        });
    }

    /// Run the metrics server (blocks until shutdown)
    async fn run(self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let app = Router::new()
            .route("/metrics", get(metrics_handler))
            .route("/health", get(health_handler))
            .with_state(self.state);

        let listener = TcpListener::bind(self.addr).await.map_err(|e| {
            warn!(error = %e, addr = %self.addr, "Failed to bind metrics server");
            e
        })?;

        info!(
            addr = %self.addr,
            endpoints = %"GET /metrics, GET /health",
            "Prometheus metrics server started"
        );

        axum::serve(listener, app).await?;

        Ok(())
    }
}

/// Handler for /metrics endpoint
async fn metrics_handler(state: axum::extract::State<MetricsState>) -> (StatusCode, String) {
    let metrics = (state.render_fn)();
    (StatusCode::OK, metrics)
}

/// Handler for /health endpoint
async fn health_handler() -> (StatusCode, &'static str) {
    (StatusCode::OK, "OK")
}

/// Install the Prometheus recorder and start the metrics server if port is configured
///
/// Returns `Some(MetricsServer)` if the server was started, `None` otherwise.
pub fn setup_metrics_server(port: Option<u16>) -> Option<MetricsServer> {
    let port = port?;

    // Install the Prometheus recorder
    let render_fn = match crate::metrics::install_prometheus_recorder() {
        Ok(render) => render,
        Err(e) => {
            error!(error = %e, "Failed to install Prometheus recorder");
            return None;
        }
    };

    // Wrap the Arc in a closure for the server
    let server = MetricsServer::new(port, move || render_fn());
    server.start();

    // Server is running as a background task, no need to return it
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_state() {
        let state = MetricsState::new(|| "test_metrics".to_string());
        let result = (state.render_fn)();
        assert_eq!(result, "test_metrics");
    }
}
