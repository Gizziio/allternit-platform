//! Error types for the cowork runtime

use thiserror::Error;

pub type Result<T> = std::result::Result<T, CoworkError>;

#[derive(Error, Debug)]
pub enum CoworkError {
    #[error("Initialization failed: {0}")]
    Initialization(String),

    #[error("Run not found: {0}")]
    RunNotFound(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("Attachment not found: {0}")]
    AttachmentNotFound(String),

    #[error("Checkpoint not found: {0}")]
    CheckpointNotFound(String),

    #[error("Invalid state transition: {from} -> {to}")]
    InvalidStateTransition { from: String, to: String },

    #[error("Run not in attachable state: {0}")]
    NotAttachable(String),

    #[error("Attachment token invalid or expired")]
    InvalidAttachmentToken,

    #[error("Lease acquisition failed: {0}")]
    LeaseAcquisitionFailed(String),

    #[error("Rails error: {0}")]
    Rails(#[from] anyhow::Error),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Checkpoint error: {0}")]
    Checkpoint(String),

    #[error("Recovery failed: {0}")]
    Recovery(String),

    #[error("UUID parse error: {0}")]
    Uuid(String),

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
