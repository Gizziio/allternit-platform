//! Dynamic model assessment routes.

use crate::assess::{AssessRequest, AssessResponse};
use crate::AppState;
use axum::{extract::State, http::StatusCode, response::Json, routing::post, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Maximum number of models accepted by `POST /assess/batch`.
const BATCH_MAX_MODELS: usize = 50;

/// API error response.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Batch assessment request: one entry per model, same shape as `POST /assess`.
#[derive(Debug, Deserialize)]
pub struct AssessBatchRequest {
    pub models: Vec<AssessRequest>,
}

/// Batch assessment response, in request order.
#[derive(Debug, Serialize)]
pub struct AssessBatchResponse {
    pub results: Vec<AssessResponse>,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/assess", post(assess_model))
        .route("/assess/batch", post(assess_models_batch))
        .with_state(state)
}

fn validate_repo_id(repo_id: &str) -> Result<String, (StatusCode, Json<ErrorResponse>)> {
    let repo_id = repo_id.trim();
    if repo_id.is_empty() || repo_id.contains(' ') {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "repo_id must be a non-empty Hugging Face repo id, e.g. \"org/name-GGUF\""
                    .into(),
            }),
        ));
    }
    Ok(repo_id.to_string())
}

async fn assess_model(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AssessRequest>,
) -> Result<Json<AssessResponse>, (StatusCode, Json<ErrorResponse>)> {
    let repo_id = validate_repo_id(&body.repo_id)?;

    let request = AssessRequest {
        repo_id,
        quantization: body.quantization,
        context_length: body.context_length,
    };

    let response = state
        .assessor
        .assess(request, &state.hardware_profile)
        .await;

    Ok(Json(response))
}

/// Assess up to `BATCH_MAX_MODELS` models in one request, returning results in
/// request order. Individual HF lookups may fail silently inside each
/// assessment (the assessor falls back to name-based estimates).
async fn assess_models_batch(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AssessBatchRequest>,
) -> Result<Json<AssessBatchResponse>, (StatusCode, Json<ErrorResponse>)> {
    if body.models.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "models must be a non-empty array".into(),
            }),
        ));
    }
    if body.models.len() > BATCH_MAX_MODELS {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!(
                    "batch is limited to {} models (got {})",
                    BATCH_MAX_MODELS,
                    body.models.len()
                ),
            }),
        ));
    }

    let mut requests = Vec::with_capacity(body.models.len());
    for (index, model) in body.models.iter().enumerate() {
        let repo_id = validate_repo_id(&model.repo_id).map_err(|(status, Json(mut err))| {
            err.error = format!("models[{}]: {}", index, err.error);
            (status, Json(err))
        })?;
        requests.push(AssessRequest {
            repo_id,
            quantization: model.quantization.clone(),
            context_length: model.context_length,
        });
    }

    let mut results = Vec::with_capacity(requests.len());
    for request in requests {
        results.push(
            state
                .assessor
                .assess(request, &state.hardware_profile)
                .await,
        );
    }

    Ok(Json(AssessBatchResponse { results }))
}
