//! Scoped platform API key management.
//!
//! API keys are long-lived credentials that authenticate programmatic access to
//! the Allternit Cloud API. The full token is returned exactly once when the key
//! is created; afterwards only a one-way hash is stored.
//!
//! Keys are tied to the user's subscription tier, with monthly quota tracking
//! and enforcement at inference time.

use chrono::{DateTime, Utc};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};

use crate::error::ApiError;

const TOKEN_PREFIX: &str = "alt_";
const TOKEN_ENTROPY_BYTES: usize = 32;

/// Subscription tiers with associated quotas.
pub const QUOTA_FREE: f64 = 5.0;
pub const QUOTA_PLUS: f64 = 22.0;
pub const QUOTA_SUPER: f64 = 110.0;
pub const QUOTA_ULTRA: f64 = 220.0;

/// Get quota for a subscription plan ID.
pub fn get_quota_for_plan(plan_id: &str) -> f64 {
    match plan_id {
        "plus" => QUOTA_PLUS,
        "super" => QUOTA_SUPER,
        "ultra" => QUOTA_ULTRA,
        _ => QUOTA_FREE,
    }
}

/// A key as returned to the owner (no hash exposed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: String,
    pub user_id: String,
    pub organization_id: Option<String>,
    pub name: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_tier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monthly_quota_usd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_this_period_usd: Option<f64>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// The plaintext token returned once at creation time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatedApiKey {
    #[serde(flatten)]
    pub key: ApiKey,
    pub token: String,
}

#[derive(Debug, FromRow)]
struct ApiKeyRow {
    id: String,
    user_id: String,
    organization_id: Option<String>,
    name: String,
    prefix: String,
    scopes: Vec<String>,
    subscription_tier: Option<String>,
    monthly_quota_usd: Option<f64>,
    usage_this_period_usd: Option<f64>,
    last_used_at: Option<DateTime<Utc>>,
    revoked_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

/// Input for creating a new API key.
pub struct CreateApiKeyInput {
    pub user_id: String,
    pub organization_id: Option<String>,
    pub name: String,
    pub scopes: Vec<String>,
    /// Subscription tier at key creation time
    pub subscription_tier: Option<String>,
    /// Monthly quota in USD for this key
    pub monthly_quota_usd: Option<f64>,
}

pub(crate) fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

fn generate_token() -> String {
    let mut entropy = [0u8; TOKEN_ENTROPY_BYTES];
    rand::thread_rng().fill_bytes(&mut entropy);
    format!("{}{}", TOKEN_PREFIX, hex::encode(entropy))
}

fn generate_id() -> String {
    format!("ak_{}", hex::encode(rand::random::<[u8; 16]>())).to_lowercase()
}

fn normalize_scopes(scopes: Vec<String>) -> Vec<String> {
    let scopes: Vec<String> = scopes
        .into_iter()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    // Operator keys drive paired nodes (catalog + runtime proxy). An empty
    // list fails `has_scope("compute")`, so minting without scopes used to
    // produce a key that could not list devices or proxy.
    if scopes.is_empty() {
        vec!["compute".to_string()]
    } else {
        scopes
    }
}

/// List active (non-revoked) API keys for a user.
pub async fn list_api_keys(db: &PgPool, user_id: &str) -> Result<Vec<ApiKey>, ApiError> {
    let rows = sqlx::query_as::<_, ApiKeyRow>(
        r#"
        SELECT id, user_id, organization_id, name, prefix, scopes,
               subscription_tier, monthly_quota_usd, usage_this_period_usd,
               last_used_at, revoked_at, created_at
        FROM api_keys
        WHERE user_id = $1 AND revoked_at IS NULL
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(into_api_key).collect())
}

/// Create a new API key and return the full token exactly once.
pub async fn create_api_key(
    db: &PgPool,
    input: CreateApiKeyInput,
) -> Result<CreatedApiKey, ApiError> {
    let token = generate_token();
    let token_hash = hash_token(&token);
    let prefix = token.chars().take(12).collect::<String>();
    let id = generate_id();
    let scopes = normalize_scopes(input.scopes);

    if input.name.trim().is_empty() {
        return Err(ApiError::BadRequest("API key name is required".to_string()));
    }

    let row = sqlx::query_as::<_, ApiKeyRow>(
        r#"
        INSERT INTO api_keys (id, user_id, organization_id, name, token_hash, prefix, scopes,
                             subscription_tier, monthly_quota_usd, usage_this_period_usd)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
        RETURNING id, user_id, organization_id, name, prefix, scopes,
                  subscription_tier, monthly_quota_usd, usage_this_period_usd,
                  last_used_at, revoked_at, created_at
        "#,
    )
    .bind(&id)
    .bind(&input.user_id)
    .bind(&input.organization_id)
    .bind(input.name.trim())
    .bind(&token_hash)
    .bind(&prefix)
    .bind(&scopes)
    .bind(&input.subscription_tier)
    .bind(&input.monthly_quota_usd)
    .fetch_one(db)
    .await?;

    Ok(CreatedApiKey {
        key: into_api_key(row),
        token,
    })
}

/// Revoke an API key. Only the owning user can revoke their own keys.
pub async fn revoke_api_key(db: &PgPool, user_id: &str, key_id: &str) -> Result<(), ApiError> {
    let result = sqlx::query(
        r#"
        UPDATE api_keys
        SET revoked_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        "#,
    )
    .bind(key_id)
    .bind(user_id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("API key not found or already revoked".to_string()));
    }

