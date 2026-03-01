//! Hetzner Provider Implementation
//!
//! Real Hetzner Cloud API integration for automated deployments.

use crate::{HetznerClient, CreateServerRequest, HetznerError};
use a2r_cloud_ssh::SshExecutor;
use tracing::{info, warn};

/// Hetzner provider for automated deployments
pub struct HetznerProvider {
    client: HetznerClient,
    ssh_executor: SshExecutor,
}

impl HetznerProvider {
    /// Create a new Hetzner provider
    pub fn new(api_token: &str) -> Self {
        Self {
            client: HetznerClient::new(api_token),
            ssh_executor: SshExecutor::new(),
        }
    }
    
    /// Validate API credentials
    pub async fn validate_credentials(&self) -> Result<bool, HetznerError> {
        self.client.validate_token().await
    }
    
    /// Deploy A2R to Hetzner Cloud
    pub async fn deploy(&self, config: &DeploymentConfig) -> Result<DeploymentResult, HetznerError> {
        info!("Deploying to Hetzner: {:?}", config);
        
        // Generate SSH keypair for this deployment
        let keypair = self.ssh_executor.generate_keypair()
            .map_err(|e| HetznerError::ApiError(format!("Failed to generate SSH key: {}", e)))?;
        
        info!("Generated SSH keypair for deployment");
        
        // Create server
        let server_request = CreateServerRequest {
            name: config.instance_name.clone(),
            server_type: config.instance_type_id.clone(),
            image: "ubuntu-22.04".to_string(),
            location: config.region_id.clone(),
            public_keys: Some(vec![keypair.public_key.clone()]),
            start_after_create: Some(true),
        };
        
        info!("Creating server: {:?}", server_request);
        let server = self.client.create_server(&server_request).await?;
        info!("Server created: {} ({})", server.name, server.id);
        
        // Wait for server to be ready
        info!("Waiting for server {} to be ready", server.id);
        self.wait_for_server_ready(server.id).await?;
        
        // Install A2R runtime via SSH
        info!("Installing A2R runtime on {}", server.name);
        let install_result = self.ssh_executor.install_a2r_runtime(
            &server.public_net.ipv4.ip,
            22,
            "root",
            &keypair.private_key,
            &config.control_plane_url,
            &config.deployment_token,
        ).await;
        
        match install_result {
            Ok(output) => {
                info!("A2R runtime installed successfully");
                info!("Installation output: {}", output.stdout);
            }
            Err(e) => {
                warn!("A2R installation failed: {}", e);
                return Err(HetznerError::ApiError(format!("Installation failed: {}", e)));
            }
        }
        
        Ok(DeploymentResult {
            instance_id: server.id.to_string(),
            instance_ip: server.public_net.ipv4.ip,
            server_name: server.name,
            ssh_key: keypair.private_key,
        })
    }
    
    /// Wait for server to be ready
    async fn wait_for_server_ready(&self, server_id: i64) -> Result<(), HetznerError> {
        // Poll server status
        for attempt in 0..30 {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            
            let server = self.client.get_server(server_id).await?;
            
            if server.status == "running" {
                info!("Server {} is running", server_id);
                return Ok(());
            }
            
            info!("Server {} status: {} (attempt {}/{})", server_id, server.status, attempt + 1, 30);
        }
        
        Err(HetznerError::ApiError("Server did not become ready in time".to_string()))
    }
    
    /// Delete server
    pub async fn delete_server(&self, server_id: i64) -> Result<(), HetznerError> {
        info!("Deleting server {}", server_id);
        self.client.delete_server(server_id).await
    }
}

/// Deployment configuration
#[derive(Debug, Clone)]
pub struct DeploymentConfig {
    pub instance_name: String,
    pub instance_type_id: String,
    pub region_id: String,
    pub storage_gb: i32,
    pub control_plane_url: String,
    pub deployment_token: String,
}

/// Deployment result
#[derive(Debug, Clone)]
pub struct DeploymentResult {
    pub instance_id: String,
    pub instance_ip: String,
    pub server_name: String,
    pub ssh_key: String,
}
