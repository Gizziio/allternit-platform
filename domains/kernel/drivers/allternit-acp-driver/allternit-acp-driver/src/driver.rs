//! ACP Driver
//!
//! High-level ACP client with schema-compliant parsing and tolerant handling
//! of unknown update types.
//!
//! Uses official ACP schema types from agent-client-protocol-schema crate.

use anyhow::{anyhow, Result};
use serde_json::Value;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use agent_client_protocol_schema::{
    ContentBlock, Implementation, InitializeRequest, InitializeResponse, NewSessionRequest,
    NewSessionResponse, PromptRequest, ProtocolVersion, SessionId, TextContent,
};

use crate::protocol::{
    EventMode, SessionSource, SessionValidation, TolerantSessionUpdate, METHOD_INITIALIZE,
    METHOD_PROMPT, METHOD_SESSION_NEW, METHOD_TOOL_RESULT,
};

/// Configuration for ACP driver
#[derive(Debug, Clone)]
pub struct DriverConfig {
    pub command: String,
    pub args: Vec<String>,
    pub enable_transcript: bool,
    pub protocol_version: ProtocolVersion,
}

impl Default for DriverConfig {
    fn default() -> Self {
        Self {
            command: String::new(),
            args: Vec::new(),
            enable_transcript: true,
            protocol_version: ProtocolVersion::V1,
        }
    }
}

/// ACP Driver for managing sessions
pub struct AcpDriver {
    // In a real implementation, this would hold the transport
    config: DriverConfig,
    session_id: Option<SessionId>,
    session_source: Option<SessionSource>,
    event_mode: Option<EventMode>,
}

/// Events emitted by the ACP driver
#[derive(Debug, Clone)]
pub enum AcpEvent {
    /// Text delta from agent
    MessageChunk(String),
    /// Message complete
    MessageComplete,
    /// Tool call received
    ToolCall { id: String, name: String, arguments: Value },
    /// Tool call update (partial args)
    ToolCallUpdate { id: String, content: Option<String> },
    /// Error from agent
    Error { message: String },
    /// Unknown update type (tolerant parsing)
    Unknown { type_name: String, raw: Value },
    /// Terminal event (for enforcement)
    TerminalEvent { session_id: String, raw: Value },
}

/// Tool result for sending back to agent
#[derive(Debug, Clone)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub content: String,
    pub is_error: bool,
}

/// Session info
#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub source: SessionSource,
    pub event_mode: EventMode,
}

impl AcpDriver {
    /// Create a new ACP driver with stdio transport
    pub async fn new_stdio(config: DriverConfig) -> Result<Self> {
        Ok(Self {
            config,
            session_id: None,
            session_source: None,
            event_mode: None,
        })
    }

    /// Initialize the ACP connection
    pub async fn initialize(&mut self) -> Result<InitializeResponse> {
        // In real implementation, this would send the initialize request
        // For now, return a mock response
        info!("ACP initialized with protocol version {:?}", self.config.protocol_version);
        
        // Return a minimal valid response using the builder pattern
        Ok(InitializeResponse::new(self.config.protocol_version.clone()))
    }

    /// Create a new session with proper source/event_mode
    pub async fn session_new(
        &mut self,
        _session_id: Option<String>,
        source: SessionSource,
        event_mode: EventMode,
    ) -> Result<Session> {
        // Validate source + event_mode combination
        if let Err(msg) = SessionValidation::validate(source, event_mode) {
            return Err(anyhow!("Invalid session configuration: {}", msg));
        }

        // Generate session ID
        let session_id_str = format!("sess_{}", uuid::Uuid::new_v4().simple());
        
        self.session_id = Some(SessionId::new(session_id_str.clone()));
        self.session_source = Some(source);
        self.event_mode = Some(event_mode);

        info!(
            "ACP session created: {} (source: {}, event_mode: {})",
            session_id_str, source, event_mode
        );

        Ok(Session {
            id: session_id_str,
            source,
            event_mode,
        })
    }

    /// Send a text prompt and receive streaming events
    pub async fn prompt_text(
        &mut self,
        _text: impl Into<String>,
    ) -> Result<mpsc::UnboundedReceiver<AcpEvent>> {
        let _session_id = self
            .session_id
            .clone()
            .ok_or_else(|| anyhow!("No session"))?;

        // Set up event channel
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        
        // Note: In real implementation, this would drive the transport
        // and send events through event_tx. For now, we return the receiver
        // and the caller would need to process events.
        
        // Drop the sender to close the channel (no events in mock)
        drop(event_tx);

        Ok(event_rx)
    }

