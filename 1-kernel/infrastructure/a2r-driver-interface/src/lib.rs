//! # A2R Execution Driver Interface (N3)
//!
//! Core trait definitions for all execution drivers in the A2R platform.
//! This crate provides the abstraction layer that separates the control plane
//! from execution substrate implementations.
//!
//! ## Architecture
//!
//! ```text
//! Control Plane (Rails)
//!     ↓
//! Driver Interface (this crate)
//!     ↓
//! Driver Implementations:
//!   - Process Driver (dev/testing)
//!   - MicroVM Driver (Firecracker/Kata)
//!   - Container Driver (gVisor)
//!   - WASM Driver (Wasmtime)
//! ```
//!
//! ## Integration with Shell UI
//!
//! The driver interface exposes configuration that maps to:
//! - Control Center → Runtime Environment section
//! - Settings → Advanced → Driver Selection
//! - Settings → Environment → Resource Limits

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use thiserror::Error;
use uuid::Uuid;

/// Unique identifier for an execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ExecutionId(pub Uuid);

impl ExecutionId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for ExecutionId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for ExecutionId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Tenant identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TenantId(pub String);

impl TenantId {
    pub fn new(id: impl Into<String>) -> Result<Self, DriverError> {
        let id = id.into();
        if id.is_empty() || id.len() > 63 {
            return Err(DriverError::InvalidInput {
                field: "tenant_id".to_string(),
                reason: "must be 1-63 characters".to_string(),
            });
        }
        Ok(Self(id))
    }
}

impl fmt::Display for TenantId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Driver type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DriverType {
    /// Firecracker/Kata microVMs - Maximum isolation
    MicroVM,
    /// gVisor/standard containers - Hardened isolation
    Container,
    /// OS processes - Limited isolation (dev only)
    Process,
    /// WebAssembly runtime - Sandboxed
    Wasm,
}

impl fmt::Display for DriverType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DriverType::MicroVM => write!(f, "microvm"),
            DriverType::Container => write!(f, "container"),
            DriverType::Process => write!(f, "process"),
            DriverType::Wasm => write!(f, "wasm"),
        }
    }
}

impl std::str::FromStr for DriverType {
    type Err = DriverError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "microvm" => Ok(DriverType::MicroVM),
            "container" => Ok(DriverType::Container),
            "process" => Ok(DriverType::Process),
            "wasm" => Ok(DriverType::Wasm),
            _ => Err(DriverError::InvalidInput {
                field: "driver_type".to_string(),
                reason: format!("unknown driver type: {}", s),
            }),
        }
    }
}

/// Isolation level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IsolationLevel {
    /// MicroVM + network isolation - for public marketplace
    Maximum,
    /// Container + seccomp - for partner integrations
    Hardened,
    /// Standard container - for internal use
    Standard,
    /// Process isolation - for dev/testing only
    Limited,
}

impl IsolationLevel {
    /// Get the driver types that support this isolation level
    pub fn supported_drivers(&self) -> Vec<DriverType> {
        match self {
            IsolationLevel::Maximum => vec![DriverType::MicroVM],
            IsolationLevel::Hardened => vec![DriverType::MicroVM, DriverType::Container],
            IsolationLevel::Standard => vec![DriverType::Container, DriverType::Wasm],
            IsolationLevel::Limited => vec![DriverType::Process, DriverType::Wasm],
        }
    }
}

/// Resource allocation specification
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ResourceSpec {
    /// CPU allocation in millicores (1000 = 1 core)
    #[serde(default)]
    pub cpu_millis: u32,
    /// Memory allocation in MiB
    #[serde(default)]
    pub memory_mib: u32,
    /// Ephemeral disk allocation in MiB
    #[serde(default)]
    pub disk_mib: Option<u32>,
    /// Network egress limit in KiB
    #[serde(default)]
    pub network_egress_kib: Option<u64>,
    /// Number of GPU devices
    #[serde(default)]
    pub gpu_count: Option<u8>,
}

impl ResourceSpec {
    /// Minimal resources for dev/testing
    pub fn minimal() -> Self {
        Self {
            cpu_millis: 100,
            memory_mib: 64,
            disk_mib: Some(100),
            network_egress_kib: None,
            gpu_count: None,
        }
    }

    /// Standard resources for production workloads
    pub fn standard() -> Self {
        Self {
            cpu_millis: 1000,
            memory_mib: 2048,
            disk_mib: Some(10240),
            network_egress_kib: Some(1048576), // 1 GiB
            gpu_count: None,
        }
    }

