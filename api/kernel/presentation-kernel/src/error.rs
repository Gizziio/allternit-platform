use axum::{
    http::StatusCode,
    response::{IntoResponse, Json},
};
use thiserror::Error;

pub type Result<T> = std::result::Result<T, PKError>;

#[derive(Debug, Error)]
pub enum PKError {
    #[error("Situation not found: {0}")]
    SituationNotFound(String),

    #[error("Invalid canvas type: {0}")]
    InvalidCanvasType(String),

    #[error("Pattern not found: {0}")]
    PatternNotFound(String),

    #[error("Pattern verification failed: {0}")]
    VerificationFailed(String),

    #[error("Pattern promotion failed: {0}")]
    PromotionFailed(String),

    #[error("Invalid pattern status: {0}")]
    InvalidPatternStatus(String),

    #[error("Invalid canvas update: {0}")]
    InvalidCanvasUpdate(String),
}

impl IntoResponse for PKError {
    fn into_response(self) -> axum::response::Response {
        let status = StatusCode::BAD_REQUEST;
        let body = serde_json::json!({"error": self.to_string()});
        (status, Json(body)).into_response()
    }
}
