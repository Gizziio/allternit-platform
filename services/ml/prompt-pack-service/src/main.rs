use anyhow::Result;
use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{info, warn};

mod api;
mod config;
mod models;
mod renderer;
mod registry;
mod storage;

use api::routes;
use config::AppConfig;
use registry::PackRegistry;
use storage::StorageManager;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "prompt_pack_service=info,tower_http=debug".into()),
        )
        .init();

    info!("Starting Prompt Pack Service v1.0.0");

    // Load configuration
    let config = AppConfig::from_env()?;
    info!("Configuration loaded: port={}, data_dir={}", config.port, config.data_dir);

    // Initialize storage
    let storage = Arc::new(StorageManager::new(&config.data_dir).await?);
    info!("Storage initialized");

    // Initialize registry
    let registry = Arc::new(PackRegistry::new(storage.clone()).await?);
    info!("Pack registry initialized");

    // Build router
    let app = routes::create_router(registry, storage);

    // Start server
    let addr: SocketAddr = format!("127.0.0.1:{}", config.port).parse()?;
    info!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
