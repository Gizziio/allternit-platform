//! Tool Loop Arbiter
//!
//! Decides whether to execute tool calls, manages permissions, and coordinates
//! the tool execution lifecycle.

use super::ToolCall;
use crate::tool_loop::{CircuitBreaker, CircuitConfig, RetryPolicy};
use std::collections::HashMap;

/// Decision for tool execution
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Execute,
    Reject(RejectionReason),
    PendingPermission,
}

/// Reasons for tool execution rejection
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RejectionReason {
    CircuitBreakerOpen,
    MaxToolCallsExceeded,
    ToolNotAllowed,
    PermissionDenied,
}

/// Arbiter for tool loop execution
pub struct ToolLoopArbiter {
    max_tool_calls: u32,
    tool_call_count: u32,
    circuit_breakers: HashMap<String, CircuitBreaker>,
    retry_policy: RetryPolicy,
    tool_timeouts: HashMap<String, u64>, // tool_name -> timeout_ms
}

impl ToolLoopArbiter {
    pub fn new(max_tool_calls: u32) -> Self {
        Self {
            max_tool_calls,
            tool_call_count: 0,
            circuit_breakers: HashMap::new(),
            retry_policy: RetryPolicy::default(),
            tool_timeouts: HashMap::new(),
        }
    }

    /// Decide whether to execute a tool call
    pub fn should_execute(&self, tool_call: &ToolCall) -> Decision {
        // Check max tool calls
        if self.tool_call_count >= self.max_tool_calls {
            return Decision::Reject(RejectionReason::MaxToolCallsExceeded);
        }

        // Check circuit breaker
        if let Some(cb) = self.circuit_breakers.get(&tool_call.name) {
            if cb.is_open() {
                return Decision::Reject(RejectionReason::CircuitBreakerOpen);
            }
        }

        Decision::Execute
    }

    /// Register a circuit breaker for a tool
    pub fn register_circuit_breaker(&mut self, tool_name: &str, config: CircuitConfig) {
        self.circuit_breakers
            .insert(tool_name.to_string(), CircuitBreaker::new(config));
    }

    /// Get retry policy
    pub fn retry_policy(&self) -> &RetryPolicy {
        &self.retry_policy
    }

    /// Record successful tool execution
    pub fn record_success(&mut self, tool_name: &str) {
        self.tool_call_count += 1;
        if let Some(cb) = self.circuit_breakers.get_mut(tool_name) {
            cb.record_success();
        }
    }

    /// Record success without tool name (for testing)
    #[cfg(test)]
    pub fn record_success_any(&mut self) {
        self.tool_call_count += 1;
    }

    /// Record failed tool execution
    pub fn record_failure(&mut self, tool_name: &str) {
        if let Some(cb) = self.circuit_breakers.get_mut(tool_name) {
            cb.record_failure();
        }
    }

    pub fn tool_call_count(&self) -> u32 {
        self.tool_call_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_execute_within_limits() {
        let arbiter = ToolLoopArbiter::new(10);
        let tool_call = ToolCall {
            id: "1".to_string(),
            name: "test".to_string(),
            arguments: serde_json::json!({}),
        };

        assert_eq!(arbiter.should_execute(&tool_call), Decision::Execute);
    }

    #[test]
    fn test_should_reject_when_max_exceeded() {
        let mut arbiter = ToolLoopArbiter::new(2);
        let tool_call = ToolCall {
            id: "1".to_string(),
            name: "test".to_string(),
            arguments: serde_json::json!({}),
        };

        arbiter.record_success("test");
        arbiter.record_success("test");

        assert_eq!(
            arbiter.should_execute(&tool_call),
            Decision::Reject(RejectionReason::MaxToolCallsExceeded)
        );
    }
}
