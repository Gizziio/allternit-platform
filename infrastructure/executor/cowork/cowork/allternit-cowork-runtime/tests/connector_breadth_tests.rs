//! P-T4 connector breadth tests: GitHub + files/local connectors through the
//! broker.
//!
//! Invariants asserted (same as the reference webhook connector):
//!   * secrets never appear in worker payloads or session responses —
//!     invocation is system-side, reading the env var at invoke time;
//!   * sessions are scoped, short-lived, lease-validated, principal-bound;
//!   * writes are approval-gated (`connector.*.write` is High risk);
//!     scoped reads auto-approve by default;
//!   * every invocation records an attributed `connector.invoked` event;
//!   * files paths are confined under the operator-configured root.

use std::path::Path;
use std::time::Duration;

use allternit_cowork_runtime::sqlite_store;
use allternit_cowork_runtime::transport::TransportErrorCode;

const WORKSPACE: &str = "ws-connectors";
const INITIATOR: &str = "a://workspace/ws-connectors/user/joe";
const WORKER: &str = "a://workspace/ws-connectors/principal/gizzi";

fn open(db_path: &Path) -> rusqlite::Connection {
    sqlite_store::open_store(db_path).expect("open store")
}

struct Fx {
    _tmp: tempfile::TempDir,
    db_path: std::path::PathBuf,
    run_id: String,
    job_id: String,
}

fn setup() -> Fx {
    let tmp = tempfile::tempdir().unwrap();
    let db_path = tmp.path().join("connectors.db");
    let mut conn = open(&db_path);
    sqlite_store::apply_store_ddl(&mut conn).unwrap();
    sqlite_store::register_principal(
        &mut conn,
        WORKER,
        WORKSPACE,
        &["shell.exec".to_string(), "compute.local".to_string()],
        &["worker".to_string()],
        "token-w",
    )
    .unwrap();
    let run_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO cowork_runs
            (id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id, policy_profile)
         VALUES (?1, 'tenant-1', ?2, ?3, 'cowork', 'queued', 'connector-proof', 'dag-c', 'default')",
        rusqlite::params![run_id, WORKSPACE, INITIATOR],
    )
    .unwrap();
    let job_id = sqlite_store::enqueue_job(
        &mut conn,
        &run_id,
        "shell_steps",
        serde_json::json!({ "steps": ["echo hi"] }),
        &["shell.exec".to_string()],
        60,
        2,
        Some(INITIATOR),
        None,
    )
    .unwrap();
    drop(conn);
    Fx { _tmp: tmp, db_path, run_id, job_id }
}

fn claim(fx: &Fx, conn: &mut rusqlite::Connection) -> allternit_cowork_runtime::LeaseGrant {
    let principal = sqlite_store::authenticate_principal(conn, "token-w").unwrap();
    sqlite_store::claim_job(conn, &principal, Some(&fx.job_id), Duration::from_secs(60)).unwrap()
}

#[test]
fn connector_capabilities_seeded() {
    let (_tmp, db_path) = {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("seed.db");
        let mut conn = open(&p);
        sqlite_store::apply_store_ddl(&mut conn).unwrap();
        (tmp, p)
    };
    let conn = open(&db_path);
    let rows: Vec<(String, String)> = conn
        .prepare("SELECT capability, secret_env FROM cowork_connector_secrets ORDER BY capability")
        .unwrap()
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    let caps: Vec<&str> = rows.iter().map(|r| r.0.as_str()).collect();
    for expected in [
        "connector.files.read",
        "connector.files.write",
        "connector.github.read",
        "connector.github.write",
        "connector.webhook.send",
    ] {
        assert!(caps.contains(&expected), "seeded capability {expected}");
    }
    assert_eq!(
        rows.iter().find(|r| r.0 == "connector.github.write").unwrap().1,
        "ALLTERNIT_BROKER_GITHUB_TOKEN"
    );
    assert_eq!(
        rows.iter().find(|r| r.0 == "connector.files.read").unwrap().1,
        "ALLTERNIT_BROKER_FILES_ROOT"
    );
}

