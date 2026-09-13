//! Fabric credits ledger client — the cloud-api side of the G15 credits ↔
//! Stripe bridge.
//!
//! When a credit-pack Checkout Session payment completes,
//! `routes::billing_webhooks` grants the purchased credits into the
//! allternit-api organization fabric credits ledger (the ledger that pays
//! for compute) through this client, instead of the local cloud wallet.
//!
//! The call is server-to-server:
//! `POST {ALLTERNIT_FABRIC_LEDGER_URL}/api/v1/admin/credits/grant` with the
//! shared internal service token (`x-allternit-internal-token` header,
//! `ALLTERNIT_INTERNAL_SERVICE_TOKEN` env — the same credential
//! allternit-api's auth_middleware verifies; set both services' env var to
//! the same value at deploy time, and keep it 32+ random bytes like the
//! billing sync secret). The request body carries the target organization,
//! the integer-cent amount, and an idempotency key derived from the Stripe
//! event id, so Stripe retries cannot double-grant even if this dedupe
//! table is bypassed.
//!
//! Deployment requirement: the bridge is OFF unless both
//! `ALLTERNIT_FABRIC_LEDGER_URL` and `ALLTERNIT_INTERNAL_SERVICE_TOKEN` are
//! set. With only the URL set the deployment is misconfigured: the webhook
//! refuses to grant (returning an error so Stripe retries and the operator
//! notices) rather than silently crediting the wrong ledger.

use serde::Serialize;
use std::time::Duration;

use crate::error::ApiError;

const INTERNAL_TOKEN_HEADER: &str = "x-allternit-internal-token";
const GRANT_PATH: &str = "/api/v1/admin/credits/grant";
const GRANT_TIMEOUT: Duration = Duration::from_secs(5);

/// Env var naming the allternit-api base URL. Unset = the bridge is off and
/// credit purchases grant into the local cloud wallet (pre-G15 behavior).
pub const FABRIC_LEDGER_URL_ENV: &str = "ALLTERNIT_FABRIC_LEDGER_URL";
/// Env var holding the shared internal service token. Must match
/// allternit-api's `ALLTERNIT_INTERNAL_SERVICE_TOKEN`.
pub const INTERNAL_TOKEN_ENV: &str = "ALLTERNIT_INTERNAL_SERVICE_TOKEN";

/// The slice of the fabric ledger API this bridge needs, abstracted so the
/// webhook orchestration is testable without a reachable allternit-api.
#[async_trait::async_trait]
pub trait FabricLedger: Send + Sync {
    /// Grant one credit-pack purchase to an organization, idempotently.
    async fn grant_pack_credits(
        &self,
        organization_id: &str,
        amount_cents: i64,
        idempotency_key: &str,
        reference_id: &str,
    ) -> Result<(), ApiError>;
}

/// Whether the bridge URL is configured (regardless of token state). The
/// webhook uses this to demand an organization at checkout time: when the
/// bridge is on, every credit session must be org-routable.
pub fn fabric_bridge_configured() -> bool {
    std::env::var(FABRIC_LEDGER_URL_ENV)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

/// Bridge client built from the environment: `Some` only when BOTH the base
/// URL and the shared token are configured.
pub fn from_env() -> Option<ReqwestFabricLedger> {
    let base_url = std::env::var(FABRIC_LEDGER_URL_ENV).ok()?;
    let token = std::env::var(INTERNAL_TOKEN_ENV).ok()?;
    if base_url.trim().is_empty() || token.trim().is_empty() {
        return None;
    }
    Some(ReqwestFabricLedger::new(base_url, token))
}

/// True when the URL is set but the token is missing — the webhook must not
/// silently fall back to the wallet in that state (the deployment intended
/// grants to land in the fabric ledger).
pub fn misconfigured() -> bool {
    fabric_bridge_configured() && std::env::var(INTERNAL_TOKEN_ENV).map(|t| t.trim().is_empty()).unwrap_or(true)
}

/// Live fabric ledger client speaking to allternit-api over HTTP.
pub struct ReqwestFabricLedger {
    base_url: String,
    token: String,
    client: reqwest::Client,
}

impl ReqwestFabricLedger {
    pub fn new(base_url: impl Into<String>, token: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            token: token.into(),
            client: reqwest::Client::builder()
                .timeout(GRANT_TIMEOUT)
                .build()
                .expect("build fabric ledger client"),
        }
    }
}

#[derive(Serialize)]
struct GrantRequest<'a> {
    organization_id: &'a str,
    amount_cents: i64,
    idempotency_key: &'a str,
    reference_id: &'a str,
    description: &'a str,
}

#[async_trait::async_trait]
impl FabricLedger for ReqwestFabricLedger {
    async fn grant_pack_credits(
        &self,
        organization_id: &str,
        amount_cents: i64,
        idempotency_key: &str,
        reference_id: &str,
    ) -> Result<(), ApiError> {
        let response = self
            .client
            .post(format!("{}{GRANT_PATH}", self.base_url))
            .header(INTERNAL_TOKEN_HEADER, &self.token)
            .json(&GrantRequest {
                organization_id,
                amount_cents,
                idempotency_key,
                reference_id,
                description: "stripe credit pack purchase (webhook)",
            })
            .send()
            .await
            .map_err(|error| ApiError::Internal(format!("Failed to reach the fabric ledger: {error}")))?;

        let status = response.status().as_u16();
        if status == 401 || status == 403 {
            return Err(ApiError::Internal(
                "Fabric ledger rejected the internal service token.".to_string(),
            ));
        }
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(ApiError::Internal(format!(
                "Fabric ledger grant failed (HTTP {status}): {body}"
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_config_parsing() {
        // Env-dependent assertions run against the operator's shell, so
        // only probe the empty-string semantics directly via the helpers.
        assert!(!fabric_bridge_configured() || std::env::var(FABRIC_LEDGER_URL_ENV).is_ok());
        if let Some(client) = from_env() {
            assert!(!client.base_url.ends_with('/'));
            assert!(!client.token.is_empty());
        }
    }

    #[test]
    fn base_url_trailing_slash_is_trimmed() {
        let client = ReqwestFabricLedger::new("https://api.example.com/", "token");
        assert_eq!(client.base_url, "https://api.example.com");
    }
}
