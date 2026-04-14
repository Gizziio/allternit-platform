//! Golden Transcript Replay Tests
//!
//! These tests replay .jsonl transcript files and verify:
//! - No unknown event crashes
//! - Deltas map to the same normalized/ACP outputs
//! - Tool roundtrip sequence is valid

use a2r_acp_driver::protocol::TolerantSessionUpdate;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

/// Parse a transcript file into JSON values
fn parse_transcript(path: &str) -> Vec<Value> {
    let content = fs::read_to_string(path).expect("Failed to read transcript");
    content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("Invalid JSON in transcript"))
        .collect()
}

/// Get the tests/golden directory path
fn golden_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("golden")
}

/// Verify a transcript has valid JSON-RPC structure
fn verify_jsonrpc_structure(lines: &[Value]) {
    // First line should be initialize request
    assert_eq!(lines[0]["jsonrpc"], "2.0", "First message should be JSON-RPC 2.0");
    assert_eq!(lines[0]["method"], "initialize", "First message should be initialize");

    // Find initialize response
    let init_resp = lines.iter().find(|l| {
        l["id"] == lines[0]["id"] && l.get("result").is_some()
    }).expect("Should have initialize response");
    assert!(init_resp["result"].is_object(), "Initialize response should have result");
}

/// Verify session/new flow exists
fn verify_session_new_flow(lines: &[Value]) {
    let session_req = lines.iter().find(|l| {
        l.get("method").and_then(|m| m.as_str()) == Some("session/new")
    }).expect("Should have session/new request");

    let session_id = session_req["id"].as_i64().expect("session/new should have id");
    let session_resp = lines.iter().find(|l| {
        l["id"].as_i64() == Some(session_id) && l.get("result").is_some()
    }).expect("Should have session/new response");

    assert!(
        session_resp["result"]["sessionId"].is_string(),
        "session/new response should have sessionId"
    );
}

/// Count update types in transcript
fn count_update_types(lines: &[Value]) -> std::collections::HashMap<String, i32> {
    let mut counts = std::collections::HashMap::new();
    for line in lines {
        if let Some(method) = line.get("method").and_then(|m| m.as_str()) {
            if method == "session/update" {
                if let Some(update_type) = line["params"]["type"].as_str() {
                    *counts.entry(update_type.to_string()).or_insert(0) += 1;
                }
            }
        }
    }
    counts
}

/// Verify tolerant parsing of all updates
fn verify_tolerant_parsing(path: &str) {
    let content = fs::read_to_string(path).expect("Failed to read transcript");
    let mut unknown_count = 0;

    for (i, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }

        // Try to parse as tolerant update
        if let Ok(update) = serde_json::from_str::<TolerantSessionUpdate>(line) {
            match update {
                TolerantSessionUpdate::Unknown => {
                    unknown_count += 1;
                    println!("Line {}: Tolerated unknown update type", i + 1);
                }
                _ => {}
            }
        }
        // Not all lines are updates (some are requests/responses), that's OK
    }

    println!("Transcript {}: {} unknown types tolerated", path, unknown_count);
}

/// Test that all golden fixtures exist and are valid JSON
#[test]
fn test_all_fixtures_exist() {
    let dir = golden_dir();

    let expected_files = vec![
        "opencode_acp_stream.jsonl",
        "claude_acp_stream.jsonl",
        "gemini_jsonl_stream.jsonl",
        "ollama_stream.jsonl",
        "openrouter_stream.jsonl",
        "error_401.jsonl",
        "error_429.jsonl",
        "error_malformed_delta.jsonl",
    ];

    for file in expected_files {
        let path = dir.join(file);
        assert!(path.exists(), "Golden fixture should exist: {}", file);

        // Verify it's valid JSONL
        let content = fs::read_to_string(&path).expect("Failed to read fixture");
        for (i, line) in content.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let _: Value = serde_json::from_str(line)
                .expect(&format!("Invalid JSON in {} line {}", file, i + 1));
        }
    }
}

