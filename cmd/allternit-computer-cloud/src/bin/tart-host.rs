//! Minimal HTTP wrapper around the Tart CLI.
//!
//! Run on a macOS host that has Tart installed:
//!   TART_HOST_TOKEN=$(openssl rand -hex 16) allternit-tart-host
//!
//! The control-plane TartDriver talks to this wrapper over HTTP and gets the
//! same lifecycle/exec/file operations that Incus provides on Linux.
//!
//! Authentication: all routes except `/health` require a valid
//! `Authorization: Bearer <TART_HOST_TOKEN>` header when `TART_HOST_TOKEN` is set.

use axum::{
    extract::{Path, Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::net::SocketAddr;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Command;
use tracing::{info, warn};

#[derive(Clone)]
struct AppState {
    tart_bin: String,
    ssh_user: String,
    ssh_password: String,
    token: Option<String>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let token = std::env::var("TART_HOST_TOKEN").ok().filter(|s| !s.is_empty());
    if token.is_none() {
        warn!("TART_HOST_TOKEN is not set; tart-host will accept unauthenticated requests");
    } else {
        info!("tart-host authentication enabled");
    }

    let state = AppState {
        tart_bin: std::env::var("TART_BIN").unwrap_or_else(|_| "tart".to_string()),
        ssh_user: std::env::var("TART_SSH_USER").unwrap_or_else(|_| "admin".to_string()),
        ssh_password: std::env::var("TART_SSH_PASSWORD").unwrap_or_else(|_| "admin".to_string()),
        token,
    };

    let state_arc = Arc::new(state);

    let protected = Router::new()
        .route("/v1/vms/:name", get(get_vm).delete(delete_vm))
        .route("/v1/vms/:name/create", post(create_vm))
        .route("/v1/vms/:name/start", post(start_vm))
        .route("/v1/vms/:name/stop", post(stop_vm))
        .route("/v1/vms/:name/exec", post(exec_vm))
        .route("/v1/vms/:name/files/pull", post(pull_file))
        .route("/v1/vms/:name/files/push", post(push_file))
        .route("/v1/vms/:name/screenshot", get(screenshot_vm))
        .route_layer(middleware::from_fn_with_state(state_arc.clone(), auth_middleware))
        .with_state(state_arc.clone());

    let app = Router::new()
        .route("/health", get(health))
        .merge(protected);

    let addr: SocketAddr = std::env::var("TART_HOST_BIND")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(|| "127.0.0.1:8020".parse().unwrap());

    info!(%addr, "Allternit Tart host wrapper starting");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    if let Some(expected) = &state.token {
        let headers = request.headers();
        let provided = headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.strip_prefix("Bearer "));
        if provided != Some(expected.as_str()) {
            warn!("rejected request with missing or invalid bearer token");
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"}))).into_response();
        }
    }
    next.run(request).await
}

async fn health() -> impl IntoResponse {
    Json(json!({"status": "ok", "service": "tart-host"}))
}

#[derive(Debug, Deserialize)]
struct CreateVmRequest {
    image: String,
    #[serde(default)]
    cpu: Option<usize>,
    #[serde(default)]
    memory_mb: Option<usize>,
}

async fn create_vm(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(body): Json<CreateVmRequest>,
) -> Response {
    if let Err(e) = run_tart(&state, &["clone", &body.image, &name]).await {
        return e.into_response();
    }
    let mut set_args = vec!["set".to_string(), name.clone()];
    if let Some(cpu) = body.cpu {
        set_args.push("--cpu".to_string());
        set_args.push(cpu.to_string());
    }
    if let Some(mem) = body.memory_mb {
        set_args.push("--memory".to_string());
        set_args.push(mem.to_string());
    }
    if set_args.len() > 2 {
        if let Err(e) = run_tart(&state, &set_args).await {
            return e.into_response();
        }
    }
    Json(json!({"name": name, "status": "created"})).into_response()
}

async fn start_vm(State(state): State<Arc<AppState>>, Path(name): Path<String>) -> Response {
    let mut child = match Command::new(&state.tart_bin)
        .args(["run", "--no-graphics", &name])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return service_error(format!("failed to start VM: {}", e)),
    };

    tokio::spawn(async move {
        let _ = child.wait().await;
    });

    Json(json!({"name": name, "status": "starting"})).into_response()
}

