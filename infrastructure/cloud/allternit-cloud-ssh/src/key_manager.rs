//! SSH key manager
//!
//! Real key generation using ed25519-dalek.

use crate::Result;
use crate::executor::SshKeypair;
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// SSH key manager for generating and managing keys
pub struct SshKeyManager;

impl SshKeyManager {
    /// Create a new key manager
    pub fn new() -> Self {
        Self
    }

    /// Generate a new SSH keypair
    /// 
    /// Uses Ed25519 for modern, secure key generation.
    pub fn generate_keypair(&self) -> Result<SshKeypair> {
        // Generate keypair using cryptographic RNG
        let mut csprng = OsRng {};
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();

        // Get raw bytes for private key
        let private_key_bytes = signing_key.to_bytes();
        
        // Encode private key in PEM format
        let private_key_pem = format!(
            "-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----",
            BASE64.encode(private_key_bytes)
        );

        // Convert public key to OpenSSH format
        let public_key_bytes = verifying_key.as_bytes();
        let public_key_base64 = BASE64.encode(public_key_bytes);
        let public_key_openssh = format!("ssh-ed25519 {} allternit-deployment", public_key_base64);

        Ok(SshKeypair {
            public_key: public_key_openssh,
            private_key: private_key_pem,
        })
    }
}

impl Default for SshKeyManager {
    fn default() -> Self {
        Self::new()
    }
}
