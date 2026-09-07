//! Data-plane JWT verification (decision A1) — node side.
//!
//! The second hop of the two-hop auth model from
//! docs/architecture/2026-09-03-control-plane-data-plane-decision.md:
//!
//! 1. Browser → cloud-api: Clerk session JWT (verified by `auth`, unchanged).
//! 2. cloud-api → data-plane node (this binary): cloud-api mints a short-lived
//!    EdDSA JWT (`cmd/allternit-cloud-api/src/auth/dataplane_jwt.rs`) and
//!    relays the user's call with it; we verify it against cloud-api's public
//!    key, fetched from `GET /api/v1/auth/dp-jwks` and cached here.
//!
//! Verification enforces, via the `jsonwebtoken` crate (already in the tree,
//! v10):
//! - EdDSA signature against the JWKS key named by the token's `kid` header
//!   (cloud-api publishes `kid` = base64url(SHA-256(pubkey)), so rotation
//!   rotates the kid automatically),
//! - `iss` (default `allternit-cloud-api`, env `ALLTERNIT_DP_JWT_ISSUER`),
//! - `exp`/`nbf` with 60 s leeway (matching `auth`'s Clerk path),
//! - `aud` == this node's device id (`ALLTERNIT_NODE_DEVICE_ID`). When the
//!   device id is unset the aud check is skipped and a startup warning is
//!   logged (self-hosted/local nodes that have not been paired yet),
//! - non-empty `sub` (the Clerk user id — the authenticated identity).
//!
//! JWKS caching mirrors `auth::JwksManager`: keys are fetched on first use,
//! cached for [`JWKS_CACHE_TTL`], and an unknown `kid` against a fresh cache
//! is treated as "not a data-plane token" so Clerk bearer tokens fall through
//! to the Clerk path without extra fetches. A failed fetch negative-caches
//! for the same TTL so a Clerk-only deployment does not retry every request.
//! Rotation therefore lands within one TTL window (or on restart).
//!
//! Unlike cloud-api's mint side — which avoids `jsonwebtoken` v10 because
//! Clerk's numeric `oiat` breaks its `Header` extras — data-plane tokens
//! carry only string header members, so `decode`/`decode_header` work as-is.
//! The `kid` is still extracted with a manual base64 parse for symmetry with
//! `auth::jwt_header_kid` and to stay robust against future header extras.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::warn;

pub const JWKS_URL_ENV: &str = "ALLTERNIT_CLOUD_JWKS_URL";
pub const DEVICE_ID_ENV: &str = "ALLTERNIT_NODE_DEVICE_ID";
pub const ISSUER_ENV: &str = "ALLTERNIT_DP_JWT_ISSUER";

const DEFAULT_JWKS_URL: &str = "https://api.allternit.com/api/v1/auth/dp-jwks";
const DEFAULT_ISSUER: &str = "allternit-cloud-api";
/// Verify-side clock skew allowance, matching `auth`'s Clerk leeway.
const LEEWAY_SECS: u64 = 60;
/// How long a fetched JWKS (or a fetch failure) is trusted before refetching.
const JWKS_CACHE_TTL: Duration = Duration::from_secs(3600);
/// How long to wait for the JWKS endpoint.
const JWKS_FETCH_TIMEOUT: Duration = Duration::from_secs(10);

/// Claims carried by the data-plane JWT. `sub` is the Clerk user id, `aud`
/// is the target node/device id, `scope` is the capability being exercised
/// (e.g. `runtime:execute`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataPlaneClaims {
    pub iss: String,
    pub sub: String,
    pub aud: String,
    pub iat: u64,
    pub nbf: u64,
    pub exp: u64,
    pub scope: String,
    pub jti: String,
}

