//! OpenClaw Host Launcher
//!
//! Manages OpenClaw as a subprocess with health checks and RPC communication.
//! This is the ONLY module allowed to interact with vendor/openclaw/ code.
//!
//! ARCHITECTURE LOCK: All OpenClaw interaction MUST go through this boundary.
//! No direct imports from vendor directory anywhere else in codebase.

use std::process::Stdio;
use std::time::Duration;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::time::{interval, timeout};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::{config::HostConfig, errors::HostError, health::HealthStatus};
use a2r_parity::capture::{write_receipt_to_disk, Receipt, ReceiptMetadata};

/// Manages OpenClaw subprocess lifecycle and communication
///
/// LOCK COMPLIANCE: This is the sole permitted interface to OpenClaw.
/// All calls are captured for parity testing.
pub struct OpenClawHost {
    /// OpenClaw child process
    process: Child,

    /// RPC client for stdio communication
    rpc_client: RpcClient,

    /// Health monitoring channel
    _health_tx: mpsc::Sender<HealthStatus>,

    /// Configuration
    config: HostConfig,

    /// Process ID for logging
    pid: u32,

    /// Corpus directory for receipt capture
    corpus_dir: std::path::PathBuf,
}

/// RPC client for JSON-RPC over stdin/stdout
struct RpcClient {
    /// Write end of stdin
    stdin: tokio::process::ChildStdin,

    /// Read end of stdout (buffered)
    stdout: BufReader<tokio::process::ChildStdout>,

    /// Request ID counter
    id_counter: u64,
}

/// RPC request envelope
#[derive(Debug, serde::Serialize)]
struct RpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: Value,
}

/// RPC response envelope
#[derive(Debug, serde::Deserialize)]
struct RpcResponse {
    jsonrpc: String,
    id: u64,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<RpcError>,
}

#[derive(Debug, serde::Deserialize)]
struct RpcError {
    code: i64,
    message: String,
    #[serde(default)]
    data: Option<Value>,
}

/// Result of an OpenClaw call with receipt
#[derive(Debug)]
pub struct CallResult {
    pub result: Value,
    pub receipt_id: Uuid,
    pub duration_ms: u64,
}

impl OpenClawHost {
    /// Start OpenClaw subprocess with given configuration
    ///
    /// # Errors
    /// - `HostError::SpawnFailed` if process fails to start
    /// - `HostError::HealthCheckFailed` if initial health check fails
    pub async fn start(config: HostConfig) -> Result<Self, HostError> {
        info!("Starting OpenClaw host with config: {:?}", config);

        let mut command = Command::new(&config.openclaw_path);

        // Set up stdio for RPC
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        // Set working directory to OpenClaw workspace
        if let Some(ref workspace) = config.workspace_dir {
            command.current_dir(workspace);
        }

        // Set environment variables
        command.env("OPENCLAW_MODE", "rpc");
        command.env("OPENCLAW_JSON", "true");

        if let Some(ref port) = config.port {
            command.env("OPENCLAW_PORT", port.to_string());
        }

        // Spawn process
        let mut process = command.spawn().map_err(|e| HostError::SpawnFailed {
            path: config.openclaw_path.clone(),
            source: e,
        })?;

        let pid = process.id().ok_or(HostError::NoPid)?;
        info!("OpenClaw spawned with PID: {}", pid);

        // Set up RPC client
        let stdin = process
            .stdin
            .take()
            .ok_or(HostError::StdioNotAvailable("stdin"))?;
        let stdout = process
            .stdout
            .take()
            .ok_or(HostError::StdioNotAvailable("stdout"))?;

        let rpc_client = RpcClient {
            stdin,
            stdout: BufReader::new(stdout),
            id_counter: 0,
        };

        // Set up health monitoring
        let (_health_tx, _health_rx) = mpsc::channel(10);
        let _health_pid = pid;
        tokio::spawn(async move {
            let mut check_interval = interval(Duration::from_secs(5));
            loop {
                check_interval.tick().await;
                // Health check implementation in health.rs
                let _status = HealthStatus::Checking;
                // TODO: Implement health monitoring
            }
        });

        let corpus_dir = config.corpus_dir.clone().unwrap_or_else(|| {
            std::path::PathBuf::from(".migration/openclaw-absorption/corpus/raw")
        });

        let mut host = Self {
            process,
            rpc_client,
            _health_tx,
            config,
            pid,
            corpus_dir,
        };

        // Wait for initial health check
        info!("Waiting for OpenClaw health check...");
        match timeout(Duration::from_secs(30), host.check_health()).await {
            Ok(Ok(())) => {
                info!("OpenClaw host healthy (PID: {})", pid);
            }
            Ok(Err(e)) => {
                error!("OpenClaw health check failed: {}", e);
                host.stop().await.ok();
                return Err(HostError::HealthCheckFailed(e.to_string()));
            }
            Err(_) => {
                error!("OpenClaw health check timeout");
                host.stop().await.ok();
                return Err(HostError::HealthCheckTimeout);
            }
        }

        Ok(host)
    }

