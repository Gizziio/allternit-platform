//! # Guest Agent Health & Versioning Module
//!
//! Provides health monitoring and version negotiation for Firecracker guest agents.
//!
//! ## Features
//!
//! - **Startup Probes**: Wait for guest agent readiness with configurable timeout
//! - **Health Checking**: Periodic Ping/Pong health checks
//! - **Version Negotiation**: Semver-based compatibility checking
//! - **Failure Detection**: Track consecutive failures and trigger VM termination
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────┐     VSOCK      ┌─────────────────┐
//! │  GuestAgent     │ ◄─────────────► │  Guest Agent    │
//! │  Monitor        │   Ping/Pong    │  (inside VM)    │
//! │                 │   Version      │                 │
//! └────────┬────────┘   Negotiation  └─────────────────┘
//!          │
//!          ▼
//! ┌─────────────────┐
//! │  tokio::task    │  Background health monitoring
//! │  (spawn_monitor)│
//! └─────────────────┘
//! ```

use a2r_driver_interface::{DriverError, ExecutionId};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::UnixStream;
use tokio::sync::Mutex;
use tokio::time::{sleep, timeout};
use tracing::{debug, error, info, warn};

/// Driver's supported protocol version range
pub const DRIVER_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Maximum supported agent major version
pub const MAX_SUPPORTED_MAJOR: u64 = 1;
/// Minimum supported agent major version
pub const MIN_SUPPORTED_MAJOR: u64 = 1;

/// Default health check interval
pub const DEFAULT_HEALTH_CHECK_INTERVAL: Duration = Duration::from_secs(10);
/// Default maximum consecutive failures before marking unhealthy
pub const DEFAULT_MAX_FAILURES: u32 = 3;
/// Default startup probe timeout
pub const DEFAULT_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);

/// Agent health status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentHealth {
    /// Agent is healthy and responding
    Healthy,
    /// Agent is unhealthy (consecutive failures exceeded threshold)
    Unhealthy,
    /// Agent is starting up (not yet ready)
    Starting,
    /// Agent has stopped responding
    NotResponding,
}

impl std::fmt::Display for AgentHealth {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentHealth::Healthy => write!(f, "healthy"),
            AgentHealth::Unhealthy => write!(f, "unhealthy"),
            AgentHealth::Starting => write!(f, "starting"),
            AgentHealth::NotResponding => write!(f, "not_responding"),
        }
    }
}

/// Agent version information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentVersion {
    /// Full version string (e.g., "1.2.3")
    pub version: String,
    /// Major version for compatibility checking
    pub major: u64,
    /// Minor version
    pub minor: u64,
    /// Patch version
    pub patch: u64,
    /// Build metadata (optional)
    pub build: Option<String>,
}

impl AgentVersion {
    /// Parse version from string (expects semver format: major.minor.patch)
    pub fn parse(version_str: &str) -> Result<Self, DriverError> {
        // Remove build metadata if present
        let version_part = version_str.split('+').next().unwrap_or(version_str);

        let parts: Vec<&str> = version_part.split('.').collect();
        if parts.len() != 3 {
            return Err(DriverError::InvalidInput {
                field: "version".to_string(),
                reason: format!(
                    "Expected semver format (major.minor.patch), got: {}",
                    version_str
                ),
            });
        }

        let major = parts[0].parse().map_err(|_| DriverError::InvalidInput {
            field: "version.major".to_string(),
            reason: format!("Invalid major version: {}", parts[0]),
        })?;

        let minor = parts[1].parse().map_err(|_| DriverError::InvalidInput {
            field: "version.minor".to_string(),
            reason: format!("Invalid minor version: {}", parts[1]),
        })?;

        let patch = parts[2].parse().map_err(|_| DriverError::InvalidInput {
            field: "version.patch".to_string(),
            reason: format!("Invalid patch version: {}", parts[2]),
        })?;

        let build = version_str.split('+').nth(1).map(|s| s.to_string());

        Ok(Self {
            version: version_str.to_string(),
            major,
            minor,
            patch,
            build,
        })
    }

    /// Check if this version is compatible with the driver
    pub fn is_compatible(&self) -> bool {
        // Major version must match exactly for compatibility
        // This follows semver semantics where major version indicates breaking changes
        self.major >= MIN_SUPPORTED_MAJOR && self.major <= MAX_SUPPORTED_MAJOR
    }

