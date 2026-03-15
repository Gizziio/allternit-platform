//! OpenClaw Host Error Types

/// Errors that can occur when managing OpenClaw host
#[derive(Debug, thiserror::Error)]
pub enum HostError {
    #[error("Failed to spawn OpenClaw at {path}: {source}")]
    SpawnFailed {
        path: std::path::PathBuf,
        source: std::io::Error,
    },

    #[error("Process has no PID")]
    NoPid,

    #[error("Stdio not available: {0}")]
    StdioNotAvailable(&'static str),

    #[error("Health check failed: {0}")]
    HealthCheckFailed(String),

    #[error("Health check timeout")]
    HealthCheckTimeout,

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Deserialization error: {0}")]
    Deserialization(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Process terminated")]
    ProcessTerminated,

    #[error("RPC timeout")]
    RpcTimeout,

    #[error("RPC ID mismatch: expected {expected}, received {received}")]
    RpcIdMismatch { expected: u64, received: u64 },

    #[error("RPC error (code {code}): {message}")]
    RpcError { code: i64, message: String },

    #[error("No result in RPC response")]
    NoResult,
}
