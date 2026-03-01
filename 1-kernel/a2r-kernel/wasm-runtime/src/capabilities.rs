//! Capability-based security model for WASM tools.
//!
//! Follows WASI's capability-based security: tools have ZERO capabilities
//! by default and must be explicitly granted access to resources.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

/// A specific capability that can be granted to a tool.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "config")]
pub enum Capability {
    /// Read access to filesystem paths (glob patterns)
    FilesystemRead { paths: Vec<String> },

    /// Write access to filesystem paths (glob patterns)
    FilesystemWrite { paths: Vec<String> },

    /// Network access to specific hosts/ports
    Network {
        allowed_hosts: Vec<String>,
        allowed_ports: Vec<u16>,
    },

    /// Access to specific environment variables
    Environment { allowed_vars: Vec<String> },

    /// Access to system clock (for timing)
    Clock,

    /// Access to random number generation
    Random,

    /// Access to stdout/stderr
    Stdio,

    /// Ability to spawn subprocesses (heavily restricted)
    Subprocess {
        allowed_commands: Vec<String>,
        max_concurrent: u32,
    },

    /// Access to HTTP client functionality
    HttpClient {
        allowed_hosts: Vec<String>,
        max_requests_per_minute: u32,
    },

    /// Custom capability for extension
    Custom {
        name: String,
        config: serde_json::Value,
    },
}

impl Capability {
    /// Get a human-readable name for this capability type
    pub fn type_name(&self) -> &str {
        match self {
            Capability::FilesystemRead { .. } => "filesystem:read",
            Capability::FilesystemWrite { .. } => "filesystem:write",
            Capability::Network { .. } => "network",
            Capability::Environment { .. } => "environment",
            Capability::Clock => "clock",
            Capability::Random => "random",
            Capability::Stdio => "stdio",
            Capability::Subprocess { .. } => "subprocess",
            Capability::HttpClient { .. } => "http_client",
            Capability::Custom { name, .. } => name,
        }
    }
}

/// A grant of capabilities to a specific capsule/tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityGrant {
    /// Unique identifier for this grant
    pub grant_id: Uuid,

    /// The capsule this grant applies to
    pub capsule_id: String,

    /// Tenant/user this grant belongs to
    pub tenant_id: String,

    /// The capabilities being granted
    pub granted_capabilities: Vec<Capability>,

    /// Additional constraints on the grant
    pub constraints: Vec<CapabilityConstraint>,

    /// When this grant expires (None = never)
    pub expires_at: Option<DateTime<Utc>>,

    /// Who granted these capabilities
    pub granted_by: String,

    /// When the grant was created
    pub granted_at: DateTime<Utc>,
}

impl CapabilityGrant {
    /// Create a new minimal grant (no capabilities)
    pub fn minimal(capsule_id: String, tenant_id: String, granted_by: String) -> Self {
        Self {
            grant_id: Uuid::new_v4(),
            capsule_id,
            tenant_id,
            granted_capabilities: Vec::new(),
            constraints: Vec::new(),
            expires_at: None,
            granted_by,
            granted_at: Utc::now(),
        }
    }

    /// Add a capability to this grant
    pub fn with_capability(mut self, capability: Capability) -> Self {
        self.granted_capabilities.push(capability);
        self
    }

    /// Add an expiration time
    pub fn with_expiry(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }

    /// Check if the grant has expired
    pub fn is_expired(&self) -> bool {
        self.expires_at.map(|exp| Utc::now() > exp).unwrap_or(false)
    }

    /// Check if a specific capability is granted
    pub fn has_capability(&self, capability: &Capability) -> bool {
        if self.is_expired() {
            return false;
        }
        self.granted_capabilities.iter().any(|c| c == capability)
    }

    /// Check if a capability type is granted (ignoring specific config)
    pub fn has_capability_type(&self, type_name: &str) -> bool {
        if self.is_expired() {
            return false;
        }
        self.granted_capabilities
            .iter()
            .any(|c| c.type_name() == type_name)
    }
}

/// Constraints that can be applied to capability grants.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum CapabilityConstraint {
    /// Maximum execution time in milliseconds
    MaxExecutionTime(u64),

    /// Maximum memory usage in bytes
    MaxMemory(u64),

    /// Maximum number of invocations
    MaxInvocations(u64),

    /// Require specific session context
    RequireSession(String),

    /// Time window constraint (only valid during certain hours)
    TimeWindow {
        start_hour: u8,
        end_hour: u8,
        timezone: String,
    },

    /// Rate limit (max calls per time window)
    RateLimit { max_calls: u64, window_seconds: u64 },
}

