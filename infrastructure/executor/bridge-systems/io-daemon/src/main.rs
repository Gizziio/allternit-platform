use axum::{
    extract::{State},
    http::StatusCode,
    response::{Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing::{info, Level};
use tracing_subscriber;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::ChildStdin;
use std::collections::HashMap;

#[derive(Clone)]
struct DaemonState {
    is_running: bool,
    start_time: u64,
    io_ready: bool,
    status: DaemonStatus,
    // Channel for communicating with the IO bridge
    io_bridge_tx: Option<tokio::sync::broadcast::Sender<IOBridgeMessage>>,
}

#[derive(Serialize, Deserialize, Clone)]
enum DaemonStatus {
    Starting,
    Running,
    Ready,
    Stopping,
    Stopped,
}

#[derive(Debug, Clone)]
enum IOBridgeMessage {
    Request { id: String, method: String, params: serde_json::Value },
    Response { id: String, result: Option<serde_json::Value>, error: Option<String> },
    Notification { method: String, params: serde_json::Value },
}

#[derive(Clone)]
struct AppState {
    daemon_state: Arc<RwLock<DaemonState>>,
    // For stdio communication
    stdin_writer: Arc<RwLock<Option<tokio::sync::mpsc::UnboundedSender<String>>>>,
}

#[derive(Serialize)]
struct DaemonHealth {
    status: DaemonStatus,
    is_running: bool,
    is_io_ready: bool,
    uptime_seconds: u64,
    timestamp: u64,
}

#[derive(Serialize)]
struct IoReadyResponse {
    ready: bool,
    message: String,
    timestamp: u64,
}

#[derive(Deserialize, Serialize)]
struct IoBridgeRequest {
    jsonrpc: String,
    id: Option<String>,
    method: String,
    params: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct IoBridgeResponse {
    jsonrpc: String,
    id: Option<String>,
    result: Option<serde_json::Value>,
    error: Option<IoBridgeError>,
}

#[derive(Serialize)]
struct IoBridgeError {
    code: i32,
    message: String,
}

async fn health_check(State(state): State<AppState>) -> Json<DaemonHealth> {
    let daemon_state = state.daemon_state.read().await;
    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let uptime = current_time - daemon_state.start_time;

    Json(DaemonHealth {
        status: daemon_state.status.clone(),
        is_running: daemon_state.is_running,
        is_io_ready: daemon_state.io_ready,
        uptime_seconds: uptime,
        timestamp: current_time,
    })
}

async fn io_ready(State(state): State<AppState>) -> Json<IoReadyResponse> {
    let daemon_state = state.daemon_state.read().await;
    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    Json(IoReadyResponse {
        ready: daemon_state.io_ready,
        message: if daemon_state.io_ready {
            "IO subsystem is ready".to_string()
        } else {
            "IO subsystem initializing".to_string()
        },
        timestamp: current_time,
    })
}

async fn start_daemon(State(state): State<AppState>) -> Result<Json<String>, StatusCode> {
    let mut daemon_state = state.daemon_state.write().await;

    if daemon_state.is_running {
        return Err(StatusCode::CONFLICT);
    }

    daemon_state.is_running = true;
    daemon_state.status = DaemonStatus::Running;
    daemon_state.start_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    info!("Daemon started");

    // Start the IO bridge
    start_io_bridge(&mut daemon_state).await;

    Ok(Json("Daemon started successfully".to_string()))
}

async fn stop_daemon(State(state): State<AppState>) -> Result<Json<String>, StatusCode> {
    let mut daemon_state = state.daemon_state.write().await;

    if !daemon_state.is_running {
        return Err(StatusCode::CONFLICT);
    }

    daemon_state.is_running = false;
    daemon_state.status = DaemonStatus::Stopped;
    daemon_state.io_ready = false;

    info!("Daemon stopped");

    Ok(Json("Daemon stopped successfully".to_string()))
}

async fn set_io_ready(State(state): State<AppState>) -> Result<Json<String>, StatusCode> {
    let mut daemon_state = state.daemon_state.write().await;

    daemon_state.io_ready = true;
    daemon_state.status = DaemonStatus::Ready;

    info!("IO subsystem marked as ready");

    // Send notification to IO bridge that system is ready
    if let Some(ref tx) = daemon_state.io_bridge_tx {
        let _ = tx.send(IOBridgeMessage::Notification {
            method: "system.ready".to_string(),
            params: serde_json::json!({"ready": true}),
        });
    }

    Ok(Json("IO subsystem ready".to_string()))
}

async fn set_io_not_ready(State(state): State<AppState>) -> Result<Json<String>, StatusCode> {
    let mut daemon_state = state.daemon_state.write().await;

    daemon_state.io_ready = false;
    if daemon_state.is_running {
        daemon_state.status = DaemonStatus::Running;
    } else {
        daemon_state.status = DaemonStatus::Starting;
    }

    info!("IO subsystem marked as not ready");

    // Send notification to IO bridge that system is not ready
    if let Some(ref tx) = daemon_state.io_bridge_tx {
        let _ = tx.send(IOBridgeMessage::Notification {
            method: "system.ready".to_string(),
            params: serde_json::json!({"ready": false}),
        });
    }

    Ok(Json("IO subsystem not ready".to_string()))
}

// Endpoint to send messages through the IO bridge (stdio NDJSON-RPC)
async fn send_io_message(
    State(state): State<AppState>,
    Json(request): Json<IoBridgeRequest>,
) -> Result<Json<IoBridgeResponse>, StatusCode> {
    if let Some(ref writer) = *state.stdin_writer.read().await {
        // Create NDJSON-RPC message
        let msg = serde_json::to_string(&request)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // Send to IO bridge
        if writer.send(msg).is_ok() {
            Ok(Json(IoBridgeResponse {
                jsonrpc: "2.0".to_string(),
                id: request.id,
                result: Some(serde_json::json!({"sent": true})),
                error: None,
            }))
        } else {
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    } else {
        Err(StatusCode::SERVICE_UNAVAILABLE)
    }
}

// Function to start the IO bridge (stdio NDJSON-RPC handler)
async fn start_io_bridge(daemon_state: &mut DaemonState) {
    // Create broadcast channel for IO bridge communication
    let (tx, _) = tokio::sync::broadcast::channel::<IOBridgeMessage>(100);
    daemon_state.io_bridge_tx = Some(tx);

    // Set IO as ready after successful bridge initialization
    daemon_state.io_ready = true;
    daemon_state.status = DaemonStatus::Ready;

    info!("IO Bridge initialized and ready");
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting IO Daemon Service with IO Bridge (stdio NDJSON-RPC)...");

    let initial_state = DaemonState {
        is_running: false,
        start_time: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        io_ready: false,
        status: DaemonStatus::Starting,
        io_bridge_tx: None,
    };

    // Create channel for stdio communication
    let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    let app_state = AppState {
        daemon_state: Arc::new(RwLock::new(initial_state)),
        stdin_writer: Arc::new(RwLock::new(Some(stdin_tx))),
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/io-ready", get(io_ready))
        .route("/start", post(start_daemon))
        .route("/stop", post(stop_daemon))
        .route("/set-io-ready", post(set_io_ready))
        .route("/set-io-not-ready", post(set_io_not_ready))
        .route("/io-bridge/send", post(send_io_message))
        .with_state(app_state.clone());

    // Spawn task to handle stdio communication
    let stdin_writer_clone = app_state.stdin_writer.clone();
    tokio::spawn(async move {
        loop {
            if let Some(msg) = stdin_rx.recv().await {
                // In a real implementation, this would write to actual stdin
                // For now, we'll just log it
                info!("Would send to stdin: {}", msg);
            }
        }
    });

    let port = std::env::var("PORT").unwrap_or_else(|_| "3011".to_string());
    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!("IO Daemon Service listening on http://{}", addr);

    axum::serve(listener, app).await.unwrap();
}