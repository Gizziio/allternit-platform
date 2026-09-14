//! P-T1 store-consolidation boundary tests.
//!
//! Within a deployment, `allternit_cowork_runtime::sqlite_store` is the only
//! writer of `cowork_runs` / `cowork_jobs` / `cowork_run_events`. Product
//! surfaces persist RunManager state through the projection helpers; these
//! tests prove the boundary holds:
//!   * a projection write can never clobber fabric-transport lease ownership;
//!   * a projection job state transition is refused while a lease is held;
//!   * run events go through the canonical idempotent insert with ownership.

use std::path::Path;
use std::time::Duration;

use allternit_cowork_runtime::sqlite_store;
use allternit_cowork_runtime::types::{Job, JobId, JobState, Run, RunId, RunMode, RunState};

const WORKSPACE: &str = "ws-boundary";
const USER: &str = "user-a";

fn open(db_path: &Path) -> rusqlite::Connection {
    sqlite_store::open_store(db_path).expect("open store")
}

fn fresh() -> (tempfile::TempDir, std::path::PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let db_path = tmp.path().join("boundary.db");
    let mut conn = open(&db_path);
    sqlite_store::apply_store_ddl(&mut conn).unwrap();
    drop(conn);
    (tmp, db_path)
}

fn insert_run(conn: &rusqlite::Connection, run_id: &str) {
    conn.execute(
        "INSERT INTO cowork_runs
            (id, tenant_id, workspace_id, initiator, delegator, mode, state,
             entrypoint, dag_id, policy_profile, user_id)
         VALUES (?1, 'tenant-1', ?2, 'a://workspace/allternit/user/joe',
                 'a://workspace/allternit/principal/al', 'cowork', 'running',
                 'boundary-proof', 'dag-b', 'default', ?3)",
        rusqlite::params![run_id, WORKSPACE, USER],
    )
    .unwrap();
}

fn enqueue(conn: &mut rusqlite::Connection, run_id: &str) -> String {
    sqlite_store::enqueue_job(
        conn,
        run_id,
        "shell_steps",
        serde_json::json!({ "steps": ["echo hi"] }),
        &["shell.exec".to_string()],
        60,
        2,
        Some("a://workspace/allternit/user/joe"),
        Some("a://workspace/allternit/principal/al"),
    )
    .unwrap()
}

/// A stale in-memory RunManager view: state moved on, no lease knowledge.
fn stale_job(run_id: &str, job_id: &str) -> Job {
    Job {
        id: JobId(uuid::Uuid::parse_str(job_id).unwrap()),
        run_id: RunId(uuid::Uuid::parse_str(run_id).unwrap()),
        dag_node_id: "node-1".to_string(),
        job_type: "shell_steps".to_string(),
        priority: 0,
        state: JobState::Running,
        lease_owner: None,
        lease_id: None,
        lease_generation: 0,
        required_capabilities: vec![],
        lease_expires_at: None,
        retry_count: 0,
        max_retries: 2,
        timeout_sec: 60,
        payload: serde_json::json!({ "steps": ["echo hi"] }),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        started_at: None,
        completed_at: None,
    }
}

