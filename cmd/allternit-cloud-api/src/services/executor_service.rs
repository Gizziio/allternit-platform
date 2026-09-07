//! Executor Service
//!
//! Background worker that claims queued runs (`runs.status = 'queued'`) and
//! executes them on an ONLINE registered gizzi instance (the presence registry
//! filled by `gizzi serve --tunnel`, see `routes/gizzi_instances.rs`).
//!
//! Dispatch path: plain HTTP to the instance's registered URL, using the
//! instance's cowork runtime API:
//!   - `POST {url}/cowork/runs`                 (create + auto-start a local run)
//!   - `GET  {url}/cowork/runs/:id`             (poll status)
//!   - `GET  {url}/cowork/runs/:id/events`      (incremental event mirror)
//!   - `POST {url}/cowork/runs/:id/cancel`      (best-effort remote cancel)
//!
//! The instance-side "local" mode executes `config.command` as a real shell
//! command on the machine the instance runs on (gizzi
//! `src/runtime/cowork/cowork.runtime.ts`), streaming stdout/stderr events.
//!
//! Honesty rules this worker follows:
//!   - A run is only marked running after a compare-and-swap claim succeeds.
//!   - If no instance is online for the run's owner, the run STAYS queued
//!     (visible as such via the runs API) — it is never marked running and
//!     never silently dropped.
//!   - If dispatch (the initial POST) fails, the run is released back to
//!     queued; after `max_dispatch_attempts` consecutive dispatch failures the
//!     run is failed with the real error.
//!   - If the remote run fails, times out, or disappears, the cloud run is
//!     failed with the real error message. Nothing is faked.
//!
//! NOT wired yet (deliberately):
//!   - Pre-action approval pausing. The seam is [`ApprovalGate`]: it runs
//!     after the claim and before the remote dispatch, so wiring the HITL
//!     approval plane later means implementing that trait against
//!     `approval_requests` instead of `AllowAllGate`.
//!   - Pause propagation to the instance (a paused cloud run keeps its remote
//!     command running; cancellation IS propagated).

use crate::db::cowork_models::*;
use crate::error::ApiError;
use crate::services::{EventStore, RunService};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, Semaphore};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// How recently a gizzi instance must have refreshed its registration to be
/// considered online. Mirrors `ONLINE_WINDOW_MINUTES` in
/// `routes/gizzi_instances.rs`.
const ONLINE_WINDOW_MINUTES: i64 = 10;

/// Executor configuration, loaded from environment variables.
#[derive(Debug, Clone)]
pub struct ExecutorConfig {
    /// How often the worker looks for queued runs.
    pub poll_interval: Duration,
    /// How often a monitored run polls the instance for status/events.
    pub monitor_interval: Duration,
    /// Max runs executing concurrently.
    pub max_concurrent_runs: usize,
    /// Hard cap on how long one run may execute before it is failed.
    pub run_timeout: Duration,
    /// Timeout for a single HTTP request to an instance.
    pub request_timeout: Duration,
    /// Consecutive dispatch failures before a run is failed instead of requeued.
    pub max_dispatch_attempts: u32,
    /// Consecutive status/event poll failures before a running dispatch is
    /// declared lost and the run is failed.
    pub max_poll_failures: u32,
    /// Optional Bearer token sent to instances (for instances fronted by an
    /// auth proxy that accepts a static token).
    pub instance_bearer_token: Option<String>,
    /// Optional HTTP basic auth (username, password) for instances started
    /// with `GIZZI_SERVER_PASSWORD`.
    pub instance_basic_auth: Option<(String, String)>,
}

impl Default for ExecutorConfig {
    fn default() -> Self {
        Self {
            poll_interval: Duration::from_secs(5),
            monitor_interval: Duration::from_secs(3),
            max_concurrent_runs: 4,
            run_timeout: Duration::from_secs(3600),
            request_timeout: Duration::from_secs(30),
            max_dispatch_attempts: 5,
            max_poll_failures: 10,
            instance_bearer_token: None,
            instance_basic_auth: None,
        }
    }
}

