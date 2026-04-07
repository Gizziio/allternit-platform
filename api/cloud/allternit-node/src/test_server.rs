//! Test Control Plane Server
//!
//! Minimal WebSocket server for testing the A2R Node.
//! Run this alongside the node to verify connectivity.
//!
//! Usage:
//!   cargo run --bin test-server
//!   PORT=8013 cargo run --bin test-server

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        Path,
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{info, warn, debug};

use allternit_protocol::{
    Message, MessagePayload, NodeConfig, NodeCapabilities,
    NodeStatus, ResourceUsage, JobSpec, JobResult,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("info,allternit_node=debug")
        .init();

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8013);

    run_test_server(port).await
}

/// Simple test node registry
pub struct TestNodeRegistry {
    nodes: RwLock<HashMap<String, TestNodeConnection>>,
}

pub struct TestNodeConnection {
    pub node_id: String,
    pub sender: mpsc::Sender<Message>,
}

impl TestNodeRegistry {
    pub fn new() -> Self {
        Self {
            nodes: RwLock::new(HashMap::new()),
        }
    }

    pub async fn register(&self, node_id: String, sender: mpsc::Sender<Message>) {
        let node_id_for_log = node_id.clone();
        let mut nodes = self.nodes.write().await;
        nodes.insert(node_id.clone(), TestNodeConnection { node_id, sender });
        info!("✅ Node registered: {} (total: {})", node_id_for_log, nodes.len());
    }

    pub async fn unregister(&self, node_id: &str) {
        let mut nodes = self.nodes.write().await;
        if nodes.remove(node_id).is_some() {
            info!("❌ Node unregistered: {} (total: {})", node_id, nodes.len());
        }
    }

    pub async fn list_nodes(&self) -> Vec<String> {
        let nodes = self.nodes.read().await;
        nodes.keys().cloned().collect()
    }

    pub async fn send_to_node(&self, node_id: &str, msg: Message) -> Result<(), String> {
        let nodes = self.nodes.read().await;
        if let Some(conn) = nodes.get(node_id) {
            conn.sender.send(msg).await
                .map_err(|e| format!("Failed to send: {}", e))?;
            Ok(())
        } else {
            Err(format!("Node {} not found", node_id))
        }
    }
}

/// Run the test server
pub async fn run_test_server(port: u16) -> anyhow::Result<()> {
    let registry = Arc::new(TestNodeRegistry::new());

    let app = Router::new()
        .route("/ws/nodes/:node_id", get(node_websocket_handler))
        .route("/api/v1/nodes", get(list_nodes))
        .with_state(registry.clone());

    let addr = format!("0.0.0.0:{}", port);
    info!("🚀 Test Control Plane starting on ws://{}", addr);
    info!("📡 WebSocket endpoint: ws://{}/ws/nodes/{{node_id}}", addr);
    info!("📊 Nodes API: http://{}/api/v1/nodes", addr);

    // Spawn a task to periodically send test jobs to nodes
    let registry_clone = registry.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            
            let nodes = registry_clone.list_nodes().await;
            for node_id in nodes {
                let job = Message::new(MessagePayload::AssignJob {
                    job: JobSpec {
                        id: format!("test-job-{}", uuid::Uuid::new_v4()),
                        name: "Test Job".to_string(),
                        wih: allternit_protocol::WIHDefinition {
                            handler: "shell".to_string(),
                            version: "1.0".to_string(),
                            task: allternit_protocol::TaskDefinition::Shell {
                                command: "echo 'Hello from test server'".to_string(),
                                working_dir: None,
                            },
                            tools: vec![],
                        },
                        resources: allternit_protocol::ResourceRequirements::default(),
                        env: Default::default(),
                        priority: 0,
                        timeout_secs: 60,
                    },
                });
                
                if let Err(e) = registry_clone.send_to_node(&node_id, job).await {
                    warn!("Failed to send job to {}: {}", node_id, e);
                } else {
                    info!("📋 Sent test job to {}", node_id);
                }
            }
        }
    });

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn node_websocket_handler(
    Path(node_id): Path<String>,
    ws: WebSocketUpgrade,
    State(registry): State<Arc<TestNodeRegistry>>,
) -> impl IntoResponse {
    info!("🔄 WebSocket upgrade request from node: {}", node_id);
    ws.on_upgrade(move |socket| handle_node_socket(socket, node_id, registry))
}

