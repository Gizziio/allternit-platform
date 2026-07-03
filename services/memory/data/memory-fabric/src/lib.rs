//! # Allternit Memory Fabric
//!
//! A unified memory/data fabric for the Allternit platform.
//!
//! The fabric provides:
//!
//! - [`MemoryProvider`] — a common async trait for memory backends.
//! - [`MemoryFabric`] — a unified entry point that owns a [`MemoryPlane`]
//!   (router + registry) and a [`HistoryLedger`] for auditability.
//! - [`HistoryLedger`] — an append-only JSONL ledger with chained SHA-256 hashes.
//! - [`InMemoryProvider`] — a simple in-memory implementation of [`MemoryProvider`].
//!
//! ## Relationship to the TypeScript Memory Agent
//!
//! The TypeScript agent in `services/memory/agent/` remains the primary
//! long-term memory implementation (SQLite + vector search + LLM consolidation).
//! Rust services consume it through the HTTP adapter provided by the top-level
//! `services/memory` crate, which implements [`MemoryProvider`] using this fabric.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

pub mod ledger;
pub mod plane;
pub mod providers;
pub mod router;

pub use ledger::{HistoryLedger, LedgerEntry, HistoryError};
pub use plane::{MemoryPlane, MemoryPlaneBuilder};
pub use providers::in_memory::InMemoryProvider;
pub use router::{MemoryRouter, MemoryRoutingConfig, MemoryRoutingRule, RoutingCondition};

/// Capabilities that a memory provider can offer.
#[derive(Debug, Clone, PartialEq)]
pub struct MemoryCapabilities {
    pub persistent: bool,
    pub supports_embeddings: bool,
    pub max_size_mb: Option<u32>,
    pub ttl_support: bool,
    pub query_capabilities: QueryCapabilities,
    pub performance_characteristics: PerformanceCharacteristics,
}

/// Query capabilities of a memory provider.
#[derive(Debug, Clone, PartialEq)]
pub struct QueryCapabilities {
    pub supports_full_text_search: bool,
    pub supports_vector_search: bool,
    pub supports_filters: bool,
    pub max_results: Option<usize>,
}

/// Performance characteristics of a memory provider.
#[derive(Debug, Clone, PartialEq)]
pub struct PerformanceCharacteristics {
    pub avg_read_latency_ms: f64,
    pub avg_write_latency_ms: f64,
    pub throughput_ops_per_sec: u32,
}

/// Type of backend implementation.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BackendType {
    SimpleInMemory,
    Redis,
    Qdrant,
    Sqlite,
    AdvancedFabric,
    MemoryAgentHttp,
    Custom(String),
}

/// Standardized memory query structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryQuery {
    pub query: String,
    #[serde(default)]
    pub filters: HashMap<String, Value>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub offset: Option<usize>,
    #[serde(default)]
    pub sort_by: Option<String>,
    #[serde(default)]
    pub ascending: Option<bool>,
    #[serde(default)]
    pub min_similarity: Option<f32>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub tenant_id: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
}

impl Default for MemoryQuery {
    fn default() -> Self {
        Self {
            query: String::new(),
            filters: HashMap::new(),
            limit: None,
            offset: None,
            sort_by: None,
            ascending: None,
            min_similarity: None,
            tags: Vec::new(),
            tenant_id: None,
            session_id: None,
        }
    }
}

/// Standardized memory entry structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub key: String,
    pub value: Value,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(default)]
    pub expires_at: Option<u64>,
    #[serde(default)]
    pub tenant_id: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub embedding: Option<Vec<f32>>,
}

/// Common error types for memory operations.
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

    #[error("History error: {0}")]
    History(#[from] HistoryError),
}

/// Performance thresholds for routing decisions.
#[derive(Debug, Clone)]
pub struct PerformanceThresholds {
    pub max_read_latency_ms: f64,
    pub max_write_latency_ms: f64,
    pub min_throughput_ops_per_sec: u32,
}

/// Common interface for all memory providers.
#[async_trait]
pub trait MemoryProvider: Send + Sync {
    /// Store a value in memory.
    async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError>;

    /// Store a complete memory entry with metadata.
    async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError>;

    /// Retrieve a value by key.
    async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError>;

    /// Retrieve a complete memory entry.
    async fn retrieve_entry(&self, key: &str) -> Result<Option<MemoryEntry>, MemoryError>;

    /// Query memory entries based on criteria.
    async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError>;

    /// Delete a memory entry by key.
    async fn delete(&self, key: &str) -> Result<(), MemoryError>;

