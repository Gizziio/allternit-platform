//! Sandbox configuration for WASM tool execution.

use serde::{Deserialize, Serialize};

/// Configuration for the WASM sandbox environment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// Maximum memory in bytes (default: 64MB)
    pub max_memory_bytes: u64,

    /// Maximum execution time in milliseconds (default: 30s)
    pub max_execution_time_ms: u64,

    /// Maximum fuel (instruction count) - None for unlimited
    pub max_fuel: Option<u64>,

    /// Allow WASI preview 2 features
    pub wasi_preview2: bool,

    /// Allow threading
    pub allow_threads: bool,

    /// Enable component model
    pub component_model: bool,

    /// Enable async support
    pub async_support: bool,

    /// Cache compiled components
    pub enable_cache: bool,

    /// Maximum table elements
    pub max_table_elements: u32,

    /// Maximum instances
    pub max_instances: u32,

    /// Maximum tables
    pub max_tables: u32,

    /// Maximum memories
    pub max_memories: u32,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            max_memory_bytes: 64 * 1024 * 1024, // 64MB
            max_execution_time_ms: 30_000,      // 30 seconds
            max_fuel: Some(100_000_000),        // 100M instructions
            wasi_preview2: true,
            allow_threads: false,
            component_model: true,
            async_support: false,
            enable_cache: true,
            max_table_elements: 10_000,
            max_instances: 10,
            max_tables: 10,
            max_memories: 1,
        }
    }
}

impl SandboxConfig {
    /// Create a minimal sandbox (most restrictive)
    pub fn minimal() -> Self {
        Self {
            max_memory_bytes: 16 * 1024 * 1024, // 16MB
            max_execution_time_ms: 5_000,       // 5 seconds
            max_fuel: Some(10_000_000),         // 10M instructions
            wasi_preview2: false,
            allow_threads: false,
            component_model: true,
            async_support: false,
            enable_cache: true,
            max_table_elements: 1_000,
            max_instances: 1,
            max_tables: 1,
            max_memories: 1,
        }
    }

    /// Create a permissive sandbox (for trusted tools)
    pub fn permissive() -> Self {
        Self {
            max_memory_bytes: 512 * 1024 * 1024, // 512MB
            max_execution_time_ms: 300_000,      // 5 minutes
            max_fuel: None,                      // Unlimited
            wasi_preview2: true,
            allow_threads: true,
            component_model: true,
            async_support: false,
            enable_cache: true,
            max_table_elements: 100_000,
            max_instances: 100,
            max_tables: 100,
            max_memories: 10,
        }
    }

    /// Builder: set max memory
    pub fn with_max_memory(mut self, bytes: u64) -> Self {
        self.max_memory_bytes = bytes;
        self
    }

    /// Builder: set max execution time
    pub fn with_max_execution_time(mut self, ms: u64) -> Self {
        self.max_execution_time_ms = ms;
        self
    }

    /// Builder: set max fuel
    pub fn with_max_fuel(mut self, fuel: Option<u64>) -> Self {
        self.max_fuel = fuel;
        self
    }

    /// Builder: enable/disable WASI preview 2
    pub fn with_wasi_preview2(mut self, enabled: bool) -> Self {
        self.wasi_preview2 = enabled;
        self
    }
}

/// Resource usage tracking for a sandbox.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SandboxMetrics {
    /// Peak memory usage in bytes
    pub peak_memory_bytes: u64,

    /// Total fuel consumed
    pub fuel_consumed: u64,

    /// Execution time in milliseconds
    pub execution_time_ms: u64,

    /// Number of host function calls
    pub host_calls: u64,

    /// Number of capability checks
    pub capability_checks: u64,

    /// Number of capability denials
    pub capability_denials: u64,
}

impl SandboxMetrics {
    /// Create new metrics
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a host function call
    pub fn record_host_call(&mut self) {
        self.host_calls += 1;
    }

    /// Record a capability check
    pub fn record_capability_check(&mut self, allowed: bool) {
        self.capability_checks += 1;
        if !allowed {
            self.capability_denials += 1;
        }
    }
}
