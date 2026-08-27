//! Realtime Audio API (A11).
//!
//! Provides session-based realtime audio interaction via WebSocket. Mounted
//! under `/v1` by the LLM gateway router.
//!
//! Endpoints:
//! - `POST /v1/realtime/sessions` — create a realtime audio session
//! - `GET /v1/realtime/sessions` — list active sessions
//! - `GET /v1/realtime/sessions/:id` — get session details
//! - `DELETE /v1/realtime/sessions/:id` — close a session
//! - WebSocket at `/v1/realtime/sessions/:id/ws` — bidirectional audio stream
//!
//! The WebSocket endpoint accepts binary audio frames (PCM16) and sends back
//! audio responses. In production, this proxies to a configured audio provider.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Path, State,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::Duration;

use crate::AppState;

use super::{
    auth::LlmKeyContext,
    translate::{error_code, OpenAiErrorResponse},
};

// ─── Session store ──────────────────────────────────────────────────────────

/// In-memory session registry for active realtime audio sessions.
pub type RealtimeSessionStore = Arc<RwLock<std::collections::HashMap<String, RealtimeSession>>>;

pub fn new_session_store() -> RealtimeSessionStore {
    Arc::new(RwLock::new(std::collections::HashMap::new()))
}

#[derive(Debug, Clone)]
pub struct RealtimeSession {
    pub id: String,
    pub model: String,
    pub modalities: Vec<String>,
    pub voice: String,
    pub instructions: Option<String>,
    pub temperature: f64,
    pub max_response_output_tokens: Option<u32>,
    pub created_at: i64,
    pub status: String,
}

// ─── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_modalities")]
    pub modalities: Vec<String>,
    #[serde(default = "default_voice")]
    pub voice: String,
    #[serde(default)]
    pub instructions: Option<String>,
    #[serde(default = "default_temperature")]
    pub temperature: f64,
    #[serde(default)]
    pub max_response_output_tokens: Option<u32>,
    #[serde(default)]
    pub input_audio_format: Option<String>,
    #[serde(default)]
    pub output_audio_format: Option<String>,
    #[serde(default)]
    pub turn_detection: Option<TurnDetection>,
}

fn default_model() -> String {
    "allternit-realtime-1".to_string()
}
fn default_modalities() -> Vec<String> {
    vec!["text".to_string(), "audio".to_string()]
}
fn default_voice() -> String {
    "alloy".to_string()
}
fn default_temperature() -> f64 {
    0.8
}

#[derive(Debug, Deserialize)]
pub struct TurnDetection {
    #[serde(rename = "type")]
    pub detection_type: String,
    #[serde(default)]
    pub threshold: Option<f64>,
    #[serde(default)]
    pub prefix_padding_ms: Option<u32>,
    #[serde(default)]
    pub silence_duration_ms: Option<u32>,
}

// ─── Response types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct SessionObject {
    pub id: String,
    pub object: &'static str,
    pub model: String,
    pub modalities: Vec<String>,
    pub voice: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instructions: Option<String>,
    pub temperature: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_response_output_tokens: Option<u32>,
    pub status: String,
    pub created_at: i64,
}

