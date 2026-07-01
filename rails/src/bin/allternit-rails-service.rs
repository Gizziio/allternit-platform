//! Allternit Agent System Rails - HTTP Service Binary
//!
//! Run: cargo run --bin allternit-rails-service

use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Get configuration from environment
    let host = std::env::var("ALLTERNIT_RAILS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("ALLTERNIT_RAILS_PORT").unwrap_or_else(|_| "3011".to_string());
    let bind_addr = format!("{}:{}", host, port);

    let root_dir = std::env::var("ALLTERNIT_RAILS_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap());

    tracing::info!("Starting Allternit Agent System Rails HTTP service");
    tracing::info!("Bind address: {}", bind_addr);
    tracing::info!("Root directory: {}", root_dir.display());

    allternit_agent_system_rails::service::run_service(&bind_addr, root_dir).await
}
