//! Allternit model broker and upstream router.
//!
//! This module owns the decision of where each inference request runs.
//! It dispatches OpenAI-compatible requests to the optimal upstream
//! (local runtime, direct provider, aggregator, or BYOK) and translates
//! responses back to a common shape.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

pub mod local;
pub mod openrouter;

/// An OpenAI-compatible chat completion request.
#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<Value>,
    #[serde(default)]
    pub stream: bool,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

/// An OpenAI-compatible chat completion response chunk.
/// This is intentionally a minimal subset; expand as needed.
#[derive(Debug, Clone, Serialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<Value>,
    pub usage: Option<Value>,
}

/// A model exposed by the `/v1/models` endpoint.
#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub object: String,
    pub owned_by: String,
}

/// Routing preference supplied by the caller or policy.
#[derive(Debug, Clone, Default)]
pub struct RoutingPreference {
    /// Prefer lowest cost.
    pub cost: bool,
    /// Prefer lowest latency.
    pub latency: bool,
    /// Prefer highest quality/capability.
    pub quality: bool,
    /// Restrict to providers that satisfy a compliance/policy constraint.
    pub provider_constraint: Option<String>,
}

/// A provider adapter that can fulfill chat-completion requests.
#[async_trait]
pub trait UpstreamProvider: Send + Sync {
    /// Unique provider id, e.g. "openrouter", "together", "local".
    fn id(&self) -> &'static str;

    /// Return true if this provider can handle the requested model.
    fn supports(&self, model: &str) -> bool;

    /// List models this provider currently offers.
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ModelRouterError>;

    /// Execute a chat completion request.
    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
        preference: RoutingPreference,
    ) -> Result<ChatCompletionResponse, ModelRouterError>;
}

/// Errors returned by the model router or upstream adapters.
#[derive(Debug, thiserror::Error)]
pub enum ModelRouterError {
    #[error("no provider supports model {0}")]
    UnsupportedModel(String),
    #[error("upstream request failed: {0}")]
    UpstreamError(String),
    #[error("router configuration error: {0}")]
    ConfigError(String),
}

/// The central broker. Holds all upstream adapters and selects one per request.
pub struct ModelRouter {
    providers: Vec<Arc<dyn UpstreamProvider>>,
}

impl ModelRouter {
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
        }
    }

    pub fn with_provider(mut self, provider: Arc<dyn UpstreamProvider>) -> Self {
        self.providers.push(provider);
        self
    }

    /// Return a static starter catalog. In production this merges `list_models`
    /// from every configured provider and caches it.
    pub fn starter_models() -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "local/llama-3.1-8b".to_string(),
                object: "model".to_string(),
                owned_by: "local".to_string(),
            },
            ModelInfo {
                id: "openrouter/llama-3.1-70b".to_string(),
                object: "model".to_string(),
                owned_by: "openrouter".to_string(),
            },
        ]
    }

    /// Select a provider for the request. This is a placeholder policy;
    /// production scoring will consider cost, latency, capacity, geography,
    /// cache affinity, and compliance constraints.
    fn select_provider(
        &self,
        model: &str,
        _preference: &RoutingPreference,
    ) -> Result<Arc<dyn UpstreamProvider>, ModelRouterError> {
        self.providers
            .iter()
            .find(|p| p.supports(model))
            .cloned()
            .ok_or_else(|| ModelRouterError::UnsupportedModel(model.to_string()))
    }

    pub async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
        preference: RoutingPreference,
    ) -> Result<ChatCompletionResponse, ModelRouterError> {
        let provider = self.select_provider(&request.model, &preference)?;
        provider.chat_completion(request, preference).await
    }
}

impl Default for ModelRouter {
    fn default() -> Self {
        Self::new()
    }
}