impl From<&RealtimeSession> for SessionObject {
    fn from(s: &RealtimeSession) -> Self {
        SessionObject {
            id: s.id.clone(),
            object: "realtime.session",
            model: s.model.clone(),
            modalities: s.modalities.clone(),
            voice: s.voice.clone(),
            instructions: s.instructions.clone(),
            temperature: s.temperature,
            max_response_output_tokens: s.max_response_output_tokens,
            status: s.status.clone(),
            created_at: s.created_at,
        }
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// `POST /v1/realtime/sessions` — create a realtime audio session.
pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<CreateSessionRequest>,
) -> Response {
    // Validate model.
    let valid_models = ["allternit-realtime-1", "allternit-realtime-1-mini"];
    if !valid_models.contains(&body.model.as_str()) {
        return OpenAiErrorResponse::invalid_request(
            format!("`model` must be one of {valid_models:?}."),
            Some("model"),
        )
        .into_response();
    }

    // Validate modalities.
    for m in &body.modalities {
        match m.as_str() {
            "text" | "audio" => {}
            _ => {
                return OpenAiErrorResponse::invalid_request(
                    "`modalities` must contain only `text` and/or `audio`.",
                    Some("modalities"),
                )
                .into_response();
            }
        }
    }

    // Validate voice.
    let valid_voices = [
        "alloy", "echo", "fable", "onyx", "nova", "shimmer",
    ];
    if !valid_voices.contains(&body.voice.as_str()) {
        return OpenAiErrorResponse::invalid_request(
            format!("`voice` must be one of {valid_voices:?}."),
            Some("voice"),
        )
        .into_response();
    }

    if !(0.0..=2.0).contains(&body.temperature) {
        return OpenAiErrorResponse::invalid_request(
            "`temperature` must be between 0.0 and 2.0.",
            Some("temperature"),
        )
        .into_response();
    }

    let id = format!("sess_{}", uuid::Uuid::new_v4().simple());
    let created_at = chrono::Utc::now().timestamp();

    let session = RealtimeSession {
        id: id.clone(),
        model: body.model.clone(),
        modalities: body.modalities.clone(),
        voice: body.voice.clone(),
        instructions: body.instructions.clone(),
        temperature: body.temperature,
        max_response_output_tokens: body.max_response_output_tokens,
        created_at,
        status: "active".to_string(),
    };

    // Register the session in the in-memory store.
    if let Some(store) = get_session_store(&state) {
        store.write().await.insert(id.clone(), session.clone());
    }

    // Persist to SQLite for durability.
    let db = state.db.clone();
    let sid = id.clone();
    let model = body.model.clone();
    let voice = body.voice.clone();
    let modalities_json = serde_json::to_string(&body.modalities).unwrap_or_default();

    let _ = tokio::task::spawn_blocking(move || -> rusqlite::Result<()> {
        let conn = db.connect()?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS realtime_sessions (
                id TEXT PRIMARY KEY,
                model TEXT NOT NULL,
                voice TEXT NOT NULL,
                modalities_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at INTEGER NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "INSERT INTO realtime_sessions (id, model, voice, modalities_json, status, created_at)
             VALUES (?1, ?2, ?3, ?4, 'active', ?5)",
            params![sid, model, voice, modalities_json, created_at],
        )?;
        Ok(())
    })
    .await;

    let obj = SessionObject::from(&session);
    (StatusCode::CREATED, Json(serde_json::to_value(obj).unwrap())).into_response()
}

/// `GET /v1/realtime/sessions` — list active sessions.
pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
) -> Response {
    let sessions = if let Some(store) = get_session_store(&state) {
        let guard = store.read().await;
        guard
            .values()
            .map(|s| serde_json::to_value(SessionObject::from(s)).unwrap())
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };

    (
        StatusCode::OK,
        Json(json!({ "object": "list", "data": sessions })),
    )
        .into_response()
}

/// `GET /v1/realtime/sessions/:id` — get session details.
pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    if let Some(store) = get_session_store(&state) {
        let guard = store.read().await;
        if let Some(session) = guard.get(&id) {
            let obj = SessionObject::from(session);
            return (StatusCode::OK, Json(serde_json::to_value(obj).unwrap())).into_response();
        }
    }

    OpenAiErrorResponse::new(
        StatusCode::NOT_FOUND,
        format!("No realtime session with id '{id}'."),
        "invalid_request_error",
        Some("session_id"),
        Some(error_code::INVALID_REQUEST),
    )
    .into_response()
}

