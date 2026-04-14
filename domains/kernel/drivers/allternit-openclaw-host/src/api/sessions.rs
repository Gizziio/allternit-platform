//! Session Management API Routes (N20)
//!
//! Provides full CRUD operations for agent sessions with:
//! - In-memory session storage (backed by DashMap for thread safety)
//! - Message history per session
//! - Session metadata and tagging

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::{AgentApiState, ApiError};

/// Session stored in memory
#[derive(Debug, Clone, Serialize)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed_at: String,
    pub message_count: u32,
    pub is_active: bool,
    pub tags: Vec<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// Messages stored in-memory for this session
    #[serde(skip)]
    pub messages: Vec<Message>,
}

/// Message within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Session response for API
#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed_at: String,
    pub message_count: u32,
    pub is_active: bool,
    pub tags: Vec<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

impl From<Session> for SessionResponse {
    fn from(session: Session) -> Self {
        Self {
            id: session.id,
            title: session.title,
            created_at: session.created_at,
            updated_at: session.updated_at,
            last_accessed_at: session.last_accessed_at,
            message_count: session.message_count,
            is_active: session.is_active,
            tags: session.tags,
            metadata: session.metadata,
        }
    }
}

/// Create session request
#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Patch session request
#[derive(Debug, Deserialize)]
pub struct PatchSessionRequest {
    pub title: Option<String>,
    pub is_active: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// List sessions response
#[derive(Debug, Serialize)]
pub struct ListSessionsResponse {
    pub sessions: Vec<SessionResponse>,
    pub count: usize,
}

/// List all sessions
pub async fn list_sessions(
    State(state): State<AgentApiState>,
) -> Result<Json<ListSessionsResponse>, (StatusCode, Json<ApiError>)> {
    let sessions = state.session_manager.read().await;
    let session_list: Vec<SessionResponse> = sessions
        .list_sessions_api()
        .await
        .into_iter()
        .map(Into::into)
        .collect();

    let count = session_list.len();
    Ok(Json(ListSessionsResponse {
        sessions: session_list,
        count,
    }))
}

/// Get a specific session
pub async fn get_session(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionResponse>, (StatusCode, Json<ApiError>)> {
    let sessions = state.session_manager.read().await;

    match sessions.get_session_api(&session_id).await {
        Some(session) => Ok(Json(session.into())),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
        )),
    }
}

/// Create a new session
pub async fn create_session(
    State(state): State<AgentApiState>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<SessionResponse>), (StatusCode, Json<ApiError>)> {
    let mut sessions = state.session_manager.write().await;

    let session_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let mut metadata = req.metadata.unwrap_or_default();
    if let Some(desc) = req.description {
        metadata.insert("description".to_string(), serde_json::Value::String(desc));
    }

    let session = Session {
        id: session_id.clone(),
        title: req.title.unwrap_or_else(|| "New Session".to_string()),
        created_at: now.clone(),
        updated_at: now.clone(),
        last_accessed_at: now,
        message_count: 0,
        is_active: true,
        tags: req.tags.unwrap_or_default(),
        metadata: if metadata.is_empty() {
            None
        } else {
            Some(metadata)
        },
        messages: Vec::new(),
    };

    sessions.insert_session_api(session.clone()).await;

    Ok((StatusCode::CREATED, Json(session.into())))
}

/// Update a session
pub async fn patch_session(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
    Json(req): Json<PatchSessionRequest>,
) -> Result<Json<SessionResponse>, (StatusCode, Json<ApiError>)> {
    let mut sessions = state.session_manager.write().await;

    // First check if session exists
    if sessions.get_session_api(&session_id).await.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
        ));
    }

    // Get mutable reference
    if let Some(session) = sessions.get_session_mut_api(&session_id).await {
        if let Some(title) = req.title {
            session.name = Some(title);
        }
        if let Some(is_active) = req.is_active {
            session.active = is_active;
        }
        if let Some(tags) = req.tags {
            session.tags = tags;
        }
        if let Some(metadata) = req.metadata {
            session.metadata = Some(metadata);
        }
        session.updated_at = Utc::now();

        // Convert back to API session for response
        let api_session = Session {
            id: session.id.as_str().to_string(),
            title: session
                .name
                .clone()
                .unwrap_or_else(|| "Untitled".to_string()),
            created_at: session.created_at.to_rfc3339(),
            updated_at: session.updated_at.to_rfc3339(),
            last_accessed_at: session.last_accessed.to_rfc3339(),
            message_count: session.messages.len() as u32,
            is_active: session.active,
            tags: session.tags.clone(),
            metadata: session.metadata.clone(),
            messages: session
                .messages
                .iter()
                .map(|m| Message {
                    id: m.id.clone(),
                    role: m.role.clone(),
                    content: m.content.clone(),
                    timestamp: m.timestamp.to_rfc3339(),
                    metadata: m.metadata.clone(),
                })
                .collect(),
        };

        Ok(Json(api_session.into()))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
        ))
    }
}

/// Delete a session
pub async fn delete_session(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut sessions = state.session_manager.write().await;

    match sessions.remove_session_api(&session_id).await {
        true => Ok(StatusCode::NO_CONTENT),
        false => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
        )),
    }
}

/// Get messages for a session
pub async fn get_session_messages(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
) -> Result<Json<Vec<Message>>, (StatusCode, Json<ApiError>)> {
    let sessions = state.session_manager.read().await;

    match sessions.get_session_api(&session_id).await {
        Some(session) => Ok(Json(session.messages)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
        )),
    }
}

/// Add a message to a session
#[derive(Debug, Deserialize)]
pub struct AddMessageRequest {
    pub role: String,
    pub content: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

pub async fn add_session_message(
    State(state): State<AgentApiState>,
    Path(session_id): Path<String>,
    Json(req): Json<AddMessageRequest>,
) -> Result<(StatusCode, Json<Message>), (StatusCode, Json<ApiError>)> {
    let mut sessions = state.session_manager.write().await;

    match sessions.get_session_mut_api(&session_id).await {
        Some(session) => {
            let message = crate::native_session_manager::SessionMessage {
                id: Uuid::new_v4().to_string(),
                role: req.role,
                content: req.content,
                timestamp: Utc::now(),
                metadata: req.metadata,
            };

            session.messages.push(message.clone());

            let api_message = Message {
                id: message.id,
                role: message.role,
                content: message.content,
                timestamp: message.timestamp.to_rfc3339(),
                metadata: message.metadata,
            };

            Ok((StatusCode::CREATED, Json(api_message)))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Session not found", "SESSION_NOT_FOUND")),
        )),
    }
}
