//! Paired-runtime identity adoption. The daemon reuses the same
//! `runtime-identity.json` the desktop app and agent-daemon hold — no new
//! pairing flow, no new auth surface (spec: "Same pairing identity").

use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeIdentity {
    #[serde(rename = "runtimeId")]
    pub runtime_id: String,
    #[serde(rename = "deviceToken")]
    pub device_token: String,
    #[serde(rename = "userId", default)]
    pub user_id: String,
    #[serde(rename = "expiresAt", default)]
    pub expires_at: Option<String>,
}

impl RuntimeIdentity {
    /// Load and validate the identity file. A missing file is a hard error:
    /// the daemon never pairs on its own — pair with Allternit Desktop (or
    /// the agent-daemon) first, then install the daemon.
    pub fn load(path: &Path) -> anyhow::Result<Self> {
        let raw = std::fs::read_to_string(path).map_err(|error| {
            anyhow::anyhow!(
                "no runtime identity at {} ({error}). Pair this machine with \
                 Allternit Desktop first; the daemon adopts that identity.",
                path.display()
            )
        })?;
        let identity: RuntimeIdentity = serde_json::from_str(&raw)
            .map_err(|error| anyhow::anyhow!("identity file {} is invalid: {error}", path.display()))?;
        if identity.runtime_id.is_empty() || identity.device_token.is_empty() {
            anyhow::bail!("identity file {} is incomplete", path.display());
        }
        Ok(identity)
    }

    /// True when `other` carries the same credential (device token + expiry).
    /// The desktop app is the single writer of the identity file; when it
    /// rotates the token the daemon adopts the new file on the next reconnect,
    /// and anything unchanged is left alone.
    pub fn same_credential(&self, other: &RuntimeIdentity) -> bool {
        self.device_token == other.device_token && self.expires_at == other.expires_at
    }

    /// Seconds until the device credential expires, when the file records an
    /// expiry. `None` means unknown (treat as fresh).
    pub fn seconds_until_expiry(&self) -> Option<i64> {
        let expires_at = self.expires_at.as_deref()?;
        let expiry = chrono::DateTime::parse_from_rfc3339(expires_at).ok()?;
        Some((expiry.with_timezone(&chrono::Utc) - chrono::Utc::now()).num_seconds())
    }

    /// Persist a rotated device token back into the identity file (same
    /// shape the agent-daemon and desktop app write).
    pub fn save(&self, path: &Path) -> anyhow::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, serde_json::to_string_pretty(self)?)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_rejects_missing_and_incomplete_identity() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("runtime-identity.json");
        assert!(RuntimeIdentity::load(&path).is_err());
        std::fs::write(&path, r#"{"runtimeId":"","deviceToken":"tok"}"#).unwrap();
        assert!(RuntimeIdentity::load(&path).is_err());
        std::fs::write(&path, r#"{"runtimeId":"rt_1","deviceToken":"tok","userId":"u"}"#).unwrap();
        let identity = RuntimeIdentity::load(&path).unwrap();
        assert_eq!(identity.runtime_id, "rt_1");
    }
}
