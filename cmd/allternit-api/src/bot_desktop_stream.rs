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
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::auth::AuthUser;
use crate::AppState;
use crate::BotDesktopControlState;

pub fn bot_desktop_stream_router() -> Router<Arc<AppState>> {
    // This router is nested under `/ws/bots`, so routes are relative to that
    // prefix (e.g. `/:bot_id/desktop/vnc` -> `/ws/bots/:bot_id/desktop/vnc`).
    Router::new().route("/:bot_id/desktop/vnc", get(bot_desktop_ws_handler))
}

#[derive(Debug, Deserialize)]
pub struct DesktopStreamQuery {
    sandbox_id: String,
    token: String,
}

async fn bot_desktop_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Query(query): Query<DesktopStreamQuery>,
) -> impl IntoResponse {
    let secret = match desktop_ws_secret(&state) {
        Some(s) => s,
        None => {
            warn!("desktop ws secret not configured");
            return (axum::http::StatusCode::SERVICE_UNAVAILABLE, "desktop ws not configured").into_response();
        }
    };

    let claims = match verify_desktop_token(&secret, &query.token) {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "invalid desktop websocket token");
            return (axum::http::StatusCode::FORBIDDEN, "invalid token").into_response();
        }
    };

    // Reject if the token claims do not match the request path / authenticated user.
    if claims.bot_id != bot_id
        || claims.sandbox_id != query.sandbox_id
        || claims.user_id != user.user_id
    {
        return (axum::http::StatusCode::FORBIDDEN, "token mismatch").into_response();
    }

    ws.on_upgrade(move |socket| handle_bot_desktop_socket(socket, state, bot_id, query.sandbox_id, user.user_id))
}

// ── Signed desktop WebSocket tokens ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopTokenClaims {
    pub bot_id: String,
    pub sandbox_id: String,
    pub user_id: String,
    pub exp: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum DesktopTokenError {
    #[error("token has expired")]
    Expired,
    #[error("invalid token format")]
    Format,
    #[error("base64 decode error")]
    Decode,
    #[error("json error")]
    Json,
    #[error("invalid signature")]
    Signature,
}

/// Return the configured desktop WS secret, or a deterministic dev fallback.
/// In production `ALLTERNIT_DESKTOP_WS_SECRET` must be set. In local dev the
/// fallback uses the data dir so restarts do not invalidate in-flight tokens.
pub fn desktop_ws_secret(state: &AppState) -> Option<String> {
    std::env::var("ALLTERNIT_DESKTOP_WS_SECRET")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            if std::env::var("ALLTERNIT_LOCAL_DEV_BYPASS").as_deref() == Ok("true") {
                Some(format!("dev-desktop-ws-secret-{}", state.data_dir.display()))
            } else {
                None
            }
        })
}

/// Sign a short-lived desktop WebSocket token.
pub fn sign_desktop_token(
    secret: &str,
    bot_id: &str,
    sandbox_id: &str,
    user_id: &str,
    expires_in_seconds: u64,
) -> String {
    let header = serde_json::json!({"alg": "HS256", "typ": "DT"});
    let claims = DesktopTokenClaims {
        bot_id: bot_id.to_string(),
        sandbox_id: sandbox_id.to_string(),
        user_id: user_id.to_string(),
        exp: chrono::Utc::now().timestamp() as u64 + expires_in_seconds,
    };

    let header_b64 = b64_encode(&serde_json::to_vec(&header).unwrap_or_default());
    let payload_b64 = b64_encode(&serde_json::to_vec(&claims).unwrap_or_default());
    let signing_input = format!("{}.{}", header_b64, payload_b64);
    let signature = hmac_sign(secret, &signing_input);

    format!("{}.{}", signing_input, signature)
}

