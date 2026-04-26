#![allow(dead_code, unused_variables, unused_imports)]
#[cfg(target_os = "linux")]
//! Node WebSocket Handler
//!
//! Handles WebSocket connections from Allternit Nodes.
//! - Node registration and authentication
//! - Heartbeat monitoring
//! - Job dispatch
//! - Message routing
//! - Database persistence

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
};
use chrono::{DateTime, Utc};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, trace, warn};
use uuid::Uuid;

use allternit_protocol::{
    FileEntry, JobResult, JobSpec, Message, MessagePayload, NodeCapabilities, NodeConfig,
    NodeStatus, ResourceUsage,
};

use crate::AppState;

/// Node record in database
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct NodeRecord {
    pub id: String,
    pub user_id: String,
    pub hostname: String,
    pub version: String,
    pub docker_available: bool,
    pub gpu_available: bool,
    pub cpu_cores: i32,
    pub memory_gb: i64,
    pub disk_gb: i64,
    pub os: String,
    pub arch: String,
    pub labels: String, // JSON array
    pub status: String,
    pub auth_token_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

/// Node connection state (in-memory)
pub struct NodeConnection {
    pub node_id: String,
    pub user_id: String,
    pub capabilities: NodeCapabilities,
    pub sender: mpsc::Sender<Message>,
    pub last_heartbeat: std::time::Instant,
    pub status: NodeStatus,
}

/// Registry of all connected nodes
#[derive(Default)]
pub struct NodeRegistry {
    nodes: RwLock<HashMap<String, NodeConnection>>,
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self {
            nodes: RwLock::new(HashMap::new()),
        }
    }

    /// Register a new node connection
    pub async fn register(&self, node_id: String, connection: NodeConnection) {
        let mut nodes = self.nodes.write().await;

        // If node was already connected, old connection will be dropped
        if nodes.contains_key(&node_id) {
            warn!("Node {} reconnected, dropping old connection", node_id);
        }

        nodes.insert(node_id.clone(), connection);
        info!("✅ Node registered: {}", node_id);
    }

    /// Unregister a node
    pub async fn unregister(&self, node_id: &str) {
        let mut nodes = self.nodes.write().await;
        if nodes.remove(node_id).is_some() {
            info!("❌ Node unregistered: {}", node_id);
        }
    }

    /// Get a node's connection
    pub async fn get_node(&self, node_id: &str) -> Option<NodeConnection> {
        let nodes = self.nodes.read().await;
        nodes.get(node_id).cloned()
    }

    /// Get all connected nodes
    pub async fn list_nodes(&self) -> Vec<String> {
        let nodes = self.nodes.read().await;
        nodes.keys().cloned().collect()
    }

    /// Get all connected node details
    pub async fn list_node_details(&self) -> Vec<(String, NodeStatus, std::time::Instant)> {
        let nodes = self.nodes.read().await;
        nodes
            .iter()
            .map(|(id, conn)| (id.clone(), conn.status.clone(), conn.last_heartbeat))
            .collect()
    }

    /// Update heartbeat timestamp
    pub async fn update_heartbeat(&self, node_id: &str) {
        let mut nodes = self.nodes.write().await;
        if let Some(conn) = nodes.get_mut(node_id) {
            conn.last_heartbeat = std::time::Instant::now();
        }
    }

    /// Check for stale connections (no heartbeat)
    pub async fn check_stale(&self, timeout: std::time::Duration) -> Vec<String> {
        let nodes = self.nodes.read().await;
        let now = std::time::Instant::now();

        nodes
            .iter()
            .filter(|(_, conn)| now.duration_since(conn.last_heartbeat) > timeout)
            .map(|(id, _)| id.clone())
            .collect()
    }

    /// Send message to a specific node
    pub async fn send_to_node(&self, node_id: &str, message: Message) -> Result<(), String> {
        let nodes = self.nodes.read().await;

        if let Some(conn) = nodes.get(node_id) {
            conn.sender
                .send(message)
                .await
                .map_err(|e| format!("Failed to send: {}", e))?;
            Ok(())
        } else {
            Err(format!("Node {} not connected", node_id))
        }
    }

    /// Find best node for a job based on capabilities
    pub async fn find_best_node(&self, required_caps: &NodeCapabilities) -> Option<String> {
        let nodes = self.nodes.read().await;

        nodes
            .iter()
            .filter(|(_, conn)| {
                // Check if node meets requirements
                let caps = &conn.capabilities;

                // Docker requirement
                if required_caps.docker && !caps.docker {
                    return false;
                }

                // GPU requirement
                if required_caps.gpu && !caps.gpu {
                    return false;
                }

                // CPU requirement
                if caps.total_cpu < required_caps.total_cpu {
                    return false;
                }

                // Memory requirement
                if caps.total_memory_gb < required_caps.total_memory_gb {
                    return false;
                }

                // Check if node is online
                if conn.status != NodeStatus::Online {
                    return false;
                }

                true
            })
            .map(|(id, conn)| (id.clone(), conn.last_heartbeat))
            .min_by_key(|(_, heartbeat)| *heartbeat) // Pick node with oldest heartbeat (most idle)
            .map(|(id, _)| id)
    }

    /// Broadcast message to all nodes for a user
    pub async fn broadcast_to_user(&self, user_id: &str, message: Message) -> Vec<String> {
        let nodes = self.nodes.read().await;
        let mut failed = Vec::new();

        for (node_id, conn) in nodes.iter() {
            if conn.user_id == user_id {
                if let Err(_) = conn.sender.send(message.clone()).await {
                    failed.push(node_id.clone());
                }
            }
        }

        failed
    }
}

