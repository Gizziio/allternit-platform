//! A2R Cloud API
//!
//! Backend API for cloud deployment management.
//! Provides REST endpoints and WebSocket event streaming.

pub mod routes;
pub mod websocket;
pub mod db;
pub mod error;
pub mod services;
pub mod runtime;
pub mod auth;
pub mod middleware;
pub mod validation;

pub use middleware::rate_limit::{RateLimiter, RateLimitConfig, create_rate_limiter};
pub use validation::{Validatable, validate_run_name, validate_email, validate_uuid};

use axum::{
    Router,
    routing::{get, post, delete},
    middleware as axum_middleware,
};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::{CorsLayer, Any};
use tower::ServiceBuilder;
use std::time::Duration;
use axum::{
    extract::DefaultBodyLimit,
    http::{Method, header},
};

pub use error::ApiError;
pub use db::models::*;
pub use websocket::DeploymentEvent;

/// API application state
pub struct ApiState {
    pub db: sqlx::SqlitePool,
    pub ssh_executor: a2r_cloud_ssh::SshExecutor,
    pub event_tx: broadcast::Sender<DeploymentEvent>,
    /// Shared event store for all operations
    pub event_store: Arc<dyn services::EventStore>,
    /// Shared run service for run lifecycle management
    pub run_service: Arc<dyn services::RunService>,
    /// Shared session manager for multi-client attachments
    pub session_manager: Arc<runtime::session_manager::SessionManager>,
    /// Rate limiter for API protection
    pub rate_limiter: Arc<RateLimiter>,
    /// Cost service for tracking run costs
    pub cost_service: Arc<dyn services::CostService>,
}

