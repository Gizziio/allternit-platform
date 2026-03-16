/**
 * MoA API Routes
 * 
 * HTTP endpoints for Mixture of Agents orchestration.
 */

use axum::{
    extract::{Path, State},
    Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::moa::service::MoAService;

/// Shared application state
pub struct AppState {
    pub moa_service: Arc<MoAService>,
}

/// Create MoA router
pub fn create_moa_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/moa/submit", post(submit_job))
        .route("/moa/job/:job_id", get(get_job))
        .route("/moa/job/:job_id/cancel", post(cancel_job))
        .route("/moa/jobs", get(list_jobs))
        .route("/moa/job/:job_id/stream", get(stream_job))
        .with_state(state)
}

/// Request/Response types
#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub prompt: String,
}

#[derive(Debug, Serialize)]
pub struct SubmitResponse {
    pub job_id: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct JobResponse {
    pub id: String,
    pub status: String,
    pub progress: u8,
    pub task_count: usize,
    pub completed_count: usize,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
pub struct ProgressEvent {
    pub job_id: String,
    pub progress: u8,
    pub status: String,
    pub tasks: Vec<TaskStatus>,
}

#[derive(Debug, Serialize)]
pub struct TaskStatus {
    pub id: String,
    pub status: String,
    pub progress: Option<u8>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/moa/submit
async fn submit_job(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SubmitRequest>,
) -> Result<Json<SubmitResponse>, (http::StatusCode, String)> {
    match state.moa_service.submit(req.prompt).await {
        Ok(job_id) => Ok(Json(SubmitResponse {
            job_id,
            status: "queued".to_string(),
        })),
        Err(e) => Err((http::StatusCode::BAD_REQUEST, e)),
    }
}

/// GET /api/moa/job/:job_id
async fn get_job(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> Result<Json<JobResponse>, (http::StatusCode, String)> {
    match state.moa_service.get_job(&job_id).await {
        Some(job) => Ok(Json(JobResponse {
            id: job.id,
            status: format!("{:?}", job.status).to_lowercase(),
            progress: job.graph.progress(),
            task_count: job.graph.tasks.len(),
            completed_count: job.graph.tasks_by_status(crate::moa::types::TaskStatus::Complete).len(),
            created_at: job.created_at,
            updated_at: job.updated_at,
        })),
        None => Err((http::StatusCode::NOT_FOUND, "Job not found".to_string())),
    }
}

/// POST /api/moa/job/:job_id/cancel
async fn cancel_job(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> Result<Json<SubmitResponse>, (http::StatusCode, String)> {
    match state.moa_service.cancel(&job_id).await {
        Ok(()) => Ok(Json(SubmitResponse {
            job_id,
            status: "cancelled".to_string(),
        })),
        Err(e) => Err((http::StatusCode::BAD_REQUEST, e)),
    }
}

/// GET /api/moa/jobs
async fn list_jobs(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<JobResponse>> {
    let jobs = state.moa_service.list_jobs().await;
    Json(jobs.iter().map(|job| JobResponse {
        id: job.id.clone(),
        status: format!("{:?}", job.status).to_lowercase(),
        progress: job.graph.progress(),
        task_count: job.graph.tasks.len(),
        completed_count: job.graph.tasks_by_status(crate::moa::types::TaskStatus::Complete).len(),
        created_at: job.created_at,
        updated_at: job.updated_at,
    }).collect())
}

/// GET /api/moa/job/:job_id/stream (SSE)
async fn stream_job(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> impl axum::response::IntoResponse {
    use axum::response::sse::{Event, KeepAlive, Sse};
    use futures::stream::Stream;
    use std::time::Duration;

    let mut rx = state.moa_service.stream_progress(job_id.clone()).await;

    let stream: impl Stream<Item = Result<Event, axum::Error>> = tokio_stream::wrappers::UnboundedReceiverStream::new(rx)
        .map(|event| {
            let data = serde_json::to_string(&ProgressEvent {
                job_id: event.job_id,
                progress: event.progress,
                status: format!("{:?}", event.status).to_lowercase(),
                tasks: event.task_statuses.iter().map(|(id, status, progress)| TaskStatus {
                    id: id.clone(),
                    status: format!("{:?}", status).to_lowercase(),
                    progress: *progress,
                }).collect(),
            }).unwrap();
            
            Ok(Event::default().data(data))
        });

    Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(5)))
}
