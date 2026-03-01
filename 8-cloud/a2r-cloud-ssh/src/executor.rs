//! SSH executor for deployment operations
//!
//! Real SSH implementation for A2R installation.

use crate::{Result, SshConnection, CommandOutput, SshKeyManager};

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

    /// Execute installation script on remote VPS
    pub async fn install_a2r_runtime(
        &self,
        host: &str,
        port: u16,
        username: &str,
        private_key: &str,
        control_plane_url: &str,
        deployment_token: &str,
    ) -> Result<CommandOutput> {
        tracing::info!("Installing A2R runtime on {}:{}", host, port);

        // Connect to VPS
        let conn = SshConnection::connect(host, port, username, private_key).await?;

        // Download and execute installation script
        let install_command = format!(
            r#"
export A2R_VERSION="latest"
export CONTROL_PLANE_URL="{}"
export DEPLOYMENT_TOKEN="{}"

curl -L "https://releases.a2r.sh/${{A2R_VERSION}}/install-a2r-runtime.sh" | bash
            "#,
            control_plane_url,
            deployment_token
        );

        let output = conn.execute(&install_command).await?;

        // Verify installation
        let verify_output = conn.execute("systemctl is-active a2r-agent").await?;
        
        if verify_output.exit_code != 0 {
            return Err(crate::SshError::CommandFailed(
                format!("A2R agent failed to start: {}", verify_output.stderr)
            ));
        }

        tracing::info!("A2R runtime installed successfully on {}:{}", host, port);

        Ok(output)
    }

    /// Test SSH connection
    pub async fn test_connection(
        &self,
        host: &str,
        port: u16,
        username: &str,
        private_key: &str,
    ) -> Result<bool> {
        tracing::info!("Testing SSH connection to {}:{}", host, port);

        let conn = SshConnection::connect(host, port, username, private_key).await?;

        // Run simple test command
        let output = conn.execute("echo 'SSH connection test successful'").await?;

        let success = output.exit_code == 0 && output.stdout.contains("SSH connection test successful");

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

/// SSH keypair
#[derive(Debug, Clone)]
pub struct SshKeypair {
    pub public_key: String,
    pub private_key: String,
}
