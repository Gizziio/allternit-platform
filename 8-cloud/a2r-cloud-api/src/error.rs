//! API error types

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

/// API error response
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub code: String,
}

/// API error types
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Deployment not found: {0}")]
    DeploymentNotFound(String),

    #[error("Instance not found: {0}")]
    InstanceNotFound(String),

    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    #[error("Invalid credentials: {0}")]
    InvalidCredentials(String),

    #[error("Deployment failed: {0}")]
    DeploymentFailed(String),

    #[error("SSH error: {0}")]
    SshError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Migration error: {0}")]
    MigrationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<sqlx::migrate::MigrateError> for ApiError {
    fn from(e: sqlx::migrate::MigrateError) -> Self {
        ApiError::MigrationError(e.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_code, message) = match &self {
            ApiError::DeploymentNotFound(id) => {
                (StatusCode::NOT_FOUND, "DEPLOYMENT_NOT_FOUND", id.clone())
            }
            ApiError::InstanceNotFound(id) => {
                (StatusCode::NOT_FOUND, "INSTANCE_NOT_FOUND", id.clone())
            }
            ApiError::ProviderNotFound(id) => {
                (StatusCode::NOT_FOUND, "PROVIDER_NOT_FOUND", id.clone())
            }
            ApiError::InvalidCredentials(msg) => {
                (StatusCode::UNAUTHORIZED, "INVALID_CREDENTIALS", msg.clone())
            }
            ApiError::DeploymentFailed(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "DEPLOYMENT_FAILED", msg.clone())
            }
            ApiError::SshError(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "SSH_ERROR", msg.clone())
            }
            ApiError::DatabaseError(e) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR", e.to_string())
            }
            ApiError::MigrationError(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "MIGRATION_ERROR", msg.clone())
            }
            ApiError::SerializationError(e) => {
                (StatusCode::BAD_REQUEST, "SERIALIZATION_ERROR", e.to_string())
            }
            ApiError::IoError(e) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "IO_ERROR", e.to_string())
            }
            ApiError::Internal(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", msg.clone())
            }
        };

        let body = Json(ErrorResponse {
            error: error_code.to_string(),
            message,
            code: error_code.to_string(),
        });

        (status, body).into_response()
    }
}
