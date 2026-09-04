//! Outbound paired-runtime relay.
//!
//! Runtimes connect outward over WebSocket. A Clerk-authenticated browser may
//! relay a scoped request only to a runtime owned by the same user. Gizzi and
//! the operator API remain private on the runtime's loopback interface.
//!
//! Wake-on-demand: when a browser targets a device backed by a stopped hosted
//! runtime, the relay starts its container and then polls the relay hub for
//! the daemon to reconnect (bounded by [`WAKE_WAIT_TIMEOUT`]). Polling was
//! chosen over an immediate "warming" response because it needs no client
//! protocol change on the common path — a stopped container typically
//! reconnects in a few seconds, so the request simply completes slower. If the
//! wait times out, the proxy answers 503 `runtime_warming` so the client can
//! retry, and socket-ticket creation answers 503 with a warming message.
//!
//! ## Socket tunnel protocol (node-side contract)
//!
//! `SocketOpen` / `SocketReady` / `SocketData` / `SocketClose` tunnel a
//! browser WebSocket through the runtime's outbound relay connection to a
//! WebSocket endpoint on the runtime's loopback API (:8013). This is how
//! WS-only data-plane endpoints (e.g. `GET /api/v1/beta/sessions/:id/events/ws`)
//! are exposed on the control plane. All envelopes are JSON text frames tagged
//! with `{ "type": <snake_case> }`:
//!
//! cloud → runtime (on the relay WebSocket):
//! - `{"type":"socket_open","socket_id":"…","path":"/api/v1/…","headers":{}}`
//! - `{"type":"socket_data","socket_id":"…","body":"…","body_encoding":"utf8"|"base64"}`
//! - `{"type":"socket_close","socket_id":"…","code":1000,"reason":"…"}`
//!
//! runtime → cloud:
//! - `{"type":"socket_ready","socket_id":"…"}` — the local WS dial succeeded
//! - `{"type":"socket_data","socket_id":"…","body":"…","body_encoding":"utf8"|"base64"}`
//! - `{"type":"socket_close","socket_id":"…","code":1000,"reason":"…"}`
//!
//! Semantics: after `socket_open` the node dials `ws://127.0.0.1:8013{path}`
//! (path includes any query string), answers `socket_ready` once the local
//! dial completes, then forwards frames in both directions until either side
//! closes (`socket_close` carries the code/reason). Reference node
//! implementation: `cmd/agent-daemon/src/index.ts` (`handleRelaySocketOpen`).
//!
//! Browser-facing WS endpoints cannot set an `Authorization` header, so a
//! browser first mints a short-lived socket ticket via a Clerk-authed POST
//! ([`issue_socket_ticket`] — either the explicit
//! `POST /api/v1/runtime-devices/:id/socket-ticket` or a namespace ticket
//! route such as `POST /api/v1/beta/sessions/:id/events/ws-ticket`) and then
//! connects with `?ticket=…`; the upgrade is redeemed by
//! [`upgrade_with_socket_ticket`].

use axum::{
    body::Body,
    extract::{
        ws::{Message, WebSocket},
        Path, Query, State, WebSocketUpgrade,
    },
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    convert::Infallible,
    sync::{Arc, OnceLock},
    time::{Duration, Instant},
};
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

use super::runtime_pairing::authenticate_runtime_token;
use crate::{ApiError, ApiState};

