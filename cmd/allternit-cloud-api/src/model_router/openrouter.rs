//! OpenRouter upstream adapter.
//!
//! Implements the `UpstreamProvider` trait for OpenRouter. Routes requests to
//! `https://openrouter.ai/api/v1/*` and forwards required identification
//! headers (`HTTP-Referer`, `X-Title`).

use axum::{
    body::{Body, Bytes},
    http::{header, Response, StatusCode},
};
use serde::Deserialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use super::{
    ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ModelRouterError, UpstreamProvider,
};

const OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";
const MODEL_LIST_CACHE_TTL: Duration = Duration::from_secs(300);

/// OpenRouter-specific model listing response.
#[derive(Debug, Deserialize)]
struct OpenRouterModelList {
    data: Vec<OpenRouterModel>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterModel {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    context_length: Option<u64>,
    #[serde(default)]
    pricing: Option<OpenRouterPricing>,
    #[serde(default)]
    top_provider: Option<String>,
    #[serde(default)]
    architecture: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct OpenRouterPricing {
    prompt: Option<f64>,
    completion: Option<f64>,
    image: Option<f64>,
    request: Option<f64>,
}

/// Adapter configuration.
#[derive(Debug, Clone)]
pub struct OpenRouterConfig {
    pub api_key: String,
    pub http_referer: String,
    pub app_title: String,
    pub base_url: String,
}

impl OpenRouterConfig {
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("OPENROUTER_API_KEY").ok()?;
        if api_key.trim().is_empty() {
            return None;
        }
        Some(Self {
            api_key,
            http_referer: std::env::var("OPENROUTER_HTTP_REFERER")
                .unwrap_or_else(|_| "https://platform.allternit.com".to_string()),
            app_title: std::env::var("OPENROUTER_APP_TITLE")
                .unwrap_or_else(|_| "Allternit Cloud".to_string()),
            base_url: std::env::var("OPENROUTER_BASE_URL")
                .unwrap_or_else(|_| OPENROUTER_BASE_URL.to_string()),
        })
    }
}

/// OpenRouter upstream provider.
pub struct OpenRouterProvider {
    config: OpenRouterConfig,
    client: reqwest::Client,
    cache: RwLock<Option<(Instant, Vec<ModelInfo>)>>,
}

impl OpenRouterProvider {
    pub fn new(config: OpenRouterConfig) -> Arc<Self> {
        Arc::new(Self {
            config,
            client: reqwest::Client::new(),
            cache: RwLock::new(None),
        })
    }

