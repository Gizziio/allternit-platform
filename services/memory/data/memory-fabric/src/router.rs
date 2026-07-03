//! Memory router that intelligently routes requests between registered providers.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::{
    BackendType, MemoryCapabilities, MemoryEntry, MemoryError, MemoryProvider, MemoryQuery,
    PerformanceCharacteristics, PerformanceThresholds, QueryCapabilities,
};

/// Condition used to select a target backend.
#[derive(Debug, Clone)]
pub enum RoutingCondition {
    SizeThreshold { max_size_bytes: usize },
    PersistenceRequired { required: bool },
    PerformanceRequirement { max_latency_ms: f64 },
    TagMatch { tag: String },
    TenantSpecific { tenant_id: String },
    SessionSpecific { session_id: String },
}

/// A single routing rule.
#[derive(Debug, Clone)]
pub struct MemoryRoutingRule {
    pub condition: RoutingCondition,
    pub target_backend: BackendType,
    pub priority: u8,
}

/// Configuration for the router.
#[derive(Debug, Clone)]
pub struct MemoryRoutingConfig {
    pub default_backend: BackendType,
    pub routing_rules: Vec<MemoryRoutingRule>,
    pub fallback_enabled: bool,
    pub fallback_backends: Vec<BackendType>,
    pub performance_thresholds: PerformanceThresholds,
}

impl Default for MemoryRoutingConfig {
    fn default() -> Self {
        Self {
            default_backend: BackendType::SimpleInMemory,
            routing_rules: vec![],
            fallback_enabled: true,
            fallback_backends: vec![BackendType::SimpleInMemory],
            performance_thresholds: PerformanceThresholds {
                max_read_latency_ms: 100.0,
                max_write_latency_ms: 100.0,
                min_throughput_ops_per_sec: 1000,
            },
        }
    }
}

/// Router that selects providers according to configured rules and fallbacks.
pub struct MemoryRouter {
    pub providers: Arc<RwLock<HashMap<BackendType, Arc<dyn MemoryProvider>>>>,
    pub config: MemoryRoutingConfig,
}

impl MemoryRouter {
    pub fn new(config: MemoryRoutingConfig) -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Register a provider for a backend type.
    pub async fn register_provider(
        &self,
        backend_type: BackendType,
        provider: Arc<dyn MemoryProvider>,
    ) -> Result<(), MemoryError> {
        let mut providers = self.providers.write().await;
        providers.insert(backend_type.clone(), provider);
        info!("Registered memory provider: {:?}", backend_type);
        Ok(())
    }

    /// Get a registered provider by type.
    pub async fn get_provider(&self, backend_type: &BackendType) -> Option<Arc<dyn MemoryProvider>> {
        let providers = self.providers.read().await;
        providers.get(backend_type).cloned()
    }

    /// Determine the best backend for a query.
    pub async fn determine_backend(&self, query: &MemoryQuery) -> Result<BackendType, MemoryError> {
        let mut applicable: Vec<&MemoryRoutingRule> = Vec::new();
        for rule in &self.config.routing_rules {
            if self.rule_matches(rule, query).await {
                applicable.push(rule);
            }
        }
        applicable.sort_by(|a, b| b.priority.cmp(&a.priority));

        if let Some(rule) = applicable.first() {
            return Ok(rule.target_backend.clone());
        }

        Ok(self.config.default_backend.clone())
    }

    async fn rule_matches(&self, rule: &MemoryRoutingRule, query: &MemoryQuery) -> bool {
        match &rule.condition {
            RoutingCondition::TagMatch { tag } => query.tags.contains(tag),
            RoutingCondition::TenantSpecific { tenant_id } => {
                query.tenant_id.as_ref().map_or(false, |id| id == tenant_id)
            }
            RoutingCondition::SessionSpecific { session_id } => {
                query.session_id.as_ref().map_or(false, |id| id == session_id)
            }
            RoutingCondition::PersistenceRequired { required } => {
                let providers = self.providers.read().await;
                providers
                    .values()
                    .any(|p| p.capabilities().persistent == *required)
            }
            RoutingCondition::PerformanceRequirement { max_latency_ms } => {
                let providers = self.providers.read().await;
                providers.values().any(|p| {
                    let caps = p.capabilities();
                    caps.performance_characteristics.avg_read_latency_ms <= *max_latency_ms
                        || caps.performance_characteristics.avg_write_latency_ms <= *max_latency_ms
                })
            }
            RoutingCondition::SizeThreshold { .. } => true,
        }
    }