async fn stop_vm(State(state): State<Arc<AppState>>, Path(name): Path<String>) -> Response {
    match run_tart(&state, &["stop", &name]).await {
        Ok(_) => Json(json!({"name": name, "status": "stopped"})).into_response(),
        Err(e) => e.into_response(),
    }
}

async fn delete_vm(State(state): State<Arc<AppState>>, Path(name): Path<String>) -> Response {
    // Tart refuses to delete a running VM; stop it first (ignore already-stopped).
    let _ = run_tart(&state, &["stop", &name, "--timeout", "5"]).await;
    match run_tart(&state, &["delete", &name]).await {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => e.into_response(),
    }
}

#[derive(Debug, Serialize)]
struct VmInfo {
    name: String,
    status: String,
    ip: Option<String>,
}

async fn get_vm(State(state): State<Arc<AppState>>, Path(name): Path<String>) -> Response {
    match vm_status(&state, &name).await {
        Ok(info) => Json(info).into_response(),
        Err(e) => e.into_response(),
    }
}

async fn vm_status(state: &AppState, name: &str) -> Result<VmInfo, TartError> {
    let list = run_tart_output(state, &["list", "--format", "json"]).await?;
    let vms: Vec<serde_json::Value> = serde_json::from_str(&list).unwrap_or_default();
    let found = vms.into_iter().find(|v| {
        v.get("Name")
            .and_then(|n| n.as_str())
            .map(|n| n == name)
            .unwrap_or(false)
    });
    let Some(vm) = found else {
        return Err(TartError::NotFound(name.to_string()));
    };
    let running = vm
        .get("State")
        .and_then(|s| s.as_str())
        .map(|s| s == "running")
        .unwrap_or(false);
    let ip = if running {
        run_tart_output(state, &["ip", name])
            .await
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    } else {
        None
    };
    Ok(VmInfo {
        name: name.to_string(),
        status: if running { "running".to_string() } else { "stopped".to_string() },
        ip,
    })
}

#[derive(Debug, Deserialize)]
struct ExecRequest {
    command: Vec<String>,
    #[serde(default)]
    env: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize)]
struct ExecResponse {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

async fn exec_vm(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(body): Json<ExecRequest>,
) -> Response {
    if body.command.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "command required"}))).into_response();
    }
    match run_tart_exec(&state, &name, &body.command, &body.env).await {
        Ok(r) => Json(r).into_response(),
        Err(e) => e.into_response(),
    }
}

async fn run_tart_exec(
    state: &AppState,
    name: &str,
    command: &[String],
    _env: &std::collections::HashMap<String, String>,
) -> Result<ExecResponse, TartError> {
    let mut args = vec!["exec".to_string(), name.to_string()];
    args.extend(command.iter().cloned());

    let out = Command::new(&state.tart_bin)
        .args(&args)
        .output()
        .await
        .map_err(|e| TartError::Internal(format!("exec failed: {}", e)))?;

    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    let exit_code = out.status.code().unwrap_or(-1);

    // Tart's native exec requires the Tart Guest Agent. Linux images (and some
    // macOS base images) may not have it running, so fall back to SSH over the
    // Tart VM's NAT IP when we detect the agent is missing.
    if exit_code != 0 && stderr.contains("Tart Guest Agent") {
        return run_ssh_exec(state, name, command).await;
    }

    Ok(ExecResponse {
        exit_code,
        stdout,
        stderr,
    })
}

async fn run_ssh_exec(
    state: &AppState,
    name: &str,
    command: &[String],
) -> Result<ExecResponse, TartError> {
    let ip = run_tart_output(state, &["ip", name]).await?;
    let ip = ip.trim();
    if ip.is_empty() {
        return Err(TartError::Internal("VM has no IP for SSH fallback".to_string()));
    }

    // When the original command is `sh -c "<script>"`, run the script directly
    // on the remote host. Otherwise join the vector into one remote command.
    let remote_cmd = if command.len() == 3 && command[0] == "sh" && command[1] == "-c" {
        command[2].clone()
    } else {
        command.join(" ")
    };

    let ssh_args = vec![
        "-o".to_string(),
        "StrictHostKeyChecking=no".to_string(),
        "-o".to_string(),
        "UserKnownHostsFile=/dev/null".to_string(),
        "-o".to_string(),
        "LogLevel=ERROR".to_string(),
        format!("{}@{}", state.ssh_user, ip),
        remote_cmd,
    ];

    let out = Command::new("sshpass")
        .arg("-p")
        .arg(&state.ssh_password)
        .arg("ssh")
        .args(&ssh_args)
        .output()
        .await
        .map_err(|e| TartError::Internal(format!("ssh exec failed: {}", e)))?;

    Ok(ExecResponse {
        exit_code: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out.stdout).to_string(),
        stderr: String::from_utf8_lossy(&out.stderr).to_string(),
    })
}