const RELAY_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_RELAY_BODY_BYTES: usize = 5 * 1024 * 1024;
const WAKE_WAIT_TIMEOUT: Duration = Duration::from_secs(30);
const WAKE_POLL_INTERVAL: Duration = Duration::from_millis(500);

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum RuntimeMessage {
    Authenticate {
        runtime_id: String,
        device_token: String,
    },
    Response {
        request_id: String,
        status: u16,
        #[serde(default)]
        headers: HashMap<String, String>,
        #[serde(default)]
        body: String,
        #[serde(default)]
        body_encoding: String,
    },
    ResponseStart {
        request_id: String,
        status: u16,
        #[serde(default)]
        headers: HashMap<String, String>,
    },
    ResponseChunk {
        request_id: String,
        #[serde(default)]
        body: String,
        #[serde(default)]
        body_encoding: String,
    },
    ResponseEnd {
        request_id: String,
    },
    SocketReady {
        socket_id: String,
    },
    SocketData {
        socket_id: String,
        #[serde(default)]
        body: String,
        #[serde(default)]
        body_encoding: String,
    },
    SocketClose {
        socket_id: String,
        #[serde(default)]
        code: u16,
        #[serde(default)]
        reason: String,
    },
    Pong,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub(crate) enum CloudMessage {
    Authenticated {
        runtime_id: String,
    },
    Request {
        request_id: String,
        method: String,
        path: String,
        headers: HashMap<String, String>,
        body: String,
        body_encoding: String,
    },
    SocketOpen {
        socket_id: String,
        path: String,
        headers: HashMap<String, String>,
    },
    SocketData {
        socket_id: String,
        body: String,
        body_encoding: String,
    },
    SocketClose {
        socket_id: String,
        code: u16,
        reason: String,
    },
    Ping,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserProxyRequest {
    method: String,
    path: String,
    #[serde(default)]
    headers: HashMap<String, String>,
    #[serde(default)]
    body: String,
    #[serde(default)]
    body_encoding: String,
}

struct RelayHead {
    status: u16,
    headers: HashMap<String, String>,
}

struct PendingRelay {
    head: Option<oneshot::Sender<RelayHead>>,
    chunks: mpsc::Sender<Result<Bytes, Infallible>>,
}

pub(crate) struct RuntimeConnection {
    sender: mpsc::UnboundedSender<CloudMessage>,
    pending: Mutex<HashMap<String, PendingRelay>>,
    /// Per-tunneled-socket frame channels, keyed by the `socket_id` the cloud
    /// assigned in `socket_open`. The pump task for each browser socket
    /// registers here; inbound `socket_data`/`socket_close` envelopes are
    /// routed through it.
    pub(crate) sockets: Mutex<HashMap<String, mpsc::UnboundedSender<RuntimeSocketFrame>>>,
}

#[derive(Debug)]
pub(crate) enum RuntimeSocketFrame {
    Ready,
    Data(Bytes, bool),
    Close(u16, String),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSocketTicketRequest {
    path: String,
}

#[derive(Debug, Deserialize)]
struct SocketTicketQuery {
    ticket: String,
}

/// A minted, single-use browser socket ticket (see [`issue_socket_ticket`]).
pub(crate) struct SocketTicket {
    pub(crate) runtime_id: String,
    pub(crate) path: String,
    expires_at: Instant,
}

type RelayHub = RwLock<HashMap<String, Arc<RuntimeConnection>>>;

fn relay_hub() -> &'static RelayHub {
    static HUB: OnceLock<RelayHub> = OnceLock::new();
    HUB.get_or_init(|| RwLock::new(HashMap::new()))
}

/// Result of resolving a runtime's relay connection, with wake-on-demand.
enum RelayConnect {
    /// The runtime has a live relay connection.
    Connected(Arc<RuntimeConnection>),
    /// A hosted machine start was issued but the daemon did not reconnect in
    /// time; the client should retry shortly.
    Warming,
    /// The runtime is not connected and cannot be woken.
    Offline,
}

/// Look up the runtime's relay connection, starting its hosted machine first
/// when the device maps to a stopped hosted runtime instance.
async fn connect_or_wake_runtime(
    db: &sqlx::PgPool,
    contabo_runtime_service: &std::sync::Arc<crate::services::ContaboRuntimeService>,
    quota_service: &crate::services::SharedQuotaService,
    runtime_id: &str,
) -> Result<RelayConnect, ApiError> {
    if let Some(connection) = relay_hub().read().await.get(runtime_id).cloned() {
        return Ok(RelayConnect::Connected(connection));
    }
    let outcome = crate::services::wake_hosted_runtime_for_device(
        db,
        contabo_runtime_service,
        quota_service,
        runtime_id,
    )
    .await?;
    if matches!(
        outcome,
        crate::services::HostedWakeOutcome::NotHosted
            | crate::services::HostedWakeOutcome::NotWakeable
    ) {
        return Ok(RelayConnect::Offline);
    }
    // The machine is (or was already) starting: poll the hub until the daemon
    // reconnects, bounded so a wedged boot does not pin the request.
    let deadline = Instant::now() + WAKE_WAIT_TIMEOUT;
    loop {
        if let Some(connection) = relay_hub().read().await.get(runtime_id).cloned() {
            return Ok(RelayConnect::Connected(connection));
        }
        if Instant::now() >= deadline {
            break;
        }
        tokio::time::sleep(WAKE_POLL_INTERVAL).await;
    }
    Ok(match outcome {
        crate::services::HostedWakeOutcome::Waking => RelayConnect::Warming,
        _ => RelayConnect::Offline,
    })
}

fn socket_tickets() -> &'static Mutex<HashMap<String, SocketTicket>> {
    static TICKETS: OnceLock<Mutex<HashMap<String, SocketTicket>>> = OnceLock::new();
    TICKETS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/runtime-relay/connect/:id", get(connect_runtime))
        .route("/api/v1/runtime-devices/:id/proxy", post(proxy_to_runtime))
        .route(
            "/api/v1/runtime-devices/:id/socket-ticket",
            post(create_socket_ticket),
        )
        .route(
            "/api/v1/runtime-devices/:id/socket",
            get(connect_browser_socket),
        )
}

async fn connect_runtime(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ApiState>>,
    Path(runtime_id): Path<String>,
) -> Response {
    ws.on_upgrade(move |socket| runtime_socket(socket, state, runtime_id))
}

/// Mint a short-lived relay socket ticket for `path` on the runtime owned by
/// `user_id`. Shared by the explicit runtime-devices socket-ticket endpoint
/// and the control-plane namespace WS handlers (beta session events): both
/// get capability checks, path validation, and wake-on-demand exactly once,
/// here. The caller must already have resolved/authorized the user and the
/// runtime.
pub(crate) async fn issue_socket_ticket(
    state: &ApiState,
    user_id: &str,
    runtime_id: &str,
    path: String,
) -> Result<serde_json::Value, ApiError> {
    let capabilities = runtime_capabilities(&state.db, runtime_id, user_id).await?;
    if !capabilities
        .iter()
        .any(|capability| capability == "runtime:connect")
    {
        return Err(ApiError::Forbidden(
            "Runtime is not allowed to accept relayed sockets".to_string(),
        ));
    }
    let validation = RelayRequest {
        method: "GET".to_string(),
        path: path.clone(),
        headers: HashMap::new(),
        body: String::new(),
        body_encoding: "utf8".to_string(),
    };
    validate_proxy_request(&validation)?;
    let required = required_capability(&validation.path, "GET");
    if !capabilities.iter().any(|capability| capability == required) {
        return Err(ApiError::Forbidden(format!(
            "Runtime pairing does not grant {required}"
        )));
    }
    match connect_or_wake_runtime(
        &state.db,
        &state.contabo_runtime_service,
        &state.quota_service,
        runtime_id,
    )
    .await?
    {
        RelayConnect::Connected(_) => {}
        RelayConnect::Warming => {
            return Err(ApiError::ServiceUnavailable(
                "The hosted runtime is waking up; retry shortly".to_string(),
            ));
        }
        RelayConnect::Offline => {
            return Err(ApiError::ServiceUnavailable(
                "The selected runtime is offline".to_string(),
            ));
        }
    }
    services_touch_runtime(&state.db, runtime_id).await;

    let ticket = Uuid::new_v4().to_string();
    let expires_at = Instant::now() + Duration::from_secs(30);
    let mut tickets = socket_tickets().lock().await;
    tickets.retain(|_, value| value.expires_at > Instant::now());
    tickets.insert(
        ticket.clone(),
        SocketTicket {
            runtime_id: runtime_id.to_string(),
            path,
            expires_at,
        },
    );
    Ok(serde_json::json!({
        "ticket": ticket,
        "expiresInSeconds": 30,
    }))
}

/// Consume a socket ticket, discarding expired ones. Returns `None` for
/// unknown or expired tickets.
pub(crate) async fn take_socket_ticket(ticket: &str) -> Option<SocketTicket> {
    socket_tickets()
        .lock()
        .await
        .remove(ticket)
        .filter(|value| value.expires_at > Instant::now())
}

/// Redeem a validated socket ticket: resolve the runtime owner, enforce relay
/// socket quotas, and answer the WebSocket upgrade. The upgraded pump task
/// ([`browser_socket`]) tunnels frames to the runtime over its outbound relay
/// connection (`socket_open`/`socket_data`/`socket_close`, see the module
/// protocol contract).
pub(crate) async fn upgrade_with_socket_ticket(
    ws: WebSocketUpgrade,
    state: &ApiState,
    ticket: SocketTicket,
) -> Result<Response, ApiError> {
    // Resolve the runtime owner and enforce relay socket/bandwidth quotas.
    let user_id = runtime_user_id(state, &ticket.runtime_id).await?;
    let quota = state.quota_service.ensure_quota(&user_id).await?;
    state
        .quota_service
        .check_relay_socket_allowed(&user_id, &quota)
        .await?;
    let relay_socket_id = state
        .quota_service
        .open_relay_socket(&ticket.runtime_id, &ticket.path)
        .await?;
    let quota_service = state.quota_service.clone();
    let db = state.db.clone();

    Ok(ws.on_upgrade(move |socket| {
        browser_socket(
            socket,
            ticket.runtime_id,
            ticket.path,
            relay_socket_id,
            quota_service,
            db,
        )
    }))
}

/// Register a fake runtime connection in the relay hub and hand back its
/// outbound envelope stream, so tests can drive the socket tunnel without a
/// real daemon on the other end. Returns the connection (its `sockets` map
/// carries the per-tunnel frame channels the pump registers) and the receiver
/// for every cloud → node envelope.
#[cfg(test)]
pub(crate) async fn register_test_connection(
    runtime_id: &str,
) -> (
    Arc<RuntimeConnection>,
    mpsc::UnboundedReceiver<CloudMessage>,
) {
    let (sender, outgoing) = mpsc::unbounded_channel();
    let connection = Arc::new(RuntimeConnection {
        sender,
        pending: Mutex::new(HashMap::new()),
        sockets: Mutex::new(HashMap::new()),
    });
    relay_hub()
        .write()
        .await
        .insert(runtime_id.to_string(), connection.clone());
    (connection, outgoing)
}

async fn create_socket_ticket(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(runtime_id): Path<String>,
    Json(request): Json<CreateSocketTicketRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = crate::auth::resolve_user_scoped(&state.db, &headers, "compute")
        .await?
        .id;
    let ticket = issue_socket_ticket(&state, &user_id, &runtime_id, request.path).await?;
    Ok(Json(ticket))
}

async fn connect_browser_socket(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ApiState>>,
    Path(runtime_id): Path<String>,
    Query(query): Query<SocketTicketQuery>,
) -> Result<Response, ApiError> {
    let ticket = take_socket_ticket(&query.ticket)
        .await
        .filter(|value| value.runtime_id == runtime_id)
        .ok_or_else(|| {
            ApiError::Unauthorized("Invalid or expired runtime socket ticket".to_string())
        })?;
    upgrade_with_socket_ticket(ws, &state, ticket).await
}

/// Map one inbound browser WebSocket message to its relay envelope. Text and
/// binary payloads become `socket_data` frames (binary base64-encoded — the
/// protocol's only wire encoding for non-UTF8 payloads); protocol control
/// frames (ping/pong/close) are answered or terminated by the pump loop
/// itself and map to `None`.
fn browser_frame_to_cloud(socket_id: &str, message: &Message) -> Option<CloudMessage> {
    match message {
        Message::Text(body) => Some(CloudMessage::SocketData {
            socket_id: socket_id.to_string(),
            body: body.clone(),
            body_encoding: "utf8".to_string(),
        }),
        Message::Binary(body) => Some(CloudMessage::SocketData {
            socket_id: socket_id.to_string(),
            body: STANDARD.encode(body),
            body_encoding: "base64".to_string(),
        }),
        _ => None,
    }
}

/// Map one runtime socket frame to the browser WebSocket message that carries
/// it. `Ready` is the tunnel handshake sentinel (`allternit_socket_ready`);
/// `Close` closes the browser socket.
fn runtime_frame_to_browser_message(frame: &RuntimeSocketFrame) -> Message {
    match frame {
        RuntimeSocketFrame::Ready => {
            Message::Text("{\"type\":\"allternit_socket_ready\"}".to_string())
        }
        RuntimeSocketFrame::Data(body, true) => Message::Binary(body.to_vec()),
        RuntimeSocketFrame::Data(body, false) => {
            Message::Text(String::from_utf8_lossy(body).into_owned())
        }
        RuntimeSocketFrame::Close(..) => Message::Close(None),
    }
}

async fn browser_socket(
    socket: WebSocket,
    runtime_id: String,
    path: String,
    relay_socket_id: String,
    quota_service: crate::services::SharedQuotaService,
    db: sqlx::PgPool,
) {
    let connection = relay_hub().read().await.get(&runtime_id).cloned();
    let Some(connection) = connection else {
        let _ = quota_service.close_relay_socket(&relay_socket_id, 0).await;
        return;
    };
    let _ = crate::services::touch_runtime_activity(&db, &runtime_id).await;
    let mut last_activity_write = Instant::now();
    let socket_id = Uuid::new_v4().to_string();
    let (runtime_sender, mut runtime_events) = mpsc::unbounded_channel();
    connection
        .sockets
        .lock()
        .await
        .insert(socket_id.clone(), runtime_sender);
    if connection
        .sender
        .send(CloudMessage::SocketOpen {
            socket_id: socket_id.clone(),
            path,
            headers: HashMap::new(),
        })
        .is_err()
    {
        connection.sockets.lock().await.remove(&socket_id);
        let _ = quota_service.close_relay_socket(&relay_socket_id, 0).await;
        return;
    }

    let mut egress_bytes: i64 = 0;
    let (mut sink, mut stream) = socket.split();
    loop {
        tokio::select! {
            browser = stream.next() => {
                match browser {
                    Some(Ok(message)) => match message {
                        Message::Text(_) | Message::Binary(_) => {
                            if last_activity_write.elapsed() >= Duration::from_secs(60) {
                                let _ = crate::services::touch_runtime_activity(&db, &runtime_id).await;
                                last_activity_write = Instant::now();
                            }
                            if let Some(outbound) = browser_frame_to_cloud(&socket_id, &message) {
                                let _ = connection.sender.send(outbound);
                            }
                        }
                        Message::Ping(body) => {
                            if sink.send(Message::Pong(body)).await.is_err() { break; }
                        }
                        Message::Close(_) => break,
                        _ => {}
                    },
                    Some(Err(_)) | None => break,
                }
            }
            runtime = runtime_events.recv() => {
                let Some(frame) = runtime else {
                    let _ = sink.send(Message::Close(None)).await;
                    break;
                };
                if let RuntimeSocketFrame::Data(body, _) = &frame {
                    if last_activity_write.elapsed() >= Duration::from_secs(60) {
                        let _ = crate::services::touch_runtime_activity(&db, &runtime_id).await;
                        last_activity_write = Instant::now();
                    }
                    egress_bytes += body.len() as i64;
                }
                let is_close = matches!(frame, RuntimeSocketFrame::Close(..));
                if sink.send(runtime_frame_to_browser_message(&frame)).await.is_err() || is_close {
                    break;
                }
            }
        }
    }

    connection.sockets.lock().await.remove(&socket_id);
    let _ = connection.sender.send(CloudMessage::SocketClose {
        socket_id,
        code: 1000,
        reason: "Browser disconnected".to_string(),
    });

    // Best-effort accounting: record socket close and egress bytes.
    let _ = quota_service
        .close_relay_socket(&relay_socket_id, egress_bytes)
        .await;
}

async fn runtime_socket(socket: WebSocket, state: Arc<ApiState>, expected_id: String) {
    let (mut sink, mut stream) = socket.split();
    let auth_message = match tokio::time::timeout(Duration::from_secs(10), stream.next()).await {
        Ok(Some(Ok(Message::Text(text)))) => serde_json::from_str::<RuntimeMessage>(&text).ok(),
        _ => None,
    };
    let (runtime_id, device_token) = match auth_message {
        Some(RuntimeMessage::Authenticate {
            runtime_id,
            device_token,
        }) if runtime_id == expected_id => (runtime_id, device_token),
        _ => {
            let _ = sink.send(Message::Close(None)).await;
            return;
        }
    };
    if authenticate_runtime_token(&state, &device_token, &runtime_id)
        .await
        .is_err()
    {
        let _ = sink.send(Message::Close(None)).await;
        return;
    }
    let hosted_instance_id: Option<String> = sqlx::query_scalar(
        "SELECT id FROM hosted_runtime_instances WHERE runtime_device_id = $1 AND status != 'destroyed'",
    )
    .bind(&runtime_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();
    if let Some(instance_id) = hosted_instance_id {
        let _ = sqlx::query(
            "UPDATE hosted_runtime_instances SET status = 'running', active_since = COALESCE(active_since, CURRENT_TIMESTAMP), last_activity_at = COALESCE(last_activity_at, CURRENT_TIMESTAMP), last_synced_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(&instance_id)
        .execute(&state.db)
        .await;
        let _ = crate::services::record_runtime_started(&state.db, &instance_id).await;
    }

    let (sender, mut outgoing) = mpsc::unbounded_channel();
    let connection = Arc::new(RuntimeConnection {
        sender,
        pending: Mutex::new(HashMap::new()),
        sockets: Mutex::new(HashMap::new()),
    });
    relay_hub()
        .write()
        .await
        .insert(runtime_id.clone(), connection.clone());
    // Stamp the relay attach so DB-side liveness signals reflect it:
    // migration 011 added runtime_devices.relay_connected_at for exactly this
    // ("last outbound WS relay attach") but nothing wrote it until now. It is
    // cleared on detach below.
    let _ = sqlx::query(
        "UPDATE runtime_devices SET relay_connected_at = CURRENT_TIMESTAMP WHERE id = $1",
    )
    .bind(&runtime_id)
    .execute(&state.db)
    .await;
    let authenticated = CloudMessage::Authenticated {
        runtime_id: runtime_id.clone(),
    };
    if sink
        .send(Message::Text(
            serde_json::to_string(&authenticated).unwrap(),
        ))
        .await
        .is_err()
    {
        relay_hub().write().await.remove(&runtime_id);
        return;
    }

    let mut ping = tokio::time::interval(Duration::from_secs(25));
    loop {
        tokio::select! {
            outbound = outgoing.recv() => {
                let Some(outbound) = outbound else { break; };
                let Ok(text) = serde_json::to_string(&outbound) else { continue; };
                if sink.send(Message::Text(text)).await.is_err() { break; }
            }
            inbound = stream.next() => {
                match inbound {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<RuntimeMessage>(&text) {
                            Ok(RuntimeMessage::ResponseStart { request_id, status, headers }) => {
                                if let Some(pending) = connection.pending.lock().await.get_mut(&request_id) {
                                    if let Some(waiter) = pending.head.take() {
                                        let _ = waiter.send(RelayHead { status, headers });
                                    }
                                }
                            }
                            Ok(RuntimeMessage::ResponseChunk { request_id, body, body_encoding }) => {
                                let chunks = connection
                                    .pending
                                    .lock()
                                    .await
                                    .get(&request_id)
                                    .map(|pending| pending.chunks.clone());
                                if let Some(chunks) = chunks {
                                    let bytes = decode_relay_body(&body, &body_encoding);
                                    let _ = chunks.send(Ok(bytes)).await;
                                }
                            }
                            Ok(RuntimeMessage::ResponseEnd { request_id }) => {
                                connection.pending.lock().await.remove(&request_id);
                            }
                            // Backward compatibility for a runtime that reconnects
                            // during a rolling deployment with the buffered protocol.
                            Ok(RuntimeMessage::Response { request_id, status, headers, body, body_encoding }) => {
                                if let Some(mut pending) = connection.pending.lock().await.remove(&request_id) {
                                    if let Some(waiter) = pending.head.take() {
                                        let _ = waiter.send(RelayHead { status, headers });
                                    }
                                    let _ = pending.chunks.send(Ok(decode_relay_body(&body, &body_encoding))).await;
                                }
                            }
                            Ok(RuntimeMessage::SocketReady { socket_id }) => {
                                let sender = connection.sockets.lock().await.get(&socket_id).cloned();
                                if let Some(sender) = sender {
                                    let _ = sender.send(RuntimeSocketFrame::Ready);
                                }
                            }
                            Ok(RuntimeMessage::SocketData { socket_id, body, body_encoding }) => {
                                let sender = connection.sockets.lock().await.get(&socket_id).cloned();
                                if let Some(sender) = sender {
                                    let is_binary = body_encoding == "base64";
                                    let _ = sender.send(RuntimeSocketFrame::Data(
                                        decode_relay_body(&body, &body_encoding),
                                        is_binary,
                                    ));
                                }
                            }
                            Ok(RuntimeMessage::SocketClose { socket_id, code, reason }) => {
                                let sender = connection.sockets.lock().await.remove(&socket_id);
                                if let Some(sender) = sender {
                                    let _ = sender.send(RuntimeSocketFrame::Close(code, reason));
                                }
                            }
                            _ => {}
                        }
                    }
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    _ => {}
                }
            }
            _ = ping.tick() => {
                let Ok(text) = serde_json::to_string(&CloudMessage::Ping) else { continue; };
                if sink.send(Message::Text(text)).await.is_err() { break; }
            }
        }
    }

    let mut hub = relay_hub().write().await;
    if hub
        .get(&runtime_id)
        .map(|current| Arc::ptr_eq(current, &connection))
        .unwrap_or(false)
    {
        hub.remove(&runtime_id);
    }
    drop(hub);
    // Relay detached: clear the liveness stamp (best-effort; the timestamp is
    // advisory, the in-memory hub remains the authoritative lookup).
    let _ = sqlx::query("UPDATE runtime_devices SET relay_connected_at = NULL WHERE id = $1")
        .bind(&runtime_id)
        .execute(&state.db)
        .await;
    connection.pending.lock().await.clear();
    let sockets = std::mem::take(&mut *connection.sockets.lock().await);
    for (_, sender) in sockets {
        let _ = sender.send(RuntimeSocketFrame::Close(
            1012,
            "Runtime disconnected".to_string(),
        ));
    }
}

async fn proxy_to_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(runtime_id): Path<String>,
    Json(request): Json<BrowserProxyRequest>,
) -> Result<Response, ApiError> {
    let user_id = crate::auth::resolve_user_scoped(&state.db, &headers, "compute")
        .await?
        .id;
    relay_request_to_runtime(
        &state.db,
        &state.contabo_runtime_service,
        &state.quota_service,
        &user_id,
        &runtime_id,
        RelayRequest {
            method: request.method,
            path: request.path,
            headers: request.headers,
            body: request.body,
            body_encoding: request.body_encoding,
        },
    )
    .await
}

/// A single request to relay to a runtime over its outbound WebSocket.
/// `headers` are the caller's raw headers; [`filtered_headers`] is applied
/// inside the relay so every relay entry point enforces the same allow-list.
pub struct RelayRequest {
    pub method: String,
    pub path: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub body_encoding: String,
}

/// Relay one allow-listed request to a user-owned runtime and stream the
/// response back. This is the shared machinery behind both the explicit
/// `POST /api/v1/runtime-devices/:id/proxy` browser proxy and the
/// control-plane namespace handlers (routes::agent_sessions): ownership +
/// capability checks, path validation, wake-on-demand, and the
/// `Body::from_stream` chunked response all live here exactly once.
pub(crate) async fn relay_request_to_runtime(
    db: &sqlx::PgPool,
    contabo_runtime_service: &std::sync::Arc<crate::services::ContaboRuntimeService>,
    quota_service: &crate::services::SharedQuotaService,
    user_id: &str,
    runtime_id: &str,
    request: RelayRequest,
) -> Result<Response, ApiError> {
    let capabilities = runtime_capabilities(db, runtime_id, user_id).await?;
    if !capabilities
        .iter()
        .any(|capability| capability == "runtime:connect")
    {
        return Err(ApiError::Forbidden(
            "Runtime is not allowed to accept relayed requests".to_string(),
        ));
    }
    validate_proxy_request(&request)?;
    let required_capability = required_capability(&request.path, &request.method);
    if !capabilities
        .iter()
        .any(|capability| capability == required_capability)
    {
        return Err(ApiError::Forbidden(format!(
            "Runtime pairing does not grant {required_capability}"
        )));
    }
    services_touch_runtime(db, runtime_id).await;

    let connection = match connect_or_wake_runtime(
        db,
        contabo_runtime_service,
        quota_service,
        runtime_id,
    )
    .await?
    {
        RelayConnect::Connected(connection) => connection,
        RelayConnect::Warming => {
            return Ok((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({ "error": "runtime_warming", "message": "The hosted runtime is waking up; retry shortly", "retryAfterSeconds": WAKE_WAIT_TIMEOUT.as_secs() })),
            ).into_response());
        }
        RelayConnect::Offline => {
            return Ok((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({ "error": "runtime_offline", "message": "The selected runtime is offline" })),
            ).into_response());
        }
    };
    let request_id = Uuid::new_v4().to_string();
    let response_timeout = if request.path.starts_with("/api/v1/providers/video/generate") {
        Duration::from_secs(340)
    } else {
        RELAY_TIMEOUT
    };
    let (head_sender, head_receiver) = oneshot::channel();
    let (chunk_sender, chunk_receiver) = mpsc::channel(32);
    connection.pending.lock().await.insert(
        request_id.clone(),
        PendingRelay {
            head: Some(head_sender),
            chunks: chunk_sender,
        },
    );
    let message = CloudMessage::Request {
        request_id: request_id.clone(),
        method: request.method.to_ascii_uppercase(),
        path: request.path,
        headers: filtered_headers(request.headers),
        body: request.body,
        body_encoding: request.body_encoding,
    };
    if connection.sender.send(message).is_err() {
        connection.pending.lock().await.remove(&request_id);
        return Ok((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "runtime_offline" })),
        )
            .into_response());
    }

    match tokio::time::timeout(response_timeout, head_receiver).await {
        Ok(Ok(head)) => {
            let status = StatusCode::from_u16(head.status).unwrap_or(StatusCode::BAD_GATEWAY);
            let mut response = axum::http::Response::builder().status(status);
            if let Some(headers) = response.headers_mut() {
                for (name, value) in filtered_response_headers(head.headers) {
                    if let (Ok(name), Ok(value)) =
                        (HeaderName::try_from(name), HeaderValue::try_from(value))
                    {
                        headers.insert(name, value);
                    }
                }
            }
            Ok(response
                .body(Body::from_stream(ReceiverStream::new(chunk_receiver)))
                .unwrap_or_else(|_| {
                    (StatusCode::BAD_GATEWAY, "Invalid runtime response").into_response()
                }))
        }
        _ => {
            connection.pending.lock().await.remove(&request_id);
            Ok((
                StatusCode::GATEWAY_TIMEOUT,
                Json(serde_json::json!({ "error": "runtime_timeout" })),
            )
                .into_response())
        }
    }
}

