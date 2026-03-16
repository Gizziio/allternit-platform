use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub context: String,
    pub recursion_depth: u32,
    pub execution_log: Vec<ExecutionEntry>,
    pub variables: HashMap<String, String>,
    pub answer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEntry {
    pub entry_type: EntryType,
    pub content: String,
    pub timestamp: i64,
    pub parent_hash: Option<String>,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntryType {
    Info,
    Execution,
    Result,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub created_at: i64,
    pub author: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLMSession {
    pub session_id: String,
    pub branch: String,
    pub description: String,
    pub parents: Vec<String>,
    pub state_snapshot: SessionState,
    pub metadata: SessionMetadata,
    pub is_head: bool,
    pub created_at: i64,
}

#[derive(Debug)]
pub enum SessionError {
    Database(String),
    Io(String),
    Json(String),
    NotFound(String),
}

impl std::fmt::Display for SessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionError::Database(msg) => write!(f, "Database error: {}", msg),
            SessionError::Io(msg) => write!(f, "IO error: {}", msg),
            SessionError::Json(msg) => write!(f, "JSON error: {}", msg),
            SessionError::NotFound(msg) => write!(f, "Session not found: {}", msg),
        }
    }
}

impl std::error::Error for SessionError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}

#[derive(Debug)]
pub struct SessionManager {
    pool: Arc<SqlitePool>,
}

impl SessionManager {
    pub async fn new(pool: Arc<SqlitePool>) -> Result<Self, SessionError> {
        Self::initialize_schema(&pool)
            .await
            .map_err(|e| SessionError::Database(e.to_string()))?;
        Ok(Self { pool })
    }

    async fn initialize_schema(pool: &SqlitePool) -> Result<(), SessionError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS rlm_sessions (
                session_id TEXT PRIMARY KEY,
                branch TEXT NOT NULL,
                description TEXT NOT NULL,
                parents TEXT NOT NULL,
                state_snapshot TEXT NOT NULL,
                metadata TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                is_head INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS session_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                parent_hash TEXT,
                hash TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES rlm_sessions(session_id) ON DELETE CASCADE
            );
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        Ok(())
    }

    pub async fn commit(
        &self,
        description: &str,
        state: SessionState,
        parents: Vec<String>,
        mode: &str,
        session_id: &str,
    ) -> Result<String, SessionError> {
        let session_id = Uuid::new_v4().to_string();
        let state_json =
            serde_json::to_string(&state).map_err(|e| SessionError::Json(e.to_string()))?;
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let metadata_json = serde_json::json!({
            "created_at": created_at,
            "author": mode,
            "tags": []
        });

        sqlx::query(
            r#"
            INSERT INTO rlm_sessions (session_id, branch, description, parents, state_snapshot, metadata, created_at, is_head)
            VALUES (?, 'main', ?, ?, ?, ?, ?, 1)
            "#,
        )
        .bind(&session_id)
        .bind(description)
        .bind(serde_json::to_string(&parents).map_err(|e| SessionError::Json(e.to_string()))?)
        .bind(&state_json)
        .bind(&metadata_json)
        .bind(created_at)
        .execute(&*self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        Ok(session_id)
    }

    pub async fn checkout(&self, session_id: &str) -> Result<RLMSession, SessionError> {
        let row = sqlx::query_as::<_, (String, String, String, String, String, String, i64, bool)>(
            "SELECT session_id, branch, description, parents, state_snapshot, metadata, created_at, is_head
             FROM rlm_sessions WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?
        .ok_or_else(|| SessionError::NotFound(session_id.to_string()))?;

        let (
            session_id,
            branch,
            description,
            parents_json,
            state_snapshot_json,
            metadata_json,
            created_at,
            is_head,
        ) = row;

        let state: SessionState = serde_json::from_str(&state_snapshot_json)
            .map_err(|e| SessionError::Json(e.to_string()))?;
        let metadata: SessionMetadata =
            serde_json::from_str(&metadata_json).map_err(|e| SessionError::Json(e.to_string()))?;
        let parents: Vec<String> =
            serde_json::from_str(&parents_json).map_err(|e| SessionError::Json(e.to_string()))?;

        Ok(RLMSession {
            session_id,
            branch,
            description,
            parents,
            state_snapshot: state,
            metadata,
            is_head,
            created_at,
        })
    }

    pub async fn branch(
        &self,
        branch_name: &str,
        session_id: &str,
    ) -> Result<String, SessionError> {
        let parent_session = self.checkout(session_id).await?;
        let new_session_id = Uuid::new_v4().to_string();
        let state_json = serde_json::to_string(&parent_session.state_snapshot)
            .map_err(|e| SessionError::Json(e.to_string()))?;
        let parents_json = serde_json::json!([parent_session.session_id]);
        let metadata_json = serde_json::json!({
            "created_at": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            "author": "branch",
            "tags": [branch_name]
        });

        sqlx::query(
            r#"
            INSERT INTO rlm_sessions (session_id, branch, description, parents, state_snapshot, metadata, is_head)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            "#,
        )
        .bind(&new_session_id)
        .bind(branch_name)
        .bind(&format!("Branch from {}", parent_session.description))
        .bind(&parents_json)
        .bind(&state_json)
        .bind(&metadata_json)
        .execute(&*self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        Ok(new_session_id)
    }

    pub async fn log(&self, limit: usize) -> Result<Vec<RLMSession>, SessionError> {
        let rows = sqlx::query_as::<_, (String, String, String, String, String, String, i64, bool)>(
            "SELECT session_id, branch, description, parents, state_snapshot, metadata, created_at, is_head
             FROM rlm_sessions ORDER BY created_at DESC LIMIT ?"
        )
        .bind(limit as i64)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        let mut sessions = Vec::new();
        for row in rows {
            let (
                session_id,
                branch,
                description,
                parents_json,
                state_snapshot_json,
                metadata_json,
                created_at,
                is_head,
            ) = row;
            let state: SessionState = serde_json::from_str(&state_snapshot_json)
                .map_err(|e| SessionError::Json(e.to_string()))?;
            let metadata: SessionMetadata = serde_json::from_str(&metadata_json)
                .map_err(|e| SessionError::Json(e.to_string()))?;
            let parents: Vec<String> = serde_json::from_str(&parents_json)
                .map_err(|e| SessionError::Json(e.to_string()))?;

            sessions.push(RLMSession {
                session_id,
                branch,
                description,
                parents,
                state_snapshot: state,
                metadata,
                is_head,
                created_at,
            });
        }

        Ok(sessions)
    }

    pub async fn reset_all(&self) -> Result<(), SessionError> {
        sqlx::query("DELETE FROM rlm_sessions")
            .execute(&*self.pool)
            .await
            .map_err(|e| SessionError::Database(e.to_string()))?;

        Ok(())
    }

    pub async fn add_entry(
        &self,
        session_id: &str,
        entry: ExecutionEntry,
    ) -> Result<(), SessionError> {
        sqlx::query(
            r#"
            INSERT INTO session_entries (session_id, entry_type, content, timestamp, parent_hash, hash)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(session_id)
        .bind(format!("{:?}", entry.entry_type))
        .bind(&entry.content)
        .bind(entry.timestamp)
        .bind(entry.parent_hash)
        .bind(&entry.hash)
        .execute(&*self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        Ok(())
    }
}
