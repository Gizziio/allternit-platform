//! # Allternitchitech Tool Registry
//!
//! Dynamic tool discovery, registration, and resolution.
//!
//! ## Purpose
//!
//! The tool registry provides:
//! - **Discovery**: Find tools by name, capability, or publisher
//! - **Registration**: Add new tools at runtime without kernel rebuild
//! - **Resolution**: Resolve tool references to capsules
//! - **Versioning**: Manage multiple versions of tools
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                    ToolRegistry                         │
//! │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
//! │  │  Discovery  │  │  Resolver   │  │  Publisher      │ │
//! │  │   Index     │  │             │  │  Trust Store    │ │
//! │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
//! │         │                │                   │          │
//! │         └────────────────┼───────────────────┘          │
//! │                          ▼                              │
//! │  ┌─────────────────────────────────────────────────┐   │
//! │  │                 CapsuleStore                     │   │
//! │  └─────────────────────────────────────────────────┘   │
//! └─────────────────────────────────────────────────────────┘
//! ```

use allternit_capsule::{CapsuleManifest, CapsuleStore, ContentHash, SafetyTier, VerifyingKey};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use semver::{Version, VersionReq};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use thiserror::Error;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Result type for registry operations.
pub type RegistryResult<T> = Result<T, RegistryError>;

/// Errors that can occur in the tool registry.
#[derive(Error, Debug)]
pub enum RegistryError {
    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Version not found: {0}@{1}")]
    VersionNotFound(String, String),

    #[error("Publisher not trusted: {0}")]
    UntrustedPublisher(String),

    #[error("Tool already registered: {0}")]
    AlreadyRegistered(String),

    #[error("Invalid query: {0}")]
    InvalidQuery(String),

    #[error("Capsule error: {0}")]
    CapsuleError(#[from] allternit_capsule::CapsuleError),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// A descriptor for a registered tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDescriptor {
    /// Unique tool ID (from capsule)
    pub id: String,

    /// Human-readable name
    pub name: String,

    /// Description
    pub description: String,

    /// Available versions
    pub versions: Vec<Version>,

    /// Latest stable version
    pub latest_version: Version,

    /// Publisher ID
    pub publisher_id: String,

    /// Whether the publisher is trusted
    pub publisher_trusted: bool,

    /// Required capabilities
    pub capabilities: Vec<String>,

    /// Safety tier
    pub safety_tier: SafetyTier,

    /// Keywords for discovery
    pub keywords: Vec<String>,

    /// When first registered
    pub registered_at: DateTime<Utc>,

    /// When last updated
    pub updated_at: DateTime<Utc>,
}

/// Query for discovering tools.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ToolQuery {
    /// Match by name (partial)
    pub name: Option<String>,

    /// Match by capability requirement
    pub capability: Option<String>,

    /// Match by publisher
    pub publisher: Option<String>,

    /// Match by keyword
    pub keyword: Option<String>,

    /// Filter by safety tier
    pub max_safety_tier: Option<SafetyTier>,

    /// Only trusted publishers
    pub trusted_only: bool,

    /// Maximum results
    pub limit: Option<usize>,
}

impl ToolQuery {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    pub fn with_capability(mut self, capability: impl Into<String>) -> Self {
        self.capability = Some(capability.into());
        self
    }

    pub fn with_publisher(mut self, publisher: impl Into<String>) -> Self {
        self.publisher = Some(publisher.into());
        self
    }

    pub fn trusted_only(mut self) -> Self {
        self.trusted_only = true;
        self
    }

    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }
}

/// Trusted publisher entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustedPublisher {
    /// Publisher ID
    pub id: String,

    /// Display name
    pub name: String,

    /// Verifying key
    pub public_key: String,

    /// When trust was established
    pub trusted_since: DateTime<Utc>,

    /// Trust level
    pub trust_level: TrustLevel,
}

/// Trust level for publishers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrustLevel {
    /// Fully trusted (system publisher)
    System,

    /// Verified organization
    Verified,

    /// Community publisher (basic trust)
    Community,

    /// Untrusted (requires explicit approval)
    Untrusted,
}

/// The main tool registry.
pub struct ToolRegistry {
    /// Capsule store for retrieving tool bundles
    capsule_store: Arc<CapsuleStore>,

    /// Index of registered tools
    tools: Arc<RwLock<HashMap<String, ToolEntry>>>,

    /// Trusted publishers
    trusted_publishers: Arc<RwLock<HashMap<String, TrustedPublisher>>>,

    /// Discovery indexes
    by_capability: Arc<RwLock<HashMap<String, HashSet<String>>>>,
    by_keyword: Arc<RwLock<HashMap<String, HashSet<String>>>>,
    by_publisher: Arc<RwLock<HashMap<String, HashSet<String>>>>,
}

/// Internal entry for a registered tool.
struct ToolEntry {
    descriptor: ToolDescriptor,
    versions: HashMap<Version, ContentHash>,
}