fn lease_view(conn: &rusqlite::Connection, job_id: &str) -> (Option<String>, i64, String) {
    conn.query_row(
        "SELECT lease_id, lease_generation, state FROM cowork_jobs WHERE id = ?1",
        rusqlite::params![job_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .unwrap()
}

#[test]
fn projection_job_write_preserves_active_lease() {
    let (_tmp, db_path) = fresh();
    let run_id = uuid::Uuid::new_v4().to_string();
    let mut conn = open(&db_path);
    insert_run(&conn, &run_id);
    let job_id = enqueue(&mut conn, &run_id);

    // Fabric transport claims the job (CAS, lock 2).
    sqlite_store::register_principal(
        &mut conn,
        "a://workspace/allternit/bot/worker-a",
        WORKSPACE,
        &["shell.exec".to_string()],
        &["worker".to_string()],
        "token-a",
    )
    .unwrap();
    let principal =
        sqlite_store::authenticate_principal(&conn, "token-a").expect("authenticate");
    let grant = sqlite_store::claim_job(&mut conn, &principal, None, Duration::from_secs(60))
        .expect("claim");
    assert_eq!(grant.job_id, job_id);
    let (lease_id, generation, state) = lease_view(&conn, &job_id);
    assert!(lease_id.is_some());
    assert_eq!(state, "leased");

    // Product surface persists a stale RunManager projection of the same job.
    let stale = stale_job(&run_id, &job_id);
    sqlite_store::persist_job_record(&conn, &stale, USER).expect("projection write");

    // Boundary: lease ownership and transport state are untouched.
    let (after_id, after_gen, after_state) = lease_view(&conn, &job_id);
    assert_eq!(after_id, lease_id, "projection must not overwrite lease_id");
    assert_eq!(after_gen, generation, "projection must not overwrite lease_generation");
    assert_eq!(after_state, "leased", "projection must not move a leased job's state");
}

#[test]
fn projection_job_transition_refused_while_leased() {
    let (_tmp, db_path) = fresh();
    let run_id = uuid::Uuid::new_v4().to_string();
    let mut conn = open(&db_path);
    insert_run(&conn, &run_id);
    let job_id = enqueue(&mut conn, &run_id);
    sqlite_store::register_principal(
        &mut conn,
        "a://workspace/allternit/bot/worker-a",
        WORKSPACE,
        &["shell.exec".to_string()],
        &["worker".to_string()],
        "token-a",
    )
    .unwrap();
    let principal = sqlite_store::authenticate_principal(&conn, "token-a").unwrap();
    sqlite_store::claim_job(&mut conn, &principal, None, Duration::from_secs(60)).unwrap();

    let applied = sqlite_store::transition_job_record(
        &conn,
        &job_id,
        "completed",
        None,
        Some(chrono::Utc::now().to_rfc3339()),
    )
    .expect("transition query");
    assert!(!applied, "leased job transition must be refused");

    let (_, _, state) = lease_view(&conn, &job_id);
    assert_eq!(state, "leased");

    // Only the transport may complete it.
    let lease_id = lease_view_id(&conn, &job_id).expect("lease id");
    let generation = generation_of(&conn, &job_id);
    let outcome = sqlite_store::complete_job(
        &mut conn,
        &principal,
        &job_id,
        &lease_id,
        generation,
        true,
        Some("done".to_string()),
        Some(serde_json::json!({ "ok": true })),
    )
    .expect("complete");
    assert!(matches!(
        outcome,
        allternit_cowork_runtime::CompleteOutcome::Committed { .. }
    ));
}

// Helper wrappers kept small: complete_job's exact signature lives in the
// store; these read the current lease fields back for the call.
fn lease_view_id(conn: &rusqlite::Connection, job_id: &str) -> Option<String> {
    lease_view(conn, job_id).0
}
fn generation_of(conn: &rusqlite::Connection, job_id: &str) -> i64 {
    lease_view(conn, job_id).1
}

#[test]
fn projection_job_write_updates_unleased_job() {
    let (_tmp, db_path) = fresh();
    let run_id = uuid::Uuid::new_v4().to_string();
    let mut conn = open(&db_path);
    insert_run(&conn, &run_id);
    let job_id = enqueue(&mut conn, &run_id);

    let stale = stale_job(&run_id, &job_id);
    sqlite_store::persist_job_record(&conn, &stale, USER).expect("projection write");
    // Unleased job: the projection state applies (RunManager-owned row).
    let (_, _, state) = lease_view(&conn, &job_id);
    assert_eq!(state, "running");

    let applied = sqlite_store::transition_job_record(
        &conn,
        &job_id,
        "completed",
        None,
        Some(chrono::Utc::now().to_rfc3339()),
    )
    .expect("transition query");
    assert!(applied, "unleased job transition must apply");
    let (_, _, state) = lease_view(&conn, &job_id);
    assert_eq!(state, "completed");
}

#[test]
fn mark_job_queued_for_transport_sets_caps_and_attribution() {
    let (_tmp, db_path) = fresh();
    let run_id = uuid::Uuid::new_v4().to_string();
    let conn = open(&db_path);
    insert_run(&conn, &run_id);

    // Simulate a RunManager-created job row (state 'planned', no caps).
    let job = stale_job(&run_id, &uuid::Uuid::new_v4().to_string());
    sqlite_store::persist_job_record(&conn, &job, USER).expect("projection write");

    let applied = sqlite_store::mark_job_queued_for_transport(
        &conn,
        &job.id.to_string(),
        &run_id,
        &serde_json::json!(["shell.exec", "git.read"]).to_string(),
        &serde_json::json!(vec!["a://workspace/allternit/principal/al"]).to_string(),
    )
    .expect("mark queued");
    assert!(applied);

    let row = conn
        .query_row(
            "SELECT state, required_capabilities, initiator, delegator, causation_chain
             FROM cowork_jobs WHERE id = ?1",
            rusqlite::params![job.id.to_string()],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, String>(4)?,
                ))
            },
        )
        .unwrap();
    assert_eq!(row.0, "queued");
    assert_eq!(row.1, serde_json::json!(["shell.exec", "git.read"]).to_string());
    assert_eq!(
        row.2.as_deref(),
        Some("a://workspace/allternit/user/joe"),
        "initiator inherited from run"
    );
    assert_eq!(
        row.3.as_deref(),
        Some("a://workspace/allternit/principal/al"),
        "delegator inherited from run"
    );
    assert_eq!(
        row.4,
        serde_json::json!(vec!["a://workspace/allternit/principal/al"]).to_string()
    );
}

