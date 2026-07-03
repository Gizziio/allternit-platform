use crate::types::Task;
use sqlx::SqlitePool;
use std::sync::Arc;

#[derive(Debug)]
pub struct TaskStore {
    pool: Arc<SqlitePool>,
}

impl TaskStore {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }

    pub async fn init(&self) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                workspace_id TEXT NOT NULL,
                repo_path TEXT NOT NULL,
                worktree_path TEXT,
                intent TEXT NOT NULL,
                agent_profile TEXT,
                status TEXT NOT NULL,
                active_run_id TEXT
            )
            "#,
        )
        .execute(&*self.pool)
        .await?;
        Ok(())
    }

    pub async fn create_task(&self, task: Task) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            INSERT INTO tasks (id, title, created_at, workspace_id, repo_path, worktree_path, intent, agent_profile, status, active_run_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(task.id)
        .bind(task.title)
        .bind(task.created_at)
        .bind(task.workspace_id)
        .bind(task.repo_path)
        .bind(task.worktree_path)
        .bind(task.intent)
        .bind(task.agent_profile)
        .bind(task.status)
        .bind(task.active_run_id)
        .execute(&*self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_task(&self, id: &str) -> anyhow::Result<Option<Task>> {
        let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
            .bind(id)
            .fetch_optional(&*self.pool)
            .await?;
        Ok(task)
    }

    pub async fn list_tasks(&self) -> anyhow::Result<Vec<Task>> {
        let tasks = sqlx::query_as::<_, Task>("SELECT * FROM tasks ORDER BY created_at DESC")
            .fetch_all(&*self.pool)
            .await?;
        Ok(tasks)
    }

    pub async fn update_status(&self, id: &str, status: &str) -> anyhow::Result<()> {
        sqlx::query("UPDATE tasks SET status = ? WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(&*self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_active_run(&self, id: &str, run_id: Option<String>) -> anyhow::Result<()> {
        sqlx::query("UPDATE tasks SET active_run_id = ? WHERE id = ?")
            .bind(run_id)
            .bind(id)
            .execute(&*self.pool)
            .await?;
        Ok(())
    }
}
