//! Per-user and per-organization provider route credentials — "BYO
//! subscription keys" (Allternit Brain `Products/ProviderRouting.md`
//! deferred follow-up, P1.7 org pool + rotation + revalidation sweep).
//!
//! When a request's resolved provider matches one of the caller's own
//! credentials, the gateway attaches it to the Gizzi session-message payload
//! as `provider_credentials` so the upstream call bills the customer's own
//! cloud console instead of Allternit credits. Keys are sealed with
//! [`crate::token_crypto`] at rest and are never returned in full — list
//! responses carry only a masked fingerprint.
//!
//! ## Resolution order (P1.7)
//!
//! [`resolve_credential`] resolves **user → org pool → platform**:
//! 1. the caller's own `active` user-scoped credential (V134), else
//! 2. the healthiest `active` entry of the org pool for
//!    `(organization_id, provider_id)` (V181), else
//! 3. nothing — the request falls through to the platform key.
//!
//! ## Rotation
//!
//! Org pool selection is **least-recently-used, least-recently-failed**: the
//! winner is the `active` row with the fewest recorded failures, never-failed
//! rows first, breaking ties by the oldest `last_used_at` (never-used first);
//! the winner's `last_used_at` is stamped on selection. A failed upstream
//! attempt calls [`mark_credential_failed`], which bumps `fail_count` and
//! `last_failed_at`; after [`MAX_CONSECUTIVE_FAILURES`] marks the row flips
//! to `failed` and is skipped by selection. A successful attempt
//! ([`mark_credential_ok`]) resets the streak. This complements (not
//! replaces) the per-provider failover cooldown tracker in `failover.rs`:
//! the cooldown steers away from a sick *provider*, the failure streak
//! steers away from a sick *key*.
//!
//! ## Revalidation sweep
//!
//! [`sweep_once`] re-runs the validate-before-store probe against every
//! `active` credential that has a `base_url`, marking 401/403-rejected keys
//! `revoked` (and evicting them from the decrypt cache). `main.rs` runs it
//! on a tokio interval (`ROUTE_CREDENTIAL_SWEEP_INTERVAL_SECS`, default 6h,
//! `0` disables). The sweep is a background task and never runs on the
//! request path.
//!
//! ## Hot-path decrypt cache
//!
//! AES-256-GCM decryption on every request is cheap but not free, so
//! decrypted keys are held in a small process-local cache keyed by credential
//! row id with a short TTL (`ROUTE_CREDENTIAL_CACHE_TTL_SECS`, default 60s,
//! `0` disables). Tradeoff: a revoked/rotated key may keep serving for up to
//! the TTL unless explicitly evicted — upsert/delete/sweep-revoke all evict
//! the entry, so the residual window only covers out-of-band changes. The
//! cache holds plaintext keys in process memory; it is never persisted and
//! never leaves the gateway process.

use rusqlite::{params, OptionalExtension};
use serde::Serialize;

use crate::db::DbHandle;
use crate::token_crypto;

/// Failures before a credential is marked `failed` and skipped by selection.
pub const MAX_CONSECUTIVE_FAILURES: u32 = 3;

/// Which table a credential lives in — user-scoped (V134) or org pool (V181).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CredentialScope {
    User,
    Org,
}

impl CredentialScope {
    fn table(self) -> &'static str {
        match self {
            CredentialScope::User => "user_route_credentials",
            CredentialScope::Org => "org_route_credentials",
        }
    }
}

/// A decrypted credential for the proxy hot path.
pub struct RouteCredential {
    /// Row id, when the credential came from a stored row (always today).
    /// Used for failure/ok marking and cache eviction.
    pub credential_id: Option<String>,
    pub scope: CredentialScope,
    pub provider_id: String,
    pub api_key: String,
    pub base_url: Option<String>,
}

/// What [`list_credentials`] returns — never the key itself.
#[derive(Debug, Serialize)]
pub struct RouteCredentialInfo {
    pub provider_id: String,
    pub base_url: Option<String>,
    pub label: Option<String>,
    pub status: String,
    pub masked: String,
    pub last_validated_at: Option<String>,
}

/// What [`list_org_credentials`] returns — pool entries include rotation and
/// health state so operators can see which keys are being skipped.
#[derive(Debug, Serialize)]
pub struct OrgRouteCredentialInfo {
    pub id: String,
    pub provider_id: String,
    pub base_url: Option<String>,
    pub label: Option<String>,
    pub status: String,
    pub masked: String,
    pub fail_count: i64,
    pub last_used_at: Option<String>,
    pub last_failed_at: Option<String>,
    pub last_validated_at: Option<String>,
}

