//! Local runtime adapter — open-weights models running on user hardware.
//!
//! This adapter is intentionally a scaffold. Production implementation will
//! dispatch to a paired local runtime via the existing runtime pairing/relay
//! system (e.g. Ollama, llama.cpp, or vLLM endpoints).

use async_trait::async_trait;

use crate::model_router::{ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ModelRouterError, RoutingPreference, UpstreamProvider};

/// Local runtime upstream adapter.
pub struct LocalProvider;

impl LocalProvider {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl UpstreamProvider for LocalProvider {
    fn id(&self) -> &'static str {
        "local"
    }

    fn supports(&self, model: &str) -> bool {
        // Accept any model prefixed with "local/" as a starter policy.
        model.starts_with("local/")
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, ModelRouterError> {
        // Placeholder: discover models from paired local runtimes.
        Ok(vec![
            ModelInfo {
                id: "local/llama-3.1-8b".to_string(),
                object: "model".to_string(),
                owned_by: "local".to_string(),
            },
        ])
    }

    async fn chat_completion(
        &self,
        _request: ChatCompletionRequest,
        _preference: RoutingPreference,
    ) -> Result<ChatCompletionResponse, ModelRouterError> {
        // Placeholder: route to the paired local runtime's chat endpoint.
        Err(ModelRouterError::ConfigError(
            "Local runtime adapter not yet wired to runtime relay".to_string(),
        ))
    }
}

impl Default for LocalProvider {
    fn default() -> Self {
        Self::new()
    }
}
