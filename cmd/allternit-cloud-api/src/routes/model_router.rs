//! Public model-router endpoints.
//!
//! These endpoints expose the Allternit model catalog and OpenAI-compatible
//! inference surface. They are intentionally stubs for now; the router
//! adapters return static data and errors until upstream API keys and
//! commercial terms are configured.

use axum::{extract::State, http::StatusCode, response::Json, routing::get, Router};
use serde_json::json;
use std::sync::Arc;

use crate::model_router::{local::LocalProvider, openrouter::OpenRouterProvider, ModelRouter, ModelRouterError};
use crate::ApiState;

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new().route("/v1/models", get(list_models))
}

async fn list_models(State(_state): State<Arc<ApiState>>) -> Result<Json<serde_json::Value>, StatusCode> {
    // Build a starter router with local + OpenRouter adapters.
    // In production this will live in ApiState and refresh from upstreams.
    let _router = ModelRouter::new()
        .with_provider(Arc::new(LocalProvider::new()))
        .with_provider(Arc::new(OpenRouterProvider::from_env()));

    let models = ModelRouter::starter_models();

    Ok(Json(json!({
        "object": "list",
        "data": models,
        "note": "Static starter catalog. Live upstream discovery coming in Phase A.",
    })))
}

impl From<ModelRouterError> for StatusCode {
    fn from(_err: ModelRouterError) -> Self {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
