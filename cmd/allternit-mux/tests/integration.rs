//! End-to-end tests: daemon on a temp socket, full lifecycle.

use allternit_mux::api::ApiServer;
use allternit_mux::client::Client;
use allternit_mux::events::EventBus;
use allternit_mux::session::SessionStore;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::Duration;
use tempfile::TempDir;

struct TestDaemon {
    _tmp: TempDir,
    socket: PathBuf,
    task: Option<tokio::task::JoinHandle<()>>,
}

async fn start_daemon() -> TestDaemon {
    let tmp = tempfile::tempdir().unwrap();
    let state_dir = tmp.path().join("mux-state");
    let socket = tmp.path().join("mux.sock");
    let bus = EventBus::new();
    let store = SessionStore::load(state_dir.clone(), bus.clone())
        .await
        .unwrap();
    let server = ApiServer::new(store, bus, socket.clone());
    let task = tokio::spawn(async move {
        server.serve().await.unwrap();
    });
    // Wait for the socket to appear.
    for _ in 0..100 {
        if socket.exists() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert!(socket.exists(), "daemon socket never appeared");
    TestDaemon {
        _tmp: tmp,
        socket,
        task: Some(task),
    }
}

impl TestDaemon {
    async fn client(&self) -> Client {
        Client::connect(&self.socket).await.unwrap()
    }

    async fn stop(mut self) {
        let mut c = self.client().await;
        let _ = c.request("server.stop", json!({})).await;
        if let Some(t) = self.task.take() {
            let _ = tokio::time::timeout(Duration::from_secs(5), t).await;
        }
    }
}

/// Poll `pane.read` until it contains `needle` (or time out).
async fn wait_for_output(client: &mut Client, pane_id: &str, needle: &str) -> String {
    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    loop {
        let out = client
            .request("pane.read", json!({ "pane_id": pane_id }))
            .await
            .unwrap();
        let text = out
            .get("output")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if text.contains(needle) {
            return text;
        }
        assert!(
            std::time::Instant::now() < deadline,
            "timed out waiting for `{needle}` in pane {pane_id}; got: {text:?}"
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

#[tokio::test]
async fn ping_pong() {
    let d = start_daemon().await;
    let mut c = d.client().await;
    let out = c.request("ping", json!({})).await.unwrap();
    assert_eq!(out["type"], "pong");
    d.stop().await;
}

#[tokio::test]
async fn session_lifecycle() {
    let d = start_daemon().await;
    let mut c = d.client().await;

    let out = c
        .request("session.create", json!({ "label": "test" }))
        .await
        .unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();

    let out = c.request("session.list", json!({})).await.unwrap();
    let sessions = out["sessions"].as_array().unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0]["label"], "test");

    c.request("session.close", json!({ "session_id": sid }))
        .await
        .unwrap();
    let out = c.request("session.list", json!({})).await.unwrap();
    assert_eq!(out["sessions"].as_array().unwrap().len(), 0);

    d.stop().await;
}

#[tokio::test]
async fn pane_run_and_read() {
    let d = start_daemon().await;
    let mut c = d.client().await;

    let out = c.request("session.create", json!({})).await.unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();

    let out = c
        .request("pane.create", json!({ "session_id": sid }))
        .await
        .unwrap();
    let pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();

    // Wait for the shell to settle, then run a command in a fresh process slot.
    let marker = format!("mux-it-{}", uuid::Uuid::new_v4());
    // pane.run requires a non-busy pane; close the shell first via send_input "exit".
    c.request(
        "pane.send_input",
        json!({ "pane_id": pane_id, "data": "exit\n" }),
    )
    .await
    .unwrap();
    // Wait for the shell to exit.
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    loop {
        let out = c
            .request("pane.get", json!({ "pane_id": pane_id }))
            .await
            .unwrap();
        if out["pane"]["process_running"] == Value::Bool(false) {
            break;
        }
        assert!(std::time::Instant::now() < deadline, "shell never exited");
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    c.request(
        "pane.run",
        json!({ "pane_id": pane_id, "command": format!("echo {marker}") }),
    )
    .await
    .unwrap();
    let text = wait_for_output(&mut c, &pane_id, &marker).await;
    assert!(text.contains(&marker));

    d.stop().await;
}

/// Wait until a `pane.output` event for `pane` containing `needle` arrives.
async fn recv_event_containing(c: &mut Client, pane: &str, needle: &str) -> bool {
    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    loop {
        let ev = c.next_event().await.unwrap();
        if ev.pane_id.as_deref() == Some(pane)
            && ev.kind == "pane.output"
            && ev.data["data"].as_str().unwrap_or("").contains(needle)
        {
            return true;
        }
        assert!(std::time::Instant::now() < deadline, "no output event for {needle}");
    }
}

#[tokio::test]
async fn two_clients_attach_one_detaches() {
    let d = start_daemon().await;
    let mut control = d.client().await;

    let out = control.request("session.create", json!({})).await.unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();
    let out = control
        .request("pane.create", json!({ "session_id": sid }))
        .await
        .unwrap();
    let pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();

    let mut a = d.client().await;
    a.subscribe(&["pane.output"]).await.unwrap();
    let mut b = d.client().await;
    b.subscribe(&["pane.output"]).await.unwrap();

    let marker = format!("attach-{}", uuid::Uuid::new_v4());
    control
        .request(
            "pane.send_input",
            json!({ "pane_id": pane_id, "data": format!("echo {marker}\n") }),
        )
        .await
        .unwrap();

    // Both subscribers see the output event.
    assert!(recv_event_containing(&mut a, &pane_id, &marker).await);
    assert!(recv_event_containing(&mut b, &pane_id, &marker).await);

    // A detaches (drops connection); B keeps streaming.
    drop(a);
    let marker2 = format!("after-detach-{}", uuid::Uuid::new_v4());
    control
        .request(
            "pane.send_input",
            json!({ "pane_id": pane_id, "data": format!("echo {marker2}\n") }),
        )
        .await
        .unwrap();
    assert!(recv_event_containing(&mut b, &pane_id, &marker2).await);

    d.stop().await;
}

#[tokio::test]
async fn agent_state_for_known_agent_process() {
    let d = start_daemon().await;
    let mut c = d.client().await;

    // Create a fake `kimi` executable in a temp dir.
    let bin_dir = tempfile::tempdir().unwrap();
    let kimi_path = bin_dir.path().join("kimi");
    std::fs::write(&kimi_path, "#!/bin/sh\nsleep 30\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&kimi_path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    let out = c.request("session.create", json!({})).await.unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();
    let out = c
        .request("pane.create", json!({ "session_id": sid }))
        .await
        .unwrap();
    let pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();

    // Exit the shell so pane.run is allowed.
    c.request(
        "pane.send_input",
        json!({ "pane_id": pane_id, "data": "exit\n" }),
    )
    .await
    .unwrap();
    tokio::time::sleep(Duration::from_millis(500)).await;

    c.request(
        "pane.run",
        json!({ "pane_id": pane_id, "command": kimi_path.display().to_string() }),
    )
    .await
    .unwrap();

    let out = c
        .request("agent.state", json!({ "pane_id": pane_id }))
        .await
        .unwrap();
    assert_eq!(out["agent"]["agent"], "kimi");
    let state = out["agent"]["state"].as_str().unwrap();
    assert!(
        state == "idle" || state == "working",
        "expected idle/working, got {state}"
    );

    let out = c.request("agent.list", json!({})).await.unwrap();
    assert_eq!(out["agents"].as_array().unwrap().len(), 1);

    d.stop().await;
}

#[tokio::test]
async fn screen_read_and_verified_send() {
    let d = start_daemon().await;
    let mut c = d.client().await;

    let out = c.request("session.create", json!({})).await.unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();
    let out = c
        .request("pane.create", json!({ "session_id": sid }))
        .await
        .unwrap();
    let pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();

    // Run `cat` so input is echoed back: exit shell first.
    c.request(
        "pane.send_input",
        json!({ "pane_id": pane_id, "data": "exit\n" }),
    )
    .await
    .unwrap();
    tokio::time::sleep(Duration::from_millis(500)).await;
    c.request("pane.run", json!({ "pane_id": pane_id, "command": ["cat"] }))
        .await
        .unwrap();

    // Verified send: text must render before Enter.
    c.request(
        "pane.send_verified",
        json!({ "pane_id": pane_id, "data": "hello-screen" }),
    )
    .await
    .unwrap();

    // Screen source shows rendered terminal contents.
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    loop {
        let out = c
            .request(
                "pane.read",
                json!({ "pane_id": pane_id, "source": "screen" }),
            )
            .await
            .unwrap();
        let text = out["output"].as_str().unwrap_or("");
        if text.contains("hello-screen") {
            break;
        }
        assert!(std::time::Instant::now() < deadline, "screen missing echo: {text:?}");
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    d.stop().await;
}

#[tokio::test]
async fn wait_file_and_env_passthrough() {
    let d = start_daemon().await;
    let mut c = d.client().await;

    let out = c.request("session.create", json!({})).await.unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();
    let out = c
        .request("pane.create", json!({ "session_id": sid }))
        .await
        .unwrap();
    let pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();
    c.request(
        "pane.send_input",
        json!({ "pane_id": pane_id, "data": "exit\n" }),
    )
    .await
    .unwrap();
    tokio::time::sleep(Duration::from_millis(500)).await;

    // env passthrough: print a var the server sets.
    c.request(
        "pane.run",
        json!({
            "pane_id": pane_id,
            "command": ["sh", "-c", "echo $MUX_TEST_VAR"],
            "env": { "MUX_TEST_VAR": "mux-env-ok" }
        }),
    )
    .await
    .unwrap();
    wait_for_output(&mut c, &pane_id, "mux-env-ok").await;

    // wait.file: create the file after a delay; the wait must resolve.
    let tmp = tempfile::tempdir().unwrap();
    let sentinel = tmp.path().join("sentinel.txt");
    let sentinel_str = sentinel.display().to_string();
    let sentinel_clone = sentinel_str.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(500)).await;
        std::fs::write(&sentinel_clone, "done").unwrap();
    });
    let out = c
        .request(
            "wait.file",
            json!({ "path": sentinel_str, "timeout_ms": 10_000 }),
        )
        .await
        .unwrap();
    assert_eq!(out["found"], Value::Bool(true));

    // wait.file timeout path.
    let out = c
        .request(
            "wait.file",
            json!({ "path": tmp.path().join("never").display().to_string(), "timeout_ms": 300 }),
        )
        .await
        .unwrap();
    assert_eq!(out["found"], Value::Bool(false));

    d.stop().await;
}

#[tokio::test]
async fn blocked_state_from_screen_manifest() {
    let d = start_daemon().await;
    let mut c = d.client().await;

    // Fake `kimi` that prints an approval prompt then sleeps.
    let bin_dir = tempfile::tempdir().unwrap();
    let kimi_path = bin_dir.path().join("kimi");
    std::fs::write(
        &kimi_path,
        "#!/bin/sh\nprintf 'Do you want to proceed?'\nsleep 30\n",
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&kimi_path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    let out = c.request("session.create", json!({})).await.unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();
    let out = c
        .request("pane.create", json!({ "session_id": sid }))
        .await
        .unwrap();
    let pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();
    c.request(
        "pane.send_input",
        json!({ "pane_id": pane_id, "data": "exit\n" }),
    )
    .await
    .unwrap();
    tokio::time::sleep(Duration::from_millis(500)).await;
    c.request(
        "pane.run",
        json!({ "pane_id": pane_id, "command": [kimi_path.display().to_string()] }),
    )
    .await
    .unwrap();

    // Once output settles (no recent output), the screen bottom holds the
    // prompt and the state must be `blocked`.
    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    loop {
        let out = c
            .request("agent.state", json!({ "pane_id": pane_id }))
            .await
            .unwrap();
        let state = out["agent"]["state"].as_str().unwrap();
        if state == "blocked" {
            break;
        }
        assert!(
            std::time::Instant::now() < deadline,
            "never reached blocked; last: {state}"
        );
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    d.stop().await;
}

#[tokio::test]
async fn close_session_kills_child_process_tree() {
    let d = start_daemon().await;
    let mut c = d.client().await;

    let out = c.request("session.create", json!({})).await.unwrap();
    let sid = out["session"]["session_id"].as_str().unwrap().to_string();
    let out = c
        .request("pane.create", json!({ "session_id": sid }))
        .await
        .unwrap();
    let pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();

    // Start a unique long-running background job inside the shell so we can
    // verify the whole process group is terminated, not just the shell itself.
    let tag = format!("mux-kill-test-{}", uuid::Uuid::new_v4());
    c.request(
        "pane.send_input",
        json!({ "pane_id": pane_id, "data": "set +H\n" }),
    )
    .await
    .unwrap();
    c.request(
        "pane.send_input",
        json!({ "pane_id": pane_id, "data": format!("sleep 300000 & echo \"{}:$!\"\n", tag) }),
    )
    .await
    .unwrap();

    // Read until the shell echoes the PID line.
    let sleep_pid = {
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        loop {
            let out = c
                .request("pane.read", json!({ "pane_id": pane_id }))
                .await
                .unwrap();
            let text = out["output"].as_str().unwrap_or("");
            if let Some(start) = text.rfind(&format!("{}:", tag)) {
                let rest = &text[start + tag.len() + 1..];
                if let Some(end) = rest.find(|c: char| !c.is_ascii_digit()) {
                    if let Ok(pid) = rest[..end].parse::<u32>() {
                        break pid;
                    }
                } else if let Ok(pid) = rest.parse::<u32>() {
                    break pid;
                }
            }
            assert!(
                std::time::Instant::now() < deadline,
                "never saw pid line; got: {text:?}"
            );
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    };

    let is_alive = |pid: u32| -> bool {
        std::process::Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    };
    assert!(is_alive(sleep_pid), "sleep child process should exist before close");

    // Closing the session must kill the shell and its background descendant.
    c.request("session.close", json!({ "session_id": sid }))
        .await
        .unwrap();

    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    while std::time::Instant::now() < deadline {
        if !is_alive(sleep_pid) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    assert!(
        !is_alive(sleep_pid),
        "child process {sleep_pid} outlived session close"
    );

    d.stop().await;
}

#[tokio::test]
async fn restore_after_restart_replays_scrollback() {
    let tmp = tempfile::tempdir().unwrap();
    let state_dir = tmp.path().join("mux-state");
    let socket = tmp.path().join("mux.sock");
    let marker = format!("restore-{}", uuid::Uuid::new_v4());
    let pane_id;
    let session_id;

    // First daemon: create session + pane, produce output.
    {
        let bus = EventBus::new();
        let store = SessionStore::load(state_dir.clone(), bus.clone())
            .await
            .unwrap();
        let server = ApiServer::new(store, bus, socket.clone());
        let task = tokio::spawn(async move { server.serve().await.unwrap() });
        for _ in 0..100 {
            if socket.exists() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let mut c = Client::connect(&socket).await.unwrap();
        let out = c
            .request("session.create", json!({ "label": "persisted" }))
            .await
            .unwrap();
        session_id = out["session"]["session_id"].as_str().unwrap().to_string();
        let out = c
            .request("pane.create", json!({ "session_id": session_id }))
            .await
            .unwrap();
        pane_id = out["pane"]["pane_id"].as_str().unwrap().to_string();

        c.request(
            "pane.send_input",
            json!({ "pane_id": pane_id, "data": format!("echo {marker}\n") }),
        )
        .await
        .unwrap();
        wait_for_output(&mut c, &pane_id, &marker).await;

        c.request("server.stop", json!({})).await.unwrap();
        let _ = tokio::time::timeout(Duration::from_secs(5), task).await;
    }

    // Second daemon over the same state dir: layout restored, scrollback replays.
    {
        let bus = EventBus::new();
        let store = SessionStore::load(state_dir.clone(), bus.clone())
            .await
            .unwrap();
        let server = ApiServer::new(store, bus, socket.clone());
        let task = tokio::spawn(async move { server.serve().await.unwrap() });
        for _ in 0..100 {
            if socket.exists() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let mut c = Client::connect(&socket).await.unwrap();

        let out = c.request("session.list", json!({})).await.unwrap();
        let sessions = out["sessions"].as_array().unwrap();
        assert_eq!(sessions.len(), 1, "session not restored");
        assert_eq!(sessions[0]["label"], "persisted");

        let out = c
            .request("pane.get", json!({ "pane_id": pane_id }))
            .await
            .unwrap();
        assert_eq!(out["pane"]["process_running"], Value::Bool(false));

        let out = c
            .request("pane.read", json!({ "pane_id": pane_id }))
            .await
            .unwrap();
        let text = out["output"].as_str().unwrap();
        assert!(
            text.contains(&marker),
            "scrollback did not replay marker; got {text:?}"
        );

        c.request("server.stop", json!({})).await.unwrap();
        let _ = tokio::time::timeout(Duration::from_secs(5), task).await;
    }
}
