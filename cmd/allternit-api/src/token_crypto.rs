//! Transparent at-rest encryption for connector tokens.
//!
//! Tokens are sealed with AES-256-GCM when an encryption key is configured —
//! `ALLTERNIT_ENCRYPTION_KEY` (override) or the platform's canonical
//! `ENCRYPTION_KEY` (config.rs::encryption_key / company.json) — and stored as
//! drawn from a UUID v4 (already a dependency), the key is SHA-256 of the env
//! value (any passphrase → 32 bytes). With no key set (local dev), tokens are
//! stored with a `plain:` prefix so the boundary is explicit and legacy
//! un-prefixed rows keep decrypting. `open` is fail-closed: a ciphertext that
//! does not decrypt returns empty (unusable) rather than leaking bytes.
//!
//! Reuses crates already in Cargo.toml: `aes-gcm`, `sha2`, `base64`, `uuid`.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::Engine;
use sha2::{Digest, Sha256};

const ENC_PREFIX: &str = "enc:v1:";
const PLAIN_PREFIX: &str = "plain:";

/// OS-keychain account holding the auto-generated platform encryption key, so
/// token sealing is zero-touch and persistent across restarts with no plaintext
/// file and nothing for the user to configure.
pub const PLATFORM_KEY_ACCOUNT: &str = "platform:encryption-key";

fn derive(passphrase: &str) -> [u8; 32] {
    let digest = Sha256::digest(passphrase.as_bytes());
    let mut k = [0u8; 32];
    k.copy_from_slice(&digest);
    k
}

fn key_bytes() -> Option<[u8; 32]> {
    static K: std::sync::OnceLock<[u8; 32]> = std::sync::OnceLock::new();
    // Return a cached key when we have one. Critically, do NOT cache a negative
    // result: the first-run wizard may generate the keychain key mid-process, and
    // a cached None would pin this process to plaintext until restart. Re-probe
    // the sources whenever no key is cached yet.
    if let Some(k) = K.get() {
        return Some(*k);
    }
    // Align with the platform's canonical encryption knob: `ENCRYPTION_KEY`
    // (config.rs::encryption_key, also backed by company.json). Keep
    // `ALLTERNIT_ENCRYPTION_KEY` as an explicit override, then fall back to the
    // zero-touch keychain key generated on first run — one secret drives both
    // the platform and connector-token sealing, no split-brain key.
    let raw = std::env::var("ALLTERNIT_ENCRYPTION_KEY")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("ENCRYPTION_KEY").ok().filter(|s| !s.is_empty()))
        .or_else(|| crate::secrets::get_secret(PLATFORM_KEY_ACCOUNT))?;
    let k = derive(&raw);
    let _ = K.set(k); // ignore Err if another thread raced us
    Some(*K.get().unwrap())
}

/// Ensure an encryption key exists: env override → keychain (auto-generated on
/// first run). Called once at startup before any connector op so the cached key
/// is warm. Returns true if sealing is available, false if every source failed
/// (headless keychain) — tokens then store `plain:` for that process only.
pub fn ensure_platform_key() -> bool {
    if encryption_enabled() {
        return true;
    }
    // Generate 256 bits of randomness as a 64-char hex passphrase (two UUID v4s).
    let mut bytes = [0u8; 32];
    bytes[..16].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    bytes[16..].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    let passphrase = hex::encode(bytes);
    if crate::secrets::set_secret(PLATFORM_KEY_ACCOUNT, &passphrase).is_err() {
        return false;
    }
    true
}

pub fn encryption_enabled() -> bool {
    key_bytes().is_some()
}

pub fn seal(plain: &str) -> String {
    if plain.is_empty() {
        return String::new();
    }
    let key = match key_bytes() {
        Some(k) => k,
        None => return format!("{}{}", PLAIN_PREFIX, plain),
    };
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce_bytes = uuid::Uuid::new_v4().as_bytes()[..12].to_vec();
    let nonce = Nonce::from_slice(&nonce_bytes);
    match cipher.encrypt(nonce, plain.as_bytes()) {
        Ok(ct) => format!(
            "{}{}:{}",
            ENC_PREFIX,
            base64::engine::general_purpose::STANDARD.encode(&nonce_bytes),
            base64::engine::general_purpose::STANDARD.encode(&ct)
        ),
        Err(_) => format!("{}{}", PLAIN_PREFIX, plain), // should not happen; never store broken ciphertext
    }
}

pub fn open(stored: &str) -> String {
    if stored.is_empty() {
        return String::new();
    }
    if let Some(rest) = stored.strip_prefix(PLAIN_PREFIX) {
        return rest.to_string();
    }
    if let Some(rest) = stored.strip_prefix(ENC_PREFIX) {
        let key = match key_bytes() {
            Some(k) => k,
            None => return String::new(), // ciphertext but no key configured → unusable, fail closed
        };
        let mut parts = rest.splitn(2, ':');
        let (Some(n_b64), Some(ct_b64)) = (parts.next(), parts.next()) else {
            return String::new();
        };
        let (Ok(nonce_bytes), Ok(ct)) = (
            base64::engine::general_purpose::STANDARD.decode(n_b64),
            base64::engine::general_purpose::STANDARD.decode(ct_b64),
        ) else {
            return String::new();
        };
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
        return match cipher.decrypt(Nonce::from_slice(&nonce_bytes), ct.as_ref()) {
            Ok(pt) => String::from_utf8(pt).unwrap_or_default(),
            Err(_) => String::new(),
        };
    }
    // Legacy un-prefixed plaintext row.
    stored.to_string()
}
