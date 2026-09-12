//! Store-level fabric-transport operations over the canonical SQLite store.
//!
//! Every claim, renew, complete, and expiry is a transactional
//! compare-and-swap against the persisted `cowork_jobs` row (A:// lock 2):
//! exclusivity of ownership is decided by SQLite, never by an in-process lock.
//! Eligibility is computed here in fabric transport; the CAS makes the winner
//! single. Lease times are server-authoritative RFC3339 UTC (lock 3).

use std::path::Path;
use std::time::Duration;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use uuid::Uuid;

use crate::transport::{
    ApprovalBinding, CompleteOutcome, ExpiryAction, LeaseGrant, PrincipalRecord,
    TransportError, TransportErrorCode as Code,
};

fn store_err(e: rusqlite::Error) -> TransportError {
    TransportError::new(Code::Store, format!("sqlite: {e}"))
}

/// Open a store connection with a busy timeout so the sweeper, API handlers,
/// and tests can write concurrently against the same DB file.
pub fn open_store(path: &Path) -> Result<Connection, TransportError> {
    let conn = Connection::open(path).map_err(store_err)?;
    conn.busy_timeout(Duration::from_secs(5)).map_err(store_err)?;
    conn.execute_batch("PRAGMA journal_mode=WAL;").map_err(store_err)?;
    Ok(conn)
}

/// Apply the cowork migration DDL needed by the store (V5, V8, V152–V154).
/// Used by tests and one-off tooling; the API applies the full refinery set.
pub fn apply_store_ddl(conn: &mut Connection) -> Result<(), TransportError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS cowork_runs (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
            initiator TEXT NOT NULL, mode TEXT NOT NULL, state TEXT NOT NULL,
            entrypoint TEXT NOT NULL, dag_id TEXT NOT NULL,
            current_job_id TEXT, current_checkpoint_id TEXT, policy_profile TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME, delegator TEXT);
         CREATE TABLE IF NOT EXISTS cowork_jobs (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL, dag_node_id TEXT NOT NULL DEFAULT '',
            job_type TEXT NOT NULL DEFAULT 'task', priority INTEGER NOT NULL DEFAULT 0,
            state TEXT NOT NULL, lease_owner TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 0, timeout_sec INTEGER NOT NULL DEFAULT 0,
            payload TEXT NOT NULL DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, started_at DATETIME, completed_at DATETIME,
            lease_id TEXT, lease_generation INTEGER NOT NULL DEFAULT 0,
            lease_expires_at DATETIME, claimed_at DATETIME,
            required_capabilities TEXT NOT NULL DEFAULT '[]', result TEXT,
            initiator TEXT, delegator TEXT);
         CREATE TABLE IF NOT EXISTS cowork_run_events (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL, event_type TEXT NOT NULL,
            payload TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            initiator TEXT, delegator TEXT, executor TEXT);
         CREATE TABLE IF NOT EXISTS cowork_principals (
            id TEXT PRIMARY KEY, workspace TEXT NOT NULL,
            capabilities TEXT NOT NULL DEFAULT '[]', token_hash TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
         CREATE TABLE IF NOT EXISTS cowork_approval_bindings (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL, job_id TEXT NOT NULL,
            lease_id TEXT NOT NULL, lease_generation INTEGER NOT NULL,
            executor TEXT NOT NULL, capability TEXT NOT NULL, target TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            decided_at DATETIME, decided_by TEXT);",
    )
    .map_err(store_err)
}

// ─── Principals (§8.3–8.4) ───────────────────────────────────────────────────

/// Register a principal; the bearer token is stored only as a SHA-256 hash.
pub fn register_principal(
    conn: &mut Connection,
    id: &str,
    workspace: &str,
    capabilities: &[String],
    token: &str,
) -> Result<(), TransportError> {
    conn.execute(
        "INSERT INTO cowork_principals (id, workspace, capabilities, token_hash, status, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
             workspace = excluded.workspace,
             capabilities = excluded.capabilities,
             token_hash = excluded.token_hash,
             status = 'active',
             updated_at = CURRENT_TIMESTAMP",
        params![
            id,
            workspace,
            serde_json::to_string(capabilities).unwrap(),
            crate::transport::hash_token(token),
        ],
    )
    .map_err(store_err)?;
    Ok(())
}

