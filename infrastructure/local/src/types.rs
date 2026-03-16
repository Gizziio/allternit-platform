// OWNER: T1-A1

//! Multi-Region Types
//!
//! Type definitions for cross-region infrastructure.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;
use thiserror::Error;
use uuid::Uuid;

// ============================================================================
// Error Types
// ============================================================================

/// Multi-region error types
#[derive(Debug, Error)]
pub enum MultiRegionError {
    #[error("Region not found: {0}")]
    RegionNotFound(String),

    #[error("Replication failed: {0}")]
    ReplicationFailed(String),

    #[error("Quorum not reached: expected {expected}, got {actual}")]
    QuorumNotReached { expected: usize, actual: usize },

    #[error("Health check failed: {0}")]
    HealthCheckFailed(String),

    #[error("Failover failed: {0}")]
    FailoverFailed(String),

    #[error("Load balancer error: {0}")]
    LoadBalancerError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),
}

pub type Result<T> = std::result::Result<T, MultiRegionError>;

// ============================================================================
// Region Types
// ============================================================================

/// Region identifier
pub type RegionId = String;

/// Region status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RegionStatus {
    Active,
    Standby,
    Degraded,
    Unavailable,
    FailingOver,
}

/// Region configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Region {
    pub id: RegionId,
    pub name: String,
    pub endpoint: String,
    pub status: RegionStatus,
    pub priority: u32,
    pub metadata: HashMap<String, String>,
}

impl Region {
    pub fn new(id: &str, name: &str, endpoint: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            endpoint: endpoint.to_string(),
            status: RegionStatus::Active,
            priority: 0,
            metadata: HashMap::new(),
        }
    }

    pub fn with_priority(mut self, priority: u32) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_status(mut self, status: RegionStatus) -> Self {
        self.status = status;
        self
    }
}

// ============================================================================
// Replication Types
// ============================================================================

/// Data to replicate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicationData {
    pub id: String,
    pub key: String,
    pub value: Vec<u8>,
    pub version: u64,
    pub created_at: DateTime<Utc>,
    pub checksum: String,
}

impl ReplicationData {
    pub fn new(key: &str, value: Vec<u8>) -> Self {
        let checksum = sha2::Sha256::digest(&value);
        Self {
            id: Uuid::new_v4().to_string(),
            key: key.to_string(),
            value,
            version: 1,
            created_at: Utc::now(),
            checksum: hex::encode(checksum),
        }
    }
}

/// Replication status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicationStatus {
    pub region_id: RegionId,
    pub status: ReplicationState,
    pub lag_ms: u64,
    pub last_sync: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReplicationState {
    Pending,
    InProgress,
    Completed,
    Failed,
}

// ============================================================================
// Health Check Types
// ============================================================================

/// Health check report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthReport {
    pub timestamp: DateTime<Utc>,
    pub region_id: RegionId,
    pub overall_status: HealthStatus,
    pub checks: Vec<HealthCheckResult>,
    pub metrics: HealthMetrics,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Individual health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub name: String,
    pub status: HealthStatus,
    pub message: Option<String>,
    pub latency_ms: Option<u64>,
    pub timestamp: DateTime<Utc>,
}

/// Health metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HealthMetrics {
    pub cpu_usage_percent: f64,
    pub memory_usage_percent: f64,
    pub disk_usage_percent: f64,
    pub network_latency_ms: u64,
    pub active_connections: u64,
}

// ============================================================================
// Failover Types
// ============================================================================

/// Failover state
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FailoverState {
    Idle,
    Detecting,
    Initiating,
    InProgress,
    Completed,
    Failed,
    RollingBack,
}

/// Failover event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailoverEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub source_region: RegionId,
    pub target_region: RegionId,
    pub state: FailoverState,
    pub reason: String,
    pub details: Option<String>,
}

impl FailoverEvent {
    pub fn new(source: &str, target: &str, reason: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            source_region: source.to_string(),
            target_region: target.to_string(),
            state: FailoverState::Idle,
            reason: reason.to_string(),
            details: None,
        }
    }
}

// ============================================================================
// Load Balancer Types
// ============================================================================

/// Load balancing strategy
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LoadBalancingStrategy {
    #[default]
    LatencyBased,
    RoundRobin,
    Weighted,
    LeastConnections,
    GeoBased,
}

/// Load balancer metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoadBalancerMetrics {
    pub requests_total: u64,
    pub requests_per_region: HashMap<RegionId, u64>,
    pub avg_latency_ms: u64,
    pub active_connections: u64,
}