impl ToolRegistry {
    /// Create a new tool registry.
    pub fn new(capsule_store: Arc<CapsuleStore>) -> Self {
        Self {
            capsule_store,
            tools: Arc::new(RwLock::new(HashMap::new())),
            trusted_publishers: Arc::new(RwLock::new(HashMap::new())),
            by_capability: Arc::new(RwLock::new(HashMap::new())),
            by_keyword: Arc::new(RwLock::new(HashMap::new())),
            by_publisher: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a tool from its manifest.
    pub fn register(&self, manifest: &CapsuleManifest) -> RegistryResult<()> {
        let tool_id = &manifest.id;
        let version = &manifest.version;

        info!("Registering tool: {}@{}", tool_id, version);

        // Check publisher trust
        let publisher_trusted = self.is_publisher_trusted(&manifest.signature.publisher_id);

        // Build capability list
        let capabilities = self.extract_capabilities(manifest);

        // Update or create entry
        let mut tools = self
            .tools
            .write()
            .map_err(|_| RegistryError::Internal("Lock poisoned".into()))?;

        if let Some(entry) = tools.get_mut(tool_id) {
            // Update existing tool
            entry.versions.insert(version.clone(), manifest.content_hash.clone());

            // Update latest if this is newer
            if version > &entry.descriptor.latest_version {
                entry.descriptor.latest_version = version.clone();
            }

            entry.descriptor.versions.push(version.clone());
            entry.descriptor.versions.sort();
            entry.descriptor.updated_at = Utc::now();
        } else {
            // New tool registration
            let descriptor = ToolDescriptor {
                id: tool_id.clone(),
                name: manifest.name.clone(),
                description: manifest.description.clone(),
                versions: vec![version.clone()],
                latest_version: version.clone(),
                publisher_id: manifest.signature.publisher_id.clone(),
                publisher_trusted,
                capabilities: capabilities.clone(),
                safety_tier: manifest.tool_abi.safety_tier,
                keywords: manifest.keywords.clone(),
                registered_at: Utc::now(),
                updated_at: Utc::now(),
            };

            let entry = ToolEntry {
                descriptor,
                versions: [(version.clone(), manifest.content_hash.clone())].into_iter().collect(),
            };

            tools.insert(tool_id.clone(), entry);
        }

        drop(tools);

        // Update indexes
        self.index_tool(tool_id, &capabilities, &manifest.keywords, &manifest.signature.publisher_id)?;

        Ok(())
    }

    /// Discover tools matching a query.
    pub fn discover(&self, query: &ToolQuery) -> RegistryResult<Vec<ToolDescriptor>> {
        let tools = self
            .tools
            .read()
            .map_err(|_| RegistryError::Internal("Lock poisoned".into()))?;

        let mut results: Vec<_> = tools
            .values()
            .filter(|entry| self.matches_query(&entry.descriptor, query))
            .map(|entry| entry.descriptor.clone())
            .collect();

        // Sort by relevance (name match first, then by update time)
        if let Some(ref name) = query.name {
            results.sort_by(|a, b| {
                let a_exact = a.name.to_lowercase() == name.to_lowercase();
                let b_exact = b.name.to_lowercase() == name.to_lowercase();
                match (a_exact, b_exact) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => b.updated_at.cmp(&a.updated_at),
                }
            });
        } else {
            results.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        }

        // Apply limit
        if let Some(limit) = query.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    /// Resolve a tool reference to its content hash.
    pub fn resolve(
        &self,
        tool_id: &str,
        version_req: Option<&VersionReq>,
    ) -> RegistryResult<(Version, ContentHash)> {
        let tools = self
            .tools
            .read()
            .map_err(|_| RegistryError::Internal("Lock poisoned".into()))?;

        let entry = tools
            .get(tool_id)
            .ok_or_else(|| RegistryError::ToolNotFound(tool_id.into()))?;

        let version = match version_req {
            Some(req) => {
                // Find best matching version
                entry
                    .descriptor
                    .versions
                    .iter()
                    .filter(|v| req.matches(v))
                    .max()
                    .cloned()
                    .ok_or_else(|| {
                        RegistryError::VersionNotFound(tool_id.into(), req.to_string())
                    })?
            }
            None => entry.descriptor.latest_version.clone(),
        };

        let hash = entry
            .versions
            .get(&version)
            .cloned()
            .ok_or_else(|| RegistryError::VersionNotFound(tool_id.into(), version.to_string()))?;

        Ok((version, hash))
    }

    /// Get a tool descriptor by ID.
    pub fn get(&self, tool_id: &str) -> RegistryResult<ToolDescriptor> {
        let tools = self
            .tools
            .read()
            .map_err(|_| RegistryError::Internal("Lock poisoned".into()))?;

        tools
            .get(tool_id)
            .map(|e| e.descriptor.clone())
            .ok_or_else(|| RegistryError::ToolNotFound(tool_id.into()))
    }

    /// List all registered tool IDs.
    pub fn list(&self) -> RegistryResult<Vec<String>> {
        let tools = self
            .tools
            .read()
            .map_err(|_| RegistryError::Internal("Lock poisoned".into()))?;

        Ok(tools.keys().cloned().collect())
    }

    /// Add a trusted publisher.
    pub fn trust_publisher(&self, publisher: TrustedPublisher) -> RegistryResult<()> {
        let mut publishers = self
            .trusted_publishers
            .write()
            .map_err(|_| RegistryError::Internal("Lock poisoned".into()))?;

        info!("Trusting publisher: {} ({})", publisher.name, publisher.id);
        publishers.insert(publisher.id.clone(), publisher);

        Ok(())
    }

    /// Check if a publisher is trusted.
    pub fn is_publisher_trusted(&self, publisher_id: &str) -> bool {
        self.trusted_publishers
            .read()
            .map(|p| p.contains_key(publisher_id))
            .unwrap_or(false)
    }

    /// Unregister a tool.
    pub fn unregister(&self, tool_id: &str) -> RegistryResult<()> {
        let mut tools = self
            .tools
            .write()
            .map_err(|_| RegistryError::Internal("Lock poisoned".into()))?;

        if tools.remove(tool_id).is_none() {
            return Err(RegistryError::ToolNotFound(tool_id.into()));
        }

        info!("Unregistered tool: {}", tool_id);
        Ok(())
    }

    // Private helpers

    fn matches_query(&self, desc: &ToolDescriptor, query: &ToolQuery) -> bool {
        // Name filter
        if let Some(ref name) = query.name {
            let name_lower = name.to_lowercase();
            if !desc.name.to_lowercase().contains(&name_lower)
                && !desc.id.to_lowercase().contains(&name_lower)
            {
                return false;
            }
        }

        // Capability filter
        if let Some(ref cap) = query.capability {
            if !desc.capabilities.iter().any(|c| c.contains(cap)) {
                return false;
            }
        }

        // Publisher filter
        if let Some(ref pub_id) = query.publisher {
            if &desc.publisher_id != pub_id {
                return false;
            }
        }

        // Keyword filter
        if let Some(ref keyword) = query.keyword {
            let kw_lower = keyword.to_lowercase();
            if !desc.keywords.iter().any(|k| k.to_lowercase().contains(&kw_lower)) {
                return false;
            }
        }

        // Safety tier filter
        if let Some(max_tier) = query.max_safety_tier {
            if !matches!(
                (desc.safety_tier, max_tier),
                (SafetyTier::Safe, _)
                    | (SafetyTier::Moderate, SafetyTier::Moderate | SafetyTier::Dangerous | SafetyTier::Critical)
                    | (SafetyTier::Dangerous, SafetyTier::Dangerous | SafetyTier::Critical)
                    | (SafetyTier::Critical, SafetyTier::Critical)
            ) {
                return false;
            }
        }

        // Trusted only filter
        if query.trusted_only && !desc.publisher_trusted {
            return false;
        }

        true
    }

    fn extract_capabilities(&self, manifest: &CapsuleManifest) -> Vec<String> {
        let mut caps = Vec::new();

        if manifest.capabilities.filesystem.is_some() {
            caps.push("filesystem".into());
        }
        if manifest.capabilities.network.is_some() {
            caps.push("network".into());
        }
        if manifest.capabilities.needs_clock {
            caps.push("clock".into());
        }
        if manifest.capabilities.needs_random {
            caps.push("random".into());
        }
        if manifest.capabilities.subprocess.is_some() {
            caps.push("subprocess".into());
        }
        if !manifest.capabilities.env_vars.is_empty() {
            caps.push("environment".into());
        }

        caps
    }

    fn index_tool(
        &self,
        tool_id: &str,
        capabilities: &[String],
        keywords: &[String],
        publisher_id: &str,
    ) -> RegistryResult<()> {
        // Index by capability
        if let Ok(mut index) = self.by_capability.write() {
            for cap in capabilities {
                index
                    .entry(cap.clone())
                    .or_default()
                    .insert(tool_id.to_string());
            }
        }

        // Index by keyword
        if let Ok(mut index) = self.by_keyword.write() {
            for kw in keywords {
                index
                    .entry(kw.to_lowercase())
                    .or_default()
                    .insert(tool_id.to_string());
            }
        }

        // Index by publisher
        if let Ok(mut index) = self.by_publisher.write() {
            index
                .entry(publisher_id.to_string())
                .or_default()
                .insert(tool_id.to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_query_builder() {
        let query = ToolQuery::new()
            .with_name("file-reader")
            .with_capability("filesystem")
            .trusted_only()
            .with_limit(10);

        assert_eq!(query.name, Some("file-reader".into()));
        assert_eq!(query.capability, Some("filesystem".into()));
        assert!(query.trusted_only);
        assert_eq!(query.limit, Some(10));
    }
}
