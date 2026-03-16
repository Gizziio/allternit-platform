//! Voice API Service
//!
//! HTTP API service for voice synthesis and recognition.
//! Runs on port 8001.

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Voice Service State
#[derive(Clone)]
struct VoiceServiceState {
    /// Active sessions
    sessions: Arc<RwLock<HashMap<String, VoiceSession>>>,
    /// TTS voice models
    tts_models: Arc<RwLock<Vec<VoiceModel>>>,
    /// STT models
    stt_models: Arc<RwLock<Vec<SttModel>>>,
    /// Request counter for metrics
    request_count: Arc<RwLock<u64>>,
}

impl VoiceServiceState {
    fn new() -> Self {
        let mut tts_models = Vec::new();
        tts_models.push(VoiceModel {
            id: "default".to_string(),
            name: "Default Voice".to_string(),
            language: "en".to_string(),
            gender: "neutral".to_string(),
            sample_rate: 24000,
        });
        tts_models.push(VoiceModel {
            id: "en-us-female".to_string(),
            name: "US English Female".to_string(),
            language: "en-US".to_string(),
            gender: "female".to_string(),
            sample_rate: 24000,
        });
        tts_models.push(VoiceModel {
            id: "en-us-male".to_string(),
            name: "US English Male".to_string(),
            language: "en-US".to_string(),
            gender: "male".to_string(),
            sample_rate: 24000,
        });

        let mut stt_models = Vec::new();
        stt_models.push(SttModel {
            id: "whisper-base".to_string(),
            name: "Whisper Base".to_string(),
            language: "multilingual".to_string(),
            supports_streaming: true,
        });

        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            tts_models: Arc::new(RwLock::new(tts_models)),
            stt_models: Arc::new(RwLock::new(stt_models)),
            request_count: Arc::new(RwLock::new(0)),
        }
    }
}

/// Voice session
#[derive(Debug, Clone, Serialize, Deserialize)]
struct VoiceSession {
    session_id: String,
    created_at: chrono::DateTime<chrono::Utc>,
    last_activity: chrono::DateTime<chrono::Utc>,
    mode: SessionMode,
    language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum SessionMode {
    Tts,
    Stt,
    Both,
}

/// Voice model for TTS
#[derive(Debug, Clone, Serialize, Deserialize)]
struct VoiceModel {
    id: String,
    name: String,
    language: String,
    gender: String,
    sample_rate: u32,
}

/// STT model
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SttModel {
    id: String,
    name: String,
    language: String,
    supports_streaming: bool,
}

/// TTS request
#[derive(Debug, Deserialize)]
struct TtsRequest {
    text: String,
    voice_id: Option<String>,
    language: Option<String>,
    speed: Option<f32>,
}

/// TTS response
#[derive(Debug, Serialize)]
struct TtsResponse {
    audio_url: String,
    duration_secs: f32,
    sample_rate: u32,
    format: String,
}

/// STT response
#[derive(Debug, Serialize)]
struct SttResponse {
    text: String,
    confidence: f32,
    language: String,
    segments: Vec<TranscriptSegment>,
}

/// Transcript segment
#[derive(Debug, Serialize)]
struct TranscriptSegment {
    start_time: f32,
    end_time: f32,
    text: String,
    confidence: f32,
}

/// Create session request
#[derive(Debug, Deserialize)]
struct CreateSessionRequest {
    mode: SessionMode,
    language: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Voice API Service on port 8001...");

    let state = VoiceServiceState::new();

    let app = create_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8001));
    info!("Voice API Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Create the router with all routes
fn create_router(state: VoiceServiceState) -> Router {
    Router::new()
        // Health endpoints
        .route("/health", get(health_check))
        .route("/v1/health", get(health_check))
        
        // Voice models
        .route("/v1/voices", get(list_voices))
        .route("/v1/voices/:id", get(get_voice))
        
        // STT models
        .route("/v1/stt/models", get(list_stt_models))
        
        // TTS endpoints
        .route("/v1/tts", post(text_to_speech))
        .route("/v1/tts/stream", post(text_to_speech_stream))
        
        // STT endpoints
        .route("/v1/stt", post(speech_to_text))
        .route("/v1/stt/stream", post(speech_to_text_stream))
        
        // Session management
        .route("/v1/sessions", get(list_sessions).post(create_session))
        .route("/v1/sessions/:id", get(get_session).delete(delete_session))
        
        // Stats
        .route("/v1/stats", get(get_stats))
        
        .with_state(state)
}

/// Health check endpoint
async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "voice",
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "features": ["tts", "stt", "streaming"],
    }))
}

/// List available voices
async fn list_voices(
    State(state): State<VoiceServiceState>,
) -> Json<Vec<VoiceModel>> {
    let models = state.tts_models.read().await;
    Json(models.clone())
}