fn validate_provider_id(provider_id: &str) -> Result<(), String> {
    if provider_id.is_empty()
        || provider_id.len() > 64
        || !provider_id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
    {
        return Err(format!(
            "Provider id `{provider_id}` must be 1-64 chars of lowercase letters, digits, `-` or `_`."
        ));
    }
    Ok(())
}

/// `sk-…4f9c` style fingerprint — safe to show in list responses.
pub fn mask_key(key: &str) -> String {
    let tail: String = key.chars().rev().take(4).collect::<String>().chars().rev().collect();
    format!("{}…{}", &key[..key.len().min(3)], tail)
}

// ─── Hot-path decrypt cache ──────────────────────────────────────────────────

struct CachedKey {
    api_key: String,
    base_url: Option<String>,
    expires_at: std::time::Instant,
}

fn decrypt_cache() -> &'static std::sync::RwLock<std::collections::HashMap<String, CachedKey>> {
    static CACHE: std::sync::OnceLock<std::sync::RwLock<std::collections::HashMap<String, CachedKey>>> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(|| std::sync::RwLock::new(std::collections::HashMap::new()))
}

fn cache_ttl() -> std::time::Duration {
    static TTL: std::sync::OnceLock<std::time::Duration> = std::sync::OnceLock::new();
    *TTL.get_or_init(|| {
        let secs = std::env::var("ROUTE_CREDENTIAL_CACHE_TTL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(60);
        std::time::Duration::from_secs(secs)
    })
}

/// Decrypt `sealed`, serving from the short-TTL cache when possible. A TTL of
/// zero disables the cache (always decrypt, never store).
fn open_cached(credential_id: &str, sealed: &str, base_url: Option<String>) -> (String, Option<String>) {
    let ttl = cache_ttl();
    if ttl.is_zero() {
        return (token_crypto::open(sealed), base_url);
    }
    if let Some(hit) = decrypt_cache()
        .read()
        .expect("credential cache poisoned")
        .get(credential_id)
    {
        if hit.expires_at > std::time::Instant::now() {
            return (hit.api_key.clone(), hit.base_url.clone());
        }
    }
    let api_key = token_crypto::open(sealed);
    decrypt_cache()
        .write()
        .expect("credential cache poisoned")
        .insert(
            credential_id.to_string(),
            CachedKey {
                api_key: api_key.clone(),
                base_url: base_url.clone(),
                expires_at: std::time::Instant::now() + ttl,
            },
        );
    (api_key, base_url)
}

/// Drop a cached plaintext key (rotation, deletion, sweep revocation).
pub fn evict_cached(credential_id: &str) {
    decrypt_cache()
        .write()
        .expect("credential cache poisoned")
        .remove(credential_id);
}

fn evict_credential_rows(conn: &rusqlite::Connection, scope: CredentialScope, where_sql: &str, p: &[&dyn rusqlite::ToSql]) {
    // Evict by subselect so callers don't have to pre-fetch ids.
    let sql = format!("SELECT id FROM {} WHERE {where_sql}", scope.table());
    if let Ok(mut stmt) = conn.prepare(&sql) {
        if let Ok(rows) = stmt.query_map(p, |row| row.get::<_, String>(0)) {
            for id in rows.flatten() {
                evict_cached(&id);
            }
        }
    }
}

// ─── User-scoped credentials (V134) ──────────────────────────────────────────

pub fn list_credentials(db: &DbHandle, user_id: &str) -> Result<Vec<RouteCredentialInfo>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT provider_id, base_url, label, status, api_key, last_validated_at
         FROM user_route_credentials WHERE user_id = ?1 ORDER BY provider_id",
    )?;
    let rows = stmt.query_map(params![user_id], |row| {
        let api_key: String = row.get(4)?;
        Ok(RouteCredentialInfo {
            provider_id: row.get(0)?,
            base_url: row.get(1)?,
            label: row.get(2)?,
            status: row.get(3)?,
            masked: mask_key(&token_crypto::open(&api_key)),
            last_validated_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

/// Validate-then-store upsert. `validated` records whether the key was
/// accepted by the provider (the caller probes before invoking this).
pub fn upsert_credential(
    db: &DbHandle,
    user_id: &str,
    tenant_id: Option<&str>,
    provider_id: &str,
    api_key: &str,
    base_url: Option<&str>,
    label: Option<&str>,
    validated: bool,
) -> Result<(), String> {
    validate_provider_id(provider_id)?;
    if api_key.is_empty() || api_key.len() > 4096 {
        return Err("api_key must be 1-4096 characters.".to_string());
    }
    let conn = db.connect().map_err(|err| err.to_string())?;
    evict_credential_rows(
        &conn,
        CredentialScope::User,
        "user_id = ?1 AND provider_id = ?2",
        &[&user_id, &provider_id],
    );
    let sealed = token_crypto::seal(api_key);
    let status = if validated { "active" } else { "unvalidated" };
    conn.execute(
        "INSERT INTO user_route_credentials
             (id, user_id, tenant_id, provider_id, api_key, base_url, label, status, last_validated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CASE WHEN ?8 = 'active' THEN CURRENT_TIMESTAMP END)
         ON CONFLICT (user_id, provider_id) DO UPDATE SET
             api_key = excluded.api_key,
             base_url = excluded.base_url,
             label = excluded.label,
             status = excluded.status,
             fail_count = 0,
             last_failed_at = NULL,
             last_validated_at = CASE WHEN excluded.status = 'active' THEN CURRENT_TIMESTAMP ELSE user_route_credentials.last_validated_at END,
             updated_at = CURRENT_TIMESTAMP",
        params![
            uuid::Uuid::new_v4().to_string(),
            user_id,
            tenant_id,
            provider_id,
            sealed,
            base_url,
            label,
            status,
        ],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

/// Delete the caller's credential for a provider. Returns true when a row
/// existed.
pub fn delete_credential(db: &DbHandle, user_id: &str, provider_id: &str) -> Result<bool, rusqlite::Error> {
    let conn = db.connect()?;
    evict_credential_rows(
        &conn,
        CredentialScope::User,
        "user_id = ?1 AND provider_id = ?2",
        &[&user_id, &provider_id],
    );
    let n = conn.execute(
        "DELETE FROM user_route_credentials WHERE user_id = ?1 AND provider_id = ?2",
        params![user_id, provider_id],
    )?;
    Ok(n > 0)
}

/// Hot-path lookup: the decrypted credential for `(user, provider)`, if any
/// `active` one exists.
pub fn get_credential(
    db: &DbHandle,
    user_id: &str,
    provider_id: &str,
) -> Result<Option<RouteCredential>, rusqlite::Error> {
    let conn = db.connect()?;
    let row: Option<(String, String, Option<String>)> = conn
        .query_row(
            "SELECT id, api_key, base_url FROM user_route_credentials
             WHERE user_id = ?1 AND provider_id = ?2 AND status = 'active'",
            params![user_id, provider_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;
    Ok(row.map(|(id, api_key, base_url)| {
        let (api_key, base_url) = open_cached(&id, &api_key, base_url);
        RouteCredential {
            credential_id: Some(id),
            scope: CredentialScope::User,
            provider_id: provider_id.to_string(),
            api_key,
            base_url,
        }
    }))
}

/// Cheap existence check for the metering path (BYO-served requests are
/// metered at zero cost).
pub fn has_credential(db: &DbHandle, user_id: &str, provider_id: &str) -> bool {
    let Ok(conn) = db.connect() else {
        return false;
    };
    conn.query_row(
        "SELECT 1 FROM user_route_credentials
         WHERE user_id = ?1 AND provider_id = ?2 AND status = 'active'",
        params![user_id, provider_id],
        |_| Ok(()),
    )
    .optional()
    .ok()
    .flatten()
    .is_some()
}

// ─── Org pool credentials (V181) ─────────────────────────────────────────────

pub fn list_org_credentials(
    db: &DbHandle,
    organization_id: &str,
) -> Result<Vec<OrgRouteCredentialInfo>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, provider_id, base_url, label, status, api_key, fail_count,
                last_used_at, last_failed_at, last_validated_at
         FROM org_route_credentials WHERE organization_id = ?1
         ORDER BY provider_id, created_at",
    )?;
    let rows = stmt.query_map(params![organization_id], |row| {
        let api_key: String = row.get(5)?;
        Ok(OrgRouteCredentialInfo {
            id: row.get(0)?,
            provider_id: row.get(1)?,
            base_url: row.get(2)?,
            label: row.get(3)?,
            status: row.get(4)?,
            masked: mask_key(&token_crypto::open(&api_key)),
            fail_count: row.get(6)?,
            last_used_at: row.get(7)?,
            last_failed_at: row.get(8)?,
            last_validated_at: row.get(9)?,
        })
    })?;
    rows.collect()
}

/// Add a key to the org pool. Unlike the user table this is an INSERT — a
/// pool holds several keys per (org, provider) by design. Returns the new id.
pub fn add_org_credential(
    db: &DbHandle,
    organization_id: &str,
    provider_id: &str,
    api_key: &str,
    base_url: Option<&str>,
    label: Option<&str>,
    validated: bool,
) -> Result<String, String> {
    validate_provider_id(provider_id)?;
    if organization_id.is_empty() {
        return Err("organization_id is required.".to_string());
    }
    if api_key.is_empty() || api_key.len() > 4096 {
        return Err("api_key must be 1-4096 characters.".to_string());
    }
    let conn = db.connect().map_err(|err| err.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let sealed = token_crypto::seal(api_key);
    let status = if validated { "active" } else { "unvalidated" };
    conn.execute(
        "INSERT INTO org_route_credentials
             (id, organization_id, provider_id, api_key, base_url, label, status, last_validated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CASE WHEN ?7 = 'active' THEN CURRENT_TIMESTAMP END)",
        params![id, organization_id, provider_id, sealed, base_url, label, status],
    )
    .map_err(|err| err.to_string())?;
    Ok(id)
}

/// Remove a pool entry by id, scoped to the org. Returns true when a row
/// existed.
pub fn delete_org_credential(
    db: &DbHandle,
    organization_id: &str,
    credential_id: &str,
) -> Result<bool, rusqlite::Error> {
    let conn = db.connect()?;
    evict_cached(credential_id);
    let n = conn.execute(
        "DELETE FROM org_route_credentials WHERE organization_id = ?1 AND id = ?2",
        params![organization_id, credential_id],
    )?;
    Ok(n > 0)
}

/// Rotation pick: the healthiest `active` pool entry for `(org, provider)`.
///
/// Order: never-failed before failed, fewer failures before more, then
/// least-recently-used (never-used first) — a round-robin cursor over the
/// healthy part of the pool. The winner's `last_used_at` is stamped so the
/// next pick rotates.
pub fn get_org_pool_credential(
    db: &DbHandle,
    organization_id: &str,
    provider_id: &str,
) -> Result<Option<RouteCredential>, rusqlite::Error> {
    let conn = db.connect()?;
    let row: Option<(String, String, Option<String>)> = conn
        .query_row(
            "SELECT id, api_key, base_url FROM org_route_credentials
             WHERE organization_id = ?1 AND provider_id = ?2 AND status = 'active'
             ORDER BY (last_failed_at IS NULL) DESC,
                      fail_count ASC,
                      (last_used_at IS NULL) DESC,
                      last_used_at ASC
             LIMIT 1",
            params![organization_id, provider_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;
    let Some((id, api_key, base_url)) = row else {
        return Ok(None);
    };
    conn.execute(
        "UPDATE org_route_credentials SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![id],
    )?;
    let (api_key, base_url) = open_cached(&id, &api_key, base_url);
    Ok(Some(RouteCredential {
        credential_id: Some(id),
        scope: CredentialScope::Org,
        provider_id: provider_id.to_string(),
        api_key,
        base_url,
    }))
}

/// P1.7 resolution: user → org pool → platform (None).
pub fn resolve_credential(
    db: &DbHandle,
    user_id: &str,
    organization_id: Option<&str>,
    provider_id: &str,
) -> Result<Option<RouteCredential>, rusqlite::Error> {
    if let Some(credential) = get_credential(db, user_id, provider_id)? {
        return Ok(Some(credential));
    }
    match organization_id {
        Some(org) => get_org_pool_credential(db, org, provider_id),
        None => Ok(None),
    }
}

/// Metering-path existence check across both scopes (user, then org pool).
pub fn has_any_credential(
    db: &DbHandle,
    user_id: &str,
    organization_id: Option<&str>,
    provider_id: &str,
) -> bool {
    if has_credential(db, user_id, provider_id) {
        return true;
    }
    let Some(org) = organization_id else {
        return false;
    };
    let Ok(conn) = db.connect() else {
        return false;
    };
    conn.query_row(
        "SELECT 1 FROM org_route_credentials
         WHERE organization_id = ?1 AND provider_id = ?2 AND status = 'active'",
        params![org, provider_id],
        |_| Ok(()),
    )
    .optional()
    .ok()
    .flatten()
    .is_some()
}

// ─── Health marking (rotation input) ─────────────────────────────────────────

/// Record a failed upstream attempt against the credential that served it.
/// After [`MAX_CONSECUTIVE_FAILURES`] cumulative marks since the last
/// success/upsert the row flips to `failed` and selection skips it.
pub fn mark_credential_failed(
    db: &DbHandle,
    scope: CredentialScope,
    credential_id: &str,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        &format!(
            "UPDATE {} SET
                 fail_count = fail_count + 1,
                 last_failed_at = CURRENT_TIMESTAMP,
                 status = CASE WHEN fail_count + 1 >= {MAX_CONSECUTIVE_FAILURES} THEN 'failed' ELSE status END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            scope.table()
        ),
        params![credential_id],
    )?;
    Ok(())
}

/// Reset a credential's failure streak after a successful attempt.
pub fn mark_credential_ok(
    db: &DbHandle,
    scope: CredentialScope,
    credential_id: &str,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        &format!(
            "UPDATE {} SET fail_count = 0, last_failed_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1 AND fail_count > 0",
            scope.table()
        ),
        params![credential_id],
    )?;
    Ok(())
}

// ─── Validation + revalidation sweep ─────────────────────────────────────────

/// Outcome of probing a credential against its provider.
#[derive(Debug, PartialEq, Eq)]
pub enum ValidationOutcome {
    /// Provider did not challenge the key.
    Valid,
    /// 401/403 — the provider rejected the key; safe to mark revoked.
    Revoked(String),
    /// Network/5xx/other — transient; do not change credential state.
    Transient(String),
}

/// Classified probe of a provider's OpenAI-compatible `/models` endpoint.
pub async fn validate_api_key_outcome(base_url: &str, api_key: &str) -> ValidationOutcome {
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(client) => client,
        Err(err) => return ValidationOutcome::Transient(format!("validator setup failed: {err}")),
    };
    let response = match client.get(&url).bearer_auth(api_key).send().await {
        Ok(response) => response,
        Err(err) => {
            return ValidationOutcome::Transient(format!(
                "validation request to {url} failed: {err}"
            ))
        }
    };
    match response.status().as_u16() {
        401 | 403 => ValidationOutcome::Revoked(format!(
            "key rejected by {url} (HTTP {}).",
            response.status()
        )),
        _ => ValidationOutcome::Valid,
    }
}

/// Probe a provider's OpenAI-compatible `/models` endpoint with the key.
/// 401/403 → rejected; any other 2xx/404 → accepted (endpoint exists and did
/// not challenge the key).
pub async fn validate_api_key(base_url: &str, api_key: &str) -> Result<(), String> {
    match validate_api_key_outcome(base_url, api_key).await {
        ValidationOutcome::Valid => Ok(()),
        ValidationOutcome::Revoked(message) | ValidationOutcome::Transient(message) => Err(message),
    }
}

/// Sweep candidate: one `active` credential with a probeable `base_url`.
struct SweepCandidate {
    scope: CredentialScope,
    id: String,
    base_url: String,
    sealed_key: String,
}

/// Collect `active` credentials (both scopes) that have a `base_url` to
/// probe. Sealed keys are decrypted one at a time inside [`sweep_once`], not
/// held in a batch.
fn sweep_candidates(db: &DbHandle) -> Result<Vec<SweepCandidate>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut out = Vec::new();
    for scope in [CredentialScope::User, CredentialScope::Org] {
        let mut stmt = conn.prepare(&format!(
            "SELECT id, base_url, api_key FROM {} WHERE status = 'active' AND base_url IS NOT NULL",
            scope.table()
        ))?;
        let rows = stmt.query_map([], |row| {
            Ok(SweepCandidate {
                scope,
                id: row.get(0)?,
                base_url: row.get(1)?,
                sealed_key: row.get(2)?,
            })
        })?;
        out.extend(rows.collect::<Result<Vec<_>, _>>()?);
    }
    Ok(out)
}

/// One revalidation pass: probe every active credential with a `base_url`,
/// mark 401/403-rejected keys `revoked` (evicting the decrypt cache), stamp
/// `last_validated_at` on the rest. Transient failures leave state untouched.
/// Returns `(checked, revoked)`.
pub async fn sweep_once(db: &DbHandle) -> Result<(usize, usize), rusqlite::Error> {
    let candidates = sweep_candidates(db)?;
    let total = candidates.len();
    let mut revoked = 0usize;
    for candidate in candidates {
        let api_key = token_crypto::open(&candidate.sealed_key);
        match validate_api_key_outcome(&candidate.base_url, &api_key).await {
            ValidationOutcome::Valid => {
                let conn = db.connect()?;
                conn.execute(
                    &format!(
                        "UPDATE {} SET last_validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                        candidate.scope.table()
                    ),
                    params![candidate.id],
                )?;
            }
            ValidationOutcome::Revoked(message) => {
                tracing::warn!(
                    credential_id = %candidate.id,
                    scope = ?candidate.scope,
                    %message,
                    "route credential revoked by revalidation sweep"
                );
                evict_cached(&candidate.id);
                let conn = db.connect()?;
                conn.execute(
                    &format!(
                        "UPDATE {} SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                        candidate.scope.table()
                    ),
                    params![candidate.id],
                )?;
                revoked += 1;
            }
            ValidationOutcome::Transient(message) => {
                tracing::debug!(
                    credential_id = %candidate.id,
                    %message,
                    "route credential revalidation skipped (transient)"
                );
            }
        }
    }
    Ok((total, revoked))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn test_db() -> DbHandle {
        DbHandle::new_memory().unwrap()
    }

    #[test]
    fn upsert_list_delete_roundtrip() {
        let db = test_db();
        upsert_credential(&db, "u1", Some("t1"), "anthropic", "sk-test-1234abcd", Some("https://api.anthropic.com"), Some("my key"), true).unwrap();
        upsert_credential(&db, "u1", Some("t1"), "openai", "sk-openai-wxyz", None, None, false).unwrap();

        let list = list_credentials(&db, "u1").unwrap();
        assert_eq!(list.len(), 2);
        let anthropic = list.iter().find(|c| c.provider_id == "anthropic").unwrap();
        assert_eq!(anthropic.masked, "sk-…abcd");
        assert_eq!(anthropic.status, "active");
        assert!(anthropic.last_validated_at.is_some());
        let openai = list.iter().find(|c| c.provider_id == "openai").unwrap();
        assert_eq!(openai.status, "unvalidated");

        // Other users see nothing.
        assert!(list_credentials(&db, "u2").unwrap().is_empty());

        // Delete only the caller's own row.
        assert!(delete_credential(&db, "u1", "anthropic").unwrap());
        assert!(!delete_credential(&db, "u2", "openai").unwrap());
        assert_eq!(list_credentials(&db, "u1").unwrap().len(), 1);
    }

    #[test]
    fn upsert_replaces_existing_key_for_provider() {
        let db = test_db();
        upsert_credential(&db, "u1", None, "anthropic", "sk-first-aaaa", None, None, true).unwrap();
        upsert_credential(&db, "u1", None, "anthropic", "sk-second-bbbb", Some("https://example.com"), Some("rotated"), false).unwrap();

        let list = list_credentials(&db, "u1").unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].masked, "sk-…bbbb");
        assert_eq!(list[0].status, "unvalidated");
        assert_eq!(list[0].label.as_deref(), Some("rotated"));
    }

    #[test]
    fn rejects_bad_provider_id_and_empty_key() {
        let db = test_db();
        assert!(upsert_credential(&db, "u1", None, "Not A Provider", "sk-x", None, None, true).is_err());
        assert!(upsert_credential(&db, "u1", None, "anthropic", "", None, None, true).is_err());
        assert!(add_org_credential(&db, "", "anthropic", "sk-x", None, None, true).is_err());
        assert!(add_org_credential(&db, "o1", "Bad Provider", "sk-x", None, None, true).is_err());
    }

    #[test]
    fn get_credential_decrypts_active_rows_only() {
        let db = test_db();
        upsert_credential(&db, "u1", None, "anthropic", "sk-secret-9876", Some("https://api.anthropic.com"), None, true).unwrap();

        let cred = get_credential(&db, "u1", "anthropic").unwrap().unwrap();
        assert_eq!(cred.api_key, "sk-secret-9876");
        assert_eq!(cred.base_url.as_deref(), Some("https://api.anthropic.com"));
        assert_eq!(cred.scope, CredentialScope::User);
        assert!(cred.credential_id.is_some());
        assert!(get_credential(&db, "u2", "anthropic").unwrap().is_none());
        assert!(get_credential(&db, "u1", "google").unwrap().is_none());

        assert!(has_credential(&db, "u1", "anthropic"));
        assert!(!has_credential(&db, "u1", "google"));
    }

    #[test]
    fn masked_key_handles_short_keys() {
        assert_eq!(mask_key("abcd"), "abc…abcd");
        assert_eq!(mask_key("sk-"), "sk-…sk-");
    }

    // ─── P1.7: resolution order ─────────────────────────────────────────

    #[test]
    fn resolution_prefers_user_over_org_pool() {
        let db = test_db();
        upsert_credential(&db, "u1", None, "anthropic", "sk-user-aaaa", None, None, true).unwrap();
        add_org_credential(&db, "org1", "anthropic", "sk-org-bbbb", None, None, true).unwrap();

        let cred = resolve_credential(&db, "u1", Some("org1"), "anthropic")
            .unwrap()
            .unwrap();
        assert_eq!(cred.scope, CredentialScope::User);
        assert_eq!(cred.api_key, "sk-user-aaaa");
    }

    #[test]
    fn resolution_falls_back_to_org_pool_then_platform() {
        let db = test_db();
        add_org_credential(&db, "org1", "anthropic", "sk-org-bbbb", None, None, true).unwrap();

        // No user credential → org pool.
        let cred = resolve_credential(&db, "u1", Some("org1"), "anthropic")
            .unwrap()
            .unwrap();
        assert_eq!(cred.scope, CredentialScope::Org);
        assert_eq!(cred.api_key, "sk-org-bbbb");

        // No user credential, no org → platform (None).
        assert!(resolve_credential(&db, "u1", Some("org2"), "anthropic").unwrap().is_none());
        assert!(resolve_credential(&db, "u1", None, "anthropic").unwrap().is_none());
        // Wrong provider → nothing.
        assert!(resolve_credential(&db, "u1", Some("org1"), "google").unwrap().is_none());
    }

    #[test]
    fn has_any_credential_covers_both_scopes() {
        let db = test_db();
        add_org_credential(&db, "org1", "anthropic", "sk-org-bbbb", None, None, true).unwrap();
        assert!(has_any_credential(&db, "u1", Some("org1"), "anthropic"));
        assert!(!has_any_credential(&db, "u1", None, "anthropic"));
        assert!(!has_any_credential(&db, "u1", Some("org1"), "google"));
        upsert_credential(&db, "u1", None, "google", "sk-user-cccc", None, None, true).unwrap();
        assert!(has_any_credential(&db, "u1", None, "google"));
    }

    // ─── P1.7: rotation ─────────────────────────────────────────────────

    #[test]
    fn org_pool_crud_scoped_to_org() {
        let db = test_db();
        let id1 = add_org_credential(&db, "org1", "anthropic", "sk-org-aaaa", None, Some("first"), true).unwrap();
        add_org_credential(&db, "org1", "anthropic", "sk-org-bbbb", None, Some("second"), false).unwrap();
        add_org_credential(&db, "org2", "anthropic", "sk-org2-cccc", None, None, true).unwrap();

        let pool = list_org_credentials(&db, "org1").unwrap();
        assert_eq!(pool.len(), 2);
        assert_eq!(pool[0].masked, "sk-…aaaa");
        assert_eq!(pool[0].status, "active");
        assert!(pool[0].last_validated_at.is_some());
        assert_eq!(pool[1].status, "unvalidated");
        assert_eq!(list_org_credentials(&db, "org2").unwrap().len(), 1);

        // Delete is org-scoped: org2 cannot delete org1's row.
        assert!(!delete_org_credential(&db, "org2", &id1).unwrap());
        assert!(delete_org_credential(&db, "org1", &id1).unwrap());
        assert_eq!(list_org_credentials(&db, "org1").unwrap().len(), 1);
    }

    #[test]
    fn pool_rotation_is_round_robin_least_recently_used() {
        let db = test_db();
        add_org_credential(&db, "org1", "anthropic", "sk-key-aaaa", None, None, true).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(1100)); // DATETIME has 1s resolution
        add_org_credential(&db, "org1", "anthropic", "sk-key-bbbb", None, None, true).unwrap();

        // Never-used first: both unused, so first-created wins… then the
        // stamp rotates to the other key on the next pick.
        let first = get_org_pool_credential(&db, "org1", "anthropic").unwrap().unwrap();
        let second = get_org_pool_credential(&db, "org1", "anthropic").unwrap().unwrap();
        assert_ne!(
            first.credential_id.as_deref(),
            second.credential_id.as_deref(),
            "consecutive picks must rotate across the pool"
        );
        std::thread::sleep(std::time::Duration::from_millis(1100));
        let third = get_org_pool_credential(&db, "org1", "anthropic").unwrap().unwrap();
        assert_eq!(third.credential_id, first.credential_id);
    }

    #[test]
    fn failing_key_is_marked_and_eventually_skipped() {
        let db = test_db();
        let bad = add_org_credential(&db, "org1", "anthropic", "sk-bad-aaaa", None, None, true).unwrap();
        let good = add_org_credential(&db, "org1", "anthropic", "sk-good-bb", None, None, true).unwrap();

        // Below the threshold the key stays active but loses to healthier rows.
        mark_credential_failed(&db, CredentialScope::Org, &bad).unwrap();
        let pick = get_org_pool_credential(&db, "org1", "anthropic").unwrap().unwrap();
        assert_eq!(pick.credential_id.as_deref(), Some(good.as_str()));

        // At the threshold the row flips to `failed` and is skipped outright.
        mark_credential_failed(&db, CredentialScope::Org, &bad).unwrap();
        mark_credential_failed(&db, CredentialScope::Org, &bad).unwrap();
        let pool = list_org_credentials(&db, "org1").unwrap();
        let bad_row = pool.iter().find(|c| c.id == bad).unwrap();
        assert_eq!(bad_row.status, "failed");
        assert_eq!(bad_row.fail_count, MAX_CONSECUTIVE_FAILURES as i64);
        assert!(bad_row.last_failed_at.is_some());

        // Only the healthy key is ever selected now.
        let pick = get_org_pool_credential(&db, "org1", "anthropic").unwrap().unwrap();
        assert_eq!(pick.credential_id.as_deref(), Some(good.as_str()));
        assert!(has_any_credential(&db, "nobody", Some("org1"), "anthropic"));

        // Failure marking works for user-scoped rows too.
        upsert_credential(&db, "u1", None, "openai", "sk-user-dddd", None, None, true).unwrap();
        let cred = get_credential(&db, "u1", "openai").unwrap().unwrap();
        let uid = cred.credential_id.clone().unwrap();
        for _ in 0..MAX_CONSECUTIVE_FAILURES {
            mark_credential_failed(&db, CredentialScope::User, &uid).unwrap();
        }
        assert!(get_credential(&db, "u1", "openai").unwrap().is_none());
        assert!(!has_credential(&db, "u1", "openai"));
    }

    #[test]
    fn success_resets_failure_streak() {
        let db = test_db();
        let id = add_org_credential(&db, "org1", "anthropic", "sk-org-aaaa", None, None, true).unwrap();
        mark_credential_failed(&db, CredentialScope::Org, &id).unwrap();
        mark_credential_failed(&db, CredentialScope::Org, &id).unwrap();
        mark_credential_ok(&db, CredentialScope::Org, &id).unwrap();
        let row = list_org_credentials(&db, "org1").unwrap().remove(0);
        assert_eq!(row.fail_count, 0);
        assert!(row.last_failed_at.is_none());
        assert_eq!(row.status, "active");
    }

    // ─── P1.7: sweep ────────────────────────────────────────────────────

    #[test]
    fn sweep_candidates_only_active_with_base_url() {
        let db = test_db();
        // Probeable: active + base_url.
        upsert_credential(&db, "u1", None, "anthropic", "sk-user-aaaa", Some("https://api.anthropic.com"), None, true).unwrap();
        add_org_credential(&db, "org1", "openai", "sk-org-bbbb", Some("https://api.openai.com"), None, true).unwrap();
        // Not probeable: no base_url.
        upsert_credential(&db, "u1", None, "google", "sk-user-cccc", None, None, true).unwrap();
        // Not probeable: not active.
        add_org_credential(&db, "org1", "anthropic", "sk-org-dddd", Some("https://example.com"), None, false).unwrap();

        let candidates = sweep_candidates(&db).unwrap();
        assert_eq!(candidates.len(), 2);
        assert!(candidates.iter().any(|c| c.scope == CredentialScope::User));
        assert!(candidates.iter().any(|c| c.scope == CredentialScope::Org));
    }

    #[tokio::test]
    async fn sweep_marks_unreachable_transient_and_leaves_state() {
        // Nothing listens on this port: validation fails as transient, so the
        // credential must stay active (the sweep only revokes on 401/403).
        let db = test_db();
        let id = add_org_credential(
            &db,
            "org1",
            "anthropic",
            "sk-org-aaaa",
            Some("http://127.0.0.1:9"),
            None,
            true,
        )
        .unwrap();
        let (checked, revoked) = sweep_once(&db).await.unwrap();
        assert_eq!((checked, revoked), (1, 0));
        let row = list_org_credentials(&db, "org1").unwrap().remove(0);
        assert_eq!(row.status, "active");
        assert_eq!(row.id, id);
    }

    #[test]
    fn evict_cached_drops_plaintext() {
        let db = test_db();
        upsert_credential(&db, "u1", None, "anthropic", "sk-cache-aaaa", None, None, true).unwrap();
        let id = get_credential(&db, "u1", "anthropic").unwrap().unwrap().credential_id.unwrap();
        assert!(decrypt_cache().read().unwrap().contains_key(&id));
        evict_cached(&id);
        assert!(!decrypt_cache().read().unwrap().contains_key(&id));
    }
}
