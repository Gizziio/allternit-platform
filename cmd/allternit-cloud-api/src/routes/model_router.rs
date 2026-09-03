//! Model router REST surface.
//!
//! Exposes:
//! - `GET /v1/models` — public list of available models.
//! - `POST /v1/chat/completions` — auth-protected OpenAI-compatible chat
//!   completions, with optional streaming.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::sync::Arc;

use crate::{
    auth::AuthContext,
    model_router::ChatCompletionRequest,
    services::inference_settlement,
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
/// resolves it to the upstream model id before dispatching. Every successful
/// completion is metered and settled against the user's prepaid credits
/// (Phase B): blocked up front when the balance is exhausted, deducted after
/// the response from the upstream usage report (or a marked estimate).
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

    let user_id = auth.user.user_id.clone();

    // Pre-check: a paying user with an exhausted balance is blocked before we
    // spend upstream money; free users (no credits row) are bounded by the
    // monthly free allowance and a tight per-user rate limit.
    let balance = inference_settlement::credit_balance_row(&state.db, &user_id).await?;
    inference_settlement::check_inference_allowed(&state.db, &user_id, balance).await?;
    if balance.is_none() {
        if let Err(info) = state.free_inference_rate_limiter.check(&user_id).await {
            tracing::warn!(user_id = %user_id, "free inference rate limit exceeded");
            let body = serde_json::json!({
                "error": "RATE_LIMIT_EXCEEDED",
                "message": "Free inference rate limit reached — add credits for higher limits.",
                "retry_after": info.reset_after.as_secs(),
            });
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                [(
                    axum::http::header::RETRY_AFTER,
                    info.reset_after.as_secs().to_string(),
                )],
                Json(body),
            )
                .into_response();
            info.add_headers(&mut response);
            return Ok(response);
        }
    }

    let alias = request.model.clone();
    let streaming = request.is_streaming();
    let prompt_chars: usize = request.messages.iter().map(|m| m.content.len()).sum();
    let prices = state.model_router.retail_prices(&alias).await?;

    let response = state.model_router.chat_completions(request).await?;

    tracing::info!(
        user_id = %user_id,
        token_id = %auth.user.token_id,
        status = %response.status(),
        streaming = streaming,
        "model router chat completion dispatched"
    );

    // Settle usage: non-streaming settles inline from the buffered JSON usage;
    // streaming settles when the wrapped body ends (or is dropped).
    let response = if streaming {
        inference_settlement::meter_stream_response(
            response,
            inference_settlement::StreamSettlement {
                db: Arc::new(state.db.clone()),
                user_id,
                model: alias,
                prices,
                prompt_token_estimate: (prompt_chars / 4) as u64,
            },
        )
    } else {
        inference_settlement::meter_json_response(
            &state.db,
            &user_id,
            &alias,
            &prices,
            prompt_chars,
            response,
        )
        .await?
    };

    Ok(response)
}

