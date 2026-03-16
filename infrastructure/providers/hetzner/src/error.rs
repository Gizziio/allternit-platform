//! Hetzner Cloud API error types

/// Hetzner error types
#[derive(Debug, thiserror::Error)]
pub enum HetznerError {
    #[error("Server not found: {0}")]
    ServerNotFound(i64),

    #[error("API error: {0}")]
    ApiError(String),

    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),
}
