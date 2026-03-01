//! MCP Apps / Interactive Capsules API Routes
//!
//! Provides REST API endpoints for capsule lifecycle management:
//! - POST /mcp-apps/capsules - Create new capsule
//! - GET /mcp-apps/capsules/:id - Get capsule state
//! - POST /mcp-apps/capsules/:id/event - Send event to capsule
//! - GET /mcp-apps/capsules/:id/stream - SSE stream for tool updates
//! - DELETE /mcp-apps/capsules/:id - Close and cleanup capsule

use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use futures_util::stream::{self, Stream};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tokio::time::interval;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Request to create a new interactive capsule
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CreateCapsuleRequest {
    /// Capsule type identifier
    pub capsule_type: String,
    /// Tool that owns this capsule
    pub tool_id: String,
    /// UI surface definition
    pub surface: ToolUISurface,
    /// Optional agent ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    /// Optional session ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// Time-to-live in seconds (default: 1800)
    #[serde(default = "default_ttl")]
    pub ttl_seconds: u64,
}

fn default_ttl() -> u64 {
    1800
}

/// UI surface definition
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ToolUISurface {
    /// HTML content
    pub html: String,
    /// Optional CSS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css: Option<String>,
    /// Optional JavaScript
    #[serde(skip_serializing_if = "Option::is_none")]
    pub js: Option<String>,
    /// Initial props
    #[serde(skip_serializing_if = "Option::is_none")]
    pub props: Option<serde_json::Value>,
    /// Permissions granted to this surface
    pub permissions: Vec<CapsulePermission>,
    /// Optional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<SurfaceMetadata>,
}

/// Permission grant
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CapsulePermission {
    /// Permission type
    pub permission_type: String,
    /// Resource identifier
    pub resource: String,
    /// Allowed actions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actions: Option<Vec<String>>,
    /// Optional conditions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<serde_json::Value>,
}

/// Surface metadata
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SurfaceMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
}

fn default_version() -> String {
    "1.0.0".to_string()
}

/// Capsule response
#[derive(Debug, Serialize, Clone)]
pub struct CapsuleResponse {
    pub id: String,
    pub capsule_type: String,
    pub state: String,
    pub tool_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub surface: ToolUISurface,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Event request
#[derive(Debug, Deserialize)]
pub struct PostEventRequest {
    pub event_type: String,
    pub payload: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// Event response (broadcast)
#[derive(Debug, Serialize, Clone)]
pub struct CapsuleEvent {
    pub id: String,
    pub capsule_id: String,
    pub direction: String, // "to_tool" or "to_ui"
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: String,
    pub source: String,
}

/// Capsule state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapsuleState {
    Pending,
    Active,
    Closed,
    Error,
}

impl std::fmt::Display for CapsuleState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CapsuleState::Pending => write!(f, "pending"),
            CapsuleState::Active => write!(f, "active"),
            CapsuleState::Closed => write!(f, "closed"),
            CapsuleState::Error => write!(f, "error"),
        }
    }
}

/// Internal capsule entry (stored in registry)
#[derive(Debug)]
pub struct CapsuleEntry {
    pub id: String,
    pub capsule_type: String,
    pub state: CapsuleState,
    pub tool_id: String,
    pub agent_id: Option<String>,
    pub session_id: Option<String>,
    pub surface: ToolUISurface,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
    pub expires_at: chrono::DateTime<Utc>,
    pub error: Option<String>,
    pub event_tx: broadcast::Sender<CapsuleEvent>,
}

/// Capsule registry with cleanup
pub struct CapsuleRegistry {
    capsules: std::collections::HashMap<String, CapsuleEntry>,
}

impl CapsuleRegistry {
    pub fn new() -> Self {
        Self {
            capsules: std::collections::HashMap::new(),
        }
    }

    /// Start background cleanup task
    pub fn start_cleanup_task(registry: Arc<tokio::sync::RwLock<Self>>) {
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(60)); // Check every minute

            loop {
                ticker.tick().await;

                let now = Utc::now();
                let mut expired_ids = Vec::new();

                // Find expired capsules
                {
                    let registry_read = registry.read().await;
                    for (id, capsule) in &registry_read.capsules {
                        if capsule.expires_at < now
                            || (capsule.state == CapsuleState::Closed
                                && capsule.updated_at + chrono::Duration::minutes(5) < now)
                        {
                            expired_ids.push(id.clone());
                        }
                    }
                }

                // Remove expired capsules
                if !expired_ids.is_empty() {
                    let mut registry_write = registry.write().await;
                    for id in expired_ids {
                        if let Some(capsule) = registry_write.capsules.get(&id) {
                            // Notify subscribers before removal
                            let cleanup_event = CapsuleEvent {
                                id: Uuid::new_v4().to_string(),
                                capsule_id: id.clone(),
                                direction: "to_ui".to_string(),
                                event_type: "capsule:expired".to_string(),
                                payload: serde_json::json!({"reason": "ttl_expired"}),
                                timestamp: Utc::now().to_rfc3339(),
                                source: "system".to_string(),
                            };
                            let _ = capsule.event_tx.send(cleanup_event);

                            warn!(capsule_id = %id, "Removing expired capsule");
                        }
                        registry_write.capsules.remove(&id);
                    }
                }
            }
        });
    }
}

