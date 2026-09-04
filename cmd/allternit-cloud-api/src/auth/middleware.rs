//! Authentication middleware for Axum
//!
//! Extracts Bearer tokens from Authorization headers and validates them.
//! Supports development mode bypass via environment variable.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use std::env;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use tower::{Layer, Service};

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
        // Dev-token fallback is rejected unless explicitly enabled (see
        // `is_dev_api_token`); it must never work in production.
        if is_dev_api_token(token) {
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
                Ok(None) => unauthorized_response("Invalid or expired token"),
                Err(e) => {
                    tracing::error!("Token validation error: {}", e);
                    unauthorized_response("Token validation failed")
                }
            }
        }
        None => unauthorized_response_with_www_authenticate(
            "Authorization header with Bearer token required",
        ),
    }
}

/// Validate an `allternit_*` API token against `api_tokens` (sha256 hash
/// lookup with legacy-md5 fallback and transparent upgrade, revocation/
/// expiration checks, `last_used_at` touch). Also answers the
/// `dev-api-token` development fallback. Crate-public for
/// `auth::resolve::resolve_user_id`, which offers the same token path to
/// management routes.
pub(crate) async fn validate_token_against_db(
    db: &sqlx::PgPool,
    token: &str,
) -> Result<Option<AuthenticatedUser>, sqlx::Error> {
    if let Some(token_record) = lookup_api_token(db, token).await? {
        // Check expiration
        if token_record.is_expired() {
            return Ok(None);
        }

        // Update last_used_at
        let _ = sqlx::query("UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1")
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

    // Modern scoped keys (`alt_…`, sha256-hashed in `api_keys` with a real
    // scopes list). This is the only production validation path for them —
    // without it, keys minted on the platform simply do not work here.
    if let Ok(Some(key)) = crate::services::api_keys::authenticate_api_key(db, token).await {
        return Ok(Some(AuthenticatedUser {
            user_id: key.user_id,
            token_id: key.id,
            permissions: key.scopes,
        }));
    }

    // Fallback: check for dev token (gated — rejected unless explicitly enabled)
    if is_dev_api_token(token) {
        return Ok(Some(AuthenticatedUser::development_user()));
    }

    Ok(None)
}


/// SHA-256 hex digest for newly stored `api_tokens` hashes.
pub(crate) fn hash_api_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Legacy MD5 hex digest. Only ever used to MATCH existing rows so they can
/// be validated once more and transparently re-hashed to SHA-256.
pub(crate) fn legacy_md5_token_hash(token: &str) -> String {
    format!("{:x}", md5::compute(token.as_bytes()))
}

/// Look up an `api_tokens` row by token. New rows are stored as SHA-256;
/// rows minted before the hashing upgrade hold MD5 digests (32 hex chars) and
/// are accepted here exactly once more — a successful legacy match is
/// transparently re-written to SHA-256 before returning.
pub(crate) async fn lookup_api_token(
    db: &sqlx::PgPool,
    token: &str,
) -> Result<Option<crate::auth::models::ApiToken>, sqlx::Error> {
    use crate::auth::models::ApiToken;

    const SELECT: &str = r#"
        SELECT id, token_hash, name, user_id, permissions, created_at, expires_at, last_used_at, is_revoked
        FROM api_tokens
        WHERE token_hash = $1 AND is_revoked = FALSE
        "#;

    let sha256_hash = hash_api_token(token);
    if let Some(row) = sqlx::query_as::<_, ApiToken>(SELECT)
        .bind(&sha256_hash)
        .fetch_optional(db)
        .await?
    {
        return Ok(Some(row));
    }

    // Legacy MD5 row: validate once more, then upgrade the stored hash.
    let md5_hash = legacy_md5_token_hash(token);
    let Some(row) = sqlx::query_as::<_, ApiToken>(SELECT)
        .bind(&md5_hash)
        .fetch_optional(db)
        .await?
    else {
        return Ok(None);
    };

    let _ = sqlx::query("UPDATE api_tokens SET token_hash = $2 WHERE id = $1")
        .bind(&row.id)
        .bind(&sha256_hash)
        .execute(db)
        .await;
    tracing::info!(token_id = %row.id, "upgraded legacy md5 api_tokens hash to sha256");
    Ok(Some(row))
}

/// Gate for the `dev-api-token` development fallback. The fallback grants a
/// wildcard-permissions user, so it is **rejected by default** and only works
/// when `ALLTERNIT_ALLOW_DEV_API_TOKEN` is explicitly set to `true`/`1`
/// (local development only — never set this in a deployed environment).
pub(crate) fn dev_api_token_allowed() -> bool {
    env::var("ALLTERNIT_ALLOW_DEV_API_TOKEN")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

pub(crate) fn is_dev_api_token(token: &str) -> bool {
    token == "dev-api-token" && dev_api_token_allowed()
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

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_pool() -> sqlx::PgPool {
        let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
        let schema_for_hook = schema.clone();
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(url)
            .await
            .unwrap();
        sqlx::query("DROP TABLE IF EXISTS api_tokens CASCADE")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            r#"
            CREATE TABLE api_tokens (
                id TEXT PRIMARY KEY,
                token_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                permissions TEXT NOT NULL DEFAULT '[]',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ,
                last_used_at TIMESTAMPTZ,
                is_revoked BOOLEAN NOT NULL DEFAULT FALSE
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn stored_hash(pool: &sqlx::PgPool, id: &str) -> String {
        sqlx::query_scalar("SELECT token_hash FROM api_tokens WHERE id = $1")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    #[test]
    fn new_token_hashes_are_sha256_hex() {
        let token = "allternit_mint_to_verify_roundtrip_0123456789";
        let hash = hash_api_token(token);
        assert_eq!(hash.len(), 64, "sha256 hex is 64 chars");
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(
            hash,
            legacy_md5_token_hash(token),
            "new hashes must not be md5"
        );
        // Same input hashes deterministically (mint -> verify roundtrip).
        assert_eq!(hash, hash_api_token(token));
    }

    #[tokio::test]
    async fn sha256_minted_token_validates() {
        let pool = test_pool().await;
        let token = "allternit_sha256_roundtrip_token_0123456789";
        sqlx::query(
            "INSERT INTO api_tokens (id, token_hash, name, user_id, permissions) VALUES ('tok_sha', $1, 't', 'user_sha', '[\"runs:read\"]')",
        )
        .bind(hash_api_token(token))
        .execute(&pool)
        .await
        .unwrap();

        let user = validate_token_against_db(&pool, token).await.unwrap();
        assert_eq!(user.map(|u| u.user_id), Some("user_sha".to_string()));
        assert_eq!(stored_hash(&pool, "tok_sha").await.len(), 64);
    }

    #[tokio::test]
    async fn legacy_md5_token_validates_and_is_upgraded() {
        let pool = test_pool().await;
        let token = "allternit_legacy_md5_token_0123456789";
        let md5_hash = legacy_md5_token_hash(token);
        assert_eq!(md5_hash.len(), 32, "pre-upgrade rows hold 32-char md5");
        sqlx::query(
            "INSERT INTO api_tokens (id, token_hash, name, user_id, permissions) VALUES ('tok_legacy', $1, 't', 'user_legacy', '[\"runs:read\"]')",
        )
        .bind(&md5_hash)
        .execute(&pool)
        .await
        .unwrap();

        // Legacy row still validates...
        let user = validate_token_against_db(&pool, token).await.unwrap();
        assert_eq!(user.map(|u| u.user_id), Some("user_legacy".to_string()));

        // ...and the stored hash was transparently upgraded to sha256.
        let upgraded = stored_hash(&pool, "tok_legacy").await;
        assert_eq!(upgraded.len(), 64);
        assert_eq!(upgraded, hash_api_token(token));

        // The sha256 path now serves the row (no md5 fallback needed).
        let again = validate_token_against_db(&pool, token).await.unwrap();
        assert_eq!(again.map(|u| u.user_id), Some("user_legacy".to_string()));
    }

    #[tokio::test]
    async fn unknown_token_does_not_validate() {
        let pool = test_pool().await;
        assert!(
            validate_token_against_db(&pool, "allternit_no_such_token_0123456789")
                .await
                .unwrap()
                .is_none()
        );
    }
}
