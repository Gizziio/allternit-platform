//! Allternit Model Router
//!
//! Abstraction layer that exposes one OpenAI-compatible API to users and
//! dispatches requests to upstream model providers. This module defines the
//! provider trait, request/response types, and the top-level `ModelRouter`.

use axum::{
    body::Body,
    http::Response,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

pub mod catalog;
pub mod generic_openai;
pub mod openrouter;

#[cfg(test)]
mod tests;

/// Errors that can occur inside the model router.
#[derive(Debug, thiserror::Error)]
pub enum ModelRouterError {
    #[error("Unknown model alias: {0}")]
    UnknownModel(String),

    #[error("Provider {provider} is not configured")]
    ProviderNotConfigured { provider: String },

    #[error("Upstream request failed: {0}")]
    UpstreamRequestFailed(String),

    #[error("Upstream returned error {status}: {message}")]
    UpstreamError { status: u16, message: String },

    #[error("Streaming not supported by provider {0}")]
    StreamingNotSupported(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<ModelRouterError> for crate::ApiError {
    fn from(e: ModelRouterError) -> Self {
        use axum::http::StatusCode;
        match e {
            ModelRouterError::UnknownModel(msg) => crate::ApiError::BadRequest(msg),
            ModelRouterError::ProviderNotConfigured { provider } => {
                crate::ApiError::ServiceUnavailable(format!("provider {} not configured", provider))
            }
            ModelRouterError::UpstreamRequestFailed(msg) => crate::ApiError::ServiceUnavailable(msg),
            ModelRouterError::UpstreamError { status, message } => {
                let code = StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY);
                if code == StatusCode::UNAUTHORIZED || code == StatusCode::FORBIDDEN {
                    crate::ApiError::Unauthorized(message)
                } else if code == StatusCode::TOO_MANY_REQUESTS {
                    crate::ApiError::ServiceUnavailable(message)
                } else if code.is_server_error() {
                    crate::ApiError::ServiceUnavailable(message)
                } else {
                    crate::ApiError::BadRequest(message)
                }
            }
            ModelRouterError::StreamingNotSupported(msg) => crate::ApiError::BadRequest(msg),
            ModelRouterError::InvalidRequest(msg) => crate::ApiError::BadRequest(msg),
            ModelRouterError::Internal(msg) => crate::ApiError::Internal(msg),
        }
    }
}

/// A single message in a chat completion conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// User-facing chat completion request. OpenAI-compatible subset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl ChatCompletionRequest {
    pub fn is_streaming(&self) -> bool {
        self.stream == Some(true)
    }
}

/// One choice in a chat completion response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub index: u32,
    pub message: Message,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

/// Token usage reported by the upstream.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Usage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u32>,
}

/// OpenAI-compatible chat completion response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<Choice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
}

/// Information about a model exposed through `/v1/models`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub owned_by: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

/// An upstream provider that can list models and run chat completions.
#[async_trait::async_trait]
pub trait UpstreamProvider: Send + Sync {
    fn provider_id(&self) -> &str;

    /// List models this provider currently offers.
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ModelRouterError>;

    /// Run a chat completion request. Returns a fully-formed HTTP response so
    /// each provider can handle streaming internally.
    async fn chat_completions(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<Response<Body>, ModelRouterError>;
}

/// Top-level router that maps model aliases to upstream providers.
pub struct ModelRouter {
    providers: HashMap<String, Arc<dyn UpstreamProvider>>,
    alias_map: catalog::ModelAliasMap,
}

impl ModelRouter {
    /// Create a new router from a list of providers and the static alias map.
    pub fn new(
        providers: Vec<Arc<dyn UpstreamProvider>>,
        alias_map: catalog::ModelAliasMap,
    ) -> Self {
        let providers = providers
            .into_iter()
            .map(|p| (p.provider_id().to_string(), p))
            .collect();
        Self {
            providers,
            alias_map,
        }
    }

    /// Create a router with no providers (returns 503 for all requests).
    pub fn disabled(alias_map: catalog::ModelAliasMap) -> Self {
        Self {
            providers: HashMap::new(),
            alias_map,
        }
    }

    /// Returns true if at least one upstream provider is configured.
    pub fn is_enabled(&self) -> bool {
        !self.providers.is_empty()
    }

    /// List all models known to the router, starting with the static catalog.
    /// Live upstream metadata is merged in when a provider is healthy.
    pub async fn list_models(&self) -> Vec<ModelInfo> {
        let mut models = Vec::new();

        for entry in self.alias_map.entries() {
            let mut info = ModelInfo {
                id: entry.alias.clone(),
                object: "model".to_string(),
                created: entry.created,
                owned_by: entry.provider.clone(),
                upstream_id: Some(entry.upstream_id.clone()),
                provider: Some(entry.provider.clone()),
                aliases: entry.aliases.clone(),
                extra: serde_json::Map::new(),
            };

            // Start with static catalog metadata so the public model list is useful
            // even when no upstream provider is configured or the upstream is slow.
            info.extra.insert(
                "name".to_string(),
                serde_json::Value::String(entry.name.clone()),
            );
            info.extra.insert(
                "prompt_price".to_string(),
                serde_json::Value::Number(
                    serde_json::Number::from_f64(entry.prompt_price).unwrap_or(0.into()),
                ),
            );
            info.extra.insert(
                "completion_price".to_string(),
                serde_json::Value::Number(
                    serde_json::Number::from_f64(entry.completion_price).unwrap_or(0.into()),
                ),
            );
            info.extra.insert(
                "context_length".to_string(),
                serde_json::Value::Number(entry.context_length.into()),
            );

            // If we have a live provider, enrich with upstream metadata.
            // Upstream values take precedence over static catalog defaults.
            if let Some(provider) = self.providers.get(&entry.provider) {
                match provider.list_models().await {
                    Ok(upstream_models) => {
                        if let Some(upstream) = upstream_models
                            .into_iter()
                            .find(|m| m.id == entry.upstream_id)
                        {
                            for (k, v) in upstream.extra {
                                info.extra.insert(k, v);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            provider = %entry.provider,
                            upstream_id = %entry.upstream_id,
                            error = %e,
                            "failed to enrich model metadata"
                        );
                    }
                }
            }

            models.push(info);
        }

        models
    }

    /// Dispatch a chat completion request to the provider responsible for the
    /// requested model alias.
    pub async fn chat_completions(
        &self,
        mut request: ChatCompletionRequest,
    ) -> Result<Response<Body>, ModelRouterError> {
        let alias = &request.model;
        let entry = self
            .alias_map
            .resolve(alias)
            .ok_or_else(|| ModelRouterError::UnknownModel(alias.clone()))?;

        let provider = self
            .providers
            .get(&entry.provider)
            .ok_or_else(|| ModelRouterError::ProviderNotConfigured {
                provider: entry.provider.clone(),
            })?;

        // Rewrite the model field to the upstream id before dispatching.
        request.model = entry.upstream_id.clone();

        provider.chat_completions(request).await
    }
}
