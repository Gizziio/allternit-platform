//! Private Fabric node adapter for the Fabric control plane.
//!
//! Turns customer-owned or Allternit-managed edge nodes into a Fabric provider.
//! The adapter is backed by a `FabricNodePool` that is populated by node
//! enrollment and heartbeats from the control plane (or directly in tests).
//!
//! Each provision creates an in-memory assignment on the selected node. The
//! control plane persists assignments to `fabric_node_assignments` and usage to
//! `fabric_usage_events`; this adapter only exposes scheduling-time capacity
//! and a lightweight assignment state.

use crate::fabric::{
    FabricProvider, HealthSnapshot, Offer, ProviderCapabilities, ProviderError, ProvisionedResource,
    RegionPolicy, ResourceKind, ResourceRequest, ResourceState, UsageEvent,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tracing::info;

const KIND: &str = "fabric_node";

/// Capability of a single Private Fabric node.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeCapacity {
    pub total_vcpu: u32,
    pub total_memory_mib: u64,
    pub total_gpu_vram_mib: u64,
    pub gpu_model: Option<String>,
    pub free_vcpu: u32,
    pub free_memory_mib: u64,
    pub free_gpu_vram_mib: u64,
}

impl NodeCapacity {
    pub fn can_fit(&self, req: &ResourceRequest) -> bool {
        self.free_vcpu >= req.vcpu_min
            && self.free_memory_mib >= req.memory_mib_min
            && self.free_gpu_vram_mib >= req.gpu_vram_mib_min
    }
}

/// A registered Private Fabric node.
#[derive(Debug, Clone)]
pub struct FabricNode {
    pub id: String,
    pub organization_id: String,
    pub display_name: Option<String>,
    pub region: String,
    pub labels: HashMap<String, String>,
    pub status: NodeStatus,
    pub capacity: NodeCapacity,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Pending,
    Approved,
    Rejected,
    Active,
    Inactive,
    Draining,
}

impl NodeStatus {
    pub fn schedulable(self) -> bool {
        matches!(self, NodeStatus::Active | NodeStatus::Approved)
    }
}

/// An active assignment of a Fabric resource to a node.
#[derive(Debug, Clone)]
pub struct NodeAssignment {
    pub assignment_id: String,
    pub node_id: String,
    pub resource_id: String,
    pub kind: ResourceKind,
    pub state: ResourceState,
    pub created_at: DateTime<Utc>,
}

/// In-memory pool of Private Fabric nodes and their assignments.
#[derive(Debug, Default)]
pub struct FabricNodePool {
    nodes: RwLock<HashMap<String, Arc<FabricNode>>>,
    assignments: RwLock<HashMap<String, NodeAssignment>>,
    next_assignment_id: AtomicU64,
}

impl FabricNodePool {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_node(&self, node: FabricNode) {
        let mut nodes = self.nodes.write().expect("FabricNodePool lock poisoned");
        info!(node_id = %node.id, region = %node.region, "registered fabric node");
        nodes.insert(node.id.clone(), Arc::new(node));
    }

    pub fn remove_node(&self, node_id: &str) -> bool {
        let mut nodes = self.nodes.write().expect("FabricNodePool lock poisoned");
        nodes.remove(node_id).is_some()
    }

    pub fn update_node_capacity(&self, node_id: &str, capacity: NodeCapacity) -> bool {
        let nodes = self.nodes.read().expect("FabricNodePool lock poisoned");
        if let Some(node) = nodes.get(node_id) {
            let mut updated = node.as_ref().clone();
            updated.capacity = capacity;
            drop(nodes);
            self.nodes
                .write()
                .expect("FabricNodePool lock poisoned")
                .insert(node_id.to_string(), Arc::new(updated));
            true
        } else {
            false
        }
    }

    pub fn nodes(&self) -> Vec<Arc<FabricNode>> {
        self.nodes
            .read()
            .map(|n| n.values().cloned().collect())
            .unwrap_or_default()
    }

    pub fn active_nodes(&self) -> Vec<Arc<FabricNode>> {
        self.nodes()
            .into_iter()
            .filter(|n| n.status.schedulable())
            .collect()
    }