/// Create a new capsule
async fn create_capsule(
    State(state): State<Arc<crate::AppState>>,
    Json(req): Json<CreateCapsuleRequest>,
) -> Result<Json<CapsuleResponse>, StatusCode> {
    let now = Utc::now();
    let id = Uuid::new_v4().to_string();
    let expires_at = now + chrono::Duration::seconds(req.ttl_seconds as i64);

    info!(capsule_id = %id, tool_id = %req.tool_id, "Creating interactive capsule");

    let response = CapsuleResponse {
        id: id.clone(),
        capsule_type: req.capsule_type.clone(),
        state: CapsuleState::Pending.to_string(),
        tool_id: req.tool_id.clone(),
        agent_id: req.agent_id.clone(),
        session_id: req.session_id.clone(),
        surface: req.surface.clone(),
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
        expires_at: Some(expires_at.to_rfc3339()),
        error: None,
    };

    // Store in registry
    if let Some(registry) = state.mcp_capsule_registry.as_ref() {
        let capsule = CapsuleEntry {
            id: id.clone(),
            capsule_type: req.capsule_type,
            state: CapsuleState::Pending,
            tool_id: req.tool_id,
            agent_id: req.agent_id,
            session_id: req.session_id,
            surface: req.surface,
            created_at: now,
            updated_at: now,
            expires_at,
            error: None,
            event_tx: broadcast::channel(100).0,
        };

        let mut registry = registry.write().await;
        registry.insert(id.clone(), capsule);
    }

    debug!(capsule_id = %id, "Capsule created successfully");
    Ok(Json(response))
}

/// Get capsule by ID
async fn get_capsule(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> Result<Json<CapsuleResponse>, StatusCode> {
    if let Some(registry) = state.mcp_capsule_registry.as_ref() {
        let registry = registry.read().await;

        if let Some(capsule) = registry.get(&id) {
            return Ok(Json(CapsuleResponse {
                id: capsule.id.clone(),
                capsule_type: capsule.capsule_type.clone(),
                state: capsule.state.to_string(),
                tool_id: capsule.tool_id.clone(),
                agent_id: capsule.agent_id.clone(),
                session_id: capsule.session_id.clone(),
                surface: capsule.surface.clone(),
                created_at: capsule.created_at.to_rfc3339(),
                updated_at: capsule.updated_at.to_rfc3339(),
                expires_at: Some(capsule.expires_at.to_rfc3339()),
                error: capsule.error.clone(),
            }));
        }
    }

    Err(StatusCode::NOT_FOUND)
}

/// Post event to capsule (UI → Tool)
async fn post_event(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
    Json(req): Json<PostEventRequest>,
) -> Result<StatusCode, StatusCode> {
    let event = CapsuleEvent {
        id: Uuid::new_v4().to_string(),
        capsule_id: id.clone(),
        direction: "to_tool".to_string(),
        event_type: req.event_type.clone(),
        payload: req.payload.clone(),
        timestamp: Utc::now().to_rfc3339(),
        source: req.source.unwrap_or_else(|| "ui".to_string()),
    };

    if let Some(registry) = state.mcp_capsule_registry.as_ref() {
        let registry = registry.read().await;

        if let Some(capsule) = registry.get(&id) {
            // Broadcast to subscribers
            let _ = capsule.event_tx.send(event);
            debug!(capsule_id = %id, event_type = %req.event_type, "Event broadcast");
            return Ok(StatusCode::ACCEPTED);
        }
    }

    Err(StatusCode::NOT_FOUND)
}

/// SSE stream for capsule events (Tool → UI)
async fn event_stream(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    let rx = if let Some(registry) = state.mcp_capsule_registry.as_ref() {
        let registry = registry.read().await;

        if let Some(capsule) = registry.get(&id) {
            Some(capsule.event_tx.subscribe())
        } else {
            None
        }
    } else {
        None
    };

    if rx.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    let rx = rx.unwrap();

    let stream = stream::unfold(rx, |mut rx| async move {
        match rx.recv().await {
            Ok(event) => {
                let data = serde_json::to_string(&event).unwrap_or_default();
                let sse_event = Event::default().event(&event.event_type).data(data);
                Some((Ok(sse_event), rx))
            }
            Err(_) => None,
        }
    });

    Ok(Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("keep-alive"),
    ))
}

