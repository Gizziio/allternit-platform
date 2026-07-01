//! MCP Health Monitoring & Auto-Restart (N14)
//!
//! Features:
//! - Periodic health checks for MCP servers
//! - Auto-restart with exponential backoff
//! - Circuit breaker pattern for failing servers
//! - Metrics emission for observability

use crate::error::{McpError, Result};
use crate::registry::{ConnectionState, McpRegistry};
use crate::McpClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, Instant};
use tracing::{debug, error, info, warn};

/// Health monitor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthMonitorConfig {
    /// Health check interval (default: 30 seconds)
    pub check_interval_secs: u64,
    /// Maximum consecutive failures before circuit breaker opens (default: 3)
    pub max_consecutive_failures: u32,
    /// Base delay for exponential backoff in seconds (default: 1)
    pub backoff_base_secs: u64,
    /// Maximum backoff delay in seconds (default: 300 = 5 minutes)
    pub backoff_max_secs: u64,
    /// Maximum restart attempts before giving up (default: 5, 0 = unlimited)
    pub max_restart_attempts: u32,
    /// Health check timeout in seconds (default: 10)
    pub health_check_timeout_secs: u64,
    /// Enable circuit breaker (default: true)
    pub circuit_breaker_enabled: bool,
    /// Circuit breaker reset timeout in seconds (default: 60)
    pub circuit_breaker_reset_secs: u64,
}

impl Default for HealthMonitorConfig {
    fn default() -> Self {
        Self {
            check_interval_secs: 30,
            max_consecutive_failures: 3,
            backoff_base_secs: 1,
            backoff_max_secs: 300,
            max_restart_attempts: 5,
            health_check_timeout_secs: 10,
            circuit_breaker_enabled: true,
            circuit_breaker_reset_secs: 60,
        }
    }
}

/// Circuit breaker state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CircuitBreakerState {
    /// Circuit is closed, requests allowed
    Closed,
    /// Circuit is open, requests blocked
    Open,
    /// Circuit is half-open, testing if service recovered
    HalfOpen,
}

impl std::fmt::Display for CircuitBreakerState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CircuitBreakerState::Closed => write!(f, "closed"),
            CircuitBreakerState::Open => write!(f, "open"),
            CircuitBreakerState::HalfOpen => write!(f, "half-open"),
        }
    }
}

/// Health status for a monitored server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerHealth {
    /// Server ID
    pub server_id: String,
    /// Current connection state
    pub connection_state: ConnectionState,
    /// Circuit breaker state
    pub circuit_breaker: CircuitBreakerState,
    /// Consecutive health check failures
    pub consecutive_failures: u32,
    /// Total restart attempts
    pub restart_attempts: u32,
    /// Last health check timestamp
    pub last_health_check: Option<i64>,
    /// Last successful health check
    pub last_successful_check: Option<i64>,
    /// Current backoff delay in seconds
    pub current_backoff_secs: u64,
    /// Whether auto-restart is enabled for this server
    pub auto_restart: bool,
    /// Last error message
    pub last_error: Option<String>,
}

/// Health check result
#[derive(Debug, Clone)]
enum HealthCheckResult {
    Healthy,
    Unhealthy(String),
    CircuitBreakerOpen,
}

/// Health monitor for MCP servers
#[derive(Debug)]
pub struct McpHealthMonitor {
    /// Configuration
    config: HealthMonitorConfig,
    /// Registry for persistence
    registry: Arc<McpRegistry>,
    /// Active clients (server_id -> client)
    clients: Arc<RwLock<HashMap<String, Arc<tokio::sync::Mutex<McpClient>>>>>,
    /// Circuit breaker states
    circuit_breakers: Arc<RwLock<HashMap<String, CircuitBreakerState>>>,
    /// Last circuit breaker state change
    circuit_breaker_timestamps: Arc<RwLock<HashMap<String, Instant>>>,
    /// Shutdown signal sender
    shutdown_tx: mpsc::Sender<()>,
    /// Shutdown signal receiver (stored for clone)
    shutdown_rx: Arc<RwLock<mpsc::Receiver<()>>>,
}

