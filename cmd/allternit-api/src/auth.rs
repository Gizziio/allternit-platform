//! Clerk JWT Authentication
//!
//! Verifies Bearer tokens against Clerk's JWKS endpoint.
//! - Fetches and caches JWKS from Clerk
//! - Verifies JWT signatures on each request
//! - Extracts user info and ensures user exists in local DB
//! - Attaches AuthUser to request extensions

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, TokenData, Validation};
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::db::DbHandle;

// ─── Configuration ──────────────────────────────────────────────────────────

/// Clerk JWKS URL — derived from the publishable key domain.
/// Key pk_live_Y2xlcmsucGxhdGZvcm0uYWxsdGVybml0LmNvbSQ decodes to clerk.platform.allternit.com
const CLERK_JWKS_URL: &str = "https://clerk.platform.allternit.com/.well-known/jwks.json";

/// How long to cache JWKS before refreshing
const JWKS_CACHE_TTL: Duration = Duration::from_secs(3600);

/// How long to wait for JWKS fetch
const JWKS_FETCH_TIMEOUT: Duration = Duration::from_secs(10);

// ─── Data Types ─────────────────────────────────────────────────────────────

/// Authenticated user attached to request extensions
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

/// Clerk JWT claims
#[derive(Debug, Serialize, Deserialize)]
struct ClerkClaims {
    /// Subject — Clerk user ID (e.g. "user_abc123")
    sub: String,
    /// Email address
    #[serde(default)]
    email: Option<String>,
    /// Full name
    #[serde(default)]
    name: Option<String>,
    /// Avatar URL
    #[serde(default, rename = "image_url")]
    image_url: Option<String>,
    /// Issuer
    iss: String,
    /// Expiration
    exp: usize,
}

/// JWKS key entry
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
struct JwkKey {
    kid: String,
    kty: String,
    #[serde(rename = "use", default)]
    key_use: Option<String>,
    n: Option<String>,
    e: Option<String>,
    #[serde(flatten)]
    extra: HashMap<String, serde_json::Value>,
}

/// JWKS response
#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<JwkKey>,
}

/// Cached JWKS with timestamp
struct CachedJwks {
    keys: HashMap<String, JwkKey>,
    fetched_at: Instant,
}

// ─── JWKS Manager ───────────────────────────────────────────────────────────

pub struct JwksManager {
    cache: RwLock<Option<CachedJwks>>,
    client: reqwest::Client,
}

impl JwksManager {
    pub fn new() -> Self {
        Self {
            cache: RwLock::new(None),
            client: reqwest::Client::builder()
                .timeout(JWKS_FETCH_TIMEOUT)
                .build()
                .expect("Failed to build HTTP client"),
        }
    }

    /// Get a JWK by key ID, fetching from Clerk if necessary
    async fn get_key(&self, kid: &str) -> Option<JwkKey> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(ref cached) = *cache {
                if cached.fetched_at.elapsed() < JWKS_CACHE_TTL {
                    if let Some(key) = cached.keys.get(kid) {
                        return Some(key.clone());
                    }
                }
            }
        }

        // Cache miss or expired — fetch fresh JWKS
        match self.fetch_jwks().await {
            Ok(keys) => {
                let mut cache = self.cache.write().await;
                *cache = Some(CachedJwks {
                    keys: keys.clone(),
                    fetched_at: Instant::now(),
                });
                keys.get(kid).cloned()
            }
            Err(e) => {
                error!("Failed to fetch JWKS: {}", e);
                None
            }
        }
    }

    async fn fetch_jwks(&self) -> Result<HashMap<String, JwkKey>, AuthError> {
        info!("Fetching JWKS from {}", CLERK_JWKS_URL);
        let resp = self
            .client
            .get(CLERK_JWKS_URL)
            .send()
            .await
            .map_err(|e| AuthError::JwksFetch(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(AuthError::JwksFetch(format!(
                "HTTP {}",
                resp.status()
            )));
        }

        let jwks: JwksResponse = resp
            .json()
            .await
            .map_err(|e| AuthError::JwksParse(e.to_string()))?;

        let mut keys = HashMap::new();
        for key in jwks.keys {
            keys.insert(key.kid.clone(), key);
        }

        info!("Loaded {} JWKS keys", keys.len());
        Ok(keys)
    }
}

