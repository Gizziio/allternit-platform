//! Cowork run routes - REST API for run lifecycle, DAG nodes, handoffs,
//! attachments, checkpoints, and event streaming.

use axum::{
    extract::{Extension, Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{sse::Event, IntoResponse, Sse},
    routing::{get, post},
    Json, Router,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};

use allternit_cowork_runtime::{
    Attachment, ClientType, CreateJobSpec, CreateRunSpec, Job, JobId, JobState, PermissionSet,
    RunId, RunManager, RunMode, RunState,
};

use crate::auth::{get_user, AuthUser};
use crate::AppState;

/// Request to create a new run. `tenant_id` and `initiator` are taken from the
/// authenticated user, never from the request body; client-supplied copies are
/// ignored so one user cannot create runs under another tenant's identity.
#[derive(Debug, Deserialize)]
pub struct CreateRunRequest {
    pub workspace_id: String,
    /// A:// delegating principal (§8.18), e.g. a://principal/al
    pub delegator: Option<String>,
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

impl From<allternit_cowork_runtime::Run> for RunResponse {
    fn from(run: allternit_cowork_runtime::Run) -> Self {
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

impl RunResponse {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            tenant_id: row.get(1)?,
            workspace_id: row.get(2)?,
            initiator: row.get(3)?,
            mode: row.get(4)?,
            state: row.get(5)?,
            entrypoint: row.get(6)?,
            dag_id: row.get(7)?,
            current_job_id: row.get(8)?,
            current_checkpoint_id: row.get(9)?,
            policy_profile: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
            completed_at: row.get(13)?,
        })
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

impl From<rusqlite::Error> for ErrorResponse {
    fn from(err: rusqlite::Error) -> Self {
        Self {
            error: err.to_string(),
            code: 500,
        }
    }
}

impl From<uuid::Error> for ErrorResponse {
    fn from(err: uuid::Error) -> Self {
        Self {
            error: err.to_string(),
            code: 400,
        }
    }
}

fn run_manager(state: &AppState) -> Result<Arc<RunManager>, ErrorResponse> {
    state
        .cowork_run_manager
        .clone()
        .ok_or_else(|| ErrorResponse {
            error: "Cowork runtime unavailable".to_string(),
            code: 503,
        })
}

fn parse_run_id(run_id: &str) -> Result<RunId, ErrorResponse> {
    Ok(RunId(uuid::Uuid::parse_str(run_id)?))
}

fn parse_job_id(job_id: &str) -> Result<JobId, ErrorResponse> {
    Ok(JobId(uuid::Uuid::parse_str(job_id)?))
}

fn parse_uuid(value: &str) -> Result<uuid::Uuid, ErrorResponse> {
    Ok(uuid::Uuid::parse_str(value)?)
}

fn db_error(e: rusqlite::Error) -> ErrorResponse {
    error!("Cowork run DB error: {e}");
    ErrorResponse {
        error: e.to_string(),
        code: 500,
    }
}

fn not_found() -> ErrorResponse {
    ErrorResponse {
        error: "run not found".to_string(),
        code: 404,
    }
}

/// Verify that the run belongs to the requesting user. Returns 404 (never
/// 403) so the endpoint cannot be used as an oracle for other users' run
/// IDs. Rows with NULL user_id (pre-ownership-migration) match no one.
fn ensure_run_owner(
    conn: &rusqlite::Connection,
    run_id: &str,
    user_id: &str,
) -> Result<(), ErrorResponse> {
    let owner = conn
        .query_row(
            "SELECT user_id FROM cowork_runs WHERE id = ?1",
            rusqlite::params![run_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => not_found(),
            other => db_error(other),
        })?;
    match owner {
        Some(owner) if owner == user_id => Ok(()),
        _ => Err(not_found()),
    }
}

fn persist_run(
    conn: &rusqlite::Connection,
    run: &allternit_cowork_runtime::Run,
    user_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO cowork_runs (id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id, current_job_id, current_checkpoint_id, policy_profile, created_at, updated_at, completed_at, user_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT(id) DO UPDATE SET
            state=excluded.state,
            current_job_id=excluded.current_job_id,
            current_checkpoint_id=excluded.current_checkpoint_id,
            updated_at=excluded.updated_at,
            completed_at=excluded.completed_at",
        rusqlite::params![
            run.id.to_string(),
            run.tenant_id,
            run.workspace_id,
            run.initiator,
            run.mode.to_string(),
            run.state.to_string(),
            run.entrypoint,
            run.dag_id,
            run.current_job_id.map(|j| j.to_string()),
            run.current_checkpoint_id,
            run.policy_profile,
            run.created_at.to_rfc3339(),
            run.updated_at.to_rfc3339(),
            run.completed_at.map(|dt| dt.to_rfc3339()),
            user_id,
        ],
    )?;
    Ok(())
}

fn persist_job(
    conn: &rusqlite::Connection,
    job: &Job,
    user_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO cowork_jobs (id, run_id, dag_node_id, job_type, priority, state, lease_owner, retry_count, max_retries, timeout_sec, payload, created_at, updated_at, started_at, completed_at, user_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
         ON CONFLICT(id) DO UPDATE SET
            state=excluded.state,
            lease_owner=excluded.lease_owner,
            retry_count=excluded.retry_count,
            updated_at=excluded.updated_at,
            started_at=excluded.started_at,
            completed_at=excluded.completed_at",
        rusqlite::params![
            job.id.to_string(),
            job.run_id.to_string(),
            job.dag_node_id,
            job.job_type,
            job.priority,
            job.state.to_string(),
            job.lease_owner,
            job.retry_count,
            job.max_retries,
            job.timeout_sec,
            job.payload.to_string(),
            job.created_at.to_rfc3339(),
            job.updated_at.to_rfc3339(),
            job.started_at.map(|dt| dt.to_rfc3339()),
            job.completed_at.map(|dt| dt.to_rfc3339()),
            user_id,
        ],
    )?;
    Ok(())
}

fn update_run_state_in_db(
    conn: &rusqlite::Connection,
    run_id: &str,
    state: RunState,
) -> Result<(), rusqlite::Error> {
    let completed_at = if state.is_terminal() {
        Some(chrono::Utc::now().to_rfc3339())
    } else {
        None
    };
    conn.execute(
        "UPDATE cowork_runs SET state = ?1, updated_at = CURRENT_TIMESTAMP, completed_at = COALESCE(?2, completed_at) WHERE id = ?3",
        rusqlite::params![state.to_string(), completed_at, run_id],
    )?;
    Ok(())
}

fn insert_run_event(
    conn: &rusqlite::Connection,
    run_id: &str,
    event_type: &str,
    payload: serde_json::Value,
    user_id: &str,
) -> Result<(), rusqlite::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO cowork_run_events (id, run_id, event_type, payload, user_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, run_id, event_type, payload.to_string(), user_id],
    )?;
    Ok(())
}

/// Create a new run
async fn create_run(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateRunRequest>,
) -> Result<Json<RunResponse>, ErrorResponse> {
    info!(entrypoint = %req.entrypoint, mode = %req.mode, "Creating run");

    let manager = run_manager(&state)?;
    let user_id = user.user_id.clone();
    let spec = CreateRunSpec {
        tenant_id: user.tenant_id.clone().unwrap_or_else(|| user_id.clone()),
        workspace_id: req.workspace_id,
        initiator: user_id.clone(),
        mode: req.mode,
        entrypoint: req.entrypoint,
        policy_profile: req.policy_profile,
    };

    let run = manager.create_run(spec).await?;

    let conn = state.db.connect().map_err(db_error)?;
    persist_run(&conn, &run, &user_id).map_err(db_error)?;
    if let Some(delegator) = &req.delegator {
        conn.execute(
            "UPDATE cowork_runs SET delegator = ?1 WHERE id = ?2",
            rusqlite::params![delegator, run.id.to_string()],
        )
        .map_err(db_error)?;
    }
    insert_run_event(
        &conn,
        &run.id.to_string(),
        "run_created",
        json!({ "dag_id": run.dag_id, "mode": run.mode.to_string() }),
        &user_id,
    )
    .map_err(db_error)?;

    Ok(Json(run.into()))
}

/// Start a run through the planned -> queued -> running lifecycle
async fn start_run(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    info!(run_id = %run_id, "Starting run");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;

    // §8.2 honesty: RUNNING means a worker holds a valid lease. start_run only
    // makes the run dispatchable (queued); fabric transport moves it to
    // running atomically with the first lease grant.
    manager
        .transition_run_state(run_id, RunState::Planned)
        .await?;
    manager
        .transition_run_state(run_id, RunState::Queued)
        .await?;

    update_run_state_in_db(&conn, &run_id.to_string(), RunState::Queued).map_err(db_error)?;
    insert_run_event(
        &conn,
        &run_id.to_string(),
        "run_queued",
        json!({}),
        &user.user_id,
    )
    .map_err(db_error)?;

    Ok(Json(json!({ "started": true, "state": "queued" })))
}

/// List runs
async fn list_runs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(_query): Query<ListRunsQuery>,
) -> Result<Json<Vec<RunResponse>>, ErrorResponse> {
    let conn = state.db.connect().map_err(db_error)?;
    let runs = fetch_runs_for_user(&conn, &user.user_id).map_err(db_error)?;
    Ok(Json(runs))
}

