//! Authentication and authorization models
//!
//! Provides data structures for users, API tokens, sessions, and audit logging.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============================================================================
// User Models
// ============================================================================

/// User record - represents a person or service account
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: UserRole,
    pub status: UserStatus,
    pub tenant_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

/// User roles for RBAC
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    Developer,
    Viewer,
    Service,
}

impl Default for UserRole {
    fn default() -> Self {
        UserRole::Viewer
    }
}

/// User account status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum UserStatus {
    Active,
    Inactive,
    Suspended,
}

impl Default for UserStatus {
    fn default() -> Self {
        UserStatus::Active
    }
}

/// User summary for list views
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct UserSummary {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub role: UserRole,
    pub status: UserStatus,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// API Token Models
// ============================================================================

/// API token record - for programmatic access
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ApiToken {
    pub id: String,
    pub token_hash: String,
    pub name: String,
    pub user_id: String,
    pub permissions: sqlx::types::Json<Vec<String>>,
    pub scopes: sqlx::types::Json<Vec<String>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub is_revoked: bool,
    pub revoked_at: Option<DateTime<Utc>>,
}

impl ApiToken {
    /// Check if the token is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires) = self.expires_at {
            expires < Utc::now()
        } else {
            false
        }
    }
    
    /// Get permissions as Vec<String>
    pub fn permissions(&self) -> Vec<String> {
        self.permissions.0.clone()
    }
    
    /// Check if token has a specific permission
    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.0.iter().any(|p| p == permission || p == "*")
    }
}

/// API token summary for list views
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ApiTokenSummary {
    pub id: String,
    pub name: String,
    pub user_id: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub is_revoked: bool,
}

/// Create API token request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiTokenRequest {
    pub name: String,
    pub permissions: Vec<String>,
    pub scopes: Vec<String>,
    pub expires_in_days: Option<i32>,
}

/// Token creation response (includes the actual token)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiTokenResponse {
    pub token: String,
    pub token_id: String,
    pub name: String,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Token validation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateTokenRequest {
    pub token: String,
}

/// Token info response
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

// ============================================================================
// User Session Models
// ============================================================================

/// User session record - for web UI sessions
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct UserSession {
    pub id: String,
    pub user_id: String,
    pub session_token_hash: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
}

/// Session validation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionValidation {
    pub valid: bool,
    pub user_id: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Audit Log Models
// ============================================================================

/// Audit log entry - for compliance and security
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
    pub token_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub request_path: Option<String>,
    pub request_method: Option<String>,
    pub status_code: Option<i32>,
    pub details: sqlx::types::Json<serde_json::Value>,
    pub success: bool,
}

/// Audit log summary for list views
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AuditLogSummary {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub action: String,
    pub resource_type: String,
    pub user_email: Option<String>,
    pub success: bool,
}

/// Filter for querying audit logs
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuditLogFilter {
    pub user_id: Option<String>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
}

// ============================================================================
// Permission Models
// ============================================================================

/// Permission definition
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Permission {
    // Run permissions
    RunsRead,
    RunsWrite,
    RunsDelete,
    RunsExecute,
    
    // Schedule permissions
    SchedulesRead,
    SchedulesWrite,
    SchedulesDelete,
    SchedulesTrigger,
    
    // Approval permissions
    ApprovalsRead,
    ApprovalsWrite,
    
    // Checkpoint permissions
    CheckpointsRead,
    CheckpointsWrite,
    CheckpointsRestore,
    
    // User/Admin permissions
    UsersRead,
    UsersWrite,
    TokensRead,
    TokensWrite,
    AuditRead,
    Admin,
}

impl Permission {
    /// Get the string representation of the permission
    pub fn as_str(&self) -> &'static str {
        match self {
            Permission::RunsRead => "runs:read",
            Permission::RunsWrite => "runs:write",
            Permission::RunsDelete => "runs:delete",
            Permission::RunsExecute => "runs:execute",
            Permission::SchedulesRead => "schedules:read",
            Permission::SchedulesWrite => "schedules:write",
            Permission::SchedulesDelete => "schedules:delete",
            Permission::SchedulesTrigger => "schedules:trigger",
            Permission::ApprovalsRead => "approvals:read",
            Permission::ApprovalsWrite => "approvals:write",
            Permission::CheckpointsRead => "checkpoints:read",
            Permission::CheckpointsWrite => "checkpoints:write",
            Permission::CheckpointsRestore => "checkpoints:restore",
            Permission::UsersRead => "users:read",
            Permission::UsersWrite => "users:write",
            Permission::TokensRead => "tokens:read",
            Permission::TokensWrite => "tokens:write",
            Permission::AuditRead => "audit:read",
            Permission::Admin => "*",
        }
    }
}

/// Check if a permission list includes a specific permission
pub fn has_permission(permissions: &[String], required: &str) -> bool {
    permissions.iter().any(|p| p == required || p == "*")
}
