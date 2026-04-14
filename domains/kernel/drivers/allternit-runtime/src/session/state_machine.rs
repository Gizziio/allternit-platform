//! Session State Machine
//!
//! Explicit states with guarded transitions.

use crate::events::{InvalidTransition, RuntimeEvent};

/// Session states - deterministic lifecycle
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum SessionState {
    /// Session created but not initialized
    Idle,

    /// Initializing connection to provider
    Initializing,

    /// Ready to accept invocations
    Ready,

    /// Invocation active - waiting for model response
    AwaitingModel,

    /// Streaming content deltas
    Streaming,

    /// Model requested tool execution
    AwaitingToolExecution,

    /// Tool(s) currently executing
    ExecutingTool,

    /// Invocation completed successfully
    Completed,

    /// Invocation failed
    Failed,
}

impl SessionState {
    /// Get state name as string (for debugging)
    pub fn name(&self) -> &'static str {
        match self {
            SessionState::Idle => "Idle",
            SessionState::Initializing => "Initializing",
            SessionState::Ready => "Ready",
            SessionState::AwaitingModel => "AwaitingModel",
            SessionState::Streaming => "Streaming",
            SessionState::AwaitingToolExecution => "AwaitingToolExecution",
            SessionState::ExecutingTool => "ExecutingTool",
            SessionState::Completed => "Completed",
            SessionState::Failed => "Failed",
        }
    }
}

/// Result of a transition attempt
pub type TransitionResult = Result<SessionState, InvalidTransition>;

impl SessionState {
    /// Attempt to transition to a new state based on an event.
    ///
    /// In debug mode: invalid transitions panic.
    /// In release mode: invalid transitions return Err.
    pub fn transition(&self, event: &RuntimeEvent) -> TransitionResult {
        let result = match (self, event) {
            // Idle → Initializing: Start event
            (SessionState::Idle, RuntimeEvent::Start) => Ok(SessionState::Initializing),

            // Initializing → Ready: Session initialized
            (SessionState::Initializing, RuntimeEvent::SessionInitialized) => {
                Ok(SessionState::Ready)
            }

            // Ready → AwaitingModel: Prompt submitted
            (SessionState::Ready, RuntimeEvent::PromptSubmitted { .. }) => {
                Ok(SessionState::AwaitingModel)
            }

            // AwaitingModel → Streaming: First delta received
            (SessionState::AwaitingModel, RuntimeEvent::ProviderDelta { .. }) => {
                Ok(SessionState::Streaming)
            }

            // AwaitingModel → AwaitingToolExecution: Tool call received
            (SessionState::AwaitingModel, RuntimeEvent::ProviderToolCall { .. }) => {
                Ok(SessionState::AwaitingToolExecution)
            }

            // AwaitingModel → Completed: Provider done immediately (no streaming)
            (SessionState::AwaitingModel, RuntimeEvent::ProviderDone { .. }) => {
                Ok(SessionState::Completed)
            }

            // Streaming → Streaming: More deltas (self-transition)
            (SessionState::Streaming, RuntimeEvent::ProviderDelta { .. }) => {
                Ok(SessionState::Streaming)
            }

            // Streaming → AwaitingToolExecution: Tool call during streaming
            (SessionState::Streaming, RuntimeEvent::ProviderToolCall { .. }) => {
                Ok(SessionState::AwaitingToolExecution)
            }

            // Streaming → Completed: Provider done
            (SessionState::Streaming, RuntimeEvent::ProviderDone { .. }) => {
                Ok(SessionState::Completed)
            }

            // AwaitingToolExecution → ExecutingTool: Start tool execution
            (SessionState::AwaitingToolExecution, RuntimeEvent::ToolExecutionStarted { .. }) => {
                Ok(SessionState::ExecutingTool)
            }

            // ExecutingTool → AwaitingModel: Tool result sent, continue
            (SessionState::ExecutingTool, RuntimeEvent::ToolResultSent { .. }) => {
                Ok(SessionState::AwaitingModel)
            }

            // ExecutingTool → Streaming: Provider delta after tool result
            (SessionState::ExecutingTool, RuntimeEvent::ProviderDelta { .. }) => {
                Ok(SessionState::Streaming)
            }

            // ExecutingTool → Completed: Provider done after tool result
            (SessionState::ExecutingTool, RuntimeEvent::ProviderDone { .. }) => {
                Ok(SessionState::Completed)
            }

            // Any → Failed: Provider error
            (_, RuntimeEvent::ProviderError { .. }) => Ok(SessionState::Failed),

            // Any → Failed: Timeout
            (_, RuntimeEvent::Timeout) => Ok(SessionState::Failed),

            // Invalid transitions
            (from, to) => Err(InvalidTransition {
                from: from.name().to_string(),
                event: to.name().to_string(),
            }),
        };

        // In debug builds, panic on invalid transitions
        #[cfg(debug_assertions)]
        if let Err(ref e) = result {
            panic!("Invalid state transition: {} -> {}", e.from, e.event);
        }

        result
    }
}

