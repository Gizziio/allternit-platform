use std::sync::Arc;
use std::collections::HashMap;
use async_trait::async_trait;
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use serde_json::Value;

use crate::{
    MemoryProvider, MemoryError, MemoryCapabilities, BackendType,
    MemoryQuery, MemoryEntry, MemoryRoutingConfig, MemoryRoutingRule,
    RoutingCondition, PerformanceThresholds, QueryCapabilities, PerformanceCharacteristics
};

/// Memory router that intelligently routes requests between different memory providers
pub struct MemoryRouter {
    pub providers: Arc<RwLock<HashMap<BackendType, Arc<dyn MemoryProvider>>>>,
    pub config: MemoryRoutingConfig,
    routing_cache: Arc<RwLock<HashMap<String, BackendType>>>,
    cached_capabilities: Arc<RwLock<MemoryCapabilities>>,
}

impl MemoryRouter {
    /// Create a new memory router with the given configuration and providers
    pub fn new(config: MemoryRoutingConfig) -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            config,
            routing_cache: Arc::new(RwLock::new(HashMap::new())),
            cached_capabilities: Arc::new(RwLock::new(MemoryCapabilities {
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
            })),
        }
    }

    /// Register a memory provider with the router
    pub async fn register_provider(
        &self,
        backend_type: BackendType,
        provider: Arc<dyn MemoryProvider>
    ) -> Result<(), MemoryError> {
        let mut providers = self.providers.write().await;
        providers.insert(backend_type.clone(), provider);
        drop(providers); // Release the lock early
        info!("Registered memory provider: {:?}", backend_type);
        Ok(())
    }

    /// Get a provider by backend type
    pub async fn get_provider(&self, backend_type: &BackendType) -> Option<Arc<dyn MemoryProvider>> {
        let providers = self.providers.read().await;
        providers.get(backend_type).cloned()
    }

    /// Determine the best backend for a given operation based on routing rules
    pub async fn determine_backend(&self, query: &MemoryQuery) -> Result<BackendType, MemoryError> {
        // Check routing rules in priority order
        let mut applicable_rules: Vec<&MemoryRoutingRule> = Vec::new();
        for rule in &self.config.routing_rules {
            if self.rule_matches(rule, query).await {
                applicable_rules.push(rule);
            }
        }

        // Sort by priority (higher priority first)
        applicable_rules.sort_by(|a, b| b.priority.cmp(&a.priority));

        if let Some(rule) = applicable_rules.first() {
            return Ok(rule.target_backend.clone());
        }

        // If no specific rule matches, use default
        Ok(self.config.default_backend.clone())
    }

    /// Check if a routing rule matches the given query
    async fn rule_matches(&self, rule: &MemoryRoutingRule, query: &MemoryQuery) -> bool {
        match &rule.condition {
            RoutingCondition::SizeThreshold { max_size_bytes } => {
                // This would need to be calculated based on the query or value
                // For now, we'll return true as a placeholder
                true
            },
            RoutingCondition::PersistenceRequired { required } => {
                // Check if any provider meets the persistence requirement
                let providers = self.providers.read().await;
                providers.values().any(|provider| {
                    provider.capabilities().persistent == *required
                })
            },
            RoutingCondition::PerformanceRequirement { max_latency_ms } => {
                // Check if any provider meets the performance requirement
                let providers = self.providers.read().await;
                providers.values().any(|provider| {
                    let caps = provider.capabilities();
                    caps.performance_characteristics.avg_read_latency_ms <= *max_latency_ms ||
                    caps.performance_characteristics.avg_write_latency_ms <= *max_latency_ms
                })
            },
            RoutingCondition::TagMatch { tag } => {
                query.tags.contains(tag)
            },
            RoutingCondition::TenantSpecific { tenant_id } => {
                query.tenant_id.as_ref().map_or(false, |id| id == tenant_id)
            },
            RoutingCondition::SessionSpecific { session_id } => {
                query.session_id.as_ref().map_or(false, |id| id == session_id)
            },
        }
    }

    /// Get the best performing provider based on performance thresholds
    async fn get_best_provider(&self, thresholds: &PerformanceThresholds) -> Option<BackendType> {
        let providers = self.providers.read().await;
        let mut best_provider: Option<BackendType> = None;
        let mut best_throughput = 0;

        for (backend_type, provider) in providers.iter() {
            let caps = provider.capabilities();
            if caps.performance_characteristics.avg_read_latency_ms <= thresholds.max_read_latency_ms &&
               caps.performance_characteristics.avg_write_latency_ms <= thresholds.max_write_latency_ms &&
               caps.performance_characteristics.throughput_ops_per_sec >= thresholds.min_throughput_ops_per_sec {

                if caps.performance_characteristics.throughput_ops_per_sec > best_throughput {
                    best_throughput = caps.performance_characteristics.throughput_ops_per_sec;
                    best_provider = Some(backend_type.clone());
                }
            }
        }

        best_provider
    }

    /// Attempt to get a provider with fallback logic
    async fn get_provider_with_fallback(&self, preferred: &BackendType) -> Result<Arc<dyn MemoryProvider>, MemoryError> {
        // Try the preferred provider first
        {
            let providers = self.providers.read().await;
            if let Some(provider) = providers.get(preferred) {
                if provider.ping().await.unwrap_or(false) {
                    return Ok(provider.clone());
                }
            }
        }

        // If preferred provider is unavailable and fallback is enabled, try fallback providers
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
        Err(MemoryError::Connection("No available memory provider".to_string()))
    }
}

