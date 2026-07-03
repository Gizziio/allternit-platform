use crate::types::Run;
use sqlx::SqlitePool;
use std::sync::Arc;

#[derive(Debug)]
pub struct RunStore {
    pool: Arc<SqlitePool>,
}

impl RunStore {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }

    pub async fn init(&self) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                started_at INTEGER,
                ended_at INTEGER,
                terminal_session_id TEXT,
                status TEXT NOT NULL,
                tokens INTEGER,
                cost REAL,
                duration_ms INTEGER,
                review_ready BOOLEAN NOT NULL DEFAULT 0,
                review_summary TEXT,
                canvas_enabled BOOLEAN NOT NULL DEFAULT 0,
                canvas_stream_id TEXT,
                last_frame_at INTEGER
            )
            "#,
        )
        .execute(&*self.pool)
        .await?;
        Ok(())
    }

    pub async fn create_run(&self, run: Run) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            INSERT INTO runs (
                id, task_id, created_at, started_at, ended_at, 
                terminal_session_id, status, tokens, cost, duration_ms, 
                review_ready, review_summary, canvas_enabled, canvas_stream_id, last_frame_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(run.id)
        .bind(run.task_id)
        .bind(run.created_at)
        .bind(run.started_at)
        .bind(run.ended_at)
        .bind(run.terminal_session_id)
        .bind(run.status)
        .bind(run.tokens)
        .bind(run.cost)
        .bind(run.duration_ms)
        .bind(run.review_ready)
        .bind(run.review_summary)
        .bind(run.canvas_enabled)
        .bind(run.canvas_stream_id)
        .bind(run.last_frame_at)
        .execute(&*self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_run(&self, id: &str) -> anyhow::Result<Option<Run>> {
        let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = ?")
            .bind(id)
            .fetch_optional(&*self.pool)
            .await?;
        Ok(run)
    }

    pub async fn list_runs_for_task(&self, task_id: &str) -> anyhow::Result<Vec<Run>> {
        let runs = sqlx::query_as::<_, Run>(
            "SELECT * FROM runs WHERE task_id = ? ORDER BY created_at DESC",
        )
        .bind(task_id)
        .fetch_all(&*self.pool)
        .await?;
        Ok(runs)
    }

    pub async fn update_run_status(&self, id: &str, status: &str) -> anyhow::Result<()> {
        sqlx::query("UPDATE runs SET status = ? WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(&*self.pool)
            .await?;
        Ok(())
    }

    pub async fn mark_review_ready(&self, id: &str, summary: &str) -> anyhow::Result<()> {
        sqlx::query("UPDATE runs SET review_ready = 1, review_summary = ?, status = 'needs_review' WHERE id = ?")
            .bind(summary)
            .bind(id)
            .execute(&*self.pool)
            .await?;
        Ok(())
    }
}
