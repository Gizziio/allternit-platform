//! Incus / Desktop Cloud provider adapter for the Fabric control plane.
//!
//! Wraps the existing `IncusHostPool` and `Substrate` so that local Incus
//! hosts appear as a Fabric provider for CPU-first workloads: Compute,
//! Sandbox, Agent, and Batch. GPU requests are not satisfied by this adapter;
//! use Runpod or Vast for those.
//!
//! Environment variables:
//! - `INCUS_PROVIDER_IMAGE` (optional) — default image for Incus instances.
//!   Defaults to `local:allternit-desktop`.
//!
//! The adapter is constructed directly from an `IncusHostPool`; wiring it into
//! a running service is done at the call site (see `routes` / `lib.rs`).

use crate::fabric::{
    FabricProvider, HealthSnapshot, Offer, ProviderCapabilities, ProviderError, ProvisionedResource,
    RegionPolicy, ResourceKind, ResourceRequest, ResourceState, UsageEvent,
};
use crate::incus_pool::IncusHostPool;
use crate::substrate::{ComputerSpec, Substrate};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const KIND: &str = "incus";
const DEFAULT_IMAGE: &str = "local:allternit-desktop";

/// Marginal cost in USD cents per MiB-hour. This is a placeholder that
/// represents power, bandwidth, and depreciation for owned/self-hosted Incus
/// capacity. Real cost should be fed from host telemetry and power/colo bills.
const COST_CENTS_PER_MIB_HOUR: f64 = 0.0005;

/// Incus-backed Fabric provider.
#[derive(Debug)]
pub struct IncusProvider {
    pool: Arc<IncusHostPool>,
    default_image: String,
    state: Mutex<HashMap<String, InstanceRecord>>,
}

#[derive(Debug, Clone)]
struct InstanceRecord {
    host_url: String,
    native_id: String,
    created_at: DateTime<Utc>,
    state: ResourceState,
}

impl IncusProvider {
    /// Build a provider from an existing host pool.
    pub fn new(pool: Arc<IncusHostPool>) -> Self {
        Self {
            pool,
            default_image: std::env::var("INCUS_PROVIDER_IMAGE")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_IMAGE.to_string()),
            state: Mutex::new(HashMap::new()),
        }
    }

    /// Override the default image. Useful in tests.
    pub fn with_default_image(mut self, image: impl Into<String>) -> Self {
        self.default_image = image.into();
        self
    }

    fn kind_matches(req: &ResourceRequest) -> bool {
        matches!(
            req.kind,
            ResourceKind::Compute | ResourceKind::Sandbox | ResourceKind::Agent | ResourceKind::Batch | ResourceKind::Harness
        ) && req.gpu_vram_mib_min == 0
    }

    fn region_from_url(url: &str) -> String {
        let lower = url.to_lowercase();
        if lower.contains("us-") || lower.contains(".us") || lower.contains("america") {
            "us-east".to_string()
        } else if lower.contains("eu-") || lower.contains(".eu") || lower.contains("europe") {
            "eu-west".to_string()
        } else {
            "any".to_string()
        }
    }
}

