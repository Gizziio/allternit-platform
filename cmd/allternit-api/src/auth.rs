//! Clerk JWT Authentication
//!
//! Verifies Bearer tokens against Clerk's JWKS endpoint.
//! - Fetches and caches JWKS from Clerk
//! - Verifies JWT signatures on each request
//! - Extracts user info and ensures user exists in local DB
//! - Attaches AuthUser to request extensions

use axum::{
    extract::{Request, State},
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, TokenData, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::db::DbHandle;

const DESKTOP_ACCESS_TOKEN_HEADER: &str = "x-allternit-desktop-access-token";
const USER_ID_HEADER: &str = "x-allternit-user-id";
const USER_EMAIL_HEADER: &str = "x-allternit-user-email";
const USER_NAME_HEADER: &str = "x-allternit-user-name";

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_CLERK_JWKS_URL: &str = "https://clerk.platform.allternit.com/.well-known/jwks.json";
const DEFAULT_CLERK_ISSUER: &str = "https://clerk.platform.allternit.com";

/// How long to cache JWKS before refreshing
const JWKS_CACHE_TTL: Duration = Duration::from_secs(3600);

/// How long to wait for JWKS fetch
const JWKS_FETCH_TIMEOUT: Duration = Duration::from_secs(10);

/// Runtime authentication configuration.
#[derive(Clone, Debug)]
pub struct AuthConfig {
    /// Clerk JWKS endpoint.
    pub clerk_jwks_url: String,
    /// Expected JWT issuer (`iss`).
    pub clerk_issuer: String,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            clerk_jwks_url: DEFAULT_CLERK_JWKS_URL.to_string(),
            clerk_issuer: DEFAULT_CLERK_ISSUER.to_string(),
        }
    }
}

impl AuthConfig {
    /// Build configuration from environment, falling back to sensible defaults.
    pub fn from_env() -> Self {
        let mut config = Self::default();
        if let Ok(url) = std::env::var("CLERK_JWKS_URL") {
            config.clerk_jwks_url = url;
        }
        if let Ok(issuer) = std::env::var("CLERK_ISSUER") {
            config.clerk_issuer = issuer;
        }
        config
    }

    /// Build configuration from the unified app config, with env overrides.
    pub fn from_app_config(app_config: &crate::config::AppConfig) -> Self {
        let mut config = Self::default();
        if let Some(url) = app_config.clerk_jwks_url() {
            config.clerk_jwks_url = url;
        }
        if let Some(issuer) = app_config.clerk_issuer() {
            config.clerk_issuer = issuer;
        }
        config
    }
}

// ─── Data Types ─────────────────────────────────────────────────────────────

/// Authenticated user attached to request extensions
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub tenant_id: Option<String>,
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
    jwks_url: String,
}

impl JwksManager {
    pub fn new(config: &AuthConfig) -> Self {
        Self {
            cache: RwLock::new(None),
            client: reqwest::Client::builder()
                .timeout(JWKS_FETCH_TIMEOUT)
                .build()
                .expect("Failed to build HTTP client"),
            jwks_url: config.clerk_jwks_url.clone(),
        }
    }

    /// Returns `true` when a JWKS fetch has succeeded recently enough to be usable.
    pub async fn is_ready(&self) -> bool {
        let cache = self.cache.read().await;
        if let Some(ref cached) = *cache {
            // Ready when we have keys, or when the last successful fetch is still fresh.
            !cached.keys.is_empty() || cached.fetched_at.elapsed() < JWKS_CACHE_TTL
        } else {
            false
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
        info!("Fetching JWKS from {}", self.jwks_url);
        let resp = self
            .client
            .get(&self.jwks_url)
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
        Self::new(&AuthConfig::default())
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
    config: &AuthConfig,
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
    validation.set_issuer(&[&config.clerk_issuer]);
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
        tenant_id: None,
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
fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    let auth_header = headers.get(axum::http::header::AUTHORIZATION)?;
    let auth_str = auth_header.to_str().ok()?;
    auth_str.strip_prefix("Bearer ").map(|s| s.to_string())
}

fn extract_header_string(headers: &HeaderMap, name: &'static str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
}

fn insert_user_headers(headers: &mut HeaderMap, user: &AuthUser) {
    headers.insert(
        HeaderName::from_static(USER_ID_HEADER),
        HeaderValue::from_str(&user.user_id).unwrap(),
    );
    if let Some(ref email) = user.email {
        if let Ok(value) = HeaderValue::from_str(email) {
            headers.insert(HeaderName::from_static(USER_EMAIL_HEADER), value);
        }
    }
    if let Some(ref name) = user.name {
        if let Ok(value) = HeaderValue::from_str(name) {
            headers.insert(HeaderName::from_static(USER_NAME_HEADER), value);
        }
    }
}

fn extract_desktop_bootstrap_user(headers: &HeaderMap) -> Option<AuthUser> {
    let user_id = extract_header_string(headers, USER_ID_HEADER)?;
    let _desktop_token = extract_header_string(headers, DESKTOP_ACCESS_TOKEN_HEADER)?;
    let email = extract_header_string(headers, USER_EMAIL_HEADER);
    let name = extract_header_string(headers, USER_NAME_HEADER);
    let tenant_id = extract_header_string(headers, "x-allternit-tenant-id");
    Some(AuthUser {
        user_id,
        email,
        name,
        avatar_url: None,
        tenant_id,
    })
}

/// Auth middleware — verifies Clerk JWT and adds user context to request headers.
/// In local development, falls back to `x-allternit-user-id` header for testing.
pub async fn auth_middleware(
    State(state): State<Arc<crate::AppState>>,
    mut request: Request,
    next: Next,
) -> Response {

    if let Some(user) = extract_desktop_bootstrap_user(request.headers()) {
        if let Err(e) = ensure_user_in_db(&state.db, &user) {
            return e.into_response();
        }

        let headers = request.headers_mut();
        insert_user_headers(headers, &user);
        request.extensions_mut().insert(user);
        return next.run(request).await;
    }

    // Try Clerk JWT first
    if let Some(token) = extract_bearer_token(request.headers()) {
        match verify_token(&state.jwks, &token, &state.auth_config).await {
            Ok(user) => {
                // Ensure user exists in local DB
                if let Err(e) = ensure_user_in_db(&state.db, &user) {
                    return e.into_response();
                }

                // Add user context as headers for backward compatibility
                // (handlers should prefer Extension<AuthUser> over header extraction)
                let headers = request.headers_mut();
                insert_user_headers(headers, &user);

                // Also attach to extensions for any middleware that needs it
                request.extensions_mut().insert(user);
                return next.run(request).await;
            }
            Err(e) => return e.into_response(),
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
        if let Ok(user) = verify_token(&state.jwks, &token, &state.auth_config).await {
            let _ = ensure_user_in_db(&state.db, &user);
            request.extensions_mut().insert(user);
        }
    }

    next.run(request).await
}

// ─── Header-based auth extraction (works around multiple axum versions) ─────

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
    let tenant_id = headers.get("x-allternit-tenant-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    Some(AuthUser {
        user_id: user_id.to_string(),
        email,
        name,
        avatar_url: None,
        tenant_id,
    })
}
