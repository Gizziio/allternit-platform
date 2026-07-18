//! MCP stdio bridge to the officecli MCP server.
//!
//! One long-lived `officecli mcp` child per user; newline-delimited
//! JSON-RPC 2.0 over stdio. Docs are passed per tool call as file paths, so a
//! single server per user suffices. The add-in reaches it through
//! `POST /office/cli/mcp`, which forwards envelopes verbatim — giving it
//! `tools/list` (dynamic discovery of officecli's full MCP tool surface) and
//! `tools/call` with no per-tool server code to maintain.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicI64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin},
    sync::oneshot,
};
use uuid::Uuid;

use crate::config::AppConfig;
use crate::office_cli_routes::caller_id;
use crate::AppState;

/// Timeout for a single forwarded JSON-RPC request.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
/// Timeout for the initialize handshake on spawn.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(30);

pub struct McpSession {
    child: Child,
    stdin: ChildStdin,
    pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    /// Next id for gateway-initiated messages (client envelopes keep their id).
    next_id: Arc<AtomicI64>,
    pub last_active: Instant,
    _reader_task: tokio::task::JoinHandle<()>,
}

impl McpSession {
    /// Spawn the officecli MCP stdio server and complete the MCP handshake:
    /// `initialize` request, then the `notifications/initialized` notification.
    pub async fn spawn(config: &AppConfig) -> Result<McpSession, String> {
        let mut child = tokio::process::Command::new(config.officecli_bin())
            .args(config.officecli_mcp_args())
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to spawn officecli MCP server: {}", e))?;

        let stdin = child.stdin.take().ok_or("officecli MCP stdin unavailable")?;
        let stdout = child
            .stdout
            .take()
            .ok_or("officecli MCP stdout unavailable")?;

        let pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let reader_pending = Arc::clone(&pending);
        let reader_task = tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(value) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                // Responses carry an id and are routed to their waiter;
                // notifications are ignored.
                if let Some(id) = value.get("id").and_then(|v| v.as_i64()) {
                    if let Some(sender) = reader_pending.lock().unwrap().remove(&id) {
                        let _ = sender.send(value);
                    }
                }
            }
            // stdout closed (child died): drop every pending sender so callers
            // fail fast instead of hanging until their timeout.
            reader_pending.lock().unwrap().clear();
        });

        let mut session = McpSession {
            child,
            stdin,
            pending,
            next_id: Arc::new(AtomicI64::new(1)),
            last_active: Instant::now(),
            _reader_task: reader_task,
        };

        let initialize = json!({
            "jsonrpc": "2.0",
            "id": 0,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "allternit-gateway", "version": "1.0" }
            }
        });
        session.request(initialize, HANDSHAKE_TIMEOUT).await?;
        session
            .notify(json!({
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            }))
            .await?;

        Ok(session)
    }

    /// Send a JSON-RPC request and await the response with the matching id.
    pub async fn request(&mut self, message: Value, timeout: Duration) -> Result<Value, String> {
        let id = message
            .get("id")
            .and_then(|v| v.as_i64())
            .ok_or("Missing JSON-RPC 'id'")?;
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(id, tx);
        if let Err(e) = self.write_line(&message).await {
            self.pending.lock().unwrap().remove(&id);
            return Err(e);
        }
        self.last_active = Instant::now();
        match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(_)) => Err("officecli MCP server closed the response channel".to_string()),
            Err(_) => {
                self.pending.lock().unwrap().remove(&id);
                Err("officecli MCP request timed out".to_string())
            }
        }
    }

    /// Send a JSON-RPC notification (no response expected).
    pub async fn notify(&mut self, message: Value) -> Result<(), String> {
        self.write_line(&message).await
    }

    async fn write_line(&mut self, message: &Value) -> Result<(), String> {
        let mut line = serde_json::to_string(message).map_err(|e| e.to_string())?;
        line.push('\n');
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to officecli MCP stdin: {}", e))?;
        self.stdin.flush().await.map_err(|e| e.to_string())
    }

    pub async fn shutdown(&mut self) {
        let _ = self.child.kill().await;
    }
}