/// One key from cloud-api's data-plane JWKS (`kty` OKP / `crv` Ed25519,
/// `kid` + raw-key `x` in base64url).
#[derive(Debug, Deserialize, Clone)]
struct DpJwk {
    kid: String,
    kty: String,
    #[serde(default)]
    crv: Option<String>,
    x: String,
    #[serde(default)]
    alg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DpJwksResponse {
    keys: Vec<DpJwk>,
}

struct CachedDpJwks {
    keys: HashMap<String, DpJwk>,
    fetched_at: Instant,
}

/// Fetches and caches cloud-api's data-plane JWKS and verifies tokens
/// against it. Constructed once at startup (`from_env`) and stored on
/// `AppState`; `disabled()` is for tests of routes that never see a
/// data-plane token.
pub struct DataPlaneJwks {
    cache: RwLock<Option<CachedDpJwks>>,
    client: reqwest::Client,
    /// `None` disables data-plane auth entirely (test deployments).
    jwks_url: Option<String>,
    expected_issuer: String,
    device_id: Option<String>,
    cache_ttl: Duration,
}

impl DataPlaneJwks {
    /// Build from the environment: JWKS URL, issuer, and this node's device
    /// id all have env overrides with production defaults.
    pub fn from_env() -> Self {
        let jwks_url = std::env::var(JWKS_URL_ENV)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_JWKS_URL.to_string());
        let expected_issuer =
            std::env::var(ISSUER_ENV).unwrap_or_else(|_| DEFAULT_ISSUER.to_string());
        let device_id = std::env::var(DEVICE_ID_ENV)
            .ok()
            .filter(|value| !value.trim().is_empty());
        if device_id.is_none() {
            warn!(
                env = DEVICE_ID_ENV,
                "node device id not configured; data-plane JWT audience check disabled"
            );
        }
        Self::new(jwks_url, expected_issuer, device_id)
    }

    /// Never authenticates anything — for tests of unrelated routes.
    pub fn disabled() -> Self {
        Self {
            cache: RwLock::new(None),
            client: reqwest::Client::builder()
                .timeout(JWKS_FETCH_TIMEOUT)
                .build()
                .expect("Failed to build HTTP client"),
            jwks_url: None,
            expected_issuer: DEFAULT_ISSUER.to_string(),
            device_id: None,
            cache_ttl: JWKS_CACHE_TTL,
        }
    }

    pub fn new(jwks_url: String, expected_issuer: String, device_id: Option<String>) -> Self {
        Self {
            cache: RwLock::new(None),
            client: reqwest::Client::builder()
                .timeout(JWKS_FETCH_TIMEOUT)
                .build()
                .expect("Failed to build HTTP client"),
            jwks_url: Some(jwks_url),
            expected_issuer,
            device_id,
            cache_ttl: JWKS_CACHE_TTL,
        }
    }

    /// Test seam: override the cache TTL so expiry/refresh behavior is
    /// exercisable without waiting an hour.
    #[cfg(test)]
    fn with_cache_ttl(mut self, ttl: Duration) -> Self {
        self.cache_ttl = ttl;
        self
    }

    /// Attempt to authenticate a bearer token as a cloud-api data-plane JWT.
    ///
    /// Returns `Some(claims)` only when the token fully verifies (signature,
    /// issuer, lifetime, audience, non-empty subject). Returns `None` for
    /// anything else — including Clerk tokens, which simply fall through to
    /// the Clerk bearer path in `auth::auth_middleware`.
    pub async fn authenticate(&self, token: &str) -> Option<DataPlaneClaims> {
        let jwks_url = self.jwks_url.as_ref()?;
        let kid = jwt_header_kid(token)?;
        let jwk = self.get_key(jwks_url, &kid).await?;
        if jwk.kty != "OKP" || jwk.crv.as_deref() != Some("Ed25519") {
            warn!(kid = %kid, "data-plane JWKS key is not Ed25519; rejecting");
            return None;
        }
        let key = DecodingKey::from_ed_components(&jwk.x).ok()?;
        let mut validation = Validation::new(Algorithm::EdDSA);
        validation.leeway = LEEWAY_SECS;
        // jsonwebtoken v10 defaults validate_nbf to false and only enforces
        // iss/aud when present — fail closed instead: cloud-api always mints
        // these claims, so require them.
        validation.validate_nbf = true;
        validation.set_required_spec_claims(&["exp", "nbf", "iss", "sub"]);
        validation.set_issuer(&[self.expected_issuer.clone()]);
        match self.device_id.as_deref() {
            Some(device_id) => {
                validation.set_audience(&[device_id]);
                validation.set_required_spec_claims(&["exp", "nbf", "iss", "sub", "aud"]);
            }
            None => validation.validate_aud = false,
        }
        let claims = decode::<DataPlaneClaims>(token, &key, &validation)
            .ok()?
            .claims;
        if claims.sub.is_empty() {
            warn!(kid = %kid, "data-plane token has an empty subject; rejecting");
            return None;
        }
        Some(claims)
    }