#[derive(Debug, Deserialize)]
struct FilePullRequest {
    path: String,
}

async fn pull_file(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(body): Json<FilePullRequest>,
) -> Response {
    let cmd = vec!["base64".to_string(), "-i".to_string(), body.path.clone()];
    match run_tart_exec(&state, &name, &cmd, &Default::default()).await {
        Ok(r) if r.exit_code == 0 => {
            let bytes = match BASE64.decode(r.stdout.trim()) {
                Ok(b) => b,
                Err(e) => return service_error(format!("base64 decode failed: {}", e)),
            };
            (StatusCode::OK, bytes).into_response()
        }
        Ok(r) => service_error(format!("pull failed: {}", r.stderr)),
        Err(e) => e.into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct FilePushRequest {
    path: String,
    content_base64: String,
}

async fn push_file(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(body): Json<FilePushRequest>,
) -> Response {
    let sh = format!(
        "mkdir -p \"$(dirname '{}')\" && printf '%s' '{}' | base64 -d > '{}'",
        body.path.replace('"', "\\\""),
        body.content_base64,
        body.path.replace('"', "\\\"")
    );
    let cmd = vec!["sh".to_string(), "-c".to_string(), sh];
    match run_tart_exec(&state, &name, &cmd, &Default::default()).await {
        Ok(r) if r.exit_code == 0 => Json(json!({"success": true})).into_response(),
        Ok(r) => service_error(format!("push failed: {}", r.stderr)),
        Err(e) => e.into_response(),
    }
}

async fn screenshot_vm(State(state): State<Arc<AppState>>, Path(name): Path<String>) -> Response {
    let cmd = vec![
        "sh".to_string(),
        "-c".to_string(),
        "screencapture -x /tmp/allternit-screen.png && base64 -i /tmp/allternit-screen.png".to_string(),
    ];
    match run_tart_exec(&state, &name, &cmd, &Default::default()).await {
        Ok(r) if r.exit_code == 0 => {
            let bytes = match BASE64.decode(r.stdout.trim()) {
                Ok(b) => b,
                Err(e) => return service_error(format!("screenshot decode failed: {}", e)),
            };
            (StatusCode::OK, bytes).into_response()
        }
        Ok(r) => service_error(format!("screenshot failed: {}", r.stderr)),
        Err(e) => e.into_response(),
    }
}

#[derive(Debug, thiserror::Error)]
enum TartError {
    #[error("VM not found: {0}")]
    NotFound(String),
    #[error("Tart command failed: {0}")]
    CommandFailed(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for TartError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            TartError::NotFound(name) => (StatusCode::NOT_FOUND, format!("VM not found: {}", name)),
            TartError::CommandFailed(s) => (StatusCode::SERVICE_UNAVAILABLE, s),
            TartError::Internal(s) => (StatusCode::INTERNAL_SERVER_ERROR, s),
        };
        (status, Json(json!({"error": msg}))).into_response()
    }
}

fn service_error(msg: String) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({"error": msg})),
    )
        .into_response()
}

async fn run_tart(state: &AppState, args: &[impl AsRef<std::ffi::OsStr>]) -> Result<(), TartError> {
    let output = Command::new(&state.tart_bin)
        .args(args)
        .output()
        .await
        .map_err(|e| TartError::Internal(format!("tart failed: {}", e)))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(TartError::CommandFailed(stderr.to_string()));
    }
    Ok(())
}

async fn run_tart_output(
    state: &AppState,
    args: &[impl AsRef<std::ffi::OsStr>],
) -> Result<String, TartError> {
    let output = Command::new(&state.tart_bin)
        .args(args)
        .output()
        .await
        .map_err(|e| TartError::Internal(format!("tart failed: {}", e)))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(TartError::CommandFailed(stderr.to_string()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
