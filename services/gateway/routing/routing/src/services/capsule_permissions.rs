//! Capsule Permissions Service
//!
//! Capability-based access control for interactive capsules.
//! Implements permission checking for tool invocation, state access, and events.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Permission types for capsule operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionType {
    /// Invoke tools through the bridge
    ToolInvoke,
    /// Subscribe to tool events
    ToolSubscribe,
    /// Read capsule state
    StateRead,
    /// Write capsule state
    StateWrite,
    /// Access filesystem (read)
    FilesystemRead,
    /// Access filesystem (write)
    FilesystemWrite,
    /// Make network requests
    NetworkAccess,
    /// Access clipboard
    ClipboardAccess,
}

/// A single permission grant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    /// Type of permission
    pub permission_type: PermissionType,
    /// Resource this permission applies to (e.g., tool name, path pattern)
    pub resource: String,
    /// Allowed actions (e.g., "read", "write", "execute")
    pub actions: Vec<String>,
    /// Optional conditions for this permission
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<PermissionConditions>,
}

/// Conditions that must be met for permission to apply
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PermissionConditions {
    /// Require user approval for each invocation
    #[serde(default)]
    pub require_approval: bool,
    /// Maximum invocations allowed (None = unlimited)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_invocations: Option<u32>,
    /// Rate limit (invocations per minute)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_limit_per_minute: Option<u32>,
    /// Allowed time window (e.g., "09:00-17:00")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_window: Option<String>,
    /// Additional constraints as JSON
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraints: Option<serde_json::Value>,
}

/// Permission check result
#[derive(Debug, Clone)]
pub struct PermissionCheckResult {
    pub allowed: bool,
    pub reason: Option<String>,
    pub requires_approval: bool,
    pub approval_reason: Option<String>,
}

/// Permission set for a capsule
#[derive(Debug, Clone, Default)]
pub struct PermissionSet {
    permissions: Vec<Permission>,
    /// Track invocation counts for rate limiting
    invocation_counts: HashMap<String, u32>,
    /// Track last invocation times
    last_invocations: HashMap<String, std::time::Instant>,
}

impl PermissionSet {
    pub fn new(permissions: Vec<Permission>) -> Self {
        Self {
            permissions,
            invocation_counts: HashMap::new(),
            last_invocations: HashMap::new(),
        }
    }

    /// Check if an action is permitted
    pub fn check(
        &mut self,
        permission_type: PermissionType,
        resource: &str,
        action: &str,
    ) -> PermissionCheckResult {
        // Find matching permission
        let matching = self.permissions.iter().find(|p| {
            p.permission_type == permission_type
                && (p.resource == "*" || p.resource == resource)
                && (p.actions.contains(&"*".to_string()) || p.actions.contains(&action.to_string()))
        });

        match matching {
            None => PermissionCheckResult {
                allowed: false,
                reason: Some(format!(
                    "No permission found for {:?} on '{}' with action '{}'",
                    permission_type, resource, action
                )),
                requires_approval: false,
                approval_reason: None,
            },
            Some(permission) => {
                // Check conditions
                if let Some(conditions) = &permission.conditions {
                    // Check max invocations
                    if let Some(max) = conditions.max_invocations {
                        let count = self.invocation_counts.get(resource).copied().unwrap_or(0);
                        if count >= max {
                            return PermissionCheckResult {
                                allowed: false,
                                reason: Some(format!(
                                    "Maximum invocations ({}) exceeded for '{}'",
                                    max, resource
                                )),
                                requires_approval: false,
                                approval_reason: None,
                            };
                        }
                    }

                    // Check rate limit
                    if let Some(limit) = conditions.rate_limit_per_minute {
                        if let Some(last) = self.last_invocations.get(resource) {
                            let elapsed = last.elapsed().as_secs();
                            if elapsed < 60 {
                                let count =
                                    self.invocation_counts.get(resource).copied().unwrap_or(0);
                                if count >= limit {
                                    return PermissionCheckResult {
                                        allowed: false,
                                        reason: Some(format!(
                                            "Rate limit ({}/min) exceeded for '{}'",
                                            limit, resource
                                        )),
                                        requires_approval: false,
                                        approval_reason: None,
                                    };
                                }
                            }
                        }
                    }

                    // Requires approval
                    if conditions.require_approval {
                        return PermissionCheckResult {
                            allowed: true,
                            reason: None,
                            requires_approval: true,
                            approval_reason: Some(format!(
                                "Permission requires approval: {:?} on '{}'",
                                permission_type, resource
                            )),
                        };
                    }
                }

                PermissionCheckResult {
                    allowed: true,
                    reason: None,
                    requires_approval: false,
                    approval_reason: None,
                }
            }
        }
    }