impl Default for JwksManager {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Auth Errors ────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidTokenFormat,
    JwksFetch(String),
    JwksParse(String),
    KeyNotFound(String),
    TokenDecode(String),
    Expired,
    DbError(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::MissingToken => write!(f, "Missing authorization token"),
            AuthError::InvalidTokenFormat => write!(f, "Invalid authorization header format"),
            AuthError::JwksFetch(msg) => write!(f, "JWKS fetch error: {}", msg),
            AuthError::JwksParse(msg) => write!(f, "JWKS parse error: {}", msg),
            AuthError::KeyNotFound(kid) => write!(f, "JWKS key not found: {}", kid),
            AuthError::TokenDecode(msg) => write!(f, "Token decode error: {}", msg),
            AuthError::Expired => write!(f, "Token expired"),
            AuthError::DbError(msg) => write!(f, "Database error: {}", msg),
        }
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing authorization token"),
            AuthError::InvalidTokenFormat => {
                (StatusCode::UNAUTHORIZED, "Invalid authorization header format")
            }
            AuthError::JwksFetch(msg) => {
                error!("JWKS fetch error: {}", msg);
                (StatusCode::SERVICE_UNAVAILABLE, "Authentication service unavailable")
            }
            AuthError::JwksParse(msg) => {
                error!("JWKS parse error: {}", msg);
                (StatusCode::SERVICE_UNAVAILABLE, "Authentication service unavailable")
            }
            AuthError::KeyNotFound(kid) => {
                warn!("JWKS key not found: {}", kid);
                (StatusCode::UNAUTHORIZED, "Invalid token signature")
            }
            AuthError::TokenDecode(msg) => {
                warn!("Token decode error: {}", msg);
                (StatusCode::UNAUTHORIZED, "Invalid token")
            }
            AuthError::Expired => (StatusCode::UNAUTHORIZED, "Token expired"),
            AuthError::DbError(msg) => {
                error!("Auth DB error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
            }
        };

        let body = Json(json!({
            "error": "Unauthorized",
            "message": message,
        }));

        (status, body).into_response()
    }
}

// ─── Token Verification ─────────────────────────────────────────────────────

pub async fn verify_token(
    jwks: &JwksManager,
    token: &str,
) -> Result<AuthUser, AuthError> {
    // Decode header to get key ID
    let header = decode_header(token)
        .map_err(|e| AuthError::TokenDecode(e.to_string()))?;

    let kid = header.kid.ok_or_else(|| {
        AuthError::TokenDecode("Token missing 'kid' header".to_string())
    })?;

    // Fetch the signing key
    let jwk = jwks
        .get_key(&kid)
        .await
        .ok_or_else(|| AuthError::KeyNotFound(kid))?;

    // Build decoding key from RSA components
    let n = jwk.n.as_ref().ok_or_else(|| {
        AuthError::KeyNotFound("JWK missing 'n'".to_string())
    })?;
    let e = jwk.e.as_ref().ok_or_else(|| {
        AuthError::KeyNotFound("JWK missing 'e'".to_string())
    })?;

    let decoding_key = DecodingKey::from_rsa_components(n, e)
        .map_err(|e| AuthError::TokenDecode(e.to_string()))?;

    // Validate token
    let mut validation = Validation::new(Algorithm::RS256);
    // Clerk tokens are issued by the Clerk instance
    validation.set_issuer(&["https://clerk.platform.allternit.com"]);
    // Accept tokens with or without audience
    validation.validate_aud = false;

    let token_data: TokenData<ClerkClaims> = decode(token, &decoding_key, &validation)
        .map_err(|e| match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::Expired,
            _ => AuthError::TokenDecode(e.to_string()),
        })?;

    let claims = token_data.claims;

    Ok(AuthUser {
        user_id: claims.sub,
        email: claims.email,
        name: claims.name,
        avatar_url: claims.image_url,
    })
}

