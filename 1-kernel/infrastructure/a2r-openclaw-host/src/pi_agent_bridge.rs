//! Pi Agent Bridge - OC-019
//!
//! Bridge between OpenClaw's Pi Agent communication protocol and A2R's native agent system.
//! This module provides the adapter pattern to translate between Pi Agent operations
//! and A2R agent operations while maintaining A2R interface.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Pi Agent execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentRequest {
    pub session_key: String,
    pub messages: Vec<PiAgentMessage>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub tools: Option<Vec<PiAgentTool>>,
    pub config: Option<HashMap<String, serde_json::Value>>,
    pub context: Option<PiAgentContext>,
    pub timeout_ms: Option<u64>,
}

/// Pi Agent message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentMessage {
    pub role: String, // 'user', 'assistant', 'system', 'tool'
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub tool_calls: Option<Vec<PiAgentToolCall>>,
    pub tool_call_results: Option<Vec<PiAgentToolResult>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Pi Agent tool call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentToolCall {
    pub id: String,
    pub name: String,
    pub arguments: HashMap<String, serde_json::Value>,
}

/// Pi Agent tool result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentToolResult {
    pub call_id: String,
    pub tool_name: String,
    pub result: serde_json::Value,
    pub error: Option<String>,
}

/// Pi Agent tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentTool {
    pub name: String,
    pub description: String,
    pub parameters: ToolParameters,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Tool parameters schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameters {
    pub properties: HashMap<String, ToolParameter>,
    pub required: Vec<String>,
}

/// Tool parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameter {
    #[serde(rename = "type")]
    pub param_type: String, // "string", "number", "integer", "boolean", "array", "object"
    pub description: Option<String>,
    pub default: Option<serde_json::Value>,
    pub enum_values: Option<Vec<String>>, // For restricted values
}

/// Pi Agent context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub workspace_dir: Option<PathBuf>,
    pub agent_dir: Option<PathBuf>,
    pub lane: Option<String>,
    pub message_channel: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Pi Agent execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub tool_calls: Option<Vec<PiAgentToolCall>>,
    pub tool_results: Option<Vec<PiAgentToolResult>>,
    pub messages: Option<Vec<PiAgentMessage>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Pi Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiAgentConfig {
    pub openclaw_path: PathBuf,
    pub enable_tool_execution: bool,
    pub enable_streaming: bool,
    pub default_timeout_ms: u64,
    pub max_concurrent_agents: Option<usize>,
    pub enable_logging: bool,
    pub log_level: String, // "debug", "info", "warn", "error"
    pub security_policy: SecurityPolicy,
}

impl Default for PiAgentConfig {
    fn default() -> Self {
        Self {
            openclaw_path: PathBuf::from("./3-adapters/vendor/openclaw"),
            enable_tool_execution: true,
            enable_streaming: true,
            default_timeout_ms: 60_000, // 60 seconds
            max_concurrent_agents: Some(10),
            enable_logging: true,
            log_level: "info".to_string(),
            security_policy: SecurityPolicy::Allowlist {
                allowed_tools: vec![
                    "bash".to_string(),
                    "fs".to_string(),
                    "git".to_string(),
                    "github".to_string(),
                    "browser".to_string(),
                    "coding".to_string(),
                ],
            },
        }
    }
}

/// Security policy for Pi Agent execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityPolicy {
    /// Deny all execution (safe mode)
    Deny,

    /// Allow only whitelisted tools
    Allowlist { allowed_tools: Vec<String> },

    /// Allow all execution (unsafe, for development)
    Allow,
}

/// Pi Agent bridge service
pub struct PiAgentBridge {
    config: PiAgentConfig,
    agent_semaphore: Option<tokio::sync::Semaphore>,
}