async fn services_touch_runtime(db: &sqlx::PgPool, runtime_id: &str) {
    if let Err(error) = crate::services::touch_runtime_activity(db, runtime_id).await {
        tracing::debug!(%runtime_id, "Unable to record hosted runtime activity: {}", error);
    }
}

async fn runtime_capabilities(
    db: &sqlx::PgPool,
    runtime_id: &str,
    user_id: &str,
) -> Result<Vec<String>, ApiError> {
    let capabilities = sqlx::query_scalar::<_, String>(
        "SELECT capabilities FROM runtime_devices WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND credential_expires_at > CURRENT_TIMESTAMP",
    )
    .bind(runtime_id)
    .bind(user_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| ApiError::NotFound("Runtime not found".to_string()))?;
    Ok(serde_json::from_str(&capabilities).unwrap_or_default())
}

async fn runtime_user_id(state: &ApiState, runtime_id: &str) -> Result<String, ApiError> {
    sqlx::query_scalar::<_, String>(
        "SELECT user_id FROM runtime_devices WHERE id = $1 AND revoked_at IS NULL",
    )
    .bind(runtime_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("Runtime not found".to_string()))
}

fn decode_relay_body(body: &str, encoding: &str) -> Bytes {
    if encoding == "base64" {
        Bytes::from(STANDARD.decode(body).unwrap_or_default())
    } else {
        Bytes::copy_from_slice(body.as_bytes())
    }
}

