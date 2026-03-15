//! Gateway Bridge - OC-009
//!
//! Bridge between OpenClaw's gateway and A2R's native gateway.
//! Implements the adapter pattern to translate between OpenClaw gateway operations
//! and A2R gateway operations while maintaining A2R interface.

use crate::{HostError, OpenClawHost};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Request to check gateway health
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckRequest {}

/// Response from health check request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub healthy: bool,
    pub status: String,
    pub uptime: Option<String>,
    pub version: Option<String>,
}

/// Request to get gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigRequest {}

/// Response from get config request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigResponse {
    pub config: std::collections::HashMap<String, serde_json::Value>,
    pub success: bool,
}

/// Request to update gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfigRequest {
    pub config_updates: std::collections::HashMap<String, serde_json::Value>,
}

/// Response from update config request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfigResponse {
    pub success: bool,
    pub error: Option<String>,
}

/// Request to send a message through the gateway
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub channel: String,
    pub recipient: String,
    pub content: String,
    pub attachments: Option<Vec<String>>,
}

/// Response from send message request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageResponse {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

/// Request to receive messages from the gateway
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiveMessageRequest {
    pub channel: String,
    pub timeout_ms: Option<u64>,
}

/// Response from receive message request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiveMessageResponse {
    pub messages: Vec<ReceivedMessage>,
    pub success: bool,
}

/// Received message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceivedMessage {
    pub id: String,
    pub channel: String,
    pub sender: String,
    pub content: String,
    pub timestamp: String,
    pub attachments: Option<Vec<String>>,
    pub metadata: Option<std::collections::HashMap<String, String>>,
}

/// Request to establish a WebSocket connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketConnectRequest {
    pub client_id: String,
    pub session_token: Option<String>,
}

/// Response from WebSocket connect request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketConnectResponse {
    pub success: bool,
    pub connection_id: Option<String>,
    pub error: Option<String>,
}

/// Gateway bridge
pub struct GatewayBridge {
    host: Arc<Mutex<OpenClawHost>>,
}

impl GatewayBridge {
    /// Create new gateway bridge
    pub fn new(host: Arc<Mutex<OpenClawHost>>) -> Self {
        Self { host }
    }

    /// Check gateway health
    pub async fn health_check(&mut self) -> Result<HealthCheckResponse, HostError> {
        let params = serde_json::json!({});
        let call_result = {
            let mut host = self.host.lock().await;
            host.call("gateway.health", params).await?
        };
        let result = &call_result.result;

        let healthy = result
            .get("healthy")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let status = result
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let uptime = result
            .get("uptime")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let version = result
            .get("version")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(HealthCheckResponse {
            healthy,
            status,
            uptime,
            version,
        })
    }

    /// Get gateway configuration
    pub async fn get_config(&mut self) -> Result<GetConfigResponse, HostError> {
        let params = serde_json::json!({});
        let call_result = {
            let mut host = self.host.lock().await;
            host.call("gateway.config.get", params).await?
        };
        let result = &call_result.result;

        let config = result
            .get("config")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(GetConfigResponse { config, success })
    }

    /// Update gateway configuration
    pub async fn update_config(
        &mut self,
        request: UpdateConfigRequest,
    ) -> Result<UpdateConfigResponse, HostError> {
        let params = serde_json::json!({
            "updates": request.config_updates
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("gateway.config.update", params).await?
        };
        let result = &call_result.result;

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let error = result
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(UpdateConfigResponse { success, error })
    }

    /// Send a message through the gateway
    pub async fn send_message(
        &mut self,
        request: SendMessageRequest,
    ) -> Result<SendMessageResponse, HostError> {
        let params = serde_json::json!({
            "channel": request.channel,
            "recipient": request.recipient,
            "content": request.content,
            "attachments": request.attachments,
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("gateway.message.send", params).await?
        };
        let result = &call_result.result;

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let message_id = result
            .get("messageId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let error = result
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(SendMessageResponse {
            success,
            message_id,
            error,
        })
    }

    /// Receive messages from the gateway
    pub async fn receive_messages(
        &mut self,
        request: ReceiveMessageRequest,
    ) -> Result<ReceiveMessageResponse, HostError> {
        let params = serde_json::json!({
            "channel": request.channel,
            "timeoutMs": request.timeout_ms,
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("gateway.message.receive", params).await?
        };
        let result = &call_result.result;

        let messages = if let Some(msg_array) = result.get("messages").and_then(|v| v.as_array()) {
            msg_array
                .iter()
                .filter_map(|msg| {
                    Some(ReceivedMessage {
                        id: msg.get("id")?.as_str()?.to_string(),
                        channel: msg.get("channel")?.as_str()?.to_string(),
                        sender: msg.get("sender")?.as_str()?.to_string(),
                        content: msg.get("content")?.as_str()?.to_string(),
                        timestamp: msg.get("timestamp")?.as_str()?.to_string(),
                        attachments: msg
                            .get("attachments")
                            .and_then(|v| serde_json::from_value(v.clone()).ok()),
                        metadata: msg
                            .get("metadata")
                            .and_then(|v| serde_json::from_value(v.clone()).ok()),
                    })
                })
                .collect()
        } else {
            vec![]
        };

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(ReceiveMessageResponse { messages, success })
    }

    /// Establish a WebSocket connection
    pub async fn websocket_connect(
        &mut self,
        request: WebSocketConnectRequest,
    ) -> Result<WebSocketConnectResponse, HostError> {
        let params = serde_json::json!({
            "clientId": request.client_id,
            "sessionToken": request.session_token,
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("gateway.ws.connect", params).await?
        };
        let result = &call_result.result;

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let connection_id = result
            .get("connectionId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let error = result
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(WebSocketConnectResponse {
            success,
            connection_id,
            error,
        })
    }

    /// Get the underlying host
    pub fn host(&self) -> Arc<Mutex<OpenClawHost>> {
        Arc::clone(&self.host)
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[test]
    fn test_gateway_structures() {
        // Test that our structures compile and have expected fields
        let health_resp = HealthCheckResponse {
            healthy: true,
            status: "operational".to_string(),
            uptime: Some("24h".to_string()),
            version: Some("1.0.0".to_string()),
        };

        assert!(health_resp.healthy);

        let msg_req = SendMessageRequest {
            channel: "test-channel".to_string(),
            recipient: "user123".to_string(),
            content: "Hello world".to_string(),
            attachments: None,
        };

        assert_eq!(msg_req.channel, "test-channel");
    }
}