    /// Check if a key exists.
    async fn exists(&self, key: &str) -> Result<bool, MemoryError>;

    /// Get the type of backend implementation.
    fn backend_type(&self) -> BackendType;

    /// Get the capabilities of this provider (synchronous baseline).
    ///
    /// Providers with dynamic capabilities may also implement
    /// [`capabilities_async`](MemoryProvider::capabilities_async).
    fn capabilities(&self) -> MemoryCapabilities {
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

    /// Get the capabilities of this provider (async version for dynamic providers).
    async fn capabilities_async(&self) -> MemoryCapabilities {
        self.capabilities()
    }

    /// Get statistics about memory usage.
    async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError>;

    /// Ping the memory provider to check connectivity.
    async fn ping(&self) -> Result<bool, MemoryError>;
}

/// Unified memory/data fabric entry point.
///
/// Combines a [`MemoryPlane`] for provider routing and a [`HistoryLedger`]
/// for auditability. This is the canonical interface for Rust services.
pub struct MemoryFabric {
    plane: MemoryPlane,
    ledger: Arc<std::sync::Mutex<HistoryLedger>>,
}

impl MemoryFabric {
    /// Create a new fabric backed by an in-memory provider and a temporary ledger.
    pub async fn new_in_memory() -> Result<Self, MemoryError> {
        let plane = MemoryPlaneBuilder::new()
            .with_provider(BackendType::SimpleInMemory, Arc::new(InMemoryProvider::new()))
            .build()
            .await?;

        let ledger_path = format!("/tmp/allternit_fabric_{}.jsonl", uuid::Uuid::new_v4());
        let ledger = Arc::new(std::sync::Mutex::new(HistoryLedger::new(ledger_path)?));

        Ok(Self { plane, ledger })
    }

    /// Create a fabric with an explicit plane and ledger path.
    pub fn new_with_plane<P: AsRef<Path>>(
        plane: MemoryPlane,
        ledger_path: P,
    ) -> Result<Self, MemoryError> {
        let ledger = Arc::new(std::sync::Mutex::new(HistoryLedger::new(ledger_path)?));
        Ok(Self { plane, ledger })
    }

    /// Store a value, auditing the operation to the ledger.
    pub async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError> {
        self.plane.store(key, value.clone()).await?;
        let event = serde_json::json!({
            "op": "store",
            "key": key,
            "value": value,
            "timestamp": now_secs(),
        });
        self.append_to_ledger(event)?;
        Ok(())
    }

    /// Store a complete memory entry, auditing the operation.
    pub async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        let key = entry.key.clone();
        let value = entry.value.clone();
        self.plane.store_entry(entry).await?;
        let event = serde_json::json!({
            "op": "store_entry",
            "key": key,
            "value": value,
            "timestamp": now_secs(),
        });
        self.append_to_ledger(event)?;
        Ok(())
    }

    /// Retrieve a value by key.
    pub async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError> {
        self.plane.retrieve(key).await
    }

    /// Query memory entries.
    pub async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError> {
        self.plane.query(query).await
    }

    /// Delete a memory entry, auditing the operation.
    pub async fn delete(&self, key: &str) -> Result<(), MemoryError> {
        self.plane.delete(key).await?;
        let event = serde_json::json!({
            "op": "delete",
            "key": key,
            "timestamp": now_secs(),
        });
        self.append_to_ledger(event)?;
        Ok(())
    }

    /// Verify the integrity of the audit ledger.
    pub fn verify_ledger(&self) -> Result<bool, MemoryError> {
        let ledger = self.ledger.lock().unwrap();
        Ok(ledger.verify_integrity()?)
    }

    /// Access the underlying memory plane.
    pub fn plane(&self) -> &MemoryPlane {
        &self.plane
    }

    fn append_to_ledger(&self, content: Value) -> Result<(), MemoryError> {
        let mut ledger = self.ledger.lock().unwrap();
        ledger.append(content)?;
        Ok(())
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fabric_store_and_retrieve() {
        let fabric = MemoryFabric::new_in_memory().await.unwrap();
        fabric
            .store("hello", serde_json::json!("world"))
            .await
            .unwrap();
        let value = fabric.retrieve("hello").await.unwrap();
        assert_eq!(value, Some(serde_json::json!("world")));
    }

    #[tokio::test]
    async fn test_fabric_ledger_integrity() {
        let fabric = MemoryFabric::new_in_memory().await.unwrap();
        fabric
            .store("a", serde_json::json!(1))
            .await
            .unwrap();
        fabric
            .store("b", serde_json::json!(2))
            .await
            .unwrap();
        assert!(fabric.verify_ledger().unwrap());
    }
}
