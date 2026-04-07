//! WebSocket Stream Gateway
//!
//! Provides real-time event streaming from the Rails Ledger via WebSocket.
//! Supports replay, filtering, and multi-client subscriptions.

use allternit_agent_system_rails::work::projection::project_dag;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::rails::RailsState;

// ============================================================================
// Routes
// ============================================================================

pub fn stream_router() -> Router<RailsState> {
    Router::new()
        .route("/ws/ledger", get(ledger_stream_handler))
        .route(
            "/ws/workspace/:workspace_id/ledger",
            get(workspace_ledger_stream),
        )
        .route("/ws/dag/:dag_id/events", get(dag_event_stream))
}

// ============================================================================
// Query Parameters
// ============================================================================

#[derive(Debug, Deserialize)]
struct StreamQueryParams {
    /// Resume from this cursor (event ID)
    cursor: Option<String>,
    /// Filter by event types (comma-separated)
    event_types: Option<String>,
    /// Replay last N events before subscribing
    replay: Option<usize>,
    /// Client identifier
    client_id: Option<String>,
}

// ============================================================================
// WebSocket Messages
// ============================================================================

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "connected")]
    Connected { client_id: String, cursor: String },

    #[serde(rename = "event")]
    Event {
        event_id: String,
        event_type: String,
        timestamp: String,
        payload: serde_json::Value,
        scope: Option<EventScopeResponse>,
    },

    #[serde(rename = "replay_complete")]
    ReplayComplete {
        events_replayed: usize,
        cursor: String,
    },

    #[serde(rename = "error")]
    Error { message: String },

    #[serde(rename = "heartbeat")]
    Heartbeat { timestamp: i64 },
}

#[derive(Debug, Serialize)]
struct EventScopeResponse {
    dag_id: Option<String>,
    wih_id: Option<String>,
    run_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe { dag_id: Option<String> },

    #[serde(rename = "unsubscribe")]
    Unsubscribe,

    #[serde(rename = "seek")]
    Seek { cursor: String },

    #[serde(rename = "ping")]
    Ping,
}

// ============================================================================
// Handlers
// ============================================================================

/// Global ledger stream - all events
async fn ledger_stream_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<StreamQueryParams>,
    State(state): State<RailsState>,
) -> impl IntoResponse {
    info!(?params, "New ledger stream connection");
    ws.on_upgrade(move |socket| handle_ledger_socket(socket, state, params, None))
}

/// Workspace-scoped ledger stream
async fn workspace_ledger_stream(
    ws: WebSocketUpgrade,
    Path(workspace_id): Path<String>,
    Query(params): Query<StreamQueryParams>,
    State(state): State<RailsState>,
) -> impl IntoResponse {
    info!(
        workspace_id,
        ?params,
        "New workspace ledger stream connection"
    );
    ws.on_upgrade(move |socket| handle_ledger_socket(socket, state, params, Some(workspace_id)))
}

/// DAG-specific event stream
async fn dag_event_stream(
    ws: WebSocketUpgrade,
    Path(dag_id): Path<String>,
    Query(params): Query<StreamQueryParams>,
    State(state): State<RailsState>,
) -> impl IntoResponse {
    info!(dag_id, ?params, "New DAG event stream connection");
    ws.on_upgrade(move |socket| handle_dag_socket(socket, state, dag_id, params))
}

// ============================================================================
// Socket Handlers
// ============================================================================

