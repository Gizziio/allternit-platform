//! Git-like session management system for RLM mode
//!
//! This module provides persistent session tracking with commit history,
//! branching, and state snapshots for RLM execution - following
//! Git's model of version control and state management.

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// A Git-like session with commit history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLMSession {
    /// Unique session ID (like Git commit hash)
    pub session_id: String,

    /// Branch name for this session
    pub branch: String,

    /// Human-readable description (commit message)
    pub description: String,

    /// Parent session(s) this is based on
    pub parents: Vec<String>,

    /// Snapshot of execution state at this point
    pub state_snapshot: SessionState,

    /// Metadata (author, timestamp, tags)
    pub metadata: SessionMetadata,

    /// Whether this is the current HEAD
    pub is_head: bool,
}

/// Current execution state snapshot
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionState {
    /// Current context being processed
    pub context: String,

    /// Current recursion depth
    pub recursion_depth: u32,

    /// Execution log (like git diff)
    pub execution_log: Vec<ExecutionEntry>,

    /// Variables in RLM environment
    pub variables: HashMap<String, String>,

    /// Result answer if available
    pub answer: Option<String>,
}

/// Single execution entry (like git commit entry)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEntry {
    /// Entry type
    pub entry_type: EntryType,

    /// Content of the entry
    pub content: String,

    /// Timestamp of entry
    pub timestamp: u64,

    /// Parent entry hash
    pub parent_hash: Option<String>,

    /// This entry's hash
    pub hash: String,
}

/// Types of session entries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntryType {
    /// User input/intent
    Input,

    /// Code execution
    Execution,

    /// LLM generation/response
    Generation,

    /// State mutation
    Mutation,

    /// Error/failure
    Error,

    /// Result/answer
    Result,
}

/// Session metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    /// User or agent who created the session
    pub author: String,

    /// Creation timestamp
    pub created_at: u64,

    /// Tags for categorization
    pub tags: Vec<String>,

    /// Mode used for this session
    pub mode: String,
}

/// Manager for Git-like session operations
#[derive(Debug)]
pub struct SessionManager {
    pool: SqlitePool,
    active_branch: Arc<RwLock<String>>,
    active_session_id: Arc<RwLock<Option<String>>>,
}

