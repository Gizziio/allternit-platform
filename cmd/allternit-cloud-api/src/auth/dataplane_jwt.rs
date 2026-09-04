//! Data-plane JWT (decision A1) — cloud-api side.
//!
//! The second hop of the two-hop auth model from
//! docs/architecture/2026-09-03-control-plane-data-plane-decision.md:
//!
//! 1. Browser → cloud-api: Clerk session JWT (unchanged, `auth::clerk`).
//! 2. cloud-api → data-plane node: the calls below. Nodes accept calls only
//!    from cloud-api (network-enforced via tailnet ACL tags) and verify this
//!    JWT against cloud-api's public key, fetched at startup from
//!    `GET /api/v1/auth/dp-jwks`.
//!
//! Design:
//! - **Signing key:** a single Ed25519 key pair. The 32-byte seed comes from
//!   the `ALLTERNIT_DP_JWT_SEED` env var as standard base64
//!   (`openssl rand -base64 32`). Unset ⇒ minting and the JWKS endpoint fail
//!   closed (503 `dp_jwt_not_configured`); the control plane keeps working,
//!   it just cannot talk to nodes yet. There is deliberately no built-in dev
//!   default — generate one with `generate_dev_seed()` (or
//!   `openssl rand -base64 32`) and set the env var.
//! - **Claims:** `iss` (env `ALLTERNIT_DP_JWT_ISSUER`, default
//!   `allternit-cloud-api`), `sub` = Clerk user id, `aud` = node/device id,
//!   `iat`/`nbf`/`exp`, `scope` (e.g. `runtime:execute`), `jti` (uuid, for
//!   later replay accounting).
//! - **Lifetime:** env `ALLTERNIT_DP_JWT_TTL_SECS`, default 600, clamped to
//!   the A1 window of 300–900 s (5–15 min).
//! - **JWKS publication:** `dp_jwks` serves a minimal JWK set
//!   (`kid` / `alg` EdDSA / `x`) so nodes can pin the verifying key at
//!   startup. `kid` is the base64url SHA-256 of the verifying key, so key
//!   rotation changes `kid` automatically.
//!
//! This module is cloud-api side only; node-side verification lands in P2
//! (cmd/allternit-api). Like `auth::clerk`, the JWT is assembled and verified
//! manually — jsonwebtoken v10's `Header` deserialization rejects
//! non-string extras, and EdDSA here is three base64url segments plus one
//! ed25519-dalek verify call.

use axum::{http::StatusCode, response::IntoResponse, Json};
use base64::{engine::general_purpose::STANDARD, engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::Digest as _;

use crate::ApiError;

pub const SEED_ENV: &str = "ALLTERNIT_DP_JWT_SEED";
pub const TTL_SECS_ENV: &str = "ALLTERNIT_DP_JWT_TTL_SECS";
pub const ISSUER_ENV: &str = "ALLTERNIT_DP_JWT_ISSUER";

const DEFAULT_TTL_SECS: u64 = 600;
/// A1 decision window: 5–15 minutes.
const MIN_TTL_SECS: u64 = 300;
const MAX_TTL_SECS: u64 = 900;
const DEFAULT_ISSUER: &str = "allternit-cloud-api";
/// Verify-side clock skew allowance, matching auth::clerk's 60s leeway.
const LEEWAY_SECS: u64 = 60;

/// The Ed25519 identity cloud-api signs data-plane tokens with.
pub struct DataPlaneKeyPair {
    signing: SigningKey,
    verifying: VerifyingKey,
    kid: String,
}

impl DataPlaneKeyPair {
    fn from_seed_bytes(seed: &[u8; 32]) -> Self {
        let signing = SigningKey::from_bytes(seed);
        let verifying = signing.verifying_key();
        // kid = base64url(SHA-256(verifying key)): rotation-safe, self-
        // describing, stable across processes that share the seed.
        let kid = URL_SAFE_NO_PAD.encode(sha2::Sha256::digest(verifying.to_bytes()));
        Self {
            signing,
            verifying,
            kid,
        }
    }

    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.verifying
    }

    pub fn kid(&self) -> &str {
        &self.kid
    }

    /// The JWK `x` member: base64url of the raw 32-byte public key.
    fn jwk_x(&self) -> String {
        URL_SAFE_NO_PAD.encode(self.verifying.to_bytes())
    }
}

