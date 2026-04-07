//! Capsule Registry Service
//!
//! Manages interactive capsule lifecycle:
//! - Creation and registration
//! - State machine transitions
//! - Event queuing per capsule
//! - Cleanup of orphaned capsules

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

/// Unique identifier for capsules
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CapsuleId(String);

impl CapsuleId {
    pub fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Default for CapsuleId {
    fn default() -> Self {
        Self::new()
    }
}

/// Capsule lifecycle states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CapsuleState {
    /// Initial state, capsule created but not yet active
    Pending,
    /// Capsule is active and receiving events
    Active,
    /// Capsule encountered an error
    Error,
    /// Capsule has been closed
    Closed,
}

impl std::fmt::Display for CapsuleState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CapsuleState::Pending => write!(f, "pending"),
            CapsuleState::Active => write!(f, "active"),
            CapsuleState::Error => write!(f, "error"),
            CapsuleState::Closed => write!(f, "closed"),
        }
    }
}

/// Tool UI Surface definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUISurface {
    pub html: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub js: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub props: Option<serde_json::Value>,
    pub permissions: Vec<CapsulePermission>,
}

/// Permissions a capsule can request
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CapsulePermission {
    /// Can invoke tools through the bridge
    InvokeTools,
    /// Can access filesystem (read-only)
    ReadFilesystem,
    /// Can access filesystem (write)
    WriteFilesystem,
    /// Can make network requests
    NetworkAccess,
    /// Can access clipboard
    ClipboardAccess,
}

/// Specification for creating a capsule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleSpec {
    pub capsule_type: String,
    pub tool_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    pub surface: ToolUISurface,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_data: Option<serde_json::Value>,
}

/// Event types for capsule communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CapsuleEvent {
    /// Tool sending data to UI
    ToolData {
        payload: serde_json::Value,
        timestamp: u64,
    },
    /// Tool notifying UI of an event
    ToolEvent {
        event_type: String,
        payload: serde_json::Value,
        timestamp: u64,
    },
    /// UI invoking an action
    UiAction {
        action: String,
        params: serde_json::Value,
        timestamp: u64,
    },
    /// UI notifying of an event
    UiEvent {
        event_type: String,
        payload: serde_json::Value,
        timestamp: u64,
    },
    /// State transition notification
    StateChange {
        from: CapsuleState,
        to: CapsuleState,
        timestamp: u64,
    },
    /// Error occurred
    Error {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
        timestamp: u64,
    },
}

/// Capsule instance data
#[derive(Debug, Clone)]
pub struct Capsule {
    pub id: CapsuleId,
    pub capsule_type: String,
    pub tool_id: String,
    pub agent_id: Option<String>,
    pub state: CapsuleState,
    pub surface: ToolUISurface,
    pub created_at: Instant,
    pub updated_at: Instant,
    pub event_tx: mpsc::Sender<CapsuleEvent>,
}

/// Response data for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleResponse {
    pub id: String,
    pub capsule_type: String,
    pub tool_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    pub state: String,
    pub surface: ToolUISurface,
    pub created_at: u64,
    pub updated_at: u64,
}

impl From<&Capsule> for CapsuleResponse {
    fn from(capsule: &Capsule) -> Self {
        Self {
            id: capsule.id.as_str().to_string(),
            capsule_type: capsule.capsule_type.clone(),
            tool_id: capsule.tool_id.clone(),
            agent_id: capsule.agent_id.clone(),
            state: capsule.state.to_string(),
            surface: capsule.surface.clone(),
            created_at: capsule.created_at.elapsed().as_secs(),
            updated_at: capsule.updated_at.elapsed().as_secs(),
        }
    }
}

/// In-memory capsule registry
pub struct CapsuleRegistry {
    capsules: RwLock<HashMap<CapsuleId, Capsule>>,
    event_buffers: RwLock<HashMap<CapsuleId, Vec<CapsuleEvent>>>,
}

impl CapsuleRegistry {
    pub fn new() -> Self {
        Self {
            capsules: RwLock::new(HashMap::new()),
            event_buffers: RwLock::new(HashMap::new()),
        }
    }

    /// Create a new capsule
    pub async fn create(&self, spec: CapsuleSpec) -> CapsuleId {
        let id = CapsuleId::new();
        let (event_tx, _event_rx) = mpsc::channel(100);

        let now = Instant::now();
        let capsule = Capsule {
            id: id.clone(),
            capsule_type: spec.capsule_type,
            tool_id: spec.tool_id,
            agent_id: spec.agent_id,
            state: CapsuleState::Pending,
            surface: spec.surface,
            created_at: now,
            updated_at: now,
            event_tx,
        };

        let mut capsules = self.capsules.write().await;
        capsules.insert(id.clone(), capsule);

        let mut buffers = self.event_buffers.write().await;
        buffers.insert(id.clone(), Vec::new());

        id
    }

    /// Get a capsule by ID
    pub async fn get(&self, id: &CapsuleId) -> Option<Capsule> {
        let capsules = self.capsules.read().await;
        capsules.get(id).cloned()
    }

    /// Get a capsule by string ID
    pub async fn get_by_str(&self, id: &str) -> Option<Capsule> {
        let capsules = self.capsules.read().await;
        capsules
            .iter()
            .find(|(k, _)| k.as_str() == id)
            .map(|(_, v)| v.clone())
    }

    /// Update capsule state
    pub async fn update_state(
        &self,
        id: &CapsuleId,
        new_state: CapsuleState,
    ) -> Result<(), String> {
        let mut capsules = self.capsules.write().await;

        if let Some(capsule) = capsules.get_mut(id) {
            let old_state = capsule.state;
            capsule.state = new_state;
            capsule.updated_at = Instant::now();

            // Emit state change event
            let event = CapsuleEvent::StateChange {
                from: old_state,
                to: new_state,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            };

            let _ = capsule.event_tx.send(event).await;

            Ok(())
        } else {
            Err("Capsule not found".to_string())
        }
    }