impl SessionManager {
    pub async fn new(pool: SqlitePool) -> Result<Self, SessionError> {
        // Initialize database tables
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS rlm_sessions (
                session_id TEXT PRIMARY KEY,
                branch TEXT NOT NULL,
                description TEXT NOT NULL,
                parents TEXT NOT NULL,
                state_snapshot TEXT NOT NULL,
                metadata TEXT NOT NULL,
                is_head INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .map_err(SessionError::Database)?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS session_entries (
                hash TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                parent_hash TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES rlm_sessions(session_id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .map_err(SessionError::Database)?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_sessions_branch ON rlm_sessions(branch)")
            .execute(&pool)
            .await
            .map_err(SessionError::Database)?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_sessions_head ON rlm_sessions(is_head)")
            .execute(&pool)
            .await
            .map_err(SessionError::Database)?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_entries_session ON session_entries(session_id)",
        )
        .execute(&pool)
        .await
        .map_err(SessionError::Database)?;

        // Initialize default branch
        sqlx::query(
            "INSERT OR IGNORE INTO rlm_sessions (session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind("main")
        .bind("main")
        .bind("Initial commit")
        .bind("[]")
        .bind("{}")
        .bind(r#"{"author": "system", "created_at": 0, "tags": [], "mode": "init"}"#)
        .bind(1)
        .bind(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64)
        .execute(&pool)
        .await
        .map_err(SessionError::Database)?;

        let active_branch = Arc::new(RwLock::new("main".to_string()));
        let active_session_id = Arc::new(RwLock::new(None));

        Ok(Self {
            pool,
            active_branch,
            active_session_id,
        })
    }

    /// Create a new session commit (like git commit)
    pub async fn commit(
        &self,
        description: &str,
        state: SessionState,
        parent_hashes: Vec<String>,
        mode: &str,
        author: &str,
    ) -> Result<String, SessionError> {
        let branch = self.active_branch.read().await.clone();
        let session_id = Uuid::new_v4().to_string();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Serialize state snapshot and metadata
        let state_snapshot = serde_json::to_string(&state).map_err(SessionError::Json)?;
        let metadata_json = serde_json::json!({
            "author": author,
            "created_at": now,
            "tags": Vec::<String>::new(),
            "mode": mode
        });
        let metadata = serde_json::to_string(&metadata_json).map_err(SessionError::Json)?;
        let parents_json = serde_json::to_string(&parent_hashes).map_err(SessionError::Json)?;

        // Insert session
        sqlx::query(
            "INSERT INTO rlm_sessions (session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
        )
        .bind(&session_id)
        .bind(&branch)
        .bind(description)
        .bind(&parents_json)
        .bind(&state_snapshot)
        .bind(&metadata)
        .bind(now as i64)
        .execute(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        // Update previous HEAD to not be head
        sqlx::query("UPDATE rlm_sessions SET is_head = 0 WHERE branch = ? AND is_head = 1")
            .bind(&branch)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        // Set new session as HEAD
        sqlx::query("UPDATE rlm_sessions SET is_head = 1 WHERE session_id = ?")
            .bind(&session_id)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        *self.active_session_id.write().await = Some(session_id.clone());

        Ok(session_id)
    }

    /// Create a new branch
    pub async fn branch(
        &self,
        branch_name: &str,
        parent_session_id: Option<&str>,
    ) -> Result<String, SessionError> {
        let session_id = Uuid::new_v4().to_string();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let parents_json = serde_json::to_string(
            &parent_session_id
                .map(|id| vec![id.to_string()])
                .unwrap_or_default(),
        )
        .map_err(SessionError::Json)?;

        let state_snapshot = serde_json::json!({
            "context": "",
            "recursion_depth": 0,
            "execution_log": [],
            "variables": HashMap::<String, String>::new(),
            "answer": None::<String>
        });
        let state_snapshot = serde_json::to_string(&state_snapshot).map_err(SessionError::Json)?;

        let metadata_json = serde_json::json!({
            "author": "system",
            "created_at": now,
            "tags": vec!["branch"],
            "mode": "branch"
        });
        let metadata = serde_json::to_string(&metadata_json).map_err(SessionError::Json)?;

        sqlx::query(
            "INSERT INTO rlm_sessions (session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
        )
        .bind(&session_id)
        .bind(branch_name)
        .bind(format!("Branch from {}", parent_session_id.unwrap_or("initial")))
        .bind(&parents_json)
        .bind(&state_snapshot)
        .bind(&metadata)
        .bind(now as i64)
        .execute(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        // Update current HEAD to point to new branch if same branch
        let current_branch = self.active_branch.read().await.clone();
        if current_branch == branch_name {
            sqlx::query("UPDATE rlm_sessions SET is_head = 0 WHERE branch = ? AND is_head = 1")
                .bind(branch_name)
                .execute(&self.pool)
                .await
                .map_err(SessionError::Database)?;

            sqlx::query("UPDATE rlm_sessions SET is_head = 1 WHERE session_id = ?")
                .bind(&session_id)
                .execute(&self.pool)
                .await
                .map_err(SessionError::Database)?;

            *self.active_session_id.write().await = Some(session_id.clone());
        }

        Ok(session_id)
    }

    /// Switch to a different branch
    pub async fn checkout(&self, session_id: &str) -> Result<RLMSession, SessionError> {
        // Get session
        let row = sqlx::query(
            "SELECT session_id, branch, description, parents, state_snapshot, metadata, is_head
            FROM rlm_sessions WHERE session_id = ?",
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(SessionError::Database)?
        .ok_or_else(|| SessionError::NotFound(format!("Session {} not found", session_id)))?;

        let session: RLMSession = Self::row_to_session(row);

        // Update HEAD pointers
        let branch = &session.branch;
        sqlx::query("UPDATE rlm_sessions SET is_head = 0 WHERE branch = ?")
            .bind(branch)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        sqlx::query("UPDATE rlm_sessions SET is_head = 1 WHERE session_id = ?")
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        *self.active_branch.write().await = branch.clone();
        *self.active_session_id.write().await = Some(session_id.to_string());

        Ok(session)
    }

    /// Get session history (like git log)
    pub async fn log(
        &self,
        limit: Option<usize>,
        branch: Option<&str>,
    ) -> Result<Vec<RLMSession>, SessionError> {
        let query = if let Some(branch) = branch {
            sqlx::query(
                "SELECT session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at
                FROM rlm_sessions
                WHERE branch = ?
                ORDER BY created_at DESC
                LIMIT ?"
            )
            .bind(branch)
            .bind(limit.unwrap_or(100) as i64)
        } else {
            sqlx::query(
                "SELECT session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at
                FROM rlm_sessions
                ORDER BY created_at DESC
                LIMIT ?"
            )
            .bind(limit.unwrap_or(100) as i64)
        };

        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        let sessions = rows
            .into_iter()
            .map(Self::row_to_session)
            .collect::<Vec<_>>();
        Ok(sessions)
    }

    /// Get current HEAD session
    pub async fn head(&self) -> Result<Option<RLMSession>, SessionError> {
        let branch = self.active_branch.read().await.clone();

        let row = sqlx::query(
            "SELECT session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at
            FROM rlm_sessions
            WHERE branch = ? AND is_head = 1"
        )
        .bind(&branch)
        .fetch_optional(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        Ok(row.map(Self::row_to_session))
    }

    /// Add execution entry to session log
    pub async fn add_entry(
        &self,
        session_id: &str,
        entry: ExecutionEntry,
    ) -> Result<String, SessionError> {
        let entry_hash = Uuid::new_v4().to_string();
        let entry_type_str = format!("{:?}", entry.entry_type);
        let parent_hash = entry.parent_hash.clone();

        sqlx::query(
            "INSERT INTO session_entries (hash, session_id, entry_type, content, timestamp, parent_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&entry_hash)
        .bind(session_id)
        .bind(&entry_type_str)
        .bind(&entry.content)
        .bind(entry.timestamp as i64)
        .bind(&parent_hash)
        .bind(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64)
        .execute(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        Ok(entry_hash)
    }

    /// Get execution entries for a session
    pub async fn get_entries(
        &self,
        session_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<ExecutionEntry>, SessionError> {
        let limit = limit.unwrap_or(100) as i64;

        let rows = sqlx::query(
            "SELECT hash, session_id, entry_type, content, timestamp, parent_hash
            FROM session_entries
            WHERE session_id = ?
            ORDER BY timestamp ASC
            LIMIT ?",
        )
        .bind(session_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        let entries = rows.into_iter().map(Self::row_to_entry).collect();

        Ok(entries)
    }

    /// Reset session to initial state
    pub async fn reset(&self) -> Result<(), SessionError> {
        let default_session_id = Uuid::new_v4().to_string();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let state_snapshot = serde_json::json!({
            "context": "",
            "recursion_depth": 0,
            "execution_log": [],
            "variables": HashMap::<String, String>::new(),
            "answer": None::<String>
        });
        let state_snapshot = serde_json::to_string(&state_snapshot).map_err(SessionError::Json)?;

        let metadata_json = serde_json::json!({
            "author": "system",
            "created_at": now,
            "tags": vec!["reset"],
            "mode": "reset"
        });
        let metadata = serde_json::to_string(&metadata_json).map_err(SessionError::Json)?;

        sqlx::query(
            "INSERT INTO rlm_sessions (session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
        )
        .bind(&default_session_id)
        .bind("main")
        .bind("Session reset")
        .bind("[]")
        .bind(&state_snapshot)
        .bind(&metadata)
        .bind(now as i64)
        .execute(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        *self.active_session_id.write().await = Some(default_session_id);

        Ok(())
    }

    /// Reset session to a specific commit (like git reset --hard <commit>)
    pub async fn reset_to_commit(&self, session_id: &str) -> Result<RLMSession, SessionError> {
        // Verify the session exists
        let session = self.get_session(session_id).await?;

        // Update HEAD to point to the specified session
        let branch = &session.branch;
        sqlx::query("UPDATE rlm_sessions SET is_head = 0 WHERE branch = ?")
            .bind(branch)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        sqlx::query("UPDATE rlm_sessions SET is_head = 1 WHERE session_id = ?")
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        *self.active_session_id.write().await = Some(session_id.to_string());
        *self.active_branch.write().await = branch.clone();

        Ok(session)
    }

    /// Get a specific session by ID
    pub async fn get_session(&self, session_id: &str) -> Result<RLMSession, SessionError> {
        let row = sqlx::query(
            "SELECT session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at
            FROM rlm_sessions WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(SessionError::Database)?
        .ok_or_else(|| SessionError::NotFound(format!("Session {} not found", session_id)))?;

        Ok(Self::row_to_session(row))
    }

    /// Get all branches
    pub async fn list_branches(&self) -> Result<Vec<String>, SessionError> {
        let rows = sqlx::query("SELECT DISTINCT branch FROM rlm_sessions")
            .fetch_all(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        let branches: Vec<String> = rows.into_iter().map(|row| row.get("branch")).collect();

        Ok(branches)
    }

    /// Merge a branch into the current branch
    pub async fn merge_branch(
        &self,
        source_branch: &str,
        commit_msg: &str,
    ) -> Result<String, SessionError> {
        let current_branch = self.active_branch.read().await.clone();

        // Get the HEAD of the source branch
        let source_head_row = sqlx::query(
            "SELECT session_id, state_snapshot, metadata FROM rlm_sessions
            WHERE branch = ? AND is_head = 1",
        )
        .bind(source_branch)
        .fetch_optional(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        if let Some(source_head_row) = source_head_row {
            // Create a merge commit in the current branch
            let merge_session_id = Uuid::new_v4().to_string();
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            // Get current HEAD session ID for parents
            let current_head_session_id = self.active_session_id.read().await.clone();
            let parents = if let Some(id) = current_head_session_id {
                vec![id, source_head_row.get("session_id")]
            } else {
                vec![source_head_row.get("session_id")]
            };

            let parents_json = serde_json::to_string(&parents).map_err(SessionError::Json)?;

            // Use the source branch's state for the merge
            let state_snapshot: String = source_head_row.get("state_snapshot");
            let source_metadata: String = source_head_row.get("metadata");

            // Update the author in metadata to reflect the merge
            let mut metadata: serde_json::Value =
                serde_json::from_str(&source_metadata).map_err(SessionError::Json)?;
            if let serde_json::Value::Object(ref mut obj) = metadata {
                obj.insert(
                    "author".to_string(),
                    serde_json::Value::String("system".to_string()),
                );
                obj.insert(
                    "created_at".to_string(),
                    serde_json::Value::Number(serde_json::Number::from(now)),
                );
                obj.insert(
                    "merge_source".to_string(),
                    serde_json::Value::String(source_branch.to_string()),
                );
            }
            let metadata = serde_json::to_string(&metadata).map_err(SessionError::Json)?;

            sqlx::query(
                "INSERT INTO rlm_sessions (session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
            )
            .bind(&merge_session_id)
            .bind(&current_branch)
            .bind(commit_msg)
            .bind(&parents_json)
            .bind(&state_snapshot)
            .bind(&metadata)
            .bind(now as i64)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

            // Update HEAD
            sqlx::query("UPDATE rlm_sessions SET is_head = 0 WHERE branch = ? AND is_head = 1")
                .bind(&current_branch)
                .execute(&self.pool)
                .await
                .map_err(SessionError::Database)?;

            sqlx::query("UPDATE rlm_sessions SET is_head = 1 WHERE session_id = ?")
                .bind(&merge_session_id)
                .execute(&self.pool)
                .await
                .map_err(SessionError::Database)?;

            *self.active_session_id.write().await = Some(merge_session_id.clone());

            Ok(merge_session_id)
        } else {
            Err(SessionError::NotFound(format!(
                "HEAD of branch {} not found",
                source_branch
            )))
        }
    }

    /// Get differences between two sessions (like git diff)
    pub async fn diff_sessions(
        &self,
        session1_id: &str,
        session2_id: &str,
    ) -> Result<SessionDiff, SessionError> {
        let session1 = self.get_session(session1_id).await?;
        let session2 = self.get_session(session2_id).await?;

        let mut diff = SessionDiff::default();

        // Compare context
        if session1.state_snapshot.context != session2.state_snapshot.context {
            diff.context_changed = true;
            diff.context_diff = Some(DiffDetail {
                before: session1.state_snapshot.context.clone(),
                after: session2.state_snapshot.context.clone(),
            });
        }

        // Compare recursion depth
        if session1.state_snapshot.recursion_depth != session2.state_snapshot.recursion_depth {
            diff.recursion_depth_changed = true;
            diff.recursion_depth_diff = Some(session2.state_snapshot.recursion_depth);
        }

        // Compare variables
        if session1.state_snapshot.variables != session2.state_snapshot.variables {
            diff.variables_changed = true;
            diff.variables_diff = Some(DiffDetail {
                before: serde_json::to_string(&session1.state_snapshot.variables)
                    .unwrap_or_default(),
                after: serde_json::to_string(&session2.state_snapshot.variables)
                    .unwrap_or_default(),
            });
        }

        // Compare answer
        if session1.state_snapshot.answer != session2.state_snapshot.answer {
            diff.answer_changed = true;
            diff.answer_diff = Some(DiffDetail {
                before: session1.state_snapshot.answer.clone().unwrap_or_default(),
                after: session2.state_snapshot.answer.clone().unwrap_or_default(),
            });
        }

        // Compare execution logs
        if session1.state_snapshot.execution_log.len()
            != session2.state_snapshot.execution_log.len()
        {
            diff.execution_log_changed = true;
            diff.execution_log_diff = Some(format!(
                "Log entries changed from {} to {}",
                session1.state_snapshot.execution_log.len(),
                session2.state_snapshot.execution_log.len()
            ));
        }

        Ok(diff)
    }

    /// Tag a session (like git tag)
    pub async fn tag_session(
        &self,
        session_id: &str,
        tag_name: &str,
        tag_message: Option<&str>,
    ) -> Result<(), SessionError> {
        // Get the current metadata
        let row = sqlx::query("SELECT metadata FROM rlm_sessions WHERE session_id = ?")
            .bind(session_id)
            .fetch_one(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        let metadata_str: String = row.get(0);
        let mut metadata: serde_json::Value =
            serde_json::from_str(&metadata_str).map_err(SessionError::Json)?;

        // Add tag information to metadata
        if let serde_json::Value::Object(ref mut obj) = metadata {
            let tags_array = obj
                .entry("tags".to_string())
                .or_insert_with(|| serde_json::Value::Array(vec![]));

            if let serde_json::Value::Array(ref mut tags) = tags_array {
                if !tags.iter().any(|t| t.as_str() == Some(tag_name)) {
                    tags.push(serde_json::Value::String(tag_name.to_string()));
                }
            }

            // Add tag-specific information
            obj.insert(
                "tag_name".to_string(),
                serde_json::Value::String(tag_name.to_string()),
            );
            if let Some(msg) = tag_message {
                obj.insert(
                    "tag_message".to_string(),
                    serde_json::Value::String(msg.to_string()),
                );
            }
        }

        let updated_metadata = serde_json::to_string(&metadata).map_err(SessionError::Json)?;

        // Update the session with new metadata
        sqlx::query("UPDATE rlm_sessions SET metadata = ? WHERE session_id = ?")
            .bind(&updated_metadata)
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        Ok(())
    }

    /// List all tags
    pub async fn list_tags(&self) -> Result<Vec<TagInfo>, SessionError> {
        let rows = sqlx::query("SELECT session_id, metadata FROM rlm_sessions")
            .fetch_all(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        let mut tags = Vec::new();
        for row in rows {
            let metadata_str: String = row.get("metadata");
            let metadata: serde_json::Value =
                serde_json::from_str(&metadata_str).unwrap_or_default();

            if let serde_json::Value::Object(obj) = metadata {
                if let Some(serde_json::Value::String(tag_name)) = obj.get("tag_name") {
                    tags.push(TagInfo {
                        tag_name: tag_name.clone(),
                        session_id: row.get("session_id"),
                        message: obj
                            .get("tag_message")
                            .and_then(|v| v.as_str())
                            .unwrap_or_default()
                            .to_string(),
                    });
                }
            }
        }

        Ok(tags)
    }

    /// Checkout a specific tag (like git checkout <tag>)
    pub async fn checkout_tag(&self, tag_name: &str) -> Result<RLMSession, SessionError> {
        let rows = sqlx::query("SELECT session_id, metadata FROM rlm_sessions")
            .fetch_all(&self.pool)
            .await
            .map_err(SessionError::Database)?;

        for row in rows {
            let metadata_str: String = row.get("metadata");
            let metadata: serde_json::Value =
                serde_json::from_str(&metadata_str).unwrap_or_default();

            if let serde_json::Value::Object(obj) = metadata {
                if let Some(serde_json::Value::String(current_tag)) = obj.get("tag_name") {
                    if current_tag == tag_name {
                        let session_id: String = row.get("session_id");
                        return self.checkout(&session_id).await;
                    }
                }
            }
        }

        Err(SessionError::NotFound(format!(
            "Tag {} not found",
            tag_name
        )))
    }

    /// Get the commit history for a specific branch (like git log <branch>)
    pub async fn log_branch(
        &self,
        branch_name: &str,
        limit: Option<usize>,
    ) -> Result<Vec<RLMSession>, SessionError> {
        let limit = limit.unwrap_or(100) as i64;

        let rows = sqlx::query(
            "SELECT session_id, branch, description, parents, state_snapshot, metadata, is_head, created_at
            FROM rlm_sessions
            WHERE branch = ?
            ORDER BY created_at DESC
            LIMIT ?"
        )
        .bind(branch_name)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(SessionError::Database)?;

        let sessions: Result<Vec<_>, _> = rows
            .into_iter()
            .map(|row| Ok(Self::row_to_session(row)))
            .collect();

        sessions
    }

    /// Get the current branch name
    pub async fn current_branch(&self) -> Result<String, SessionError> {
        Ok(self.active_branch.read().await.clone())
    }

    /// Get the number of commits in the current branch
    pub async fn commit_count(&self, branch: Option<&str>) -> Result<i64, SessionError> {
        let query = if let Some(branch) = branch {
            sqlx::query("SELECT COUNT(*) as count FROM rlm_sessions WHERE branch = ?").bind(branch)
        } else {
            let current_branch = self.active_branch.read().await.clone();
            sqlx::query("SELECT COUNT(*) as count FROM rlm_sessions WHERE branch = ?")
                .bind(current_branch)
        };

        let row = query
            .fetch_one(&self.pool)
            .await
            .map_err(SessionError::Database)?;
        let count: i64 = row.get("count");
        Ok(count)
    }

    /// Helper to convert DB row to RLMSession
    fn row_to_session(row: sqlx::sqlite::SqliteRow) -> RLMSession {
        let session_id: String = row.get("session_id");
        let branch: String = row.get("branch");
        let description: String = row.get("description");
        let parents_json: String = row.get("parents");
        let state_snapshot_json: String = row.get("state_snapshot");
        let metadata_json: String = row.get("metadata");
        let is_head: i32 = row.get("is_head");

        let parents: Vec<String> =
            serde_json::from_str(&parents_json).unwrap_or_else(|_| Vec::new());
        let state_snapshot: SessionState =
            serde_json::from_str(&state_snapshot_json).unwrap_or_else(|_| SessionState::default());
        let metadata: SessionMetadata =
            serde_json::from_str(&metadata_json).unwrap_or_else(|_| SessionMetadata {
                author: "unknown".to_string(),
                created_at: 0,
                tags: vec![],
                mode: "unknown".to_string(),
            });

        RLMSession {
            session_id,
            branch,
            description,
            parents,
            state_snapshot,
            metadata,
            is_head: is_head != 0,
        }
    }

    /// Helper to convert DB row to ExecutionEntry
    fn row_to_entry(row: sqlx::sqlite::SqliteRow) -> ExecutionEntry {
        let entry_type_str: String = row.get("entry_type");
        let entry_type: EntryType = match entry_type_str.as_str() {
            "Input" => EntryType::Input,
            "Execution" => EntryType::Execution,
            "Generation" => EntryType::Generation,
            "Mutation" => EntryType::Mutation,
            "Error" => EntryType::Error,
            "Result" => EntryType::Result,
            _ => EntryType::Input,
        };

        ExecutionEntry {
            entry_type,
            content: row.get("content"),
            timestamp: row.get::<i64, _>("timestamp") as u64,
            parent_hash: {
                let parent_hash_opt: Option<String> = row.get("parent_hash");
                parent_hash_opt
            },
            hash: row.get("hash"),
        }
    }
}

/// Information about a session difference
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionDiff {
    pub context_changed: bool,
    pub context_diff: Option<DiffDetail<String>>,
    pub recursion_depth_changed: bool,
    pub recursion_depth_diff: Option<u32>,
    pub variables_changed: bool,
    pub variables_diff: Option<DiffDetail<String>>,
    pub answer_changed: bool,
    pub answer_diff: Option<DiffDetail<String>>,
    pub execution_log_changed: bool,
    pub execution_log_diff: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffDetail<T> {
    pub before: T,
    pub after: T,
}

impl<T> Default for DiffDetail<T>
where
    T: Default,
{
    fn default() -> Self {
        Self {
            before: T::default(),
            after: T::default(),
        }
    }
}

/// Information about a tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub tag_name: String,
    pub session_id: String,
    pub message: String,
}

#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Session not found: {0}")]
    NotFound(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
}
