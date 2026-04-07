//! Multimodal Streaming API Routes
//!
//! Provides WebSocket endpoints for real-time multimodal streaming:
//! - Vision stream (camera/video)
//! - Audio stream (microphone)
//! - Synchronized multimodal stream

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

/// Multimodal streaming state
#[derive(Clone)]
pub struct MultimodalState {
    pub active_streams: Arc<RwLock<Vec<ActiveStream>>>,
    pub vision_tx: Arc<broadcast::Sender<VisionFrame>>,
    pub audio_tx: Arc<broadcast::Sender<AudioChunk>>,
}

impl MultimodalState {
    pub fn new() -> Self {
        let (vision_tx, _) = broadcast::channel(100);
        let (audio_tx, _) = broadcast::channel(100);

        Self {
            active_streams: Arc::new(RwLock::new(Vec::new())),
            vision_tx: Arc::new(vision_tx),
            audio_tx: Arc::new(audio_tx),
        }
    }
}

impl Default for MultimodalState {
    fn default() -> Self {
        Self::new()
    }
}

/// Active stream info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveStream {
    pub stream_id: String,
    pub stream_type: String,
    pub client_id: String,
    pub started_at: DateTime<Utc>,
    pub status: String,
}

/// Vision frame data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionFrame {
    pub frame_id: String,
    pub timestamp: DateTime<Utc>,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub data: Vec<u8>,
}

/// Audio chunk data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioChunk {
    pub chunk_id: String,
    pub timestamp: DateTime<Utc>,
    pub sample_rate: u32,
    pub channels: u16,
    pub data: Vec<u8>,
}

/// Stream control message
#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum StreamControl {
    Start { stream_type: String },
    Stop { stream_id: String },
    Configure { settings: StreamSettings },
}

/// Stream settings
#[derive(Debug, Deserialize)]
pub struct StreamSettings {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
}

/// Stream status response
#[derive(Debug, Serialize)]
pub struct StreamStatus {
    pub stream_id: String,
    pub status: String,
    pub frames_sent: u64,
    pub bytes_sent: u64,
}

/// Create multimodal router from engine
pub fn multimodal_router_from_engine() -> Router<Arc<crate::AppState>> {
    Router::new()
        // WebSocket endpoints
        .route("/api/v1/multimodal/ws/vision", get(vision_ws_handler))
        .route("/api/v1/multimodal/ws/audio", get(audio_ws_handler))
        .route(
            "/api/v1/multimodal/ws/multimodal",
            get(multimodal_ws_handler),
        )
        // REST endpoints for stream management
        .route("/api/v1/multimodal/streams", get(list_streams_engine))
        .route("/api/v1/multimodal/streams/:id", get(get_stream_engine))
        .route(
            "/api/v1/multimodal/streams/:id/stop",
            post(stop_stream_engine),
        )
        // Health check
        .route("/api/v1/multimodal/health", get(multimodal_health_check))
}

// ============================================================================
// WebSocket Handlers
// ============================================================================

/// Vision stream WebSocket handler
///
/// WS /api/v1/multimodal/ws/vision
async fn vision_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<crate::AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_vision_socket(socket, state))
}

/// Audio stream WebSocket handler
///
/// WS /api/v1/multimodal/ws/audio
async fn audio_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<crate::AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_audio_socket(socket, state))
}

/// Multimodal stream WebSocket handler
///
/// WS /api/v1/multimodal/ws/multimodal
async fn multimodal_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<crate::AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_multimodal_socket(socket, state))
}

// ============================================================================
// Socket Handlers
// ============================================================================

async fn handle_vision_socket(socket: WebSocket, _state: Arc<crate::AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let stream_id = Uuid::new_v4().to_string();

    // Simple echo for now - in production this would stream vision data
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            if sender
                .send(Message::Text(format!("Vision [{}]: {}", stream_id, text)))
                .await
                .is_err()
            {
                break;
            }
        }
    }
}

async fn handle_audio_socket(socket: WebSocket, _state: Arc<crate::AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let stream_id = Uuid::new_v4().to_string();

    // Simple echo for now - in production this would stream audio data
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            if sender
                .send(Message::Text(format!("Audio [{}]: {}", stream_id, text)))
                .await
                .is_err()
            {
                break;
            }
        }
    }
}

async fn handle_multimodal_socket(socket: WebSocket, _state: Arc<crate::AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let stream_id = Uuid::new_v4().to_string();

    // Simple echo for now - in production this would stream multimodal data
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            if sender
                .send(Message::Text(format!(
                    "Multimodal [{}]: {}",
                    stream_id, text
                )))
                .await
                .is_err()
            {
                break;
            }
        }
    }
}

// ============================================================================
// REST Endpoints - Engine-based
// ============================================================================

async fn list_streams_engine(
    State(state): State<Arc<crate::AppState>>,
) -> Json<Vec<allternit_multimodal_streaming::ActiveStreamInfo>> {
    let streams = state.multimodal_engine.get_active_streams().await;
    Json(streams)
}

async fn get_stream_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> Result<Json<allternit_multimodal_streaming::StreamConfig>, StatusCode> {
    state
        .multimodal_engine
        .get_stream(&id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn stop_stream_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> StatusCode {
    if state.multimodal_engine.stop_stream(&id).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

// ============================================================================
// Health Check
// ============================================================================

/// Health check endpoint
async fn multimodal_health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "multimodal-streaming"
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use tower::ServiceExt;

    fn create_test_app() -> Router {
        let state = MultimodalState::new();
        // Create a simple test router
        Router::new().route("/health", get(multimodal_health_check))
    }

    #[tokio::test]
    async fn test_health_check() {
        let response = multimodal_health_check().await;
        assert_eq!(response.0["status"], "healthy");
    }
}
