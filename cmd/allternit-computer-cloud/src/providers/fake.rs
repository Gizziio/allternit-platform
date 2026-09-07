//! Deterministic fake provider for Fabric testing.
//!
//! This simulator is intentionally simple: it returns predictable offers,
//! provisions instantly, and charges a fixed cost. It lets the scheduler
//! and billing layers be exercised before any live supplier integration is
//! written.

use crate::fabric::{
    FabricProvider, HealthSnapshot, Offer, ProviderCapabilities, ProviderError, ProvisionedResource,
    RegionPolicy, ResourceKind, ResourceRequest, ResourceState, UsageEvent,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

const KIND: &str = "fake";

/// In-memory fake provider.
#[derive(Debug)]
pub struct FakeProvider {
    region: String,
    instance_type: String,
    price_per_hour_cents: i64,
    cost_per_hour_cents: i64,
    vcpu: u32,
    memory_mib: u64,
    gpu_vram_mib: u64,
    reliability_score: f64,
    provision_should_fail: bool,
    state: Mutex<HashMap<String, FakeResourceState>>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct FakeResourceState {
    created_at: DateTime<Utc>,
    status: ResourceState,
    kind: ResourceKind,
    class: String,
}

impl FakeProvider {
    pub fn new(region: impl Into<String>, instance_type: impl Into<String>) -> Self {
        Self {
            region: region.into(),
            instance_type: instance_type.into(),
            price_per_hour_cents: 50,
            cost_per_hour_cents: 30,
            vcpu: 2,
            memory_mib: 4096,
            gpu_vram_mib: 0,
            reliability_score: 0.95,
            provision_should_fail: false,
            state: Mutex::new(HashMap::new()),
        }
    }

    pub fn with_pricing(mut self, retail: i64, cost: i64) -> Self {
        self.price_per_hour_cents = retail;
        self.cost_per_hour_cents = cost;
        self
    }

    pub fn with_capacity(mut self, vcpu: u32, memory_mib: u64, gpu_vram_mib: u64) -> Self {
        self.vcpu = vcpu;
        self.memory_mib = memory_mib;
        self.gpu_vram_mib = gpu_vram_mib;
        self
    }

    pub fn with_reliability(mut self, score: f64) -> Self {
        self.reliability_score = score.clamp(0.0, 1.0);
        self
    }

    pub fn with_provision_failure(mut self) -> Self {
        self.provision_should_fail = true;
        self
    }

    fn can_satisfy(&self, req: &ResourceRequest) -> bool {
        if self.vcpu < req.vcpu_min {
            return false;
        }
        if self.memory_mib < req.memory_mib_min {
            return false;
        }
        if self.gpu_vram_mib < req.gpu_vram_mib_min {
            return false;
        }
        if let Some(max) = req.constraints.max_price_per_hour_cents {
            if self.price_per_hour_cents > max {
                return false;
            }
        }
        match &req.region_policy {
            RegionPolicy::Any => true,
            RegionPolicy::Prefer(regions) => regions.contains(&self.region),
            RegionPolicy::Require(regions) => regions.contains(&self.region),
            RegionPolicy::Exclude(regions) => !regions.contains(&self.region),
        }
    }

    fn matches_kind(&self, req: &ResourceRequest) -> bool {
        match req.kind {
            ResourceKind::Compute
            | ResourceKind::Sandbox
            | ResourceKind::Agent
            | ResourceKind::Batch
            | ResourceKind::Harness => self.gpu_vram_mib == 0,
            ResourceKind::Gpu | ResourceKind::Inference | ResourceKind::Cluster => {
                self.gpu_vram_mib > 0
            }
            ResourceKind::Storage => false,
        }
    }
}

#[async_trait]
impl FabricProvider for FakeProvider {
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
            regions: vec![self.region.clone()],
            supports_gpu: self.gpu_vram_mib > 0,
            supports_interruptible: true,
            supports_spot: false,
            supports_persistence: true,
        }
    }

    async fn discover_offers(&self, req: &ResourceRequest) -> Result<Vec<Offer>, ProviderError> {
        if !self.matches_kind(req) || !self.can_satisfy(req) {
            return Ok(Vec::new());
        }
        Ok(vec![Offer {
            id: format!("off_fake_{}", self.instance_type),
            provider_kind: KIND.to_string(),
            region: self.region.clone(),
            instance_type: self.instance_type.clone(),
            vcpu: self.vcpu,
            memory_mib: self.memory_mib,
            gpu_vram_mib: self.gpu_vram_mib,
            gpu_model: if self.gpu_vram_mib > 0 {
                Some("fake-gpu".to_string())
            } else {
                None
            },
            price_per_hour_cents: self.price_per_hour_cents,
            currency: "USD".to_string(),
            reliability_score: self.reliability_score,
            interruptible: req.reliability_tier == crate::fabric::ReliabilityTier::Interruptible,
            estimated_ready_secs: 1,
            raw_metadata: None,
        }])
    }

    async fn quote(&self, _offer: &Offer, duration: Duration) -> Result<i64, ProviderError> {
        let hours = duration.as_secs_f64() / 3600.0;
        Ok((self.price_per_hour_cents as f64 * hours) as i64)
    }

    async fn provision(
        &self,
        req: &ResourceRequest,
        offer: &Offer,
    ) -> Result<ProvisionedResource, ProviderError> {
        if self.provision_should_fail {
            return Err(ProviderError::CapacityUnavailable(
                "injected provision failure".to_string(),
            ));
        }
        let id = format!("fake-{}", uuid::Uuid::new_v4().simple());
        self.state.lock().unwrap().insert(
            id.clone(),
            FakeResourceState {
                created_at: Utc::now(),
                status: ResourceState::Running,
                kind: req.kind,
                class: req.class.clone(),
            },
        );
        Ok(ProvisionedResource {
            provider_resource_id: id,
            region: offer.region.clone(),
            instance_type: offer.instance_type.clone(),
            ipv4: Some("10.254.0.1".to_string()),
            endpoint: None,
            metadata: HashMap::new(),
        })
    }

    async fn inspect(&self, provider_resource_id: &str) -> Result<ResourceState, ProviderError> {
        let state = self.state.lock().unwrap();
        Ok(state
            .get(provider_resource_id)
            .map(|s| s.status)
            .unwrap_or(ResourceState::Unknown))
    }

    async fn start(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let mut state = self.state.lock().unwrap();
        if let Some(s) = state.get_mut(provider_resource_id) {
            s.status = ResourceState::Running;
            Ok(())
        } else {
            Err(ProviderError::NotFound(provider_resource_id.to_string()))
        }
    }

    async fn stop(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let mut state = self.state.lock().unwrap();
        if let Some(s) = state.get_mut(provider_resource_id) {
            s.status = ResourceState::Stopped;
            Ok(())
        } else {
            Err(ProviderError::NotFound(provider_resource_id.to_string()))
        }
    }

    async fn terminate(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        let mut state = self.state.lock().unwrap();
        if let Some(s) = state.get_mut(provider_resource_id) {
            s.status = ResourceState::Terminated;
            Ok(())
        } else {
            Err(ProviderError::NotFound(provider_resource_id.to_string()))
        }
    }

    async fn collect_usage(
        &self,
        provider_resource_id: &str,
        _since: DateTime<Utc>,
    ) -> Result<Vec<UsageEvent>, ProviderError> {
        let state = self.state.lock().unwrap();
        let resource = state
            .get(provider_resource_id)
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;
        Ok(vec![UsageEvent {
            event_type: "compute_seconds".to_string(),
            quantity: 60.0,
            unit: "seconds".to_string(),
            measured_at: Utc::now(),
            metadata: {
                let mut m = HashMap::new();
                m.insert("kind".to_string(), resource.kind.to_string());
                m.insert("class".to_string(), resource.class.clone());
                m
            },
        }])
    }

    async fn health(&self) -> Result<HealthSnapshot, ProviderError> {
        Ok(HealthSnapshot {
            healthy: true,
            message: Some("fake provider is always healthy".to_string()),
            last_checked: Utc::now(),
        })
    }
}

