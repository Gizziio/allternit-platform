//! A:// fabric-transport conformance test — the §8.24 adversarial two-worker proof.
//!
//! Scenario: worker A claims lease generation 1, checkpoints mid-job, and dies
//! (heartbeats stop). The sweeper expires the lease; the job requeues. Worker B
//! claims generation 2, replays from A's last committed checkpoint, and
//! completes. A's late completion under generation 1 is rejected as a stale
//! generation; the result commits exactly once; the event ledger preserves the
//! initiator/delegator/executor triple across both lease generations.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use allternit_cowork_runtime::{
    sqlite_store, CompleteOutcome, CoworkEvent, CreateJobSpec, CreateRunSpec, TransportErrorCode,
    JobState, LeaseGrant, RailsClient, RunManager, RunManagerConfig, RunState,
};

const WORKSPACE: &str = "ws-allternit";
const INITIATOR: &str = "a://workspace/allternit/user/joe";
const DELEGATOR: &str = "a://workspace/allternit/principal/al";
const WORKER_A: &str = "a://workspace/allternit/bot/worker-a";
const WORKER_B: &str = "a://workspace/allternit/bot/worker-b";
const SHELL_CAPS: &[&str] = &["shell.exec"];

/// Mock Rails client — the fabric-transport store does not need a Rails backend.
#[derive(Default, Clone)]
struct MockRailsClient {
    inner: Arc<Mutex<Vec<CoworkEvent>>>,
}

#[async_trait::async_trait]
impl RailsClient for MockRailsClient {
    async fn create_dag(
        &self,
        _run_id: allternit_cowork_runtime::RunId,
        _spec: &CreateRunSpec,
    ) -> anyhow::Result<String> {
        Ok("dag-transport-test".to_string())
    }
    async fn create_node(
        &self,
        _dag_id: &str,
        job_id: allternit_cowork_runtime::JobId,
        _spec: &CreateJobSpec,
    ) -> anyhow::Result<String> {
        Ok(format!("node-{job_id}"))
    }
    async fn update_run_state(&self, _d: &str, _s: RunState) -> anyhow::Result<()> {
        Ok(())
    }
    async fn update_job_state(&self, _n: &str, _s: JobState) -> anyhow::Result<()> {
        Ok(())
    }
    async fn request_lease(&self, _r: &str, _o: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
    async fn release_lease(&self, _r: &str, _o: &str) -> anyhow::Result<()> {
        Ok(())
    }
    async fn append_event(&self, event: &CoworkEvent) -> anyhow::Result<()> {
        self.inner.lock().unwrap().push(event.clone());
        Ok(())
    }
}

struct Fixture {
    _tmp: tempfile::TempDir,
    db_path: std::path::PathBuf,
    manager: Arc<RunManager>,
    run_id: String,
    job_id: String,
}

fn open(db_path: &std::path::Path) -> rusqlite::Connection {
    sqlite_store::open_store(db_path).expect("open store")
}

fn event_rows(conn: &rusqlite::Connection, run_id: &str) -> Vec<(String, String, String, String)> {
    // (event_type, initiator, delegator, executor) in commit order.
    conn.prepare(
        "SELECT event_type, COALESCE(initiator,''), COALESCE(delegator,''), COALESCE(executor,'')
         FROM cowork_run_events WHERE run_id = ?1 ORDER BY rowid ASC",
    )
    .unwrap()
    .query_map(rusqlite::params![run_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    })
    .unwrap()
    .collect::<Result<Vec<_>, _>>()
    .unwrap()
}

fn job_state(conn: &rusqlite::Connection, job_id: &str) -> String {
    conn.query_row(
        "SELECT state FROM cowork_jobs WHERE id = ?1",
        rusqlite::params![job_id],
        |row| row.get(0),
    )
    .unwrap()
}

async fn setup() -> Fixture {
    setup_with_payload(serde_json::json!({
        "steps": ["echo step-0", "echo step-1", "echo step-2"],
        "checkpoint_every": 1,
    }))
    .await
}

async fn setup_with_payload(payload: serde_json::Value) -> Fixture {
    let tmp = tempfile::tempdir().unwrap();
    let db_path = tmp.path().join("transport.db");
    {
        let mut conn = open(&db_path);
        sqlite_store::apply_store_ddl(&mut conn).unwrap();
        sqlite_store::register_principal(&mut conn, WORKER_A, WORKSPACE, &caps(), "token-a")
            .unwrap();
        sqlite_store::register_principal(&mut conn, WORKER_B, WORKSPACE, &caps(), "token-b")
            .unwrap();
        // A principal without shell.exec — must be filtered by eligibility.
        sqlite_store::register_principal(&mut conn, "a://bot/no-shell", WORKSPACE, &[], "token-c")
            .unwrap();

        let run_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO cowork_runs
                (id, tenant_id, workspace_id, initiator, delegator, mode, state,
                 entrypoint, dag_id, policy_profile)
             VALUES (?1, 'tenant-1', ?2, ?3, ?4, 'cowork', 'running', 'proof-slice', 'dag-x', 'default')",
            rusqlite::params![run_id, WORKSPACE, INITIATOR, DELEGATOR],
        )
        .unwrap();
        let job_id = sqlite_store::enqueue_job(
            &mut conn,
            &run_id,
            "shell_steps",
            payload,
            &["shell.exec".to_string()],
            60,
            2,
            Some(INITIATOR),
            Some(DELEGATOR),
        )
        .unwrap();
        drop(conn);

        let config = RunManagerConfig {
            data_dir: tmp.path().join("runtime"),
            rails_base_url: "http://127.0.0.1:9".to_string(), // unroutable: local-only checkpoints
            attachment_timeout_secs: 300,
            lease_duration_secs: 2,
            max_checkpoint_age_hours: 24,
            store_path: Some(db_path.clone()),
            lease_sweep_interval_secs: 1,
        };
        let (manager, _events) =
            RunManager::new(config, Arc::new(MockRailsClient::default()))
                .await
                .unwrap();

        Fixture {
            _tmp: tmp,
            db_path,
            manager: Arc::new(manager),
            run_id,
            job_id,
        }
    }
}

