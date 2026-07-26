//! Credential Management
//!
//! Secure credential handling for cloud providers.
//! 
//! Policy: Never store provider secrets unless absolutely necessary.

use serde::{Deserialize, Serialize};

/// Credential policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialPolicy {
    /// Use ephemeral credentials (use once, discard)
    pub ephemeral: bool,
    
    /// Encrypt credentials at rest (if stored)
    pub encrypt_at_rest: bool,
    
    /// Token scope
    pub scope: TokenScope,
    
    /// Auto-rotate credentials
    pub auto_rotate: bool,
}

impl Default for CredentialPolicy {
    fn default() -> Self {
        Self {
            ephemeral: true,
            encrypt_at_rest: true,
            scope: TokenScope::DeployOnly,
            auto_rotate: false,
        }
    }
}

/// Token scope
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TokenScope {
    /// Read-only access
    ReadOnly,
    /// Deploy instances only
    DeployOnly,
    /// Full access (not recommended)
    Full,
}

/// Provider credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCredentials {
    /// Provider name
    pub provider: String,
    
    /// API key / token
    pub api_key: String,
    
    /// API secret (sensitive!)
    pub api_secret: String,
    
    /// Optional: API endpoint override
    pub endpoint: Option<String>,
    
    /// Credential metadata
    pub metadata: CredentialMetadata,
}

/// Credential metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialMetadata {
    /// When credentials were created
    pub created_at: chrono::DateTime<chrono::Utc>,
    
    /// When credentials expire (if applicable)
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    
    /// Last used timestamp
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    
    /// Usage count
    pub usage_count: u32,
}

impl ProviderCredentials {
    /// Create new credentials
    pub fn new(provider: &str, api_key: &str, api_secret: &str) -> Self {
        Self {
            provider: provider.to_string(),
            api_key: api_key.to_string(),
            api_secret: api_secret.to_string(),
            endpoint: None,
            metadata: CredentialMetadata {
                created_at: chrono::Utc::now(),
                expires_at: None,
                last_used: None,
                usage_count: 0,
            },
        }
    }
    
    /// Mark credentials as used
    pub fn mark_used(&mut self) {
        self.metadata.last_used = Some(chrono::Utc::now());
        self.metadata.usage_count += 1;
    }
    
    /// Check if credentials are expired
    pub fn is_expired(&self) -> bool {
        self.metadata
            .expires_at
            .map(|exp| chrono::Utc::now() > exp)
            .unwrap_or(false)
    }
}

/// Encrypted credentials (for storage)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedCredentials {
    /// Encrypted API key
    pub encrypted_api_key: Vec<u8>,
    
    /// Encrypted API secret
    pub encrypted_api_secret: Vec<u8>,
    
    /// Encryption key ID
    pub key_id: String,
    
    /// Nonce for encryption
    pub nonce: Vec<u8>,
}

// ============================================================================
// Encryption at rest (AES-256-GCM via `ring`)
// ============================================================================

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::rand::{SecureRandom, SystemRandom};
use sha2::{Digest, Sha256};

/// Environment variable holding the credential encryption key material.
/// The raw value is SHA-256'd into the AES-256 key, so any high-entropy
/// string works (e.g. `openssl rand -hex 32`).
pub const CREDENTIALS_KEY_ENV: &str = "ALLTERNIT_CREDENTIALS_KEY";

/// Serialized ciphertexts carry this version prefix so the format can rotate.
const CIPHER_VERSION_PREFIX: &str = "v1:";
const NONCE_LEN: usize = 12;

/// Credential encryption/decryption error
#[derive(Debug, thiserror::Error)]
pub enum CredentialCryptoError {
    #[error("encryption failed: {0}")]
    EncryptFailed(String),

    #[error("decryption failed: {0}")]
    DecryptFailed(String),
}

/// AES-256-GCM cipher for provider tokens and other secrets stored in the
/// platform database. Built from [`CREDENTIALS_KEY_ENV`]; when the variable
/// is unset, callers decide whether plaintext storage is acceptable (dev) —
/// production wiring should refuse to start without it.
pub struct CredentialCipher {
    key: LessSafeKey,
    rng: SystemRandom,
}

impl CredentialCipher {
    /// Build a cipher from arbitrary key material (hashed to 256 bits).
    pub fn new(key_material: &str) -> Self {
        let digest = Sha256::digest(key_material.as_bytes());
        let unbound = UnboundKey::new(&AES_256_GCM, &digest)
            .expect("SHA-256 output is always a valid AES-256 key");
        Self {
            key: LessSafeKey::new(unbound),
            rng: SystemRandom::new(),
        }
    }

