use std::sync::Arc;
use std::collections::HashMap;
use async_trait::async_trait;
use serde_json::Value;
use tracing::info;

use crate::{
    MemoryProvider, MemoryError, MemoryCapabilities, BackendType, 
    MemoryQuery, MemoryEntry, MemoryRoutingConfig, MemoryRoutingRule, 
    PerformanceThresholds, QueryCapabilities, PerformanceCharacteristics, router::MemoryRouter
};

/// The unified memory plane interface that provides seamless access to all memory implementations
pub struct MemoryPlane {
    router: Arc<MemoryRouter>,
}

impl MemoryPlane {
    /// Create a new memory plane with the given routing configuration
    pub fn new(config: MemoryRoutingConfig) -> Self {
        let router = Arc::new(MemoryRouter::new(config));
        Self { router }
    }

    /// Register a memory provider with the memory plane
    pub async fn register_provider(
        &self,
        backend_type: BackendType,
        provider: Arc<dyn MemoryProvider>
    ) -> Result<(), MemoryError> {
        self.router.register_provider(backend_type, provider).await
    }

    /// Get a specific provider by backend type
    pub async fn get_provider(&self, backend_type: &BackendType) -> Option<Arc<dyn MemoryProvider>> {
        self.router.get_provider(backend_type).await
    }

    /// Get the current routing configuration
    pub fn get_routing_config(&self) -> &MemoryRoutingConfig {
        &self.router.config
    }

    /// Get capabilities of the entire memory plane
    pub fn capabilities(&self) -> MemoryCapabilities {
        // For now, return a default set of capabilities
        // In a real implementation, we'd need to handle this differently
        MemoryCapabilities {
            persistent: true,
            supports_embeddings: false,
            max_size_mb: None,
            ttl_support: false,
            query_capabilities: QueryCapabilities {
                supports_full_text_search: true,
                supports_vector_search: false,
                supports_filters: true,
                max_results: Some(100),
            },
            performance_characteristics: PerformanceCharacteristics {
                avg_read_latency_ms: 10.0,
                avg_write_latency_ms: 10.0,
                throughput_ops_per_sec: 1000,
            },
        }
    }

    /// Get capabilities of the entire memory plane (async version)
    pub async fn capabilities_async(&self) -> MemoryCapabilities {
        self.router.capabilities_async().await
    }

    /// Get statistics for all registered providers
    pub async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError> {
        self.router.stats().await
    }

    /// Check if the memory plane is operational
    pub async fn is_operational(&self) -> bool {
        self.router.ping().await.unwrap_or(false)
    }
}

#[async_trait]
impl MemoryProvider for MemoryPlane {
    async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError> {
        self.router.store(key, value).await
    }

    async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        self.router.store_entry(entry).await
    }

    async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError> {
        self.router.retrieve(key).await
    }

    async fn retrieve_entry(&self, key: &str) -> Result<Option<MemoryEntry>, MemoryError> {
        self.router.retrieve_entry(key).await
    }

    async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError> {
        self.router.query(query).await
    }

    async fn delete(&self, key: &str) -> Result<(), MemoryError> {
        self.router.delete(key).await
    }

    async fn exists(&self, key: &str) -> Result<bool, MemoryError> {
        self.router.exists(key).await
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Custom("MemoryPlane".to_string())
    }

    async fn capabilities_async(&self) -> MemoryCapabilities {
        self.router.capabilities_async().await
    }

    async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError> {
        self.router.stats().await
    }

    async fn ping(&self) -> Result<bool, MemoryError> {
        self.router.ping().await
    }
}

/// Builder for creating a MemoryPlane instance with fluent configuration
pub struct MemoryPlaneBuilder {
    config: MemoryRoutingConfig,
    providers: Vec<(BackendType, Arc<dyn MemoryProvider>)>,
}

impl MemoryPlaneBuilder {
    /// Create a new builder with default configuration
    pub fn new() -> Self {
        Self {
            config: MemoryRoutingConfig {
                default_backend: BackendType::SimpleInMemory,
                routing_rules: vec![],
                fallback_enabled: true,
                fallback_backends: vec![BackendType::SimpleInMemory], // Default fallback
                performance_thresholds: PerformanceThresholds {
                    max_read_latency_ms: 100.0,
                    max_write_latency_ms: 100.0,
                    min_throughput_ops_per_sec: 1000,
                },
            },
            providers: vec![],
        }
    }

    /// Set the default backend type
    pub fn default_backend(mut self, backend_type: BackendType) -> Self {
        self.config.default_backend = backend_type;
        self
    }

    /// Add a routing rule
    pub fn add_routing_rule(mut self, rule: MemoryRoutingRule) -> Self {
        self.config.routing_rules.push(rule);
        self
    }

    /// Enable or disable fallback mechanism
    pub fn fallback_enabled(mut self, enabled: bool) -> Self {
        self.config.fallback_enabled = enabled;
        self
    }

    /// Set fallback backends
    pub fn fallback_backends(mut self, backends: Vec<BackendType>) -> Self {
        self.config.fallback_backends = backends;
        self
    }

    /// Set performance thresholds
    pub fn performance_thresholds(mut self, thresholds: PerformanceThresholds) -> Self {
        self.config.performance_thresholds = thresholds;
        self
    }

    /// Register a provider with this builder
    pub fn with_provider(mut self, backend_type: BackendType, provider: Arc<dyn MemoryProvider>) -> Self {
        self.providers.push((backend_type, provider));
        self
    }

    /// Build the MemoryPlane instance
    pub async fn build(self) -> Result<MemoryPlane, MemoryError> {
        let memory_plane = MemoryPlane::new(self.config);

        // Register all providers
        for (backend_type, provider) in self.providers {
            memory_plane.register_provider(backend_type, provider).await?;
        }

        // Log stats after providers are registered
        let stats = memory_plane.stats().await.unwrap_or_default();
        info!("MemoryPlane built with {} providers", stats.len());

        Ok(memory_plane)
    }
}

impl Default for MemoryPlaneBuilder {
    fn default() -> Self {
        Self::new()
    }
}