impl ExecutorConfig {
    /// Load configuration from environment variables.
    pub fn from_env() -> Self {
        let defaults = Self::default();
        let secs = |key: &str, default: u64| {
            std::env::var(key)
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(default)
        };
        let basic_auth = std::env::var("EXECUTOR_INSTANCE_PASSWORD")
            .ok()
            .filter(|p| !p.is_empty())
            .map(|password| {
                let username = std::env::var("EXECUTOR_INSTANCE_USERNAME")
                    .ok()
                    .filter(|u| !u.is_empty())
                    .unwrap_or_else(|| "gizzi".to_string());
                (username, password)
            });
        Self {
            poll_interval: Duration::from_secs(secs("EXECUTOR_POLL_INTERVAL_SECS", 5)),
            monitor_interval: Duration::from_secs(secs("EXECUTOR_MONITOR_INTERVAL_SECS", 3)),
            max_concurrent_runs: std::env::var("EXECUTOR_MAX_CONCURRENT_RUNS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.max_concurrent_runs),
            run_timeout: Duration::from_secs(secs("EXECUTOR_RUN_TIMEOUT_SECS", 3600)),
            request_timeout: Duration::from_secs(secs("EXECUTOR_REQUEST_TIMEOUT_SECS", 30)),
            max_dispatch_attempts: std::env::var("EXECUTOR_MAX_DISPATCH_ATTEMPTS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.max_dispatch_attempts),
            max_poll_failures: std::env::var("EXECUTOR_MAX_POLL_FAILURES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.max_poll_failures),
            instance_bearer_token: std::env::var("EXECUTOR_INSTANCE_BEARER_TOKEN")
                .ok()
                .filter(|t| !t.is_empty()),
            instance_basic_auth: basic_auth,
        }
    }
}

/// Pre-dispatch approval seam.
///
/// Called after a run is claimed and before anything is sent to the instance.
/// The default gate allows everything; a future HITL implementation should
/// create an `approval_requests` row and either block here until resolved or
/// pause the run (queued → paused) and release the claim.
#[async_trait]
pub trait ApprovalGate: Send + Sync {
    async fn check_before_dispatch(&self, run: &Run) -> Result<(), ApiError>;
}

/// Default gate: every run may dispatch.
pub struct AllowAllGate;

#[async_trait]
impl ApprovalGate for AllowAllGate {
    async fn check_before_dispatch(&self, _run: &Run) -> Result<(), ApiError> {
        Ok(())
    }
}

/// An online registered gizzi instance.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OnlineInstance {
    pub id: String,
    pub name: String,
    pub url: String,
    pub user_id: String,
    pub updated_at: DateTime<Utc>,
}

/// Dependencies the executor needs — a deliberately small subset of ApiState
/// so the worker can be exercised in tests without booting the whole server.
#[derive(Clone)]
pub struct ExecutorDeps {
    pub db: PgPool,
    pub event_store: Arc<dyn EventStore>,
    pub run_service: Arc<dyn RunService>,
}

// ============================================================================
// Claim semantics (the queue)
// ============================================================================

/// Compare-and-swap claim: queued → running.
///
/// Returns `true` iff this caller won the claim. Two workers racing the same
/// run cannot both win: SQLite serializes the UPDATE and only the first one
/// still sees `status = 'queued'`. `started_at` is stamped here (mirroring
/// `RunServiceImpl::transition`'s behavior for the running transition).
pub async fn claim_run(db: &PgPool, run_id: &str) -> Result<bool, ApiError> {
    let now = Utc::now();
    let result = sqlx::query(
        "UPDATE runs SET status = $1, started_at = $2, updated_at = $3 WHERE id = $4 AND status = $5",
    )
    .bind(RunStatus::Running)
    .bind(now)
    .bind(now)
    .bind(run_id)
    .bind(RunStatus::Queued)
    .execute(db)
    .await
    .map_err(ApiError::DatabaseError)?;
    Ok(result.rows_affected() == 1)
}

/// Release a claimed run back to the queue (running → queued). Used when
/// dispatch to the instance fails before any remote work started.
pub async fn release_run(db: &PgPool, run_id: &str) -> Result<bool, ApiError> {
    let now = Utc::now();
    let result = sqlx::query(
        "UPDATE runs SET status = $1, started_at = NULL, updated_at = $2 WHERE id = $3 AND status = $4",
    )
    .bind(RunStatus::Queued)
    .bind(now)
    .bind(run_id)
    .bind(RunStatus::Running)
    .execute(db)
    .await
    .map_err(ApiError::DatabaseError)?;
    Ok(result.rows_affected() == 1)
}

/// List queued runs, oldest first.
pub async fn list_queued_runs(db: &PgPool, limit: i64) -> Result<Vec<Run>, ApiError> {
    sqlx::query_as::<_, Run>(
        "SELECT * FROM runs WHERE status = $1 ORDER BY created_at ASC LIMIT $2",
    )
    .bind(RunStatus::Queued)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(ApiError::DatabaseError)
}

/// Find the freshest online instance for an owner.
///
/// Owner scoping: a run with an `owner_id` may only execute on an instance
/// registered by the same user. A run with no owner (e.g. created through the
/// unauthenticated dev path) may use any online instance — acceptable for the
/// single-operator deployments this serves today, and easy to tighten later.
pub async fn find_online_instance(
    db: &PgPool,
    owner_id: Option<&str>,
) -> Result<Option<OnlineInstance>, ApiError> {
    sqlx::query_as::<_, OnlineInstance>(
        r#"
        SELECT id, name, url, user_id, updated_at
        FROM gizzi_instances
        WHERE updated_at >= NOW() + $1::INTERVAL
          AND ($2 IS NULL OR user_id = $3)
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(format!("-{ONLINE_WINDOW_MINUTES} minutes"))
    .bind(owner_id)
    .bind(owner_id)
    .fetch_optional(db)
    .await
    .map_err(ApiError::DatabaseError)
}

// ============================================================================
// Instance HTTP client
// ============================================================================

/// Why a dispatch/monitor call to an instance failed.
#[derive(Debug)]
pub enum DispatchError {
    /// Network-level failure (DNS, TCP, TLS, timeout).
    Transport(String),
    /// The instance answered with a non-2xx status.
    Http { status: u16, body: String },
    /// The instance answered 2xx but the body was not the expected shape.
    InvalidResponse(String),
}

impl std::fmt::Display for DispatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DispatchError::Transport(e) => write!(f, "instance unreachable: {e}"),
            DispatchError::Http { status, body } => {
                write!(f, "instance returned HTTP {status}: {}", truncate(body, 200))
            }
            DispatchError::InvalidResponse(e) => write!(f, "invalid instance response: {e}"),
        }
    }
}

fn truncate(s: &str, max: usize) -> &str {
    if s.len() <= max {
        s
    } else {
        let mut end = max;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        &s[..end]
    }
}

/// Status view of a run on the instance.
#[derive(Debug, Deserialize)]
struct InstanceRunView {
    status: String,
    error_message: Option<String>,
}

/// One event from the instance's cowork event log.
#[derive(Debug, Deserialize)]
struct InstanceEvent {
    sequence: i64,
    event_type: String,
    payload: Option<serde_json::Value>,
}

/// HTTP client for one gizzi instance's cowork API.
#[derive(Debug, Clone)]
pub struct GizziInstanceClient {
    http: reqwest::Client,
    base_url: String,
    bearer_token: Option<String>,
    basic_auth: Option<(String, String)>,
}

impl GizziInstanceClient {
    pub fn new(
        base_url: &str,
        request_timeout: Duration,
        bearer_token: Option<String>,
        basic_auth: Option<(String, String)>,
    ) -> Result<Self, ApiError> {
        let http = reqwest::Client::builder()
            .timeout(request_timeout)
            .build()
            .map_err(|e| ApiError::Internal(format!("Failed to build HTTP client: {e}")))?;
        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            bearer_token,
            basic_auth,
        })
    }

    fn authed(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        let req = if let Some(token) = &self.bearer_token {
            req.bearer_auth(token)
        } else {
            req
        };
        if let Some((username, password)) = &self.basic_auth {
            req.basic_auth(username, Some(password))
        } else {
            req
        }
    }

    async fn send(&self, req: reqwest::RequestBuilder) -> Result<reqwest::Response, DispatchError> {
        let response = self
            .authed(req)
            .send()
            .await
            .map_err(|e| DispatchError::Transport(e.to_string()))?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(DispatchError::Http {
                status: status.as_u16(),
                body,
            });
        }
        Ok(response)
    }

    /// Create (and auto-start) a local run on the instance. Returns the
    /// instance-side run id.
    async fn create_run(
        &self,
        name: &str,
        config: serde_json::Value,
    ) -> Result<String, DispatchError> {
        let response = self
            .send(self.http.post(format!("{}/cowork/runs", self.base_url)).json(&serde_json::json!({
                "name": name,
                "mode": "local",
                "config": config,
                "auto_start": true,
            })))
            .await?;
        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| DispatchError::InvalidResponse(e.to_string()))?;
        body.get("id")
            .and_then(|id| id.as_str())
            .map(|id| id.to_string())
            .ok_or_else(|| DispatchError::InvalidResponse(format!("missing run id: {body}")))
    }

    async fn get_run(&self, remote_run_id: &str) -> Result<InstanceRunView, DispatchError> {
        let response = self
            .send(self.http.get(format!("{}/cowork/runs/{}", self.base_url, remote_run_id)))
            .await?;
        response
            .json()
            .await
            .map_err(|e| DispatchError::InvalidResponse(e.to_string()))
    }

    /// Fetch events with `sequence >= since_sequence`, ascending. The
    /// instance returns newest-first with a `gte` cursor, so we over-fetch and
    /// flip the order.
    async fn get_events(
        &self,
        remote_run_id: &str,
        since_sequence: i64,
    ) -> Result<Vec<InstanceEvent>, DispatchError> {
        let response = self
            .send(self.http.get(format!(
                "{}/cowork/runs/{}/events?cursor={}&limit=200",
                self.base_url, remote_run_id, since_sequence
            )))
            .await?;
        let mut events: Vec<InstanceEvent> = response
            .json()
            .await
            .map_err(|e| DispatchError::InvalidResponse(e.to_string()))?;
        events.sort_by_key(|e| e.sequence);
        Ok(events)
    }

    async fn cancel_run(&self, remote_run_id: &str) -> Result<(), DispatchError> {
        self.send(self.http.post(format!(
            "{}/cowork/runs/{}/cancel",
            self.base_url, remote_run_id
        )))
        .await?;
        Ok(())
    }
}

