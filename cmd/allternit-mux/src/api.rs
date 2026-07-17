//! Unix socket API server: NDJSON request/response + event subscriptions.

use crate::events::EventBus;
use crate::protocol::{Event, Request, Response};
use crate::session::{SessionStore, SplitMeta};
use anyhow::Result;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::Notify;
use tracing::{error, info, warn};

pub struct ApiServer {
    store: SessionStore,
    bus: EventBus,
    socket_path: PathBuf,
    shutdown: Arc<Notify>,
}

impl ApiServer {
    pub fn new(store: SessionStore, bus: EventBus, socket_path: PathBuf) -> Self {
        Self {
            store,
            bus,
            socket_path,
            shutdown: Arc::new(Notify::new()),
        }
    }

    pub fn shutdown_handle(&self) -> Arc<Notify> {
        self.shutdown.clone()
    }

    /// Serve until `server.stop` or SIGTERM/SIGINT.
    pub async fn serve(&self) -> Result<()> {
        if let Some(parent) = self.socket_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if self.socket_path.exists() {
            std::fs::remove_file(&self.socket_path)?;
        }
        let listener = UnixListener::bind(&self.socket_path)?;
        info!("mux listening on {}", self.socket_path.display());

        loop {
            tokio::select! {
                accept = listener.accept() => {
                    match accept {
                        Ok((stream, _)) => {
                            let server = self.clone_shallow();
                            tokio::spawn(async move {
                                if let Err(e) = server.handle_conn(stream).await {
                                    warn!("connection error: {e:#}");
                                }
                            });
                        }
                        Err(e) => error!("accept: {e}"),
                    }
                }
                _ = self.shutdown.notified() => {
                    info!("mux shutting down");
                    break;
                }
            }
        }
        self.store.shutdown().await;
        let _ = std::fs::remove_file(&self.socket_path);
        Ok(())
    }

    fn clone_shallow(&self) -> Self {
        Self {
            store: self.store.clone(),
            bus: self.bus.clone(),
            socket_path: self.socket_path.clone(),
            shutdown: self.shutdown.clone(),
        }
    }

