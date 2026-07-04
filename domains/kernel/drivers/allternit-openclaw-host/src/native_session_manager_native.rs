//! Session Manager Native - OC-028
//!
//! Native Rust implementation of OpenClaw's session management system.
//! This module provides a pure Rust implementation of session management that
//! will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use uuid::Uuid;

/// Session identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SessionId(String);

impl SessionId {
    pub fn new(id: String) -> Self {
        Self(id)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Session message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub role: String, // 'user', 'assistant', 'system', 'tool'
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub sessions_dir: PathBuf,
    pub enable_persistence: bool,
    pub enable_compaction: bool,
    pub compaction_threshold_messages: Option<usize>,
    pub compaction_threshold_days: Option<u32>,
    pub max_session_age_days: Option<u32>,
    pub max_session_size_mb: Option<u64>,
    pub enable_history: bool,
    pub history_limit: Option<usize>,
    pub enable_encryption: bool,
    pub encryption_key: Option<String>,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            sessions_dir: PathBuf::from("./sessions"),
            enable_persistence: true,
            enable_compaction: true,
            compaction_threshold_messages: Some(1000),
            compaction_threshold_days: Some(30),
            max_session_age_days: Some(90),
            max_session_size_mb: Some(100), // 100MB limit
            enable_history: true,
            history_limit: Some(10000),
            enable_encryption: false,
            encryption_key: None,
        }
    }
}

/// Session state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub id: SessionId,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub messages: Vec<SessionMessage>,
    pub active: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Session manager service
pub struct SessionManagerService {
    config: SessionConfig,
    sessions: HashMap<SessionId, SessionState>,
    active_sessions: HashMap<SessionId, tokio::sync::Mutex<()>>, // Mutex to prevent concurrent writes
}

impl Default for SessionManagerService {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionManagerService {
    /// Create new session manager with default configuration
    pub fn new() -> Self {
        Self {
            config: SessionConfig::default(),
            sessions: HashMap::new(),
            active_sessions: HashMap::new(),
        }
    }

    /// Create new session manager with custom configuration
    pub fn with_config(config: SessionConfig) -> Self {
        Self {
            config,
            sessions: HashMap::new(),
            active_sessions: HashMap::new(),
        }
    }

    /// Initialize the service by loading existing sessions
    pub async fn initialize(&mut self) -> Result<(), SessionManagerError> {
        self.ensure_sessions_dir().await?;
        self.load_existing_sessions().await?;
        Ok(())
    }

    /// Ensure the sessions directory exists
    async fn ensure_sessions_dir(&self) -> Result<(), SessionManagerError> {
        fs::create_dir_all(&self.config.sessions_dir)
            .await
            .map_err(|e| {
                SessionManagerError::IoError(format!("Failed to create sessions directory: {}", e))
            })
    }

