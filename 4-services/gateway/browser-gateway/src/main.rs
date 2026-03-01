use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
    routing::{get, post},
    Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{info, error};

// Define the application state to hold WebSocket connections
#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<WsMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WsMessage {
    id: String,
    #[serde(rename = "type")]
    message_type: String,
    payload: serde_json::Value,
    timestamp: u64,
}

#[derive(Deserialize)]
struct BrowserInboundPayload {
    source_tab_id: String,
    message: String,
    timestamp: u64,
    message_id: String,
    context: serde_json::Value,
}

#[derive(Serialize)]
struct BrowserResponse {
    status: String,
    message: Option<String>,
    function_call: Option<FunctionCall>,
}

#[derive(Serialize, Deserialize, Clone)]
struct FunctionCall {
    function_id: String,
    parameters: serde_json::Value,
}

// WebSocket handler
async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();
    
    // Spawn a task to forward broadcast messages to the WebSocket
    let mut sender_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    if let Err(e) = sender.send(Message::Text(serde_json::to_string(&msg).unwrap())).await {
                        error!("Error sending WebSocket message: {:?}", e);
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    // Spawn a task to handle incoming WebSocket messages
    let tx = state.tx.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                    info!("Received WebSocket message: {:?}", ws_msg);
                    // Broadcast the message to all connected clients
                    if tx.send(ws_msg).is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Wait for either task to complete and abort the other
    tokio::select! {
        _ = &mut sender_task => recv_task.abort(),
        _ = &mut recv_task => sender_task.abort(),
    }
}

// HTTP endpoint for receiving browser messages
async fn handle_inbound_browser(
    State(state): State<Arc<AppState>>,
    payload: axum::Json<BrowserInboundPayload>,
) -> Result<axum::Json<BrowserResponse>, axum::http::StatusCode> {
    info!("Received browser message: {}", payload.message);
    
    // Create a WebSocket message to broadcast
    let ws_msg = WsMessage {
        id: payload.message_id.clone(),
        message_type: "browser_message".to_string(),
        payload: serde_json::json!({
            "source_tab_id": payload.source_tab_id,
            "message": payload.message,
            "context": payload.context
        }),
        timestamp: payload.timestamp,
    };
    
    // Broadcast to all connected WebSocket clients
    if state.tx.send(ws_msg).is_err() {
        error!("Failed to broadcast message");
    }
    
    Ok(axum::Json(BrowserResponse {
        status: "success".to_string(),
        message: Some("Browser gateway received message".to_string()),
        function_call: None,
    }))
}

// Health check endpoint
async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "service": "browser-gateway",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    // Create a broadcast channel for WebSocket messages
    let (tx, _) = broadcast::channel::<WsMessage>(100);
    let app_state = Arc::new(AppState { tx });

    let app = Router::new()
        .route("/ws", get(websocket_handler))  // WebSocket endpoint
        .route("/webhook/browser", post(handle_inbound_browser))  // HTTP endpoint
        .route("/health", get(health_check))
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3108".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Browser Gateway listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
