use allternit_local_engine::cache::ModelStore;
use allternit_local_engine::runtime::ProcessManager;
use allternit_local_engine::routes::{chat, health, models, runtimes, status};
use allternit_local_engine::AppState;
use axum::Router;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("allternit-local-engine");
    let models_dir = data_dir.join("models");

    tokio::fs::create_dir_all(&models_dir).await?;
    tokio::fs::create_dir_all(data_dir.join("logs").join("runtimes")).await?;

    let store = ModelStore::new(&models_dir);
    let manager = ProcessManager::new(&data_dir);

    let state = Arc::new(AppState {
        store,
        manager,
        models_dir: models_dir.clone(),
    });

    let app = Router::new()
        .merge(health::create_router())
        .merge(models::create_router(state.clone()))
        .merge(runtimes::create_router(state.clone()))
        .merge(chat::create_router(state.clone()))
        .merge(status::create_router(state));

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3015".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    info!("Allternit Local Engine listening on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