    /// High-performance resources
    pub fn high_performance() -> Self {
        Self {
            cpu_millis: 4000,
            memory_mib: 8192,
            disk_mib: Some(51200),
            network_egress_kib: Some(10485760), // 10 GiB
            gpu_count: Some(1),
        }
    }
}

/// Environment specification types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum EnvSpecType {
    /// OCI container image (default)
    #[default]
    Oci,
    /// Nix flake reference
    Nix,
    /// Dev Containers specification
    Devcontainer,
    /// WebAssembly module
    Wasm,
}

/// Mount specification for environment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MountSpec {
    pub source: String,
    pub target: String,
    #[serde(default)]
    pub read_only: bool,
    #[serde(default)]
    pub mount_type: MountType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MountType {
    #[default]
    Bind,
    Volume,
    Tmpfs,
    Secret,
}

/// Environment specification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct EnvironmentSpec {
    #[serde(default)]
    pub spec_type: EnvSpecType,
    #[serde(default)]
    pub image: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub packages: Vec<String>,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub mounts: Vec<MountSpec>,
}

/// Network policy for execution
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct NetworkPolicy {
    #[serde(default)]
    pub egress_allowed: bool,
    #[serde(default)]
    pub allowed_hosts: Vec<String>,
    #[serde(default)]
    pub allowed_ports: Vec<u16>,
    #[serde(default)]
    pub dns_allowed: bool,
}

/// File access policy
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct FilePolicy {
    #[serde(default)]
    pub read_paths: Vec<String>,
    #[serde(default)]
    pub write_paths: Vec<String>,
    #[serde(default = "default_true")]
    pub deny_dot_files: bool,
}

fn default_true() -> bool {
    true
}

/// Policy specification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicySpec {
    pub version: String,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
    #[serde(default)]
    pub denied_tools: Vec<String>,
    #[serde(default)]
    pub network_policy: NetworkPolicy,
    #[serde(default)]
    pub file_policy: FilePolicy,
    #[serde(default)]
    pub timeout_seconds: Option<u32>,
}

impl PolicySpec {
    /// Default permissive policy (for dev only)
    pub fn default_permissive() -> Self {
        Self {
            version: "0.1.0".to_string(),
            allowed_tools: vec!["*".to_string()],
            denied_tools: vec![],
            network_policy: NetworkPolicy {
                egress_allowed: true,
                allowed_hosts: vec!["*".to_string()],
                allowed_ports: vec![],
                dns_allowed: true,
            },
            file_policy: FilePolicy::default(),
            timeout_seconds: Some(3600),
        }
    }

    /// Restrictive default policy (for production)
    pub fn default_restrictive() -> Self {
        Self {
            version: "0.1.0".to_string(),
            allowed_tools: vec![],
            denied_tools: vec![],
            network_policy: NetworkPolicy::default(),
            file_policy: FilePolicy::default(),
            timeout_seconds: Some(300),
        }
    }
}

/// Determinism envelope for replay (N12)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterminismEnvelope {
    /// Hash of environment specification
    pub env_spec_hash: String,
    /// Tool versions used
    #[serde(default)]
    pub tool_versions: HashMap<String, String>,
    /// Hash of policy specification
    pub policy_hash: String,
    /// Hash of input bundle
    pub inputs_hash: String,
    /// Whether time is frozen
    #[serde(default)]
    pub time_frozen: bool,
    /// Random seed for reproducibility
    #[serde(default)]
    pub seed: Option<u64>,
}

/// Spawn specification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpawnSpec {
    pub tenant: TenantId,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub workspace: Option<String>,
    #[serde(default)]
    pub run_id: Option<ExecutionId>,
    pub env: EnvironmentSpec,
    pub policy: PolicySpec,
    pub resources: ResourceSpec,
    #[serde(default)]
    pub envelope: Option<DeterminismEnvelope>,
    /// Prewarm pool to source from (N16)
    #[serde(default)]
    pub prewarm_pool: Option<String>,
}

/// Command specification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommandSpec {
    pub command: Vec<String>,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub stdin_data: Option<Vec<u8>>,
    #[serde(default = "default_true")]
    pub capture_stdout: bool,
    #[serde(default = "default_true")]
    pub capture_stderr: bool,
}

/// Execution result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecResult {
    pub exit_code: i32,
    #[serde(default)]
    pub stdout: Option<Vec<u8>>,
    #[serde(default)]
    pub stderr: Option<Vec<u8>>,
    pub duration_ms: u64,
    #[serde(default)]
    pub resource_usage: ResourceConsumption,
}

