//! Simple in-memory implementation of [`MemoryProvider`].

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::RwLock;

use crate::{
    BackendType, MemoryCapabilities, MemoryEntry, MemoryError, MemoryProvider, MemoryQuery,
    PerformanceCharacteristics, QueryCapabilities,
};

/// In-memory memory provider.
pub struct InMemoryProvider {
    store: Arc<RwLock<HashMap<String, MemoryEntry>>>,
}

impl InMemoryProvider {
    pub fn new() -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for InMemoryProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MemoryProvider for InMemoryProvider {
    async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError> {
        let now = now_secs();
        let entry = MemoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            key: key.to_string(),
            value,
            tags: vec![],
            created_at: now,
            updated_at: now,
            expires_at: None,
            tenant_id: None,
            session_id: None,
            embedding: None,
        };
        self.store_entry(entry).await
    }

    async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        let mut store = self.store.write().await;
        store.insert(entry.key.clone(), entry);
        Ok(())
    }

    async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError> {
        let store = self.store.read().await;
        Ok(store.get(key).map(|e| e.value.clone()))
    }

    async fn retrieve_entry(&self, key: &str) -> Result<Option<MemoryEntry>, MemoryError> {
        let store = self.store.read().await;
        Ok(store.get(key).cloned())
    }

    async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError> {
        let store = self.store.read().await;
        let mut results: Vec<MemoryEntry> = store
            .values()
            .filter(|e| {
                query.query.is_empty()
                    || e.key.contains(&query.query)
                    || e.value.to_string().contains(&query.query)
            })
            .cloned()
            .collect();

        if let Some(limit) = query.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    async fn delete(&self, key: &str) -> Result<(), MemoryError> {
        let mut store = self.store.write().await;
        store.remove(key);
        Ok(())
    }

    async fn exists(&self, key: &str) -> Result<bool, MemoryError> {
        let store = self.store.read().await;
        Ok(store.contains_key(key))
    }

    fn backend_type(&self) -> BackendType {
        BackendType::SimpleInMemory
    }

    async fn capabilities_async(&self) -> MemoryCapabilities {
        MemoryCapabilities {
            persistent: false,
            supports_embeddings: false,
            max_size_mb: None,
            ttl_support: false,
            query_capabilities: QueryCapabilities {
                supports_full_text_search: true,
                supports_vector_search: false,
                supports_filters: false,
                max_results: None,
            },
            performance_characteristics: PerformanceCharacteristics {
                avg_read_latency_ms: 0.05,
                avg_write_latency_ms: 0.05,
                throughput_ops_per_sec: 100_000,
            },
        }
    }

    async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError> {
        let store = self.store.read().await;
        let mut stats = HashMap::new();
        stats.insert(
            "entry_count".to_string(),
            Value::Number(serde_json::Number::from(store.len())),
        );
        stats.insert(
            "backend_type".to_string(),
            Value::String("simple_in_memory".to_string()),
        );
        Ok(stats)
    }

    async fn ping(&self) -> Result<bool, MemoryError> {
        Ok(true)
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
    async fn test_in_memory_provider() {
        let provider = InMemoryProvider::new();
        provider
            .store("key", serde_json::json!("value"))
            .await
            .unwrap();
        let value = provider.retrieve("key").await.unwrap();
        assert_eq!(value, Some(serde_json::json!("value")));
    }
}
