//! Pi coding-agent CLI driver (`@earendil-works/pi-coding-agent`).
//!
//! Oracle: `_build_pi` (~1861). Load-bearing: `--mode json`, `--approve`
//! (sandbox is the trust boundary), `--no-extensions` (a task could drop
//! `.pi/extensions/` and have the next turn execute it). Prompt is the last
//! argv element. Resume is `--session-id`.

use std::path::Path;

use crate::drivers::{parse_ndjson_line, DriverState, ParsedEvent};

pub fn argv(prompt: &str, model: Option<&str>, resume: Option<&str>, _cwd: &Path) -> Vec<String> {
    let mut args = vec![
        "pi".to_string(),
        "-p".to_string(),
        "--mode".to_string(),
        "json".to_string(),
        "--approve".to_string(),
        "--no-extensions".to_string(),
    ];
    if let Some(model) = model {
        args.push("--model".to_string());
        args.push(model.to_string());
    }
    if let Some(id) = resume {
        args.push("--session-id".to_string());
        args.push(id.to_string());
    }
    args.push(prompt.to_string());
    args
}

pub fn parse_line(line: &str, state: &mut DriverState) -> Vec<ParsedEvent> {
    parse_ndjson_line(line, state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argv_shape_from_build_pi() {
        let fresh = argv("hi", Some("sonnet"), None, Path::new("/tmp"));
        assert_eq!(fresh[0], "pi");
        assert_eq!(fresh.last().map(String::as_str), Some("hi"));
        let joined = fresh.join(" ");
        assert!(joined.contains("-p"));
        assert!(joined.contains("--mode json"));
        assert!(joined.contains("--approve"));
        assert!(joined.contains("--no-extensions"));
        assert!(joined.contains("--model sonnet"));
        assert!(!joined.contains("--session-id"));
        let resumed = argv("hi", None, Some("pi_sess"), Path::new("/tmp")).join(" ");
        assert!(resumed.contains("--session-id pi_sess"));
    }
}
