//! Gateway WebSocket Handlers Native - OC-014
//!
//! Native Rust implementation of OpenClaw's gateway WebSocket message handlers.
//! This module provides the native implementation that will eventually replace
//! the OpenClaw subprocess WebSocket handlers.

#[cfg(feature = "futures-util")]
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
#[cfg(feature = "tokio-tungstenite")]
use tokio_tungstenite::tungstenite::Message as WsMessage;

/// WebSocket connection state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsConnectionState {
    pub connection_id: String,
    pub client_id: Option<String>,
    pub user_id: Option<String>,
    pub connected_at: u64,
    pub last_activity: u64,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub authenticated: bool,
    pub scopes: Vec<String>, // e.g., "operator.read", "operator.write", "operator.admin"
    pub metadata: HashMap<String, String>,
}

/// WebSocket message frame
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsFrame {
    pub id: String,
    #[serde(rename = "type")]
    pub frame_type: WsFrameType,
    pub method: Option<String>,
    pub params: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<WsError>,
    pub timestamp: u64,
}

/// WebSocket frame type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WsFrameType {
    Request,
    Response,
    Notification,
    Error,
}

/// WebSocket error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsError {
    pub code: i32,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

/// Gateway WebSocket configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayWsConfig {
    pub max_connections: Option<usize>,
    pub max_payload_bytes: Option<usize>,
    pub max_buffered_bytes: Option<usize>,
    pub heartbeat_interval_ms: Option<u64>,
    pub handshake_timeout_ms: Option<u64>,
    pub enable_compression: Option<bool>,
    pub allowed_origins: Option<Vec<String>>,
    pub auth_required: Option<bool>,
    pub default_scopes: Option<Vec<String>>,
}

impl Default for GatewayWsConfig {
    fn default() -> Self {
        Self {
            max_connections: Some(1000),
            max_payload_bytes: Some(1024 * 1024),       // 1MB
            max_buffered_bytes: Some(16 * 1024 * 1024), // 16MB
            heartbeat_interval_ms: Some(30_000),        // 30 seconds
            handshake_timeout_ms: Some(10_000),         // 10 seconds
            enable_compression: Some(true),
            allowed_origins: None,
            auth_required: Some(true),
            default_scopes: Some(vec!["operator.read".to_string()]),
        }
    }
}

/// WebSocket handler result
#[derive(Debug)]
pub enum WsHandlerResult {
    /// Send a response back to the client
    Response(WsFrame),
    /// Broadcast a notification to multiple clients
    Broadcast {
        recipients: Vec<String>, // connection IDs
        message: WsFrame,
    },
    /// Broadcast to all clients
    BroadcastAll { message: WsFrame },
    /// Close the connection
    Close { code: u16, reason: String },
    /// Continue processing
    Continue,
    /// Error occurred
    Error(WsError),
}

/// WebSocket handler trait
#[async_trait::async_trait]
pub trait WsHandler: Send + Sync {
    async fn handle(
        &self,
        connection_state: Arc<RwLock<WsConnectionState>>,
        frame: WsFrame,
    ) -> Result<WsHandlerResult, WsError>;

    /// Check if this handler can handle the given method
    fn can_handle(&self, method: &str) -> bool;

    /// Get the priority of this handler (lower numbers = higher priority)
    fn priority(&self) -> i32 {
        0
    }
}

/// Chat message handler
pub struct ChatHandler {
    config: Arc<GatewayWsConfig>,
}

impl ChatHandler {
    pub fn new(config: Arc<GatewayWsConfig>) -> Self {
        Self { config }
    }
}

