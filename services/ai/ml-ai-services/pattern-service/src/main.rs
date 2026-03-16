use axum::{response::Json, routing::get, Router};
use serde::Serialize;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    timestamp: u64,
}

async fn handle_health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "pattern-service".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3020".to_string());
    let addr = format!("{}:{}", host, port);

    let app = Router::new()
        .route("/health", get(handle_health))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
