//! WebSocket module for live deployment events

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::ApiState;

/// Query parameters for WebSocket connection (for token-based auth)
#[derive(Debug, Deserialize)]
pub struct WsQuery {
    /// API token for authentication
    token: Option<String>,
}

/// Deployment event for WebSocket
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeploymentEvent {
    pub deployment_id: Uuid,
    pub event_type: String,
    pub progress: i32,
    pub message: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub data: Option<serde_json::Value>,
}

/// WebSocket handler for deployment events with authentication
/// Supports authentication via:
/// 1. Query parameter: ?token=<token>
/// 2. Authorization header: Bearer <token>
/// 3. Sec-WebSocket-Protocol header: token.<token>
/// 4. A Clerk session JWT in any of those carriers
///
/// Token validation goes through `auth::middleware::validate_token_against_db`
/// (same as the HTTP middleware); this route additionally sits behind the
/// `auth_middleware` layer, which already enforced a valid Bearer token for
/// header-capable clients.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(id): Path<Uuid>,
    Query(query): Query<WsQuery>,
    headers: axum::http::HeaderMap,
    State(state): State<Arc<ApiState>>,
) -> impl IntoResponse {
    // Try to get token from multiple sources
    let token = query
        .token
        .or_else(|| extract_token_from_header(&headers))
        .or_else(|| extract_token_from_protocol(&headers));

    // Validate token if provided
    let token_valid = if let Some(token) = token {
        validate_ws_token(&state.db, &token).await
            // Browsers cannot set Authorization headers on WebSocket
            // connections; a Clerk session JWT may be passed as the token
            // (query param or subprotocol) instead.
            || crate::auth::clerk::user_from_headers(&headers).await.is_ok()
    } else {
        // In development mode, allow connections without token
        std::env::var("Allternit_API_DEVELOPMENT_MODE")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false)
    };

    if !token_valid {
        return (
            StatusCode::UNAUTHORIZED,
            "WebSocket authentication required. Pass token via ?token= query param, Authorization header, or Sec-WebSocket-Protocol header",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_socket(socket, id, state))
}

/// Extract token from Authorization header
fn extract_token_from_header(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| {
            if s.starts_with("Bearer ") {
                Some(s[7..].to_string())
            } else {
                None
            }
        })
}

/// Extract token from Sec-WebSocket-Protocol header
fn extract_token_from_protocol(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| {
            // Format: "token.<actual_token>" or just the token
            if s.starts_with("token.") {
                Some(s[6..].to_string())
            } else {
                Some(s.to_string())
            }
        })
}

/// Validate a WebSocket token: legacy `allternit_*` tokens (sha256 lookup in
/// `api_tokens`), modern scoped `alt_…` keys, and the opt-in development
/// overrides (the hardcoded `dev-api-token` gated by
/// `ALLTERNIT_ALLOW_DEV_TOKEN`, default OFF — audit finding B1; see
/// `auth::dev_token`) — all through the same validation the HTTP middleware
/// uses.
async fn validate_ws_token(db: &sqlx::PgPool, token: &str) -> bool {
    matches!(
        crate::auth::middleware::validate_token_against_db(db, token).await,
        Ok(Some(_))
    )
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, deployment_id: Uuid, state: Arc<ApiState>) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to deployment events
    let mut rx = state.event_tx.subscribe();

    // Spawn task to receive messages from client (mostly for ping/pong)
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }
    });

    // Send deployment events to client
    let send_task = tokio::spawn(async move {
        // Send initial connection message
        let init_event = DeploymentEvent {
            deployment_id,
            event_type: "connected".to_string(),
            progress: 0,
            message: "Connected to deployment event stream".to_string(),
            timestamp: chrono::Utc::now(),
            data: None,
        };

        if let Ok(json) = serde_json::to_string(&init_event) {
            let _ = sender.send(Message::Text(json)).await;
        }

        // Listen for deployment events
        while let Ok(event) = rx.recv().await {
            // Only send events for this deployment
            if event.deployment_id == deployment_id {
                if let Ok(json) = serde_json::to_string(&event) {
                    if sender.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = recv_task => {},
        _ = send_task => {},
    }
}

// Run WebSocket handler for Cowork Runtime
pub mod run_ws;
pub use run_ws::run_ws_handler;
