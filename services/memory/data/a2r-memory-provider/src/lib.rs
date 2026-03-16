use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

/// Capabilities that a memory provider can offer
#[derive(Debug, Clone, PartialEq)]
pub struct MemoryCapabilities {
    pub persistent: bool,
    pub supports_embeddings: bool,
    pub max_size_mb: Option<u32>,
    pub ttl_support: bool,
    pub query_capabilities: QueryCapabilities,
    pub performance_characteristics: PerformanceCharacteristics,
}

/// Query capabilities of a memory provider
#[derive(Debug, Clone, PartialEq)]
pub struct QueryCapabilities {
    pub supports_full_text_search: bool,
    pub supports_vector_search: bool,
    pub supports_filters: bool,
    pub max_results: Option<usize>,
}

/// Performance characteristics of a memory provider
#[derive(Debug, Clone, PartialEq)]
pub struct PerformanceCharacteristics {
    pub avg_read_latency_ms: f64,
    pub avg_write_latency_ms: f64,
    pub throughput_ops_per_sec: u32,
}

/// Type of backend implementation
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BackendType {
    SimpleInMemory,
    Redis,
    Qdrant,
    Sqlite,
    AdvancedFabric,
    Custom(String),
}

/// Memory query structure for standardized querying across implementations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryQuery {
    pub query: String,
    pub filters: HashMap<String, Value>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub sort_by: Option<String>,
    pub ascending: Option<bool>,
    pub min_similarity: Option<f32>,
    pub tags: Vec<String>,
    pub tenant_id: Option<String>,
    pub session_id: Option<String>,
}

/// Standardized memory entry structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub key: String,
    pub value: Value,
    pub tags: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub expires_at: Option<u64>,
    pub tenant_id: Option<String>,
    pub session_id: Option<String>,
    pub embedding: Option<Vec<f32>>,
}

/// Common error types for memory operations
#[derive(Error, Debug)]
pub enum MemoryError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Connection error: {0}")]
    Connection(String),
    
    #[error("Timeout error: {0}")]
    Timeout(String),
    
    #[error("Capacity exceeded: {0}")]
    CapacityExceeded(String),
    
    #[error("Backend error: {0}")]
    Backend(String),
}

/// Common interface for all memory providers
#[async_trait]
pub trait MemoryProvider: Send + Sync {
    /// Store a value in memory
    async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError>;
    
    /// Store a complete memory entry with metadata
    async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError>;
    
    /// Retrieve a value by key
    async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError>;
    
    /// Retrieve a complete memory entry
    async fn retrieve_entry(&self, key: &str) -> Result<Option<MemoryEntry>, MemoryError>;
    
    /// Query memory entries based on criteria
    async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError>;
    
    /// Delete a memory entry by key
    async fn delete(&self, key: &str) -> Result<(), MemoryError>;
    
    /// Check if a key exists
    async fn exists(&self, key: &str) -> Result<bool, MemoryError>;
    
    /// Get the type of backend implementation
    fn backend_type(&self) -> BackendType;
    
    /// Get the capabilities of this memory provider (async version for dynamic providers)
    async fn capabilities_async(&self) -> MemoryCapabilities;
    
    /// Get the capabilities of this memory provider (sync version for static providers)
    fn capabilities(&self) -> MemoryCapabilities {
        // Default implementation that returns basic capabilities
        MemoryCapabilities {
            persistent: false,
            supports_embeddings: false,
            max_size_mb: None,
            ttl_support: false,
            query_capabilities: QueryCapabilities {
                supports_full_text_search: false,
                supports_vector_search: false,
                supports_filters: false,
                max_results: None,
            },
            performance_characteristics: PerformanceCharacteristics {
                avg_read_latency_ms: 0.0,
                avg_write_latency_ms: 0.0,
                throughput_ops_per_sec: 0,
            },
        }
    }
    
    /// Get statistics about memory usage
    async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError>;
    
    /// Ping the memory provider to check connectivity
    async fn ping(&self) -> Result<bool, MemoryError>;
}

/// Configuration for memory routing decisions
#[derive(Debug, Clone)]
pub struct MemoryRoutingConfig {
    pub default_backend: BackendType,
    pub routing_rules: Vec<MemoryRoutingRule>,
    pub fallback_enabled: bool,
    pub fallback_backends: Vec<BackendType>,
    pub performance_thresholds: PerformanceThresholds,
}

/// Rule for routing memory operations
#[derive(Debug, Clone)]
pub struct MemoryRoutingRule {
    pub condition: RoutingCondition,
    pub target_backend: BackendType,
    pub priority: u8,
}

/// Condition for routing decisions
#[derive(Debug, Clone)]
pub enum RoutingCondition {
    SizeThreshold { max_size_bytes: usize },
    PersistenceRequired { required: bool },
    PerformanceRequirement { max_latency_ms: f64 },
    TagMatch { tag: String },
    TenantSpecific { tenant_id: String },
    SessionSpecific { session_id: String },
    // Custom variant is not included in the enum since it can't be cloned
    // Instead, use predefined conditions or implement a different approach
}

/// Performance thresholds for routing decisions
#[derive(Debug, Clone)]
pub struct PerformanceThresholds {
    pub max_read_latency_ms: f64,
    pub max_write_latency_ms: f64,
    pub min_throughput_ops_per_sec: u32,
}

pub mod router;
pub mod plane;