    /// Replace the in-memory node set with `nodes`. Existing assignments are
    /// preserved; nodes that disappear will cause their assignments to become
    /// orphaned until a later iteration handles cleanup.
    pub fn sync_nodes(&self, nodes: Vec<FabricNode>) {
        let mut guard = self.nodes.write().expect("FabricNodePool lock poisoned");
        guard.clear();
        for node in nodes {
            info!(node_id = %node.id, region = %node.region, "synced fabric node");
            guard.insert(node.id.clone(), Arc::new(node));
        }
    }

    fn create_assignment(&self, node_id: String, resource_id: String, kind: ResourceKind) -> String {
        let id = self
            .next_assignment_id
            .fetch_add(1, Ordering::Relaxed)
            .to_string();
        let key = format!("{}:{}:{}", KIND, node_id, id);
        let assignment = NodeAssignment {
            assignment_id: id.clone(),
            node_id,
            resource_id,
            kind,
            state: ResourceState::Running,
            created_at: Utc::now(),
        };
        self.assignments
            .write()
            .expect("FabricNodePool lock poisoned")
            .insert(key, assignment);
        id
    }

    fn assignment(&self, provider_resource_id: &str) -> Option<NodeAssignment> {
        self.assignments
            .read()
            .ok()
            .and_then(|a| a.get(provider_resource_id).cloned())
    }

    fn set_assignment_state(&self, provider_resource_id: &str, state: ResourceState) -> bool {
        let mut assignments = self
            .assignments
            .write()
            .expect("FabricNodePool lock poisoned");
        if let Some(a) = assignments.get_mut(provider_resource_id) {
            a.state = state;
            true
        } else {
            false
        }
    }
}

#[derive(Clone, Debug)]
pub struct FabricNodeProvider {
    pool: Arc<FabricNodePool>,
    organization_id: String,
}

impl FabricNodeProvider {
    pub fn new(pool: Arc<FabricNodePool>, organization_id: impl Into<String>) -> Self {
        Self {
            pool,
            organization_id: organization_id.into(),
        }
    }

    pub fn pool(&self) -> Arc<FabricNodePool> {
        self.pool.clone()
    }

    /// Replace the provider's node pool with the given nodes. Callers (e.g. the
    /// control plane) are responsible for reading active nodes from the registry
    /// and converting them to the provider's `FabricNode` representation.
    pub fn sync_nodes(&self, nodes: Vec<FabricNode>) {
        self.pool.sync_nodes(nodes);
    }
}

fn kind_supported(kind: ResourceKind) -> bool {
    matches!(
        kind,
        ResourceKind::Compute | ResourceKind::Gpu | ResourceKind::Sandbox | ResourceKind::Agent | ResourceKind::Batch | ResourceKind::Harness
    )
}

