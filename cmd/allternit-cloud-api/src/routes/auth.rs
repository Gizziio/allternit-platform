//! Authentication routes
//!
//! Provides endpoints for:
//! - POST /api/v1/auth/validate - Validate a token
//! - POST /api/v1/auth/login - Authenticate and get token (future)
//! - POST /api/v1/auth/logout - Revoke current token (future)
//! - GET /api/v1/auth/me - Get current user info

use axum::{
    extract::{Extension, State},
    Json,
};
use std::sync::Arc;
use chrono::Utc;

use crate::auth::{
    models::{ApiToken, TokenInfo, ValidateTokenRequest},
    AuthContext,
};
use crate::ApiState;
use crate::ApiError;

/// Validate a token
/// 
/// POST /api/v1/auth/validate
/// 
/// Returns token information including validity, user, and permissions.
/// This endpoint is publicly accessible (no auth required) to allow
/// clients to validate tokens before use.
pub async fn validate_token(
    State(state): State<Arc<ApiState>>,
    Json(request): Json<ValidateTokenRequest>,
) -> Result<Json<TokenInfo>, ApiError> {
    // Simple hash for lookup
    let digest = md5::compute(request.token.as_bytes());
    let token_hash = format!("{:x}", digest);
    
    let db_token: Option<ApiToken> = sqlx::query_as::<_, ApiToken>(
        r#"
        SELECT id, token_hash, name, user_id, permissions, created_at, expires_at, last_used_at, is_revoked
        FROM api_tokens
        WHERE token_hash = ? AND is_revoked = FALSE
        "#
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let token_info = match db_token {
        Some(token) => {
            let is_valid = !token.is_expired();
            let permissions = token.permissions();
            TokenInfo {
                valid: is_valid,
                token_id: Some(token.id),
                user_id: Some(token.user_id),
                name: Some(token.name),
                permissions,
                expires_at: token.expires_at,
                issued_at: Some(token.created_at),
            }
        }
        None => {
            // Check for dev token
            if request.token == "dev-api-token" {
                TokenInfo {
                    valid: true,
                    token_id: Some("dev-token".to_string()),
                    user_id: Some("dev-user".to_string()),
                    name: Some("Development Token".to_string()),
                    permissions: vec!["*".to_string()],
                    expires_at: None,
                    issued_at: None,
                }
            } else {
                TokenInfo {
                    valid: false,
                    token_id: None,
                    user_id: None,
                    name: None,
                    permissions: vec![],
                    expires_at: None,
                    issued_at: None,
                }
            }
        }
    };
    
    Ok(Json(token_info))
}

/// Get current user information
/// 
/// GET /api/v1/auth/me
/// 
/// Returns information about the currently authenticated user.
/// Requires authentication.
pub async fn get_current_user(
    Extension(auth): Extension<AuthContext>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(serde_json::json!({
        "user_id": auth.user.user_id,
        "token_id": auth.user.token_id,
        "permissions": auth.user.permissions,
        "is_development": auth.is_development,
    })))
}

/// List all tokens for the current user
/// 
/// GET /api/v1/auth/tokens
/// 
/// Requires: tokens:read permission
pub async fn list_tokens(
    Extension(auth): Extension<AuthContext>,
    State(state): State<Arc<ApiState>>,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    // Check permission
    if !auth.user.has_permission("tokens:read") && !auth.user.has_permission("admin") {
        return Err(ApiError::Forbidden("Missing required permission: tokens:read".to_string()));
    }
    
    let tokens: Vec<ApiToken> = sqlx::query_as::<_, ApiToken>(
        r#"
        SELECT id, token_hash, name, user_id, permissions, created_at, expires_at, last_used_at, is_revoked
        FROM api_tokens
        WHERE user_id = ? AND is_revoked = FALSE
        ORDER BY created_at DESC
        "#
    )
    .bind(&auth.user.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let result: Vec<serde_json::Value> = tokens
        .into_iter()
        .map(|t| serde_json::json!({
            "id": t.id,
            "name": t.name,
            "permissions": t.permissions(),
            "created_at": t.created_at,
            "expires_at": t.expires_at,
            "last_used_at": t.last_used_at,
        }))
        .collect();
    
    Ok(Json(result))
}

/// Create a new API token
/// 
/// POST /api/v1/auth/tokens
/// 
/// Requires: tokens:write permission
#[derive(serde::Deserialize)]
pub struct CreateTokenRequest {
    pub name: String,
    pub permissions: Vec<String>,
    pub expires_in_days: Option<i32>,
}

#[derive(serde::Serialize)]
pub struct CreateTokenResponse {
    pub token: String,
    pub token_id: String,
    pub expires_at: Option<chrono::DateTime<Utc>>,
}

pub async fn create_token(
    Extension(auth): Extension<AuthContext>,
    State(state): State<Arc<ApiState>>,
    Json(request): Json<CreateTokenRequest>,
) -> Result<Json<CreateTokenResponse>, ApiError> {
    // Check permission
    if !auth.user.has_permission("tokens:write") && !auth.user.has_permission("admin") {
        return Err(ApiError::Forbidden("Missing required permission: tokens:write".to_string()));
    }
    
    // Generate token
    let token = format!("a2r_{}", generate_secure_random(48));
    let digest = md5::compute(token.as_bytes());
    let token_hash = format!("{:x}", digest);
    let token_id = format!("token_{}", generate_secure_random(16));
    
    // Calculate expiration
    let expires_at = request.expires_in_days.map(|days| {
        Utc::now() + chrono::Duration::days(days as i64)
    });
    
    // Store token
    let permissions_json = serde_json::to_string(&request.permissions)
        .map_err(|e| ApiError::SerializationError(e))?;
    
    sqlx::query(
        r#"
        INSERT INTO api_tokens (id, token_hash, name, user_id, permissions, created_at, expires_at, is_revoked)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, FALSE)
        "#
    )
    .bind(&token_id)
    .bind(&token_hash)
    .bind(&request.name)
    .bind(&auth.user.user_id)
    .bind(&permissions_json)
    .bind(expires_at)
    .execute(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    Ok(Json(CreateTokenResponse {
        token,
        token_id,
        expires_at,
    }))
}

/// Revoke an API token
/// 
/// DELETE /api/v1/auth/tokens/:id
/// 
/// Requires: tokens:delete permission (or ownership of the token)
pub async fn revoke_token(
    Extension(auth): Extension<AuthContext>,
    State(state): State<Arc<ApiState>>,
    axum::extract::Path(token_id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Check if user can delete this token (must be owner or have tokens:delete permission)
    let token: Option<ApiToken> = sqlx::query_as::<_, ApiToken>(
        "SELECT * FROM api_tokens WHERE id = ?"
    )
    .bind(&token_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let token = token.ok_or_else(|| ApiError::NotFound(format!("Token not found: {}", token_id)))?;
    
    let can_delete = token.user_id == auth.user.user_id 
        || auth.user.has_permission("tokens:delete")
        || auth.user.has_permission("admin");
    
    if !can_delete {
        return Err(ApiError::Forbidden("Cannot revoke this token".to_string()));
    }
    
    sqlx::query("UPDATE api_tokens SET is_revoked = TRUE WHERE id = ?")
        .bind(&token_id)
        .execute(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
    
    Ok(Json(serde_json::json!({
        "message": "Token revoked successfully",
        "token_id": token_id,
    })))
}



/// Generate a secure random string
fn generate_secure_random(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    
    (0..length)
        .map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char)
        .collect()
}
