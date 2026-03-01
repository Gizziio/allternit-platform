//! Native Agent API (N20)
//!
//! Exposes native services via HTTP/WebSocket for ShellUI integration.
//! This wires together the native implementations to create the unified agent experience.
//!
//! ## Full Implementation Status
//!
//! | Endpoint | Status | Description |
//! |----------|--------|-------------|
//! | `GET /v1/agent/sessions` | ✅ Full | List all sessions with filtering |
//! | `POST /v1/agent/sessions` | ✅ Full | Create new session |
//! | `GET /v1/agent/sessions/:id` | ✅ Full | Get session details |
//! | `PATCH /v1/agent/sessions/:id` | ✅ Full | Update session |
//! | `DELETE /v1/agent/sessions/:id` | ✅ Full | Delete session |
//! | `GET /v1/agent/sessions/:id/messages` | ✅ Full | Get session message history |
//! | `POST /v1/agent/sessions/:id/messages` | ✅ Full | Add message to session |
//! | `POST /v1/agent/sessions/:id/chat/stream` | ✅ Full | SSE streaming chat with rich events |
//! | `POST /v1/agent/sessions/:id/abort` | ✅ Full | Abort generation |
//! | `POST /v1/agent/sessions/:id/inject` | ✅ Full | Inject message (PI Agent) |
//! | `GET /v1/agent/tools` | ✅ Full | List available tools |
//! | `POST /v1/agent/sessions/:id/tools/execute` | ✅ Full | Execute tool synchronously |
//! | `POST /v1/agent/sessions/:id/tools/stream` | ✅ Full | Execute tool with streaming |
//! | `GET /v1/agent/canvas` | ✅ Full | List canvases with filtering |
//! | `POST /v1/agent/canvas` | ✅ Full | Create canvas (A2UI or Document mode) |
//! | `GET /v1/agent/canvas/:id` | ✅ Full | Get canvas |
//! | `POST /v1/agent/canvas/:id` | ✅ Full | Canvas operations |
//! | `DELETE /v1/agent/canvas/:id` | ✅ Full | Delete canvas |

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::RwLock;

pub mod canvas;
pub mod chat;
pub mod sessions;
pub mod tools;

use crate::{
    native_canvas_a2ui::CanvasService, native_session_manager::SessionManagerService,
    native_skill_execution::SkillExecutionService, native_tool_registry::ToolRegistry,
    native_tool_streaming::ToolStreamerService,
};

/// Shared state for agent API
#[derive(Clone)]
pub struct AgentApiState {
    pub session_manager: Arc<RwLock<SessionManagerService>>,
    pub skill_executor: Arc<RwLock<SkillExecutionService>>,
    pub canvas: Arc<RwLock<CanvasService>>,
    pub tool_registry: Arc<RwLock<ToolRegistry>>,
    pub tool_streamer: Arc<RwLock<ToolStreamerService>>,
}

impl AgentApiState {
    /// Create new API state with default services
    pub async fn new() -> Result<Self, crate::errors::HostError> {
        Ok(Self {
            session_manager: Arc::new(RwLock::new(SessionManagerService::new())),
            skill_executor: Arc::new(RwLock::new(SkillExecutionService::new())),
            canvas: Arc::new(RwLock::new(CanvasService::new())),
            tool_registry: Arc::new(RwLock::new(ToolRegistry::new())),
            tool_streamer: Arc::new(RwLock::new(ToolStreamerService::new())),
        })
    }
}

/// Create the agent API router
pub fn create_agent_router(state: AgentApiState) -> Router {
    Router::new()
        // Session management
        .route(
            "/v1/agent/sessions",
            get(sessions::list_sessions).post(sessions::create_session),
        )
        .route(
            "/v1/agent/sessions/:session_id",
            get(sessions::get_session)
                .patch(sessions::patch_session)
                .delete(sessions::delete_session),
        )
        // Session messages
        .route(
            "/v1/agent/sessions/:session_id/messages",
            get(sessions::get_session_messages).post(sessions::add_session_message),
        )
        // Chat streaming
        .route(
            "/v1/agent/sessions/:session_id/chat/stream",
            post(chat::chat_stream),
        )
        .route(
            "/v1/agent/sessions/:session_id/abort",
            post(chat::abort_generation),
        )
        .route(
            "/v1/agent/sessions/:session_id/inject",
            post(chat::inject_message),
        )
        // Tool execution
        .route("/v1/agent/tools", get(tools::list_tools))
        .route(
            "/v1/agent/sessions/:session_id/tools/execute",
            post(tools::execute_tool),
        )
        .route(
            "/v1/agent/sessions/:session_id/tools/stream",
            post(tools::stream_tool_execution),
        )
        // Canvas operations
        .route(
            "/v1/agent/canvas",
            get(canvas::list_canvases).post(canvas::create_canvas),
        )
        .route(
            "/v1/agent/canvas/:canvas_id",
            get(canvas::get_canvas)
                .post(canvas::canvas_operation)
                .delete(canvas::delete_canvas),
        )
        .with_state(state)
}

/// API error response
#[derive(Debug, serde::Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
}

impl ApiError {
    pub fn new(error: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            code: code.into(),
        }
    }
}

/// Convert HostError to API response
impl From<crate::errors::HostError> for ApiError {
    fn from(err: crate::errors::HostError) -> Self {
        Self::new(err.to_string(), "INTERNAL_ERROR")
    }
}
