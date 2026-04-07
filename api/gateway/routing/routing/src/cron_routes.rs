//! Cron Job Routes - Native OpenClaw Cron System HTTP API
//!
//! Provides REST API endpoints for managing cron jobs using the native
//! Rust implementation in allternit_openclaw_host::native_cron_system.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::ToSchema;

use allternit_openclaw_host::native_cron_system::{
    CronJobDefinition, CronJobExecutionRequest, CronJobId, CronJobManagementRequest,
    CronJobOperation,
};

/// Create cron job request
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateCronJobRequest {
    pub name: String,
    pub description: Option<String>,
    /// Cron expression (e.g., "0 9 * * *" for daily at 9 AM)
    pub schedule: String,
    /// Command to execute
    pub command: String,
    /// Optional command arguments
    pub arguments: Option<HashMap<String, serde_json::Value>>,
    /// Whether the job is enabled (default: true)
    pub enabled: Option<bool>,
    /// Optional metadata
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Cron job response
#[derive(Debug, Serialize, ToSchema)]
pub struct CronJobResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub schedule: String,
    pub command: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
}

/// Cron job list response
#[derive(Debug, Serialize, ToSchema)]
pub struct CronJobListResponse {
    pub jobs: Vec<CronJobResponse>,
    pub count: usize,
}

/// Cron job detail response
#[derive(Debug, Serialize, ToSchema)]
pub struct CronJobDetailResponse {
    pub job: CronJobResponse,
    pub arguments: Option<HashMap<String, serde_json::Value>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Cron execution response
#[derive(Debug, Serialize, ToSchema)]
pub struct CronExecutionResponse {
    pub status: String,
    pub job_id: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub started_at: String,
    pub completed_at: String,
    pub duration_ms: u64,
}

/// Cron scheduler status response
#[derive(Debug, Serialize, ToSchema)]
pub struct CronStatusResponse {
    pub total_jobs: usize,
    pub enabled_jobs: usize,
    pub config: CronConfigInfo,
}

/// Cron configuration info
#[derive(Debug, Serialize, ToSchema)]
pub struct CronConfigInfo {
    pub jobs_dir: String,
    pub enable_persistence: bool,
    pub max_history_entries: Option<usize>,
    pub max_concurrent_jobs: Option<usize>,
}

/// Error response
#[derive(Debug, Serialize, ToSchema)]
pub struct CronErrorResponse {
    pub error: String,
}

/// Create router for cron job routes
pub fn create_cron_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Cron job CRUD endpoints
        .route("/api/v1/cron", get(list_cron_jobs).post(create_cron_job))
        .route(
            "/api/v1/cron/:id",
            get(get_cron_job).delete(delete_cron_job),
        )
        // Job execution
        .route("/api/v1/cron/:id/run", post(run_cron_job))
        // Job enable/disable
        .route("/api/v1/cron/:id/enable", post(enable_cron_job))
        .route("/api/v1/cron/:id/disable", post(disable_cron_job))
        // Scheduler status
        .route("/api/v1/cron/status", get(get_cron_status))
}