/// Convenience constructor for tests.
pub fn fake_cpu_provider() -> FakeProvider {
    FakeProvider::new("us-east", "fake-cpu-small")
        .with_capacity(2, 4096, 0)
        .with_pricing(1, 5)
}

/// Convenience constructor for tests.
pub fn fake_gpu_provider() -> FakeProvider {
    FakeProvider::new("us-east", "fake-gpu-medium")
        .with_capacity(8, 32768, 49152)
        .with_pricing(199, 119)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fabric::{CustomerConstraints, ReliabilityTier, ResourceRequest};

    fn compute_request(class: &str) -> ResourceRequest {
        ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Compute,
            class: class.to_string(),
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
        }
    }

    #[tokio::test]
    async fn fake_provider_returns_offer_for_matching_request() {
        let provider = fake_cpu_provider();
        let req = compute_request("s");
        let offers = provider.discover_offers(&req).await.unwrap();
        assert_eq!(offers.len(), 1);
        assert_eq!(offers[0].provider_kind, "fake");
    }

    #[tokio::test]
    async fn fake_provider_provisions_and_inspects() {
        let provider = fake_cpu_provider();
        let req = compute_request("s");
        let offer = provider.discover_offers(&req).await.unwrap().pop().unwrap();
        let resource = provider.provision(&req, &offer).await.unwrap();
        let state = provider.inspect(&resource.provider_resource_id).await.unwrap();
        assert_eq!(state, ResourceState::Running);
    }

    #[tokio::test]
    async fn fake_provider_respects_max_price_constraint() {
        let provider = fake_cpu_provider().with_pricing(100, 60);
        let mut req = compute_request("s");
        req.constraints.max_price_per_hour_cents = Some(50);
        let offers = provider.discover_offers(&req).await.unwrap();
        assert!(offers.is_empty());
    }

    #[tokio::test]
    async fn fake_provider_respects_region_requirement() {
        let provider = fake_cpu_provider();
        let mut req = compute_request("s");
        req.region_policy = RegionPolicy::Require(vec!["eu-west".to_string()]);
        let offers = provider.discover_offers(&req).await.unwrap();
        assert!(offers.is_empty());
    }
}