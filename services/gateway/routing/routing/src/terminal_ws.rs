#![allow(dead_code, unused_variables, unused_imports)]
#[cfg(target_os = "linux")]
//! Terminal WebSocket Handler
//!
//! Handles WebSocket connections for terminal sessions on nodes.
//! Bridges browser terminal to node's PTY via control plane.
//! Includes session persistence, reconnection support, and file operations.

use axum::body::Bytes;
use axum::extract::DefaultBodyLimit;
use axum::extract::Query;
use axum::routing::{delete, get, post};
use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot, RwLock};
use tokio::time::interval;
use tracing::{debug, error, info, trace, warn};
use uuid::Uuid;

use crate::AppState;
use allternit_protocol::{FileEntry, FileOperation, Message, MessagePayload};

/// Maximum file size for upload (100MB)
const MAX_FILE_SIZE: usize = 100 * 1024 * 1024;
/// Chunk size for file transfers (64KB)
const FILE_CHUNK_SIZE: usize = 64 * 1024;
/// Timeout for file operations
const FILE_OPERATION_TIMEOUT: Duration = Duration::from_secs(60);
/// Default session timeout: 30 minutes
const SESSION_TIMEOUT_SECONDS: i64 = 30 * 60;
/// Warning threshold: 5 minutes before timeout
const SESSION_WARNING_THRESHOLD_SECONDS: i64 = 5 * 60;
/// Reconnection window: 30 seconds to reconnect (temporary disconnect grace period)
const RECONNECTION_WINDOW_SECONDS: i64 = 30;
/// Cleanup interval: check every minute
const CLEANUP_INTERVAL_SECONDS: u64 = 60;
/// Maximum output buffer size per session (1000 lines)
const MAX_OUTPUT_BUFFER_SIZE: usize = 1000;

/// Session connection state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionConnectionState {
    /// WebSocket is connected and active
    Connected,
    /// WebSocket disconnected but session is still alive (reconnection window)
    Disconnected,
    /// Session is closed and will be cleaned up
    Closed,
}

/// Terminal session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub node_id: String,
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Last activity timestamp for session timeout tracking
    pub last_activity: chrono::DateTime<chrono::Utc>,
    /// Current connection state
    pub connection_state: SessionConnectionState,
    /// Whether the browser intentionally closed the session
    pub intentional_close: bool,
    /// WebSocket close reason if any
    pub close_reason: Option<String>,
}

/// Response for session status endpoint
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStatusResponse {
    pub exists: bool,
    pub session_id: String,
    pub node_id: Option<String>,
    pub connection_state: Option<String>,
    pub last_activity: Option<chrono::DateTime<chrono::Utc>>,
    pub can_reconnect: bool,
}

/// File operation response
#[derive(Debug, Clone)]
pub struct FileOperationResponse {
    pub success: bool,
    pub error: Option<String>,
    pub data: Option<Vec<u8>>,
    pub entries: Option<Vec<FileEntry>>,
}

/// File transfer progress
#[derive(Debug, Clone, Serialize)]
pub struct FileTransferProgress {
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percentage: f32,
}

/// File list response
#[derive(Debug, Serialize)]
pub struct FileListResponse {
    pub path: String,
    pub entries: Vec<FileEntry>,
}

/// File upload request
#[derive(Debug, Deserialize)]
pub struct FileUploadRequest {
    pub path: String,
}

/// File path query parameter
#[derive(Debug, Deserialize)]
pub struct FilePathQuery {
    pub path: String,
}

/// Active terminal sessions registry
#[derive(Default)]
pub struct TerminalSessionRegistry {
    sessions: RwLock<HashMap<String, TerminalSession>>,
    /// Channel senders for each session to forward data from node to browser
    data_channels: RwLock<HashMap<String, mpsc::Sender<String>>>,
    /// Pending file operation responses
    pending_file_ops: RwLock<HashMap<String, oneshot::Sender<FileOperationResponse>>>,
    /// File transfer progress channels
    file_progress_channels: RwLock<HashMap<String, mpsc::Sender<FileTransferProgress>>>,
    /// Buffer for session output when browser is disconnected (for replay on reconnect)
    output_buffer: RwLock<HashMap<String, Vec<String>>>,
}