fn filtered_response_headers(headers: HashMap<String, String>) -> HashMap<String, String> {
    headers
        .into_iter()
        .filter(|(name, _)| {
            matches!(
                name.to_ascii_lowercase().as_str(),
                "content-type"
                    | "cache-control"
                    | "content-disposition"
                    | "etag"
                    | "last-modified"
                    | "x-request-id"
            )
        })
        .collect()
}

fn validate_proxy_request(request: &RelayRequest) -> Result<(), ApiError> {
    let method = request.method.to_ascii_uppercase();
    if !matches!(method.as_str(), "GET" | "POST" | "PUT" | "PATCH" | "DELETE") {
        return Err(ApiError::BadRequest("Unsupported relay method".to_string()));
    }
    if !request.path.starts_with('/')
        || request.path.starts_with("//")
        || request.path.contains("..")
        || request.path.contains("://")
    {
        return Err(ApiError::BadRequest("Invalid runtime path".to_string()));
    }
    if !is_allowed_runtime_path(&request.path) {
        return Err(ApiError::Forbidden(
            "Runtime path is outside the allowed gateway surface".to_string(),
        ));
    }
    let estimated_size = if request.body_encoding == "base64" {
        request.body.len() * 3 / 4
    } else {
        request.body.len()
    };
    if estimated_size > MAX_RELAY_BODY_BYTES {
        return Err(ApiError::BadRequest("Relay body is too large".to_string()));
    }
    Ok(())
}

