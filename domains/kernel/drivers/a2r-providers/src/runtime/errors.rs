//! Provider Error Types
//!
//! Canonical error representation across all providers.
//! Maps provider-specific errors to normalized error kinds.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Normalized error kind for provider operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProviderErrorKind {
    /// Authentication error (missing, invalid, or expired credentials)
    Auth,
    /// Rate limit exceeded
    RateLimit,
    /// Bad request (invalid parameters, malformed input)
    BadRequest,
    /// Provider-side bug or unexpected response
    ProviderBug,
    /// Network connectivity issue
    Network,
    /// Unknown or uncategorized error
    Unknown,
}

impl fmt::Display for ProviderErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProviderErrorKind::Auth => write!(f, "auth"),
            ProviderErrorKind::RateLimit => write!(f, "rate_limit"),
            ProviderErrorKind::BadRequest => write!(f, "bad_request"),
            ProviderErrorKind::ProviderBug => write!(f, "provider_bug"),
            ProviderErrorKind::Network => write!(f, "network"),
            ProviderErrorKind::Unknown => write!(f, "unknown"),
        }
    }
}

/// Canonical provider error with retry metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderError {
    /// Error kind classification
    pub kind: ProviderErrorKind,
    /// HTTP status code if available
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<u16>,
    /// Human-readable error message
    pub message: String,
    /// Retry-after hint in seconds (for rate limits)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
    /// Provider-specific error code if available
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_code: Option<String>,
    /// Raw provider response (for debugging, may be truncated)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_response: Option<String>,
}

impl ProviderError {
    /// Create a new auth error
    pub fn auth(message: impl Into<String>) -> Self {
        Self {
            kind: ProviderErrorKind::Auth,
            status_code: Some(401),
            message: message.into(),
            retry_after: None,
            provider_code: None,
            raw_response: None,
        }
    }

    /// Create a new rate limit error
    pub fn rate_limit(message: impl Into<String>, retry_after: Option<u64>) -> Self {
        Self {
            kind: ProviderErrorKind::RateLimit,
            status_code: Some(429),
            message: message.into(),
            retry_after,
            provider_code: None,
            raw_response: None,
        }
    }

    /// Create a new bad request error
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            kind: ProviderErrorKind::BadRequest,
            status_code: Some(400),
            message: message.into(),
            retry_after: None,
            provider_code: None,
            raw_response: None,
        }
    }

    /// Create a new provider bug error
    pub fn provider_bug(message: impl Into<String>) -> Self {
        Self {
            kind: ProviderErrorKind::ProviderBug,
            status_code: Some(500),
            message: message.into(),
            retry_after: None,
            provider_code: None,
            raw_response: None,
        }
    }

    /// Create a new network error
    pub fn network(message: impl Into<String>) -> Self {
        Self {
            kind: ProviderErrorKind::Network,
            status_code: None,
            message: message.into(),
            retry_after: None,
            provider_code: None,
            raw_response: None,
        }
    }

    /// Create a new unknown error
    pub fn unknown(message: impl Into<String>) -> Self {
        Self {
            kind: ProviderErrorKind::Unknown,
            status_code: None,
            message: message.into(),
            retry_after: None,
            provider_code: None,
            raw_response: None,
        }
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self.kind,
            ProviderErrorKind::RateLimit | ProviderErrorKind::Network
        )
    }

    /// Get canonical message for the error kind
    pub fn canonical_message(&self) -> String {
        match self.kind {
            ProviderErrorKind::Auth => {
                "Authentication failed. Please check your API key or run the auth wizard."
                    .to_string()
            }
            ProviderErrorKind::RateLimit => {
                if let Some(seconds) = self.retry_after {
                    format!("Rate limit exceeded. Retry after {} seconds.", seconds)
                } else {
                    "Rate limit exceeded. Please wait before retrying.".to_string()
                }
            }
            ProviderErrorKind::BadRequest => {
                format!("Invalid request: {}", self.message)
            }
            ProviderErrorKind::ProviderBug => {
                format!(
                    "Provider error: {}. This may be a temporary issue.",
                    self.message
                )
            }
            ProviderErrorKind::Network => {
                "Network error. Please check your connection and retry.".to_string()
            }
            ProviderErrorKind::Unknown => {
                format!("Unexpected error: {}", self.message)
            }
        }
    }
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.kind, self.canonical_message())
    }
}

impl std::error::Error for ProviderError {}

/// Error mapping trait for provider adapters
///
/// Each provider adapter implements this to map their specific
/// error format to the canonical ProviderError.
pub trait ErrorMapper: Send + Sync {
    /// Map a raw error to ProviderError
    fn map_error(&self, status_code: Option<u16>, body: &str) -> ProviderError;
}

/// Common HTTP status code to error kind mapping
pub fn map_http_status(status_code: u16) -> ProviderErrorKind {
    match status_code {
        401 | 403 => ProviderErrorKind::Auth,
        429 => ProviderErrorKind::RateLimit,
        400 | 404 | 422 => ProviderErrorKind::BadRequest,
        500..=599 => ProviderErrorKind::ProviderBug,
        _ => ProviderErrorKind::Unknown,
    }
}

/// Extract retry-after from headers
pub fn extract_retry_after(headers: &[(String, String)]) -> Option<u64> {
    headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("retry-after"))
        .and_then(|(_, v)| v.parse().ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_error_creation() {
        let err = ProviderError::auth("API key invalid");
        assert_eq!(err.kind, ProviderErrorKind::Auth);
        assert_eq!(err.status_code, Some(401));
        assert!(err.canonical_message().contains("Authentication failed"));
    }

    #[test]
    fn test_rate_limit_error() {
        let err = ProviderError::rate_limit("Too many requests", Some(60));
        assert_eq!(err.kind, ProviderErrorKind::RateLimit);
        assert_eq!(err.retry_after, Some(60));
        assert!(err.is_retryable());
        assert!(err.canonical_message().contains("60 seconds"));
    }

    #[test]
    fn test_map_http_status() {
        assert_eq!(map_http_status(401), ProviderErrorKind::Auth);
        assert_eq!(map_http_status(429), ProviderErrorKind::RateLimit);
        assert_eq!(map_http_status(400), ProviderErrorKind::BadRequest);
        assert_eq!(map_http_status(500), ProviderErrorKind::ProviderBug);
        assert_eq!(map_http_status(999), ProviderErrorKind::Unknown);
    }

    #[test]
    fn test_extract_retry_after() {
        let headers = vec![("Retry-After".to_string(), "120".to_string())];
        assert_eq!(extract_retry_after(&headers), Some(120));

        let headers = vec![("retry-after".to_string(), "60".to_string())];
        assert_eq!(extract_retry_after(&headers), Some(60));
    }
}