#[test]
fn projection_run_record_roundtrip_and_delegator() {
    let (_tmp, db_path) = fresh();
    let run_id = uuid::Uuid::new_v4().to_string();
    let conn = open(&db_path);

    let run = Run {
        id: RunId(uuid::Uuid::parse_str(&run_id).unwrap()),
        tenant_id: "tenant-1".to_string(),
        workspace_id: WORKSPACE.to_string(),
        initiator: "a://workspace/allternit/user/joe".to_string(),
        mode: RunMode::Cowork,
        state: RunState::Queued,
        entrypoint: "boundary-proof".to_string(),
        dag_id: "dag-b".to_string(),
        current_job_id: None,
        current_checkpoint_id: None,
        policy_profile: "default".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        completed_at: None,
    };
    sqlite_store::persist_run_record(&conn, &run, USER).expect("persist run");
    sqlite_store::set_run_delegator(&conn, &run_id, "a://workspace/allternit/principal/al")
        .expect("set delegator");

    let row = conn
        .query_row(
            "SELECT state, delegator, user_id FROM cowork_runs WHERE id = ?1",
            rusqlite::params![run_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .unwrap();
    assert_eq!(row.0, "queued");
    assert_eq!(
        row.1.as_deref(),
        Some("a://workspace/allternit/principal/al")
    );
    assert_eq!(row.2.as_deref(), Some(USER));

    // Second projection (state moved) upserts without touching attribution.
    let mut moved = run.clone();
    moved.state = RunState::Running;
    sqlite_store::persist_run_record(&conn, &moved, USER).expect("persist run again");
    let state: String = conn
        .query_row(
            "SELECT state FROM cowork_runs WHERE id = ?1",
            rusqlite::params![run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(state, "running");
}

#[test]
fn projection_events_carry_ownership_attribution() {
    let (_tmp, db_path) = fresh();
    let run_id = uuid::Uuid::new_v4().to_string();
    let mut conn = open(&db_path);
    insert_run(&conn, &run_id);

    let id = sqlite_store::record_run_event_projection(
        &mut conn,
        &run_id,
        "run_created",
        serde_json::json!({ "dag_id": "dag-b" }),
        USER,
    )
    .expect("record event");

    let row = conn
        .query_row(
            "SELECT event_type, user_id FROM cowork_run_events WHERE id = ?1",
            rusqlite::params![id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?)),
        )
        .unwrap();
    assert_eq!(row.0, "run_created");
    assert_eq!(row.1.as_deref(), Some(USER));
}
