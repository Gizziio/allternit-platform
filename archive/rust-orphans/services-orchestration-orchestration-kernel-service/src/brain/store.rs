use crate::brain::types::{BrainSession, SessionStatus};
use anyhow::Result;
use sqlx::SqlitePool;
use std::sync::Arc;

#[derive(Debug)]
pub struct BrainStore {
    pool: Arc<SqlitePool>,
}

impl BrainStore {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }

    pub async fn init(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS brain_sessions (
                id TEXT PRIMARY KEY,
                brain_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                workspace_dir TEXT NOT NULL,
                profile_id TEXT,
                plan_id TEXT,
                conversation_state TEXT,
                pid INTEGER
            )
            "#,
        )
        .execute(&*self.pool)
        .await?;

        // Backfill missing columns for older schemas.
        let columns: Vec<(i64, String, String, i64, Option<String>, i64)> =
            sqlx::query_as("PRAGMA table_info(brain_sessions)")
                .fetch_all(&*self.pool)
                .await?;
        let has_status = columns.iter().any(|col| col.1 == "status");
        if !has_status {
            sqlx::query(
                "ALTER TABLE brain_sessions ADD COLUMN status TEXT NOT NULL DEFAULT '\"Created\"'",
            )
            .execute(&*self.pool)
            .await?;
        }
        Ok(())
    }

    pub async fn upsert_session(&self, session: &BrainSession) -> Result<()> {
        let status_str = serde_json::to_string(&session.status)?;
        let state_json = session.conversation_state.as_ref().map(|s| s.to_string());

        sqlx::query(
            r#"
            INSERT INTO brain_sessions (id, brain_id, created_at, status, workspace_dir, profile_id, plan_id, conversation_state, pid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                conversation_state = excluded.conversation_state,
                pid = excluded.pid
            "#,
        )
        .bind(&session.id)
        .bind(&session.brain_id)
        .bind(session.created_at)
        .bind(status_str)
        .bind(&session.workspace_dir)
        .bind(&session.profile_id)
        .bind(&session.plan_id)
        .bind(state_json)
        .bind(session.pid.map(|p| p as i64))
        .execute(&*self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_session(&self, id: &str) -> Result<Option<BrainSession>> {
        let row = sqlx::query_as::<_, (String, String, i64, String, String, Option<String>, Option<String>, Option<String>, Option<i64>)>(
            "SELECT id, brain_id, created_at, status, workspace_dir, profile_id, plan_id, conversation_state, pid FROM brain_sessions WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&*self.pool)
        .await?;

        if let Some(row) = row {
            let status: SessionStatus = serde_json::from_str(&row.3)?;
            let conversation_state = row.7.and_then(|s| serde_json::from_str(&s).ok());

            Ok(Some(BrainSession {
                id: row.0,
                brain_id: row.1,
                created_at: row.2,
                status,
                workspace_dir: row.4,
                profile_id: row.5,
                plan_id: row.6,
                conversation_state,
                pid: row.8.map(|p| p as u32),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn list_sessions(&self) -> Result<Vec<BrainSession>> {
        let rows = sqlx::query_as::<_, (String, String, i64, String, String, Option<String>, Option<String>, Option<String>, Option<i64>)>(
            "SELECT id, brain_id, created_at, status, workspace_dir, profile_id, plan_id, conversation_state, pid FROM brain_sessions ORDER BY created_at DESC"
        )
        .fetch_all(&*self.pool)
        .await?;

        let mut sessions = Vec::new();
        for row in rows {
            let status: SessionStatus = serde_json::from_str(&row.3)?;
            let conversation_state = row.7.and_then(|s| serde_json::from_str(&s).ok());

            sessions.push(BrainSession {
                id: row.0,
                brain_id: row.1,
                created_at: row.2,
                status,
                workspace_dir: row.4,
                profile_id: row.5,
                plan_id: row.6,
                conversation_state,
                pid: row.8.map(|p| p as u32),
            });
        }
        Ok(sessions)
    }
}