/// Resource consumption metrics (N11)
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ResourceConsumption {
    /// CPU time used in millicore-seconds
    pub cpu_millis_used: u64,
    /// Peak memory usage in MiB
    pub memory_mib_peak: u32,
    /// Disk usage in MiB
    pub disk_mib_used: u32,
    /// Network egress in KiB
    pub network_egress_kib: u64,
}

/// Artifact produced by execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Artifact {
    pub path: String,
    pub hash: String, // Blake3 hash
    pub size: u64,
    #[serde(default)]
    pub content_type: Option<String>,
}

/// Execution receipt
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Receipt {
    pub run_id: ExecutionId,
    pub tenant: TenantId,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: chrono::DateTime<chrono::Utc>,
    pub exit_code: i32,
    pub env_spec_hash: String,
    pub policy_hash: String,
    pub inputs_hash: String,
    #[serde(default)]
    pub outputs_hash: Option<String>,
    pub resource_consumption: ResourceConsumption,
    #[serde(default)]
    pub artifacts: Vec<Artifact>,
}

/// Driver feature flags
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct DriverFeatures {
    #[serde(default)]
    pub snapshot: bool,
    #[serde(default)]
    pub live_restore: bool,
    #[serde(default)]
    pub gpu: bool,
    /// Supports prewarm pools (N16)
    #[serde(default)]
    pub prewarm: bool,
}

/// Driver capabilities advertisement
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DriverCapabilities {
    pub driver_type: DriverType,
    pub isolation: IsolationLevel,
    pub max_resources: ResourceSpec,
    #[serde(default)]
    pub supported_env_specs: Vec<EnvSpecType>,
    #[serde(default)]
    pub features: DriverFeatures,
}

/// Execution handle
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecutionHandle {
    pub id: ExecutionId,
    pub tenant: TenantId,
    #[serde(default)]
    pub driver_info: HashMap<String, String>,
    /// Environment specification used for this execution
    #[serde(default)]
    pub env_spec: EnvironmentSpec,
}

/// Driver errors
#[derive(Debug, Clone, Error, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DriverError {
    #[error("Invalid input: {field} - {reason}")]
    InvalidInput { field: String, reason: String },

    #[error("Insufficient resources: {resource}")]
    InsufficientResources { resource: String },

    #[error("Spawn failed: {reason}")]
    SpawnFailed { reason: String },

    #[error("Execution timeout after {timeout}s")]
    ExecTimeout { timeout: u32 },

    #[error("Policy violation: {policy}")]
    PolicyViolation { policy: String },

    #[error("Isolation breach detected")]
    IsolationBreach,

    #[error("Execution not found: {id}")]
    NotFound { id: String },

    #[error("Feature not supported: {feature}")]
    NotSupported { feature: String },

    #[error("Internal driver error: {message}")]
    InternalError { message: String },
}

/// Log entry from execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LogEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub stream: LogStream,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogStream {
    Stdout,
    Stderr,
    System,
}

/// Core execution driver trait (N3)
#[async_trait]
pub trait ExecutionDriver: Send + Sync + fmt::Debug {
    /// Get driver capabilities
    fn capabilities(&self) -> DriverCapabilities;

    /// Spawn a new execution environment
    async fn spawn(&self, spec: SpawnSpec) -> Result<ExecutionHandle, DriverError>;

    /// Execute a command in the environment
    async fn exec(
        &self,
        handle: &ExecutionHandle,
        cmd: CommandSpec,
    ) -> Result<ExecResult, DriverError>;

    /// Stream logs from the environment
    async fn stream_logs(&self, handle: &ExecutionHandle) -> Result<Vec<LogEntry>, DriverError>;

    /// Get artifacts produced by the execution
    async fn get_artifacts(&self, handle: &ExecutionHandle) -> Result<Vec<Artifact>, DriverError>;

    /// Destroy the execution environment
    async fn destroy(&self, handle: &ExecutionHandle) -> Result<(), DriverError>;

    /// Get resource consumption for an execution (N11)
    async fn get_consumption(
        &self,
        handle: &ExecutionHandle,
    ) -> Result<ResourceConsumption, DriverError>;

    /// Get execution receipt
    async fn get_receipt(&self, handle: &ExecutionHandle) -> Result<Option<Receipt>, DriverError>;

    /// Health check
    async fn health_check(&self) -> Result<DriverHealth, DriverError>;
}

/// Driver health status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DriverHealth {
    pub healthy: bool,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub active_executions: u32,
    #[serde(default)]
    pub available_capacity: ResourceSpec,
}

