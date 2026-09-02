//! Model router REST surface.
//!
//! Exposes:
//! - `GET /v1/models` — public list of available models.
//! - `POST /v1/chat/completions` — auth-protected OpenAI-compatible chat
//!   completions, with optional streaming.

use axum::{
    extract::{Extension, State},
    response::Response,
    Json,
};
use serde::Serialize;
use std::sync::Arc;

use crate::{
    auth::AuthContext,
    model_router::ChatCompletionRequest,
    ApiError, ApiState,
};

/// Permission required to invoke chat completions.
const REQUIRED_PERMISSION: &str = "models:write";

/// Response shape for the public model list endpoint.
#[derive(Debug, Serialize)]
pub struct ModelListResponse {
    object: String,
    data: Vec<crate::model_router::ModelInfo>,
}

/// `GET /v1/models`
///
/// Public endpoint listing all models Allternit can route. Returns a static
/// catalog enriched with live upstream metadata when providers are healthy.
pub async fn list_models(State(state): State<Arc<ApiState>>) -> Result<Json<ModelListResponse>, ApiError> {
    let models = state.model_router.list_models().await;

    Ok(Json(ModelListResponse {
        object: "list".to_string(),
        data: models,
    }))
}

/// `POST /v1/chat/completions`
///
/// Auth-protected OpenAI-compatible chat completions. Supports streaming via
/// `stream: true`. The request `model` field is an Allternit alias; the router
/// resolves it to the upstream provider model id before dispatching.
pub async fn chat_completions(
    State(state): State<Arc<ApiState>>,
    Extension(auth): Extension<AuthContext>,
    Json(request): Json<ChatCompletionRequest>,
) -> Result<Response, ApiError> {
    if !auth.user.has_permission(REQUIRED_PERMISSION) && !auth.user.has_permission("admin") {
        return Err(ApiError::Forbidden(format!(
            "Missing required permission: {}",
            REQUIRED_PERMISSION
        )));
    }

    if !state.model_router.is_enabled() {
        return Err(ApiError::ServiceUnavailable(
            "Model router is not configured".to_string(),
        ));
    }

    let response = state.model_router.chat_completions(request).await?;

    // Log usage metadata for later cost tracking (Phase B+).
    tracing::info!(
        user_id = %auth.user.user_id,
        token_id = %auth.user.token_id,
        status = %response.status(),
        "model router chat completion dispatched"
    );

    Ok(response)
}

