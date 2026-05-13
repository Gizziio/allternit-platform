//! Checkpoints routes

use axum::{
    extract::State,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn checkpoints_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/checkpoints", get(list_checkpoints).post(create_checkpoint))
        .route("/checkpoints/commit", post(commit_checkpoint))
        .route("/checkpoints/tag", post(tag_checkpoint))
}

async fn list_checkpoints(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "checkpoints": [],
        "total": 0,
        "stub": true,
    }))
}

async fn create_checkpoint(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "id": "stub-checkpoint-id",
        "status": "created",
        "stub": true,
    }))
}

async fn commit_checkpoint(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "committed",
        "stub": true,
    }))
}

async fn tag_checkpoint(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "tagged",
        "stub": true,
    }))
}