    /// Record an invocation for rate limiting
    pub fn record_invocation(&mut self, resource: &str) {
        *self
            .invocation_counts
            .entry(resource.to_string())
            .or_insert(0) += 1;
        self.last_invocations
            .insert(resource.to_string(), std::time::Instant::now());
    }

    /// Get current invocation count for a resource
    pub fn get_invocation_count(&self, resource: &str) -> u32 {
        self.invocation_counts.get(resource).copied().unwrap_or(0)
    }

    /// Reset invocation counts (e.g., for new session)
    pub fn reset_counts(&mut self) {
        self.invocation_counts.clear();
        self.last_invocations.clear();
    }
}

/// Default permissions for new capsules
pub fn default_capsule_permissions() -> Vec<Permission> {
    vec![
        Permission {
            permission_type: PermissionType::ToolInvoke,
            resource: "*".to_string(),
            actions: vec!["read".to_string()],
            conditions: Some(PermissionConditions {
                require_approval: false,
                max_invocations: None,
                rate_limit_per_minute: Some(60),
                time_window: None,
                constraints: None,
            }),
        },
        Permission {
            permission_type: PermissionType::StateRead,
            resource: "*".to_string(),
            actions: vec!["read".to_string()],
            conditions: None,
        },
        Permission {
            permission_type: PermissionType::StateWrite,
            resource: "*".to_string(),
            actions: vec!["write".to_string()],
            conditions: Some(PermissionConditions {
                require_approval: true,
                max_invocations: None,
                rate_limit_per_minute: None,
                time_window: None,
                constraints: None,
            }),
        },
    ]
}

/// Restricted permissions (minimal access)
pub fn restricted_capsule_permissions() -> Vec<Permission> {
    vec![Permission {
        permission_type: PermissionType::StateRead,
        resource: "*".to_string(),
        actions: vec!["read".to_string()],
        conditions: None,
    }]
}

/// Full permissions (for trusted capsules)
pub fn full_capsule_permissions() -> Vec<Permission> {
    vec![
        Permission {
            permission_type: PermissionType::ToolInvoke,
            resource: "*".to_string(),
            actions: vec!["*".to_string()],
            conditions: Some(PermissionConditions {
                require_approval: false,
                max_invocations: None,
                rate_limit_per_minute: Some(120),
                time_window: None,
                constraints: None,
            }),
        },
        Permission {
            permission_type: PermissionType::StateRead,
            resource: "*".to_string(),
            actions: vec!["*".to_string()],
            conditions: None,
        },
        Permission {
            permission_type: PermissionType::StateWrite,
            resource: "*".to_string(),
            actions: vec!["*".to_string()],
            conditions: None,
        },
        Permission {
            permission_type: PermissionType::FilesystemRead,
            resource: "*".to_string(),
            actions: vec!["read".to_string()],
            conditions: Some(PermissionConditions {
                require_approval: true,
                max_invocations: None,
                rate_limit_per_minute: None,
                time_window: None,
                constraints: None,
            }),
        },
        Permission {
            permission_type: PermissionType::NetworkAccess,
            resource: "*".to_string(),
            actions: vec!["read".to_string()],
            conditions: Some(PermissionConditions {
                require_approval: true,
                max_invocations: None,
                rate_limit_per_minute: None,
                time_window: None,
                constraints: None,
            }),
        },
    ]
}

/// Permission checker for capsule operations
pub struct PermissionChecker {
    permission_sets: HashMap<String, PermissionSet>,
}

impl PermissionChecker {
    pub fn new() -> Self {
        Self {
            permission_sets: HashMap::new(),
        }
    }

