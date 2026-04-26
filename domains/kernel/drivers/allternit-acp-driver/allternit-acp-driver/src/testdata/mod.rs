//! Test data for ACP driver tests

use serde_json::Value;

/// Parse a transcript string into JSON values
pub fn parse_transcript(transcript: &str) -> Vec<Value> {
    transcript
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("Invalid JSON in transcript"))
        .collect()
}

/// Sample OpenCode ACP session transcript
pub const OPENCODE_SESSION_TRANSCRIPT: &str = r#"
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"allternit-acp-driver","version":"0.1.0"}}}
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"experimental":{},"tools":{"listChanged":false}},"serverInfo":{"name":"opencode","version":"0.1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/tmp","source":"chat","event_mode":"acp"}}
{"jsonrpc":"2.0","id":2,"result":{"sessionId":"sess_abc123"}}
{"jsonrpc":"2.0","method":"session/started","params":{"sessionId":"sess_abc123","timestamp":"2026-02-16T10:00:00Z"}}
{"jsonrpc":"2.0","id":3,"method":"prompt","params":{"sessionId":"sess_abc123","content":[{"type":"text","text":"Hello, world!"}]}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc123","type":"agent_message_chunk","content":"Hello"}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc123","type":"agent_message_chunk","content":"!"}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc123","type":"agent_message_complete","content":"Hello!"}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc123","type":"unknown_future_update","data":"some_data"}}
"#;

/// Sample real session transcript with tool calls
pub const REAL_SESSION_TRANSCRIPT: &str = r#"
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"allternit-acp-driver","version":"0.1.0"}}}
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","serverInfo":{"name":"test-agent","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/test"}}
{"jsonrpc":"2.0","id":2,"result":{"sessionId":"sess_abc123"}}
{"jsonrpc":"2.0","method":"session/started","params":{"sessionId":"sess_abc123","source":"chat","eventMode":"acp"}}
{"jsonrpc":"2.0","id":3,"method":"prompt","params":{"sessionId":"sess_abc123","content":[{"type":"text","text":"What's the weather?"}]}}
{"jsonrpc":"2.0","method":"session/update","params":{"type":"agent_message_chunk","content":"I'll"}}
{"jsonrpc":"2.0","method":"session/update","params":{"type":"agent_message_chunk","content":" check"}}
{"jsonrpc":"2.0","method":"session/update","params":{"type":"agent_message_chunk","content":" the"}}
{"jsonrpc":"2.0","method":"session/update","params":{"type":"unknown_future_update","data":"test"}}
{"jsonrpc":"2.0","method":"session/update","params":{"type":"tool_call","name":"get_weather","arguments":{"location":"NYC"}}}
{"jsonrpc":"2.0","id":4,"method":"tool/result","params":{"sessionId":"sess_abc123","tool_call_id":"tool_123","content":"72°F and sunny"}}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_transcript() {
        let lines = parse_transcript(OPENCODE_SESSION_TRANSCRIPT);
        assert!(!lines.is_empty(), "Transcript should have lines");

        // First line should be initialize request
        let first = &lines[0];
        assert_eq!(first["jsonrpc"], "2.0");
        assert_eq!(first["method"], "initialize");
    }

    #[test]
    fn test_real_session_transcript() {
        let lines = parse_transcript(REAL_SESSION_TRANSCRIPT);
        assert_eq!(lines.len(), 12, "Real transcript should have 12 lines");

        // Line 1: Initialize request
        assert_eq!(lines[0]["method"], "initialize");
        assert_eq!(lines[0]["id"], 1);

        // Line 2: Initialize response
        assert!(lines[1]["result"].is_object());
        assert_eq!(lines[1]["id"], 1);

        // Line 3: session/new request
        assert_eq!(lines[2]["method"], "session/new");
        assert_eq!(lines[2]["id"], 2);

        // Line 4: session/new response
        assert_eq!(lines[3]["result"]["sessionId"], "sess_abc123");

        // Line 5: session/started notification (no id)
        assert_eq!(lines[4]["method"], "session/started");
        assert!(!lines[4].as_object().unwrap().contains_key("id"));

        // Line 6: prompt request
        assert_eq!(lines[5]["method"], "prompt");

        // Lines 7-9: agent_message_chunk
        assert_eq!(lines[6]["params"]["type"], "agent_message_chunk");
        assert_eq!(lines[7]["params"]["type"], "agent_message_chunk");
        assert_eq!(lines[8]["params"]["type"], "agent_message_chunk");

        // Line 10: unknown update type (tolerance test)
        assert_eq!(lines[9]["params"]["type"], "unknown_future_update");

        // Line 11: tool_call
        assert_eq!(lines[10]["params"]["type"], "tool_call");
        assert_eq!(lines[10]["params"]["name"], "get_weather");

        // Line 12: tool/result
        assert_eq!(lines[11]["method"], "tool/result");
        assert_eq!(lines[11]["id"], 4);
    }

    #[test]
    fn test_json_rpc_structure() {
        let lines = parse_transcript(REAL_SESSION_TRANSCRIPT);

        for (i, line) in lines.iter().enumerate() {
            // Every message must have jsonrpc: "2.0"
            assert_eq!(line["jsonrpc"], "2.0", "Line {} missing jsonrpc", i + 1);

            // Requests have "method", responses have "result" or "error"
            let has_method = line.get("method").is_some();
            let has_result = line.get("result").is_some();
            let has_error = line.get("error").is_some();

            assert!(
                has_method || has_result || has_error,
                "Line {} should have method, result, or error",
                i + 1
            );
        }
    }
}
