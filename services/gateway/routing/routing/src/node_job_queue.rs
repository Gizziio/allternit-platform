#[cfg(target_os = "linux")]
//! Node Job Queue
//!
//! Manages job queue with priority scheduling for node assignment.

use a2r_protocol::{JobResult, JobSpec};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row, SqlitePool};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::AppState;

/// Job queue entry
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct QueuedJob {
    pub id: i64,
    pub job_id: String,
    pub node_id: Option<String>,
    pub status: String,
    pub priority: i32,
    pub job_spec: String,       // JSON
    pub result: Option<String>, // JSON
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Job status enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Pending,
    Scheduled,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Job queue manager
pub struct JobQueue {
    db: SqlitePool,
    /// In-memory priority queue for pending jobs
    pending_jobs: RwLock<Vec<QueuedJob>>,
}

impl JobQueue {
    pub fn new(db: SqlitePool) -> Self {
        Self {
            db,
            pending_jobs: RwLock::new(Vec::new()),
        }
    }

    /// Initialize database tables
    pub async fn init(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS node_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT UNIQUE NOT NULL,
                node_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                priority INTEGER NOT NULL DEFAULT 0,
                job_spec TEXT NOT NULL,
                result TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP
            )
            "#,
        )
        .execute(&self.db)
        .await?;

        self.ensure_required_columns().await?;

        // Create indexes for performance
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_node_jobs_status ON node_jobs(status)
            "#,
        )
        .execute(&self.db)
        .await?;

        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_node_jobs_priority ON node_jobs(priority DESC)
            "#,
        )
        .execute(&self.db)
        .await?;

        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_node_jobs_node ON node_jobs(node_id)
            "#,
        )
        .execute(&self.db)
        .await?;

        info!("✅ Job queue tables initialized");
        Ok(())
    }

    async fn ensure_required_columns(&self) -> Result<(), sqlx::Error> {
        let existing_columns = sqlx::query("PRAGMA table_info(node_jobs)")
            .fetch_all(&self.db)
            .await?;

        let has_column = |name: &str| {
            existing_columns
                .iter()
                .filter_map(|row| row.try_get::<String, _>("name").ok())
                .any(|column_name| column_name == name)
        };

        let required_columns = [
            (
                "priority",
                "ALTER TABLE node_jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 0",
            ),
            ("result", "ALTER TABLE node_jobs ADD COLUMN result TEXT"),
            (
                "started_at",
                "ALTER TABLE node_jobs ADD COLUMN started_at TIMESTAMP",
            ),
            (
                "completed_at",
                "ALTER TABLE node_jobs ADD COLUMN completed_at TIMESTAMP",
            ),
        ];

        for (column_name, statement) in required_columns {
            if !has_column(column_name) {
                warn!(
                    "Migrating legacy node_jobs table: adding missing '{}' column",
                    column_name
                );
                sqlx::query(statement).execute(&self.db).await?;
            }
        }

        Ok(())
    }

    /// Enqueue a job
    pub async fn enqueue(
        &self,
        job: &JobSpec,
        node_id: Option<String>,
    ) -> Result<String, sqlx::Error> {
        let job_id = format!("job-{}", Uuid::new_v4());
        let job_spec =
            serde_json::to_string(job).map_err(|e| sqlx::Error::Protocol(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO node_jobs (job_id, node_id, status, priority, job_spec, created_at)
            VALUES (?, ?, 'pending', ?, ?, ?)
            "#,
        )
        .bind(&job_id)
        .bind(node_id)
        .bind(job.priority)
        .bind(&job_spec)
        .bind(Utc::now().to_rfc3339())
        .execute(&self.db)
        .await?;

        info!("📝 Job {} enqueued (priority: {})", job_id, job.priority);
        Ok(job_id)
    }

    /// Get next pending job (highest priority)
    pub async fn dequeue_next(&self) -> Result<Option<QueuedJob>, sqlx::Error> {
        let job = sqlx::query_as::<_, QueuedJob>(
            r#"
            SELECT * FROM node_jobs 
            WHERE status = 'pending' 
            ORDER BY priority DESC, created_at ASC 
            LIMIT 1
            "#,
        )
        .fetch_optional(&self.db)
        .await?;

        if let Some(ref job) = job {
            // Mark as scheduled
            sqlx::query(
                r#"
                UPDATE node_jobs SET status = 'scheduled', started_at = ? WHERE job_id = ?
                "#,
            )
            .bind(Utc::now().to_rfc3339())
            .bind(&job.job_id)
            .execute(&self.db)
            .await?;

            info!("📤 Job {} dequeued", job.job_id);
        }

        Ok(job)
    }

    /// Update job status
    pub async fn update_status(&self, job_id: &str, status: JobStatus) -> Result<(), sqlx::Error> {
        let status_str = match status {
            JobStatus::Pending => "pending",
            JobStatus::Scheduled => "scheduled",
            JobStatus::Running => "running",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Cancelled => "cancelled",
        };

        let query = match status {
            JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled => sqlx::query(
                r#"
                    UPDATE node_jobs 
                    SET status = ?, completed_at = ? 
                    WHERE job_id = ?
                    "#,
            )
            .bind(status_str)
            .bind(Utc::now().to_rfc3339())
            .bind(job_id),
            _ => sqlx::query(
                r#"
                    UPDATE node_jobs SET status = ? WHERE job_id = ?
                    "#,
            )
            .bind(status_str)
            .bind(job_id),
        };

        query.execute(&self.db).await?;
        Ok(())
    }

    /// Store job result
    pub async fn store_result(&self, job_id: &str, result: &JobResult) -> Result<(), sqlx::Error> {
        let result_json =
            serde_json::to_string(result).map_err(|e| sqlx::Error::Protocol(e.to_string()))?;

        sqlx::query(
            r#"
            UPDATE node_jobs 
            SET result = ?, status = ?, completed_at = ?
            WHERE job_id = ?
            "#,
        )
        .bind(&result_json)
        .bind(if result.success {
            "completed"
        } else {
            "failed"
        })
        .bind(Utc::now().to_rfc3339())
        .bind(job_id)
        .execute(&self.db)
        .await?;

        info!("✅ Job {} result stored", job_id);
        Ok(())
    }

    /// Get job by ID
    pub async fn get_job(&self, job_id: &str) -> Result<Option<QueuedJob>, sqlx::Error> {
        sqlx::query_as::<_, QueuedJob>(
            r#"
            SELECT * FROM node_jobs WHERE job_id = ?
            "#,
        )
        .bind(job_id)
        .fetch_optional(&self.db)
        .await
    }

    /// List jobs for a node
    pub async fn list_node_jobs(&self, node_id: &str) -> Result<Vec<QueuedJob>, sqlx::Error> {
        sqlx::query_as::<_, QueuedJob>(
            r#"
            SELECT * FROM node_jobs 
            WHERE node_id = ? 
            ORDER BY created_at DESC
            "#,
        )
        .bind(node_id)
        .fetch_all(&self.db)
        .await
    }

    /// Get queue statistics
    pub async fn stats(&self) -> Result<JobQueueStats, sqlx::Error> {
        let stats = sqlx::query_as::<_, (i64, i64, i64, i64, i64)>(
            r#"
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'running') as running,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
            FROM node_jobs
            "#,
        )
        .fetch_one(&self.db)
        .await?;

        Ok(JobQueueStats {
            pending: stats.0 as u32,
            running: stats.1 as u32,
            completed: stats.2 as u32,
            failed: stats.3 as u32,
            cancelled: stats.4 as u32,
        })
    }

    /// Cancel a pending job
    pub async fn cancel_job(&self, job_id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query(
            r#"
            UPDATE node_jobs SET status = 'cancelled', completed_at = ? 
            WHERE job_id = ? AND status IN ('pending', 'scheduled')
            "#,
        )
        .bind(Utc::now().to_rfc3339())
        .bind(job_id)
        .execute(&self.db)
        .await?;

        Ok(result.rows_affected() > 0)
    }
}

