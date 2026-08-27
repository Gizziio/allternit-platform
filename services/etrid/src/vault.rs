//! Vault integration for Etrid key material.
//!
//! Phase 1 is a trait + in-memory implementation. Production should call the
//! Allternit vault service (`allternit_vault`) or an external KMS to seal and
//! unseal private keys.

use base64::prelude::*;
use serde::{Deserialize, Serialize};

/// Encrypted key blob returned by the vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SealedKey {
    pub vault_ref: String,
    pub ciphertext: String,
    pub nonce: String,
}

/// Vault backend contract.
pub trait KeyVault: Send + Sync {
    type Error: std::error::Error + Send + Sync + 'static;

    /// Seal raw private key bytes and return a vault reference.
    fn seal(&self, key_bytes: &[u8]) -> Result<SealedKey, Self::Error>;

    /// Unseal a previously sealed key.
    fn unseal(&self, vault_ref: &str) -> Result<Vec<u8>, Self::Error>;
}

/// In-memory vault for local development and tests.
pub struct InMemoryVault {
    keys: std::sync::Mutex<std::collections::HashMap<String, Vec<u8>>>,
}

impl InMemoryVault {
    pub fn new() -> Self {
        Self {
            keys: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }
}

impl Default for InMemoryVault {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyVault for InMemoryVault {
    type Error = std::io::Error;

    fn seal(&self, key_bytes: &[u8]) -> Result<SealedKey, Self::Error> {
        use rand::RngCore;
        let mut ref_bytes = [0u8; 16];
        rand::rngs::OsRng.fill_bytes(&mut ref_bytes);
        let vault_ref = format!("vault://etrid/mem/{}", hex::encode(ref_bytes));
        self.keys
            .lock()
            .unwrap()
            .insert(vault_ref.clone(), key_bytes.to_vec());
        Ok(SealedKey {
            vault_ref,
            ciphertext: BASE64_STANDARD.encode(key_bytes),
            nonce: hex::encode(ref_bytes),
        })
    }

    fn unseal(&self, vault_ref: &str) -> Result<Vec<u8>, Self::Error> {
        self.keys
            .lock()
            .unwrap()
            .get(vault_ref)
            .cloned()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "key not found"))
    }
}
