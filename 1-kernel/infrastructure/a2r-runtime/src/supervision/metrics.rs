//! Runtime Metrics
//!
//! Performance and health metrics for the runtime brain.

use serde::{Deserialize, Serialize};

/// Runtime metrics snapshot
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RuntimeMetrics {
    pub sessions_created: u64,
    pub sessions_active: u64,
    pub sessions_terminated: u64,
    pub invocations_completed: u64,
    pub invocations_failed: u64,
    pub tool_calls_executed: u64,
    pub tool_calls_failed: u64,
    pub tokens_emitted: u64,
    pub provider_failovers: u64,
    pub circuit_breaker_opens: u64,
}

impl RuntimeMetrics {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn success_rate(&self) -> f64 {
        let total = self.invocations_completed + self.invocations_failed;
        if total == 0 {
            1.0
        } else {
            self.invocations_completed as f64 / total as f64
        }
    }
}
