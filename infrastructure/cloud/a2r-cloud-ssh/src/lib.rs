//! A2R Cloud SSH Executor
//!
//! SSH connection management for cloud deployment.

pub mod connection;
pub mod executor;
pub mod key_manager;

pub use connection::SshConnection;
pub use executor::{SshExecutor, SshKeypair};
pub use key_manager::SshKeyManager;

/// Command output from SSH execution
#[derive(Debug, Clone)]
pub struct CommandOutput {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// SSH error types
#[derive(Debug, thiserror::Error)]
pub enum SshError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Command failed: {0}")]
    CommandFailed(String),

    #[error("File transfer failed: {0}")]
    FileTransferFailed(String),

    #[error("Key generation failed: {0}")]
    KeyGenerationFailed(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, SshError>;