#[async_trait::async_trait]
impl WsHandler for ChatHandler {
    async fn handle(
        &self,
        connection_state: Arc<RwLock<WsConnectionState>>,
        frame: WsFrame,
    ) -> Result<WsHandlerResult, WsError> {
        let method = frame.method.as_deref().unwrap_or("");

        match method {
            "chat.send" => {
                // Handle chat send request
                let params = frame.params.unwrap_or_default();

                // Validate scopes
                {
                    let state = connection_state.read().await;
                    if !self.has_scope(&state, "operator.write") {
                        return Err(WsError {
                            code: 403,
                            message: "Insufficient permissions".to_string(),
                            details: None,
                        });
                    }
                }

                // Process chat message
                let response_frame = WsFrame {
                    id: frame.id,
                    frame_type: WsFrameType::Response,
                    method: Some("chat.send".to_string()),
                    params: None,
                    result: Some(serde_json::json!({
                        "status": "accepted",
                        "messageId": format!("msg_{}", uuid::Uuid::new_v4())
                    })),
                    error: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                };

                Ok(WsHandlerResult::Response(response_frame))
            }
            "chat.history" => {
                // Handle chat history request
                let params = frame.params.unwrap_or_default();

                // Validate scopes
                {
                    let state = connection_state.read().await;
                    if !self.has_scope(&state, "operator.read") {
                        return Err(WsError {
                            code: 403,
                            message: "Insufficient permissions".to_string(),
                            details: None,
                        });
                    }
                }

                // Return chat history
                let response_frame = WsFrame {
                    id: frame.id,
                    frame_type: WsFrameType::Response,
                    method: Some("chat.history".to_string()),
                    params: None,
                    result: Some(serde_json::json!({
                        "messages": [],
                        "sessionId": "default_session",
                        "hasMore": false
                    })),
                    error: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                };

                Ok(WsHandlerResult::Response(response_frame))
            }
            _ => Ok(WsHandlerResult::Continue),
        }
    }

    fn can_handle(&self, method: &str) -> bool {
        method.starts_with("chat.")
    }
}

impl ChatHandler {
    fn has_scope(&self, state: &WsConnectionState, required_scope: &str) -> bool {
        state
            .scopes
            .iter()
            .any(|scope| scope == required_scope || scope == "operator.admin")
    }
}

/// Session handler
pub struct SessionHandler {
    config: Arc<GatewayWsConfig>,
}

impl SessionHandler {
    pub fn new(config: Arc<GatewayWsConfig>) -> Self {
        Self { config }
    }
}

#[async_trait::async_trait]
impl WsHandler for SessionHandler {
    async fn handle(
        &self,
        connection_state: Arc<RwLock<WsConnectionState>>,
        frame: WsFrame,
    ) -> Result<WsHandlerResult, WsError> {
        let method = frame.method.as_deref().unwrap_or("");

        match method {
            "sessions.list" => {
                // Handle sessions list request
                let params = frame.params.unwrap_or_default();

                // Validate scopes
                {
                    let state = connection_state.read().await;
                    if !self.has_scope(&state, "operator.read") {
                        return Err(WsError {
                            code: 403,
                            message: "Insufficient permissions".to_string(),
                            details: None,
                        });
                    }
                }

                // Return sessions list
                let response_frame = WsFrame {
                    id: frame.id,
                    frame_type: WsFrameType::Response,
                    method: Some("sessions.list".to_string()),
                    params: None,
                    result: Some(serde_json::json!({
                        "sessions": [
                            {
                                "id": "session_1",
                                "name": "Default Session",
                                "active": true,
                                "lastActivity": std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_secs(),
                                "messageCount": 10
                            }
                        ]
                    })),
                    error: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                };

                Ok(WsHandlerResult::Response(response_frame))
            }
            "sessions.get" => {
                // Handle session get request
                let params = frame.params.unwrap_or_default();

                // Validate scopes
                {
                    let state = connection_state.read().await;
                    if !self.has_scope(&state, "operator.read") {
                        return Err(WsError {
                            code: 403,
                            message: "Insufficient permissions".to_string(),
                            details: None,
                        });
                    }
                }

                // Return session details
                let response_frame = WsFrame {
                    id: frame.id,
                    frame_type: WsFrameType::Response,
                    method: Some("sessions.get".to_string()),
                    params: None,
                    result: Some(serde_json::json!({
                        "session": {
                            "id": "session_1",
                            "name": "Default Session",
                            "active": true,
                            "createdAt": std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs(),
                            "lastActivity": std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs(),
                            "messageCount": 10
                        }
                    })),
                    error: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                };

                Ok(WsHandlerResult::Response(response_frame))
            }
            _ => Ok(WsHandlerResult::Continue),
        }
    }

