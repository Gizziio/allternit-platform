//! Fabric control plane contracts.
//!
//! Fabric is the multi-provider compute abstraction layer: customers ask
//! Allternit for a capability class, and Fabric decides where to run it.
//! This module defines the resource contract, provider adapter trait, and
//! common types used by both the API scheduler and provider-specific
//! adapters.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::time::Duration;
use thiserror::Error;

/// Customer-facing product line.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceKind {
    Compute,
    Gpu,
    Sandbox,
    Inference,
    Agent,
    Batch,
    Cluster,
    Storage,
    Harness,
}

impl fmt::Display for ResourceKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResourceKind::Compute => write!(f, "compute"),
            ResourceKind::Gpu => write!(f, "gpu"),
            ResourceKind::Sandbox => write!(f, "sandbox"),
            ResourceKind::Inference => write!(f, "inference"),
            ResourceKind::Agent => write!(f, "agent"),
            ResourceKind::Batch => write!(f, "batch"),
            ResourceKind::Cluster => write!(f, "cluster"),
            ResourceKind::Storage => write!(f, "storage"),
            ResourceKind::Harness => write!(f, "harness"),
        }
    }
}

impl std::str::FromStr for ResourceKind {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "compute" => Ok(ResourceKind::Compute),
            "gpu" => Ok(ResourceKind::Gpu),
            "sandbox" => Ok(ResourceKind::Sandbox),
            "inference" => Ok(ResourceKind::Inference),
            "agent" => Ok(ResourceKind::Agent),
            "batch" => Ok(ResourceKind::Batch),
            "cluster" => Ok(ResourceKind::Cluster),
            "storage" => Ok(ResourceKind::Storage),
            "harness" => Ok(ResourceKind::Harness),
            other => Err(format!("unknown resource kind: {other}")),
        }
    }
}

/// Reliability / isolation tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReliabilityTier {
    Standard,
    Premium,
    Interruptible,
}

impl fmt::Display for ReliabilityTier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ReliabilityTier::Standard => write!(f, "standard"),
            ReliabilityTier::Premium => write!(f, "premium"),
            ReliabilityTier::Interruptible => write!(f, "interruptible"),
        }
    }
}

impl std::str::FromStr for ReliabilityTier {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "standard" => Ok(ReliabilityTier::Standard),
            "premium" => Ok(ReliabilityTier::Premium),
            "interruptible" => Ok(ReliabilityTier::Interruptible),
            other => Err(format!("unknown reliability tier: {other}")),
        }
    }
}

/// Region / data-residency policy.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RegionPolicy {
    #[default]
    Any,
    Prefer(Vec<String>),
    Require(Vec<String>),
    Exclude(Vec<String>),
}

/// Customer pinning constraints.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CustomerConstraints {
    pub pin_provider: Option<String>,
    pub pin_instance_type: Option<String>,
    pub pin_region: Option<String>,
    pub max_price_per_hour_cents: Option<i64>,
    pub allow_interruptible: bool,
}

/// A request for a Fabric resource.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRequest {
    pub id: String,
    pub kind: ResourceKind,
    pub class: String,
    pub display_name: Option<String>,
    pub vcpu_min: u32,
    pub memory_mib_min: u64,
    pub gpu_vram_mib_min: u64,
    pub region_policy: RegionPolicy,
    pub latency_slo_ms: Option<u64>,
    pub deadline: Option<DateTime<Utc>>,
    pub reliability_tier: ReliabilityTier,
    pub image: Option<String>,
    pub model: Option<String>,
    pub runtime: Option<String>,
    pub storage_mib: u64,
    pub egress_policy: Option<String>,
    pub constraints: CustomerConstraints,
    pub labels: HashMap<String, String>,
    pub user_data: Option<String>,
}

impl ResourceRequest {
    pub fn full_class(&self) -> String {
        format!("{}.{}", self.kind, self.class)
    }
}

/// An offer discovered by a provider adapter.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Offer {
    pub id: String,
    pub provider_kind: String,
    pub region: String,
    pub instance_type: String,
    pub vcpu: u32,
    pub memory_mib: u64,
    pub gpu_vram_mib: u64,
    pub gpu_model: Option<String>,
    pub price_per_hour_cents: i64,
    pub currency: String,
    pub reliability_score: f64,
    pub interruptible: bool,
    pub estimated_ready_secs: u64,
    pub raw_metadata: Option<serde_json::Value>,
}

/// A provisioned resource returned by a provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvisionedResource {
    pub provider_resource_id: String,
    pub region: String,
    pub instance_type: String,
    pub ipv4: Option<String>,
    pub endpoint: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Lifecycle state of a provisioned resource.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceState {
    Provisioning,
    Running,
    Stopped,
    Terminated,
    Error,
    Unknown,
}

impl fmt::Display for ResourceState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResourceState::Provisioning => write!(f, "provisioning"),
            ResourceState::Running => write!(f, "running"),
            ResourceState::Stopped => write!(f, "stopped"),
            ResourceState::Terminated => write!(f, "terminated"),
            ResourceState::Error => write!(f, "error"),
            ResourceState::Unknown => write!(f, "unknown"),
        }
    }
}

/// Snapshot of provider health.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HealthSnapshot {
    pub healthy: bool,
    pub message: Option<String>,
    pub last_checked: DateTime<Utc>,
}

/// Capabilities advertised by a provider.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub kinds: Vec<ResourceKind>,
    pub regions: Vec<String>,
    pub supports_gpu: bool,
    pub supports_interruptible: bool,
    pub supports_spot: bool,
    pub supports_persistence: bool,
}