/// Create the API router
pub fn create_router(state: Arc<ApiState>) -> Router {
    // Create protected routes with auth middleware
    let protected_routes = Router::new()
        // Run endpoints (Cowork Runtime)
        .route("/api/v1/runs", post(routes::runs::create_run))
        .route("/api/v1/runs", get(routes::runs::list_runs))
        .route("/api/v1/runs/:id", get(routes::runs::get_run))
        .route("/api/v1/runs/:id", axum::routing::put(routes::runs::update_run))
        .route("/api/v1/runs/:id", axum::routing::delete(routes::runs::delete_run))
        .route("/api/v1/runs/:id/start", post(routes::runs::start_run))
        .route("/api/v1/runs/:id/pause", post(routes::runs::pause_run))
        .route("/api/v1/runs/:id/resume", post(routes::runs::resume_run))
        .route("/api/v1/runs/:id/cancel", post(routes::runs::cancel_run))
        .route("/api/v1/runs/:id/attach", post(routes::runs::attach_to_run))
        .route("/api/v1/runs/:id/detach", post(routes::runs::detach_from_run))
        .route("/api/v1/runs/:id/attachments", get(routes::runs::get_run_attachments))
        .route("/api/v1/runs/:id/events", get(routes::runs::get_run_events))
        .route("/api/v1/runs/:id/events/stream", get(routes::runs::run_events_sse))
        // Checkpoint endpoints
        .route("/api/v1/runs/:id/checkpoints", post(routes::runs::create_checkpoint))
        .route("/api/v1/runs/:id/checkpoints", get(routes::runs::list_checkpoints))
        .route("/api/v1/checkpoints/:id", get(routes::runs::get_checkpoint))
        .route("/api/v1/checkpoints/:id", axum::routing::delete(routes::runs::delete_checkpoint))
        .route("/api/v1/runs/:id/restore", post(routes::runs::restore_checkpoint))
        // Job endpoints
        .route("/api/v1/runs/:run_id/jobs", post(routes::jobs::create_job))
        .route("/api/v1/runs/:run_id/jobs", get(routes::jobs::list_jobs))
        .route("/api/v1/runs/:run_id/jobs/:job_id", get(routes::jobs::get_job))
        .route("/api/v1/runs/:run_id/jobs/:job_id", axum::routing::put(routes::jobs::update_job))
        .route("/api/v1/runs/:run_id/jobs/:job_id", axum::routing::delete(routes::jobs::delete_job))
        .route("/api/v1/runs/:run_id/jobs/:job_id/start", post(routes::jobs::start_job))
        .route("/api/v1/runs/:run_id/jobs/:job_id/complete", post(routes::jobs::complete_job))
        .route("/api/v1/runs/:run_id/jobs/:job_id/fail", post(routes::jobs::fail_job))
        .route("/api/v1/runs/:run_id/jobs/:job_id/cancel", post(routes::jobs::cancel_job))
        // Schedule endpoints
        .route("/api/v1/schedules", post(routes::schedules::create_schedule))
        .route("/api/v1/schedules", get(routes::schedules::list_schedules))
        .route("/api/v1/schedules/:id", get(routes::schedules::get_schedule))
        .route("/api/v1/schedules/:id", axum::routing::put(routes::schedules::update_schedule))
        .route("/api/v1/schedules/:id", axum::routing::delete(routes::schedules::delete_schedule))
        .route("/api/v1/schedules/:id/enable", post(routes::schedules::enable_schedule))
        .route("/api/v1/schedules/:id/disable", post(routes::schedules::disable_schedule))
        .route("/api/v1/schedules/:id/trigger", post(routes::schedules::trigger_schedule))
        // Approval endpoints
        .route("/api/v1/approvals", post(routes::approvals::create_approval))
        .route("/api/v1/approvals", get(routes::approvals::list_approvals))
        .route("/api/v1/approvals/:id", get(routes::approvals::get_approval))
        .route("/api/v1/approvals/:id/approve", post(routes::approvals::approve_request))
        .route("/api/v1/approvals/:id/deny", post(routes::approvals::deny_request))
        .route("/api/v1/approvals/:id/cancel", post(routes::approvals::cancel_request))
        // WebSocket endpoint for run events
        .route("/ws/runs/:id", get(websocket::run_ws_handler))
        // Deployment endpoints (existing)
        .route("/api/v1/deployments", post(routes::deployments::create_deployment))
        .route("/api/v1/deployments", get(routes::deployments::list_deployments))
        .route("/api/v1/deployments/:id", get(routes::deployments::get_deployment))
        .route("/api/v1/deployments/:id/cancel", delete(routes::deployments::cancel_deployment))
        // WebSocket endpoint for live events
        .route("/api/v1/deployments/:id/events", get(websocket::ws_handler))
        // Provider endpoints
        .route("/api/v1/providers", get(routes::providers::list_providers))
        .route("/api/v1/providers/:id/validate", post(routes::providers::validate_credentials))
        // Region endpoints
        .route("/api/v1/regions", get(routes::regions::list_regions))
        .route("/api/v1/regions/:id", get(routes::regions::get_region))
        .route("/api/v1/regions/:id/capacity", get(routes::regions::get_region_capacity))
        // Instance endpoints
        .route("/api/v1/instances", get(routes::instances::list_instances))
        .route("/api/v1/instances/:id", get(routes::instances::get_instance))
        .route("/api/v1/instances/:id/restart", post(routes::instances::restart_instance))
        .route("/api/v1/instances/:id/destroy", delete(routes::instances::destroy_instance))
        // Cost tracking endpoints
        .route("/api/v1/runs/:id/cost", get(routes::costs::get_run_cost))
        .route("/api/v1/costs/summary", get(routes::costs::get_cost_summary))
        .route("/api/v1/costs/breakdown", get(routes::costs::get_cost_breakdown))
        .route("/api/v1/costs/budget", get(routes::costs::get_budget))
        .route("/api/v1/costs/budget", axum::routing::put(routes::costs::update_budget))
        .route("/api/v1/costs/rates", get(routes::costs::list_cost_rates))
        .route("/api/v1/costs/rates", post(routes::costs::set_cost_rate))
        .route("/api/v1/costs/recalculate", post(routes::costs::recalculate_costs))
        .route("/api/v1/costs/reset", post(routes::costs::reset_monthly_costs))
        .layer(axum_middleware::from_fn_with_state(
            state.rate_limiter.clone(),
            crate::middleware::rate_limit::rate_limit_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth::middleware::auth_middleware,
        ))
        .with_state(state.clone());

    // Create public routes (no auth required)
    let public_routes = Router::new()
        // Health endpoints (public)
        .route("/api/v1/health", get(routes::health::health_check))
        .route("/api/v1/health/ready", get(routes::health::readiness_check))
        .route("/api/v1/health/live", get(routes::health::liveness_check))
        .route("/api/v1/metrics", get(routes::health::metrics))
        // Auth endpoints (public)
        .route("/api/v1/auth/validate", post(routes::auth::validate_token));

    // Create auth-protected routes (require auth but listed separately for clarity)
    let auth_routes = Router::new()
        .route("/api/v1/auth/me", get(routes::auth::get_current_user))
        .route("/api/v1/auth/tokens", get(routes::auth::list_tokens))
        .route("/api/v1/auth/tokens", post(routes::auth::create_token))
        .route("/api/v1/auth/tokens/:id", delete(routes::auth::revoke_token))
        .layer(axum_middleware::from_fn_with_state(
            state.rate_limiter.clone(),
            crate::middleware::rate_limit::rate_limit_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth::middleware::auth_middleware,
        ))
        .with_state(state.clone());

    // Configure CORS
    let cors = if std::env::var("A2R_API_DEVELOPMENT_MODE")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false) {
        // Development: Allow all origins
        CorsLayer::permissive()
    } else {
        // Production: Restrictive CORS
        let allowed_origins: Vec<_> = std::env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000,https://app.a2r.io".to_string())
            .split(',')
            .filter_map(|s| s.trim().parse::<axum::http::HeaderValue>().ok())
            .collect();
        
        CorsLayer::new()
            .allow_origin(allowed_origins)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::DELETE,
                Method::PATCH,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::CONTENT_TYPE,
                header::AUTHORIZATION,
                header::ACCEPT,
                header::ORIGIN,
                header::HeaderName::from_static("x-requested-with"),
            ])
            .allow_credentials(true)
            .max_age(std::time::Duration::from_secs(3600))
    };
    
    // Get max body size from env (default 10MB)
    let max_body_size = std::env::var("MAX_BODY_SIZE_BYTES")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(10 * 1024 * 1024); // 10MB default
    
    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(auth_routes)
        .merge(protected_routes)
        .layer(DefaultBodyLimit::max(max_body_size))
        .layer(cors)
        .with_state(state)
}

