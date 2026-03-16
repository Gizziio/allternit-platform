//! Error types for A2R CLI

use thiserror::Error;

pub type Result<T> = std::result::Result<T, CliError>;

#[derive(Error, Debug)]
pub enum CliError {
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Desktop app not running")]
    DesktopNotRunning {
        socket_path: std::path::PathBuf,
    },
    
    #[error("VM error: {0}")]
    Vm(String),
    
    #[error("Session error: {0}")]
    Session(String),
    
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    
    #[error("Session limit exceeded: max {0} sessions allowed")]
    SessionLimitExceeded(usize),
    
    #[error("Invalid reconnect token")]
    InvalidToken,
    
    #[error("Driver not available: {0}")]
    DriverNotAvailable(String),
    
    #[error("Platform not supported: {0}")]
    PlatformNotSupported(String),
    
    #[error("Execution failed: {message}")]
    ExecutionFailed { message: String, exit_code: i32 },
    
    #[error("Timeout after {seconds}s")]
    Timeout { seconds: u64 },
    
    #[error("Connection failed: {0}")]
    Connection(String),
    
    #[error("Authentication required")]
    NotAuthenticated,
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("Internal error: {0}")]
    Internal(String),
    
    #[error("Not implemented: {0}")]
    NotImplemented(String),
}

impl From<sqlx::Error> for CliError {
    fn from(err: sqlx::Error) -> Self {
        CliError::Database(err.to_string())
    }
}

impl CliError {
    /// Get the exit code for this error
    pub fn exit_code(&self) -> i32 {
        match self {
            CliError::ExecutionFailed { exit_code, .. } => *exit_code,
            CliError::Timeout { .. } => 124,
            CliError::NotAuthenticated => 77,
            _ => 1,
        }
    }
}