impl TerminalSessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            data_channels: RwLock::new(HashMap::new()),
            pending_file_ops: RwLock::new(HashMap::new()),
            file_progress_channels: RwLock::new(HashMap::new()),
            output_buffer: RwLock::new(HashMap::new()),
        }
    }

    /// Start the cleanup task that removes inactive sessions
    pub fn start_cleanup_task(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(CLEANUP_INTERVAL_SECONDS));

            loop {
                interval.tick().await;

                let now = chrono::Utc::now();
                let mut sessions_to_remove = Vec::new();

                // Find inactive sessions
                {
                    let sessions = self.sessions.read().await;
                    for (session_id, session) in sessions.iter() {
                        let elapsed = now
                            .signed_duration_since(session.last_activity)
                            .num_seconds();

                        // Check if session has timed out
                        if elapsed > SESSION_TIMEOUT_SECONDS {
                            info!("Session {} timed out after {} seconds", session_id, elapsed);
                            sessions_to_remove.push(session_id.clone());
                        }
                    }
                }

                // Remove timed out sessions
                for session_id in sessions_to_remove {
                    if let Some(session) = self.sessions.write().await.remove(&session_id) {
                        info!(
                            "Cleaned up timed out session {} for node {}",
                            session_id, session.node_id
                        );
                    }

                    // Clean up associated channels and buffers
                    self.data_channels.write().await.remove(&session_id);
                    self.output_buffer.write().await.remove(&session_id);
                }

                trace!("Session cleanup cycle completed");
            }
        });
    }

    /// Create a new terminal session
    pub async fn create(
        &self,
        node_id: String,
        shell: String,
        cols: u16,
        rows: u16,
    ) -> TerminalSession {
        let now = chrono::Utc::now();
        let session = TerminalSession {
            id: Uuid::new_v4().to_string(),
            node_id,
            shell,
            cols,
            rows,
            created_at: now,
            last_activity: now,
            connection_state: SessionConnectionState::Disconnected,
            intentional_close: false,
            close_reason: None,
        };

        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id.clone(), session.clone());

        // Initialize output buffer for this session
        self.output_buffer
            .write()
            .await
            .insert(session.id.clone(), Vec::new());

        info!(
            "Created terminal session {} for node {}",
            session.id, session.node_id
        );
        session
    }

    /// Get session info
    pub async fn get(&self, session_id: &str) -> Option<TerminalSession> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }

    /// Update last activity timestamp
    pub async fn update_activity(&self, session_id: &str) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.last_activity = chrono::Utc::now();
            trace!("Updated activity for session {}", session_id);
        }
    }

    /// Mark session as connected
    pub async fn mark_connected(&self, session_id: &str) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.connection_state = SessionConnectionState::Connected;
            session.intentional_close = false;
            session.close_reason = None;
            session.last_activity = chrono::Utc::now();
            info!("Session {} marked as connected", session_id);
        }
    }

    /// Mark session as disconnected (allows reconnection)
    pub async fn mark_disconnected(&self, session_id: &str, reason: Option<String>) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.connection_state = SessionConnectionState::Disconnected;
            session.close_reason = reason;
            info!("Session {} marked as disconnected", session_id);
        }

        // Remove data channel when disconnected
        self.data_channels.write().await.remove(session_id);
    }

    /// Mark session as intentionally closed
    pub async fn mark_intentionally_closed(&self, session_id: &str, reason: String) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.connection_state = SessionConnectionState::Closed;
            session.intentional_close = true;
            session.close_reason = Some(reason);
            info!("Session {} marked as intentionally closed", session_id);
        }
    }

    /// Check if session can be reconnected
    pub async fn can_reconnect(&self, session_id: &str) -> bool {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(session_id) {
            // Can reconnect if:
            // 1. Session exists and is not intentionally closed
            // 2. Within reconnection window (2 minutes of last activity)
            if session.intentional_close
                || session.connection_state == SessionConnectionState::Closed
            {
                return false;
            }

            let elapsed = chrono::Utc::now()
                .signed_duration_since(session.last_activity)
                .num_seconds();
            elapsed < RECONNECTION_WINDOW_SECONDS
        } else {
            false
        }
    }

    /// Check if session is nearing timeout (for warning)
    pub async fn is_nearing_timeout(&self, session_id: &str) -> Option<i64> {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(session_id) {
            let elapsed = chrono::Utc::now()
                .signed_duration_since(session.last_activity)
                .num_seconds();
            let remaining = SESSION_TIMEOUT_SECONDS - elapsed;

            if remaining > 0 && remaining < SESSION_WARNING_THRESHOLD_SECONDS {
                Some(remaining)
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Get buffered output for replay on reconnection
    pub async fn get_buffered_output(&self, session_id: &str) -> Vec<String> {
        let buffer = self.output_buffer.read().await;
        buffer.get(session_id).cloned().unwrap_or_default()
    }

    /// Buffer output for potential reconnection replay
    pub async fn buffer_output(&self, session_id: &str, data: String) {
        let mut buffer = self.output_buffer.write().await;
        if let Some(session_buffer) = buffer.get_mut(session_id) {
            session_buffer.push(data);
            // Trim buffer if it gets too large
            if session_buffer.len() > MAX_OUTPUT_BUFFER_SIZE {
                session_buffer.remove(0);
            }
        }
    }

    /// Register data channel for a session
    pub async fn register_data_channel(&self, session_id: String, sender: mpsc::Sender<String>) {
        let mut channels = self.data_channels.write().await;
        channels.insert(session_id, sender);
    }

    /// Send data to browser terminal
    pub async fn send_to_browser(&self, session_id: &str, data: String) -> Result<(), String> {
        // Buffer the output first (for reconnection replay)
        self.buffer_output(session_id, data.clone()).await;

        // Try to send to connected browser
        let channels = self.data_channels.read().await;
        if let Some(sender) = channels.get(session_id) {
            sender
                .send(data)
                .await
                .map_err(|e| format!("Failed to send: {}", e))
        } else {
            Err("No data channel for session (browser disconnected)".to_string())
        }
    }

    /// Register a pending file operation
    pub async fn register_file_operation(
        &self,
        operation_id: String,
        response_tx: oneshot::Sender<FileOperationResponse>,
    ) {
        let mut pending = self.pending_file_ops.write().await;
        pending.insert(operation_id, response_tx);
    }

    /// Complete a pending file operation
    pub async fn complete_file_operation(
        &self,
        operation_id: &str,
        response: FileOperationResponse,
    ) -> Result<(), FileOperationResponse> {
        let mut pending = self.pending_file_ops.write().await;
        if let Some(tx) = pending.remove(operation_id) {
            tx.send(response).map_err(|r| r)?;
            Ok(())
        } else {
            warn!("No pending file operation found for ID: {}", operation_id);
            Err(response)
        }
    }

    /// Register file progress channel
    pub async fn register_file_progress_channel(
        &self,
        operation_id: String,
        sender: mpsc::Sender<FileTransferProgress>,
    ) {
        let mut channels = self.file_progress_channels.write().await;
        channels.insert(operation_id, sender);
    }

    /// Send file progress update
    pub async fn send_file_progress(
        &self,
        operation_id: &str,
        progress: FileTransferProgress,
    ) -> Result<(), ()> {
        let channels = self.file_progress_channels.read().await;
        if let Some(sender) = channels.get(operation_id) {
            let _ = sender.send(progress).await;
        }
        Ok(())
    }

    /// Remove session
    pub async fn remove(&self, session_id: &str) {
        let mut sessions = self.sessions.write().await;
        let mut channels = self.data_channels.write().await;
        let mut buffer = self.output_buffer.write().await;

        sessions.remove(session_id);
        channels.remove(session_id);
        buffer.remove(session_id);

        info!("Removed terminal session {}", session_id);
    }

    /// List active sessions for a node
    pub async fn list_for_node(&self, node_id: &str) -> Vec<TerminalSession> {
        let sessions = self.sessions.read().await;
        sessions
            .values()
            .filter(|s| s.node_id == node_id)
            .cloned()
            .collect()
    }

    /// Get all active sessions
    pub async fn list_all(&self) -> Vec<TerminalSession> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }

    /// Check session status for reconnection
    pub async fn check_session_status(&self, session_id: &str) -> SessionStatusResponse {
        let sessions = self.sessions.read().await;

        if let Some(session) = sessions.get(session_id) {
            let can_reconnect = self.can_reconnect(session_id).await;

            SessionStatusResponse {
                exists: true,
                session_id: session_id.to_string(),
                node_id: Some(session.node_id.clone()),
                connection_state: Some(format!("{:?}", session.connection_state)),
                last_activity: Some(session.last_activity),
                can_reconnect,
            }
        } else {
            SessionStatusResponse {
                exists: false,
                session_id: session_id.to_string(),
                node_id: None,
                connection_state: None,
                last_activity: None,
                can_reconnect: false,
            }
        }
    }
}

/// Request to create a terminal session
#[derive(Debug, Deserialize)]
pub struct CreateTerminalRequest {
    #[serde(default = "default_shell")]
    pub shell: String,
    #[serde(default = "default_cols")]
    pub cols: u16,
    #[serde(default = "default_rows")]
    pub rows: u16,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub working_dir: Option<String>,
    /// Optional: try to reconnect to existing session
    #[serde(default)]
    pub reconnect_session_id: Option<String>,
}

fn default_shell() -> String {
    "/bin/bash".to_string()
}
fn default_cols() -> u16 {
    80
}
fn default_rows() -> u16 {
    24
}

/// Create a new terminal session on a node
pub async fn create_terminal_session(
    Path(node_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTerminalRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // Check if node is connected
    if state.node_registry.get_node(&node_id).await.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Check if we should reconnect to an existing session
    if let Some(existing_session_id) = &req.reconnect_session_id {
        let can_reconnect = state
            .terminal_registry
            .can_reconnect(existing_session_id)
            .await;

        if can_reconnect {
            info!("Reconnecting to existing session {}", existing_session_id);

            // Get the existing session
            if let Some(session) = state.terminal_registry.get(existing_session_id).await {
                // Mark as connected again
                state
                    .terminal_registry
                    .mark_connected(existing_session_id)
                    .await;

                return Ok((
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "sessionId": session.id,
                        "nodeId": session.node_id,
                        "shell": session.shell,
                        "cols": session.cols,
                        "rows": session.rows,
                        "reconnected": true,
                        "env": req.env,
                        "workingDir": req.working_dir,
                    })),
                ));
            }
        }
    }

    // Create new session
    let session = state
        .terminal_registry
        .create(node_id.clone(), req.shell, req.cols, req.rows)
        .await;

    // Send CreateTerminal message to node
    let msg = Message::new(MessagePayload::CreateTerminal {
        session_id: session.id.clone(),
        shell: session.shell.clone(),
        cols: session.cols,
        rows: session.rows,
        env: req.env.clone(),
        working_dir: req.working_dir.clone(),
        sandbox: None,
    });

    if let Err(e) = state.node_registry.send_to_node(&node_id, msg).await {
        error!("Failed to send CreateTerminal to node {}: {}", node_id, e);
        // Clean up session
        state.terminal_registry.remove(&session.id).await;
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "sessionId": session.id,
            "nodeId": session.node_id,
            "shell": session.shell,
            "cols": session.cols,
            "rows": session.rows,
            "reconnected": false,
            "env": req.env,
            "workingDir": req.working_dir,
        })),
    ))
}