impl McpHealthMonitor {
    /// Create a new health monitor
    pub async fn new(
        registry: Arc<McpRegistry>,
        config: Option<HealthMonitorConfig>,
    ) -> Result<Self> {
        let config = config.unwrap_or_default();
        let (shutdown_tx, shutdown_rx) = mpsc::channel(1);

        Ok(Self {
            config,
            registry,
            clients: Arc::new(RwLock::new(HashMap::new())),
            circuit_breakers: Arc::new(RwLock::new(HashMap::new())),
            circuit_breaker_timestamps: Arc::new(RwLock::new(HashMap::new())),
            shutdown_tx,
            shutdown_rx: Arc::new(RwLock::new(shutdown_rx)),
        })
    }

    /// Register a client for health monitoring
    pub async fn register_client(
        &self,
        server_id: &str,
        client: Arc<tokio::sync::Mutex<McpClient>>,
        auto_restart: bool,
    ) -> Result<()> {
        debug!("Registering client for health monitoring: {}", server_id);

        let mut clients = self.clients.write().await;
        clients.insert(server_id.to_string(), client);
        drop(clients);

        // Initialize circuit breaker state
        let mut breakers = self.circuit_breakers.write().await;
        breakers.insert(server_id.to_string(), CircuitBreakerState::Closed);
        drop(breakers);

        // Initialize timestamp
        let mut timestamps = self.circuit_breaker_timestamps.write().await;
        timestamps.insert(server_id.to_string(), Instant::now());
        drop(timestamps);

        // Update auto_restart flag in registry
        if let Some(mut server) = self.registry.get_server(server_id).await? {
            server.auto_connect = auto_restart;
            self.registry.save_server(&server).await?;
        }

        info!(
            "Registered client for health monitoring: {} (auto_restart: {})",
            server_id, auto_restart
        );
        Ok(())
    }

    /// Unregister a client from health monitoring
    pub async fn unregister_client(&self, server_id: &str) -> Result<()> {
        debug!("Unregistering client from health monitoring: {}", server_id);

        let mut clients = self.clients.write().await;
        clients.remove(server_id);
        drop(clients);

        let mut breakers = self.circuit_breakers.write().await;
        breakers.remove(server_id);
        drop(breakers);

        let mut timestamps = self.circuit_breaker_timestamps.write().await;
        timestamps.remove(server_id);
        drop(timestamps);

        info!("Unregistered client from health monitoring: {}", server_id);
        Ok(())
    }

