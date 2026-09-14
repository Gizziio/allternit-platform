//! P-T2 non-local compute placement tests.
//!
//! Placement resolves per contract §8.8 through required capabilities: a
//! job whose intent declared `compute: vm` is only claimable by a principal
//! that declares `compute.vm`; a local-only worker's claim is refused with
//! `A_CAPABILITY_MISSING`. Placement never rewrites identity or attribution.

use std::path::Path;
use std::time::Duration;

use allternit_cowork_runtime::sqlite_store;
use allternit_cowork_runtime::transport::{IntentAction, IntentEnvelope, TransportErrorCode};

const WORKSPACE: &str = "ws-placement";
const INITIATOR: &str = "a://workspace/ws-placement/user/joe";
const LOCAL_WORKER: &str = "a://workspace/ws-placement/principal/gizzi";
const VM_WORKER: &str = "a://workspace/ws-placement/bot/vm-worker";

fn open(db_path: &Path) -> rusqlite::Connection {
    sqlite_store::open_store(db_path).expect("open store")
}

fn fresh() -> (tempfile::TempDir, std::path::PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let db_path = tmp.path().join("placement.db");
    let mut conn = open(&db_path);
    sqlite_store::apply_store_ddl(&mut conn).unwrap();
    drop(conn);
    (tmp, db_path)
}

fn seed_principals(conn: &mut rusqlite::Connection) {
    // Local-only worker: the seeded Gizzi set (incl. compute.local, no vm).
    let mut local_caps = sqlite_store::GIZZI_CAPABILITIES
        .iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    sqlite_store::register_principal(
        conn,
        LOCAL_WORKER,
        WORKSPACE,
        &local_caps,
        &["worker".to_string()],
        "token-local",
    )
    .unwrap();
    // VM-capable worker: gizzi set + compute.vm.
    local_caps.push("compute.vm".to_string());
    sqlite_store::register_principal(
        conn,
        VM_WORKER,
        WORKSPACE,
        &local_caps,
        &["worker".to_string()],
        "token-vm",
    )
    .unwrap();
}

fn insert_run(conn: &rusqlite::Connection, run_id: &str) {
    conn.execute(
        "INSERT INTO cowork_runs
            (id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id, policy_profile)
         VALUES (?1, 'tenant-1', ?2, ?3, 'cowork', 'queued', 'placement-proof', 'dag-p', 'default')",
        rusqlite::params![run_id, WORKSPACE, INITIATOR],
    )
    .unwrap();
}

fn claim_err(
    conn: &mut rusqlite::Connection,
    token: &str,
    job_id: Option<&str>,
) -> Option<TransportErrorCode> {
    let principal = sqlite_store::authenticate_principal(conn, token).expect("auth");
    match sqlite_store::claim_job(conn, &principal, job_id, Duration::from_secs(60)) {
        Ok(_) => None,
        Err(e) => Some(e.code),
    }
}

#[test]
fn compute_requirements_map_explicit_policies() {
    let vm = serde_json::json!({ "policy": "vm" });
    let local = serde_json::json!("local");
    assert_eq!(
        sqlite_store::compute_requirements(&Some(vm)),
        vec!["compute.vm".to_string()]
    );
    assert_eq!(
        sqlite_store::compute_requirements(&Some(local)),
        vec!["compute.local".to_string()]
    );
    // auto / absent stay capability-neutral.
    assert!(sqlite_store::compute_requirements(&Some(serde_json::json!({ "policy": "auto" }))).is_empty());
    assert!(sqlite_store::compute_requirements(&None).is_empty());
}

