//! Capsule manifest types.

use crate::content_hash::ContentHash;
use crate::signing::CapsuleSignature;
use chrono::{DateTime, Utc};
use semver::Version;
use serde::{Deserialize, Serialize};

/// The main capsule manifest.
///
/// Contains all metadata about a capsule including its
/// tool specification, capabilities, and signature.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleManifest {
    /// Unique identifier (reverse-DNS format: com.example.tools.file-reader)
    pub id: String,

    /// Semantic version
    pub version: Version,

    /// Human-readable name
    pub name: String,

    /// Description of what this tool does
    pub description: String,

    /// Tool ABI specification
    pub tool_abi: ToolABISpec,

    /// WASM component metadata
    pub wasm_component: WasmComponent,

    /// Required capabilities
    pub capabilities: Capabilities,

    /// Publisher signature
    pub signature: CapsuleSignature,

    /// Content hash of the entire bundle
    pub content_hash: ContentHash,

    /// When this capsule was created
    pub created_at: DateTime<Utc>,

    /// Optional homepage/documentation URL
    pub homepage: Option<String>,

    /// Optional license identifier (SPDX)
    pub license: Option<String>,

    /// Optional keywords for discovery
    pub keywords: Vec<String>,
}

impl CapsuleManifest {
    /// Get the full capsule ID with version.
    pub fn full_id(&self) -> String {
        format!("{}@{}", self.id, self.version)
    }

    /// Check if this is a pre-release version.
    pub fn is_prerelease(&self) -> bool {
        !self.version.pre.is_empty()
    }
}

/// Tool ABI specification.
///
/// Defines the interface contract for the tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolABISpec {
    /// Tool name (must match capsule ID)
    pub name: String,

    /// Human-readable description
    pub description: String,

    /// JSON Schema for input parameters
    pub input_schema: serde_json::Value,

    /// JSON Schema for output
    pub output_schema: serde_json::Value,

    /// Declared side effects
    pub side_effects: Vec<SideEffect>,

    /// Safety tier
    pub safety_tier: SafetyTier,

    /// Idempotency behavior
    pub idempotency: IdempotencyBehavior,

    /// Example invocations
    #[serde(default)]
    pub examples: Vec<ToolExample>,
}

/// Declared side effect types.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SideEffect {
    /// Reads from filesystem
    FilesystemRead,

    /// Writes to filesystem
    FilesystemWrite,

    /// Makes network requests
    Network,

    /// Spawns subprocesses
    Subprocess,

    /// Modifies environment
    Environment,

    /// Generates random values (non-deterministic)
    Random,

    /// Uses system clock
    Clock,

    /// Custom side effect
    Custom(String),
}

/// Safety tier classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SafetyTier {
    /// Pure computation, no side effects
    Safe,

    /// May have controlled side effects
    Moderate,

    /// Has significant side effects, requires careful review
    Dangerous,

    /// Can cause irreversible changes
    Critical,
}

impl SafetyTier {
    /// Get a human-readable description.
    pub fn description(&self) -> &'static str {
        match self {
            SafetyTier::Safe => "Pure computation with no side effects",
            SafetyTier::Moderate => "May have controlled, reversible side effects",
            SafetyTier::Dangerous => "Has significant side effects requiring review",
            SafetyTier::Critical => "Can cause irreversible or destructive changes",
        }
    }

    /// Check if this tier requires human approval.
    pub fn requires_approval(&self) -> bool {
        matches!(self, SafetyTier::Dangerous | SafetyTier::Critical)
    }
}

/// Idempotency behavior of the tool.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IdempotencyBehavior {
    /// Same inputs always produce same outputs, safe to retry
    Idempotent,

    /// Idempotent if idempotency key is provided
    IdempotentWithKey,

    /// Not idempotent, retries may have different effects
    NotIdempotent,
}

