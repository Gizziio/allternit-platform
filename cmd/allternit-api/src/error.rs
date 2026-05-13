//! Unified API error type
//!
//! All route handlers should use `Result<T, ApiError>` so errors serialize
//! to a consistent JSON shape and are logged consistently.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use tracing::error;

/// Production-grade API error.
///
/// Internal details are logged but never leaked to the client.
#[derive(Debug)]
pub enum ApiError {
    Unauthorized,
    NotFound(String),
    BadRequest(String),
    DbError(String),
    Internal(String),
}

impl ApiError {
    /// HTTP status code for this error.
    pub fn status(&self) -> StatusCode {
        match self {
            ApiError::Unauthorized => StatusCode::UNAUTHORIZED,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::DbError(_) | ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// Message exposed to the client (safe, no internals).
    pub fn client_message(&self) -> String {
        match self {
            ApiError::Unauthorized => "Unauthorized".to_string(),
            ApiError::NotFound(msg) => msg.clone(),
            ApiError::BadRequest(msg) => msg.clone(),
            ApiError::DbError(_) | ApiError::Internal(_) => {
                "Internal server error".to_string()
            }
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let message = self.client_message();

        match &self {
            ApiError::DbError(msg) => error!("Database error: {}", msg),
            ApiError::Internal(msg) => error!("Internal error: {}", msg),
            _ => {}
        }

        let body = Json(json!({
            "error": message,
        }));
        (status, body).into_response()
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::Unauthorized => write!(f, "Unauthorized"),
            ApiError::NotFound(msg) => write!(f, "Not found: {}", msg),
            ApiError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            ApiError::DbError(msg) => write!(f, "Database error: {}", msg),
            ApiError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for ApiError {}

// ─── Conversions ────────────────────────────────────────────────────────────

impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        ApiError::DbError(e.to_string())
    }
}

impl From<std::io::Error> for ApiError {
    fn from(e: std::io::Error) -> Self {
        ApiError::Internal(e.to_string())
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(e: serde_json::Error) -> Self {
        ApiError::BadRequest(format!("JSON parse error: {}", e))
    }
}