/// Delete (close) capsule
async fn delete_capsule(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    if let Some(registry) = state.mcp_capsule_registry.as_ref() {
        let mut registry = registry.write().await;

        if let Some(capsule) = registry.get_mut(&id) {
            // Notify subscribers
            let close_event = CapsuleEvent {
                id: Uuid::new_v4().to_string(),
                capsule_id: id.clone(),
                direction: "to_ui".to_string(),
                event_type: "capsule:closed".to_string(),
                payload: serde_json::json!({"reason": "user_request"}),
                timestamp: Utc::now().to_rfc3339(),
                source: "system".to_string(),
            };
            let _ = capsule.event_tx.send(close_event);

            // Remove from registry
            registry.remove(&id);

            info!(capsule_id = %id, "Capsule closed");
            return Ok(StatusCode::NO_CONTENT);
        }
    }

    Err(StatusCode::NOT_FOUND)
}

/// List capsules (optionally filtered)
async fn list_capsules(
    State(state): State<Arc<crate::AppState>>,
) -> Result<Json<Vec<CapsuleResponse>>, StatusCode> {
    let mut capsules = Vec::new();

    if let Some(registry) = state.mcp_capsule_registry.as_ref() {
        let registry = registry.read().await;

        for (_, capsule) in registry.iter() {
            capsules.push(CapsuleResponse {
                id: capsule.id.clone(),
                capsule_type: capsule.capsule_type.clone(),
                state: capsule.state.to_string(),
                tool_id: capsule.tool_id.clone(),
                agent_id: capsule.agent_id.clone(),
                session_id: capsule.session_id.clone(),
                surface: capsule.surface.clone(),
                created_at: capsule.created_at.to_rfc3339(),
                updated_at: capsule.updated_at.to_rfc3339(),
                expires_at: Some(capsule.expires_at.to_rfc3339()),
                error: capsule.error.clone(),
            });
        }
    }

    Ok(Json(capsules))
}

/// Request to update capsule state
#[derive(Debug, Deserialize)]
pub struct UpdateStateRequest {
    pub state: String, // pending, active, closed, error
    pub error: Option<String>,
}

/// Update capsule state
async fn update_capsule_state(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateStateRequest>,
) -> Result<Json<CapsuleResponse>, StatusCode> {
    let new_state = match req.state.as_str() {
        "pending" => CapsuleState::Pending,
        "active" => CapsuleState::Active,
        "closed" => CapsuleState::Closed,
        "error" => CapsuleState::Error,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    if let Some(registry) = state.mcp_capsule_registry.as_ref() {
        let mut registry = registry.write().await;

        if let Some(capsule) = registry.get_mut(&id) {
            capsule.state = new_state;
            capsule.updated_at = Utc::now();
            if req.error.is_some() {
                capsule.error = req.error;
            }

            // Broadcast state change event
            let state_event = CapsuleEvent {
                id: Uuid::new_v4().to_string(),
                capsule_id: id.clone(),
                direction: "to_ui".to_string(),
                event_type: "capsule:state_changed".to_string(),
                payload: serde_json::json!({
                    "state": req.state,
                    "error": capsule.error,
                }),
                timestamp: Utc::now().to_rfc3339(),
                source: "system".to_string(),
            };
            let _ = capsule.event_tx.send(state_event);

            return Ok(Json(CapsuleResponse {
                id: capsule.id.clone(),
                capsule_type: capsule.capsule_type.clone(),
                state: capsule.state.to_string(),
                tool_id: capsule.tool_id.clone(),
                agent_id: capsule.agent_id.clone(),
                session_id: capsule.session_id.clone(),
                surface: capsule.surface.clone(),
                created_at: capsule.created_at.to_rfc3339(),
                updated_at: capsule.updated_at.to_rfc3339(),
                expires_at: Some(capsule.expires_at.to_rfc3339()),
                error: capsule.error.clone(),
            }));
        }
    }

    Err(StatusCode::NOT_FOUND)
}

/// Create router
pub fn router() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route(
            "/mcp-apps/capsules",
            post(create_capsule).get(list_capsules),
        )
        .route(
            "/mcp-apps/capsules/:id",
            get(get_capsule).delete(delete_capsule),
        )
        .route("/mcp-apps/capsules/:id/event", post(post_event))
        .route("/mcp-apps/capsules/:id/stream", get(event_stream))
        .route("/mcp-apps/capsules/:id/state", post(update_capsule_state))
}
