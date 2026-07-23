//! Allternit Node Registry
//!
//! Implements node registration, capability tracking, health monitoring, and discovery.
//!
//! Features:
//! - Node registration API
//! - Capability tracking
//! - Health monitoring
//! - Routing metadata
//! - Node discovery

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Node registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub node_id: String,
    pub name: String,
    pub node_type: NodeType,
    pub status: NodeStatus,
    pub capabilities: HashSet<String>,
    pub metadata: NodeMetadata,
    pub health: NodeHealth,
    pub registered_at: DateTime<Utc>,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub tags: HashSet<String>,
}

/// Node type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NodeType {
    ControlPlane,
    Worker,
    Edge,
    Gateway,
}

/// Node status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NodeStatus {
    Registering,
    Healthy,
    Degraded,
    Unhealthy,
    Offline,
}

/// Node metadata
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeMetadata {
    pub region: Option<String>,
    pub zone: Option<String>,
    pub cpu_cores: Option<f32>,
    pub memory_mb: Option<u64>,
    pub gpu_count: Option<u32>,
    pub disk_gb: Option<u64>,
    pub network_bandwidth_mbps: Option<f32>,
    pub endpoint: Option<String>,
    pub public_ip: Option<String>,
    pub private_ip: Option<String>,
}

/// Node health status
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeHealth {
    pub status: NodeHealthStatus,
    pub cpu_percent: Option<f32>,
    pub memory_percent: Option<f32>,
    pub disk_percent: Option<f32>,
    pub active_workers: Option<u32>,
    pub max_workers: Option<u32>,
    pub last_check: DateTime<Utc>,
    pub issues: Vec<String>,
    pub consecutive_failures: u32,
}

/// Node health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub enum NodeHealthStatus {
    #[default]
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Node registration request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterNodeRequest {
    pub name: String,
    pub node_type: NodeType,
    pub capabilities: Vec<String>,
    pub metadata: NodeMetadata,
    pub tags: Vec<String>,
}

/// Node registration response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterNodeResponse {
    pub node_id: String,
    pub node_secret: String,
    pub status: NodeStatus,
}

/// Node discovery query
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeDiscoveryQuery {
    pub node_type: Option<NodeType>,
    pub required_capabilities: Vec<String>,
    pub region: Option<String>,
    pub status: Option<NodeStatus>,
    pub min_cpu_cores: Option<f32>,
    pub min_memory_mb: Option<u64>,
    pub min_gpu_count: Option<u32>,
    pub tags: Vec<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Node discovery result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeDiscoveryResult {
    pub nodes: Vec<Node>,
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
}

/// Node heartbeat request
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeHeartbeat {
    pub cpu_percent: Option<f32>,
    pub memory_percent: Option<f32>,
    pub disk_percent: Option<f32>,
    pub active_workers: Option<u32>,
    pub issues: Vec<String>,
}

/// Node routing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeRoutingInfo {
    pub node_id: String,
    pub endpoint: String,
    pub capabilities: HashSet<String>,
    pub load_score: f32,  // 0.0 = idle, 1.0 = fully loaded
    pub latency_ms: Option<f32>,
    pub priority: i32,
}

/// Node registry error types
#[derive(Debug, thiserror::Error)]
pub enum NodeRegistryError {
    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Node already registered: {0}")]
    NodeAlreadyRegistered(String),

    #[error("Invalid node secret")]
    InvalidSecret,

