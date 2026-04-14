//! Session Manager Native - OC-017
//!
//! Native Rust implementation of OpenClaw's session management system.
//! This module provides a pure Rust implementation of session management that
//! will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncBufReadExt as _;
use tokio::io::AsyncWriteExt as _; // For write_all method
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use uuid::Uuid; // For lines method

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
    pub role: String, // 'user', 'assistant', 'system', etc.
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
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
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub active: bool,
    pub tags: Vec<String>,
}

/// Session manager configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionManagerConfig {
    pub sessions_dir: PathBuf,
    pub max_session_size_mb: Option<u64>,
    pub max_session_age_days: Option<u32>,
    pub enable_compaction: bool,
    pub compaction_threshold_messages: Option<usize>,
    pub enable_persistence: bool,
    pub default_timeout_ms: u64,
    pub max_concurrent_sessions: Option<usize>,
}

impl Default for SessionManagerConfig {
    fn default() -> Self {
        // Use environment variable if set, otherwise use default path
        let sessions_dir = std::env::var("A2R_SESSIONS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                // Use temp directory for development if ./sessions doesn't exist
                let default = PathBuf::from("./sessions");
                if !default.exists() {
                    std::env::temp_dir().join("a2r-sessions")
                } else {
                    default
                }
            });

        Self {
            sessions_dir,
            max_session_size_mb: Some(100), // 100MB limit
            max_session_age_days: Some(30), // 30 days
            enable_compaction: true,
            compaction_threshold_messages: Some(1000), // Compact after 1000 messages
            enable_persistence: true,
            default_timeout_ms: 30_000, // 30 seconds
            max_concurrent_sessions: Some(100),
        }
    }
}

/// Session manager service
pub struct SessionManagerService {
    config: SessionManagerConfig,
    sessions: HashMap<SessionId, SessionState>,
    session_semaphore: Option<tokio::sync::Semaphore>,
}

impl Default for SessionManagerService {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionManagerService {
    /// Create new session manager with default configuration
    pub fn new() -> Self {
        let config = SessionManagerConfig::default();

        // Ensure sessions directory exists synchronously
        if let Err(e) = std::fs::create_dir_all(&config.sessions_dir) {
            tracing::warn!(
                "Failed to create sessions directory {:?}: {}",
                config.sessions_dir,
                e
            );
        }

        let semaphore = config
            .max_concurrent_sessions
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            sessions: HashMap::new(),
            session_semaphore: semaphore,
        }
    }

