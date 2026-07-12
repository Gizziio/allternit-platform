//! Secure secret storage for the packaged Allternit Platform app.
//!
//! Provider API keys and other user secrets are stored in the OS keychain
//! (macOS Keychain, Windows Credential Manager, Linux secret-service/Keyring)
//! instead of being written to plain JSON config files. The API still supports
//! an in-memory fallback for environments without a keychain.

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

const SERVICE_NAME: &str = "allternit-platform";

/// Hard ceiling for any single keychain call. On macOS, a relinked or unsigned
/// binary that reads/writes an existing keychain item can trigger an ACL prompt
/// that blocks the underlying Security.framework call indefinitely — which has
/// been observed to hang API requests (e.g. the onboarding config endpoint)
/// forever. We run every keychain op on a worker thread and bound it; on
/// timeout the caller degrades (read → None, write/delete → Err) and the stuck
/// worker is left to finish on its own, since keychain calls cannot be
/// cancelled. Degraded mode means plaintext-prefix token sealing for that
/// process — a safe, explicit fallback.
const KEYCHAIN_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(1500);

/// Run a keychain operation with `KEYCHAIN_TIMEOUT`. Returns the op's result,
/// or an Err if the keychain did not answer in time.
fn with_keychain_timeout<T, F>(op: &'static str, account: &str, f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(f());
    });
    match rx.recv_timeout(KEYCHAIN_TIMEOUT) {
        Ok(result) => result,
        Err(_) => {
            warn!(
                op,
                account,
                timeout_ms = KEYCHAIN_TIMEOUT.as_millis() as u64,
                "Keychain call timed out — degrading (likely a macOS ACL prompt blocking Security.framework)"
            );
            Err(format!(
                "Keychain {op} for '{account}' timed out after {:?}",
                KEYCHAIN_TIMEOUT
            ))
        }
    }
}

/// Stored secret record. The `account` field is a stable identifier such as
/// `provider:anthropic` or `provider:openai`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StoredSecret {
    pub account: String,
    pub value: String,
}

fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| format!("Failed to open keychain entry: {e}"))
}

/// Read a secret from the OS keychain. Bounded by `KEYCHAIN_TIMEOUT`; returns
/// None on timeout or any keychain error.
pub fn get_secret(account: &str) -> Option<String> {
    let account_owned = account.to_string();
    match with_keychain_timeout("read", account, move || -> Result<Option<String>, String> {
        let entry = entry(&account_owned)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(format!("Failed to read secret from keychain: {err}")),
        }
    }) {
        Ok(Some(value)) => {
            info!(account, "Read secret from keychain");
            Some(value)
        }
        Ok(None) => None,
        Err(err) => {
            warn!(account, error = %err, "Failed to read secret from keychain");
            None
        }
    }
}

/// Write a secret to the OS keychain. Bounded by `KEYCHAIN_TIMEOUT`.
pub fn set_secret(account: &str, value: &str) -> Result<(), String> {
    let account_owned = account.to_string();
    let value_owned = value.to_string();
    with_keychain_timeout("write", account, move || {
        entry(&account_owned)?
            .set_password(&value_owned)
            .map_err(|e| format!("Failed to write secret to keychain: {e}"))
    })?;
    info!(account, "Wrote secret to keychain");
    Ok(())
}

/// Delete a secret from the OS keychain. Bounded by `KEYCHAIN_TIMEOUT`.
pub fn delete_secret(account: &str) -> Result<(), String> {
    let account_owned = account.to_string();
    with_keychain_timeout("delete", account, move || {
        entry(&account_owned)?
            .delete_credential()
            .map_err(|e| format!("Failed to delete secret from keychain: {e}"))
    })?;
    info!(account, "Deleted secret from keychain");
    Ok(())
}

/// Stable keychain account name for a provider API key.
pub fn provider_account(provider: &str) -> String {
    format!("provider:{provider}")
}

/// Retrieve all provider keys that have been stored in the keychain.
/// This is intentionally conservative: we only return keys for providers the
/// wizard has explicitly configured, so we do not enumerate the keychain.
pub fn get_provider_keys(providers: &[String]) -> std::collections::HashMap<String, String> {
    let mut out = std::collections::HashMap::new();
    for provider in providers {
        if let Some(value) = get_secret(&provider_account(provider)) {
            out.insert(provider.clone(), value);
        }
    }
    out
}
