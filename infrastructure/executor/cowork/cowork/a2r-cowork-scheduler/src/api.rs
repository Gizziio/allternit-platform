//! HTTP API for the scheduler
//!
//! Provides REST endpoints compatible with the Gizzi CLI cron command

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::{CreateScheduleRequest, Result, Schedule, Scheduler, SchedulerError};

/// API state shared across handlers
pub struct ApiState {
    pub scheduler: Arc<RwLock<Scheduler>>,
}

/// Schedule response DTO
#[derive(Debug, Serialize)]
pub struct ScheduleResponse {
    pub id: String,
    pub name: String,
    pub schedule: String,
    pub entrypoint: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_run_at: Option<String>,
    pub next_run_at: Option<String>,
    pub run_count: i64,
    pub fail_count: i64,
}

impl From<Schedule> for ScheduleResponse {
    fn from(s: Schedule) -> Self {
        Self {
            id: s.id,
            name: s.name,
            schedule: s.cron,
            entrypoint: s.entrypoint,
            status: if s.enabled { "active" } else { "paused" }.to_string(),
            created_at: s.created_at.to_rfc3339(),
            updated_at: s.updated_at.to_rfc3339(),
            last_run_at: s.last_triggered_at.map(|t| t.to_rfc3339()),
            next_run_at: s.next_run_at.map(|t| t.to_rfc3339()),
            run_count: 0, // TODO: track runs
            fail_count: 0,
        }
    }
}

/// Create schedule request
#[derive(Debug, Deserialize)]
pub struct CreateScheduleDto {
    pub name: String,
    pub schedule: String,
    pub entrypoint: String,
    pub args: Option<Vec<String>>,
    pub env: Option<std::collections::HashMap<String, String>>,
    pub timezone: Option<String>,
}

/// Update schedule request
#[derive(Debug, Deserialize)]
pub struct UpdateScheduleDto {
    pub name: Option<String>,
    pub schedule: Option<String>,
    pub entrypoint: Option<String>,
    pub status: Option<String>,
}

/// Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// List all schedules
async fn list_schedules(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    let scheduler = state.scheduler.read().await;
    
    match scheduler.list_schedules().await {
        Ok(schedules) => {
            let responses: Vec<ScheduleResponse> = schedules.into_iter().map(Into::into).collect();
            (StatusCode::OK, Json(responses)).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to list schedules");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
                .into_response()
        }
    }
}

/// Get a schedule by ID
async fn get_schedule(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let scheduler = state.scheduler.read().await;
    
    match scheduler.get_schedule(&id).await {
        Ok(schedule) => {
            (StatusCode::OK, Json(ScheduleResponse::from(schedule))).into_response()
        }
        Err(SchedulerError::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Schedule '{}' not found", id),
            }),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
            .into_response(),
    }
}

/// Create a new schedule
async fn create_schedule(
    State(state): State<Arc<ApiState>>,
    Json(dto): Json<CreateScheduleDto>,
) -> impl IntoResponse {
    let req = CreateScheduleRequest {
        name: dto.name,
        cron: dto.schedule,
        timezone: dto.timezone,
        entrypoint: dto.entrypoint,
        args: dto.args,
        env: dto.env,
        priority: None,
        timeout_secs: None,
        run_mode: Some("scheduled".to_string()),
    };

    let mut scheduler = state.scheduler.write().await;
    
    match scheduler.create_schedule("default", req).await {
        Ok(schedule) => {
            info!(schedule_id = %schedule.id, "Created schedule via API");
            (StatusCode::CREATED, Json(ScheduleResponse::from(schedule))).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to create schedule");
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
                .into_response()
        }
    }
}

/// Update a schedule
async fn update_schedule(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Json(dto): Json<UpdateScheduleDto>,
) -> impl IntoResponse {
    // Handle status change
    if let Some(status) = dto.status {
        let mut scheduler = state.scheduler.write().await;
        
        let result = match status.as_str() {
            "active" => scheduler.enable_schedule(&id).await,
            "paused" | "disabled" => {
                // Get the schedule first to return it after disabling
                let schedule = scheduler.get_schedule(&id).await;
                if let Ok(_) = schedule {
                    // Note: disable_schedule doesn't exist in current impl
                    // For now just return the schedule
                    schedule
                } else {
                    schedule
                }
            }
            _ => Err(SchedulerError::InvalidCron(format!("Invalid status: {}", status))),
        };
        
        match result {
            Ok(schedule) => {
                return (StatusCode::OK, Json(ScheduleResponse::from(schedule))).into_response();
            }
            Err(SchedulerError::NotFound(_)) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(ErrorResponse {
                        error: format!("Schedule '{}' not found", id),
                    }),
                )
                    .into_response();
            }
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: e.to_string(),
                    }),
                )
                    .into_response();
            }
        }
    }
    
    (
        StatusCode::OK,
        Json(serde_json::json!({ "message": "Update not fully implemented" })),
    )
        .into_response()
}

/// Delete a schedule
async fn delete_schedule(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let mut scheduler = state.scheduler.write().await;
    
    match scheduler.delete_schedule(&id).await {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(SchedulerError::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Schedule '{}' not found", id),
            }),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
            .into_response(),
    }
}

/// Trigger a schedule immediately
async fn trigger_schedule(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let mut scheduler = state.scheduler.write().await;
    
    match scheduler.run_now(&id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({ "message": "Schedule triggered" })),
        )
            .into_response(),
        Err(SchedulerError::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Schedule '{}' not found", id),
            }),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
            .into_response(),
    }
}

/// Get scheduler status
async fn get_status(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    let mut scheduler = state.scheduler.write().await;
    
    match scheduler.get_stats().await {
        Ok(stats) => {
            let response = serde_json::json!({
                "jobs": stats.total_schedules,
                "active": stats.enabled_schedules,
                "pending_runs": 0,
                "running_runs": 0,
            });
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
            .into_response(),
    }
}

/// Wake/Trigger all due schedules
async fn wake_schedules(State(state): State<Arc<ApiState>>) -> impl IntoResponse {
    // This would check for due jobs and trigger them
    // For now, just return a placeholder response
    let response = serde_json::json!({
        "triggered": 0,
        "jobs": [],
    });
    (StatusCode::OK, Json(response)).into_response()
}

/// Create the API router
pub fn api_router(state: Arc<ApiState>) -> Router {
    Router::new()
        .route("/schedules", get(list_schedules).post(create_schedule))
        .route("/schedules/:id", get(get_schedule).patch(update_schedule).delete(delete_schedule))
        .route("/schedules/:id/run", post(trigger_schedule))
        .route("/status", get(get_status))
        .route("/wake", post(wake_schedules))
        .with_state(state)
}
