// 7-apps/api/src/browser_recording/mod.rs
//! Browser Recording Module
//!
//! Provides native browser recording tools for agents to capture
//! browser sessions as GIF/video for review.

pub mod service;
pub mod capture;
pub mod encoder;

pub use service::{RecordingService, RecordingSession, RecordingConfig, RecordingStatus};
pub use capture::FrameCapture;
pub use encoder::GifEncoder;

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::AppState;

/// Recording tool execution request
#[derive(Debug, Deserialize)]
#[serde(tag = "action")]
pub enum RecordingAction {
    #[serde(rename = "start")]
    Start(StartRecordingRequest),
    #[serde(rename = "stop")]
    Stop(StopRecordingRequest),
    #[serde(rename = "status")]
    Status(StatusRequest),
}

#[derive(Debug, Deserialize)]
pub struct StartRecordingRequest {
    pub session_id: Option<String>,
    pub format: Option<String>,
    pub fps: Option<u32>,
    pub quality: Option<u32>,
    pub max_duration_secs: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct StopRecordingRequest {
    pub recording_id: String,
    pub save: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct StatusRequest {
    pub recording_id: String,
}

#[derive(Debug, Serialize)]
pub struct RecordingResponse {
    pub success: bool,
    pub recording_id: Option<String>,
    pub status: Option<String>,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

/// Create browser recording routes
pub fn create_recording_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/v1/browser/recording", post(handle_recording_action))
}

/// Handle recording action
async fn handle_recording_action(
    State(state): State<Arc<AppState>>,
    Json(action): Json<RecordingAction>,
) -> Result<Json<RecordingResponse>, StatusCode> {
    let recording_service = state
        .browser_recording_service
        .clone()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    match action {
        RecordingAction::Start(req) => {
            let config = service::RecordingConfig {
                format: req.format.unwrap_or_else(|| "gif".to_string()),
                fps: req.fps.unwrap_or(10),
                quality: req.quality.unwrap_or(80),
                max_duration_secs: req.max_duration_secs,
                output_path: None,
            };

            match recording_service.write().await.start_recording(req.session_id, config).await {
                Ok(recording_id) => Ok(Json(RecordingResponse {
                    success: true,
                    recording_id: Some(recording_id),
                    status: Some("recording".to_string()),
                    file_path: None,
                    error: None,
                })),
                Err(e) => Ok(Json(RecordingResponse {
                    success: false,
                    recording_id: None,
                    status: None,
                    file_path: None,
                    error: Some(e.to_string()),
                })),
            }
        }
        RecordingAction::Stop(req) => {
            match recording_service.write().await.stop_recording(&req.recording_id, req.save.unwrap_or(true)).await {
                Ok(result) => Ok(Json(RecordingResponse {
                    success: true,
                    recording_id: Some(req.recording_id),
                    status: Some("stopped".to_string()),
                    file_path: result.file_path.map(|p| p.to_string_lossy().to_string()),
                    error: None,
                })),
                Err(e) => Ok(Json(RecordingResponse {
                    success: false,
                    recording_id: Some(req.recording_id),
                    status: None,
                    file_path: None,
                    error: Some(e.to_string()),
                })),
            }
        }
        RecordingAction::Status(req) => {
            match recording_service.read().await.get_status(&req.recording_id).await {
                Some(status) => Ok(Json(RecordingResponse {
                    success: true,
                    recording_id: Some(req.recording_id),
                    status: Some(if status.is_recording { "recording" } else { "stopped" }.to_string()),
                    file_path: None,
                    error: None,
                })),
                None => Ok(Json(RecordingResponse {
                    success: false,
                    recording_id: Some(req.recording_id),
                    status: None,
                    file_path: None,
                    error: Some("Recording not found".to_string()),
                })),
            }
        }
    }
}

/// Initialize browser recording service
pub async fn init_browser_recording_service() -> anyhow::Result<Arc<RwLock<RecordingService>>> {
    let service = RecordingService::new(None).await?;
    let service = Arc::new(RwLock::new(service));
    
    info!("Browser recording service initialized");
    Ok(service)
}
