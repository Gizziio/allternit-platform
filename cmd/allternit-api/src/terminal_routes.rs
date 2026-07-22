//! Terminal API routes — Code Mode terminals backed by `allternit-mux`.
//!
//! Same HTTP contract as the old tmux implementation (create/input/close/
//! resize/stream), but every terminal is a real PTY owned by the mux daemon
//! instead of an external tmux session. Wins over tmux: sessions survive API
//! restarts (mux owns them), scrollback replay comes from mux's persistent
//! logs (no 75 ms file poller), and no tmux dependency on PATH.

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
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::unix::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::UnixStream;
use tokio::sync::RwLock;
use tracing::{debug, warn};
use uuid::Uuid;

use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// Mux NDJSON client
// ─────────────────────────────────────────────────────────────────────────────

fn mux_socket_path() -> PathBuf {
    if let Ok(p) = std::env::var("ALLTERNIT_MUX_SOCKET") {
        return PathBuf::from(p);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".allternit").join("mux").join("mux.sock")
}

struct MuxClient {
    write: OwnedWriteHalf,
    read: BufReader<OwnedReadHalf>,
}

impl MuxClient {
    async fn connect() -> Result<Self, String> {
        let path = mux_socket_path();
        let stream = UnixStream::connect(&path).await.map_err(|e| {
            format!(
                "allternit-mux is not reachable at {}: {}",
                path.display(),
                e
            )
        })?;
        let (read, write) = stream.into_split();
        Ok(Self {
            write,
            read: BufReader::new(read),
        })
    }

