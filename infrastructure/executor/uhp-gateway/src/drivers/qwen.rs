//! Qwen Code CLI driver.
//!
//! Oracle: `vendor/harnessrouter-ce/runner/server.py` `_build_qwen` (~3183).
//! Load-bearing flags (verified upstream on 0.22.1): `-o stream-json`,
//! `--auth-type openai` (resume dies without it), `--yolo` (otherwise no
//! shell/write/edit tools in headless mode).

use std::path::Path;

use crate::drivers::{parse_ndjson_line, DriverState, ParsedEvent};

pub fn argv(prompt: &str, model: Option<&str>, resume: Option<&str>, _cwd: &Path) -> Vec<String> {
    let mut args = vec![
        "qwen".to_string(),
        "-p".to_string(),
        prompt.to_string(),
        "-o".to_string(),
        "stream-json".to_string(),
        "--auth-type".to_string(),
        "openai".to_string(),
        "--yolo".to_string(),
    ];
    if let Some(model) = model {
        args.push("-m".to_string());
        args.push(model.to_string());
    }
    if let Some(id) = resume {
        args.push("-r".to_string());
        args.push(id.to_string());
    }
    args
}

pub fn parse_line(line: &str, state: &mut DriverState) -> Vec<ParsedEvent> {
    parse_ndjson_line(line, state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argv_shape_from_build_qwen() {
        let fresh = argv("hi", Some("qwen3-coder"), None, Path::new("/tmp"));
        let joined = fresh.join(" ");
        assert_eq!(fresh[0], "qwen");
        assert!(joined.contains("-p hi"));
        assert!(joined.contains("-o stream-json"));
        assert!(joined.contains("--auth-type openai"));
        assert!(joined.contains("--yolo"));
        assert!(joined.contains("-m qwen3-coder"));
        assert!(!joined.contains(" -r "));
        let resumed = argv("hi", None, Some("sess_q"), Path::new("/tmp")).join(" ");
        assert!(resumed.contains("-r sess_q"));
    }

    #[test]
    fn parses_assistant_and_session() {
        let mut state = DriverState::default();
        let events = parse_line(
            r#"{"type":"assistant","session_id":"qs_1","message":{"content":[{"type":"text","text":"ok"}]}}"#,
            &mut state,
        );
        assert_eq!(state.text, "ok");
        assert!(events.contains(&ParsedEvent::TextDelta("ok".into())));
        assert_eq!(state.session_ref.as_deref(), Some("qs_1"));
    }
}