/// Load the signing key pair from `ALLTERNIT_DP_JWT_SEED` (standard base64,
/// 32 bytes). Read per call — the seed decode is nanoseconds, keeping tests
/// hermetic and allowing ops rotation without a restart... in practice the
/// env is fixed per process; there is intentionally no global cache so a
/// missing seed fails closed everywhere it is read.
pub fn key_pair_from_env() -> Result<DataPlaneKeyPair, ApiError> {
    let seed_b64 = std::env::var(SEED_ENV).map_err(|_| {
        ApiError::ServiceUnavailable("dp_jwt_not_configured".to_string())
    })?;
    let seed = STANDARD.decode(seed_b64.trim()).map_err(|_| {
        ApiError::ServiceUnavailable(format!("{SEED_ENV} is not valid base64"))
    })?;
    let seed: [u8; 32] = seed.as_slice().try_into().map_err(|_| {
        ApiError::ServiceUnavailable(format!(
            "{SEED_ENV} must decode to 32 bytes (an Ed25519 seed)"
        ))
    })?;
    Ok(DataPlaneKeyPair::from_seed_bytes(&seed))
}

/// Token lifetime in seconds: env-configured, clamped to the A1 5–15 min
/// window.
pub fn ttl_secs_from_env() -> u64 {
    std::env::var(TTL_SECS_ENV)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(DEFAULT_TTL_SECS)
        .clamp(MIN_TTL_SECS, MAX_TTL_SECS)
}

fn issuer_from_env() -> String {
    std::env::var(ISSUER_ENV).unwrap_or_else(|_| DEFAULT_ISSUER.to_string())
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

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

/// Mint a data-plane JWT for `user_id` addressed to node `audience`.
/// Fails closed (503) when no signing seed is configured.
pub fn mint(user_id: &str, audience: &str, scope: &str) -> Result<String, ApiError> {
    let key = key_pair_from_env()?;
    let ttl = ttl_secs_from_env();
    let now = now_secs();
    let claims = DataPlaneClaims {
        iss: issuer_from_env(),
        sub: user_id.to_string(),
        aud: audience.to_string(),
        iat: now,
        nbf: now,
        exp: now + ttl,
        scope: scope.to_string(),
        jti: uuid::Uuid::new_v4().to_string(),
    };
    Ok(mint_with_key(&key, &claims))
}

/// Sign an explicit claim set with an explicit key — the test seam (lets
/// tests mint expired/wrong-audience tokens without touching the env or the
/// clock).
fn mint_with_key(key: &DataPlaneKeyPair, claims: &DataPlaneClaims) -> String {
    let header = URL_SAFE_NO_PAD.encode(
        serde_json::to_string(&serde_json::json!({
            "alg": "EdDSA",
            "typ": "JWT",
            "kid": key.kid(),
        }))
        .expect("JWT header serializes"),
    );
    let payload = URL_SAFE_NO_PAD.encode(serde_json::to_string(claims).expect("claims serialize"));
    let signature: Signature = key.signing.sign(format!("{header}.{payload}").as_bytes());
    format!("{header}.{payload}.{}", URL_SAFE_NO_PAD.encode(signature.to_bytes()))
}

/// Verify a data-plane JWT against the given Ed25519 public key (cloud-api's
/// own key for cloud→node calls; a registered node's `public_key` for the
/// node→cloud direction the registry anticipates). Enforces signature, `alg`
/// = EdDSA, `exp`/`nbf` (60s leeway), and non-empty `sub`/`aud`.
pub fn verify(token: &str, public_key: &VerifyingKey) -> Result<DataPlaneClaims, ApiError> {
    let unauthorized = |message: &str| ApiError::Unauthorized(format!("Invalid data-plane token: {message}"));
    let mut parts = token.split('.');
    let (header_b64, payload_b64, signature_b64) = match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(h), Some(p), Some(s), None) => (h, p, s),
        _ => return Err(unauthorized("malformed")),
    };
    let header_bytes = URL_SAFE_NO_PAD
        .decode(header_b64)
        .map_err(|_| unauthorized("malformed header"))?;
    let header: serde_json::Value = serde_json::from_slice(&header_bytes)
        .map_err(|_| unauthorized("malformed header"))?;
    if header.get("alg").and_then(|value| value.as_str()) != Some("EdDSA") {
        return Err(unauthorized("unexpected algorithm"));
    }
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature_b64)
        .map_err(|_| unauthorized("malformed signature"))?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| unauthorized("malformed signature"))?;
    public_key
        .verify(format!("{header_b64}.{payload_b64}").as_bytes(), &signature)
        .map_err(|_| unauthorized("signature mismatch"))?;

    let claims: DataPlaneClaims = serde_json::from_slice(
        &URL_SAFE_NO_PAD
            .decode(payload_b64)
            .map_err(|_| unauthorized("malformed payload"))?,
    )
    .map_err(|_| unauthorized("malformed payload"))?;

    let now = now_secs();
    if claims.exp + LEEWAY_SECS <= now {
        return Err(unauthorized("expired"));
    }
    if claims.nbf > now + LEEWAY_SECS {
        return Err(unauthorized("not yet valid"));
    }
    if claims.sub.is_empty() || claims.aud.is_empty() {
        return Err(unauthorized("missing subject or audience"));
    }
    Ok(claims)
}

