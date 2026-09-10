//! Kimi CLI driver (`kimi -p <prompt> --output-format stream-json [-S <id>] [-m <model>]`).
//!
//! No upstream oracle exists for kimi (see `docs/UHP_VENDOR_INVENTORY.md`); the
//! parser handles the CLI's real wire shape (verified against 0.42.0): role-keyed
//! lines `{"role":"assistant","content":"..."}`, meta lines carrying the resume
//! ref (`session.resume_hint` → `session_id`), plus claude-stream-json-shaped
//! assistant events. Non-JSON lines are CLI noise and are dropped, never text.

use std::path::Path;

use crate::drivers::{norm_usage, DriverState, ParsedEvent};

pub fn argv(prompt: &str, model: Option<&str>, resume: Option<&str>, _cwd: &Path) -> Vec<String> {
    let mut args = vec![
        "kimi".to_string(),
        "-p".to_string(),
        prompt.to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];
    match resume {
        // A captured session id pins the exact conversation. No ref yet means
        // first turn of the session: start fresh (a bare `-c` only prints a
        // "no sessions to continue" warning in a fresh workspace cwd).
        Some(id) if !id.is_empty() => {
            args.push("-S".to_string());
            args.push(id.to_string());
        }
        _ => {}
    }
    if let Some(model) = model {
        args.push("-m".to_string());
        args.push(model.to_string());
    }
    args
}

pub fn parse_line(line: &str, state: &mut DriverState) -> Vec<ParsedEvent> {
    if state.finished {
        return Vec::new();
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
        // CLI noise (deprecation warnings, resume hints in prose, spinners):
        // dropped, exactly like the claude driver. kimi's stream-json mode
        // emits JSON for content; anything else is not assistant text.
        return Vec::new();
    };
    let mut events = Vec::new();

    // Capture a session id from any field named `session`, `session_id` or `sid`.
    for key in ["session_id", "session", "sid"] {
        if let Some(id) = value.get(key).and_then(serde_json::Value::as_str) {
            if !id.is_empty() && state.session_ref.as_deref() != Some(id) {
                state.session_ref = Some(id.to_string());
                events.push(ParsedEvent::SessionRef(id.to_string()));
            }
        }
    }

    // Kimi's own wire shape (verified against CLI 0.42.0): role-keyed, no
    // `type` — `{"role":"assistant","content":"..."}` and meta lines like
    // `{"role":"meta","type":"session.resume_hint","session_id":...}`.
    if value.get("type").is_none() {
        if value.get("role").and_then(serde_json::Value::as_str) == Some("assistant") {
            match value.get("content") {
                Some(serde_json::Value::String(text)) => {
                    state.text.push_str(text);
                    events.push(ParsedEvent::TextDelta(text.clone()));
                }
                Some(serde_json::Value::Array(parts)) => {
                    for part in parts {
                        if let Some(text) = part.get("text").and_then(serde_json::Value::as_str) {
                            state.text.push_str(text);
                            events.push(ParsedEvent::TextDelta(text.to_string()));
                        }
                    }
                }
                _ => {}
            }
        }
        return events;
    }

    match value.get("type").and_then(serde_json::Value::as_str) {
        Some("assistant") | Some("message") => {
            let content = value
                .get("message")
                .and_then(|message| message.get("content"))
                .or_else(|| value.get("content"))
                .cloned();
            match content {
                Some(serde_json::Value::Array(parts)) => {
                    for part in parts {
                        if part.get("type").and_then(serde_json::Value::as_str) == Some("text")
                            || part.get("type").is_none()
                        {
                            if let Some(text) = part.get("text").and_then(serde_json::Value::as_str)
                            {
                                state.text.push_str(text);
                                events.push(ParsedEvent::TextDelta(text.to_string()));
                            }
                        }
                    }
                }
                Some(serde_json::Value::String(text)) => {
                    state.text.push_str(&text);
                    events.push(ParsedEvent::TextDelta(text));
                }
                _ => {
                    if let Some(text) = value.get("text").and_then(serde_json::Value::as_str) {
                        state.text.push_str(text);
                        events.push(ParsedEvent::TextDelta(text.to_string()));
                    }
                }
            }
        }
        Some("text") | Some("output_text") => {
            if let Some(text) = value
                .get("text")
                .or_else(|| value.get("delta"))
                .and_then(serde_json::Value::as_str)
            {
                state.text.push_str(text);
                events.push(ParsedEvent::TextDelta(text.to_string()));
            }
        }
        Some("result") | Some("turn.completed") | Some("done") => {
            state.finished = true;
            if let Some(usage) = parse_usage(&value) {
                events.push(ParsedEvent::Usage(usage));
            }
            if let Some(true) = value.get("is_error").and_then(serde_json::Value::as_bool) {
                let message = value
                    .get("result")
                    .or_else(|| value.get("error"))
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("kimi reported an error")
                    .to_string();
                events.push(ParsedEvent::Error(message));
            }
            events.push(ParsedEvent::Done);
        }
        Some("error") => {
            state.finished = true;
            let message = value
                .get("message")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("kimi reported an error")
                .to_string();
            events.push(ParsedEvent::Error(message), );
            events.push(ParsedEvent::Done);
        }
        _ => {}
    }
    events
}

