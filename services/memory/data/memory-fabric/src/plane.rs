//! The unified memory plane that exposes a single [`MemoryProvider`] interface
//! over a collection of registered backends.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;
use tracing::info;

use crate::{
    BackendType, MemoryCapabilities, MemoryEntry, MemoryError, MemoryProvider, MemoryQuery,
    MemoryRoutingConfig, MemoryRoutingRule, PerformanceThresholds, router::MemoryRouter,
};

/// Unified memory plane interface.
pub struct MemoryPlane {
    router: Arc<MemoryRouter>,
}

impl MemoryPlane {
    pub fn new(config: MemoryRoutingConfig) -> Self {
        let router = Arc::new(MemoryRouter::new(config));
        Self { router }
    }

    pub async fn register_provider(
        &self,
        backend_type: BackendType,
        provider: Arc<dyn MemoryProvider>,
    ) -> Result<(), MemoryError> {
        self.router.register_provider(backend_type, provider).await
    }

    pub async fn get_provider(&self, backend_type: &BackendType) -> Option<Arc<dyn MemoryProvider>> {
        self.router.get_provider(backend_type).await
    }

    pub fn routing_config(&self) -> &MemoryRoutingConfig {
        &self.router.config
    }

    pub async fn capabilities_async(&self) -> MemoryCapabilities {
        self.router.capabilities_async().await
    }

    pub async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError> {
        self.router.stats().await
    }

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

/// Fluent builder for [`MemoryPlane`].
pub struct MemoryPlaneBuilder {
    config: MemoryRoutingConfig,
    providers: Vec<(BackendType, Arc<dyn MemoryProvider>)>,
}

impl MemoryPlaneBuilder {
    pub fn new() -> Self {
        Self {
            config: MemoryRoutingConfig::default(),
            providers: vec![],
        }
    }

    pub fn default_backend(mut self, backend_type: BackendType) -> Self {
        self.config.default_backend = backend_type;
        self
    }

    pub fn add_routing_rule(mut self, rule: MemoryRoutingRule) -> Self {
        self.config.routing_rules.push(rule);
        self
    }

    pub fn fallback_enabled(mut self, enabled: bool) -> Self {
        self.config.fallback_enabled = enabled;
        self
    }

    pub fn fallback_backends(mut self, backends: Vec<BackendType>) -> Self {
        self.config.fallback_backends = backends;
        self
    }

    pub fn performance_thresholds(mut self, thresholds: PerformanceThresholds) -> Self {
        self.config.performance_thresholds = thresholds;
        self
    }

    pub fn with_provider(
        mut self,
        backend_type: BackendType,
        provider: Arc<dyn MemoryProvider>,
    ) -> Self {
        self.providers.push((backend_type, provider));
        self
    }

    pub async fn build(self) -> Result<MemoryPlane, MemoryError> {
        let plane = MemoryPlane::new(self.config);
        for (backend_type, provider) in self.providers {
            plane.register_provider(backend_type, provider).await?;
        }
        let stats = plane.stats().await.unwrap_or_default();
        info!("MemoryPlane built with {} providers", stats.len());
        Ok(plane)
    }
}

impl Default for MemoryPlaneBuilder {
    fn default() -> Self {
        Self::new()
    }
}
