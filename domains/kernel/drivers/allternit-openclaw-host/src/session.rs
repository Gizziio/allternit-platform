//! Session Manager Bridge - OC-008
//!
//! Bridge between OpenClaw's session management and A2R's native session management.
//! Implements the adapter pattern to translate between OpenClaw session operations
//! and A2R session operations while maintaining A2R interface.

use crate::{HostError, OpenClawHost};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Request to create a new session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub session_id: String,
    pub metadata: Option<std::collections::HashMap<String, String>>,
}

/// Response from create session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub session_path: String,
    pub success: bool,
}

/// Request to read a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadSessionRequest {
    pub session_id: String,
}

/// Response from read session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadSessionResponse {
    pub session_id: String,
    pub messages: Vec<SessionMessage>,
    pub exists: bool,
}

/// Request to write to a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteSessionRequest {
    pub session_id: String,
    pub message: SessionMessage,
}

/// Response from write session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteSessionResponse {
    pub success: bool,
    pub message_id: Option<String>,
}

/// Request to compact a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactSessionRequest {
    pub session_id: String,
    pub retention_policy: Option<RetentionPolicy>,
}

/// Response from compact session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactSessionResponse {
    pub success: bool,
    pub compacted_size: Option<u64>,
}

/// Session message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub role: String, // 'user', 'assistant', 'system', etc.
    pub content: String,
    pub timestamp: String,
    pub metadata: Option<std::collections::HashMap<String, String>>,
}

/// Retention policy for session compaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub max_age_days: Option<u32>,
    pub max_messages: Option<u32>,
    pub max_tokens: Option<u32>,
    pub preserve_recent: Option<u32>, // Number of recent messages to always preserve
}

/// Session manager bridge
pub struct SessionManagerBridge {
    host: Arc<Mutex<OpenClawHost>>,
}

impl SessionManagerBridge {
    /// Create new session manager bridge
    pub fn new(host: Arc<Mutex<OpenClawHost>>) -> Self {
        Self { host }
    }

    /// Create a new session
    pub async fn create_session(
        &mut self,
        request: CreateSessionRequest,
    ) -> Result<CreateSessionResponse, HostError> {
        // Delegate to OpenClaw subprocess
        let params = serde_json::json!({
            "sessionId": request.session_id,
            "metadata": request.metadata
        });

        let call_result = {
            let mut host = self.host.lock().await;
            host.call("session.create", params).await?
        };
        let result = &call_result.result;

        // Parse response
        let session_id = result
            .get("sessionId")
            .and_then(|v| v.as_str())
            .unwrap_or(&request.session_id)
            .to_string();

        let session_path = result
            .get("sessionPath")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(CreateSessionResponse {
            session_id,
            session_path,
            success,
        })
    }

    /// Read a session
    pub async fn read_session(
        &mut self,
        request: ReadSessionRequest,
    ) -> Result<ReadSessionResponse, HostError> {
        // Delegate to OpenClaw subprocess
        let params = serde_json::json!({
            "sessionId": request.session_id
        });

        let call_result = {
            let mut host = self.host.lock().await;
            host.call("session.read", params).await?
        };
        let result = &call_result.result;

        let exists = result
            .get("exists")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let messages = if let Some(msg_array) = result.get("messages").and_then(|v| v.as_array()) {
            msg_array
                .iter()
                .filter_map(|msg| {
                    Some(SessionMessage {
                        id: msg.get("id")?.as_str()?.to_string(),
                        role: msg.get("role")?.as_str()?.to_string(),
                        content: msg.get("content")?.as_str()?.to_string(),
                        timestamp: msg.get("timestamp")?.as_str()?.to_string(),
                        metadata: msg
                            .get("metadata")
                            .and_then(|m| serde_json::from_value(m.clone()).ok()),
                    })
                })
                .collect()
        } else {
            vec![]
        };

        Ok(ReadSessionResponse {
            session_id: request.session_id,
            messages,
            exists,
        })
    }

    /// Write to a session
    pub async fn write_to_session(
        &mut self,
        request: WriteSessionRequest,
    ) -> Result<WriteSessionResponse, HostError> {
        // Delegate to OpenClaw subprocess
        let params = serde_json::json!({
            "sessionId": request.session_id,
            "message": {
                "id": request.message.id,
                "role": request.message.role,
                "content": request.message.content,
                "timestamp": request.message.timestamp,
                "metadata": request.message.metadata,
            }
        });

        let call_result = {
            let mut host = self.host.lock().await;
            host.call("session.write", params).await?
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

        Ok(WriteSessionResponse {
            success,
            message_id,
        })
    }

    /// Compact a session
    pub async fn compact_session(
        &mut self,
        request: CompactSessionRequest,
    ) -> Result<CompactSessionResponse, HostError> {
        // Delegate to OpenClaw subprocess
        let params = serde_json::json!({
            "sessionId": request.session_id,
            "retentionPolicy": request.retention_policy.map(|policy| {
                serde_json::json!({
                    "maxAgeDays": policy.max_age_days,
                    "maxMessages": policy.max_messages,
                    "maxTokens": policy.max_tokens,
                    "preserveRecent": policy.preserve_recent,
                })
            }).unwrap_or(serde_json::Value::Null)
        });

        let call_result = {
            let mut host = self.host.lock().await;
            host.call("session.compact", params).await?
        };
        let result = &call_result.result;

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let compacted_size = result.get("compactedSize").and_then(|v| v.as_u64());

        Ok(CompactSessionResponse {
            success,
            compacted_size,
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
    fn test_session_structures() {
        // Test that our structures compile and have expected fields
        let message = SessionMessage {
            id: "test-id".to_string(),
            role: "user".to_string(),
            content: "test content".to_string(),
            timestamp: "2023-01-01T00:00:00Z".to_string(),
            metadata: None,
        };

        assert_eq!(message.role, "user");

        let policy = RetentionPolicy {
            max_age_days: Some(30),
            max_messages: Some(100),
            max_tokens: Some(2000),
            preserve_recent: Some(10),
        };

        assert_eq!(policy.max_age_days, Some(30));
    }
}
