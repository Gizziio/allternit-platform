//! A2rchitech Runtime Interface
//!
//! Core abstraction for brain runtimes. Alternate harnesses can implement
//! BrainRuntime to plug into the system without adopting the kernel wiring.
//!
//! Architecture:
//! - ACP driver is one BrainRuntime implementation
//! - Provider adapters are used to build other runtimes
//! - Kernel-service calls BrainRuntime via 1-kernel libs

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use thiserror::Error;
use tokio::sync::mpsc;
use uuid::Uuid;

// Runtime brain modules
pub mod acp;
pub mod changeset;
pub mod events;
pub mod session;
pub mod streaming;
pub mod supervision;
pub mod tool_loop;

pub mod provider;

// Re-export changeset types
pub use changeset::{ChangeSet, ChangeSetId, Plan, PlanId, PlanStep, PlanStepType, ExecutionMode, Patch, VerificationResult};

// Re-export normalized types from providers
pub use a2rchitech_providers::runtime::{
    FinishReason, NormalizedDelta, NormalizedModelInfo, NormalizedModelsResponse,
    NormalizedResponse, NormalizedToolCall, NormalizedToolResult, NormalizedUsage,
    NormalizedValidateResponse, ProviderError, ProviderErrorKind,
};

/// Runtime errors
#[derive(Debug, Error, Clone, Serialize, Deserialize)]
pub enum RuntimeError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
    #[error("Provider error: {0:?}")]
    Provider(ProviderError),
    #[error("Stream error: {0}")]
    Stream(String),
    #[error("Tool execution error: {0}")]
    ToolExecution(String),
    #[error("Session closed")]
    SessionClosed,
    #[error("Rate limited: retry after {retry_after}s")]
    RateLimited { retry_after: u64 },
    #[error("Authentication required")]
    AuthRequired,
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl RuntimeError {
    pub fn from_provider_error(error: ProviderError) -> Self {
        match error.kind {
            ProviderErrorKind::Auth => RuntimeError::AuthRequired,
            ProviderErrorKind::RateLimit => RuntimeError::RateLimited {
                retry_after: error.retry_after.unwrap_or(60),
            },
            _ => RuntimeError::Provider(error),
        }
    }
}

/// Session source (chat vs terminal)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionSource {
    Chat,
    Terminal,
}

impl std::fmt::Display for SessionSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionSource::Chat => write!(f, "chat"),
            SessionSource::Terminal => write!(f, "terminal"),
        }
    }
}

/// Event mode for session
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventMode {
    Acp,
    Jsonl,
    Terminal,
}

impl std::fmt::Display for EventMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventMode::Acp => write!(f, "acp"),
            EventMode::Jsonl => write!(f, "jsonl"),
            EventMode::Terminal => write!(f, "terminal"),
        }
    }
}

/// Create session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSession {
    /// Session ID (generated if not provided)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Tenant ID
    pub tenant_id: String,
    /// Working directory
    pub cwd: PathBuf,
    /// Session source
    pub source: SessionSource,
    /// Event mode
    pub event_mode: EventMode,
    /// Initial context/warmup text
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warmup: Option<String>,
    /// Provider profile to use
    pub profile_id: String,
    /// Model ID (opaque)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<HashMap<String, serde_json::Value>>,
}

impl CreateSession {
    /// Create a new session request with required fields
    pub fn new(
        tenant_id: String,
        cwd: PathBuf,
        source: SessionSource,
        event_mode: EventMode,
        profile_id: String,
    ) -> Self {
        Self {
            id: None,
            tenant_id,
            cwd,
            source,
            event_mode,
            warmup: None,
            profile_id,
            model_id: None,
            meta: None,
        }
    }

    /// Set explicit session ID
    pub fn with_id(mut self, id: impl Into<String>) -> Self {
        self.id = Some(id.into());
        self
    }

    /// Set model ID
    pub fn with_model(mut self, model_id: impl Into<String>) -> Self {
        self.model_id = Some(model_id.into());
        self
    }

    /// Set warmup text
    pub fn with_warmup(mut self, warmup: impl Into<String>) -> Self {
        self.warmup = Some(warmup.into());
        self
    }

    /// Validate source + event_mode combination
    pub fn validate(&self) -> Result<(), RuntimeError> {
        match (self.source, self.event_mode) {
            (SessionSource::Chat, EventMode::Terminal) => Err(RuntimeError::InvalidConfig(
                "Chat source cannot use terminal event mode".to_string(),
            )),
            (SessionSource::Terminal, EventMode::Acp)
            | (SessionSource::Terminal, EventMode::Jsonl) => Err(RuntimeError::InvalidConfig(
                "Terminal source must use terminal event mode".to_string(),
            )),
            _ => Ok(()),
        }
    }
}

