//! Runtime Events
//!
//! Events that drive state transitions and flow through the system.

use serde::{Deserialize, Serialize};

/// Tool call from provider
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Tool execution result
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub result: serde_json::Value,
    pub error: Option<String>,
    pub execution_time_ms: Option<u64>,
}

/// Events that can trigger state transitions
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeEvent {
    /// Start the session (Idle → Initializing)
    Start,

    /// Session initialized with provider (Initializing → Ready)
    SessionInitialized,

    /// User submitted a prompt (Ready → AwaitingModel)
    PromptSubmitted { prompt: String },

    /// Provider sent a content delta (AwaitingModel → Streaming, or Streaming)
    ProviderDelta { content: String },

    /// Provider requested a tool call (AwaitingModel/Streaming → AwaitingToolExecution)
    ProviderToolCall { tool_call: ToolCall },

    /// Provider finished (Streaming → Completed)
    ProviderDone { reason: FinishReason },

    /// Tool execution started (AwaitingToolExecution → ExecutingTool)
    ToolExecutionStarted { tool_call_id: String },

    /// Tool result sent to provider (ExecutingTool → AwaitingModel/Completed)
    ToolResultSent { result: ToolResult },

    /// Provider error (Any → Failed)
    ProviderError { code: String, message: String },

    /// Timeout (Any → Failed)
    Timeout,
}

impl RuntimeEvent {
    /// Get event name for debugging
    pub fn name(&self) -> &'static str {
        match self {
            RuntimeEvent::Start => "Start",
            RuntimeEvent::SessionInitialized => "SessionInitialized",
            RuntimeEvent::PromptSubmitted { .. } => "PromptSubmitted",
            RuntimeEvent::ProviderDelta { .. } => "ProviderDelta",
            RuntimeEvent::ProviderToolCall { .. } => "ProviderToolCall",
            RuntimeEvent::ProviderDone { .. } => "ProviderDone",
            RuntimeEvent::ToolExecutionStarted { .. } => "ToolExecutionStarted",
            RuntimeEvent::ToolResultSent { .. } => "ToolResultSent",
            RuntimeEvent::ProviderError { .. } => "ProviderError",
            RuntimeEvent::Timeout => "Timeout",
        }
    }
}

/// Reasons for finishing a session
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    /// Natural completion
    Stop,
    /// Length limit reached
    Length,
    /// Content filtered
    ContentFilter,
    /// Tool calls completed
    ToolCalls,
    /// Error
    Error,
}

/// Error when an invalid state transition is attempted
#[derive(Debug, Clone, thiserror::Error, PartialEq, Eq, Serialize, Deserialize)]
#[error("Invalid transition from {from} on event {event}")]
pub struct InvalidTransition {
    pub from: String,
    pub event: String,
}

/// Items that can be streamed from a provider
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderStreamItem {
    /// Content delta
    Delta(String),
    /// Tool call request
    ToolCall(ToolCall),
    /// Stream complete
    Done(FinishReason),
    /// Error
    Error(ProviderError),
}

/// Provider-side errors
#[derive(Debug, Clone, thiserror::Error, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Rate limited")]
    RateLimited,

    #[error("Provider error: {code} - {message}")]
    Provider { code: String, message: String },

    #[error("Stream error: {0}")]
    Stream(String),
}

/// Normalized events emitted by the runtime
/// These are provider-agnostic and suitable for UI consumption
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NormalizedEvent {
    /// Session lifecycle
    SessionStarted {
        session_id: String,
        tenant_id: String,
    },
    SessionReady {
        session_id: String,
        tenant_id: String,
    },
    SessionError {
        session_id: String,
        tenant_id: String,
        error: String,
    },
    SessionEnded {
        session_id: String,
        tenant_id: String,
        reason: String,
    },

    /// Invocation lifecycle
    InvocationStarted {
        invocation_id: String,
        prompt: String,
    },
    InvocationCompleted {
        invocation_id: String,
        result: String,
    },
    InvocationFailed {
        invocation_id: String,
        error: String,
    },

    /// Content streaming
    ContentDelta {
        invocation_id: String,
        delta: String,
    },

    /// Tool lifecycle
    ToolCallStart {
        invocation_id: String,
        call_id: String,
        name: String,
        args: serde_json::Value,
    },
    ToolCallExecuting {
        invocation_id: String,
        call_id: String,
    },
    ToolCallCompleted {
        invocation_id: String,
        call_id: String,
        result: serde_json::Value,
    },
    ToolCallFailed {
        invocation_id: String,
        call_id: String,
        error: String,
    },

    /// Metadata
    Usage {
        invocation_id: String,
        prompt_tokens: u32,
        completion_tokens: u32,
    },
    ModelInfo {
        invocation_id: String,
        model: String,
        provider: String,
    },
}
