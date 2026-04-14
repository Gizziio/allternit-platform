//! ACP (Agent Communication Protocol) client implementation
//!
//! Copied from agent-shell/src/acp.rs - this is the WORKING implementation
//! that actually spawns ACP agents and communicates over stdio.

pub mod client;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// ACP Request
#[derive(Debug, Serialize)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum Request {
    Initialize { params: InitializeParams },
    PromptsList,
    PromptsGet { params: PromptsGetParams },
    ToolsList,
    ToolsCall { params: ToolsCallParams },
    Complete { params: CompleteParams },
    LoggingSetLevel { params: SetLevelParams },
    Cancel { params: CancelParams },
}

#[derive(Debug, Serialize)]
pub struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: ProtocolVersion,
    #[serde(rename = "clientCapabilities")]
    pub capabilities: ClientCapabilities,
    #[serde(rename = "clientInfo")]
    pub client_info: ClientInfo,
}

/// Protocol version - can be either a number (for claude-agent-acp) or string (for MCP-style)
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum ProtocolVersion {
    Number(u16),
    String(String),
}

impl ProtocolVersion {
    /// Get protocol version for a specific agent
    pub fn for_agent(agent_id: &str) -> Self {
        match agent_id {
            // Claude Agent ACP uses protocol version 1
            "claude-code" | "claude-acp" | "claude-agent-acp" => ProtocolVersion::Number(1),
            // Gemini CLI ACP uses protocol version 1
            "gemini-cli" | "gemini-acp" => ProtocolVersion::Number(1),
            // Default to string version for MCP-style agents
            _ => ProtocolVersion::String("2024-11-05".to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ClientCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experimental: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompts: Option<PromptsCapability>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsCapability>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logging: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct PromptsCapability {
    pub list_changed: bool,
}

#[derive(Debug, Serialize)]
pub struct ToolsCapability {
    pub list_changed: bool,
}

#[derive(Debug, Serialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Serialize)]
pub struct PromptsGetParams {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Serialize)]
pub struct ToolsCallParams {
    pub name: String,
    pub arguments: serde_json::Map<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CompleteParams {
    pub ref_: PromptReference,
    pub argument: CompletionArgument,
}

#[derive(Debug, Serialize)]
pub struct PromptReference {
    pub r#type: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct CompletionArgument {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct SetLevelParams {
    pub level: String,
}

#[derive(Debug, Serialize)]
pub struct CancelParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

/// ACP Response
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum Response {
    Success { result: serde_json::Value },
    Error { error: RpcError },
}

#[derive(Debug, Deserialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

/// ACP Notification from server
#[derive(Debug, Deserialize)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum Notification {
    Initialized,
    PromptsListChanged,
    ToolsListChanged,
    ToolCall { params: ToolCallNotification },
    ToolResult { params: ToolResultNotification },
    LoggingMessage,
    Progress,
}

#[derive(Debug, Deserialize)]
pub struct ToolCallNotification {
    pub tool_id: String,
    pub call_id: String,
    pub arguments: String,
}

#[derive(Debug, Deserialize)]
pub struct ToolResultNotification {
    pub call_id: String,
    pub result: String,
}

/// Configuration for ACP agent spawning
/// Copied from agent-shell/src/config.rs AgentConfig
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpAgentConfig {
    /// Unique identifier for this agent
    pub id: String,
    /// Display name
    pub name: String,
    /// Command to execute
    pub command: String,
    /// Command arguments
    #[serde(default)]
    pub args: Vec<String>,
    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Working directory
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

impl AcpAgentConfig {
    /// Default Claude Code configuration (ACP mode)
    /// Requires: npm install -g @zed-industries/claude-agent-acp
    pub fn claude_code() -> Self {
        Self {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            command: "claude-agent-acp".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
        }
    }

    /// Default OpenCode configuration (ACP mode)
    /// Uses: opencode acp subcommand
    pub fn opencode() -> Self {
        Self {
            id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            command: "opencode".to_string(),
            args: vec!["acp".to_string()],
            env: HashMap::new(),
            cwd: None,
        }
    }

    /// Default Gemini CLI configuration (ACP mode)
    /// Uses: gemini --experimental-acp flag
    pub fn gemini_cli() -> Self {
        Self {
            id: "gemini-cli".to_string(),
            name: "Gemini CLI".to_string(),
            command: "gemini".to_string(),
            args: vec!["--experimental-acp".to_string()],
            env: HashMap::new(),
            cwd: None,
        }
    }

    /// Default Kimi CLI configuration (ACP mode if supported)
    pub fn kimi_cli() -> Self {
        Self {
            id: "kimi-cli".to_string(),
            name: "Kimi CLI".to_string(),
            command: "kimi".to_string(),
            args: vec![], // Kimi may not support ACP, needs verification
            env: HashMap::new(),
            cwd: None,
        }
    }

    /// Default Aider configuration (no ACP support, uses direct CLI)
    /// This is a fallback - aider doesn't speak ACP
    pub fn aider() -> Self {
        Self {
            id: "aider".to_string(),
            name: "Aider".to_string(),
            command: "aider".to_string(),
            args: vec!["--yes-always".to_string()], // Auto-confirm
            env: HashMap::new(),
            cwd: None,
        }
    }

    /// Resolve agent config by provider_id
    /// These commands use ACP mode where available
    pub fn resolve(provider_id: &str) -> Option<Self> {
        match provider_id {
            // Claude Code ACP - requires: npm install -g @zed-industries/claude-agent-acp
            "claude" | "claude-code" | "claude-acp" => Some(Self::claude_code()),
            // OpenCode ACP - uses opencode acp subcommand
            "opencode" | "opencode-acp" => Some(Self::opencode()),
            // Gemini CLI ACP - uses --experimental-acp flag
            "gemini" | "gemini-cli" | "gemini-acp" => Some(Self::gemini_cli()),
            // Kimi CLI - may not support ACP
            "kimi" | "kimi-cli" | "kimi-acp" => Some(Self::kimi_cli()),
            // Aider - no ACP support, direct CLI mode
            "aider" => Some(Self::aider()),
            // Qwen Code ACP - requires: npm install -g @qwen-code/qwen-code (binary is 'qwen')
            "qwen-acp" => Some(Self {
                id: "qwen-acp".to_string(),
                name: "Qwen ACP".to_string(),
                command: "qwen".to_string(),
                args: vec!["--acp".to_string()],
                env: HashMap::new(),
                cwd: None,
            }),
            // TODO: Add proper support for these providers
            "together" | "together-acp" => Some(Self {
                id: "together".to_string(),
                name: "Together AI".to_string(),
                command: "echo".to_string(),
                args: vec!["Together AI not yet supported".to_string()],
                env: HashMap::new(),
                cwd: None,
            }),
            "fireworks" | "fireworks-acp" => Some(Self {
                id: "fireworks".to_string(),
                name: "Fireworks AI".to_string(),
                command: "echo".to_string(),
                args: vec!["Fireworks AI not yet supported".to_string()],
                env: HashMap::new(),
                cwd: None,
            }),
            _ => None,
        }
    }
}
