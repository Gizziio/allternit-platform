//! Session persistence using SQLite
//!
//! Provides durable storage for session metadata with automatic cleanup
//! of old records (30 days by default).

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Row, Sqlite};
use std::path::PathBuf;
use uuid::Uuid;

use crate::error::{CliError, Result};
use crate::tokens::TokenManager;

/// Unique identifier for a session
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SessionId(pub Uuid);

impl SessionId {
    /// Generate a new random session ID
    pub fn new() -> Self {
        SessionId(Uuid::new_v4())
    }
}

impl Default for SessionId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for SessionId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        Ok(SessionId(Uuid::parse_str(s)?))
    }
}

/// Status of a persisted session
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[repr(i32)]
pub enum SessionStatus {
    /// Session is active and ready for use
    Active = 0,
    /// Session is paused (e.g., VM suspended)
    Paused = 1,
    /// Session is being terminated
    Terminating = 2,
    /// Session has been destroyed
    Destroyed = 3,
    /// Session expired due to inactivity
    Expired = 4,
}

impl SessionStatus {
    /// Check if the session can be reconnected to
    pub fn is_reconnectable(self) -> bool {
        matches!(self, SessionStatus::Active | SessionStatus::Paused)
    }
}

/// A persisted session record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    /// Unique session identifier
    pub id: SessionId,
    /// Human-readable session name
    pub name: String,
    /// Associated VM identifier
    pub vm_id: Uuid,
    /// Tenant identifier for multi-tenancy
    pub tenant_id: String,
    /// Session creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last activity timestamp
    pub last_activity: DateTime<Utc>,
    /// Token used for reconnecting to this session
    pub reconnect_token: String,
    /// Current session status
    pub status: SessionStatus,
}

/// Session store backed by SQLite
pub struct SessionStore {
    pool: Pool<Sqlite>,
}

impl SessionStore {
    /// Open or create a session store at the given database path
    pub async fn open(db_path: impl Into<PathBuf>) -> Result<Self> {
        let db_path: PathBuf = db_path.into();

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let database_url = format!("sqlite:{}", db_path.display());

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .map_err(|e| CliError::Session(format!("Failed to connect to database: {}", e)))?;

        let store = Self { pool };
        store.init_schema().await?;

        Ok(store)
    }

    /// Create a new session store with default path
    pub async fn new() -> Result<Self> {
        let db_path = get_default_db_path()
            .ok_or_else(|| CliError::Config("Could not determine data directory".to_string()))?;
        Self::open(db_path).await
    }

    /// Initialize the database schema
    async fn init_schema(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                vm_id TEXT NOT NULL,
                tenant_id TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                last_activity TEXT NOT NULL,
                reconnect_token TEXT NOT NULL UNIQUE,
                status INTEGER NOT NULL DEFAULT 0,
                metadata TEXT
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| CliError::Session(format!("Failed to create sessions table: {}", e)))?;

