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

const PLATFORM_KEY_FILE: &str = "connector-encryption.key";

fn derive(passphrase: &str) -> [u8; 32] {
    let digest = Sha256::digest(passphrase.as_bytes());
    let mut k = [0u8; 32];
    k.copy_from_slice(&digest);
    k
}

fn key_bytes() -> Option<[u8; 32]> {
    static K: std::sync::OnceLock<[u8; 32]> = std::sync::OnceLock::new();
    // Return a cached key when we have one. Critically, do NOT cache a negative
    // result: the first-run wizard may generate the runtime key mid-process, and
    // a cached None would pin this process to plaintext until restart. Re-probe
    // the sources whenever no key is cached yet.
    if let Some(k) = K.get() {
        return Some(*k);
    }
    // The signed desktop process provides `ALLTERNIT_ENCRYPTION_KEY`. Headless
    // runtimes fall back to a mode-0600 runtime file; this process never talks
    // to OS Keychain.
    let raw = std::env::var("ALLTERNIT_ENCRYPTION_KEY")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            std::env::var("ENCRYPTION_KEY")
                .ok()
                .filter(|s| !s.is_empty())
        })
        .or_else(read_runtime_key)?;
    let k = derive(&raw);
    let _ = K.set(k); // ignore Err if another thread raced us
    Some(*K.get().unwrap())
}

fn runtime_key_path() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("ALLTERNIT_PLATFORM_KEY_FILE") {
        if !path.is_empty() {
            return path.into();
        }
    }
    let directory = std::env::var("ALLTERNIT_DATA_DIR")
        .ok()
        .filter(|value| !value.is_empty())
        .map(std::path::PathBuf::from)
        .or_else(|| dirs::data_dir().map(|path| path.join("allternit")))
        .unwrap_or_else(|| std::path::PathBuf::from("/var/lib/allternit"));
    directory.join(PLATFORM_KEY_FILE)
}

fn read_runtime_key() -> Option<String> {
    std::fs::read_to_string(runtime_key_path())
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

/// Ensure an encryption key exists. Desktop supplies it from Electron
/// `safeStorage`; headless/VPS mode creates a private local runtime key.
pub fn ensure_platform_key() -> bool {
    if encryption_enabled() {
        return true;
    }
    // Generate 256 bits of randomness as a 64-char hex passphrase (two UUID v4s).
    let mut bytes = [0u8; 32];
    bytes[..16].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    bytes[16..].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    let passphrase = hex::encode(bytes);
    let path = runtime_key_path();
    if let Some(parent) = path.parent() {
        if std::fs::create_dir_all(parent).is_err() {
            return false;
        }
    }

    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    match options.open(&path) {
        Ok(mut file) => {
            use std::io::Write;
            if file.write_all(passphrase.as_bytes()).is_err() {
                let _ = std::fs::remove_file(&path);
                return false;
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(_) => return false,
    }
    key_bytes().is_some()
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
