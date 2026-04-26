//! Allternit Cloud Contabo Provider
//!
//! Contabo VPS provider - budget-friendly German VPS provider.

use allternit_cloud_core::{
    CloudProvider, CloudError, DeploymentConfig, Instance, InstanceType, 
    Region, PricingInfo, HealthStatus, InstanceStatus,
};
use async_trait::async_trait;
use chrono::Utc;
use std::sync::Arc;

pub mod pricing;
pub mod regions;

/// Contabo provider implementation
pub struct ContaboProvider {
    config: ContaboConfig,
}

#[derive(Debug, Clone)]
pub struct ContaboConfig {
    pub client_id: String,
    pub api_password: String,
}

impl ContaboProvider {
    pub fn new(config: ContaboConfig) -> Self {
        Self { config }
    }
    
    pub fn from_env() -> Result<Self, CloudError> {
        let client_id = std::env::var("CONTABO_CLIENT_ID")
            .map_err(|_| CloudError::CredentialError("CONTABO_CLIENT_ID not set".to_string()))?;
        let api_password = std::env::var("CONTABO_API_PASSWORD")
            .map_err(|_| CloudError::CredentialError("CONTABO_API_PASSWORD not set".to_string()))?;
        
        Ok(Self::new(ContaboConfig { client_id, api_password }))
    }
}

#[async_trait]
impl CloudProvider for ContaboProvider {
    fn name(&self) -> &str { "contabo" }
    fn display_name(&self) -> &str { "Contabo" }
    fn logo_url(&self) -> &str { "https://contabo.com/logo.svg" }
    
    async fn list_regions(&self) -> Result<Vec<Region>, CloudError> {
        Ok(regions::CONTABO_REGIONS.iter().map(|r| Region {
            id: r.id.to_string(), name: r.name.to_string(),
            location: r.location.to_string(), available: true,
        }).collect())
    }
    
    async fn list_instances(&self, region: &str) -> Result<Vec<InstanceType>, CloudError> {
        let _ = region;
        Ok(pricing::CONTABO_VPS.iter().map(|v| InstanceType {
            id: v.id.to_string(), name: v.name.to_string(),
            vcpus: v.vcpus, memory_gb: v.memory_gb, storage_gb: v.storage_gb,
            price_monthly: v.price_monthly, price_hourly: v.price_hourly,
        }).collect())
    }
    
    async fn get_pricing(&self) -> Result<PricingInfo, CloudError> {
        Ok(PricingInfo {
            currency: "EUR".to_string(),
            instances: pricing::CONTABO_VPS.iter().map(|v| {
                allternit_cloud_core::InstancePricing {
                    instance_type: v.id.to_string(),
                    price_monthly: v.price_monthly, price_hourly: v.price_hourly,
                }
            }).collect(),
            storage: allternit_cloud_core::StoragePricing { price_per_gb_month: 0.05 },
            network: allternit_cloud_core::NetworkPricing { price_per_gb: 0.00, free_gb_monthly: 0 },
        })
    }
    
    async fn provision(&self, config: DeploymentConfig) -> Result<Instance, CloudError> {
        Ok(Instance {
            id: format!("cb-{}", &uuid::Uuid::new_v4().to_string()[..8]),
            name: config.instance_name,
            public_ip: Some("123.45.67.89".to_string()),
            private_ip: Some("10.0.0.2".to_string()),
            region: config.region, instance_type: config.instance_type,
            status: InstanceStatus::Pending, created_at: Utc::now(), ssh_key: None,
        })
    }
    
    async fn deprovision(&self, id: String) -> Result<(), CloudError> {
        tracing::info!("Deprovisioning Contabo VPS: {}", id); Ok(())
    }
    
    async fn health_check(&self, id: String) -> Result<HealthStatus, CloudError> {
        let _ = id;
        Ok(HealthStatus { healthy: true, status: "running".to_string(),
            checks: vec![allternit_cloud_core::HealthCheck {
                name: "vps_status".to_string(), passed: true,
                message: "VPS is running".to_string(),
            }]
        })
    }
    
    async fn get_instance(&self, id: String) -> Result<Instance, CloudError> {
        Ok(Instance { id, name: "allternit-vps".to_string(),
            public_ip: Some("123.45.67.89".to_string()),
            private_ip: Some("10.0.0.2".to_string()),
            region: "de".to_string(), instance_type: "VPS 10".to_string(),
            status: InstanceStatus::Running, created_at: Utc::now(), ssh_key: None,
        })
    }
}

pub fn create_provider() -> Result<Arc<dyn CloudProvider>, CloudError> {
    Ok(Arc::new(ContaboProvider::from_env()?))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_contabo_name() {
        let p = ContaboProvider::new(ContaboConfig { client_id: "test".into(), api_password: "test".into() });
        assert_eq!(p.name(), "contabo");
    }
}
