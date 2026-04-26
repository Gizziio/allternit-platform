//! Client attachment registry
//!
//! Tracks which clients are connected to which runs,
//! manages reconnect tokens, and detects stale connections.

use chrono::{DateTime, Duration, Utc};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Row, Sqlite};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};
use uuid::Uuid;

use crate::error::{CoworkError, Result};
use crate::types::{Attachment, AttachmentState, ClientType, PermissionSet, RunId};

/// Registry for managing client attachments
pub struct AttachmentRegistry {
    /// SQLite connection pool
    pub pool: Pool<Sqlite>,
    /// Seconds before an inactive attachment is considered stale
    pub timeout_secs: u64,
    /// Handle to the background cleanup task
    pub cleanup_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

impl AttachmentRegistry {
    /// Create a new attachment registry
    pub async fn new(data_dir: PathBuf, timeout_secs: u64) -> Result<Self> {
        tokio::fs::create_dir_all(&data_dir).await?;

        let db_path = data_dir.join("attachments.db");
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&format!("sqlite:{}", db_path.display()))
            .await?;

        let registry = Self {
            pool,
            timeout_secs,
            cleanup_handle: Arc::new(RwLock::new(None)),
        };

        registry.init_schema().await?;
        registry.start_cleanup_task().await;

        Ok(registry)
    }

    /// Initialize the database schema
    async fn init_schema(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY NOT NULL,
                run_id TEXT NOT NULL,
                client_type TEXT NOT NULL,
                client_session_id TEXT NOT NULL,
                state TEXT NOT NULL,
                permissions_read INTEGER NOT NULL DEFAULT 1,
                permissions_write INTEGER NOT NULL DEFAULT 0,
                permissions_approve INTEGER NOT NULL DEFAULT 0,
                permissions_admin INTEGER NOT NULL DEFAULT 0,
                last_seen_at TEXT NOT NULL,
                replay_cursor TEXT NOT NULL,
                reconnect_token TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_attachments_run ON attachments(run_id);
            CREATE INDEX IF NOT EXISTS idx_attachments_token ON attachments(reconnect_token);
            CREATE INDEX IF NOT EXISTS idx_attachments_state ON attachments(state);
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Start background cleanup task for stale attachments
    async fn start_cleanup_task(&self) {
        let pool = self.pool.clone();
        let timeout_secs = self.timeout_secs;
        let handle = self.cleanup_handle.clone();

        let task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

            loop {
                interval.tick().await;

                let cutoff = Utc::now() - Duration::seconds(timeout_secs as i64);
                let cutoff_str = cutoff.to_rfc3339();

                let result = sqlx::query(
                    "UPDATE attachments SET state = 'stale' 
                     WHERE state = 'attached' AND last_seen_at < ?",
                )
                .bind(&cutoff_str)
                .execute(&pool)
                .await;

                match result {
                    Ok(res) => {
                        if res.rows_affected() > 0 {
                            info!(
                                "Marked {} attachments as stale",
                                res.rows_affected()
                            );
                        }
                    }
                    Err(e) => {
                        error!("Failed to cleanup stale attachments: {}", e);
                    }
                }
            }
        });