/// Check session status endpoint for reconnection
pub async fn check_session_status(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    let status = state
        .terminal_registry
        .check_session_status(&session_id)
        .await;

    if status.exists {
        Ok((StatusCode::OK, Json(status)))
    } else {
        Ok((StatusCode::NOT_FOUND, Json(status)))
    }
}

/// WebSocket upgrade handler for terminal session
pub async fn terminal_websocket_handler(
    Path(session_id): Path<String>,
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    info!(
        "🔄 Terminal WebSocket upgrade request for session: {}",
        session_id
    );

    ws.on_upgrade(move |socket| handle_terminal_socket(socket, session_id, state))
}

/// Handle the terminal WebSocket connection
async fn handle_terminal_socket(socket: WebSocket, session_id: String, state: Arc<AppState>) {
    info!("🔌 Terminal session {} connected", session_id);

    // Verify session exists
    let session = match state.terminal_registry.get(&session_id).await {
        Some(s) => s,
        None => {
            error!("Terminal session {} not found", session_id);
            return;
        }
    };

    let node_id = session.node_id.clone();

    // Mark session as connected
    state.terminal_registry.mark_connected(&session_id).await;

    // Channel for data from node to browser
    let (data_tx, mut data_rx) = mpsc::channel::<String>(100);
    state
        .terminal_registry
        .register_data_channel(session_id.clone(), data_tx)
        .await;

    // Split socket for concurrent read/write
    let (mut sender, mut receiver) = socket.split();

    // Send buffered output on reconnection
    let buffered_output = state
        .terminal_registry
        .get_buffered_output(&session_id)
        .await;
    if !buffered_output.is_empty() {
        info!(
            "Replaying {} buffered lines for session {}",
            buffered_output.len(),
            session_id
        );
        for line in buffered_output {
            if sender.send(WsMessage::Text(line)).await.is_err() {
                break;
            }
        }
    }

    // Task to forward data from node to browser
    let forward_task = tokio::spawn(async move {
        while let Some(data) = data_rx.recv().await {
            if sender.send(WsMessage::Text(data)).await.is_err() {
                break;
            }
        }
    });

    // Timeout warning check interval
    let mut warning_interval = interval(Duration::from_secs(30));

    // Track if this is an intentional close
    let mut intentional_close = false;
    let mut close_reason: Option<String> = None;

    // Handle incoming messages from browser
    loop {
        tokio::select! {
            msg = receiver.next() => {
                match msg {
                    Some(Ok(WsMessage::Text(text))) => {
                        // Update activity on any input
                        state.terminal_registry.update_activity(&session_id).await;

                        // Check for keepalive command
                        if let Ok(cmd) = serde_json::from_str::<KeepaliveCommand>(&text) {
                            if cmd.cmd_type == "keepalive" {
                                trace!("Keepalive received for session {}", session_id);
                                // Activity already updated above
                                continue;
                            }
                        }

                        // Parse resize command
                        if let Ok(cmd) = serde_json::from_str::<ResizeCommand>(&text) {
                            if cmd.cmd_type == "resize" {
                                let resize_msg = Message::new(MessagePayload::ResizeTerminal {
                                    session_id: session_id.clone(),
                                    cols: cmd.cols,
                                    rows: cmd.rows,
                                });

                                if let Err(e) = state.node_registry.send_to_node(&node_id, resize_msg).await {
                                    error!("Failed to send resize to node {}: {}", node_id, e);
                                }
                                continue;
                            }
                        }

                        // Forward terminal input to node
                        let input_msg = Message::new(MessagePayload::TerminalInput {
                            session_id: session_id.clone(),
                            data: text,
                        });

                        if let Err(e) = state.node_registry.send_to_node(&node_id, input_msg).await {
                            error!("Failed to send terminal input to node {}: {}", node_id, e);
                            break;
                        }
                    }

                    Some(Ok(WsMessage::Binary(data))) => {
                        // Update activity on any input
                        state.terminal_registry.update_activity(&session_id).await;

                        // Forward binary data to node
                        let data_str = String::from_utf8_lossy(&data);
                        let input_msg = Message::new(MessagePayload::TerminalInput {
                            session_id: session_id.clone(),
                            data: data_str.to_string(),
                        });

                        if let Err(e) = state.node_registry.send_to_node(&node_id, input_msg).await {
                            error!("Failed to send terminal input to node {}: {}", node_id, e);
                            break;
                        }
                    }

                    Some(Ok(WsMessage::Ping(_))) => {
                        // Update activity on ping
                        state.terminal_registry.update_activity(&session_id).await;
                        trace!("🏓 Ping from terminal {}", session_id);
                    }

                    Some(Ok(WsMessage::Pong(_))) => {
                        // Update activity on pong
                        state.terminal_registry.update_activity(&session_id).await;
                        trace!("🏓 Pong from terminal {}", session_id);
                    }

                    Some(Ok(WsMessage::Close(close_frame))) => {
                        info!("🔌 Terminal session {} closed by browser", session_id);
                        intentional_close = true;
                        close_reason = close_frame.as_ref().map(|f| format!("{:?}: {}", f.code, f.reason));
                        break;
                    }

                    Some(Err(e)) => {
                        error!("WebSocket error for terminal {}: {}", session_id, e);
                        close_reason = Some(format!("WebSocket error: {}", e));
                        break;
                    }

                    None => {
                        info!("Terminal WebSocket stream ended for {}", session_id);
                        close_reason = Some("Stream ended".to_string());
                        break;
                    }
                }
            }

            // Check for timeout warning
            _ = warning_interval.tick() => {
                if let Some(remaining_seconds) = state.terminal_registry.is_nearing_timeout(&session_id).await {
                    // Send warning to browser
                    let warning = serde_json::json!({
                        "type": "timeout_warning",
                        "remaining_seconds": remaining_seconds,
                        "message": format!("Session will timeout in {} minutes", remaining_seconds / 60)
                    });

                    // Send through the data channel
                    let _ = state.terminal_registry.send_to_browser(&session_id, warning.to_string()).await;
                }
            }

            _ = tokio::time::sleep(Duration::from_secs(30)) => {
                // Connection keepalive - WebSocket handles ping/pong automatically
                trace!("Keepalive check for terminal {}", session_id);
            }
        }
    }

    // Cleanup
    forward_task.abort();

    if intentional_close {
        // Intentional close - mark session as closed and clean up
        state
            .terminal_registry
            .mark_intentionally_closed(
                &session_id,
                close_reason.unwrap_or_else(|| "Browser closed".to_string()),
            )
            .await;
        state.terminal_registry.remove(&session_id).await;

        // Send close message to node
        let close_msg = Message::new(MessagePayload::CloseTerminal {
            session_id: session_id.clone(),
        });

        if let Err(e) = state.node_registry.send_to_node(&node_id, close_msg).await {
            error!("Failed to send CloseTerminal to node {}: {}", node_id, e);
        }

        info!("👋 Terminal session {} intentionally closed", session_id);
    } else {
        // Unintentional disconnect - allow reconnection window
        state
            .terminal_registry
            .mark_disconnected(&session_id, close_reason)
            .await;

        // Don't send CloseTerminal to node - keep it running for reconnection
        info!(
            "🔌 Terminal session {} disconnected (reconnection window open)",
            session_id
        );

        // Start a task to eventually close the session if no reconnection
        let session_id_clone = session_id.clone();
        let registry = state.terminal_registry.clone();
        let node_registry = state.node_registry.clone();

        tokio::spawn(async move {
            // Wait for reconnection window
            tokio::time::sleep(Duration::from_secs(RECONNECTION_WINDOW_SECONDS as u64)).await;

            // Check if session was reconnected
            if let Some(session) = registry.get(&session_id_clone).await {
                if session.connection_state == SessionConnectionState::Disconnected
                    && !session.intentional_close
                {
                    // No reconnection within window - clean up
                    info!(
                        "Reconnection window expired for session {}, closing terminal",
                        session_id_clone
                    );

                    registry.remove(&session_id_clone).await;

                    // Now send close to node
                    let close_msg = Message::new(MessagePayload::CloseTerminal {
                        session_id: session_id_clone.clone(),
                    });

                    let _ = node_registry.send_to_node(&node_id, close_msg).await;
                }
            }
        });
    }
}

