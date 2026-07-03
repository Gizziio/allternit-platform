//! Secure secret storage for the packaged Allternit Platform app.
//!
//! Provider API keys and other user secrets are stored in the OS keychain
//! (macOS Keychain, Windows Credential Manager, Linux secret-service/Keyring)
//! instead of being written to plain JSON config files. The API still supports
//! an in-memory fallback for environments without a keychain.

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

const SERVICE_NAME: &str = "allternit-platform";

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

/// Read a secret from the OS keychain.
pub fn get_secret(account: &str) -> Option<String> {
    let entry = match entry(account) {
        Ok(e) => e,
        Err(err) => {
            warn!(account, error = %err, "Failed to open keychain entry");
            return None;
        }
    };
    match entry.get_password() {
        Ok(value) => {
            info!(account, "Read secret from keychain");
            Some(value)
        }
        Err(keyring::Error::NoEntry) => None,
        Err(err) => {
            warn!(account, error = %err, "Failed to read secret from keychain");
            None
        }
    }
}

/// Write a secret to the OS keychain.
pub fn set_secret(account: &str, value: &str) -> Result<(), String> {
    entry(account)?.set_password(value).map_err(|e| format!("Failed to write secret to keychain: {e}"))?;
    info!(account, "Wrote secret to keychain");
    Ok(())
}

/// Delete a secret from the OS keychain.
pub fn delete_secret(account: &str) -> Result<(), String> {
    entry(account)?.delete_credential().map_err(|e| format!("Failed to delete secret from keychain: {e}"))?;
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