/// `POST /office/cli/mcp` — JSON-RPC envelope passthrough. Lazily spawns the
/// user's session; on child death the session is dropped, respawned once and
/// the request retried once. Failures map to JSON-RPC error responses.
///
/// NOTE: the session map stays write-locked across the forwarded request, so
/// MCP calls are serialized process-wide — acceptable for v1 (one user per
/// gateway in practice); revisit if multi-user concurrency matters.
pub async fn mcp_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = caller_id(&headers);
    let mut message = body;
    let rpc_id = message
        .get("id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Bad request", "message": "Missing JSON-RPC 'id'" })),
            )
        })?;

    // `doc_id` is a gateway extension: resolve it to an absolute path (with
    // ownership check), rewrite "@doc" placeholders inside params, then strip
    // it before forwarding so the officecli server never sees it.
    if let Some(doc_id) = message
        .get("doc_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
    {
        let uuid = doc_id.parse::<Uuid>().map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Bad request", "message": "Invalid doc_id" })),
            )
        })?;
        let path = {
            let docs = state.office_cli_docs.read().await;
            docs.get(&uuid)
                .filter(|doc| doc.user_id == user_id)
                .map(|doc| doc.path.clone())
                .ok_or_else(|| {
                    (
                        StatusCode::NOT_FOUND,
                        Json(json!({ "error": "Office CLI document not found" })),
                    )
                })?
        };
        if let Some(params) = message.get_mut("params") {
            rewrite_doc_placeholders(params, &path);
        }
        if let Some(object) = message.as_object_mut() {
            object.remove("doc_id");
        }
    }

    let mut sessions = state.office_cli_mcp_sessions.write().await;
    let mut last_error: Option<String> = None;
    for _attempt in 0..2 {
        if !sessions.contains_key(&user_id) {
            match McpSession::spawn(&state.config).await {
                Ok(session) => {
                    sessions.insert(user_id.clone(), session);
                }
                Err(e) => {
                    last_error = Some(e);
                    continue;
                }
            }
        }
        let session = sessions.get_mut(&user_id).expect("session inserted above");
        match session.request(message.clone(), REQUEST_TIMEOUT).await {
            Ok(response) => return Ok(Json(response)),
            Err(e) => {
                last_error = Some(e);
                // Drop the (possibly dead) session; the next loop iteration
                // respawns it and retries the request once.
                if let Some(mut dead) = sessions.remove(&user_id) {
                    dead.shutdown().await;
                }
            }
        }
    }

    Ok(Json(json!({
        "jsonrpc": "2.0",
        "id": rpc_id,
        "error": {
            "code": -32603,
            "message": last_error.unwrap_or_else(|| "officecli MCP request failed".to_string()),
        }
    })))
}

/// Recursively rewrite "@doc" inside any string value in a JSON-RPC params
/// object to the resolved absolute document path. Substring replacement is
/// required: the officecli MCP server exposes a single tool whose `command`
/// string embeds the filename (e.g. "view @doc outline").
fn rewrite_doc_placeholders(value: &mut Value, path: &std::path::Path) {
    match value {
        Value::String(s) if s.contains("@doc") => {
            *s = s.replace("@doc", &path.to_string_lossy().to_string());
        }
        Value::Array(items) => items
            .iter_mut()
            .for_each(|item| rewrite_doc_placeholders(item, path)),
        Value::Object(map) => map
            .values_mut()
            .for_each(|item| rewrite_doc_placeholders(item, path)),
        _ => {}
    }
}

/// Allocate the next gateway-side JSON-RPC id (reserved for future use, e.g.
/// gateway-initiated pings).
#[allow(dead_code)]
fn next_rpc_id(session: &McpSession) -> i64 {
    session.next_id.fetch_add(1, Ordering::Relaxed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_doc_placeholder_recursively() {
        let mut params = json!({
            "name": "docx_get",
            "arguments": {
                "file": "@doc",
                "nested": ["@doc", { "deep": "@doc" }, "untouched"]
            }
        });
        rewrite_doc_placeholders(&mut params, std::path::Path::new("/abs/path/report.docx"));
        assert_eq!(
            params["arguments"]["file"],
            json!("/abs/path/report.docx")
        );
        assert_eq!(
            params["arguments"]["nested"][0],
            json!("/abs/path/report.docx")
        );
        assert_eq!(
            params["arguments"]["nested"][1]["deep"],
            json!("/abs/path/report.docx")
        );
        assert_eq!(params["arguments"]["nested"][2], json!("untouched"));
        // "@doc" embedded inside a command string is rewritten too (the real
        // MCP tool takes a single `command` param containing the filename).
        let mut other = json!({"command": "view @doc outline"});
        rewrite_doc_placeholders(&mut other, std::path::Path::new("/abs/report.docx"));
        assert_eq!(other["command"], json!("view /abs/report.docx outline"));
    }
}