impl Clone for NodeConnection {
    fn clone(&self) -> Self {
        Self {
            node_id: self.node_id.clone(),
            user_id: self.user_id.clone(),
            capabilities: self.capabilities.clone(),
            sender: self.sender.clone(),
            last_heartbeat: self.last_heartbeat,
            status: self.status.clone(),
        }
    }
}

/// Initialize database tables for nodes
pub async fn init_node_tables(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            hostname TEXT NOT NULL,
            version TEXT NOT NULL,
            docker_available BOOLEAN NOT NULL DEFAULT 0,
            gpu_available BOOLEAN NOT NULL DEFAULT 0,
            cpu_cores INTEGER NOT NULL DEFAULT 1,
            memory_gb INTEGER NOT NULL DEFAULT 1,
            disk_gb INTEGER NOT NULL DEFAULT 10,
            os TEXT NOT NULL DEFAULT 'linux',
            arch TEXT NOT NULL DEFAULT 'x86_64',
            labels TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'offline',
            auth_token_hash TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create index on user_id for faster queries
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_nodes_user_id ON nodes(user_id)
        "#,
    )
    .execute(pool)
    .await?;

    // Create node_job_history table for node-executed job history.
    // The queued job system owns the node_jobs table.
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS node_job_history (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            duration_secs INTEGER,
            exit_code INTEGER,
            stdout TEXT,
            stderr TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Node database tables initialized");
    Ok(())
}

/// Generate a secure node token
fn create_node_token() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const TOKEN_LEN: usize = 32;

    use rand::Rng;
    let mut rng = rand::thread_rng();
    let token: String = (0..TOKEN_LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();

    format!("allternit_{}", token)
}

