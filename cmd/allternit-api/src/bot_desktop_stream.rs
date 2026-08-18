//! Bot desktop VNC WebSocket proxy
//!
//! Proxies binary WebSocket frames between the browser (noVNC or a raw VNC
//! client) and the OpenSandbox VNC TCP endpoint. Auth is checked before the
//! upgrade and again inside the spawned task.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Extension, Path, Query, State};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use futures::{sink::SinkExt, stream::StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::auth::AuthUser;
use crate::AppState;
use crate::BotDesktopControlState;

pub fn bot_desktop_stream_router() -> Router<Arc<AppState>> {
    Router::new().route("/bots/:bot_id/desktop/vnc", get(bot_desktop_ws_handler))
}

#[derive(Debug, Deserialize)]
pub struct DesktopStreamQuery {
    sandbox_id: String,
    user_id: String,
}

async fn bot_desktop_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopStreamQuery>,
) -> impl IntoResponse {
    // Reject if the user_id in the query does not match the authenticated user.
    if query.user_id != user.user_id {
        return (axum::http::StatusCode::FORBIDDEN, "user mismatch").into_response();
    }

    ws.on_upgrade(move |socket| handle_bot_desktop_socket(socket, state, bot_id, query.sandbox_id, user.user_id))
}

async fn handle_bot_desktop_socket(
    socket: WebSocket,
    state: Arc<AppState>,
    bot_id: String,
    sandbox_id: String,
    user_id: String,
) {
    // Double-check ownership inside the spawned task before opening any TCP.
    if !verify_bot_ownership(&state, &user_id, &bot_id).await {
        let _ = socket.close().await;
        return;
    }

    let control_state = {
        let sessions = state.bot_desktop_sessions.read().await;
        sessions
            .get(&bot_id)
            .filter(|s| s.sandbox_id == sandbox_id)
            .map(|s| s.control_state)
            .unwrap_or(BotDesktopControlState::BotControls)
    };

    // The human can view the desktop in observe mode and drive it in control
    // mode. Bot-only control rejects the socket so the bot's VNC session is not
    // accidentally shared.
    if !matches!(
        control_state,
        BotDesktopControlState::HumanControls | BotDesktopControlState::HumanObserving
    ) {
        warn!(bot_id, user_id, "Desktop socket opened before take-over");
        let _ = socket.close().await;
        return;
    }

    let endpoint = match &state.vm_driver {
        Some(driver) => match driver.get_desktop_endpoint_by_native_id(&sandbox_id).await {
            Ok(Some(ep)) => ep,
            Ok(None) => {
                warn!(sandbox_id, "No desktop endpoint found");
                let _ = socket.close().await;
                return;
            }
            Err(e) => {
                error!(error = %e, sandbox_id, "Failed to resolve desktop endpoint");
                let _ = socket.close().await;
                return;
            }
        },
        None => {
            warn!("No VM driver available");
            let _ = socket.close().await;
            return;
        }
    };

    if !matches!(endpoint.protocol, allternit_driver_interface::DesktopProtocol::Vnc) {
        warn!(protocol = ?endpoint.protocol, "Only raw VNC over TCP is supported for WebSocket proxy");
        let _ = socket.close().await;
        return;
    }

    let tcp_addr = match parse_tcp_addr(&endpoint.url) {
        Some(addr) => addr,
        None => {
            error!(url = %endpoint.url, "Could not parse VNC URL as TCP address");
            let _ = socket.close().await;
            return;
        }
    };

    info!(bot_id, sandbox_id, %tcp_addr, "Opening VNC WebSocket proxy");

    let tcp = match TcpStream::connect(&tcp_addr).await {
        Ok(stream) => stream,
        Err(e) => {
            error!(error = %e, %tcp_addr, "Failed to connect to VNC endpoint");
            let _ = socket.close().await;
            return;
        }
    };

    let _vnc_token = endpoint.token;

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (mut tcp_read, mut tcp_write) = tokio::io::split(tcp);

    // Channel for messages that need to go to the browser.
    let (ws_tx, mut ws_rx) = mpsc::channel::<Message>(128);
    let ws_tx2 = ws_tx.clone();

    // Forward channel -> WebSocket sender.
    let forward_to_ws = tokio::spawn(async move {
        while let Some(msg) = ws_rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Forward WebSocket receiver -> TCP.
    let ws_to_tcp = tokio::spawn(async move {
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    if tcp_write.write_all(&data).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Close(_)) => break,
                Ok(Message::Ping(data)) => {
                    let _ = ws_tx2.send(Message::Pong(data)).await;
                }
                Ok(Message::Pong(_)) => {}
                Err(e) => {
                    debug!(error = %e, "WebSocket receive error");
                    break;
                }
                _ => {}
            }
        }
    });

    // Forward TCP -> WebSocket channel.
    let tcp_to_ws = tokio::spawn(async move {
        let mut buf = vec![0u8; 16384];
        loop {
            match tcp_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if ws_tx.send(Message::Binary(buf[..n].to_vec())).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    debug!(error = %e, "VNC TCP read error");
                    break;
                }
            }
        }
    });

    // Wait for any direction to finish, then clean up.
    tokio::select! {
        _ = forward_to_ws => {},
        _ = ws_to_tcp => {},
        _ = tcp_to_ws => {},
    }

    info!(bot_id, sandbox_id, "VNC WebSocket proxy closed");
}

async fn verify_bot_ownership(state: &AppState, user_id: &str, bot_id: &str) -> bool {
    let db = state.db.clone();
    let bot_id = bot_id.to_string();
    let user_id = user_id.to_string();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare("SELECT 1 FROM agents WHERE id = ?1 AND user_id = ?2 LIMIT 1")?;
        let exists: Option<i64> = stmt.query_row(rusqlite::params![bot_id, user_id], |row| {
            row.get(0)
        }).ok();
        Ok::<_, rusqlite::Error>(exists.is_some())
    })
    .await;

    match result {
        Ok(Ok(true)) => true,
        _ => false,
    }
}

/// Parse a TCP host:port from endpoint URLs returned by OpenSandbox.
/// Accepts `tcp://host:port`, `ws://host:port`, `host:port`, or `http://host:port`.
fn parse_tcp_addr(url: &str) -> Option<String> {
    let url = url.trim();

    // Strip known schemes.
    let stripped = url
        .strip_prefix("tcp://")
        .or_else(|| url.strip_prefix("ws://"))
        .or_else(|| url.strip_prefix("wss://"))
        .or_else(|| url.strip_prefix("http://"))
        .or_else(|| url.strip_prefix("https://"))
        .unwrap_or(url);

    // Strip any path.
    let host_port = stripped.split('/').next()?;

    // Validate it looks like host:port.
    let parts: Vec<&str> = host_port.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let port: u16 = parts[1].parse().ok()?;
    if port == 0 {
        return None;
    }

    Some(host_port.to_string())
}