/// Example tool invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExample {
    /// Description of what this example demonstrates
    pub description: String,

    /// Input parameters (JSON)
    pub input: serde_json::Value,

    /// Expected output (JSON)
    pub expected_output: serde_json::Value,
}

/// WASM component metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmComponent {
    /// Path to WASM file within the bundle
    pub path: String,

    /// Content hash of the WASM file
    pub hash: ContentHash,

    /// Size in bytes
    pub size_bytes: u64,

    /// WIT world this component targets
    pub wit_world: String,

    /// Minimum required runtime version
    pub min_runtime_version: Option<Version>,
}

/// Capability requirements for the tool.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Capabilities {
    /// Filesystem access requirements
    #[serde(default)]
    pub filesystem: Option<FilesystemCapability>,

    /// Network access requirements
    #[serde(default)]
    pub network: Option<NetworkCapability>,

    /// Environment variable access
    #[serde(default)]
    pub env_vars: Vec<String>,

    /// Maximum memory in MB
    #[serde(default = "default_max_memory")]
    pub max_memory_mb: u32,

    /// Maximum execution time in ms
    #[serde(default = "default_max_execution_time")]
    pub max_execution_time_ms: u64,

    /// Whether clock access is needed
    #[serde(default)]
    pub needs_clock: bool,

    /// Whether random number generation is needed
    #[serde(default)]
    pub needs_random: bool,

    /// Whether subprocess spawning is needed
    #[serde(default)]
    pub subprocess: Option<SubprocessCapability>,
}

fn default_max_memory() -> u32 {
    64
}

fn default_max_execution_time() -> u64 {
    30_000
}

/// Filesystem capability requirements.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesystemCapability {
    /// Paths that need read access (glob patterns)
    #[serde(default)]
    pub read_paths: Vec<String>,

    /// Paths that need write access (glob patterns)
    #[serde(default)]
    pub write_paths: Vec<String>,
}

/// Network capability requirements.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkCapability {
    /// Allowed hosts (or "*" for any)
    pub allowed_hosts: Vec<String>,

    /// Allowed ports (empty = any)
    #[serde(default)]
    pub allowed_ports: Vec<u16>,

    /// Maximum requests per minute
    #[serde(default = "default_rate_limit")]
    pub max_requests_per_minute: u32,
}

fn default_rate_limit() -> u32 {
    60
}

/// Subprocess capability requirements.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubprocessCapability {
    /// Allowed commands
    pub allowed_commands: Vec<String>,

    /// Maximum concurrent subprocesses
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent: u32,
}

fn default_max_concurrent() -> u32 {
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safety_tier_approval() {
        assert!(!SafetyTier::Safe.requires_approval());
        assert!(!SafetyTier::Moderate.requires_approval());
        assert!(SafetyTier::Dangerous.requires_approval());
        assert!(SafetyTier::Critical.requires_approval());
    }

    #[test]
    fn test_full_id() {
        let manifest = CapsuleManifest {
            id: "com.example.test".into(),
            version: Version::parse("1.2.3").unwrap(),
            name: "Test".into(),
            description: "Test capsule".into(),
            tool_abi: ToolABISpec {
                name: "test".into(),
                description: "Test".into(),
                input_schema: serde_json::json!({}),
                output_schema: serde_json::json!({}),
                side_effects: vec![],
                safety_tier: SafetyTier::Safe,
                idempotency: IdempotencyBehavior::Idempotent,
                examples: vec![],
            },
            wasm_component: WasmComponent {
                path: "component.wasm".into(),
                hash: ContentHash::hash(b"test"),
                size_bytes: 1024,
                wit_world: "tool-component".into(),
                min_runtime_version: None,
            },
            capabilities: Capabilities::default(),
            signature: CapsuleSignature::placeholder(),
            content_hash: ContentHash::hash(b"test"),
            created_at: Utc::now(),
            homepage: None,
            license: Some("MIT".into()),
            keywords: vec![],
        };

        assert_eq!(manifest.full_id(), "com.example.test@1.2.3");
    }
}