/// A set of capabilities for easy checking.
#[derive(Debug, Clone, Default)]
pub struct CapabilitySet {
    capabilities: HashSet<String>,
    detailed: Vec<Capability>,
}

impl CapabilitySet {
    /// Create an empty capability set (default deny)
    pub fn empty() -> Self {
        Self::default()
    }

    /// Create from a capability grant
    pub fn from_grant(grant: &CapabilityGrant) -> Self {
        let capabilities = grant
            .granted_capabilities
            .iter()
            .map(|c| c.type_name().to_string())
            .collect();
        let detailed = grant.granted_capabilities.clone();
        Self {
            capabilities,
            detailed,
        }
    }

    /// Check if a capability type is present
    pub fn has(&self, type_name: &str) -> bool {
        self.capabilities.contains(type_name)
    }

    /// Get the detailed capability config if present
    pub fn get(&self, type_name: &str) -> Option<&Capability> {
        self.detailed.iter().find(|c| c.type_name() == type_name)
    }

    /// Check if network access is allowed for a host
    pub fn can_access_host(&self, host: &str, port: u16) -> bool {
        self.detailed.iter().any(|c| match c {
            Capability::Network {
                allowed_hosts,
                allowed_ports,
            } => {
                let host_ok = allowed_hosts.iter().any(|h| h == "*" || h == host);
                let port_ok = allowed_ports.is_empty() || allowed_ports.contains(&port);
                host_ok && port_ok
            }
            _ => false,
        })
    }

    /// Check if HTTP client access is allowed for a host
    pub fn can_access_http_host(&self, host: &str, port: u16) -> bool {
        self.detailed.iter().any(|c| match c {
            Capability::HttpClient {
                allowed_hosts,
                max_requests_per_minute: _,
            } => allowed_hosts.iter().any(|h| h == "*" || h == host),
            _ => false,
        })
    }

    /// Check if filesystem read is allowed for a path
    pub fn can_read_path(&self, path: &str) -> bool {
        self.detailed.iter().any(|c| match c {
            Capability::FilesystemRead { paths } => {
                paths.iter().any(|pattern| glob_match(pattern, path))
            }
            _ => false,
        })
    }

    /// Check if filesystem write is allowed for a path
    pub fn can_write_path(&self, path: &str) -> bool {
        self.detailed.iter().any(|c| match c {
            Capability::FilesystemWrite { paths } => {
                paths.iter().any(|pattern| glob_match(pattern, path))
            }
            _ => false,
        })
    }
}

/// Simple glob matching for capability paths.
fn glob_match(pattern: &str, path: &str) -> bool {
    if pattern == "*" || pattern == "**" {
        return true;
    }
    if pattern.ends_with("/*") {
        let prefix = &pattern[..pattern.len() - 2];
        return path.starts_with(prefix);
    }
    if pattern.ends_with("/**") {
        let prefix = &pattern[..pattern.len() - 3];
        return path.starts_with(prefix);
    }
    pattern == path
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimal_grant_has_no_capabilities() {
        let grant =
            CapabilityGrant::minimal("test-capsule".into(), "test-tenant".into(), "system".into());
        assert!(grant.granted_capabilities.is_empty());
        assert!(!grant.has_capability_type("filesystem:read"));
    }

    #[test]
    fn test_grant_with_capability() {
        let grant =
            CapabilityGrant::minimal("test-capsule".into(), "test-tenant".into(), "system".into())
                .with_capability(Capability::Clock);

        assert!(grant.has_capability_type("clock"));
        assert!(!grant.has_capability_type("random"));
    }

    #[test]
    fn test_capability_set_path_matching() {
        let grant = CapabilityGrant::minimal("test".into(), "test".into(), "system".into())
            .with_capability(Capability::FilesystemRead {
                paths: vec!["/tmp/*".into(), "/data/**".into()],
            });

        let set = CapabilitySet::from_grant(&grant);
        assert!(set.can_read_path("/tmp/file.txt"));
        assert!(set.can_read_path("/data/deep/nested/file.txt"));
        assert!(!set.can_read_path("/etc/passwd"));
    }
}
