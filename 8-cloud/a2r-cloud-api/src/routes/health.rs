//! Health check routes
//!
//! Provides endpoints for:
//! - GET /api/v1/health - Basic health check with DB connectivity
//! - GET /api/v1/health/ready - Readiness probe for Kubernetes
//! - GET /api/v1/health/live - Liveness probe
//! - GET /api/v1/metrics - Prometheus metrics endpoint

use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use chrono::Utc;
use axum::http::header;

use crate::ApiState;

/// Basic health check response
#[derive(Debug, serde::Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
}

/// Readiness probe response
#[derive(Debug, serde::Serialize)]
pub struct ReadinessResponse {
    pub ready: bool,
    pub checks: ReadinessChecks,
}

/// Readiness checks details
#[derive(Debug, serde::Serialize)]
pub struct ReadinessChecks {
    pub database: bool,
}

/// Liveness probe response
#[derive(Debug, serde::Serialize)]
pub struct LivenessResponse {
    pub alive: bool,
}

/// Basic health check
///
/// GET /api/v1/health
///
/// Returns basic health status and checks database connectivity.
/// This endpoint is publicly accessible (no auth required).
pub async fn health_check(
    State(state): State<Arc<ApiState>>,
) -> Result<Json<HealthResponse>, Json<HealthResponse>> {
    let timestamp = Utc::now().to_rfc3339();
    
    // Check database connectivity
    let db_healthy = sqlx::query("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();
    
    if db_healthy {
        Ok(Json(HealthResponse {
            status: "healthy".to_string(),
            timestamp,
        }))
    } else {
        Err(Json(HealthResponse {
            status: "unhealthy".to_string(),
            timestamp,
        }))
    }
}

/// Readiness probe for Kubernetes
///
/// GET /api/v1/health/ready
///
/// Returns readiness status with detailed checks.
/// Used by Kubernetes to determine if the pod is ready to receive traffic.
/// This endpoint is publicly accessible (no auth required).
pub async fn readiness_check(
    State(state): State<Arc<ApiState>>,
) -> impl IntoResponse {
    // Check database connectivity
    let db_healthy = sqlx::query("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();
    
    let response = ReadinessResponse {
        ready: db_healthy,
        checks: ReadinessChecks {
            database: db_healthy,
        },
    };
    
    let status_code = if db_healthy {
        axum::http::StatusCode::OK
    } else {
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    };
    
    (status_code, Json(response))
}

/// Liveness probe
///
/// GET /api/v1/health/live
///
/// Returns liveness status.
/// Used by Kubernetes to determine if the pod should be restarted.
/// This endpoint is publicly accessible (no auth required).
pub async fn liveness_check() -> impl IntoResponse {
    Json(LivenessResponse {
        alive: true,
    })
}

/// Prometheus metrics endpoint
///
/// GET /api/v1/metrics
///
/// Returns Prometheus-formatted metrics for monitoring.
/// This endpoint is publicly accessible (no auth required).
pub async fn metrics(
    State(state): State<Arc<ApiState>>,
) -> impl IntoResponse {
    let mut metrics_output = String::new();
    
    // Helper function to add metric lines
    let mut add_metric = |name: &str, help: &str, metric_type: &str, value: &str, labels: Option<&str>| {
        metrics_output.push_str(&format!("# HELP {} {}\n", name, help));
        metrics_output.push_str(&format!("# TYPE {} {}\n", name, metric_type));
        if let Some(lbls) = labels {
            metrics_output.push_str(&format!("{}{} {}\n", name, lbls, value));
        } else {
            metrics_output.push_str(&format!("{} {}\n", name, value));
        }
    };
    
    // a2r_runs_total - Total number of runs
    let runs_total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM runs")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
    add_metric(
        "a2r_runs_total",
        "Total number of runs",
        "counter",
        &runs_total.to_string(),
        None,
    );
    
    // a2r_runs_active - Currently active runs
    let runs_active: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM runs WHERE status IN ('pending', 'provisioning', 'running')"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    add_metric(
        "a2r_runs_active",
        "Number of currently active runs",
        "gauge",
        &runs_active.to_string(),
        None,
    );
    
    // a2r_cloud_instances - Number of cloud instances
    let instances: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM instances")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
    add_metric(
        "a2r_cloud_instances",
        "Number of cloud instances",
        "gauge",
        &instances.to_string(),
        None,
    );
    
    // a2r_deployments_total - Total number of deployments
    let deployments_total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM deployments")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
    add_metric(
        "a2r_deployments_total",
        "Total number of deployments",
        "counter",
        &deployments_total.to_string(),
        None,
    );
    
    // a2r_deployments_active - Active deployments
    let deployments_active: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM deployments WHERE status IN ('pending', 'provisioning', 'installing')"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    add_metric(
        "a2r_deployments_active",
        "Number of active deployments",
        "gauge",
        &deployments_active.to_string(),
        None,
    );
    
    // a2r_api_requests_total - API request counter (placeholder for future implementation)
    // In a real implementation, this would be tracked via middleware
    add_metric(
        "a2r_api_requests_total",
        "Total number of API requests",
        "counter",
        "0",
        None,
    );
    
    // Add timestamp
    let timestamp = Utc::now().timestamp();
    metrics_output.push_str(&format!("\n# Scrape timestamp: {}\n", timestamp));
    
    (
        [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        metrics_output
    )
}