    /// Push event to a capsule
    pub async fn push_event(&self, id: &CapsuleId, event: CapsuleEvent) -> Result<(), String> {
        // Send to active subscribers
        let capsules = self.capsules.read().await;
        if let Some(capsule) = capsules.get(id) {
            let _ = capsule.event_tx.send(event.clone()).await;
        }
        drop(capsules);

        // Buffer the event
        let mut buffers = self.event_buffers.write().await;
        if let Some(buffer) = buffers.get_mut(id) {
            buffer.push(event);
            // Keep last 1000 events
            if buffer.len() > 1000 {
                buffer.remove(0);
            }
            Ok(())
        } else {
            Err("Capsule not found".to_string())
        }
    }

    /// Subscribe to capsule events
    pub async fn subscribe(&self, id: &CapsuleId) -> Option<mpsc::Receiver<CapsuleEvent>> {
        let capsules = self.capsules.read().await;
        capsules.get(id).map(|c| {
            // Create new channel for subscriber
            let (tx, rx) = mpsc::channel(100);
            // Note: In production, you'd track subscribers
            rx
        })
    }

    /// Get event buffer for a capsule
    pub async fn get_events(&self, id: &CapsuleId) -> Option<Vec<CapsuleEvent>> {
        let buffers = self.event_buffers.read().await;
        buffers.get(id).cloned()
    }

    /// Delete a capsule
    pub async fn delete(&self, id: &CapsuleId) -> Result<(), String> {
        let mut capsules = self.capsules.write().await;
        capsules.remove(id).ok_or("Capsule not found")?;
        drop(capsules);

        let mut buffers = self.event_buffers.write().await;
        buffers.remove(id);

        Ok(())
    }

    /// List all capsules
    pub async fn list_all(&self) -> Vec<Capsule> {
        let capsules = self.capsules.read().await;
        capsules.values().cloned().collect()
    }

    /// List capsules by agent
    pub async fn list_by_agent(&self, agent_id: &str) -> Vec<Capsule> {
        let capsules = self.capsules.read().await;
        capsules
            .values()
            .filter(|c| c.agent_id.as_deref() == Some(agent_id))
            .cloned()
            .collect()
    }

    /// Cleanup orphaned capsules (inactive for too long)
    pub async fn cleanup_orphaned(&self, max_age: Duration) -> usize {
        let now = Instant::now();
        let mut to_remove = Vec::new();

        {
            let capsules = self.capsules.read().await;
            for (id, capsule) in capsules.iter() {
                let age = now.duration_since(capsule.updated_at);
                let is_terminal =
                    matches!(capsule.state, CapsuleState::Closed | CapsuleState::Error);

                if age > max_age && is_terminal {
                    to_remove.push(id.clone());
                }
            }
        }

        let count = to_remove.len();

        for id in to_remove {
            let _ = self.delete(&id).await;
        }

        count
    }

    /// Get count of active capsules
    pub async fn active_count(&self) -> usize {
        let capsules = self.capsules.read().await;
        capsules
            .values()
            .filter(|c| matches!(c.state, CapsuleState::Active | CapsuleState::Pending))
            .count()
    }
}

impl Default for CapsuleRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// Global registry instance (consider using DI in production)
pub type SharedCapsuleRegistry = Arc<CapsuleRegistry>;

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_and_get_capsule() {
        let registry = CapsuleRegistry::new();

        let spec = CapsuleSpec {
            capsule_type: "test".to_string(),
            tool_id: "test-tool".to_string(),
            agent_id: None,
            surface: ToolUISurface {
                html: "<div>test</div>".to_string(),
                css: None,
                js: None,
                props: None,
                permissions: vec![CapsulePermission::InvokeTools],
            },
            initial_data: None,
        };

        let id = registry.create(spec).await;
        let capsule = registry.get(&id).await;

        assert!(capsule.is_some());
        let capsule = capsule.unwrap();
        assert_eq!(capsule.capsule_type, "test");
        assert_eq!(capsule.state, CapsuleState::Pending);
    }

    #[tokio::test]
    async fn test_state_transition() {
        let registry = CapsuleRegistry::new();

        let spec = CapsuleSpec {
            capsule_type: "test".to_string(),
            tool_id: "test-tool".to_string(),
            agent_id: None,
            surface: ToolUISurface {
                html: "<div>test</div>".to_string(),
                css: None,
                js: None,
                props: None,
                permissions: vec![],
            },
            initial_data: None,
        };

        let id = registry.create(spec).await;

        // Transition to Active
        let result = registry.update_state(&id, CapsuleState::Active).await;
        assert!(result.is_ok());

        let capsule = registry.get(&id).await.unwrap();
        assert_eq!(capsule.state, CapsuleState::Active);
    }

    #[tokio::test]
    async fn test_delete_capsule() {
        let registry = CapsuleRegistry::new();

        let spec = CapsuleSpec {
            capsule_type: "test".to_string(),
            tool_id: "test-tool".to_string(),
            agent_id: None,
            surface: ToolUISurface {
                html: "<div>test</div>".to_string(),
                css: None,
                js: None,
                props: None,
                permissions: vec![],
            },
            initial_data: None,
        };

        let id = registry.create(spec).await;
        assert!(registry.get(&id).await.is_some());

        let result = registry.delete(&id).await;
        assert!(result.is_ok());
        assert!(registry.get(&id).await.is_none());
    }
}