    /// Resolve a JWK by `kid`: fresh cache hit returns immediately; an
    /// unknown kid against a fresh cache means "not a data-plane token"
    /// (no refetch — keeps Clerk tokens from hammering the endpoint); a
    /// stale cache triggers exactly one refetch.
    async fn get_key(&self, jwks_url: &str, kid: &str) -> Option<DpJwk> {
        {
            let cache = self.cache.read().await;
            if let Some(ref cached) = *cache {
                if cached.fetched_at.elapsed() < self.cache_ttl {
                    return cached.keys.get(kid).cloned();
                }
            }
        }
        match self.fetch_jwks(jwks_url).await {
            Ok(keys) => {
                let jwk = keys.get(kid).cloned();
                let mut cache = self.cache.write().await;
                *cache = Some(CachedDpJwks {
                    keys,
                    fetched_at: Instant::now(),
                });
                jwk
            }
            Err(error) => {
                // Negative-cache the failure (or keep serving the previous
                // keys, if any) so the next request does not retry.
                let mut cache = self.cache.write().await;
                let stale = cache
                    .as_ref()
                    .is_none_or(|cached| cached.fetched_at.elapsed() >= self.cache_ttl);
                if stale {
                    let keys = cache
                        .take()
                        .map(|cached| cached.keys)
                        .unwrap_or_default();
                    *cache = Some(CachedDpJwks {
                        keys,
                        fetched_at: Instant::now(),
                    });
                }
                warn!(error = %error, "failed to fetch data-plane JWKS; token not treated as data-plane");
                None
            }
        }
    }

    async fn fetch_jwks(&self, jwks_url: &str) -> Result<HashMap<String, DpJwk>, String> {
        let response = self
            .client
            .get(jwks_url)
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let jwks: DpJwksResponse = response.json().await.map_err(|error| error.to_string())?;
        Ok(jwks.keys.into_iter().map(|key| (key.kid.clone(), key)).collect())
    }
}