        // Create indexes for common queries
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
            CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(reconnect_token);
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| CliError::Session(format!("Failed to create indexes: {}", e)))?;

        Ok(())
    }

    /// Save a session to the store
    ///
    /// If the session already exists, it will be updated.
    pub async fn save_session(&self, session: &PersistedSession) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO sessions (id, name, vm_id, tenant_id, created_at, last_activity, reconnect_token, status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                vm_id = excluded.vm_id,
                tenant_id = excluded.tenant_id,
                last_activity = excluded.last_activity,
                reconnect_token = excluded.reconnect_token,
                status = excluded.status
            "#,
        )
        .bind(session.id.to_string())
        .bind(&session.name)
        .bind(session.vm_id.to_string())
        .bind(&session.tenant_id)
        .bind(session.created_at.to_rfc3339())
        .bind(session.last_activity.to_rfc3339())
        .bind(&session.reconnect_token)
        .bind(session.status as i32)
        .execute(&self.pool)
        .await
        .map_err(|e| CliError::Session(format!("Failed to save session: {}", e)))?;

        tracing::debug!(
            target: "a2r::persistence",
            session_id = %session.id,
            "Session saved to database"
        );

        Ok(())
    }

    /// Get a session by its ID
    pub async fn get_session(&self, id: SessionId) -> Option<PersistedSession> {
        let row = sqlx::query(
            r#"
            SELECT id, name, vm_id, tenant_id, created_at, last_activity, reconnect_token, status
            FROM sessions
            WHERE id = ?1
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await
        .ok()?;

        row.map(|r| self.row_to_session(&r))
    }

    /// Get a session by its reconnect token
    pub async fn get_session_by_token(&self, token: &str) -> Option<PersistedSession> {
        if !TokenManager::validate(token) {
            return None;
        }

        let row = sqlx::query(
            r#"
            SELECT id, name, vm_id, tenant_id, created_at, last_activity, reconnect_token, status
            FROM sessions
            WHERE reconnect_token = ?1
            "#,
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await
        .ok()?;

        row.map(|r| self.row_to_session(&r))
    }

    /// List all active sessions
    pub async fn list_active(&self) -> Vec<PersistedSession> {
        self.list_by_status(SessionStatus::Active).await
    }

    /// List sessions by status
    pub async fn list_by_status(&self, status: SessionStatus) -> Vec<PersistedSession> {
        let rows = sqlx::query(
            r#"
            SELECT id, name, vm_id, tenant_id, created_at, last_activity, reconnect_token, status
            FROM sessions
            WHERE status = ?1
            ORDER BY last_activity DESC
            "#,
        )
        .bind(status as i32)
        .fetch_all(&self.pool)
        .await;

        match rows {
            Ok(rows) => rows.iter().map(|r| self.row_to_session(r)).collect(),
            Err(e) => {
                tracing::error!(target: "a2r::persistence", error = %e, "Failed to list sessions");
                vec![]
            }
        }
    }

    /// List all sessions for a tenant
    pub async fn list_by_tenant(&self, tenant_id: &str) -> Vec<PersistedSession> {
        let rows = sqlx::query(
            r#"
            SELECT id, name, vm_id, tenant_id, created_at, last_activity, reconnect_token, status
            FROM sessions
            WHERE tenant_id = ?1
            ORDER BY last_activity DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await;

        match rows {
            Ok(rows) => rows.iter().map(|r| self.row_to_session(r)).collect(),
            Err(e) => {
                tracing::error!(
                    target: "a2r::persistence",
                    tenant_id = tenant_id,
                    error = %e,
                    "Failed to list tenant sessions"
                );
                vec![]
            }
        }
    }

    /// Mark a session as destroyed
    pub async fn mark_destroyed(&self, id: SessionId) -> Result<()> {
        self.update_status(id, SessionStatus::Destroyed).await
    }

    /// Mark a session as expired
    pub async fn mark_expired(&self, id: SessionId) -> Result<()> {
        self.update_status(id, SessionStatus::Expired).await
    }

    /// Update session status
    pub async fn update_status(&self, id: SessionId, status: SessionStatus) -> Result<()> {
        let result = sqlx::query(
            r#"
            UPDATE sessions
            SET status = ?1, last_activity = ?2
            WHERE id = ?3
            "#,
        )
        .bind(status as i32)
        .bind(Utc::now().to_rfc3339())
        .bind(id.to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| CliError::Session(format!("Failed to update session status: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(CliError::Session(format!(
                "Session {} not found",
                id
            )));
        }

        tracing::debug!(
            target: "a2r::persistence",
            session_id = %id,
            ?status,
            "Session status updated"
        );

        Ok(())
    }

    /// Update the last activity timestamp for a session
    pub async fn touch(&self, id: SessionId) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE sessions
            SET last_activity = ?1
            WHERE id = ?2
            "#,
        )
        .bind(Utc::now().to_rfc3339())
        .bind(id.to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| CliError::Session(format!("Failed to update session activity: {}", e)))?;

        Ok(())
    }

    /// Clean up old sessions (older than the specified duration)
    ///
    /// By default, sessions older than 30 days are removed.
    pub async fn cleanup_old_sessions(&self, max_age: Duration) -> Result<usize> {
        let cutoff = Utc::now() - max_age;

        let result = sqlx::query(
            r#"
            DELETE FROM sessions
            WHERE last_activity < ?1 AND status IN (2, 3, 4)
            "#,
        )
        .bind(cutoff.to_rfc3339())
        .execute(&self.pool)
        .await
        .map_err(|e| CliError::Session(format!("Failed to cleanup old sessions: {}", e)))?;

        let deleted = result.rows_affected() as usize;

        if deleted > 0 {
            tracing::info!(
                target: "a2r::persistence",
                deleted_count = deleted,
                "Cleaned up old sessions"
            );
        }

        Ok(deleted)
    }

    /// Count active sessions for a tenant
    pub async fn count_active_for_tenant(&self, tenant_id: &str) -> Result<usize> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM sessions
            WHERE tenant_id = ?1 AND status = 0
            "#,
        )
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CliError::Session(format!("Failed to count sessions: {}", e)))?;

        Ok(count as usize)
    }

    /// Convert a database row to a PersistedSession
    fn row_to_session(&self, row: &sqlx::sqlite::SqliteRow) -> PersistedSession {
        PersistedSession {
            id: SessionId(
                Uuid::parse_str(row.get::<&str, _>("id")).unwrap_or_else(|_| Uuid::nil()),
            ),
            name: row.get("name"),
            vm_id: Uuid::parse_str(row.get::<&str, _>("vm_id")).unwrap_or_else(|_| Uuid::nil()),
            tenant_id: row.get("tenant_id"),
            created_at: DateTime::parse_from_rfc3339(row.get::<&str, _>("created_at"))
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            last_activity: DateTime::parse_from_rfc3339(row.get::<&str, _>("last_activity"))
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            reconnect_token: row.get("reconnect_token"),
            status: match row.get::<i32, _>("status") {
                0 => SessionStatus::Active,
                1 => SessionStatus::Paused,
                2 => SessionStatus::Terminating,
                3 => SessionStatus::Destroyed,
                _ => SessionStatus::Expired,
            },
        }
    }

    /// Close the database connection pool
    pub async fn close(&self) {
        self.pool.close().await;
    }
}

