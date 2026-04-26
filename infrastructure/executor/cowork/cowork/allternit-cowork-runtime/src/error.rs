//! Error types for the cowork runtime

use thiserror::Error;

/// Result type for cowork operations
pub type Result<T> = std::result::Result<T, CoworkError>;

/// Error types emitted by the cowork runtime
#[derive(Error, Debug)]
pub enum CoworkError {
    /// Failed to initialize the runtime or a component
    #[error("Initialization failed: {0}")]
    Initialization(String),

    /// Requested run could not be found
    #[error("Run not found: {0}")]
    RunNotFound(String),

    /// Requested job could not be found
    #[error("Job not found: {0}")]
    JobNotFound(String),

    /// Requested client attachment could not be found
    #[error("Attachment not found: {0}")]
    AttachmentNotFound(String),

    /// Requested checkpoint could not be found
    #[error("Checkpoint not found: {0}")]
    CheckpointNotFound(String),

    /// Run or job attempted an invalid state transition
    #[error("Invalid state transition: {from} -> {to}")]
    InvalidStateTransition { 
        /// Source state
        from: String, 
        /// Target state
        to: String 
    },

    /// Run is not in a state that allows client attachment
    #[error("Run not in attachable state: {0}")]
    NotAttachable(String),

    /// Provided attachment token is invalid or has expired
    #[error("Attachment token invalid or expired")]
    InvalidAttachmentToken,

    /// Failed to acquire or renew an exclusive worker lease
    #[error("Lease acquisition failed: {0}")]
    LeaseAcquisitionFailed(String),

    /// Underlying Rails service returned an error
    #[error("Rails error: {0}")]
    Rails(#[from] anyhow::Error),

    /// Internal storage operation failed
    #[error("Storage error: {0}")]
    Storage(String),

    /// JSON serialization or deserialization failed
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Standard I/O error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Local database operation failed
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    /// Failed to create or load a checkpoint
    #[error("Checkpoint error: {0}")]
    Checkpoint(String),

    /// Failed to recover state after a crash or disconnect
    #[error("Recovery failed: {0}")]
    Recovery(String),

    /// Failed to parse a UUID string
    #[error("UUID parse error: {0}")]
    Uuid(String),

    /// Failed to parse a date string
    #[error("Date parse error: {0}")]
    DateParse(String),
}

impl CoworkError {
    /// Get the HTTP status code for this error
    pub fn http_status_code(&self) -> u16 {
        match self {
            CoworkError::RunNotFound(_) => 404,
            CoworkError::JobNotFound(_) => 404,
            CoworkError::AttachmentNotFound(_) => 404,
            CoworkError::CheckpointNotFound(_) => 404,
            CoworkError::InvalidStateTransition { .. } => 409,
            CoworkError::NotAttachable(_) => 409,
            CoworkError::InvalidAttachmentToken => 401,
            CoworkError::LeaseAcquisitionFailed(_) => 409,
            _ => 500,
        }
    }
}
