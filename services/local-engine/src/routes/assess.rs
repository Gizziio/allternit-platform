//! Dynamic model assessment routes.

use crate::assess::AssessRequest;
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
        .route("/assess", post(assess_model))
        .with_state(state)
}

async fn assess_model(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AssessRequest>,
) -> Result<Json<crate::assess::AssessResponse>, (StatusCode, Json<ErrorResponse>)> {
    let repo_id = body.repo_id.trim();
    if repo_id.is_empty() || repo_id.contains(' ') {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "repo_id must be a non-empty Hugging Face repo id, e.g. \"org/name-GGUF\"".into(),
            }),
        ));
    }

    let request = AssessRequest {
        repo_id: repo_id.to_string(),
        quantization: body.quantization,
        context_length: body.context_length,
    };

    let response = state
        .assessor
        .assess(request, &state.hardware_profile)
        .await;

    Ok(Json(response))
}
