//! Host state and functions for WASM tool execution.

use crate::capabilities::{CapabilityGrant, CapabilitySet};
use crate::sandbox::SandboxMetrics;
use allternit_history::HistoryLedger;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// State held by the host during WASM execution.
///
/// This state is passed to host functions and provides:
/// - Capability checking
/// - Event logging
/// - Resource tracking
/// - Policy logging
pub struct ToolHostState {
    /// The capability grant for this execution
    pub capability_grant: CapabilityGrant,

    /// Pre-computed capability set for fast checks
    pub capability_set: CapabilitySet,

    /// Execution context
    pub context: ExecutionContext,

    /// Metrics for this execution
    pub metrics: Arc<Mutex<SandboxMetrics>>,

    /// Event log for this execution
    pub events: Arc<Mutex<Vec<HostEvent>>>,

    /// History ledger for audit trail
    pub history_ledger: Arc<Mutex<HistoryLedger>>,

    /// Capsule ID for logging
    pub capsule_id: String,

    /// Tenant ID for logging
    pub tenant_id: String,

    /// Execution ID for logging
    pub execution_id: String,
}

impl ToolHostState {
    /// Create new host state from a capability grant
    pub fn new(
        grant: CapabilityGrant,
        context: ExecutionContext,
        history_ledger: Arc<Mutex<HistoryLedger>>,
    ) -> Self {
        let capability_set = CapabilitySet::from_grant(&grant);
        let capsule_id = grant.capsule_id.clone();
        let tenant_id = grant.tenant_id.clone();
        let execution_id = context.execution_id.to_string();
        Self {
            capability_grant: grant,
            capability_set,
            context,
            metrics: Arc::new(Mutex::new(SandboxMetrics::new())),
            events: Arc::new(Mutex::new(Vec::new())),
            history_ledger,
            capsule_id,
            tenant_id,
            execution_id,
        }
    }

    /// Check if a capability is granted
    pub fn check_capability(&self, capability_type: &str) -> bool {
        let allowed = self.capability_set.has(capability_type);

        // Record in metrics
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.record_capability_check(allowed);
        }

        // Log to events
        if let Ok(mut events) = self.events.lock() {
            events.push(HostEvent::CapabilityCheck {
                capability_type: capability_type.to_string(),
                allowed,
                timestamp: Utc::now(),
            });
        }

        // Log to policy engine for audit trail
        if let Ok(mut history) = self.history_ledger.lock() {
            let content = serde_json::json!({
                "event": "CapabilityCheck",
                "capability_type": capability_type,
                "allowed": allowed,
                "capsule_id": &self.capsule_id,
                "tenant_id": &self.tenant_id,
                "execution_id": &self.execution_id,
                "timestamp": Utc::now().to_rfc3339(),
            });
            let _ = history.append(content); // Ignore errors when appending to history
        }

        // Publish event to messaging system for real-time monitoring
        if allowed {
            tracing::info!(
                "Capability granted: {} for capsule {} in tenant {}",
                capability_type,
                self.capsule_id,
                self.tenant_id
            );
        } else {
            tracing::warn!(
                "Capability denied: {} for capsule {} in tenant {}",
                capability_type,
                self.capsule_id,
                self.tenant_id
            );
        }

        allowed
    }

    /// Log an event from the tool
    pub fn log_event(&self, message: String, level: LogLevel) {
        if let Ok(mut events) = self.events.lock() {
            events.push(HostEvent::Log {
                message,
                level,
                timestamp: Utc::now(),
            });
        }
    }

    /// Record a host function call
    pub fn record_host_call(&self, function_name: &str) {
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.record_host_call();
        }

        if let Ok(mut events) = self.events.lock() {
            events.push(HostEvent::HostCall {
                function_name: function_name.to_string(),
                timestamp: Utc::now(),
            });
        }
    }

    /// Get collected metrics
    pub fn get_metrics(&self) -> SandboxMetrics {
        self.metrics.lock().map(|m| m.clone()).unwrap_or_default()
    }

    /// Get collected events
    pub fn get_events(&self) -> Vec<HostEvent> {
        self.events.lock().map(|e| e.clone()).unwrap_or_default()
    }
}

/// Context for a tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    /// Unique execution ID
    pub execution_id: Uuid,

    /// Session ID (if part of a session)
    pub session_id: Option<String>,

    /// Tenant ID
    pub tenant_id: String,

    /// Trace ID for distributed tracing
    pub trace_id: Option<String>,

    /// Idempotency key for safe retries
    pub idempotency_key: Option<String>,

    /// When execution started
    pub started_at: DateTime<Utc>,

    /// Parent execution ID (if this is a nested call)
    pub parent_execution_id: Option<Uuid>,
}

impl ExecutionContext {
    /// Create a new execution context
    pub fn new(tenant_id: String) -> Self {
        Self {
            execution_id: Uuid::new_v4(),
            session_id: None,
            tenant_id,
            trace_id: None,
            idempotency_key: None,
            started_at: Utc::now(),
            parent_execution_id: None,
        }
    }

    /// Builder: set session ID
    pub fn with_session(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }

    /// Builder: set trace ID
    pub fn with_trace(mut self, trace_id: String) -> Self {
        self.trace_id = Some(trace_id);
        self
    }

    /// Builder: set idempotency key
    pub fn with_idempotency_key(mut self, key: String) -> Self {
        self.idempotency_key = Some(key);
        self
    }

    /// Builder: set parent execution
    pub fn with_parent(mut self, parent_id: Uuid) -> Self {
        self.parent_execution_id = Some(parent_id);
        self
    }
}

/// Events logged during tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum HostEvent {
    /// A capability check was performed
    CapabilityCheck {
        capability_type: String,
        allowed: bool,
        timestamp: DateTime<Utc>,
    },

    /// A log message from the tool
    Log {
        message: String,
        level: LogLevel,
        timestamp: DateTime<Utc>,
    },

    /// A host function was called
    HostCall {
        function_name: String,
        timestamp: DateTime<Utc>,
    },

    /// Resource limit warning
    ResourceWarning {
        resource_type: String,
        current_usage: u64,
        limit: u64,
        timestamp: DateTime<Utc>,
    },
}

/// Log levels for tool messages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Trace => write!(f, "TRACE"),
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warn => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
        }
    }
}