/// List all cron jobs
#[utoipa::path(
    get,
    path = "/api/v1/cron",
    responses(
        (status = 200, description = "List of cron jobs", body = CronJobListResponse),
        (status = 500, description = "Failed to list jobs", body = CronErrorResponse)
    )
)]
async fn list_cron_jobs(State(state): State<Arc<crate::AppState>>) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = cron_service.write().await;

    let request = CronJobManagementRequest {
        operation: CronJobOperation::ListJobs,
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if let Some(result) = response.result {
                // Parse the result and convert to response format
                if let Some(jobs) = result.get("jobs").and_then(|j| j.as_array()) {
                    let job_responses: Vec<CronJobResponse> = jobs
                        .iter()
                        .filter_map(|job| {
                            Some(CronJobResponse {
                                id: job.get("id")?.as_str()?.to_string(),
                                name: job.get("name")?.as_str()?.to_string(),
                                description: job.get("description")?.as_str()?.to_string(),
                                schedule: job.get("schedule")?.as_str()?.to_string(),
                                command: job.get("command")?.as_str()?.to_string(),
                                enabled: job.get("enabled")?.as_bool().unwrap_or(true),
                                created_at: job.get("createdAt")?.as_str()?.to_string(),
                                updated_at: job.get("updatedAt")?.as_str()?.to_string(),
                                last_run: job
                                    .get("lastRun")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                next_run: job
                                    .get("nextRun")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                            })
                        })
                        .collect();

                    let response = CronJobListResponse {
                        count: job_responses.len(),
                        jobs: job_responses,
                    };
                    return (StatusCode::OK, Json(response)).into_response();
                }
            }

            // Fallback: return empty list
            let response = CronJobListResponse {
                count: 0,
                jobs: vec![],
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list cron jobs: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to list jobs: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Create a new cron job
#[utoipa::path(
    post,
    path = "/api/v1/cron",
    request_body = CreateCronJobRequest,
    responses(
        (status = 201, description = "Job created successfully", body = serde_json::Value),
        (status = 400, description = "Invalid request", body = CronErrorResponse),
        (status = 500, description = "Failed to create job", body = CronErrorResponse)
    )
)]
async fn create_cron_job(
    State(state): State<Arc<crate::AppState>>,
    Json(req): Json<CreateCronJobRequest>,
) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    // Validate required fields
    if req.name.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Job name cannot be empty"})),
        )
            .into_response();
    }

    if req.schedule.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Schedule cannot be empty"})),
        )
            .into_response();
    }

    if req.command.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Command cannot be empty"})),
        )
            .into_response();
    }

    let job_id = CronJobId::new(uuid::Uuid::new_v4().to_string());
    let now = chrono::Utc::now();

    let job_def = CronJobDefinition {
        id: job_id.clone(),
        name: req.name,
        description: req.description.unwrap_or_default(),
        schedule: req.schedule,
        command: req.command,
        arguments: req.arguments,
        enabled: req.enabled.unwrap_or(true),
        metadata: req.metadata,
        created_at: now,
        updated_at: now,
        last_run: None,
        next_run: None,
    };

    let mut service = cron_service.write().await;

    let request = CronJobManagementRequest {
        operation: CronJobOperation::UpsertJob {
            definition: job_def,
        },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if response.success {
                (
                    StatusCode::CREATED,
                    Json(serde_json::json!({
                        "status": "job_created",
                        "id": job_id.as_str(),
                    })),
                )
                    .into_response()
            } else {
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({
                        "error": response.error.unwrap_or_else(|| "Failed to create job".to_string())
                    })),
                ).into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to create cron job: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to create job: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Get a specific cron job by ID