/// Exact list query used by list_runs: only the requesting user's rows are
/// visible (V142 ownership scoping).
fn fetch_runs_for_user(
    conn: &rusqlite::Connection,
    user_id: &str,
) -> Result<Vec<RunResponse>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id, current_job_id, current_checkpoint_id, policy_profile, created_at, updated_at, completed_at
         FROM cowork_runs WHERE user_id = ?1 ORDER BY created_at DESC"
    )?;

    let runs = stmt
        .query_map(rusqlite::params![user_id], |row| RunResponse::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(runs)
}

/// Get a run by ID
async fn get_run(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<RunResponse>, ErrorResponse> {
    info!(run_id = %run_id, "Getting run");
    let conn = state.db.connect().map_err(db_error)?;

    let run = fetch_run_for_user(&conn, &run_id, &user.user_id).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => not_found(),
        other => db_error(other),
    })?;

    Ok(Json(run))
}

/// Exact get query used by get_run: a run owned by another user (or with a
/// NULL user_id) returns QueryReturnedNoRows, which the caller maps to 404.
fn fetch_run_for_user(
    conn: &rusqlite::Connection,
    run_id: &str,
    user_id: &str,
) -> Result<RunResponse, rusqlite::Error> {
    conn.query_row(
        "SELECT id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id, current_job_id, current_checkpoint_id, policy_profile, created_at, updated_at, completed_at
         FROM cowork_runs WHERE id = ?1 AND user_id = ?2",
        rusqlite::params![run_id, user_id],
        |row| RunResponse::from_row(row),
    )
}