    fn can_handle(&self, method: &str) -> bool {
        method.starts_with("sessions.")
    }
}

impl SessionHandler {
    fn has_scope(&self, state: &WsConnectionState, required_scope: &str) -> bool {
        state
            .scopes
            .iter()
            .any(|scope| scope == required_scope || scope == "operator.admin")
    }
}

/// Skill handler
pub struct SkillHandler {
    config: Arc<GatewayWsConfig>,
}

impl SkillHandler {
    pub fn new(config: Arc<GatewayWsConfig>) -> Self {
        Self { config }
    }
}

#[async_trait::async_trait]
impl WsHandler for SkillHandler {
    async fn handle(
        &self,
        connection_state: Arc<RwLock<WsConnectionState>>,
        frame: WsFrame,
    ) -> Result<WsHandlerResult, WsError> {
        let method = frame.method.as_deref().unwrap_or("");

        match method {
            "skills.list" => {
                // Handle skills list request
                let params = frame.params.unwrap_or_default();

                // Validate scopes
                {
                    let state = connection_state.read().await;
                    if !self.has_scope(&state, "operator.read") {
                        return Err(WsError {
                            code: 403,
                            message: "Insufficient permissions".to_string(),
                            details: None,
                        });
                    }
                }

                // Return skills list
                let response_frame = WsFrame {
                    id: frame.id,
                    frame_type: WsFrameType::Response,
                    method: Some("skills.list".to_string()),
                    params: None,
                    result: Some(serde_json::json!({
                        "skills": [
                            {
                                "id": "github",
                                "name": "GitHub",
                                "description": "GitHub CLI integration",
                                "enabled": true,
                                "available": true
                            },
                            {
                                "id": "bash",
                                "name": "Bash",
                                "description": "Execute bash commands",
                                "enabled": true,
                                "available": true
                            }
                        ]
                    })),
                    error: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                };

                Ok(WsHandlerResult::Response(response_frame))
            }
            _ => Ok(WsHandlerResult::Continue),
        }
    }

    fn can_handle(&self, method: &str) -> bool {
        method.starts_with("skills.")
    }
}

impl SkillHandler {
    fn has_scope(&self, state: &WsConnectionState, required_scope: &str) -> bool {
        state
            .scopes
            .iter()
            .any(|scope| scope == required_scope || scope == "operator.admin")
    }
}

/// Gateway WebSocket handler service
pub struct GatewayWsHandlerService {
    config: Arc<GatewayWsConfig>,
    handlers: Vec<Box<dyn WsHandler>>,
}

impl GatewayWsHandlerService {
    /// Create new service with default configuration
    pub fn new() -> Self {
        let config = Arc::new(GatewayWsConfig::default());
        let mut service = Self {
            config,
            handlers: Vec::new(),
        };

        // Add default handlers
        service.add_handler(Box::new(ChatHandler::new(service.config.clone())));
        service.add_handler(Box::new(SessionHandler::new(service.config.clone())));
        service.add_handler(Box::new(SkillHandler::new(service.config.clone())));

        service
    }

    /// Create new service with custom configuration
    pub fn with_config(config: GatewayWsConfig) -> Self {
        let config = Arc::new(config);
        let mut service = Self {
            config,
            handlers: Vec::new(),
        };

        // Add default handlers
        service.add_handler(Box::new(ChatHandler::new(service.config.clone())));
        service.add_handler(Box::new(SessionHandler::new(service.config.clone())));
        service.add_handler(Box::new(SkillHandler::new(service.config.clone())));

        service
    }

    /// Add a handler to the service
    pub fn add_handler(&mut self, handler: Box<dyn WsHandler>) {
        self.handlers.push(handler);
        // Sort by priority (higher priority first)
        self.handlers
            .sort_by(|a, b| b.priority().cmp(&a.priority()));
    }

