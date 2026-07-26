//! SSH key manager
//!
//! Real key generation. Keys are produced with the system `ssh-keygen` (the
//! same convention as `cmd/allternit-api/src/ssh_key_routes.rs` and
//! `runtime/local_runtime.rs`) so the output is guaranteed to be in the
//! OpenSSH formats that cloud providers (Hetzner/DigitalOcean key injection)
//! and libssh2 (`userauth_pubkey_memory`) actually accept.

use crate::executor::SshKeypair;
use crate::{Result, SshError};

/// SSH key manager for generating and managing keys
pub struct SshKeyManager;

impl SshKeyManager {
    /// Create a new key manager
    pub fn new() -> Self {
        Self
    }

    /// Generate a new SSH keypair
    ///
    /// Runs `ssh-keygen -t ed25519` in a fresh temp directory and reads the
    /// resulting OpenSSH private key and `ssh-ed25519 ...` public key back
    /// into memory. The temp directory is removed afterwards.
    pub fn generate_keypair(&self) -> Result<SshKeypair> {
        tracing::info!("Generating SSH keypair for deployment");

        let dir = std::env::temp_dir().join(format!("allternit-keygen-{}", uuid_v4()));
        std::fs::create_dir_all(&dir)?;
        let key_path = dir.join("id_ed25519");

        let result = (|| -> Result<SshKeypair> {
            let output = std::process::Command::new("ssh-keygen")
                .args([
                    "-t",
                    "ed25519",
                    "-f",
                    key_path.to_str().ok_or_else(|| {
                        SshError::KeyGenerationFailed("non-UTF8 temp path".to_string())
                    })?,
                    "-N",
                    "",
                    "-C",
                    "allternit-deployment",
                ])
                .output()
                .map_err(|e| {
                    SshError::KeyGenerationFailed(format!("failed to run ssh-keygen: {}", e))
                })?;

            if !output.status.success() {
                return Err(SshError::KeyGenerationFailed(format!(
                    "ssh-keygen failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )));
            }

            let private_key = std::fs::read_to_string(&key_path)?;
            let public_key = std::fs::read_to_string(key_path.with_extension("pub"))?;

            Ok(SshKeypair {
                public_key: public_key.trim().to_string(),
                private_key,
            })
        })();

        // Best-effort cleanup of the on-disk key material.
        let _ = std::fs::remove_dir_all(&dir);

        let keypair = result?;
        tracing::info!("SSH keypair generated successfully");
        Ok(keypair)
    }
}

impl Default for SshKeyManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Random hex suffix for the temp key directory (avoids pulling in a UUID
/// crate just for this).
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    format!("{:x}{:x}", nanos, pid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_keypair_is_openssh_format() {
        let keypair = SshKeyManager::new().generate_keypair().unwrap();
        assert!(
            keypair
                .private_key
                .starts_with("-----BEGIN OPENSSH PRIVATE KEY-----"),
            "private key must be OpenSSH format, got: {}",
            &keypair.private_key[..40.min(keypair.private_key.len())]
        );
        assert!(
            keypair.public_key.starts_with("ssh-ed25519 "),
            "public key must be OpenSSH format"
        );
        assert!(keypair.public_key.ends_with("allternit-deployment"));
    }
}