/// Generic run state transition
#[derive(Debug, Deserialize)]
pub struct TransitionRunRequest {
    pub state: RunState,
}

async fn transition_run(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
    Json(req): Json<TransitionRunRequest>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    info!(run_id = %run_id, state = %req.state, "Transitioning run state");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;

    manager.transition_run_state(run_id, req.state).await?;

    update_run_state_in_db(&conn, &run_id.to_string(), req.state).map_err(db_error)?;
    insert_run_event(
        &conn,
        &run_id.to_string(),
        "run_state_changed",
        json!({ "state": req.state.to_string() }),
        &user.user_id,
    )
    .map_err(db_error)?;

    Ok(Json(json!({ "ok": true })))
}

async fn cancel_run(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    info!(run_id = %run_id, "Cancelling run");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;

    manager.cancel(run_id).await?;

    update_run_state_in_db(&conn, &run_id.to_string(), RunState::Cancelled).map_err(db_error)?;
    insert_run_event(
        &conn,
        &run_id.to_string(),
        "run_cancelled",
        json!({}),
        &user.user_id,
    )
    .map_err(db_error)?;

    Ok(Json(json!({ "cancelled": true })))
}

fn conn_ws(state: &AppState, run_id: RunId) -> Result<String, ErrorResponse> {
    let conn = state.db.connect().map_err(db_error)?;
    conn.query_row(
        "SELECT workspace_id FROM cowork_runs WHERE id = ?1",
        rusqlite::params![run_id.to_string()],
        |row| row.get(0),
    )
    .map_err(db_error)
}