#[async_trait]
impl FabricProvider for FabricNodeProvider {
    fn kind(&self) -> String {
        KIND.to_string()
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            kinds: vec![
                ResourceKind::Compute,
                ResourceKind::Gpu,
                ResourceKind::Sandbox,
                ResourceKind::Agent,
                ResourceKind::Batch,
                ResourceKind::Harness,
            ],
            regions: vec!["us-east".to_string(), "us-west".to_string(), "any".to_string()],
            supports_gpu: true,
            supports_interruptible: false,
            supports_spot: false,
            supports_persistence: false,
        }
    }

    async fn discover_offers(&self, req: &ResourceRequest) -> Result<Vec<Offer>, ProviderError> {
        if !kind_supported(req.kind) {
            return Ok(Vec::new());
        }

        let mut offers = Vec::new();
        for node in self.pool.active_nodes() {
            if node.organization_id != self.organization_id {
                continue;
            }

            if !node.capacity.can_fit(req) {
                continue;
            }

            let region = match &req.region_policy {
                RegionPolicy::Require(regions) if !regions.contains(&node.region) => continue,
                RegionPolicy::Exclude(regions) if regions.contains(&node.region) => continue,
                _ => node.region.clone(),
            };

            let gpu_model = node.capacity.gpu_model.clone();
            let gpu_vram_mib = node.capacity.total_gpu_vram_mib;

            offers.push(Offer {
                id: format!("off_fabric_node_{}", node.id),
                provider_kind: KIND.to_string(),
                region,
                instance_type: node.id.clone(),
                vcpu: node.capacity.total_vcpu,
                memory_mib: node.capacity.total_memory_mib,
                gpu_vram_mib,
                gpu_model,
                price_per_hour_cents: 0, // BYOC: customer-owned; price is software license.
                currency: "USD".to_string(),
                reliability_score: 0.95,
                interruptible: false,
                estimated_ready_secs: 5,
                raw_metadata: Some(serde_json::json!({
                    "fabric_node_id": node.id,
                    "fabric_node_display_name": node.display_name,
                    "fabric_node_free_vcpu": node.capacity.free_vcpu,
                    "fabric_node_free_memory_mib": node.capacity.free_memory_mib,
                    "fabric_node_free_gpu_vram_mib": node.capacity.free_gpu_vram_mib,
                })),
            });
        }

        Ok(offers)
    }

    async fn quote(&self, _offer: &Offer, _duration: Duration) -> Result<i64, ProviderError> {
        Ok(0)
    }

    async fn provision(
        &self,
        req: &ResourceRequest,
        offer: &Offer,
    ) -> Result<ProvisionedResource, ProviderError> {
        let node_id = offer.instance_type.clone();
        let assignment_id = self
            .pool
            .create_assignment(node_id.clone(), req.id.clone(), req.kind);
        let provider_resource_id = format!("{}:{}:{}", KIND, node_id, assignment_id);

        let mut metadata = HashMap::new();
        metadata.insert("fabric_node_id".to_string(), node_id.clone());
        metadata.insert("fabric_assignment_id".to_string(), assignment_id);
        metadata.insert("allternit_request_id".to_string(), req.id.clone());

        info!(provider_resource_id, "provisioned fabric node assignment");

        Ok(ProvisionedResource {
            provider_resource_id,
            region: offer.region.clone(),
            instance_type: node_id,
            ipv4: None,
            endpoint: None,
            metadata,
        })
    }

    async fn inspect(&self, provider_resource_id: &str) -> Result<ResourceState, ProviderError> {
        if let Some(a) = self.pool.assignment(provider_resource_id) {
            Ok(a.state)
        } else {
            Err(ProviderError::NotFound(provider_resource_id.to_string()))
        }
    }

    async fn start(&self, _provider_resource_id: &str) -> Result<(), ProviderError> {
        Ok(())
    }

    async fn stop(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        self.pool
            .set_assignment_state(provider_resource_id, ResourceState::Stopped);
        Ok(())
    }

    async fn terminate(&self, provider_resource_id: &str) -> Result<(), ProviderError> {
        self.pool
            .set_assignment_state(provider_resource_id, ResourceState::Terminated);
        Ok(())
    }

    async fn collect_usage(
        &self,
        provider_resource_id: &str,
        since: DateTime<Utc>,
    ) -> Result<Vec<UsageEvent>, ProviderError> {
        let assignment = self
            .pool
            .assignment(provider_resource_id)
            .ok_or_else(|| ProviderError::NotFound(provider_resource_id.to_string()))?;

        let seconds = (Utc::now() - since).num_seconds().max(0) as f64;

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), KIND.to_string());
        metadata.insert("fabric_node_id".to_string(), assignment.node_id.clone());
        metadata.insert("fabric_assignment_id".to_string(), assignment.assignment_id.clone());
        metadata.insert("resource_id".to_string(), assignment.resource_id.clone());

        Ok(vec![UsageEvent {
            event_type: "compute_seconds".to_string(),
            quantity: seconds,
            unit: "seconds".to_string(),
            measured_at: since,
            metadata,
        }])
    }

    async fn health(&self) -> Result<HealthSnapshot, ProviderError> {
        let nodes = self.pool.active_nodes();
        let healthy = !nodes.is_empty();
        Ok(HealthSnapshot {
            healthy,
            message: Some(format!(
                "{} active fabric node(s) in pool",
                nodes.len()
            )),
            last_checked: Utc::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fabric::{CustomerConstraints, ReliabilityTier, ResourceRequest};

    fn node(id: &str, memory_mib: u64, gpu_vram_mib: u64) -> FabricNode {
        FabricNode {
            id: id.to_string(),
            organization_id: "org-1".to_string(),
            display_name: Some(format!("node {}", id)),
            region: "us-east".to_string(),
            labels: HashMap::new(),
            status: NodeStatus::Active,
            capacity: NodeCapacity {
                total_vcpu: 8,
                total_memory_mib: memory_mib,
                total_gpu_vram_mib: gpu_vram_mib,
                gpu_model: if gpu_vram_mib > 0 { Some("A40".to_string()) } else { None },
                free_vcpu: 8,
                free_memory_mib: memory_mib,
                free_gpu_vram_mib: gpu_vram_mib,
            },
            last_heartbeat_at: Some(Utc::now()),
        }
    }

    fn compute_request(memory_mib: u64) -> ResourceRequest {
        ResourceRequest {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ResourceKind::Compute,
            class: "s".to_string(),
            display_name: None,
            vcpu_min: 1,
            memory_mib_min: memory_mib,
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
    async fn fabric_node_discovers_offers_for_matching_request() {
        let pool = Arc::new(FabricNodePool::new());
        pool.register_node(node("n1", 8192, 0));
        let provider = FabricNodeProvider::new(pool, "org-1");

        let offers = provider.discover_offers(&compute_request(1024)).await.unwrap();
        assert_eq!(offers.len(), 1);
        assert_eq!(offers[0].instance_type, "n1");
    }

    #[tokio::test]
    async fn fabric_node_filters_by_capacity() {
        let pool = Arc::new(FabricNodePool::new());
        pool.register_node(node("n1", 2048, 0));
        let provider = FabricNodeProvider::new(pool, "org-1");

        let offers = provider.discover_offers(&compute_request(4096)).await.unwrap();
        assert!(offers.is_empty());
    }

    #[tokio::test]
    async fn fabric_node_filters_by_organization() {
        let pool = Arc::new(FabricNodePool::new());
        pool.register_node(node("n1", 8192, 0));
        let provider = FabricNodeProvider::new(pool, "org-2");

        let offers = provider.discover_offers(&compute_request(1024)).await.unwrap();
        assert!(offers.is_empty());
    }

    #[tokio::test]
    async fn fabric_node_provisions_assignment() {
        let pool = Arc::new(FabricNodePool::new());
        pool.register_node(node("n1", 8192, 0));
        let provider = FabricNodeProvider::new(pool.clone(), "org-1");

        let req = compute_request(1024);
        let mut offers = provider.discover_offers(&req).await.unwrap();
        let offer = offers.pop().unwrap();
        let resource = provider.provision(&req, &offer).await.unwrap();

        assert!(resource.provider_resource_id.starts_with("fabric_node:n1:"));
        let state = provider.inspect(&resource.provider_resource_id).await.unwrap();
        assert_eq!(state, ResourceState::Running);
    }

    #[tokio::test]
    async fn fabric_node_terminates_assignment() {
        let pool = Arc::new(FabricNodePool::new());
        pool.register_node(node("n1", 8192, 0));
        let provider = FabricNodeProvider::new(pool.clone(), "org-1");

        let req = compute_request(1024);
        let mut offers = provider.discover_offers(&req).await.unwrap();
        let offer = offers.pop().unwrap();
        let resource = provider.provision(&req, &offer).await.unwrap();

        provider.terminate(&resource.provider_resource_id).await.unwrap();
        let state = provider.inspect(&resource.provider_resource_id).await.unwrap();
        assert_eq!(state, ResourceState::Terminated);
    }

    #[tokio::test]
    async fn fabric_node_sync_nodes_replaces_pool() {
        let pool = Arc::new(FabricNodePool::new());
        pool.register_node(node("n1", 8192, 0));
        let provider = FabricNodeProvider::new(pool.clone(), "org-1");

        let offers_before = provider.discover_offers(&compute_request(1024)).await.unwrap();
        assert_eq!(offers_before.len(), 1);

        provider.sync_nodes(vec![node("n2", 16384, 0)]);

        let offers_after = provider.discover_offers(&compute_request(1024)).await.unwrap();
        assert_eq!(offers_after.len(), 1);
        assert_eq!(offers_after[0].instance_type, "n2");
    }
}
