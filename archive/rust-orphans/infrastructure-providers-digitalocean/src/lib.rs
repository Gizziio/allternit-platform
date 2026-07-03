//! Allternit Cloud DigitalOcean Provider
//!
//! DigitalOcean Droplet provider implementation for Allternit cloud deployment.

use allternit_cloud_core::{
    CloudProvider, CloudError, DeploymentConfig, Instance, InstanceType, 
    Region, PricingInfo, HealthStatus, InstanceStatus,
};
use async_trait::async_trait;
use chrono::Utc;
use std::sync::Arc;

pub mod droplets;
pub mod pricing;
pub mod regions;

/// DigitalOcean provider implementation
pub struct DigitalOceanProvider {
    config: DoConfig,
}

/// DigitalOcean configuration
#[derive(Debug, Clone)]
pub struct DoConfig {
    pub api_token: String,
    pub endpoint: Option<String>,
}

impl DigitalOceanProvider {
    /// Create new DigitalOcean provider
    pub fn new(config: DoConfig) -> Self {
        Self { config }
    }
    
    /// Create from environment variables
    pub fn from_env() -> Result<Self, CloudError> {
        let api_token = std::env::var("DIGITALOCEAN_ACCESS_TOKEN")
            .map_err(|_| CloudError::CredentialError("DIGITALOCEAN_ACCESS_TOKEN not set".to_string()))?;
        
        Ok(Self::new(DoConfig {
            api_token,
            endpoint: None,
        }))
    }
}

#[async_trait]
impl CloudProvider for DigitalOceanProvider {
    fn name(&self) -> &str {
        "digitalocean"
    }
    
    fn display_name(&self) -> &str {
        "DigitalOcean"
    }
    
    fn logo_url(&self) -> &str {
        "https://www.digitalocean.com/assets/images/logo-default.svg"
    }
    
    async fn list_regions(&self) -> Result<Vec<Region>, CloudError> {
        // In production, this would call DO API
        Ok(regions::DO_REGIONS.iter().map(|r| {
            Region {
                id: r.id.to_string(),
                name: r.name.to_string(),
                location: r.location.to_string(),
                available: true,
            }
        }).collect())
    }
    
    async fn list_instances(&self, region: &str) -> Result<Vec<InstanceType>, CloudError> {
        // In production, this would call DO API
        let _ = region;
        Ok(pricing::DO_DROPLETS.iter().map(|d| {
            InstanceType {
                id: d.slug.to_string(),
                name: d.name.to_string(),
                vcpus: d.vcpus,
                memory_gb: d.memory_gb,
                storage_gb: d.storage_gb,
                price_monthly: d.price_monthly,
                price_hourly: d.price_hourly,
            }
        }).collect())
    }
    
    async fn get_pricing(&self) -> Result<PricingInfo, CloudError> {
        Ok(PricingInfo {
            currency: "USD".to_string(),
            instances: pricing::DO_DROPLETS.iter().map(|d| {
                allternit_cloud_core::InstancePricing {
                    instance_type: d.slug.to_string(),
                    price_monthly: d.price_monthly,
                    price_hourly: d.price_hourly,
                }
            }).collect(),
            storage: allternit_cloud_core::StoragePricing {
                price_per_gb_month: 0.10,
            },
            network: allternit_cloud_core::NetworkPricing {
                price_per_gb: 0.01,
                free_gb_monthly: 1000, // DO includes 1TB transfer
            },
        })
    }
    
    async fn provision(&self, config: DeploymentConfig) -> Result<Instance, CloudError> {
        // In production, this would call DO API to create Droplet
        tracing::info!("Provisioning DigitalOcean Droplet: {:?}", config);
        
        Ok(Instance {
            id: format!("do-{}", &uuid::Uuid::new_v4().to_string()[..8]),
            name: config.instance_name,
            public_ip: Some("104.131.186.241".to_string()),
            private_ip: Some("10.132.0.2".to_string()),
            region: config.region,
            instance_type: config.instance_type,
            status: InstanceStatus::Pending,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }
    
    async fn deprovision(&self, id: String) -> Result<(), CloudError> {
        // In production, this would call DO API to delete Droplet
        tracing::info!("Deprovisioning DigitalOcean Droplet: {}", id);
        Ok(())
    }
    
    async fn health_check(&self, id: String) -> Result<HealthStatus, CloudError> {
        // In production, this would check Droplet status
        let _ = id;
        Ok(HealthStatus {
            healthy: true,
            status: "active".to_string(),
            checks: vec![
                allternit_cloud_core::HealthCheck {
                    name: "droplet_status".to_string(),
                    passed: true,
                    message: "Droplet is active".to_string(),
                },
                allternit_cloud_core::HealthCheck {
                    name: "network_status".to_string(),
                    passed: true,
                    message: "Network is available".to_string(),
                },
            ],
        })
    }
    
    async fn get_instance(&self, id: String) -> Result<Instance, CloudError> {
        // In production, this would call DO API
        tracing::info!("Getting DigitalOcean Droplet: {}", id);
        
        Ok(Instance {
            id,
            name: "allternit-droplet".to_string(),
            public_ip: Some("104.131.186.241".to_string()),
            private_ip: Some("10.132.0.2".to_string()),
            region: "nyc3".to_string(),
            instance_type: "s-2vcpu-4gb".to_string(),
            status: InstanceStatus::Running,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }
}

/// Create DigitalOcean provider instance
pub fn create_provider() -> Result<Arc<dyn CloudProvider>, CloudError> {
    let provider = DigitalOceanProvider::from_env()?;
    Ok(Arc::new(provider))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_do_provider_name() {
        let config = DoConfig {
            api_token: "test".to_string(),
            endpoint: None,
        };
        let provider = DigitalOceanProvider::new(config);
        assert_eq!(provider.name(), "digitalocean");
        assert_eq!(provider.display_name(), "DigitalOcean");
    }
}