/// Create a job within a run
#[derive(Debug, Deserialize)]
pub struct CreateJobRequest {
    pub job_type: String,
    pub priority: i32,
    pub payload: serde_json::Value,
    pub max_retries: i32,
    pub timeout_sec: i32,
    /// Mandatory capability strings for A:// fabric-transport eligibility (§8.6–8.7)
    pub required_capabilities: Option<Vec<String>>,
    /// Append-only delegation causation chain (§8.15); validated (cycle/depth).
    pub causation_chain: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct JobResponse {
    pub id: String,
    pub run_id: String,
    pub dag_node_id: String,
    pub job_type: String,
    pub priority: i32,
    pub state: String,
    pub payload: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Job> for JobResponse {
    fn from(job: Job) -> Self {
        Self {
            id: job.id.to_string(),
            run_id: job.run_id.to_string(),
            dag_node_id: job.dag_node_id,
            job_type: job.job_type,
            priority: job.priority,
            state: job.state.to_string(),
            payload: job.payload,
            created_at: job.created_at.to_rfc3339(),
            updated_at: job.updated_at.to_rfc3339(),
        }
    }
}

async fn create_job(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
    Json(req): Json<CreateJobRequest>,
) -> Result<Json<JobResponse>, ErrorResponse> {
    info!(run_id = %run_id, job_type = %req.job_type, "Creating job");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;

    let spec = CreateJobSpec {
        run_id,
        job_type: req.job_type,
        priority: req.priority,
        payload: req.payload,
        max_retries: req.max_retries,
        timeout_sec: req.timeout_sec,
    };

    let job = manager.create_job(spec).await?;
    manager.set_current_job(run_id, Some(job.id)).await?;
    // New jobs enter the fabric-transport queue immediately; fabric transport only
    // claims persisted rows in state 'queued'.
    manager.transition_job_state(job.id, JobState::Queued).await.ok();

    // Validate the delegation causation chain (§8.15) before persisting: the
    // chain must be well-formed within the run's workspace.
    let chain = req.causation_chain.clone().unwrap_or_default();
    if !chain.is_empty() {
        let run_ws: String = conn_ws(&state, run_id)?;
        allternit_cowork_runtime::sqlite_store::validate_delegation_chain(
            &conn,
            &run_ws,
            &chain,
        )
        .map_err(|e| ErrorResponse {
            error: format!("{}: {}", e.wire(), e.message),
            code: e.http_status(),
        })?;
    }
    persist_job(&conn, &job, &user.user_id).map_err(db_error)?;
    conn.execute(
        "UPDATE cowork_jobs SET state = 'queued', required_capabilities = ?1,
            initiator = (SELECT initiator FROM cowork_runs WHERE id = ?2),
            delegator = (SELECT delegator FROM cowork_runs WHERE id = ?2),
            causation_chain = ?4
         WHERE id = ?3",
        rusqlite::params![
            serde_json::to_string(&req.required_capabilities.unwrap_or_default()).unwrap(),
            run_id.to_string(),
            job.id.to_string(),
            serde_json::to_string(&chain).unwrap(),
        ],
    )
    .map_err(db_error)?;
    conn.execute(
        "UPDATE cowork_runs SET current_job_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![job.id.to_string(), run_id.to_string()],
    )
    .map_err(db_error)?;
    insert_run_event(
        &conn,
        &run_id.to_string(),
        "job_created",
        json!({ "job_id": job.id.to_string(), "job_type": job.job_type }),
        &user.user_id,
    )
    .map_err(db_error)?;

    Ok(Json(job.into()))
}

async fn list_jobs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<Vec<JobResponse>>, ErrorResponse> {
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;
    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;
    let jobs = manager.list_jobs(run_id).await;
    Ok(Json(jobs.into_iter().map(JobResponse::from).collect()))
}

/// Transition a job to a new state
#[derive(Debug, Deserialize)]
pub struct TransitionJobRequest {
    pub state: JobState,
}

async fn transition_job(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((run_id, job_id)): Path<(String, String)>,
    Json(req): Json<TransitionJobRequest>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    info!(job_id = %job_id, state = %req.state, "Transitioning job state");
    let _run_id = parse_run_id(&run_id)?;
    let job_id = parse_job_id(&job_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id, &user.user_id)?;

    manager.transition_job_state(job_id, req.state).await?;

    let completed_at = if req.state.is_terminal() {
        Some(chrono::Utc::now().to_rfc3339())
    } else {
        None
    };
    let started_at = if req.state == JobState::Running {
        Some(chrono::Utc::now().to_rfc3339())
    } else {
        None
    };
    conn.execute(
        "UPDATE cowork_jobs SET state = ?1, updated_at = CURRENT_TIMESTAMP, started_at = COALESCE(?2, started_at), completed_at = COALESCE(?3, completed_at) WHERE id = ?4",
        rusqlite::params![req.state.to_string(), started_at, completed_at, job_id.to_string()],
    ).map_err(db_error)?;
    insert_run_event(
        &conn,
        &run_id,
        "job_state_changed",
        json!({ "job_id": job_id.to_string(), "state": req.state.to_string() }),
        &user.user_id,
    )
    .map_err(db_error)?;

    Ok(Json(json!({ "ok": true })))
}

/// Handoff a run to another agent/task
#[derive(Debug, Deserialize)]
pub struct CreateHandoffRequest {
    pub to_agent_id: String,
    pub task_id: Option<String>,
    pub note: Option<String>,
    /// Append-only delegation causation chain (§8.15); validated (cycle/depth).
    pub causation_chain: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct HandoffResponse {
    pub id: String,
    pub run_id: String,
    pub to_agent_id: String,
    pub task_id: Option<String>,
    pub note: Option<String>,
    pub status: String,
    pub created_at: String,
}

async fn create_handoff(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
    Json(req): Json<CreateHandoffRequest>,
) -> Result<Json<HandoffResponse>, ErrorResponse> {
    info!(run_id = %run_id, to_agent = %req.to_agent_id, "Creating handoff");
    let run_id_str = run_id.clone();
    let _run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id_str, &user.user_id)?;

    // Create a handoff job in the runtime so the DAG reflects the handoff.
    let job_spec = CreateJobSpec {
        run_id: _run_id,
        job_type: "handoff".to_string(),
        priority: 100,
        payload: json!({
            "to_agent_id": req.to_agent_id,
            "task_id": req.task_id,
            "note": req.note,
        }),
        max_retries: 0,
        timeout_sec: 300,
    };
    let job = manager.create_job(job_spec).await?;
    manager.set_current_job(_run_id, Some(job.id)).await?;

    let handoff_id = uuid::Uuid::new_v4().to_string();
    // Validate the delegation causation chain (§8.15) before persisting.
    let chain = req.causation_chain.clone().unwrap_or_default();
    if !chain.is_empty() {
        let run_ws = conn_ws(&state, _run_id)?;
        allternit_cowork_runtime::sqlite_store::validate_delegation_chain(
            &conn,
            &run_ws,
            &chain,
        )
        .map_err(|e| ErrorResponse {
            error: format!("{}: {}", e.wire(), e.message),
            code: e.http_status(),
        })?;
    }
    conn.execute(
        "INSERT INTO cowork_handoffs (id, run_id, to_agent_id, task_id, note, status, user_id, job_id, causation_chain)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            &handoff_id,
            &run_id_str,
            &req.to_agent_id,
            req.task_id,
            req.note,
            "pending",
            user.user_id,
            job.id.to_string(),
            serde_json::to_string(&chain).unwrap(),
        ],
    ).map_err(db_error)?;
    persist_job(&conn, &job, &user.user_id).map_err(db_error)?;
    conn.execute(
        "UPDATE cowork_runs SET current_job_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![job.id.to_string(), run_id_str],
    )
    .map_err(db_error)?;
    insert_run_event(
        &conn,
        &run_id_str,
        "handoff_created",
        json!({
            "handoff_id": handoff_id,
            "to_agent_id": req.to_agent_id,
            "task_id": req.task_id,
            "job_id": job.id.to_string(),
        }),
        &user.user_id,
    )
    .map_err(db_error)?;

    Ok(Json(HandoffResponse {
        id: handoff_id,
        run_id: run_id_str,
        to_agent_id: req.to_agent_id,
        task_id: req.task_id,
        note: req.note,
        status: "pending".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    }))
}

async fn list_handoffs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<Vec<HandoffResponse>>, ErrorResponse> {
    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id, &user.user_id)?;
    let mut stmt = conn.prepare(
        "SELECT id, run_id, to_agent_id, task_id, note, status, created_at FROM cowork_handoffs WHERE run_id = ?1 ORDER BY created_at DESC"
    ).map_err(db_error)?;

