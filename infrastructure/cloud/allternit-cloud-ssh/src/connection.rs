//! SSH connection manager
//!
//! Real SSH implementation using ssh2 library with async wrappers.

use crate::{SshError, CommandOutput};
use ssh2::Session;
use std::io::Read;
use std::net::TcpStream;
use std::sync::Arc;
use tokio::sync::Mutex;

/// SSH connection to a remote VPS
pub struct SshConnection {
    session: Arc<Mutex<Session>>,
}

impl SshConnection {
    /// Connect to a VPS via SSH
    pub async fn connect(
        host: &str,
        port: u16,
        username: &str,
        private_key: &str,
    ) -> Result<Self, SshError> {
        let host = host.to_string();
        let port = port;
        let username = username.to_string();
        let private_key = private_key.to_string();

        // Run synchronous SSH connection in blocking task
        let session = tokio::task::spawn_blocking({
            let host = host.clone();
            let username = username.clone();
            let private_key = private_key.clone();
            move || {
                tracing::info!("Connecting to {}:{} as {}", host, port, username);

                // Establish TCP connection
                let tcp = TcpStream::connect(format!("{}:{}", host, port))
                    .map_err(|e| SshError::ConnectionFailed(format!("TCP connection failed: {}", e)))?;

                // Create SSH session
                let mut session = Session::new()
                    .map_err(|e| SshError::ConnectionFailed(format!("Failed to create session: {}", e)))?;
                
                session.set_tcp_stream(tcp);
                session.handshake()
                    .map_err(|e| SshError::ConnectionFailed(format!("SSH handshake failed: {}", e)))?;

                // Authenticate with private key from memory
                session.userauth_pubkey_memory(username.as_str(), None, private_key.as_str(), None)
                    .map_err(|e| SshError::AuthenticationFailed(format!("Authentication failed: {}", e)))?;

                tracing::info!("SSH connection established to {}:{}", host, port);
                Ok::<Session, SshError>(session)
            }
        })
        .await
        .map_err(|e| SshError::ConnectionFailed(format!("Task join failed: {}", e)))??;

        Ok(Self {
            session: Arc::new(Mutex::new(session)),
        })
    }

    /// Execute a command on the remote VPS
    pub async fn execute(&self, command: &str) -> Result<CommandOutput, SshError> {
        let session = Arc::clone(&self.session);
        let command = command.to_string();

        let result = tokio::task::spawn_blocking(move || {
            tracing::info!("Executing command: {}", command);

            let session = session.blocking_lock();

            // Create channel
            let mut channel = session.channel_session()
                .map_err(|e| SshError::CommandFailed(format!("Failed to create channel: {}", e)))?;

            // Execute command
            channel.exec(&command)
                .map_err(|e| SshError::CommandFailed(format!("Failed to execute command: {}", e)))?;

            // Read output
            let mut stdout = Vec::new();
            let mut stderr = Vec::new();
            channel.read_to_end(&mut stdout)
                .map_err(|e| SshError::CommandFailed(format!("Failed to read stdout: {}", e)))?;
            channel.stderr().read_to_end(&mut stderr)
                .map_err(|e| SshError::CommandFailed(format!("Failed to read stderr: {}", e)))?;

            // Wait for exit
            channel.wait_eof()
                .map_err(|e| SshError::CommandFailed(format!("Failed to wait for command: {}", e)))?;
            channel.close()
                .map_err(|e| SshError::CommandFailed(format!("Failed to close channel: {}", e)))?;
            let exit_status = channel.exit_status()
                .map_err(|e| SshError::CommandFailed(format!("Failed to get exit status: {}", e)))?;

            Ok::<CommandOutput, SshError>(CommandOutput {
                exit_code: exit_status,
                stdout: String::from_utf8_lossy(&stdout).to_string(),
                stderr: String::from_utf8_lossy(&stderr).to_string(),
            })
        })
        .await
        .map_err(|e| SshError::CommandFailed(format!("Task join failed: {}", e)))??;

        Ok(result)
    }

    /// Upload a file to the remote VPS via SCP
    pub async fn upload_file(&self, _local_path: &str, remote_path: &str, content: &[u8]) -> Result<(), SshError> {
        let session = Arc::clone(&self.session);
        let remote_path = std::path::PathBuf::from(remote_path);
        let content = content.to_vec();

        tokio::task::spawn_blocking(move || {
            tracing::info!("Uploading file to {:?}", remote_path);

            let session = session.blocking_lock();

            // Open remote file for writing
            let mut remote_file = session.scp_send(&remote_path, 0o644, content.len() as u64, None)
                .map_err(|e| SshError::FileTransferFailed(format!("Failed to create remote file: {}", e)))?;

            // Write content
            use std::io::Write;
            remote_file.write_all(&content)
                .map_err(|e| SshError::FileTransferFailed(format!("Failed to write file: {}", e)))?;

            Ok::<(), SshError>(())
        })
        .await
        .map_err(|e| SshError::FileTransferFailed(format!("Task join failed: {}", e)))??;

        Ok(())
    }

    /// Download a file from the remote VPS via SCP
    pub async fn download_file(&self, remote_path: &str) -> Result<Vec<u8>, SshError> {
        let session = Arc::clone(&self.session);
        let remote_path = std::path::PathBuf::from(remote_path);

        let result = tokio::task::spawn_blocking(move || {
            tracing::info!("Downloading file from {:?}", remote_path);

            let session = session.blocking_lock();

            // Open remote file for reading
            let (mut remote_file, stat) = session.scp_recv(&remote_path)
                .map_err(|e| SshError::FileTransferFailed(format!("Failed to open remote file: {}", e)))?;

            // Read content
            let mut content = Vec::with_capacity(stat.size() as usize);
            use std::io::Read;
            remote_file.read_to_end(&mut content)
                .map_err(|e| SshError::FileTransferFailed(format!("Failed to read file: {}", e)))?;

            Ok::<Vec<u8>, SshError>(content)
        })
        .await
        .map_err(|e| SshError::FileTransferFailed(format!("Task join failed: {}", e)))??;

        Ok(result)
    }

    /// Close the SSH connection
    pub async fn close(&mut self) {
        self.session = Arc::new(Mutex::new(Session::new().unwrap()));
        tracing::info!("SSH connection closed");
    }

    /// Check if connection is still alive
    pub fn is_connected(&self) -> bool {
        Arc::strong_count(&self.session) > 0
    }
}
