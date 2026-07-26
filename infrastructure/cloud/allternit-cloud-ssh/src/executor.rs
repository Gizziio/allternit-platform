//! SSH executor for deployment operations
//!
//! Real SSH implementation for gizzi-code bootstrap on user-supplied VPSes.

use crate::{CommandOutput, Result, SshConnection, SshError, SshKeyManager};

/// SSH executor for running deployment tasks
pub struct SshExecutor {
    key_manager: SshKeyManager,
}

impl SshExecutor {
    /// Create a new SSH executor
    pub fn new() -> Self {
        Self {
            key_manager: SshKeyManager::new(),
        }
    }

    /// Upload and execute a bootstrap script on a remote VPS.
    ///
    /// The script is transferred via SCP to a temp path and run with `bash`;
    /// the full command output (exit code, stdout, stderr) is returned so the
    /// caller can parse result markers (e.g. `MESH_IP=...`) out of stdout.
    pub async fn run_script(
        &self,
        host: &str,
        port: u16,
        username: &str,
        private_key: &str,
        script: &str,
    ) -> Result<CommandOutput> {
        tracing::info!("Running bootstrap script on {}:{}", host, port);

        let conn = SshConnection::connect(host, port, username, private_key).await?;

        let remote_path = format!("/tmp/allternit-bootstrap-{}.sh", std::process::id());
        conn.upload_file("bootstrap.sh", &remote_path, script.as_bytes())
            .await?;

        let output = conn
            .execute(&format!("bash {}", shell_quote(&remote_path)))
            .await?;

        // Best-effort cleanup of the uploaded script (it may contain no
        // secrets — those live in the env file — but keep the box tidy).
        let _ = conn
            .execute(&format!("rm -f {}", shell_quote(&remote_path)))
            .await;

        if output.exit_code != 0 {
            return Err(SshError::CommandFailed(format!(
                "bootstrap script exited {}: {}",
                output.exit_code,
                tail(&output.stderr, 500)
            )));
        }

        tracing::info!("Bootstrap script completed on {}:{}", host, port);
        Ok(output)
    }

    /// Test SSH connection with a trivial command (`uname -a`).
    ///
    /// Returns `Ok(true)` when the connection, authentication, and command
    /// execution all succeed.
    pub async fn test_connection(
        &self,
        host: &str,
        port: u16,
        username: &str,
        private_key: &str,
    ) -> Result<bool> {
        tracing::info!("Testing SSH connection to {}:{}", host, port);

        let conn = SshConnection::connect(host, port, username, private_key).await?;

        let output = conn.execute("uname -a").await?;

        let success = output.exit_code == 0 && !output.stdout.trim().is_empty();

        if success {
            tracing::info!("SSH connection test passed for {}:{}", host, port);
        } else {
            tracing::warn!("SSH connection test failed for {}:{}", host, port);
        }

        Ok(success)
    }

    /// Generate SSH keypair for deployment
    pub fn generate_keypair(&self) -> Result<crate::SshKeypair> {
        tracing::info!("Generating SSH keypair for deployment");
        let keypair = self.key_manager.generate_keypair()?;
        tracing::info!("SSH keypair generated successfully");
        Ok(keypair)
    }
}

impl Default for SshExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Minimal single-quote shell escaping for remote paths we generate.
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Last `n` chars of a string, for error messages.
fn tail(value: &str, n: usize) -> &str {
    if value.len() <= n {
        value
    } else {
        &value[value.len() - n..]
    }
}

/// SSH keypair
#[derive(Debug, Clone)]
pub struct SshKeypair {
    pub public_key: String,
    pub private_key: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_quote_escapes_single_quotes() {
        assert_eq!(shell_quote("/tmp/a b.sh"), "'/tmp/a b.sh'");
        assert_eq!(shell_quote("it's"), "'it'\\''s'");
    }

    #[test]
    fn tail_returns_last_n_chars() {
        assert_eq!(tail("hello", 500), "hello");
        assert_eq!(tail("abcdef", 3), "def");
    }
}