/// Job queue statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct JobQueueStats {
    pub pending: u32,
    pub running: u32,
    pub completed: u32,
    pub failed: u32,
    pub cancelled: u32,
}

// ============================================================================
// HTTP Handlers
// ============================================================================

/// Request to create a job
#[derive(Debug, Deserialize)]
pub struct CreateJobRequest {
    pub name: String,
    pub wih: a2r_protocol::WIHDefinition,
    #[serde(default)]
    pub resources: a2r_protocol::ResourceRequirements,
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub priority: i32,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    #[serde(default)]
    pub node_id: Option<String>,
}

fn default_timeout() -> u64 {
    3600
}

/// Create a new job
pub async fn create_node_job(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateJobRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let job_spec = JobSpec {
        id: format!("job-{}", Uuid::new_v4()),
        name: payload.name,
        wih: payload.wih,
        resources: payload.resources,
        env: payload.env,
        priority: payload.priority,
        timeout_secs: payload.timeout_secs,
    };

    // Enqueue the job
    match state.job_queue.enqueue(&job_spec, payload.node_id).await {
        Ok(job_id) => {
            info!("📝 Job {} created", job_id);
            Ok((
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "job_id": job_id,
                    "status": "queued",
                })),
            ))
        }
        Err(e) => {
            error!("Failed to create job: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// List all jobs
pub async fn list_node_jobs(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    match state.job_queue.stats().await {
        Ok(stats) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "stats": stats,
            })),
        )),
        Err(e) => {
            error!("Failed to list jobs: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get a specific job
pub async fn get_node_job(
    Path(job_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    match state.job_queue.get_job(&job_id).await {
        Ok(Some(job)) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "job": job,
            })),
        )),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get job {}: {}", job_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Cancel a job
pub async fn cancel_node_job(
    Path(job_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    match state.job_queue.cancel_job(&job_id).await {
        Ok(true) => Ok((StatusCode::NO_CONTENT, ())),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to cancel job {}: {}", job_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get job queue statistics
pub async fn get_job_queue_stats(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    match state.job_queue.stats().await {
        Ok(stats) => Ok((StatusCode::OK, Json(stats))),
        Err(e) => {
            error!("Failed to get job stats: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn init_migrates_legacy_node_jobs_table() {
        let db = SqlitePool::connect("sqlite::memory:").await.unwrap();

        sqlx::query(
            r#"
            CREATE TABLE node_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT UNIQUE NOT NULL,
                node_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                job_spec TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&db)
        .await
        .unwrap();

        let job_queue = JobQueue::new(db.clone());
        job_queue.init().await.unwrap();

        let columns = sqlx::query("PRAGMA table_info(node_jobs)")
            .fetch_all(&db)
            .await
            .unwrap();

        let column_names: Vec<String> = columns
            .iter()
            .map(|row| row.try_get::<String, _>("name").unwrap())
            .collect();

        assert!(column_names.iter().any(|name| name == "priority"));
        assert!(column_names.iter().any(|name| name == "result"));
        assert!(column_names.iter().any(|name| name == "started_at"));
        assert!(column_names.iter().any(|name| name == "completed_at"));
    }
}