/// Driver configuration for Shell UI (N3 → UI mapping)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DriverConfig {
    /// Selected driver type
    pub driver_type: DriverType,
    /// Default resource spec
    pub default_resources: ResourceSpec,
    /// Environment variables to inject
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    /// Mounts to apply
    #[serde(default)]
    pub default_mounts: Vec<MountSpec>,
    /// Network policy
    #[serde(default)]
    pub network_policy: NetworkPolicy,
    /// Timeout in seconds
    #[serde(default)]
    pub default_timeout_seconds: u32,
    /// Enable prewarm pools (N16)
    #[serde(default)]
    pub enable_prewarm: bool,
}

impl Default for DriverConfig {
    fn default() -> Self {
        Self {
            driver_type: DriverType::Process,
            default_resources: ResourceSpec::standard(),
            env_vars: HashMap::new(),
            default_mounts: vec![],
            network_policy: NetworkPolicy::default(),
            default_timeout_seconds: 300,
            enable_prewarm: false,
        }
    }
}

/// Runtime environment settings for Shell UI Control Center
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeEnvironmentSettings {
    /// Active driver configuration
    pub driver_config: DriverConfig,
    /// Available drivers
    pub available_drivers: Vec<DriverCapabilities>,
    /// Prewarm pool configurations (N16)
    #[serde(default)]
    pub prewarm_pools: Vec<PrewarmPoolConfig>,
    /// Determinism settings (N12)
    #[serde(default)]
    pub determinism_enabled: bool,
    /// Replay capture level
    #[serde(default)]
    pub replay_capture_level: ReplayCaptureLevel,
}

/// Prewarm pool configuration (N16)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PrewarmPoolConfig {
    pub pool_name: String,
    pub pool_size: u32,
    pub env_spec: EnvironmentSpec,
    pub resources: ResourceSpec,
    pub max_idle_seconds: u32,
}

/// Replay capture level (N12)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayCaptureLevel {
    #[default]
    None,
    Minimal,
    Full,
}

use std::sync::Arc;

/// Global driver registry
pub struct DriverRegistry {
    drivers: HashMap<DriverType, Arc<dyn ExecutionDriver>>,
    configs: HashMap<TenantId, DriverConfig>,
}

impl DriverRegistry {
    pub fn new() -> Self {
        Self {
            drivers: HashMap::new(),
            configs: HashMap::new(),
        }
    }

    /// Register a driver implementation
    pub fn register_driver(&mut self, driver: Arc<dyn ExecutionDriver>) {
        let driver_type = driver.capabilities().driver_type;
        self.drivers.insert(driver_type, driver);
    }

    /// Get a driver by type
    pub fn get_driver(&self, driver_type: DriverType) -> Option<&dyn ExecutionDriver> {
        self.drivers.get(&driver_type).map(|d| d.as_ref())
    }

    /// Get a driver by type as an Arc
    pub fn get_driver_arc(&self, driver_type: DriverType) -> Option<Arc<dyn ExecutionDriver>> {
        self.drivers.get(&driver_type).cloned()
    }
    /// Set tenant-specific driver configuration
    pub fn set_config(&mut self, tenant: TenantId, config: DriverConfig) {
        self.configs.insert(tenant, config);
    }

    /// Get tenant configuration or default
    pub fn get_config(&self, tenant: &TenantId) -> DriverConfig {
        self.configs.get(tenant).cloned().unwrap_or_default()
    }

    /// Get available drivers for a tenant based on trust tier
    pub fn available_for_tier(&self, tier: IsolationLevel) -> Vec<&dyn ExecutionDriver> {
        let supported = tier.supported_drivers();
        supported
            .into_iter()
            .filter_map(|dt| self.drivers.get(&dt).map(|d| d.as_ref()))
            .collect()
    }
}

impl Default for DriverRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tenant_id_validation() {
        assert!(TenantId::new("valid-tenant").is_ok());
        assert!(TenantId::new("").is_err());
    }

    #[test]
    fn test_resource_spec_presets() {
        let minimal = ResourceSpec::minimal();
        assert_eq!(minimal.cpu_millis, 100);

        let standard = ResourceSpec::standard();
        assert_eq!(standard.cpu_millis, 1000);

        let high_perf = ResourceSpec::high_performance();
        assert_eq!(high_perf.cpu_millis, 4000);
    }

    #[test]
    fn test_isolation_level_drivers() {
        assert_eq!(
            IsolationLevel::Maximum.supported_drivers(),
            vec![DriverType::MicroVM]
        );
        assert_eq!(
            IsolationLevel::Limited.supported_drivers(),
            vec![DriverType::Process, DriverType::Wasm]
        );
    }

    #[test]
    fn test_driver_config_default() {
        let config = DriverConfig::default();
        assert!(matches!(config.driver_type, DriverType::Process));
        assert_eq!(config.default_timeout_seconds, 300);
    }
}