async fn handle_node_socket(
    mut socket: WebSocket,
    node_id: String,
    registry: Arc<TestNodeRegistry>,
) {
    info!("🔌 Node {} connected", node_id);

    let (tx, mut rx) = mpsc::channel::<Message>(100);
    let (mut sender, mut receiver) = socket.split();

    // Register node
    registry.register(node_id.clone(), tx.clone()).await;

    // Send registration acknowledgment
    let ack = Message::new(MessagePayload::NodeRegistered {
        node_id: node_id.clone(),
        config: NodeConfig::default(),
    });

    if let Err(e) = sender.send(WsMessage::Text(
        serde_json::to_string(&ack).unwrap()
    )).await {
        warn!("Failed to send ack to {}: {}", node_id, e);
        registry.unregister(&node_id).await;
        return;
    }

    // Main loop
    loop {
        tokio::select! {
            msg = receiver.next() => {
                match msg {
                    Some(Ok(WsMessage::Text(text))) => {
                        debug!("📨 From {}: {}", node_id, text);
                        
                        match serde_json::from_str::<Message>(&text) {
                            Ok(message) => {
                                handle_message(&node_id, &message).await;
                            }
                            Err(e) => {
                                warn!("Failed to parse message from {}: {}", node_id, e);
                            }
                        }
                    }
                    Some(Ok(WsMessage::Binary(data))) => {
                        debug!("📨 Binary data from {}: {} bytes", node_id, data.len());
                    }
                    Some(Ok(WsMessage::Ping(_))) => {
                        // Automatic pong
                    }
                    Some(Ok(WsMessage::Pong(_))) => {
                        // Received pong
                    }
                    Some(Ok(WsMessage::Close(_))) => {
                        info!("🔌 Node {} closed connection", node_id);
                        break;
                    }
                    Some(Err(e)) => {
                        warn!("WebSocket error from {}: {}", node_id, e);
                        break;
                    }
                    None => {
                        info!("WebSocket stream ended for {}", node_id);
                        break;
                    }
                }
            }
            
            Some(msg) = rx.recv() => {
                let json = serde_json::to_string(&msg).unwrap();
                debug!("📤 To {}: {}", node_id, json);
                
                if let Err(e) = sender.send(WsMessage::Text(json)).await {
                    warn!("Failed to send to {}: {}", node_id, e);
                    break;
                }
            }
        }
    }

    registry.unregister(&node_id).await;
    info!("👋 Connection closed for node {}", node_id);
}

async fn handle_message(node_id: &str, msg: &Message) {
    match &msg.payload {
        MessagePayload::NodeRegister { capabilities, hostname, version, .. } => {
            info!(
                "📋 Node {} registered: {} v{} (docker={}, cpu={})",
                node_id, hostname, version, capabilities.docker, capabilities.total_cpu
            );
        }
        
        MessagePayload::Heartbeat { status, resource_usage, running_jobs, .. } => {
            debug!(
                "💓 Heartbeat from {}: cpu={:.1}%, mem={:.1}%, jobs={}",
                node_id, resource_usage.cpu_percent, resource_usage.memory_percent, running_jobs
            );
        }
        
        MessagePayload::JobStarted { job_id, .. } => {
            info!("🚀 Job {} started on {}", job_id, node_id);
        }
        
        MessagePayload::JobCompleted { job_id, result, duration_secs, .. } => {
            info!(
                "✅ Job {} completed on {} in {}s (success={}, exit={})",
                job_id, node_id, duration_secs, result.success, result.exit_code
            );
            if !result.stdout.is_empty() {
                info!("📄 Output: {}", result.stdout.trim());
            }
            if !result.stderr.is_empty() {
                warn!("⚠️  Stderr: {}", result.stderr.trim());
            }
        }
        
        MessagePayload::JobProgress { job_id, progress, message, .. } => {
            info!("📊 Job {} progress: {:.0}% - {}", job_id, progress * 100.0, message);
        }
        
        _ => {
            debug!("Received message from {}: {:?}", node_id, msg.payload);
        }
    }
}

async fn list_nodes(
    State(registry): State<Arc<TestNodeRegistry>>,
) -> impl IntoResponse {
    let nodes = registry.list_nodes().await;
    axum::Json(serde_json::json!({
        "nodes": nodes,
        "count": nodes.len(),
    }))
}
