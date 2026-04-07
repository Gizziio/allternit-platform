//! Authentication helpers for API route authorization.

use anyhow::{bail, Result};
use axum::http::HeaderMap;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256, Sha384, Sha512};
use std::collections::HashMap;

type HmacSha256 = Hmac<Sha256>;
type HmacSha384 = Hmac<Sha384>;
type HmacSha512 = Hmac<Sha512>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthClaims {
    pub sub: Option<String>,
    pub user_id: Option<String>,
    pub aud: Option<serde_json::Value>,
    pub exp: Option<i64>,
    pub nbf: Option<i64>,
    pub iat: Option<i64>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: String,
}

pub fn authorize_request(headers: &HeaderMap) -> Result<AuthContext> {
    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| anyhow::anyhow!("Missing Authorization header"))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| anyhow::anyhow!("Invalid Authorization scheme"))?;

    validate_auth_token(token.trim())
}

pub fn validate_auth_token(token: &str) -> Result<AuthContext> {
    if token.is_empty() {
        bail!("Missing authentication token");
    }

    if token == "dev-token" {
        if !env_flag("ALLOW_DEV_TOKEN") {
            bail!("dev-token is disabled");
        }
        return Ok(AuthContext {
            user_id: "dev-user".to_string(),
        });
    }

    let jwt_secret = std::env::var("JWT_SECRET")
        .ok()
        .or_else(|| std::env::var("ALLTERNIT_JWT_SECRET").ok());

    if looks_like_jwt(token) {
        let secret = jwt_secret.ok_or_else(|| anyhow::anyhow!("JWT_SECRET is not configured"))?;
        let claims = decode_jwt(token, &secret)?;
        if let Ok(expected_audience) = std::env::var("JWT_AUDIENCE") {
            if !expected_audience.trim().is_empty()
                && !matches_audience(claims.aud.as_ref(), &expected_audience)
            {
                bail!("Token audience mismatch");
            }
        }
        let user_id = resolve_user_id(&claims, token);
        return Ok(AuthContext { user_id });
    }

    if jwt_secret.is_some() && !env_flag("ALLOW_INSECURE_TOKENS") {
        bail!("Opaque tokens are disabled when JWT validation is configured");
    }

    let user_id = format!("opaque-{}", fingerprint_token(token));
    Ok(AuthContext { user_id })
}

fn decode_jwt(token: &str, secret: &str) -> Result<AuthClaims> {
    let parts = token.split('.').collect::<Vec<_>>();
    if parts.len() != 3 {
        bail!("Invalid JWT format");
    }

    let header = parse_jwt_part::<serde_json::Value>(parts[0], "header")?;
    let claims = parse_jwt_part::<AuthClaims>(parts[1], "payload")?;
    let alg = header
        .get("alg")
        .and_then(|value| value.as_str())
        .ok_or_else(|| anyhow::anyhow!("Unsupported JWT algorithm"))?;

    verify_signature(
        alg,
        secret.as_bytes(),
        &format!("{}.{}", parts[0], parts[1]),
        parts[2],
    )?;

    let now = chrono::Utc::now().timestamp();
    if claims.nbf.is_some_and(|nbf| nbf > now) {
        bail!("JWT is not valid yet");
    }
    if claims.exp.is_some_and(|exp| exp <= now) {
        bail!("JWT has expired");
    }

    Ok(claims)
}

fn verify_signature(alg: &str, secret: &[u8], signing_input: &str, signature: &str) -> Result<()> {
    let provided = URL_SAFE_NO_PAD
        .decode(signature)
        .map_err(|_| anyhow::anyhow!("Invalid JWT encoding"))?;

    match alg {
        "HS256" => {
            let mut mac = HmacSha256::new_from_slice(secret)?;
            mac.update(signing_input.as_bytes());
            mac.verify_slice(&provided)
                .map_err(|_| anyhow::anyhow!("Invalid JWT signature"))?;
        }
        "HS384" => {
            let mut mac = HmacSha384::new_from_slice(secret)?;
            mac.update(signing_input.as_bytes());
            mac.verify_slice(&provided)
                .map_err(|_| anyhow::anyhow!("Invalid JWT signature"))?;
        }
        "HS512" => {
            let mut mac = HmacSha512::new_from_slice(secret)?;
            mac.update(signing_input.as_bytes());
            mac.verify_slice(&provided)
                .map_err(|_| anyhow::anyhow!("Invalid JWT signature"))?;
        }
        _ => bail!("Unsupported JWT algorithm"),
    }
    Ok(())
}

fn parse_jwt_part<T: for<'de> Deserialize<'de>>(value: &str, label: &str) -> Result<T> {
    let bytes = URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| anyhow::anyhow!("Invalid JWT encoding"))?;
    serde_json::from_slice(&bytes).map_err(|_| anyhow::anyhow!("Invalid JWT {}", label))
}

fn matches_audience(aud: Option<&serde_json::Value>, expected: &str) -> bool {
    match aud {
        Some(serde_json::Value::String(value)) => value == expected,
        Some(serde_json::Value::Array(values)) => {
            values.iter().any(|value| value.as_str() == Some(expected))
        }
        _ => false,
    }
}

fn resolve_user_id(claims: &AuthClaims, token: &str) -> String {
    claims
        .sub
        .clone()
        .or_else(|| claims.user_id.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("user-{}", fingerprint_token(token)))
}

fn looks_like_jwt(token: &str) -> bool {
    token.split('.').count() == 3
}

fn env_flag(name: &str) -> bool {
    matches!(
        std::env::var(name).ok().as_deref(),
        Some("1" | "true" | "yes" | "on" | "TRUE" | "YES" | "ON")
    )
}

fn fingerprint_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    let mut out = String::with_capacity(12);
    for byte in &digest[..6] {
        out.push_str(&format!("{:02x}", byte));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opaque_tokens_are_rejected_when_jwt_secret_is_configured() {
        unsafe {
            std::env::set_var("JWT_SECRET", "secret");
            std::env::remove_var("ALLOW_INSECURE_TOKENS");
        }
        let result = validate_auth_token("opaque-token");
        assert!(result.is_err());
    }
}
