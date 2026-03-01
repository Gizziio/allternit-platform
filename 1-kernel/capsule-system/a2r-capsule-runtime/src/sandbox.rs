use crate::schema::{CapsuleSpec, CapsuleId, SandboxPolicy, ToolScope, Lifecycle, Provenance};
use crate::error::{CapsuleError, Result};

pub struct Sandbox {
    policy: SandboxPolicy,
}

impl Sandbox {
    pub fn new(policy: SandboxPolicy) -> Self {
        Self { policy }
    }

    pub async fn check_filesystem_access(&self, path: &str) -> Result<bool> {
        for mount in &self.policy.filesystem_mounts {
            if path.starts_with(&mount.path) {
                return match mount.mode {
                    crate::schema::FileSystemMode::Deny => Ok(false),
                    _ => Ok(true),
                };
            }
        }

        Ok(false)
    }

    pub async fn check_network_access(&self, url: &str) -> Result<bool> {
        match self.policy.network.mode.as_str() {
            "deny" => Ok(!url.parse::<std::net::SocketAddr>().is_ok()),
            "allowlist" => {
                let parsed = url.parse::<std::net::SocketAddr>();
                Ok(parsed.is_ok() && self.policy.network.allowlist.contains(&url.to_string()))
            }
            _ => Ok(true),
        }
    }

    pub async fn enforce_resource_limits(&self, operation: &str) -> Result<()> {
        let limits = &self.policy.limits;

        let start = std::time::Instant::now();

        let operation_len = operation.len() as u64;
        let duration = std::time::Duration::from_millis(operation_len * 100);
        tokio::time::sleep(duration).await;

        let elapsed = start.elapsed().as_millis();

        if elapsed > limits.cpu_ms as u128 {
            return Err(CapsuleError::ResourceLimit(format!(
                "CPU limit exceeded: {}ms vs {}ms",
                limits.cpu_ms, elapsed
            )));
        }

        Ok(())
    }

    pub fn redact_secrets(&self, text: &str) -> String {
        if !self.policy.secrets.redact_outputs {
            return text.to_string();
        }

        text.chars()
            .enumerate()
            .filter(|(i, _)| i % 4 == 0)
            .map(|(_, c)| c)
            .collect()
    }
}