    /// Get compatibility error message if incompatible
    pub fn compatibility_error(&self) -> Option<String> {
        if !self.is_compatible() {
            Some(format!(
                "Agent version {} (major={}) is incompatible with driver (supports major versions {}-{})",
                self.version, self.major, MIN_SUPPORTED_MAJOR, MAX_SUPPORTED_MAJOR
            ))
        } else {
            None
        }
    }
}

impl std::fmt::Display for AgentVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.version)
    }
}

/// Guest agent request types (extends the main protocol)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GuestAgentRequest {
    /// Execute a command in the guest
    #[serde(rename = "execute")]
    Execute {
        command: Vec<String>,
        env_vars: std::collections::HashMap<String, String>,
        working_dir: Option<String>,
        stdin_data: Option<Vec<u8>>,
    },
    /// Get logs from the guest
    #[serde(rename = "get_logs")]
    GetLogs {
        since: Option<chrono::DateTime<chrono::Utc>>,
    },
    /// Get artifacts from the guest
    #[serde(rename = "get_artifacts")]
    GetArtifacts { paths: Vec<String> },
    /// Get metrics from the guest
    #[serde(rename = "get_metrics")]
    GetMetrics,
    /// Ping for health check
    #[serde(rename = "ping")]
    Ping { version: String },
}

/// Guest agent response types (extends the main protocol)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GuestAgentResponse {
    /// Command execution result
    #[serde(rename = "execute_result")]
    ExecuteResult {
        exit_code: i32,
        stdout: Option<Vec<u8>>,
        stderr: Option<Vec<u8>>,
        duration_ms: u64,
    },
    /// Log entries
    #[serde(rename = "logs")]
    Logs { entries: Vec<LogEntry> },
    /// Artifacts
    #[serde(rename = "artifacts")]
    Artifacts { artifacts: Vec<Artifact> },
    /// Metrics
    #[serde(rename = "metrics")]
    Metrics {
        cpu_usage_percent: f64,
        memory_used_mib: u64,
        disk_used_mib: u64,
    },
    /// Error response
    #[serde(rename = "error")]
    Error { message: String },
    /// Pong response to ping
    #[serde(rename = "pong")]
    Pong { version: String, uptime_secs: u64 },
}

/// Log entry from guest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub stream: String,
    pub data: Vec<u8>,
}

/// Artifact information from guest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub path: String,
    pub size: u64,
    pub hash: String,
}

/// Shared state for health monitoring
#[derive(Debug)]
struct MonitorState {
    consecutive_failures: AtomicU32,
    current_health: Mutex<AgentHealth>,
    agent_version: Mutex<Option<AgentVersion>>,
    shutdown_signal: tokio::sync::watch::Sender<bool>,
}

impl MonitorState {
    fn new() -> (Self, tokio::sync::watch::Receiver<bool>) {
        let (tx, rx) = tokio::sync::watch::channel(false);
        (
            Self {
                consecutive_failures: AtomicU32::new(0),
                current_health: Mutex::new(AgentHealth::Starting),
                agent_version: Mutex::new(None),
                shutdown_signal: tx,
            },
            rx,
        )
    }

    fn record_success(&self) {
        self.consecutive_failures.store(0, Ordering::SeqCst);
    }

    fn record_failure(&self) -> u32 {
        self.consecutive_failures.fetch_add(1, Ordering::SeqCst) + 1
    }

    async fn set_health(&self, health: AgentHealth) {
        let mut current = self.current_health.lock().await;
        if *current != health {
            info!("Agent health changed: {} -> {}", current, health);
            *current = health;
        }
    }

    async fn get_health(&self) -> AgentHealth {
        *self.current_health.lock().await
    }

    async fn set_version(&self, version: AgentVersion) {
        *self.agent_version.lock().await = Some(version);
    }

    fn request_shutdown(&self) {
        let _ = self.shutdown_signal.send(true);
    }
}

/// Guest agent health monitor
///
/// Monitors the health of a guest agent running inside a Firecracker MicroVM
/// through VSOCK communication.
#[derive(Debug, Clone)]
pub struct GuestAgentMonitor {
    vm_id: ExecutionId,
    vsock_path: PathBuf,
    health_check_interval: Duration,
    max_failures: u32,
    state: Arc<MonitorState>,
}