fn caps() -> Vec<String> {
    SHELL_CAPS.iter().map(|s| s.to_string()).collect()
}

fn auth(conn: &rusqlite::Connection, token: &str) -> allternit_cowork_runtime::PrincipalRecord {
    sqlite_store::authenticate_principal(conn, token).expect("authenticate")
}

/// Adversarial §8.24 proof: A claims gen 1, dies, B claims gen 2, A's stale
/// completion is rejected, exactly-once result, full attribution triple.
#[tokio::test]
async fn test_adversarial_two_worker_failover() {
    let fx = setup().await;
    let lease_ttl = Duration::from_secs(2);
    let mut conn = open(&fx.db_path);

    // Eligibility: a principal without shell.exec can never claim this job
    // (checked while the job is still queued — a leased job is simply
    // unavailable to everyone else, whatever their capabilities).
    let no_shell = auth(&conn, "token-c");
    let ineligible = sqlite_store::claim_job(&mut conn, &no_shell, Some(&fx.job_id), lease_ttl)
        .expect_err("missing capability must be rejected");
    assert_eq!(ineligible.code, TransportErrorCode::CapabilityMissing);

    // ── 6–7. Worker A authenticates and claims lease generation 1 ──────────
    let a = auth(&conn, "token-a");
    let lease_a: LeaseGrant = sqlite_store::claim_job(&mut conn, &a, Some(&fx.job_id), lease_ttl)
        .expect("worker A claims");
    assert_eq!(lease_a.lease_generation, 1);
    assert!(lease_a.lease_id.starts_with("lease_"));
    assert_eq!(job_state(&conn, &fx.job_id), "leased");
    assert_eq!(lease_a.initiator.as_deref(), Some(INITIATOR));
    assert_eq!(lease_a.delegator.as_deref(), Some(DELEGATOR));

    // Concurrent conflict: B cannot take an already-leased job.
    let b = auth(&conn, "token-b");
    let conflict = sqlite_store::claim_job(&mut conn, &b, Some(&fx.job_id), lease_ttl)
        .expect_err("B must lose the claim race");
    assert_eq!(conflict.code, TransportErrorCode::JobAlreadyLeased);

    // ── 8. A begins execution: heartbeat, renew, then a committed checkpoint ──
    sqlite_store::record_heartbeat(
        &mut conn,
        &a,
        &fx.job_id,
        &lease_a.lease_id,
        lease_a.lease_generation,
        Some("2026-09-12T00:00:00Z".to_string()), // advisory only
    )
    .expect("heartbeat");
    let wrong_gen = sqlite_store::record_heartbeat(
        &mut conn,
        &a,
        &fx.job_id,
        &lease_a.lease_id,
        99,
        None,
    )
    .expect_err("wrong generation must be rejected");
    assert_eq!(wrong_gen.code, TransportErrorCode::StaleLeaseGeneration);

    let new_expiry = sqlite_store::renew_lease(
        &mut conn,
        &a,
        &fx.job_id,
        &lease_a.lease_id,
        lease_a.lease_generation,
        lease_ttl,
    )
    .expect("renew");
    assert!(new_expiry > lease_a.lease_expires_at);

    // A executes step 0 and commits a checkpoint (portable data, lock 3)
    // through the runtime's own checkpoint manager.
    let run_id = allternit_cowork_runtime::RunId(uuid::Uuid::parse_str(&fx.run_id).unwrap());
    let cp = fx
        .manager
        .checkpoint(
            run_id,
            None,
            0,
            serde_json::json!({ "completed_steps": 1, "outputs": ["step-0 done"] }),
        )
        .await
        .expect("checkpoint");
    conn.execute(
        "UPDATE cowork_runs SET current_checkpoint_id = ?1 WHERE id = ?2",
        rusqlite::params![cp.id, fx.run_id],
    )
    .unwrap();
    drop(conn);

    // ── 13–15. A is SIGKILLed: heartbeats stop, lease generation 1 expires ──
    // (No more heartbeats from A. The RunManager sweeper — a real background
    // task on the store — must expire the lease within a few ticks.)
    let deadline = std::time::Instant::now() + Duration::from_secs(20);
    loop {
        let conn = open(&fx.db_path);
        if job_state(&conn, &fx.job_id) == "queued" {
            let (retry, lease_id): (i64, Option<String>) = conn
                .query_row(
                    "SELECT retry_count, lease_id FROM cowork_jobs WHERE id = ?1",
                    rusqlite::params![fx.job_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();
            assert_eq!(retry, 1, "requeue increments retry_count");
            assert!(lease_id.is_none(), "expired lease is cleared");
            break;
        }
        assert!(
            std::time::Instant::now() < deadline,
            "sweeper never requeued the job"
        );
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    // Ghost heartbeats from A are dead on arrival.
    let mut conn = open(&fx.db_path);
    let ghost_hb = sqlite_store::record_heartbeat(
        &mut conn,
        &a,
        &fx.job_id,
        &lease_a.lease_id,
        lease_a.lease_generation,
        None,
    )
    .expect_err("ghost heartbeat must be rejected");
    assert!(matches!(
        ghost_hb.code,
        TransportErrorCode::InvalidLease | TransportErrorCode::LeaseExpired
    ));

    // ── 18–19. Worker B authenticates and claims lease generation 2 ─────────
    let lease_b = sqlite_store::claim_job(&mut conn, &b, Some(&fx.job_id), lease_ttl)
        .expect("worker B claims after requeue");
    assert_eq!(lease_b.lease_generation, 2, "ownership change bumps generation");
    assert_ne!(lease_b.lease_id, lease_a.lease_id);

    // ── Recovery (lock 3): B's grant carries A's last committed checkpoint ──
    assert_eq!(
        lease_b.current_checkpoint_id.as_deref(),
        Some(cp.id.as_str()),
        "B must replay from A's last committed checkpoint"
    );
    let latest_cps = fx.manager.list_checkpoints(run_id).await.unwrap();
    let latest = latest_cps.iter().max_by_key(|c| c.step_index).unwrap();
    let completed_steps = latest.cursor_state["completed_steps"].as_i64().unwrap();
    assert_eq!(completed_steps, 1, "checkpoint data is portable across generations");

    // ── The §8.24 assertion: A cannot complete under generation 1 ──────────
    let stale = sqlite_store::complete_job(
        &mut conn,
        &a,
        &fx.job_id,
        &lease_a.lease_id,
        lease_a.lease_generation, // generation 1 — stale
        true,
        Some("A finished late".to_string()),
        None,
    )
    .expect_err("killed worker's completion must be rejected");
    assert_eq!(
        stale.code,
        TransportErrorCode::StaleLeaseGeneration,
        "late completion under an old generation is A_STALE_LEASE_GENERATION"
    );
    assert_eq!(job_state(&conn, &fx.job_id), "leased", "rejection must not disturb B's lease");

    // A renewal under generation 1 is equally dead.
    let stale_renew = sqlite_store::renew_lease(
        &mut conn,
        &a,
        &fx.job_id,
        &lease_a.lease_id,
        1,
        lease_ttl,
    )
    .expect_err("stale renew must be rejected");
    assert_eq!(stale_renew.code, TransportErrorCode::StaleLeaseGeneration);

    // ── 21–22. B replays the remaining steps and completes — exactly once ──
    let outcome = sqlite_store::complete_job(
        &mut conn,
        &b,
        &fx.job_id,
        &lease_b.lease_id,
        lease_b.lease_generation,
        true,
        Some("replayed from checkpoint, steps 1-2 done".to_string()),
        Some(serde_json::json!({ "steps_replayed": 2 })),
    )
    .expect("B completes");
    let (committed_state, result_id): (String, String) = match outcome {
        CompleteOutcome::Committed { job_state, result } => {
            assert_eq!(job_state, "completed");
            (job_state, result["result_id"].as_str().unwrap().to_string())
        }
        CompleteOutcome::AlreadyCommitted { .. } => panic!("first completion must commit"),
    };

    // Repeat completion (B, correct generation) returns the canonical result.
    let dup = sqlite_store::complete_job(
        &mut conn,
        &b,
        &fx.job_id,
        &lease_b.lease_id,
        lease_b.lease_generation,
        true,
        Some("duplicate".to_string()),
        None,
    )
    .expect("duplicate completion is idempotent");
    match dup {
        CompleteOutcome::AlreadyCommitted { job_state, result } => {
            assert_eq!(job_state, committed_state);
            assert_eq!(
                result["result_id"].as_str().unwrap(),
                result_id,
                "exactly-once: canonical result is returned, no new side effects"
            );
        }
        CompleteOutcome::Committed { .. } => panic!("duplicate completion must not re-commit"),
    }

    // Run advanced to its terminal state; job has no active lease left.
    let run_state: String = conn
        .query_row(
            "SELECT state FROM cowork_runs WHERE id = ?1",
            rusqlite::params![fx.run_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(run_state, "completed");
    assert_eq!(job_state(&conn, &fx.job_id), "completed");

    // ── 25. Ledger attribution: initiator=user, delegator=Al, executor=A→B ──
    let rows = event_rows(&conn, &fx.run_id);
    let claimed_a = rows
        .iter()
        .filter(|r| r.0 == "job.claimed" && r.3 == WORKER_A)
        .count();
    let claimed_b = rows
        .iter()
        .filter(|r| r.0 == "job.claimed" && r.3 == WORKER_B)
        .count();
    assert_eq!(claimed_a, 1, "exactly one claim event for A");
    assert_eq!(claimed_b, 1, "exactly one claim event for B");

    for (etype, initiator, delegator, executor) in &rows {
        // Every transport event carries the full triple context.
        assert_eq!(initiator, INITIATOR, "{etype}: initiator attribution");
        assert_eq!(delegator, DELEGATOR, "{etype}: delegator attribution");
        match etype.as_str() {
            "job.claimed" | "job.heartbeat" | "job.lease_renewed" | "job.completed"
            | "result.created" | "run.completed" => {
                assert!(!executor.is_empty(), "{etype}: executor attribution");
            }
            "job.lease_expired" => assert_eq!(executor, WORKER_A),
            "job.requeued" => assert!(executor.is_empty(), "requeue is a fabric-transport action"),
            _ => {}
        }
    }

    assert_eq!(
        rows.iter().filter(|r| r.0 == "result.created").count(),
        1,
        "exactly-once result in the ledger"
    );
    assert_eq!(rows.iter().filter(|r| r.0 == "job.completed").count(), 1);
    assert!(rows.iter().any(|r| r.0 == "run.completed"));
}

/// Dead-letter: recovery policy exhausts after max_retries. Each expiry
/// requeues the job; a new lease must be claimed (and die) to expire again.
#[tokio::test]
async fn test_lease_exhaustion_dead_letters() {
    let fx = setup().await;

    // max_retries = 2: three claim-and-die cycles → dead_letter.
    let deadline = std::time::Instant::now() + Duration::from_secs(40);
    loop {
        let state = {
            let mut conn = open(&fx.db_path);
            if job_state(&conn, &fx.job_id) == "queued" {
                let a = auth(&conn, "token-a");
                sqlite_store::claim_job(
                    &mut conn,
                    &a,
                    Some(&fx.job_id),
                    Duration::from_secs(1),
                )
                .expect("re-claim between deaths");
            }
            job_state(&conn, &fx.job_id)
        };
        if state == "dead_letter" {
            break;
        }
        assert_ne!(state, "completed");
        assert!(
            std::time::Instant::now() < deadline,
            "job never dead-lettered (state={state})"
        );
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    let conn = open(&fx.db_path);
    let rows = event_rows(&conn, &fx.run_id);
    assert_eq!(rows.iter().filter(|r| r.0 == "job.lease_expired").count(), 3);
    assert_eq!(rows.iter().filter(|r| r.0 == "job.requeued").count(), 2);
    assert_eq!(rows.iter().filter(|r| r.0 == "job.dead_lettered").count(), 1);
}

/// Concurrent claims: persistence-level CAS gives exactly one winner.
#[test]
fn test_concurrent_claims_single_winner() {
    let tmp = tempfile::tempdir().unwrap();
    let db_path = tmp.path().join("cc.db");
    {
        let mut conn = open(&db_path);
        sqlite_store::apply_store_ddl(&mut conn).unwrap();
        sqlite_store::register_principal(&mut conn, "w", WORKSPACE, &["shell.exec".to_string()], "t")
            .unwrap();
        conn.execute(
            "INSERT INTO cowork_runs
                (id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id, policy_profile)
             VALUES ('r1', 't', ?1, ?2, 'cowork', 'running', 'x', 'd', 'default')",
            rusqlite::params![WORKSPACE, INITIATOR],
        )
        .unwrap();
    }
    let job_id = {
        let mut conn = open(&db_path);
        sqlite_store::enqueue_job(
            &mut conn,
            "r1",
            "shell_steps",
            serde_json::json!({"steps": ["echo hi"]}),
            &["shell.exec".to_string()],
            60,
            0,
            Some(INITIATOR),
            Some(DELEGATOR),
        )
        .unwrap()
    };

    let winners: Arc<Mutex<usize>> = Arc::new(Mutex::new(0));
    let mut handles = Vec::new();
    for _ in 0..8 {
        let db_path = db_path.clone();
        let job_id = job_id.clone();
        let winners = winners.clone();
        handles.push(std::thread::spawn(move || {
            let mut conn = open(&db_path);
            let p = auth(&conn, "t");
            match sqlite_store::claim_job(&mut conn, &p, Some(&job_id), Duration::from_secs(60)) {
                Ok(_) => *winners.lock().unwrap() += 1,
                Err(e) => assert_eq!(e.code, TransportErrorCode::JobAlreadyLeased),
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    assert_eq!(*winners.lock().unwrap(), 1, "exactly one concurrent winner");
}

const PROTECTED_CAPABILITY: &str = "connector.bank.payment.submit";
const PROTECTED_TARGET: &str = "payment/123";

async fn wait_until_queued(db_path: &std::path::Path, job_id: &str) {
    // tokio::time::sleep (not std::thread::sleep): the test runtime is
    // single-threaded and must yield for the sweeper task to run.
    let deadline = std::time::Instant::now() + Duration::from_secs(20);
    loop {
        {
            let conn = open(db_path);
            if job_state(&conn, job_id) == "queued" {
                return;
            }
        }
        assert!(std::time::Instant::now() < deadline, "sweeper never requeued");
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

/// The FULL §8.24 proof-of-protocol sequence, including the approval steps:
/// protected action → approval request → user grants → execution resumes →
/// worker killed → approval bound to generation 1 invalidated → the
/// generation-2 worker must re-obtain approval → completes exactly once with
/// correct attribution.
#[tokio::test]
async fn test_full_824_sequence_with_approval() {
    let fx = setup_with_payload(serde_json::json!({
        "steps": ["echo step-0", "echo pay", "echo step-2"],
        "checkpoint_every": 1,
        "protected": { "step": 1, "capability": PROTECTED_CAPABILITY, "target": PROTECTED_TARGET },
    }))
    .await;
    let lease_ttl = Duration::from_secs(2);
    let mut conn = open(&fx.db_path);
    let a = auth(&conn, "token-a");
    let b = auth(&conn, "token-b");
    let run_id_uuid =
        allternit_cowork_runtime::RunId(uuid::Uuid::parse_str(&fx.run_id).unwrap());

    // 5–7. A authenticates, claims lease generation 1, begins execution.
    let lease_a = sqlite_store::claim_job(&mut conn, &a, Some(&fx.job_id), lease_ttl)
        .expect("A claims gen 1");
    assert_eq!(lease_a.lease_generation, 1);

    // 8. A executes step 0 and checkpoints.
    let cp0 = fx
        .manager
        .checkpoint(run_id_uuid, None, 0, serde_json::json!({ "completed_steps": 1 }))
        .await
        .unwrap();
    conn.execute(
        "UPDATE cowork_runs SET current_checkpoint_id = ?1 WHERE id = ?2",
        rusqlite::params![cp0.id, fx.run_id],
    )
    .unwrap();

    // 9–10. Step 1 is a protected action: no approval on file → required.
    let required = sqlite_store::check_approval(
        &mut conn, &a, &fx.job_id, &lease_a.lease_id, 1,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect_err("protected action without approval");
    assert_eq!(required.code, TransportErrorCode::ApprovalRequired);

    let binding1 = sqlite_store::request_approval(
        &mut conn, &a, &fx.job_id, &lease_a.lease_id, 1,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect("A requests approval");
    assert_eq!(binding1.status, "pending");
    assert_eq!(binding1.lease_generation, 1);
    assert_eq!(binding1.executor, WORKER_A);

    // Pending approval still blocks execution.
    let pending = sqlite_store::check_approval(
        &mut conn, &a, &fx.job_id, &lease_a.lease_id, 1,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect_err("pending approval does not authorize");
    assert_eq!(pending.code, TransportErrorCode::ApprovalRequired);

    // 11. The user grants (approval bound to generation 1).
    let granted1 = sqlite_store::decide_approval(&mut conn, &binding1.id, true, INITIATOR)
        .expect("user grants");
    assert_eq!(granted1.status, "granted");
    sqlite_store::check_approval(
        &mut conn, &a, &fx.job_id, &lease_a.lease_id, 1,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect("granted approval authorizes");

    // 12. Execution resumes; A runs the protected step and checkpoints.
    let cp1 = fx
        .manager
        .checkpoint(run_id_uuid, None, 1, serde_json::json!({ "completed_steps": 2, "paid": true }))
        .await
        .unwrap();
    conn.execute(
        "UPDATE cowork_runs SET current_checkpoint_id = ?1 WHERE id = ?2",
        rusqlite::params![cp1.id, fx.run_id],
    )
    .unwrap();
    drop(conn);

    // 13–15. A is killed before completion. Heartbeats stop; gen 1 expires.
    wait_until_queued(&fx.db_path, &fx.job_id).await;
    let mut conn = open(&fx.db_path);

    // 16. The approval bound to generation 1 is invalidated by expiry.
    let b1 = sqlite_store::get_approval(&conn, &binding1.id).unwrap().unwrap();
    assert_eq!(b1.status, "invalidated", "lease expiry invalidates bound approvals");

    // The invalidated approval must not authorize anything, even from A.
    let stale_check = sqlite_store::check_approval(
        &mut conn, &a, &fx.job_id, &lease_a.lease_id, 1,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect_err("invalidated approval cannot authorize");
    // The ghost's lease is dead (job requeued, lease cleared) — anything it
    // presents is invalid before approval state even matters.
    assert!(matches!(
        stale_check.code,
        TransportErrorCode::ApprovalInvalid
            | TransportErrorCode::LeaseExpired
            | TransportErrorCode::StaleLeaseGeneration
            | TransportErrorCode::InvalidLease
    ));

    // 18–19. B authenticates and claims lease generation 2.
    let lease_b = sqlite_store::claim_job(&mut conn, &b, Some(&fx.job_id), lease_ttl)
        .expect("B claims gen 2");
    assert_eq!(lease_b.lease_generation, 2);
    assert_eq!(
        lease_b.current_checkpoint_id.as_deref(),
        Some(cp1.id.as_str()),
        "B replays from A's last committed checkpoint"
    );

    // 20. The protected action is re-evaluated: the gen-1 approval is invalid.
    let invalid = sqlite_store::check_approval(
        &mut conn, &b, &fx.job_id, &lease_b.lease_id, 2,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect_err("stale-generation approval must be rejected");
    assert_eq!(invalid.code, TransportErrorCode::ApprovalInvalid);

    // B re-obtains approval under generation 2; the user grants again.
    let binding2 = sqlite_store::request_approval(
        &mut conn, &b, &fx.job_id, &lease_b.lease_id, 2,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect("B re-requests approval");
    assert_eq!(binding2.lease_generation, 2);
    assert_ne!(binding2.id, binding1.id);
    sqlite_store::decide_approval(&mut conn, &binding2.id, true, INITIATOR).unwrap();
    sqlite_store::check_approval(
        &mut conn, &b, &fx.job_id, &lease_b.lease_id, 2,
        PROTECTED_CAPABILITY, PROTECTED_TARGET,
    )
    .expect("gen-2 approval authorizes");

    // The killed worker still cannot complete under generation 1.
    let stale = sqlite_store::complete_job(
        &mut conn, &a, &fx.job_id, &lease_a.lease_id, 1,
        true, Some("A finished late".to_string()), None,
    )
    .expect_err("killed worker's completion rejected");
    assert_eq!(stale.code, TransportErrorCode::StaleLeaseGeneration);

    // 21–23. B completes; the result commits exactly once; the run completes.
    let outcome = sqlite_store::complete_job(
        &mut conn, &b, &fx.job_id, &lease_b.lease_id, 2,
        true, Some("re-approval under gen 2, steps replayed".to_string()),
        Some(serde_json::json!({ "paid": true, "reapproved": true })),
    )
    .expect("B completes");
    let result_id = match outcome {
        CompleteOutcome::Committed { result, .. } => {
            result["result_id"].as_str().unwrap().to_string()
        }
        CompleteOutcome::AlreadyCommitted { .. } => panic!("first completion must commit"),
    };
    let dup = sqlite_store::complete_job(
        &mut conn, &b, &fx.job_id, &lease_b.lease_id, 2,
        true, Some("duplicate".to_string()), None,
    )
    .unwrap();
    match dup {
        CompleteOutcome::AlreadyCommitted { result, .. } => {
            assert_eq!(result["result_id"].as_str().unwrap(), result_id);
        }
        _ => panic!("duplicate must return the canonical result"),
    }

    // 25. Ledger: attribution triple + the full approval event story.
    let rows = event_rows(&conn, &fx.run_id);
    let count = |t: &str| rows.iter().filter(|r| r.0 == t).count();
    assert_eq!(count("approval.requested"), 2);
    assert_eq!(count("approval.granted"), 2);
    assert_eq!(count("approval.invalidated"), 1);
    assert_eq!(count("result.created"), 1);
    assert_eq!(count("job.completed"), 1);
    assert!(rows.iter().any(|r| r.0 == "run.completed"));

    let invalidated_row = rows.iter().find(|r| r.0 == "approval.invalidated").unwrap();
    assert_eq!(invalidated_row.3, WORKER_A, "invalidated approval attributes its executor");

    let requested_a = rows.iter().filter(|r| r.0 == "approval.requested" && r.3 == WORKER_A).count();
    let requested_b = rows.iter().filter(|r| r.0 == "approval.requested" && r.3 == WORKER_B).count();
    assert_eq!(requested_a, 1);
    assert_eq!(requested_b, 1);

    for (etype, initiator, delegator, executor) in &rows {
        assert_eq!(initiator, INITIATOR, "{etype}: initiator");
        assert_eq!(delegator, DELEGATOR, "{etype}: delegator");
        assert!(
            !executor.is_empty() || etype == &"job.requeued",
            "{etype}: executor attribution"
        );
    }
}

/// §8.20/§8.21: leases that expire during downtime are recovered at boot by
/// the server clock — requeued per policy, never silently lost — and queued
/// and leased jobs rehydrate into the runtime mirror.
#[tokio::test]
async fn test_downtime_expiry_recovers_at_boot() {
    // No manager/sweeper: simulate a server that goes down while a lease is
    // held, and stays down past the lease expiry.
    let tmp = tempfile::tempdir().unwrap();
    let db_path = tmp.path().join("downtime.db");
    let (run_id, job_id) = {
        let mut conn = open(&db_path);
        sqlite_store::apply_store_ddl(&mut conn).unwrap();
        sqlite_store::register_principal(&mut conn, WORKER_A, WORKSPACE, &caps(), "token-a")
            .unwrap();
        let run_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO cowork_runs
                (id, tenant_id, workspace_id, initiator, delegator, mode, state,
                 entrypoint, dag_id, policy_profile)
             VALUES (?1, 'tenant-1', ?2, ?3, ?4, 'cowork', 'running', 'x', 'd', 'default')",
            rusqlite::params![run_id, WORKSPACE, INITIATOR, DELEGATOR],
        )
        .unwrap();
        let job_id = sqlite_store::enqueue_job(
            &mut conn, &run_id, "shell_steps",
            serde_json::json!({"steps": ["echo hi"]}),
            &["shell.exec".to_string()], 60, 2, Some(INITIATOR), Some(DELEGATOR),
        )
        .unwrap();
        // Worker claims with a 2s lease, then the server dies.
        let a = auth(&conn, "token-a");
        sqlite_store::claim_job(&mut conn, &a, Some(&job_id), Duration::from_secs(2)).unwrap();
        assert_eq!(job_state(&conn, &job_id), "leased");
        (run_id, job_id)
    };

    // "Downtime" passes (well past lease expiry). Boot: expire, then rehydrate.
    std::thread::sleep(Duration::from_secs(3));
    let actions = {
        let mut conn = open(&db_path);
        let actions = sqlite_store::expire_leases(&mut conn, chrono::Utc::now()).unwrap();
        assert_eq!(actions.len(), 1, "downtime-expired lease is recovered at boot");
        assert_eq!(actions[0].outcome, "queued");
        assert_eq!(job_state(&conn, &job_id), "queued");
        actions
    };

    // The rehydrated view a fresh manager would load: job is queued and
    // claimable by a replacement worker under a new generation.
    let mut conn = open(&db_path);
    let b = sqlite_store::authenticate_principal(&conn, "token-a").unwrap();
    let grant = sqlite_store::claim_job(&mut conn, &b, Some(&job_id), Duration::from_secs(60))
        .expect("requeued job claimable after boot recovery");
    assert!(grant.lease_generation > actions[0].lease_generation);
    let _ = run_id;
}