    async fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = Uuid::new_v4().to_string();
        let frame = json!({ "id": id, "method": method, "params": params });
        let mut line = serde_json::to_string(&frame).map_err(|e| e.to_string())?;
        line.push('\n');
        self.write
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("mux write: {e}"))?;
        self.write.flush().await.map_err(|e| format!("mux flush: {e}"))?;

        // Skip interleaved event frames; responses carry our id.
        loop {
            let mut buf = String::new();
            let n = self
                .read
                .read_line(&mut buf)
                .await
                .map_err(|e| format!("mux read: {e}"))?;
            if n == 0 {
                return Err("mux closed the connection".into());
            }
            let resp: Value = serde_json::from_str(buf.trim()).map_err(|e| e.to_string())?;
            if resp.get("id").and_then(|v| v.as_str()) != Some(&id) {
                continue;
            }
            if let Some(err) = resp.get("error") {
                let code = err.get("code").and_then(|v| v.as_str()).unwrap_or("error");
                let msg = err.get("message").and_then(|v| v.as_str()).unwrap_or("unknown");
                return Err(format!("{code}: {msg}"));
            }
            return Ok(resp.get("result").cloned().unwrap_or(Value::Null));
        }
    }

    /// Next pushed event frame (only valid after `events.subscribe`).
    async fn next_event(&mut self) -> Option<Value> {
        let mut buf = String::new();
        match self.read.read_line(&mut buf).await {
            Ok(0) | Err(_) => None,
            Ok(_) => serde_json::from_str(buf.trim()).ok(),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared state: external session id -> mux session/pane ids
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

#[derive(Clone)]
struct TerminalSession {
    mux_session_id: String,
    mux_pane_id: String,
}

impl TerminalSessionStore {
    async fn get(&self, id: &str) -> Option<TerminalSession> {
        {
            let sessions = self.inner.read().await;
            if let Some(s) = sessions.get(id) {
                return Some(s.clone());
            }
        }
        // Cache miss — recover the mapping from mux by label. Mux owns the
        // sessions, so an API restart doesn't lose terminals (the old tmux
        // implementation lost them with its in-memory registry).
        let label = format!("allt-term-{}", id.replace('-', ""));
        let mut mux = MuxClient::connect().await.ok()?;
        let list = mux.request("session.list", json!({})).await.ok()?;
        let found = list["sessions"].as_array()?.iter().find(|s| {
            s["label"].as_str() == Some(&label)
        })?;
        let mux_session_id = found["session_id"].as_str()?.to_string();
        let mux_pane_id = found["panes"].as_array()?.first()?["pane_id"]
            .as_str()?
            .to_string();
        let session = TerminalSession {
            mux_session_id,
            mux_pane_id,
        };
        let mut sessions = self.inner.write().await;
        sessions.insert(id.to_string(), session.clone());
        Some(session)
    }
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
// Request/response types (unchanged contract)
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

fn err_response(status: StatusCode, message: String) -> (StatusCode, Json<TerminalMessageResponse>) {
    (
        status,
        Json(TerminalMessageResponse {
            success: false,
            message,
            data: None,
        }),
    )
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
    let mut mux = match MuxClient::connect().await {
        Ok(m) => m,
        Err(err) => {
            return err_response(StatusCode::SERVICE_UNAVAILABLE, err);
        }
    };

    let session_id = Uuid::new_v4().to_string();
    let cwd = request.cwd.clone().or_else(|| {
        std::env::current_dir()
            .ok()
            .map(|p| p.to_string_lossy().into_owned())
    });

    let created = mux
        .request(
            "session.create",
            json!({
                "label": format!("allt-term-{}", session_id.replace('-', "")),
                "cwd": cwd,
            }),
        )
        .await;
    let mux_session_id = match created {
        Ok(v) => v["session"]["session_id"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        Err(err) => return err_response(StatusCode::INTERNAL_SERVER_ERROR, err),
    };

    let pane = mux
        .request(
            "pane.create",
            json!({
                "session_id": mux_session_id,
                "cols": request.cols,
                "rows": request.rows,
                "command": [request.shell],
                // Set terminal capabilities explicitly at the API boundary as
                // well as in allternit-mux. This keeps browser shells usable
                // with an older or externally managed mux daemon whose
                // inherited TERM may be "dumb".
                "env": {
                    "TERM": "xterm-256color",
                    "COLORTERM": "truecolor",
                },
            }),
        )
        .await;
    let mux_pane_id = match pane {
        Ok(v) => v["pane"]["pane_id"].as_str().unwrap_or_default().to_string(),
        Err(err) => {
            let _ = mux
                .request("session.close", json!({ "session_id": mux_session_id }))
                .await;
            return err_response(StatusCode::INTERNAL_SERVER_ERROR, err);
        }
    };

    {
        let mut sessions = state.terminal_sessions.inner.write().await;
        sessions.insert(
            session_id.clone(),
            TerminalSession {
                mux_session_id,
                mux_pane_id,
            },
        );
    }

    debug!(%session_id, "Terminal session created (mux)");

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
            return err_response(
                StatusCode::NOT_FOUND,
                format!("Terminal session '{}' not found", session_id),
            )
        }
    };

    // Raw bytes straight through: a real PTY treats '\r' as Enter, so no
    // send-keys style splitting is needed.
    let mut mux = match MuxClient::connect().await {
        Ok(m) => m,
        Err(err) => return err_response(StatusCode::SERVICE_UNAVAILABLE, err),
    };
    if let Err(err) = mux
        .request(
            "pane.send_input",
            json!({ "pane_id": session.mux_pane_id, "data": request.content }),
        )
        .await
    {
        warn!(%err, %session_id, "Failed to send terminal input");
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
            return err_response(
                StatusCode::NOT_FOUND,
                format!("Terminal session '{}' not found", session_id),
            )
        }
    };

    let mut mux = match MuxClient::connect().await {
        Ok(m) => m,
        Err(err) => return err_response(StatusCode::SERVICE_UNAVAILABLE, err),
    };
    if let Err(err) = mux
        .request(
            "pane.resize",
            json!({
                "pane_id": session.mux_pane_id,
                "cols": request.cols,
                "rows": request.rows,
            }),
        )
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
        if let Ok(mut mux) = MuxClient::connect().await {
            if let Err(err) = mux
                .request(
                    "session.close",
                    json!({ "session_id": session.mux_session_id }),
                )
                .await
            {
                warn!(%err, %session_id, "Failed to close mux session");
            }
        }
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
    let session = match state.terminal_sessions.get(&session_id).await {
        Some(s) => s,
        None => {
            return err_response(
                StatusCode::NOT_FOUND,
                format!("Terminal session '{}' not found", session_id),
            )
            .into_response();
        }
    };

    let mut mux = match MuxClient::connect().await {
        Ok(m) => m,
        Err(err) => {
            return err_response(StatusCode::SERVICE_UNAVAILABLE, err).into_response();
        }
    };

    // Replay the full scrollback (mux persists it across restarts), then
    // subscribe to live output.
    let initial = mux
        .request(
            "pane.read",
            json!({ "pane_id": session.mux_pane_id, "source": "scrollback" }),
        )
        .await
        .ok()
        .and_then(|v| v["output"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();

    let pane_id = session.mux_pane_id.clone();
    let subscribed = mux
        .request("events.subscribe", json!({ "types": ["pane.output"] }))
        .await
        .is_ok();

    let stream = async_stream::stream! {
        if !initial.is_empty() {
            yield Ok::<_, std::convert::Infallible>(Bytes::from(sse_data_event(&initial)));
        }

        if !subscribed {
            // Mux unreachable for live data; the replay above is all we have.
            return;
        }

        loop {
            tokio::select! {
                event = mux.next_event() => {
                    match event {
                        Some(ev)
                            if ev.get("type").and_then(|v| v.as_str()) == Some("pane.output")
                                && ev.get("pane_id").and_then(|v| v.as_str()) == Some(pane_id.as_str()) =>
                        {
                            let chunk = ev["data"]["data"].as_str().unwrap_or("").to_string();
                            if !chunk.is_empty() {
                                yield Ok(Bytes::from(sse_data_event(&chunk)));
                            }
                        }
                        Some(_) => continue, // other panes' output
                        None => break,       // mux closed
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
