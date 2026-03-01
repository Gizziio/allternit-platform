//! A2R Cloud API Server
//!
//! Main entry point for the cloud deployment API.

use a2r_cloud_api::{ApiState, create_router, init_db};
use std::sync::Arc;
use tokio::sync::broadcast;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    // Get configuration from environment
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://a2r-cloud.db".to_string());
    let bind_addr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:3001".to_string());
    
    tracing::info!("Starting A2R Cloud API server");
    tracing::info!("Database: {}", database_url);
    tracing::info!("Bind address: {}", bind_addr);
    
    // Initialize database
    tracing::info!("Initializing database...");
    let db = init_db(&database_url).await?;
    tracing::info!("Database initialized");
    
    // Create broadcast channel for deployment events
    let (event_tx, _event_rx) = broadcast::channel::<a2r_cloud_api::DeploymentEvent>(100);
    
    // Create API state
    let state = Arc::new(ApiState {
        db,
        ssh_executor: a2r_cloud_ssh::SshExecutor::new(),
        event_tx,
    });
    
    // Start server
    tracing::info!("Starting API server on {}", bind_addr);
    a2r_cloud_api::start_server(state, &bind_addr).await?;
    
    Ok(())
}