/// Get specific voice
async fn get_voice(
    State(state): State<VoiceServiceState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<VoiceModel>, StatusCode> {
    let models = state.tts_models.read().await;
    models.iter()
        .find(|m| m.id == id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// List STT models
async fn list_stt_models(
    State(state): State<VoiceServiceState>,
) -> Json<Vec<SttModel>> {
    let models = state.stt_models.read().await;
    Json(models.clone())
}

/// Text-to-speech
async fn text_to_speech(
    State(state): State<VoiceServiceState>,
    Json(request): Json<TtsRequest>,
) -> Result<Json<TtsResponse>, StatusCode> {
    // Increment request counter
    {
        let mut count = state.request_count.write().await;
        *count += 1;
    }

    let voice_id = request.voice_id.unwrap_or_else(|| "default".to_string());
    let models = state.tts_models.read().await;
    
    let voice = models.iter()
        .find(|m| m.id == voice_id)
        .ok_or(StatusCode::BAD_REQUEST)?;

    // Simulate TTS processing
    let text_len = request.text.len() as f32;
    let duration_secs = text_len / 15.0; // Rough estimate: ~15 chars per second

    info!("TTS request: {} chars -> {:.2}s audio", text_len, duration_secs);

    Ok(Json(TtsResponse {
        audio_url: format!("/v1/audio/{}.wav", uuid::Uuid::new_v4().simple()),
        duration_secs,
        sample_rate: voice.sample_rate,
        format: "wav".to_string(),
    }))
}

/// Text-to-speech streaming (SSE)
async fn text_to_speech_stream(
    State(state): State<VoiceServiceState>,
    Json(request): Json<TtsRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // For now, return the same as non-streaming
    let response = text_to_speech(State(state), Json(request)).await?;
    
    Ok(Json(serde_json::json!({
        "stream_url": format!("/v1/streams/{}.mp3", uuid::Uuid::new_v4().simple()),
        "duration_secs": response.duration_secs,
        "format": "mp3",
    })))
}

/// Speech-to-text
async fn speech_to_text(
    State(state): State<VoiceServiceState>,
    mut multipart: Multipart,
) -> Result<Json<SttResponse>, StatusCode> {
    // Increment request counter
    {
        let mut count = state.request_count.write().await;
        *count += 1;
    }

    // Process multipart form data
    let mut audio_data = Vec::new();
    let mut model_id = None;
    let mut language = None;

    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("").to_string();
        let data = field.bytes().await.unwrap();

        match name.as_str() {
            "audio" => audio_data = data.to_vec(),
            "model" => model_id = Some(String::from_utf8_lossy(&data).to_string()),
            "language" => language = Some(String::from_utf8_lossy(&data).to_string()),
            _ => {}
        }
    }

    if audio_data.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let audio_duration = audio_data.len() as f32 / 16000.0 / 2.0; // Assuming 16kHz 16-bit mono

    info!("STT request: {} bytes -> {:.2}s audio", audio_data.len(), audio_duration);

    // Simulate STT result
    Ok(Json(SttResponse {
        text: "This is a simulated transcription result from the voice service.".to_string(),
        confidence: 0.95,
        language: language.unwrap_or_else(|| "en".to_string()),
        segments: vec![
            TranscriptSegment {
                start_time: 0.0,
                end_time: audio_duration,
                text: "Simulated transcription".to_string(),
                confidence: 0.95,
            }
        ],
    }))
}

/// Speech-to-text streaming
async fn speech_to_text_stream(
    State(_state): State<VoiceServiceState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "websocket_url": format!("ws://localhost:8001/v1/stt/ws/{}", uuid::Uuid::new_v4().simple()),
        "status": "ready",
    })))
}

/// List active sessions
async fn list_sessions(
    State(state): State<VoiceServiceState>,
) -> Json<Vec<VoiceSession>> {
    let sessions = state.sessions.read().await;
    Json(sessions.values().cloned().collect())
}

/// Get specific session
async fn get_session(
    State(state): State<VoiceServiceState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<VoiceSession>, StatusCode> {
    let sessions = state.sessions.read().await;
    sessions.get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Create new session
async fn create_session(
    State(state): State<VoiceServiceState>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<VoiceSession>, StatusCode> {
    let session = VoiceSession {
        session_id: uuid::Uuid::new_v4().to_string(),
        created_at: chrono::Utc::now(),
        last_activity: chrono::Utc::now(),
        mode: request.mode,
        language: request.language.unwrap_or_else(|| "en".to_string()),
    };

    let mut sessions = state.sessions.write().await;
    sessions.insert(session.session_id.clone(), session.clone());

    info!("Created voice session: {}", session.session_id);

    Ok(Json(session))
}

/// Delete session
async fn delete_session(
    State(state): State<VoiceServiceState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut sessions = state.sessions.write().await;
    
    if sessions.remove(&id).is_some() {
        info!("Deleted voice session: {}", id);
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Get service stats
async fn get_stats(
    State(state): State<VoiceServiceState>,
) -> Json<serde_json::Value> {
    let sessions = state.sessions.read().await;
    let tts_models = state.tts_models.read().await;
    let stt_models = state.stt_models.read().await;
    let request_count = state.request_count.read().await;

    Json(serde_json::json!({
        "active_sessions": sessions.len(),
        "tts_models": tts_models.len(),
        "stt_models": stt_models.len(),
        "total_requests": *request_count,
        "timestamp": chrono::Utc::now().timestamp_millis(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::util::ServiceExt;

    fn create_test_state() -> VoiceServiceState {
        VoiceServiceState::new()
    }

    #[tokio::test]
    async fn test_health_check() {
        let state = create_test_state();
        let app = create_router(state);

        let response = app
            .oneshot(Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_list_voices() {
        let state = create_test_state();
        let app = create_router(state);

        let response = app
            .oneshot(Request::builder()
                .uri("/v1/voices")
                .body(Body::empty())
                .unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_stats() {
        let state = create_test_state();
        let app = create_router(state);

        let response = app
            .oneshot(Request::builder()
                .uri("/v1/stats")
                .body(Body::empty())
                .unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
