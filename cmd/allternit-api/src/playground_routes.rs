//! Playground routes

use axum::{
    extract::State,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn playground_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/playground", post(playground_handler))
}

async fn playground_handler(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}