impl GuestAgentMonitor {
    /// Create a new guest agent monitor
    ///
    /// # Arguments
    ///
    /// * `vm_id` - The execution ID of the VM being monitored
    /// * `vsock_path` - Path to the VSOCK Unix socket
    ///
    /// # Example
    ///
    /// ```rust
    /// use std::path::PathBuf;
    /// use a2r_driver_interface::ExecutionId;
    ///
    /// let vm_id = ExecutionId::new();
    /// let vsock_path = PathBuf::from("/tmp/vsock-test.sock");
    /// let monitor = GuestAgentMonitor::new(vm_id, vsock_path);
    /// ```
    pub fn new(vm_id: ExecutionId, vsock_path: PathBuf) -> Self {
        let (state, _) = MonitorState::new();

        Self {
            vm_id,
            vsock_path,
            health_check_interval: DEFAULT_HEALTH_CHECK_INTERVAL,
            max_failures: DEFAULT_MAX_FAILURES,
            state: Arc::new(state),
        }
    }

    /// Create with custom configuration
    pub fn with_config(
        vm_id: ExecutionId,
        vsock_path: PathBuf,
        health_check_interval: Duration,
        max_failures: u32,
    ) -> Self {
        let (state, _) = MonitorState::new();

        Self {
            vm_id,
            vsock_path,
            health_check_interval,
            max_failures,
            state: Arc::new(state),
        }
    }

    /// Get the current health status
    pub async fn current_health(&self) -> AgentHealth {
        self.state.get_health().await
    }

    /// Wait for the guest agent to be ready (startup probe)
    ///
    /// Polls the agent with Ping requests until it responds or timeout is reached.
    /// This should be called after VM start to ensure the agent is initialized.
    ///
    /// # Arguments
    ///
    /// * `timeout` - Maximum time to wait for agent readiness
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Agent is ready
    /// * `Err(DriverError)` - Timeout or connection error
    pub async fn wait_for_ready(&self, timeout_duration: Duration) -> Result<(), DriverError> {
        info!(
            vm_id = %self.vm_id,
            timeout_secs = timeout_duration.as_secs(),
            "Waiting for guest agent to be ready"
        );

        let start = std::time::Instant::now();
        let check_interval = Duration::from_millis(500);

        let result = timeout(timeout_duration, async {
            loop {
                match self.ping().await {
                    Ok(pong) => {
                        info!(
                            vm_id = %self.vm_id,
                            version = %pong.version,
                            uptime_secs = pong.uptime_secs,
                            elapsed_ms = start.elapsed().as_millis(),
                            "Guest agent is ready"
                        );
                        return Ok(());
                    }
                    Err(e) => {
                        debug!(
                            vm_id = %self.vm_id,
                            error = %e,
                            "Agent not ready yet, retrying..."
                        );
                        sleep(check_interval).await;
                    }
                }
            }
        })
        .await;

        match result {
            Ok(Ok(())) => Ok(()),
            Ok(Err(e)) => Err(e),
            Err(_) => Err(DriverError::SpawnFailed {
                reason: format!(
                    "Guest agent failed to become ready within {} seconds",
                    timeout_duration.as_secs()
                ),
            }),
        }
    }

