//! A:// fabric transport routes (contract v0.1 §8) — worker-facing fabric-transport API.
//!
//! v0.1 workers discover work by long-polling the claim endpoint (lock 4; no
//! push machinery). Every handler authenticates the worker as a Principal via
//! bearer token (§8.4) and delegates exclusivity to the store-level CAS in
//! `allternit_cowork_runtime::sqlite_store` (lock 2).

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use rusqlite::OptionalExtension;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tracing::info;

use allternit_cowork_runtime::{
    sqlite_store, CompleteOutcome, TransportError, JobState, LeaseGrant, RunId, RunManager,
    RunState,
};

use crate::AppState;

use super::routes_cowork::ErrorResponse;

/// Create the A:// fabric transport router (mounted under the v1 API).
pub fn fabric_transport_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/fabric/transport/principals", post(create_principal))
        .route("/fabric/transport/claim", post(claim))
        .route("/fabric/transport/jobs/:job_id", get(get_job))
        .route("/fabric/transport/jobs/:job_id/heartbeat", post(heartbeat))
        .route("/fabric/transport/jobs/:job_id/renew", post(renew))
        .route("/fabric/transport/jobs/:job_id/complete", post(complete))
        // Approval bindings (§8.14): scoped to (executor, capability, target,
        // run, job, lease_generation); invalidated when the lease expires.
        .route(
            "/fabric/transport/jobs/:job_id/approvals/request",
            post(request_approval),
        )
        .route(
            "/fabric/transport/jobs/:job_id/approvals/check",
            post(check_approval),
        )
        .route("/fabric/transport/approvals/:approval_id", get(get_approval))
        .route(
            "/fabric/transport/approvals/:approval_id/grant",
            post(decide_approval_grant),
        )
        .route(
            "/fabric/transport/approvals/:approval_id/deny",
            post(decide_approval_deny),
        )
}

fn db_error(e: rusqlite::Error) -> ErrorResponse {
    tracing::error!("A:// fabric-transport DB error: {e}");
    ErrorResponse {
        error: e.to_string(),
        code: 500,
    }
}

fn transport_err(e: TransportError) -> ErrorResponse {
    ErrorResponse {
        error: format!("{}: {}", e.wire(), e.message),
        code: e.http_status(),
    }
}

/// Authenticate `Authorization: Bearer <token>` to a Principal (§8.4).
fn authenticate(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<allternit_cowork_runtime::PrincipalRecord, ErrorResponse> {
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| ErrorResponse {
            error: "A_AUTHENTICATION_FAILED: missing Authorization: Bearer <token>".to_string(),
            code: 401,
        })?;
    let conn = state.db.connect().map_err(db_error)?;
    sqlite_store::authenticate_principal(&conn, token).map_err(transport_err)
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

fn default_lease_ttl() -> Duration {
    Duration::from_secs(
        std::env::var("ALLTERNIT_FABRIC_TRANSPORT_LEASE_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(60),
    )
}

/// Best-effort sync of the in-memory runtime mirror after a store-level
/// transition. The SQLite store is canonical (lock 1); the mirror keeps
/// attachments/checkpoints coherent.
async fn sync_job_state(state: &AppState, job_id: &str, to: JobState) {
    if let (Ok(manager), Ok(id)) = (
        run_manager(state),
        uuid::Uuid::parse_str(job_id).map(allternit_cowork_runtime::JobId),
    ) {
        let _ = manager.transition_job_state(id, to).await;
    }
}

async fn sync_run_state(state: &AppState, run_id: &str, to: RunState) {
    if let (Ok(manager), Ok(id)) = (run_manager(state), uuid::Uuid::parse_str(run_id).map(RunId)) {
        let _ = manager.transition_run_state(id, to).await;
    }
}

// ─── Principal registration ─────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct CreatePrincipalRequest {
    pub id: String,
    pub workspace: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct CreatePrincipalResponse {
    pub id: String,
    pub workspace: String,
    pub capabilities: Vec<String>,
    /// Bearer token, returned exactly once; only its SHA-256 hash is stored.
    pub token: String,
}

/// Register a worker principal. Requires the caller's normal user auth; the
/// bearer token is shown once and stored hashed.
async fn create_principal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreatePrincipalRequest>,
) -> Result<Json<CreatePrincipalResponse>, ErrorResponse> {
    if crate::auth::get_user(&headers).is_none() {
        return Err(ErrorResponse {
            error: "authentication required to register principals".to_string(),
            code: 401,
        });
    }
    let token = format!("atok_{}", uuid::Uuid::new_v4());
    let mut conn = state.db.connect().map_err(db_error)?;
    sqlite_store::register_principal(
        &mut conn,
        &req.id,
        &req.workspace,
        &req.capabilities,
        &token,
    )
    .map_err(transport_err)?;
    info!(principal = %req.id, workspace = %req.workspace, "Registered A:// principal");
    Ok(Json(CreatePrincipalResponse {
        id: req.id,
        workspace: req.workspace,
        capabilities: req.capabilities,
        token,
    }))
}

// ─── Claim (§8.10, lock 4 long-poll) ────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct ClaimRequest {
    pub job_id: Option<String>,
    /// Long-poll window in seconds (default 0 = single attempt).
    pub wait_secs: Option<u64>,
    pub lease_ttl_secs: Option<u64>,
}