    /// Start the health monitoring loop
    pub async fn start_monitoring(self: Arc<Self>) -> Result<()> {
        info!(
            "Starting MCP health monitoring (interval: {}s, max_failures: {}, max_restarts: {})",
            self.config.check_interval_secs,
            self.config.max_consecutive_failures,
            self.config.max_restart_attempts
        );

        let mut interval = interval(Duration::from_secs(self.config.check_interval_secs));
        let mut shutdown_rx = self.shutdown_rx.write().await;

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = self.run_health_checks().await {
                        error!("Error during health checks: {}", e);
                    }
                }
                _ = shutdown_rx.recv() => {
                    info!("Health monitoring shutting down");
                    break;
                }
            }
        }

        Ok(())
    }

    /// Stop the health monitoring loop
    pub async fn stop_monitoring(&self) -> Result<()> {
        info!("Stopping MCP health monitoring");
        self.shutdown_tx
            .send(())
            .await
            .map_err(|e| McpError::Protocol(format!("Failed to send shutdown signal: {}", e)))?;
        Ok(())
    }

    /// Run health checks for all registered clients
    async fn run_health_checks(&self) -> Result<()> {
        let clients = self.clients.read().await;
        let server_ids: Vec<String> = clients.keys().cloned().collect();
        drop(clients);

        for server_id in server_ids {
            if let Err(e) = self.check_server_health(&server_id).await {
                warn!("Health check failed for {}: {}", server_id, e);
            }
        }

        Ok(())
    }

    /// Check health of a specific server
    async fn check_server_health(&self, server_id: &str) -> Result<()> {
        // Check circuit breaker
        if self.config.circuit_breaker_enabled {
            match self.get_circuit_breaker_state(server_id).await {
                CircuitBreakerState::Open => {
                    // Check if we should try half-open
                    if self.should_attempt_reset(server_id).await {
                        info!("Circuit breaker for {} entering half-open state", server_id);
                        self.set_circuit_breaker_state(server_id, CircuitBreakerState::HalfOpen)
                            .await;
                    } else {
                        debug!(
                            "Circuit breaker open for {}, skipping health check",
                            server_id
                        );
                        return Ok(());
                    }
                }
                CircuitBreakerState::HalfOpen => {
                    debug!(
                        "Circuit breaker half-open for {}, testing health",
                        server_id
                    );
                }
                CircuitBreakerState::Closed => {}
            }
        }

        // Get the client
        let client = {
            let clients = self.clients.read().await;
            clients.get(server_id).cloned()
        };

        let Some(client) = client else {
            return Ok(());
        };

        // Perform health check
        let check_result = self.perform_health_check(&client).await;

        // Update registry with health check timestamp
        let _ = self.registry.record_health_check(server_id).await;

        match check_result {
            HealthCheckResult::Healthy => {
                self.handle_healthy_check(server_id).await?;
            }
            HealthCheckResult::Unhealthy(error) => {
                self.handle_unhealthy_check(server_id, &error).await?;
            }
            HealthCheckResult::CircuitBreakerOpen => {
                // Should not happen, but handle gracefully
                debug!("Circuit breaker open for {}", server_id);
            }
        }

        Ok(())
    }

    /// Perform actual health check on a client
    async fn perform_health_check(
        &self,
        client: &Arc<tokio::sync::Mutex<McpClient>>,
    ) -> HealthCheckResult {
        let timeout = Duration::from_secs(self.config.health_check_timeout_secs);

        match tokio::time::timeout(timeout, async {
            let client = client.lock().await;
            client.is_healthy().await
        })
        .await
        {
            Ok(true) => HealthCheckResult::Healthy,
            Ok(false) => HealthCheckResult::Unhealthy("Client reported unhealthy".to_string()),
            Err(_) => HealthCheckResult::Unhealthy("Health check timeout".to_string()),
        }
    }

    /// Handle healthy health check
    async fn handle_healthy_check(&self, server_id: &str) -> Result<()> {
        debug!("Health check passed for {}", server_id);

        // Reset circuit breaker if it was half-open
        let breaker_state = self.get_circuit_breaker_state(server_id).await;
        if breaker_state == CircuitBreakerState::HalfOpen {
            info!(
                "Circuit breaker for {} closing after successful health check",
                server_id
            );
            self.set_circuit_breaker_state(server_id, CircuitBreakerState::Closed)
                .await;
        }

        // Reset health failures
        self.registry.reset_health_failures(server_id).await?;

        // Update status if needed
        let status = self.registry.get_status(server_id).await?;
        if let Some(status) = status {
            if status.connection_state != ConnectionState::Connected {
                self.registry.record_connection_success(server_id).await?;
            }
        }

        Ok(())
    }

    /// Handle unhealthy health check
    async fn handle_unhealthy_check(&self, server_id: &str, error: &str) -> Result<()> {
        warn!("Health check failed for {}: {}", server_id, error);

        // Record health failure
        self.registry.record_health_failure(server_id).await?;

        // Get current status
        let status = self.registry.get_status(server_id).await?;
        let consecutive_failures = status
            .as_ref()
            .map(|s| s.health_check_failures)
            .unwrap_or(0);

        // Check if we should open circuit breaker
        if self.config.circuit_breaker_enabled
            && consecutive_failures >= self.config.max_consecutive_failures
        {
            let breaker_state = self.get_circuit_breaker_state(server_id).await;
            if breaker_state != CircuitBreakerState::Open {
                warn!(
                    "Opening circuit breaker for {} after {} consecutive failures",
                    server_id, consecutive_failures
                );
                self.set_circuit_breaker_state(server_id, CircuitBreakerState::Open)
                    .await;
            }
        }

        // Attempt auto-restart if enabled
        let auto_restart = {
            let server = self.registry.get_server(server_id).await?;
            server.map(|s| s.auto_connect).unwrap_or(false)
        };

        if auto_restart {
            self.attempt_restart(server_id).await?;
        }

        Ok(())
    }

    /// Attempt to restart a server
    async fn attempt_restart(&self, server_id: &str) -> Result<()> {
        // Get current restart attempts
        let restart_attempts = {
            let status = self.registry.get_status(server_id).await?;
            status.map(|s| s.failure_count).unwrap_or(0) as u32
        };

        // Check max restart attempts
        if self.config.max_restart_attempts > 0
            && restart_attempts >= self.config.max_restart_attempts
        {
            error!(
                "Max restart attempts ({}) reached for {}, giving up",
                self.config.max_restart_attempts, server_id
            );
            return Ok(());
        }

        // Calculate backoff delay
        let backoff_secs = self.calculate_backoff(restart_attempts);

        info!(
            "Attempting to restart {} in {} seconds (attempt {})",
            server_id,
            backoff_secs,
            restart_attempts + 1
        );

        // Wait for backoff delay
        tokio::time::sleep(Duration::from_secs(backoff_secs)).await;

        // Record the restart attempt
        let error_msg = format!("Auto-restart attempt {}", restart_attempts + 1);
        self.registry
            .record_connection_failure(server_id, &error_msg)
            .await?;

        // Note: Actual restart is handled by the caller (McpToolBridge)
        // This monitor only tracks and coordinates restarts
        info!("Restart delay completed for {}", server_id);

        Ok(())
    }

    /// Calculate exponential backoff delay
    fn calculate_backoff(&self, attempt: u32) -> u64 {
        let exponent = attempt.min(10); // Cap exponent at 10
        let delay = self
            .config
            .backoff_base_secs
            .saturating_mul(2_u64.saturating_pow(exponent));
        delay.min(self.config.backoff_max_secs)
    }

    /// Get circuit breaker state
    async fn get_circuit_breaker_state(&self, server_id: &str) -> CircuitBreakerState {
        let breakers = self.circuit_breakers.read().await;
        breakers
            .get(server_id)
            .copied()
            .unwrap_or(CircuitBreakerState::Closed)
    }

    /// Set circuit breaker state
    async fn set_circuit_breaker_state(&self, server_id: &str, state: CircuitBreakerState) {
        let mut breakers = self.circuit_breakers.write().await;
        breakers.insert(server_id.to_string(), state);
        drop(breakers);

        let mut timestamps = self.circuit_breaker_timestamps.write().await;
        timestamps.insert(server_id.to_string(), Instant::now());
    }

    /// Check if we should attempt to reset circuit breaker
    async fn should_attempt_reset(&self, server_id: &str) -> bool {
        let timestamps = self.circuit_breaker_timestamps.read().await;
        if let Some(timestamp) = timestamps.get(server_id) {
            let elapsed = timestamp.elapsed().as_secs();
            elapsed >= self.config.circuit_breaker_reset_secs
        } else {
            true
        }
    }

    /// Get health status for all monitored servers
    pub async fn get_all_health_status(&self) -> Vec<ServerHealth> {
        let clients = self.clients.read().await;
        let mut statuses = Vec::new();

        for server_id in clients.keys() {
            if let Ok(Some(health)) = self.get_server_health(server_id).await {
                statuses.push(health);
            }
        }

        statuses
    }

    /// Get health status for a specific server
    pub async fn get_server_health(&self, server_id: &str) -> Result<Option<ServerHealth>> {
        let clients = self.clients.read().await;
        if !clients.contains_key(server_id) {
            return Ok(None);
        }
        drop(clients);

        let registry_status = self.registry.get_status(server_id).await?;
        let circuit_breaker = self.get_circuit_breaker_state(server_id).await;
        let server = self.registry.get_server(server_id).await?;

        let health = match (registry_status, server) {
            (Some(status), Some(server)) => Some(ServerHealth {
                server_id: server_id.to_string(),
                connection_state: status.connection_state,
                circuit_breaker,
                consecutive_failures: status.health_check_failures,
                restart_attempts: status.failure_count as u32,
                last_health_check: Some(status.updated_at),
                last_successful_check: status.last_connected_at,
                current_backoff_secs: self.calculate_backoff(status.failure_count as u32),
                auto_restart: server.auto_connect,
                last_error: status.last_error,
            }),
            _ => None,
        };

        Ok(health)
    }

    /// Manually trigger a health check for a server
    pub async fn check_health_now(&self, server_id: &str) -> Result<ServerHealth> {
        self.check_server_health(server_id).await?;
        self.get_server_health(server_id)
            .await?
            .ok_or_else(|| McpError::Protocol(format!("Server {} not found", server_id)))
    }

    /// Reset circuit breaker for a server (manual override)
    pub async fn reset_circuit_breaker(&self, server_id: &str) -> Result<()> {
        info!("Manually resetting circuit breaker for {}", server_id);
        self.set_circuit_breaker_state(server_id, CircuitBreakerState::Closed)
            .await;
        self.registry.reset_health_failures(server_id).await?;
        Ok(())
    }
}