fn is_allowed_runtime_path(path: &str) -> bool {
    const PREFIXES: &[&str] = &[
        "/api",
        "/viz",
        "/sandbox",
        "/vm-session",
        "/rails",
        "/stream",
        "/terminal",
        "/mcp",
        "/platform",
        "/metrics",
        "/alabs",
        "/cowork",
        "/webhooks",
        "/ws",
        "/panes",
        "/status",
        "/health",
        // gizzi-code mirrors its entire route surface under /v1/*, so this one
        // prefix covers BYO-VPS boxes (pty, sessions, events, instance, ...).
        "/v1",
    ];
    PREFIXES.iter().any(|prefix| {
        path == *prefix
            || path
                .strip_prefix(prefix)
                .map(|suffix| suffix.starts_with('/') || suffix.starts_with('?'))
                .unwrap_or(false)
    })
}

fn required_capability(path: &str, method: &str) -> &'static str {
    let normalized = path.to_ascii_lowercase();
    if normalized == "/health"
        || normalized.starts_with("/health?")
        || normalized == "/status"
        || normalized.starts_with("/status?")
        || normalized == "/metrics"
        || normalized.starts_with("/metrics?")
    {
        return "runtime:connect";
    }
    if normalized.contains("provider") || normalized.contains("/onboarding/provider") {
        return if method.eq_ignore_ascii_case("GET") {
            "providers:use"
        } else {
            "providers:connect"
        };
    }
    if normalized.contains("terminal")
        || normalized.contains("/pty")
        || normalized.starts_with("/panes")
    {
        return "runtime:terminal";
    }
    if normalized.contains("/files")
        || normalized.contains("/file/")
        || normalized.contains("workspace")
    {
        return "runtime:files";
    }
    if normalized.contains("remote-control") {
        return "runtime:remote_control";
    }
    "runtime:execute"
}

