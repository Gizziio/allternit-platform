//! Per-user provider route credentials — "BYO subscription keys"
//! (Allternit Brain `Products/ProviderRouting.md` deferred follow-up).
//!
//! When a request's resolved provider matches one of the caller's own
//! credentials, the gateway attaches it to the Gizzi session-message payload
//! as `provider_credentials` so the upstream call bills the customer's own
//! cloud console instead of Allternit credits. Keys are sealed with
//! [`crate::token_crypto`] at rest and are never returned in full — list
//! responses carry only a masked fingerprint.

use rusqlite::{params, OptionalExtension};
use serde::Serialize;

use crate::db::DbHandle;
use crate::token_crypto;

/// A decrypted credential for the proxy hot path.
pub struct RouteCredential {
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
    let row: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT api_key, base_url FROM user_route_credentials
             WHERE user_id = ?1 AND provider_id = ?2 AND status = 'active'",
            params![user_id, provider_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    Ok(row.map(|(api_key, base_url)| RouteCredential {
        provider_id: provider_id.to_string(),
        api_key: token_crypto::open(&api_key),
        base_url,
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

/// Probe a provider's OpenAI-compatible `/models` endpoint with the key.
/// 401/403 → rejected; any other 2xx/404 → accepted (endpoint exists and did
/// not challenge the key).
pub async fn validate_api_key(base_url: &str, api_key: &str) -> Result<(), String> {
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|err| format!("validator setup failed: {err}"))?;
    let response = client
        .get(&url)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|err| format!("validation request to {url} failed: {err}"))?;
    match response.status().as_u16() {
        401 | 403 => Err(format!("key rejected by {url} (HTTP {}).", response.status())),
        _ => Ok(()),
    }
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
    }

    #[test]
    fn get_credential_decrypts_active_rows_only() {
        let db = test_db();
        upsert_credential(&db, "u1", None, "anthropic", "sk-secret-9876", Some("https://api.anthropic.com"), None, true).unwrap();

        let cred = get_credential(&db, "u1", "anthropic").unwrap().unwrap();
        assert_eq!(cred.api_key, "sk-secret-9876");
        assert_eq!(cred.base_url.as_deref(), Some("https://api.anthropic.com"));
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
}