/// Ensure a user exists in the local SQLite DB, creating if necessary
pub fn ensure_user_in_db(db: &DbHandle, user: &AuthUser) -> Result<(), AuthError> {
    let conn = db.connect().map_err(|e| AuthError::DbError(e.to_string()))?;

    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM users WHERE id = ?1 LIMIT 1",
            [&user.user_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !exists {
        info!("Creating local user record for {}", user.user_id);
        conn.execute(
            "INSERT INTO users (id, email, name, avatar_url, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                name = excluded.name,
                avatar_url = excluded.avatar_url,
                updated_at = CURRENT_TIMESTAMP",
            rusqlite::params![
                &user.user_id,
                user.email.as_deref().unwrap_or(""),
                user.name.as_deref().unwrap_or(""),
                user.avatar_url.as_deref().unwrap_or(""),
            ],
        )
        .map_err(|e| AuthError::DbError(e.to_string()))?;
    }

    Ok(())
}

// ─── Axum Middleware ────────────────────────────────────────────────────────

/// Extract Bearer token from Authorization header
fn extract_bearer_token(headers: &axum::http::HeaderMap) -> Option<String> {
    let auth_header = headers.get(axum::http::header::AUTHORIZATION)?;
    let auth_str = auth_header.to_str().ok()?;
    auth_str.strip_prefix("Bearer ").map(|s| s.to_string())
}

/// Auth middleware — verifies Clerk JWT and adds user context to request headers.
/// In local development, falls back to `x-allternit-user-id` header for testing.
pub async fn auth_middleware(
    State(state): State<Arc<crate::AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    // Dev bypass: skip auth entirely when ALLTERNIT_DEV_AUTH_BYPASS is set
    if std::env::var("ALLTERNIT_DEV_AUTH_BYPASS").ok().filter(|s| !s.is_empty()).is_some() {
        let user = AuthUser {
            user_id: "dev-user-001".to_string(),
            email: Some("dev@allternit.local".to_string()),
            name: Some("Dev User".to_string()),
            avatar_url: None,
        };
        let headers = request.headers_mut();
        headers.insert(
            axum::http::HeaderName::from_static("x-allternit-user-id"),
            axum::http::HeaderValue::from_str(&user.user_id).unwrap(),
        );
        headers.insert(
            axum::http::HeaderName::from_static("x-allternit-user-email"),
            axum::http::HeaderValue::from_str("dev@allternit.local").unwrap(),
        );
        headers.insert(
            axum::http::HeaderName::from_static("x-allternit-user-name"),
            axum::http::HeaderValue::from_str("Dev User").unwrap(),
        );
        request.extensions_mut().insert(user);
        return next.run(request).await;
    }

    // Try Clerk JWT first
    if let Some(token) = extract_bearer_token(request.headers()) {
        match verify_token(&state.jwks, &token).await {
            Ok(user) => {
                // Ensure user exists in local DB
                if let Err(e) = ensure_user_in_db(&state.db, &user) {
                    return e.into_response();
                }

                // Add user context as headers for backward compatibility
                // (handlers should prefer Extension<AuthUser> over header extraction)
                let headers = request.headers_mut();
                headers.insert(
                    axum::http::HeaderName::from_static("x-allternit-user-id"),
                    axum::http::HeaderValue::from_str(&user.user_id).unwrap(),
                );
                if let Some(ref email) = user.email {
                    if let Ok(val) = axum::http::HeaderValue::from_str(email) {
                        headers.insert(
                            axum::http::HeaderName::from_static("x-allternit-user-email"),
                            val,
                        );
                    }
                }
                if let Some(ref name) = user.name {
                    if let Ok(val) = axum::http::HeaderValue::from_str(name) {
                        headers.insert(
                            axum::http::HeaderName::from_static("x-allternit-user-name"),
                            val,
                        );
                    }
                }

                // Also attach to extensions for any middleware that needs it
                request.extensions_mut().insert(user);
                return next.run(request).await;
            }
            Err(e) => return e.into_response(),
        }
    }

    // Dev fallback: accept x-allternit-user-id header directly for local testing
    // ONLY when ALLTERNIT_DEV_AUTH_BYPASS is set — disabled in production
    let dev_bypass = std::env::var("ALLTERNIT_DEV_AUTH_BYPASS").ok().filter(|s| !s.is_empty()).is_some();
    if dev_bypass {
        let headers = request.headers();
        let user_id = headers.get("x-allternit-user-id").and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let email = headers.get("x-allternit-user-email").and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        let name = headers.get("x-allternit-user-name").and_then(|v| v.to_str().ok()).map(|s| s.to_string());
        if let Some(user_id) = user_id {
            let user = AuthUser {
                user_id,
                email,
                name,
                avatar_url: None,
            };

            if let Err(e) = ensure_user_in_db(&state.db, &user) {
                return e.into_response();
            }

            let user_id_log = user.user_id.clone();
            request.extensions_mut().insert(user);
            info!("Auth bypass: accepting x-allternit-user-id for local dev (user_id={})", user_id_log);
            return next.run(request).await;
        }
    }

    AuthError::MissingToken.into_response()
}

/// Optional auth middleware — verifies token if present, but allows anonymous requests
pub async fn optional_auth_middleware(
    State(state): State<Arc<crate::AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    if let Some(token) = extract_bearer_token(request.headers()) {
        if let Ok(user) = verify_token(&state.jwks, &token).await {
            let _ = ensure_user_in_db(&state.db, &user);
            request.extensions_mut().insert(user);
        }
    }

    next.run(request).await
}

// ─── Header-based auth extraction (works around multiple axum versions) ─────

use axum::http::HeaderMap;

/// Extract AuthUser from request headers set by auth_middleware.
/// 
/// **Deprecated**: Now that the axum version conflict is resolved, handlers should
/// use `Extension<AuthUser>` instead. This function is kept for backward
/// compatibility with any code that hasn't been migrated yet.
pub fn get_user(headers: &HeaderMap) -> Option<AuthUser> {
    let user_id = headers.get("x-allternit-user-id")?.to_str().ok()?;
    let email = headers.get("x-allternit-user-email")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let name = headers.get("x-allternit-user-name")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    Some(AuthUser {
        user_id: user_id.to_string(),
        email,
        name,
        avatar_url: None,
    })
}
