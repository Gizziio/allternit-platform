//! Hetzner / Contabo bare-VM provider adapter for the Fabric control plane.
//!
//! Wraps the existing `CloudProviderRegistry` so that VPS hosts can be rented
//! as general-purpose CPU Fabric capacity. This adapter is for CPU-first
//! workloads (`Compute`, `Sandbox`, `Agent`, `Batch`); GPU workloads should
//! use Runpod or Vast.
//!
//! The current `CloudProvider` trait supports create/get/delete but not
//! start/stop power actions, so `start` and `stop` are no-ops that succeed
//! immediately. Real power control can be added later by extending the cloud
//! trait and the underlying Hetzner/Contabo clients.
//!
//! Environment variables are inherited from `CloudProviderRegistry::from_env()`:
//! - `HETZNER_API_TOKEN`, `HETZNER_DEFAULT_REGION`, `HETZNER_DEFAULT_TYPE`
//! - `CONTABO_CLIENT_ID`, `CONTABO_CLIENT_SECRET`, `CONTABO_API_USERNAME`,
//!   `CONTABO_API_PASSWORD`, `CONTABO_DEFAULT_REGION`, `CONTABO_DEFAULT_PLAN`

use crate::cloud::{
    CloudProviderError, CloudProviderRegistry, CreateServerRequest, ServerInfo, ServerStatus,
};
use crate::fabric::{
    FabricProvider, HealthSnapshot, Offer, ProviderCapabilities, ProviderError, ProvisionedResource,
    RegionPolicy, ResourceKind, ResourceRequest, ResourceState, UsageEvent,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

const KIND: &str = "bare_vm";

/// A static plan catalog for bare-VM providers. Prices are USD cents per hour
/// and represent supplier cost placeholders. Real pricing should come from
/// provider price sheets or a cached price crawler.
#[derive(Debug, Clone)]
struct VmPlan {
    provider: &'static str,
    region: &'static str,
    instance_type: &'static str,
    vcpu: u32,
    memory_mib: u64,
    price_per_hour_cents: i64,
}

fn vm_plans() -> Vec<VmPlan> {
    vec![
        // Hetzner Cloud (USD cents/hr, approximate supplier cost)
        VmPlan {
            provider: "hetzner",
            region: "ash",
            instance_type: "cpx11",
            vcpu: 2,
            memory_mib: 4096,
            price_per_hour_cents: 1,
        },
        VmPlan {
            provider: "hetzner",
            region: "ash",
            instance_type: "cpx21",
            vcpu: 4,
            memory_mib: 8192,
            price_per_hour_cents: 2,
        },
        VmPlan {
            provider: "hetzner",
            region: "nbg1",
            instance_type: "cpx31",
            vcpu: 8,
            memory_mib: 16384,
            price_per_hour_cents: 4,
        },
        VmPlan {
            provider: "hetzner",
            region: "fsn1",
            instance_type: "cpx41",
            vcpu: 16,
            memory_mib: 32768,
            price_per_hour_cents: 8,
        },
        // Contabo Cloud (USD cents/hr, approximate supplier cost)
        VmPlan {
            provider: "contabo",
            region: "US-central",
            instance_type: "V1",
            vcpu: 4,
            memory_mib: 8192,
            price_per_hour_cents: 1,
        },
        VmPlan {
            provider: "contabo",
            region: "EU",
            instance_type: "V153",
            vcpu: 6,
            memory_mib: 16384,
            price_per_hour_cents: 1,
        },
    ]
}

/// Bare-VM Fabric provider backed by Hetzner/Contabo cloud registries.
#[derive(Debug)]
pub struct BareVmProvider {
    registry: CloudProviderRegistry,
    state: Mutex<HashMap<String, InstanceRecord>>,
}

#[derive(Debug, Clone)]
struct InstanceRecord {
    server_id: String,
    provider: String,
    created_at: DateTime<Utc>,
    state: ResourceState,
}

impl BareVmProvider {
    /// Build a provider from environment variables.
    pub fn from_env() -> Result<Self, ProviderError> {
        let registry = CloudProviderRegistry::from_env()
            .map_err(|e| ProviderError::MissingCredentials(e.to_string()))?;
        Ok(Self::new(registry))
    }

    /// Build a provider from an existing registry.
    pub fn new(registry: CloudProviderRegistry) -> Self {
        Self {
            registry,
            state: Mutex::new(HashMap::new()),
        }
    }

    fn kind_matches(req: &ResourceRequest) -> bool {
        matches!(
            req.kind,
            ResourceKind::Compute | ResourceKind::Sandbox | ResourceKind::Agent | ResourceKind::Batch | ResourceKind::Harness
        ) && req.gpu_vram_mib_min == 0
    }
}

#[async_trait]
impl FabricProvider for BareVmProvider {
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
            regions: vec![
                "ash".to_string(),
                "nbg1".to_string(),
                "fsn1".to_string(),
                "US-central".to_string(),
                "EU".to_string(),
            ],
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
        for plan in vm_plans() {
            if plan.vcpu < req.vcpu_min {
                continue;
            }
            if plan.memory_mib < req.memory_mib_min {
                continue;
            }

            match &req.region_policy {
                RegionPolicy::Require(regions) if !regions.contains(&plan.region.to_string()) => continue,
                RegionPolicy::Exclude(regions) if regions.contains(&plan.region.to_string()) => continue,
                _ => {}
            }

            if let Some(max) = req.constraints.max_price_per_hour_cents {
                if plan.price_per_hour_cents > max {
                    continue;
                }
            }

            offers.push(Offer {
                id: format!("off_bare_vm_{}_{}", plan.provider, plan.instance_type),
                provider_kind: KIND.to_string(),
                region: plan.region.to_string(),
                instance_type: plan.instance_type.to_string(),
                vcpu: plan.vcpu,
                memory_mib: plan.memory_mib,
                gpu_vram_mib: 0,
                gpu_model: None,
                price_per_hour_cents: plan.price_per_hour_cents,
                currency: "USD".to_string(),
                reliability_score: 0.96,
                interruptible: false,
                estimated_ready_secs: 120,
                raw_metadata: Some(json!({
                    "bare_vm_provider": plan.provider,
                    "bare_vm_region": plan.region,
                    "bare_vm_plan": plan.instance_type,
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
        let plan = offer.instance_type.clone();
        let region = offer.region.clone();
        let name = format!(
            "allternit-{}-{}",
            req.kind,
            uuid::Uuid::new_v4().simple()
        );

        let create_req = CreateServerRequest {
            name,
            region: Some(region.clone()),
            plan: Some(plan.clone()),
            ssh_key_id: None,
            user_data: None,
        };

        let info = self
            .registry
            .create_server(create_req)
            .await
            .map_err(map_cloud_error)?;

        let resource_id = uuid::Uuid::new_v4().to_string();
        self.state.lock().unwrap().insert(
            resource_id.clone(),
            InstanceRecord {
                server_id: info.id.clone(),
                provider: provider_from_offer(offer),
                created_at: Utc::now(),
                state: ResourceState::Running,
            },
        );

        let mut metadata = HashMap::new();
        metadata.insert("bare_vm_server_id".to_string(), info.id.clone());
        metadata.insert("bare_vm_plan".to_string(), plan);
        metadata.insert("bare_vm_provider".to_string(), provider_from_offer(offer));

        Ok(ProvisionedResource {
            provider_resource_id: resource_id,
            region: info.region,
            instance_type: info.plan,
            ipv4: info.ipv4,
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

        let info = self
            .registry
            .get_server(&record.server_id)
            .await
            .map_err(map_cloud_error)?
            .ok_or_else(|| ProviderError::NotFound(record.server_id.clone()))?;

        let state = map_server_status(info.status);
        self.state
            .lock()
            .unwrap()
            .get_mut(provider_resource_id)
            .map(|r| r.state = state);

        Ok(state)
    }

    async fn start(&self, _provider_resource_id: &str) -> Result<(), ProviderError> {
        // The CloudProvider trait does not expose a start/power-on action yet.
        Ok(())
    }

    async fn stop(&self, _provider_resource_id: &str) -> Result<(), ProviderError> {
        // The CloudProvider trait does not expose a stop/power-off action yet.
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

        self.registry
            .delete_server(&record.server_id)
            .await
            .map_err(map_cloud_error)?;

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
        metadata.insert("bare_vm_server_id".to_string(), record.server_id);
        metadata.insert("bare_vm_provider".to_string(), record.provider);
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
        let providers: Vec<String> = self
            .registry
            .providers()
            .iter()
            .map(|p| p.kind().to_string())
            .collect();

        if providers.is_empty() {
            return Ok(HealthSnapshot {
                healthy: false,
                message: Some("no bare-VM providers configured".to_string()),
                last_checked: Utc::now(),
            });
        }

        Ok(HealthSnapshot {
            healthy: true,
            message: Some(format!("bare-VM providers: {}", providers.join(", "))),
            last_checked: Utc::now(),
        })
    }
}

fn provider_from_offer(offer: &Offer) -> String {
    offer
        .raw_metadata
        .as_ref()
        .and_then(|m| m.get("bare_vm_provider"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string()
}

fn map_server_status(status: ServerStatus) -> ResourceState {
    match status {
        ServerStatus::Running => ResourceState::Running,
        ServerStatus::Stopped => ResourceState::Stopped,
        ServerStatus::Terminated => ResourceState::Terminated,
        ServerStatus::Error => ResourceState::Error,
        ServerStatus::Provisioning => ResourceState::Provisioning,
        ServerStatus::Unknown => ResourceState::Unknown,
    }
}

fn map_cloud_error(e: CloudProviderError) -> ProviderError {
    match e {
        CloudProviderError::NotFound(id) => ProviderError::NotFound(id),
        CloudProviderError::MissingCredentials(msg) => ProviderError::MissingCredentials(msg),
        other => ProviderError::Request(other.to_string()),
    }
}

// Add a get_server helper to the registry that tries each provider.
impl CloudProviderRegistry {
    /// Look up a server by id across all registered providers.
    pub async fn get_server(&self, id: &str) -> Result<Option<ServerInfo>, CloudProviderError> {
        for provider in self.providers() {
            match provider.get_server(id).await {
                Ok(Some(info)) => return Ok(Some(info)),
                Ok(None) => continue,
                Err(e) => {
                    tracing::warn!(provider = ?provider.kind(), error = %e, "get_server failed");
                    continue;
                }
            }
        }
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloud::{CloudProvider, ProviderKind};
    use crate::fabric::{CustomerConstraints, ReliabilityTier, ResourceRequest};
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    #[derive(Debug)]
    struct MockCloudProvider {
        kind: ProviderKind,
        deleted: Mutex<bool>,
    }

    impl MockCloudProvider {
        fn new(kind: ProviderKind) -> Self {
            Self {
                kind,
                deleted: Mutex::new(false),
            }
        }
    }

    #[async_trait]
    impl CloudProvider for MockCloudProvider {
        fn kind(&self) -> ProviderKind {
            self.kind
        }

        async fn create_server(
            &self,
            _req: CreateServerRequest,
        ) -> Result<ServerInfo, CloudProviderError> {
            Ok(ServerInfo {
                id: "srv-123".to_string(),
                name: "allternit-compute-abc".to_string(),
                status: ServerStatus::Running,
                ipv4: Some("10.0.0.1".to_string()),
                region: "ash".to_string(),
                plan: "cpx21".to_string(),
            })
        }

        async fn delete_server(&self, id: &str) -> Result<(), CloudProviderError> {
            if id == "srv-123" {
                *self.deleted.lock().unwrap() = true;
            }
            Ok(())
        }

        async fn get_server(&self, id: &str) -> Result<Option<ServerInfo>, CloudProviderError> {
            if id != "srv-123" {
                return Ok(None);
            }
            let status = if *self.deleted.lock().unwrap() {
                ServerStatus::Terminated
            } else {
                ServerStatus::Running
            };
            Ok(Some(ServerInfo {
                id: "srv-123".to_string(),
                name: "allternit-compute-abc".to_string(),
                status,
                ipv4: Some("10.0.0.1".to_string()),
                region: "ash".to_string(),
                plan: "cpx21".to_string(),
            }))
        }

        async fn list_servers(&self) -> Result<Vec<ServerInfo>, CloudProviderError> {
            Ok(Vec::new())
        }
    }

    fn compute_request(class: &str, vcpu_min: u32, memory_mib_min: u64) -> ResourceRequest {
        ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Compute,
            class: class.to_string(),
            display_name: None,
            vcpu_min,
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

    #[tokio::test]
    async fn bare_vm_discovers_offers_for_compute_request() {
        let registry = CloudProviderRegistry::empty();
        let provider = BareVmProvider::new(registry);

        let req = compute_request("s", 1, 2048);
        let offers = provider.discover_offers(&req).await.unwrap();
        assert!(offers.len() >= 4);
        assert!(offers.iter().any(|o| o.instance_type == "cpx21"));
        assert!(offers.iter().any(|o| o.instance_type == "V153"));
    }

    #[tokio::test]
    async fn bare_vm_filters_offers_by_region_requirement() {
        let registry = CloudProviderRegistry::empty();
        let provider = BareVmProvider::new(registry);

        let mut req = compute_request("s", 1, 2048);
        req.region_policy = RegionPolicy::Require(vec!["EU".to_string()]);
        let offers = provider.discover_offers(&req).await.unwrap();
        assert!(offers.iter().all(|o| o.region == "EU"));
    }

    #[tokio::test]
    async fn bare_vm_returns_no_offers_for_gpu_request() {
        let registry = CloudProviderRegistry::empty();
        let provider = BareVmProvider::new(registry);

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

    #[tokio::test]
    async fn bare_vm_provisions_and_inspects() {
        let mut registry = CloudProviderRegistry::empty();
        registry.register(Arc::new(MockCloudProvider::new(ProviderKind::Hetzner)));

        let provider = BareVmProvider::new(registry);
        let req = compute_request("s", 1, 2048);
        let offer = Offer {
            id: "off_bare_vm_hetzner_cpx21".to_string(),
            provider_kind: KIND.to_string(),
            region: "ash".to_string(),
            instance_type: "cpx21".to_string(),
            vcpu: 4,
            memory_mib: 8192,
            gpu_vram_mib: 0,
            gpu_model: None,
            price_per_hour_cents: 2,
            currency: "USD".to_string(),
            reliability_score: 0.96,
            interruptible: false,
            estimated_ready_secs: 120,
            raw_metadata: Some(json!({"bare_vm_provider": "hetzner"})),
        };

        let resource = provider.provision(&req, &offer).await.unwrap();
        assert_eq!(resource.metadata.get("bare_vm_server_id"), Some(&"srv-123".to_string()));
        assert_eq!(resource.ipv4, Some("10.0.0.1".to_string()));

        let state = provider.inspect(&resource.provider_resource_id).await.unwrap();
        assert_eq!(state, ResourceState::Running);
    }

    #[tokio::test]
    async fn bare_vm_terminates_server() {
        let mut registry = CloudProviderRegistry::empty();
        registry.register(Arc::new(MockCloudProvider::new(ProviderKind::Hetzner)));

        let provider = BareVmProvider::new(registry);
        let req = compute_request("s", 1, 2048);
        let offer = Offer {
            id: "off_bare_vm_hetzner_cpx21".to_string(),
            provider_kind: KIND.to_string(),
            region: "ash".to_string(),
            instance_type: "cpx21".to_string(),
            vcpu: 4,
            memory_mib: 8192,
            gpu_vram_mib: 0,
            gpu_model: None,
            price_per_hour_cents: 2,
            currency: "USD".to_string(),
            reliability_score: 0.96,
            interruptible: false,
            estimated_ready_secs: 120,
            raw_metadata: Some(json!({"bare_vm_provider": "hetzner"})),
        };

        let resource = provider.provision(&req, &offer).await.unwrap();
        provider.terminate(&resource.provider_resource_id).await.unwrap();
        let state = provider.inspect(&resource.provider_resource_id).await.unwrap();
        assert_eq!(state, ResourceState::Terminated);
    }
}