/// Documented dev-key helper: 32 random bytes as standard base64 — the exact
/// format `ALLTERNIT_DP_JWT_SEED` expects. Equivalent to
/// `openssl rand -base64 32`.
pub fn generate_dev_seed() -> String {
    use rand::RngCore as _;
    let mut seed = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut seed);
    STANDARD.encode(seed)
}

/// Minimal JWKS publication for nodes: one key, `kid` + `alg` + `x` (plus
/// the `kty`/`crv`/`use` members JWK consumers require to interpret `x`).
/// Public — nodes fetch this at startup before they have any credential.
pub async fn dp_jwks() -> Result<impl IntoResponse, ApiError> {
    let key = key_pair_from_env().map_err(|_| {
        ApiError::ServiceUnavailable("dp_jwt_not_configured".to_string())
    })?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "keys": [{
                "kty": "OKP",
                "use": "sig",
                "alg": "EdDSA",
                "crv": "Ed25519",
                "kid": key.kid(),
                "x": key.jwk_x(),
            }],
        })),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Serializes the env-touching tests in this module.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn test_key() -> DataPlaneKeyPair {
        DataPlaneKeyPair::from_seed_bytes(&[7u8; 32])
    }

    fn claims(exp_offset: u64) -> DataPlaneClaims {
        let now = now_secs();
        DataPlaneClaims {
            iss: DEFAULT_ISSUER.to_string(),
            sub: "user_123".to_string(),
            aud: "rt_node_1".to_string(),
            iat: now,
            nbf: now,
            exp: now + exp_offset,
            scope: "runtime:execute".to_string(),
            jti: uuid::Uuid::new_v4().to_string(),
        }
    }

    #[test]
    fn mint_verify_roundtrip_preserves_sub_aud_and_scope() {
        let key = test_key();
        let token = mint_with_key(&key, &claims(600));
        let verified = verify(&token, key.verifying_key()).unwrap();
        assert_eq!(verified.sub, "user_123");
        assert_eq!(verified.aud, "rt_node_1");
        assert_eq!(verified.scope, "runtime:execute");
        assert_eq!(verified.iss, DEFAULT_ISSUER);
        assert!(!verified.jti.is_empty());
        let ttl = verified.exp - verified.iat;
        assert!((300..=900).contains(&ttl));
    }

    #[test]
    fn verification_fails_with_the_wrong_public_key() {
        let key = test_key();
        let other = DataPlaneKeyPair::from_seed_bytes(&[9u8; 32]);
        let token = mint_with_key(&key, &claims(600));
        assert!(verify(&token, other.verifying_key()).is_err());
    }

    #[test]
    fn expired_token_fails_verification() {
        let key = test_key();
        let mut expired = claims(0);
        expired.iat -= 3600;
        expired.nbf -= 3600;
        expired.exp -= 3600;
        let token = mint_with_key(&key, &expired);
        assert!(verify(&token, key.verifying_key()).is_err());
    }

    #[test]
    fn not_yet_valid_token_fails_verification() {
        let key = test_key();
        let mut future = claims(600);
        future.nbf += 3600;
        let token = mint_with_key(&key, &future);
        assert!(verify(&token, key.verifying_key()).is_err());
    }

    #[test]
    fn tampered_payload_fails_verification() {
        let key = test_key();
        let token = mint_with_key(&key, &claims(600));
        let mut parts: Vec<&str> = token.split('.').collect();
        // Decode the payload, flip the audience, re-encode unsigned.
        let mut payload: serde_json::Value = serde_json::from_slice(
            &URL_SAFE_NO_PAD.decode(parts[1]).unwrap(),
        )
        .unwrap();
        payload["aud"] = serde_json::json!("rt_evil");
        parts[1] = Box::leak(URL_SAFE_NO_PAD.encode(serde_json::to_string(&payload).unwrap()).into_boxed_str());
        let tampered = parts.join(".");
        assert!(verify(&tampered, key.verifying_key()).is_err());
    }

    #[test]
    fn malformed_and_wrong_alg_tokens_fail_verification() {
        let key = test_key();
        assert!(verify("not-a-jwt", key.verifying_key()).is_err());
        assert!(verify("a.b.c", key.verifying_key()).is_err());

        // Correctly signed but alg=none header must be rejected before the
        // signature is even checked.
        let payload = URL_SAFE_NO_PAD.encode(serde_json::to_string(&claims(600)).unwrap());
        let none = format!(
            "{}.{payload}.{}",
            URL_SAFE_NO_PAD.encode(r#"{"alg":"none","typ":"JWT"}"#),
            URL_SAFE_NO_PAD.encode([0u8; 64])
        );
        assert!(verify(&none, key.verifying_key()).is_err());
    }

    #[test]
    fn ttl_is_env_configurable_and_clamped_to_the_a1_window() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var(TTL_SECS_ENV, "30");
        assert_eq!(ttl_secs_from_env(), MIN_TTL_SECS, "below the window clamps up");
        std::env::set_var(TTL_SECS_ENV, "6000");
        assert_eq!(ttl_secs_from_env(), MAX_TTL_SECS, "above the window clamps down");
        std::env::set_var(TTL_SECS_ENV, "420");
        assert_eq!(ttl_secs_from_env(), 420);
        std::env::remove_var(TTL_SECS_ENV);
        assert_eq!(ttl_secs_from_env(), DEFAULT_TTL_SECS);
    }

    #[test]
    fn mint_fails_closed_without_a_seed() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var(SEED_ENV);
        match mint("user_123", "rt_node_1", "runtime:execute") {
            Err(ApiError::ServiceUnavailable(message)) => {
                assert_eq!(message, "dp_jwt_not_configured")
            }
            other => panic!("expected ServiceUnavailable, got {other:?}"),
        }
    }

    #[test]
    fn mint_from_env_seed_roundtrips_through_verify() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var(SEED_ENV, generate_dev_seed());
        let token = mint("user_123", "rt_node_1", "runtime:execute").unwrap();
        let key = key_pair_from_env().unwrap();
        let verified = verify(&token, key.verifying_key()).unwrap();
        assert_eq!(verified.sub, "user_123");
        assert_eq!(verified.aud, "rt_node_1");
        std::env::remove_var(SEED_ENV);
    }

    #[test]
    fn env_seed_must_decode_to_32_bytes() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var(SEED_ENV, STANDARD.encode([1u8; 16]));
        assert!(matches!(
            key_pair_from_env(),
            Err(ApiError::ServiceUnavailable(_))
        ));
        std::env::set_var(SEED_ENV, "!!! not base64 !!!");
        assert!(matches!(
            key_pair_from_env(),
            Err(ApiError::ServiceUnavailable(_))
        ));
        std::env::remove_var(SEED_ENV);
    }

    #[tokio::test]
    async fn jwks_publishes_the_verifying_key_with_minimal_members() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var(SEED_ENV, generate_dev_seed());
        let key = key_pair_from_env().unwrap();

        let response = dp_jwks().await.unwrap().into_response();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let jwk = &body["keys"][0];
        assert_eq!(jwk["alg"], "EdDSA");
        assert_eq!(jwk["kid"], key.kid());
        assert_eq!(jwk["kty"], "OKP");
        assert_eq!(jwk["crv"], "Ed25519");
        // `x` must decode back to the raw verifying key.
        let x = URL_SAFE_NO_PAD.decode(jwk["x"].as_str().unwrap()).unwrap();
        assert_eq!(x, key.verifying_key().to_bytes().to_vec());

        std::env::remove_var(SEED_ENV);
    }

    #[tokio::test]
    async fn jwks_fails_closed_when_unconfigured() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var(SEED_ENV);
        match dp_jwks().await {
            Err(error) => {
                let response = error.into_response();
                assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
            }
            Ok(_) => panic!("JWKS must fail closed when no seed is configured"),
        }
    }
}
