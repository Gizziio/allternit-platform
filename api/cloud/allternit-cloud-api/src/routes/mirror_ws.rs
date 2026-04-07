//! WebSocket Streaming for Mirror Sessions
//!
//! Real-time bidirectional streaming between desktop and mobile devices.
//! Supports:
//! - Terminal output streaming (desktop → mobile)
//! - Command execution (mobile → desktop)
//! - Approval workflows (mobile → desktop)
//! - Connection management

use axum::{
    extract::{Path, Query, State, WebSocketUpgrade},
    response::IntoResponse,
};
use axum::extract::ws::{Message, WebSocket};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use futures_util::{SinkExt, StreamExt};
use tracing::{info, warn, error};

use crate::ApiState;

// ============================================================================
// Types
// ============================================================================

/// WebSocket message from client
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum WsClientMessage {
    /// Subscribe to session stream
    Subscribe { session_id: String },
    /// Send command to terminal
    Command { content: String },
    /// Approve/reject file changes
    Approval { diff_id: String, approved: bool },
    /// Ping for keepalive
    Ping,
}

/// WebSocket message to client
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum WsServerMessage {
    /// Terminal output
    Output { content: String, timestamp: i64 },
    /// File diff for approval
    Diff {
        diff_id: String,
        file_path: String,
        changes: Vec<DiffChange>,
        timestamp: i64,
    },
    /// Session status update
    Status { status: String, client_count: i64 },
    /// Command execution result
    CommandResult { success: bool, output: String },
    /// Pong for keepalive
    Pong,
    /// Error message
    Error { message: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffChange {
    #[serde(rename = "type")]
    pub change_type: String, // "add" | "remove" | "unchanged"
    pub content: String,
    pub line_number: Option<i64>,
}

/// Query parameters for WebSocket connection
#[derive(Debug, Deserialize)]
pub struct WsQueryParams {
    token: String,
}

// ============================================================================
// WebSocket Handler
// ============================================================================

/// WS /api/v1/mirror/:session_id/stream
/// WebSocket endpoint for real-time session streaming
pub async fn mirror_session_ws(
    Path(session_id): Path<String>,
    Query(params): Query<WsQueryParams>,
    ws: WebSocketUpgrade,
    State(state): State<Arc<ApiState>>,
) -> impl IntoResponse {
    // Validate token
    match validate_session_token(&state.db, &session_id, &params.token).await {
        Ok(true) => {
            // Token valid, upgrade connection
            ws.on_upgrade(move |socket| handle_socket(socket, state, session_id))
        }
        Ok(false) => {
            // Token invalid
            axum::http::StatusCode::UNAUTHORIZED.into_response()
        }
        Err(e) => {
            error!("Token validation error: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Validate session token
async fn validate_session_token(
    pool: &sqlx::SqlitePool,
    session_id: &str,
    token: &str,
) -> Result<bool, sqlx::Error> {
    let result: Option<(String,)> = sqlx::query_as(
        r#"
        SELECT access_token
        FROM mirror_sessions
        WHERE id = ? AND status IN ('active', 'paired') AND expires_at > datetime('now')
        "#,
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?;

    Ok(result.map_or(false, |row| row.0 == token))
}

/// Handle WebSocket connection
async fn handle_socket(
    socket: WebSocket,
    state: Arc<ApiState>,
    session_id: String,
) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to session broadcast channel
    let mut rx = state.event_tx.subscribe();

    // Update client count
    if let Err(e) = increment_client_count(&state.db, &session_id).await {
        error!("Failed to increment client count: {}", e);
    }

    // Send initial status
    let status_msg = WsServerMessage::Status {
        status: "connected".to_string(),
        client_count: 1,
    };
    if let Ok(json) = serde_json::to_string(&status_msg) {
        let _ = sender.send(Message::Text(json)).await;
    }

    info!("WebSocket client connected to session: {}", session_id);

    // Spawn task to receive messages from client
    let state_clone = state.clone();
    let session_id_clone = session_id.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(&text) {
                        handle_client_message(&state_clone, &session_id_clone, client_msg).await;
                    }
                }
                Ok(Message::Close(_)) => {
                    info!("WebSocket client disconnected from session: {}", session_id_clone);
                    break;
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }
    });

    // Spawn task to broadcast messages to client
    let session_id_clone2 = session_id.clone();
    let send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            // Only broadcast events for this session
            if let Some(ws_msg) = event_to_ws_message(&event, &session_id_clone2) {
                if let Ok(json) = serde_json::to_string(&ws_msg) {
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

    // Decrement client count on disconnect
    if let Err(e) = decrement_client_count(&state.db, &session_id).await {
        error!("Failed to decrement client count: {}", e);
    }
}

/// Handle message from client
async fn handle_client_message(
    state: &Arc<ApiState>,
    session_id: &str,
    msg: WsClientMessage,
) {
    match msg {
        WsClientMessage::Subscribe { session_id: sid } => {
            info!("Client subscribed to session: {}", sid);
        }
        WsClientMessage::Command { content } => {
            // TODO: Forward command to Cowork Controller
            info!("Received command for session {}: {}", session_id, content);
            
            // For now, send back a placeholder response
            let response = WsServerMessage::CommandResult {
                success: true,
                output: format!("Command received: {}", content),
            };
            broadcast_to_session(state, session_id, response).await;
        }
        WsClientMessage::Approval { diff_id, approved } => {
            info!("Approval for {} in session {}: {}", diff_id, session_id, if approved { "approved" } else { "rejected" });
            
            // TODO: Forward approval to Cowork Controller
            
            let response = WsServerMessage::CommandResult {
                success: true,
                output: format!("Approval recorded: {}", if approved { "approved" } else { "rejected" }),
            };
            broadcast_to_session(state, session_id, response).await;
        }
        WsClientMessage::Ping => {
            let _ = broadcast_to_session(state, session_id, WsServerMessage::Pong).await;
        }
    }
}

/// Convert deployment event to WebSocket message
fn event_to_ws_message(
    event: &crate::websocket::DeploymentEvent,
    session_id: &str,
) -> Option<WsServerMessage> {
    // Map deployment events to WebSocket messages
    match event.event_type.as_str() {
        "terminal_output" => {
            Some(WsServerMessage::Output {
                content: event.message.clone(),
                timestamp: event.timestamp.timestamp(),
            })
        }
        "file_diff" => {
            // Parse diff from event data payload
            let changes = event.data.as_ref().and_then(|d| {
                d.get("changes").and_then(|c| serde_json::from_value(c.clone()).ok())
            }).unwrap_or_else(|| vec![]);
            
            Some(WsServerMessage::Diff {
                diff_id: event.deployment_id.to_string(),
                file_path: event.message.clone(),
                changes,
                timestamp: event.timestamp.timestamp(),
            })
        }
        "status_update" => {
            Some(WsServerMessage::Status {
                status: event.message.clone(),
                client_count: event.progress as i64,
            })
        }
        _ => None,
    }
}

/// Broadcast message to specific session
async fn broadcast_to_session(
    state: &Arc<ApiState>,
    session_id: &str,
    msg: WsServerMessage,
) {
    // Create deployment event for this message
    let event = crate::websocket::DeploymentEvent {
        deployment_id: uuid::Uuid::new_v4(),
        event_type: "websocket_message".to_string(),
        progress: 0,
        message: serde_json::to_string(&msg).unwrap_or_default(),
        timestamp: chrono::Utc::now(),
        data: Some(serde_json::json!({
            "session_id": session_id
        })),
    };

    // Broadcast through existing event system
    let _ = state.event_tx.send(event);
}

/// Increment client count for session
async fn increment_client_count(
    pool: &sqlx::SqlitePool,
    session_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE mirror_sessions
        SET client_count = client_count + 1, last_activity_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(session_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Decrement client count for session
async fn decrement_client_count(
    pool: &sqlx::SqlitePool,
    session_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE mirror_sessions
        SET client_count = MAX(0, client_count - 1), last_activity_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(session_id)
    .execute(pool)
    .await?;
    Ok(())
}