/// Session handle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionHandle {
    /// Session ID
    pub id: String,
    /// Tenant ID
    pub tenant_id: String,
    /// Profile ID
    pub profile_id: String,
    /// Model ID in use
    pub model_id: Option<String>,
    /// Session source
    pub source: SessionSource,
    /// Event mode
    pub event_mode: EventMode,
    /// Created at timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl SessionHandle {
    /// Generate a new session ID
    pub fn generate_id() -> String {
        format!("sess_{}", Uuid::new_v4().simple())
    }
}

/// Prompt request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    /// Prompt ID
    pub id: String,
    /// Message content
    pub content: String,
    /// Whether to use streaming
    #[serde(default)]
    pub stream: bool,
    /// System message override
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    /// Tools available for this prompt
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ToolDefinition>>,
    /// Maximum tokens to generate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    /// Temperature
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

impl Prompt {
    /// Create a new prompt
    pub fn new(content: impl Into<String>) -> Self {
        Self {
            id: format!("prompt_{}", Uuid::new_v4().simple()),
            content: content.into(),
            stream: true,
            system: None,
            tools: None,
            max_tokens: None,
            temperature: None,
        }
    }

    /// Set streaming mode
    pub fn with_stream(mut self, stream: bool) -> Self {
        self.stream = stream;
        self
    }

    /// Set tools
    pub fn with_tools(mut self, tools: Vec<ToolDefinition>) -> Self {
        self.tools = Some(tools);
        self
    }
}

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Tool name
    pub name: String,
    /// Tool description
    pub description: String,
    /// JSON schema for parameters
    pub parameters: serde_json::Value,
}

/// Tool result request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Call ID this result is for
    pub call_id: String,
    /// Result content
    pub content: String,
    /// Whether this is an error
    #[serde(default)]
    pub is_error: bool,
}

/// Stream event from runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    /// Delta event (content/tool/finish)
    Delta(NormalizedDelta),
    /// Tool call requested
    ToolCall { call: NormalizedToolCall },
    /// Response complete
    Complete { usage: Option<NormalizedUsage> },
    /// Error occurred
    Error { error: RuntimeError },
}

/// BrainRuntime trait - core abstraction for all brain runtimes
///
/// Implement this trait to create alternate harnesses that can plug
/// into the A2rchitech system without adopting the UI or kernel wiring.
#[async_trait]
pub trait BrainRuntime: Send + Sync {
    /// Create a new session
    ///
    /// Validates source+event_mode combination and returns a session handle.
    async fn create_session(
        &self,
        tenant_id: String,
        req: CreateSession,
    ) -> Result<SessionHandle, RuntimeError>;

    /// Send a prompt to a session
    ///
    /// For streaming responses, events are returned via the stream callback.
    async fn send_prompt(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        prompt: Prompt,
    ) -> Result<NormalizedResponse, RuntimeError>;

    /// Send a prompt with streaming
    ///
    /// Returns a stream of events. The stream ends with Complete or Error.
    async fn send_prompt_stream(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        prompt: Prompt,
    ) -> Result<mpsc::Receiver<StreamEvent>, RuntimeError>;

    /// Send tool result to a session
    ///
    /// Called after executing a tool requested by the runtime.
    async fn send_tool_result(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        result: ToolResult,
    ) -> Result<(), RuntimeError>;

    /// Close a session
    ///
    /// Releases resources and marks the session as closed.
    async fn close_session(
        &self,
        tenant_id: &str,
        session: SessionHandle,
    ) -> Result<(), RuntimeError>;

    /// Get session status
    async fn session_status(
        &self,
        tenant_id: &str,
        session_id: &str,
    ) -> Result<SessionHandle, RuntimeError>;

    /// List active sessions for a tenant
    async fn list_sessions(&self, tenant_id: &str) -> Result<Vec<SessionHandle>, RuntimeError>;

    // ========================================================================
    // ChangeSet Methods (for diff-first patch management)
    // ========================================================================

