//! Job routes for Cowork Runtime
//!
//! Provides REST API endpoints for job management within runs.

use axum::{
    extract::{Path, Query, State},
    Json,
};
use std::sync::Arc;
use serde::Deserialize;

use crate::{
    ApiError, ApiState,
    db::cowork_models::*,
};

/// Query parameters for listing jobs
#[derive(Debug, Deserialize, Default)]
pub struct ListJobsQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Create job request
#[derive(Debug, Deserialize)]
pub struct CreateJobRequest {
    pub name: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub config: JobConfig,
}

/// Update job request
#[derive(Debug, Deserialize, Default)]
pub struct UpdateJobRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<JobStatus>,
}

/// List jobs for a run
pub async fn list_jobs(
    State(state): State<Arc<ApiState>>,
    Path(run_id): Path<String>,
    Query(query): Query<ListJobsQuery>,
) -> Result<Json<Vec<Job>>, ApiError> {
    // Verify run exists
    let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = ?")
        .bind(&run_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
    
    if run.is_none() {
        return Err(ApiError::NotFound(format!("Run not found: {}", run_id)));
    }
    
    let limit = query.limit.unwrap_or(100);
    let offset = query.offset.unwrap_or(0);
    
    let jobs = if let Some(status_str) = query.status {
        sqlx::query_as::<_, Job>(
            "SELECT * FROM jobs WHERE run_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .bind(&run_id)
        .bind(status_str)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?
    } else {
        sqlx::query_as::<_, Job>(
            "SELECT * FROM jobs WHERE run_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .bind(&run_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?
    };
    
    Ok(Json(jobs))
}

/// Create a new job for a run
pub async fn create_job(
    State(state): State<Arc<ApiState>>,
    Path(run_id): Path<String>,
    Json(request): Json<CreateJobRequest>,
) -> Result<Json<Job>, ApiError> {
    tracing::info!("Creating job '{}' for run: {}", request.name, run_id);
    
    // Verify run exists
    let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = ?")
        .bind(&run_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
    
    if run.is_none() {
        return Err(ApiError::NotFound(format!("Run not found: {}", run_id)));
    }
    
    let job_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();
    let priority = request.priority.unwrap_or(0);
    
    let job = sqlx::query_as::<_, Job>(
        r#"
        INSERT INTO jobs (
            id, run_id, name, description, status, priority, queue_position,
            config, scheduled_at, started_at, completed_at, exit_code, result,
            error_message, retry_count, max_retries, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#
    )
    .bind(&job_id)
    .bind(&run_id)
    .bind(&request.name)
    .bind(&request.description)
    .bind(JobStatus::Pending)
    .bind(priority)
    .bind(None::<i32>) // queue_position
    .bind(sqlx::types::Json(request.config.clone()))
    .bind(None::<chrono::DateTime<chrono::Utc>>) // scheduled_at
    .bind(None::<chrono::DateTime<chrono::Utc>>) // started_at
    .bind(None::<chrono::DateTime<chrono::Utc>>) // completed_at
    .bind(None::<i32>) // exit_code
    .bind(None::<sqlx::types::Json<serde_json::Value>>) // result
    .bind(None::<String>) // error_message
    .bind(0i32) // retry_count
    .bind(0i32) // max_retries
    .bind(now)
    .bind(now)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    // Emit job created event
    let _ = state.event_store.append(
        &run_id,
        EventType::JobQueued,
        serde_json::json!({
            "job_id": job_id,
            "job_name": request.name,
            "priority": priority,
            "config": request.config,
        })
    ).await;
    
    tracing::info!("Job created: {} for run: {}", job_id, run_id);
    Ok(Json(job))
}

/// Get job by ID
pub async fn get_job(
    State(state): State<Arc<ApiState>>,
    Path((run_id, job_id)): Path<(String, String)>,
) -> Result<Json<Job>, ApiError> {
    let job = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE id = ? AND run_id = ?"
    )
    .bind(&job_id)
    .bind(&run_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    job.ok_or_else(|| ApiError::NotFound(format!("Job not found: {}", job_id)))
        .map(Json)
}

/// Update job
pub async fn update_job(
    State(state): State<Arc<ApiState>>,
    Path((run_id, job_id)): Path<(String, String)>,
    Json(request): Json<UpdateJobRequest>,
) -> Result<Json<Job>, ApiError> {
    // Get existing job
    let job = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE id = ? AND run_id = ?"
    )
    .bind(&job_id)
    .bind(&run_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let job = job.ok_or_else(|| ApiError::NotFound(format!("Job not found: {}", job_id)))?;
    
    let name = request.name.unwrap_or_else(|| job.name.clone());
    let description = request.description.or(job.description.clone());
    let status = request.status.unwrap_or(job.status);
    
    let updated = sqlx::query_as::<_, Job>(
        r#"
        UPDATE jobs 
        SET name = ?, description = ?, status = ?, updated_at = ?
        WHERE id = ? AND run_id = ?
        RETURNING *
        "#
    )
    .bind(&name)
    .bind(&description)
    .bind(status)
    .bind(chrono::Utc::now())
    .bind(&job_id)
    .bind(&run_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    Ok(Json(updated))
}

/// Delete a job
pub async fn delete_job(
    State(state): State<Arc<ApiState>>,
    Path((run_id, job_id)): Path<(String, String)>,
) -> Result<(), ApiError> {
    let result = sqlx::query(
        "DELETE FROM jobs WHERE id = ? AND run_id = ?"
    )
    .bind(&job_id)
    .bind(&run_id)
    .execute(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound(format!("Job not found: {}", job_id)));
    }
    
    Ok(())
}

/// Start a job (mark as running)
pub async fn start_job(
    State(state): State<Arc<ApiState>>,
    Path((run_id, job_id)): Path<(String, String)>,
) -> Result<Json<Job>, ApiError> {
    let now = chrono::Utc::now();
    
    let job = sqlx::query_as::<_, Job>(
        r#"
        UPDATE jobs 
        SET status = ?, started_at = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND status IN (?, ?)
        RETURNING *
        "#
    )
    .bind(JobStatus::Running)
    .bind(now)
    .bind(now)
    .bind(&job_id)
    .bind(&run_id)
    .bind(JobStatus::Pending)
    .bind(JobStatus::Queued)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let job = job.ok_or_else(|| ApiError::NotFound(format!("Job not found or cannot be started: {}", job_id)))?;
    
    // Emit job started event
    let _ = state.event_store.append(
        &run_id,
        EventType::JobStarted,
        serde_json::json!({
            "job_id": job_id,
            "job_name": job.name,
            "started_at": now,
        })
    ).await;
    
    Ok(Json(job))
}

/// Complete a job successfully
pub async fn complete_job(
    State(state): State<Arc<ApiState>>,
    Path((run_id, job_id)): Path<(String, String)>,
    Json(result): Json<serde_json::Value>,
) -> Result<Json<Job>, ApiError> {
    let now = chrono::Utc::now();
    let result_clone = result.clone();
    
    let job = sqlx::query_as::<_, Job>(
        r#"
        UPDATE jobs 
        SET status = ?, completed_at = ?, exit_code = ?, result = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND status = ?
        RETURNING *
        "#
    )
    .bind(JobStatus::Completed)
    .bind(now)
    .bind(0i32) // exit_code 0 = success
    .bind(sqlx::types::Json(result))
    .bind(now)
    .bind(&job_id)
    .bind(&run_id)
    .bind(JobStatus::Running)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let job = job.ok_or_else(|| ApiError::NotFound(format!("Job not found or not running: {}", job_id)))?;
    
    // Emit job completed event
    let _ = state.event_store.append(
        &run_id,
        EventType::JobCompleted,
        serde_json::json!({
            "job_id": job_id,
            "job_name": job.name,
            "exit_code": 0,
            "result": result_clone,
            "completed_at": now,
        })
    ).await;
    
    Ok(Json(job))
}

/// Fail a job
pub async fn fail_job(
    State(state): State<Arc<ApiState>>,
    Path((run_id, job_id)): Path<(String, String)>,
    Json(request): Json<FailJobRequest>,
) -> Result<Json<Job>, ApiError> {
    let now = chrono::Utc::now();
    
    let job = sqlx::query_as::<_, Job>(
        r#"
        UPDATE jobs 
        SET status = ?, completed_at = ?, exit_code = ?, error_message = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND status = ?
        RETURNING *
        "#
    )
    .bind(JobStatus::Failed)
    .bind(now)
    .bind(request.exit_code.unwrap_or(1))
    .bind(&request.error_message)
    .bind(now)
    .bind(&job_id)
    .bind(&run_id)
    .bind(JobStatus::Running)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let job = job.ok_or_else(|| ApiError::NotFound(format!("Job not found or not running: {}", job_id)))?;
    
    // Emit job failed event
    let _ = state.event_store.append(
        &run_id,
        EventType::JobFailed,
        serde_json::json!({
            "job_id": job_id,
            "job_name": job.name,
            "exit_code": request.exit_code.unwrap_or(1),
            "error_message": request.error_message,
            "failed_at": now,
        })
    ).await;
    
    Ok(Json(job))
}

/// Fail job request
#[derive(Debug, Deserialize)]
pub struct FailJobRequest {
    pub exit_code: Option<i32>,
    pub error_message: String,
}

/// Cancel a job
pub async fn cancel_job(
    State(state): State<Arc<ApiState>>,
    Path((run_id, job_id)): Path<(String, String)>,
) -> Result<Json<Job>, ApiError> {
    let now = chrono::Utc::now();
    
    let job = sqlx::query_as::<_, Job>(
        r#"
        UPDATE jobs 
        SET status = ?, completed_at = ?, error_message = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND status IN (?, ?, ?)
        RETURNING *
        "#
    )
    .bind(JobStatus::Cancelled)
    .bind(now)
    .bind("Cancelled by user")
    .bind(now)
    .bind(&job_id)
    .bind(&run_id)
    .bind(JobStatus::Pending)
    .bind(JobStatus::Queued)
    .bind(JobStatus::Running)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;
    
    let job = job.ok_or_else(|| ApiError::NotFound(format!("Job not found or already completed: {}", job_id)))?;
    
    // Emit job cancelled event
    let _ = state.event_store.append(
        &run_id,
        EventType::JobCancelled,
        serde_json::json!({
            "job_id": job_id,
            "job_name": job.name,
            "cancelled_at": now,
        })
    ).await;
    
    Ok(Json(job))
}
