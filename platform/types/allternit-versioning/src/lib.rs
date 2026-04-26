//! # Allternit Versioning (N14)
//!
//! Schema versioning and backwards compatibility management.
//!
//! ## Features
//!
//! - Version tracking for all schema types
//! - Compatibility negotiation
//! - Migration support
//!
//! ## Shell UI Integration
//!
//! Control Center → Runtime Environment → Versioning:
//! - Schema versions displayed
//! - Compatibility warnings
//! - Migration recommendations

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Semantic version
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SchemaVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl SchemaVersion {
    pub fn new(major: u32, minor: u32, patch: u32) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }

    /// Parse from string (semver format)
    pub fn parse(version: &str) -> Result<Self, VersionError> {
        let parts: Vec<&str> = version.split('.').collect();
        if parts.len() != 3 {
            return Err(VersionError::InvalidFormat(version.to_string()));
        }
        
        let major = parts[0].parse().map_err(|_| VersionError::InvalidFormat(version.to_string()))?;
        let minor = parts[1].parse().map_err(|_| VersionError::InvalidFormat(version.to_string()))?;
        let patch = parts[2].parse().map_err(|_| VersionError::InvalidFormat(version.to_string()))?;
        
        Ok(Self { major, minor, patch })
    }

    /// Check if this version is compatible with another
    /// (same major, greater or equal minor)
    pub fn is_compatible_with(&self, other: &SchemaVersion) -> bool {
        self.major == other.major && self.minor >= other.minor
    }

    /// Check if this is a newer version than another
    pub fn is_newer_than(&self, other: &SchemaVersion) -> bool {
        (self.major > other.major)
            || (self.major == other.major && self.minor > other.minor)
            || (self.major == other.major && self.minor == other.minor && self.patch > other.patch)
    }
}

impl fmt::Display for SchemaVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

impl Default for SchemaVersion {
    fn default() -> Self {
        Self::new(0, 1, 0)
    }
}

use std::fmt;

/// Versioned component types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComponentType {
    EnvironmentSpec,
    DriverInterface,
    PolicySchema,
    SchedulerSemantics,
    ReceiptFormat,
    SpawnSpec,
    CommandSpec,
}

impl fmt::Display for ComponentType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ComponentType::EnvironmentSpec => write!(f, "environment_spec"),
            ComponentType::DriverInterface => write!(f, "driver_interface"),
            ComponentType::PolicySchema => write!(f, "policy_schema"),
            ComponentType::SchedulerSemantics => write!(f, "scheduler_semantics"),
            ComponentType::ReceiptFormat => write!(f, "receipt_format"),
            ComponentType::SpawnSpec => write!(f, "spawn_spec"),
            ComponentType::CommandSpec => write!(f, "command_spec"),
        }
    }
}

/// Component version info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentVersionInfo {
    pub component: ComponentType,
    pub current: SchemaVersion,
    pub minimum_supported: SchemaVersion,
    pub deprecation_date: Option<chrono::DateTime<chrono::Utc>>,
}

/// Version registry
pub struct VersionRegistry {
    versions: HashMap<ComponentType, ComponentVersionInfo>,
}

impl VersionRegistry {
    pub fn new() -> Self {
        let mut versions = HashMap::new();

        // Initialize with default versions
        versions.insert(
            ComponentType::DriverInterface,
            ComponentVersionInfo {
                component: ComponentType::DriverInterface,
                current: SchemaVersion::new(0, 1, 0),
                minimum_supported: SchemaVersion::new(0, 1, 0),
                deprecation_date: None,
            },
        );

        versions.insert(
            ComponentType::EnvironmentSpec,
            ComponentVersionInfo {
                component: ComponentType::EnvironmentSpec,
                current: SchemaVersion::new(0, 1, 0),
                minimum_supported: SchemaVersion::new(0, 1, 0),
                deprecation_date: None,
            },
        );

        versions.insert(
            ComponentType::PolicySchema,
            ComponentVersionInfo {
                component: ComponentType::PolicySchema,
                current: SchemaVersion::new(0, 1, 0),
                minimum_supported: SchemaVersion::new(0, 1, 0),
                deprecation_date: None,
            },
        );

        Self { versions }
    }

