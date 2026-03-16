//! Storage backend for the scheduler

use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Row, Sqlite};

use crate::{Result, Schedule, SchedulerError};

/// SQLite-backed schedule store
pub struct SqliteStore {
    pool: Pool<Sqlite>,
}

impl SqliteStore {
    /// Create a new SQLite store
    pub async fn new(db_path: impl AsRef<std::path::Path>) -> Result<Self> {
        let db_path = db_path.as_ref();
        
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| SchedulerError::Store(e.to_string()))?;
        }
        
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&format!("sqlite:{}", db_path.display()))
            .await
            .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        let store = Self { pool };
        store.init_schema().await?;
        
        Ok(store)
    }
    
    /// Initialize the database schema
    async fn init_schema(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                cron TEXT NOT NULL,
                timezone TEXT NOT NULL DEFAULT 'UTC',
                enabled INTEGER NOT NULL DEFAULT 1,
                entrypoint TEXT NOT NULL,
                args TEXT NOT NULL DEFAULT '[]',
                env TEXT NOT NULL DEFAULT '{}',
                priority INTEGER NOT NULL DEFAULT 0,
                timeout_secs INTEGER NOT NULL DEFAULT 3600,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_triggered_at TEXT,
                next_run_at TEXT,
                owner TEXT NOT NULL,
                run_mode TEXT NOT NULL DEFAULT 'scheduled'
            );
            CREATE INDEX IF NOT EXISTS idx_schedules_owner ON schedules(owner);
            CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
            CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at);
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        Ok(())
    }
    
    /// Save a schedule
    pub async fn save_schedule(&self, schedule: &Schedule) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO schedules 
            (id, name, cron, timezone, enabled, entrypoint, args, env, priority, timeout_secs, 
             created_at, updated_at, last_triggered_at, next_run_at, owner, run_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&schedule.id)
        .bind(&schedule.name)
        .bind(&schedule.cron)
        .bind(&schedule.timezone)
        .bind(if schedule.enabled { 1 } else { 0 })
        .bind(&schedule.entrypoint)
        .bind(serde_json::to_string(&schedule.args).map_err(|e| SchedulerError::Store(e.to_string()))?)
        .bind(serde_json::to_string(&schedule.env).map_err(|e| SchedulerError::Store(e.to_string()))?)
        .bind(schedule.priority)
        .bind(schedule.timeout_secs)
        .bind(schedule.created_at.to_rfc3339())
        .bind(schedule.updated_at.to_rfc3339())
        .bind(schedule.last_triggered_at.map(|dt| dt.to_rfc3339()))
        .bind(schedule.next_run_at.map(|dt| dt.to_rfc3339()))
        .bind(&schedule.owner)
        .bind(&schedule.run_mode)
        .execute(&self.pool)
        .await
        .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        Ok(())
    }
    
    /// Get a schedule by ID
    pub async fn get_schedule(&self, id: &str) -> Result<Schedule> {
        let row = sqlx::query(
            r#"
            SELECT id, name, cron, timezone, enabled, entrypoint, args, env, priority, timeout_secs,
                   created_at, updated_at, last_triggered_at, next_run_at, owner, run_mode
            FROM schedules WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        match row {
            Some(row) => Ok(self.row_to_schedule(&row)?),
            None => Err(SchedulerError::NotFound(id.to_string())),
        }
    }
    
    /// List all schedules
    pub async fn list_schedules(&self) -> Result<Vec<Schedule>> {
        let rows = sqlx::query(
            r#"
            SELECT id, name, cron, timezone, enabled, entrypoint, args, env, priority, timeout_secs,
                   created_at, updated_at, last_triggered_at, next_run_at, owner, run_mode
            FROM schedules
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        let mut schedules = Vec::new();
        for row in rows {
            schedules.push(self.row_to_schedule(&row)?);
        }
        
        Ok(schedules)
    }
    
    /// List schedules for an owner
    pub async fn list_schedules_for_owner(&self, owner: &str) -> Result<Vec<Schedule>> {
        let rows = sqlx::query(
            r#"
            SELECT id, name, cron, timezone, enabled, entrypoint, args, env, priority, timeout_secs,
                   created_at, updated_at, last_triggered_at, next_run_at, owner, run_mode
            FROM schedules WHERE owner = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(owner)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        let mut schedules = Vec::new();
        for row in rows {
            schedules.push(self.row_to_schedule(&row)?);
        }
        
        Ok(schedules)
    }
    
    /// Delete a schedule
    pub async fn delete_schedule(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM schedules WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        Ok(())
    }
    
    /// Convert a database row to a Schedule
    fn row_to_schedule(&self, row: &sqlx::sqlite::SqliteRow) -> Result<Schedule> {
        let args_json: &str = row.get("args");
        let args: Vec<String> = serde_json::from_str(args_json)
            .map_err(|e| SchedulerError::Store(e.to_string()))?;
        
        let env_json: &str = row.get("env");
        let env: std::collections::HashMap<String, String> = serde_json::from_str(env_json)
            .map_err(|e| SchedulerError::Store(e.to_string()))?;

        let created_at_str: &str = row.get("created_at");
        let updated_at_str: &str = row.get("updated_at");
        let last_triggered_str: Option<&str> = row.get("last_triggered_at");
        let next_run_str: Option<&str> = row.get("next_run_at");
        
        Ok(Schedule {
            id: row.get("id"),
            name: row.get("name"),
            cron: row.get("cron"),
            timezone: row.get("timezone"),
            enabled: row.get::<i32, _>("enabled") != 0,
            entrypoint: row.get("entrypoint"),
            args,
            env,
            priority: row.get("priority"),
            timeout_secs: row.get("timeout_secs"),
            created_at: DateTime::parse_from_rfc3339(created_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| SchedulerError::Store(e.to_string()))?,
            updated_at: DateTime::parse_from_rfc3339(updated_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| SchedulerError::Store(e.to_string()))?,
            last_triggered_at: last_triggered_str
                .map(|s| DateTime::parse_from_rfc3339(s).ok())
                .flatten()
                .map(|dt| dt.with_timezone(&Utc)),
            next_run_at: next_run_str
                .map(|s| DateTime::parse_from_rfc3339(s).ok())
                .flatten()
                .map(|dt| dt.with_timezone(&Utc)),
            owner: row.get("owner"),
            run_mode: row.get("run_mode"),
        })
    }
}