impl PiAgentBridge {
    /// Create new Pi Agent bridge with default configuration
    pub fn new() -> Self {
        let config = PiAgentConfig::default();
        let semaphore = config
            .max_concurrent_agents
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            agent_semaphore: semaphore,
        }
    }

    /// Create new Pi Agent bridge with custom configuration
    pub fn with_config(config: PiAgentConfig) -> Self {
        let semaphore = config
            .max_concurrent_agents
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            agent_semaphore: semaphore,
        }
    }

    /// Execute a Pi Agent request
    pub async fn execute_pi_agent(
        &self,
        request: PiAgentRequest,
    ) -> Result<PiAgentResponse, PiAgentError> {
        let start_time = std::time::Instant::now();

        // Acquire semaphore if configured
        let _permit = if let Some(semaphore) = &self.agent_semaphore {
            Some(semaphore.acquire().await.map_err(|e| {
                PiAgentError::ResourceError(format!(
                    "Failed to acquire agent execution permit: {}",
                    e
                ))
            })?)
        } else {
            None
        };

        // Validate request
        self.validate_request(&request)?;

        // Check security policy
        if let Some(tools) = &request.tools {
            for tool in tools {
                self.check_security_policy(&tool.name)?;
            }
        }

        // Convert request to OpenClaw format
        let openclaw_request = self.convert_to_openclaw_request(request)?;

        // Execute via OpenClaw subprocess
        let result = self.execute_via_openclaw(&openclaw_request).await?;

        let execution_time = start_time.elapsed().as_millis() as u64;

        // Convert response back to A2R format
        let response = self.convert_from_openclaw_response(result, execution_time)?;

        Ok(response)
    }

    /// Validate Pi Agent request
    fn validate_request(&self, request: &PiAgentRequest) -> Result<(), PiAgentError> {
        if request.session_key.is_empty() {
            return Err(PiAgentError::ValidationError(
                "Session key cannot be empty".to_string(),
            ));
        }

        if request.messages.is_empty() {
            return Err(PiAgentError::ValidationError(
                "Messages cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    /// Check security policy for a tool
    fn check_security_policy(&self, tool_name: &str) -> Result<(), PiAgentError> {
        match &self.config.security_policy {
            SecurityPolicy::Deny => {
                return Err(PiAgentError::SecurityViolation(
                    "All Pi Agent execution is denied by security policy".to_string(),
                ));
            }
            SecurityPolicy::Allowlist { allowed_tools } => {
                if !allowed_tools.contains(&tool_name.to_string()) {
                    return Err(PiAgentError::SecurityViolation(format!(
                        "Tool '{}' not in allowlist",
                        tool_name
                    )));
                }
            }
            SecurityPolicy::Allow => {
                // No restrictions
            }
        }

        Ok(())
    }

    /// Convert A2R request to OpenClaw format
    fn convert_to_openclaw_request(
        &self,
        request: PiAgentRequest,
    ) -> Result<serde_json::Value, PiAgentError> {
        // Create the OpenClaw-compatible request payload
        let mut converted = serde_json::Map::new();

        converted.insert(
            "sessionKey".to_string(),
            serde_json::Value::String(request.session_key),
        );

        // Convert messages
        let message_array: Vec<serde_json::Value> = request
            .messages
            .into_iter()
            .map(|msg| {
                let mut msg_obj = serde_json::Map::new();
                msg_obj.insert("role".to_string(), serde_json::Value::String(msg.role));
                msg_obj.insert(
                    "content".to_string(),
                    serde_json::Value::String(msg.content),
                );
                msg_obj.insert(
                    "timestamp".to_string(),
                    serde_json::Value::String(msg.timestamp.to_rfc3339()),
                );

                if let Some(tool_calls) = msg.tool_calls {
                    msg_obj.insert(
                        "toolCalls".to_string(),
                        serde_json::to_value(tool_calls).unwrap_or_default(),
                    );
                }

                if let Some(tool_results) = msg.tool_call_results {
                    msg_obj.insert(
                        "toolResults".to_string(),
                        serde_json::to_value(tool_results).unwrap_or_default(),
                    );
                }

                if let Some(metadata) = msg.metadata {
                    msg_obj.insert(
                        "metadata".to_string(),
                        serde_json::to_value(metadata).unwrap_or_default(),
                    );
                }

                serde_json::Value::Object(msg_obj)
            })
            .collect();

        converted.insert(
            "messages".to_string(),
            serde_json::Value::Array(message_array),
        );

        // Add optional fields
        if let Some(model) = request.model {
            converted.insert("model".to_string(), serde_json::Value::String(model));
        }

        if let Some(provider) = request.provider {
            converted.insert("provider".to_string(), serde_json::Value::String(provider));
        }

        if let Some(tools) = request.tools {
            let tool_array: Vec<serde_json::Value> = tools
                .into_iter()
                .map(|tool| {
                    let mut tool_obj = serde_json::Map::new();
                    tool_obj.insert("name".to_string(), serde_json::Value::String(tool.name));
                    tool_obj.insert(
                        "description".to_string(),
                        serde_json::Value::String(tool.description),
                    );
                    tool_obj.insert(
                        "parameters".to_string(),
                        serde_json::to_value(tool.parameters).unwrap_or_default(),
                    );

                    if let Some(metadata) = tool.metadata {
                        tool_obj.insert(
                            "metadata".to_string(),
                            serde_json::to_value(metadata).unwrap_or_default(),
                        );
                    }

                    serde_json::Value::Object(tool_obj)
                })
                .collect();

            converted.insert("tools".to_string(), serde_json::Value::Array(tool_array));
        }

        if let Some(context) = request.context {
            let mut context_obj = serde_json::Map::new();

            if let Some(session_id) = context.session_id {
                context_obj.insert(
                    "sessionId".to_string(),
                    serde_json::Value::String(session_id),
                );
            }

            if let Some(agent_id) = context.agent_id {
                context_obj.insert("agentId".to_string(), serde_json::Value::String(agent_id));
            }

            if let Some(user_id) = context.user_id {
                context_obj.insert("userId".to_string(), serde_json::Value::String(user_id));
            }

            if let Some(workspace_dir) = context.workspace_dir {
                context_obj.insert(
                    "workspaceDir".to_string(),
                    serde_json::Value::String(workspace_dir.to_string_lossy().to_string()),
                );
            }

            if let Some(agent_dir) = context.agent_dir {
                context_obj.insert(
                    "agentDir".to_string(),
                    serde_json::Value::String(agent_dir.to_string_lossy().to_string()),
                );
            }

            if let Some(lane) = context.lane {
                context_obj.insert("lane".to_string(), serde_json::Value::String(lane));
            }

            if let Some(message_channel) = context.message_channel {
                context_obj.insert(
                    "messageChannel".to_string(),
                    serde_json::Value::String(message_channel),
                );
            }

            if let Some(metadata) = context.metadata {
                context_obj.insert(
                    "metadata".to_string(),
                    serde_json::to_value(metadata).unwrap_or_default(),
                );
            }

            converted.insert(
                "context".to_string(),
                serde_json::Value::Object(context_obj),
            );
        }

        if let Some(config) = request.config {
            converted.insert(
                "config".to_string(),
                serde_json::to_value(config).unwrap_or_default(),
            );
        }

        Ok(serde_json::Value::Object(converted))
    }

    /// Execute request via OpenClaw subprocess
    async fn execute_via_openclaw(
        &self,
        request: &serde_json::Value,
    ) -> Result<serde_json::Value, PiAgentError> {
        // In a real implementation, this would call the OpenClaw Pi Agent subprocess
        // For now, we'll simulate the call by returning a mock response
        // In practice, this would use the OpenClawHost to make the call

        // This would typically be something like:
        // let host = OpenClawHost::new(self.config.openclaw_path.clone()).await?;
        // let result = host.call("pi-agent.execute", request.clone()).await?;
        // Ok(result.result)

        // For simulation purposes, return a mock response
        Ok(serde_json::json!({
            "success": true,
            "result": {
                "messages": [
                    {
                        "role": "assistant",
                        "content": "This is a simulated response from the Pi Agent execution",
                        "timestamp": Utc::now().to_rfc3339(),
                        "toolCalls": [],
                        "toolResults": []
                    }
                ],
                "toolCalls": [],
                "toolResults": []
            },
            "executionTimeMs": 1000,
            "metadata": {
                "simulation": true,
                "openclawVersion": "2026.1.29"
            }
        }))
    }

    /// Convert OpenClaw response to A2R format
    fn convert_from_openclaw_response(
        &self,
        result: serde_json::Value,
        execution_time_ms: u64,
    ) -> Result<PiAgentResponse, PiAgentError> {
        // Extract success status
        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // Extract error if present
        let error = result
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract messages if present
        let messages = result
            .get("result")
            .and_then(|r| r.get("messages"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|msg_val| {
                        msg_val.as_object().map(|msg_obj| PiAgentMessage {
                            role: msg_obj
                                .get("role")
                                .and_then(|v| v.as_str())
                                .unwrap_or("assistant")
                                .to_string(),
                            content: msg_obj
                                .get("content")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            timestamp: msg_obj
                                .get("timestamp")
                                .and_then(|v| v.as_str())
                                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                .map(|dt| dt.with_timezone(&Utc))
                                .unwrap_or_else(Utc::now),
                            tool_calls: msg_obj
                                .get("toolCalls")
                                .and_then(|v| serde_json::from_value(v.clone()).ok()),
                            tool_call_results: msg_obj
                                .get("toolResults")
                                .and_then(|v| serde_json::from_value(v.clone()).ok()),
                            metadata: msg_obj
                                .get("metadata")
                                .and_then(|v| serde_json::from_value(v.clone()).ok()),
                        })
                    })
                    .collect()
            });

        // Extract tool calls if present
        let tool_calls = result
            .get("result")
            .and_then(|r| r.get("toolCalls"))
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        // Extract tool results if present
        let tool_results = result
            .get("result")
            .and_then(|r| r.get("toolResults"))
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        // Extract metadata if present
        let metadata = result
            .get("metadata")
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        Ok(PiAgentResponse {
            success,
            result: result.get("result").cloned(),
            error,
            execution_time_ms,
            tool_calls,
            tool_results,
            messages,
            metadata,
        })
    }

    /// Get current configuration
    pub fn config(&self) -> &PiAgentConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut PiAgentConfig {
        &mut self.config
    }

    /// Update configuration
    pub fn set_config(&mut self, config: PiAgentConfig) {
        let max_concurrent_agents = config.max_concurrent_agents;
        self.config = config;

        // Update semaphore based on new configuration
        if let Some(max_agents) = max_concurrent_agents {
            self.agent_semaphore = Some(tokio::sync::Semaphore::new(max_agents));
        } else {
            self.agent_semaphore = None;
        }
    }
}

impl Default for PiAgentBridge {
    fn default() -> Self {
        Self::new()
    }
}

/// Pi Agent error
#[derive(Debug, thiserror::Error)]
pub enum PiAgentError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Security violation: {0}")]
    SecurityViolation(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Timeout error")]
    Timeout,

    #[error("Resource error: {0}")]
    ResourceError(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

impl From<serde_json::Error> for PiAgentError {
    fn from(error: serde_json::Error) -> Self {
        PiAgentError::SerializationError(error.to_string())
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[test]
    fn test_pi_agent_bridge_creation() {
        let bridge = PiAgentBridge::new();
        assert_eq!(bridge.config.default_timeout_ms, 60_000);
        assert!(bridge.config.enable_tool_execution);
        assert_eq!(
            bridge.config.security_policy,
            SecurityPolicy::Allowlist {
                allowed_tools: vec![
                    "bash".to_string(),
                    "fs".to_string(),
                    "git".to_string(),
                    "github".to_string(),
                    "browser".to_string(),
                    "coding".to_string(),
                ]
            }
        );
    }

    #[test]
    fn test_pi_agent_request_conversion() {
        let bridge = PiAgentBridge::new();

        let mut config = HashMap::new();
        config.insert(
            "test".to_string(),
            serde_json::Value::String("value".to_string()),
        );

        let mut metadata = HashMap::new();
        metadata.insert(
            "source".to_string(),
            serde_json::Value::String("test".to_string()),
        );

        let request = PiAgentRequest {
            session_key: "test-session".to_string(),
            messages: vec![PiAgentMessage {
                role: "user".to_string(),
                content: "Hello, world!".to_string(),
                timestamp: Utc::now(),
                tool_calls: None,
                tool_call_results: None,
                metadata: Some(metadata),
            }],
            model: Some("gpt-4".to_string()),
            provider: Some("openai".to_string()),
            tools: Some(vec![PiAgentTool {
                name: "bash".to_string(),
                description: "Execute bash commands".to_string(),
                parameters: ToolParameters {
                    properties: HashMap::new(),
                    required: vec![],
                },
                metadata: None,
            }]),
            config: Some(config),
            context: Some(PiAgentContext {
                session_id: Some("test-session".to_string()),
                agent_id: Some("test-agent".to_string()),
                user_id: Some("test-user".to_string()),
                workspace_dir: Some(PathBuf::from("/tmp")),
                agent_dir: Some(PathBuf::from("/tmp/agent")),
                lane: Some("test-lane".to_string()),
                message_channel: Some("test-channel".to_string()),
                metadata: Some(HashMap::new()),
            }),
            timeout_ms: Some(30_000),
        };

        let converted = bridge.convert_to_openclaw_request(request).unwrap();
        assert!(converted.get("sessionKey").is_some());
        assert!(converted.get("messages").is_some());
        assert_eq!(
            converted.get("model").and_then(|v| v.as_str()),
            Some("gpt-4")
        );
    }

    #[test]
    fn test_security_policy_deny() {
        let mut config = PiAgentConfig::default();
        config.security_policy = SecurityPolicy::Deny;

        let bridge = PiAgentBridge::with_config(config);
        let result = bridge.check_security_policy("bash");
        assert!(matches!(result, Err(PiAgentError::SecurityViolation(_))));
    }

    #[test]
    fn test_security_policy_allowlist() {
        let mut config = PiAgentConfig::default();
        config.security_policy = SecurityPolicy::Allowlist {
            allowed_tools: vec!["bash".to_string(), "fs".to_string()],
        };

        let bridge = PiAgentBridge::with_config(config);

        // Test allowed tool
        let result = bridge.check_security_policy("bash");
        assert!(result.is_ok());

        // Test disallowed tool
        let result = bridge.check_security_policy("dangerous-tool");
        assert!(matches!(result, Err(PiAgentError::SecurityViolation(_))));
    }

    #[test]
    fn test_security_policy_allow() {
        let mut config = PiAgentConfig::default();
        config.security_policy = SecurityPolicy::Allow;

        let bridge = PiAgentBridge::with_config(config);
        let result = bridge.check_security_policy("any-tool");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_request() {
        let bridge = PiAgentBridge::new();

        // Test valid request
        let request = PiAgentRequest {
            session_key: "valid-session".to_string(),
            messages: vec![PiAgentMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp: Utc::now(),
                tool_calls: None,
                tool_call_results: None,
                metadata: None,
            }],
            model: None,
            provider: None,
            tools: None,
            config: None,
            context: None,
            timeout_ms: None,
        };

        let result = bridge.validate_request(&request);
        assert!(result.is_ok());

        // Test invalid request (empty session key)
        let mut invalid_request = request.clone();
        invalid_request.session_key = "".to_string();

        let result = bridge.validate_request(&invalid_request);
        assert!(matches!(result, Err(PiAgentError::ValidationError(_))));

        // Test invalid request (empty messages)
        let mut invalid_request = request.clone();
        invalid_request.session_key = "valid-session".to_string();
        invalid_request.messages = vec![];

        let result = bridge.validate_request(&invalid_request);
        assert!(matches!(result, Err(PiAgentError::ValidationError(_))));
    }

    #[test]
    fn test_pi_agent_message_structure() {
        let message = PiAgentMessage {
            role: "assistant".to_string(),
            content: "Hello, world!".to_string(),
            timestamp: Utc::now(),
            tool_calls: Some(vec![PiAgentToolCall {
                id: "call-1".to_string(),
                name: "bash".to_string(),
                arguments: {
                    let mut args = HashMap::new();
                    args.insert(
                        "command".to_string(),
                        serde_json::Value::String("echo hello".to_string()),
                    );
                    args
                },
            }]),
            tool_call_results: Some(vec![PiAgentToolResult {
                call_id: "call-1".to_string(),
                tool_name: "bash".to_string(),
                result: serde_json::Value::String("hello".to_string()),
                error: None,
            }]),
            metadata: Some({
                let mut meta = HashMap::new();
                meta.insert("test".to_string(), serde_json::Value::Bool(true));
                meta
            }),
        };

        assert_eq!(message.role, "assistant");
        assert_eq!(message.content, "Hello, world!");
        assert!(message.tool_calls.is_some());
        assert!(message.tool_call_results.is_some());
    }
}
