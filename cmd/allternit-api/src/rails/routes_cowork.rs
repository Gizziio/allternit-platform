//! Cowork run routes - REST API for run lifecycle and attachments

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

use allternit_cowork_runtime::{
    Attachment, AttachmentState, ClientType, CreateRunSpec, PermissionSet, Run, RunId, RunMode,
    RunState,
};

use crate::AppState;

/// Request to create a new run
#[derive(Debug, Deserialize)]
pub struct CreateRunRequest {
    pub tenant_id: String,
    pub workspace_id: String,
    pub initiator: String,
    pub mode: RunMode,
    pub entrypoint: String,
    pub policy_profile: Option<String>,
}

/// Run response DTO
#[derive(Debug, Serialize)]
pub struct RunResponse {
    pub id: String,
    pub tenant_id: String,
    pub workspace_id: String,
    pub initiator: String,
    pub mode: String,
    pub state: String,
    pub entrypoint: String,
    pub dag_id: String,
    pub current_job_id: Option<String>,
    pub current_checkpoint_id: Option<String>,
    pub policy_profile: String,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

impl From<Run> for RunResponse {
    fn from(run: Run) -> Self {
        Self {
            id: run.id.to_string(),
            tenant_id: run.tenant_id,
            workspace_id: run.workspace_id,
            initiator: run.initiator,
            mode: run.mode.to_string(),
            state: run.state.to_string(),
            entrypoint: run.entrypoint,
            dag_id: run.dag_id,
            current_job_id: run.current_job_id.map(|j| j.to_string()),
            current_checkpoint_id: run.current_checkpoint_id,
            policy_profile: run.policy_profile,
            created_at: run.created_at.to_rfc3339(),
            updated_at: run.updated_at.to_rfc3339(),
            completed_at: run.completed_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// Request to attach to a run
#[derive(Debug, Deserialize)]
pub struct AttachRequest {
    pub client_type: ClientType,
    pub session_id: String,
    pub permissions: Option<PermissionSetSpec>,
}

#[derive(Debug, Deserialize)]
pub struct PermissionSetSpec {
    pub read: Option<bool>,
    pub write: Option<bool>,
    pub approve: Option<bool>,
    pub admin: Option<bool>,
}

impl PermissionSetSpec {
    fn into_permissions(self) -> PermissionSet {
        PermissionSet {
            read: self.read.unwrap_or(true),
            write: self.write.unwrap_or(false),
            approve: self.approve.unwrap_or(false),
            admin: self.admin.unwrap_or(false),
        }
    }
}

/// Attachment response DTO
#[derive(Debug, Serialize)]
pub struct AttachmentResponse {
    pub id: String,
    pub run_id: String,
    pub client_type: String,
    pub client_session_id: String,
    pub state: String,
    pub permissions: PermissionSetResponse,
    pub last_seen_at: String,
    pub replay_cursor: String,
    pub reconnect_token: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct PermissionSetResponse {
    pub read: bool,
    pub write: bool,
    pub approve: bool,
    pub admin: bool,
}

impl From<Attachment> for AttachmentResponse {
    fn from(att: Attachment) -> Self {
        Self {
            id: att.id.to_string(),
            run_id: att.run_id.to_string(),
            client_type: att.client_type.to_string(),
            client_session_id: att.client_session_id,
            state: att.state.to_string(),
            permissions: PermissionSetResponse {
                read: att.permissions.read,
                write: att.permissions.write,
                approve: att.permissions.approve,
                admin: att.permissions.admin,
            },
            last_seen_at: att.last_seen_at.to_rfc3339(),
            replay_cursor: att.replay_cursor,
            reconnect_token: att.reconnect_token,
            created_at: att.created_at.to_rfc3339(),
        }
    }
}

/// Request to reattach using a token
#[derive(Debug, Deserialize)]
pub struct ReattachRequest {
    pub token: String,
    pub cursor: Option<String>,
}

/// Request to create a checkpoint
#[derive(Debug, Deserialize)]
pub struct CreateCheckpointRequest {
    pub step_index: i32,
    pub cursor_state: serde_json::Value,
}

/// Checkpoint response DTO
#[derive(Debug, Serialize)]
pub struct CheckpointResponse {
    pub id: String,
    pub run_id: String,
    pub job_id: Option<String>,
    pub step_index: i32,
    pub pack_id: String,
    pub cursor_state: serde_json::Value,
    pub pending_approvals: Vec<String>,
    pub artifact_refs: Vec<String>,
    pub created_at: String,
}

impl From<allternit_cowork_runtime::Checkpoint> for CheckpointResponse {
    fn from(cp: allternit_cowork_runtime::Checkpoint) -> Self {
        Self {
            id: cp.id,
            run_id: cp.run_id.to_string(),
            job_id: cp.job_id.map(|j| j.to_string()),
            step_index: cp.step_index,
            pack_id: cp.pack_id,
            cursor_state: cp.cursor_state,
            pending_approvals: cp.pending_approvals,
            artifact_refs: cp.artifact_refs,
            created_at: cp.created_at.to_rfc3339(),
        }
    }
}

/// Query parameters for listing runs
#[derive(Debug, Deserialize)]
pub struct ListRunsQuery {
    pub state: Option<RunState>,
}

/// API Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: u16,
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> axum::response::Response {
        let status = StatusCode::from_u16(self.code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self)).into_response()
    }
}

impl From<allternit_cowork_runtime::CoworkError> for ErrorResponse {
    fn from(err: allternit_cowork_runtime::CoworkError) -> Self {
        Self {
            error: err.to_string(),
            code: err.http_status_code(),
        }
    }
}

/// Create a new run
async fn create_run(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateRunRequest>,
) -> impl IntoResponse {
    info!(entrypoint = %req.entrypoint, mode = %req.mode, "Creating run");

    let spec = CreateRunSpec {
        tenant_id: req.tenant_id,
        workspace_id: req.workspace_id,
        initiator: req.initiator,
        mode: req.mode,
        entrypoint: req.entrypoint,
        policy_profile: req.policy_profile,
    };

    // For now, return an error since we need to implement RunManager
    // This will be replaced with actual run creation
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ErrorResponse {
            error: "RunManager not yet initialized".to_string(),
            code: 501,
        }),
    )
}

/// List runs
async fn list_runs(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<ListRunsQuery>,
) -> impl IntoResponse {
    info!(state = ?query.state, "Listing runs");

    // Placeholder - will integrate with RunManager
    let runs: Vec<RunResponse> = vec![];

    (StatusCode::OK, Json(runs))
}

/// Get a run by ID
async fn get_run(
    State(_state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    info!(run_id = %run_id, "Getting run");

    // Placeholder - will integrate with RunManager
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ErrorResponse {
            error: format!("Run {} not found", run_id),
            code: 404,
        }),
    )
}