fn parse_usage(value: &serde_json::Value) -> Option<crate::protocol::Usage> {
    let usage = value.get("usage")?;
    let input = usage.get("input_tokens")?.as_u64()?;
    let output = usage
        .get("output_tokens")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(0);
    let cached = usage
        .get("cache_read_tokens")
        .or_else(|| usage.get("cached_input_tokens"))
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(0);
    let cache_write = usage
        .get("cache_write_tokens")
        .or_else(|| usage.get("cache_creation_input_tokens"))
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(0);
    Some(norm_usage(input, output, cached, cache_write))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argv_shape_resume_variants() {
        let fresh = argv("hi", Some("kimi-k3"), None, Path::new("/tmp"));
        assert_eq!(fresh[0..2], ["kimi", "-p"]);
        assert!(fresh.join(" ").contains("--output-format stream-json"));
        assert!(!fresh.join(" ").contains(" -c"));
        assert!(fresh.join(" ").contains("-m kimi-k3"));
        let resumed = argv("hi", None, Some("sess_x"), Path::new("/tmp")).join(" ");
        assert!(resumed.contains("-S sess_x"));
        assert!(!resumed.contains(" -c"));
    }

    #[test]
    fn parses_assistant_events_and_captures_session() {
        let mut state = DriverState::default();
        let events = parse_line(
            r#"{"type":"assistant","session_id":"ksess_1","message":{"content":[{"type":"text","text":"ok"}]}}"#,
            &mut state,
        );
        assert_eq!(state.text, "ok");
        assert!(events.contains(&ParsedEvent::TextDelta("ok".into())));
        assert!(events.contains(&ParsedEvent::SessionRef("ksess_1".into())));
    }

    #[test]
    fn parses_kimi_role_keyed_shape() {
        // Verified against kimi CLI 0.42.0 stream-json output: no `type`,
        // role-keyed, content a plain string; the resume ref rides the meta line.
        let mut state = DriverState::default();
        let events = parse_line(r#"{"role":"assistant","content":"ok"}"#, &mut state);
        assert_eq!(state.text, "ok");
        assert!(events.contains(&ParsedEvent::TextDelta("ok".into())));
        let events = parse_line(
            r#"{"role":"meta","type":"session.resume_hint","session_id":"session_abc","content":"To resume: kimi -r session_abc"}"#,
            &mut state,
        );
        assert_eq!(state.session_ref.as_deref(), Some("session_abc"));
        assert!(events.contains(&ParsedEvent::SessionRef("session_abc".into())));
        // A meta line contributes no text.
        assert_eq!(state.text, "ok");
    }

    #[test]
    fn non_json_lines_are_dropped() {
        // Deprecation warnings, spinner frames and prose hints are CLI noise,
        // never assistant text (same policy as the claude driver).
        let mut state = DriverState::default();
        assert!(parse_line("Warning: [loop_control] deprecated", &mut state).is_empty());
        assert!(parse_line("No sessions to continue; starting a fresh session.", &mut state).is_empty());
        assert!(parse_line("", &mut state).is_empty());
        assert!(state.text.is_empty());
    }

    #[test]
    fn parses_result_with_usage() {
        let mut state = DriverState::default();
        let events = parse_line(
            r#"{"type":"result","session":"ksess_2","is_error":false,"usage":{"input_tokens":60,"output_tokens":10,"cache_read_tokens":10}}"#,
            &mut state,
        );
        let usage = events
            .iter()
            .find_map(|event| match event {
                ParsedEvent::Usage(usage) => Some(usage.clone()),
                _ => None,
            })
            .expect("usage event");
        assert_eq!(usage.input_tokens, 50);
        assert_eq!(usage.total_tokens, 60);
        assert_eq!(state.session_ref.as_deref(), Some("ksess_2"));
        assert!(events.contains(&ParsedEvent::Done));
    }

    #[test]
    fn no_usage_means_none() {
        let mut state = DriverState::default();
        let events = parse_line(r#"{"type":"result","is_error":false}"#, &mut state);
        assert!(!events.iter().any(|event| matches!(event, ParsedEvent::Usage(_))));
        // The turn watcher may then leave response.usage null (allowed by T-05).
    }
}
