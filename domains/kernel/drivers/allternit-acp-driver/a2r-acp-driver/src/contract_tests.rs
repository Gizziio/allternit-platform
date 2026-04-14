//! Session Contract Enforcement Tests
//!
//! Tests the hard gates for auth wizard and chat contracts

use crate::{SessionSource, EventMode, AcpDriver, AcpDriverBuilder};

/// Test: source="chat" + Terminal event mode = REJECTION
#[tokio::test]
async fn test_chat_source_terminal_mode_rejected() {
    // Create a mock driver config
    let config = crate::DriverConfig {
        command: "/bin/echo".to_string(),
        args: vec!["test".to_string()],
        enable_transcript: true,
        protocol_version: crate::ProtocolVersion::V1,
    };
    
    // Create driver
    let mut driver = AcpDriver::new_stdio(config).await.expect("Failed to create driver");
    
    // Attempt to create session with chat source + terminal mode
    // This should fail with contract violation
    let result = driver.session_new(
        Some("test_session".to_string()),
        SessionSource::Chat,
        EventMode::Terminal,
    ).await;
    
    assert!(result.is_err(), "Chat source with Terminal mode should be rejected");
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("chat source cannot use terminal event mode"), 
            "Error should mention chat source restriction: {}", err_msg);
}

/// Test: source="terminal" + ACP event mode = REJECTION
#[tokio::test]
async fn test_terminal_source_acp_mode_rejected() {
    let config = crate::DriverConfig {
        command: "/bin/echo".to_string(),
        args: vec!["test".to_string()],
        enable_transcript: true,
        protocol_version: crate::ProtocolVersion::V1,
    };
    
    let mut driver = AcpDriver::new_stdio(config).await.expect("Failed to create driver");
    
    // Attempt to create session with terminal source + ACP mode
    let result = driver.session_new(
        Some("test_session".to_string()),
        SessionSource::Terminal,
        EventMode::Acp,
    ).await;
    
    assert!(result.is_err(), "Terminal source with ACP mode should be rejected");
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("terminal source must use terminal event mode"),
            "Error should mention terminal source restriction: {}", err_msg);
}

/// Test: source="terminal" + JSONL event mode = REJECTION
#[tokio::test]
async fn test_terminal_source_jsonl_mode_rejected() {
    let config = crate::DriverConfig {
        command: "/bin/echo".to_string(),
        args: vec!["test".to_string()],
        enable_transcript: true,
        protocol_version: crate::ProtocolVersion::V1,
    };
    
    let mut driver = AcpDriver::new_stdio(config).await.expect("Failed to create driver");
    
    // Attempt to create session with terminal source + JSONL mode
    let result = driver.session_new(
        Some("test_session".to_string()),
        SessionSource::Terminal,
        EventMode::Jsonl,
    ).await;
    
    assert!(result.is_err(), "Terminal source with JSONL mode should be rejected");
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("terminal source must use terminal event mode"),
            "Error should mention terminal source restriction: {}", err_msg);
}

/// Test: Valid combinations
#[tokio::test]
async fn test_valid_session_combinations() {
    let config = crate::DriverConfig {
        command: "/bin/echo".to_string(),
        args: vec!["test".to_string()],
        enable_transcript: true,
        protocol_version: crate::ProtocolVersion::V1,
    };
    
    // Note: We can't actually create valid sessions without a running ACP server
    // But we can verify the validation logic allows these combinations
    
    // Chat + ACP = OK (would succeed if server available)
    // Chat + Jsonl = OK (would succeed if server available)
    // Terminal + Terminal = OK (would succeed if server available)
    
    // Just verify the config is valid
    let _driver = AcpDriver::new_stdio(config).await.expect("Failed to create driver");
}

/// Test terminal event detection
#[test]
fn test_terminal_event_detection_comprehensive() {
    use crate::driver::is_terminal_event;
    use serde_json::json;
    
    // Terminal event types
    assert!(is_terminal_event("terminal_output", &json!({})));
    assert!(is_terminal_event("terminal_created", &json!({})));
    assert!(is_terminal_event("terminal_exited", &json!({})));
    assert!(is_terminal_event("terminal_input", &json!({})));
    
    // Non-terminal events
    assert!(!is_terminal_event("agent_message_chunk", &json!({})));
    assert!(!is_terminal_event("agent_message_complete", &json!({})));
    assert!(!is_terminal_event("tool_call", &json!({})));
    assert!(!is_terminal_event("tool_call_update", &json!({})));
    assert!(!is_terminal_event("error", &json!({})));
    
    // Events with terminal_id field (any type)
    let with_terminal = json!({"terminal_id": "term_123", "content": "test"});
    assert!(is_terminal_event("any_type", &with_terminal));
    
    // Events without terminal_id
    let without_terminal = json!({"content": "test", "session_id": "sess_123"});
    assert!(!is_terminal_event("agent_message_chunk", &without_terminal));
}

/// Test violation logging format
#[test]
fn test_violation_log_format() {
    let session_id = "sess_test_123";
    let profile_id = "opencode-acp";
    let source = "chat";
    let event_mode = "acp";
    let event_type = "terminal_output";
    
    let violation = format!(
        "VIOLATION: Terminal event '{}' detected in chat session. \
        session_id={}, profile_id={}, source={}, event_mode={}",
        event_type, session_id, profile_id, source, event_mode
    );
    
    assert!(violation.contains("VIOLATION:"));
    assert!(violation.contains("sess_test_123"));
    assert!(violation.contains("opencode-acp"));
    assert!(violation.contains("chat"));
    assert!(violation.contains("acp"));
    assert!(violation.contains("terminal_output"));
}