/// Hash a token for storage (simple hash for now - should use bcrypt in production)
pub fn hash_token(token: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    token.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Verify a token against its hash
pub fn verify_token(token: &str, hash: &str) -> bool {
    hash_token(token) == hash
}

/// Register a new node in the database
pub async fn register_node_in_db(
    pool: &SqlitePool,
    node_id: &str,
    user_id: &str,
    hostname: &str,
    version: &str,
    capabilities: &NodeCapabilities,
    labels: &[String],
    auth_token: &str,
) -> Result<NodeRecord, sqlx::Error> {
    let labels_json = serde_json::to_string(labels).unwrap_or_default();
    let token_hash = hash_token(auth_token);

    sqlx::query_as::<_, NodeRecord>(
        r#"
        INSERT INTO nodes (
            id, user_id, hostname, version, docker_available, gpu_available,
            cpu_cores, memory_gb, disk_gb, os, arch, labels, status,
            auth_token_hash, created_at, updated_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            hostname = excluded.hostname,
            version = excluded.version,
            docker_available = excluded.docker_available,
            gpu_available = excluded.gpu_available,
            cpu_cores = excluded.cpu_cores,
            memory_gb = excluded.memory_gb,
            disk_gb = excluded.disk_gb,
            os = excluded.os,
            arch = excluded.arch,
            labels = excluded.labels,
            status = 'online',
            updated_at = datetime('now'),
            last_seen_at = datetime('now')
        RETURNING *
        "#,
    )
    .bind(node_id)
    .bind(user_id)
    .bind(hostname)
    .bind(version)
    .bind(capabilities.docker)
    .bind(capabilities.gpu)
    .bind(capabilities.total_cpu as i32)
    .bind(capabilities.total_memory_gb as i64)
    .bind(capabilities.total_disk_gb as i64)
    .bind(&capabilities.os)
    .bind(&capabilities.arch)
    .bind(labels_json)
    .bind("online")
    .bind(token_hash)
    .fetch_one(pool)
    .await
}

/// Update node status in database
pub async fn update_node_status(
    pool: &SqlitePool,
    node_id: &str,
    status: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE nodes SET
            status = ?,
            last_seen_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(status)
    .bind(node_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Get all nodes for a user
pub async fn get_user_nodes(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<Vec<NodeRecord>, sqlx::Error> {
    sqlx::query_as::<_, NodeRecord>(
        r#"
        SELECT * FROM nodes WHERE user_id = ? ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Get a single node by ID
pub async fn get_node_by_id(
    pool: &SqlitePool,
    node_id: &str,
) -> Result<Option<NodeRecord>, sqlx::Error> {
    sqlx::query_as::<_, NodeRecord>(
        r#"
        SELECT * FROM nodes WHERE id = ?
        "#,
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
}

/// Delete a node
pub async fn delete_node(pool: &SqlitePool, node_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM nodes WHERE id = ?")
        .bind(node_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// WebSocket upgrade handler
pub async fn node_websocket_handler(
    Path(node_id): Path<String>,
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    info!("🔄 WebSocket upgrade request from node: {}", node_id);

    ws.on_upgrade(move |socket| handle_node_socket(socket, node_id, state))
}

/// Handle the WebSocket connection
async fn handle_node_socket(socket: WebSocket, node_id: String, state: Arc<AppState>) {
    info!("🔌 Node {} connected via WebSocket", node_id);

    // Channel for outgoing messages
    let (tx, mut rx) = mpsc::channel::<Message>(100);

    // Split socket for concurrent read/write
    let (mut sender, mut receiver) = socket.split();

    // Wait for registration message
    let registration =
        tokio::time::timeout(std::time::Duration::from_secs(10), receiver.next()).await;

    let (capabilities, user_id) = match registration {
        Ok(Some(Ok(WsMessage::Text(text)))) => {
            match serde_json::from_str::<Message>(&text) {
                Ok(Message {
                    payload:
                        MessagePayload::NodeRegister {
                            node_id: reg_node_id,
                            auth_token: token,
                            capabilities,
                            hostname,
                            version,
                            labels,
                        },
                    ..
                }) => {
                    if reg_node_id != node_id {
                        warn!(
                            "Node ID mismatch: expected {}, got {}",
                            node_id, reg_node_id
                        );
                        let _ = sender
                            .send(WsMessage::Text(
                                serde_json::to_string(&Message::new(
                                    MessagePayload::NodeRegistered {
                                        node_id: node_id.clone(),
                                        config: NodeConfig::default(),
                                    },
                                ))
                                .unwrap(),
                            ))
                            .await;
                        return;
                    }

                    // Verify JWT token
                    let user_id = match state.node_auth.validate_token(&token) {
                        Ok(claims) => {
                            info!(
                                "✅ Node {} token validated for user {}",
                                node_id, claims.user_id
                            );
                            claims.user_id
                        }
                        Err(e) => {
                            warn!("Invalid token from node {}: {}", node_id, e);
                            // For backward compatibility, accept token as registration token
                            // In production, reject invalid tokens
                            "user-123".to_string()
                        }
                    };

                    info!("📋 Node {} registered ({} v{})", node_id, hostname, version);

                    // Persist to database
                    if let Err(e) = register_node_in_db(
                        &state.database,
                        &node_id,
                        &user_id,
                        &hostname,
                        &version,
                        &capabilities,
                        &labels,
                        &token,
                    )
                    .await
                    {
                        error!("Failed to persist node {} to database: {}", node_id, e);
                    }

                    (capabilities, user_id)
                }
                Ok(_) => {
                    error!("Expected NodeRegister message from {}", node_id);
                    return;
                }
                Err(e) => {
                    error!("Failed to parse registration from {}: {}", node_id, e);
                    return;
                }
            }
        }
        _ => {
            error!(
                "Failed to receive valid registration message from {}",
                node_id
            );
            return;
        }
    };

    // Register the node
    let connection = NodeConnection {
        node_id: node_id.clone(),
        user_id: user_id.clone(),
        capabilities: capabilities.clone(),
        sender: tx.clone(),
        last_heartbeat: std::time::Instant::now(),
        status: NodeStatus::Online,
    };

    state
        .node_registry
        .register(node_id.clone(), connection)
        .await;

    // Send registration acknowledgment
    let ack = Message::new(MessagePayload::NodeRegistered {
        node_id: node_id.clone(),
        config: NodeConfig::default(),
    });

    if let Err(e) = sender
        .send(WsMessage::Text(serde_json::to_string(&ack).unwrap()))
        .await
    {
        error!("Failed to send registration ack to {}: {}", node_id, e);
        state.node_registry.unregister(&node_id).await;
        return;
    }

    // Main message loop
    let node_id_clone = node_id.clone();
    let node_registry = state.node_registry.clone();
    let terminal_registry = state.terminal_registry.clone();
    let database = state.database.clone();

    loop {
        tokio::select! {
            // Incoming WebSocket messages from node
            msg = receiver.next() => {
                match msg {
                    Some(Ok(WsMessage::Text(text))) => {
                        trace!("📨 From {}: {}", node_id_clone, text);

                        match serde_json::from_str::<Message>(&text) {
                            Ok(message) => {
                                if let Err(e) = handle_node_message(
                                    &node_id_clone,
                                    message,
                                    &node_registry,
                                    &database,
                                    &terminal_registry,
                                    &state.job_queue,
                                    &tx, &state
                                ).await {
                                    error!("Error handling message from {}: {}", node_id_clone, e);
                                }
                            }
                            Err(e) => {
                                error!("Failed to parse message from {}: {}", node_id_clone, e);
                            }
                        }
                    }

                    Some(Ok(WsMessage::Ping(data))) => {
                        trace!("🏓 Ping from {}", node_id_clone);
                    }

                    Some(Ok(WsMessage::Pong(_))) => {
                        trace!("🏓 Pong from {}", node_id_clone);
                    }

                    Some(Ok(WsMessage::Binary(_))) => {
                        warn!("Binary messages not supported from {}", node_id_clone);
                    }

                    Some(Ok(WsMessage::Close(frame))) => {
                        info!("🔌 Node {} closed connection: {:?}", node_id_clone, frame);
                        break;
                    }

                    Some(Err(e)) => {
                        error!("❌ WebSocket error from {}: {}", node_id_clone, e);
                        break;
                    }

                    None => {
                        warn!("⚠️ WebSocket stream ended for {}", node_id_clone);
                        break;
                    }
                }
            }

            // Outgoing messages to node
            Some(msg) = rx.recv() => {
                let json = serde_json::to_string(&msg).unwrap();
                trace!("📤 To {}: {}", node_id_clone, json);

                if let Err(e) = sender.send(WsMessage::Text(json)).await {
                    error!("Failed to send to {}: {}", node_id_clone, e);
                    break;
                }
            }

            // Health check - send ping periodically
            _ = tokio::time::sleep(std::time::Duration::from_secs(30)) => {
                let ping = Message::new(MessagePayload::Ping {
                    timestamp: chrono::Utc::now(),
                });

                if let Err(e) = sender.send(WsMessage::Text(
                    serde_json::to_string(&ping).unwrap()
                )).await {
                    error!("Failed to send ping to {}: {}", node_id_clone, e);
                    break;
                }
            }
        }
    }

    // Cleanup
    node_registry.unregister(&node_id_clone).await;

    // Update status to offline in database
    if let Err(e) = update_node_status(&database, &node_id_clone, "offline").await {
        error!("Failed to update node {} status: {}", node_id_clone, e);
    }

    info!("👋 Connection closed for node {}", node_id_clone);
}

/// Handle incoming message from node
async fn handle_node_message(
    node_id: &str,
    msg: Message,
    registry: &NodeRegistry,
    database: &SqlitePool,
    terminal_registry: &crate::terminal_ws::TerminalSessionRegistry,
    job_queue: &crate::node_job_queue::JobQueue,
    _sender: &mpsc::Sender<Message>,
    state: &crate::AppState,
) -> Result<(), String> {
    match msg.payload {
        MessagePayload::Heartbeat {
            node_id: msg_node_id,
            status,
            resource_usage,
            running_jobs,
        } => {
            if msg_node_id != node_id {
                return Err("Node ID mismatch in heartbeat".to_string());
            }

            registry.update_heartbeat(node_id).await;

            // Update last_seen_at in database periodically (every 5 heartbeats ~ 2.5 min)
            // For simplicity, we update every heartbeat for now
            if let Err(e) = update_node_status(database, node_id, "online").await {
                error!("Failed to update node {} heartbeat in db: {}", node_id, e);
            }

            debug!(
                "💓 Heartbeat from {}: status={:?}, cpu={:.1}%, jobs={}",
                node_id, status, resource_usage.cpu_percent, running_jobs
            );
        }

        MessagePayload::JobStarted { job_id, node_id: _ } => {
            info!("🚀 Job {} started on node {}", job_id, node_id);

            // Update job status in database
            if let Err(e) = job_queue
                .update_status(&job_id, crate::node_job_queue::JobStatus::Running)
                .await
            {
                error!("Failed to update job {} status: {}", job_id, e);
            }

            // Broadcast to UI clients
            let _ = state.job_events_tx.send(crate::JobEvent {
                event_type: "job_started".to_string(),
                job_id: job_id.clone(),
                status: Some("running".to_string()),
                progress: None,
                message: Some("Job started".to_string()),
                timestamp: chrono::Utc::now(),
            });
        }

        MessagePayload::JobProgress {
            job_id,
            progress,
            message,
            logs,
        } => {
            debug!(
                "📊 Job {} progress: {:.0}% - {}",
                job_id,
                progress * 100.0,
                message
            );

            // Stream logs if any
            for log in logs {
                trace!("📄 Job {} log: {}", job_id, log);
            }

            // Broadcast to UI clients
            let _ = state.job_events_tx.send(crate::JobEvent {
                event_type: "job_progress".to_string(),
                job_id: job_id.clone(),
                status: None,
                progress: Some(progress),
                message: Some(message.clone()),
                timestamp: chrono::Utc::now(),
            });
        }

        MessagePayload::JobCompleted {
            job_id,
            result,
            duration_secs,
        } => {
            info!(
                "✅ Job {} completed on {} in {}s (success={})",
                job_id, node_id, duration_secs, result.success
            );

            // Store job result in database
            if let Err(e) = job_queue.store_result(&job_id, &result).await {
                error!("Failed to store job {} result: {}", job_id, e);
            }

            // Broadcast to UI clients
            let _ = state.job_events_tx.send(crate::JobEvent {
                event_type: "job_completed".to_string(),
                job_id: job_id.clone(),
                status: Some(
                    if result.success {
                        "completed"
                    } else {
                        "failed"
                    }
                    .to_string(),
                ),
                progress: Some(1.0),
                message: Some(
                    if result.success {
                        "Job completed successfully"
                    } else {
                        "Job failed"
                    }
                    .to_string(),
                ),
                timestamp: chrono::Utc::now(),
            });
        }

        MessagePayload::JobLog {
            job_id,
            level,
            message,
            timestamp,
        } => {
            trace!("📝 [{}] Job {} {:?}: {}", timestamp, job_id, level, message);

            // Broadcast to UI clients
            let _ = state.job_events_tx.send(crate::JobEvent {
                event_type: "job_log".to_string(),
                job_id: job_id.clone(),
                status: None,
                progress: None,
                message: Some(format!("[{:?}] {}", level, message)),
                timestamp: chrono::Utc::now(),
            });
        }

        MessagePayload::TerminalOutput { session_id, data } => {
            trace!("💻 Terminal {} output: {} bytes", session_id, data.len());
            // Forward to browser terminal via terminal service
            if let Err(e) = terminal_registry.send_to_browser(&session_id, data).await {
                trace!("Failed to forward terminal output: {}", e);
            }
        }

        MessagePayload::FileOperationResult {
            operation_id,
            success,
            error,
            data,
        } => {
            debug!(
                "📁 File operation {} result: success={}",
                operation_id, success
            );
            if let Some(ref err) = error {
                error!("File operation {} failed: {}", operation_id, err);
            }

            // Extract file content and entries from FileData
            let file_data = data.as_ref();
            let content = file_data.and_then(|d| d.content.clone());
            let entries = file_data.and_then(|d| {
                d.children.as_ref().map(|children| {
                    children
                        .iter()
                        .map(|child| allternit_protocol::FileEntry {
                            name: child.name.clone(),
                            path: child.path.clone(),
                            is_dir: child.is_dir,
                            size: child.size,
                            modified: child.modified,
                            permissions: child.permissions,
                            mime_type: None, // Will be determined by client if needed
                        })
                        .collect()
                })
            });

            // Forward to terminal registry to complete pending operation
            crate::terminal_ws::handle_file_operation_result(
                terminal_registry,
                operation_id,
                success,
                error,
                content,
                entries,
            )
            .await;
        }

        _ => {
            warn!(
                "Unexpected message type from node {}: {:?}",
                node_id, msg.payload
            );
        }
    }

    Ok(())
}

/// HTTP handler to list connected nodes
pub async fn list_nodes(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    let nodes = state.node_registry.list_nodes().await;
    let connected_details = state.node_registry.list_node_details().await;

    // Get all nodes from database
    let all_nodes = match get_user_nodes(&state.database, "user-123").await {
        Ok(nodes) => nodes,
        Err(e) => {
            error!("Failed to get nodes from database: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok((
        StatusCode::OK,
        axum::Json(serde_json::json!({
            "connected": nodes,
            "connected_details": connected_details.iter().map(|(id, status, _)| {
                serde_json::json!({
                    "id": id,
                    "status": status,
                })
            }).collect::<Vec<_>>(),
            "all_nodes": all_nodes,
            "count": nodes.len(),
            "total_nodes": all_nodes.len(),
        })),
    ))
}

/// HTTP handler to get a specific node
pub async fn get_node(
    Path(node_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    // Check if connected
    let is_connected = state.node_registry.get_node(&node_id).await.is_some();

    // Get from database
    match get_node_by_id(&state.database, &node_id).await {
        Ok(Some(node)) => Ok((
            StatusCode::OK,
            axum::Json(serde_json::json!({
                "node": node,
                "connected": is_connected,
            })),
        )),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get node {}: {}", node_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// HTTP handler to delete a node
pub async fn delete_node_handler(
    Path(node_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    // Disconnect if connected
    if let Some(_conn) = state.node_registry.get_node(&node_id).await {
        // Send shutdown message to node
        let shutdown_msg = Message::new(MessagePayload::Shutdown);
        let _ = state
            .node_registry
            .send_to_node(&node_id, shutdown_msg)
            .await;

        // Unregister from registry
        state.node_registry.unregister(&node_id).await;

        info!("👋 Node {} disconnected and unregistered", node_id);
    }

    // Delete from database
    match delete_node(&state.database, &node_id).await {
        Ok(()) => {
            info!("✅ Node {} deleted from database", node_id);
            Ok((StatusCode::NO_CONTENT, ()))
        }
        Err(e) => {
            error!("Failed to delete node {}: {}", node_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// HTTP handler to generate a new node token
pub async fn generate_node_token(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    let token = state
        .node_auth
        .generate_node_token(
            &format!("node-{}", Uuid::new_v4()),
            "user-123", // In production, get from authenticated user session
            None,
        )
        .map_err(|e| {
            error!("Failed to generate token: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::OK,
        axum::Json(serde_json::json!({
            "token": token,
            "token_type": "jwt",
            "install_command": format!(
                "curl -fsSL https://install.allternit.com | ALLTERNIT_TOKEN={} bash",
                token
            ),
        })),
    ))
}

/// HTTP handler to send a job to a node
pub async fn assign_job_to_node(
    Path(node_id): Path<String>,
    State(state): State<Arc<AppState>>,
    axum::Json(job): axum::Json<JobSpec>,
) -> Result<impl IntoResponse, StatusCode> {
    // If node_id is "auto", find best node based on job requirements
    let target_node_id = if node_id == "auto" {
        match state
            .node_registry
            .find_best_node(&job.resources.clone().into())
            .await
        {
            Some(id) => {
                info!("🎯 Auto-selected node {} for job {}", id, job.id);
                id
            }
            None => {
                warn!("No suitable node found for job {}", job.id);
                return Err(StatusCode::SERVICE_UNAVAILABLE);
            }
        }
    } else {
        node_id
    };

    let message = Message::new(MessagePayload::AssignJob { job });

    match state
        .node_registry
        .send_to_node(&target_node_id, message)
        .await
    {
        Ok(()) => Ok((
            StatusCode::OK,
            axum::Json(serde_json::json!({
                "status": "sent",
                "node_id": target_node_id,
            })),
        )),
        Err(e) => {
            warn!("Failed to send job to node {}: {}", target_node_id, e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}
