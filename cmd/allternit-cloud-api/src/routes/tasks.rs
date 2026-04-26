//! Task routes for Cowork Runtime
//!
//! Provides REST API endpoints for task lifecycle management.

use axum::{
    extract::{Extension, Path, Query, State},
    routing::{get, post},
    Json,
    Router,
};
use std::sync::Arc;
use serde::Deserialize;

use crate::{
    ApiError, ApiState,
    auth::middleware::AuthContext,
    db::cowork_models::*,
    services::task_service,
};

/// Query parameters for listing tasks
#[derive(Debug, Deserialize, Default)]
pub struct ListTasksQuery {
    pub workspace_id: String,
    pub status: Option<String>,
    pub assignee_id: Option<String>,
    pub priority_min: Option<i32>,
    pub priority_max: Option<i32>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Query parameters for optimizing tasks
#[derive(Debug, Deserialize)]
pub struct OptimizeTasksQuery {
    pub workspace_id: String,
}

/// Query parameters for listing queue items
#[derive(Debug, Deserialize)]
pub struct ListQueueQuery {
    pub workspace_id: Option<String>,
    pub status: Option<String>,
}

/// Request body for claiming a queue item
#[derive(Debug, Deserialize)]
pub struct ClaimQueueRequest {
    pub agent_id: String,
    pub agent_role: Option<String>,
    pub workspace_id: Option<String>,
}

/// Request body for completing a queue item
#[derive(Debug, Deserialize)]
pub struct CompleteQueueRequest {
    pub result: Option<String>,
    pub error: Option<String>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// Create a new task
pub async fn create_task(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateTaskRequest>,
) -> Result<Json<Task>, ApiError> {
    tracing::info!("Creating task: {}", request.title);

    let tenant_id = Some(auth_context.user.user_id.clone());
    let owner_id = Some(auth_context.user.user_id.clone());

    let task = task_service::create_task(&state.db, request, tenant_id, owner_id).await?;

    tracing::info!("Task created: {}", task.id);
    Ok(Json(task))
}

/// List tasks for a workspace
pub async fn list_tasks(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Query(query): Query<ListTasksQuery>,
) -> Result<Json<Vec<Task>>, ApiError> {
    let tenant_id = Some(auth_context.user.user_id.clone());

    let status = query.status.map(|s| {
        s.split(',')
            .filter_map(|part| {
                let trimmed = part.trim();
                serde_json::from_str(&format!("\"{}\"", trimmed)).ok()
            })
            .collect()
    });

    let filter = TaskListFilter {
        tenant_id: tenant_id.clone(),
        workspace_id: Some(query.workspace_id.clone()),
        status,
        assignee_id: query.assignee_id,
        priority_min: query.priority_min,
        priority_max: query.priority_max,
        limit: query.limit,
        offset: query.offset,
    };

    let tasks = task_service::list_tasks(&state.db, &filter).await?;

    Ok(Json(tasks))
}

/// Get task by ID
pub async fn get_task(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<Json<Task>, ApiError> {
    let tenant_id = Some(auth_context.user.user_id.clone());

    let task = task_service::get_task(&state.db, &id, tenant_id.as_deref()).await?;

    Ok(Json(task))
}

/// Update task
pub async fn update_task(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(request): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, ApiError> {
    let tenant_id = Some(auth_context.user.user_id.clone());

    let task = task_service::update_task(&state.db, &id, request, tenant_id.as_deref()).await?;

    Ok(Json(task))
}

/// Delete a task
pub async fn delete_task(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<(), ApiError> {
    let tenant_id = Some(auth_context.user.user_id.clone());

    task_service::delete_task(&state.db, &id, tenant_id.as_deref()).await?;

    Ok(())
}

/// Assign a task
pub async fn assign_task(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(request): Json<AssignTaskRequest>,
) -> Result<Json<Task>, ApiError> {
    tracing::info!("Assigning task {} to {:?} {}", id, request.assignee_type, request.assignee_id);

    let tenant_id = Some(auth_context.user.user_id.clone());
    let assigned_by = Some(auth_context.user.user_id.as_str());

    let task = task_service::assign_task(&state.db, &id, request, tenant_id.as_deref(), assigned_by).await?;

    Ok(Json(task))
}

/// List comments for a task
pub async fn list_comments(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<Json<Vec<TaskComment>>, ApiError> {
    let tenant_id = Some(auth_context.user.user_id.clone());

    let comments = task_service::list_comments(&state.db, &id, tenant_id.as_deref()).await?;

    Ok(Json(comments))
}

/// Add a comment to a task
pub async fn add_comment(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(request): Json<CreateCommentRequest>,
) -> Result<Json<TaskComment>, ApiError> {
    let tenant_id = Some(auth_context.user.user_id.clone());

    let comment = task_service::add_comment(&state.db, &id, request, tenant_id.as_deref()).await?;

    Ok(Json(comment))
}

/// List queue items for a workspace
pub async fn list_queue_items(
    State(state): State<Arc<ApiState>>,
    Extension(_auth_context): Extension<AuthContext>,
    Query(query): Query<ListQueueQuery>,
) -> Result<Json<Vec<TaskQueueEntry>>, ApiError> {
    let items = task_service::list_queue_items(
        &state.db,
        query.workspace_id.as_deref(),
        query.status.as_deref(),
    )
    .await?;

    Ok(Json(items))
}

/// Optimize tasks for a workspace (IntelliSchedule)
pub async fn optimize_tasks(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Query(query): Query<OptimizeTasksQuery>,
) -> Result<Json<Vec<Task>>, ApiError> {
    tracing::info!("Optimizing tasks for workspace: {}", query.workspace_id);

    let tenant_id = Some(auth_context.user.user_id.clone());

    let tasks = task_service::optimize_tasks(
        &state.db,
        &query.workspace_id,
        tenant_id.as_deref(),
    )
    .await?;

    tracing::info!("Optimized {} tasks for workspace: {}", tasks.len(), query.workspace_id);
    Ok(Json(tasks))
}

/// Claim the next pending queue item for an agent
pub async fn claim_queue_item(
    State(state): State<Arc<ApiState>>,
    Extension(_auth_context): Extension<AuthContext>,
    Json(request): Json<ClaimQueueRequest>,
) -> Result<Json<Option<TaskQueueEntry>>, ApiError> {
    tracing::info!("Agent {} claiming queue item", request.agent_id);

    let entry = task_service::claim_queue_item(
        &state.db,
        &request.agent_id,
        request.agent_role.as_deref(),
        request.workspace_id.as_deref(),
    )
    .await?;

    Ok(Json(entry))
}

/// Start a claimed queue item (transition to running)
pub async fn start_queue_item(
    State(state): State<Arc<ApiState>>,
    Extension(_auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<Json<TaskQueueEntry>, ApiError> {
    tracing::info!("Starting queue item: {}", id);

    let entry = task_service::start_queue_item(&state.db, &id).await?;

    Ok(Json(entry))
}

/// Complete a queue item with result or error
pub async fn complete_queue_item(
    State(state): State<Arc<ApiState>>,
    Extension(_auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(request): Json<CompleteQueueRequest>,
) -> Result<Json<TaskQueueEntry>, ApiError> {
    tracing::info!("Completing queue item: {}", id);

    let entry = task_service::complete_queue_item(
        &state.db,
        &id,
        request.result,
        request.error,
    )
    .await?;

    Ok(Json(entry))
}

/// Query parameters for SSE stream
#[derive(Debug, Deserialize)]
pub struct TaskEventsQuery {
    pub workspace_id: Option<String>,
}

/// Server-sent events endpoint for real-time task events
pub async fn task_events_sse(
    State(state): State<Arc<ApiState>>,
    Query(query): Query<TaskEventsQuery>,
) -> Result<axum::response::Sse<impl futures::Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>>, ApiError> {
    use axum::response::sse::{Event as SseEvent, Sse};
    use futures::stream::{self, StreamExt};
    use tokio::time::{sleep, Duration};

    // Get recent events filtered by workspace if provided
    let events = if let Some(ref ws_id) = query.workspace_id {
        sqlx::query_as::<_, TaskEvent>(
            r#"
            SELECT e.* FROM task_events e
            JOIN tasks t ON e.task_id = t.id
            WHERE t.workspace_id = ?
            ORDER BY e.created_at DESC
            LIMIT 100
            "#
        )
        .bind(ws_id)
        .fetch_all(&state.db)
        .await
        .map_err(ApiError::DatabaseError)?
    } else {
        sqlx::query_as::<_, TaskEvent>(
            "SELECT * FROM task_events ORDER BY created_at DESC LIMIT 100"
        )
        .fetch_all(&state.db)
        .await
        .map_err(ApiError::DatabaseError)?
    };

    let historical = stream::iter(events.into_iter().rev())
        .map(|event| {
            let data = serde_json::to_string(&event).unwrap_or_default();
            Ok::<_, std::convert::Infallible>(SseEvent::default().data(data))
        });

    let heartbeat = stream::unfold((), |_| async {
        sleep(Duration::from_secs(30)).await;
        Some((Ok(SseEvent::default().comment("heartbeat")), ()))
    });

    let stream = historical.chain(heartbeat);

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}

// ============================================================================
// Router
// ============================================================================

/// Create the task routes router
pub fn task_routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/tasks", post(create_task).get(list_tasks))
        .route("/api/v1/tasks/:id", get(get_task).put(update_task).delete(delete_task))
        .route("/api/v1/tasks/:id/assign", post(assign_task))
        .route("/api/v1/tasks/:id/comments", get(list_comments).post(add_comment))
        .route("/api/v1/tasks/optimize", post(optimize_tasks))
        .route("/api/v1/tasks/stream", get(task_events_sse))
        .route("/api/v1/queue", get(list_queue_items))
        .route("/api/v1/queue/claim", post(claim_queue_item))
        .route("/api/v1/queue/:id/start", post(start_queue_item))
        .route("/api/v1/queue/:id/complete", post(complete_queue_item))
}