/// Map an instance-side cowork event onto the cloud event taxonomy. Returns
/// `None` for the instance's own terminal bookkeeping events — the cloud side
/// emits its own `run_completed`/`run_failed` via `RunService` with the
/// authoritative payload, and mirroring both would duplicate them.
fn map_instance_event(event_type: &str, payload: serde_json::Value) -> Option<(EventType, serde_json::Value)> {
    let with_stream = |stream: &str, payload: serde_json::Value| {
        let mut obj = payload.as_object().cloned().unwrap_or_default();
        obj.insert("stream".to_string(), serde_json::Value::String(stream.to_string()));
        serde_json::Value::Object(obj)
    };
    match event_type {
        "run_started" => Some((EventType::RunStarted, payload)),
        "stdout" => Some((EventType::Stdout, with_stream("stdout", payload))),
        "stderr" => Some((EventType::Stderr, with_stream("stderr", payload))),
        "step_started" => Some((EventType::StepStarted, payload)),
        "step_completed" => Some((EventType::StepCompleted, payload)),
        "step_failed" => Some((EventType::StepFailed, payload)),
        "run_completed" | "run_failed" | "run_cancelled" | "run_paused" | "run_resumed" => None,
        // Unknown event types are mirrored verbatim as generic output so the
        // cloud log never silently drops information.
        _ => Some((
            EventType::Output,
            serde_json::json!({ "instance_event_type": event_type, "payload": payload }),
        )),
    }
}

// ============================================================================
// Job bookkeeping (runs/:id/jobs answers with real data)
// ============================================================================