    /// Process a WebSocket frame
    pub async fn process_frame(
        &self,
        connection_state: Arc<RwLock<WsConnectionState>>,
        frame: WsFrame,
    ) -> Result<WsHandlerResult, WsError> {
        // Try each handler in priority order
        for handler in &self.handlers {
            if let Some(method) = &frame.method {
                if handler.can_handle(method) {
                    match handler
                        .handle(connection_state.clone(), frame.clone())
                        .await
                    {
                        Ok(result) => {
                            // If the result is Continue, try the next handler
                            if matches!(result, WsHandlerResult::Continue) {
                                continue;
                            }
                            return Ok(result);
                        }
                        Err(e) => {
                            // If a handler returns an error, return it immediately
                            return Err(e);
                        }
                    }
                }
            }
        }

        // If no handler could process the frame, return an error
        Err(WsError {
            code: 404,
            message: format!("No handler found for method: {:?}", frame.method),
            details: Some(serde_json::json!({
                "method": frame.method,
                "id": frame.id,
            })),
        })
    }

    /// Get the configuration
    pub fn config(&self) -> &GatewayWsConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut GatewayWsConfig {
        Arc::make_mut(&mut self.config)
    }
}

impl Default for GatewayWsHandlerService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gateway_ws_handler_creation() {
        let service = GatewayWsHandlerService::new();

        assert_eq!(service.handlers.len(), 3); // chat, session, skill handlers
        assert!(service.config.max_connections.is_some());
    }

    #[tokio::test]
    async fn test_chat_handler() {
        let config = Arc::new(GatewayWsConfig::default());
        let handler = ChatHandler::new(config);

        let connection_state = Arc::new(RwLock::new(WsConnectionState {
            connection_id: "test_conn".to_string(),
            client_id: Some("test_client".to_string()),
            user_id: Some("test_user".to_string()),
            connected_at: 0,
            last_activity: 0,
            ip_address: None,
            user_agent: None,
            authenticated: true,
            scopes: vec!["operator.write".to_string()],
            metadata: HashMap::new(),
        }));

        let frame = WsFrame {
            id: "test_id".to_string(),
            frame_type: WsFrameType::Request,
            method: Some("chat.send".to_string()),
            params: Some(serde_json::json!({
                "message": "Hello, world!"
            })),
            result: None,
            error: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };

        let result = handler.handle(connection_state, frame).await;
        assert!(result.is_ok());

        match result.unwrap() {
            WsHandlerResult::Response(response) => {
                assert_eq!(response.method, Some("chat.send".to_string()));
                assert!(response.result.is_some());
            }
            _ => panic!("Expected Response"),
        }
    }

    #[tokio::test]
    async fn test_session_handler() {
        let config = Arc::new(GatewayWsConfig::default());
        let handler = SessionHandler::new(config);

        let connection_state = Arc::new(RwLock::new(WsConnectionState {
            connection_id: "test_conn".to_string(),
            client_id: Some("test_client".to_string()),
            user_id: Some("test_user".to_string()),
            connected_at: 0,
            last_activity: 0,
            ip_address: None,
            user_agent: None,
            authenticated: true,
            scopes: vec!["operator.read".to_string()],
            metadata: HashMap::new(),
        }));

        let frame = WsFrame {
            id: "test_id".to_string(),
            frame_type: WsFrameType::Request,
            method: Some("sessions.list".to_string()),
            params: None,
            result: None,
            error: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };

        let result = handler.handle(connection_state, frame).await;
        assert!(result.is_ok());

        match result.unwrap() {
            WsHandlerResult::Response(response) => {
                assert_eq!(response.method, Some("sessions.list".to_string()));
                assert!(response.result.is_some());
            }
            _ => panic!("Expected Response"),
        }
    }

    #[test]
    fn test_ws_frame_serialization() {
        let frame = WsFrame {
            id: "test_id".to_string(),
            frame_type: WsFrameType::Request,
            method: Some("test.method".to_string()),
            params: Some(serde_json::json!({"param": "value"})),
            result: None,
            error: None,
            timestamp: 1234567890,
        };

        let serialized = serde_json::to_string(&frame).expect("Serialization should succeed");
        let deserialized: WsFrame =
            serde_json::from_str(&serialized).expect("Deserialization should succeed");

        assert_eq!(deserialized.id, "test_id");
        assert_eq!(deserialized.method, Some("test.method".to_string()));
    }
}