#[derive(Debug, Deserialize)]
struct ResizeCommand {
    #[serde(rename = "type")]
    cmd_type: String,
    cols: u16,
    rows: u16,
}

#[derive(Debug, Deserialize)]
struct KeepaliveCommand {
    #[serde(rename = "type")]
    cmd_type: String,
}

/// Delete a terminal session
pub async fn delete_terminal_session(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    if let Some(session) = state.terminal_registry.get(&session_id).await {
        // Send close message to node
        let close_msg = Message::new(MessagePayload::CloseTerminal {
            session_id: session_id.clone(),
        });

        let _ = state
            .node_registry
            .send_to_node(&session.node_id, close_msg)
            .await;
    }

    state.terminal_registry.remove(&session_id).await;

    Ok(StatusCode::NO_CONTENT)
}

/// Handle terminal output from node (called from node_ws message handler)
pub async fn handle_terminal_output(state: &Arc<AppState>, session_id: &str, data: &str) {
    // Update activity on output
    state.terminal_registry.update_activity(session_id).await;

    if let Err(e) = state
        .terminal_registry
        .send_to_browser(session_id, data.to_string())
        .await
    {
        trace!("Failed to forward terminal output to browser: {}", e);
    }
}

// ============================================================================
// File Operations
// ============================================================================