/// Verify a desktop WebSocket token and return its claims.
pub fn verify_desktop_token(secret: &str, token: &str) -> Result<DesktopTokenClaims, DesktopTokenError> {
    let mut parts = token.split('.');
    let header_b64 = parts.next().ok_or(DesktopTokenError::Format)?;
    let payload_b64 = parts.next().ok_or(DesktopTokenError::Format)?;
    let signature_b64 = parts.next().ok_or(DesktopTokenError::Format)?;
    if parts.next().is_some() {
        return Err(DesktopTokenError::Format);
    }

    let signing_input = format!("{}.{}", header_b64, payload_b64);
    let expected = hmac_sign(secret, &signing_input);
    if !constant_time_eq(signature_b64.as_bytes(), expected.as_bytes()) {
        return Err(DesktopTokenError::Signature);
    }

    let payload_bytes = b64_decode(payload_b64).map_err(|_| DesktopTokenError::Decode)?;
    let claims: DesktopTokenClaims = serde_json::from_slice(&payload_bytes).map_err(|_| DesktopTokenError::Json)?;

    let now = chrono::Utc::now().timestamp() as u64;
    if claims.exp < now {
        return Err(DesktopTokenError::Expired);
    }

    Ok(claims)
}

fn hmac_sign(secret: &str, input: &str) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(input.as_bytes());
    let result = mac.finalize();
    b64_encode(&result.into_bytes())
}

fn b64_encode(input: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    URL_SAFE_NO_PAD.encode(input)
}

fn b64_decode(input: &str) -> Result<Vec<u8>, base64::DecodeError> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    URL_SAFE_NO_PAD.decode(input)
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
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

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &str = "test-ws-secret-for-unit-tests";

    #[test]
    fn sign_and_verify_valid_token() {
        let token = sign_desktop_token(TEST_SECRET, "bot-1", "sandbox-1", "user-1", 60);
        let claims = verify_desktop_token(TEST_SECRET, &token).unwrap();
        assert_eq!(claims.bot_id, "bot-1");
        assert_eq!(claims.sandbox_id, "sandbox-1");
        assert_eq!(claims.user_id, "user-1");
    }

    #[test]
    fn verify_rejects_expired_token() {
        let token = sign_desktop_token(TEST_SECRET, "bot-1", "sandbox-1", "user-1", 1);
        std::thread::sleep(std::time::Duration::from_secs(2));
        let err = verify_desktop_token(TEST_SECRET, &token).unwrap_err();
        assert!(matches!(err, DesktopTokenError::Expired));
    }

    #[test]
    fn verify_rejects_tampered_payload() {
        let token = sign_desktop_token(TEST_SECRET, "bot-1", "sandbox-1", "user-1", 60);
        let mut parts: Vec<&str> = token.split('.').collect();
        // Corrupt the payload segment.
        parts[1] = "dGFtcGVyZWQ";
        let tampered = parts.join(".");
        let err = verify_desktop_token(TEST_SECRET, &tampered).unwrap_err();
        assert!(matches!(err, DesktopTokenError::Signature));
    }

    #[test]
    fn verify_rejects_wrong_secret() {
        let token = sign_desktop_token(TEST_SECRET, "bot-1", "sandbox-1", "user-1", 60);
        let err = verify_desktop_token("wrong-secret", &token).unwrap_err();
        assert!(matches!(err, DesktopTokenError::Signature));
    }

    #[test]
    fn verify_rejects_malformed_token() {
        let err = verify_desktop_token(TEST_SECRET, "not-a-token").unwrap_err();
        assert!(matches!(err, DesktopTokenError::Format));
    }

    #[test]
    fn parse_tcp_addr_handles_schemes() {
        assert_eq!(parse_tcp_addr("tcp://host:5900"), Some("host:5900".to_string()));
        assert_eq!(parse_tcp_addr("ws://host:5900"), Some("host:5900".to_string()));
        assert_eq!(parse_tcp_addr("host:5900"), Some("host:5900".to_string()));
        assert_eq!(parse_tcp_addr("http://host:5900/path"), Some("host:5900".to_string()));
        assert_eq!(parse_tcp_addr("host"), None);
    }
}
