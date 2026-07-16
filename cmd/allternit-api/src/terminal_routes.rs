//! Terminal API routes — local tmux-backed PTY sessions for Code Mode.
//!
//! Each terminal pane gets its own tmux session. Output is captured with
//! `tmux pipe-pane` into a per-session log file and streamed to the client
//! over Server-Sent Events. Input is injected with `tmux send-keys`.

use axum::{
    body::Body,
    extract::{Json, Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::process::Command;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, warn};
use uuid::Uuid;

use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// Shared state
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct TerminalSessionStore {
    inner: Arc<RwLock<HashMap<String, TerminalSession>>>,
}

impl TerminalSessionStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

struct TerminalSession {
    tmux_name: String,
    log_path: PathBuf,
    tx: broadcast::Sender<String>,
    stop: Arc<AtomicBool>,
}

impl TerminalSessionStore {
    async fn get(&self, id: &str) -> Option<TerminalSessionRef> {
        let sessions = self.inner.read().await;
        sessions.get(id).map(|s| TerminalSessionRef {
            tmux_name: s.tmux_name.clone(),
        })
    }
}

struct TerminalSessionRef {
    tmux_name: String,
}

fn tmux_target(tmux_name: &str) -> String {
    format!("={}:", tmux_name)
}

fn tmux_name(session_id: &str) -> String {
    format!("allt-term-{}", session_id.replace('-', ""))
}

fn default_shell() -> String {
    "/bin/zsh".into()
}

fn default_cols() -> u16 {
    80
}

fn default_rows() -> u16 {
    24
}

// ─────────────────────────────────────────────────────────────────────────────
// tmux helpers
// ─────────────────────────────────────────────────────────────────────────────

async fn tmux_available() -> bool {
    Command::new("tmux")
        .arg("-V")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

async fn run_tmux(args: &[&str]) -> Result<String, String> {
    debug!(?args, "Running tmux command");
    let output = Command::new("tmux")
        .args(args)
        .output()
        .await
        .map_err(|e| format!("tmux command failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("tmux error: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

// ─────────────────────────────────────────────────────────────────────────────
// Output poller
// ─────────────────────────────────────────────────────────────────────────────

async fn poll_terminal_output(log_path: PathBuf, tx: broadcast::Sender<String>, stop: Arc<AtomicBool>) {
    // Wait until the log file exists (created by pipe-pane or pre-created).
    for _ in 0..50 {
        if stop.load(Ordering::Relaxed) {
            return;
        }
        if log_path.exists() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    let mut file = match fs::File::open(&log_path).await {
        Ok(f) => f,
        Err(err) => {
            warn!(%err, path = %log_path.display(), "Failed to open terminal log file");
            return;
        }
    };

    let mut offset = file
        .metadata()
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    if file.seek(SeekFrom::Start(offset)).await.is_err() {
        offset = 0;
    }

    let mut interval = tokio::time::interval(Duration::from_millis(75));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    let mut buf = vec![0u8; 4096];

    while !stop.load(Ordering::Relaxed) {
        interval.tick().await;

        let metadata = match file.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };

        let len = metadata.len();
        if len < offset {
            // Log was truncated; replay from the start.
            offset = 0;
            if file.seek(SeekFrom::Start(0)).await.is_err() {
                continue;
            }
        }

        if len == offset {
            continue;
        }

        let mut chunk = String::new();
        loop {
            match file.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    offset += n as u64;
                    chunk.push_str(&String::from_utf8_lossy(&buf[..n]));
                }
                Err(err) => {
                    warn!(%err, "Error reading terminal log");
                    break;
                }
            }
        }

        if !chunk.is_empty() {
            let _ = tx.send(chunk);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request / response types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateTerminalRequest {
    #[serde(default = "default_shell")]
    pub shell: String,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default = "default_cols")]
    pub cols: u16,
    #[serde(default = "default_rows")]
    pub rows: u16,
}

#[derive(Debug, Serialize)]
pub struct TerminalMessageResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct TerminalInputRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct TerminalResizeRequest {
    pub cols: u16,
    pub rows: u16,
}

fn sse_data_event(data: &str) -> String {
    let payload = serde_json::json!({ "type": "data", "data": data });
    format!("data: {}\n\n", payload)
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

pub fn terminal_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/create", post(create_terminal))
        .route("/:session_id/input", post(terminal_input))
        .route("/:session_id/close", post(terminal_close))
        .route("/:session_id/resize", post(terminal_resize))
        .route("/:session_id/stream", get(terminal_stream))
}

async fn create_terminal(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateTerminalRequest>,
) -> impl IntoResponse {
    if !tmux_available().await {
        error!("tmux is not available; cannot create terminal session");
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(TerminalMessageResponse {
                success: false,
                message: "tmux is not installed or not on PATH".into(),
                data: None,
            }),
        );
    }

    let session_id = Uuid::new_v4().to_string();
    let tmux_name = tmux_name(&session_id);
    let target = tmux_target(&tmux_name);

    let cwd = request.cwd.clone().or_else(|| {
        std::env::current_dir()
            .ok()
            .map(|p| p.to_string_lossy().into_owned())
    });

    let log_dir = std::env::temp_dir().join("allternit-terminals");
    if let Err(err) = fs::create_dir_all(&log_dir).await {
        error!(%err, "Failed to create terminal log directory");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TerminalMessageResponse {
                success: false,
                message: "Failed to create terminal log directory".into(),
                data: None,
            }),
        );
    }
    let log_path = log_dir.join(format!("{}.log", session_id));

    // Pre-create the log file so the poller can open it immediately.
    if let Err(err) = fs::File::create(&log_path).await {
        error!(%err, "Failed to create terminal log file");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TerminalMessageResponse {
                success: false,
                message: "Failed to create terminal log file".into(),
                data: None,
            }),
        );
    }

    let mut args = vec!["new-session", "-d", "-s", &tmux_name];
    if let Some(cwd) = &cwd {
        args.push("-c");
        args.push(cwd);
    }
    args.push(&request.shell);

    if let Err(err) = run_tmux(&args).await {
        error!(%err, %session_id, "Failed to spawn tmux session");
        let _ = fs::remove_file(&log_path).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TerminalMessageResponse {
                success: false,
                message: err,
                data: None,
            }),
        );
    }

    // Apply initial size.
    let _ = run_tmux(&[
        "resize-window",
        "-t",
        &target,
        "-x",
        &request.cols.to_string(),
        "-y",
        &request.rows.to_string(),
    ])
    .await;

    // Pipe pane output into the log file.
    let pipe_cmd = format!("cat >> '{}'", log_path.display());
    if let Err(err) = run_tmux(&["pipe-pane", "-t", &target, &pipe_cmd]).await {
        error!(%err, %session_id, "Failed to attach tmux pipe-pane");
        let _ = run_tmux(&["kill-session", "-t", &target]).await;
        let _ = fs::remove_file(&log_path).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TerminalMessageResponse {
                success: false,
                message: err,
                data: None,
            }),
        );
    }

    let (tx, _rx) = broadcast::channel::<String>(256);
    let stop = Arc::new(AtomicBool::new(false));

    tokio::spawn(poll_terminal_output(log_path.clone(), tx.clone(), stop.clone()));

    {
        let mut sessions = state.terminal_sessions.inner.write().await;
        sessions.insert(
            session_id.clone(),
            TerminalSession {
                tmux_name,
                log_path,
                tx,
                stop,
            },
        );
    }

    debug!(%session_id, "Terminal session created");

    (
        StatusCode::OK,
        Json(TerminalMessageResponse {
            success: true,
            message: "Terminal session created".into(),
            data: Some(serde_json::json!({ "session_id": session_id })),
        }),
    )
}