async fn claim(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<ClaimRequest>,
) -> Result<Json<LeaseGrant>, ErrorResponse> {
    let principal = authenticate(&state, &headers)?;
    let ttl = req
        .lease_ttl_secs
        .map(Duration::from_secs)
        .unwrap_or_else(default_lease_ttl);
    let wait = Duration::from_secs(req.wait_secs.unwrap_or(0).min(60));
    let deadline = std::time::Instant::now() + wait;

    loop {
        let mut conn = state.db.connect().map_err(db_error)?;
        match sqlite_store::claim_job(&mut conn, &principal, req.job_id.as_deref(), ttl) {
            Ok(grant) => {
                drop(conn);
                sync_job_state(&state, &grant.job_id, JobState::Leased).await;
                sync_run_state(&state, &grant.run_id, RunState::Running).await;
                return Ok(Json(grant));
            }
            Err(e)
                if e.code
                    == allternit_cowork_runtime::TransportErrorCode::NoEligibleWorker
                    || e.code
                        == allternit_cowork_runtime::TransportErrorCode::JobAlreadyLeased =>
            {
                if std::time::Instant::now() >= deadline {
                    return Err(transport_err(e));
                }
                drop(conn);
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            Err(e) => return Err(transport_err(e)),
        }
    }
}

// ─── Heartbeat / renew (§8.11–8.12) ─────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct HeartbeatRequest {
    pub lease_id: String,
    pub lease_generation: i64,
    /// Advisory only; the server clock decides expiry (lock 3).
    pub worker_time: Option<String>,
}

async fn heartbeat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
    Json(req): Json<HeartbeatRequest>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    let principal = authenticate(&state, &headers)?;
    let mut conn = state.db.connect().map_err(db_error)?;
    sqlite_store::record_heartbeat(
        &mut conn,
        &principal,
        &job_id,
        &req.lease_id,
        req.lease_generation,
        req.worker_time,
    )
    .map_err(transport_err)?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Debug, serde::Deserialize)]
pub struct RenewRequest {
    pub lease_id: String,
    pub lease_generation: i64,
    pub lease_ttl_secs: Option<u64>,
}

async fn renew(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
    Json(req): Json<RenewRequest>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    let principal = authenticate(&state, &headers)?;
    let ttl = req
        .lease_ttl_secs
        .map(Duration::from_secs)
        .unwrap_or_else(default_lease_ttl);
    let mut conn = state.db.connect().map_err(db_error)?;
    let expires_at = sqlite_store::renew_lease(
        &mut conn,
        &principal,
        &job_id,
        &req.lease_id,
        req.lease_generation,
        ttl,
    )
    .map_err(transport_err)?;
    Ok(Json(json!({ "ok": true, "lease_expires_at": expires_at })))
}

// ─── Completion (§8.16) ─────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct CompleteRequest {
    pub lease_id: String,
    pub lease_generation: i64,
    pub success: bool,
    pub summary: Option<String>,
    pub outputs: Option<serde_json::Value>,
}