    /// Perform a single health check (Ping/Pong)
    ///
    /// Sends a Ping request to the agent and waits for a Pong response.
    /// Also validates the agent version on successful response.
    ///
    /// # Returns
    ///
    /// * `Ok(AgentHealth)` - Current health status
    /// * `Err(DriverError)` - Communication error
    pub async fn health_check(&self) -> Result<AgentHealth, DriverError> {
        match self.ping().await {
            Ok(pong) => {
                // Parse and validate version
                match AgentVersion::parse(&pong.version) {
                    Ok(version) => {
                        if let Some(error) = version.compatibility_error() {
                            warn!(vm_id = %self.vm_id, "{}", error);
                            return Err(DriverError::InvalidInput {
                                field: "agent_version".to_string(),
                                reason: error,
                            });
                        }

                        // Store version info
                        self.state.set_version(version).await;

                        // Record success and update health
                        self.state.record_success();
                        self.state.set_health(AgentHealth::Healthy).await;

                        debug!(
                            vm_id = %self.vm_id,
                            version = %pong.version,
                            uptime_secs = pong.uptime_secs,
                            "Health check passed"
                        );

                        Ok(AgentHealth::Healthy)
                    }
                    Err(e) => {
                        warn!(
                            vm_id = %self.vm_id,
                            version = %pong.version,
                            "Failed to parse agent version: {}", e
                        );
                        // Still count as success if we got a pong
                        self.state.record_success();
                        Ok(AgentHealth::Healthy)
                    }
                }
            }
            Err(e) => {
                let failures = self.state.record_failure();

                if failures >= self.max_failures {
                    warn!(
                        vm_id = %self.vm_id,
                        consecutive_failures = failures,
                        "Agent marked unhealthy due to consecutive failures"
                    );
                    self.state.set_health(AgentHealth::Unhealthy).await;
                    Ok(AgentHealth::Unhealthy)
                } else {
                    debug!(
                        vm_id = %self.vm_id,
                        consecutive_failures = failures,
                        error = %e,
                        "Health check failed"
                    );
                    Ok(AgentHealth::NotResponding)
                }
            }
        }
    }

    /// Get the agent version
    ///
    /// Performs a ping and returns the parsed version information.
    /// This can be used during startup for version negotiation.
    ///
    /// # Returns
    ///
    /// * `Ok(AgentVersion)` - Parsed version info
    /// * `Err(DriverError)` - Communication or parsing error
    pub async fn get_version(&self) -> Result<AgentVersion, DriverError> {
        let pong = self.ping().await?;
        AgentVersion::parse(&pong.version)
    }

    /// Perform version negotiation
    ///
    /// Sends a ping with driver version and validates agent response.
    /// Fails if major version is incompatible.
    ///
    /// # Returns
    ///
    /// * `Ok(AgentVersion)` - Compatible agent version
    /// * `Err(DriverError)` - Version mismatch or communication error
    pub async fn negotiate_version(&self) -> Result<AgentVersion, DriverError> {
        info!(
            vm_id = %self.vm_id,
            driver_version = DRIVER_VERSION,
            "Starting version negotiation"
        );

        let agent_version = self.get_version().await?;

        if let Some(error) = agent_version.compatibility_error() {
            error!(
                vm_id = %self.vm_id,
                agent_version = %agent_version.version,
                "Version negotiation failed: {}", error
            );
            return Err(DriverError::InvalidInput {
                field: "agent_version".to_string(),
                reason: error,
            });
        }

        info!(
            vm_id = %self.vm_id,
            agent_version = %agent_version.version,
            "Version negotiation successful"
        );

        // Store version
        self.state.set_version(agent_version.clone()).await;

        Ok(agent_version)
    }

    /// Spawn a background monitoring task
    ///
    /// Starts a tokio task that periodically performs health checks.
    /// The task runs until the VM is destroyed or max failures is exceeded.
    ///
    /// # Returns
    ///
    /// A JoinHandle that can be used to await or abort the monitoring task.
    pub fn spawn_monitor(self) -> tokio::task::JoinHandle<()> {
        let vm_id = self.vm_id;
        let interval = self.health_check_interval;
        let max_failures = self.max_failures;
        let state = self.state.clone();
        let vsock_path = self.vsock_path.clone();

        info!(
            vm_id = %vm_id,
            interval_secs = interval.as_secs(),
            max_failures,
            "Starting background health monitor"
        );

        tokio::spawn(async move {
            let mut shutdown_rx = state.shutdown_signal.subscribe();

            loop {
                tokio::select! {
                    _ = sleep(interval) => {
                        match self.health_check().await {
                            Ok(AgentHealth::Unhealthy) => {
                                error!(
                                    vm_id = %vm_id,
                                    "Agent is unhealthy, triggering VM termination"
                                );
                                // Signal that VM should be terminated
                                // In a real implementation, this would trigger destroy()
                                state.request_shutdown();
                                break;
                            }
                            Ok(_) => {
                                // Health check passed or agent not responding yet
                            }
                            Err(e) => {
                                warn!(
                                    vm_id = %vm_id,
                                    error = %e,
                                    "Health check error"
                                );
                            }
                        }
                    }
                    _ = shutdown_rx.changed() => {
                        info!(vm_id = %vm_id, "Health monitor received shutdown signal");
                        break;
                    }
                }
            }

            info!(vm_id = %vm_id, "Health monitor stopped");
        })
    }

