//! OpenRouter adapter — long-tail coverage and emergency fallback.
//!
//! This adapter is intentionally a scaffold. It defines the integration
//! surface but does not make live upstream calls until API keys and
//! commercial terms are in place.

use async_trait::async_trait;

use crate::model_router::{ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ModelRouterError, RoutingPreference, UpstreamProvider};

/// OpenRouter upstream adapter.
pub struct OpenRouterProvider {
    /// OpenRouter API base URL. Stored for the live integration in Phase A.
    _base_url: String,
}

impl OpenRouterProvider {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            _base_url: base_url.into(),
        }
    }

    pub fn from_env() -> Self {
        let base_url = std::env::var("OPENROUTER_BASE_URL")
            .unwrap_or_else(|_| "https://openrouter.ai/api/v1".to_string());
        Self::new(base_url)
    }
}

#[async_trait]
impl UpstreamProvider for OpenRouterProvider {
    fn id(&self) -> &'static str {
        "openrouter"
    }

    fn supports(&self, model: &str) -> bool {
        // Accept any model prefixed with "openrouter/" as a starter policy.
        model.starts_with("openrouter/")
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, ModelRouterError> {
        // Placeholder: returns a minimal static set. Replace with a cached
        // fetch to `GET {base_url}/models` once API keys are available.
        Ok(vec![
            ModelInfo {
                id: "openrouter/llama-3.1-70b".to_string(),
                object: "model".to_string(),
                owned_by: "openrouter".to_string(),
            },
        ])
    }

    async fn chat_completion(
        &self,
        _request: ChatCompletionRequest,
        _preference: RoutingPreference,
    ) -> Result<ChatCompletionResponse, ModelRouterError> {
        // Placeholder: wire to `POST {base_url}/chat/completions` once
        // reseller terms and API keys are configured.
        Err(ModelRouterError::ConfigError(
            "OpenRouter adapter not yet wired to live upstream".to_string(),
        ))
    }
}