    Ok(())
}

/// Find a valid API key by its full token and update its last-used timestamp.
pub async fn authenticate_api_key(
    db: &PgPool,
    token: &str,
) -> Result<Option<ApiKey>, ApiError> {
    let token_hash = hash_token(token);

    let row = sqlx::query_as::<_, ApiKeyRow>(
        r#"
        UPDATE api_keys
        SET last_used_at = NOW(), updated_at = NOW()
        WHERE token_hash = $1 AND revoked_at IS NULL
        RETURNING id, user_id, organization_id, name, prefix, scopes,
                  subscription_tier, monthly_quota_usd, usage_this_period_usd,
                  last_used_at, revoked_at, created_at
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(db)
    .await?;

    Ok(row.map(into_api_key))
}

/// Record usage against an API key's quota.
pub async fn record_usage(
    db: &PgPool,
    key_id: &str,
    amount_usd: f64,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        UPDATE api_keys
        SET usage_this_period_usd = usage_this_period_usd + $2,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(key_id)
    .bind(amount_usd)
    .execute(db)
    .await?;

    Ok(())
}

/// Check if an API key has exceeded its quota.
pub async fn check_quota_exceeded(db: &PgPool, key_id: &str) -> Result<bool, ApiError> {
    let row: Option<(Option<f64>, Option<f64>)> = sqlx::query_as(
        r#"
        SELECT monthly_quota_usd, usage_this_period_usd
        FROM api_keys
        WHERE id = $1
        "#,
    )
    .bind(key_id)
    .fetch_optional(db)
    .await?;

    match row {
        Some((Some(quota), Some(usage))) => Ok(usage >= quota),
        _ => Ok(false), // No quota set = unlimited
    }
}

fn into_api_key(row: ApiKeyRow) -> ApiKey {
    ApiKey {
        id: row.id,
        user_id: row.user_id,
        organization_id: row.organization_id,
        name: row.name,
        prefix: row.prefix,
        scopes: row.scopes,
        subscription_tier: row.subscription_tier,
        monthly_quota_usd: row.monthly_quota_usd,
        usage_this_period_usd: row.usage_this_period_usd,
        last_used_at: row.last_used_at,
        revoked_at: row.revoked_at,
        created_at: row.created_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_tokens_have_expected_prefix_and_length() {
        let token = generate_token();
        assert!(token.starts_with(TOKEN_PREFIX));
        assert_eq!(token.len(), TOKEN_PREFIX.len() + TOKEN_ENTROPY_BYTES * 2);
    }

    #[test]
    fn token_hash_is_deterministic() {
        let token = "alt_test_token";
        let h1 = hash_token(token);
        let h2 = hash_token(token);
        assert_eq!(h1, h2);
        assert_ne!(h1, token);
    }

    #[test]
    fn scopes_are_normalized() {
        let scopes = vec!["  Read ".to_string(), "COMPUTE".to_string(), "".to_string()];
        assert_eq!(normalize_scopes(scopes), vec!["read", "compute"]);
    }

    #[test]
    fn empty_scopes_default_to_compute() {
        assert_eq!(normalize_scopes(vec![]), vec!["compute"]);
        assert_eq!(
            normalize_scopes(vec!["".to_string(), "  ".to_string()]),
            vec!["compute"]
        );
    }

    #[test]
    fn quota_for_plan_returns_expected_values() {
        assert_eq!(get_quota_for_plan("free"), QUOTA_FREE);
        assert_eq!(get_quota_for_plan("plus"), QUOTA_PLUS);
        assert_eq!(get_quota_for_plan("super"), QUOTA_SUPER);
        assert_eq!(get_quota_for_plan("ultra"), QUOTA_ULTRA);
        assert_eq!(get_quota_for_plan("unknown"), QUOTA_FREE);
    }
}