    /// Propose a ChangeSet for review
    ///
    /// Returns a ChangeSetId for tracking. The ChangeSet must be approved
    /// before it can be applied.
    async fn propose_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset: ChangeSet,
    ) -> Result<ChangeSetId, RuntimeError> {
        // Default implementation returns error - optional feature
        let _ = (tenant_id, session, changeset);
        Err(RuntimeError::Unknown("propose_changeset not implemented".to_string()))
    }

    /// Apply an approved ChangeSet
    ///
    /// Applies the file changes atomically. Returns error if ChangeSet
    /// was not approved or verification failed.
    async fn apply_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset_id: ChangeSetId,
    ) -> Result<(), RuntimeError> {
        // Default implementation returns error - optional feature
        let _ = (tenant_id, session, changeset_id);
        Err(RuntimeError::Unknown("apply_changeset not implemented".to_string()))
    }

    /// Verify a ChangeSet before applying
    ///
    /// Runs tests, linting, or other verification steps.
    async fn verify_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset_id: ChangeSetId,
    ) -> Result<VerificationResult, RuntimeError> {
        // Default implementation returns success - override for custom verification
        let _ = (tenant_id, session, changeset_id);
        Ok(VerificationResult::success())
    }

    // ========================================================================
    // Plan Methods (for Plan → Execute flow)
    // ========================================================================

    /// Generate an execution plan from a prompt
    ///
    /// Returns a structured plan with steps that can be reviewed before execution.
    async fn generate_plan(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        prompt: Prompt,
    ) -> Result<Plan, RuntimeError> {
        // Default implementation returns error - optional feature
        let _ = (tenant_id, session, prompt);
        Err(RuntimeError::Unknown("generate_plan not implemented".to_string()))
    }

    /// Execute a plan step by step
    ///
    /// Executes the plan one step at a time, allowing for review between steps.
    async fn execute_plan(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        plan_id: PlanId,
    ) -> Result<(), RuntimeError> {
        // Default implementation returns error - optional feature
        let _ = (tenant_id, session, plan_id);
        Err(RuntimeError::Unknown("execute_plan not implemented".to_string()))
    }

    // ========================================================================
    // Mode Management
    // ========================================================================

    /// Set the execution mode
    ///
    /// Controls whether changes require approval (Safe), execute automatically (Auto),
    /// or only generate plans (Plan).
    async fn set_mode(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        mode: ExecutionMode,
    ) -> Result<(), RuntimeError> {
        // Default implementation is a no-op - override for mode-aware runtimes
        let _ = (tenant_id, session, mode);
        Ok(())
    }

    /// Get the current execution mode
    async fn get_mode(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
    ) -> Result<ExecutionMode, RuntimeError> {
        // Default implementation returns Safe
        let _ = (tenant_id, session);
        Ok(ExecutionMode::Safe)
    }
}

/// Runtime capability flags
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RuntimeCapabilities {
    /// Supports streaming responses
    pub streaming: bool,
    /// Supports tool calling
    pub tools: bool,
    /// Supports multi-turn conversations
    pub multi_turn: bool,
    /// Supports system messages
    pub system_messages: bool,
    /// Supports vision/attachments
    pub vision: bool,
    /// Supports model discovery
    pub model_discovery: bool,
}

/// Runtime information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeInfo {
    /// Runtime name
    pub name: String,
    /// Runtime version
    pub version: String,
    /// Capabilities
    pub capabilities: RuntimeCapabilities,
    /// Supported event modes
    pub supported_modes: Vec<EventMode>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_session_builder() {
        let req = CreateSession::new(
            "tenant-1".to_string(),
            PathBuf::from("/tmp"),
            SessionSource::Chat,
            EventMode::Acp,
            "opencode".to_string(),
        )
        .with_model("gpt-4")
        .with_warmup("Hello");

        assert_eq!(req.tenant_id, "tenant-1");
        assert_eq!(req.profile_id, "opencode");
        assert_eq!(req.model_id, Some("gpt-4".to_string()));
        assert_eq!(req.warmup, Some("Hello".to_string()));
    }

    #[test]
    fn test_session_validation() {
        let valid = CreateSession::new(
            "test-tenant".to_string(),
            PathBuf::from("/tmp"),
            SessionSource::Chat,
            EventMode::Acp,
            "test".to_string(),
        );
        assert!(valid.validate().is_ok());

        let invalid = CreateSession::new(
            "test-tenant".to_string(),
            PathBuf::from("/tmp"),
            SessionSource::Chat,
            EventMode::Terminal, // Invalid combination
            "test".to_string(),
        );
        assert!(invalid.validate().is_err());

        let invalid2 = CreateSession::new(
            "test-tenant".to_string(),
            PathBuf::from("/tmp"),
            SessionSource::Terminal,
            EventMode::Acp, // Invalid combination
            "test".to_string(),
        );
        assert!(invalid2.validate().is_err());
    }

    #[test]
    fn test_prompt_builder() {
        let prompt = Prompt::new("Hello")
            .with_stream(true)
            .with_tools(vec![ToolDefinition {
                name: "test".to_string(),
                description: "Test tool".to_string(),
                parameters: serde_json::json!({}),
            }]);

        assert_eq!(prompt.content, "Hello");
        assert!(prompt.stream);
        assert_eq!(prompt.tools.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn test_session_handle_generation() {
        let id1 = SessionHandle::generate_id();
        let id2 = SessionHandle::generate_id();
        assert_ne!(id1, id2);
        assert!(id1.starts_with("sess_"));
    }

    #[test]
    fn test_runtime_error_from_provider() {
        let auth_error = ProviderError::auth("test");
        let runtime_error = RuntimeError::from_provider_error(auth_error);
        assert!(matches!(runtime_error, RuntimeError::AuthRequired));

        let rate_error = ProviderError::rate_limit("test", Some(60));
        let runtime_error = RuntimeError::from_provider_error(rate_error);
        assert!(matches!(
            runtime_error,
            RuntimeError::RateLimited { retry_after: 60 }
        ));
    }
}
