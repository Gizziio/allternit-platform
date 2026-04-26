//! WebSocket handler for run events
//!
//! Provides bidirectional WebSocket connection for real-time run event streaming
//! and interactive approvals.

use axum::{
    extract::{Path, State, WebSocketUpgrade},
    response::Response,
};
use std::sync::Arc;

use crate::{ApiError, ApiState};
use crate::db::cowork_models::*;
use crate::services::{EventStore, EventStoreImpl, RunService};

/// WebSocket handler for run events
pub async fn run_ws_handler(
    State(state): State<Arc<ApiState>>,
    Path(run_id): Path<String>,
    ws: WebSocketUpgrade,
) -> Result<Response, ApiError> {
    // Verify run exists
    let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = ?")
        .bind(&run_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
    
    if run.is_none() {
        return Err(ApiError::NotFound(format!("Run not found: {}", run_id)));
    }
    
    Ok(ws.on_upgrade(move |socket| handle_run_socket(socket, state, run_id)))
}

/// Handle WebSocket connection for a run
async fn handle_run_socket(
    mut socket: axum::extract::ws::WebSocket,
    state: Arc<ApiState>,
    run_id: String,
) {
    use axum::extract::ws::Message;
    use futures::stream::StreamExt;
    
    tracing::info!("WebSocket connected for run: {}", run_id);
    
    // Create event store and subscribe to events
    let event_store = EventStoreImpl::new(state.db.clone());
    let mut event_rx = match event_store.subscribe(&run_id).await {
        Ok(rx) => rx,
        Err(e) => {
            tracing::error!("Failed to subscribe to events: {}", e);
            let _ = socket.close().await;
            return;
        }
    };
    
    // Register attachment
    let client_id = uuid::Uuid::new_v4().to_string();
    let attachment_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();
    
    let _ = sqlx::query(
        r#"
        INSERT INTO attachments (id, run_id, client_id, client_type, cursor_sequence, attached_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&attachment_id)
    .bind(&run_id)
    .bind(&client_id)
    .bind(ClientType::Web) // Default to Web, could be determined from headers
    .bind(0i64)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await;
    
    // Get latest sequence for cursor tracking
    let latest_sequence = event_store.get_latest_sequence(&run_id).await.unwrap_or(0);
    
    // Send initial connection acknowledgment
    let ack = serde_json::json!({
        "type": "connected",
        "run_id": &run_id,
        "client_id": &client_id,
        "latest_sequence": latest_sequence,
    });
    
    if let Err(e) = socket.send(Message::Text(ack.to_string())).await {
        tracing::error!("Failed to send ack: {}", e);
        return;
    }
    
    // Main message loop
    loop {
        tokio::select! {
            // Receive events from broadcast
            Ok(event) = event_rx.recv() => {
                let event_json = match serde_json::to_string(&event) {
                    Ok(json) => json,
                    Err(e) => {
                        tracing::error!("Failed to serialize event: {}", e);
                        continue;
                    }
                };
                
                if let Err(e) = socket.send(Message::Text(event_json)).await {
                    tracing::error!("Failed to send event: {}", e);
                    break;
                }
                
                // Update cursor position
                let _ = sqlx::query(
                    "UPDATE attachments SET cursor_sequence = ?, last_seen_at = ? WHERE id = ?"
                )
                .bind(event.sequence)
                .bind(chrono::Utc::now())
                .bind(&attachment_id)
                .execute(&state.db)
                .await;
            }
            
            // Receive messages from client
            Some(msg) = socket.next() => {
                match msg {
                    Ok(Message::Text(text)) => {
                        // Handle client messages (approvals, commands, etc.)
                        if let Err(e) = handle_client_message(&text, &state, &run_id, &client_id).await {
                            let error_msg = serde_json::json!({
                                "type": "error",
                                "error": e.to_string(),
                            });
                            let _ = socket.send(Message::Text(error_msg.to_string())).await;
                        }
                    }
                    Ok(Message::Close(_)) => {
                        tracing::info!("WebSocket closed by client for run: {}", run_id);
                        break;
                    }
                    Ok(Message::Ping(data)) => {
                        if let Err(e) = socket.send(Message::Pong(data)).await {
                            tracing::error!("Failed to send pong: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            
            // Timeout/heartbeat check
            else => {
                // Send heartbeat
                let heartbeat = serde_json::json!({
                    "type": "heartbeat",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                });
                
                if let Err(e) = socket.send(Message::Text(heartbeat.to_string())).await {
                    tracing::error!("Failed to send heartbeat: {}", e);
                    break;
                }
            }
        }
    }
    
    // Clean up attachment
    let _ = sqlx::query(
        "UPDATE attachments SET detached_at = ? WHERE id = ?"
    )
    .bind(chrono::Utc::now())
    .bind(&attachment_id)
    .execute(&state.db)
    .await;
    
    tracing::info!("WebSocket disconnected for run: {}", run_id);
}

/// Handle messages from WebSocket client
async fn handle_client_message(
    text: &str,
    state: &ApiState,
    run_id: &str,
    client_id: &str,
) -> Result<(), ApiError> {
    #[derive(serde::Deserialize)]
    struct ClientMessage {
        #[serde(rename = "type")]
        msg_type: String,
        #[serde(flatten)]
        payload: serde_json::Value,
    }
    
    let msg: ClientMessage = serde_json::from_str(text)
        .map_err(|e| ApiError::BadRequest(format!("Invalid message format: {}", e)))?;
    
    match msg.msg_type.as_str() {
        "approval_response" => {
            #[derive(serde::Deserialize)]
            struct ApprovalResponse {
                tool_name: String,
                approved: bool,
                reason: Option<String>,
            }
            
            let approval: ApprovalResponse = serde_json::from_value(msg.payload)
                .map_err(|e| ApiError::BadRequest(format!("Invalid approval response: {}", e)))?;
            
            // Emit approval event
            let event_store = EventStoreImpl::new(state.db.clone());
            
            let event_type = if approval.approved {
                EventType::ApprovalGiven
            } else {
                EventType::ApprovalDenied
            };
            
            let payload = if approval.approved {
                serde_json::json!({
                    "tool_name": approval.tool_name,
                    "approved_by": client_id,
                    "approved_at": chrono::Utc::now().to_rfc3339(),
                })
            } else {
                serde_json::json!({
                    "tool_name": approval.tool_name,
                    "denied_by": client_id,
                    "reason": approval.reason,
                    "denied_at": chrono::Utc::now().to_rfc3339(),
                })
            };
            
            event_store.append_with_source(
                run_id,
                event_type,
                payload,
                Some(client_id),
                Some(ClientType::Web),
            ).await?;
            
            tracing::info!(
                "Approval {} for tool {} in run {}",
                if approval.approved { "granted" } else { "denied" },
                approval.tool_name,
                run_id
            );
        }
        
        "cursor_sync" => {
            #[derive(serde::Deserialize)]
            struct CursorSync {
                sequence: i64,
            }
            
            let sync: CursorSync = serde_json::from_value(msg.payload)
                .map_err(|e| ApiError::BadRequest(format!("Invalid cursor sync: {}", e)))?;
            
            // Update attachment cursor
            let _ = sqlx::query(
                "UPDATE attachments SET cursor_sequence = ?, last_seen_at = ? 
                 WHERE run_id = ? AND client_id = ?"
            )
            .bind(sync.sequence)
            .bind(chrono::Utc::now())
            .bind(run_id)
            .bind(client_id)
            .execute(&state.db)
            .await;
        }
        
        "command" => {
            #[derive(serde::Deserialize)]
            struct Command {
                command: String,
            }
            
            let cmd: Command = serde_json::from_value(msg.payload)
                .map_err(|e| ApiError::BadRequest(format!("Invalid command: {}", e)))?;
            
            // Handle commands like pause, resume, cancel
            use crate::services::RunServiceImpl;
            let run_service = RunServiceImpl::from_arc(Arc::new(state.db.clone()));
            
            match cmd.command.as_str() {
                "pause" => {
                    run_service.pause(run_id).await?;
                }
                "resume" => {
                    run_service.resume(run_id).await?;
                }
                "cancel" => {
                    run_service.cancel(run_id, None).await?;
                }
                _ => {
                    return Err(ApiError::BadRequest(format!("Unknown command: {}", cmd.command)));
                }
            }
        }
        
        _ => {
            return Err(ApiError::BadRequest(format!("Unknown message type: {}", msg.msg_type)));
        }
    }
    
    Ok(())
}
