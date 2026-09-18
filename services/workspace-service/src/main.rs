use allternit_workspace_service::{AppState, build_router};
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3021".to_string())
        .parse()
        .unwrap_or(3021);
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());

    let state = AppState::new();
    let app = build_router(state);

    let addr = format!("{}:{}", host, port);
    info!("allternit-workspace-service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