#[test]
fn vm_required_job_refuses_local_worker_and_wins_on_vm_worker() {
    let (_tmp, db_path) = fresh();
    let mut conn = open(&db_path);
    seed_principals(&mut conn);
    let run_id = uuid::Uuid::new_v4().to_string();
    insert_run(&conn, &run_id);
    let job_id = sqlite_store::enqueue_job(
        &mut conn,
        &run_id,
        "shell_steps",
        serde_json::json!({ "steps": ["echo vm"] }),
        &["compute.vm".to_string()],
        60,
        2,
        Some(INITIATOR),
        None,
    )
    .unwrap();

    // Local-only worker: targeted claim refused with the §8.6 vocabulary.
    let err = claim_err(&mut conn, "token-local", Some(&job_id));
    assert_eq!(err, Some(TransportErrorCode::CapabilityMissing));

    // Job untouched by the refused claim.
    let state: String = conn
        .query_row(
            "SELECT state FROM cowork_jobs WHERE id = ?1",
            rusqlite::params![job_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(state, "queued");

    // VM-capable worker claims; identity/attribution stay the worker's own.
    let principal = sqlite_store::authenticate_principal(&conn, "token-vm").unwrap();
    let grant = sqlite_store::claim_job(&mut conn, &principal, Some(&job_id), Duration::from_secs(60))
        .expect("vm worker claims");
    assert_eq!(grant.job_id, job_id);
    let lease_owner: String = conn
        .query_row(
            "SELECT lease_owner FROM cowork_jobs WHERE id = ?1",
            rusqlite::params![job_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(lease_owner, VM_WORKER, "placement never rewrites executor identity");
}

#[test]
fn local_policy_job_refuses_vm_only_worker_without_local_cap() {
    let (_tmp, db_path) = fresh();
    let mut conn = open(&db_path);
    // A principal declaring ONLY compute.vm must not pick up local work.
    sqlite_store::register_principal(
        &mut conn,
        VM_WORKER,
        WORKSPACE,
        &["compute.vm".to_string()],
        &["worker".to_string()],
        "token-vm",
    )
    .unwrap();
    let run_id = uuid::Uuid::new_v4().to_string();
    insert_run(&conn, &run_id);
    let job_id = sqlite_store::enqueue_job(
        &mut conn,
        &run_id,
        "shell_steps",
        serde_json::json!({ "steps": ["echo local"] }),
        &["compute.local".to_string()],
        60,
        2,
        Some(INITIATOR),
        None,
    )
    .unwrap();
    let err = claim_err(&mut conn, "token-vm", Some(&job_id));
    assert_eq!(err, Some(TransportErrorCode::CapabilityMissing));
}

#[test]
fn submit_intent_enqueues_claimable_job_with_compute_requirements() {
    let (_tmp, db_path) = fresh();
    let mut conn = open(&db_path);
    seed_principals(&mut conn);

    let envelope = IntentEnvelope {
        version: "a/0.1".to_string(),
        intent_id: "intent_vm_001".to_string(),
        workspace: format!("a://workspace/{WORKSPACE}"),
        initiator: INITIATOR.to_string(),
        delegator: None,
        target: Some(LOCAL_WORKER.to_string()),
        action: IntentAction {
            action_type: "shell_steps".to_string(),
            description: "run in a vm".to_string(),
            payload: Some(serde_json::json!({ "steps": ["echo hi"] })),
        },
        permissions: vec![],
        compute: Some(serde_json::json!({ "policy": "vm" })),
        model: None,
        approval: None,
        return_channel: None,
        causation_chain: vec![INITIATOR.to_string()],
    };
    let submission = sqlite_store::submit_intent(&mut conn, &envelope).unwrap();
    assert!(submission.created);

    // The canonical job exists with the compute policy as mandatory caps.
    let job: (String, String) = conn
        .query_row(
            "SELECT state, required_capabilities FROM cowork_jobs WHERE run_id = ?1",
            rusqlite::params![submission.run_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(job.0, "queued");
    assert_eq!(job.1, serde_json::json!(["compute.vm"]).to_string());

    // Idempotent replay does not enqueue a second job.
    let replay = sqlite_store::submit_intent(&mut conn, &envelope).unwrap();
    assert!(!replay.created);
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cowork_jobs WHERE run_id = ?1",
            rusqlite::params![submission.run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);

    // Local-only worker refused; VM-capable worker claims.
    let job_id: String = conn
        .query_row(
            "SELECT id FROM cowork_jobs WHERE run_id = ?1",
            rusqlite::params![submission.run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        claim_err(&mut conn, "token-local", Some(&job_id)),
        Some(TransportErrorCode::CapabilityMissing)
    );
    let principal = sqlite_store::authenticate_principal(&conn, "token-vm").unwrap();
    sqlite_store::claim_job(&mut conn, &principal, Some(&job_id), Duration::from_secs(60))
        .expect("vm-capable worker claims the vm job");
}

#[test]
fn al_targeted_intent_creates_no_bypass_job() {
    let (_tmp, db_path) = fresh();
    let mut conn = open(&db_path);
    let envelope = IntentEnvelope {
        version: "a/0.1".to_string(),
        intent_id: "intent_al_001".to_string(),
        workspace: format!("a://workspace/{WORKSPACE}"),
        initiator: INITIATOR.to_string(),
        delegator: None,
        target: Some(format!("a://workspace/{WORKSPACE}/principal/al")),
        action: IntentAction {
            action_type: "shell_steps".to_string(),
            description: "orchestrate me".to_string(),
            payload: None,
        },
        permissions: vec![],
        compute: Some(serde_json::json!({ "policy": "vm" })),
        model: None,
        approval: None,
        return_channel: None,
        causation_chain: vec![INITIATOR.to_string()],
    };
    let submission = sqlite_store::submit_intent(&mut conn, &envelope).unwrap();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cowork_jobs WHERE run_id = ?1",
            rusqlite::params![submission.run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0, "Al-targeted parent intents carry no claimable job");
}

#[test]
fn set_principal_capabilities_updates_and_missing_errors() {
    let (_tmp, db_path) = fresh();
    let mut conn = open(&db_path);
    seed_principals(&mut conn);
    let caps = vec!["compute.vm".to_string(), "shell.exec".to_string()];
    sqlite_store::set_principal_capabilities(&conn, LOCAL_WORKER, &caps).unwrap();
    let principal = sqlite_store::authenticate_principal(&conn, "token-local").unwrap();
    assert_eq!(principal.capabilities, caps);

    let err = sqlite_store::set_principal_capabilities(
        &conn,
        "a://workspace/ws-placement/principal/nope",
        &caps,
    )
    .unwrap_err();
    assert_eq!(err.code, TransportErrorCode::PrincipalNotFound);
}