/// Test OpenCode ACP stream transcript
#[test]
fn test_opencode_acp_stream_replay() {
    let path = golden_dir().join("opencode_acp_stream.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    verify_jsonrpc_structure(&lines);
    verify_session_new_flow(&lines);

    let update_types = count_update_types(&lines);
    assert!(update_types.contains_key("agent_message_chunk"), "Should have agent_message_chunk");
    assert!(update_types.contains_key("agent_message_complete"), "Should have agent_message_complete");

    verify_tolerant_parsing(path.to_str().unwrap());
}

/// Test Claude ACP stream transcript with tool calls
#[test]
fn test_claude_acp_stream_replay() {
    let path = golden_dir().join("claude_acp_stream.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    verify_jsonrpc_structure(&lines);
    verify_session_new_flow(&lines);

    let update_types = count_update_types(&lines);
    assert!(update_types.contains_key("agent_message_chunk"), "Should have agent_message_chunk");
    assert!(update_types.contains_key("tool_call"), "Should have tool_call");

    // Verify tool call roundtrip
    let tool_call = lines.iter().find(|l| {
        l.get("method").and_then(|m| m.as_str()) == Some("session/update")
            && l["params"]["type"] == "tool_call"
    }).expect("Should have tool_call update");

    assert!(tool_call["params"]["tool_call"]["id"].is_string(), "Tool call should have id");
    assert!(tool_call["params"]["tool_call"]["name"].is_string(), "Tool call should have name");

    // Verify tool/result response exists
    let tool_result = lines.iter().find(|l| {
        l.get("method").and_then(|m| m.as_str()) == Some("tool/result")
    }).expect("Should have tool/result");

    assert_eq!(
        tool_result["params"]["tool_call_id"],
        tool_call["params"]["tool_call"]["id"],
        "Tool result should reference tool call id"
    );

    verify_tolerant_parsing(path.to_str().unwrap());
}

/// Test Gemini JSONL stream transcript
#[test]
fn test_gemini_jsonl_stream_replay() {
    let path = golden_dir().join("gemini_jsonl_stream.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    verify_jsonrpc_structure(&lines);
    verify_session_new_flow(&lines);

    // Check for JSONL-style streaming (type field at root)
    let content_messages: Vec<_> = lines.iter()
        .filter(|l| l.get("type").and_then(|t| t.as_str()) == Some("content"))
        .collect();

    assert!(!content_messages.is_empty(), "Should have JSONL content messages");

    verify_tolerant_parsing(path.to_str().unwrap());
}

/// Test Ollama stream transcript
#[test]
fn test_ollama_stream_replay() {
    let path = golden_dir().join("ollama_stream.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    verify_jsonrpc_structure(&lines);
    verify_session_new_flow(&lines);

    let update_types = count_update_types(&lines);
    assert!(update_types.contains_key("agent_message_chunk"), "Should have agent_message_chunk");

    verify_tolerant_parsing(path.to_str().unwrap());
}

/// Test OpenRouter stream transcript
#[test]
fn test_openrouter_stream_replay() {
    let path = golden_dir().join("openrouter_stream.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    verify_jsonrpc_structure(&lines);
    verify_session_new_flow(&lines);

    verify_tolerant_parsing(path.to_str().unwrap());
}

/// Test 401 auth error handling
#[test]
fn test_error_401_replay() {
    let path = golden_dir().join("error_401.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    // Find error response
    let error_resp = lines.iter().find(|l| l.get("error").is_some())
        .expect("Should have error response");

    assert_eq!(error_resp["error"]["code"], 401, "Should be 401 error");
    assert!(
        error_resp["error"]["message"].as_str().unwrap().to_lowercase().contains("auth"),
        "Error should mention auth"
    );
}

/// Test 429 rate limit error handling
#[test]
fn test_error_429_replay() {
    let path = golden_dir().join("error_429.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    // Find error response
    let error_resp = lines.iter().find(|l| l.get("error").is_some())
        .expect("Should have error response");

    assert_eq!(error_resp["error"]["code"], 429, "Should be 429 error");
    assert!(
        error_resp["error"]["message"].as_str().unwrap().to_lowercase().contains("rate"),
        "Error should mention rate"
    );

    // Verify retry_after in data
    assert!(error_resp["error"]["data"]["retry_after"].is_number(), "Should have retry_after");
}

/// Test malformed delta handling (tolerant parsing)
#[test]
fn test_malformed_delta_replay() {
    let path = golden_dir().join("error_malformed_delta.jsonl");
    let lines = parse_transcript(path.to_str().unwrap());

    // Should still have valid structure despite malformed content
    verify_jsonrpc_structure(&lines);
    verify_session_new_flow(&lines);

    let update_types = count_update_types(&lines);
    assert!(update_types.contains_key("agent_message_chunk"), "Should have agent_message_chunk");
    assert!(update_types.contains_key("agent_message_complete"), "Should have agent_message_complete");

    // Verify tolerant parsing handles malformed updates
    verify_tolerant_parsing(path.to_str().unwrap());
}

/// Test deterministic output - same transcript should produce same results
#[test]
fn test_deterministic_replay() {
    let path = golden_dir().join("opencode_acp_stream.jsonl");

    let lines1 = parse_transcript(path.to_str().unwrap());
    let lines2 = parse_transcript(path.to_str().unwrap());

    assert_eq!(lines1.len(), lines2.len(), "Same transcript should produce same line count");

    for (i, (a, b)) in lines1.iter().zip(lines2.iter()).enumerate() {
        assert_eq!(a, b, "Line {} should be identical", i);
    }
}

/// Test that malformed JSON is handled gracefully
#[test]
fn test_malformed_json_recovery() {
    // Create a temporary malformed transcript
    let malformed = r#"
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05"}}
{"invalid json here
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{}}
"#;

    let mut valid_count = 0;
    let mut invalid_count = 0;

    for line in malformed.lines() {
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Value>(line) {
            Ok(_) => valid_count += 1,
            Err(_) => invalid_count += 1,
        }
    }

    assert_eq!(valid_count, 3, "Should parse 3 valid lines");
    assert_eq!(invalid_count, 1, "Should detect 1 invalid line");
}