async fn handle_ledger_socket(
    socket: WebSocket,
    state: RailsState,
    params: StreamQueryParams,
    _workspace_filter: Option<String>,
) {
    let client_id = params
        .client_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let event_types = parse_event_types(params.event_types.as_deref());
    let replay_count = params.replay;
    let mut cursor = params.cursor.clone().unwrap_or_else(|| "0".to_string());
    let mut subscribed_dag: Option<String> = None;
    let (mut sender, mut receiver) = socket.split();

    // Channel for sending messages to the client
    let (tx, mut rx) = mpsc::channel::<Message>(100);

    // Send connected message
    let connected_msg = ServerMessage::Connected {
        client_id: client_id.clone(),
        cursor: cursor.clone(),
    };

    if let Ok(json) = serde_json::to_string(&connected_msg) {
        let _ = tx.send(Message::Text(json)).await;
    }

    // Spawn heartbeat task
    let heartbeat_tx = tx.clone();
    let heartbeat_handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let heartbeat = ServerMessage::Heartbeat {
                timestamp: chrono::Utc::now().timestamp_millis(),
            };
            if let Ok(json) = serde_json::to_string(&heartbeat) {
                if heartbeat_tx.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Handle replay if requested
    if let Some(replay_count) = replay_count {
        if params.cursor.is_some() {
            cursor = replay_events(
                &state,
                &tx,
                &client_id,
                &cursor,
                replay_count,
                event_types.clone(),
                subscribed_dag.as_deref(),
            )
            .await;
        }
    }

    // Spawn task to forward messages from channel to WebSocket
    let forward_handle = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages from client
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => {
                        match client_msg {
                            ClientMessage::Ping => {
                                // Heartbeat response
                                let pong = ServerMessage::Heartbeat {
                                    timestamp: chrono::Utc::now().timestamp_millis(),
                                };
                                if let Ok(json) = serde_json::to_string(&pong) {
                                    let _ = tx.send(Message::Text(json)).await;
                                }
                            }
                            ClientMessage::Seek {
                                cursor: requested_cursor,
                            } => {
                                debug!(
                                    client_id,
                                    requested_cursor,
                                    ?subscribed_dag,
                                    "Client seeking to cursor"
                                );
                                let replay_limit = replay_count.unwrap_or(100);
                                cursor = replay_events(
                                    &state,
                                    &tx,
                                    &client_id,
                                    &requested_cursor,
                                    replay_limit,
                                    event_types.clone(),
                                    subscribed_dag.as_deref(),
                                )
                                .await;
                            }
                            ClientMessage::Subscribe { dag_id } => {
                                subscribed_dag = dag_id;
                                debug!(client_id, ?subscribed_dag, "Client subscribing to DAG");
                                if subscribed_dag.is_some() {
                                    let replay_limit = replay_count.unwrap_or(100);
                                    cursor = replay_events(
                                        &state,
                                        &tx,
                                        &client_id,
                                        &cursor,
                                        replay_limit,
                                        event_types.clone(),
                                        subscribed_dag.as_deref(),
                                    )
                                    .await;
                                }
                            }
                            ClientMessage::Unsubscribe => {
                                debug!(client_id, "Client unsubscribing");
                                subscribed_dag = None;
                            }
                        }
                    }
                    Err(e) => {
                        warn!(error = %e, "Failed to parse client message");
                        let error_msg = ServerMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        if let Ok(json) = serde_json::to_string(&error_msg) {
                            let _ = tx.send(Message::Text(json)).await;
                        }
                    }
                }
            }
            Message::Close(_) => {
                info!(client_id, "Client disconnected");
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    heartbeat_handle.abort();
    forward_handle.abort();

    info!(client_id, "Stream connection closed");
}

fn map_event_scope(
    scope: Option<&allternit_agent_system_rails::EventScope>,
) -> Option<EventScopeResponse> {
    scope.map(|scope| EventScopeResponse {
        dag_id: scope.dag_id.clone(),
        wih_id: scope.wih_id.clone(),
        run_id: scope.run_id.clone(),
    })
}

fn parse_event_types(event_types: Option<&str>) -> Option<Vec<String>> {
    event_types.and_then(|value| {
        let parsed = value
            .split(',')
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        if parsed.is_empty() {
            None
        } else {
            Some(parsed)
        }
    })
}

