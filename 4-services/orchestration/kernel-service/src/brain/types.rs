use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BrainType {
    Api,
    Cli,
    Local,
}

/// Event mode determines how the brain communicates
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EventMode {
    /// PTY-based terminal app (human UI, not for chat brains)
    Terminal,
    /// ACP protocol (JSON-RPC over pipes) - PRIMARY for CLI brains
    Acp,
    /// JSON Lines protocol (NDJSON events)
    Jsonl,
    /// HTTP API
    Api,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainConfig {
    pub id: String,
    pub tenant_id: Option<String>,
    pub name: String,
    pub brain_type: BrainType,
    pub model: Option<String>,
    pub endpoint: Option<String>,
    pub api_key_env: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    /// How to pass the prompt as a CLI argument:
    /// - Some(flag): Pass as `--flag "prompt"` (e.g., "-p" for Gemini, "--prompt" for Kimi)
    /// - None: Pass as positional argument (e.g., Codex `exec --yolo "prompt"`)
    pub prompt_arg: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub cwd: Option<String>,
    pub requirements: Vec<BrainRequirement>,
    pub sandbox: Option<SandboxConfig>,
    /// Event mode determines the communication protocol
    /// - Terminal: PTY-based (human UI only, NOT for chat brains)
    /// - Acp: ACP protocol (JSON-RPC over pipes) - PRIMARY for chat
    /// - Jsonl: JSON Lines protocol
    /// - Api: HTTP API
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_mode: Option<EventMode>,
    /// Runtime overrides for this session (e.g., model_id, temperature)
    /// Passed to the runtime during prompt/session creation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_overrides: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    pub workspace_only: bool,
    pub network_enabled: bool,
    pub tool_allowlist: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BrainRequirement {
    Binary {
        name: String,
    },
    EnvVar {
        name: String,
    },
    Dependency {
        name: String,
        package_manager: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainSession {
    pub id: String,
    pub brain_id: String,
    pub created_at: i64,
    pub status: SessionStatus,
    pub workspace_dir: String,
    pub profile_id: Option<String>,
    pub plan_id: Option<String>,
    pub conversation_state: Option<serde_json::Value>,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Created,
    Starting,
    Ready,
    Running,
    Paused,
    Exited,
    Terminated,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum BrainEvent {
    // Session Lifecycle
    #[serde(rename = "session.created")]
    SessionCreated {
        session_id: String,
        event_id: Option<String>,
    },
    /// Session started - emitted when runtime begins processing
    /// Contains metadata about the session source and mode
    #[serde(rename = "session.started")]
    SessionStarted {
        session_id: String,
        source: String,
        event_mode: String,
        brain_profile_id: String,
        event_id: Option<String>,
    },
    #[serde(rename = "session.status")]
    SessionStatus {
        status: SessionStatus,
        event_id: Option<String>,
    },

    // Chat Stream
    #[serde(rename = "chat.delta")]
    ChatDelta {
        text: String,
        event_id: Option<String>,
    },
    #[serde(rename = "chat.message.completed")]
    ChatMessageCompleted {
        text: String,
        event_id: Option<String>,
    },

    // Terminal Stream
    #[serde(rename = "terminal.delta")]
    TerminalDelta {
        data: String,
        stream: String,
        event_id: Option<String>,
    }, // stream: "stdout" | "stderr"

    // Tool Stream
    #[serde(rename = "tool.call")]
    ToolCall {
        tool_id: String,
        call_id: String,
        args: String,
        event_id: Option<String>,
    },
    #[serde(rename = "tool.result")]
    ToolResult {
        tool_id: String,
        call_id: String,
        result: String,
        event_id: Option<String>,
    },

    // Artifacts
    #[serde(rename = "artifact.created")]
    ArtifactCreated {
        id: String,
        kind: String,
        content: String,
        event_id: Option<String>,
    },

    // Errors
    #[serde(rename = "error")]
    Error {
        message: String,
        code: Option<String>,
        event_id: Option<String>,
    },

    // Integration Lifecycle Events (for UI checklist feedback)
    #[serde(rename = "integration.profile.registered")]
    IntegrationProfileRegistered {
        profile_id: String,
        event_id: Option<String>,
    },

    #[serde(rename = "integration.pty.initializing")]
    IntegrationPtyInitializing {
        command: String,
        event_id: Option<String>,
    },

    #[serde(rename = "integration.pty.ready")]
    IntegrationPtyReady { pid: u32, event_id: Option<String> },

    #[serde(rename = "integration.dispatcher.connected")]
    IntegrationDispatcherConnected { event_id: Option<String> },

    #[serde(rename = "integration.tools.verified")]
    IntegrationToolsVerified {
        count: usize,
        event_id: Option<String>,
    },

    #[serde(rename = "integration.context.synced")]
    IntegrationContextSynced { event_id: Option<String> },

    #[serde(rename = "integration.complete")]
    IntegrationComplete { event_id: Option<String> },
}

impl BrainEvent {
    pub fn chat_delta(text: &str) -> Self {
        BrainEvent::ChatDelta {
            text: text.to_string(),
            event_id: None,
        }
    }

    pub fn terminal_delta(data: &str) -> Self {
        BrainEvent::TerminalDelta {
            data: data.to_string(),
            stream: "stdout".to_string(),
            event_id: None,
        }
    }

    pub fn with_event_id(mut self, id: String) -> Self {
        match &mut self {
            BrainEvent::SessionCreated { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::SessionStatus { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::ChatDelta { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::ChatMessageCompleted { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::TerminalDelta { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::ToolCall { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::ToolResult { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::ArtifactCreated { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::Error { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::IntegrationProfileRegistered { event_id, .. } => {
                *event_id = Some(id.clone())
            }
            BrainEvent::IntegrationPtyInitializing { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::IntegrationPtyReady { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::IntegrationDispatcherConnected { event_id, .. } => {
                *event_id = Some(id.clone())
            }
            BrainEvent::IntegrationToolsVerified { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::IntegrationContextSynced { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::IntegrationComplete { event_id, .. } => *event_id = Some(id.clone()),
            BrainEvent::SessionStarted { event_id, .. } => *event_id = Some(id.clone()),
        }
        self
    }
}