    /// Load existing sessions from disk
    async fn load_existing_sessions(&mut self) -> Result<(), SessionManagerError> {
        if !self.config.sessions_dir.exists() {
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.sessions_dir).await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to read sessions directory: {}", e))
        })?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(session_state) = self.load_session_from_file(file_stem).await {
                        self.sessions
                            .insert(session_state.id.clone(), session_state);
                    }
                }
            }
        }

        Ok(())
    }

    /// Load a session from its JSONL file
    async fn load_session_from_file(
        &self,
        session_id: &str,
    ) -> Result<SessionState, SessionManagerError> {
        let session_path = self.session_file_path(session_id);

        if !session_path.exists() {
            return Err(SessionManagerError::SessionNotFound(session_id.to_string()));
        }

        let mut messages = Vec::new();
        let file = tokio::fs::File::open(&session_path).await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to open session file: {}", e))
        })?;

        let reader = tokio::io::BufReader::new(file);
        let mut lines = reader.lines();

        while let Some(line) = lines.next_line().await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to read session file: {}", e))
        })? {
            if !line.trim().is_empty() {
                match serde_json::from_str::<SessionMessage>(&line) {
                    Ok(message) => messages.push(message),
                    Err(_) => {
                        // Skip invalid lines - similar to OpenClaw's behavior
                        continue;
                    }
                }
            }
        }

        // Get file metadata for timestamps
        let metadata = fs::metadata(&session_path).await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to get session file metadata: {}", e))
        })?;

        let created_at = metadata.created().map_err(|_| {
            SessionManagerError::IoError("Failed to get file creation time".to_string())
        })?;
        let modified_at = metadata.modified().map_err(|_| {
            SessionManagerError::IoError("Failed to get file modification time".to_string())
        })?;

        Ok(SessionState {
            id: SessionId::new(session_id.to_string()),
            name: Some(format!("Session {}", session_id)),
            description: Some("Loaded from persisted file".to_string()),
            created_at: DateTime::<Utc>::from(created_at),
            updated_at: DateTime::<Utc>::from(modified_at),
            last_accessed: Utc::now(),
            messages,
            active: false, // Initially inactive until used
            metadata: None,
        })
    }

    /// Create a new session
    pub async fn create_session(
        &mut self,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<SessionState, SessionManagerError> {
        let session_id = SessionId::new(Uuid::new_v4().to_string());

        let session_state = SessionState {
            id: session_id.clone(),
            name,
            description,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_accessed: Utc::now(),
            messages: Vec::new(),
            active: true,
            metadata: Some({
                let mut meta = HashMap::new();
                meta.insert(
                    "created_by".to_string(),
                    serde_json::Value::String("allternit-native".to_string()),
                );
                meta
            }),
        };

        // Add to registry
        self.sessions
            .insert(session_id.clone(), session_state.clone());

        // Create the session file
        if self.config.enable_persistence {
            let session_path = self.session_file_path(&session_state.id.0);
            fs::File::create(&session_path).await.map_err(|e| {
                SessionManagerError::IoError(format!("Failed to create session file: {}", e))
            })?;
        }

        // Add to active sessions
        self.active_sessions
            .insert(session_id.clone(), tokio::sync::Mutex::new(()));

        Ok(session_state)
    }

    /// Get a session by ID
    pub async fn get_session(
        &self,
        session_id: &SessionId,
    ) -> Result<SessionState, SessionManagerError> {
        match self.sessions.get(session_id) {
            Some(session) => Ok(session.clone()),
            None => Err(SessionManagerError::SessionNotFound(session_id.0.clone())),
        }
    }

    /// Add a message to a session
    pub async fn add_message_to_session(
        &mut self,
        session_id: &SessionId,
        message: SessionMessage,
    ) -> Result<(), SessionManagerError> {
        if !self.sessions.contains_key(session_id) {
            return Err(SessionManagerError::SessionNotFound(session_id.0.clone()));
        }

        // Acquire lock to prevent concurrent writes to the same session
        let _lock = if let Some(lock) = self.active_sessions.get(session_id) {
            lock.lock().await
        } else {
            // Create a new lock if one doesn't exist
            self.active_sessions
                .insert(session_id.clone(), tokio::sync::Mutex::new(()));
            self.active_sessions.get(session_id).unwrap().lock().await
        };

        // Update the session in memory
        {
            let session = self.sessions.get_mut(session_id).unwrap();
            session.messages.push(message);
            session.updated_at = Utc::now();
            session.last_accessed = Utc::now();
        }

        // Persist to disk if enabled
        if self.config.enable_persistence {
            if let Some(session) = self.sessions.get(session_id) {
                self.persist_session_to_file(session).await?;
            }
        }

        // Check if compaction is needed
        if self.config.enable_compaction {
            if let Some(threshold) = self.config.compaction_threshold_messages {
                if let Some(session) = self.sessions.get(session_id) {
                    if session.messages.len() >= threshold {
                        drop(_lock); // Release lock before compacting to avoid deadlock
                        self.compact_session(session_id).await?;
                        return Ok(());
                    }
                }
            }
        }

        Ok(())
    }

    /// Get messages from a session
    pub async fn get_session_messages(
        &self,
        session_id: &SessionId,
    ) -> Result<Vec<SessionMessage>, SessionManagerError> {
        if !self.sessions.contains_key(session_id) {
            return Err(SessionManagerError::SessionNotFound(session_id.0.clone()));
        }

        let session = self.sessions.get(session_id).unwrap();
        Ok(session.messages.clone())
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Result<Vec<SessionSummary>, SessionManagerError> {
        let mut sessions: Vec<SessionSummary> = self
            .sessions
            .values()
            .map(|session| SessionSummary {
                id: session.id.clone(),
                name: session.name.clone(),
                description: session.description.clone(),
                message_count: session.messages.len(),
                created_at: session.created_at,
                updated_at: session.updated_at,
                last_accessed: session.last_accessed,
                active: session.active,
            })
            .collect();

        // Sort by most recently updated
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(sessions)
    }

    /// Delete a session
    pub async fn delete_session(
        &mut self,
        session_id: &SessionId,
    ) -> Result<(), SessionManagerError> {
        if !self.sessions.contains_key(session_id) {
            return Err(SessionManagerError::SessionNotFound(session_id.0.clone()));
        }

        // Remove from memory
        self.sessions.remove(session_id);

        // Remove from active sessions
        self.active_sessions.remove(session_id);

        // Remove from disk if it exists
        if self.config.enable_persistence {
            let session_path = self.session_file_path(&session_id.0);
            if session_path.exists() {
                fs::remove_file(&session_path).await.map_err(|e| {
                    SessionManagerError::IoError(format!("Failed to delete session file: {}", e))
                })?;
            }
        }

        Ok(())
    }

    /// Compact a session (remove old messages based on age/size)
    pub async fn compact_session(
        &mut self,
        session_id: &SessionId,
    ) -> Result<SessionState, SessionManagerError> {
        if !self.sessions.contains_key(session_id) {
            return Err(SessionManagerError::SessionNotFound(session_id.0.clone()));
        }

        let session = self.sessions.get_mut(session_id).unwrap();

        let original_count = session.messages.len();

        // Filter messages based on age if max_age is set
        if let Some(max_age_days) = self.config.max_session_age_days {
            let cutoff_time = Utc::now() - chrono::Duration::days(max_age_days as i64);
            session.messages.retain(|msg| msg.timestamp >= cutoff_time);
        }

        // Limit by message count if history limit is set
        if let Some(history_limit) = self.config.history_limit {
            if session.messages.len() > history_limit {
                let start_idx = session.messages.len() - history_limit;
                session.messages.drain(0..start_idx);
            }
        }

        // Update timestamps
        session.updated_at = Utc::now();

        let updated_session = session.clone();
        drop(session);

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_session_to_file(&updated_session).await?;
        }

        Ok(updated_session)
    }

    /// Persist a session to its JSONL file
    async fn persist_session_to_file(
        &self,
        session: &SessionState,
    ) -> Result<(), SessionManagerError> {
        let session_path = self.session_file_path(&session.id.0);

        // Create the session file with all messages in JSONL format
        let mut file = tokio::fs::File::create(&session_path).await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to create session file: {}", e))
        })?;

        for message in &session.messages {
            let json_line = serde_json::to_string(message).map_err(|e| {
                SessionManagerError::SerializationError(format!(
                    "Failed to serialize message: {}",
                    e
                ))
            })?;
            file.write_all(format!("{}\n", json_line).as_bytes())
                .await
                .map_err(|e| {
                    SessionManagerError::IoError(format!("Failed to write to session file: {}", e))
                })?;
        }

        Ok(())
    }

    /// Get the file path for a session
    fn session_file_path(&self, session_id: &str) -> PathBuf {
        self.config
            .sessions_dir
            .join(format!("{}.jsonl", session_id))
    }

    /// Get current configuration
    pub fn config(&self) -> &SessionConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut SessionConfig {
        &mut self.config
    }

    /// Check if a session exists
    pub fn has_session(&self, session_id: &SessionId) -> bool {
        self.sessions.contains_key(session_id)
    }
}

