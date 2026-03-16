//! Credential Management
//!
//! Secure credential handling for cloud providers.
//! 
//! Policy: Never store provider secrets unless absolutely necessary.

use serde::{Deserialize, Serialize};

/// Credential policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialPolicy {
    /// Use ephemeral credentials (use once, discard)
    pub ephemeral: bool,
    
    /// Encrypt credentials at rest (if stored)
    pub encrypt_at_rest: bool,
    
    /// Token scope
    pub scope: TokenScope,
    
    /// Auto-rotate credentials
    pub auto_rotate: bool,
}

impl Default for CredentialPolicy {
    fn default() -> Self {
        Self {
            ephemeral: true,
            encrypt_at_rest: true,
            scope: TokenScope::DeployOnly,
            auto_rotate: false,
        }
    }
}

/// Token scope
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TokenScope {
    /// Read-only access
    ReadOnly,
    /// Deploy instances only
    DeployOnly,
    /// Full access (not recommended)
    Full,
}

/// Provider credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCredentials {
    /// Provider name
    pub provider: String,
    
    /// API key / token
    pub api_key: String,
    
    /// API secret (sensitive!)
    pub api_secret: String,
    
    /// Optional: API endpoint override
    pub endpoint: Option<String>,
    
    /// Credential metadata
    pub metadata: CredentialMetadata,
}

/// Credential metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialMetadata {
    /// When credentials were created
    pub created_at: chrono::DateTime<chrono::Utc>,
    
    /// When credentials expire (if applicable)
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    
    /// Last used timestamp
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    
    /// Usage count
    pub usage_count: u32,
}

impl ProviderCredentials {
    /// Create new credentials
    pub fn new(provider: &str, api_key: &str, api_secret: &str) -> Self {
        Self {
            provider: provider.to_string(),
            api_key: api_key.to_string(),
            api_secret: api_secret.to_string(),
            endpoint: None,
            metadata: CredentialMetadata {
                created_at: chrono::Utc::now(),
                expires_at: None,
                last_used: None,
                usage_count: 0,
            },
        }
    }
    
    /// Mark credentials as used
    pub fn mark_used(&mut self) {
        self.metadata.last_used = Some(chrono::Utc::now());
        self.metadata.usage_count += 1;
    }
    
    /// Check if credentials are expired
    pub fn is_expired(&self) -> bool {
        self.metadata
            .expires_at
            .map(|exp| chrono::Utc::now() > exp)
            .unwrap_or(false)
    }
}

/// Encrypted credentials (for storage)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedCredentials {
    /// Encrypted API key
    pub encrypted_api_key: Vec<u8>,
    
    /// Encrypted API secret
    pub encrypted_api_secret: Vec<u8>,
    
    /// Encryption key ID
    pub key_id: String,
    
    /// Nonce for encryption
    pub nonce: Vec<u8>,
}
