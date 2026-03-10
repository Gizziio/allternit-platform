use crate::types::{EntityId, Metadata, Status};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Manages active sessions
#[derive(Debug)]
pub struct SessionManager {
    sessions: HashMap<EntityId, Session>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn create_session(&mut self, task_id: EntityId) -> &Session {
        let session = Session::new(task_id);
        let id = session.id();
        self.sessions.insert(id, session);
        self.sessions.get(&id).unwrap()
    }

    pub fn get_session(&self, id: EntityId) -> Option<&Session> {
        self.sessions.get(&id)
    }

    pub fn get_session_mut(&mut self, id: EntityId) -> Option<&mut Session> {
        self.sessions.get_mut(&id)
    }

    pub fn get_task_status(&self, task_id: EntityId) -> Option<Status> {
        self.sessions
            .values()
            .find(|s| s.task_id == task_id)
            .map(|s| s.status)
    }

    pub fn update_task_status(&mut self, task_id: EntityId, status: Status) -> bool {
        if let Some(session) = self.sessions.values_mut().find(|s| s.task_id == task_id) {
            session.status = status;
            session.updated_at = Utc::now();
            true
        } else {
            false
        }
    }

    pub fn remove_session(&mut self, id: EntityId) -> Option<Session> {
        self.sessions.remove(&id)
    }

    pub fn active_sessions(&self) -> Vec<&Session> {
        self.sessions
            .values()
            .filter(|s| !s.status.is_terminal())
            .collect()
    }

    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// A session tracking a task execution
#[derive(Debug, Clone)]
pub struct Session {
    metadata: Metadata,
    pub task_id: EntityId,
    pub status: Status,
    pub mode: Option<String>,
    pub current_phase: Option<String>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl Session {
    pub fn new(task_id: EntityId) -> Self {
        let now = Utc::now();
        Self {
            metadata: Metadata::new(),
            task_id,
            status: Status::Pending,
            mode: None,
            current_phase: None,
            started_at: now,
            updated_at: now,
            completed_at: None,
        }
    }

    pub fn id(&self) -> EntityId {
        self.metadata.id
    }

    pub fn set_mode(&mut self, mode: impl Into<String>) {
        self.mode = Some(mode.into());
        self.updated_at = Utc::now();
    }

    pub fn set_phase(&mut self, phase: impl Into<String>) {
        self.current_phase = Some(phase.into());
        self.updated_at = Utc::now();
    }

    pub fn set_status(&mut self, status: Status) {
        self.status = status;
        if status.is_terminal() {
            self.completed_at = Some(Utc::now());
        }
        self.updated_at = Utc::now();
    }

    pub fn duration_secs(&self) -> f64 {
        let end = self.completed_at.unwrap_or_else(Utc::now);
        (end - self.started_at).num_seconds() as f64
    }
}