/// Session summary for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: SessionId,
    pub name: Option<String>,
    pub description: Option<String>,
    pub message_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub active: bool,
}

/// Session manager error
#[derive(Debug, thiserror::Error)]
pub enum SessionManagerError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Timeout error")]
    Timeout,
}

impl From<serde_json::Error> for SessionManagerError {
    fn from(error: serde_json::Error) -> Self {
        SessionManagerError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_session_manager_creation() {
        let manager = SessionManagerService::new();
        assert_eq!(manager.config.sessions_dir, PathBuf::from("./sessions"));
        assert!(manager.config.enable_persistence);
        assert_eq!(manager.sessions.len(), 0);
    }

    #[tokio::test]
    async fn test_session_manager_with_config() {
        let config = SessionConfig {
            sessions_dir: PathBuf::from("/tmp/test-sessions"),
            enable_persistence: false,
            max_session_age_days: Some(7),
            max_session_size_mb: Some(50),
            ..Default::default()
        };

        let manager = SessionManagerService::with_config(config);
        assert_eq!(
            manager.config.sessions_dir,
            PathBuf::from("/tmp/test-sessions")
        );
        assert!(!manager.config.enable_persistence);
        assert_eq!(manager.config.max_session_age_days, Some(7));
    }

    #[tokio::test]
    async fn test_create_and_get_session() {
        let mut manager = SessionManagerService::new();

        let session = manager
            .create_session(
                Some("Test Session".to_string()),
                Some("A test session for testing".to_string()),
            )
            .await
            .unwrap();

        assert_eq!(session.name, Some("Test Session".to_string()));
        assert_eq!(
            session.description,
            Some("A test session for testing".to_string())
        );
        assert_eq!(session.messages.len(), 0);
        assert!(session.active);

        // Get the session
        let retrieved = manager.get_session(&session.id).await.unwrap();
        assert_eq!(retrieved.id, session.id);
        assert_eq!(retrieved.name, session.name);
    }

    #[tokio::test]
    async fn test_add_and_get_messages() {
        let mut manager = SessionManagerService::new();

        let session = manager.create_session(None, None).await.unwrap();

        // Add a message
        let message = SessionMessage {
            id: Uuid::new_v4().to_string(),
            role: "user".to_string(),
            content: "Hello, world!".to_string(),
            timestamp: Utc::now(),
            metadata: Some({
                let mut meta = HashMap::new();
                meta.insert("test".to_string(), serde_json::Value::Bool(true));
                meta
            }),
        };

        manager
            .add_message_to_session(&session.id, message.clone())
            .await
            .unwrap();

        // Get messages
        let messages = manager.get_session_messages(&session.id).await.unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "Hello, world!");
        assert_eq!(messages[0].role, "user");
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let mut manager = SessionManagerService::new();

        // Create a few sessions
        for i in 1..=3 {
            let session = manager
                .create_session(
                    Some(format!("Session {}", i)),
                    Some(format!("Test session {}", i)),
                )
                .await
                .unwrap();

            // Add a message to each to update the timestamp
            let message = SessionMessage {
                id: Uuid::new_v4().to_string(),
                role: "system".to_string(),
                content: format!("Created session {}", i),
                timestamp: Utc::now(),
                metadata: None,
            };

            manager
                .add_message_to_session(&session.id, message)
                .await
                .unwrap();
        }

        let sessions = manager.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 3);