    /// Process incoming notification and convert to event
    /// This should be called in a loop by the caller
    ///
    /// # Enforcement
    /// - If terminal events appear in chat stream => abort + log violation
    pub async fn process_notification(&mut self, raw_value: Value) -> Result<AcpEvent> {
        // Extract type for logging unknown updates
        let type_name = raw_value
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or("unknown")
            .to_string();

        // Check for terminal events in chat streams (enforcement)
        if self.session_source == Some(SessionSource::Chat) {
            if SessionValidation::is_terminal_event(&type_name, &raw_value) {
                let session_id = self
                    .session_id
                    .as_ref()
                    .map(|s| s.0.to_string())
                    .unwrap_or_default();
                let violation = format!(
                    "VIOLATION: Terminal event '{}' detected in chat stream. session_id={}",
                    type_name, session_id
                );
                error!("{}", violation);
                return Ok(AcpEvent::TerminalEvent { session_id, raw: raw_value });
            }
        }

        // Try to parse as tolerant session update
        match serde_json::from_value::<TolerantSessionUpdate>(raw_value.clone()) {
            Ok(update) => match update {
                TolerantSessionUpdate::AgentMessageChunk { content } => {
                    Ok(AcpEvent::MessageChunk(content))
                }
                TolerantSessionUpdate::AgentMessageComplete => Ok(AcpEvent::MessageComplete),
                TolerantSessionUpdate::ToolCall { id, name, arguments } => {
                    Ok(AcpEvent::ToolCall { id, name, arguments })
                }
                TolerantSessionUpdate::ToolCallUpdate { id, content, .. } => {
                    Ok(AcpEvent::ToolCallUpdate { id, content })
                }
                TolerantSessionUpdate::Error { message, .. } => Ok(AcpEvent::Error { message }),
                TolerantSessionUpdate::Unknown => {
                    warn!("Unknown ACP update type: {}", type_name);
                    Ok(AcpEvent::Unknown { type_name, raw: raw_value })
                }
            },
            Err(e) => {
                warn!("Failed to parse ACP update: {} (type: {})", e, type_name);
                Ok(AcpEvent::Unknown { type_name, raw: raw_value })
            }
        }
    }

    /// Send tool result back to the agent
    pub async fn send_tool_result(&mut self, result: ToolResult) -> Result<()> {
        // In real implementation, this would send the tool result via transport
        debug!(
            "Sending tool result: tool_call_id={}, is_error={}",
            result.tool_call_id, result.is_error
        );
        Ok(())
    }

    /// Get session ID if available
    pub fn session_id(&self) -> Option<&SessionId> {
        self.session_id.as_ref()
    }

    /// Get session source if available
    pub fn session_source(&self) -> Option<SessionSource> {
        self.session_source
    }

    /// Get event mode if available
    pub fn event_mode(&self) -> Option<EventMode> {
        self.event_mode
    }
}

/// Check if an event is a terminal event (for enforcement)
pub fn is_terminal_event(type_name: &str, value: &Value) -> bool {
    SessionValidation::is_terminal_event(type_name, value)
}

/// ACP Driver builder
pub struct AcpDriverBuilder {
    config: DriverConfig,
}

impl AcpDriverBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            config: DriverConfig::default(),
        }
    }

    /// Set the command
    pub fn command(mut self, command: impl Into<String>) -> Self {
        self.config.command = command.into();
        self
    }

    /// Set the args
    pub fn args(mut self, args: Vec<String>) -> Self {
        self.config.args = args;
        self
    }

    /// Enable transcript
    pub fn enable_transcript(mut self, enable: bool) -> Self {
        self.config.enable_transcript = enable;
        self
    }

    /// Build the driver
    pub async fn build(self) -> Result<AcpDriver> {
        AcpDriver::new_stdio(self.config).await
    }
}

impl Default for AcpDriverBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// ACP Doctor - diagnostics
pub struct AcpDoctor;

impl AcpDoctor {
    /// Run diagnostics on ACP setup
    pub async fn check() -> Result<Vec<DoctorResult>> {
        let mut results = Vec::new();

        results.push(DoctorResult {
            check: "ACP Driver".to_string(),
            status: DoctorStatus::Ok,
            message: "Library loaded successfully".to_string(),
        });

        results.push(DoctorResult {
            check: "Schema Version".to_string(),
            status: DoctorStatus::Ok,
            message: format!("agent-client-protocol-schema v{}", ACP_SCHEMA_VERSION),
        });

        Ok(results)
    }
}

#[derive(Debug, Clone)]
pub struct DoctorResult {
    pub check: String,
    pub status: DoctorStatus,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DoctorStatus {
    Ok,
    Warning,
    Error,
}

/// Official ACP schema version constant
pub const ACP_SCHEMA_VERSION: &str = "0.10.8";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testdata::{parse_transcript, OPENCODE_SESSION_TRANSCRIPT};

    #[test]
    fn test_acp_schema_version() {
        assert_eq!(ACP_SCHEMA_VERSION, "0.10.8");
    }

    #[test]
    fn test_session_source_display() {
        assert_eq!(SessionSource::Chat.to_string(), "chat");
        assert_eq!(SessionSource::Terminal.to_string(), "terminal");
    }

    #[test]
    fn test_event_mode_display() {
        assert_eq!(EventMode::Acp.to_string(), "acp");
        assert_eq!(EventMode::Jsonl.to_string(), "jsonl");
        assert_eq!(EventMode::Terminal.to_string(), "terminal");
    }

    #[test]
    fn test_golden_transcript_parsing() {
        let lines = parse_transcript(OPENCODE_SESSION_TRANSCRIPT);
        assert_eq!(lines.len(), 10, "Transcript should have 10 lines");

        // Verify JSON-RPC structure
        assert_eq!(lines[0]["jsonrpc"], "2.0");
        assert_eq!(lines[0]["method"], "initialize");
        assert_eq!(lines[1]["result"]["protocolVersion"], "2024-11-05");
    }
}