/// Cancel a run
async fn cancel_run(
    State(_state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    info!(run_id = %run_id, "Cancelling run");

    // Placeholder - will integrate with RunManager
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ErrorResponse {
            error: "Cancel not yet implemented".to_string(),
            code: 501,
        }),
    )
}

/// Attach to a run
async fn attach(
    State(_state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
    Json(req): Json<AttachRequest>,
) -> impl IntoResponse {
    info!(run_id = %run_id, client_type = %req.client_type, "Attaching to run");

    let permissions = req
        .permissions
        .map(|p| p.into_permissions())
        .unwrap_or_else(PermissionSet::read_only);

    // Placeholder - will integrate with RunManager
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ErrorResponse {
            error: "Attach not yet implemented".to_string(),
            code: 501,
        }),
    )
}

/// Reattach to a run using a token
async fn reattach(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ReattachRequest>,
) -> impl IntoResponse {
    info!("Reattaching to run");

    // Placeholder - will integrate with RunManager
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ErrorResponse {
            error: "Reattach not yet implemented".to_string(),
            code: 501,
        }),
    )
}

/// Detach from a run
async fn detach(
    State(_state): State<Arc<AppState>>,
    Path(attachment_id): Path<String>,
) -> impl IntoResponse {
    info!(attachment_id = %attachment_id, "Detaching from run");

    // Placeholder - will integrate with RunManager
    StatusCode::NOT_IMPLEMENTED
}

/// List attachments for a run
async fn list_attachments(
    State(_state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    info!(run_id = %run_id, "Listing attachments");

    // Placeholder - will integrate with RunManager
    let attachments: Vec<AttachmentResponse> = vec![];
    (StatusCode::OK, Json(attachments))
}

/// Create a checkpoint
async fn create_checkpoint(
    State(_state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
    Json(req): Json<CreateCheckpointRequest>,
) -> impl IntoResponse {
    info!(run_id = %run_id, step_index = req.step_index, "Creating checkpoint");

    // Placeholder - will integrate with RunManager
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ErrorResponse {
            error: "Checkpoint not yet implemented".to_string(),
            code: 501,
        }),
    )
}

/// List checkpoints for a run
async fn list_checkpoints(
    State(_state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    info!(run_id = %run_id, "Listing checkpoints");

    // Placeholder - will integrate with RunManager
    let checkpoints: Vec<CheckpointResponse> = vec![];
    (StatusCode::OK, Json(checkpoints))
}

/// Recover a run from its latest checkpoint
async fn recover_run(
    State(_state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    info!(run_id = %run_id, "Recovering run from checkpoint");

    // Placeholder - will integrate with RunManager
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ErrorResponse {
            error: "Recovery not yet implemented".to_string(),
            code: 501,
        }),
    )
}

/// Create the cowork routes router
pub fn cowork_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Run management
        .route("/runs", post(create_run))
        .route("/runs", get(list_runs))
        .route("/runs/:run_id", get(get_run))
        .route("/runs/:run_id/cancel", post(cancel_run))
        // Attachments
        .route("/runs/:run_id/attach", post(attach))
        .route("/reattach", post(reattach))
        .route("/attachments/:attachment_id/detach", post(detach))
        .route("/runs/:run_id/attachments", get(list_attachments))
        // Checkpoints
        .route("/runs/:run_id/checkpoints", post(create_checkpoint))
        .route("/runs/:run_id/checkpoints", get(list_checkpoints))
        .route("/runs/:run_id/recover", post(recover_run))
}
