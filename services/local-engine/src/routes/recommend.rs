//! Model recommendation routes.

use crate::recommend::RecommendRequest;
use crate::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde::Serialize;
use std::sync::Arc;

/// API error response.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/recommend", post(recommend_models))
        .with_state(state)
}

async fn recommend_models(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RecommendRequest>,
) -> Result<Json<crate::recommend::RecommendResponse>, (StatusCode, Json<ErrorResponse>)> {
    let response = state
        .recommender
        .recommend(body, &state.catalog, &state.hardware_profile)
        .await;
    Ok(Json(response))
}
