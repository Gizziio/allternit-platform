//! Clerk verification for human-facing cloud control-plane actions.
//!
//! Clerk proves who approved a runtime. The runtime receives a separate device
//! credential; the Clerk JWT is never handed to or stored by the runtime.

use axum::http::{header, HeaderMap};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::ApiError;

const DEFAULT_CLERK_ISSUER: &str = "https://clerk.platform.allternit.com";
const DEFAULT_CLERK_JWKS_URL: &str = "https://clerk.platform.allternit.com/.well-known/jwks.json";
const JWKS_TTL: Duration = Duration::from_secs(60 * 60);

#[derive(Clone, Debug)]
pub struct ClerkUser {
    pub id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub image_url: Option<String>,
    pub organization_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClerkClaims {
    sub: String,
    iss: String,
    exp: usize,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    email_address: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    image_url: Option<String>,
    /// Clerk session token v2 organization claim.
    #[serde(default)]
    o: Option<ClerkOrganizationClaims>,
    /// Clerk session token v1 organization claim.
    #[serde(default)]
    org_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClerkOrganizationClaims {
    id: String,
}

#[derive(Clone, Debug, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<Jwk>,
}

struct CachedKeys {
    fetched_at: Instant,
    keys: HashMap<String, Jwk>,
}

struct ClerkVerifier {
    client: reqwest::Client,
    cache: RwLock<Option<CachedKeys>>,
    issuer: String,
    jwks_url: String,
}

impl ClerkVerifier {
    fn from_env() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("failed to create Clerk HTTP client"),
            cache: RwLock::new(None),
            issuer: std::env::var("CLERK_ISSUER")
                .unwrap_or_else(|_| DEFAULT_CLERK_ISSUER.to_string()),
            jwks_url: std::env::var("CLERK_JWKS_URL")
                .unwrap_or_else(|_| DEFAULT_CLERK_JWKS_URL.to_string()),
        }
    }

    async fn key(&self, kid: &str) -> Result<Jwk, ApiError> {
        {
            let cache = self.cache.read().await;
            if let Some(cache) = cache.as_ref() {
                if cache.fetched_at.elapsed() < JWKS_TTL {
                    if let Some(key) = cache.keys.get(kid) {
                        return Ok(key.clone());
                    }
                }
            }
        }

        let response = self
            .client
            .get(&self.jwks_url)
            .send()
            .await
            .map_err(|error| ApiError::Unauthorized(format!("Clerk JWKS unavailable: {error}")))?;
        if !response.status().is_success() {
            return Err(ApiError::Unauthorized("Clerk JWKS unavailable".to_string()));
        }
        let jwks = response
            .json::<JwksResponse>()
            .await
            .map_err(|error| ApiError::Unauthorized(format!("Invalid Clerk JWKS: {error}")))?;
        let keys = jwks
            .keys
            .into_iter()
            .map(|key| (key.kid.clone(), key))
            .collect::<HashMap<_, _>>();
        let key = keys
            .get(kid)
            .cloned()
            .ok_or_else(|| ApiError::Unauthorized("Clerk signing key not found".to_string()))?;
        *self.cache.write().await = Some(CachedKeys {
            fetched_at: Instant::now(),
            keys,
        });
        Ok(key)
    }

    async fn verify(&self, token: &str) -> Result<ClerkUser, ApiError> {
        let header = decode_header(token)
            .map_err(|_| ApiError::Unauthorized("Invalid Clerk token".to_string()))?;
        let kid = header
            .kid
            .ok_or_else(|| ApiError::Unauthorized("Clerk token has no key id".to_string()))?;
        let jwk = self.key(&kid).await?;
        let key = DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
            .map_err(|_| ApiError::Unauthorized("Invalid Clerk signing key".to_string()))?;
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&self.issuer]);
        validation.validate_aud = false;
        let claims = decode::<ClerkClaims>(token, &key, &validation)
            .map_err(|_| ApiError::Unauthorized("Invalid or expired Clerk session".to_string()))?
            .claims;

        let organization_id = claims
            .o
            .map(|organization| organization.id)
            .or(claims.org_id);

        Ok(ClerkUser {
            id: claims.sub,
            email: claims.email.or(claims.email_address),
            name: claims.name,
            image_url: claims.image_url,
            organization_id,
        })
    }
}

fn verifier() -> &'static Arc<ClerkVerifier> {
    static VERIFIER: OnceLock<Arc<ClerkVerifier>> = OnceLock::new();
    VERIFIER.get_or_init(|| Arc::new(ClerkVerifier::from_env()))
}

pub async fn user_from_headers(headers: &HeaderMap) -> Result<ClerkUser, ApiError> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or_else(|| ApiError::Unauthorized("A Clerk session is required".to_string()))?;
    verifier().verify(token).await
}