/// Upload a file to the node's terminal session
/// POST /api/v1/terminal/:session_id/files/upload
pub async fn upload_file(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<FilePathQuery>,
    body: Bytes,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Get session
    let session = state
        .terminal_registry
        .get(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    // Validate file size
    if body.len() > MAX_FILE_SIZE {
        return Ok(Json(serde_json::json!({
            "error": "File too large",
            "max_size": MAX_FILE_SIZE,
        })));
    }

    // Validate path
    if !is_valid_path(&params.path) {
        return Ok(Json(serde_json::json!({
            "error": "Invalid path",
        })));
    }

    let operation_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    // Register pending operation
    state
        .terminal_registry
        .register_file_operation(operation_id.clone(), tx)
        .await;

    // Send file operation to node
    let file_op = FileOperation::Upload {
        path: params.path.clone(),
        data: body.to_vec(),
    };

    let msg = Message::new(MessagePayload::FileOperation { operation: file_op });

    if let Err(e) = state
        .node_registry
        .send_to_node(&session.node_id, msg)
        .await
    {
        error!("Failed to send file operation to node: {}", e);
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Wait for response
    match tokio::time::timeout(FILE_OPERATION_TIMEOUT, rx).await {
        Ok(Ok(response)) => {
            if response.success {
                Ok(Json(serde_json::json!({
                    "success": true,
                    "path": params.path,
                    "bytes_written": body.len(),
                })))
            } else {
                Ok(Json(serde_json::json!({
                    "success": false,
                    "error": response.error.unwrap_or_else(|| "Unknown error".to_string()),
                })))
            }
        }
        Ok(Err(_)) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        Err(_) => {
            error!("File upload timeout for session {}", session_id);
            Err(StatusCode::REQUEST_TIMEOUT)
        }
    }
}

/// Download a file from the node's terminal session
/// GET /api/v1/terminal/:session_id/files/download?path=...
pub async fn download_file(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<FilePathQuery>,
) -> Result<axum::response::Response, StatusCode> {
    use axum::body::Body;
    use axum::response::Response;

    // Get session
    let session = state
        .terminal_registry
        .get(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    // Validate path
    if !is_valid_path(&params.path) {
        return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"error": "Invalid path"}"#))
            .unwrap());
    }

    let operation_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    // Register pending operation
    state
        .terminal_registry
        .register_file_operation(operation_id.clone(), tx)
        .await;

    // Send file operation to node
    let file_op = FileOperation::Download {
        path: params.path.clone(),
    };

    let msg = Message::new(MessagePayload::FileOperation { operation: file_op });

    if let Err(e) = state
        .node_registry
        .send_to_node(&session.node_id, msg)
        .await
    {
        error!("Failed to send file operation to node: {}", e);
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Wait for response
    match tokio::time::timeout(FILE_OPERATION_TIMEOUT, rx).await {
        Ok(Ok(response)) => {
            if response.success {
                let data = response.data.unwrap_or_default();
                let filename = std::path::Path::new(&params.path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("download");

                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("content-type", "application/octet-stream")
                    .header(
                        "content-disposition",
                        format!("attachment; filename=\"{}\"", filename),
                    )
                    .body(Body::from(data))
                    .unwrap())
            } else {
                let error_json = serde_json::json!({
                    "success": false,
                    "error": response.error.unwrap_or_else(|| "File not found".to_string()),
                });
                Ok(Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header("content-type", "application/json")
                    .body(Body::from(error_json.to_string()))
                    .unwrap())
            }
        }
        Ok(Err(_)) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        Err(_) => {
            error!("File download timeout for session {}", session_id);
            Err(StatusCode::REQUEST_TIMEOUT)
        }
    }
}

/// List files in a directory on the node
/// GET /api/v1/terminal/:session_id/files/list?path=...
pub async fn list_files(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<FilePathQuery>,
) -> Result<axum::response::Response, StatusCode> {
    use axum::body::Body;
    use axum::response::Response;
    // Get session
    let session = state
        .terminal_registry
        .get(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    // Validate path
    if !is_valid_path(&params.path) {
        return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"error": "Invalid path"}"#))
            .unwrap());
    }

    let operation_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    // Register pending operation
    state
        .terminal_registry
        .register_file_operation(operation_id.clone(), tx)
        .await;

    // Send file operation to node
    let file_op = FileOperation::List {
        path: params.path.clone(),
    };

    let msg = Message::new(MessagePayload::FileOperation { operation: file_op });

    if let Err(e) = state
        .node_registry
        .send_to_node(&session.node_id, msg)
        .await
    {
        error!("Failed to send file operation to node: {}", e);
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Wait for response
    match tokio::time::timeout(FILE_OPERATION_TIMEOUT, rx).await {
        Ok(Ok(response)) => {
            if response.success {
                let entries = response.entries.unwrap_or_default();
                let list_response = FileListResponse {
                    path: params.path,
                    entries,
                };
                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&list_response).unwrap()))
                    .unwrap())
            } else {
                let error_json = serde_json::json!({
                    "success": false,
                    "error": response.error.unwrap_or_else(|| "Directory not found".to_string()),
                });
                Ok(Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header("content-type", "application/json")
                    .body(Body::from(error_json.to_string()))
                    .unwrap())
            }
        }
        Ok(Err(_)) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        Err(_) => {
            error!("File list timeout for session {}", session_id);
            Err(StatusCode::REQUEST_TIMEOUT)
        }
    }
}