    #[error("Node unhealthy: {0}")]
    NodeUnhealthy(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

/// Node Registry
pub struct NodeRegistry {
    nodes: Arc<RwLock<HashMap<String, Node>>>,
    node_secrets: Arc<RwLock<HashMap<String, String>>>,  // node_id -> secret
    max_missed_heartbeats: u32,
    heartbeat_interval_seconds: u64,
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self {
            nodes: Arc::new(RwLock::new(HashMap::new())),
            node_secrets: Arc::new(RwLock::new(HashMap::new())),
            max_missed_heartbeats: 3,
            heartbeat_interval_seconds: 30,
        }
    }

    /// Register a new node
    pub async fn register_node(&self, request: RegisterNodeRequest) -> Result<RegisterNodeResponse, NodeRegistryError> {
        let node_id = format!("node_{}", Uuid::new_v4().simple());
        let node_secret = Uuid::new_v4().simple().to_string();

        let node = Node {
            node_id: node_id.clone(),
            name: request.name,
            node_type: request.node_type,
            status: NodeStatus::Registering,
            capabilities: request.capabilities.into_iter().collect(),
            metadata: request.metadata,
            health: NodeHealth {
                status: NodeHealthStatus::Unknown,
                last_check: Utc::now(),
                ..Default::default()
            },
            registered_at: Utc::now(),
            last_heartbeat: None,
            tags: request.tags.into_iter().collect(),
        };

        let mut nodes = self.nodes.write().await;
        let mut secrets = self.node_secrets.write().await;

        if nodes.contains_key(&node_id) {
            return Err(NodeRegistryError::NodeAlreadyRegistered(node_id));
        }

        nodes.insert(node_id.clone(), node);
        secrets.insert(node_id.clone(), node_secret.clone());

        Ok(RegisterNodeResponse {
            node_id,
            node_secret,
            status: NodeStatus::Registering,
        })
    }

    /// Receive heartbeat from node
    pub async fn receive_heartbeat(&self, node_id: &str, secret: &str, heartbeat: NodeHeartbeat) -> Result<(), NodeRegistryError> {
        // Verify secret
        let secrets = self.node_secrets.read().await;
        if let Some(expected_secret) = secrets.get(node_id) {
            if expected_secret != secret {
                return Err(NodeRegistryError::InvalidSecret);
            }
        } else {
            return Err(NodeRegistryError::NodeNotFound(node_id.to_string()));
        }
        drop(secrets);

        // Update node health
        let mut nodes = self.nodes.write().await;
        if let Some(node) = nodes.get_mut(node_id) {
            node.last_heartbeat = Some(Utc::now());
            node.health.cpu_percent = heartbeat.cpu_percent;
            node.health.memory_percent = heartbeat.memory_percent;
            node.health.disk_percent = heartbeat.disk_percent;
            node.health.active_workers = heartbeat.active_workers;
            node.health.issues = heartbeat.issues;
            node.health.consecutive_failures = 0;
            node.health.last_check = Utc::now();

            // Update status based on health
            node.health.status = self.calculate_health_status(&node.health);
            node.status = self.calculate_node_status(node.health.status);
        } else {
            return Err(NodeRegistryError::NodeNotFound(node_id.to_string()));
        }

        Ok(())
    }

    /// Get node by ID
    pub async fn get_node(&self, node_id: &str) -> Option<Node> {
        let nodes = self.nodes.read().await;
        nodes.get(node_id).cloned()
    }

    /// Discover nodes matching query
    pub async fn discover_nodes(&self, query: NodeDiscoveryQuery) -> NodeDiscoveryResult {
        let nodes = self.nodes.read().await;
        let mut matching: Vec<Node> = nodes.values().cloned().collect();

        // Filter by node type
        if let Some(node_type) = query.node_type {
            matching.retain(|n| n.node_type == node_type);
        }

        // Filter by required capabilities
        if !query.required_capabilities.is_empty() {
            matching.retain(|n| {
                query.required_capabilities.iter().all(|cap| n.capabilities.contains(cap))
            });
        }

        // Filter by region
        if let Some(region) = query.region {
            matching.retain(|n| n.metadata.region.as_ref() == Some(&region));
        }

        // Filter by status
        if let Some(status) = query.status {
            matching.retain(|n| n.status == status);
        }

        // Filter by minimum resources
        if let Some(min_cpu) = query.min_cpu_cores {
            matching.retain(|n| n.metadata.cpu_cores.unwrap_or(0.0) >= min_cpu);
        }
        if let Some(min_memory) = query.min_memory_mb {
            matching.retain(|n| n.metadata.memory_mb.unwrap_or(0) >= min_memory);
        }
        if let Some(min_gpu) = query.min_gpu_count {
            matching.retain(|n| n.metadata.gpu_count.unwrap_or(0) >= min_gpu);
        }

        // Filter by tags
        if !query.tags.is_empty() {
            matching.retain(|n| {
                query.tags.iter().all(|tag| n.tags.contains(tag))
            });
        }

        let total = matching.len();

        // Sort by health status (healthy first) and then by load
        matching.sort_by(|a, b| {
            let health_order = |h: &NodeHealthStatus| match h {
                NodeHealthStatus::Healthy => 0,
                NodeHealthStatus::Degraded => 1,
                NodeHealthStatus::Unhealthy => 2,
                NodeHealthStatus::Unknown => 3,
            };
            health_order(&a.health.status).cmp(&health_order(&b.health.status))
        });

        // Apply pagination
        let offset = query.offset.unwrap_or(0);
        let limit = query.limit.unwrap_or(usize::MAX);
        let nodes = matching.into_iter().skip(offset).take(limit).collect();

        NodeDiscoveryResult {
            nodes,
            total,
            limit,
            offset,
        }
    }

    /// Get routing info for a node
    pub async fn get_routing_info(&self, node_id: &str) -> Option<NodeRoutingInfo> {
        let nodes = self.nodes.read().await;
        let node = nodes.get(node_id)?;

        // Calculate load score
        let load_score = node.health.active_workers.unwrap_or(0) as f32
            / node.health.max_workers.unwrap_or(1) as f32;

        // Calculate priority based on health and load
        let priority = match node.health.status {
            NodeHealthStatus::Healthy => 10,
            NodeHealthStatus::Degraded => 5,
            NodeHealthStatus::Unhealthy => 0,
            NodeHealthStatus::Unknown => 1,
        } - (load_score * 10.0) as i32;

        Some(NodeRoutingInfo {
            node_id: node.node_id.clone(),
            endpoint: node.metadata.endpoint.clone().unwrap_or_default(),
            capabilities: node.capabilities.clone(),
            load_score,
            latency_ms: None,  // Would be calculated from actual network latency
            priority,
        })
    }

    /// Check for unhealthy nodes (background task)
    pub async fn check_node_health(&self) -> Vec<String> {
        let mut nodes = self.nodes.write().await;
        let mut unhealthy = Vec::new();
        let now = Utc::now();

        for (node_id, node) in nodes.iter_mut() {
            if let Some(last_heartbeat) = node.last_heartbeat {
                let seconds_since_heartbeat = now.signed_duration_since(last_heartbeat).num_seconds() as u32;
                let missed_heartbeats = seconds_since_heartbeat / self.heartbeat_interval_seconds as u32;

                if missed_heartbeats >= self.max_missed_heartbeats {
                    node.health.consecutive_failures = missed_heartbeats;
                    node.health.status = NodeHealthStatus::Unhealthy;
                    node.status = NodeStatus::Unhealthy;
                    node.health.issues.push(format!(
                        "No heartbeat for {} seconds",
                        seconds_since_heartbeat
                    ));
                    unhealthy.push(node_id.clone());
                }
            }
        }

        unhealthy
    }

    /// Calculate health status from metrics
    fn calculate_health_status(&self, health: &NodeHealth) -> NodeHealthStatus {
        if health.consecutive_failures >= self.max_missed_heartbeats {
            return NodeHealthStatus::Unhealthy;
        }

        // Check resource usage
        let cpu = health.cpu_percent.unwrap_or(0.0);
        let memory = health.memory_percent.unwrap_or(0.0);
        let disk = health.disk_percent.unwrap_or(0.0);

        if cpu > 95.0 || memory > 95.0 || disk > 95.0 {
            NodeHealthStatus::Unhealthy
        } else if cpu > 80.0 || memory > 80.0 || disk > 80.0 {
            NodeHealthStatus::Degraded
        } else if !health.issues.is_empty() {
            NodeHealthStatus::Degraded
        } else {
            NodeHealthStatus::Healthy
        }
    }

    /// Calculate node status from health status
    fn calculate_node_status(&self, health_status: NodeHealthStatus) -> NodeStatus {
        match health_status {
            NodeHealthStatus::Healthy => NodeStatus::Healthy,
            NodeHealthStatus::Degraded => NodeStatus::Degraded,
            NodeHealthStatus::Unhealthy => NodeStatus::Unhealthy,
            NodeHealthStatus::Unknown => NodeStatus::Registering,
        }
    }

    /// Get all nodes
    pub async fn get_all_nodes(&self) -> Vec<Node> {
        let nodes = self.nodes.read().await;
        nodes.values().cloned().collect()
    }

    /// Get node count by status
    pub async fn get_status_counts(&self) -> HashMap<NodeStatus, usize> {
        let nodes = self.nodes.read().await;
        let mut counts = HashMap::new();

        for node in nodes.values() {
            *counts.entry(node.status).or_insert(0) += 1;
        }

        counts
    }

    /// Compute node fingerprint for integrity verification
    pub fn compute_node_fingerprint(node: &Node) -> String {
        let mut hasher = Sha256::new();
        hasher.update(node.node_id.as_bytes());
        hasher.update(node.name.as_bytes());
        hasher.update(format!("{:?}", node.node_type).as_bytes());
        hasher.update(format!("{:?}", node.status).as_bytes());
        
        let mut caps: Vec<_> = node.capabilities.iter().collect();
        caps.sort();
        for cap in caps {
            hasher.update(cap.as_bytes());
        }
        
        format!("{:x}", hasher.finalize())
    }
}

impl Default for NodeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_register_node() {
        let registry = NodeRegistry::new();
        
