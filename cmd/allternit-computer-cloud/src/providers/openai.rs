//! OpenAI inference adapter for the Fabric control plane.
//!
//! Models external OpenAI-compatible endpoints as capacity-less inference
//! supply. There is no VM to provision; each "resource" is a model endpoint
//! that the Model Gateway routes requests to. Token usage is metered by the
//! gateway; this adapter only exposes pricing and connectivity.
//!
//! Environment variables:
//! - `OPENAI_API_KEY` (required) — API key.
//! - `OPENAI_API_URL` (optional) — base URL; defaults to
//!   `https://api.openai.com/v1`.
//!
//! Pricing is a hardcoded planning catalog. Production should pull live model
//! prices from the OpenAI API or a cached price sheet.

use crate::fabric::{
    FabricProvider, HealthSnapshot, Offer, ProviderCapabilities, ProviderError, ProvisionedResource,
    RegionPolicy, ResourceKind, ResourceRequest, ResourceState, UsageEvent,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::time::Duration;

const KIND: &str = "openai";
const DEFAULT_API_URL: &str = "https://api.openai.com/v1";

/// A model in the OpenAI planning catalog. Prices are in USD cents per
/// 1,000,000 tokens.
#[derive(Debug, Clone)]
struct ModelPrice {
    id: &'static str,
    display_name: &'static str,
    context_tokens: u32,
    input_cents_per_1m: i64,
    output_cents_per_1m: i64,
    quality_tier: &'static str,
}

fn model_catalog() -> Vec<ModelPrice> {
    vec![
        ModelPrice {
            id: "gpt-4o-mini",
            display_name: "GPT-4o mini",
            context_tokens: 128_000,
            input_cents_per_1m: 15,
            output_cents_per_1m: 60,
            quality_tier: "fast",
        },
        ModelPrice {
            id: "gpt-4o",
            display_name: "GPT-4o",
            context_tokens: 128_000,
            input_cents_per_1m: 250,
            output_cents_per_1m: 1000,
            quality_tier: "high",
        },
        ModelPrice {
            id: "gpt-4.1-mini",
            display_name: "GPT-4.1 mini",
            context_tokens: 1_000_000,
            input_cents_per_1m: 40,
            output_cents_per_1m: 160,
            quality_tier: "fast",
        },
        ModelPrice {
            id: "gpt-4.1",
            display_name: "GPT-4.1",
            context_tokens: 1_000_000,
            input_cents_per_1m: 200,
            output_cents_per_1m: 800,
            quality_tier: "high",
        },
        ModelPrice {
            id: "o3-mini",
            display_name: "o3-mini",
            context_tokens: 200_000,
            input_cents_per_1m: 110,
            output_cents_per_1m: 440,
            quality_tier: "reasoning",
        },
    ]
}

/// OpenAI-compatible inference provider.
#[derive(Clone, Debug)]
pub struct OpenAiClient {
    api_url: String,
    api_key: String,
    http: reqwest::Client,
}

impl OpenAiClient {
    /// Create a client from environment variables.
    pub fn from_env() -> Result<Self, ProviderError> {
        let api_key = std::env::var("OPENAI_API_KEY")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| ProviderError::MissingCredentials("OPENAI_API_KEY".to_string()))?;

        let api_url = std::env::var("OPENAI_API_URL")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_API_URL.to_string());

        Ok(Self {
            api_url,
            api_key,
            http: reqwest::Client::new(),
        })
    }

    /// Create a client directly. Useful in tests.
    pub fn new(api_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            api_url: api_url.into(),
            api_key: api_key.into(),
            http: reqwest::Client::new(),
        }
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    async fn get(&self, path: &str) -> Result<serde_json::Value, ProviderError> {
        let url = format!("{}{}", self.api_url.trim_end_matches('/'), path);
        let res = self
            .http
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("OpenAI request failed: {e}")))?;

        let status = res.status();
        let body: serde_json::Value = res
            .json()
            .await
            .map_err(|e| ProviderError::Request(format!("OpenAI response parse failed: {e}")))?;

        if !status.is_success() {
            let message = body
                .get("error")
                .and_then(|e: &serde_json::Value| e.get("message"))
                .and_then(|m: &serde_json::Value| m.as_str())
                .unwrap_or("OpenAI API error")
                .to_string();
            return Err(ProviderError::Api {
                status: status.as_u16(),
                message,
            });
        }
        Ok(body)
    }
}

fn kind_matches(req: &ResourceRequest) -> bool {
    req.kind == ResourceKind::Inference
}