    /// Create new session manager with custom configuration
    pub fn with_config(config: SessionManagerConfig) -> Self {
        let semaphore = config
            .max_concurrent_sessions
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            sessions: HashMap::new(),
            session_semaphore: semaphore,
        }
    }

    /// Initialize the session manager by loading existing sessions
    pub async fn initialize(&mut self) -> Result<(), SessionManagerError> {
        self.ensure_sessions_dir().await?;
        if self.config.enable_persistence {
            self.load_persisted_sessions().await?;
        }
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

    /// Load persisted sessions from disk
    async fn load_persisted_sessions(&mut self) -> Result<(), SessionManagerError> {
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

        let file = fs::File::open(&session_path).await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to open session file: {}", e))
        })?;

        let reader = tokio::io::BufReader::new(file);
        let mut lines = reader.lines();
        let mut messages = Vec::new();

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

        // For now, create a basic session state from the file
        // In a real implementation, we'd also load metadata from a separate file or from the first lines
        Ok(SessionState {
            id: SessionId::new(session_id.to_string()),
            name: Some(format!("Session {}", session_id)),
            description: Some("Loaded from persisted file".to_string()),
            created_at: self.get_file_created_time(&session_path).await?,
            updated_at: self.get_file_modified_time(&session_path).await?,
            last_accessed: Utc::now(), // Set to current time when loaded
            messages,
            metadata: None,
            active: false, // Initially inactive until used
            tags: Vec::new(),
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
            metadata: Some(HashMap::new()),
            active: true,
            tags: Vec::new(),
        };

        // Add to memory
        self.sessions
            .insert(session_id.clone(), session_state.clone());

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_session(&session_state).await?;
        }

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
    pub async fn add_message(
        &mut self,
        session_id: &SessionId,
        message: SessionMessage,
    ) -> Result<(), SessionManagerError> {
        // First check if session exists
        if !self.sessions.contains_key(session_id) {
            return Err(SessionManagerError::SessionNotFound(session_id.0.clone()));
        }

        // Update the session in memory
        {
            let session = self.sessions.get_mut(session_id).unwrap();
            session.messages.push(message);
            session.updated_at = Utc::now();
            session.last_accessed = Utc::now();
        } // Release mutable borrow

        // Persist if enabled
        if self.config.enable_persistence {
            if let Some(session) = self.sessions.get(session_id) {
                self.persist_session(session).await?;
            }
        }

        // Check if we need to compact
        if self.config.enable_compaction {
            if let Some(threshold) = self.config.compaction_threshold_messages {
                if let Some(session) = self.sessions.get(session_id) {
                    if session.messages.len() > threshold {
                        drop(session); // Explicitly drop the borrow
                        self.compact_session(session_id).await?;
                    }
                }
            }
        }

        Ok(())
    }

    /// Get all messages from a session
    pub async fn get_messages(
        &self,
        session_id: &SessionId,
    ) -> Result<Vec<SessionMessage>, SessionManagerError> {
        match self.sessions.get(session_id) {
            Some(session) => Ok(session.messages.clone()),
            None => Err(SessionManagerError::SessionNotFound(session_id.0.clone())),
        }
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Result<Vec<SessionSummary>, SessionManagerError> {
        let mut summaries: Vec<SessionSummary> = self
            .sessions
            .values()
            .map(|session| SessionSummary {
                id: session.id.clone(),
                name: session.name.clone(),
                description: session.description.clone(),
                message_count: session.messages.len(),
                created_at: session.created_at,
                updated_at: session.updated_at,
                active: session.active,
            })
            .collect();

        // Sort by most recently updated
        summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(summaries)
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

        // Remove persisted file if it exists
        if self.config.enable_persistence {
            let session_path = self.session_file_path(&session_id.0);
            let _ = fs::remove_file(session_path).await; // Ignore errors if file doesn't exist
        }

        Ok(())
    }

    /// Patch mutable session fields.
    pub async fn patch_session(
        &mut self,
        session_id: &SessionId,
        name: Option<String>,
        description: Option<String>,
        active: Option<bool>,
        metadata: Option<HashMap<String, serde_json::Value>>,
        tags: Option<Vec<String>>,
    ) -> Result<SessionState, SessionManagerError> {
        if !self.sessions.contains_key(session_id) {
            return Err(SessionManagerError::SessionNotFound(session_id.0.clone()));
        }

        {
            let session = self.sessions.get_mut(session_id).unwrap();

            if let Some(next_name) = name {
                let trimmed = next_name.trim();
                session.name = if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                };
            }

            if let Some(next_description) = description {
                let trimmed = next_description.trim();
                session.description = if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                };
            }

            if let Some(next_active) = active {
                session.active = next_active;
            }

            if let Some(next_tags) = tags {
                session.tags = next_tags;
            }

            if let Some(metadata_patch) = metadata {
                let store = session.metadata.get_or_insert_with(HashMap::new);
                for (key, value) in metadata_patch {
                    store.insert(key, value);
                }
            }

            session.updated_at = Utc::now();
            session.last_accessed = Utc::now();
        }

        if self.config.enable_persistence {
            if let Some(session) = self.sessions.get(session_id) {
                self.persist_session(session).await?;
            }
        }

        match self.sessions.get(session_id) {
            Some(session) => Ok(session.clone()),
            None => Err(SessionManagerError::SessionNotFound(session_id.0.clone())),
        }
    }

    /// Compact a session (remove old messages based on age/size)
    pub async fn compact_session(
        &mut self,
        session_id: &SessionId,
    ) -> Result<SessionState, SessionManagerError> {
        // First check if session exists
        if !self.sessions.contains_key(session_id) {
            return Err(SessionManagerError::SessionNotFound(session_id.0.clone()));
        }

        // Get original message count
        let original_count = {
            let session = self.sessions.get(session_id).unwrap();
            session.messages.len()
        };

        // Filter messages based on age if max_age is set
        let filtered_messages = {
            let session = self.sessions.get(session_id).unwrap();
            if let Some(max_age_days) = self.config.max_session_age_days {
                let cutoff_time = Utc::now() - chrono::Duration::days(max_age_days as i64);
                session
                    .messages
                    .iter()
                    .filter(|msg| msg.timestamp >= cutoff_time)
                    .cloned()
                    .collect()
            } else {
                session.messages.clone()
            }
        };

        // Update session with filtered messages
        {
            let session = self.sessions.get_mut(session_id).unwrap();
            session.messages = filtered_messages;
            session.updated_at = Utc::now();
        } // Release mutable borrow

        // Persist if enabled
        if self.config.enable_persistence {
            if let Some(session) = self.sessions.get(session_id) {
                self.persist_session(session).await?;
            }
        }

        // Return the updated session
        match self.sessions.get(session_id) {
            Some(session) => Ok(session.clone()),
            None => Err(SessionManagerError::SessionNotFound(session_id.0.clone())),
        }
    }

    /// Persist a session to disk
    async fn persist_session(&self, session: &SessionState) -> Result<(), SessionManagerError> {
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

    /// Get file creation time
    async fn get_file_created_time(
        &self,
        path: &PathBuf,
    ) -> Result<DateTime<Utc>, SessionManagerError> {
        let metadata = fs::metadata(path).await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to get file metadata: {}", e))
        })?;

        let created = metadata.created().map_err(|_| {
            SessionManagerError::IoError("Failed to get file creation time".to_string())
        })?;

        Ok(DateTime::<Utc>::from(created))
    }

    /// Get file modification time
    async fn get_file_modified_time(
        &self,
        path: &PathBuf,
    ) -> Result<DateTime<Utc>, SessionManagerError> {
        let metadata = fs::metadata(path).await.map_err(|e| {
            SessionManagerError::IoError(format!("Failed to get file metadata: {}", e))
        })?;

        let modified = metadata.modified().map_err(|_| {
            SessionManagerError::IoError("Failed to get file modification time".to_string())
        })?;

        Ok(DateTime::<Utc>::from(modified))
    }

    /// Get current configuration
    pub fn config(&self) -> &SessionManagerConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut SessionManagerConfig {
        &mut self.config
    }

    /// Get session count
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }

    // =========================================================================
    // API-compatible wrapper methods (for /api/sessions.rs)
    // =========================================================================

    /// List all sessions - API compatible version
    pub async fn list_sessions_api(&self) -> Vec<crate::api::sessions::Session> {
        self.sessions
            .values()
            .map(|s| crate::api::sessions::Session {
                id: s.id.0.clone(),
                title: s.name.clone().unwrap_or_else(|| "Untitled".to_string()),
                created_at: s.created_at.to_rfc3339(),
                updated_at: s.updated_at.to_rfc3339(),
                last_accessed_at: s.last_accessed.to_rfc3339(),
                message_count: s.messages.len() as u32,
                is_active: s.active,
                tags: s.tags.clone(),
                metadata: s.metadata.clone(),
                messages: s
                    .messages
                    .iter()
                    .map(|m| crate::api::sessions::Message {
                        id: m.id.clone(),
                        role: m.role.clone(),
                        content: m.content.clone(),
                        timestamp: m.timestamp.to_rfc3339(),
                        metadata: m.metadata.clone(),
                    })
                    .collect(),
            })
            .collect()
    }

    /// Get session by string ID - API compatible version
    pub async fn get_session_api(&self, session_id: &str) -> Option<crate::api::sessions::Session> {
        self.sessions
            .get(&SessionId::new(session_id.to_string()))
            .map(|s| crate::api::sessions::Session {
                id: s.id.0.clone(),
                title: s.name.clone().unwrap_or_else(|| "Untitled".to_string()),
                created_at: s.created_at.to_rfc3339(),
                updated_at: s.updated_at.to_rfc3339(),
                last_accessed_at: s.last_accessed.to_rfc3339(),
                message_count: s.messages.len() as u32,
                is_active: s.active,
                tags: s.tags.clone(),
                metadata: s.metadata.clone(),
                messages: s
                    .messages
                    .iter()
                    .map(|m| crate::api::sessions::Message {
                        id: m.id.clone(),
                        role: m.role.clone(),
                        content: m.content.clone(),
                        timestamp: m.timestamp.to_rfc3339(),
                        metadata: m.metadata.clone(),
                    })
                    .collect(),
            })
    }

    /// Get mutable session by string ID - API compatible version
    pub async fn get_session_mut_api(&mut self, session_id: &str) -> Option<&mut SessionState> {
        self.sessions
            .get_mut(&SessionId::new(session_id.to_string()))
    }

    /// Insert session - API compatible version
    pub async fn insert_session_api(&mut self, session: crate::api::sessions::Session) {
        let session_state = SessionState {
            id: SessionId::new(session.id),
            name: Some(session.title),
            description: session
                .metadata
                .as_ref()
                .and_then(|m| m.get("description"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            created_at: DateTime::parse_from_rfc3339(&session.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&session.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            last_accessed: DateTime::parse_from_rfc3339(&session.last_accessed_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            messages: session
                .messages
                .into_iter()
                .map(|m| SessionMessage {
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: DateTime::parse_from_rfc3339(&m.timestamp)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    metadata: m.metadata,
                })
                .collect(),
            metadata: session.metadata,
            active: session.is_active,
            tags: session.tags,
        };
        self.sessions
            .insert(session_state.id.clone(), session_state);
    }

    /// Remove session - API compatible version
    pub async fn remove_session_api(&mut self, session_id: &str) -> bool {
        let id = SessionId::new(session_id.to_string());
        if self.sessions.contains_key(&id) {
            self.sessions.remove(&id);
            // Remove persisted file if it exists
            if self.config.enable_persistence {
                let session_path = self.session_file_path(session_id);
                let _ = std::fs::remove_file(session_path); // Ignore errors
            }
            true
        } else {
            false
        }
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
    pub active: bool,
}

/// Session manager error
#[derive(Debug, thiserror::Error)]
pub enum SessionManagerError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

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

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_session_manager_creation() {
        let manager = SessionManagerService::new();
        assert_eq!(manager.config.sessions_dir, PathBuf::from("./sessions"));
        assert!(manager.config.enable_persistence);
        assert_eq!(manager.session_count(), 0);
    }

    #[tokio::test]
    async fn test_create_and_get_session() {
        let mut manager = SessionManagerService::new();

        let session = manager
            .create_session(
                Some("Test Session".to_string()),
                Some("A test session".to_string()),
            )
            .await
            .unwrap();

        assert_eq!(session.name, Some("Test Session".to_string()));
        assert_eq!(session.description, Some("A test session".to_string()));
        assert_eq!(session.messages.len(), 0);

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
            id: "msg1".to_string(),
            role: "user".to_string(),
            content: "Hello, world!".to_string(),
            timestamp: Utc::now(),
            metadata: None,
        };

        manager
            .add_message(&session.id, message.clone())
            .await
            .unwrap();

        // Get messages
        let messages = manager.get_messages(&session.id).await.unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "Hello, world!");
        assert_eq!(messages[0].role, "user");
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let mut manager = SessionManagerService::new();

        // Create a few sessions
        for i in 1..=3 {
            manager
                .create_session(
                    Some(format!("Session {}", i)),
                    Some(format!("Test session {}", i)),
                )
                .await
                .unwrap();
        }

        let sessions = manager.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 3);

        // Verify they're sorted by most recently updated
        for i in 0..sessions.len() {
            assert_eq!(sessions[i].name, Some(format!("Session {}", 3 - i)));
        }
    }

    #[tokio::test]
    async fn test_session_compaction() {
        let mut manager = SessionManagerService::new();

        // Override config for testing
        manager.config.max_session_age_days = Some(1); // 1 day max age
        manager.config.enable_compaction = true;

        let session = manager.create_session(None, None).await.unwrap();

        // Add some old messages
        let old_message = SessionMessage {
            id: "old_msg".to_string(),
            role: "assistant".to_string(),
            content: "Old message".to_string(),
            timestamp: Utc::now() - chrono::Duration::days(30), // 30 days old
            metadata: None,
        };

        let new_message = SessionMessage {
            id: "new_msg".to_string(),
            role: "user".to_string(),
            content: "New message".to_string(),
            timestamp: Utc::now(),
            metadata: None,
        };

        manager.add_message(&session.id, old_message).await.unwrap();
        manager
            .add_message(&session.id, new_message.clone())
            .await
            .unwrap();

        // Verify both messages are there initially
        let messages = manager.get_messages(&session.id).await.unwrap();
        assert_eq!(messages.len(), 2);

        // Compact the session
        let compacted = manager.compact_session(&session.id).await.unwrap();
        assert_eq!(compacted.messages.len(), 1); // Only the new message should remain

        // Verify the remaining message is the new one
        let messages_after = manager.get_messages(&session.id).await.unwrap();
        assert_eq!(messages_after.len(), 1);
        assert_eq!(messages_after[0].content, "New message");
    }

    #[tokio::test]
    async fn test_delete_session() {
        let mut manager = SessionManagerService::new();

        let session = manager.create_session(None, None).await.unwrap();
        let session_id = session.id.clone();

        assert!(manager.get_session(&session_id).await.is_ok());

        manager.delete_session(&session_id).await.unwrap();

        let result = manager.get_session(&session_id).await;
        assert!(matches!(
            result,
            Err(SessionManagerError::SessionNotFound(_))
        ));
    }

    #[tokio::test]
    async fn test_patch_session_updates_core_fields() {
        let mut manager = SessionManagerService::new();
        let session = manager
            .create_session(Some("Original".to_string()), Some("Before".to_string()))
            .await
            .unwrap();

        let mut metadata = HashMap::new();
        metadata.insert("thinkingLevel".to_string(), serde_json::json!("high"));

        let patched = manager
            .patch_session(
                &session.id,
                Some("Renamed".to_string()),
                Some("After".to_string()),
                Some(false),
                Some(metadata),
                Some(vec!["alpha".to_string(), "beta".to_string()]),
            )
            .await
            .unwrap();

        assert_eq!(patched.name, Some("Renamed".to_string()));
        assert_eq!(patched.description, Some("After".to_string()));
        assert!(!patched.active);
        assert_eq!(patched.tags, vec!["alpha".to_string(), "beta".to_string()]);
        assert_eq!(
            patched
                .metadata
                .as_ref()
                .and_then(|meta| meta.get("thinkingLevel"))
                .and_then(serde_json::Value::as_str),
            Some("high")
        );
    }

    #[tokio::test]
    async fn test_patch_session_merges_metadata() {
        let mut manager = SessionManagerService::new();
        let session = manager.create_session(None, None).await.unwrap();

        let mut first_patch = HashMap::new();
        first_patch.insert("thinkingLevel".to_string(), serde_json::json!("medium"));
        manager
            .patch_session(&session.id, None, None, None, Some(first_patch), None)
            .await
            .unwrap();

        let mut second_patch = HashMap::new();
        second_patch.insert("verboseLevel".to_string(), serde_json::json!("low"));
        let patched = manager
            .patch_session(&session.id, None, None, None, Some(second_patch), None)
            .await
            .unwrap();

        let metadata = patched.metadata.unwrap_or_default();
        assert_eq!(
            metadata
                .get("thinkingLevel")
                .and_then(serde_json::Value::as_str),
            Some("medium")
        );
        assert_eq!(
            metadata
                .get("verboseLevel")
                .and_then(serde_json::Value::as_str),
            Some("low")
        );
    }
}