async fn replay_events(
    state: &RailsState,
    tx: &mpsc::Sender<Message>,
    client_id: &str,
    cursor: &str,
    replay_count: usize,
    event_types: Option<Vec<String>>,
    dag_filter: Option<&str>,
) -> String {
    debug!(
        client_id,
        replay_count,
        cursor,
        ?event_types,
        ?dag_filter,
        "Replaying events"
    );

    let query = allternit_agent_system_rails::LedgerQuery {
        r#type: None,
        types: event_types,
        scope: None,
        since: Some(cursor.to_string()),
        until: None,
        limit: Some(replay_count),
    };

    match state.ledger.query(query).await {
        Ok(events) => {
            let last_cursor = events
                .last()
                .map(|event| event.event_id.clone())
                .unwrap_or_else(|| cursor.to_string());

            let filtered_events = events
                .into_iter()
                .filter(|event| {
                    dag_filter.is_none_or(|dag_id| {
                        event
                            .scope
                            .as_ref()
                            .and_then(|scope| scope.dag_id.as_deref())
                            .or_else(|| {
                                event.payload.get("dag_id").and_then(|value| value.as_str())
                            })
                            == Some(dag_id)
                    })
                })
                .collect::<Vec<_>>();

            for event in &filtered_events {
                let msg = ServerMessage::Event {
                    event_id: event.event_id.clone(),
                    event_type: event.r#type.clone(),
                    timestamp: event.ts.clone(),
                    payload: event.payload.clone(),
                    scope: map_event_scope(event.scope.as_ref()),
                };

                if let Ok(json) = serde_json::to_string(&msg) {
                    if tx.send(Message::Text(json)).await.is_err() {
                        return last_cursor;
                    }
                }
            }

            let complete_msg = ServerMessage::ReplayComplete {
                events_replayed: filtered_events.len(),
                cursor: last_cursor.clone(),
            };

            if let Ok(json) = serde_json::to_string(&complete_msg) {
                let _ = tx.send(Message::Text(json)).await;
            }

            last_cursor
        }
        Err(e) => {
            error!(client_id, error = %e, "Failed to query ledger for replay");
            let error_msg = ServerMessage::Error {
                message: format!("Replay failed: {}", e),
            };
            if let Ok(json) = serde_json::to_string(&error_msg) {
                let _ = tx.send(Message::Text(json)).await;
            }
            cursor.to_string()
        }
    }
}

async fn handle_dag_socket(
    socket: WebSocket,
    state: RailsState,
    dag_id: String,
    params: StreamQueryParams,
) {
    let client_id = params
        .client_id
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let (mut sender, mut receiver) = socket.split();

    // Channel for sending messages
    let (tx, mut rx) = mpsc::channel::<Message>(100);

    // Send connected message
    let connected_msg = ServerMessage::Connected {
        client_id: client_id.clone(),
        cursor: params.cursor.clone().unwrap_or_else(|| "0".to_string()),
    };

    if let Ok(json) = serde_json::to_string(&connected_msg) {
        let _ = tx.send(Message::Text(json)).await;
    }

    // Query current DAG state from the ledger projection.
    match state
        .ledger
        .query(allternit_agent_system_rails::LedgerQuery::default())
        .await
    {
        Ok(events) => {
            let dag_events = events
                .into_iter()
                .filter(|event| {
                    event.payload.get("dag_id").and_then(|value| value.as_str())
                        == Some(dag_id.as_str())
                })
                .collect::<Vec<_>>();

            if dag_events.is_empty() {
                warn!(dag_id, "DAG not found for stream");
            } else {
                let dag = project_dag(&dag_events, &dag_id);
                let status_counts = dag.nodes.values().fold(
                    std::collections::HashMap::<String, usize>::new(),
                    |mut counts, node| {
                        *counts.entry(node.status.clone()).or_default() += 1;
                        counts
                    },
                );

                // Send current DAG state as initial event
                let state_msg = ServerMessage::Event {
                    event_id: format!("state-{}", dag_id),
                    event_type: "dag.state".to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    payload: serde_json::json!({
                        "dag_id": dag.dag_id,
                        "node_count": dag.nodes.len(),
                        "statuses": status_counts,
                    }),
                    scope: Some(EventScopeResponse {
                        dag_id: Some(dag_id.clone()),
                        wih_id: None,
                        run_id: None,
                    }),
                };

                if let Ok(json) = serde_json::to_string(&state_msg) {
                    let _ = tx.send(Message::Text(json)).await;
                }
            }
        }
        Err(e) => {
            error!(dag_id, error = %e, "Failed to get DAG for stream");
        }
    }

    // Spawn heartbeat
    let heartbeat_tx = tx.clone();
    let heartbeat_handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let heartbeat = ServerMessage::Heartbeat {
                timestamp: chrono::Utc::now().timestamp_millis(),
            };
            if let Ok(json) = serde_json::to_string(&heartbeat) {
                if heartbeat_tx.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Forward task
    let forward_handle = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match client_msg {
                        ClientMessage::Ping => {
                            let pong = ServerMessage::Heartbeat {
                                timestamp: chrono::Utc::now().timestamp_millis(),
                            };
                            if let Ok(json) = serde_json::to_string(&pong) {
                                let _ = tx.send(Message::Text(json)).await;
                            }
                        }
                        _ => {}
                    }
                }
            }
            Message::Close(_) => {
                info!(client_id, dag_id, "DAG stream client disconnected");
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    heartbeat_handle.abort();
    forward_handle.abort();

    info!(client_id, dag_id, "DAG stream connection closed");
}