#[async_trait]
impl FabricProvider for IncusProvider {
    fn kind(&self) -> String {
        KIND.to_string()
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            kinds: vec![
                ResourceKind::Compute,
                ResourceKind::Sandbox,
                ResourceKind::Agent,
                ResourceKind::Batch,
                ResourceKind::Harness,
            ],
            regions: vec!["us-east".to_string(), "eu-west".to_string(), "any".to_string()],
            supports_gpu: false,
            supports_interruptible: false,
            supports_spot: false,
            supports_persistence: true,
        }
    }

    async fn discover_offers(&self, req: &ResourceRequest) -> Result<Vec<Offer>, ProviderError> {
        if !Self::kind_matches(req) {
            return Ok(Vec::new());
        }

        let mut offers = Vec::new();
        for host in self.pool.hosts() {
            let free_mb = host.free_memory_mb();
            if free_mb < req.memory_mib_min {
                continue;
            }

            let region = Self::region_from_url(&host.url);
            match &req.region_policy {
                RegionPolicy::Require(regions) if !regions.contains(&region) => continue,
                RegionPolicy::Exclude(regions) if regions.contains(&region) => continue,
                _ => {}
            }

            let vcpu = req.vcpu_min.max(1);
            let memory_mib = req.memory_mib_min.max(512);
            let price_per_hour_cents =
                (memory_mib as f64 * COST_CENTS_PER_MIB_HOUR).max(1.0).round() as i64;

            if let Some(max) = req.constraints.max_price_per_hour_cents {
                if price_per_hour_cents > max {
                    continue;
                }
            }

            let instance_type = format!("incus-cpu-{}c-{}m", vcpu, memory_mib);
            offers.push(Offer {
                id: format!("off_incus_{}", instance_type),
                provider_kind: KIND.to_string(),
                region,
                instance_type,
                vcpu,
                memory_mib,
                gpu_vram_mib: 0,
                gpu_model: None,
                price_per_hour_cents,
                currency: "USD".to_string(),
                reliability_score: 0.98,
                interruptible: false,
                estimated_ready_secs: 30,
                raw_metadata: Some(json!({
                    "incus_host_url": host.url,
                    "incus_free_memory_mb": free_mb,
                    "incus_image": normalize_image_alias(&self.default_image),
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
        let image_alias = offer
            .raw_metadata
            .as_ref()
            .and_then(|m| m.get("incus_image"))
            .and_then(|v| v.as_str())
            .unwrap_or("allternit-desktop");

        let host = self
            .pool
            .select_for_spawn(req.memory_mib_min as u32, Some(image_alias))
            .map_err(|e| ProviderError::CapacityUnavailable(e.to_string()))?;

        let image = req
            .image
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| self.default_image.clone());

        let name = format!(
            "allternit-{}-{}",
            req.kind,
            uuid::Uuid::new_v4().simple()
        );

        let spec = ComputerSpec {
            name: name.clone(),
            os: "linux".to_string(),
            image,
            cpu_cores: req.vcpu_min.max(1),
            memory_mb: req.memory_mib_min.max(512) as u32,
            disk_mb: (req.storage_mib / 1024).max(20_480) as u32,
            env: {
                let mut m = HashMap::new();
                m.insert("ALLTERNIT_RESOURCE_ID".to_string(), req.id.clone());
                m.insert("ALLTERNIT_RESOURCE_KIND".to_string(), req.kind.to_string());
                m
            },
            profiles: std::env::var("INCUS_DESKTOP_PROFILES")
                .unwrap_or_else(|_| "default".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
        };

        let handle = host
            .substrate
            .create(spec)
            .await
            .map_err(|e| ProviderError::Request(format!("Incus create failed: {e}")))?;

        // Start immediately so the instance reaches a usable state.
        let _ = host
            .substrate
            .start(&handle.native_id)
            .await
            .map_err(|e| ProviderError::Request(format!("Incus start failed: {e}")))?;

        let resource_id = uuid::Uuid::new_v4().to_string();
        self.state.lock().unwrap().insert(
            resource_id.clone(),
            InstanceRecord {
                host_url: host.url.clone(),
                native_id: handle.native_id.clone(),
                created_at: Utc::now(),
                state: ResourceState::Running,
            },
        );

        let mut metadata = HashMap::new();
        metadata.insert("incus_host_url".to_string(), host.url.clone());
        metadata.insert("incus_native_id".to_string(), handle.native_id);

        Ok(ProvisionedResource {
            provider_resource_id: resource_id,
            region: offer.region.clone(),
            instance_type: offer.instance_type.clone(),
            ipv4: None,
            endpoint: None,
            metadata,
        })
    }

    async fn inspect(&self, provider_resource_id: &str) -> Result<ResourceState, ProviderError> {
        let record = self
            .state
            .lock()
            .unwrap()
            .get(provider_resource_id)
            .cloned()
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;

        let host = self
            .pool
            .hosts()
            .into_iter()
            .find(|h| h.url == record.host_url)
            .ok_or_else(|| ProviderError::Request(format!("Incus host {} disappeared", record.host_url)))?;

        let handle = host
            .substrate
            .get(&record.native_id)
            .await
            .map_err(|e| ProviderError::Request(format!("Incus get failed: {e}")))?;

        let state = match handle.state {
            crate::substrate::ComputerState::Running => ResourceState::Running,
            crate::substrate::ComputerState::Stopped => ResourceState::Stopped,
            crate::substrate::ComputerState::Error => ResourceState::Error,
            crate::substrate::ComputerState::Creating => ResourceState::Provisioning,
        };

        self.state
            .lock()
            .unwrap()
            .get_mut(provider_resource_id)
            .map(|r| r.state = state);

        Ok(state)
    }

    async fn start(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let record = self
            .state
            .lock()
            .unwrap()
            .get(provider_resource_id)
            .cloned()
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;

        let host = self
            .pool
            .hosts()
            .into_iter()
            .find(|h| h.url == record.host_url)
            .ok_or_else(|| ProviderError::Request(format!("Incus host {} disappeared", record.host_url)))?;

        host.substrate
            .start(&record.native_id)
            .await
            .map_err(|e| ProviderError::Request(format!("Incus start failed: {e}")))?;
        Ok(())
    }

    async fn stop(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let record = self
            .state
            .lock()
            .unwrap()
            .get(provider_resource_id)
            .cloned()
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;

        let host = self
            .pool
            .hosts()
            .into_iter()
            .find(|h| h.url == record.host_url)
            .ok_or_else(|| ProviderError::Request(format!("Incus host {} disappeared", record.host_url)))?;

        host.substrate
            .stop(&record.native_id)
            .await
            .map_err(|e| ProviderError::Request(format!("Incus stop failed: {e}")))?;
        Ok(())
    }

    async fn terminate(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let record = self
            .state
            .lock()
            .unwrap()
            .get(provider_resource_id)
            .cloned()
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;

        let host = self
            .pool
            .hosts()
            .into_iter()
            .find(|h| h.url == record.host_url)
            .ok_or_else(|| ProviderError::Request(format!("Incus host {} disappeared", record.host_url)))?;

        host.substrate
            .delete(&record.native_id)
            .await
            .map_err(|e| ProviderError::Request(format!("Incus delete failed: {e}")))?;

        self.state
            .lock()
            .unwrap()
            .get_mut(provider_resource_id)
            .map(|r| r.state = ResourceState::Terminated);

        Ok(())
    }

    async fn collect_usage(
        &self,
        provider_resource_id: &str,
        since: DateTime<Utc>,
    ) -> Result<Vec<UsageEvent>, ProviderError> {
        let record = self
            .state
            .lock()
            .unwrap()
            .get(provider_resource_id)
            .cloned()
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;

        let uptime_seconds = if record.state == ResourceState::Running {
            Utc::now()
                .signed_duration_since(record.created_at)
                .num_seconds()
                .max(0) as u64
        } else {
            0
        };

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), KIND.to_string());
        metadata.insert("incus_host_url".to_string(), record.host_url);
        metadata.insert("incus_native_id".to_string(), record.native_id);
        metadata.insert("running".to_string(), (record.state == ResourceState::Running).to_string());

        Ok(vec![UsageEvent {
            event_type: "compute_seconds".to_string(),
            quantity: uptime_seconds as f64,
            unit: "seconds".to_string(),
            measured_at: since,
            metadata,
        }])
    }

    async fn health(&self) -> Result<HealthSnapshot, ProviderError> {
        let hosts = self.pool.hosts();
        if hosts.is_empty() {
            return Ok(HealthSnapshot {
                healthy: false,
                message: Some("no Incus hosts in pool".to_string()),
                last_checked: Utc::now(),
            });
        }

        let reachable = hosts.len();
        Ok(HealthSnapshot {
            healthy: true,
            message: Some(format!("Incus pool has {reachable} host(s)")),
            last_checked: Utc::now(),
        })
    }
}

fn normalize_image_alias(image: &str) -> &str {
    image
        .strip_prefix("local:")
        .or_else(|| image.strip_prefix("images:"))
        .unwrap_or(image)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fabric::{CustomerConstraints, ReliabilityTier, ResourceRequest};
    use crate::incus_pool::IncusHost;
    use crate::substrate::{IncusSubstrate, HttpClient};
    use async_trait::async_trait;
    use std::sync::Mutex;

    fn compute_request(class: &str, memory_mib_min: u64) -> ResourceRequest {
        ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Compute,
            class: class.to_string(),
            display_name: None,
            vcpu_min: 1,
            memory_mib_min,
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
        }
    }

    fn fake_substrate() -> Arc<IncusSubstrate> {
        // Scheduling tests never touch the network; a dummy URL is enough.
        Arc::new(IncusSubstrate::new("http://dummy").unwrap())
    }

    fn host(url: &str, total: u64, used: u64) -> Arc<IncusHost> {
        Arc::new(
            IncusHost::new(url, fake_substrate()).with_memory(total, used),
        )
    }

    #[tokio::test]
    async fn incus_discovers_offers_for_compute_request() {
        let pool = Arc::new(IncusHostPool::new(vec![
            host("https://a.us:8443", 8192, 1000),
            host("https://b.eu:8443", 16384, 4000),
        ]));
        let provider = IncusProvider::new(pool);

        let req = compute_request("s", 2048);
        let offers = provider.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 2);
        assert!(offers.iter().any(|o| o.region == "us-east"));
        assert!(offers.iter().any(|o| o.region == "eu-west"));
    }

    #[tokio::test]
    async fn incus_filters_hosts_by_memory() {
        let pool = Arc::new(IncusHostPool::new(vec![
            host("https://a.us:8443", 4096, 3500),
            host("https://b.us:8443", 16384, 1000),
        ]));
        let provider = IncusProvider::new(pool);

        let req = compute_request("m", 4096);
        let offers = provider.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 1);
        assert_eq!(offers[0].region, "us-east");
    }

    #[tokio::test]
    async fn incus_returns_no_offers_for_gpu_request() {
        let pool = Arc::new(IncusHostPool::new(vec![
            host("https://a.us:8443", 8192, 1000),
        ]));
        let provider = IncusProvider::new(pool);

        let req = ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Gpu,
            class: "s".to_string(),
            display_name: None,
            vcpu_min: 1,
            memory_mib_min: 1024,
            gpu_vram_mib_min: 24 * 1024,
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

        let offers = provider.discover_offers(&req).await.unwrap();
        assert!(offers.is_empty());
    }

    struct MockHttpClient {
        responses: Mutex<Vec<(u16, serde_json::Value)>>,
    }

    #[async_trait]
    impl HttpClient for MockHttpClient {
        async fn request(
            &self,
            _method: reqwest::Method,
            _path: &str,
            _body: Option<serde_json::Value>,
        ) -> Result<(u16, serde_json::Value), crate::substrate::SubstrateError> {
            let mut responses = self.responses.lock().unwrap();
            Ok(responses.remove(0))
        }

        async fn request_bytes(
            &self,
            _method: reqwest::Method,
            _path: &str,
            _body: Option<serde_json::Value>,
        ) -> Result<(u16, Vec<u8>), crate::substrate::SubstrateError> {
            Ok((200, Vec::new()))
        }

        async fn request_bytes_with_body(
            &self,
            _method: reqwest::Method,
            _path: &str,
            _body: Vec<u8>,
        ) -> Result<(u16, Vec<u8>), crate::substrate::SubstrateError> {
            Ok((200, Vec::new()))
        }
    }

    #[tokio::test]
    async fn incus_provisions_and_inspects() {
        let substrate = Arc::new(IncusSubstrate::with_client(Box::new(MockHttpClient {
            responses: Mutex::new(vec![
                // create
                (
                    200,
                    json!({
                        "operation": "/1.0/operations/op-1",
                        "status": "Operation created",
                    }),
                ),
                // wait create
                (
                    200,
                    json!({
                        "data": {
                            "status": "Success",
                            "metadata": {
                                "resources": {
                                    "instances": ["/1.0/instances/allternit-compute-abc123"]
                                }
                            }
                        }
                    }),
                ),
                // start
                (
                    200,
                    json!({
                        "operation": "/1.0/operations/op-2",
                        "status": "Operation created",
                    }),
                ),
                // wait start
                (
                    200,
                    json!({
                        "data": {
                            "status": "Success",
                        }
                    }),
                ),
                // get after start
                (
                    200,
                    json!({
                        "metadata": {
                            "status": "Running",
                        }
                    }),
                ),
            ]),
        })));

        let pool = Arc::new(IncusHostPool::new(vec![Arc::new(IncusHost::new(
            "https://a.us:8443",
            substrate,
        ))]));
        let provider = IncusProvider::new(pool);

        let req = compute_request("s", 2048);
        let offer = Offer {
            id: "off_incus_incus-cpu-1c-2048m".to_string(),
            provider_kind: KIND.to_string(),
            region: "us-east".to_string(),
            instance_type: "incus-cpu-1c-2048m".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            gpu_model: None,
            price_per_hour_cents: 1,
            currency: "USD".to_string(),
            reliability_score: 0.98,
            interruptible: false,
            estimated_ready_secs: 30,
            raw_metadata: Some(json!({"incus_image": "allternit-desktop"})),
        };

        let resource = provider.provision(&req, &offer).await.unwrap();
        assert!(resource.provider_resource_id.len() > 0);
        assert_eq!(resource.metadata.get("incus_host_url"), Some(&"https://a.us:8443".to_string()));
    }
}
