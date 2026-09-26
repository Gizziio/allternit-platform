//! Quota enforcement middleware for subscription-based API keys.
//!
//! Checks monthly quota limits before allowing inference requests.
//! Returns 402 Payment Required when quota is exceeded.

use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Extension, Json,
};
use std::sync::Arc;

use crate::{auth::AuthContext, services, ApiState};

/// Check quota before processing inference requests.
///
/// Skips quota checks for non-inference endpoints (admin, health, etc).
/// Returns 402 with upgrade prompt when quota exceeded.
pub async fn quota_middleware(
    Extension(auth): Extension<AuthContext>,
    Extension(state): Extension<Arc<ApiState>>,
    request: Request,
    next: Next,
) -> Result<Response<Body>, Response> {
    // Skip quota check for non-inference endpoints
    let path = request.uri().path();
    if !is_inference_endpoint(path) {
        return Ok(next.run(request).await);
    }

    // Check quota against the API key row. token_id here is the legacy
    // allternit_* api-token id, not the scoped api_keys.id — the scoped-key
    // path resolves the key by hash inside authenticate_api_key and records
    // usage there, so this middleware only guards the token path.
    let quota_exceeded = services::api_keys::check_quota_exceeded(&state.db, &auth.user.token_id)
        .await
        .unwrap_or(false);

    if quota_exceeded {
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            [(header::WWW_AUTHENTICATE, "Bearer")],
            Json(serde_json::json!({
                "error": "quota_exceeded",
                "message": "Monthly quota exceeded. Upgrade your plan at https://platform.allternit.com/billing"
            })),
        )
            .into_response());
    }

    Ok(next.run(request).await)
}

/// Determine if endpoint should have quota checks.
fn is_inference_endpoint(path: &str) -> bool {
    // Inference endpoints that consume quota
    path.starts_with("/v1/chat/completions")
        || path.starts_with("/v1/completions")
        || path.starts_with("/v1/messages")
        || path.starts_with("/api/v1/inference")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inference_endpoints_are_detected() {
        assert!(is_inference_endpoint("/v1/chat/completions"));
        assert!(is_inference_endpoint("/v1/completions"));
        assert!(is_inference_endpoint("/v1/messages"));
        assert!(is_inference_endpoint("/api/v1/inference/models"));
    }

    #[test]
    fn non_inference_endpoints_skip_quota() {
        assert!(!is_inference_endpoint("/api/v1/runs"));
        assert!(!is_inference_endpoint("/api/v1/api-keys"));
        assert!(!is_inference_endpoint("/health"));
        assert!(!is_inference_endpoint("/api/v1/billing/subscription"));
    }
}
