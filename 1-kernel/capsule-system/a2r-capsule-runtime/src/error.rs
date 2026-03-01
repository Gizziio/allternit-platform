use thiserror::Error;

pub type Result<T> = std::result::Result<T, CapsuleError>;

#[derive(Debug, thiserror::Error)]
pub enum CapsuleError {
    #[error("Capsule not found: {0}")]
    NotFound(String),

    #[error("Duplicate framework: {0}")]
    DuplicateFramework(String),

    #[error("Resource limit exceeded: {0}")]
    ResourceLimit(String),

    #[error("Invalid export format: {0}")]
    InvalidExport(String),

    #[error("Unauthorized access: {0}")]
    UnauthorizedAccess(String),

    #[error("Registry error: {0}")]
    RegistryError(#[from] Box<dyn std::error::Error + Send + Sync>),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}
