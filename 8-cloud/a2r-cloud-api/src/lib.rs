//! A2R Cloud API
//!
//! Backend API for cloud deployment management.
//! Provides REST endpoints and WebSocket event streaming.

pub mod routes;
pub mod websocket;
pub mod db;
pub mod error;

use axum::{
    Router,
    routing::{get, post, delete},
};
use std::sync::Arc;
use tokio::sync::broadcast;

pub use error::ApiError;
pub use db::models::*;
pub use websocket::DeploymentEvent;

/// API application state
pub struct ApiState {
    pub db: sqlx::SqlitePool,
    pub ssh_executor: a2r_cloud_ssh::SshExecutor,
    pub event_tx: broadcast::Sender<DeploymentEvent>,
}

/// Create the API router
pub fn create_router(state: Arc<ApiState>) -> Router {
    Router::new()
        // Deployment endpoints
        .route("/api/v1/deployments", post(routes::deployments::create_deployment))
        .route("/api/v1/deployments", get(routes::deployments::list_deployments))
        .route("/api/v1/deployments/:id", get(routes::deployments::get_deployment))
        .route("/api/v1/deployments/:id/cancel", delete(routes::deployments::cancel_deployment))
        // WebSocket endpoint for live events
        .route("/api/v1/deployments/:id/events", get(websocket::ws_handler))
        // Provider endpoints
        .route("/api/v1/providers", get(routes::providers::list_providers))
        .route("/api/v1/providers/:id/validate", post(routes::providers::validate_credentials))
        // Instance endpoints
        .route("/api/v1/instances", get(routes::instances::list_instances))
        .route("/api/v1/instances/:id", get(routes::instances::get_instance))
        .route("/api/v1/instances/:id/restart", post(routes::instances::restart_instance))
        .route("/api/v1/instances/:id/destroy", delete(routes::instances::destroy_instance))
        .with_state(state)
}

/// Initialize the database
pub async fn init_db(database_url: &str) -> Result<sqlx::SqlitePool, ApiError> {
    let pool = sqlx::SqlitePool::connect(database_url).await?;
    
    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    
    Ok(pool)
}

/// Start the API server
pub async fn start_server(state: Arc<ApiState>, addr: &str) -> Result<(), ApiError> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("API server listening on {}", addr);
    
    let router = create_router(state);
    axum::serve(listener, router).await?;
    
    Ok(())
}