async fn terminal_input(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(request): Json<TerminalInputRequest>,
) -> impl IntoResponse {
    let session = match state.terminal_sessions.get(&session_id).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(TerminalMessageResponse {
                    success: false,
                    message: format!("Terminal session '{}' not found", session_id),
                    data: None,
                }),
            )
        }
    };

    let target = tmux_target(&session.tmux_name);
    let text = request.content;

    // Send literal characters. If the input ends with a newline, send those
    // characters without the newline and then press Enter. xterm.js emits
    // Enter as '\r'.
    let trimmed = text.trim_end_matches(&['\r', '\n']);
    if !trimmed.is_empty() {
        if let Err(err) = run_tmux(&["send-keys", "-t", &target, "-l", trimmed]).await {
            warn!(%err, %session_id, "Failed to send terminal input");
        }
    }

    if text.ends_with('\r') || text.ends_with('\n') {
        if let Err(err) = run_tmux(&["send-keys", "-t", &target, "Enter"]).await {
            warn!(%err, %session_id, "Failed to send Enter key");
        }
    }

    (
        StatusCode::OK,
        Json(TerminalMessageResponse {
            success: true,
            message: "Input forwarded".into(),
            data: None,
        }),
    )
}

async fn terminal_resize(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(request): Json<TerminalResizeRequest>,
) -> impl IntoResponse {
    let session = match state.terminal_sessions.get(&session_id).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(TerminalMessageResponse {
                    success: false,
                    message: format!("Terminal session '{}' not found", session_id),
                    data: None,
                }),
            )
        }
    };

    let target = tmux_target(&session.tmux_name);
    if let Err(err) = run_tmux(&[
        "resize-window",
        "-t",
        &target,
        "-x",
        &request.cols.to_string(),
        "-y",
        &request.rows.to_string(),
    ])
    .await
    {
        warn!(%err, %session_id, "Failed to resize terminal");
    }

    (
        StatusCode::OK,
        Json(TerminalMessageResponse {
            success: true,
            message: "Terminal resized".into(),
            data: None,
        }),
    )
}

