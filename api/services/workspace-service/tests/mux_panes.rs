// Mux-backed pane I/O: panes perform REAL PTY I/O through allternit-mux
// (phase 4 of the terminal consolidation plan). Spawns a mux daemon on a temp
// state dir, then drives the service over HTTP via tower::oneshot.

use allternit_workspace_service::{build_router, AppState};
use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};
use tower::ServiceExt;

/// Serializes tests that mutate ALLTERNIT_MUX_SOCKET (process-global env).
static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

struct MuxDaemon {
    child: Child,
    socket: String,
    _tmp: tempfile::TempDir,
}

fn mux_binary() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../target/debug/allternit-mux")
}

async fn start_mux() -> MuxDaemon {
    let tmp = tempfile::tempdir().unwrap();
    let state_dir = tmp.path().join("mux-state");
    let socket = state_dir.join("mux.sock");
    std::fs::create_dir_all(&state_dir).unwrap();
    let child = Command::new(mux_binary())
        .arg("serve")
        .env("ALLTERNIT_MUX_STATE_DIR", &state_dir)
        .env("ALLTERNIT_MUX_SOCKET", &socket)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("failed to spawn allternit-mux (run `cargo build -p allternit-mux` first)");
    let deadline = Instant::now() + Duration::from_secs(10);
    while !socket.exists() {
        assert!(Instant::now() < deadline, "mux socket never appeared");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    MuxDaemon {
        child,
        socket: socket.display().to_string(),
        _tmp: tmp,
    }
}

impl Drop for MuxDaemon {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

async fn post(app: &axum::Router, uri: &str, body: serde_json::Value) -> (StatusCode, serde_json::Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap_or(json!({})))
}

async fn get(app: &axum::Router, uri: &str) -> (StatusCode, serde_json::Value) {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap_or(json!({})))
}

#[tokio::test]
async fn panes_perform_real_pty_io_through_mux() {
    let _guard = ENV_LOCK.lock().unwrap();
    let daemon = start_mux().await;
    std::env::set_var("ALLTERNIT_MUX_SOCKET", &daemon.socket);
    let app = build_router(AppState::new());

    // Session + pane (default shell).
    let (status, created) = post(&app, "/sessions", json!({ "name": "mux-io" })).await;
    assert_eq!(status, StatusCode::CREATED);
    let session_id = created["session"]["id"].as_str().unwrap().to_string();

    let (status, pane) = post(
        &app,
        &format!("/sessions/{}/panes", session_id),
        json!({ "name": "main" }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let pane_id = pane["id"].as_str().unwrap().to_string();

    // Send a command through the pane; real PTY executes it.
    let marker = format!("ws-mux-io-{}", uuid::Uuid::new_v4());
    let (status, _) = post(
        &app,
        &format!("/panes/{}/send", pane_id),
        json!({ "keys": format!("echo {marker}") }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Capture must show REAL shell output, not the old simulated "$ cmd" echo.
    let deadline = Instant::now() + Duration::from_secs(15);
    let mut captured = String::new();
    while Instant::now() < deadline {
        let (status, body) = get(&app, &format!("/panes/{}/capture", pane_id)).await;
        assert_eq!(status, StatusCode::OK);
        captured = body["output"].as_str().unwrap_or("").to_string();
        // Real PTY output contains the command's *result* on its own line.
        if captured.lines().any(|l| l.trim() == marker) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    assert!(
        captured.lines().any(|l| l.trim() == marker),
        "no real PTY output for marker; got: {captured:?}"
    );
    assert!(
        !captured.starts_with("$ echo"),
        "fell back to simulated output: {captured:?}"
    );

    // Logs endpoint reads the same real scrollback.
    let (status, logs) = get(&app, &format!("/panes/{}/logs", pane_id)).await;
    assert_eq!(status, StatusCode::OK);
    assert!(logs["logs"].as_str().unwrap_or("").contains(&marker));

    // Delete session tears down the mux session too.
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/sessions/{}", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}
