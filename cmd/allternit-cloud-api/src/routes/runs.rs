//! Run routes for Cowork Runtime
//!
//! Provides REST API endpoints for run lifecycle management.

use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use std::sync::Arc;
use serde::Deserialize;

use crate::{
    ApiError, ApiState,
    auth::middleware::AuthContext,
    db::cowork_models::*,
    services::{run_service::RunListFilter},
};

/// Query parameters for listing runs
#[derive(Debug, Deserialize, Default)]
pub struct ListRunsQuery {
    pub status: Option<String>,
    pub mode: Option<String>,
    pub owner_id: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Event query parameters
#[derive(Debug, Deserialize, Default)]
pub struct EventQuery {
    pub cursor: Option<i64>,
    pub limit: Option<i64>,
}

/// Create a new run
pub async fn create_run(
    State(state): State<Arc<ApiState>>,
    Json(request): Json<CreateRunRequest>,
) -> Result<Json<Run>, ApiError> {
    tracing::info!("Creating run: {}", request.name);
    
    // Validate region if specified
    if let Some(ref region_id) = request.region_id {
        let region_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM regions WHERE id = ? AND active = TRUE)"
        )
        .bind(region_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        if !region_exists {
            return Err(ApiError::BadRequest(format!(
                "Region '{}' not found or inactive", region_id
            )));
        }
    }
    
    // Use shared run service from state
    let run = state.run_service.create(request).await?;
    
    tracing::info!("Run created: {}", run.id);
    Ok(Json(run))
}

/// List all runs

pub async fn list_runs(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Query(query): Query<ListRunsQuery>,
) -> Result<Json<Vec<RunSummary>>, ApiError> {
    let filter = RunListFilter {
        status: query.status.map(|s| {
            s.split(',')
                .filter_map(|part| serde_json::from_str(&format!("\"{}\"", part.trim())).ok())
                .collect()
        }),
        mode: query.mode.map(|m| {
            vec![serde_json::from_str(&format!("\"{}\"", m)).unwrap_or(RunMode::Local)]
        }),
        owner_id: query.owner_id,
        tenant_id: Some(auth_context.user.user_id.clone()),
        schedule_id: None,
        runtime_id: None,
        since: None,
        until: None,
        limit: query.limit,
        offset: query.offset,
    };
    
    // Use shared run service from state
    let runs = state.run_service.list(filter).await?;
    
    Ok(Json(runs))
}

/// Get run by ID

pub async fn get_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Run>, ApiError> {
    // Use shared run service from state
    let run = state.run_service.get(&id).await?;
    
    Ok(Json(run))
}

/// Update run metadata

pub async fn update_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Json(request): Json<UpdateRunRequest>,
) -> Result<Json<Run>, ApiError> {
    let run = state.run_service.update(&id, request).await?;
    
    Ok(Json(run))
}

/// Delete a run

pub async fn delete_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<(), ApiError> {
    state.run_service.delete(&id).await?;
    
    Ok(())
}

/// Start a run

pub async fn start_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Run>, ApiError> {
    tracing::info!("Starting run: {}", id);
    
    let run = state.run_service.start(&id).await?;
    
    Ok(Json(run))
}

/// Pause a run

pub async fn pause_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Run>, ApiError> {
    tracing::info!("Pausing run: {}", id);
    
    let run = state.run_service.pause(&id).await?;
    
    Ok(Json(run))
}

/// Resume a paused run

pub async fn resume_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Run>, ApiError> {
    tracing::info!("Resuming run: {}", id);
    
    let run = state.run_service.resume(&id).await?;
    
    Ok(Json(run))
}

/// Cancel a run

pub async fn cancel_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Run>, ApiError> {
    tracing::info!("Cancelling run: {}", id);
    
    let run = state.run_service.cancel(&id, None).await?;
    
    Ok(Json(run))
}

/// Attach a client to a run
#[derive(Debug, serde::Deserialize)]
pub struct AttachRequest {
    pub client_type: ClientType,
    pub user_id: Option<String>,
}

pub async fn attach_to_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Json(request): Json<AttachRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Use shared session manager from state
    let (client_id, _rx) = state.session_manager.attach(&id, request.client_type, request.user_id).await?;
    
    Ok(Json(serde_json::json!({
        "client_id": client_id,
        "run_id": id,
        "attached": true,
    })))
}

/// Detach a client from a run
#[derive(Debug, serde::Deserialize)]
pub struct DetachRequest {
    pub client_id: String,
}

pub async fn detach_from_run(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Json(request): Json<DetachRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Use shared session manager from state
    state.session_manager.detach(&id, &request.client_id).await?;
    
    Ok(Json(serde_json::json!({
        "client_id": request.client_id,
        "run_id": id,
        "detached": true,
    })))
}

