//! Job Events WebSocket Handler
//!
//! Broadcasts job events to subscribed UI clients in real-time.

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info};

use crate::AppState;
use crate::JobEvent;

/// WebSocket handler for job events
pub async fn job_events_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_job_events_socket(socket, state))
}

/// Handle the WebSocket connection
async fn handle_job_events_socket(socket: WebSocket, state: Arc<AppState>) {
    info!("🔌 Job events WebSocket client connected");

    let (mut sender, mut receiver) = socket.split();

    // Subscribe to job events
    let mut rx = state.job_events_tx.subscribe();

    // Spawn task to receive messages from client (mostly ping/pong)
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(WsMessage::Ping(data)) => {
                    debug!("Ping from job events client");
                    // Pong is automatic
                }
                Ok(WsMessage::Pong(_)) => {
                    debug!("Pong from job events client");
                }
                Ok(WsMessage::Close(_)) => {
                    info!("Job events client disconnected");
                    break;
                }
                Ok(WsMessage::Text(text)) => {
                    debug!("Received from job events client: {}", text);
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }
    });

    // Send job events to client
    while let Ok(event) = rx.recv().await {
        let json = match serde_json::to_string(&event) {
            Ok(j) => j,
            Err(e) => {
                error!("Failed to serialize job event: {}", e);
                continue;
            }
        };

        if sender.send(WsMessage::Text(json)).await.is_err() {
            error!("Failed to send job event to client");
            break;
        }
    }

    // Clean up
    recv_task.abort();
    info!("Job events WebSocket connection closed");
}