        let mut guard = handle.write().await;
        *guard = Some(task);
    }

    /// Attach a client to a run
    pub async fn attach(
        &self,
        run_id: RunId,
        client_type: ClientType,
        client_session_id: String,
        permissions: PermissionSet,
    ) -> Result<Attachment> {
        let id = Uuid::new_v4();
        let token = Uuid::new_v4().to_string();
        let now = Utc::now();

        let attachment = Attachment {
            id,
            run_id,
            client_type,
            client_session_id: client_session_id.clone(),
            state: AttachmentState::Attached,
            permissions,
            last_seen_at: now,
            replay_cursor: "0".to_string(),
            reconnect_token: token.clone(),
            created_at: now,
        };

        sqlx::query(
            r#"
            INSERT INTO attachments 
            (id, run_id, client_type, client_session_id, state, 
             permissions_read, permissions_write, permissions_approve, permissions_admin,
             last_seen_at, replay_cursor, reconnect_token, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id.to_string())
        .bind(run_id.to_string())
        .bind(client_type.to_string())
        .bind(client_session_id)
        .bind("attached")
        .bind(permissions.read as i32)
        .bind(permissions.write as i32)
        .bind(permissions.approve as i32)
        .bind(permissions.admin as i32)
        .bind(now.to_rfc3339())
        .bind("0")
        .bind(token)
        .bind(now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        info!(
            attachment_id = %id,
            run_id = %run_id,
            client_type = %client_type,
            "Client attached to run"
        );

        Ok(attachment)
    }

    /// Reattach using a reconnect token
    pub async fn reattach(&self, token: &str, cursor: Option<String>) -> Result<Attachment> {
        let attachment = self.get_by_token(token).await?;

        if attachment.state == AttachmentState::Revoked {
            return Err(CoworkError::InvalidAttachmentToken);
        }

        let now = Utc::now();
        let cursor = cursor.unwrap_or_else(|| attachment.replay_cursor.clone());

        sqlx::query(
            r#"
            UPDATE attachments 
            SET state = 'attached', last_seen_at = ?, replay_cursor = ?
            WHERE id = ?
            "#,
        )
        .bind(now.to_rfc3339())
        .bind(cursor)
        .bind(attachment.id.to_string())
        .execute(&self.pool)
        .await?;

        info!(
            attachment_id = %attachment.id,
            run_id = %attachment.run_id,
            "Client reattached to run"
        );

        // Return updated attachment
        self.get(attachment.id).await
    }

    /// Detach a client (clean disconnect)
    pub async fn detach(&self, attachment_id: Uuid) -> Result<()> {
        let now = Utc::now();

        let result = sqlx::query(
            "UPDATE attachments SET state = 'detached', last_seen_at = ? WHERE id = ?",
        )
        .bind(now.to_rfc3339())
        .bind(attachment_id.to_string())
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(CoworkError::AttachmentNotFound(attachment_id.to_string()));
        }

        info!(attachment_id = %attachment_id, "Client detached from run");

        Ok(())
    }

    /// Revoke an attachment (permanent)
    pub async fn revoke(&self, attachment_id: Uuid) -> Result<()> {
        let result = sqlx::query("UPDATE attachments SET state = 'revoked' WHERE id = ?")
            .bind(attachment_id.to_string())
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(CoworkError::AttachmentNotFound(attachment_id.to_string()));
        }

        info!(attachment_id = %attachment_id, "Attachment revoked");

        Ok(())
    }

    /// Touch an attachment (update last_seen_at)
    pub async fn touch(&self, attachment_id: Uuid, cursor: &str) -> Result<()> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE attachments SET last_seen_at = ?, replay_cursor = ? WHERE id = ?",
        )
        .bind(now.to_rfc3339())
        .bind(cursor)
        .bind(attachment_id.to_string())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get an attachment by ID
    pub async fn get(&self, attachment_id: Uuid) -> Result<Attachment> {
        let row = sqlx::query(
            r#"
            SELECT id, run_id, client_type, client_session_id, state,
                   permissions_read, permissions_write, permissions_approve, permissions_admin,
                   last_seen_at, replay_cursor, reconnect_token, created_at
            FROM attachments WHERE id = ?
            "#,
        )
        .bind(attachment_id.to_string())
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(self.row_to_attachment(&row)?),
            None => Err(CoworkError::AttachmentNotFound(attachment_id.to_string())),
        }
    }

    /// Get an attachment by reconnect token
    pub async fn get_by_token(&self, token: &str) -> Result<Attachment> {
        let row = sqlx::query(
            r#"
            SELECT id, run_id, client_type, client_session_id, state,
                   permissions_read, permissions_write, permissions_approve, permissions_admin,
                   last_seen_at, replay_cursor, reconnect_token, created_at
            FROM attachments WHERE reconnect_token = ?
            "#,
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(self.row_to_attachment(&row)?),
            None => Err(CoworkError::InvalidAttachmentToken),
        }
    }

    /// List active attachments for a run
    pub async fn list_active(&self, run_id: RunId) -> Result<Vec<Attachment>> {
        let rows = sqlx::query(
            r#"
            SELECT id, run_id, client_type, client_session_id, state,
                   permissions_read, permissions_write, permissions_approve, permissions_admin,
                   last_seen_at, replay_cursor, reconnect_token, created_at
            FROM attachments 
            WHERE run_id = ? AND state = 'attached'
            ORDER BY created_at DESC
            "#,
        )
        .bind(run_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        let mut attachments = Vec::new();
        for row in rows {
            attachments.push(self.row_to_attachment(&row)?);
        }

        Ok(attachments)
    }

    /// List all attachments for a run (including detached/stale)
    pub async fn list_all(&self, run_id: RunId) -> Result<Vec<Attachment>> {
        let rows = sqlx::query(
            r#"
            SELECT id, run_id, client_type, client_session_id, state,
                   permissions_read, permissions_write, permissions_approve, permissions_admin,
                   last_seen_at, replay_cursor, reconnect_token, created_at
            FROM attachments 
            WHERE run_id = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(run_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        let mut attachments = Vec::new();
        for row in rows {
            attachments.push(self.row_to_attachment(&row)?);
        }

        Ok(attachments)
    }

    /// Convert a database row to an Attachment
    fn row_to_attachment(&self, row: &sqlx::sqlite::SqliteRow) -> Result<Attachment> {
        let state_str: String = row.get("state");
        let state = match state_str.as_str() {
            "attached" => AttachmentState::Attached,
            "detached" => AttachmentState::Detached,
            "stale" => AttachmentState::Stale,
            "revoked" => AttachmentState::Revoked,
            _ => AttachmentState::Detached,
        };

        let client_type_str: String = row.get("client_type");
        let client_type = match client_type_str.as_str() {
            "terminal" => ClientType::Terminal,
            "web" => ClientType::Web,
            "desktop" => ClientType::Desktop,
            _ => ClientType::Terminal,
        };

        let id_str: &str = row.get("id");
        let run_id_str: &str = row.get("run_id");
        let last_seen_str: &str = row.get("last_seen_at");
        let created_str: &str = row.get("created_at");

        Ok(Attachment {
            id: Uuid::parse_str(id_str).map_err(|e| CoworkError::Uuid(e.to_string()))?,
            run_id: RunId(uuid::Uuid::parse_str(run_id_str).map_err(|e| CoworkError::Uuid(e.to_string()))?),
            client_type,
            client_session_id: row.get("client_session_id"),
            state,
            permissions: PermissionSet {
                read: row.get::<i32, _>("permissions_read") != 0,
                write: row.get::<i32, _>("permissions_write") != 0,
                approve: row.get::<i32, _>("permissions_approve") != 0,
                admin: row.get::<i32, _>("permissions_admin") != 0,
            },
            last_seen_at: DateTime::parse_from_rfc3339(last_seen_str)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| CoworkError::DateParse(e.to_string()))?,
            replay_cursor: row.get("replay_cursor"),
            reconnect_token: row.get("reconnect_token"),
            created_at: DateTime::parse_from_rfc3339(created_str)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| CoworkError::DateParse(e.to_string()))?,
        })
    }

    /// Stop the cleanup task
    pub async fn stop_cleanup(&self) {
        let mut guard = self.cleanup_handle.write().await;
        if let Some(handle) = guard.take() {
            handle.abort();
            info!("Attachment cleanup task stopped");
        }
    }
}

impl Drop for AttachmentRegistry {
    fn drop(&mut self) {
        // Note: We can't use async Drop, so cleanup task may not be
        // properly stopped on drop. This is acceptable for now.
    }
}
