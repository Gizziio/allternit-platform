//! ACP Protocol Types
//!
//! Tolerant parsing for session updates and validation of ACP contracts.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Tolerant wrapper for session updates that handles unknown variants
///
/// The official SessionNotification type is strict; this wrapper provides
/// tolerant parsing for unknown update types (they're logged and ignored).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TolerantSessionUpdate {
    #[serde(rename = "agent_message_chunk")]
    AgentMessageChunk { content: String },
    #[serde(rename = "agent_message_complete")]
    AgentMessageComplete,
    #[serde(rename = "tool_call")]
    ToolCall { id: String, name: String, arguments: Value },
    #[serde(rename = "tool_call_update")]
    ToolCallUpdate { id: String, #[serde(default)] content: Option<String>, #[serde(default)] arguments: Option<Value> },
    #[serde(rename = "error")]
    Error { message: String, #[serde(default)] code: Option<String> },
    /// Unknown variants are captured for tolerant parsing
    #[serde(other)]
    Unknown,
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

/// Session validation rules
pub struct SessionValidation;

impl SessionValidation {
    /// Validate source + event_mode combination
    /// 
    /// Returns Err if combination is invalid per ACP contract
    pub fn validate(source: SessionSource, event_mode: EventMode) -> Result<(), String> {
        match (source, event_mode) {
            (SessionSource::Chat, EventMode::Terminal) => {
                Err("Chat source cannot use terminal event mode".to_string())
            }
            (SessionSource::Terminal, EventMode::Acp) | 
            (SessionSource::Terminal, EventMode::Jsonl) => {
                Err("Terminal source must use terminal event mode".to_string())
            }
            _ => Ok(()),
        }
    }

    /// Check if an update type is a terminal event
    pub fn is_terminal_event(type_name: &str, value: &Value) -> bool {
        matches!(type_name, 
            "terminal_output" | "terminal_created" | "terminal_exited" | "terminal_input"
        ) || value.get("terminal_id").is_some()
    }

    /// Check if an update type is known/expected
    pub fn is_known_update_type(update_type: &str) -> bool {
        matches!(update_type, 
            "agent_message_chunk" | "agent_message_complete" | "tool_call" | 
            "tool_call_update" | "error"
        )
    }
}

/// ACP method constants
pub const METHOD_INITIALIZE: &str = "initialize";
pub const METHOD_SESSION_NEW: &str = "session/new";
pub const METHOD_PROMPT: &str = "prompt";
pub const METHOD_TOOL_RESULT: &str = "tool/result";
pub const METHOD_AUTHENTICATE: &str = "authenticate";
pub const METHOD_SHUTDOWN: &str = "shutdown";

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_session_validation() {
        assert!(SessionValidation::validate(SessionSource::Chat, EventMode::Acp).is_ok());
        assert!(SessionValidation::validate(SessionSource::Chat, EventMode::Jsonl).is_ok());
        assert!(SessionValidation::validate(SessionSource::Terminal, EventMode::Terminal).is_ok());
        
        assert!(SessionValidation::validate(SessionSource::Chat, EventMode::Terminal).is_err());
        assert!(SessionValidation::validate(SessionSource::Terminal, EventMode::Acp).is_err());
        assert!(SessionValidation::validate(SessionSource::Terminal, EventMode::Jsonl).is_err());
    }

    #[test]
    fn test_tolerant_session_update_parsing() {
        // Test parsing known update types
        let chunk_json = r#"{"type":"agent_message_chunk","content":"test"}"#;
        let update: TolerantSessionUpdate = serde_json::from_str(chunk_json).unwrap();
        match update {
            TolerantSessionUpdate::AgentMessageChunk { content } => {
                assert_eq!(content, "test");
            }
            _ => panic!("Expected AgentMessageChunk"),
        }

        // Test parsing unknown update type
        let unknown_json = r#"{"type":"future_unknown_type","data":"value"}"#;
        let update: TolerantSessionUpdate = serde_json::from_str(unknown_json).unwrap();
        match update {
            TolerantSessionUpdate::Unknown => {}
            _ => panic!("Expected Unknown variant for unrecognized type"),
        }
    }

    #[test]
    fn test_is_terminal_event() {
        assert!(SessionValidation::is_terminal_event("terminal_output", &json!({})));
        assert!(SessionValidation::is_terminal_event("terminal_created", &json!({})));
        assert!(SessionValidation::is_terminal_event("any_type", &json!({"terminal_id": "123"})));
        
        assert!(!SessionValidation::is_terminal_event("agent_message_chunk", &json!({})));
        assert!(!SessionValidation::is_terminal_event("tool_call", &json!({})));
    }

    #[test]
    fn test_is_known_update_type() {
        assert!(SessionValidation::is_known_update_type("agent_message_chunk"));
        assert!(SessionValidation::is_known_update_type("agent_message_complete"));
        assert!(SessionValidation::is_known_update_type("tool_call"));
        
        assert!(!SessionValidation::is_known_update_type("unknown_type"));
        assert!(!SessionValidation::is_known_update_type("terminal_output"));
    }
}