async fn job_started(db: &PgPool, run_id: &str, instance_name: &str) -> Result<String, ApiError> {
    let job_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    sqlx::query(
        r#"
        INSERT INTO jobs (
            id, run_id, name, description, status, priority, queue_position,
            config, scheduled_at, started_at, completed_at, exit_code, result,
            error_message, retry_count, max_retries, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        "#,
    )
    .bind(&job_id)
    .bind(run_id)
    .bind("gizzi-dispatch")
    .bind(format!("Dispatched to gizzi instance '{instance_name}'"))
    .bind(JobStatus::Running)
    .bind(0i32)
    .bind(None::<i32>)
    .bind(sqlx::types::Json(serde_json::json!({})))
    .bind(None::<DateTime<Utc>>)
    .bind(now)
    .bind(None::<DateTime<Utc>>)
    .bind(None::<i32>)
    .bind(None::<sqlx::types::Json<serde_json::Value>>)
    .bind(None::<String>)
    .bind(0i32)
    .bind(0i32)
    .bind(now)
    .bind(now)
    .execute(db)
    .await
    .map_err(ApiError::DatabaseError)?;
    Ok(job_id)
}

async fn job_finished(
    db: &PgPool,
    job_id: &str,
    status: JobStatus,
    result: Option<serde_json::Value>,
    error_message: Option<&str>,
) -> Result<(), ApiError> {
    sqlx::query(
        "UPDATE jobs SET status = $1, completed_at = $2, result = $3, error_message = $4, updated_at = $5 WHERE id = $6",
    )
    .bind(status)
    .bind(Utc::now())
    .bind(result.map(sqlx::types::Json))
    .bind(error_message)
    .bind(Utc::now())
    .bind(job_id)
    .execute(db)
    .await
    .map_err(ApiError::DatabaseError)?;
    Ok(())
}

// ============================================================================
// Run execution lifecycle
// ============================================================================

/// Build the instance-side run config from the cloud run config. Returns
/// `Err` with an operator-facing message when the run has nothing executable.
fn build_instance_config(run: &Run, run_timeout: Duration) -> Result<serde_json::Value, String> {
    let config = &run.config.0;
    let command = config
        .command
        .as_deref()
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .ok_or_else(|| {
            "run config has no command to execute (set config.command or, for schedules, a job_template with a command)".to_string()
        })?;
    let timeout_ms = config
        .resource_limits
        .as_ref()
        .and_then(|r| r.timeout_seconds)
        .map(|s| (s.max(1) as u64) * 1000)
        .unwrap_or_else(|| run_timeout.as_millis() as u64);
    let mut out = serde_json::json!({
        "command": command,
        "timeout_ms": timeout_ms,
    });
    if let Some(dir) = config.working_dir.as_deref().filter(|d| !d.is_empty()) {
        out["working_dir"] = serde_json::Value::String(dir.to_string());
    }
    if let Some(env) = &config.env {
        out["env"] = serde_json::json!(env);
    }
    Ok(out)
}

/// Outcome of one execute_run call (mostly useful for tests and logging).
#[derive(Debug, PartialEq, Eq)]
pub enum ExecutionOutcome {
    Completed,
    Failed,
    Cancelled,
    /// Dispatch failed; the run was released back to queued.
    Requeued,
}

/// Execute a claimed run on the given instance. The run MUST already be
/// claimed (status running) by the caller.
pub async fn execute_run(
    deps: &ExecutorDeps,
    config: &ExecutorConfig,
    gate: &dyn ApprovalGate,
    run: &Run,
    instance: &OnlineInstance,
) -> ExecutionOutcome {
    let run_id = run.id.clone();

    info!(run_id = %run_id, instance = %instance.name, "Dispatching run to gizzi instance");

    // Record the runtime assignment so run reads show where it executes.
    if let Err(e) = deps
        .run_service
        .assign_runtime(&run_id, &instance.id, "remote")
        .await
    {
        warn!(run_id = %run_id, "Failed to record runtime assignment: {e}");
    }

    // Heartbeat: the run row's updated_at proves a live executor owns it.
    let _ = deps
        .event_store
        .append(
            &run_id,
            EventType::RunStarted,
            serde_json::json!({
                "executor": "gizzi-instance",
                "instance_id": instance.id,
                "instance_name": instance.name,
                "started_at": Utc::now().to_rfc3339(),
            }),
        )
        .await;

    let job_id = match job_started(&deps.db, &run_id, &instance.name).await {
        Ok(id) => Some(id),
        Err(e) => {
            warn!(run_id = %run_id, "Failed to create job row: {e}");
            None
        }
    };

    // Pre-action approval seam — no-op today.
    if let Err(e) = gate.check_before_dispatch(run).await {
        let message = format!("dispatch rejected by approval gate: {e}");
        let _ = deps.run_service.fail(&run_id, &message, None).await;
        if let Some(job_id) = &job_id {
            let _ = job_finished(&deps.db, job_id, JobStatus::Failed, None, Some(&message)).await;
        }
        return ExecutionOutcome::Failed;
    }

    let instance_config = match build_instance_config(run, config.run_timeout) {
        Ok(c) => c,
        Err(message) => {
            let _ = deps.run_service.fail(&run_id, &message, None).await;
            if let Some(job_id) = &job_id {
                let _ = job_finished(&deps.db, job_id, JobStatus::Failed, None, Some(&message)).await;
            }
            return ExecutionOutcome::Failed;
        }
    };

    let client = match GizziInstanceClient::new(
        &instance.url,
        config.request_timeout,
        config.instance_bearer_token.clone(),
        config.instance_basic_auth.clone(),
    ) {
        Ok(c) => c,
        Err(e) => {
            let message = e.to_string();
            let _ = deps.run_service.fail(&run_id, &message, None).await;
            if let Some(job_id) = &job_id {
                let _ = job_finished(&deps.db, job_id, JobStatus::Failed, None, Some(&message)).await;
            }
            return ExecutionOutcome::Failed;
        }
    };

    // --- Dispatch: create the remote run ---
    let remote_run_id = match client.create_run(&run.name, instance_config).await {
        Ok(id) => id,
        Err(e) => {
            let _ = deps
                .event_store
                .append(
                    &run_id,
                    EventType::Warning,
                    serde_json::json!({
                        "warning": "dispatch to instance failed; run returned to queue",
                        "error": e.to_string(),
                        "instance_id": instance.id,
                    }),
                )
                .await;
            if let Err(release_err) = release_run(&deps.db, &run_id).await {
                error!(run_id = %run_id, "Failed to release run back to queue: {release_err}");
            }
            if let Some(job_id) = &job_id {
                let _ = job_finished(
                    &deps.db,
                    job_id,
                    JobStatus::Failed,
                    None,
                    Some(&format!("dispatch failed: {e}")),
                )
                .await;
            }
            return ExecutionOutcome::Requeued;
        }
    };

    info!(run_id = %run_id, remote_run_id = %remote_run_id, "Remote run created on instance");

    // --- Monitor: mirror events + watch for terminal status ---
    let outcome = monitor_run(deps, config, &client, run, instance, &remote_run_id).await;

    if let Some(job_id) = &job_id {
        let (status, result, error_message) = match &outcome {
            ExecutionOutcome::Completed => (
                JobStatus::Completed,
                Some(serde_json::json!({
                    "instance_id": instance.id,
                    "instance_name": instance.name,
                    "remote_run_id": remote_run_id,
                })),
                None,
            ),
            ExecutionOutcome::Cancelled => (JobStatus::Cancelled, None, None),
            ExecutionOutcome::Requeued => (JobStatus::Failed, None, Some("dispatch failed".to_string())),
            ExecutionOutcome::Failed => (JobStatus::Failed, None, Some("remote execution failed".to_string())),
        };
        let _ = job_finished(&deps.db, job_id, status, result, error_message.as_deref()).await;
    }

    outcome
}

/// Current local status of a run.
async fn local_run_status(db: &PgPool, run_id: &str) -> Result<Option<RunStatus>, ApiError> {
    sqlx::query_scalar::<_, RunStatus>("SELECT status FROM runs WHERE id = $1")
        .bind(run_id)
        .fetch_optional(db)
        .await
        .map_err(ApiError::DatabaseError)
}

/// Poll the instance until the remote run terminates, the local run is
/// cancelled, the run times out, or contact is lost.
async fn monitor_run(
    deps: &ExecutorDeps,
    config: &ExecutorConfig,
    client: &GizziInstanceClient,
    run: &Run,
    instance: &OnlineInstance,
    remote_run_id: &str,
) -> ExecutionOutcome {
    let run_id = &run.id;
    let deadline = std::time::Instant::now() + config.run_timeout;
    let mut cursor: i64 = 0;
    let mut poll_failures: u32 = 0;

    loop {
        tokio::time::sleep(config.monitor_interval).await;

        // Local cancellation wins: propagate to the instance and stop.
        match local_run_status(&deps.db, run_id).await {
            Ok(Some(RunStatus::Cancelled)) => {
                info!(run_id = %run_id, "Run cancelled locally; cancelling remote run");
                let _ = client.cancel_run(remote_run_id).await;
                drain_events(deps, client, run_id, instance, remote_run_id, &mut cursor).await;
                return ExecutionOutcome::Cancelled;
            }
            Ok(Some(status)) if status.is_terminal() => {
                // Failed/completed by another path (shouldn't normally happen).
                return ExecutionOutcome::Cancelled;
            }
            Ok(_) => {}
            Err(e) => warn!(run_id = %run_id, "Failed to read local run status: {e}"),
        }

        // Mirror new events.
        match client.get_events(remote_run_id, cursor + 1).await {
            Ok(events) => {
                poll_failures = 0;
                for event in events {
                    cursor = cursor.max(event.sequence);
                    let payload = event.payload.unwrap_or(serde_json::Value::Null);
                    if let Some((event_type, mapped)) = map_instance_event(&event.event_type, payload) {
                        let _ = deps
                            .event_store
                            .append_with_source(
                                run_id,
                                event_type,
                                mapped,
                                Some(&instance.id),
                                Some(ClientType::Api),
                            )
                            .await;
                    }
                }
            }
            Err(e) => {
                poll_failures += 1;
                warn!(run_id = %run_id, failures = poll_failures, "Event poll failed: {e}");
            }
        }

        // Heartbeat: prove a live executor still owns this run.
        let _ = sqlx::query("UPDATE runs SET updated_at = $1 WHERE id = $2")
            .bind(Utc::now())
            .bind(run_id)
            .execute(&deps.db)
            .await;

        // Check remote status.
        match client.get_run(remote_run_id).await {
            Ok(view) => {
                poll_failures = 0;
                match view.status.as_str() {
                    "completed" => {
                        drain_events(deps, client, run_id, instance, remote_run_id, &mut cursor).await;
                        finish_terminal(deps, run_id, |svc, id| async move { svc.complete(&id).await.map(|_| ()) }).await;
                        return ExecutionOutcome::Completed;
                    }
                    "failed" => {
                        drain_events(deps, client, run_id, instance, remote_run_id, &mut cursor).await;
                        let message = view
                            .error_message
                            .unwrap_or_else(|| "remote run failed without an error message".to_string());
                        let svc = deps.run_service.clone();
                        let id = run_id.clone();
                        let _ = svc.fail(&id, &message, None).await;
                        return ExecutionOutcome::Failed;
                    }
                    "cancelled" => {
                        drain_events(deps, client, run_id, instance, remote_run_id, &mut cursor).await;
                        let _ = deps.run_service.cancel(run_id, Some("cancelled on instance")).await;
                        return ExecutionOutcome::Cancelled;
                    }
                    _ => {}
                }
            }
            Err(e) => {
                poll_failures += 1;
                warn!(run_id = %run_id, failures = poll_failures, "Status poll failed: {e}");
                if poll_failures >= config.max_poll_failures {
                    let message = format!(
                        "lost contact with instance '{}' after {poll_failures} poll failures (last error: {e}); remote run {remote_run_id} state unknown",
                        instance.name
                    );
                    let _ = deps.run_service.fail(run_id, &message, None).await;
                    return ExecutionOutcome::Failed;
                }
            }
        }

        if std::time::Instant::now() >= deadline {
            let message = format!(
                "run exceeded executor timeout of {}s; remote run cancelled",
                config.run_timeout.as_secs()
            );
            let _ = client.cancel_run(remote_run_id).await;
            drain_events(deps, client, run_id, instance, remote_run_id, &mut cursor).await;
            let _ = deps.run_service.fail(run_id, &message, None).await;
            return ExecutionOutcome::Failed;
        }
    }
}

/// Final event drain so mirrored output lands before the terminal transition.
async fn drain_events(
    deps: &ExecutorDeps,
    client: &GizziInstanceClient,
    run_id: &str,
    instance: &OnlineInstance,
    remote_run_id: &str,
    cursor: &mut i64,
) {
    if let Ok(events) = client.get_events(remote_run_id, *cursor + 1).await {
        for event in events {
            *cursor = (*cursor).max(event.sequence);
            let payload = event.payload.unwrap_or(serde_json::Value::Null);
            if let Some((event_type, mapped)) = map_instance_event(&event.event_type, payload) {
                let _ = deps
                    .event_store
                    .append_with_source(run_id, event_type, mapped, Some(&instance.id), Some(ClientType::Api))
                    .await;
            }
        }
    }
}

/// Complete a run unless it was concurrently moved to a terminal state.
async fn finish_terminal<F, Fut>(deps: &ExecutorDeps, run_id: &str, finish: F)
where
    F: FnOnce(Arc<dyn RunService>, String) -> Fut,
    Fut: std::future::Future<Output = Result<(), ApiError>>,
{
    match local_run_status(&deps.db, run_id).await {
        Ok(Some(status)) if status.is_terminal() => {
            info!(run_id = %run_id, "Run already terminal locally; skipping completion");
        }
        _ => {
            if let Err(e) = finish(deps.run_service.clone(), run_id.to_string()).await {
                warn!(run_id = %run_id, "Failed to finalize run: {e}");
            }
        }
    }
}

// ============================================================================
// Background worker
// ============================================================================

/// The executor worker: claims queued runs and dispatches them.
pub struct ExecutorService {
    config: ExecutorConfig,
    deps: ExecutorDeps,
    gate: Arc<dyn ApprovalGate>,
}

impl ExecutorService {
    pub fn new(config: ExecutorConfig, deps: ExecutorDeps) -> Self {
        Self {
            config,
            deps,
            gate: Arc::new(AllowAllGate),
        }
    }

    /// Install a custom approval gate (future HITL wiring).
    pub fn with_gate(mut self, gate: Arc<dyn ApprovalGate>) -> Self {
        self.gate = gate;
        self
    }

    /// Spawn the worker loop.
    pub fn start(self) {
        tokio::spawn(async move {
            if let Err(e) = self.fail_orphaned_runs().await {
                error!("Executor startup sweep failed: {e}");
            }

            let semaphore = Arc::new(Semaphore::new(self.config.max_concurrent_runs));
            // Consecutive dispatch failures per run. In-memory on purpose: a
            // restart resets the budget, which is the least surprising behavior.
            let dispatch_attempts: Arc<Mutex<HashMap<String, u32>>> =
                Arc::new(Mutex::new(HashMap::new()));
            let mut interval = tokio::time::interval(self.config.poll_interval);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            info!(
                poll_interval_secs = self.config.poll_interval.as_secs(),
                max_concurrent = self.config.max_concurrent_runs,
                "Executor service started"
            );

            loop {
                interval.tick().await;
                if let Err(e) = self.tick(&semaphore, &dispatch_attempts).await {
                    error!("Error during executor tick: {e}");
                }
            }
        });
    }

    async fn tick(
        &self,
        semaphore: &Arc<Semaphore>,
        dispatch_attempts: &Arc<Mutex<HashMap<String, u32>>>,
    ) -> Result<(), ApiError> {
        if semaphore.available_permits() == 0 {
            return Ok(());
        }

        let candidates =
            list_queued_runs(&self.deps.db, (semaphore.available_permits() * 2) as i64).await?;

        for run in candidates {
            let Ok(permit) = semaphore.clone().try_acquire_owned() else {
                break;
            };

            let instance = match find_online_instance(&self.deps.db, run.owner_id.as_deref()).await?
            {
                Some(instance) => instance,
                None => {
                    // Never stuck silently: the run stays queued (truthfully
                    // reported by the runs API as waiting for capacity) and we
                    // say why in the logs.
                    debug!(
                        run_id = %run.id,
                        owner_id = ?run.owner_id,
                        "No online gizzi instance for run; leaving queued"
                    );
                    drop(permit);
                    continue;
                }
            };

            if !claim_run(&self.deps.db, &run.id).await? {
                drop(permit);
                continue; // lost the race to another worker
            }

            let deps = self.deps.clone();
            let config = self.config.clone();
            let gate = self.gate.clone();
            let attempts = dispatch_attempts.clone();
            let run_id = run.id.clone();

            tokio::spawn(async move {
                let _permit = permit;
                let outcome = execute_run(&deps, &config, gate.as_ref(), &run, &instance).await;
                let mut attempts = attempts.lock().await;
                match outcome {
                    ExecutionOutcome::Requeued => {
                        let count = attempts.entry(run_id.clone()).or_insert(0);
                        *count += 1;
                        if *count >= config.max_dispatch_attempts {
                            let message = format!(
                                "dispatch failed {count} times in a row; giving up (last error is in the run's event log)"
                            );
                            // The run is queued again at this point; claim it
                            // back so the state machine allows the failure.
                            if let Ok(true) = claim_run(&deps.db, &run_id).await {
                                let _ = deps.run_service.fail(&run_id, &message, None).await;
                            }
                            attempts.remove(&run_id);
                        }
                    }
                    _ => {
                        attempts.remove(&run_id);
                    }
                }
            });
        }

        Ok(())
    }

    /// Runs left in `running` by a previous executor process (crash/restart)
    /// have no live monitor in this process, and the remote run's real state
    /// is unknowable from here. Failing them loudly beats leaving them
    /// running forever or blindly re-executing a possibly non-idempotent
    /// command.
    async fn fail_orphaned_runs(&self) -> Result<(), ApiError> {
        let orphans = sqlx::query_as::<_, Run>(
            "SELECT * FROM runs WHERE status = $1 AND runtime_id LIKE 'gi\\_%' ESCAPE '\\'",
        )
        .bind(RunStatus::Running)
        .fetch_all(&self.deps.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        for orphan in orphans {
            warn!(run_id = %orphan.id, "Failing orphaned run from a previous executor process");
            // Claim semantics don't apply here (already running); fail directly.
            let _ = self
                .deps
                .run_service
                .fail(
                    &orphan.id,
                    "executor restarted before this run finished; remote execution state unknown",
                    None,
                )
                .await;
        }

        Ok(())
    }
}

/// Initialize and start the executor service.
pub fn start_executor_service(config: ExecutorConfig, deps: ExecutorDeps) {
    ExecutorService::new(config, deps).start();
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::{EventStoreImpl, RunServiceImpl};
    use sqlx::postgres::PgPoolOptions;

    /// Minimal DDL for the tables the executor touches, matching migrations
    /// 002 (runs/jobs/events) and 018 (gizzi_instances).
    const TEST_DDL: &str = r#"
        DROP TABLE IF EXISTS runs CASCADE;

        CREATE TABLE runs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            mode runmode NOT NULL,
            status runstatus NOT NULL,
            step_cursor TEXT,
            total_steps INTEGER,
            completed_steps INTEGER DEFAULT 0,
            config JSONB NOT NULL,
            owner_id TEXT,
            tenant_id TEXT,
            runtime_id TEXT,
            runtime_type TEXT CHECK (runtime_type IN ('local', 'remote', 'cloud')),
            schedule_id TEXT,
            region_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            error_message TEXT,
            error_details JSONB
        );
        DROP TABLE IF EXISTS jobs CASCADE;

        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            status jobstatus NOT NULL,
            priority INTEGER NOT NULL DEFAULT 0,
            queue_position INTEGER,
            config JSONB NOT NULL,
            scheduled_at TIMESTAMPTZ,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            exit_code INTEGER,
            result JSONB,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        DROP TABLE IF EXISTS events CASCADE;

        CREATE TABLE events (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
            sequence BIGINT NOT NULL,
            event_type eventtype NOT NULL,
            payload JSONB,
            source_client_id TEXT,
            source_client_type TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        DROP TABLE IF EXISTS gizzi_instances CASCADE;

        CREATE TABLE gizzi_instances (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, name)
        );
    "#;

    async fn test_pool() -> PgPool {
        let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
        let schema_for_hook = schema.clone();
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    for stmt in [
                        "CREATE TYPE runmode AS ENUM ('local', 'remote', 'cloud')",
                        "CREATE TYPE runstatus AS ENUM ('pending', 'planning', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled')",
                        "CREATE TYPE jobstatus AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'retrying')",
                        "CREATE TYPE clienttype AS ENUM ('terminal', 'web', 'desktop', 'mobile', 'api')",
                        "CREATE TYPE eventtype AS ENUM ('run_created', 'run_started', 'run_completed', 'run_failed', 'run_cancelled', 'run_paused', 'run_resumed', 'step_started', 'step_completed', 'step_failed', 'step_skipped', 'stdout', 'stderr', 'output', 'tool_call', 'tool_result', 'approval_needed', 'approval_given', 'approval_denied', 'approval_timeout', 'checkpoint_created', 'checkpoint_restored', 'job_queued', 'job_started', 'job_completed', 'job_failed', 'job_cancelled', 'heartbeat', 'warning', 'error')",
                    ] {
                        sqlx::query(stmt)
                            .execute(&mut *conn)
                            .await
                            .ok();
                    }
                    Ok(())
                })
            })
            .connect(url)
            .await
            .unwrap();
        for statement in TEST_DDL.split(';').map(str::trim).filter(|s| !s.is_empty()) {
            sqlx::query(statement).execute(&pool).await.unwrap();
        }
        pool
    }

    /// Shared pool for tests that need to race on one database.
    /// Uses a unique schema per test name for isolation.
    async fn shared_pool(name: &str) -> PgPool {
        let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
        let schema = format!("test_{}", name.replace(|c: char| !c.is_alphanumeric(), "_"));
        let schema_for_hook = schema.clone();
        let pool = PgPoolOptions::new()
            .max_connections(4)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    // Create enum types in the test schema so DDL doesn't need public in search_path.
                    for stmt in [
                        "CREATE TYPE runmode AS ENUM ('local', 'remote', 'cloud')",
                        "CREATE TYPE runstatus AS ENUM ('pending', 'planning', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled')",
                        "CREATE TYPE jobstatus AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'retrying')",
                        "CREATE TYPE clienttype AS ENUM ('terminal', 'web', 'desktop', 'mobile', 'api')",
                        "CREATE TYPE eventtype AS ENUM ('run_created', 'run_started', 'run_completed', 'run_failed', 'run_cancelled', 'run_paused', 'run_resumed', 'step_started', 'step_completed', 'step_failed', 'step_skipped', 'stdout', 'stderr', 'output', 'tool_call', 'tool_result', 'approval_needed', 'approval_given', 'approval_denied', 'approval_timeout', 'checkpoint_created', 'checkpoint_restored', 'job_queued', 'job_started', 'job_completed', 'job_failed', 'job_cancelled', 'heartbeat', 'warning', 'error')",
                    ] {
                        sqlx::query(stmt)
                            .execute(&mut *conn)
                            .await
                            .ok(); // ignore "already exists" errors
                    }
                    Ok(())
                })
            })
            .connect(url)
            .await
            .unwrap();
        for statement in TEST_DDL.split(';').map(str::trim).filter(|s| !s.is_empty()) {
            sqlx::query(statement).execute(&pool).await.unwrap();
        }
        pool
    }

    fn test_deps(db: PgPool) -> ExecutorDeps {
        let event_store: Arc<dyn EventStore> = Arc::new(EventStoreImpl::new(db.clone()));
        let run_service: Arc<dyn RunService> =
            Arc::new(RunServiceImpl::new(db.clone()).with_event_store(event_store.clone()));
        ExecutorDeps {
            db,
            event_store,
            run_service,
        }
    }

    async fn insert_run(pool: &PgPool, id: &str, status: RunStatus, config: serde_json::Value) {
        insert_run_with_owner(pool, id, status, config, None).await;
    }

    async fn insert_run_with_owner(
        pool: &PgPool,
        id: &str,
        status: RunStatus,
        config: serde_json::Value,
        owner_id: Option<&str>,
    ) {
        sqlx::query(
            r#"
            INSERT INTO runs (
                id, name, description, mode, status, step_cursor, total_steps, completed_steps,
                config, owner_id, tenant_id, runtime_id, runtime_type, schedule_id, region_id,
                created_at, updated_at, started_at, completed_at, error_message, error_details
            ) VALUES ($1, $2, NULL, 'remote', $3, NULL, NULL, 0, $4, $5, NULL, NULL, NULL, NULL, NULL,
                      NOW(), NOW(), NULL, NULL, NULL, NULL)
            "#,
        )
        .bind(id)
        .bind(format!("run-{id}"))
        .bind(status)
        .bind(sqlx::types::Json(config))
        .bind(owner_id)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn run_status(pool: &PgPool, id: &str) -> RunStatus {
        sqlx::query_scalar("SELECT status FROM runs WHERE id = $1")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    fn test_config() -> ExecutorConfig {
        ExecutorConfig {
            poll_interval: Duration::from_millis(50),
            monitor_interval: Duration::from_millis(50),
            max_concurrent_runs: 2,
            run_timeout: Duration::from_secs(30),
            request_timeout: Duration::from_secs(5),
            max_dispatch_attempts: 3,
            max_poll_failures: 5,
            instance_bearer_token: None,
            instance_basic_auth: None,
        }
    }

    // ---------------------------------------------------------------- claim

    #[tokio::test]
    async fn claim_wins_once_then_loses() {
        let pool = test_pool().await;
        insert_run(&pool, "r1", RunStatus::Queued, serde_json::json!({})).await;

        assert!(claim_run(&pool, "r1").await.unwrap(), "first claim wins");
        assert!(!claim_run(&pool, "r1").await.unwrap(), "second claim loses");
        assert_eq!(run_status(&pool, "r1").await, RunStatus::Running);

        let started_at: Option<DateTime<Utc>> =
            sqlx::query_scalar("SELECT started_at FROM runs WHERE id = 'r1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(started_at.is_some(), "claim stamps started_at");
    }

    #[tokio::test]
    async fn concurrent_claims_cannot_double_take() {
        let name = format!("claimrace{}", Uuid::new_v4().simple());
        let setup = shared_pool(&name).await;
        for statement in TEST_DDL.split(';').map(str::trim).filter(|s| !s.is_empty()) {
            sqlx::query(statement).execute(&setup).await.unwrap();
        }
        insert_run(&setup, "r1", RunStatus::Queued, serde_json::json!({})).await;

        let workers = 8;
        let mut handles = Vec::new();
        for _ in 0..workers {
            let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
            let schema = format!("test_{}", name.replace(|c: char| !c.is_alphanumeric(), "_"));
            let schema_for_hook = schema.clone();
            handles.push(tokio::spawn(async move {
                let pool = PgPoolOptions::new()
                    .max_connections(2)
                    .after_connect(move |conn, _meta| {
                        let schema = schema_for_hook.clone();
                        Box::pin(async move {
                            sqlx::query(&format!("SET search_path TO {}, public", schema))
                                .execute(&mut *conn)
                                .await?;
                            Ok(())
                        })
                    })
                    .connect(url)
                    .await
                    .unwrap();
                claim_run(&pool, "r1").await.unwrap()
            }));
        }

        let mut wins = 0;
        for handle in handles {
            if handle.await.unwrap() {
                wins += 1;
            }
        }
        assert_eq!(wins, 1, "exactly one worker may claim the run");
        assert_eq!(run_status(&setup, "r1").await, RunStatus::Running);
    }

    #[tokio::test]
    async fn release_returns_run_to_queue() {
        let pool = test_pool().await;
        insert_run(&pool, "r1", RunStatus::Queued, serde_json::json!({})).await;

        assert!(claim_run(&pool, "r1").await.unwrap());
        assert!(release_run(&pool, "r1").await.unwrap());
        assert_eq!(run_status(&pool, "r1").await, RunStatus::Queued);

        let started_at: Option<DateTime<Utc>> =
            sqlx::query_scalar("SELECT started_at FROM runs WHERE id = 'r1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(started_at.is_none(), "release clears started_at");

        // And it can be claimed again afterwards.
        assert!(claim_run(&pool, "r1").await.unwrap());
    }

    // ------------------------------------------------------- instance pick

    #[tokio::test]
    async fn online_instance_respects_window_and_owner() {
        let pool = test_pool().await;

        // Stale instance for user_1, fresh for user_2.
        sqlx::query(
            "INSERT INTO gizzi_instances (id, user_id, name, url, updated_at) VALUES ('gi_old', 'user_1', 'old', 'https://old.example.com', NOW() - INTERVAL '1 hour')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO gizzi_instances (id, user_id, name, url) VALUES ('gi_new', 'user_2', 'new', 'https://new.example.com')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let found = find_online_instance(&pool, Some("user_2")).await.unwrap();
        assert_eq!(found.unwrap().id, "gi_new");

        let found = find_online_instance(&pool, Some("user_1")).await.unwrap();
        assert!(found.is_none(), "stale instance is not online");

        // Ownerless runs may use any online instance.
        let found = find_online_instance(&pool, None).await.unwrap();
        assert_eq!(found.unwrap().id, "gi_new");
    }

    // -------------------------------------------------------- event mapping

    #[test]
    fn maps_instance_events_to_cloud_taxonomy() {
        let (ty, payload) = map_instance_event("stdout", serde_json::json!({"content": "hi", "step": "execute"})).unwrap();
        assert_eq!(ty, EventType::Stdout);
        assert_eq!(payload["stream"], "stdout");
        assert_eq!(payload["content"], "hi");

        let (ty, payload) = map_instance_event("stderr", serde_json::json!({"content": "bad"})).unwrap();
        assert_eq!(ty, EventType::Stderr);
        assert_eq!(payload["stream"], "stderr");

        assert!(map_instance_event("run_completed", serde_json::json!({})).is_none());
        assert!(map_instance_event("run_failed", serde_json::json!({})).is_none());

        let (ty, payload) = map_instance_event("some_future_event", serde_json::json!({"x": 1})).unwrap();
        assert_eq!(ty, EventType::Output);
        assert_eq!(payload["instance_event_type"], "some_future_event");
    }

    // --------------------------------------------------------- config build

    #[tokio::test]
    async fn build_instance_config_requires_command() {
        let pool = test_pool().await;
        insert_run(&pool, "r1", RunStatus::Queued, serde_json::json!({})).await;
        let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = 'r1'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(build_instance_config(&run, Duration::from_secs(60)).is_err());

        insert_run(
            &pool,
            "r2",
            RunStatus::Queued,
            serde_json::json!({"command": "echo hi", "working_dir": "/tmp", "env": {"A": "1"}}),
        )
        .await;
        let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = 'r2'")
            .fetch_one(&pool)
            .await
            .unwrap();
        let config = build_instance_config(&run, Duration::from_secs(60)).unwrap();
        assert_eq!(config["command"], "echo hi");
        assert_eq!(config["working_dir"], "/tmp");
        assert_eq!(config["env"]["A"], "1");
    }

    // ------------------------------------------------ end-to-end dispatch

    use axum::{extract::State as AxumState, routing::{get, post}, Json as AxumJson, Router as AxumRouter};
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[derive(Clone)]
    struct MockInstance {
        polls: Arc<AtomicUsize>,
        fail: bool,
    }

    /// Mock gizzi instance implementing the cowork API the executor uses.
    async fn spawn_mock_instance(fail: bool) -> String {
        let state = MockInstance {
            polls: Arc::new(AtomicUsize::new(0)),
            fail,
        };
        let app = AxumRouter::new()
            .route(
                "/cowork/runs",
                post(|| async {
                    AxumJson(serde_json::json!({"id": "remote-1", "status": "queued"}))
                }),
            )
            .route(
                "/cowork/runs/:id",
                get(|AxumState(state): AxumState<MockInstance>| async move {
                    let n = state.polls.fetch_add(1, Ordering::SeqCst);
                    if state.fail {
                        AxumJson(serde_json::json!({"id": "remote-1", "status": "failed", "error_message": "command exited with code 1"}))
                    } else if n >= 1 {
                        AxumJson(serde_json::json!({"id": "remote-1", "status": "completed"}))
                    } else {
                        AxumJson(serde_json::json!({"id": "remote-1", "status": "running"}))
                    }
                }),
            )
            .route(
                "/cowork/runs/:id/events",
                get(|| async {
                    AxumJson(serde_json::json!([
                        {"id": "e2", "run_id": "remote-1", "sequence": 2, "event_type": "stdout", "payload": {"content": "hello from instance"}, "time_created": 0},
                        {"id": "e1", "run_id": "remote-1", "sequence": 1, "event_type": "run_started", "payload": {"run_id": "remote-1"}, "time_created": 0}
                    ]))
                }),
            )
            .route(
                "/cowork/runs/:id/cancel",
                post(|| async { AxumJson(serde_json::json!({"success": true})) }),
            )
            .with_state(state);

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{addr}")
    }

    fn instance_at(url: String) -> OnlineInstance {
        OnlineInstance {
            id: "gi_test".to_string(),
            name: "test-instance".to_string(),
            url,
            user_id: "user_1".to_string(),
            updated_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn execute_run_completes_and_mirrors_events() {
        let pool = test_pool().await;
        insert_run(
            &pool,
            "r1",
            RunStatus::Queued,
            serde_json::json!({"command": "echo hello"}),
        )
        .await;
        assert!(claim_run(&pool, "r1").await.unwrap());
        let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = 'r1'")
            .fetch_one(&pool)
            .await
            .unwrap();

        let url = spawn_mock_instance(false).await;
        let deps = test_deps(pool.clone());
        let outcome = execute_run(
            &deps,
            &test_config(),
            &AllowAllGate,
            &run,
            &instance_at(url),
        )
        .await;

        assert_eq!(outcome, ExecutionOutcome::Completed);
        assert_eq!(run_status(&pool, "r1").await, RunStatus::Completed);

        let (started_at, completed_at): (Option<DateTime<Utc>>, Option<DateTime<Utc>>) =
            sqlx::query_as("SELECT started_at, completed_at FROM runs WHERE id = 'r1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(started_at.is_some() && completed_at.is_some(), "duration is recorded");

        // Events: run_started (executor), mirrored run_started + stdout, run_completed.
        let event_types: Vec<String> = sqlx::query_scalar(
            "SELECT event_type::text FROM events WHERE run_id = 'r1' ORDER BY sequence ASC",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        assert!(event_types.contains(&"stdout".to_string()), "mirrored stdout: {event_types:?}");
        assert_eq!(event_types.last().unwrap(), "run_completed");

        let stdout_payload: String = sqlx::query_scalar(
            "SELECT payload::text FROM events WHERE run_id = 'r1' AND event_type = 'stdout'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(stdout_payload.contains("hello from instance"));

        // Job row tells the same truth.
        let (job_status, result): (String, Option<String>) =
            sqlx::query_as("SELECT status::text, result::text FROM jobs WHERE run_id = 'r1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(job_status, "completed");
        assert!(result.unwrap().contains("remote-1"));
    }

    #[tokio::test]
    async fn execute_run_remote_failure_marks_run_failed() {
        let pool = test_pool().await;
        insert_run(
            &pool,
            "r1",
            RunStatus::Queued,
            serde_json::json!({"command": "exit 1"}),
        )
        .await;
        assert!(claim_run(&pool, "r1").await.unwrap());
        let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = 'r1'")
            .fetch_one(&pool)
            .await
            .unwrap();

        let url = spawn_mock_instance(true).await;
        let deps = test_deps(pool.clone());
        let outcome = execute_run(
            &deps,
            &test_config(),
            &AllowAllGate,
            &run,
            &instance_at(url),
        )
        .await;

        assert_eq!(outcome, ExecutionOutcome::Failed);
        assert_eq!(run_status(&pool, "r1").await, RunStatus::Failed);

        let error_message: Option<String> =
            sqlx::query_scalar("SELECT error_message FROM runs WHERE id = 'r1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(
            error_message.unwrap().contains("command exited with code 1"),
            "the instance's DOUBLE PRECISION error is surfaced"
        );

        let job_status: JobStatus = sqlx::query_scalar("SELECT status FROM jobs WHERE run_id = 'r1'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(job_status, JobStatus::Failed);
    }

    #[tokio::test]
    async fn dispatch_failure_requeues_run() {
        let pool = test_pool().await;
        insert_run(
            &pool,
            "r1",
            RunStatus::Queued,
            serde_json::json!({"command": "echo hi"}),
        )
        .await;
        assert!(claim_run(&pool, "r1").await.unwrap());
        let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = 'r1'")
            .fetch_one(&pool)
            .await
            .unwrap();

        // Nothing listens on this port: connection refused.
        let deps = test_deps(pool.clone());
        let outcome = execute_run(
            &deps,
            &test_config(),
            &AllowAllGate,
            &run,
            &instance_at("http://127.0.0.1:1".to_string()),
        )
        .await;

        assert_eq!(outcome, ExecutionOutcome::Requeued);
        assert_eq!(run_status(&pool, "r1").await, RunStatus::Queued, "run returns to the queue");

        let warnings: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM events WHERE run_id = 'r1' AND event_type = 'warning'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(warnings, 1, "a warning event records why it was requeued");
    }

    #[tokio::test]
    async fn missing_command_fails_honestly() {
        let pool = test_pool().await;
        insert_run(&pool, "r1", RunStatus::Queued, serde_json::json!({})).await;
        assert!(claim_run(&pool, "r1").await.unwrap());
        let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = 'r1'")
            .fetch_one(&pool)
            .await
            .unwrap();

        let deps = test_deps(pool.clone());
        let outcome = execute_run(
            &deps,
            &test_config(),
            &AllowAllGate,
            &run,
            &instance_at("http://127.0.0.1:1".to_string()),
        )
        .await;

        assert_eq!(outcome, ExecutionOutcome::Failed);
        let error_message: Option<String> =
            sqlx::query_scalar("SELECT error_message FROM runs WHERE id = 'r1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(error_message.unwrap().contains("no command"));
    }
}
