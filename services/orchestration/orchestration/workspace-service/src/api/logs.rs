//! WebSocket log streaming

use axum::{
    extract::{Path, State, WebSocketUpgrade},
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use tracing::{debug, error, info};

use crate::state::AppState;
use crate::tmux::TmuxClient;

/// Stream logs from a pane via WebSocket
pub async fn stream_logs(
    State(_state): State<AppState>,
    Path(pane_id): Path<String>,
    ws: WebSocketUpgrade,
) -> Response {
    info!("WebSocket connection requested for pane: {}", pane_id);
    ws.on_upgrade(move |socket| handle_socket(socket, pane_id))
}

async fn handle_socket(socket: axum::extract::ws::WebSocket, pane_id: String) {
    let (mut sender, mut receiver) = socket.split();
    let client = TmuxClient::new();

    info!("WebSocket connected for pane: {}", pane_id);

    // Send initial output
    match client.capture_pane(&pane_id, Some(100)).await {
        Ok(output) => {
            let _ = sender
                .send(axum::extract::ws::Message::Text(output))
                .await;
        }
        Err(e) => {
            error!("Failed to capture pane {}: {}", pane_id, e.message);
            let _ = sender
                .send(axum::extract::ws::Message::Text(format!(
                    "Error connecting to pane: {}\r\n",
                    e.message
                )))
                .await;
        }
    }

    // Stream updates and handle input
    let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(100));
    let mut last_output = String::new();

    loop {
        tokio::select! {
            _ = interval.tick() => {
                match client.capture_pane(&pane_id, Some(100)).await {
                    Ok(output) => {
                        if output != last_output {
                            // Find new content
                            let new_content = if output.starts_with(&last_output) {
                                &output[last_output.len()..]
                            } else {
                                // Content changed significantly, send all
                                &output
                            };
                            
                            if !new_content.is_empty() {
                                if sender.send(axum::extract::ws::Message::Text(new_content.to_string())).await.is_err() {
                                    debug!("WebSocket sender closed for pane: {}", pane_id);
                                    break;
                                }
                            }
                            last_output = output;
                        }
                    }
                    Err(e) => {
                        error!("Failed to capture pane {}: {}", pane_id, e.message);
                        let _ = sender.send(axum::extract::ws::Message::Text(
                            format!("\r\n[Error: {}]\r\n", e.message)
                        )).await;
                        break;
                    }
                }
            }
            msg = receiver.next() => {
                match msg {
                    Some(Ok(axum::extract::ws::Message::Text(text))) => {
                        debug!("Received input for pane {}: {:?}", pane_id, text);
                        // Send keys to the pane
                        if let Err(e) = crate::tmux::send_keys(&pane_id, &text).await {
                            error!("Failed to send keys to pane {}: {}", pane_id, e.message);
                        }
                    }
                    Some(Ok(axum::extract::ws::Message::Close(_))) => {
                        debug!("WebSocket close received for pane: {}", pane_id);
                        break;
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error for pane {}: {:?}", pane_id, e);
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    info!("WebSocket disconnected for pane: {}", pane_id);
}
