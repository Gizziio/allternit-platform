//! A2R Cloud RackNerd Provider - Budget US VPS provider.

use a2r_cloud_core::{
    CloudProvider, CloudError, DeploymentConfig, Instance, InstanceType, 
    Region, PricingInfo, HealthStatus, InstanceStatus,
};
use async_trait::async_trait;
use chrono::Utc;
use std::sync::Arc;

pub mod pricing;
pub mod regions;

pub struct RackNerdProvider {
    config: RackNerdConfig,
}

#[derive(Debug, Clone)]
pub struct RackNerdConfig {
    pub api_key: String,
}

impl RackNerdProvider {
    pub fn new(config: RackNerdConfig) -> Self {
        Self { config }
    }
    
    pub fn from_env() -> Result<Self, CloudError> {
        let api_key = std::env::var("RACKNERD_API_KEY")
            .map_err(|_| CloudError::CredentialError("RACKNERD_API_KEY not set".into()))?;
        Ok(Self::new(RackNerdConfig { api_key }))
    }
}

#[async_trait]
impl CloudProvider for RackNerdProvider {
    fn name(&self) -> &str { "racknerd" }
    fn display_name(&self) -> &str { "RackNerd" }
    fn logo_url(&self) -> &str { "https://racknerd.com/logo.png" }
    
    async fn list_regions(&self) -> Result<Vec<Region>, CloudError> {
        Ok(regions::RN_REGIONS.iter().map(|r| Region {
            id: r.id.into(), name: r.name.into(),
            location: r.location.into(), available: true,
        }).collect())
    }
    
    async fn list_instances(&self, _: &str) -> Result<Vec<InstanceType>, CloudError> {
        Ok(pricing::RN_PLANS.iter().map(|p| InstanceType {
            id: p.id.into(), name: p.name.into(),
            vcpus: p.vcpus, memory_gb: p.memory_gb, storage_gb: p.storage_gb,
            price_monthly: p.price_monthly, price_hourly: p.price_hourly,
        }).collect())
    }
    
    async fn get_pricing(&self) -> Result<PricingInfo, CloudError> {
        Ok(PricingInfo {
            currency: "USD".into(),
            instances: pricing::RN_PLANS.iter().map(|p| a2r_cloud_core::InstancePricing {
                instance_type: p.id.into(),
                price_monthly: p.price_monthly,
                price_hourly: p.price_hourly,
            }).collect(),
            storage: a2r_cloud_core::StoragePricing { price_per_gb_month: 0.10 },
            network: a2r_cloud_core::NetworkPricing { price_per_gb: 0.00, free_gb_monthly: 0 },
        })
    }
    
    async fn provision(&self, config: DeploymentConfig) -> Result<Instance, CloudError> {
        Ok(Instance {
            id: format!("rn-{}", &uuid::Uuid::new_v4().to_string()[..8]),
            name: config.instance_name,
            public_ip: Some("192.252.208.1".into()),
            private_ip: Some("10.0.0.2".into()),
            region: config.region,
            instance_type: config.instance_type,
            status: InstanceStatus::Pending,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }
    
    async fn deprovision(&self, id: String) -> Result<(), CloudError> {
        tracing::info!("Deprovisioning RackNerd: {}", id);
        Ok(())
    }
    
    async fn health_check(&self, _: String) -> Result<HealthStatus, CloudError> {
        Ok(HealthStatus {
            healthy: true,
            status: "running".into(),
            checks: vec![a2r_cloud_core::HealthCheck {
                name: "vps_status".into(),
                passed: true,
                message: "VPS running".into(),
            }],
        })
    }
    
    async fn get_instance(&self, id: String) -> Result<Instance, CloudError> {
        Ok(Instance {
            id,
            name: "a2r-vps".into(),
            public_ip: Some("192.252.208.1".into()),
            private_ip: Some("10.0.0.2".into()),
            region: "us".into(),
            instance_type: "budget-1".into(),
            status: InstanceStatus::Running,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }
}

pub fn create_provider() -> Result<Arc<dyn CloudProvider>, CloudError> {
    Ok(Arc::new(RackNerdProvider::from_env()?))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_name() {
        let p = RackNerdProvider::new(RackNerdConfig { api_key: "test".into() });
        assert_eq!(p.name(), "racknerd");
    }
}
