//! Reconnect token generation and validation
//!
//! Tokens are used to reconnect to existing sessions across CLI invocations.
//! Format: "a2r_" prefix + URL-safe base64-encoded random bytes

use rand::RngCore;

/// Prefix for all A2R reconnect tokens
const TOKEN_PREFIX: &str = "a2r_";

/// Length of random bytes in the token (before base64 encoding)
const TOKEN_ENTROPY_BYTES: usize = 32;

/// Minimum valid token length (prefix + at least some entropy)
const MIN_TOKEN_LENGTH: usize = TOKEN_PREFIX.len() + 16;

/// Maximum valid token length
const MAX_TOKEN_LENGTH: usize = 128;

/// Token manager for generating and validating reconnect tokens
pub struct TokenManager;

impl TokenManager {
    /// Generate a new reconnect token
    ///
    /// Format: "a2r_" + base64url(random 32 bytes)
    /// Total length: 4 + 43 = 47 characters
    pub fn generate() -> String {
        let mut random_bytes = vec![0u8; TOKEN_ENTROPY_BYTES];
        rand::thread_rng().fill_bytes(&mut random_bytes);

        // Use URL-safe base64 encoding (no padding)
        use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
        let encoded = URL_SAFE_NO_PAD.encode(&random_bytes);

        format!("{}{}", TOKEN_PREFIX, encoded)
    }

    /// Validate a token's format
    ///
    /// Checks:
    /// - Has the correct prefix
    /// - Is within acceptable length bounds
    /// - Contains only valid base64url characters after prefix
    pub fn validate(token: &str) -> bool {
        // Check length bounds
        if token.len() < MIN_TOKEN_LENGTH || token.len() > MAX_TOKEN_LENGTH {
            return false;
        }

        // Check prefix
        if !token.starts_with(TOKEN_PREFIX) {
            return false;
        }

        // Get the payload (after prefix)
        let payload = &token[TOKEN_PREFIX.len()..];

        // Check that payload contains only valid base64url characters
        // base64url alphabet: A-Z, a-z, 0-9, -, _
        payload
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    }

    /// Extract the token payload (without prefix) for storage lookup
    pub fn extract_payload(token: &str) -> Option<&str> {
        if Self::validate(token) {
            Some(&token[TOKEN_PREFIX.len()..])
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_starts_with_prefix() {
        let token = TokenManager::generate();
        assert!(token.starts_with(TOKEN_PREFIX));
    }

    #[test]
    fn test_generate_valid_length() {
        let token = TokenManager::generate();
        // 4 (prefix) + 43 (base64 of 32 bytes with URL_SAFE_NO_PAD) = 47
        assert_eq!(token.len(), 47);
    }

    #[test]
    fn test_generated_tokens_are_valid() {
        for _ in 0..100 {
            let token = TokenManager::generate();
            assert!(TokenManager::validate(&token), "Token should be valid: {}", token);
        }
    }

    #[test]
    fn test_validate_rejects_invalid_prefix() {
        assert!(!TokenManager::validate("invalid_token"));
        assert!(!TokenManager::validate("a2r")); // incomplete prefix
        assert!(!TokenManager::validate("a2r"));
    }

    #[test]
    fn test_validate_rejects_too_short() {
        assert!(!TokenManager::validate("a2r_abc"));
    }

    #[test]
    fn test_validate_rejects_too_long() {
        let long_token = format!("{}a{}", TOKEN_PREFIX, "b".repeat(200));
        assert!(!TokenManager::validate(&long_token));
    }

    #[test]
    fn test_validate_rejects_invalid_characters() {
        // Standard base64 with padding and +/ characters should be rejected
        assert!(!TokenManager::validate("a2r_abc+/=="));
        // Spaces should be rejected
        assert!(!TokenManager::validate("a2r_abc def"));
    }

    #[test]
    fn test_extract_payload() {
        let token = TokenManager::generate();
        let payload = TokenManager::extract_payload(&token);
        assert!(payload.is_some());
        assert!(!payload.unwrap().is_empty());
    }

    #[test]
    fn test_extract_payload_invalid() {
        assert!(TokenManager::extract_payload("invalid").is_none());
    }
}