    async fn handle_conn(&self, stream: UnixStream) -> Result<()> {
        let (read, mut write) = stream.into_split();
        let mut lines = BufReader::new(read).lines();
        let mut subscription: Option<tokio::sync::broadcast::Receiver<Event>> = None;

        loop {
            tokio::select! {
                line = lines.next_line() => {
                    let Some(line) = line? else { break };
                    if line.trim().is_empty() {
                        continue;
                    }
                    let req: Request = match serde_json::from_str(&line) {
                        Ok(r) => r,
                        Err(e) => {
                            let resp = Response::err("", "parse_error", e.to_string());
                            write_line(&mut write, &resp).await?;
                            continue;
                        }
                    };
                    // Event subscription: ack, then stream.
                    if req.method == "events.subscribe" {
                        let types: Vec<String> = req
                            .params
                            .get("types")
                            .and_then(|v| serde_json::from_value(v.clone()).ok())
                            .unwrap_or_default();
                        let rx = self.bus.subscribe();
                        let resp = Response::ok(req.id.clone(), json!({"type":"subscribed","types":types}));
                        write_line(&mut write, &resp).await?;
                        subscription = Some(rx);
                        continue;
                    }
                    let resp = self.dispatch(req).await;
                    let stop = resp
                        .result
                        .as_ref()
                        .and_then(|r| r.get("type"))
                        .and_then(|t| t.as_str())
                        == Some("stopping");
                    write_line(&mut write, &resp).await?;
                    if stop {
                        self.shutdown.notify_waiters();
                        break;
                    }
                }
                event = async {
                    match &mut subscription {
                        Some(rx) => rx.recv().await,
                        None => std::future::pending().await,
                    }
                } => {
                    match event {
                        Ok(ev) => {
                            let line = serde_json::to_string(&ev)?;
                            write.write_all(line.as_bytes()).await?;
                            write.write_all(b"\n").await?;
                            write.flush().await?;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
            }
        }
        Ok(())
    }

    async fn dispatch(&self, req: Request) -> Response {
        let id = req.id.clone();
        match self.dispatch_inner(&req.method, req.params).await {
            Ok(v) => Response::ok(id, v),
            Err(e) => {
                let msg = format!("{e:#}");
                let code = if msg.contains("not found") {
                    "not_found"
                } else if msg.contains("invalid") || msg.contains("missing") || msg.contains("empty") {
                    "invalid_params"
                } else {
                    "internal"
                };
                Response::err(id, code, msg)
            }
        }
    }

    async fn dispatch_inner(&self, method: &str, params: Value) -> Result<Value> {
        match method {
            "ping" => Ok(json!({"type":"pong","protocol":1})),
            "server.status" => {
                let sessions = self.store.list_sessions().await;
                Ok(json!({
                    "type": "server_status",
                    "sessions": sessions.len(),
                    "state_dir": self.store.state_dir().display().to_string(),
                }))
            }
            "server.stop" => Ok(json!({"type":"stopping"})),
            "session.create" => {
                let label = params.get("label").and_then(|v| v.as_str()).map(String::from);
                let cwd = params.get("cwd").and_then(|v| v.as_str()).map(String::from);
                let meta = self.store.create_session(label, cwd).await?;
                Ok(json!({"type":"session","session":meta}))
            }
            "session.list" => {
                let sessions = self.store.list_sessions().await;
                Ok(json!({"type":"sessions","sessions":sessions}))
            }
            "session.get" => {
                let id = str_param(&params, "session_id")?;
                let meta = self.store.get_session(&id).await?;
                Ok(json!({"type":"session","session":meta}))
            }
            "session.close" => {
                let id = str_param(&params, "session_id")?;
                self.store.close_session(&id).await?;
                Ok(json!({"type":"session_closed","session_id":id}))
            }
            "pane.split" => {
                let session_id = str_param(&params, "session_id")?;
                let direction = params
                    .get("direction")
                    .and_then(|v| v.as_str())
                    .unwrap_or("right")
                    .to_string();
                let ratio = params.get("ratio").and_then(|v| v.as_f64()).map(|f| f as f32);
                let cols = u16_param(&params, "cols", 80);
                let rows = u16_param(&params, "rows", 24);
                let (command, env) = command_and_env(&params)?;
                let meta = self
                    .store
                    .create_pane(&session_id, Some(SplitMeta { direction, ratio }), cols, rows, command, env)
                    .await?;
                Ok(json!({"type":"pane","pane":meta}))
            }
            "pane.create" => {
                // New root pane in an existing session (v1: same as split w/o direction).
                let session_id = str_param(&params, "session_id")?;
                let cols = u16_param(&params, "cols", 80);
                let rows = u16_param(&params, "rows", 24);
                let (command, env) = command_and_env(&params)?;
                let meta = self.store.create_pane(&session_id, None, cols, rows, command, env).await?;
                Ok(json!({"type":"pane","pane":meta}))
            }
            "pane.list" => {
                let session_id = str_param(&params, "session_id")?;
                let panes = self.store.list_panes(&session_id).await?;
                Ok(json!({"type":"panes","panes":panes}))
            }
            "pane.get" => {
                let pane_id = str_param(&params, "pane_id")?;
                let (sid, pane) = self.store.get_pane(&pane_id).await?;
                let p = pane.lock().await;
                let bottom = SessionStore::screen_bottom(&p, 5);
                Ok(json!({
                    "type": "pane_info",
                    "session_id": sid,
                    "pane": p.meta,
                    "agent": p.detector.agent,
                    "agent_state": p.detector.state(!p.meta.process_running, &bottom).to_string(),
                }))
            }
            "pane.run" => {
                let pane_id = str_param(&params, "pane_id")?;
                // Accept argv array (preferred) or a shell-style string.
                let argv: Vec<String> = match params.get("command") {
                    Some(Value::Array(arr)) => arr
                        .iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect(),
                    Some(Value::String(s)) => crate::session::tokenize_command(s),
                    _ => anyhow::bail!("missing param: command"),
                };
                anyhow::ensure!(!argv.is_empty(), "empty command");
                let env: std::collections::HashMap<String, String> = params
                    .get("env")
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                    .unwrap_or_default();
                let meta = self.store.run_in_pane(&pane_id, argv, env).await?;
                Ok(json!({"type":"pane","pane":meta}))
            }
            "pane.send_input" => {
                let pane_id = str_param(&params, "pane_id")?;
                let data = str_param(&params, "data")?;
                self.store.send_input(&pane_id, data.as_bytes()).await?;
                Ok(json!({"type":"sent","pane_id":pane_id}))
            }
            "pane.read" => {
                let pane_id = str_param(&params, "pane_id")?;
                let lines = params
                    .get("lines")
                    .and_then(|v| v.as_u64())
                    .map(|n| n as usize);
                let source = params
                    .get("source")
                    .and_then(|v| v.as_str())
                    .unwrap_or("scrollback");
                let text = match source {
                    "scrollback" | "recent" => self.store.read_pane(&pane_id, lines).await?,
                    "screen" | "visible" => self.store.read_screen(&pane_id, lines).await?,
                    other => anyhow::bail!("invalid source: {other}"),
                };
                Ok(json!({"type":"pane_output","pane_id":pane_id,"source":source,"output":text}))
            }
            "pane.send_verified" => {
                let pane_id = str_param(&params, "pane_id")?;
                let data = str_param(&params, "data")?;
                let timeout_ms = params
                    .get("timeout_ms")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(10_000);
                self.store
                    .send_verified(&pane_id, &data, std::time::Duration::from_millis(timeout_ms))
                    .await?;
                Ok(json!({"type":"sent","pane_id":pane_id,"verified":true}))
            }
            "wait.file" => {
                let path = str_param(&params, "path")?;
                let timeout_ms = params
                    .get("timeout_ms")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(3_600_000);
                let found = self
                    .store
                    .wait_file(&path, std::time::Duration::from_millis(timeout_ms))
                    .await;
                Ok(json!({"type":"wait_file","path":path,"found":found}))
            }
            "pane.resize" => {
                let pane_id = str_param(&params, "pane_id")?;
                let cols = u16_param(&params, "cols", 80);
                let rows = u16_param(&params, "rows", 24);
                self.store.resize_pane(&pane_id, cols, rows).await?;
                Ok(json!({"type":"resized","pane_id":pane_id,"cols":cols,"rows":rows}))
            }
            "pane.close" => {
                let pane_id = str_param(&params, "pane_id")?;
                self.store.close_pane(&pane_id).await?;
                Ok(json!({"type":"pane_closed","pane_id":pane_id}))
            }
            "agent.list" => {
                let agents = self.store.list_agents().await;
                Ok(json!({"type":"agents","agents":agents}))
            }
            "agent.state" => {
                let pane_id = str_param(&params, "pane_id")?;
                let state = self.store.agent_state(&pane_id).await?;
                Ok(json!({"type":"agent_state","agent":state}))
            }
            other => Err(anyhow::anyhow!("unknown method: {other}")),
        }
    }
}

fn str_param(params: &Value, key: &str) -> Result<String> {
    params
        .get(key)
        .and_then(|v| v.as_str())
        .map(String::from)
        .ok_or_else(|| anyhow::anyhow!("missing param: {key}"))
}

/// Optional `command` (argv array or shell string) + `env` params.
fn command_and_env(
    params: &Value,
) -> Result<(Option<Vec<String>>, std::collections::HashMap<String, String>)> {
    let argv: Option<Vec<String>> = match params.get("command") {
        Some(Value::Array(arr)) => Some(
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect(),
        ),
        Some(Value::String(s)) => Some(crate::session::tokenize_command(s)),
        _ => None,
    };
    let env = params
        .get("env")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    Ok((argv, env))
}

fn u16_param(params: &Value, key: &str, default: u16) -> u16 {
    params
        .get(key)
        .and_then(|v| v.as_u64())
        .map(|n| n as u16)
        .unwrap_or(default)
}

async fn write_line(
    write: &mut tokio::net::unix::OwnedWriteHalf,
    resp: &Response,
) -> Result<()> {
    let mut line = serde_json::to_string(resp)?;
    line.push('\n');
    write.write_all(line.as_bytes()).await?;
    write.flush().await?;
    Ok(())
}