#[async_trait]
impl MemoryProvider for MemoryRouter {
    fn capabilities(&self) -> MemoryCapabilities {
        // For a sync method, we'll return a default set of capabilities
        // In a real implementation, capabilities would be cached or computed differently
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

    async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError> {
        // For store operations, we might want to use a specific routing strategy
        // For now, let's create a simple query to determine the backend
        let query = MemoryQuery {
            query: String::new(),
            filters: HashMap::new(),
            limit: None,
            offset: None,
            sort_by: None,
            ascending: None,
            min_similarity: None,
            tags: vec![],
            tenant_id: None,
            session_id: None,
        };

        let backend = self.determine_backend(&query).await?;
        let provider = self.get_provider_with_fallback(&backend).await?;

        provider.store(key, value).await
    }

    async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        // Create a query based on the entry properties to determine backend
        let query = MemoryQuery {
            query: String::new(),
            filters: HashMap::new(),
            limit: None,
            offset: None,
            sort_by: None,
            ascending: None,
            min_similarity: None,
            tags: entry.tags.clone(),
            tenant_id: entry.tenant_id.clone(),
            session_id: entry.session_id.clone(),
        };

        let backend = self.determine_backend(&query).await?;
        let provider = self.get_provider_with_fallback(&backend).await?;

        provider.store_entry(entry).await
    }

    async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError> {
        // For retrieve, we might need to check multiple providers or have a strategy
        // For now, let's try the default provider
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        
        provider.retrieve(key).await
    }

    async fn retrieve_entry(&self, key: &str) -> Result<Option<MemoryEntry>, MemoryError> {
        // Similar to retrieve, try the default provider
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        
        provider.retrieve_entry(key).await
    }

    async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError> {
        let backend = self.determine_backend(query).await?;
        let provider = self.get_provider_with_fallback(&backend).await?;

        provider.query(query).await
    }

    async fn delete(&self, key: &str) -> Result<(), MemoryError> {
        // Try to delete from the default provider
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        
        provider.delete(key).await
    }

    async fn exists(&self, key: &str) -> Result<bool, MemoryError> {
        // Check existence in the default provider
        let provider = self.get_provider_with_fallback(&self.config.default_backend).await?;
        
        provider.exists(key).await
    }

    fn backend_type(&self) -> BackendType {
        BackendType::Custom("MemoryRouter".to_string())
    }

    async fn capabilities_async(&self) -> MemoryCapabilities {
        // Compute capabilities dynamically from current providers
        let providers = self.providers.read().await;

        let mut persistent = false;
        let mut supports_embeddings = false;
        let mut max_size_mb = None;
        let mut ttl_support = false;

        let mut avg_read_latency_ms = 0.0;
        let mut avg_write_latency_ms = 0.0;
        let mut throughput_ops_per_sec = 0;
        let mut provider_count = 0;

        for (_, provider) in providers.iter() {
            let caps = provider.capabilities();
            persistent |= caps.persistent;
            supports_embeddings |= caps.supports_embeddings;
            ttl_support |= caps.ttl_support;

            avg_read_latency_ms += caps.performance_characteristics.avg_read_latency_ms;
            avg_write_latency_ms += caps.performance_characteristics.avg_write_latency_ms;
            throughput_ops_per_sec += caps.performance_characteristics.throughput_ops_per_sec;
            provider_count += 1;
        }

        if provider_count > 0 {
            avg_read_latency_ms /= provider_count as f64;
            avg_write_latency_ms /= provider_count as f64;
            throughput_ops_per_sec /= provider_count;
        }

        MemoryCapabilities {
            persistent,
            supports_embeddings,
            max_size_mb,
            ttl_support,
            query_capabilities: QueryCapabilities {
                supports_full_text_search: providers.values().any(|p| p.capabilities().query_capabilities.supports_full_text_search),
                supports_vector_search: providers.values().any(|p| p.capabilities().query_capabilities.supports_vector_search),
                supports_filters: providers.values().any(|p| p.capabilities().query_capabilities.supports_filters),
                max_results: providers.values().filter_map(|p| p.capabilities().query_capabilities.max_results).max(),
            },
            performance_characteristics: PerformanceCharacteristics {
                avg_read_latency_ms,
                avg_write_latency_ms,
                throughput_ops_per_sec,
            },
        }
    }

    async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError> {
        let mut all_stats = HashMap::new();
        let providers = self.providers.read().await;

        for (backend_type, provider) in providers.iter() {
            match provider.stats().await {
                Ok(provider_stats) => {
                    all_stats.insert(
                        format!("{:?}", backend_type),
                        serde_json::to_value(provider_stats).unwrap_or(Value::Null)
                    );
                }
                Err(e) => {
                    all_stats.insert(
                        format!("{:?}_error", backend_type),
                        Value::String(e.to_string())
                    );
                }
            }
        }

        Ok(all_stats)
    }

    async fn ping(&self) -> Result<bool, MemoryError> {
        // Check if at least one provider is available
        let providers = self.providers.read().await;
        for (_, provider) in providers.iter() {
            if provider.ping().await.unwrap_or(false) {
                return Ok(true);
            }
        }
        Ok(false)
    }
}