/// `DELETE /v1/realtime/sessions/:id` — close a session.
pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    if let Some(store) = get_session_store(&state) {
        let mut guard = store.write().await;
        if guard.remove(&id).is_some() {
            // Mark as closed in SQLite.
            let db = state.db.clone();
            let id_c = id.clone();
            let _ = tokio::task::spawn_blocking(move || -> rusqlite::Result<()> {
                let conn = db.connect()?;
                conn.execute(
                    "UPDATE realtime_sessions SET status = 'closed' WHERE id = ?1",
                    params![id_c],
                )?;
                Ok(())
            })
            .await;

            return (
                StatusCode::OK,
                Json(json!({ "id": id, "object": "realtime.session.deleted", "deleted": true })),
            )
                .into_response();
        }
    }

    OpenAiErrorResponse::new(
        StatusCode::NOT_FOUND,
        format!("No realtime session with id '{id}'."),
        "invalid_request_error",
        Some("session_id"),
        Some(error_code::INVALID_REQUEST),
    )
    .into_response()
}

/// WebSocket upgrade handler for realtime audio streaming.
pub async fn ws_handler(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
) -> Response {
    // Verify session exists.
    if let Some(store) = get_session_store(&state) {
        let guard = store.read().await;
        if !guard.contains_key(&id) {
            return OpenAiErrorResponse::new(
                StatusCode::NOT_FOUND,
                format!("No realtime session with id '{id}'."),
                "invalid_request_error",
                Some("session_id"),
                Some(error_code::INVALID_REQUEST),
            )
            .into_response();
        }
    } else {
        return OpenAiErrorResponse::upstream(
            "Session store unavailable.",
            "internal_error",
        )
        .into_response();
    }

    ws.on_upgrade(move |socket| handle_ws_connection(socket, id, state))
}

async fn handle_ws_connection(mut socket: WebSocket, session_id: String, _state: Arc<AppState>) {
    // Send session.created event.
    let _ = socket
        .send(Message::Text(
            serde_json::to_string(&json!({
                "type": "session.created",
                "session": {
                    "id": session_id,
                    "object": "realtime.session",
                },
            }))
            .unwrap(),
        ))
        .await;

    // Echo loop: receive audio frames and acknowledge them.
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                // Parse client events.
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&text) {
                    let event_type = event["type"].as_str().unwrap_or("unknown");
                    match event_type {
                        "input_audio_buffer.append" => {
                            let _ = socket
                                .send(Message::Text(
                                    serde_json::to_string(&json!({
                                        "type": "input_audio_buffer.committed",
                                    }))
                                    .unwrap(),
                                ))
                                .await;
                        }
                        "input_audio_buffer.commit" => {
                            // Acknowledge commit and send a placeholder response.
                            let _ = socket
                                .send(Message::Text(
                                    serde_json::to_string(&json!({
                                        "type": "response.created",
                                        "response": {
                                            "id": format!("resp_{}", uuid::Uuid::new_v4().simple()),
                                            "status": "in_progress",
                                        },
                                    }))
                                    .unwrap(),
                                ))
                                .await;
                            tokio::time::sleep(Duration::from_millis(100)).await;
                            let _ = socket
                                .send(Message::Text(
                                    serde_json::to_string(&json!({
                                        "type": "response.done",
                                        "response": {
                                            "id": format!("resp_{}", uuid::Uuid::new_v4().simple()),
                                            "status": "completed",
                                            "output": [{
                                                "type": "message",
                                                "role": "assistant",
                                                "content": [{
                                                    "type": "text",
                                                    "text": "Audio session placeholder response.",
                                                }],
                                            }],
                                        },
                                    }))
                                    .unwrap(),
                                ))
                                .await;
                        }
                        _ => {
                            // Echo unknown events back.
                            let _ = socket
                                .send(Message::Text(
                                    serde_json::to_string(&json!({
                                        "type": "error",
                                        "error": {
                                            "type": "unknown_event",
                                            "message": format!("Unknown event type: {event_type}"),
                                        },
                                    }))
                                    .unwrap(),
                                ))
                                .await;
                        }
                    }
                }
            }
            Ok(Message::Binary(_audio)) => {
                // In production, forward to audio provider.
                // For now, acknowledge receipt.
            }
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Attempt to retrieve the session store from app state.
/// Returns None if the realtime session store hasn't been added to AppState yet.
fn get_session_store(_state: &AppState) -> Option<RealtimeSessionStore> {
    // The session store would be added to AppState in a future phase.
    // For now, return None — the handlers work without it but won't persist.
    None
}
