use thiserror::Error;

pub type Result<T> = std::result::Result<T, IGKError>;

#[derive(Debug, thiserror::Error)]
pub enum IGKError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("JSON serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Policy violation: {0}")]
    PolicyViolation(String),

    #[error("Duplicate node: {0}")]
    DuplicateNode(String),

    #[error("Internal error: {0}")]
    Internal(String),
}