/// Authenticate a bearer token to a principal identity.
pub fn authenticate_principal(
    conn: &Connection,
    token: &str,
) -> Result<PrincipalRecord, TransportError> {
    let hash = crate::transport::hash_token(token);
    let row = conn
        .query_row(
            "SELECT id, workspace, capabilities, status FROM cowork_principals
             WHERE token_hash = ?1",
            params![hash],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()
        .map_err(store_err)?;

    match row {
        None => Err(TransportError::new(
            Code::AuthenticationFailed,
            "bearer token does not map to any principal",
        )),
        Some((id, workspace, caps, status)) if status == "active" => Ok(PrincipalRecord {
            id,
            workspace,
            capabilities: serde_json::from_str(&caps).unwrap_or_default(),
            status,
        }),
        Some((id, _, _, status)) => Err(TransportError::new(
            Code::PermissionDenied,
            format!("principal {id} is not active (status={status})"),
        )),
    }
}

// ─── Job enqueue helper ─────────────────────────────────────────────────────

/// Insert a queued job row directly (fabric-transport path; skips the Rails DAG
/// mirror, which the API layer maintains separately).
#[allow(clippy::too_many_arguments)]
pub fn enqueue_job(
    conn: &mut Connection,
    run_id: &str,
    job_type: &str,
    payload: serde_json::Value,
    required_capabilities: &[String],
    timeout_sec: i64,
    max_retries: i64,
    initiator: Option<&str>,
    delegator: Option<&str>,
) -> Result<String, TransportError> {
    let job_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO cowork_jobs
            (id, run_id, job_type, state, payload, required_capabilities, timeout_sec,
             max_retries, initiator, delegator)
         VALUES (?1, ?2, ?3, 'queued', ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            job_id,
            run_id,
            job_type,
            payload.to_string(),
            serde_json::to_string(required_capabilities).unwrap(),
            timeout_sec,
            max_retries,
            initiator,
            delegator,
        ],
    )
    .map_err(store_err)?;
    Ok(job_id)
}

// ─── Events (§8.18 attribution triple) ───────────────────────────────────────

fn insert_event(
    conn: &Connection,
    run_id: &str,
    event_type: &str,
    payload: serde_json::Value,
    initiator: Option<&str>,
    delegator: Option<&str>,
    executor: Option<&str>,
) -> Result<(), TransportError> {
    conn.execute(
        "INSERT INTO cowork_run_events (id, run_id, event_type, payload, initiator, delegator, executor)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            Uuid::new_v4().to_string(),
            run_id,
            event_type,
            payload.to_string(),
            initiator,
            delegator,
            executor,
        ],
    )
    .map_err(store_err)?;
    Ok(())
}

struct JobRow {
    id: String,
    run_id: String,
    state: String,
    payload: String,
    _required_capabilities: String,
    lease_id: Option<String>,
    lease_generation: i64,
    lease_expires_at: Option<String>,
    lease_owner: Option<String>,
    retry_count: i64,
    max_retries: i64,
    result: Option<String>,
    initiator: Option<String>,
    delegator: Option<String>,
}

fn load_job(conn: &Connection, job_id: &str) -> Result<Option<JobRow>, TransportError> {
    conn.query_row(
        "SELECT id, run_id, state, payload, required_capabilities, lease_id,
                lease_generation, lease_expires_at, lease_owner, retry_count,
                max_retries, result, initiator, delegator
         FROM cowork_jobs WHERE id = ?1",
        params![job_id],
        |row| {
            Ok(JobRow {
                id: row.get(0)?,
                run_id: row.get(1)?,
                state: row.get(2)?,
                payload: row.get(3)?,
                _required_capabilities: row.get(4)?,
                lease_id: row.get(5)?,
                lease_generation: row.get(6)?,
                lease_expires_at: row.get(7)?,
                lease_owner: row.get(8)?,
                retry_count: row.get(9)?,
                max_retries: row.get(10)?,
                result: row.get(11)?,
                initiator: row.get(12)?,
                delegator: row.get(13)?,
            })
        },
    )
    .optional()
    .map_err(store_err)
}

