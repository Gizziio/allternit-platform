//! Permission definitions and checking utilities

use serde::{Deserialize, Serialize};
use std::fmt;

/// Permission enum for all API operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    // Run permissions
    RunsRead,
    RunsWrite,
    RunsDelete,
    RunsExecute,

    // Job permissions
    JobsRead,
    JobsWrite,
    JobsDelete,
    JobsExecute,

    // Schedule permissions
    SchedulesRead,
    SchedulesWrite,
    SchedulesDelete,
    SchedulesExecute,

    // Approval permissions
    ApprovalsRead,
    ApprovalsWrite,
    ApprovalsRespond,

    // Checkpoint permissions
    CheckpointsRead,
    CheckpointsWrite,
    CheckpointsRestore,

    // Event permissions
    EventsRead,
    EventsStream,

    // Token/Auth permissions
    TokensRead,
    TokensWrite,
    TokensDelete,

    // Admin permission (grants all access)
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

            Permission::JobsRead => "jobs:read",
            Permission::JobsWrite => "jobs:write",
            Permission::JobsDelete => "jobs:delete",
            Permission::JobsExecute => "jobs:execute",

            Permission::SchedulesRead => "schedules:read",
            Permission::SchedulesWrite => "schedules:write",
            Permission::SchedulesDelete => "schedules:delete",
            Permission::SchedulesExecute => "schedules:execute",

            Permission::ApprovalsRead => "approvals:read",
            Permission::ApprovalsWrite => "approvals:write",
            Permission::ApprovalsRespond => "approvals:respond",

            Permission::CheckpointsRead => "checkpoints:read",
            Permission::CheckpointsWrite => "checkpoints:write",
            Permission::CheckpointsRestore => "checkpoints:restore",

            Permission::EventsRead => "events:read",
            Permission::EventsStream => "events:stream",

            Permission::TokensRead => "tokens:read",
            Permission::TokensWrite => "tokens:write",
            Permission::TokensDelete => "tokens:delete",

            Permission::Admin => "admin",
        }
    }

    /// Get all permissions as a vector
    pub fn all() -> Vec<Permission> {
        vec![
            Permission::RunsRead,
            Permission::RunsWrite,
            Permission::RunsDelete,
            Permission::RunsExecute,
            Permission::JobsRead,
            Permission::JobsWrite,
            Permission::JobsDelete,
            Permission::JobsExecute,
            Permission::SchedulesRead,
            Permission::SchedulesWrite,
            Permission::SchedulesDelete,
            Permission::SchedulesExecute,
            Permission::ApprovalsRead,
            Permission::ApprovalsWrite,
            Permission::ApprovalsRespond,
            Permission::CheckpointsRead,
            Permission::CheckpointsWrite,
            Permission::CheckpointsRestore,
            Permission::EventsRead,
            Permission::EventsStream,
            Permission::TokensRead,
            Permission::TokensWrite,
            Permission::TokensDelete,
            Permission::Admin,
        ]
    }

    /// Get permissions for a read-only role
    pub fn read_only() -> Vec<Permission> {
        vec![
            Permission::RunsRead,
            Permission::JobsRead,
            Permission::SchedulesRead,
            Permission::ApprovalsRead,
            Permission::CheckpointsRead,
            Permission::EventsRead,
            Permission::EventsStream,
        ]
    }

    /// Get permissions for an operator role
    pub fn operator() -> Vec<Permission> {
        vec![
            Permission::RunsRead,
            Permission::RunsWrite,
            Permission::RunsExecute,
            Permission::JobsRead,
            Permission::JobsWrite,
            Permission::JobsExecute,
            Permission::SchedulesRead,
            Permission::SchedulesWrite,
            Permission::SchedulesExecute,
            Permission::ApprovalsRead,
            Permission::ApprovalsRespond,
            Permission::CheckpointsRead,
            Permission::CheckpointsWrite,
            Permission::CheckpointsRestore,
            Permission::EventsRead,
            Permission::EventsStream,
        ]
    }
}

impl fmt::Display for Permission {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl AsRef<str> for Permission {
    fn as_ref(&self) -> &str {
        self.as_str()
    }
}

/// Helper struct for checking permissions
pub struct PermissionChecker;

impl PermissionChecker {
    /// Check if the given permissions list includes the required permission
    pub fn has_permission(have: &[String], need: Permission) -> bool {
        let need_str = need.as_str();
        have.contains(&"*".to_string()) ||
        have.contains(&"admin".to_string()) ||
        have.contains(&need_str.to_string())
    }

    /// Check if the given permissions list includes any of the required permissions
    pub fn has_any_permission(have: &[String], need: &[Permission]) -> bool {
        if have.contains(&"*".to_string()) || have.contains(&"admin".to_string()) {
            return true;
        }
        need.iter().any(|p| Self::has_permission(have, *p))
    }

    /// Check if the given permissions list includes all of the required permissions
    pub fn has_all_permissions(have: &[String], need: &[Permission]) -> bool {
        if have.contains(&"*".to_string()) || have.contains(&"admin".to_string()) {
            return true;
        }
        need.iter().all(|p| Self::has_permission(have, *p))
    }

    /// Convert permission enums to string vector
    pub fn to_strings(permissions: &[Permission]) -> Vec<String> {
        permissions.iter().map(|p| p.as_str().to_string()).collect()
    }
}

/// Macro to require a specific permission in a route handler
/// 
/// Usage:
/// ```rust
/// async fn handler(
///     auth: AuthContext,
/// ) -> Result<Json<...>, ApiError> {
///     require_permission!(auth, Permission::RunsRead)?;
///     // ... handler logic
/// }
/// ```
#[macro_export]
macro_rules! require_permission {
    ($auth:expr, $perm:expr) => {
        if !$auth.user.has_permission($perm.as_str()) {
            return Err($crate::ApiError::Forbidden(
                format!("Missing required permission: {}", $perm)
            ));
        }
    };
}

/// Macro to require any of the specified permissions
#[macro_export]
macro_rules! require_any_permission {
    ($auth:expr, $($perm:expr),+) => {
        {
            let perms = vec![$($perm.as_str()),+];
            if !$auth.user.has_any_permission(&perms) {
                return Err($crate::ApiError::Forbidden(
                    format!("Missing required permissions: {:?}", perms)
                ));
            }
        }
    };
}
