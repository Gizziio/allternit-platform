//! Provider Registry
//!
//! Registry for cloud providers.

use crate::CloudProvider;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Provider registry
pub struct ProviderRegistry {
    providers: Arc<RwLock<HashMap<String, Arc<dyn CloudProvider>>>>,
}

impl ProviderRegistry {
    /// Create new registry
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Register a provider
    pub async fn register(&self, provider: Arc<dyn CloudProvider>) {
        let name = provider.name().to_string();
        let mut providers = self.providers.write().await;
        providers.insert(name, provider);
    }
    
    /// Get provider by name
    pub async fn get(&self, name: &str) -> Option<Arc<dyn CloudProvider>> {
        let providers = self.providers.read().await;
        providers.get(name).cloned()
    }
    
    /// List all registered providers
    pub async fn list(&self) -> Vec<String> {
        let providers = self.providers.read().await;
        providers.keys().cloned().collect()
    }
    
    /// Check if provider is registered
    pub async fn has(&self, name: &str) -> bool {
        let providers = self.providers.read().await;
        providers.contains_key(name)
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Global registry instance
static REGISTRY: once_cell::sync::Lazy<ProviderRegistry> = 
    once_cell::sync::Lazy::new(ProviderRegistry::new);

/// Get global registry
pub fn global_registry() -> &'static ProviderRegistry {
    &REGISTRY
}
