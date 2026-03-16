//! A2R Cloud AWS Provider
//!
//! AWS EC2 provider implementation for A2R cloud deployment.

use a2r_cloud_core::{
    CloudProvider, CloudError, DeploymentConfig, Instance, InstanceType, 
    Region, PricingInfo, HealthStatus, InstanceStatus, DeploymentStatus,
    DeploymentPhase,
};
use async_trait::async_trait;
use chrono::Utc;
use std::sync::Arc;

pub mod ec2;
pub mod pricing;
pub mod regions;

// pub use ec2::AwsEc2Provider;

/// AWS provider implementation
pub struct AwsProvider {
    config: AwsConfig,
}

/// AWS configuration
#[derive(Debug, Clone)]
pub struct AwsConfig {
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
    pub endpoint: Option<String>,
}

impl AwsProvider {
    /// Create new AWS provider
    pub fn new(config: AwsConfig) -> Self {
        Self { config }
    }
    
    /// Create from environment variables
    pub fn from_env() -> Result<Self, CloudError> {
        let access_key = std::env::var("AWS_ACCESS_KEY_ID")
            .map_err(|_| CloudError::CredentialError("AWS_ACCESS_KEY_ID not set".to_string()))?;
        let secret_key = std::env::var("AWS_SECRET_ACCESS_KEY")
            .map_err(|_| CloudError::CredentialError("AWS_SECRET_ACCESS_KEY not set".to_string()))?;
        let region = std::env::var("AWS_DEFAULT_REGION")
            .unwrap_or_else(|_| "us-west-2".to_string());
        
        Ok(Self::new(AwsConfig {
            access_key,
            secret_key,
            region,
            endpoint: None,
        }))
    }
}

#[async_trait]
impl CloudProvider for AwsProvider {
    fn name(&self) -> &str {
        "aws"
    }
    
    fn display_name(&self) -> &str {
        "Amazon Web Services"
    }
    
    fn logo_url(&self) -> &str {
        "https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg"
    }
    
    async fn list_regions(&self) -> Result<Vec<Region>, CloudError> {
        // In production, this would call AWS EC2 DescribeRegions
        Ok(regions::AWS_REGIONS.iter().map(|r| {
            Region {
                id: r.id.to_string(),
                name: r.name.to_string(),
                location: r.location.to_string(),
                available: true,
            }
        }).collect())
    }
    
    async fn list_instances(&self, region: &str) -> Result<Vec<InstanceType>, CloudError> {
        // In production, this would call AWS EC2 DescribeInstanceTypes
        let _ = region; // Suppress unused warning
        Ok(pricing::AWS_INSTANCE_TYPES.iter().map(|t| {
            InstanceType {
                id: t.id.to_string(),
                name: t.name.to_string(),
                vcpus: t.vcpus,
                memory_gb: t.memory_gb,
                storage_gb: t.storage_gb,
                price_monthly: t.price_monthly,
                price_hourly: t.price_hourly,
            }
        }).collect())
    }
    
    async fn get_pricing(&self) -> Result<PricingInfo, CloudError> {
        Ok(PricingInfo {
            currency: "USD".to_string(),
            instances: pricing::AWS_INSTANCE_TYPES.iter().map(|t| {
                a2r_cloud_core::InstancePricing {
                    instance_type: t.id.to_string(),
                    price_monthly: t.price_monthly,
                    price_hourly: t.price_hourly,
                }
            }).collect(),
            storage: a2r_cloud_core::StoragePricing {
                price_per_gb_month: 0.10,
            },
            network: a2r_cloud_core::NetworkPricing {
                price_per_gb: 0.09,
                free_gb_monthly: 100,
            },
        })
    }
    
    async fn provision(&self, config: DeploymentConfig) -> Result<Instance, CloudError> {
        // In production, this would call AWS EC2 RunInstances
        // For now, return a mock instance
        
        tracing::info!("Provisioning AWS instance: {:?}", config);
        
        Ok(Instance {
            id: format!("i-{}", &uuid::Uuid::new_v4().to_string()[..17]),
            name: config.instance_name,
            public_ip: Some("54.123.45.67".to_string()),
            private_ip: Some("10.0.1.100".to_string()),
            region: config.region,
            instance_type: config.instance_type,
            status: InstanceStatus::Pending,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }
    
    async fn deprovision(&self, id: String) -> Result<(), CloudError> {
        // In production, this would call AWS EC2 TerminateInstances
        tracing::info!("Deprovisioning AWS instance: {}", id);
        Ok(())
    }
    
    async fn health_check(&self, id: String) -> Result<HealthStatus, CloudError> {
        // In production, this would check instance status
        let _ = id;
        Ok(HealthStatus {
            healthy: true,
            status: "running".to_string(),
            checks: vec![
                a2r_cloud_core::HealthCheck {
                    name: "instance_status".to_string(),
                    passed: true,
                    message: "Instance is running".to_string(),
                },
                a2r_cloud_core::HealthCheck {
                    name: "system_status".to_string(),
                    passed: true,
                    message: "System checks passed".to_string(),
                },
            ],
        })
    }
    
    async fn get_instance(&self, id: String) -> Result<Instance, CloudError> {
        // In production, this would call AWS EC2 DescribeInstances
        tracing::info!("Getting AWS instance: {}", id);
        
        Ok(Instance {
            id,
            name: "a2r-instance".to_string(),
            public_ip: Some("54.123.45.67".to_string()),
            private_ip: Some("10.0.1.100".to_string()),
            region: "us-west-2".to_string(),
            instance_type: "t3.medium".to_string(),
            status: InstanceStatus::Running,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }
}

/// Create AWS provider instance
pub fn create_provider() -> Result<Arc<dyn CloudProvider>, CloudError> {
    let provider = AwsProvider::from_env()?;
    Ok(Arc::new(provider))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_aws_provider_name() {
        let config = AwsConfig {
            access_key: "test".to_string(),
            secret_key: "test".to_string(),
            region: "us-west-2".to_string(),
            endpoint: None,
        };
        let provider = AwsProvider::new(config);
        assert_eq!(provider.name(), "aws");
        assert_eq!(provider.display_name(), "Amazon Web Services");
    }
}
