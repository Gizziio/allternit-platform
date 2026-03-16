#![allow(dead_code, unused_variables, unused_imports)]
//! Node Authentication with JWT
//!
//! Provides JWT token generation and validation for node authentication.

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

/// JWT claims for node authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeClaims {
    /// Node ID
    pub sub: String,
    /// User ID who owns this node
    pub user_id: String,
    /// Token type
    pub token_type: String,
    /// Issued at timestamp
    pub iat: i64,
    /// Expiration timestamp
    pub exp: i64,
    /// Node capabilities (for routing)
    #[serde(default)]
    pub capabilities: NodeCapabilitiesClaim,
}

/// Node capabilities claim for JWT
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeCapabilitiesClaim {
    #[serde(default)]
    pub docker: bool,
    #[serde(default)]
    pub gpu: bool,
    #[serde(default)]
    pub cpu_cores: u32,
    #[serde(default)]
    pub memory_gb: u64,
    #[serde(default)]
    pub labels: Vec<String>,
}

/// JWT authentication service
pub struct NodeAuthService {
    /// Secret key for signing tokens
    secret_key: Vec<u8>,
    /// Public key for verification (if using asymmetric)
    public_key: Option<Vec<u8>>,
    /// Token validity duration
    token_validity: Duration,
    /// Revoked tokens cache
    revoked_tokens: RwLock<Vec<String>>,
}

impl NodeAuthService {
    /// Create new auth service with random secret
    pub fn new() -> Self {
        // Generate a random secret key
        let secret_key: Vec<u8> = (0..64).map(|_| rand::random::<u8>()).collect();

        Self {
            secret_key,
            public_key: None,
            token_validity: Duration::days(365), // Nodes tokens valid for 1 year
            revoked_tokens: RwLock::new(Vec::new()),
        }
    }

    /// Create auth service with custom secret
    pub fn with_secret(secret: Vec<u8>) -> Self {
        Self {
            secret_key: secret,
            public_key: None,
            token_validity: Duration::days(365),
            revoked_tokens: RwLock::new(Vec::new()),
        }
    }

    /// Generate a new node token
    pub fn generate_node_token(
        &self,
        node_id: &str,
        user_id: &str,
        capabilities: Option<NodeCapabilitiesClaim>,
    ) -> Result<String, jsonwebtoken::errors::Error> {
        let now = Utc::now();
        let claims = NodeClaims {
            sub: node_id.to_string(),
            user_id: user_id.to_string(),
            token_type: "node".to_string(),
            iat: now.timestamp(),
            exp: (now + self.token_validity).timestamp(),
            capabilities: capabilities.unwrap_or_default(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(&self.secret_key),
        )
    }

    /// Validate a node token
    pub fn validate_token(&self, token: &str) -> Result<NodeClaims, AuthError> {
        // Check if token is revoked
        {
            let revoked = self.revoked_tokens.blocking_read();
            if revoked.contains(&token.to_string()) {
                return Err(AuthError::TokenRevoked);
            }
        }

        let mut validation = Validation::default();
        validation.validate_exp = true;
        validation.required_spec_claims.insert("sub".to_string());
        validation
            .required_spec_claims
            .insert("user_id".to_string());
        validation
            .required_spec_claims
            .insert("token_type".to_string());

        let token_data = decode::<NodeClaims>(
            token,
            &DecodingKey::from_secret(&self.secret_key),
            &validation,
        )?;

        // Verify token type
        if token_data.claims.token_type != "node" {
            return Err(AuthError::InvalidTokenType);
        }

        Ok(token_data.claims)
    }

    /// Revoke a token (for node deletion/logout)
    pub async fn revoke_token(&self, token: &str) {
        let mut revoked = self.revoked_tokens.write().await;
        revoked.push(token.to_string());
        info!("Token revoked");
    }

    /// Clean up old revoked tokens (call periodically)
    pub async fn cleanup_revoked_tokens(&self) {
        let mut revoked = self.revoked_tokens.write().await;
        // Keep only tokens that haven't expired yet
        revoked.clear();
        info!("Revoked tokens cleaned up");
    }

    /// Get the encoding key for external use
    pub fn get_encoding_key(&self) -> EncodingKey {
        EncodingKey::from_secret(&self.secret_key)
    }
}

impl Default for NodeAuthService {
    fn default() -> Self {
        Self::new()
    }
}

/// Authentication errors
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Invalid token: {0}")]
    InvalidToken(#[from] jsonwebtoken::errors::Error),

    #[error("Token has expired")]
    TokenExpired,

    #[error("Token has been revoked")]
    TokenRevoked,

    #[error("Invalid token type")]
    InvalidTokenType,

    #[error("Missing required claim: {0}")]
    MissingClaim(String),
}

/// Extract JWT from Authorization header
pub fn extract_token_from_header(auth_header: &str) -> Option<&str> {
    if auth_header.starts_with("Bearer ") {
        Some(&auth_header[7..])
    } else {
        None
    }
}

/// Generate a secure random token for node registration
pub fn generate_registration_token() -> String {
    let token: String = (0..32)
        .map(|_| {
            const CHARSET: &[u8] =
                b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let idx = rand::random::<usize>() % CHARSET.len();
            CHARSET[idx] as char
        })
        .collect();

    format!("a2r_node_{}", token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_generation_and_validation() {
        let auth = NodeAuthService::new();

        let token = auth
            .generate_node_token("node-123", "user-456", None)
            .unwrap();

        let claims = auth.validate_token(&token).unwrap();

        assert_eq!(claims.sub, "node-123");
        assert_eq!(claims.user_id, "user-456");
        assert_eq!(claims.token_type, "node");
    }

    #[test]
    fn test_token_with_capabilities() {
        let auth = NodeAuthService::new();

        let capabilities = NodeCapabilitiesClaim {
            docker: true,
            gpu: true,
            cpu_cores: 8,
            memory_gb: 32,
            labels: vec!["production".to_string(), "high-memory".to_string()],
        };

        let token = auth
            .generate_node_token("node-123", "user-456", Some(capabilities.clone()))
            .unwrap();

        let claims = auth.validate_token(&token).unwrap();

        assert!(claims.capabilities.docker);
        assert!(claims.capabilities.gpu);
        assert_eq!(claims.capabilities.cpu_cores, 8);
        assert_eq!(claims.capabilities.labels.len(), 2);
    }

    #[tokio::test]
    async fn test_token_revocation() {
        let auth = NodeAuthService::new();

        let token = auth
            .generate_node_token("node-123", "user-456", None)
            .unwrap();

        // Should validate before revocation
        assert!(auth.validate_token(&token).is_ok());

        // Revoke token
        auth.revoke_token(&token).await;

        // Should fail after revocation
        assert!(matches!(
            auth.validate_token(&token),
            Err(AuthError::TokenRevoked)
        ));
    }

    #[test]
    fn test_extract_token_from_header() {
        assert_eq!(
            extract_token_from_header("Bearer token123"),
            Some("token123")
        );
        assert_eq!(extract_token_from_header("token123"), None);
        assert_eq!(extract_token_from_header(""), None);
    }
}
