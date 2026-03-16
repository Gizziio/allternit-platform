//! OAuth types for MCP authentication

use serde::{Deserialize, Serialize};

/// OAuth tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokens {
    pub access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
}

/// OAuth client registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientRegistration {
    pub client_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redirect_uris: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grant_types: Option<Vec<String>>,
}

/// PKCE (Proof Key for Code Exchange) parameters
#[derive(Debug, Clone)]
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
    pub method: String,
}

impl Pkce {
    /// Generate a new PKCE pair with S256 method
    pub fn generate() -> Self {
        use rand::Rng;
        use sha2::{Digest, Sha256};

        // Generate 128-byte random verifier
        let verifier = {
            let random_bytes: Vec<u8> = (0..128).map(|_| rand::thread_rng().gen()).collect();
            base64::encode_config(random_bytes, base64::URL_SAFE_NO_PAD)
        };

        // Compute S256 challenge
        let challenge = {
            let mut hasher = Sha256::new();
            hasher.update(verifier.as_bytes());
            let hash = hasher.finalize();
            base64::encode_config(hash, base64::URL_SAFE_NO_PAD)
        };

        Self {
            verifier,
            challenge,
            method: "S256".to_string(),
        }
    }
}
