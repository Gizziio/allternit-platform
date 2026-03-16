//! Approval System API Routes
//!
//! Human-in-the-loop endpoints for approving autonomous run actions.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    auth::middleware::AuthContext,
    db::cowork_models::*,
    error::ApiError,
    services::EventStore,
    ApiState,
};

// ============================================================================
// Request/Response Types
// ============================================================================

/// Query parameters for listing approvals
#[derive(Debug, Deserialize, Default)]
pub struct ListApprovalsQuery {
    pub run_id: Option<String>,
    pub status: Option<ApprovalStatus>,
    pub limit: Option<i64>,
}

// ============================================================================
// Route Configuration
// ============================================================================

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/approvals", get(list_approvals).post(create_approval))
        .route("/api/v1/approvals/:id", get(get_approval))
        .route("/api/v1/approvals/:id/approve", post(approve_request))
        .route("/api/v1/approvals/:id/deny", post(deny_request))
        .route("/api/v1/approvals/:id/cancel", post(cancel_request))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// List approval requests with optional filtering
pub async fn list_approvals(
    State(state): State<Arc<ApiState>>,
    Query(query): Query<ListApprovalsQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let limit = query.limit.unwrap_or(50).min(100);
    
    let approvals = if let Some(run_id) = query.run_id {
        if let Some(status) = query.status {
            sqlx::query_as::<_, ApprovalRequestSummary>(
                r#"
                SELECT id, run_id, status, priority, title, action_type, created_at, responded_at
                FROM approval_requests
                WHERE run_id = ? AND status = ?
                ORDER BY 
                    CASE priority
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'normal' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    created_at DESC
                LIMIT ?
                "#
            )
            .bind(&run_id)
            .bind(status)
            .bind(limit)
            .fetch_all(&state.db)
            .await
            .map_err(ApiError::DatabaseError)?
        } else {
            sqlx::query_as::<_, ApprovalRequestSummary>(
                r#"
                SELECT id, run_id, status, priority, title, action_type, created_at, responded_at
                FROM approval_requests
                WHERE run_id = ?
                ORDER BY 
                    CASE priority
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'normal' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    created_at DESC
                LIMIT ?
                "#
            )
            .bind(&run_id)
            .bind(limit)
            .fetch_all(&state.db)
            .await
            .map_err(ApiError::DatabaseError)?
        }
    } else if let Some(status) = query.status {
        sqlx::query_as::<_, ApprovalRequestSummary>(
            r#"
            SELECT id, run_id, status, priority, title, action_type, created_at, responded_at
            FROM approval_requests
            WHERE status = ?
            ORDER BY 
                CASE priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    WHEN 'low' THEN 4
                END,
                created_at DESC
            LIMIT ?
            "#
        )
        .bind(status)
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(ApiError::DatabaseError)?
    } else {
        sqlx::query_as::<_, ApprovalRequestSummary>(
            r#"
            SELECT id, run_id, status, priority, title, action_type, created_at, responded_at
            FROM approval_requests
            ORDER BY 
                CASE priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    WHEN 'low' THEN 4
                END,
                created_at DESC
            LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(ApiError::DatabaseError)?
    };
    
    Ok((StatusCode::OK, Json(approvals)))
}

/// Get a single approval request by ID
pub async fn get_approval(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?
    .ok_or_else(|| ApiError::NotFound(format!("Approval request '{}' not found", id)))?;
    
    Ok((StatusCode::OK, Json(approval)))
}

/// Create a new approval request
pub async fn create_approval(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateApprovalRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let priority = request.priority.unwrap_or_default();
    let requested_by = auth_context.user.user_id;
    
    // Verify the run exists
    let run_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM runs WHERE id = ?)"
    )
    .bind(&request.run_id)
    .fetch_one(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    if !run_exists {
        return Err(ApiError::NotFound(format!("Run '{}' not found", request.run_id)));
    }
    
    // Insert the approval request
    sqlx::query(
        r#"
        INSERT INTO approval_requests (
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, timeout_seconds, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&request.run_id)
    .bind(&request.step_cursor)
    .bind(ApprovalStatus::Pending)
    .bind(priority)
    .bind(&request.title)
    .bind(&request.description)
    .bind(&request.action_type)
    .bind(request.action_params.as_ref().map(|p| sqlx::types::Json(p.clone())))
    .bind(&request.reasoning)
    .bind(Some(requested_by))
    .bind(request.timeout_seconds)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    // Return the created approval
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    // Emit approval needed event using shared event store
    let _ = state.event_store.append(
        &request.run_id,
        EventType::ApprovalNeeded,
        serde_json::json!({
            "approval_id": id,
            "title": request.title,
            "priority": priority,
            "action_type": request.action_type,
        })
    ).await;
    
    // Notify connected clients via session manager
    let _ = state.session_manager.notify_approval_needed(
        &request.run_id,
        &id,
        &request.action_type.as_deref().unwrap_or("action"),
        &request.action_params.as_ref().unwrap_or(&serde_json::json!({})),
        request.reasoning.as_deref(),
        priority,
        request.timeout_seconds.map(|t| t as u32),
    ).await;
    
    Ok((StatusCode::CREATED, Json(approval)))
}

/// Approve an approval request
pub async fn approve_request(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(response): Json<ApprovalResponse>,
) -> Result<impl IntoResponse, ApiError> {
    let user_id = &auth_context.user.user_id;
    let now = Utc::now();
    
    // Get the approval request
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?
    .ok_or_else(|| ApiError::NotFound(format!("Approval request '{}' not found", id)))?;
    
    // Verify it's still pending
    if approval.status != ApprovalStatus::Pending {
        return Err(ApiError::BadRequest(format!(
            "Approval request is already {:?}",
            approval.status
        )));
    }
    
    // Update the approval
    sqlx::query(
        r#"
        UPDATE approval_requests
        SET status = ?, responded_by = ?, response_message = ?, responded_at = ?
        WHERE id = ?
        "#
    )
    .bind(ApprovalStatus::Approved)
    .bind(Some(user_id.as_str()))
    .bind(&response.message)
    .bind(now)
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    // Return the updated approval
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    // Emit approval given event
    let _ = state.event_store.append(
        &approval.run_id,
        EventType::ApprovalGiven,
        serde_json::json!({
            "approval_id": id,
            "message": response.message,
            "modified_params": response.modified_params,
        })
    ).await;
    
    // Notify connected clients
    let _ = state.session_manager.notify_approval_resolved(
        &approval.run_id, 
        &id, 
        true,  // approved
        user_id,
        response.message.as_deref()
    ).await;
    
    Ok((StatusCode::OK, Json(approval)))
}

/// Deny an approval request
pub async fn deny_request(
    State(state): State<Arc<ApiState>>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(response): Json<ApprovalResponse>,
) -> Result<impl IntoResponse, ApiError> {
    let user_id = &auth_context.user.user_id;
    let now = Utc::now();
    
    // Get the approval request
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?
    .ok_or_else(|| ApiError::NotFound(format!("Approval request '{}' not found", id)))?;
    
    // Verify it's still pending
    if approval.status != ApprovalStatus::Pending {
        return Err(ApiError::BadRequest(format!(
            "Approval request is already {:?}",
            approval.status
        )));
    }
    
    // Update the approval
    sqlx::query(
        r#"
        UPDATE approval_requests
        SET status = ?, responded_by = ?, response_message = ?, responded_at = ?
        WHERE id = ?
        "#
    )
    .bind(ApprovalStatus::Denied)
    .bind(user_id.as_str())
    .bind(&response.message)
    .bind(now)
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    // Return the updated approval
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    // Emit approval denied event
    let _ = state.event_store.append(
        &approval.run_id,
        EventType::ApprovalDenied,
        serde_json::json!({
            "approval_id": id,
            "message": response.message,
        })
    ).await;
    
    // Notify connected clients
    let _ = state.session_manager.notify_approval_resolved(
        &approval.run_id, 
        &id, 
        false,  // denied
        user_id,
        response.message.as_deref()
    ).await;
    
    Ok((StatusCode::OK, Json(approval)))
}

/// Cancel an approval request (by the run)
pub async fn cancel_request(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let now = Utc::now();
    
    // Get the approval request
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?
    .ok_or_else(|| ApiError::NotFound(format!("Approval request '{}' not found", id)))?;
    
    // Verify it's still pending
    if approval.status != ApprovalStatus::Pending {
        return Err(ApiError::BadRequest(format!(
            "Approval request is already {:?}",
            approval.status
        )));
    }
    
    // Update the approval
    sqlx::query(
        r#"
        UPDATE approval_requests
        SET status = ?, responded_at = ?
        WHERE id = ?
        "#
    )
    .bind(ApprovalStatus::Cancelled)
    .bind(now)
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    // Return the updated approval
    let approval = sqlx::query_as::<_, ApprovalRequest>(
        r#"
        SELECT 
            id, run_id, step_cursor, status, priority,
            title, description, action_type, action_params,
            reasoning, requested_by, responded_by, response_message,
            timeout_seconds, created_at, responded_at
        FROM approval_requests
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    
    Ok((StatusCode::OK, Json(approval)))
}
