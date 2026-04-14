//! Wizard State
//!
//! Application state for the deployment wizard.

use a2r_cloud_core::ProviderRegistry;
use a2r_cloud_deploy::DeploymentTracker;

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
}

impl Default for WizardAppState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_wizard_state_creation() {
        let state = WizardAppState::new();
        assert!(state.registry.list().await.is_empty());
    }
}
