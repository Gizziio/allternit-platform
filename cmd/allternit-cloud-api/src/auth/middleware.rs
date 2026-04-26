//! Authentication middleware for Axum
//!
//! Extracts Bearer tokens from Authorization headers and validates them.
//! Supports development mode bypass via environment variable.

use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
    body::Body,
};
use std::sync::Arc;
use std::task::{Context, Poll};
use tower::{Layer, Service};
use std::future::Future;
use std::pin::Pin;
use std::env;

use crate::auth::models::AuthenticatedUser;
use crate::ApiState;

/// Authentication context added to requests
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user: AuthenticatedUser,
    pub is_development: bool,
}

impl AuthContext {
    /// Create a development context with full permissions
    pub fn development() -> Self {
        Self {
            user: AuthenticatedUser::development_user(),
            is_development: true,
        }
    }
}

/// Authentication layer for Tower
#[derive(Debug, Clone)]
pub struct AuthLayer {
    development_mode: bool,
}

impl AuthLayer {
    /// Create a new auth layer
    pub fn new() -> Self {
        let development_mode = env::var("Allternit_API_DEVELOPMENT_MODE")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);
        
        if development_mode {
            tracing::warn!("API running in DEVELOPMENT MODE - authentication disabled");
        }
        
        Self { development_mode }
    }

    /// Create with explicit development mode setting
    pub fn with_development_mode(development_mode: bool) -> Self {
        Self { development_mode }
    }
}

impl Default for AuthLayer {
    fn default() -> Self {
        Self::new()
    }
}

impl<S> Layer<S> for AuthLayer {
    type Service = AuthMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AuthMiddleware {
            inner,
            development_mode: self.development_mode,
        }
    }
}

/// Authentication middleware service
#[derive(Debug, Clone)]
pub struct AuthMiddleware<S> {
    inner: S,
    development_mode: bool,
}

impl<S> AuthMiddleware<S> {
    /// Extract Bearer token from Authorization header
    fn extract_token(headers: &axum::http::HeaderMap) -> Option<String> {
        let auth_header = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
        
        if !auth_header.starts_with("Bearer ") {
            return None;
        }
        
        Some(auth_header[7..].to_string())
    }

    /// Validate API token (placeholder - full implementation would check database)
    async fn validate_token(&self, token: &str) -> Option<AuthenticatedUser> {
        // TODO: Implement actual token validation against database
        // For now, support a simple dev token
        if token == "dev-api-token" {
            return Some(AuthenticatedUser::development_user());
        }
        
        // Check if token starts with "allternit_" (our token format)
        if token.starts_with("allternit_") && token.len() >= 32 {
            // Placeholder: In production, hash the token and look it up in the database
            // let token_hash = sha256::digest(token);
            // let db_token = sqlx::query_as::<_, ApiToken>(...)
            
            // For now, return a mock user with limited permissions
            return Some(AuthenticatedUser {
                user_id: format!("user_{}", &token[4..12]),
                token_id: format!("token_{}", &token[4..12]),
                permissions: vec![
                    "runs:read".to_string(),
                    "runs:write".to_string(),
                    "jobs:read".to_string(),
                    "jobs:write".to_string(),
                ],
            });
        }
        
        None
    }
}

