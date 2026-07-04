//! Integration tests for the cloud deployment orchestrator.

use std::sync::Arc;

use allternit_cloud_core::{
    CloudError, CloudProvider, DeploymentConfig, DeploymentPhase, HealthCheck,
    HealthStatus, Instance, InstanceStatus, InstanceType, PricingInfo, ProviderCredentials, Region,
};
use allternit_cloud_deploy::DeploymentOrchestrator;
use async_trait::async_trait;
use chrono::Utc;

struct MockProvider {
    should_fail_provision: bool,
    should_fail_health: bool,
}

#[async_trait]
impl CloudProvider for MockProvider {
    fn name(&self) -> &str {
        "mock"
    }

    fn display_name(&self) -> &str {
        "Mock Provider"
    }

    fn logo_url(&self) -> &str {
        ""
    }

    async fn list_regions(&self) -> Result<Vec<Region>, CloudError> {
        Ok(vec![Region {
            id: "us-test".to_string(),
            name: "Test Region".to_string(),
            location: "Test".to_string(),
            available: true,
        }])
    }

    async fn list_instances(&self, _region: &str) -> Result<Vec<InstanceType>, CloudError> {
        Ok(vec![])
    }

    async fn get_pricing(&self) -> Result<PricingInfo, CloudError> {
        unimplemented!()
    }

    async fn provision(&self, _config: DeploymentConfig) -> Result<Instance, CloudError> {
        if self.should_fail_provision {
            return Err(CloudError::ProvisioningFailed("mock provision failure".to_string()));
        }
        Ok(Instance {
            id: "i-mock".to_string(),
            name: "test-instance".to_string(),
            public_ip: Some("203.0.113.42".to_string()),
            private_ip: Some("10.0.0.5".to_string()),
            region: "us-test".to_string(),
            instance_type: "small".to_string(),
            status: InstanceStatus::Running,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }

    async fn deprovision(&self, _id: String) -> Result<(), CloudError> {
        Ok(())
    }

    async fn health_check(&self, _id: String) -> Result<HealthStatus, CloudError> {
        if self.should_fail_health {
            return Ok(HealthStatus {
                healthy: false,
                status: "unhealthy".to_string(),
                checks: vec![HealthCheck {
                    name: "mock".to_string(),
                    passed: false,
                    message: "mock health failure".to_string(),
                }],
            });
        }
        Ok(HealthStatus {
            healthy: true,
            status: "healthy".to_string(),
            checks: vec![HealthCheck {
                name: "mock".to_string(),
                passed: true,
                message: "ok".to_string(),
            }],
        })
    }

    async fn get_instance(&self, _id: String) -> Result<Instance, CloudError> {
        Ok(Instance {
            id: "i-mock".to_string(),
            name: "test-instance".to_string(),
            public_ip: Some("203.0.113.42".to_string()),
            private_ip: Some("10.0.0.5".to_string()),
            region: "us-test".to_string(),
            instance_type: "small".to_string(),
            status: InstanceStatus::Running,
            created_at: Utc::now(),
            ssh_key: None,
        })
    }
}

fn test_config() -> DeploymentConfig {
    DeploymentConfig::new("mock", "us-test", "small")
        .with_name("test-instance")
        .with_ssh_key("ssh-rsa AAAA test")
}

fn test_credentials() -> ProviderCredentials {
    ProviderCredentials::new("mock", "mock-key", "mock-secret")
}

#[tokio::test]
async fn test_deploy_succeeds_with_mock_provider() {
    let provider = Arc::new(MockProvider {
        should_fail_provision: false,
        should_fail_health: false,
    });
    let orchestrator = DeploymentOrchestrator::new(provider, test_credentials());
    let result = orchestrator.deploy(test_config()).await.unwrap();

    assert_eq!(result.instance_id, "i-mock");
    assert_eq!(result.public_ip, "203.0.113.42");
    assert!(result.access_url.contains("203.0.113.42"));
    assert!(!result.temporary_password.is_empty());
    assert_eq!(result.status.phase, DeploymentPhase::Complete);
}

#[tokio::test]
async fn test_deploy_fails_on_preflight() {
    let provider = Arc::new(MockProvider {
        should_fail_provision: false,
        should_fail_health: false,
    });
    let orchestrator = DeploymentOrchestrator::new(provider, ProviderCredentials::new("mock", "", ""));
    let err = orchestrator.deploy(test_config()).await.unwrap_err();

    assert!(matches!(err, CloudError::PreflightFailed(_)));
}

#[tokio::test]
async fn test_deploy_fails_on_provision() {
    let provider = Arc::new(MockProvider {
        should_fail_provision: true,
        should_fail_health: false,
    });
    let orchestrator = DeploymentOrchestrator::new(provider, test_credentials());
    let err = orchestrator.deploy(test_config()).await.unwrap_err();

    assert!(matches!(err, CloudError::ProvisioningFailed(_)));
}

#[tokio::test]
async fn test_deploy_fails_on_health_check() {
    let provider = Arc::new(MockProvider {
        should_fail_provision: false,
        should_fail_health: true,
    });
    let orchestrator = DeploymentOrchestrator::new(provider, test_credentials());
    let err = orchestrator.deploy(test_config()).await.unwrap_err();

    assert!(matches!(err, CloudError::HealthCheckFailed(_)));
}

#[tokio::test]
async fn test_get_status_returns_complete() {
    let provider = Arc::new(MockProvider {
        should_fail_provision: false,
        should_fail_health: false,
    });
    let orchestrator = DeploymentOrchestrator::new(provider, test_credentials());
    let status = orchestrator.get_status("test-deploy").await.unwrap();

    assert_eq!(status.phase, DeploymentPhase::Complete);
    assert_eq!(status.progress, 100);
}
