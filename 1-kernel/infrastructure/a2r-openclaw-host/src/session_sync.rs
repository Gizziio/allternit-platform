//! Session Sync Service - Bridges native sessions to external consumers
//!
//! Emits real-time session changes via broadcast channel for SSE/WebSocket delivery

use crate::native_session_manager::{SessionMessage, SessionState};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// Session change event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionChangeEvent {
    /// New session created
    Created {
        #[serde(flatten)]
        session: SessionStateSnapshot,
    },
    /// Session metadata updated
    Updated {
        session_id: String,
        #[serde(flatten)]
        changes: SessionChanges,
    },
    /// Session deleted
    Deleted { session_id: String },
    /// New message added to session
    MessageAdded {
        session_id: String,
        #[serde(flatten)]
        message: SessionMessageSnapshot,
    },
    /// Session active status changed
    StatusChanged { session_id: String, active: bool },
}

/// Serializable session state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStateSnapshot {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub message_count: usize,
    pub active: bool,
    pub tags: Vec<String>,
}

impl From<&SessionState> for SessionStateSnapshot {
    fn from(state: &SessionState) -> Self {
        Self {
            id: state.id.as_str().to_string(),
            name: state.name.clone(),
            description: state.description.clone(),
            created_at: state.created_at.to_rfc3339(),
            updated_at: state.updated_at.to_rfc3339(),
            last_accessed: state.last_accessed.to_rfc3339(),
            message_count: state.messages.len(),
            active: state.active,
            tags: state.tags.clone(),
        }
    }
}

/// Serializable message snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessageSnapshot {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

impl From<&SessionMessage> for SessionMessageSnapshot {
    fn from(msg: &SessionMessage) -> Self {
        Self {
            id: msg.id.clone(),
            role: msg.role.clone(),
            content: msg.content.clone(),
            timestamp: msg.timestamp.to_rfc3339(),
        }
    }
}

/// Session changes for update events
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionChanges {
    pub name: Option<Option<String>>,
    pub description: Option<Option<String>>,
    pub active: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<std::collections::HashMap<String, serde_json::Value>>,
}

/// Subscriber handle for managing subscriptions
#[derive(Debug)]
pub struct SubscriberHandle {
    pub id: String,
    pub filter: Option<SessionEventFilter>,
}

/// Filter for session events
#[derive(Debug, Clone)]
pub struct SessionEventFilter {
    pub session_ids: Option<Vec<String>>,
    pub event_types: Option<Vec<String>>,
}

/// Session sync service for broadcasting session changes
pub struct SessionSyncService {
    event_tx: broadcast::Sender<SessionChangeEvent>,
    subscribers: Arc<RwLock<Vec<SubscriberHandle>>>,
}

impl SessionSyncService {
    /// Create a new session sync service
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(1000);
        Self {
            event_tx,
            subscribers: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Subscribe to session change events
    pub fn subscribe(&self) -> broadcast::Receiver<SessionChangeEvent> {
        self.event_tx.subscribe()
    }

    /// Emit a session change event to all subscribers
    pub fn emit(&self, event: SessionChangeEvent) {
        let _ = self.event_tx.send(event);
    }

    /// Emit a session created event
    pub fn emit_created(&self, session: &SessionState) {
        let event = SessionChangeEvent::Created {
            session: SessionStateSnapshot::from(session),
        };
        self.emit(event);
    }

    /// Emit a session updated event
    pub fn emit_updated(&self, session_id: &str, changes: SessionChanges) {
        let event = SessionChangeEvent::Updated {
            session_id: session_id.to_string(),
            changes,
        };
        self.emit(event);
    }

    /// Emit a session deleted event
    pub fn emit_deleted(&self, session_id: &str) {
        let event = SessionChangeEvent::Deleted {
            session_id: session_id.to_string(),
        };
        self.emit(event);
    }

    /// Emit a message added event
    pub fn emit_message_added(&self, session_id: &str, message: &SessionMessage) {
        let event = SessionChangeEvent::MessageAdded {
            session_id: session_id.to_string(),
            message: SessionMessageSnapshot::from(message),
        };
        self.emit(event);
    }

    /// Emit a status changed event
    pub fn emit_status_changed(&self, session_id: &str, active: bool) {
        let event = SessionChangeEvent::StatusChanged {
            session_id: session_id.to_string(),
            active,
        };
        self.emit(event);
    }

    /// Register a new subscriber
    pub async fn register_subscriber(&self, filter: Option<SessionEventFilter>) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let handle = SubscriberHandle {
            id: id.clone(),
            filter,
        };

        let mut subscribers = self.subscribers.write().await;
        subscribers.push(handle);

        id
    }

    /// Unregister a subscriber
    pub async fn unregister_subscriber(&self, subscriber_id: &str) {
        let mut subscribers = self.subscribers.write().await;
        subscribers.retain(|s| s.id != subscriber_id);
    }

    /// Get current subscriber count
    pub async fn subscriber_count(&self) -> usize {
        let subscribers = self.subscribers.read().await;
        subscribers.len()
    }
}

impl Default for SessionSyncService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;
    use crate::native_session_manager::{SessionId, SessionState};
    use chrono::Utc;

    #[test]
    fn test_session_sync_service_creation() {
        let service = SessionSyncService::new();
        let rx = service.subscribe();
        assert_eq!(service.event_tx.receiver_count(), 1);
        drop(rx);
    }

    #[test]
    fn test_emit_and_receive() {
        let service = SessionSyncService::new();
        let mut rx = service.subscribe();

        // Emit a status changed event
        service.emit_status_changed("test-session", true);

        // Should receive the event
        let event = rx.try_recv();
        assert!(event.is_ok());

        match event.unwrap() {
            SessionChangeEvent::StatusChanged { session_id, active } => {
                assert_eq!(session_id, "test-session");
                assert!(active);
            }
            _ => panic!("Expected StatusChanged event"),
        }
    }

    #[test]
    fn test_multiple_subscribers() {
        let service = SessionSyncService::new();
        let mut rx1 = service.subscribe();
        let mut rx2 = service.subscribe();

        service.emit_deleted("session-123");

        // Both subscribers should receive the event
        let event1 = rx1.try_recv();
        let event2 = rx2.try_recv();

        assert!(event1.is_ok());
        assert!(event2.is_ok());

        match event1.unwrap() {
            SessionChangeEvent::Deleted { session_id } => {
                assert_eq!(session_id, "session-123");
            }
            _ => panic!("Expected Deleted event"),
        }
    }

    #[test]
    fn test_snapshot_conversions() {
        let session = SessionState {
            id: SessionId::new("test-id".to_string()),
            name: Some("Test Session".to_string()),
            description: Some("Description".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_accessed: Utc::now(),
            messages: vec![],
            metadata: None,
            active: true,
            tags: vec!["tag1".to_string()],
        };

        let snapshot = SessionStateSnapshot::from(&session);

        assert_eq!(snapshot.id, "test-id");
        assert_eq!(snapshot.name, Some("Test Session".to_string()));
        assert_eq!(snapshot.active, true);
        assert_eq!(snapshot.tags, vec!["tag1".to_string()]);
    }
}