    let rows = stmt
        .query_map([&run_id], |row| {
            Ok(HandoffResponse {
                id: row.get(0)?,
                run_id: row.get(1)?,
                to_agent_id: row.get(2)?,
                task_id: row.get(3)?,
                note: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?;

    Ok(Json(rows))
}

/// Acknowledge a handoff: completes the handoff and its linked job (A-T1).
#[derive(Debug, Deserialize)]
pub struct AckHandoffRequest {
    pub note: Option<String>,
}

async fn ack_handoff(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((run_id, handoff_id)): Path<(String, String)>,
    Json(req): Json<AckHandoffRequest>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    // Only the run's owner may ack its handoffs (same 404-not-403 oracle
    // rule as every other run-scoped mutation).
    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id, &user.user_id)?;
    let mut conn = conn;
    let outcome = allternit_cowork_runtime::sqlite_store::ack_handoff(
        &mut conn,
        &handoff_id,
        &user.user_id,
        req.note,
    )
    .map_err(|e| ErrorResponse {
        error: format!("{}: {}", e.wire(), e.message),
        code: e.http_status(),
    })?;
    Ok(Json(outcome))
}

/// Attach to a run
async fn attach(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
    Json(req): Json<AttachRequest>,
) -> Result<Json<AttachmentResponse>, ErrorResponse> {
    info!(run_id = %run_id, client_type = %req.client_type, "Attaching to run");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;

    let permissions = req
        .permissions
        .map(|p| p.into_permissions())
        .unwrap_or_else(PermissionSet::read_only);

    let attachment = manager
        .attach(run_id, req.client_type, req.session_id, permissions)
        .await?;
    Ok(Json(attachment.into()))
}

/// Reattach to a run using a token. The reconnect token is only minted by
/// `attach` (which now verifies run ownership), so possession of the token is
/// the authorization; a valid Clerk session is still required.
async fn reattach(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<ReattachRequest>,
) -> Result<Json<AttachmentResponse>, ErrorResponse> {
    info!(user_id = %user.user_id, "Reattaching to run");
    let manager = run_manager(&state)?;
    let attachment = manager.reattach(&req.token, req.cursor).await?;
    Ok(Json(attachment.into()))
}

/// Detach from a run
async fn detach(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(attachment_id): Path<String>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    info!(attachment_id = %attachment_id, user_id = %user.user_id, "Detaching from run");
    let attachment_id = parse_uuid(&attachment_id)?;
    let manager = run_manager(&state)?;
    manager.detach(attachment_id).await?;
    Ok(Json(json!({ "detached": true })))
}

/// List attachments for a run
async fn list_attachments(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<Vec<AttachmentResponse>>, ErrorResponse> {
    info!(run_id = %run_id, "Listing attachments");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;
    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;
    let attachments = manager.list_attachments(run_id).await?;
    Ok(Json(
        attachments
            .into_iter()
            .map(AttachmentResponse::from)
            .collect(),
    ))
}

/// Create a checkpoint
async fn create_checkpoint(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
    Json(req): Json<CreateCheckpointRequest>,
) -> Result<Json<CheckpointResponse>, ErrorResponse> {
    info!(run_id = %run_id, step_index = req.step_index, "Creating checkpoint");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;

    let checkpoint = manager
        .checkpoint(run_id, None, req.step_index, req.cursor_state)
        .await?;

    conn.execute(
        "UPDATE cowork_runs SET current_checkpoint_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![checkpoint.id, run_id.to_string()],
    ).map_err(db_error)?;
    insert_run_event(
        &conn,
        &run_id.to_string(),
        "checkpoint_created",
        json!({ "checkpoint_id": checkpoint.id }),
        &user.user_id,
    )
    .map_err(db_error)?;

    Ok(Json(checkpoint.into()))
}

/// List checkpoints for a run
async fn list_checkpoints(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<Vec<CheckpointResponse>>, ErrorResponse> {
    info!(run_id = %run_id, "Listing checkpoints");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;
    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;
    let checkpoints = manager.list_checkpoints(run_id).await?;
    Ok(Json(
        checkpoints
            .into_iter()
            .map(CheckpointResponse::from)
            .collect(),
    ))
}

/// Recover a run from its latest checkpoint
async fn recover_run(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    info!(run_id = %run_id, "Recovering run from checkpoint");
    let run_id = parse_run_id(&run_id)?;
    let manager = run_manager(&state)?;

    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id.to_string(), &user.user_id)?;

    let result = manager.recover(run_id).await?;

    update_run_state_in_db(&conn, &run_id.to_string(), RunState::Recovering).map_err(db_error)?;

    match result {
        Some((checkpoint, cursor)) => {
            insert_run_event(
                &conn,
                &run_id.to_string(),
                "run_recovered",
                json!({ "checkpoint_id": checkpoint.id, "cursor": cursor }),
                &user.user_id,
            )
            .map_err(db_error)?;
            Ok(Json(
                json!({ "recovered": true, "checkpoint_id": checkpoint.id, "cursor": cursor }),
            ))
        }
        None => Ok(Json(
            json!({ "recovered": false, "reason": "no checkpoint" }),
        )),
    }
}

/// Create the cowork routes router
pub fn cowork_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Run management
        .route("/runs", post(create_run))
        .route("/runs", get(list_runs))
        .route("/runs/:run_id", get(get_run))
        .route("/runs/:run_id/start", post(start_run))
        .route("/runs/:run_id/cancel", post(cancel_run))
        .route("/runs/:run_id/state", post(transition_run))
        .route(
            "/runs/:run_id/events",
            get(get_run_events).post(post_run_event),
        )
        .route("/runs/:run_id/events/stream", get(stream_events))
        // Jobs / DAG nodes
        .route("/runs/:run_id/jobs", post(create_job))
        .route("/runs/:run_id/jobs", get(list_jobs))
        .route("/runs/:run_id/jobs/:job_id/state", post(transition_job))
        // Handoffs
        .route("/runs/:run_id/handoffs", post(create_handoff))
        .route("/runs/:run_id/handoffs", get(list_handoffs))
        .route("/runs/:run_id/handoffs/:handoff_id/ack", post(ack_handoff))
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

async fn stream_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, StatusCode> {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    // Only the owning user may stream a run's events.
    {
        let conn = state
            .db
            .connect()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let owner = conn
            .query_row(
                "SELECT user_id FROM cowork_runs WHERE id = ?1",
                rusqlite::params![run_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => StatusCode::NOT_FOUND,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            })?;
        match owner {
            Some(owner) if owner == user.user_id => {}
            _ => return Err(StatusCode::NOT_FOUND),
        }
    }

    let db = state.db.clone();
    let r_id = run_id.clone();

    let stream = async_stream::stream! {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        let mut last_event_id: Option<String> = None;

        loop {
            interval.tick().await;

            let events = {
                let conn = match db.connect() {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let query = if last_event_id.is_some() {
                    "SELECT id, event_type, payload FROM cowork_run_events
                     WHERE run_id = ?1 AND created_at > (SELECT created_at FROM cowork_run_events WHERE id = ?2)
                     ORDER BY created_at ASC"
                } else {
                    "SELECT id, event_type, payload FROM cowork_run_events WHERE run_id = ?1 ORDER BY created_at ASC"
                };

                let params: Vec<String> = if let Some(ref last_id) = last_event_id {
                    vec![r_id.clone(), last_id.clone()]
                } else {
                    vec![r_id.clone()]
                };

                let mut stmt = match conn.prepare(query) {
                    Ok(s) => s,
                    Err(_) => continue,
                };

                let events_res = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                });

                match events_res {
                    Ok(iter) => iter.filter_map(|r| r.ok()).collect::<Vec<(String, String, String)>>(),
                    Err(_) => Vec::new(),
                }
            };

            for item in events {
                let (id, event_type, payload_str) = item;
                last_event_id = Some(id);

                let payload: serde_json::Value = serde_json::from_str(&payload_str).unwrap_or_else(|_| json!({}));
                let sse_event = Event::default().data(json!({
                    "event_type": event_type,
                    "payload": payload,
                }).to_string());

                yield Ok(sse_event);
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::new()))
}

#[derive(Debug, Serialize)]
pub struct RunEventResponse {
    pub id: String,
    pub run_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub created_at: String,
}

async fn get_run_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
) -> Result<Json<Vec<RunEventResponse>>, ErrorResponse> {
    let conn = state.db.connect().map_err(db_error)?;
    ensure_run_owner(&conn, &run_id, &user.user_id)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, run_id, event_type, payload, created_at 
             FROM cowork_run_events 
             WHERE run_id = ?1 
             ORDER BY created_at ASC",
        )
        .map_err(db_error)?;

    let rows = stmt
        .query_map(rusqlite::params![&run_id], |row| {
            let payload_str: String = row.get(3)?;
            let payload: serde_json::Value =
                serde_json::from_str(&payload_str).unwrap_or_else(|_| serde_json::Value::Null);
            Ok(RunEventResponse {
                id: row.get(0)?,
                run_id: row.get(1)?,
                event_type: row.get(2)?,
                payload,
                created_at: row.get(4)?,
            })
        })
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct PostEventRequest {
    pub event_type: String,
    pub payload: serde_json::Value,
    /// Client-supplied idempotency key (A:// §5): retries with the same
    /// event_id return the canonical existing event instead of double-writing.
    pub event_id: Option<String>,
}

async fn post_run_event(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(run_id): Path<String>,
    Json(req): Json<PostEventRequest>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    let mut conn = state.db.connect().map_err(db_error)?;
    // Verify run ownership before appending: events must never be writable
    // by a user other than the run's owner.
    ensure_run_owner(&conn, &run_id, &user.user_id)?;
    let outcome = allternit_cowork_runtime::sqlite_store::insert_event_idempotent(
        &mut conn,
        &run_id,
        &req.event_type,
        req.payload,
        None,
        None,
        None,
        req.event_id.as_deref(),
    )
    .map_err(|e| ErrorResponse {
        error: format!("{}: {}", e.wire(), e.message),
        code: e.http_status(),
    })?;
    match outcome {
        allternit_cowork_runtime::sqlite_store::EventInsertOutcome::Inserted(id) => {
            // Preserve V142 ownership attribution on the written row.
            conn.execute(
                "UPDATE cowork_run_events SET user_id = ?1 WHERE id = ?2",
                rusqlite::params![user.user_id, id],
            )
            .map_err(db_error)?;
            Ok(Json(json!({ "id": id, "duplicated": false })))
        }
        allternit_cowork_runtime::sqlite_store::EventInsertOutcome::Duplicate(id) => {
            Ok(Json(json!({ "id": id, "duplicated": true })))
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    /// V5 cowork_runs DDL + the V142 ownership column.
    const RUNS_DDL: &str = "
        CREATE TABLE cowork_runs (
            id                    TEXT PRIMARY KEY,
            tenant_id             TEXT NOT NULL,
            workspace_id          TEXT NOT NULL,
            initiator             TEXT NOT NULL,
            mode                  TEXT NOT NULL,
            state                 TEXT NOT NULL,
            entrypoint            TEXT NOT NULL,
            dag_id                TEXT NOT NULL,
            current_job_id        TEXT,
            current_checkpoint_id TEXT,
            policy_profile        TEXT NOT NULL,
            created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at          DATETIME,
            user_id               TEXT
        );
    ";

    fn scratch_runs_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(RUNS_DDL).expect("ddl");
        conn
    }

    fn insert_run(conn: &rusqlite::Connection, id: &str, user_id: Option<&str>) {
        conn.execute(
            "INSERT INTO cowork_runs (id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id, policy_profile, user_id)
             VALUES (?1, 'tenant', 'ws', 'initiator', 'interactive', 'planned', 'entry', 'dag', 'default', ?2)",
            rusqlite::params![id, user_id],
        )
        .expect("insert");
    }

    #[test]
    fn list_runs_only_returns_own_rows() {
        let conn = scratch_runs_db();
        insert_run(&conn, "run-a1", Some("user-a"));
        insert_run(&conn, "run-a2", Some("user-a"));
        insert_run(&conn, "run-b1", Some("user-b"));
        // Pre-ownership-migration row: NULL user_id matches no one.
        insert_run(&conn, "run-legacy", None);

        let runs = fetch_runs_for_user(&conn, "user-a").expect("list");
        let mut ids: Vec<&str> = runs.iter().map(|r| r.id.as_str()).collect();
        ids.sort_unstable();
        assert_eq!(ids, vec!["run-a1", "run-a2"]);

        let b_runs = fetch_runs_for_user(&conn, "user-b").expect("list");
        assert_eq!(b_runs.len(), 1);
        assert_eq!(b_runs[0].id, "run-b1");
    }

    #[test]
    fn get_run_returns_no_row_for_other_user() {
        let conn = scratch_runs_db();
        insert_run(&conn, "run-a1", Some("user-a"));

        // Own run resolves.
        let run = fetch_run_for_user(&conn, "run-a1", "user-a").expect("own get");
        assert_eq!(run.id, "run-a1");

        // Other user's run: QueryReturnedNoRows -> handler maps to 404.
        let err = fetch_run_for_user(&conn, "run-a1", "user-b").unwrap_err();
        assert!(matches!(err, rusqlite::Error::QueryReturnedNoRows));

        // Unknown id: same 404 path.
        let err = fetch_run_for_user(&conn, "nope", "user-a").unwrap_err();
        assert!(matches!(err, rusqlite::Error::QueryReturnedNoRows));
    }

    #[test]
    fn ensure_run_owner_scopes_access() {
        let conn = scratch_runs_db();
        insert_run(&conn, "run-a1", Some("user-a"));
        insert_run(&conn, "run-legacy", None);

        // Owner passes.
        ensure_run_owner(&conn, "run-a1", "user-a").expect("owner ok");

        // Other user gets a 404-shaped error (never 403 — no ID oracle).
        let err = ensure_run_owner(&conn, "run-a1", "user-b").unwrap_err();
        assert_eq!(err.code, 404);

        // NULL-owner rows match no one.
        let err = ensure_run_owner(&conn, "run-legacy", "user-a").unwrap_err();
        assert_eq!(err.code, 404);

        // Unknown id also 404.
        let err = ensure_run_owner(&conn, "nope", "user-a").unwrap_err();
        assert_eq!(err.code, 404);
    }
}