/// Delete a file on the node
/// DELETE /api/v1/terminal/:session_id/files?path=...
pub async fn delete_file(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<FilePathQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Get session
    let session = state
        .terminal_registry
        .get(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    // Validate path
    if !is_valid_path(&params.path) {
        return Ok(Json(serde_json::json!({
            "error": "Invalid path",
        })));
    }

    // Prevent deletion of sensitive paths
    if is_sensitive_path(&params.path) {
        return Ok(Json(serde_json::json!({
            "error": "Cannot delete sensitive system paths",
        })));
    }

    let operation_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    // Register pending operation
    state
        .terminal_registry
        .register_file_operation(operation_id.clone(), tx)
        .await;

    // Send file operation to node
    let file_op = FileOperation::Delete {
        path: params.path.clone(),
    };

    let msg = Message::new(MessagePayload::FileOperation { operation: file_op });

    if let Err(e) = state
        .node_registry
        .send_to_node(&session.node_id, msg)
        .await
    {
        error!("Failed to send file operation to node: {}", e);
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Wait for response
    match tokio::time::timeout(FILE_OPERATION_TIMEOUT, rx).await {
        Ok(Ok(response)) => {
            if response.success {
                Ok(Json(serde_json::json!({
                    "success": true,
                    "path": params.path,
                })))
            } else {
                Ok(Json(serde_json::json!({
                    "success": false,
                    "error": response.error.unwrap_or_else(|| "File not found".to_string()),
                })))
            }
        }
        Ok(Err(_)) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        Err(_) => {
            error!("File delete timeout for session {}", session_id);
            Err(StatusCode::REQUEST_TIMEOUT)
        }
    }
}

/// Create a directory on the node
/// POST /api/v1/terminal/:session_id/files/mkdir?path=...
pub async fn mkdir(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<FilePathQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Get session
    let session = state
        .terminal_registry
        .get(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    // Validate path
    if !is_valid_path(&params.path) {
        return Ok(Json(serde_json::json!({
            "error": "Invalid path",
        })));
    }

    let operation_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    // Register pending operation
    state
        .terminal_registry
        .register_file_operation(operation_id.clone(), tx)
        .await;

    // Send file operation to node
    let file_op = FileOperation::Mkdir {
        path: params.path.clone(),
    };

    let msg = Message::new(MessagePayload::FileOperation { operation: file_op });

    if let Err(e) = state
        .node_registry
        .send_to_node(&session.node_id, msg)
        .await
    {
        error!("Failed to send file operation to node: {}", e);
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Wait for response
    match tokio::time::timeout(FILE_OPERATION_TIMEOUT, rx).await {
        Ok(Ok(response)) => {
            if response.success {
                Ok(Json(serde_json::json!({
                    "success": true,
                    "path": params.path,
                })))
            } else {
                Ok(Json(serde_json::json!({
                    "success": false,
                    "error": response.error.unwrap_or_else(|| "Failed to create directory".to_string()),
                })))
            }
        }
        Ok(Err(_)) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        Err(_) => {
            error!("File mkdir timeout for session {}", session_id);
            Err(StatusCode::REQUEST_TIMEOUT)
        }
    }
}

/// Get file/directory info on the node
/// GET /api/v1/terminal/:session_id/files/stat?path=...
pub async fn stat_file(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<FilePathQuery>,
) -> Result<axum::response::Response, StatusCode> {
    use axum::body::Body;
    use axum::response::Response;
    // Get session
    let session = state
        .terminal_registry
        .get(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    // Validate path
    if !is_valid_path(&params.path) {
        use axum::response::IntoResponse;
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid path",
            })),
        )
            .into_response());
    }

    let operation_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    // Register pending operation
    state
        .terminal_registry
        .register_file_operation(operation_id.clone(), tx)
        .await;

    // Send file operation to node
    let file_op = FileOperation::Stat {
        path: params.path.clone(),
    };

    let msg = Message::new(MessagePayload::FileOperation { operation: file_op });

    if let Err(e) = state
        .node_registry
        .send_to_node(&session.node_id, msg)
        .await
    {
        error!("Failed to send file operation to node: {}", e);
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Wait for response
    match tokio::time::timeout(FILE_OPERATION_TIMEOUT, rx).await {
        Ok(Ok(response)) => {
            if response.success {
                let entries = response.entries.unwrap_or_default();
                if let Some(entry) = entries.first() {
                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "application/json")
                        .body(Body::from(serde_json::to_string(entry).unwrap()))
                        .unwrap())
                } else {
                    Err(StatusCode::NOT_FOUND)
                }
            } else {
                let error_json = serde_json::json!({
                    "success": false,
                    "error": response.error.unwrap_or_else(|| "File not found".to_string()),
                });
                Ok(Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header("content-type", "application/json")
                    .body(Body::from(error_json.to_string()))
                    .unwrap())
            }
        }
        Ok(Err(_)) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        Err(_) => {
            error!("File stat timeout for session {}", session_id);
            Err(StatusCode::REQUEST_TIMEOUT)
        }
    }
}