async fn complete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
    Json(req): Json<CompleteRequest>,
) -> Result<Json<CompleteOutcome>, ErrorResponse> {
    let principal = authenticate(&state, &headers)?;
    let mut conn = state.db.connect().map_err(db_error)?;
    let outcome = sqlite_store::complete_job(
        &mut conn,
        &principal,
        &job_id,
        &req.lease_id,
        req.lease_generation,
        req.success,
        req.summary,
        req.outputs,
    )
    .map_err(transport_err)?;
    drop(conn);

    match &outcome {
        CompleteOutcome::Committed { job_state, .. }
        | CompleteOutcome::AlreadyCommitted { job_state, .. } => {
            let job_state = job_state.clone();
            let view = {
                let conn = state.db.connect().map_err(db_error)?;
                sqlite_store::get_job_view(&conn, &job_id).map_err(transport_err)?
            };
            let run_id = view
                .as_ref()
                .and_then(|v| v["run_id"].as_str())
                .unwrap_or_default()
                .to_string();
            let run_terminal = {
                let conn = state.db.connect().map_err(db_error)?;
                conn.query_row(
                    "SELECT state FROM cowork_runs WHERE id = ?1",
                    rusqlite::params![run_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .map_err(db_error)?
            };
            sync_job_state(
                &state,
                &job_id,
                if job_state == "completed" {
                    JobState::Completed
                } else {
                    JobState::Failed
                },
            )
            .await;
            if let Some(run_state) = run_terminal {
                if run_state == "completed" {
                    sync_run_state(&state, &run_id, RunState::Completed).await;
                } else if run_state == "failed" {
                    sync_run_state(&state, &run_id, RunState::Failed).await;
                }
            }
        }
    }
    Ok(Json(outcome))
}

// ─── Canonical job view (read-only) ─────────────────────────────────────────

async fn get_job(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    let conn = state.db.connect().map_err(db_error)?;
    let view = sqlite_store::get_job_view(&conn, &job_id)
        .map_err(transport_err)?
        .ok_or_else(|| ErrorResponse {
            error: "A_JOB_NOT_FOUND: job not found".to_string(),
            code: 404,
        })?;
    Ok(Json(view))
}

// ─── Approval bindings (§8.14) ──────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct ApprovalScopeRequest {
    pub lease_id: String,
    pub lease_generation: i64,
    pub capability: String,
    pub target: String,
}

async fn request_approval(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
    Json(req): Json<ApprovalScopeRequest>,
) -> Result<Json<allternit_cowork_runtime::ApprovalBinding>, ErrorResponse> {
    let principal = authenticate(&state, &headers)?;
    let mut conn = state.db.connect().map_err(db_error)?;
    let binding = sqlite_store::request_approval(
        &mut conn,
        &principal,
        &job_id,
        &req.lease_id,
        req.lease_generation,
        &req.capability,
        &req.target,
    )
    .map_err(transport_err)?;
    Ok(Json(binding))
}

async fn check_approval(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
    Json(req): Json<ApprovalScopeRequest>,
) -> Result<Json<serde_json::Value>, ErrorResponse> {
    let principal = authenticate(&state, &headers)?;
    let mut conn = state.db.connect().map_err(db_error)?;
    let binding = sqlite_store::check_approval(
        &mut conn,
        &principal,
        &job_id,
        &req.lease_id,
        req.lease_generation,
        &req.capability,
        &req.target,
    )
    .map_err(transport_err)?;
    Ok(Json(json!({ "ok": true, "approval_id": binding.id, "status": binding.status })))
}

async fn get_approval(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(approval_id): Path<String>,
) -> Result<Json<allternit_cowork_runtime::ApprovalBinding>, ErrorResponse> {
    let principal = authenticate(&state, &headers)?;
    let conn = state.db.connect().map_err(db_error)?;
    let binding = sqlite_store::get_approval(&conn, &approval_id)
        .map_err(transport_err)?
        .ok_or_else(|| ErrorResponse {
            error: "A_JOB_NOT_FOUND: approval binding not found".to_string(),
            code: 404,
        })?;
    if binding.executor != principal.id {
        return Err(ErrorResponse {
            error: "A_PERMISSION_DENIED: approval belongs to another executor".to_string(),
            code: 403,
        });
    }
    Ok(Json(binding))
}

/// Human decision endpoints — require the normal user auth (Extension-style
/// via headers), not a worker bearer token.
async fn decide_approval_grant(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(approval_id): Path<String>,
) -> Result<Json<allternit_cowork_runtime::ApprovalBinding>, ErrorResponse> {
    decide_approval(state, headers, approval_id, true).await
}

async fn decide_approval_deny(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(approval_id): Path<String>,
) -> Result<Json<allternit_cowork_runtime::ApprovalBinding>, ErrorResponse> {
    decide_approval(state, headers, approval_id, false).await
}

async fn decide_approval(
    state: Arc<AppState>,
    headers: HeaderMap,
    approval_id: String,
    grant: bool,
) -> Result<Json<allternit_cowork_runtime::ApprovalBinding>, ErrorResponse> {
    let user = crate::auth::get_user(&headers).ok_or_else(|| ErrorResponse {
        error: "authentication required to decide approvals".to_string(),
        code: 401,
    })?;
    let mut conn = state.db.connect().map_err(db_error)?;
    let binding =
        sqlite_store::decide_approval(&mut conn, &approval_id, grant, &user.user_id)
            .map_err(transport_err)?;
    Ok(Json(binding))
}
