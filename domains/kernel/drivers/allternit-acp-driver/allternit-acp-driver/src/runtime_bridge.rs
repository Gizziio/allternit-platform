//! ACP Driver Runtime Bridge
//!
//! Implements the BrainRuntime trait for ACP driver.
//! Converts between normalized types and ACP-specific types.

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{error, info};

use allternit_runtime::{
    BrainRuntime, CreateSession, EventMode, NormalizedDelta, NormalizedResponse,
    NormalizedToolCall, Prompt, ProviderError, ProviderErrorKind, RuntimeError, SessionHandle,
    SessionSource, StreamEvent, ToolResult,
};

use crate::driver::{AcpDriver, AcpEvent, DriverConfig, Session, ToolResult as AcpToolResult};
use crate::protocol::{EventMode as AcpEventMode, SessionSource as AcpSessionSource};

/// ACP implementation of BrainRuntime
pub struct AcpBrainRuntime {
    sessions: Arc<RwLock<HashMap<String, AcpDriverSession>>>,
    default_command: String,
    default_args: Vec<String>,
}

struct AcpDriverSession {
    handle: SessionHandle,
    source: SessionSource,
    event_mode: EventMode,
}

impl AcpBrainRuntime {
    pub fn new(command: impl Into<String>, args: Vec<String>) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            default_command: command.into(),
            default_args: args,
        }
    }

    pub fn opencode() -> Self {
        Self::new("opencode", vec!["acp".to_string()])
    }

    fn map_event_mode(mode: EventMode) -> AcpEventMode {
        match mode {
            EventMode::Acp => AcpEventMode::Acp,
            EventMode::Jsonl => AcpEventMode::Jsonl,
            EventMode::Terminal => AcpEventMode::Terminal,
        }
    }

    fn map_session_source(source: SessionSource) -> AcpSessionSource {
        match source {
            SessionSource::Chat => AcpSessionSource::Chat,
            SessionSource::Terminal => AcpSessionSource::Terminal,
        }
    }

    fn map_acp_event_to_delta(event: &AcpEvent) -> Option<NormalizedDelta> {
        match event {
            AcpEvent::MessageChunk(text) => Some(NormalizedDelta::Content {
                text: text.clone(),
                finish_reason: None,
            }),
            AcpEvent::MessageComplete => Some(NormalizedDelta::Finish {
                reason: allternit_runtime::FinishReason::Stop,
                usage: None,
            }),
            AcpEvent::ToolCall { id, name, arguments } => {
                let args_str = serde_json::to_string(arguments).unwrap_or_default();
                Some(NormalizedDelta::ToolCall {
                    id: id.clone(),
                    name: name.clone(),
                    arguments: args_str,
                    is_complete: Some(true),
                })
            }
            AcpEvent::Error { message } => Some(NormalizedDelta::Error {
                error: ProviderError::provider_bug(message.clone()),
            }),
            _ => None,
        }
    }
}

#[async_trait]
impl BrainRuntime for AcpBrainRuntime {
    async fn create_session(&self, req: CreateSession) -> Result<SessionHandle, RuntimeError> {
        // Validate source + event_mode
        req.validate()?;

        let session_id = req.id.unwrap_or_else(SessionHandle::generate_id);

        let handle = SessionHandle {
            id: session_id.clone(),
            profile_id: req.profile_id,
            model_id: req.model_id,
            source: req.source,
            event_mode: req.event_mode,
            created_at: chrono::Utc::now(),
        };

        let session_data = AcpDriverSession {
            handle: handle.clone(),
            source: req.source,
            event_mode: req.event_mode,
        };

        self.sessions.write().await.insert(session_id, session_data);
        info!("Created ACP session: {}", handle.id);
        Ok(handle)
    }

    async fn send_prompt(
        &self,
        _session: &SessionHandle,
        _prompt: Prompt,
    ) -> Result<NormalizedResponse, RuntimeError> {
        // Stub implementation
        Err(RuntimeError::Unknown("Not yet implemented".to_string()))
    }

    async fn send_prompt_stream(
        &self,
        _session: &SessionHandle,
        _prompt: Prompt,
    ) -> Result<mpsc::Receiver<StreamEvent>, RuntimeError> {
        let (_, rx) = mpsc::channel(1);
        Ok(rx)
    }

    async fn send_tool_result(
        &self,
        _session: &SessionHandle,
        _result: ToolResult,
    ) -> Result<(), RuntimeError> {
        Ok(())
    }

    async fn close_session(&self, session: SessionHandle) -> Result<(), RuntimeError> {
        self.sessions.write().await.remove(&session.id);
        info!("Closed ACP session: {}", session.id);
        Ok(())
    }

    async fn session_status(&self, session_id: &str) -> Result<SessionHandle, RuntimeError> {
        self.sessions
            .read()
            .await
            .get(session_id)
            .map(|s| s.handle.clone())
            .ok_or_else(|| RuntimeError::SessionNotFound(session_id.to_string()))
    }

    async fn list_sessions(&self) -> Result<Vec<SessionHandle>, RuntimeError> {
        Ok(self.sessions.read().await.values().map(|s| s.handle.clone()).collect())
    }
}

/// Normalizer for converting between ACP and normalized types
pub struct AcpNormalizer;

impl AcpNormalizer {
    pub fn normalize_content(text: impl Into<String>) -> NormalizedDelta {
        NormalizedDelta::Content {
            text: text.into(),
            finish_reason: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_mode_mapping() {
        assert!(matches!(
            AcpBrainRuntime::map_event_mode(EventMode::Acp),
            AcpEventMode::Acp
        ));
    }

    #[test]
    fn test_session_source_mapping() {
        assert!(matches!(
            AcpBrainRuntime::map_session_source(SessionSource::Chat),
            AcpSessionSource::Chat
        ));
    }

    #[test]
    fn test_acp_event_to_delta_mapping() {
        let event = AcpEvent::MessageChunk("Hello".to_string());
        let delta = AcpBrainRuntime::map_acp_event_to_delta(&event);
        assert!(matches!(delta, Some(NormalizedDelta::Content { .. })));
    }
}