        // Verify they're sorted by most recent update
        for i in 0..sessions.len() {
            assert_eq!(sessions[i].name, Some(format!("Session {}", 3 - i)));
        }
    }

    #[tokio::test]
    async fn test_delete_session() {
        let mut manager = SessionManagerService::new();

        let session = manager.create_session(None, None).await.unwrap();
        let session_id = session.id.clone();

        assert!(manager.has_session(&session_id));

        manager.delete_session(&session_id).await.unwrap();

        assert!(!manager.has_session(&session_id));
    }

    #[tokio::test]
    async fn test_session_compaction() {
        let mut manager = SessionManagerService::new();

        // Override config for testing
        manager.config.max_session_age_days = Some(1); // 1 day max age
        manager.config.history_limit = Some(5); // Only keep 5 messages

        let session = manager.create_session(None, None).await.unwrap();

        // Add some old messages
        for i in 1..=3 {
            let old_message = SessionMessage {
                id: format!("old_msg_{}", i),
                role: "assistant".to_string(),
                content: format!("Old message {}", i),
                timestamp: Utc::now() - chrono::Duration::days(30), // 30 days old
                metadata: None,
            };

            manager
                .add_message_to_session(&session.id, old_message)
                .await
                .unwrap();
        }

        // Add some new messages
        for i in 1..=7 {
            let new_message = SessionMessage {
                id: format!("new_msg_{}", i),
                role: "user".to_string(),
                content: format!("New message {}", i),
                timestamp: Utc::now(),
                metadata: None,
            };

            manager
                .add_message_to_session(&session.id, new_message)
                .await
                .unwrap();
        }

        // Verify we have 10 messages initially
        let messages = manager.get_session_messages(&session.id).await.unwrap();
        assert_eq!(messages.len(), 10);

        // Compact the session
        let compacted = manager.compact_session(&session.id).await.unwrap();
        let messages_after = manager.get_session_messages(&session.id).await.unwrap();

        // Should only have the 5 newest messages due to history limit
        assert_eq!(messages_after.len(), 5);
        assert_eq!(compacted.messages.len(), 5);

        // Verify the newest messages are preserved
        for msg in &messages_after {
            assert!(msg.content.starts_with("New message"));
        }
    }

    #[test]
    fn test_session_id_display() {
        let session_id = SessionId::new("test-session".to_string());
        assert_eq!(format!("{}", session_id), "test-session");
    }

    #[test]
    fn test_session_message_structure() {
        let message = SessionMessage {
            id: "msg-123".to_string(),
            role: "assistant".to_string(),
            content: "Hello, user!".to_string(),
            timestamp: Utc::now(),
            metadata: Some({
                let mut meta = HashMap::new();
                meta.insert(
                    "source".to_string(),
                    serde_json::Value::String("test".to_string()),
                );
                meta
            }),
        };

        assert_eq!(message.role, "assistant");
        assert_eq!(message.content, "Hello, user!");
        assert!(message.metadata.is_some());
    }
}
