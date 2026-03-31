//! Error types for capsule operations.

use thiserror::Error;

/// Result type for capsule operations.
pub type CapsuleResult<T> = Result<T, CapsuleError>;

/// Errors that can occur during capsule operations.
#[derive(Error, Debug)]
pub enum CapsuleError {
    #[error("Invalid manifest: {0}")]
    InvalidManifest(String),

    #[error("Bundle creation failed: {0}")]
    BundleCreationFailed(String),

    #[error("Bundle extraction failed: {0}")]
    BundleExtractionFailed(String),

    #[error("Missing file in bundle: {0}")]
    MissingFile(String),

    #[error("Signature verification failed: {0}")]
    SignatureVerificationFailed(String),

    #[error("Cryptography error: {0}")]
    CryptoError(String),

    #[error("Content hash mismatch: expected {expected}, got {actual}")]
    ContentHashMismatch { expected: String, actual: String },

    #[error("Capsule not found: {0}")]
    CapsuleNotFound(String),

    #[error("Capsule already exists: {0}")]
    AlreadyExists(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    /// Serialization error
    #[error("Serialization error: {0}")]
    SerdeError(#[from] serde_json::Error),

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}