        let request = RegisterNodeRequest {
            name: "test-node".to_string(),
            node_type: NodeType::Worker,
            capabilities: vec!["cpu".to_string(), "memory".to_string()],
            metadata: NodeMetadata {
                cpu_cores: Some(8.0),
                memory_mb: Some(16384),
                ..Default::default()
            },
            tags: vec!["test".to_string()],
        };

        let response = registry.register_node(request).await.unwrap();
        
        assert!(response.node_id.starts_with("node_"));
        assert_eq!(response.status, NodeStatus::Registering);

        // Verify node can be retrieved
        let node = registry.get_node(&response.node_id).await.unwrap();
        assert_eq!(node.name, "test-node");
        assert_eq!(node.node_type, NodeType::Worker);
    }

    #[tokio::test]
    async fn test_heartbeat() {
        let registry = NodeRegistry::new();
        
        let request = RegisterNodeRequest {
            name: "test-node".to_string(),
            node_type: NodeType::Worker,
            capabilities: vec![],
            metadata: NodeMetadata::default(),
            tags: vec![],
        };

        let response = registry.register_node(request).await.unwrap();
        
        let heartbeat = NodeHeartbeat {
            cpu_percent: Some(50.0),
            memory_percent: Some(60.0),
            disk_percent: Some(40.0),
            active_workers: Some(5),
            issues: vec![],
        };

        registry.receive_heartbeat(&response.node_id, &response.node_secret, heartbeat)
            .await.unwrap();

        let node = registry.get_node(&response.node_id).await.unwrap();
        assert_eq!(node.health.cpu_percent, Some(50.0));
        assert_eq!(node.health.status, NodeHealthStatus::Healthy);
    }

