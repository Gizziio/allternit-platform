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
        // The dev-token override is rejected unless explicitly enabled (see
        // `is_dev_api_token`); it is hard-refused in production environments.
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
/// lookup, revocation/expiration checks, `last_used_at` touch), then against
/// the modern scoped `alt_…` keys. Also answers the opt-in development
/// override (see `is_dev_api_token`). Crate-public for
/// `auth::resolve::resolve_user_id`, which offers the same token path to
/// management routes.
pub(crate) async fn validate_token_against_db(
    db: &sqlx::PgPool,
    token: &str,
) -> Result<Option<AuthenticatedUser>, sqlx::Error> {
    use crate::auth::models::ApiToken;

    let token_hash = crate::services::api_keys::hash_token(token);

    let db_token: Option<ApiToken> = sqlx::query_as::<_, ApiToken>(
        r#"
        SELECT id, token_hash, name, user_id, permissions, created_at, expires_at, last_used_at, is_revoked
        FROM api_tokens
        WHERE token_hash = $1 AND is_revoked = FALSE
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

    // Development override (opt-in — rejected by default, refused in
    // production environments; see `is_dev_api_token`).
    if is_dev_api_token(token) {
        return Ok(Some(AuthenticatedUser::development_user()));
    }

    Ok(None)
}

/// Development-only override for legacy `dev-…` Bearer callers (the shipped
/// iOS app hardcodes such a token). There is **no hardcoded token anywhere
/// in this crate**: this path authenticates only a caller-supplied token
/// that equals the `ALLTERNIT_DEV_BEARER` environment variable, and only
/// when ALL of the following hold:
///
/// 1. `ALLTERNIT_DEV_MODE` is explicitly `true`/`1` (defaults off),
/// 2. `ALLTERNIT_DEV_BEARER` is set to a non-empty value (the local dev
///    operator chooses it — e.g. export the legacy token while migrating
///    the iOS app), and
/// 3. neither `RUST_ENV` nor `ENVIRONMENT` is `production` — the override is
///    hard-refused in production, regardless of the other two settings.
///
/// A process that grants an authentication through this path logs at WARN
/// (once, plus the startup log in `dev_api_token_allowed`).
pub(crate) fn is_dev_api_token(token: &str) -> bool {
    if !dev_api_token_allowed() {
        return false;
    }
    match env::var("ALLTERNIT_DEV_BEARER") {
        Ok(expected) if !expected.is_empty() && token == expected => {
            static LOGGED: std::sync::OnceLock<()> = std::sync::OnceLock::new();
            LOGGED.get_or_init(|| {
                tracing::warn!(
                    "ALLTERNIT_DEV_BEARER override is ACTIVE: requests bearing the \
                     configured development bearer authenticate as the wildcard \
                     dev user. Local development only — this path is refused \
                     when RUST_ENV/ENVIRONMENT=production."
                );
            });
            true
        }
        _ => false,
    }
}

/// Gate for the development bearer override (see `is_dev_api_token`):
/// defaults off, and hard-refused when `RUST_ENV`/`ENVIRONMENT` is
/// `production` even if the enabling variables are set.
fn dev_api_token_allowed() -> bool {
    let production = ["RUST_ENV", "ENVIRONMENT"].iter().any(|key| {
        env::var(key)
            .map(|value| value == "production")
            .unwrap_or(false)
    });
    if production {
        if env::var("ALLTERNIT_DEV_MODE")
            .map(|value| value == "true" || value == "1")
            .unwrap_or(false)
        {
            tracing::error!(
                "ALLTERNIT_DEV_MODE is set but RUST_ENV/ENVIRONMENT=production — \
                 the development bearer override stays DISABLED."
            );
        }
        return false;
    }

    let enabled = env::var("ALLTERNIT_DEV_MODE")
        .map(|value| value == "true" || value == "1")
        .unwrap_or(false);
    if enabled && env::var("ALLTERNIT_DEV_BEARER").is_ok() {
        tracing::warn!(
            "Development bearer override enabled (ALLTERNIT_DEV_MODE=true). \
             Never set ALLTERNIT_DEV_MODE/ALLTERNIT_DEV_BEARER in a deployed \
             environment."
        );
        true
    } else {
        false
    }
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
    use serial_test::serial;
    use sqlx::PgPool;

    /// The exact token the legacy iOS app ships. It must never authenticate
    /// under default configuration.
    const LEGACY_DEV_TOKEN: &str = "dev-api-token";

    async fn test_pool() -> PgPool {
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

    #[tokio::test]
    #[serial]
    async fn legacy_dev_token_shape_is_rejected_by_default() {
        std::env::remove_var("ALLTERNIT_DEV_MODE");
        std::env::remove_var("ALLTERNIT_DEV_BEARER");
        std::env::remove_var("RUST_ENV");
        std::env::remove_var("ENVIRONMENT");
        let pool = test_pool().await;
        let user = validate_token_against_db(&pool, LEGACY_DEV_TOKEN)
            .await
            .unwrap();
        assert!(user.is_none(), "legacy dev-token shape must be rejected");
    }

    #[tokio::test]
    #[serial]
    async fn dev_override_requires_dev_mode_and_env_bearer() {
        let pool = test_pool().await;

        // ALLTERNIT_DEV_BEARER alone (no DEV_MODE) does not enable anything.
        std::env::remove_var("ALLTERNIT_DEV_MODE");
        std::env::set_var("ALLTERNIT_DEV_BEARER", LEGACY_DEV_TOKEN);
        assert!(
            validate_token_against_db(&pool, LEGACY_DEV_TOKEN)
                .await
                .unwrap()
                .is_none()
        );

        // DEV_MODE + matching env bearer authenticates as the dev user.
        std::env::set_var("ALLTERNIT_DEV_MODE", "1");
        let user = validate_token_against_db(&pool, LEGACY_DEV_TOKEN)
            .await
            .unwrap()
            .expect("override authenticates when explicitly enabled");
        assert_eq!(user.user_id, "dev-user");
        assert!(
            user.permissions.iter().any(|p| p == "*"),
            "dev user keeps wildcard permissions"
        );

        // A different bearer than the configured one is still rejected.
        assert!(
            validate_token_against_db(&pool, "some-other-token")
                .await
                .unwrap()
                .is_none()
        );

        std::env::remove_var("ALLTERNIT_DEV_MODE");
        std::env::remove_var("ALLTERNIT_DEV_BEARER");
    }

    #[tokio::test]
    #[serial]
    async fn dev_override_is_refused_in_production() {
        let pool = test_pool().await;
        std::env::set_var("ALLTERNIT_DEV_MODE", "1");
        std::env::set_var("ALLTERNIT_DEV_BEARER", LEGACY_DEV_TOKEN);
        std::env::set_var("ENVIRONMENT", "production");

        assert!(
            validate_token_against_db(&pool, LEGACY_DEV_TOKEN)
                .await
                .unwrap()
                .is_none(),
            "override must stay disabled when ENVIRONMENT=production"
        );
        assert!(
            !dev_api_token_allowed(),
            "gate reports disabled in production"
        );

        std::env::remove_var("ALLTERNIT_DEV_MODE");
        std::env::remove_var("ALLTERNIT_DEV_BEARER");
        std::env::remove_var("ENVIRONMENT");
    }
}
