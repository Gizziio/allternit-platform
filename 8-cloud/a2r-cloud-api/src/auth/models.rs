//! Authentication models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// API Token record - stored in database
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ApiToken {
    pub id: String,
    pub token_hash: String,
    pub name: String,
    pub user_id: String,
    pub permissions: String, // JSON array stored as string
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub is_revoked: bool,
}

impl ApiToken {
    /// Parse permissions from JSON string
    pub fn permissions(&self) -> Vec<String> {
        serde_json::from_str(&self.permissions).unwrap_or_default()
    }

    /// Check if token is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }

    /// Check if token is valid (not revoked and not expired)
    pub fn is_valid(&self) -> bool {
        !self.is_revoked && !self.is_expired()
    }
}

/// Token information returned by validation endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub valid: bool,
    pub token_id: Option<String>,
    pub user_id: Option<String>,
    pub name: Option<String>,
    pub permissions: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub issued_at: Option<DateTime<Utc>>,
}

/// Authenticated user context extracted from token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub token_id: String,
    pub permissions: Vec<String>,
}

impl AuthenticatedUser {
    /// Create a development mode user with all permissions
    pub fn development_user() -> Self {
        Self {
            user_id: "dev-user".to_string(),
            token_id: "dev-token".to_string(),
            permissions: vec!["*".to_string()], // Wildcard = all permissions
        }
    }

    /// Check if user has a specific permission
    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.contains(&"*".to_string()) ||
        self.permissions.contains(&permission.to_string())
    }

    /// Check if user has any of the specified permissions
    pub fn has_any_permission(&self, permissions: &[&str]) -> bool {
        if self.permissions.contains(&"*".to_string()) {
            return true;
        }
        permissions.iter().any(|p| self.has_permission(p))
    }

    /// Check if user has all of the specified permissions
    pub fn has_all_permissions(&self, permissions: &[&str]) -> bool {
        if self.permissions.contains(&"*".to_string()) {
            return true;
        }
        permissions.iter().all(|p| self.has_permission(p))
    }
}

/// Request payload for token validation
#[derive(Debug, Clone, Deserialize)]
pub struct ValidateTokenRequest {
    pub token: String,
}

/// Login request for future JWT implementation
#[derive(Debug, Clone, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Login response with token
#[derive(Debug, Clone, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: Option<DateTime<Utc>>,
}