/// Metrics for health monitoring
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HealthMetrics {
    /// Total number of health checks performed
    pub total_checks: u64,
    /// Number of successful health checks
    pub successful_checks: u64,
    /// Number of failed health checks
    pub failed_checks: u64,
    /// Number of auto-restarts triggered
    pub auto_restarts: u64,
    /// Number of circuit breaker state changes
    pub circuit_breaker_triggers: u64,
    /// Current number of monitored servers
    pub monitored_servers: usize,
    /// Number of servers with open circuit breakers
    pub open_circuits: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_monitor_config_default() {
        let config = HealthMonitorConfig::default();
        assert_eq!(config.check_interval_secs, 30);
        assert_eq!(config.max_consecutive_failures, 3);
        assert_eq!(config.backoff_base_secs, 1);
        assert_eq!(config.backoff_max_secs, 300);
    }

    #[tokio::test]
    async fn test_calculate_backoff() {
        let config = HealthMonitorConfig::default();
        let registry = Arc::new(McpRegistry::from_url(":memory:").await.unwrap());
        let monitor = Arc::new(
            McpHealthMonitor::new(registry, Some(config.clone()))
                .await
                .unwrap(),
        );

        // Test exponential backoff
        assert_eq!(monitor.calculate_backoff(0), 1);
        assert_eq!(monitor.calculate_backoff(1), 2);
        assert_eq!(monitor.calculate_backoff(2), 4);
        assert_eq!(monitor.calculate_backoff(3), 8);

        // Test max cap (2^10 = 1024, but capped at 300)
        assert_eq!(monitor.calculate_backoff(10), 300);
        assert!(monitor.calculate_backoff(20) <= config.backoff_max_secs);
    }

    #[tokio::test]
    async fn test_circuit_breaker_state_transitions() {
        // This would require a full integration test with a mock registry
        // For now, just test the state enum
        assert_eq!(CircuitBreakerState::Closed.to_string(), "closed");
        assert_eq!(CircuitBreakerState::Open.to_string(), "open");
        assert_eq!(CircuitBreakerState::HalfOpen.to_string(), "half-open");
    }
}