/// Handle file operation result from node
pub async fn handle_file_operation_result(
    terminal_registry: &TerminalSessionRegistry,
    operation_id: String,
    success: bool,
    error: Option<String>,
    data: Option<Vec<u8>>,
    entries: Option<Vec<FileEntry>>,
) {
    let response = FileOperationResponse {
        success,
        error,
        data,
        entries,
    };

    if let Err(_response) = terminal_registry
        .complete_file_operation(&operation_id, response)
        .await
    {
        warn!(
            "Could not complete file operation {} - no pending request found",
            operation_id
        );
    }
}

/// Handle file download data from node (chunked)
pub async fn handle_file_download(
    _state: &Arc<AppState>,
    path: &str,
    _data: Vec<u8>,
    chunk_index: u32,
    total_chunks: u32,
) {
    debug!(
        "Received file download chunk {}/{} for {}",
        chunk_index, total_chunks, path
    );
    // For chunked downloads, we would need to buffer chunks and reassemble
    // This is a simplified implementation
}

/// Handle file list from node
pub async fn handle_file_list(_state: &Arc<AppState>, path: &str, entries: Vec<FileEntry>) {
    debug!("Received file list for {}: {} entries", path, entries.len());
}

/// Handle file transfer progress from node
pub async fn handle_file_transfer_progress(
    state: &Arc<AppState>,
    operation_id: &str,
    bytes_transferred: u64,
    total_bytes: u64,
    percentage: f32,
) {
    let progress = FileTransferProgress {
        bytes_transferred,
        total_bytes,
        percentage,
    };

    let _ = state
        .terminal_registry
        .send_file_progress(operation_id, progress)
        .await;
}

/// Validate a file path for security
fn is_valid_path(path: &str) -> bool {
    // Check for path traversal attempts
    if path.contains("..") {
        return false;
    }

    // Check for null bytes
    if path.contains('\0') {
        return false;
    }

    // Must be absolute path
    if !path.starts_with('/') {
        return false;
    }

    // Path length limit
    if path.len() > 4096 {
        return false;
    }

    true
}

/// Check if path is sensitive and should not be deleted
fn is_sensitive_path(path: &str) -> bool {
    let sensitive_paths = [
        "/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/root", "/sbin", "/sys",
        "/usr", "/var",
    ];

    for sensitive in &sensitive_paths {
        if path == *sensitive {
            return true;
        }
    }

    false
}

/// Create file operation routes
pub fn file_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/:session_id/files/upload", post(upload_file))
        .route("/:session_id/files/download", get(download_file))
        .route("/:session_id/files/list", get(list_files))
        .route("/:session_id/files", delete(delete_file))
        .route("/:session_id/files/mkdir", post(mkdir))
        .route("/:session_id/files/stat", get(stat_file))
        .layer(DefaultBodyLimit::max(MAX_FILE_SIZE))
}
