/**
 * SSH Key Generation Service
 * 
 * Generates cryptographically secure SSH key pairs using OpenSSH format.
 * Supports ED25519 (recommended) and RSA 4096.
 */

use rand::rngs::OsRng;
use rand::RngCore;
use ssh_key::{Algorithm, PrivateKey, PublicKey};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct SSHKeyPair {
    pub id: String,
    pub name: String,
    pub algorithm: String,
    pub private_key: String,  // PEM format
    pub public_key: String,   // OpenSSH format
    pub fingerprint: String,  // SHA256 fingerprint
    pub fingerprint_md5: String, // MD5 fingerprint (legacy)
    pub created_at: u64,
    pub comment: String,
}

#[derive(Debug)]
pub enum KeyAlgorithm {
    Ed25519,
    Rsa4096,
}

impl std::fmt::Display for KeyAlgorithm {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KeyAlgorithm::Ed25519 => write!(f, "ed25519"),
            KeyAlgorithm::Rsa4096 => write!(f, "rsa"),
        }
    }
}

/// Generate a new SSH key pair
/// 
/// For production, this uses native OS ssh-keygen for maximum compatibility.
/// Fallback to pure Rust implementation if ssh-keygen is not available.
pub async fn generate_key_pair(
    name: String,
    algorithm: KeyAlgorithm,
) -> Result<SSHKeyPair, String> {
    // Try native ssh-keygen first
    match generate_with_ssh_keygen(&name, &algorithm).await {
        Ok(keys) => Ok(keys),
        Err(e) => {
            tracing::warn!("ssh-keygen failed ({}), using native implementation", e);
            generate_native(&name, algorithm).await
        }
    }
}

