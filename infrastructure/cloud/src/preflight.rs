//! Preflight Checks
//!
//! Validate deployment configuration BEFORE provisioning to avoid support issues.

use crate::{CloudError, DeploymentConfig, ProviderCredentials};
use serde::{Deserialize, Serialize};

/// Preflight check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightResult {
    /// All checks passed
    pub passed: bool,
    
    /// Errors (blocking)
    pub errors: Vec<String>,
    
    /// Warnings (non-blocking)
    pub warnings: Vec<String>,
}

impl PreflightResult {
    pub fn success() -> Self {
        Self {
            passed: true,
            errors: vec![],
            warnings: vec![],
        }
    }
    
    pub fn failure(errors: Vec<String>) -> Self {
        Self {
            passed: false,
            errors,
            warnings: vec![],
        }
    }
}

/// Preflight checker
pub struct PreflightChecker;

impl PreflightChecker {
    pub fn new() -> Self {
        Self
    }
    
    /// Run all preflight checks
    pub async fn check(
        &self,
        config: &DeploymentConfig,
        credentials: &ProviderCredentials,
    ) -> Result<PreflightResult, CloudError> {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        
        // 1. Validate credentials format
        if credentials.api_key.is_empty() {
            errors.push("API key is required".to_string());
        }
        if credentials.api_secret.is_empty() {
            errors.push("API secret is required".to_string());
        }
        
        // 2. Check if credentials are expired
        if credentials.is_expired() {
            errors.push("Credentials have expired".to_string());
        }
        
        // 3. Validate region format
        if config.region.is_empty() {
            errors.push("Region is required".to_string());
        }
        
        // 4. Validate instance type
        if config.instance_type.is_empty() {
            errors.push("Instance type is required".to_string());
        }
        
        // 5. Check storage size
        if config.storage_gb < 10 {
            errors.push("Minimum storage is 10 GB".to_string());
        }
        if config.storage_gb > 1000 {
            warnings.push("Large storage sizes may incur additional costs".to_string());
        }
        
        // 6. Validate SSH key format (basic check)
        if config.ssh_public_key.is_empty() {
            errors.push("SSH public key is required".to_string());
        } else if !config.ssh_public_key.starts_with("ssh-") {
            warnings.push("SSH key format looks unusual".to_string());
        }
        
        // 7. Check instance name
        if config.instance_name.len() > 64 {
            errors.push("Instance name must be <= 64 characters".to_string());
        }
        
        Ok(PreflightResult {
            passed: errors.is_empty(),
            errors,
            warnings,
        })
    }
    
    /// Quick validation (format checks only)
    pub fn quick_validate(&self, config: &DeploymentConfig) -> PreflightResult {
        let mut errors = Vec::new();
        
        if config.region.is_empty() {
            errors.push("Region is required".to_string());
        }
        
        if config.instance_type.is_empty() {
            errors.push("Instance type is required".to_string());
        }
        
        if config.ssh_public_key.is_empty() {
            errors.push("SSH public key is required".to_string());
        }
        
        PreflightResult {
            passed: errors.is_empty(),
            errors,
            warnings: vec![],
        }
    }
}

impl Default for PreflightChecker {
    fn default() -> Self {
        Self::new()
    }
}
