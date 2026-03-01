//! Error types for the WASM runtime.

use thiserror::Error;

/// Result type for WASM runtime operations.
pub type WasmRuntimeResult<T> = Result<T, WasmRuntimeError>;

/// Errors that can occur in the WASM runtime.
#[derive(Error, Debug)]
pub enum WasmRuntimeError {
    /// Failed to compile WASM component
    #[error("Failed to compile WASM component: {0}")]
    CompilationError(String),

    /// Failed to instantiate WASM component
    #[error("Failed to instantiate WASM component: {0}")]
    InstantiationError(String),

    /// Failed to execute tool function
    #[error("Tool execution failed: {0}")]
    ExecutionError(String),

    /// Capability was denied by policy
    #[error("Capability denied: {capability} - {reason}")]
    CapabilityDenied { capability: String, reason: String },

    /// Tool execution timed out
    #[error("Tool execution timed out after {timeout_ms}ms")]
    Timeout { timeout_ms: u64 },

    /// Memory limit exceeded
    #[error("Memory limit exceeded: used {used_bytes} bytes, limit {limit_bytes} bytes")]
    MemoryLimitExceeded { used_bytes: u64, limit_bytes: u64 },

    /// Invalid tool input
    #[error("Invalid tool input: {0}")]
    InvalidInput(String),

    /// Tool not found in component
    #[error("Tool function not found: {0}")]
    ToolNotFound(String),

    /// WASI context error
    #[error("WASI context error: {0}")]
    WasiError(String),

    /// Capsule verification failed
    #[error("Capsule verification failed: {0}")]
    CapsuleVerificationFailed(String),

    /// Internal runtime error
    #[error("Internal runtime error: {0}")]
    Internal(String),

    /// Manifest validation failed
    #[error("Manifest validation failed: {0}")]
    ManifestError(String),
}

impl From<anyhow::Error> for WasmRuntimeError {
    fn from(err: anyhow::Error) -> Self {
        WasmRuntimeError::Internal(err.to_string())
    }
}