fn parse_time(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Run attribution: job-level triple falls back to the run row.
struct RunAttribution {
    initiator: Option<String>,
    delegator: Option<String>,
    current_checkpoint_id: Option<String>,
}

fn load_run_attribution(
    conn: &Connection,
    run_id: &str,
) -> Result<RunAttribution, TransportError> {
    conn.query_row(
        "SELECT initiator, delegator, current_checkpoint_id FROM cowork_runs WHERE id = ?1",
        params![run_id],
        |row| {
            Ok(RunAttribution {
                initiator: row.get(0)?,
                delegator: row.get(1)?,
                current_checkpoint_id: row.get(2)?,
            })
        },
    )
    .optional()
    .map_err(store_err)
    .map(|o| {
        o.unwrap_or(RunAttribution {
            initiator: None,
            delegator: None,
            current_checkpoint_id: None,
        })
    })
}

// ─── Claim (§8.10) ───────────────────────────────────────────────────────────

/// Atomically claim a job for an authenticated principal.
///
/// Eligibility (workspace, capabilities, run state) is evaluated here; the
/// actual claim is `UPDATE cowork_jobs ... WHERE id=? AND state='queued'
/// RETURNING ...` inside an immediate transaction, so exactly one concurrent
/// caller wins the row.
pub fn claim_job(
    conn: &mut Connection,
    principal: &PrincipalRecord,
    job_id: Option<&str>,
    lease_ttl: Duration,
) -> Result<LeaseGrant, TransportError> {
    let now = Utc::now();
    let expires = now + lease_ttl;
    let lease_id = format!("lease_{}", Uuid::new_v4());

    // Candidate selection (fabric-transport eligibility).
    let mut candidates: Vec<(String, String, String, String, String)> = Vec::new(); // id, run_id, payload, req_caps, workspace
    {
        let sql = "SELECT j.id, j.run_id, j.payload, j.required_capabilities, r.workspace_id
                   FROM cowork_jobs j JOIN cowork_runs r ON r.id = j.run_id
                   WHERE j.state = 'queued'
                     AND r.state NOT IN ('completed', 'failed', 'cancelled')
                   ORDER BY j.priority DESC, j.created_at ASC";
        let mut stmt = conn.prepare(sql).map_err(store_err)?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(store_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(store_err)?;

        for (id, run_id, payload, req_caps, workspace) in rows {
            if let Some(want) = job_id {
                if id != want {
                    continue;
                }
            }
            if workspace != principal.workspace {
                if job_id == Some(id.as_str()) {
                    return Err(TransportError::new(
                        Code::WorkspaceMismatch,
                        format!(
                            "job {id} is in workspace {workspace}, principal {} is in {}",
                            principal.id, principal.workspace
                        ),
                    ));
                }
                continue;
            }
            let required: Vec<String> =
                serde_json::from_str(&req_caps).unwrap_or_default();
            let missing: Vec<&String> = required
                .iter()
                .filter(|c| !principal.capabilities.contains(c))
                .collect();
            if !missing.is_empty() {
                if job_id == Some(id.as_str()) {
                    return Err(TransportError::new(
                        Code::CapabilityMissing,
                        format!(
                            "principal {} lacks required capabilities: {}",
                            principal.id,
                            missing.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", ")
                        ),
                    ));
                }
                continue;
            }
            candidates.push((id, run_id, payload, req_caps, workspace));
        }
    }

    if candidates.is_empty() {
        return Err(TransportError::new(
            if job_id.is_some() {
                Code::JobAlreadyLeased
            } else {
                Code::NoEligibleWorker
            },
            if job_id.is_some() {
                "job is not claimable (already leased, terminal, or missing)"
            } else {
                "no queued job matches this principal's workspace and capabilities"
            },
        ));
    }

    let (chosen, run_id, payload, req_caps, _workspace) = candidates.remove(0);
    let caps: Vec<String> = serde_json::from_str(&req_caps).unwrap_or_default();

    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(store_err)?;

    // Re-check run state inside the transaction.
    let run_state: Option<String> = tx
        .query_row(
            "SELECT state FROM cowork_runs WHERE id = ?1",
            params![run_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(store_err)?;
    match run_state.as_deref() {
        Some("cancelled") => {
            tx.rollback().map_err(store_err)?;
            return Err(TransportError::new(
                Code::RunCancelled,
                format!("run {run_id} is cancelled"),
            ));
        }
        Some("completed") | Some("failed") | None => {
            tx.rollback().map_err(store_err)?;
            return Err(TransportError::new(
                Code::NoEligibleWorker,
                format!("run {run_id} is not transportable (state={run_state:?})"),
            ));
        }
        _ => {}
    }

    // The persistence-level CAS: exactly one winner.
    let granted: Option<(i64,)> = tx
        .query_row(
            "UPDATE cowork_jobs
             SET state = 'leased',
                 lease_owner = ?1,
                 lease_id = ?2,
                 lease_generation = lease_generation + 1,
                 lease_expires_at = ?3,
                 claimed_at = ?4,
                 started_at = COALESCE(started_at, ?4),
                 updated_at = ?4
             WHERE id = ?5 AND state = 'queued'
             RETURNING lease_generation",
            params![
                principal.id,
                lease_id,
                expires.to_rfc3339(),
                now.to_rfc3339(),
                chosen,
            ],
            |row| Ok((row.get(0)?,)),
        )
        .optional()
        .map_err(store_err)?;

    let generation = match granted {
        Some((g,)) => g,
        None => {
            tx.rollback().map_err(store_err)?;
            return Err(TransportError::new(
                Code::JobAlreadyLeased,
                format!("job {chosen} was claimed by another worker first"),
            ));
        }
    };

    let attr = load_run_attribution(&tx, &run_id)?;
    let initiator = attr.initiator.as_deref();
    let delegator = attr.delegator.as_deref();

    // RUNNING means a worker holds a valid lease (§8.2): the first claim moves
    // the run from queued to running atomically with the lease grant.
    tx.execute(
        "UPDATE cowork_runs SET state = 'running', updated_at = ?1
         WHERE id = ?2 AND state = 'queued'",
        params![now.to_rfc3339(), run_id],
    )
    .map_err(store_err)?;

    tx.execute(
        "UPDATE cowork_runs SET current_job_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![chosen, now.to_rfc3339(), run_id],
    )
    .map_err(store_err)?;

    insert_event(
        &tx,
        &run_id,
        "job.claimed",
        serde_json::json!({
            "job_id": chosen,
            "lease_id": lease_id,
            "lease_generation": generation,
            "lease_expires_at": expires.to_rfc3339(),
            "capabilities": caps,
        }),
        initiator,
        delegator,
        Some(principal.id.as_str()),
    )?;

    tx.commit().map_err(store_err)?;

    Ok(LeaseGrant {
        job_id: chosen.clone(),
        run_id,
        lease_id,
        lease_generation: generation,
        lease_expires_at: expires.to_rfc3339(),
        payload: serde_json::from_str(&payload).unwrap_or(serde_json::Value::Null),
        required_capabilities: caps,
        current_checkpoint_id: attr.current_checkpoint_id,
        initiator: initiator.map(|s| s.to_string()),
        delegator: delegator.map(|s| s.to_string()),
    })
}

// ─── Lease validation shared by heartbeat/renew/complete (§8.11–8.12, 8.16) ──

fn validate_lease(
    conn: &Connection,
    principal: &PrincipalRecord,
    job_id: &str,
    lease_id: &str,
    generation: i64,
) -> Result<JobRow, TransportError> {
    let job = load_job(conn, job_id)?
        .ok_or_else(|| TransportError::new(Code::JobNotFound, format!("job {job_id} not found")))?;

    // Stale generations are rejected before anything else: a worker never
    // decides whether its own lease remains valid (§8.26).
    if job.lease_generation != generation {
        return Err(TransportError::new(
            Code::StaleLeaseGeneration,
            format!(
                "job {job_id} is at lease generation {}, caller presented {generation}",
                job.lease_generation
            ),
        ));
    }
    if job.lease_id.as_deref() != Some(lease_id) {
        return Err(TransportError::new(
            Code::InvalidLease,
            format!("lease_id {lease_id} does not own job {job_id}"),
        ));
    }
    if job.lease_owner.as_deref() != Some(principal.id.as_str()) {
        return Err(TransportError::new(
            Code::PermissionDenied,
            format!(
                "job {job_id} is leased to {:?}, not {}",
                job.lease_owner, principal.id
            ),
        ));
    }
    match job.state.as_str() {
        "leased" | "running" => {}
        "cancelled" => {
            return Err(TransportError::new(
                Code::RunCancelled,
                format!("job {job_id} is cancelled"),
            ))
        }
        _ => {
            return Err(TransportError::new(
                Code::LeaseExpired,
                format!("job {job_id} lease is no longer active (state={})", job.state),
            ))
        }
    }
    if let Some(exp) = job.lease_expires_at.as_deref() {
        if parse_time(exp).map(|e| e < Utc::now()).unwrap_or(true) {
            return Err(TransportError::new(
                Code::LeaseExpired,
                format!("lease on job {job_id} expired at {exp} (server clock)"),
            ));
        }
    }
    Ok(job)
}

/// Heartbeat: proves liveness, records an attributed event; `worker_time` is
/// advisory only — the server clock decides expiry (lock 3, §8.11).
pub fn record_heartbeat(
    conn: &mut Connection,
    principal: &PrincipalRecord,
    job_id: &str,
    lease_id: &str,
    generation: i64,
    worker_time: Option<String>,
) -> Result<(), TransportError> {
    let job = validate_lease(conn, principal, job_id, lease_id, generation)?;
    let attr = load_run_attribution(conn, &job.run_id)?;
    insert_event(
        conn,
        &job.run_id,
        "job.heartbeat",
        serde_json::json!({
            "job_id": job_id,
            "lease_id": lease_id,
            "lease_generation": generation,
            "worker_time": worker_time,
        }),
        attr.initiator.as_deref(),
        attr.delegator.as_deref(),
        Some(principal.id.as_str()),
    )?;
    Ok(())
}

/// Renew a lease before expiration (§8.12). Renewal never resurrects an
/// expired generation — expiry is judged by the server clock at renew time.
pub fn renew_lease(
    conn: &mut Connection,
    principal: &PrincipalRecord,
    job_id: &str,
    lease_id: &str,
    generation: i64,
    lease_ttl: Duration,
) -> Result<String, TransportError> {
    let job = validate_lease(conn, principal, job_id, lease_id, generation)?;
    let expires = (Utc::now() + lease_ttl).to_rfc3339();

    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(store_err)?;
    let updated = tx
        .execute(
            "UPDATE cowork_jobs SET lease_expires_at = ?1, updated_at = ?2
             WHERE id = ?3 AND state IN ('leased','running')
               AND lease_id = ?4 AND lease_generation = ?5 AND lease_owner = ?6",
            params![
                expires,
                Utc::now().to_rfc3339(),
                job_id,
                lease_id,
                generation,
                principal.id,
            ],
        )
        .map_err(store_err)?;
    if updated == 0 {
        tx.rollback().map_err(store_err)?;
        return Err(TransportError::new(
            Code::InvalidLease,
            format!("renewal lost the race on job {job_id}"),
        ));
    }
    let attr = load_run_attribution(&tx, &job.run_id)?;
    insert_event(
        &tx,
        &job.run_id,
        "job.lease_renewed",
        serde_json::json!({
            "job_id": job_id,
            "lease_id": lease_id,
            "lease_generation": generation,
            "lease_expires_at": expires,
        }),
        attr.initiator.as_deref(),
        attr.delegator.as_deref(),
        Some(principal.id.as_str()),
    )?;
    tx.commit().map_err(store_err)?;
    Ok(expires)
}

/// Complete (or fail) a job under the active lease generation (§8.16).
///
/// Validation order: stale generation is rejected even for terminal jobs (the
/// killed worker can never submit a valid completion under an old generation),
/// while the worker that holds the terminal generation gets the canonical
/// existing result back on repeat — exactly-once side effects either way.
#[allow(clippy::too_many_arguments)]
pub fn complete_job(
    conn: &mut Connection,
    principal: &PrincipalRecord,
    job_id: &str,
    lease_id: &str,
    generation: i64,
    success: bool,
    summary: Option<String>,
    outputs: Option<serde_json::Value>,
) -> Result<CompleteOutcome, TransportError> {
    let job = load_job(conn, job_id)?
        .ok_or_else(|| TransportError::new(Code::JobNotFound, format!("job {job_id} not found")))?;

    if job.lease_generation != generation {
        return Err(TransportError::new(
            Code::StaleLeaseGeneration,
            format!(
                "job {job_id} is at lease generation {}, caller presented {generation}",
                job.lease_generation
            ),
        ));
    }

    let terminal = matches!(
        job.state.as_str(),
        "completed" | "failed" | "dead_letter" | "cancelled"
    );
    if terminal {
        let result: serde_json::Value = job
            .result
            .as_deref()
            .and_then(|r| serde_json::from_str(r).ok())
            .unwrap_or(serde_json::Value::Null);
        return Ok(CompleteOutcome::AlreadyCommitted {
            job_state: job.state.clone(),
            result,
        });
    }

    let job = validate_lease(conn, principal, job_id, lease_id, generation)?;
    let now = Utc::now();
    let new_state = if success { "completed" } else { "failed" };
    let result = serde_json::json!({
        "result_id": format!("result_{}", Uuid::new_v4()),
        "run_id": job.run_id,
        "job_id": job_id,
        "status": new_state,
        "summary": summary.unwrap_or_default(),
        "outputs": outputs.unwrap_or(serde_json::json!({})),
        "executor": principal.id,
        "completed_at": now.to_rfc3339(),
    });

    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(store_err)?;

    // Terminal CAS: state, lease identity, generation, and owner must all still
    // match; the lease is released in the same write as the result commit.
    let updated = tx
        .execute(
            "UPDATE cowork_jobs
             SET state = ?1, result = ?2, completed_at = ?3, updated_at = ?3,
                 lease_id = NULL, lease_expires_at = NULL
             WHERE id = ?4 AND state IN ('leased','running')
               AND lease_id = ?5 AND lease_generation = ?6 AND lease_owner = ?7",
            params![
                new_state,
                result.to_string(),
                now.to_rfc3339(),
                job_id,
                lease_id,
                generation,
                principal.id,
            ],
        )
        .map_err(store_err)?;
    if updated == 0 {
        tx.rollback().map_err(store_err)?;
        // Lost a race with the sweeper or another completion: report the
        // canonical outcome of whoever won.
        if let Some(current) = load_job(conn, job_id)? {
            if matches!(
                current.state.as_str(),
                "completed" | "failed" | "dead_letter" | "cancelled"
            ) {
                let result: serde_json::Value = current
                    .result
                    .as_deref()
                    .and_then(|r| serde_json::from_str(r).ok())
                    .unwrap_or(serde_json::Value::Null);
                return Ok(CompleteOutcome::AlreadyCommitted {
                    job_state: current.state.clone(),
                    result,
                });
            }
        }
        return Err(TransportError::new(
            Code::LeaseExpired,
            format!("completion lost the race on job {job_id}"),
        ));
    }

    let attr = load_run_attribution(&tx, &job.run_id)?;
    insert_event(
        &tx,
        &job.run_id,
        if success { "job.completed" } else { "job.failed" },
        serde_json::json!({
            "job_id": job_id,
            "lease_id": lease_id,
            "lease_generation": generation,
            "result_id": result["result_id"],
        }),
        attr.initiator.as_deref(),
        attr.delegator.as_deref(),
        Some(principal.id.as_str()),
    )?;
    insert_event(
        &tx,
        &job.run_id,
        "result.created",
        result.clone(),
        attr.initiator.as_deref(),
        attr.delegator.as_deref(),
        Some(principal.id.as_str()),
    )?;

    // Advance the run when no non-terminal jobs remain (§8.16).
    let remaining: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM cowork_jobs
             WHERE run_id = ?1 AND state NOT IN ('completed','failed','dead_letter','cancelled')",
            params![job.run_id],
            |row| row.get(0),
        )
        .map_err(store_err)?;
    if remaining == 0 {
        let failures: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM cowork_jobs
                 WHERE run_id = ?1 AND state IN ('failed','dead_letter')",
                params![job.run_id],
                |row| row.get(0),
            )
            .map_err(store_err)?;
        let run_state = if failures > 0 { "failed" } else { "completed" };
        tx.execute(
            "UPDATE cowork_runs SET state = ?1, completed_at = ?2, updated_at = ?2 WHERE id = ?3",
            params![run_state, now.to_rfc3339(), job.run_id],
        )
        .map_err(store_err)?;
        insert_event(
            &tx,
            &job.run_id,
            "run.completed",
            serde_json::json!({ "state": run_state }),
            attr.initiator.as_deref(),
            attr.delegator.as_deref(),
            Some(principal.id.as_str()),
        )?;
    }

    tx.commit().map_err(store_err)?;

    Ok(CompleteOutcome::Committed {
        job_state: new_state.to_string(),
        result,
    })
}

// ─── Lease expiry sweeper (§8.13) ────────────────────────────────────────────

/// Expire every lease whose server-authoritative `lease_expires_at` has
/// passed. Recovery policy: requeue (`retry_count+1 <= max_retries`) or
/// dead-letter. Each expiry is itself a CAS so a worker renewing mid-sweep
/// keeps its lease. Returns the actions taken.
pub fn expire_leases(conn: &mut Connection, now: DateTime<Utc>) -> Result<Vec<ExpiryAction>, TransportError> {
    let candidates: Vec<JobRow> = {
        let mut stmt = conn
            .prepare(
                "SELECT id, run_id, state, payload, required_capabilities, lease_id,
                        lease_generation, lease_expires_at, lease_owner, retry_count,
                        max_retries, result, initiator, delegator
                 FROM cowork_jobs
                 WHERE state IN ('leased','running') AND lease_expires_at IS NOT NULL",
            )
            .map_err(store_err)?;
        let rows = stmt
            .query_map([], |row| {
            Ok(JobRow {
                id: row.get(0)?,
                run_id: row.get(1)?,
                state: row.get(2)?,
                payload: row.get(3)?,
                _required_capabilities: row.get(4)?,
                lease_id: row.get(5)?,
                lease_generation: row.get(6)?,
                lease_expires_at: row.get(7)?,
                lease_owner: row.get(8)?,
                retry_count: row.get(9)?,
                max_retries: row.get(10)?,
                result: row.get(11)?,
                initiator: row.get(12)?,
                delegator: row.get(13)?,
            })
        })
        .map_err(store_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(store_err)?;
        rows
    };

    let mut actions = Vec::new();
    for job in candidates {
        let Some(exp) = job.lease_expires_at.as_deref() else {
            continue;
        };
        if !parse_time(exp).map(|e| e < now).unwrap_or(false) {
            continue;
        }

        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(store_err)?;
        // CAS: only expire if the same lease is still un-renewed.
        let updated = tx
            .execute(
                "UPDATE cowork_jobs
                 SET retry_count = retry_count + 1,
                     state = CASE WHEN retry_count + 1 > max_retries
                                  THEN 'dead_letter' ELSE 'queued' END,
                     lease_owner = CASE WHEN retry_count + 1 > max_retries
                                        THEN lease_owner ELSE NULL END,
                     lease_id = NULL,
                     lease_expires_at = NULL,
                     updated_at = ?1
                 WHERE id = ?2 AND state IN ('leased','running')
                   AND lease_id IS ?3 AND lease_expires_at = ?4",
                params![
                    now.to_rfc3339(),
                    job.id,
                    job.lease_id,
                    job.lease_expires_at,
                ],
            )
            .map_err(store_err)?;
        if updated == 0 {
            tx.rollback().map_err(store_err)?;
            continue; // renewed or completed mid-sweep
        }

        let new_retry = job.retry_count + 1;
        let outcome = if new_retry > job.max_retries {
            "dead_letter"
        } else {
            "queued"
        };

        let attr = load_run_attribution(&tx, &job.run_id)?;
        insert_event(
            &tx,
            &job.run_id,
            "job.lease_expired",
            serde_json::json!({
                "job_id": job.id,
                "lease_id": job.lease_id,
                "lease_generation": job.lease_generation,
                "lease_expires_at": job.lease_expires_at,
                "expired_at": now.to_rfc3339(),
            }),
            attr.initiator.as_deref(),
            attr.delegator.as_deref(),
            job.lease_owner.as_deref(),
        )?;

        // §8.13 / §8.14: a lease-bound approval dies with its generation. A
        // replacement worker under a new generation must re-obtain approval.
        let invalidated: Vec<(String, String, String, String)> = {
            let mut stmt = tx
                .prepare(
                    "SELECT id, executor, capability, target FROM cowork_approval_bindings
                     WHERE job_id = ?1 AND lease_generation = ?2
                       AND status IN ('pending','granted')",
                )
                .map_err(store_err)?;
            let rows = stmt
                .query_map(
                    rusqlite::params![job.id, job.lease_generation],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, String>(3)?,
                        ))
                    },
                )
                .map_err(store_err)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(store_err)?;
            rows
        };
        tx.execute(
            "UPDATE cowork_approval_bindings SET status = 'invalidated'
             WHERE job_id = ?1 AND lease_generation = ?2 AND status IN ('pending','granted')",
            params![job.id, job.lease_generation],
        )
        .map_err(store_err)?;
        for (binding_id, executor, capability, target) in invalidated {
            insert_event(
                &tx,
                &job.run_id,
                "approval.invalidated",
                serde_json::json!({
                    "approval_id": binding_id,
                    "capability": capability,
                    "target": target,
                    "lease_generation": job.lease_generation,
                }),
                attr.initiator.as_deref(),
                attr.delegator.as_deref(),
                Some(executor.as_str()),
            )?;
        }
        insert_event(
            &tx,
            &job.run_id,
            if outcome == "dead_letter" {
                "job.dead_lettered"
            } else {
                "job.requeued"
            },
            serde_json::json!({
                "job_id": job.id,
                "retry_count": new_retry,
                "max_retries": job.max_retries,
            }),
            attr.initiator.as_deref(),
            attr.delegator.as_deref(),
            None, // fabric-transport action, not an executor
        )?;
        tx.commit().map_err(store_err)?;

        actions.push(ExpiryAction {
            job_id: job.id,
            run_id: job.run_id,
            lease_id: job.lease_id,
            lease_generation: job.lease_generation,
            executor: job.lease_owner,
            outcome: outcome.to_string(),
            retry_count: new_retry,
        });
    }
    Ok(actions)
}