/// Initialize the database with configured connection pooling
pub async fn init_db(database_url: &str) -> Result<sqlx::SqlitePool, ApiError> {
    use sqlx::sqlite::SqlitePoolOptions;
    
    // Get pool configuration from environment
    let max_connections = std::env::var("DB_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10);
    
    let min_connections = std::env::var("DB_MIN_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2);
    
    let acquire_timeout_secs = std::env::var("DB_ACQUIRE_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);
    
    let max_lifetime_mins = std::env::var("DB_MAX_LIFETIME_MINS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);
    
    let idle_timeout_mins = std::env::var("DB_IDLE_TIMEOUT_MINS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10);
    
    tracing::info!(
        "Database pool config: max={}, min={}, acquire_timeout={}s, max_lifetime={}m, idle_timeout={}m",
        max_connections, min_connections, acquire_timeout_secs, max_lifetime_mins, idle_timeout_mins
    );
    
    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .min_connections(min_connections)
        .acquire_timeout(std::time::Duration::from_secs(acquire_timeout_secs))
        .max_lifetime(std::time::Duration::from_secs(max_lifetime_mins * 60))
        .idle_timeout(std::time::Duration::from_secs(idle_timeout_mins * 60))
        .connect(database_url)
        .await?;
    
    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    
    tracing::info!("Database pool initialized with {} max connections", max_connections);
    Ok(pool)
}

/// Start the API server with graceful shutdown
pub async fn start_server(state: Arc<ApiState>, addr: &str) -> Result<(), ApiError> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("API server listening on {}", addr);
    
    let router = create_router(state);
    
    // Setup graceful shutdown
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    
    tokio::spawn(async move {
        // Wait for shutdown signal
        let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to create SIGTERM handler");
        let mut sigint = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
            .expect("Failed to create SIGINT handler");
        
        tokio::select! {
            _ = sigterm.recv() => tracing::info!("Received SIGTERM, shutting down gracefully..."),
            _ = sigint.recv() => tracing::info!("Received SIGINT, shutting down gracefully..."),
        }
        
        let _ = shutdown_tx.send(());
    });
    
    // Start server with graceful shutdown
    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = shutdown_rx.await;
        })
        .await?;
    
    tracing::info!("Server shutdown complete");
    Ok(())
}