    /// Register a component version
    pub fn register(&mut self, info: ComponentVersionInfo) {
        self.versions.insert(info.component, info);
    }

    /// Get version info for a component
    pub fn get(&self, component: ComponentType) -> Option<&ComponentVersionInfo> {
        self.versions.get(&component)
    }

    /// Check if a version is supported
    pub fn is_supported(&self, component: ComponentType, version: &SchemaVersion) -> bool {
        let Some(info) = self.versions.get(&component) else {
            return false;
        };
        
        version.major == info.minimum_supported.major
            && version.minor >= info.minimum_supported.minor
    }

    /// Check compatibility between two versions
    pub fn check_compatibility(
        &self,
        component: ComponentType,
        provided: &SchemaVersion,
    ) -> CompatibilityResult {
        let Some(info) = self.versions.get(&component) else {
            return CompatibilityResult::UnknownComponent;
        };

        if provided.major != info.current.major {
            return CompatibilityResult::Incompatible {
                reason: format!(
                    "Major version mismatch: {} vs {}",
                    provided.major, info.current.major
                ),
            };
        }

        if provided.minor < info.minimum_supported.minor {
            return CompatibilityResult::Unsupported {
                minimum_required: info.minimum_supported.clone(),
            };
        }

        if provided.minor < info.current.minor {
            return CompatibilityResult::CompatibleButOld {
                current: info.current.clone(),
            };
        }

        CompatibilityResult::FullyCompatible
    }

    /// List all registered components
    pub fn list_components(&self) -> Vec<&ComponentVersionInfo> {
        self.versions.values().collect()
    }

    /// Negotiate a compatible version
    pub fn negotiate_version(
        &self,
        component: ComponentType,
        offered: &SchemaVersion,
    ) -> Result<SchemaVersion, VersionError> {
        let info = self.versions
            .get(&component)
            .ok_or_else(|| VersionError::UnknownComponent(format!("{:?}", component)))?;

        if offered.major != info.current.major {
            return Err(VersionError::Incompatible {
                offered: offered.clone(),
                current: info.current.clone(),
            });
        }

        // Use the minimum of offered and current
        let negotiated = if offered.minor > info.current.minor {
            info.current.clone()
        } else {
            offered.clone()
        };

        Ok(negotiated)
    }
}

impl Default for VersionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Compatibility check result
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompatibilityResult {
    FullyCompatible,
    CompatibleButOld { current: SchemaVersion },
    Incompatible { reason: String },
    Unsupported { minimum_required: SchemaVersion },
    UnknownComponent,
}

/// Version error
#[derive(Debug, thiserror::Error)]
pub enum VersionError {
    #[error("Invalid version format: {0}")]
    InvalidFormat(String),
    
    #[error("Unknown component: {0}")]
    UnknownComponent(String),
    
    #[error("Incompatible version: offered {offered}, current {current}")]
    Incompatible { offered: SchemaVersion, current: SchemaVersion },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_parsing() {
        let v = SchemaVersion::parse("1.2.3").unwrap();
        assert_eq!(v.major, 1);
        assert_eq!(v.minor, 2);
        assert_eq!(v.patch, 3);
    }

    #[test]
    fn test_version_compatibility() {
        let v1 = SchemaVersion::new(1, 2, 0);
        let v2 = SchemaVersion::new(1, 3, 0);
        
        assert!(v2.is_compatible_with(&v1));
        assert!(!v1.is_compatible_with(&v2));
    }

    #[test]
    fn test_registry_compatibility() {
        let registry = VersionRegistry::new();
        
        let result = registry.check_compatibility(
            ComponentType::DriverInterface,
            &SchemaVersion::new(0, 1, 0),
        );
        
        assert!(matches!(result, CompatibilityResult::FullyCompatible));
    }
}
