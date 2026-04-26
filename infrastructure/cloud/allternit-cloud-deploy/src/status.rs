//! Deployment Status
//!
//! Status tracking for deployments.

use allternit_cloud_core::DeploymentStatus;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;

/// Deployment status tracker
pub struct DeploymentTracker {
    deployments: Arc<RwLock<HashMap<String, DeploymentStatus>>>,
}

impl DeploymentTracker {
    pub fn new() -> Self {
        Self {
            deployments: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Create new deployment status
    pub async fn create(&self, status: DeploymentStatus) {
        let mut deployments = self.deployments.write().await;
        deployments.insert(status.id.clone(), status);
    }
    
    /// Update deployment status
    pub async fn update(&self, deployment_id: &str, status: DeploymentStatus) {
        let mut deployments = self.deployments.write().await;
        deployments.insert(deployment_id.to_string(), status);
    }
    
    /// Get deployment status
    pub async fn get(&self, deployment_id: &str) -> Option<DeploymentStatus> {
        let deployments = self.deployments.read().await;
        deployments.get(deployment_id).cloned()
    }
    
    /// List all deployments
    pub async fn list(&self) -> Vec<DeploymentStatus> {
        let deployments = self.deployments.read().await;
        deployments.values().cloned().collect()
    }
    
    /// Delete deployment status
    pub async fn delete(&self, deployment_id: &str) {
        let mut deployments = self.deployments.write().await;
        deployments.remove(deployment_id);
    }
}

impl Default for DeploymentTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_cloud_core::DeploymentPhase;
    use chrono::Utc;
    
    #[tokio::test]
    async fn test_deployment_tracker() {
        let tracker = DeploymentTracker::new();
        
        let status = DeploymentStatus {
            id: "test-123".to_string(),
            phase: DeploymentPhase::Pending,
            progress: 0,
            message: "Test deployment".to_string(),
            errors: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        tracker.create(status.clone()).await;
        
        let retrieved = tracker.get("test-123").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, "test-123");
    }
}