    fn headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {}", self.config.api_key)
                .parse()
                .expect("valid bearer header"),
        );
        headers.insert(
            "HTTP-Referer",
            self.config
                .http_referer
                .parse()
                .expect("valid referer header"),
        );
        headers.insert(
            "X-Title",
            self.config.app_title.parse().expect("valid title header"),
        );
        headers
    }

    async fn fetch_models(&self) -> Result<Vec<ModelInfo>, ModelRouterError> {
        let url = format!("{}/models", self.config.base_url);
        let response = self
            .client
            .get(&url)
            .headers(self.headers())
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| ModelRouterError::UpstreamRequestFailed(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let message = response
                .text()
                .await
                .unwrap_or_else(|_| "unknown error".to_string());
            return Err(ModelRouterError::UpstreamError {
                status: status.as_u16(),
                message,
            });
        }

        let list: OpenRouterModelList = response
            .json()
            .await
            .map_err(|e| ModelRouterError::UpstreamRequestFailed(format!("invalid JSON: {}", e)))?;

        let models = list
            .data
            .into_iter()
            .map(|m| {
                let mut extra = m.extra;
                extra.insert("name".to_string(), serde_json::Value::String(m.name));
                if !m.description.is_empty() {
                    extra.insert(
                        "description".to_string(),
                        serde_json::Value::String(m.description),
                    );
                }
                if let Some(ctx) = m.context_length {
                    extra.insert(
                        "context_length".to_string(),
                        serde_json::Value::Number(ctx.into()),
                    );
                }
                if let Some(p) = m.pricing {
                    if let Some(prompt) = p.prompt {
                        extra.insert(
                            "prompt_price".to_string(),
                            serde_json::Value::Number(
                                serde_json::Number::from_f64(prompt).unwrap_or(0.into()),
                            ),
                        );
                    }
                    if let Some(completion) = p.completion {
                        extra.insert(
                            "completion_price".to_string(),
                            serde_json::Value::Number(
                                serde_json::Number::from_f64(completion).unwrap_or(0.into()),
                            ),
                        );
                    }
                }
                if let Some(arch) = m.architecture {
                    extra.insert(
                        "architecture".to_string(),
                        serde_json::Value::Object(arch),
                    );
                }

                ModelInfo {
                    id: m.id,
                    object: "model".to_string(),
                    created: 0,
                    owned_by: m.top_provider.unwrap_or_else(|| "openrouter".to_string()),
                    upstream_id: None,
                    provider: Some("openrouter".to_string()),
                    aliases: None,
                    extra,
                }
            })
            .collect();

        Ok(models)
    }

    /// Proxy a non-streaming chat completion request.
    async fn chat_completions_non_streaming(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<Response<Body>, ModelRouterError> {
        let url = format!("{}/chat/completions", self.config.base_url);
        let upstream_response = self
            .client
            .post(&url)
            .headers(self.headers())
            .json(&request)
            .timeout(Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| ModelRouterError::UpstreamRequestFailed(e.to_string()))?;

        let status = upstream_response.status();
        if !status.is_success() {
            let message = upstream_response
                .text()
                .await
                .unwrap_or_else(|_| "unknown error".to_string());
            return Err(ModelRouterError::UpstreamError {
                status: status.as_u16(),
                message,
            });
        }

        let response_body: ChatCompletionResponse = upstream_response
            .json()
            .await
            .map_err(|e| ModelRouterError::UpstreamRequestFailed(format!("invalid JSON: {}", e)))?;

        let json = serde_json::to_string(&response_body)
            .map_err(|e| ModelRouterError::Internal(e.to_string()))?;

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json))
            .map_err(|e| ModelRouterError::Internal(e.to_string()))
    }

    /// Proxy a streaming chat completion request as server-sent events.
    async fn chat_completions_streaming(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<Response<Body>, ModelRouterError> {
        let url = format!("{}/chat/completions", self.config.base_url);
        let upstream_response = self
            .client
            .post(&url)
            .headers(self.headers())
            .header(reqwest::header::ACCEPT, "text/event-stream")
            .json(&request)
            .timeout(Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| ModelRouterError::UpstreamRequestFailed(e.to_string()))?;

        let status = upstream_response.status();
        if !status.is_success() {
            let message = upstream_response
                .text()
                .await
                .unwrap_or_else(|_| "unknown error".to_string());
            return Err(ModelRouterError::UpstreamError {
                status: status.as_u16(),
                message,
            });
        }

        let byte_stream = upstream_response.bytes_stream();
        let body = Body::from_stream(byte_stream);

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/event-stream")
            .header(header::CACHE_CONTROL, "no-cache")
            .header(header::CONNECTION, "keep-alive")
            .body(body)
            .map_err(|e| ModelRouterError::Internal(e.to_string()))
    }
}

#[async_trait::async_trait]
impl UpstreamProvider for OpenRouterProvider {
    fn provider_id(&self) -> &str {
        "openrouter"
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, ModelRouterError> {
        {
            let guard = self.cache.read().await;
            if let Some((instant, models)) = guard.as_ref() {
                if instant.elapsed() < MODEL_LIST_CACHE_TTL {
                    return Ok(models.clone());
                }
            }
        }

        let models = self.fetch_models().await?;

        {
            let mut guard = self.cache.write().await;
            *guard = Some((Instant::now(), models.clone()));
        }

        Ok(models)
    }

    async fn chat_completions(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<Response<Body>, ModelRouterError> {
        if request.is_streaming() {
            self.chat_completions_streaming(request).await
        } else {
            self.chat_completions_non_streaming(request).await
        }
    }
}

/// Ensure the raw byte stream yields `Bytes` items compatible with axum Body.
fn _assert_bytes_stream<T>(_: T)
where
    T: futures_util::Stream<Item = std::result::Result<Bytes, reqwest::Error>>,
{
}