async fn terminal_close(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let session = {
        let mut sessions = state.terminal_sessions.inner.write().await;
        sessions.remove(&session_id)
    };

    if let Some(session) = session {
        session.stop.store(true, Ordering::Relaxed);
        let target = tmux_target(&session.tmux_name);
        if let Err(err) = run_tmux(&["kill-session", "-t", &target]).await {
            warn!(%err, %session_id, "Failed to kill tmux session");
        }
        let _ = fs::remove_file(&session.log_path).await;
    }

    (
        StatusCode::OK,
        Json(TerminalMessageResponse {
            success: true,
            message: "Terminal session closed".into(),
            data: None,
        }),
    )
}

async fn terminal_stream(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let rx = {
        let sessions = state.terminal_sessions.inner.read().await;
        match sessions.get(&session_id) {
            Some(session) => session.tx.subscribe(),
            None => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(TerminalMessageResponse {
                        success: false,
                        message: format!("Terminal session '{}' not found", session_id),
                        data: None,
                    }),
                )
                    .into_response();
            }
        }
    };

    let initial = {
        let sessions = state.terminal_sessions.inner.read().await;
        sessions
            .get(&session_id)
            .and_then(|s| std::fs::read_to_string(&s.log_path).ok())
            .unwrap_or_default()
    };

    let stream = async_stream::stream! {
        if !initial.is_empty() {
            yield Ok::<_, std::convert::Infallible>(Bytes::from(sse_data_event(&initial)));
        }

        let mut rx = rx;
        loop {
            tokio::select! {
                msg = rx.recv() => {
                    match msg {
                        Ok(chunk) => {
                            yield Ok(Bytes::from(sse_data_event(&chunk)));
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
                        Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    }
                }
                _ = tokio::time::sleep(Duration::from_secs(15)) => {
                    yield Ok(Bytes::from("event: ping\ndata: {}\n\n"));
                }
            }
        }
    };

    let body = Body::from_stream(stream);
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/event-stream")],
        body,
    )
        .into_response()
}