    /// Register a capsule with its permissions
    pub fn register_capsule(&mut self, capsule_id: &str, permissions: Vec<Permission>) {
        self.permission_sets
            .insert(capsule_id.to_string(), PermissionSet::new(permissions));
    }

    /// Check permission for a capsule
    pub fn check(
        &mut self,
        capsule_id: &str,
        permission_type: PermissionType,
        resource: &str,
        action: &str,
    ) -> PermissionCheckResult {
        match self.permission_sets.get_mut(capsule_id) {
            None => PermissionCheckResult {
                allowed: false,
                reason: Some(format!("Capsule '{}' not registered", capsule_id)),
                requires_approval: false,
                approval_reason: None,
            },
            Some(set) => set.check(permission_type, resource, action),
        }
    }

    /// Record invocation for rate limiting
    pub fn record_invocation(&mut self, capsule_id: &str, resource: &str) {
        if let Some(set) = self.permission_sets.get_mut(capsule_id) {
            set.record_invocation(resource);
        }
    }

    /// Unregister a capsule
    pub fn unregister_capsule(&mut self, capsule_id: &str) {
        self.permission_sets.remove(capsule_id);
    }

    /// Get permission set for a capsule
    pub fn get_permission_set(&self, capsule_id: &str) -> Option<&PermissionSet> {
        self.permission_sets.get(capsule_id)
    }
}

impl Default for PermissionChecker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_check_allowed() {
        let mut set = PermissionSet::new(vec![Permission {
            permission_type: PermissionType::ToolInvoke,
            resource: "test-tool".to_string(),
            actions: vec!["execute".to_string()],
            conditions: None,
        }]);

        let result = set.check(PermissionType::ToolInvoke, "test-tool", "execute");
        assert!(result.allowed);
        assert!(!result.requires_approval);
    }

    #[test]
    fn test_permission_check_denied() {
        let mut set = PermissionSet::new(vec![Permission {
            permission_type: PermissionType::ToolInvoke,
            resource: "test-tool".to_string(),
            actions: vec!["execute".to_string()],
            conditions: None,
        }]);

        let result = set.check(PermissionType::ToolInvoke, "other-tool", "execute");
        assert!(!result.allowed);
        assert!(result.reason.is_some());
    }

    #[test]
    fn test_permission_check_wildcard() {
        let mut set = PermissionSet::new(vec![Permission {
            permission_type: PermissionType::ToolInvoke,
            resource: "*".to_string(),
            actions: vec!["*".to_string()],
            conditions: None,
        }]);

        let result = set.check(PermissionType::ToolInvoke, "any-tool", "any-action");
        assert!(result.allowed);
    }

    #[test]
    fn test_permission_requires_approval() {
        let mut set = PermissionSet::new(vec![Permission {
            permission_type: PermissionType::ToolInvoke,
            resource: "sensitive-tool".to_string(),
            actions: vec!["execute".to_string()],
            conditions: Some(PermissionConditions {
                require_approval: true,
                max_invocations: None,
                rate_limit_per_minute: None,
                time_window: None,
                constraints: None,
            }),
        }]);

        let result = set.check(PermissionType::ToolInvoke, "sensitive-tool", "execute");
        assert!(result.allowed);
        assert!(result.requires_approval);
    }

    #[test]
    fn test_rate_limiting() {
        let mut set = PermissionSet::new(vec![Permission {
            permission_type: PermissionType::ToolInvoke,
            resource: "limited-tool".to_string(),
            actions: vec!["execute".to_string()],
            conditions: Some(PermissionConditions {
                require_approval: false,
                max_invocations: Some(2),
                rate_limit_per_minute: None,
                time_window: None,
                constraints: None,
            }),
        }]);

        // First two should succeed
        let result1 = set.check(PermissionType::ToolInvoke, "limited-tool", "execute");
        assert!(result1.allowed);
        set.record_invocation("limited-tool");

        let result2 = set.check(PermissionType::ToolInvoke, "limited-tool", "execute");
        assert!(result2.allowed);
        set.record_invocation("limited-tool");

        // Third should fail (max invocations exceeded)
        let result3 = set.check(PermissionType::ToolInvoke, "limited-tool", "execute");
        assert!(!result3.allowed);
    }
}