/// Get the default database path
pub fn get_default_db_path() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join("a2r").join("sessions.db"))
}

/// Run automatic cleanup of old sessions
pub async fn run_cleanup(store: &SessionStore) -> Result<usize> {
    // Clean up sessions older than 30 days
    let thirty_days = Duration::days(30);
    store.cleanup_old_sessions(thirty_days).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn create_test_store() -> (SessionStore, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let store = SessionStore::open(db_path).await.unwrap();
        (store, temp_dir)
    }

    fn create_test_session() -> PersistedSession {
        PersistedSession {
            id: SessionId::new(),
            name: "test-session".to_string(),
            vm_id: Uuid::new_v4(),
            tenant_id: "test-tenant".to_string(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
            reconnect_token: TokenManager::generate(),
            status: SessionStatus::Active,
        }
    }

    #[tokio::test]
    async fn test_save_and_get_session() {
        let (store, _temp) = create_test_store().await;
        let session = create_test_session();

        store.save_session(&session).await.unwrap();
        let retrieved = store.get_session(session.id).await;

        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.id, session.id);
        assert_eq!(retrieved.name, session.name);
        assert_eq!(retrieved.vm_id, session.vm_id);
        assert_eq!(retrieved.tenant_id, session.tenant_id);
        assert_eq!(retrieved.reconnect_token, session.reconnect_token);
    }

    #[tokio::test]
    async fn test_get_session_by_token() {
        let (store, _temp) = create_test_store().await;
        let session = create_test_session();
        let token = session.reconnect_token.clone();

        store.save_session(&session).await.unwrap();
        let retrieved = store.get_session_by_token(&token).await;

        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, session.id);
    }

    #[tokio::test]
    async fn test_list_active() {
        let (store, _temp) = create_test_store().await;

        // Create active session
        let active = create_test_session();
        store.save_session(&active).await.unwrap();

        // Create destroyed session
        let mut destroyed = create_test_session();
        destroyed.status = SessionStatus::Destroyed;
        store.save_session(&destroyed).await.unwrap();

        let active_list = store.list_active().await;
        assert_eq!(active_list.len(), 1);
        assert_eq!(active_list[0].id, active.id);
    }

    #[tokio::test]
    async fn test_mark_destroyed() {
        let (store, _temp) = create_test_store().await;
        let session = create_test_session();

        store.save_session(&session).await.unwrap();
        store.mark_destroyed(session.id).await.unwrap();

        let retrieved = store.get_session(session.id).await.unwrap();
        assert_eq!(retrieved.status, SessionStatus::Destroyed);
    }

    #[tokio::test]
    async fn test_cleanup_old_sessions() {
        let (store, _temp) = create_test_store().await;

        // Create session with old activity
        let mut old_session = create_test_session();
        old_session.status = SessionStatus::Destroyed;
        old_session.last_activity = Utc::now() - Duration::days(31);
        store.save_session(&old_session).await.unwrap();

        // Create recent session
        let recent = create_test_session();
        store.save_session(&recent).await.unwrap();

        // Clean up sessions older than 30 days
        let deleted = store.cleanup_old_sessions(Duration::days(30)).await.unwrap();
        assert_eq!(deleted, 1);

        // Old session should be gone
        assert!(store.get_session(old_session.id).await.is_none());
        // Recent session should remain
        assert!(store.get_session(recent.id).await.is_some());
    }

    #[tokio::test]
    async fn test_count_active_for_tenant() {
        let (store, _temp) = create_test_store().await;

        let mut session = create_test_session();
        session.tenant_id = "tenant-a".to_string();
        store.save_session(&session).await.unwrap();

        let count = store.count_active_for_tenant("tenant-a").await.unwrap();
        assert_eq!(count, 1);

        let count = store.count_active_for_tenant("tenant-b").await.unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_session_status_is_reconnectable() {
        assert!(SessionStatus::Active.is_reconnectable());
        assert!(SessionStatus::Paused.is_reconnectable());
        assert!(!SessionStatus::Terminating.is_reconnectable());
        assert!(!SessionStatus::Destroyed.is_reconnectable());
        assert!(!SessionStatus::Expired.is_reconnectable());
    }
}