impl<S, B> Service<Request<B>> for AuthMiddleware<S>
where
    S: Service<Request<B>, Response = Response> + Send + Sync + Clone + 'static,
    S::Future: Send + 'static,
    B: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: Request<B>) -> Self::Future {
        let development_mode = self.development_mode;
        let mut inner = self.inner.clone();
        
        Box::pin(async move {
            // Development mode: bypass authentication
            if development_mode {
                let auth_context = AuthContext::development();
                req.extensions_mut().insert(auth_context);
                return inner.call(req).await;
            }
            
            // Extract and validate token
            let token = Self::extract_token(req.headers());
            
            match token {
                Some(token) => {
                    // Create a simple auth middleware instance for validation
                    let this = AuthMiddleware {
                        inner: inner.clone(),
                        development_mode,
                    };
                    
                    match this.validate_token(&token).await {
                        Some(user) => {
                            let auth_context = AuthContext {
                                user,
                                is_development: false,
                            };
                            req.extensions_mut().insert(auth_context);
                            inner.call(req).await
                        }
                        None => {
                            let response = Response::builder()
                                .status(StatusCode::UNAUTHORIZED)
                                .header(header::CONTENT_TYPE, "application/json")
                                .body(Body::from(r#"{"error":"INVALID_TOKEN","message":"Invalid or expired token"}"#))
                                .unwrap();
                            Ok(response)
                        }
                    }
                }
                None => {
                    let response = Response::builder()
                        .status(StatusCode::UNAUTHORIZED)
                        .header(header::CONTENT_TYPE, "application/json")
                        .header(header::WWW_AUTHENTICATE, "Bearer")
                        .body(Body::from(r#"{"error":"MISSING_TOKEN","message":"Authorization header with Bearer token required"}"#))
                        .unwrap();
                    Ok(response)
                }
            }
        })
    }
}

/// Simple auth middleware function for use with axum::middleware::from_fn
pub async fn auth_middleware(
    State(state): State<Arc<ApiState>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let development_mode = env::var("Allternit_API_DEVELOPMENT_MODE")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);
    
    if development_mode {
        let mut request = request;
        request.extensions_mut().insert(AuthContext::development());
        return next.run(request).await;
    }
    
    // Extract token
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| {
            if h.starts_with("Bearer ") {
                Some(h[7..].to_string())
            } else {
                None
            }
        });
    
    match token {
        Some(token) => {
            // Validate against database
            match validate_token_against_db(&state.db, &token).await {
                Ok(Some(user)) => {
                    let mut request = request;
                    request.extensions_mut().insert(AuthContext {
                        user,
                        is_development: false,
                    });
                    next.run(request).await
                }
                Ok(None) => {
                    unauthorized_response("Invalid or expired token")
                }
                Err(e) => {
                    tracing::error!("Token validation error: {}", e);
                    unauthorized_response("Token validation failed")
                }
            }
        }
        None => {
            unauthorized_response_with_www_authenticate("Authorization header with Bearer token required")
        }
    }
}

async fn validate_token_against_db(
    db: &sqlx::SqlitePool,
    token: &str,
) -> Result<Option<AuthenticatedUser>, sqlx::Error> {
    use crate::auth::models::ApiToken;
    
    // Simple hash for lookup (in production, use proper hashing)
    let token_hash = format!("{:x}", md5::compute(token.as_bytes()));
    
    let db_token: Option<ApiToken> = sqlx::query_as::<_, ApiToken>(
        r#"
        SELECT id, token_hash, name, user_id, permissions, created_at, expires_at, last_used_at, is_revoked
        FROM api_tokens
        WHERE token_hash = ? AND is_revoked = FALSE
        "#
    )
    .bind(&token_hash)
    .fetch_optional(db)
    .await?;
    
    if let Some(token_record) = db_token {
        // Check expiration
        if token_record.is_expired() {
            return Ok(None);
        }
        
        // Update last_used_at
        let _ = sqlx::query(
            "UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(&token_record.id)
        .execute(db)
        .await;
        
        let permissions = token_record.permissions();
        return Ok(Some(AuthenticatedUser {
            user_id: token_record.user_id,
            token_id: token_record.id,
            permissions,
        }));
    }
    
    // Fallback: check for dev token
    if token == "dev-api-token" {
        return Ok(Some(AuthenticatedUser::development_user()));
    }
    
    Ok(None)
}

fn unauthorized_response(message: &str) -> Response {
    let body = format!(r#"{{"error":"UNAUTHORIZED","message":"{}"}}"#, message);
    Response::builder()
        .status(StatusCode::UNAUTHORIZED)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .unwrap()
}

fn unauthorized_response_with_www_authenticate(message: &str) -> Response {
    let body = format!(r#"{{"error":"UNAUTHORIZED","message":"{}"}}"#, message);
    Response::builder()
        .status(StatusCode::UNAUTHORIZED)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::WWW_AUTHENTICATE, "Bearer")
        .body(Body::from(body))
        .unwrap()
}