/// Events that trigger state transitions
#[derive(Debug, Clone)]
pub enum StateEvent {
    Initialize,
    InitSuccess,
    InitFailed {
        retryable: bool,
    },
    Invoke {
        invocation_id: String,
        prompt: String,
    },
    ModelStarted,
    Timeout,
    ToolCallsRequested {
        calls: Vec<crate::events::ToolCall>,
    },
    ToolExecutionStarted {
        call_id: String,
    },
    ToolResultSent {
        result: crate::events::ToolResult,
    },
    ModelDone,
    ProviderError {
        code: String,
        message: String,
    },
    Terminate,
}

/// Full session state machine with context
pub struct SessionStateMachine {
    pub session_id: String,
    state: SessionState,
    config: super::SessionConfig,
    started_at: std::time::Instant,
    last_activity: std::time::Instant,
}

impl SessionStateMachine {
    pub fn new(config: super::SessionConfig) -> Self {
        let now = std::time::Instant::now();
        Self {
            session_id: config.session_id.clone(),
            state: SessionState::Idle,
            config,
            started_at: now,
            last_activity: now,
        }
    }

    pub fn state(&self) -> &SessionState {
        &self.state
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self.state, SessionState::Completed | SessionState::Failed)
    }

    pub fn is_stalled(&self, timeout_secs: u64) -> bool {
        self.last_activity.elapsed().as_secs() > timeout_secs
    }

    pub fn transition(&mut self, event: &RuntimeEvent) -> TransitionResult {
        let result = self.state.transition(event);
        if let Ok(new_state) = &result {
            self.state = new_state.clone();
            self.last_activity = std::time::Instant::now();
        }
        result
    }

    pub fn uptime_secs(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

#[cfg(test)]
mod state_tests {
    use super::*;

    #[test]
    fn test_valid_transition_idle_to_initializing() {
        let state = SessionState::Idle;
        let result = state.transition(&RuntimeEvent::Start);
        assert_eq!(result.unwrap(), SessionState::Initializing);
    }

    #[test]
    fn test_valid_transition_ready_to_awaiting_model() {
        let state = SessionState::Ready;
        let result = state.transition(&RuntimeEvent::PromptSubmitted {
            prompt: "hello".to_string(),
        });
        assert_eq!(result.unwrap(), SessionState::AwaitingModel);
    }

    #[test]
    fn test_session_state_machine_lifecycle() {
        let config = super::super::SessionConfig {
            session_id: "test".to_string(),
            provider_id: "test".to_string(),
            ..Default::default()
        };
        let mut sm = SessionStateMachine::new(config);

        assert_eq!(sm.state, SessionState::Idle);
        assert!(!sm.is_terminal());

        sm.transition(&RuntimeEvent::Start).unwrap();
        assert_eq!(sm.state, SessionState::Initializing);

        sm.transition(&RuntimeEvent::SessionInitialized).unwrap();
        assert_eq!(sm.state, SessionState::Ready);
    }

    #[test]
    #[cfg(not(debug_assertions))]
    fn test_invalid_transition_returns_error_in_release() {
        let state = SessionState::Idle;
        let result = state.transition(&RuntimeEvent::ProviderDelta {
            content: "delta".to_string(),
        });
        assert!(result.is_err());
    }
}