/// Extracts `kid` from a JWT header without `jsonwebtoken`'s `Header`
/// deserialization, mirroring `auth::jwt_header_kid` (v10 rejects non-string
/// header extras; parsing manually keeps this path robust regardless).
fn jwt_header_kid(token: &str) -> Option<String> {
    let part = token.split('.').next()?;
    let bytes = URL_SAFE_NO_PAD.decode(part).ok()?;
    let header: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    header.get("kid").and_then(|value| value.as_str()).map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::engine::general_purpose::STANDARD;
    use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
    use sha2::Digest as _;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};

    /// Serializes the env-touching tests in this module.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn test_signing_key(seed: u8) -> SigningKey {
        SigningKey::from_bytes(&[seed; 32])
    }

    fn kid_for(verifying: &VerifyingKey) -> String {
        URL_SAFE_NO_PAD.encode(sha2::Sha256::digest(verifying.to_bytes()))
    }

    /// Mint a data-plane-shaped JWT exactly the way
    /// cloud-api's `dataplane_jwt::mint_with_key` does (three base64url
    /// segments, EdDSA header with kid) — the interop contract under test.
    fn mint(signing: &SigningKey, claims: &DataPlaneClaims) -> String {
        let header = URL_SAFE_NO_PAD.encode(
            serde_json::to_string(&serde_json::json!({
                "alg": "EdDSA",
                "typ": "JWT",
                "kid": kid_for(&signing.verifying_key()),
            }))
            .unwrap(),
        );
        let payload = URL_SAFE_NO_PAD.encode(serde_json::to_string(claims).unwrap());
        let signature: Signature = signing.sign(format!("{header}.{payload}").as_bytes());
        format!("{header}.{payload}.{}", URL_SAFE_NO_PAD.encode(signature.to_bytes()))
    }

    fn claims(now: u64, aud: &str) -> DataPlaneClaims {
        DataPlaneClaims {
            iss: DEFAULT_ISSUER.to_string(),
            sub: "user_123".to_string(),
            aud: aud.to_string(),
            iat: now,
            nbf: now,
            exp: now + 600,
            scope: "runtime:execute".to_string(),
            jti: uuid::Uuid::new_v4().to_string(),
        }
    }

    fn now_secs() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0)
    }

    fn jwks_json(signing: &SigningKey) -> String {
        serde_json::json!({
            "keys": [{
                "kty": "OKP",
                "use": "sig",
                "alg": "EdDSA",
                "crv": "Ed25519",
                "kid": kid_for(&signing.verifying_key()),
                "x": URL_SAFE_NO_PAD.encode(signing.verifying_key().to_bytes()),
            }],
        })
        .to_string()
    }

    /// A local JWKS HTTP server with a request counter and a swappable body,
    /// standing in for cloud-api's `GET /api/v1/auth/dp-jwks`.
    struct MockJwksServer {
        url: String,
        hits: Arc<AtomicUsize>,
        body: Arc<std::sync::RwLock<String>>,
    }

    impl MockJwksServer {
        async fn start(signing: &SigningKey) -> Self {
            let hits = Arc::new(AtomicUsize::new(0));
            let body = Arc::new(std::sync::RwLock::new(jwks_json(signing)));
            let app = axum::Router::new().route(
                "/api/v1/auth/dp-jwks",
                axum::routing::get({
                    let hits = hits.clone();
                    let body = body.clone();
                    move || {
                        let hits = hits.clone();
                        let body = body.clone();
                        async move {
                            hits.fetch_add(1, Ordering::SeqCst);
                            axum::Json(
                                serde_json::from_str::<serde_json::Value>(
                                    &body.read().unwrap(),
                                )
                                .unwrap(),
                            )
                        }
                    }
                }),
            );
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let url = format!("http://{}", listener.local_addr().unwrap());
            tokio::spawn(async move {
                axum::serve(listener, app).await.unwrap();
            });
            Self { url, hits, body }
        }

        fn hits(&self) -> usize {
            self.hits.load(Ordering::SeqCst)
        }

        fn rotate(&self, signing: &SigningKey) {
            *self.body.write().unwrap() = jwks_json(signing);
        }
    }

    fn verifier_for(server: &MockJwksServer, device_id: Option<&str>) -> DataPlaneJwks {
        DataPlaneJwks::new(
            format!("{}/api/v1/auth/dp-jwks", server.url),
            DEFAULT_ISSUER.to_string(),
            device_id.map(str::to_string),
        )
    }

    #[tokio::test]
    async fn valid_mint_is_accepted_and_returns_sub() {
        let key = test_signing_key(7);
        let server = MockJwksServer::start(&key).await;
        let verifier = verifier_for(&server, Some("rt_node_1"));
        let token = mint(&key, &claims(now_secs(), "rt_node_1"));

        let claims = verifier.authenticate(&token).await.expect("valid DP token accepted");
        assert_eq!(claims.sub, "user_123");
        assert_eq!(claims.aud, "rt_node_1");
        assert_eq!(claims.scope, "runtime:execute");
        assert_eq!(server.hits(), 1, "JWKS fetched once");
        // Second verification of the same token hits the cache.
        assert!(verifier.authenticate(&token).await.is_some());
        assert_eq!(server.hits(), 1, "cached JWKS is not refetched");
    }

    #[tokio::test]
    async fn token_signed_by_an_unknown_key_is_rejected_and_falls_through() {
        let published = test_signing_key(7);
        let other = test_signing_key(9);
        let server = MockJwksServer::start(&published).await;
        let verifier = verifier_for(&server, Some("rt_node_1"));
        let token = mint(&other, &claims(now_secs(), "rt_node_1"));

        assert!(verifier.authenticate(&token).await.is_none());
        // One fetch to learn the JWKS; the unknown kid then falls through
        // without refetching (a Clerk token must not hammer the endpoint).
        assert!(verifier.authenticate(&token).await.is_none());
        assert_eq!(server.hits(), 1);
    }

    #[tokio::test]
    async fn tampered_payload_fails_signature() {
        let key = test_signing_key(7);
        let server = MockJwksServer::start(&key).await;
        let verifier = verifier_for(&server, Some("rt_node_1"));
        let token = mint(&key, &claims(now_secs(), "rt_node_1"));
        let mut parts: Vec<String> = token.split('.').map(str::to_string).collect();
        let mut payload: serde_json::Value =
            serde_json::from_slice(&URL_SAFE_NO_PAD.decode(&parts[1]).unwrap()).unwrap();
        payload["aud"] = serde_json::json!("rt_evil");
        parts[1] = URL_SAFE_NO_PAD.encode(serde_json::to_string(&payload).unwrap());

        assert!(verifier.authenticate(&parts.join(".")).await.is_none());
    }

    #[tokio::test]
    async fn expired_and_not_yet_valid_tokens_are_rejected() {
        let key = test_signing_key(7);
        let server = MockJwksServer::start(&key).await;
        let verifier = verifier_for(&server, Some("rt_node_1"));
        let now = now_secs();

        let mut expired = claims(now, "rt_node_1");
        expired.iat -= 3600;
        expired.nbf -= 3600;
        expired.exp -= 3600;
        assert!(verifier.authenticate(&mint(&key, &expired)).await.is_none());

        let mut future = claims(now, "rt_node_1");
        future.nbf += 3600;
        assert!(verifier.authenticate(&mint(&key, &future)).await.is_none());
    }

    #[tokio::test]
    async fn alg_none_and_malformed_tokens_are_rejected() {
        let key = test_signing_key(7);
        let server = MockJwksServer::start(&key).await;
        let verifier = verifier_for(&server, Some("rt_node_1"));
        let now = now_secs();

        let payload = URL_SAFE_NO_PAD.encode(serde_json::to_string(&claims(now, "rt_node_1")).unwrap());
        let none = format!(
            "{}.{payload}.{}",
            URL_SAFE_NO_PAD.encode(r#"{"alg":"none","typ":"JWT"}"#),
            URL_SAFE_NO_PAD.encode([0u8; 64])
        );
        assert!(verifier.authenticate(&none).await.is_none());
        assert!(verifier.authenticate("not-a-jwt").await.is_none());
        assert!(verifier.authenticate("a.b.c").await.is_none());
    }

    #[tokio::test]
    async fn audience_mismatch_is_rejected_unless_device_id_unset() {
        let key = test_signing_key(7);
        let server = MockJwksServer::start(&key).await;
        let now = now_secs();
        let wrong_aud = mint(&key, &claims(now, "rt_other_node"));

        let verifier = verifier_for(&server, Some("rt_node_1"));
        assert!(verifier.authenticate(&wrong_aud).await.is_none());

        // Unset device id skips the aud check (with a startup warning).
        let verifier = verifier_for(&server, None);
        assert!(verifier.authenticate(&wrong_aud).await.is_some());
    }

    #[tokio::test]
    async fn issuer_mismatch_and_empty_subject_are_rejected() {
        let key = test_signing_key(7);
        let server = MockJwksServer::start(&key).await;
        let now = now_secs();

        let mut wrong_iss = claims(now, "rt_node_1");
        wrong_iss.iss = "evil-issuer".to_string();
        let verifier = verifier_for(&server, Some("rt_node_1"));
        assert!(verifier.authenticate(&mint(&key, &wrong_iss)).await.is_none());

        let mut empty_sub = claims(now, "rt_node_1");
        empty_sub.sub = String::new();
        assert!(verifier.authenticate(&mint(&key, &empty_sub)).await.is_none());
    }

    #[tokio::test]
    async fn stale_cache_refetches_and_picks_up_key_rotation() {
        let key_a = test_signing_key(7);
        let key_b = test_signing_key(9);
        let server = MockJwksServer::start(&key_a).await;
        // A short TTL lets the "stale cache" path run for real.
        let verifier = verifier_for(&server, Some("rt_node_1")).with_cache_ttl(Duration::from_millis(40));
        let now = now_secs();

        let token_a = mint(&key_a, &claims(now, "rt_node_1"));
        assert!(verifier.authenticate(&token_a).await.is_some());
        assert_eq!(server.hits(), 1);

        // A fresh cache does not refetch for an unknown (rotated) kid.
        let token_b = mint(&key_b, &claims(now, "rt_node_1"));
        assert!(verifier.authenticate(&token_b).await.is_none());
        assert_eq!(server.hits(), 1);

        // Once the cache is stale the rotated key is fetched and accepted.
        tokio::time::sleep(Duration::from_millis(60)).await;
        server.rotate(&key_b);
        assert!(verifier.authenticate(&token_b).await.is_some());
        assert_eq!(server.hits(), 2);
    }

    #[tokio::test]
    async fn unreachable_jwks_endpoint_falls_through_without_retry_storm() {
        let verifier = DataPlaneJwks::new(
            "http://127.0.0.1:1/api/v1/auth/dp-jwks".to_string(),
            DEFAULT_ISSUER.to_string(),
            Some("rt_node_1".to_string()),
        );
        let key = test_signing_key(7);
        let token = mint(&key, &claims(now_secs(), "rt_node_1"));
        assert!(verifier.authenticate(&token).await.is_none());
        assert!(verifier.authenticate(&token).await.is_none());
    }

    #[test]
    fn from_env_reads_overrides_and_defaults() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var(JWKS_URL_ENV);
        std::env::remove_var(ISSUER_ENV);
        std::env::remove_var(DEVICE_ID_ENV);
        let verifier = DataPlaneJwks::from_env();
        assert_eq!(verifier.jwks_url.as_deref(), Some(DEFAULT_JWKS_URL));
        assert_eq!(verifier.expected_issuer, DEFAULT_ISSUER);
        assert!(verifier.device_id.is_none());

        std::env::set_var(JWKS_URL_ENV, "http://localhost:8080/jwks");
        std::env::set_var(ISSUER_ENV, "custom-issuer");
        std::env::set_var(DEVICE_ID_ENV, "dev_node_1");
        let verifier = DataPlaneJwks::from_env();
        assert_eq!(verifier.jwks_url.as_deref(), Some("http://localhost:8080/jwks"));
        assert_eq!(verifier.expected_issuer, "custom-issuer");
        assert_eq!(verifier.device_id.as_deref(), Some("dev_node_1"));

        std::env::remove_var(JWKS_URL_ENV);
        std::env::remove_var(ISSUER_ENV);
        std::env::remove_var(DEVICE_ID_ENV);
    }

    #[tokio::test]
    async fn disabled_verifier_authenticates_nothing() {
        let verifier = DataPlaneJwks::disabled();
        let key = test_signing_key(7);
        let token = mint(&key, &claims(now_secs(), "rt_node_1"));
        assert!(verifier.jwks_url.is_none());
        assert!(verifier.authenticate(&token).await.is_none());
    }

    #[test]
    fn kid_matches_cloud_apis_sha256_derivation() {
        let key = test_signing_key(7);
        let verifying = key.verifying_key();
        let kid = kid_for(&verifying);
        let decoded = URL_SAFE_NO_PAD.decode(kid).unwrap();
        assert_eq!(decoded, sha2::Sha256::digest(verifying.to_bytes()).to_vec());
        // And STANDARD base64 decoding the seed matches cloud-api's env format.
        let seed_b64 = STANDARD.encode([7u8; 32]);
        let seed = STANDARD.decode(seed_b64).unwrap();
        assert_eq!(seed, [7u8; 32]);
    }
}