#[async_trait]
impl FabricProvider for OpenAiClient {
    fn kind(&self) -> String {
        KIND.to_string()
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            kinds: vec![ResourceKind::Inference],
            regions: vec!["us-east".to_string(), "any".to_string()],
            supports_gpu: false,
            supports_interruptible: false,
            supports_spot: false,
            supports_persistence: false,
        }
    }

    async fn discover_offers(&self, req: &ResourceRequest) -> Result<Vec<Offer>, ProviderError> {
        if !kind_matches(req) {
            return Ok(Vec::new());
        }

        let mut offers = Vec::new();
        for model in model_catalog() {
            // Filter by requested model if the customer pinned one.
            if let Some(pin) = req.model.as_deref().filter(|s| !s.is_empty()) {
                if model.id != pin {
                    continue;
                }
            }

            let region = match &req.region_policy {
                RegionPolicy::Require(regions) if !regions.contains(&"us-east".to_string()) => {
                    continue;
                }
                RegionPolicy::Exclude(regions) if regions.contains(&"us-east".to_string()) => {
                    continue;
                }
                _ => "us-east".to_string(),
            };

            // Price is input cost per 1M tokens in cents. The scheduler can
            // compare offers by this normalized unit.
            let price = model.input_cents_per_1m.max(1);
            if let Some(max) = req.constraints.max_price_per_hour_cents {
                if price > max {
                    continue;
                }
            }

            offers.push(Offer {
                id: format!("off_openai_{}", model.id),
                provider_kind: KIND.to_string(),
                region,
                instance_type: model.id.to_string(),
                vcpu: 0,
                memory_mib: 0,
                gpu_vram_mib: 0,
                gpu_model: None,
                price_per_hour_cents: price,
                currency: "USD".to_string(),
                reliability_score: 0.99,
                interruptible: false,
                estimated_ready_secs: 0,
                raw_metadata: Some(json!({
                    "openai_model_id": model.id,
                    "openai_model_name": model.display_name,
                    "openai_context_tokens": model.context_tokens,
                    "openai_input_cents_per_1m": model.input_cents_per_1m,
                    "openai_output_cents_per_1m": model.output_cents_per_1m,
                    "openai_quality_tier": model.quality_tier,
                    "openai_endpoint": format!("{}/chat/completions", self.api_url.trim_end_matches('/')),
                })),
            });
        }

        Ok(offers)
    }

    async fn quote(&self, _offer: &Offer, _duration: Duration) -> Result<i64, ProviderError> {
        // Inference is pay-per-use; no hourly quote.
        Ok(0)
    }

    async fn provision(
        &self,
        req: &ResourceRequest,
        offer: &Offer,
    ) -> Result<ProvisionedResource, ProviderError> {
        let model_id = offer.instance_type.clone();
        let endpoint = offer
            .raw_metadata
            .as_ref()
            .and_then(|m| m.get("openai_endpoint"))
            .and_then(|v| v.as_str())
            .unwrap_or("https://api.openai.com/v1/chat/completions")
            .to_string();

        let resource_id = format!("{}:{}", KIND, model_id);
        let mut metadata = HashMap::new();
        metadata.insert("openai_model_id".to_string(), model_id.clone());
        metadata.insert("openai_endpoint".to_string(), endpoint.clone());
        metadata.insert("allternit_request_id".to_string(), req.id.clone());

        Ok(ProvisionedResource {
            provider_resource_id: resource_id,
            region: offer.region.clone(),
            instance_type: model_id,
            ipv4: None,
            endpoint: Some(endpoint),
            metadata,
        })
    }

    async fn inspect(&self, provider_resource_id: &str) -> Result<ResourceState, ProviderError> {
        if provider_resource_id.starts_with(&format!("{}:", KIND)) {
            Ok(ResourceState::Running)
        } else {
            Err(ProviderError::NotFound(provider_resource_id.to_string()))
        }
    }

    async fn start(&self, _provider_resource_id: &str) -> Result<(), ProviderError> {
        Ok(())
    }

    async fn stop(&self, _provider_resource_id: &str) -> Result<(), ProviderError> {
        Ok(())
    }

    async fn terminate(&self, _provider_resource_id: &str) -> Result<(), ProviderError> {
        // Stateless endpoint; nothing to terminate.
        Ok(())
    }

    async fn collect_usage(
        &self,
        provider_resource_id: &str,
        since: DateTime<Utc>,
    ) -> Result<Vec<UsageEvent>, ProviderError> {
        // Token/request usage is metered by the Model Gateway. The provider
        // adapter only reports that the endpoint is available.
        let model_id = provider_resource_id
            .strip_prefix(&format!("{}:", KIND))
            .unwrap_or(provider_resource_id);

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), KIND.to_string());
        metadata.insert("openai_model_id".to_string(), model_id.to_string());
        metadata.insert("note".to_string(), "token usage metered by model gateway".to_string());

        Ok(vec![UsageEvent {
            event_type: "endpoint_available".to_string(),
            quantity: 1.0,
            unit: "boolean".to_string(),
            measured_at: since,
            metadata,
        }])
    }

    async fn health(&self) -> Result<HealthSnapshot, ProviderError> {
        // Probe the models endpoint as a lightweight connectivity check.
        match self.get("/models").await {
            Ok(_) => Ok(HealthSnapshot {
                healthy: true,
                message: Some("OpenAI API reachable".to_string()),
                last_checked: Utc::now(),
            }),
            Err(e) => Ok(HealthSnapshot {
                healthy: false,
                message: Some(format!("OpenAI health check failed: {e}")),
                last_checked: Utc::now(),
            }),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct ModelsResponse {
    data: Vec<OpenAiModel>,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct OpenAiModel {
    id: String,
    #[serde(rename = "created")]
    created_at: Option<i64>,
    object: Option<String>,
    owned_by: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fabric::{CustomerConstraints, ReliabilityTier, ResourceRequest};

    fn inference_request(model: Option<&str>) -> ResourceRequest {
        ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Inference,
            class: "s".to_string(),
            display_name: None,
            vcpu_min: 0,
            memory_mib_min: 0,
            gpu_vram_mib_min: 0,
            region_policy: RegionPolicy::Any,
            latency_slo_ms: None,
            deadline: None,
            reliability_tier: ReliabilityTier::Standard,
            image: None,
            model: model.map(|s| s.to_string()),
            runtime: None,
            storage_mib: 0,
            egress_policy: None,
            constraints: CustomerConstraints::default(),
            labels: HashMap::new(),
            user_data: None,
        }
    }

    #[tokio::test]
    async fn openai_discovers_offers_for_inference_request() {
        let client = OpenAiClient::new("http://dummy", "test-key");
        let req = inference_request(None);
        let offers = client.discover_offers(&req).await.unwrap();
        assert!(offers.len() >= 4);
        assert!(offers.iter().any(|o| o.instance_type == "gpt-4o-mini"));
        assert!(offers.iter().any(|o| o.instance_type == "gpt-4o"));
    }

    #[tokio::test]
    async fn openai_filters_by_pinned_model() {
        let client = OpenAiClient::new("http://dummy", "test-key");
        let req = inference_request(Some("gpt-4o-mini"));
        let offers = client.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 1);
        assert_eq!(offers[0].instance_type, "gpt-4o-mini");
    }

    #[tokio::test]
    async fn openai_returns_no_offers_for_compute_request() {
        let client = OpenAiClient::new("http://dummy", "test-key");
        let req = ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Compute,
            class: "s".to_string(),
            display_name: None,
            vcpu_min: 1,
            memory_mib_min: 1024,
            gpu_vram_mib_min: 0,
            region_policy: RegionPolicy::Any,
            latency_slo_ms: None,
            deadline: None,
            reliability_tier: ReliabilityTier::Standard,
            image: None,
            model: None,
            runtime: None,
            storage_mib: 0,
            egress_policy: None,
            constraints: CustomerConstraints::default(),
            labels: HashMap::new(),
            user_data: None,
        };

        let offers = client.discover_offers(&req).await.unwrap();
        assert!(offers.is_empty());
    }

    #[tokio::test]
    async fn openai_provisions_endpoint() {
        let client = OpenAiClient::new("http://dummy", "test-key");
        let req = inference_request(Some("gpt-4o-mini"));
        let offers = client.discover_offers(&req).await.unwrap();
        let offer = offers.into_iter().next().unwrap();

        let resource = client.provision(&req, &offer).await.unwrap();
        assert_eq!(resource.provider_resource_id, "openai:gpt-4o-mini");
        assert!(resource.endpoint.as_deref().unwrap().contains("/chat/completions"));
    }

    #[tokio::test]
    async fn openai_health_checks_models_endpoint() {
        let mut server = mockito::Server::new_async().await;
        let client = OpenAiClient::new(server.url(), "test-key");

        server
            .mock("GET", "/models")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(json!({"data": [{"id": "gpt-4o-mini"}]}).to_string())
            .create_async()
            .await;

        let health = client.health().await.unwrap();
        assert!(health.healthy);
    }

    #[tokio::test]
    async fn openai_from_env_requires_key() {
        for (k, _) in std::env::vars() {
            if k == "OPENAI_API_KEY" {
                std::env::remove_var(&k);
            }
        }
        let result = OpenAiClient::from_env();
        assert!(matches!(result, Err(ProviderError::MissingCredentials(_))));
    }
}
