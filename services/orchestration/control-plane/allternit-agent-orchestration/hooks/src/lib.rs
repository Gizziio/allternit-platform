use allternit_messaging::EventBus;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HookEventName {
    SessionStart,
    SessionStop,
    WorkflowStart,
    WorkflowStop,
    AgentStart,
    AgentStop,
    PreToolUse,
    PostToolUse,
    VerifyResult,
    LearningExtracted,
    Custom(String),
}

impl std::fmt::Display for HookEventName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HookEventName::Custom(s) => write!(f, "{}", s),
            variant => write!(f, "{:?}", variant),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEvent {
    pub id: String,
    pub name: HookEventName,
    pub tenant_id: String,
    pub run_id: String,
    pub principal: serde_json::Value, // PrincipalContext
    pub payload: serde_json::Value,
    pub timestamp: u64,
}

#[async_trait::async_trait]
pub trait HookHandler: Send + Sync {
    /// Handle a hook event. Must be idempotent.
    /// Returns Ok(()) if handled successfully (or ignored safely).
    /// Returns Err if the flow should be interrupted (e.g. PreToolUse security check fails).
    async fn handle(&self, event: &HookEvent) -> anyhow::Result<()>;
}

/// The HookBus manages registration and execution of lifecycle hooks.
/// It sits between the Orchestrator and the Policy/Tooling layers.
pub struct HookBus {
    handlers: Arc<RwLock<HashMap<String, Vec<Arc<dyn HookHandler>>>>>,
    event_bus: Option<Arc<EventBus>>,
}

impl HookBus {
    pub fn new(event_bus: Option<Arc<EventBus>>) -> Self {
        Self {
            handlers: Arc::new(RwLock::new(HashMap::new())),
            event_bus,
        }
    }

    /// Register a handler for a specific event name (stringified)
    pub async fn register(&self, event_name: &str, handler: Arc<dyn HookHandler>) {
        let mut handlers = self.handlers.write().await;
        handlers
            .entry(event_name.to_string())
            .or_insert_with(Vec::new)
            .push(handler);
    }

    /// Emit a hook event. This will:
    /// 1. Execute all registered local handlers in sequence (awaiting them).
    /// 2. If all succeed, optionally publish to the async EventBus for observability.
    pub async fn emit(&self, event: HookEvent) -> anyhow::Result<()> {
        let event_name = event.name.to_string();
        let handlers_lock = self.handlers.read().await;

        if let Some(handlers) = handlers_lock.get(&event_name) {
            for handler in handlers {
                // Fail-fast if a handler returns error (e.g. Policy Blocking)
                handler.handle(&event).await?;
            }
        }

        // Publish to distributed bus (fire and forget)
        if let Some(bus) = &self.event_bus {
            // Convert HookEvent to Messaging EventEnvelope
            let event_envelope = allternit_messaging::EventEnvelope {
                event_id: event.id.clone(),
                event_type: event_name.clone(),
                session_id: event.run_id.clone(), // Using run_id as session_id
                tenant_id: event.tenant_id.clone(),
                actor_id: extract_actor_id(&event.principal),
                role: event_name_to_role(&event.name),
                timestamp: event.timestamp,
                trace_id: extract_trace_id(&event.payload),
                payload: event.payload.clone(),
            };

            // Publish to the event bus in a non-blocking way, but handle errors gracefully
            // We use a detached task to avoid blocking, but log errors for observability
            let bus_clone = bus.clone();
            let _ = tokio::spawn(async move {
                if let Err(e) = bus_clone.publish(event_envelope).await {
                    // Log error but don't fail the main operation
                    // This maintains determinism of the main hook execution path
                    eprintln!("Failed to publish hook event to EventBus: {}", e);
                }
            });
        }

        Ok(())
    }
}

/// Extract actor ID from principal value with better error handling
fn extract_actor_id(principal: &serde_json::Value) -> String {
    match principal {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Object(obj) => {
            // Try multiple possible field names for actor ID
            obj.get("id")
                .or_else(|| obj.get("actor_id"))
                .or_else(|| obj.get("principal_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string()
        }
        serde_json::Value::Null => "unknown".to_string(),
        _ => {
            // If it's not a string or object, try to serialize and use as ID
            serde_json::to_string(principal).unwrap_or_else(|_| "unknown".to_string())
        }
    }
}

/// Map hook event names to appropriate roles
fn event_name_to_role(event_name: &HookEventName) -> String {
    match event_name {
        HookEventName::SessionStart | HookEventName::SessionStop => "session_manager".to_string(),
        HookEventName::WorkflowStart | HookEventName::WorkflowStop => "workflow_engine".to_string(),
        HookEventName::AgentStart | HookEventName::AgentStop => "agent_orchestrator".to_string(),
        HookEventName::PreToolUse | HookEventName::PostToolUse => "tool_gateway".to_string(),
        HookEventName::VerifyResult => "policy_engine".to_string(),
        HookEventName::LearningExtracted => "learning_system".to_string(),
        HookEventName::Custom(_) => "custom_hook".to_string(),
    }
}

/// Extract trace ID from payload if available
fn extract_trace_id(payload: &serde_json::Value) -> Option<String> {
    if let Some(obj) = payload.as_object() {
        obj.get("trace_id")
            .or_else(|| obj.get("traceId"))
            .or_else(|| obj.get("x-trace-id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    }
}
