//! Wizard API
//!
//! Main wizard API state and configuration.

use allternit_cloud_core::ProviderRegistry;
use allternit_cloud_deploy::DeploymentTracker;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Wizard application state
pub struct WizardAppState {
    pub registry: ProviderRegistry,
    pub deployments: DeploymentTracker,
}

impl WizardAppState {
    pub fn new() -> Self {
        Self {
            registry: ProviderRegistry::new(),
            deployments: DeploymentTracker::new(),
        }
    }
    
    pub async fn register_providers(&self) {
        // Register all available providers
        #[cfg(feature = "aws")]
        {
            if let Ok(provider) = allternit_cloud_aws::create_provider() {
                self.registry.register(provider).await;
            }
        }
        
        #[cfg(feature = "digitalocean")]
        {
            if let Ok(provider) = allternit_cloud_digitalocean::create_provider() {
                self.registry.register(provider).await;
            }
        }
        
        #[cfg(feature = "hetzner")]
        {
            if let Ok(provider) = allternit_cloud_hetzner::create_provider() {
                self.registry.register(provider).await;
            }
        }
        
        #[cfg(feature = "contabo")]
        {
            if let Ok(provider) = allternit_cloud_contabo::create_provider() {
                self.registry.register(provider).await;
            }
        }
        
        #[cfg(feature = "racknerd")]
        {
            if let Ok(provider) = allternit_cloud_racknerd::create_provider() {
                self.registry.register(provider).await;
            }
        }
    }
}

impl Default for WizardAppState {
    fn default() -> Self {
        Self::new()
    }
}