/// Usage event emitted by a provider or daemon.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageEvent {
    pub event_type: String,
    pub quantity: f64,
    pub unit: String,
    pub measured_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

/// Cost event: what Allternit paid a supplier.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEvent {
    pub cost_cents: i64,
    pub currency: String,
    pub description: String,
    pub recorded_at: DateTime<Utc>,
}

/// Errors returned by provider adapters.
#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("request failed: {0}")]
    Request(String),
    #[error("api error {status}: {message}")]
    Api { status: u16, message: String },
    #[error("resource not found: {0}")]
    NotFound(String),
    #[error("capacity unavailable: {0}")]
    CapacityUnavailable(String),
    #[error("missing credentials: {0}")]
    MissingCredentials(String),
    #[error("not configured")]
    NotConfigured,
}

impl ProviderError {
    pub fn from_api_status(status: u16, body: String) -> Self {
        if status == 404 {
            Self::NotFound(body)
        } else {
            Self::Api { status, message: body }
        }
    }
}

/// A Fabric provider adapter.
#[async_trait]
pub trait FabricProvider: Send + Sync + fmt::Debug {
    fn kind(&self) -> String;

    fn capabilities(&self) -> ProviderCapabilities;

    async fn discover_offers(
        &self,
        req: &ResourceRequest,
    ) -> Result<Vec<Offer>, ProviderError>;

    async fn quote(
        &self,
        offer: &Offer,
        duration: Duration,
    ) -> Result<i64, ProviderError>;

    async fn provision(
        &self,
        req: &ResourceRequest,
        offer: &Offer,
    ) -> Result<ProvisionedResource, ProviderError>;

    async fn inspect(&self, provider_resource_id: &str) -> Result<ResourceState, ProviderError>;

    async fn start(&self, provider_resource_id: &str) -> Result<(), ProviderError>;

    async fn stop(&self, provider_resource_id: &str) -> Result<(), ProviderError>;

    async fn terminate(&self, provider_resource_id: &str) -> Result<(), ProviderError>;

    async fn collect_usage(
        &self,
        provider_resource_id: &str,
        since: DateTime<Utc>,
    ) -> Result<Vec<UsageEvent>, ProviderError>;

    async fn health(&self) -> Result<HealthSnapshot, ProviderError>;
}

/// Registry of enabled Fabric providers.
#[derive(Clone, Debug, Default)]
pub struct FabricProviderRegistry {
    providers: Vec<std::sync::Arc<dyn FabricProvider>>,
}

impl FabricProviderRegistry {
    pub fn empty() -> Self {
        Self {
            providers: Vec::new(),
        }
    }

    pub fn register(&mut self, provider: std::sync::Arc<dyn FabricProvider>) {
        self.providers.push(provider);
    }

    pub fn providers(&self) -> &[std::sync::Arc<dyn FabricProvider>] {
        &self.providers
    }

    pub fn discover_all(
        &self,
        _req: &ResourceRequest,
    ) -> Vec<(&std::sync::Arc<dyn FabricProvider>, Vec<Offer>)> {
        // Synchronous discovery for fake/test providers; real providers will
        // call this concurrently from the scheduler.
        Vec::new()
    }

    /// Run a health check against every registered provider and return the
    /// latest snapshot keyed by provider kind.
    pub async fn health_check_all(&self) -> Vec<(String, HealthSnapshot)> {
        let mut results = Vec::with_capacity(self.providers.len());
        for provider in &self.providers {
            let kind = provider.kind();
            let snapshot = match provider.health().await {
                Ok(s) => s,
                Err(e) => HealthSnapshot {
                    healthy: false,
                    message: Some(format!("health check error: {e}")),
                    last_checked: Utc::now(),
                },
            };
            results.push((kind, snapshot));
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::fake::fake_cpu_provider;
    use crate::providers::runpod::RunpodClient;
    use crate::providers::vast::VastClient;
    use std::sync::Arc;

    #[tokio::test]
    async fn health_check_all_returns_fake_provider_snapshot() {
        let mut registry = FabricProviderRegistry::empty();
        registry.register(Arc::new(fake_cpu_provider()));

        let results = registry.health_check_all().await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "fake");
        assert!(results[0].1.healthy);
    }

    #[tokio::test]
    async fn health_check_all_returns_runpod_and_vast_snapshots() {
        let mut runpod_server = mockito::Server::new_async().await;
        runpod_server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"data":{"gpuTypes":[{"id":"test","displayName":"Test GPU","memoryInGb":24.0,"secureCloud":true,"communityCloud":false,"lowestPrice":{"uninterruptablePrice":0.5,"interruptablePrice":0.3,"stockStatus":"Available"}}]}}"#)
            .create_async()
            .await;

        let mut vast_server = mockito::Server::new_async().await;
        vast_server
            .mock("POST", "/bundles/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"offers":[]}"#)
            .create_async()
            .await;

        let mut registry = FabricProviderRegistry::empty();
        registry.register(Arc::new(RunpodClient::new(runpod_server.url(), "token")));
        registry.register(Arc::new(VastClient::new(vast_server.url(), "key")));

        let results = registry.health_check_all().await;
        let kinds: std::collections::HashSet<_> = results.iter().map(|(k, _)| k.clone()).collect();
        assert!(kinds.contains("runpod"));
        assert!(kinds.contains("vast"));
        for (_, snapshot) in &results {
            assert!(snapshot.healthy, "expected healthy snapshot: {snapshot:?}");
        }
    }
}
