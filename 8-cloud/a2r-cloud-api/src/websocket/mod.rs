//! WebSocket module for live deployment events

use axum::{
    extract::{Path, State},
    Error,
};
use axum::extract::ws::{WebSocket, WebSocketUpgrade, Message};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::ApiState;

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

/// WebSocket handler for deployment events
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(id): Path<Uuid>,
    State(state): State<Arc<ApiState>>,
) -> axum::response::Response {
    ws.on_upgrade(move |socket| handle_socket(socket, id, state))
}

/// Handle WebSocket connection
async fn handle_socket(
    socket: WebSocket,
    deployment_id: Uuid,
    state: Arc<ApiState>,
) {
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