/// Get attachments for a run
pub async fn get_run_attachments(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Attachment>>, ApiError> {
    // Use shared session manager from state
    let attachments = state.session_manager.get_attachments(&id).await?;
    
    Ok(Json(attachments))
}

/// Get events for a run

pub async fn get_run_events(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Query(query): Query<EventQuery>,
) -> Result<Json<Vec<Event>>, ApiError> {
    let filter = EventFilter {
        event_types: None,
        since: None,
        until: None,
        limit: query.limit,
        cursor: query.cursor,
    };
    
    // Use shared event store from state
    let events = state.event_store.get_for_run(&id, filter).await?;
    
    Ok(Json(events))
}

/// Create a checkpoint for a run
#[derive(Debug, serde::Deserialize)]
pub struct CreateCheckpointBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub workspace_state: Option<serde_json::Value>,
    pub approval_state: Option<serde_json::Value>,
    pub context: Option<serde_json::Value>,
}

pub async fn create_checkpoint(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Json(request): Json<CreateCheckpointBody>,
) -> Result<Json<Checkpoint>, ApiError> {
    tracing::info!("Creating checkpoint for run: {}", id);
    
    // Get current run to capture step_cursor
    let run = state.run_service.get(&id).await?;
    
    let step_cursor = run.step_cursor.unwrap_or_else(|| "0".to_string());
    
    let checkpoint_request = CreateCheckpointRequest {
        name: request.name,
        description: request.description,
        step_cursor,
        workspace_state: request.workspace_state,
        approval_state: request.approval_state,
        context: request.context,
    };
    
    let checkpoint = state.run_service.create_checkpoint(&id, checkpoint_request).await?;
    
    tracing::info!("Checkpoint created: {} for run: {}", checkpoint.id, id);
    Ok(Json(checkpoint))
}

/// List checkpoints for a run
pub async fn list_checkpoints(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<CheckpointSummary>>, ApiError> {
    // Use shared run service from state
    let checkpoints = state.run_service.list_checkpoints(&id).await?;
    
    Ok(Json(checkpoints))
}

/// Get checkpoint by ID
pub async fn get_checkpoint(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Checkpoint>, ApiError> {
    // Use shared run service from state
    let checkpoint = state.run_service.get_checkpoint(&id).await?;
    
    Ok(Json(checkpoint))
}

/// Restore a run from a checkpoint
#[derive(Debug, serde::Deserialize)]
pub struct RestoreCheckpointBody {
    pub checkpoint_id: String,
}

pub async fn restore_checkpoint(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Json(request): Json<RestoreCheckpointBody>,
) -> Result<Json<Run>, ApiError> {
    tracing::info!("Restoring run: {} from checkpoint: {}", id, request.checkpoint_id);
    
    // Use shared run service from state
    let run = state.run_service.restore_checkpoint(&id, &request.checkpoint_id).await?;
    
    tracing::info!("Run {} restored from checkpoint {}", id, request.checkpoint_id);
    Ok(Json(run))
}

/// Delete a checkpoint
pub async fn delete_checkpoint(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<(), ApiError> {
    tracing::info!("Deleting checkpoint: {}", id);
    
    // Use shared run service from state
    state.run_service.delete_checkpoint(&id).await?;
    
    tracing::info!("Checkpoint deleted: {}", id);
    Ok(())
}

/// Server-sent events endpoint for real-time run updates

pub async fn run_events_sse(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    Query(query): Query<EventQuery>,
) -> Result<axum::response::Sse<impl futures::Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>>, ApiError> {
    use axum::response::sse::{Event as SseEvent, Sse};
    use futures::stream::{self, StreamExt};
    use tokio_stream::wrappers::BroadcastStream;
    
    // Use shared event store from state
    
    // Get historical events if cursor provided
    let historical_events = if let Some(cursor) = query.cursor {
        state.event_store.get_from_sequence(&id, cursor + 1, None).await.unwrap_or_default()
    } else {
        // Get last 100 events by default
        let filter = EventFilter {
            event_types: None,
            since: None,
            until: None,
            limit: Some(100),
            cursor: None,
        };
        state.event_store.get_for_run(&id, filter).await.unwrap_or_default()
    };
    
    // Subscribe to new events
    let rx = state.event_store.subscribe(&id).await?;
    let broadcast_stream = BroadcastStream::new(rx);
    
    // Create SSE stream
    let stream = stream::iter(historical_events)
        .map(|event| {
            let data = serde_json::to_string(&event).unwrap_or_default();
            Ok::<_, std::convert::Infallible>(SseEvent::default().data(data))
        })
        .chain(broadcast_stream.map(|result| {
            match result {
                Ok(event) => {
                    let data = serde_json::to_string(&event).unwrap_or_default();
                    Ok(SseEvent::default().data(data))
                }
                Err(_) => Ok(SseEvent::default().comment("heartbeat")),
            }
        }));
    
    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}
