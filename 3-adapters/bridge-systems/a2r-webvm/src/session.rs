use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::Utc;

use crate::types::{SessionInfo, SessionCreateResponse};

#[derive(Debug, Clone)]
pub struct VMSession {
    pub session_id: String,
    pub status: String,
    pub created_at: i64,
    pub url: String,
    pub memory_mb: u32,
    pub cpu_cores: u32,
    pub terminal_output: Vec<String>,
}

impl VMSession {
    pub fn new(url: String) -> Self {
        let session_id = Uuid::new_v4().to_string();
        Self {
            url: format!("{}/{}", url, session_id),
            session_id: session_id.clone(),
            status: "running".to_string(),
            created_at: Utc::now().timestamp_millis(),
            memory_mb: 512,
            cpu_cores: 2,
            terminal_output: Vec::new(),
        }
    }

    pub fn to_info(&self) -> SessionInfo {
        SessionInfo {
            session_id: self.session_id.clone(),
            status: self.status.clone(),
            created_at: self.created_at,
            url: self.url.clone(),
            memory_mb: self.memory_mb,
            cpu_cores: self.cpu_cores,
        }
    }
}

#[derive(Debug)]
pub struct SessionManager {
    base_url: String,
    sessions: Arc<RwLock<HashMap<String, VMSession>>>,
}

impl SessionManager {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_session(&self, _disk_image: Option<String>) -> Result<SessionCreateResponse> {
        let session = VMSession::new(self.base_url.clone());
        let session_id = session.session_id.clone();

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), session);
        }

        tracing::info!("Created WebVM session: {}", session_id);

        Ok(SessionCreateResponse {
            session_id: session_id.clone(),
            status: "running".to_string(),
            url: format!("{}/{}", self.base_url, session_id),
        })
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<SessionInfo>> {
        let sessions = self.sessions.read().await;
        Ok(sessions.get(session_id).map(|s| s.to_info()))
    }

    pub async fn list_sessions(&self) -> Result<Vec<SessionInfo>> {
        let sessions = self.sessions.read().await;
        Ok(sessions.values().map(|s| s.to_info()).collect())
    }

    pub async fn stop_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        match sessions.remove(session_id) {
            Some(_) => {
                tracing::info!("Stopped WebVM session: {}", session_id);
                Ok(())
            }
            None => anyhow::bail!("Session not found: {}", session_id),
        }
    }

    pub async fn add_terminal_output(&self, session_id: &str, output: String) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.terminal_output.push(output);
            tracing::debug!("Added terminal output to session {}", session_id);
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}