    async fn get_provider_with_fallback(
        &self,
        preferred: &BackendType,
    ) -> Result<Arc<dyn MemoryProvider>, MemoryError> {
        {
            let providers = self.providers.read().await;
            if let Some(provider) = providers.get(preferred) {
                if provider.ping().await.unwrap_or(false) {
                    return Ok(provider.clone());
                }
            }
        }

        if self.config.fallback_enabled {
            for fallback_backend in &self.config.fallback_backends {
                let providers = self.providers.read().await;
                if let Some(provider) = providers.get(fallback_backend) {
                    if provider.ping().await.unwrap_or(false) {
                        warn!("Using fallback provider: {:?}", fallback_backend);
                        return Ok(provider.clone());
                    }
                }
            }
        }

        error!("No available memory provider found");
        Err(MemoryError::Connection(
            "No available memory provider".to_string(),
        ))
    }
}

#[async_trait]
impl MemoryProvider for MemoryRouter {
    fn backend_type(&self) -> BackendType {
        BackendType::Custom("MemoryRouter".to_string())
    }

    async fn capabilities_async(&self) -> MemoryCapabilities {
        let providers = self.providers.read().await;

        let mut persistent = false;
        let mut supports_embeddings = false;
        let mut ttl_support = false;
        let mut avg_read_latency_ms = 0.0;
        let mut avg_write_latency_ms = 0.0;
        let mut throughput_ops_per_sec = 0;
        let mut count = 0;

        for provider in providers.values() {
            let caps = provider.capabilities();
            persistent |= caps.persistent;
            supports_embeddings |= caps.supports_embeddings;
            ttl_support |= caps.ttl_support;
            avg_read_latency_ms += caps.performance_characteristics.avg_read_latency_ms;
            avg_write_latency_ms += caps.performance_characteristics.avg_write_latency_ms;
            throughput_ops_per_sec += caps.performance_characteristics.throughput_ops_per_sec;
            count += 1;
        }

        if count > 0 {
            avg_read_latency_ms /= count as f64;
            avg_write_latency_ms /= count as f64;
            throughput_ops_per_sec /= count;
        }

        MemoryCapabilities {
            persistent,
            supports_embeddings,
            max_size_mb: None,
            ttl_support,
            query_capabilities: QueryCapabilities {
                supports_full_text_search: providers
                    .values()
                    .any(|p| p.capabilities().query_capabilities.supports_full_text_search),
                supports_vector_search: providers
                    .values()
                    .any(|p| p.capabilities().query_capabilities.supports_vector_search),
                supports_filters: providers
                    .values()
                    .any(|p| p.capabilities().query_capabilities.supports_filters),
                max_results: providers
                    .values()
                    .filter_map(|p| p.capabilities().query_capabilities.max_results)
                    .max(),
            },
            performance_characteristics: PerformanceCharacteristics {
                avg_read_latency_ms,
                avg_write_latency_ms,
                throughput_ops_per_sec,
            },
        }
    }

    async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError> {
        let backend = self.determine_backend(&MemoryQuery::default()).await?;
        let provider = self.get_provider_with_fallback(&backend).await?;
        provider.store(key, value).await
    }

    async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        let query = MemoryQuery {
            tags: entry.tags.clone(),
            tenant_id: entry.tenant_id.clone(),
            session_id: entry.session_id.clone(),
            ..Default::default()
        };
        let backend = self.determine_backend(&query).await?;
        let provider = self.get_provider_with_fallback(&backend).await?;
        provider.store_entry(entry).await
    }

    async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError> {
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        provider.retrieve(key).await
    }

    async fn retrieve_entry(&self, key: &str) -> Result<Option<MemoryEntry>, MemoryError> {
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        provider.retrieve_entry(key).await
    }

    async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError> {
        let backend = self.determine_backend(query).await?;
        let provider = self.get_provider_with_fallback(&backend).await?;
        provider.query(query).await
    }

    async fn delete(&self, key: &str) -> Result<(), MemoryError> {
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        provider.delete(key).await
    }

    async fn exists(&self, key: &str) -> Result<bool, MemoryError> {
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        provider.exists(key).await
    }

    async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError> {
        let mut all_stats = HashMap::new();
        let providers = self.providers.read().await;

        for (backend_type, provider) in providers.iter() {
            match provider.stats().await {
                Ok(provider_stats) => {
                    all_stats.insert(
                        format!("{:?}", backend_type),
                        serde_json::to_value(provider_stats).unwrap_or(Value::Null),
                    );
                }
                Err(e) => {
                    all_stats.insert(
                        format!("{:?}_error", backend_type),
                        Value::String(e.to_string()),
                    );
                }
            }
        }

        Ok(all_stats)
    }

    async fn ping(&self) -> Result<bool, MemoryError> {
        let providers = self.providers.read().await;
        for provider in providers.values() {
            if provider.ping().await.unwrap_or(false) {
                return Ok(true);
            }
        }
        Ok(false)
    }
}
