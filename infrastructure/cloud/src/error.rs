//! Cloud Errors
//!
//! Error types for cloud operations.

use thiserror::Error;

/// Cloud operation errors
#[derive(Debug, Error)]
pub enum CloudError {
    #[error("Provider not found: {0}")]
    ProviderNotFound(String),
    
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    
    #[error("Authorization failed: {0}")]
    AuthorizationFailed(String),
    
    #[error("Instance not found: {0}")]
    InstanceNotFound(String),
    
    #[error("Region not available: {0}")]
    RegionNotAvailable(String),
    
    #[error("Instance type not available: {0}")]
    InstanceTypeNotAvailable(String),
    
    #[error("Quota exceeded: {0}")]
    QuotaExceeded(String),
    
    #[error("Provisioning failed: {0}")]
    ProvisioningFailed(String),
    
    #[error("Deprovisioning failed: {0}")]
    DeprovisioningFailed(String),
    
    #[error("Health check failed: {0}")]
    HealthCheckFailed(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Timeout: {0}")]
    Timeout(String),
    
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
    
    #[error("Credential error: {0}")]
    CredentialError(String),
    
    #[error("Preflight check failed: {0}")]
    PreflightFailed(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Result type for cloud operations
pub type CloudResult<T> = Result<T, CloudError>;