#[tokio::test]
async fn github_write_requires_approval_read_auto_approves() {
    let fx = setup();
    // System-side secret: the broker reads it from the env at invoke time.
    // A dummy token is enough — the payload-validation failure happens
    // before any network I/O.
    std::env::set_var("ALLTERNIT_BROKER_GITHUB_TOKEN", "ghp_dummy");
    let mut conn = open(&fx.db_path);
    let lease = claim(&fx, &mut conn);
    let principal = sqlite_store::authenticate_principal(&conn, "token-w").unwrap();

    // Read (Low risk): session issued without any approval binding.
    let read = sqlite_store::request_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.github.read",
        Some(Duration::from_secs(60)),
    )
    .unwrap();
    assert!(read.get("secret").is_none() && read.get("token").is_none());

    // Write (High risk): refused until a human grants the approval binding.
    let blocked = sqlite_store::request_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.github.write",
        None,
    )
    .expect_err("write must be approval-gated");
    assert_eq!(blocked.code, TransportErrorCode::ApprovalRequired);

    let binding = sqlite_store::request_approval(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.github.write",
        "*",
        None,
    )
    .unwrap();
    sqlite_store::decide_approval(&mut conn, &binding.id, true, INITIATOR).unwrap();
    let write = sqlite_store::request_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.github.write",
        None,
    )
    .unwrap();
    assert!(write["session_id"].as_str().unwrap().starts_with("cs_"));

    // Payload validation happens without any network access (no repo field).
    let outcome = sqlite_store::invoke_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        write["session_id"].as_str().unwrap(),
        serde_json::json!({ "path": "README.md" }),
    )
    .await
    .unwrap();
    assert_eq!(outcome["delivered"], false);
    assert!(outcome["detail"].as_str().unwrap().contains("owner/name"));
    std::env::remove_var("ALLTERNIT_BROKER_GITHUB_TOKEN");
}

#[tokio::test]
async fn files_connector_confined_write_and_read() {
    let fx = setup();
    let root = fx._tmp.path().join("files-root");
    std::fs::create_dir_all(&root).unwrap();
    // The broker reads the secret from the env at invoke time (system-side).
    std::env::set_var("ALLTERNIT_BROKER_FILES_ROOT", &root);

    let mut conn = open(&fx.db_path);
    let lease = claim(&fx, &mut conn);
    let principal = sqlite_store::authenticate_principal(&conn, "token-w").unwrap();

    // files.write is approval-gated; files.read auto-approves.
    let blocked = sqlite_store::request_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.files.write",
        None,
    )
    .expect_err("files write must be approval-gated");
    assert_eq!(blocked.code, TransportErrorCode::ApprovalRequired);
    let binding = sqlite_store::request_approval(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.files.write",
        "*",
        None,
    )
    .unwrap();
    sqlite_store::decide_approval(&mut conn, &binding.id, true, INITIATOR).unwrap();

    let write = sqlite_store::request_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.files.write",
        None,
    )
    .unwrap();
    let outcome = sqlite_store::invoke_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        write["session_id"].as_str().unwrap(),
        serde_json::json!({ "path": "notes/hello.txt", "content": "hello connector" }),
    )
    .await
    .unwrap();
    assert_eq!(outcome["delivered"], true, "write confined under root: {outcome:?}");
    assert_eq!(
        std::fs::read_to_string(root.join("notes/hello.txt")).unwrap(),
        "hello connector"
    );

    // Read it back through the broker.
    let read = sqlite_store::request_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        "connector.files.read",
        None,
    )
    .unwrap();
    let outcome = sqlite_store::invoke_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        read["session_id"].as_str().unwrap(),
        serde_json::json!({ "path": "notes/hello.txt" }),
    )
    .await
    .unwrap();
    assert_eq!(outcome["delivered"], true);

    // Path escapes are refused and never touch disk.
    for escape in ["../outside.txt", "notes/../../escape.txt", "/etc/passwd"] {
        let outcome = sqlite_store::invoke_connector_session(
            &mut conn,
            &principal,
            &fx.job_id,
            &lease.lease_id,
            lease.lease_generation,
            read["session_id"].as_str().unwrap(),
            serde_json::json!({ "path": escape }),
        )
        .await
        .unwrap();
        assert_eq!(outcome["delivered"], false, "escape refused: {escape}");
        assert!(outcome["detail"].as_str().unwrap().contains("escape")
            || outcome["detail"].as_str().unwrap().contains("absolute"));
    }
    assert!(!fx._tmp.path().join("outside.txt").exists());
    assert!(!std::path::Path::new("/etc/escape.txt").exists());

    // Invocations are attributed to the executor on the run's ledger.
    let events: Vec<(String, String)> = conn
        .prepare(
            "SELECT event_type, COALESCE(executor,'') FROM cowork_run_events
             WHERE run_id = ?1 AND event_type = 'connector.invoked' ORDER BY rowid",
        )
        .unwrap()
        .query_map(rusqlite::params![fx.run_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert!(events.len() >= 3, "one attributed event per invocation");
    assert!(events.iter().all(|(_, exe)| exe == WORKER));

    // Honest simulation: with the root unset the SAME session reports
    // simulated — never silent. (Kept in this test because std::env is
    // process-global and test threads run in parallel.)
    std::env::remove_var("ALLTERNIT_BROKER_FILES_ROOT");
    let outcome = sqlite_store::invoke_connector_session(
        &mut conn,
        &principal,
        &fx.job_id,
        &lease.lease_id,
        lease.lease_generation,
        read["session_id"].as_str().unwrap(),
        serde_json::json!({ "path": "anything.txt" }),
    )
    .await
    .unwrap();
    assert_eq!(outcome["simulated"], true, "unset env → simulated, never silent");
    assert_eq!(outcome["delivered"], false);
}
