//! Configuration management for Allternit Node

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Node configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    /// Unique node identifier
    #[serde(default = "default_node_id")]
    pub node_id: String,
    
    /// Authentication token for control plane
    pub auth_token: String,
    
    /// Control plane WebSocket URL
    #[serde(default = "default_control_plane")]
    pub control_plane_url: String,
    
    /// Node labels for scheduling
    #[serde(default)]
    pub labels: Vec<String>,
    
    /// Heartbeat interval in seconds
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval_secs: u64,
    
    /// Maximum concurrent jobs
    #[serde(default = "default_max_jobs")]
    pub max_concurrent_jobs: usize,
    
    /// Docker configuration
    #[serde(default)]
    pub docker: DockerConfig,
    
    /// Logging configuration
    #[serde(default)]
    pub logging: LoggingConfig,
    
    /// Maximum file upload size in bytes
    #[serde(default = "default_max_file_upload_size")]
    pub max_file_upload_size: u64,
    
    /// Allowed paths for file operations (empty = any)
    #[serde(default)]
    pub allowed_file_paths: Vec<String>,
    
    /// Blocked file patterns (e.g., ["*.exe", "*.dll"])
    #[serde(default)]
    pub blocked_file_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerConfig {
    /// Docker socket path
    #[serde(default = "default_docker_socket")]
    pub socket: String,
    
    /// Default network mode
    #[serde(default = "default_network_mode")]
    pub network_mode: String,
    
    /// Default registry for images
    #[serde(default)]
    pub registry: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Log level
    #[serde(default = "default_log_level")]
    pub level: String,
    
    /// Log file path (optional)
    pub file: Option<String>,
}

impl NodeConfig {
    /// Load configuration from file
    pub async fn load<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        
        // Try to load from file
        if path.exists() {
            let content = tokio::fs::read_to_string(path)
                .await
                .with_context(|| format!("Failed to read config from {:?}", path))?;
            
            let config: NodeConfig = toml::from_str(&content)
                .with_context(|| format!("Failed to parse config from {:?}", path))?;
            
            return Ok(config);
        }
        
        // Try environment variables
        if let Ok(config) = Self::from_env() {
            return Ok(config);
        }
        
        // Return default (will fail validation)
        Ok(Self::default())
    }
    
    /// Load from environment variables
    pub fn from_env() -> Result<Self> {
        let node_id = std::env::var("Allternit_NODE_ID")
            .map_err(|_| anyhow::anyhow!("Allternit_NODE_ID not set"))?;
        
        let auth_token = std::env::var("Allternit_TOKEN")
            .map_err(|_| anyhow::anyhow!("Allternit_TOKEN not set"))?;
        
        let control_plane_url = std::env::var("Allternit_CONTROL_PLANE")
            .unwrap_or_else(|_| default_control_plane());
        
        let labels = std::env::var("Allternit_LABELS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        
        Ok(Self {
            node_id,
            auth_token,
            control_plane_url,
            labels,
            ..Default::default()
        })
    }
    
    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        if self.node_id.is_empty() {
            anyhow::bail!("node_id cannot be empty");
        }
        
        if self.auth_token.is_empty() {
            anyhow::bail!("auth_token cannot be empty");
        }
        
        if self.control_plane_url.is_empty() {
            anyhow::bail!("control_plane_url cannot be empty");
        }
        
        // Validate URL format
        if !self.control_plane_url.starts_with("ws://") 
            && !self.control_plane_url.starts_with("wss://") {
            anyhow::bail!("control_plane_url must start with ws:// or wss://");
        }
        
        Ok(())
    }
    
    /// Save configuration to file
    pub async fn save<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        
        let content = toml::to_string_pretty(self)?;
        tokio::fs::write(path, content).await?;
        
        Ok(())
    }
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            node_id: default_node_id(),
            auth_token: String::new(),
            control_plane_url: default_control_plane(),
            labels: Vec::new(),
            heartbeat_interval_secs: default_heartbeat_interval(),
            max_concurrent_jobs: default_max_jobs(),
            docker: DockerConfig::default(),
            logging: LoggingConfig::default(),
            max_file_upload_size: default_max_file_upload_size(),
            allowed_file_paths: Vec::new(),
            blocked_file_patterns: Vec::new(),
        }
    }
}

impl Default for DockerConfig {
    fn default() -> Self {
        Self {
            socket: default_docker_socket(),
            network_mode: default_network_mode(),
            registry: None,
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: default_log_level(),
            file: None,
        }
    }
}

// Default functions
fn default_node_id() -> String {
    format!("node-{}", uuid::Uuid::new_v4())
}

fn default_control_plane() -> String {
    "wss://control.allternit.io".to_string()
}

fn default_heartbeat_interval() -> u64 {
    30
}

fn default_max_jobs() -> usize {
    10
}

fn default_docker_socket() -> String {
    "/var/run/docker.sock".to_string()
}

fn default_network_mode() -> String {
    "bridge".to_string()
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_max_file_upload_size() -> u64 {
    100 * 1024 * 1024 // 100MB
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_config() {
        let config = NodeConfig::default();
        assert!(!config.node_id.is_empty());
        assert_eq!(config.heartbeat_interval_secs, 30);
    }
    
    #[test]
    fn test_validate_empty_node_id() {
        let config = NodeConfig {
            node_id: "".to_string(),
            auth_token: "test".to_string(),
            control_plane_url: "wss://test".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_err());
    }
    
    #[test]
    fn test_validate_invalid_url() {
        let config = NodeConfig {
            node_id: "test".to_string(),
            auth_token: "test".to_string(),
            control_plane_url: "http://test".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_err());
    }
    
    #[test]
    fn test_validate_valid() {
        let config = NodeConfig {
            node_id: "test-node".to_string(),
            auth_token: "secret-token".to_string(),
            control_plane_url: "wss://control.allternit.io".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }
}
