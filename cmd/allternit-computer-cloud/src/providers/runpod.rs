//! Runpod provider adapter for the Fabric control plane.
//!
//! Runpod exposes GPU-first pods through a GraphQL API. This adapter maps
//! Runpod GPU types to Allternit capability classes (`gpu.s/m/l`) and
//! implements the full `FabricProvider` lifecycle.
//!
//! Environment variables:
//! - `RUNPOD_API_TOKEN` (required) — Runpod API key.
//! - `RUNPOD_API_URL` (optional) — GraphQL endpoint; defaults to
//!   `https://api.runpod.io/graphql`.
//! - `RUNPOD_DEFAULT_IMAGE` (optional) — Container image used when the request
//!   does not specify one. Defaults to a PyTorch/CUDA image maintained by
//!   Runpod.
//!
//! GraphQL reference: <https://docs.runpod.io/sdks/graphql/manage-pods>

use crate::fabric::{
    FabricProvider, HealthSnapshot, Offer, ProviderCapabilities, ProviderError, ProvisionedResource,
    RegionPolicy, ReliabilityTier, ResourceKind, ResourceRequest, ResourceState, UsageEvent,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::time::Duration;

const KIND: &str = "runpod";
const DEFAULT_API_URL: &str = "https://api.runpod.io/graphql";
const DEFAULT_IMAGE: &str = "runpod/pytorch:2.2.0-py3.10-cuda12.1-devel-ubuntu22.04";

/// Runpod GraphQL client configured from the environment.
#[derive(Clone, Debug)]
pub struct RunpodClient {
    api_url: String,
    api_token: String,
    default_image: String,
    http: reqwest::Client,
}

impl RunpodClient {
    /// Create a client from environment variables.
    ///
    /// Returns `ProviderError::NotConfigured` when `RUNPOD_API_TOKEN` is
    /// missing or empty.
    pub fn from_env() -> Result<Self, ProviderError> {
        let api_token = std::env::var("RUNPOD_API_TOKEN")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| ProviderError::MissingCredentials("RUNPOD_API_TOKEN".to_string()))?;

        let api_url = std::env::var("RUNPOD_API_URL")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_API_URL.to_string());

        let default_image = std::env::var("RUNPOD_DEFAULT_IMAGE")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_IMAGE.to_string());

        Ok(Self {
            api_url,
            api_token,
            default_image,
            http: reqwest::Client::new(),
        })
    }

    /// Create a client directly. Useful in tests.
    pub fn new(api_url: impl Into<String>, api_token: impl Into<String>) -> Self {
        Self {
            api_url: api_url.into(),
            api_token: api_token.into(),
            default_image: DEFAULT_IMAGE.to_string(),
            http: reqwest::Client::new(),
        }
    }

    /// Override the default image. Useful in tests.
    pub fn with_default_image(mut self, image: impl Into<String>) -> Self {
        self.default_image = image.into();
        self
    }

    async fn graphql_request<T: serde::de::DeserializeOwned>(
        &self,
        query: &str,
        variables: Option<serde_json::Value>,
    ) -> Result<T, ProviderError> {
        let body = json!({"query": query, "variables": variables.unwrap_or_default()});
        let res = self
            .http
            .post(&self.api_url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Request(format!("Runpod request failed: {e}")))?;

        let status = res.status();
        let payload: GraphQlResponse<T> = res
            .json()
            .await
            .map_err(|e| ProviderError::Request(format!("Runpod response parse failed: {e}")))?;

        if let Some(errors) = payload.errors {
            if !errors.is_empty() {
                let messages: Vec<String> = errors.into_iter().map(|e| e.message).collect();
                return Err(ProviderError::Api {
                    status: status.as_u16(),
                    message: messages.join("; "),
                });
            }
        }

        payload.data.ok_or_else(|| {
            ProviderError::Api {
                status: status.as_u16(),
                message: "Runpod response contained no data".to_string(),
            }
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct GraphQlResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQlError>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct GraphQlError {
    message: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GpuTypesResponse {
    #[serde(rename = "gpuTypes")]
    gpu_types: Vec<GpuType>,
}

#[derive(Debug, Clone, Deserialize)]
struct GpuType {
    id: String,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "memoryInGb")]
    memory_in_gb: f64,
    #[serde(rename = "secureCloud")]
    secure_cloud: bool,
    #[serde(rename = "communityCloud")]
    community_cloud: bool,
    #[serde(rename = "lowestPrice")]
    lowest_price: Option<GpuLowestPrice>,
}

#[derive(Debug, Clone, Deserialize)]
struct GpuLowestPrice {
    #[serde(rename = "uninterruptablePrice")]
    uninterruptable_price: Option<f64>,
    #[serde(rename = "interruptablePrice")]
    interruptable_price: Option<f64>,
    #[serde(rename = "stockStatus")]
    stock_status: String,
}

#[derive(Debug, Clone, Deserialize)]
struct PodResponse {
    pod: Option<Pod>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct Pod {
    id: String,
    name: Option<String>,
    #[serde(rename = "desiredStatus")]
    desired_status: Option<String>,
    runtime: Option<PodRuntime>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct PodRuntime {
    #[serde(rename = "uptimeInSeconds")]
    uptime_in_seconds: Option<u64>,
    ports: Option<Vec<PodPort>>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct PodPort {
    ip: Option<String>,
    #[serde(rename = "publicPort")]
    public_port: Option<u16>,
    #[serde(rename = "type")]
    port_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct PodDeployResponse {
    #[serde(rename = "podFindAndDeployOnDemand")]
    pod_find_and_deploy_on_demand: Option<DeployedPod>,
}

#[derive(Debug, Clone, Deserialize)]
struct DeployedPod {
    id: String,
    #[serde(rename = "imageName")]
    image_name: Option<String>,
    #[serde(rename = "machineId")]
    machine_id: Option<String>,
    machine: Option<DeployedMachine>,
}

#[derive(Debug, Clone, Deserialize)]
struct DeployedMachine {
    #[serde(rename = "podHostId")]
    pod_host_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct PodActionResponse {
    #[serde(rename = "podResume")]
    pod_resume: Option<String>,
    #[serde(rename = "podStop")]
    pod_stop: Option<String>,
    #[serde(rename = "podTerminate")]
    pod_terminate: Option<String>,
}

/// Convert Runpod `desiredStatus` to the Fabric `ResourceState`.
fn parse_desired_status(status: Option<&str>) -> ResourceState {
    match status {
        Some("RUNNING") => ResourceState::Running,
        Some("EXITED") | Some("STOPPED") => ResourceState::Stopped,
        Some("TERMINATED") => ResourceState::Terminated,
        Some(_) => ResourceState::Unknown,
        None => ResourceState::Unknown,
    }
}

/// Map a Runpod GPU memory size to a capability class suffix.
///
/// Thresholds mirror the built-in SKU catalog:
/// - `gpu.s`: ~24 GB (e.g. RTX A5000, RTX 3090)
/// - `gpu.m`: ~48 GB (e.g. RTX A40, RTX A6000)
/// - `gpu.l`: 80+ GB (e.g. A100, H100)
fn class_for_gpu_memory(memory_in_gb: f64) -> Option<&'static str> {
    if memory_in_gb >= 70.0 {
        Some("l")
    } else if memory_in_gb >= 36.0 {
        Some("m")
    } else if memory_in_gb >= 20.0 {
        Some("s")
    } else {
        None
    }
}

fn kind_matches_runpod(req: &ResourceRequest) -> bool {
    matches!(
        req.kind,
        ResourceKind::Gpu | ResourceKind::Inference | ResourceKind::Cluster | ResourceKind::Agent
    )
}

#[async_trait]
impl FabricProvider for RunpodClient {
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
        if !kind_matches_runpod(req) {
            return Ok(Vec::new());
        }

        // Runpod only supplies GPU pods today. CPU-only requests return no
        // offers; Incus / dedicated-server adapters will satisfy those.
        if req.gpu_vram_mib_min == 0 {
            return Ok(Vec::new());
        }

        let query = r#"
            query {
                gpuTypes {
                    id
                    displayName
                    memoryInGb
                    secureCloud
                    communityCloud
                    lowestPrice(input: {gpuCount: 1}) {
                        uninterruptablePrice
                        interruptablePrice
                        stockStatus
                    }
                }
            }
        "#;

        let resp: GpuTypesResponse = self.graphql_request(query, None).await?;
        let mut offers = Vec::new();

        for gpu in resp.gpu_types {
            // Only consider GPUs that are in stock.
            if gpu.lowest_price.as_ref().map(|p| p.stock_status.as_str()) != Some("Available") {
                continue;
            }

            let memory_mib = (gpu.memory_in_gb * 1024.0) as u64;
            if memory_mib < req.gpu_vram_mib_min {
                continue;
            }

            let Some(class_suffix) = class_for_gpu_memory(gpu.memory_in_gb) else {
                continue;
            };

            let interruptible = req.reliability_tier == ReliabilityTier::Interruptible;
            let price_per_hour = gpu
                .lowest_price
                .as_ref()
                .and_then(|p| {
                    if interruptible {
                        p.interruptable_price
                    } else {
                        p.uninterruptable_price
                    }
                })
                .unwrap_or(0.0);

            // Price is returned in USD per hour (float). Convert to cents.
            let price_per_hour_cents = (price_per_hour * 100.0).round() as i64;
            if price_per_hour_cents <= 0 {
                continue;
            }

            // Region policy is best-effort: Runpod does not expose per-GPU
            // region in `gpuTypes`. We advertise a generic region and let the
            // scheduler apply region bonuses/penalties later.
            let region = "any".to_string();
            if let RegionPolicy::Require(regions) = &req.region_policy {
                if !regions.contains(&region) {
                    continue;
                }
            }
            if let RegionPolicy::Exclude(regions) = &req.region_policy {
                if regions.contains(&region) {
                    continue;
                }
            }

            if let Some(max) = req.constraints.max_price_per_hour_cents {
                if price_per_hour_cents > max {
                    continue;
                }
            }

            let reliability_score = if gpu.secure_cloud { 0.95 } else { 0.85 };

            offers.push(Offer {
                id: format!("off_runpod_{}", gpu.id),
                provider_kind: KIND.to_string(),
                region: region.clone(),
                instance_type: gpu.id.clone(),
                // Runpod does not expose vCPU/RAM per GPU type in this query.
                // We estimate based on the GPU class so the offer can be scored.
                vcpu: match class_suffix {
                    "s" => 4,
                    "m" => 8,
                    _ => 16,
                },
                memory_mib,
                gpu_vram_mib: memory_mib,
                gpu_model: Some(gpu.display_name.clone()),
                price_per_hour_cents,
                currency: "USD".to_string(),
                reliability_score,
                interruptible,
                estimated_ready_secs: 120,
                raw_metadata: Some(json!({
                    "runpod_gpu_type_id": gpu.id,
                    "runpod_gpu_display_name": gpu.display_name,
                    "runpod_secure_cloud": gpu.secure_cloud,
                    "runpod_community_cloud": gpu.community_cloud,
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
        let image = req
            .image
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| self.default_image.clone());

        let query = format!(
            r#"
            mutation {{
                podFindAndDeployOnDemand(input: {{
                    cloudType: COMMUNITY,
                    gpuCount: 1,
                    volumeInGb: 20,
                    containerDiskInGb: 20,
                    minVcpuCount: {},
                    minMemoryInGb: {},
                    gpuTypeId: "{}",
                    imageName: "{}",
                    name: "{}"
                }}) {{
                    id
                    imageName
                    machineId
                    machine {{
                        podHostId
                    }}
                }}
            }}
            "#,
            offer.vcpu,
            (offer.memory_mib / 1024).max(1),
            offer.instance_type,
            image,
            req.display_name.as_deref().unwrap_or("allternit-pod")
        );

        let resp: PodDeployResponse = self.graphql_request(&query, None).await?;
        let pod = resp
            .pod_find_and_deploy_on_demand
            .ok_or_else(|| ProviderError::Api {
                status: 500,
                message: "Runpod did not return a deployed pod".to_string(),
            })?;

        let mut metadata = HashMap::new();
        if let Some(machine_id) = pod.machine_id {
            metadata.insert("runpod_machine_id".to_string(), machine_id);
        }
        if let Some(host_id) = pod.machine.and_then(|m| m.pod_host_id) {
            metadata.insert("runpod_pod_host_id".to_string(), host_id);
        }
        if let Some(image_name) = pod.image_name {
            metadata.insert("runpod_image_name".to_string(), image_name);
        }

        Ok(ProvisionedResource {
            provider_resource_id: pod.id,
            region: offer.region.clone(),
            instance_type: offer.instance_type.clone(),
            ipv4: None,
            endpoint: None,
            metadata,
        })
    }

    async fn inspect(&self, provider_resource_id: &str) -> Result<ResourceState, ProviderError> {
        let query = format!(
            r#"
            query {{
                pod(input: {{ podId: "{}" }}) {{
                    id
                    name
                    desiredStatus
                    runtime {{
                        uptimeInSeconds
                        ports {{
                            ip
                            publicPort
                            type
                        }}
                    }}
                }}
            }}
            "#,
            provider_resource_id
        );

        let resp: PodResponse = self.graphql_request(&query, None).await?;
        let pod = resp
            .pod
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;
        Ok(parse_desired_status(pod.desired_status.as_deref()))
    }

    async fn start(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let query = format!(
            r#"
            mutation {{
                podResume(input: {{ podId: "{}" }})
            }}
            "#,
            provider_resource_id
        );
        let _: PodActionResponse = self.graphql_request(&query, None).await?;
        Ok(())
    }

    async fn stop(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let query = format!(
            r#"
            mutation {{
                podStop(input: {{ podId: "{}" }})
            }}
            "#,
            provider_resource_id
        );
        let _: PodActionResponse = self.graphql_request(&query, None).await?;
        Ok(())
    }

    async fn terminate(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let query = format!(
            r#"
            mutation {{
                podTerminate(input: {{ podId: "{}" }})
            }}
            "#,
            provider_resource_id
        );
        let _: PodActionResponse = self.graphql_request(&query, None).await?;
        Ok(())
    }

    async fn collect_usage(
        &self,
        provider_resource_id: &str,
        since: DateTime<Utc>,
    ) -> Result<Vec<UsageEvent>, ProviderError> {
        // Runpod does not expose a fine-grained usage meter in the public
        // GraphQL API. We report compute seconds based on observed uptime.
        // Provider invoices remain the authoritative cost input; this event
        // is used for customer-visible metering and alerting.
        let query = format!(
            r#"
            query {{
                pod(input: {{ podId: "{}" }}) {{
                    id
                    desiredStatus
                    runtime {{
                        uptimeInSeconds
                    }}
                }}
            }}
            "#,
            provider_resource_id
        );

        let resp: PodResponse = self.graphql_request(&query, None).await?;
        let pod = resp
            .pod
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;
        let uptime = pod
            .runtime
            .and_then(|r| r.uptime_in_seconds)
            .unwrap_or(0);

        let running = matches!(
            parse_desired_status(pod.desired_status.as_deref()),
            ResourceState::Running
        );

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), KIND.to_string());
        metadata.insert("running".to_string(), running.to_string());

        Ok(vec![UsageEvent {
            event_type: "compute_seconds".to_string(),
            quantity: uptime as f64,
            unit: "seconds".to_string(),
            measured_at: since,
            metadata,
        }])
    }

    async fn health(&self) -> Result<HealthSnapshot, ProviderError> {
        // A lightweight probe: list GPU types and treat any parsable response
        // as healthy.
        let query = "query { gpuTypes { id } }";
        match self.graphql_request::<GpuTypesResponse>(query, None).await {
            Ok(_) => Ok(HealthSnapshot {
                healthy: true,
                message: Some("Runpod GraphQL reachable".to_string()),
                last_checked: Utc::now(),
            }),
            Err(e) => Ok(HealthSnapshot {
                healthy: false,
                message: Some(format!("Runpod health check failed: {e}")),
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
    async fn runpod_discovers_offers_for_gpu_request() {
        let mut server = mockito::Server::new_async().await;
        let client = RunpodClient::new(server.url(), "test-token");

        let body = json!({
            "data": {
                "gpuTypes": [
                    {
                        "id": "NVIDIA RTX A5000",
                        "displayName": "RTX A5000",
                        "memoryInGb": 24.0,
                        "secureCloud": true,
                        "communityCloud": true,
                        "lowestPrice": {
                            "uninterruptablePrice": 0.27,
                            "interruptablePrice": 0.18,
                            "stockStatus": "Available"
                        }
                    },
                    {
                        "id": "NVIDIA RTX A40",
                        "displayName": "RTX A40",
                        "memoryInGb": 48.0,
                        "secureCloud": true,
                        "communityCloud": true,
                        "lowestPrice": {
                            "uninterruptablePrice": 0.44,
                            "interruptablePrice": 0.30,
                            "stockStatus": "Available"
                        }
                    }
                ]
            }
        });

        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body.to_string())
            .create_async()
            .await;

        let req = gpu_request("s", 20 * 1024);
        let offers = client.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 2);
        assert!(offers.iter().any(|o| o.instance_type == "NVIDIA RTX A5000"));
        assert!(offers.iter().any(|o| o.instance_type == "NVIDIA RTX A40"));
    }

    #[tokio::test]
    async fn runpod_filters_out_of_stock_gpus() {
        let mut server = mockito::Server::new_async().await;
        let client = RunpodClient::new(server.url(), "test-token");

        let body = json!({
            "data": {
                "gpuTypes": [
                    {
                        "id": "NVIDIA RTX A5000",
                        "displayName": "RTX A5000",
                        "memoryInGb": 24.0,
                        "secureCloud": true,
                        "communityCloud": true,
                        "lowestPrice": {
                            "uninterruptablePrice": 0.27,
                            "stockStatus": "Available"
                        }
                    },
                    {
                        "id": "NVIDIA A100 80GB PCIe",
                        "displayName": "A100 80GB",
                        "memoryInGb": 80.0,
                        "secureCloud": true,
                        "communityCloud": false,
                        "lowestPrice": {
                            "uninterruptablePrice": 1.39,
                            "stockStatus": "Out Of Stock"
                        }
                    }
                ]
            }
        });

        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body.to_string())
            .create_async()
            .await;

        let req = gpu_request("s", 20 * 1024);
        let offers = client.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 1);
        assert_eq!(offers[0].instance_type, "NVIDIA RTX A5000");
    }

    #[tokio::test]
    async fn runpod_returns_no_offers_for_compute_request() {
        let mut server = mockito::Server::new_async().await;
        let client = RunpodClient::new(server.url(), "test-token");

        let body = json!({
            "data": {
                "gpuTypes": [
                    {
                        "id": "NVIDIA RTX A5000",
                        "displayName": "RTX A5000",
                        "memoryInGb": 24.0,
                        "secureCloud": true,
                        "communityCloud": true,
                        "lowestPrice": {
                            "uninterruptablePrice": 0.27,
                            "stockStatus": "Available"
                        }
                    }
                ]
            }
        });

        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body.to_string())
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
    async fn runpod_provisions_pod() {
        let mut server = mockito::Server::new_async().await;
        let client = RunpodClient::new(server.url(), "test-token");

        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                json!({
                    "data": {
                        "podFindAndDeployOnDemand": {
                            "id": "pod-123",
                            "imageName": "runpod/pytorch",
                            "machineId": "machine-abc",
                            "machine": {
                                "podHostId": "host-xyz"
                            }
                        }
                    }
                })
                .to_string(),
            )
            .create_async()
            .await;

        let req = gpu_request("s", 20 * 1024);
        let offer = Offer {
            id: "off_runpod_rtx_a5000".to_string(),
            provider_kind: KIND.to_string(),
            region: "any".to_string(),
            instance_type: "NVIDIA RTX A5000".to_string(),
            vcpu: 4,
            memory_mib: 24 * 1024,
            gpu_vram_mib: 24 * 1024,
            gpu_model: Some("RTX A5000".to_string()),
            price_per_hour_cents: 27,
            currency: "USD".to_string(),
            reliability_score: 0.95,
            interruptible: false,
            estimated_ready_secs: 120,
            raw_metadata: None,
        };

        let resource = client.provision(&req, &offer).await.unwrap();
        assert_eq!(resource.provider_resource_id, "pod-123");
        assert_eq!(resource.metadata.get("runpod_machine_id"), Some(&"machine-abc".to_string()));
    }

    #[tokio::test]
    async fn runpod_inspect_maps_status() {
        let mut server = mockito::Server::new_async().await;
        let client = RunpodClient::new(server.url(), "test-token");

        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                json!({
                    "data": {
                        "pod": {
                            "id": "pod-123",
                            "name": "test-pod",
                            "desiredStatus": "RUNNING",
                            "runtime": {
                                "uptimeInSeconds": 300,
                                "ports": []
                            }
                        }
                    }
                })
                .to_string(),
            )
            .create_async()
            .await;

        let state = client.inspect("pod-123").await.unwrap();
        assert_eq!(state, ResourceState::Running);
    }

    #[tokio::test]
    async fn runpod_stop_and_terminate() {
        let mut server = mockito::Server::new_async().await;
        let client = RunpodClient::new(server.url(), "test-token");

        server
            .mock("POST", "/")
            .match_body(mockito::Matcher::Regex("podStop".to_string()))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(json!({ "data": { "podStop": "pod-123" } }).to_string())
            .create_async()
            .await;

        server
            .mock("POST", "/")
            .match_body(mockito::Matcher::Regex("podTerminate".to_string()))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(json!({ "data": { "podTerminate": "pod-123" } }).to_string())
            .create_async()
            .await;

        client.stop("pod-123").await.unwrap();
        client.terminate("pod-123").await.unwrap();
    }

    #[tokio::test]
    async fn runpod_from_env_requires_token() {
        // Ensure no token leaks from the outer environment.
        let mut env = std::env::vars().collect::<HashMap<_, _>>();
        env.remove("RUNPOD_API_TOKEN");
        for (k, _) in std::env::vars() {
            if k == "RUNPOD_API_TOKEN" {
                std::env::remove_var(&k);
            }
        }
        let result = RunpodClient::from_env();
        assert!(matches!(result, Err(ProviderError::MissingCredentials(_))));
    }
}
