//! State management for the workspace service

use crate::types::{Pane, Session, SessionId};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Shared application state
#[derive(Debug, Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

#[derive(Debug)]
struct AppStateInner {
    /// Session registry
    sessions: RwLock<HashMap<SessionId, Session>>,
    /// Pane registry
    panes: RwLock<HashMap<String, Pane>>,
}

impl AppState {
    /// Create a new application state
    pub fn new() -> Self {
        Self {
            inner: Arc::new(AppStateInner {
                sessions: RwLock::new(HashMap::new()),
                panes: RwLock::new(HashMap::new()),
            }),
        }
    }

    /// Register a session
    pub async fn register_session(&self, session: Session) {
        let mut sessions = self.inner.sessions.write().await;
        sessions.insert(session.id.clone(), session);
    }

    /// Get a session by ID
    pub async fn get_session(&self, id: &str) -> Option<Session> {
        let sessions = self.inner.sessions.read().await;
        sessions.get(id).cloned()
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Vec<Session> {
        let sessions = self.inner.sessions.read().await;
        sessions.values().cloned().collect()
    }

    /// Remove a session
    pub async fn remove_session(&self, id: &str) {
        let mut sessions = self.inner.sessions.write().await;
        sessions.remove(id);
    }

    /// Register a pane
    pub async fn register_pane(&self, pane: Pane) {
        let mut panes = self.inner.panes.write().await;
        panes.insert(pane.id.clone(), pane);
    }

    /// Get a pane by ID
    pub async fn get_pane(&self, id: &str) -> Option<Pane> {
        let panes = self.inner.panes.read().await;
        panes.get(id).cloned()
    }

    /// List panes for a session
    pub async fn list_session_panes(&self, session_id: &str) -> Vec<Pane> {
        let panes = self.inner.panes.read().await;
        panes
            .values()
            .filter(|p| p.session_id == session_id)
            .cloned()
            .collect()
    }

    /// Remove a pane
    pub async fn remove_pane(&self, id: &str) {
        let mut panes = self.inner.panes.write().await;
        panes.remove(id);
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