    #[tokio::test]
    async fn test_discover_nodes() {
        let registry = NodeRegistry::new();
        
        // Register multiple nodes
        for i in 0..5 {
            let request = RegisterNodeRequest {
                name: format!("node-{}", i),
                node_type: NodeType::Worker,
                capabilities: vec!["cpu".to_string()],
                metadata: NodeMetadata {
                    cpu_cores: Some(8.0),
                    memory_mb: Some(16384),
                    region: Some("us-west".to_string()),
                    ..Default::default()
                },
                tags: vec!["test".to_string()],
            };
            registry.register_node(request).await.unwrap();
        }

        // Discover with filters
        let query = NodeDiscoveryQuery {
            node_type: Some(NodeType::Worker),
            region: Some("us-west".to_string()),
            limit: Some(3),
            ..Default::default()
        };

        let result = registry.discover_nodes(query).await;
        
        assert_eq!(result.total, 5);
        assert_eq!(result.nodes.len(), 3);
        assert_eq!(result.limit, 3);
        assert_eq!(result.offset, 0);
    }

    #[tokio::test]
    async fn test_invalid_secret() {
        let registry = NodeRegistry::new();
        
        let request = RegisterNodeRequest {
            name: "test-node".to_string(),
            node_type: NodeType::Worker,
            capabilities: vec![],
            metadata: NodeMetadata::default(),
            tags: vec![],
        };

        let response = registry.register_node(request).await.unwrap();
        
        let heartbeat = NodeHeartbeat::default();
        
        // Try with wrong secret
        let result = registry.receive_heartbeat(&response.node_id, "wrong_secret", heartbeat).await;
        
        assert!(matches!(result, Err(NodeRegistryError::InvalidSecret)));
    }
}