    /// Signal the monitor to stop
    ///
    /// This should be called when the VM is being destroyed.
    pub fn stop(&self) {
        info!(vm_id = %self.vm_id, "Requesting health monitor stop");
        self.state.request_shutdown();
    }

    /// Internal method to send a ping and receive pong
    async fn ping(&self) -> Result<PongResponse, DriverError> {
        let request = GuestAgentRequest::Ping {
            version: DRIVER_VERSION.to_string(),
        };

        let response = self.send_request(&request).await?;

        match response {
            GuestAgentResponse::Pong {
                version,
                uptime_secs,
            } => Ok(PongResponse {
                version,
                uptime_secs,
            }),
            GuestAgentResponse::Error { message } => Err(DriverError::InternalError { message }),
            _ => Err(DriverError::InternalError {
                message: "Unexpected response to ping (expected pong)".to_string(),
            }),
        }
    }

    /// Send a request to the guest agent and wait for response
    async fn send_request(
        &self,
        request: &GuestAgentRequest,
    ) -> Result<GuestAgentResponse, DriverError> {
        let mut stream = UnixStream::connect(&self.vsock_path).await.map_err(|e| {
            DriverError::InternalError {
                message: format!("Failed to connect to guest agent: {}", e),
            }
        })?;

        let request_json = serde_json::to_vec(request).map_err(|e| DriverError::InternalError {
            message: format!("Failed to serialize request: {}", e),
        })?;

        // Send length-prefixed message
        let len = request_json.len() as u32;
        tokio::io::AsyncWriteExt::write_all(&mut stream, &len.to_be_bytes())
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write request length: {}", e),
            })?;

        tokio::io::AsyncWriteExt::write_all(&mut stream, &request_json)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write request: {}", e),
            })?;

        // Read response length
        let mut len_buf = [0u8; 4];
        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut len_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read response length: {}", e),
            })?;

        let response_len = u32::from_be_bytes(len_buf) as usize;

        // Sanity check on response size
        if response_len > 10 * 1024 * 1024 {
            // 10MB limit
            return Err(DriverError::InternalError {
                message: format!("Response too large: {} bytes", response_len),
            });
        }

        let mut response_buf = vec![0u8; response_len];
        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut response_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read response: {}", e),
            })?;

        serde_json::from_slice(&response_buf).map_err(|e| DriverError::InternalError {
            message: format!("Failed to parse response: {}", e),
        })
    }
}

/// Pong response data
#[derive(Debug)]
struct PongResponse {
    version: String,
    uptime_secs: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_version_parse() {
        let v = AgentVersion::parse("1.2.3").unwrap();
        assert_eq!(v.major, 1);
        assert_eq!(v.minor, 2);
        assert_eq!(v.patch, 3);
        assert_eq!(v.build, None);

        let v = AgentVersion::parse("1.2.3+build.456").unwrap();
        assert_eq!(v.major, 1);
        assert_eq!(v.build, Some("build.456".to_string()));
    }

    #[test]
    fn test_agent_version_parse_errors() {
        assert!(AgentVersion::parse("1.2").is_err());
        assert!(AgentVersion::parse("1.2.3.4").is_err());
        assert!(AgentVersion::parse("abc").is_err());
    }

    #[test]
    fn test_version_compatibility() {
        // Compatible versions (major == 1)
        let v1 = AgentVersion::parse("1.0.0").unwrap();
        assert!(v1.is_compatible());

        let v2 = AgentVersion::parse("1.5.10").unwrap();
        assert!(v2.is_compatible());

        // Incompatible (major != 1)
        let v3 = AgentVersion::parse("2.0.0").unwrap();
        assert!(!v3.is_compatible());

        let v4 = AgentVersion::parse("0.9.0").unwrap();
        assert!(!v4.is_compatible());
    }

    #[test]
    fn test_agent_health_display() {
        assert_eq!(AgentHealth::Healthy.to_string(), "healthy");
        assert_eq!(AgentHealth::Unhealthy.to_string(), "unhealthy");
        assert_eq!(AgentHealth::Starting.to_string(), "starting");
        assert_eq!(AgentHealth::NotResponding.to_string(), "not_responding");
    }
}