#[utoipa::path(
    get,
    path = "/api/v1/cron/{id}",
    params(
        ("id" = String, Path, description = "Job ID")
    ),
    responses(
        (status = 200, description = "Job retrieved successfully", body = CronJobDetailResponse),
        (status = 404, description = "Job not found", body = CronErrorResponse),
        (status = 500, description = "Failed to get job", body = CronErrorResponse)
    )
)]
async fn get_cron_job(
    State(state): State<Arc<crate::AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = cron_service.write().await;

    let request = CronJobManagementRequest {
        operation: CronJobOperation::GetJob {
            id: CronJobId::new(job_id),
        },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if let Some(result) = response.result {
                if let Some(job) = result.get("job") {
                    let job_response = CronJobResponse {
                        id: job
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        name: job
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        description: job
                            .get("description")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        schedule: job
                            .get("schedule")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        command: job
                            .get("command")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        enabled: job.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
                        created_at: job
                            .get("createdAt")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        updated_at: job
                            .get("updatedAt")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        last_run: job
                            .get("lastRun")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        next_run: job
                            .get("nextRun")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                    };

                    let detail_response =
                        CronJobDetailResponse {
                            job: job_response,
                            arguments: job.get("arguments").and_then(|v| v.as_object()).map(
                                |obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
                            ),
                            metadata: job.get("metadata").and_then(|v| v.as_object()).map(|obj| {
                                obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
                            }),
                        };
                    return (StatusCode::OK, Json(detail_response)).into_response();
                }
            }

            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Job not found"})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::warn!("Failed to get cron job: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Job not found: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Delete a cron job
#[utoipa::path(
    delete,
    path = "/api/v1/cron/{id}",
    params(
        ("id" = String, Path, description = "Job ID")
    ),
    responses(
        (status = 204, description = "Job deleted successfully"),
        (status = 404, description = "Job not found", body = CronErrorResponse),
        (status = 500, description = "Failed to delete job", body = CronErrorResponse)
    )
)]
async fn delete_cron_job(
    State(state): State<Arc<crate::AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = cron_service.write().await;

    let request = CronJobManagementRequest {
        operation: CronJobOperation::RemoveJob {
            id: CronJobId::new(job_id),
        },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if response.success {
                StatusCode::NO_CONTENT.into_response()
            } else {
                (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({
                        "error": response.error.unwrap_or_else(|| "Job not found".to_string())
                    })),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::warn!("Failed to delete cron job: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Job not found: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Run a cron job immediately
#[utoipa::path(
    post,
    path = "/api/v1/cron/{id}/run",
    params(
        ("id" = String, Path, description = "Job ID")
    ),
    responses(
        (status = 200, description = "Job executed successfully", body = CronExecutionResponse),
        (status = 404, description = "Job not found", body = CronErrorResponse),
        (status = 500, description = "Failed to execute job", body = CronErrorResponse)
    )
)]
async fn run_cron_job(
    State(state): State<Arc<crate::AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = cron_service.write().await;
    let job_id_clone = job_id.clone();

    let exec_request = CronJobExecutionRequest {
        job_id: CronJobId::new(job_id),
        force_execution: true,
        override_arguments: None,
    };

    let request = CronJobManagementRequest {
        operation: CronJobOperation::ExecuteJob {
            request: exec_request,
        },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if let Some(result) = response.result {
                if let Some(exec_result) = result.get("result") {
                    let exec_response = CronExecutionResponse {
                        status: "job_executed".to_string(),
                        job_id: exec_result
                            .get("job_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        success: exec_result
                            .get("success")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false),
                        output: exec_result
                            .get("output")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        error: exec_result
                            .get("error")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        started_at: exec_result
                            .get("started_at")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        completed_at: exec_result
                            .get("completed_at")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        duration_ms: exec_result
                            .get("duration_ms")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0),
                    };
                    return (StatusCode::OK, Json(exec_response)).into_response();
                }
            }

            (
                StatusCode::OK,
                Json(serde_json::json!({"status": "job_triggered", "job_id": job_id_clone})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("Failed to execute cron job: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to execute job: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Enable a cron job
#[utoipa::path(
    post,
    path = "/api/v1/cron/{id}/enable",
    params(
        ("id" = String, Path, description = "Job ID")
    ),
    responses(
        (status = 200, description = "Job enabled successfully", body = serde_json::Value),
        (status = 404, description = "Job not found", body = CronErrorResponse),
        (status = 500, description = "Failed to enable job", body = CronErrorResponse)
    )
)]
async fn enable_cron_job(
    State(state): State<Arc<crate::AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = cron_service.write().await;
    let job_id_clone = job_id.clone();

    let request = CronJobManagementRequest {
        operation: CronJobOperation::EnableJob {
            id: CronJobId::new(job_id),
        },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if response.success {
                (
                    StatusCode::OK,
                    Json(serde_json::json!({"status": "job_enabled", "id": job_id_clone})),
                )
                    .into_response()
            } else {
                (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({
                        "error": response.error.unwrap_or_else(|| "Job not found".to_string())
                    })),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::warn!("Failed to enable cron job: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Job not found: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Disable a cron job
#[utoipa::path(
    post,
    path = "/api/v1/cron/{id}/disable",
    params(
        ("id" = String, Path, description = "Job ID")
    ),
    responses(
        (status = 200, description = "Job disabled successfully", body = serde_json::Value),
        (status = 404, description = "Job not found", body = CronErrorResponse),
        (status = 500, description = "Failed to disable job", body = CronErrorResponse)
    )
)]
async fn disable_cron_job(
    State(state): State<Arc<crate::AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = cron_service.write().await;
    let job_id_clone = job_id.clone();

    let request = CronJobManagementRequest {
        operation: CronJobOperation::DisableJob {
            id: CronJobId::new(job_id),
        },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if response.success {
                (
                    StatusCode::OK,
                    Json(serde_json::json!({"status": "job_disabled", "id": job_id_clone})),
                )
                    .into_response()
            } else {
                (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({
                        "error": response.error.unwrap_or_else(|| "Job not found".to_string())
                    })),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::warn!("Failed to disable cron job: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("Job not found: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Get cron scheduler status
#[utoipa::path(
    get,
    path = "/api/v1/cron/status",
    responses(
        (status = 200, description = "Scheduler status", body = CronStatusResponse),
        (status = 500, description = "Failed to get status", body = CronErrorResponse)
    )
)]
async fn get_cron_status(State(state): State<Arc<crate::AppState>>) -> impl IntoResponse {
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Cron service not initialized"})),
            )
                .into_response();
        }
    };

    let service = cron_service.read().await;

    // Extract config values while we have the read lock
    let config_info = CronConfigInfo {
        jobs_dir: service.config().jobs_dir.to_string_lossy().to_string(),
        enable_persistence: service.config().enable_persistence,
        max_history_entries: service.config().max_history_entries,
        max_concurrent_jobs: service.config().max_concurrent_jobs,
    };

    drop(service);

    let mut service = cron_service.write().await;
    let request = CronJobManagementRequest {
        operation: CronJobOperation::GetStatus,
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            let (total_jobs, enabled_jobs) = if let Some(result) = response.result {
                (
                    result
                        .get("totalJobs")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0) as usize,
                    result
                        .get("enabledJobs")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0) as usize,
                )
            } else {
                (0, 0)
            };

            let status_response = CronStatusResponse {
                total_jobs,
                enabled_jobs,
                config: config_info,
            };
            (StatusCode::OK, Json(status_response)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to get cron status: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to get status: {}", e)})),
            )
                .into_response()
        }
    }
}
