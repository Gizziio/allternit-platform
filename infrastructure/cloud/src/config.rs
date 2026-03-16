//! Deployment Configuration
//!
//! Configuration for cloud deployments.

use serde::{Deserialize, Serialize};

/// Deployment configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentConfig {
    /// Provider name (aws, digitalocean, etc.)
    pub provider: String,
    
    /// Region ID
    pub region: String,
    
    /// Instance type ID
    pub instance_type: String,
    
    /// Storage size in GB
    pub storage_gb: u32,
    
    /// Instance name
    pub instance_name: String,
    
    /// SSH public key
    pub ssh_public_key: String,
    
    /// Tags/labels
    pub tags: Vec<String>,
    
    /// User data / startup script
    pub user_data: Option<String>,
}

impl DeploymentConfig {
    /// Create a new deployment config with defaults
    pub fn new(provider: &str, region: &str, instance_type: &str) -> Self {
        Self {
            provider: provider.to_string(),
            region: region.to_string(),
            instance_type: instance_type.to_string(),
            storage_gb: 100,
            instance_name: format!("a2r-instance-{}", &uuid::Uuid::new_v4().to_string()[..8]),
            ssh_public_key: String::new(),
            tags: vec!["a2r".to_string()],
            user_data: None,
        }
    }
    
    /// Set instance name
    pub fn with_name(mut self, name: &str) -> Self {
        self.instance_name = name.to_string();
        self
    }
    
    /// Set SSH public key
    pub fn with_ssh_key(mut self, key: &str) -> Self {
        self.ssh_public_key = key.to_string();
        self
    }
    
    /// Set storage size
    pub fn with_storage(mut self, gb: u32) -> Self {
        self.storage_gb = gb;
        self
    }
}
