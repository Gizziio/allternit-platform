//! Vast.ai provider adapter for the Fabric control plane.
//!
//! Vast.ai is a GPU marketplace with dynamic, machine-specific offers. This
//! adapter searches offers via the `/api/v0/bundles/` endpoint, maps them to
//! Allternit capability classes (`gpu.s/m/l`), and implements the full
//! `FabricProvider` lifecycle.
//!
//! Environment variables:
//! - `VAST_API_KEY` (required) — Vast.ai API key.
//! - `VAST_API_URL` (optional) — API base URL; defaults to
//!   `https://console.vast.ai/api/v0`.
//! - `VAST_DEFAULT_IMAGE` (optional) — Container image used when the request
//!   does not specify one. Defaults to `ubuntu:22.04`.
//!
//! API reference: <https://docs.vast.ai/api-reference/creating-instances-with-api>

use crate::fabric::{
    FabricProvider, HealthSnapshot, Offer, ProviderCapabilities, ProviderError, ProvisionedResource,
    RegionPolicy, ReliabilityTier, ResourceKind, ResourceRequest, ResourceState, UsageEvent,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::time::Duration;

const KIND: &str = "vast";
const DEFAULT_API_URL: &str = "https://console.vast.ai/api/v0";
const DEFAULT_IMAGE: &str = "ubuntu:22.04";

/// Vast.ai REST client configured from the environment.
#[derive(Clone, Debug)]
pub struct VastClient {
    api_url: String,
    api_key: String,
    default_image: String,
    http: reqwest::Client,
}

impl VastClient {
    /// Create a client from environment variables.
    pub fn from_env() -> Result<Self, ProviderError> {
        let api_key = std::env::var("VAST_API_KEY")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| ProviderError::MissingCredentials("VAST_API_KEY".to_string()))?;

        let api_url = std::env::var("VAST_API_URL")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_API_URL.to_string());

        let default_image = std::env::var("VAST_DEFAULT_IMAGE")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_IMAGE.to_string());

        Ok(Self {
            api_url,
            api_key,
            default_image,
            http: reqwest::Client::new(),
        })
    }

    /// Create a client directly. Useful in tests.
    pub fn new(api_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            api_url: api_url.into(),
            api_key: api_key.into(),
            default_image: DEFAULT_IMAGE.to_string(),
            http: reqwest::Client::new(),
        }
    }

    /// Override the default image. Useful in tests.
    pub fn with_default_image(mut self, image: impl Into<String>) -> Self {
        self.default_image = image.into();
        self
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    async fn check_success(&self, res: reqwest::Response) -> Result<serde_json::Value, ProviderError> {
        let status = res.status();
        let body = res
            .json::<serde_json::Value>()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast response parse failed: {e}")))?;

        if !status.is_success() {
            let message = body
                .get("msg")
                .or_else(|| body.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("Vast API error")
                .to_string();
            return Err(ProviderError::from_api_status(status.as_u16(), message));
        }
        Ok(body)
    }
}

#[derive(Debug, Clone, Deserialize)]
struct SearchResponse {
    offers: Vec<VastOffer>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct VastOffer {
    id: u64,
    #[serde(rename = "ask_contract_id")]
    ask_contract_id: Option<u64>,
    #[serde(rename = "gpu_name")]
    gpu_name: String,
    #[serde(rename = "gpu_ram")]
    gpu_ram: u64,
    #[serde(rename = "num_gpus")]
    num_gpus: u64,
    #[serde(rename = "cpu_cores")]
    cpu_cores: u64,
    #[serde(rename = "cpu_ram")]
    cpu_ram: u64,
    #[serde(rename = "dph_total")]
    dph_total: f64,
    geolocation: Option<String>,
    reliability: Option<f64>,
    #[serde(rename = "reliability2")]
    reliability2: Option<f64>,
    #[serde(rename = "is_bid")]
    is_bid: Option<bool>,
    verification: Option<String>,
    rentable: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
struct CreateInstanceResponse {
    success: bool,
    #[serde(rename = "new_contract")]
    new_contract: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct ShowInstanceResponse {
    instances: VastInstance,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct VastInstance {
    id: u64,
    #[serde(rename = "actual_status")]
    actual_status: Option<String>,
    #[serde(rename = "intended_status")]
    intended_status: Option<String>,
    #[serde(rename = "ssh_host")]
    ssh_host: Option<String>,
    #[serde(rename = "ssh_port")]
    ssh_port: Option<u16>,
    #[serde(rename = "public_ipaddr")]
    public_ipaddr: Option<String>,
    #[serde(rename = "uptime_mins")]
    uptime_mins: Option<f64>,
    #[serde(rename = "dph_total")]
    dph_total: Option<f64>,
}

/// Convert Vast instance status to the Fabric `ResourceState`.
fn parse_actual_status(status: Option<&str>) -> ResourceState {
    match status {
        Some("running") => ResourceState::Running,
        Some("stopped") | Some("exited") => ResourceState::Stopped,
        Some("terminated") | Some("destroyed") => ResourceState::Terminated,
        Some("loading") | Some("creating") => ResourceState::Provisioning,
        Some(_) => ResourceState::Unknown,
        None => ResourceState::Unknown,
    }
}

/// Map a Vast GPU memory size to a capability class suffix.
fn class_for_gpu_memory(gpu_ram_mib: u64) -> Option<&'static str> {
    let gb = gpu_ram_mib as f64 / 1024.0;
    if gb >= 70.0 {
        Some("l")
    } else if gb >= 36.0 {
        Some("m")
    } else if gb >= 20.0 {
        Some("s")
    } else {
        None
    }
}

fn kind_matches_vast(req: &ResourceRequest) -> bool {
    matches!(
        req.kind,
        ResourceKind::Gpu | ResourceKind::Inference | ResourceKind::Cluster | ResourceKind::Agent
    )
}

#[async_trait]
impl FabricProvider for VastClient {
    fn kind(&self) -> String {
        KIND.to_string()
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            kinds: vec![
                ResourceKind::Gpu,
                ResourceKind::Inference,
                ResourceKind::Cluster,
                ResourceKind::Agent,
            ],
            regions: vec!["us-east".to_string(), "eu-west".to_string(), "any".to_string()],
            supports_gpu: true,
            supports_interruptible: true,
            supports_spot: false,
            supports_persistence: true,
        }
    }

    async fn discover_offers(&self, req: &ResourceRequest) -> Result<Vec<Offer>, ProviderError> {
        if !kind_matches_vast(req) || req.gpu_vram_mib_min == 0 {
            return Ok(Vec::new());
        }

        // Vast.ai exposes a marketplace of individual machines. We search for
        // rentable offers with enough GPU RAM. The response is an on-demand
        // or bid offer depending on `type`.
        let offer_type = if req.reliability_tier == ReliabilityTier::Interruptible {
            "bid"
        } else {
            "ondemand"
        };

        let filters = json!({
            "gpu_ram": {"gte": req.gpu_vram_mib_min},
            "num_gpus": {"gte": 1},
            "rentable": {"eq": true},
            "type": offer_type,
            "limit": 50
        });

        let url = format!("{}/bundles/", self.api_url);
        let res = self
            .http
            .post(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&filters)
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast search request failed: {e}")))?;

        let body = self.check_success(res).await?;
        let search: SearchResponse = serde_json::from_value(body).map_err(|e| {
            ProviderError::Request(format!("Vast search response shape unexpected: {e}"))
        })?;

        let mut offers = Vec::new();

        for offer in search.offers {
            if !offer.rentable.unwrap_or(true) {
                continue;
            }

            if class_for_gpu_memory(offer.gpu_ram).is_none() {
                continue;
            }

            // Per-GPU vRAM must satisfy the request. Vast lists total GPU RAM
            // for the offer, but we advertise the per-GPU capacity.
            let per_gpu_vram = offer.gpu_ram / offer.num_gpus.max(1);
            if per_gpu_vram < req.gpu_vram_mib_min {
                continue;
            }

            let price_per_hour_cents = (offer.dph_total * 100.0).round() as i64;
            if price_per_hour_cents <= 0 {
                continue;
            }

            if let Some(max) = req.constraints.max_price_per_hour_cents {
                if price_per_hour_cents > max {
                    continue;
                }
            }

            let region = offer
                .geolocation
                .as_deref()
                .map(|g| {
                    let lower = g.to_lowercase();
                    if lower.contains("us") || lower.contains("america") {
                        "us-east".to_string()
                    } else if lower.contains("eu") || lower.contains("europe") {
                        "eu-west".to_string()
                    } else {
                        "any".to_string()
                    }
                })
                .unwrap_or_else(|| "any".to_string());

            match &req.region_policy {
                RegionPolicy::Require(regions) if !regions.contains(&region) => continue,
                RegionPolicy::Exclude(regions) if regions.contains(&region) => continue,
                _ => {}
            }

            let reliability = offer
                .reliability2
                .or(offer.reliability)
                .unwrap_or(0.9)
                .clamp(0.0, 1.0);

            let instance_type = format!("{}-{}x{}-{:016x}", offer.gpu_name, offer.num_gpus, per_gpu_vram, offer.id);

            offers.push(Offer {
                id: format!("off_vast_{}", offer.id),
                provider_kind: KIND.to_string(),
                region,
                instance_type,
                vcpu: offer.cpu_cores as u32,
                memory_mib: offer.cpu_ram,
                gpu_vram_mib: per_gpu_vram,
                gpu_model: Some(offer.gpu_name.clone()),
                price_per_hour_cents,
                currency: "USD".to_string(),
                reliability_score: reliability,
                interruptible: offer.is_bid.unwrap_or(false)
                    || req.reliability_tier == ReliabilityTier::Interruptible,
                estimated_ready_secs: 180,
                raw_metadata: Some(json!({
                    "vast_offer_id": offer.id,
                    "vast_ask_contract_id": offer.ask_contract_id,
                    "vast_gpu_name": offer.gpu_name,
                    "vast_num_gpus": offer.num_gpus,
                    "vast_geolocation": offer.geolocation,
                    "vast_verification": offer.verification,
                    "vast_is_bid": offer.is_bid,
                    "vast_dph_total": offer.dph_total,
                })),
            });
        }

        Ok(offers)
    }

    async fn quote(&self, offer: &Offer, duration: Duration) -> Result<i64, ProviderError> {
        let hours = duration.as_secs_f64() / 3600.0;
        Ok((offer.price_per_hour_cents as f64 * hours) as i64)
    }

    async fn provision(
        &self,
        req: &ResourceRequest,
        offer: &Offer,
    ) -> Result<ProvisionedResource, ProviderError> {
        let offer_id = offer
            .raw_metadata
            .as_ref()
            .and_then(|m| m.get("vast_offer_id"))
            .and_then(|v| v.as_u64())
            .ok_or_else(|| ProviderError::Request("Vast offer id missing in metadata".to_string()))?;

        let image = req
            .image
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| self.default_image.clone());

        let body = json!({
            "image": image,
            "label": req.display_name.as_deref().unwrap_or("allternit-vast"),
            "disk": 20,
            "runtype": "ssh_direct",
            "target_state": "running"
        });

        let url = format!("{}/asks/{}/", self.api_url, offer_id);
        let res = self
            .http
            .put(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast create instance request failed: {e}")))?;

        let body = self.check_success(res).await?;
        let created: CreateInstanceResponse = serde_json::from_value(body).map_err(|e| {
            ProviderError::Request(format!("Vast create instance response shape unexpected: {e}"))
        })?;

        if !created.success {
            return Err(ProviderError::Api {
                status: 500,
                message: "Vast instance creation reported failure".to_string(),
            });
        }

        let instance_id = created
            .new_contract
            .ok_or_else(|| ProviderError::Api {
                status: 500,
                message: "Vast did not return a new_contract id".to_string(),
            })?;

        let mut metadata = HashMap::new();
        metadata.insert("vast_offer_id".to_string(), offer_id.to_string());

        Ok(ProvisionedResource {
            provider_resource_id: instance_id.to_string(),
            region: offer.region.clone(),
            instance_type: offer.instance_type.clone(),
            ipv4: None,
            endpoint: None,
            metadata,
        })
    }

    async fn inspect(&self, provider_resource_id: &str) -> Result<ResourceState, ProviderError> {
        let url = format!("{}/instances/{}/", self.api_url, provider_resource_id);
        let res = self
            .http
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast show instance request failed: {e}")))?;

        let body = self.check_success(res).await?;
        let show: ShowInstanceResponse = serde_json::from_value(body).map_err(|e| {
            ProviderError::Request(format!("Vast show instance response shape unexpected: {e}"))
        })?;

        Ok(parse_actual_status(show.instances.actual_status.as_deref()))
    }

    async fn start(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let url = format!("{}/instances/{}", self.api_url, provider_resource_id);
        let body = json!({"state": "running"});
        let res = self
            .http
            .put(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast start instance request failed: {e}")))?;
        self.check_success(res).await?;
        Ok(())
    }

    async fn stop(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let url = format!("{}/instances/{}", self.api_url, provider_resource_id);
        let body = json!({"state": "stopped"});
        let res = self
            .http
            .put(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast stop instance request failed: {e}")))?;
        self.check_success(res).await?;
        Ok(())
    }

    async fn terminate(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let url = format!("{}/instances/{}", self.api_url, provider_resource_id);
        let res = self
            .http
            .delete(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast destroy instance request failed: {e}")))?;
        self.check_success(res).await?;
        Ok(())
    }

    async fn collect_usage(
        &self,
        provider_resource_id: &str,
        since: DateTime<Utc>,
    ) -> Result<Vec<UsageEvent>, ProviderError> {
        // Vast exposes per-instance uptime in minutes. We emit compute seconds
        // from that value. Provider invoices remain authoritative for cost.
        let url = format!("{}/instances/{}/", self.api_url, provider_resource_id);
        let res = self
            .http
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Vast usage request failed: {e}")))?;

        let body = self.check_success(res).await?;
        let show: ShowInstanceResponse = serde_json::from_value(body).map_err(|e| {
            ProviderError::Request(format!("Vast usage response shape unexpected: {e}"))
        })?;

        let uptime_seconds = show
            .instances
            .uptime_mins
            .map(|m| (m * 60.0) as u64)
            .unwrap_or(0);

        let running = matches!(
            parse_actual_status(show.instances.actual_status.as_deref()),
            ResourceState::Running
        );

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), KIND.to_string());
        metadata.insert("running".to_string(), running.to_string());

        Ok(vec![UsageEvent {
            event_type: "compute_seconds".to_string(),
            quantity: uptime_seconds as f64,
            unit: "seconds".to_string(),
            measured_at: since,
            metadata,
        }])
    }

    async fn health(&self) -> Result<HealthSnapshot, ProviderError> {
        // Lightweight probe: search with a tiny limit.
        let url = format!("{}/bundles/", self.api_url);
        let body = json!({"limit": 1});
        match self
            .http
            .post(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(res) => {
                if res.status().is_success() {
                    Ok(HealthSnapshot {
                        healthy: true,
                        message: Some("Vast.ai API reachable".to_string()),
                        last_checked: Utc::now(),
                    })
                } else {
                    Ok(HealthSnapshot {
                        healthy: false,
                        message: Some(format!("Vast.ai API returned {}", res.status())),
                        last_checked: Utc::now(),
                    })
                }
            }
            Err(e) => Ok(HealthSnapshot {
                healthy: false,
                message: Some(format!("Vast.ai health check failed: {e}")),
                last_checked: Utc::now(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fabric::{CustomerConstraints, ReliabilityTier, ResourceRequest};

    fn gpu_request(class: &str, min_vram_mib: u64) -> ResourceRequest {
        ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Gpu,
            class: class.to_string(),
            display_name: None,
            vcpu_min: 1,
            memory_mib_min: 1024,
            gpu_vram_mib_min: min_vram_mib,
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
        }
    }

    #[tokio::test]
    async fn vast_discovers_offers_for_gpu_request() {
        let mut server = mockito::Server::new_async().await;
        let client = VastClient::new(server.url(), "test-key");

        let body = json!({
            "offers": [
                {
                    "id": 12345678,
                    "ask_contract_id": 12345678,
                    "gpu_name": "RTX 4090",
                    "gpu_ram": 24576,
                    "num_gpus": 1,
                    "cpu_cores": 16,
                    "cpu_ram": 65536,
                    "dph_total": 0.35,
                    "geolocation": "Washington, US",
                    "reliability2": 0.99,
                    "is_bid": false,
                    "verification": "verified",
                    "rentable": true
                },
                {
                    "id": 87654321,
                    "ask_contract_id": 87654321,
                    "gpu_name": "RTX A6000",
                    "gpu_ram": 49152,
                    "num_gpus": 1,
                    "cpu_cores": 32,
                    "cpu_ram": 131072,
                    "dph_total": 0.53,
                    "geolocation": "Frankfurt, DE",
                    "reliability2": 0.97,
                    "is_bid": false,
                    "verification": "verified",
                    "rentable": true
                }
            ]
        });

        server
            .mock("POST", "/bundles/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body.to_string())
            .create_async()
            .await;

        let req = gpu_request("s", 20 * 1024);
        let offers = client.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 2);
        assert!(offers.iter().any(|o| o.instance_type.contains("RTX 4090")));
        assert!(offers.iter().any(|o| o.instance_type.contains("RTX A6000")));
    }

    #[tokio::test]
    async fn vast_filters_out_non_rentable_offers() {
        let mut server = mockito::Server::new_async().await;
        let client = VastClient::new(server.url(), "test-key");

        let body = json!({
            "offers": [
                {
                    "id": 1,
                    "gpu_name": "RTX 4090",
                    "gpu_ram": 24576,
                    "num_gpus": 1,
                    "cpu_cores": 16,
                    "cpu_ram": 65536,
                    "dph_total": 0.35,
                    "geolocation": "Washington, US",
                    "reliability2": 0.99,
                    "is_bid": false,
                    "rentable": true
                },
                {
                    "id": 2,
                    "gpu_name": "RTX A6000",
                    "gpu_ram": 49152,
                    "num_gpus": 1,
                    "cpu_cores": 32,
                    "cpu_ram": 131072,
                    "dph_total": 0.53,
                    "geolocation": "Frankfurt, DE",
                    "reliability2": 0.97,
                    "is_bid": false,
                    "rentable": false
                }
            ]
        });

        server
            .mock("POST", "/bundles/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body.to_string())
            .create_async()
            .await;

        let req = gpu_request("s", 20 * 1024);
        let offers = client.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 1);
        assert_eq!(offers[0].gpu_model.as_deref(), Some("RTX 4090"));
    }

    #[tokio::test]
    async fn vast_returns_no_offers_for_compute_request() {
        let mut server = mockito::Server::new_async().await;
        let client = VastClient::new(server.url(), "test-key");

        server
            .mock("POST", "/bundles/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(json!({"offers": []}).to_string())
            .create_async()
            .await;

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
    async fn vast_provisions_instance() {
        let mut server = mockito::Server::new_async().await;
        let client = VastClient::new(server.url(), "test-key");

        server
            .mock("PUT", "/asks/12345678/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                json!({
                    "success": true,
                    "new_contract": 987654
                })
                .to_string(),
            )
            .create_async()
            .await;

        let req = gpu_request("s", 20 * 1024);
        let offer = Offer {
            id: "off_vast_12345678".to_string(),
            provider_kind: KIND.to_string(),
            region: "us-east".to_string(),
            instance_type: "RTX 4090-1x24576-0000000000000000".to_string(),
            vcpu: 16,
            memory_mib: 65536,
            gpu_vram_mib: 24576,
            gpu_model: Some("RTX 4090".to_string()),
            price_per_hour_cents: 35,
            currency: "USD".to_string(),
            reliability_score: 0.99,
            interruptible: false,
            estimated_ready_secs: 180,
            raw_metadata: Some(json!({"vast_offer_id": 12345678})),
        };

        let resource = client.provision(&req, &offer).await.unwrap();
        assert_eq!(resource.provider_resource_id, "987654");
        assert_eq!(resource.metadata.get("vast_offer_id"), Some(&"12345678".to_string()));
    }

    #[tokio::test]
    async fn vast_inspect_maps_status() {
        let mut server = mockito::Server::new_async().await;
        let client = VastClient::new(server.url(), "test-key");

        server
            .mock("GET", "/instances/987654/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                json!({
                    "instances": {
                        "id": 987654,
                        "actual_status": "running",
                        "intended_status": "running",
                        "ssh_host": "ssh2281.vast.ai",
                        "ssh_port": 10882,
                        "public_ipaddr": "63.135.50.11",
                        "uptime_mins": 5.0,
                        "dph_total": 0.35
                    }
                })
                .to_string(),
            )
            .create_async()
            .await;

        let state = client.inspect("987654").await.unwrap();
        assert_eq!(state, ResourceState::Running);
    }

    #[tokio::test]
    async fn vast_start_stop_terminate() {
        let mut server = mockito::Server::new_async().await;
        let client = VastClient::new(server.url(), "test-key");

        server
            .mock("PUT", "/instances/987654")
            .match_body(mockito::Matcher::Regex("running".to_string()))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(json!({"success": true}).to_string())
            .create_async()
            .await;

        server
            .mock("PUT", "/instances/987654")
            .match_body(mockito::Matcher::Regex("stopped".to_string()))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(json!({"success": true}).to_string())
            .create_async()
            .await;

        server
            .mock("DELETE", "/instances/987654")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(json!({"success": true, "msg": "destroyed"}).to_string())
            .create_async()
            .await;

        client.start("987654").await.unwrap();
        client.stop("987654").await.unwrap();
        client.terminate("987654").await.unwrap();
    }

    #[tokio::test]
    async fn vast_from_env_requires_key() {
        for (k, _) in std::env::vars() {
            if k == "VAST_API_KEY" {
                std::env::remove_var(&k);
            }
        }
        let result = VastClient::from_env();
        assert!(matches!(result, Err(ProviderError::MissingCredentials(_))));
    }
}