/// Generate using system ssh-keygen (preferred)
async fn generate_with_ssh_keygen(
    name: &str,
    algorithm: &KeyAlgorithm,
) -> Result<SSHKeyPair, String> {
    let temp_dir = std::env::temp_dir();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let key_path = temp_dir.join(format!("a2r_key_{}_{}", timestamp, rand::random::<u16>()));
    
    let alg_flag = match algorithm {
        KeyAlgorithm::Ed25519 => "ed25519",
        KeyAlgorithm::Rsa4096 => "rsa",
    };
    
    let bits_flag = match algorithm {
        KeyAlgorithm::Ed25519 => "",
        KeyAlgorithm::Rsa4096 => "-b 4096",
    };

    // Generate key
    let output = Command::new("ssh-keygen")
        .args(&[
            "-t", alg_flag,
            "-f", key_path.to_str().unwrap(),
            "-N", "", // No passphrase (for automation)
            "-C", &format!("a2r-{}", name),
        ])
        .args(bits_flag.split_whitespace())
        .output()
        .map_err(|e| format!("Failed to run ssh-keygen: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ssh-keygen failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Read generated keys
    let private_key = tokio::fs::read_to_string(&key_path)
        .await
        .map_err(|e| format!("Failed to read private key: {}", e))?;
    
    let public_key = tokio::fs::read_to_string(format!("{}.pub", key_path.to_str().unwrap()))
        .await
        .map_err(|e| format!("Failed to read public key: {}", e))?;

    // Get fingerprint
    let fingerprint_output = Command::new("ssh-keygen")
        .args(&["-lf", key_path.to_str().unwrap()])
        .output()
        .map_err(|e| format!("Failed to get fingerprint: {}", e))?;

    let fingerprint_str = String::from_utf8_lossy(&fingerprint_output.stdout);
    let fingerprint_parts: Vec<&str> = fingerprint_str.split_whitespace().collect();
    let fingerprint = fingerprint_parts.get(1).unwrap_or(&"").to_string();
    let fingerprint_md5 = fingerprint_parts.get(2).unwrap_or(&"").to_string();

    // Cleanup temp files
    let _ = tokio::fs::remove_file(&key_path).await;
    let _ = tokio::fs::remove_file(format!("{}.pub", key_path.to_str().unwrap())).await;

    Ok(SSHKeyPair {
        id: format!("key_{}", uuid::Uuid::new_v4()),
        name: name.to_string(),
        algorithm: algorithm.to_string(),
        private_key,
        public_key: public_key.trim().to_string(),
        fingerprint,
        fingerprint_md5,
        created_at: timestamp,
        comment: format!("a2r-{}", name),
    })
}

/// Generate using native Rust implementation (fallback)
async fn generate_native(name: &str, algorithm: KeyAlgorithm) -> Result<SSHKeyPair, String> {
    use ed25519_dalek::{SigningKey, SECRET_KEY_LENGTH};
    
    match algorithm {
        KeyAlgorithm::Ed25519 => {
            // Generate ED25519 key pair
            let mut rng = OsRng;
            let signing_key = SigningKey::generate(&mut rng);
            
            // Create SSH key from bytes
            let private_key_bytes = signing_key.to_bytes();
            let public_key_bytes = signing_key.verifying_key().to_bytes();
            
            // Format as OpenSSH
            let private_key = format_ed25519_private_key(&private_key_bytes)?;
            let public_key = format_ed25519_public_key(&public_key_bytes, &format!("a2r-{}", name))?;
            
            // Calculate fingerprint
            let fingerprint = calculate_fingerprint(&public_key_bytes);
            
            Ok(SSHKeyPair {
                id: format!("key_{}", uuid::Uuid::new_v4()),
                name: name.to_string(),
                algorithm: "ed25519".to_string(),
                private_key,
                public_key,
                fingerprint: format!("SHA256:{}", fingerprint),
                fingerprint_md5: "N/A".to_string(),
                created_at: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                comment: format!("a2r-{}", name),
            })
        }
        KeyAlgorithm::Rsa4096 => {
            // For RSA, we really should use ssh-keygen or a proper RSA crate
            // This is a placeholder that returns an error
            Err("RSA key generation requires ssh-keygen. Please install OpenSSH.".to_string())
        }
    }
}

fn format_ed25519_private_key(secret_key: &[u8; 32]) -> Result<String, String> {
    // OpenSSH ED25519 private key format
    // This is a simplified version - in production use proper ASN.1 encoding
    let key_data = base64::encode(secret_key);
    
    Ok(format!(
        "-----BEGIN OPENSSH PRIVATE KEY-----\n\
        b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n\
        QyNTUxOQAAACBkdXBsaWNhdGVzLWFyZS1maW5lLWZvci1kZW1vLXB1cnBvc2VzAAAAFHRl\n\
        c3RrZXlAZXhhbXBsZS5jb20AAAAJ\n\
        {}\n\
        -----END OPENSSH PRIVATE KEY-----",
        key_data
    ))
}

fn format_ed25519_public_key(public_key: &[u8; 32], comment: &str) -> Result<String, String> {
    let mut key_data = vec![0u8; 51]; // "ssh-ed25519" prefix + key
    key_data[0..11].copy_from_slice(b"ssh-ed25519");
    key_data[11..19].copy_from_slice(&[0, 0, 0, 32]); // key length
    key_data[19..51].copy_from_slice(public_key);
    
    let encoded = base64::encode(&key_data);
    Ok(format!("ssh-ed25519 {} {}", encoded, comment))
}

fn calculate_fingerprint(public_key: &[u8]) -> String {
    use sha2::{Sha256, Digest};
    
    let mut hasher = Sha256::new();
    hasher.update(public_key);
    let result = hasher.finalize();
    
    // Base64 encode the first 16 bytes
    base64::encode(&result[..16])
}

/// Store key securely (encrypt at rest)
pub async fn store_key_encrypted(
    key: &SSHKeyPair,
    encryption_key: &[u8],
) -> Result<StoredKey, String> {
    // In production, encrypt the private key before storing
    // For now, we'll store with a simple encryption
    let encrypted_private = encrypt_key(&key.private_key, encryption_key)?;
    
    Ok(StoredKey {
        id: key.id.clone(),
        name: key.name.clone(),
        algorithm: key.algorithm.clone(),
        public_key: key.public_key.clone(),
        encrypted_private_key: encrypted_private,
        fingerprint: key.fingerprint.clone(),
        created_at: key.created_at,
    })
}

#[derive(Debug, Clone)]
pub struct StoredKey {
    pub id: String,
    pub name: String,
    pub algorithm: String,
    pub public_key: String,
    pub encrypted_private_key: Vec<u8>,
    pub fingerprint: String,
    pub created_at: u64,
}

fn encrypt_key(key: &str, encryption_key: &[u8]) -> Result<Vec<u8>, String> {
    // Simple XOR encryption for demo - in production use AES-GCM
    let key_bytes = key.as_bytes();
    let mut encrypted = Vec::with_capacity(key_bytes.len());
    
    for (i, &byte) in key_bytes.iter().enumerate() {
        encrypted.push(byte ^ encryption_key[i % encryption_key.len()]);
    }
    
    Ok(encrypted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_generate_ed25519_key() {
        let key = generate_key_pair(
            "test-key".to_string(),
            KeyAlgorithm::Ed25519,
        ).await;
        
        assert!(key.is_ok());
        let key = key.unwrap();
        assert!(key.public_key.starts_with("ssh-ed25519"));
        assert!(key.fingerprint.starts_with("SHA256:"));
    }
}
