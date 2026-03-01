//! Workspace Service - Main entry point

use std::net::SocketAddr;
use tracing::{info, warn};

use workspace_service::api::create_router;
use workspace_service::state::AppState;
use workspace_service::types::ServiceConfig;
use workspace_service::tmux::check_tmux;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load configuration
    let config = ServiceConfig::from_env();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(&config.log_level)
        .init();

    info!("Starting Workspace Service v{}", workspace_service::VERSION);

    // Check tmux availability
    if !check_tmux().await {
        warn!("tmux is not installed or not available in PATH");
        warn!("Some functionality may not work correctly");
    } else {
        info!("tmux is available");
    }

    // Create application state
    let state = AppState::new();

    // Create router
    let app = create_router(state);

    // Bind address
    let addr: SocketAddr = format!("{}:{}", config.bind_address, config.port).parse()?;

    info!("Listening on http://{}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