/// Read back a job's canonical state + result (idempotent result read).
pub fn get_job_view(
    conn: &Connection,
    job_id: &str,
) -> Result<Option<serde_json::Value>, TransportError> {
    let Some(job) = load_job(conn, job_id)? else {
        return Ok(None);
    };
    let result: serde_json::Value = job
        .result
        .as_deref()
        .and_then(|r| serde_json::from_str(r).ok())
        .unwrap_or(serde_json::Value::Null);
    Ok(Some(serde_json::json!({
        "job_id": job.id,
        "run_id": job.run_id,
        "state": job.state,
        "lease_owner": job.lease_owner,
        "lease_id": job.lease_id,
        "lease_generation": job.lease_generation,
        "lease_expires_at": job.lease_expires_at,
        "retry_count": job.retry_count,
        "max_retries": job.max_retries,
        "payload": serde_json::from_str::<serde_json::Value>(&job.payload).unwrap_or(serde_json::Value::Null),
        "result": result,
        "initiator": job.initiator,
        "delegator": job.delegator,
    })))
}

// ─── Approval bindings (§8.14) ───────────────────────────────────────────────

fn load_binding(conn: &Connection, approval_id: &str) -> Result<Option<ApprovalBinding>, TransportError> {
    conn.query_row(
        "SELECT id, run_id, job_id, lease_id, lease_generation, executor,
                capability, target, status, decided_by
         FROM cowork_approval_bindings WHERE id = ?1",
        params![approval_id],
        |row| {
            Ok(ApprovalBinding {
                id: row.get(0)?,
                run_id: row.get(1)?,
                job_id: row.get(2)?,
                lease_id: row.get(3)?,
                lease_generation: row.get(4)?,
                executor: row.get(5)?,
                capability: row.get(6)?,
                target: row.get(7)?,
                status: row.get(8)?,
                decided_by: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(store_err)
}

/// Request an approval for a protected action under the caller's current
/// lease. Idempotent per (job, capability, target, generation): an existing
/// pending/granted binding for the same scope is returned.
pub fn request_approval(
    conn: &mut Connection,
    principal: &PrincipalRecord,
    job_id: &str,
    lease_id: &str,
    generation: i64,
    capability: &str,
    target: &str,
) -> Result<ApprovalBinding, TransportError> {
    let job = validate_lease(conn, principal, job_id, lease_id, generation)?;

    if let Some(existing) = conn
        .query_row(
            "SELECT id FROM cowork_approval_bindings
             WHERE job_id = ?1 AND capability = ?2 AND target = ?3
               AND lease_generation = ?4 AND status IN ('pending','granted')
             ORDER BY created_at DESC LIMIT 1",
            params![job_id, capability, target, generation],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(store_err)?
    {
        return load_binding(conn, &existing)?
            .ok_or_else(|| TransportError::new(Code::Store, "binding vanished"));
    }

    let id = format!("appr_{}", Uuid::new_v4());
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(store_err)?;
    tx.execute(
        "INSERT INTO cowork_approval_bindings
            (id, run_id, job_id, lease_id, lease_generation, executor, capability, target, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending')",
        params![
            id,
            job.run_id,
            job_id,
            lease_id,
            generation,
            principal.id,
            capability,
            target,
        ],
    )
    .map_err(store_err)?;
    let attr = load_run_attribution(&tx, &job.run_id)?;
    insert_event(
        &tx,
        &job.run_id,
        "approval.requested",
        serde_json::json!({
            "approval_id": id,
            "job_id": job_id,
            "capability": capability,
            "target": target,
            "lease_generation": generation,
        }),
        attr.initiator.as_deref(),
        attr.delegator.as_deref(),
        Some(principal.id.as_str()),
    )?;
    tx.commit().map_err(store_err)?;

    load_binding(conn, &id)?
        .ok_or_else(|| TransportError::new(Code::Store, "binding vanished after insert"))
}

/// Human decision on a pending approval (§8.22 approval.granted/denied).
pub fn decide_approval(
    conn: &mut Connection,
    approval_id: &str,
    grant: bool,
    decided_by: &str,
) -> Result<ApprovalBinding, TransportError> {
    let binding = load_binding(conn, approval_id)?
        .ok_or_else(|| TransportError::new(Code::JobNotFound, format!("approval {approval_id} not found")))?;
    match binding.status.as_str() {
        "granted" if grant => return Ok(binding),
        "denied" if !grant => return Ok(binding),
        "pending" => {}
        other => {
            return Err(TransportError::new(
                Code::ApprovalInvalid,
                format!("approval {approval_id} is {other}, not pending"),
            ))
        }
    }

    let new_status = if grant { "granted" } else { "denied" };
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(store_err)?;
    tx.execute(
        "UPDATE cowork_approval_bindings SET status = ?1, decided_at = ?2, decided_by = ?3
         WHERE id = ?4 AND status = 'pending'",
        params![new_status, Utc::now().to_rfc3339(), decided_by, approval_id],
    )
    .map_err(store_err)?;
    let attr = load_run_attribution(&tx, &binding.run_id)?;
    insert_event(
        &tx,
        &binding.run_id,
        if grant { "approval.granted" } else { "approval.denied" },
        serde_json::json!({
            "approval_id": approval_id,
            "capability": binding.capability,
            "target": binding.target,
            "lease_generation": binding.lease_generation,
            "decided_by": decided_by,
        }),
        attr.initiator.as_deref(),
        attr.delegator.as_deref(),
        Some(binding.executor.as_str()),
    )?;
    tx.commit().map_err(store_err)?;

    load_binding(conn, approval_id)?
        .ok_or_else(|| TransportError::new(Code::Store, "binding vanished after decision"))
}

/// Check whether a protected action may proceed under the caller's current
/// lease (§8.14). Stale-generation or invalidated approvals are rejected so
/// approvals can never be replayed across reassignment.
pub fn check_approval(
    conn: &mut Connection,
    principal: &PrincipalRecord,
    job_id: &str,
    lease_id: &str,
    generation: i64,
    capability: &str,
    target: &str,
) -> Result<ApprovalBinding, TransportError> {
    let job = validate_lease(conn, principal, job_id, lease_id, generation)?;

    let latest = conn
        .query_row(
            "SELECT id FROM cowork_approval_bindings
             WHERE job_id = ?1 AND capability = ?2 AND target = ?3
             ORDER BY created_at DESC, rowid DESC LIMIT 1",
            params![job_id, capability, target],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(store_err)?;

    let Some(binding_id) = latest else {
        return Err(TransportError::new(
            Code::ApprovalRequired,
            format!("no approval on file for {capability}/{target} on job {job_id}"),
        ));
    };
    let binding = load_binding(conn, &binding_id)?
        .ok_or_else(|| TransportError::new(Code::Store, "binding vanished"))?;

    if binding.lease_generation != job.lease_generation {
        return Err(TransportError::new(
            Code::ApprovalInvalid,
            format!(
                "approval {} is bound to lease generation {}, current is {}",
                binding.id, binding.lease_generation, job.lease_generation
            ),
        ));
    }
    match binding.status.as_str() {
        "granted" => Ok(binding),
        "pending" => Err(TransportError::new(
            Code::ApprovalRequired,
            format!("approval {} is still pending for {capability}/{target}", binding.id),
        )),
        "denied" => Err(TransportError::new(
            Code::ApprovalRequired,
            format!("approval {} was denied; a new approval must be obtained", binding.id),
        )),
        other => Err(TransportError::new(
            Code::ApprovalInvalid,
            format!("approval {} is {other} and cannot be reused", binding.id),
        )),
    }
}

/// Read an approval binding (worker polling for the human decision).
pub fn get_approval(
    conn: &Connection,
    approval_id: &str,
) -> Result<Option<ApprovalBinding>, TransportError> {
    load_binding(conn, approval_id)
}