fn filtered_headers(headers: HashMap<String, String>) -> HashMap<String, String> {
    headers
        .into_iter()
        .filter(|(name, _)| {
            matches!(
                name.to_ascii_lowercase().as_str(),
                // The caller is already Clerk-authenticated on this route, so
                // forwarding their Authorization lets the box's gizzi-code
                // validate the end user's JWT instead of 401-ing every relayed
                // request behind GIZZI_REQUIRE_CLERK_AUTH.
                "authorization"
                    | "accept"
                    | "content-type"
                    | "if-none-match"
                    | "if-modified-since"
                    | "last-event-id"
                    | "x-request-id"
            )
        })
        .collect()
}

/// Collect an inbound HTTP request's headers into the string map the relay
/// protocol carries. Nothing is filtered here — the allow-list is applied by
/// [`filtered_headers`] inside `relay_request_to_runtime`, so every relay
/// entry point (browser proxy, namespace handlers) shares one enforcement
/// point.
pub(crate) fn relay_headers_from_http(headers: &HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.to_string(), value.to_string()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browser_text_frames_encode_as_utf8_socket_data() {
        let message = Message::Text("{\"seq\":1}".to_string());
        let outbound = browser_frame_to_cloud("sock_1", &message).expect("text must relay");
        let json = serde_json::to_value(&outbound).unwrap();
        assert_eq!(json["type"], "socket_data");
        assert_eq!(json["socket_id"], "sock_1");
        assert_eq!(json["body"], "{\"seq\":1}");
        assert_eq!(json["body_encoding"], "utf8");
    }

    #[test]
    fn browser_binary_frames_encode_as_base64_socket_data() {
        let message = Message::Binary(vec![0x01, 0x02, 0x03]);
        let outbound = browser_frame_to_cloud("sock_1", &message).expect("binary must relay");
        let json = serde_json::to_value(&outbound).unwrap();
        assert_eq!(json["type"], "socket_data");
        assert_eq!(json["body"], STANDARD.encode([0x01, 0x02, 0x03]));
        assert_eq!(json["body_encoding"], "base64");
    }

    #[test]
    fn browser_control_frames_have_no_relay_envelope() {
        assert!(browser_frame_to_cloud("sock_1", &Message::Ping(Vec::new())).is_none());
        assert!(browser_frame_to_cloud("sock_1", &Message::Pong(Vec::new())).is_none());
        assert!(browser_frame_to_cloud("sock_1", &Message::Close(None)).is_none());
    }

    #[test]
    fn runtime_frames_decode_to_browser_messages() {
        assert_eq!(
            runtime_frame_to_browser_message(&RuntimeSocketFrame::Ready),
            Message::Text("{\"type\":\"allternit_socket_ready\"}".to_string())
        );
        assert_eq!(
            runtime_frame_to_browser_message(&RuntimeSocketFrame::Data(
                Bytes::from_static(b"hi"),
                false
            )),
            Message::Text("hi".to_string())
        );
        assert_eq!(
            runtime_frame_to_browser_message(&RuntimeSocketFrame::Data(
                Bytes::from_static(&[0xff]),
                true
            )),
            Message::Binary(vec![0xff])
        );
        assert_eq!(
            runtime_frame_to_browser_message(&RuntimeSocketFrame::Close(1000, "bye".to_string())),
            Message::Close(None)
        );
    }

    #[test]
    fn socket_tunnel_envelopes_match_the_node_contract() {
        // Exact wire shapes consumed by the node-side relay client
        // (cmd/agent-daemon/src/index.ts) — pinned here so a serde rename or
        // field drift cannot silently break the tunnel.
        let open = serde_json::to_value(CloudMessage::SocketOpen {
            socket_id: "s".to_string(),
            path: "/api/v1/beta/sessions/x/events/ws".to_string(),
            headers: HashMap::new(),
        })
        .unwrap();
        assert_eq!(
            open,
            serde_json::json!({
                "type": "socket_open",
                "socket_id": "s",
                "path": "/api/v1/beta/sessions/x/events/ws",
                "headers": {},
            })
        );

        let ready: RuntimeMessage =
            serde_json::from_str(r#"{"type":"socket_ready","socket_id":"s"}"#).unwrap();
        assert!(matches!(ready, RuntimeMessage::SocketReady { .. }));

        let node_data: RuntimeMessage = serde_json::from_str(
            r#"{"type":"socket_data","socket_id":"s","body":"AQID","body_encoding":"base64"}"#,
        )
        .unwrap();
        match node_data {
            RuntimeMessage::SocketData {
                socket_id,
                body,
                body_encoding,
            } => {
                assert_eq!(socket_id, "s");
                assert_eq!(body, "AQID");
                assert_eq!(body_encoding, "base64");
            }
            other => panic!("expected socket_data, got {other:?}"),
        }

        let node_close: RuntimeMessage = serde_json::from_str(
            r#"{"type":"socket_close","socket_id":"s","code":1000,"reason":"done"}"#,
        )
        .unwrap();
        match node_close {
            RuntimeMessage::SocketClose {
                socket_id,
                code,
                reason,
            } => {
                assert_eq!(socket_id, "s");
                assert_eq!(code, 1000);
                assert_eq!(reason, "done");
            }
            other => panic!("expected socket_close, got {other:?}"),
        }

        let cloud_close = serde_json::to_value(CloudMessage::SocketClose {
            socket_id: "s".to_string(),
            code: 1000,
            reason: "Browser disconnected".to_string(),
        })
        .unwrap();
        assert_eq!(
            cloud_close,
            serde_json::json!({
                "type": "socket_close",
                "socket_id": "s",
                "code": 1000,
                "reason": "Browser disconnected",
            })
        );
    }

    #[test]
    fn beta_events_ws_path_passes_the_relay_allow_list() {
        // The events WS tunnels as a socket_open with this exact path; both
        // the bare path and the `after`-cursor query form must validate.
        for path in [
            "/api/v1/beta/sessions/sess_1/events/ws",
            "/api/v1/beta/sessions/sess_1/events/ws?after=42",
        ] {
            let request = RelayRequest {
                method: "GET".to_string(),
                path: path.to_string(),
                headers: HashMap::new(),
                body: String::new(),
                body_encoding: "utf8".to_string(),
            };
            assert!(
                validate_proxy_request(&request).is_ok(),
                "{path} must relay"
            );
        }
    }

    #[test]
    fn beta_events_ws_requires_the_execute_capability() {
        assert_eq!(
            required_capability("/api/v1/beta/sessions/sess_1/events/ws", "GET"),
            "runtime:execute"
        );
    }

    #[test]
    fn agent_sessions_paths_pass_the_relay_allow_list() {
        // The inventory doc (§3) notes /api is already allow-listed; these
        // are the exact paths the control-plane agent-sessions handlers
        // relay. If the allow-list ever tightens, this test fails first.
        for path in [
            "/api/v1/agent-sessions",
            "/api/v1/agent-sessions?originSurface=chat",
            "/api/v1/agent-sessions/sess_1",
            "/api/v1/agent-sessions/sess_1/messages?limit=50&offset=0",
            "/api/v1/agent-sessions/sess_1/abort",
            "/api/v1/agent-sessions/sess_1/revert",
            "/api/v1/agent-sessions/sess_1/unrevert",
            "/api/v1/agent-sessions/sess_1/compact",
            "/api/v1/agent-sessions/sync",
            "/api/v1/agent-sessions/sync?since=123",
        ] {
            assert!(is_allowed_runtime_path(path), "{path} must relay");
        }
    }

    #[test]
    fn relay_allow_list_still_rejects_non_gateway_paths() {
        for path in [
            "/",
            "/etc/passwd",
            "https://evil.example/api/v1/agent-sessions",
            "/apiwol",
        ] {
            assert!(!is_allowed_runtime_path(path), "{path} must not relay");
        }
        // Path-traversal and scheme-relative inputs match the /api prefix
        // but are rejected by the path sanity check one layer up.
        for sneaky_path in ["//api/v1/agent-sessions", "/api/../admin"] {
            let sneaky = RelayRequest {
                method: "GET".to_string(),
                path: sneaky_path.to_string(),
                headers: HashMap::new(),
                body: String::new(),
                body_encoding: "utf8".to_string(),
            };
            assert!(
                validate_proxy_request(&sneaky).is_err(),
                "{sneaky_path} must not relay"
            );
        }
    }

    #[test]
    fn agent_sessions_relay_requires_the_execute_capability() {
        assert_eq!(
            required_capability("/api/v1/agent-sessions/sess_1", "GET"),
            "runtime:execute"
        );
        assert_eq!(
            required_capability("/api/v1/agent-sessions/sync", "GET"),
            "runtime:execute"
        );
        assert_eq!(
            required_capability("/api/v1/agent-sessions/sess_1/messages", "POST"),
            "runtime:execute"
        );
    }

    #[test]
    fn office_and_beta_paths_pass_the_relay_allow_list() {
        // Exact paths the P1 office/beta control-plane handlers relay. If the
        // allow-list ever tightens, this test fails first. Both namespaces
        // sit under the /api prefix already allow-listed for the agent-
        // sessions tranche.
        for path in [
            "/api/v1/office/bindings",
            "/api/v1/office/bindings?surface=word",
            "/api/v1/office/bindings/bind_1",
            "/api/v1/office/bootstrap",
            "/api/v1/office/runtime/state",
            "/api/v1/beta/research",
            "/api/v1/beta/research/rt_1",
            "/api/v1/beta/sessions",
            "/api/v1/beta/sessions/sess_1",
            "/api/v1/beta/sessions/sess_1/events/list?limit=10",
            "/api/v1/beta/sessions/sess_1/memory/search?q=hi",
            "/api/v1/beta/sessions/sess_1/run",
        ] {
            assert!(is_allowed_runtime_path(path), "{path} must relay");
        }
    }

    #[test]
    fn office_and_beta_relay_require_the_execute_capability() {
        // The capability table (required_capability) maps both namespaces to
        // the runtime:execute default: no health/status/provider/terminal/
        // files/remote-control pattern matches their paths. Pin that here so
        // a future table change that narrows office/beta fails loudly.
        for (path, method) in [
            ("/api/v1/office/bindings", "GET"),
            ("/api/v1/office/bindings/bind_1", "GET"),
            ("/api/v1/office/bootstrap", "POST"),
            ("/api/v1/office/runtime/state", "POST"),
            ("/api/v1/beta/research", "POST"),
            ("/api/v1/beta/research/rt_1", "GET"),
            ("/api/v1/beta/sessions", "POST"),
            ("/api/v1/beta/sessions/sess_1", "PATCH"),
            ("/api/v1/beta/sessions/sess_1/events/list", "GET"),
            ("/api/v1/beta/sessions/sess_1/memory/search", "GET"),
            ("/api/v1/beta/sessions/sess_1/run", "POST"),
        ] {
            assert_eq!(
                required_capability(path, method),
                "runtime:execute",
                "{method} {path} must require runtime:execute"
            );
        }
    }

    #[test]
    fn relay_headers_keep_only_the_forward_allow_list() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Bearer abc".parse().unwrap());
        headers.insert("accept", "text/event-stream".parse().unwrap());
        headers.insert("content-type", "application/json".parse().unwrap());
        headers.insert("cookie", "session=secret".parse().unwrap());
        headers.insert("x-request-id", "req_1".parse().unwrap());

        let forwarded = relay_headers_from_http(&headers);
        // Raw collection carries everything; the allow-list is enforced by
        // filtered_headers inside the relay before anything hits the wire.
        assert_eq!(forwarded["authorization"], "Bearer abc");
        assert_eq!(forwarded["accept"], "text/event-stream");
        assert_eq!(forwarded["content-type"], "application/json");
        assert_eq!(forwarded["x-request-id"], "req_1");
        assert!(forwarded.contains_key("cookie"));

        let filtered = filtered_headers(forwarded);
        assert!(filtered.contains_key("authorization"));
        assert!(filtered.contains_key("accept"));
        assert!(!filtered.contains_key("cookie"));
    }
}
