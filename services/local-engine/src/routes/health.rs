//! Health check route.

use axum::{routing::get, Json, Router};
use serde::Serialize;

/// Health response body.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
}

/// Create the health router.
pub fn create_router() -> Router {
    Router::new().route("/health", get(get_health))
}

async fn get_health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}
