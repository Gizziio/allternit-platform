//! Voice Service Client
//!
//! Provides integration with the Voice Service for text-to-speech,
//! voice cloning, and voice model management.
//!
//! Environment:
//!   - A2R_VOICE_URL: URL of the voice service (default: http://127.0.0.1:8001)

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Voice service configuration
#[derive(Clone)]
pub struct VoiceClient {
    base_url: String,
    http_client: reqwest::Client,
}

impl VoiceClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            http_client: reqwest::Client::new(),
        }
    }

    pub fn from_env() -> Self {
        let base_url =
            std::env::var("A2R_VOICE_URL").unwrap_or_else(|_| "http://127.0.0.1:8001".to_string());
        Self::new(base_url)
    }

    /// Check voice service health
    pub async fn health_check(&self) -> Result<bool, reqwest::Error> {
        let response = self
            .http_client
            .get(format!("{}/health", self.base_url))
            .send()
            .await?;
        Ok(response.status().is_success())
    }

    /// List available voice models
    pub async fn list_models(&self) -> Result<Vec<VoiceModel>, reqwest::Error> {
        let response = self
            .http_client
            .get(format!("{}/v1/voice/models", self.base_url))
            .send()
            .await?;
        response.json().await
    }

    /// List available voices/presets
    pub async fn list_voices(&self) -> Result<Vec<VoicePreset>, reqwest::Error> {
        let response = self
            .http_client
            .get(format!("{}/v1/voice/voices", self.base_url))
            .send()
            .await?;
        response.json().await
    }

    /// Generate speech from text
    pub async fn text_to_speech(&self, request: TTSRequest) -> Result<TTSResponse, VoiceError> {
        let response = self
            .http_client
            .post(format!("{}/v1/voice/tts", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| VoiceError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| VoiceError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(VoiceError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Clone voice from reference audio
    pub async fn clone_voice(&self, request: VoiceCloneRequest) -> Result<TTSResponse, VoiceError> {
        let response = self
            .http_client
            .post(format!("{}/v1/voice/clone", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| VoiceError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| VoiceError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(VoiceError::Service(format!("{}: {}", status, text)))
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum VoiceError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Service error: {0}")]
    Service(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceModel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePreset {
    pub id: String,
    pub label: String,
    pub engine: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker_wav: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSRequest {
    pub text: String,
    pub voice: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_paralinguistic: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSResponse {
    pub audio_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceCloneRequest {
    pub text: String,
    pub reference_audio_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
}

// API Routes

pub fn create_voice_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/api/v1/voice/health", get(voice_health))
        .route("/api/v1/voice/models", get(list_voice_models))
        .route("/api/v1/voice/voices", get(list_voice_presets))
        .route("/api/v1/voice/tts", post(voice_tts))
        .route("/api/v1/voice/clone", post(voice_clone))
}

async fn voice_health() -> impl IntoResponse {
    let client = VoiceClient::from_env();
    match client.health_check().await {
        Ok(true) => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "healthy" })),
        ),
        Ok(false) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "unhealthy" })),
        ),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
        ),
    }
}

async fn list_voice_models() -> Result<impl IntoResponse, StatusCode> {
    let client = VoiceClient::from_env();
    match client.list_models().await {
        Ok(models) => Ok((StatusCode::OK, Json(models))),
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

async fn list_voice_presets() -> Result<impl IntoResponse, StatusCode> {
    let client = VoiceClient::from_env();
    match client.list_voices().await {
        Ok(voices) => Ok((StatusCode::OK, Json(voices))),
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

async fn voice_tts(Json(request): Json<TTSRequest>) -> Result<impl IntoResponse, StatusCode> {
    let client = VoiceClient::from_env();
    match client.text_to_speech(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn voice_clone(
    Json(request): Json<VoiceCloneRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = VoiceClient::from_env();
    match client.clone_voice(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