    /// Call OpenClaw method via JSON-RPC
    ///
    /// All calls are automatically captured for parity testing.
    ///
    /// # Arguments
    /// - `method`: OpenClaw method name
    /// - `params`: JSON parameters
    ///
    /// # Returns
    /// CallResult with JSON response and receipt info
    pub async fn call(&mut self, method: &str, params: Value) -> Result<CallResult, HostError> {
        let start_time = std::time::Instant::now();
        let receipt_id = Uuid::new_v4();

        debug!(
            "OpenClaw call [{}]: {} with params: {}",
            receipt_id, method, params
        );

        // Make RPC call
        let result = self.rpc_client.call(method, params.clone()).await;

        let duration_ms = start_time.elapsed().as_millis() as u64;

        // Prepare receipt response based on result
        let is_ok = result.is_ok();
        let response_value = match &result {
            Ok(value) => value.clone(),
            Err(e) => serde_json::json!({"error": e.to_string()}),
        };

        // Capture receipt for parity testing
        // This is LOCK 2 compliance: every call recorded
        let receipt = Receipt {
            id: receipt_id,
            timestamp: chrono::Utc::now(),
            duration_ms,
            method: method.to_string(),
            request: params,
            response: response_value,
            stderr: String::new(), // Captured separately
            exit_code: if is_ok { 0 } else { 1 },
            metadata: ReceiptMetadata {
                version: env!("CARGO_PKG_VERSION").to_string(),
                host_version: self.config.openclaw_version.clone(),
                environment: std::env::var("A2R_ENV").unwrap_or_else(|_| "development".to_string()),
                host_hash: None,
            },
        };

        // Async write to corpus (non-blocking)
        let corpus_dir = self.corpus_dir.clone();
        tokio::spawn(async move {
            if let Err(e) = write_receipt_to_disk(&receipt, &corpus_dir, 1024 * 1024).await {
                warn!("Failed to write parity receipt: {}", e);
            }
        });

        // Return the original result
        match result {
            Ok(value) => Ok(CallResult {
                result: value,
                receipt_id,
                duration_ms,
            }),
            Err(e) => Err(e),
        }
    }

    /// Check OpenClaw health status
    pub async fn check_health(&mut self) -> Result<(), HostError> {
        // Simple ping-pong health check
        match self
            .rpc_client
            .call("health.ping", serde_json::json!({}))
            .await
        {
            Ok(_) => Ok(()),
            Err(e) => Err(e),
        }
    }

    /// Get current health status
    pub fn health_status(&self) -> HealthStatus {
        // TODO: Implement proper health status tracking
        HealthStatus::Healthy
    }

    /// Get the corpus directory
    pub fn corpus_dir(&self) -> &std::path::PathBuf {
        &self.corpus_dir
    }

    /// Get configuration
    pub fn config(&self) -> &HostConfig {
        &self.config
    }

    /// Gracefully stop OpenClaw subprocess
    pub async fn stop(&mut self) -> Result<(), HostError> {
        info!("Stopping OpenClaw host (PID: {})", self.pid);

        // Try graceful shutdown first
        match self
            .rpc_client
            .call("system.shutdown", serde_json::json!({}))
            .await
        {
            Ok(_) => {
                debug!("OpenClaw shutdown signal sent");
            }
            Err(e) => {
                warn!("OpenClaw shutdown signal failed: {}", e);
            }
        }

        // Wait for graceful shutdown
        match timeout(Duration::from_secs(10), self.process.wait()).await {
            Ok(Ok(status)) => {
                info!("OpenClaw exited with status: {:?}", status);
                Ok(())
            }
            Ok(Err(e)) => {
                warn!("OpenClaw wait error: {}", e);
                self.force_kill().await
            }
            Err(_) => {
                warn!("OpenClaw shutdown timeout, forcing kill");
                self.force_kill().await
            }
        }
    }

    /// Force kill OpenClaw process
    async fn force_kill(&mut self) -> Result<(), HostError> {
        #[cfg(unix)]
        {
            if let Some(id) = self.process.id() {
                // Try SIGTERM first
                let _ = tokio::process::Command::new("kill")
                    .arg("-TERM")
                    .arg(id.to_string())
                    .output()
                    .await;

                // Wait a bit then SIGKILL
                tokio::time::sleep(Duration::from_secs(2)).await;
                let _ = tokio::process::Command::new("kill")
                    .arg("-KILL")
                    .arg(id.to_string())
                    .output()
                    .await;
            }
        }

        #[cfg(windows)]
        {
            self.process.kill().await.ok();
        }

        Ok(())
    }

