//! Cloud Provider Trait
//!
//! The core abstraction that all VPS providers must implement.

use async_trait::async_trait;
use crate::{
    DeploymentConfig, Instance, InstanceType, Region, PricingInfo, 
    HealthStatus, CloudError,
};

/// Cloud provider trait - implemented by all VPS providers
#[async_trait]
pub trait CloudProvider: Send + Sync {
    /// Provider identifier (aws, digitalocean, hetzner, etc.)
    fn name(&self) -> &str;
    
    /// Human-readable display name
    fn display_name(&self) -> &str;
    
    /// Provider logo URL for UI
    fn logo_url(&self) -> &str;
    
    /// List available regions
    async fn list_regions(&self) -> Result<Vec<Region>, CloudError>;
    
    /// List available instance types for a region
    async fn list_instances(&self, region: &str) -> Result<Vec<InstanceType>, CloudError>;
    
    /// Get pricing information
    async fn get_pricing(&self) -> Result<PricingInfo, CloudError>;
    
    /// Provision a new VM instance
    async fn provision(&self, config: DeploymentConfig) -> Result<Instance, CloudError>;
    
    /// Deprovision an instance
    async fn deprovision(&self, id: String) -> Result<(), CloudError>;
    
    /// Health check on an instance
    async fn health_check(&self, id: String) -> Result<HealthStatus, CloudError>;
    
    /// Get instance details
    async fn get_instance(&self, id: String) -> Result<Instance, CloudError>;
    
    /// Validate credentials
    async fn validate_credentials(&self) -> Result<bool, CloudError> {
        // Default implementation: try to list regions
        match self.list_regions().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}