    /// Build a cipher from [`CREDENTIALS_KEY_ENV`]; `None` when unset/empty.
    pub fn from_env() -> Option<Self> {
        std::env::var(CREDENTIALS_KEY_ENV)
            .ok()
            .filter(|value| !value.is_empty())
            .map(|value| Self::new(&value))
    }

    /// Encrypt a UTF-8 secret; returns `v1:<base64(nonce || ciphertext || tag)>`.
    pub fn encrypt(&self, plaintext: &str) -> Result<String, CredentialCryptoError> {
        let mut nonce_bytes = [0u8; NONCE_LEN];
        self.rng
            .fill(&mut nonce_bytes)
            .map_err(|_| CredentialCryptoError::EncryptFailed("RNG failure".to_string()))?;
        let nonce = Nonce::assume_unique_for_key(nonce_bytes);

        let mut in_out = plaintext.as_bytes().to_vec();
        self.key
            .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| CredentialCryptoError::EncryptFailed("seal failed".to_string()))?;

        let mut blob = nonce_bytes.to_vec();
        blob.extend_from_slice(&in_out);
        Ok(format!("{}{}", CIPHER_VERSION_PREFIX, BASE64.encode(blob)))
    }

    /// Decrypt a value produced by [`CredentialCipher::encrypt`].
    pub fn decrypt(&self, encoded: &str) -> Result<String, CredentialCryptoError> {
        let blob_b64 = encoded.strip_prefix(CIPHER_VERSION_PREFIX).ok_or_else(|| {
            CredentialCryptoError::DecryptFailed("unknown ciphertext format".to_string())
        })?;
        let mut blob = BASE64.decode(blob_b64).map_err(|e| {
            CredentialCryptoError::DecryptFailed(format!("invalid base64: {}", e))
        })?;
        if blob.len() < NONCE_LEN + AES_256_GCM.tag_len() {
            return Err(CredentialCryptoError::DecryptFailed(
                "ciphertext too short".to_string(),
            ));
        }
        let (nonce_bytes, ciphertext) = blob.split_at_mut(NONCE_LEN);
        let mut nonce_array = [0u8; NONCE_LEN];
        nonce_array.copy_from_slice(nonce_bytes);
        let nonce = Nonce::assume_unique_for_key(nonce_array);

        let plaintext = self
            .key
            .open_in_place(nonce, Aad::empty(), ciphertext)
            .map_err(|_| {
                CredentialCryptoError::DecryptFailed(
                    "open failed (wrong key or corrupted data)".to_string(),
                )
            })?;
        String::from_utf8(plaintext.to_vec()).map_err(|e| {
            CredentialCryptoError::DecryptFailed(format!("plaintext is not UTF-8: {}", e))
        })
    }

    /// Encrypt unless the value is already a `v1:` ciphertext (idempotent
    /// re-saves).
    pub fn encrypt_if_plaintext(&self, value: &str) -> Result<String, CredentialCryptoError> {
        if value.starts_with(CIPHER_VERSION_PREFIX) {
            Ok(value.to_string())
        } else {
            self.encrypt(value)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let cipher = CredentialCipher::new("test-key-material");
        let secret = "hcx-super-secret-token";
        let encrypted = cipher.encrypt(secret).unwrap();
        assert!(encrypted.starts_with("v1:"));
        assert!(!encrypted.contains(secret));
        assert_eq!(cipher.decrypt(&encrypted).unwrap(), secret);
    }

    #[test]
    fn encrypt_is_non_deterministic() {
        let cipher = CredentialCipher::new("test-key-material");
        let a = cipher.encrypt("same").unwrap();
        let b = cipher.encrypt("same").unwrap();
        assert_ne!(a, b, "random nonce must make ciphertexts differ");
        assert_eq!(cipher.decrypt(&a).unwrap(), "same");
        assert_eq!(cipher.decrypt(&b).unwrap(), "same");
    }

    #[test]
    fn wrong_key_fails_to_decrypt() {
        let a = CredentialCipher::new("key-a");
        let b = CredentialCipher::new("key-b");
        let encrypted = a.encrypt("secret").unwrap();
        assert!(b.decrypt(&encrypted).is_err());
    }

    #[test]
    fn encrypt_if_plaintext_is_idempotent() {
        let cipher = CredentialCipher::new("test-key-material");
        let once = cipher.encrypt_if_plaintext("token").unwrap();
        let twice = cipher.encrypt_if_plaintext(&once).unwrap();
        assert_eq!(once, twice);
    }
}