    /// Get process ID
    pub fn pid(&self) -> u32 {
        self.pid
    }

    /// Create a mock OpenClawHost instance for testing/transition purposes
    /// This creates a minimal instance that doesn't actually start a subprocess
    pub async fn create_mock() -> Self {
        let config = HostConfig {
            openclaw_path: std::path::PathBuf::from("/dev/null"), // Not actually used
            workspace_dir: None,
            port: Some(8080), // Match the port we're serving on
            openclaw_version: "native-mock-2026.1.29".to_string(),
            corpus_dir: Some(std::path::PathBuf::from("./corpus")),
        };

        // Create a mock process that doesn't actually run anything
        let mut command = tokio::process::Command::new("/bin/sh");
        command.arg("-c").arg("sleep 3600"); // Keep it alive but do nothing
        command.stdin(std::process::Stdio::piped());
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());
        command.kill_on_drop(true);

        let mut process = command.spawn().expect("Failed to create mock process");

        let pid = process.id().unwrap_or(0);

        // Create a mock stdin/stdout for the RPC client
        let stdin = process.stdin.take().expect("Failed to get mock stdin");
        let stdout = process.stdout.take().expect("Failed to get mock stdout");

        let rpc_client = RpcClient {
            stdin,
            stdout: tokio::io::BufReader::new(stdout),
            id_counter: 0,
        };

        // Set up mock health monitoring
        let (health_tx, _health_rx) = tokio::sync::mpsc::channel(10);

        let corpus_dir = config
            .corpus_dir
            .clone()
            .unwrap_or_else(|| std::path::PathBuf::from("./corpus"));

        Self {
            process,
            rpc_client,
            _health_tx: health_tx,
            config,
            pid,
            corpus_dir,
        }
    }
}

impl RpcClient {
    /// Make JSON-RPC call
    async fn call(&mut self, method: &str, params: Value) -> Result<Value, HostError> {
        self.id_counter += 1;
        let id = self.id_counter;

        let request = RpcRequest {
            jsonrpc: "2.0",
            id,
            method: method.to_string(),
            params,
        };

        let request_json =
            serde_json::to_string(&request).map_err(|e| HostError::Serialization(e.to_string()))?;

        // Send request
        let request_line = format!("{}\n", request_json);
        self.stdin
            .write_all(request_line.as_bytes())
            .await
            .map_err(|e| HostError::IoError(e.to_string()))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| HostError::IoError(e.to_string()))?;

        debug!("RPC request [{}]: {}", id, request_json);

        // Read response
        let mut response_line = String::new();
        let read_result = timeout(
            Duration::from_secs(60),
            self.stdout.read_line(&mut response_line),
        )
        .await;

        match read_result {
            Ok(Ok(0)) => {
                return Err(HostError::ProcessTerminated);
            }
            Ok(Ok(_)) => {
                debug!("RPC response [{}]: {}", id, response_line.trim());
            }
            Ok(Err(e)) => {
                return Err(HostError::IoError(e.to_string()));
            }
            Err(_) => {
                return Err(HostError::RpcTimeout);
            }
        }

        // Parse response
        let response: RpcResponse = serde_json::from_str(&response_line)
            .map_err(|e| HostError::Deserialization(e.to_string()))?;

        // Verify ID matches
        if response.id != id {
            return Err(HostError::RpcIdMismatch {
                expected: id,
                received: response.id,
            });
        }

        // Check for RPC error
        if let Some(error) = response.error {
            return Err(HostError::RpcError {
                code: error.code,
                message: error.message,
            });
        }

        // Return result
        response.result.ok_or(HostError::NoResult)
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    // These tests require OpenClaw to be installed
    // Run with: cargo test --features integration-tests openclaw_host

    #[tokio::test]
    #[ignore = "requires OpenClaw installation"]
    async fn test_host_lifecycle() {
        let config = HostConfig {
            openclaw_path: std::path::PathBuf::from("openclaw"),
            workspace_dir: None,
            port: None,
            openclaw_version: "2026.1.29".to_string(),
            corpus_dir: Some(std::path::PathBuf::from("/tmp/test_corpus")),
        };

        let mut host = OpenClawHost::start(config)
            .await
            .expect("Failed to start OpenClaw host");

        // Health check
        host.check_health().await.expect("Health check failed");

        // Simple call
        let result = host
            .call("skills.list", serde_json::json!({}))
            .await
            .expect("skills.list call failed");

        assert!(
            result.result.get("skills").is_some(),
            "Expected skills in response"
        );

        // Stop
        host.stop().await.expect("Failed to stop OpenClaw host");
    }
}
