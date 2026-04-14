//! OpenClaw Host Health Monitoring

/// Health status of OpenClaw host
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HealthStatus {
    /// Healthy and responding
    Healthy,

    /// Currently checking
    Checking,

    /// Unhealthy but retrying
    Degraded,

    /// Failed, not responding
    Failed,
}

impl HealthStatus {
    /// Check if status is considered healthy
    pub fn is_healthy(&self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }
}
