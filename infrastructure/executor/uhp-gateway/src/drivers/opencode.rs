//! OpenCode CLI driver.
//!
//! Oracle: `_build_opencode` (~3746). Load-bearing: `--format json`, `--auto`
//! (permissions; nobody is attached to answer), `--pure` (plugins off so a
//! task cannot plant plugin_origins for the next turn), `--thinking`.
//! Prompt after `--` when it starts with `-`.

use std::path::Path;

use crate::drivers::{parse_ndjson_line, DriverState, ParsedEvent};

pub fn argv(prompt: &str, model: Option<&str>, resume: Option<&str>, _cwd: &Path) -> Vec<String> {
    let mut args = vec![
        "opencode".to_string(),
        "run".to_string(),
        "--format".to_string(),
        "json".to_string(),
        "--auto".to_string(),
        "--pure".to_string(),
        "--thinking".to_string(),
    ];
    // Catalog placeholders like `opencode/gpt-5` are not OpenCode model ids.
    // Omit --model unless the caller passed a real `provider/model` that the
    // local CLI is configured for; otherwise inherit the user's default (the
    // path that live-verified "ok" on this machine).
    if let Some(model) = model {
        if model.contains('/') && !model.starts_with("opencode/") {
            args.push("--model".to_string());
            args.push(model.to_string());
        }
    }
    if let Some(id) = resume {
        args.push("--session".to_string());
        args.push(id.to_string());
    }
    if prompt.starts_with('-') {
        args.push("--".to_string());
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
    fn argv_shape_from_build_opencode() {
        let fresh = argv("hi", Some("opencode/gpt-5"), None, Path::new("/tmp"));
        let joined = fresh.join(" ");
        assert_eq!(&fresh[0..2], &["opencode", "run"]);
        assert!(joined.contains("--format json"));
        assert!(joined.contains("--auto"));
        assert!(joined.contains("--pure"));
        assert!(joined.contains("--thinking"));
        assert!(
            !joined.contains("--model "),
            "catalog placeholder must not be passed as --model: {joined}"
        );
        assert!(joined.ends_with(" hi") || fresh.last().map(String::as_str) == Some("hi"));
        assert!(!joined.contains("--session"));
        let resumed = argv("hi", None, Some("ses_oc"), Path::new("/tmp")).join(" ");
        assert!(resumed.contains("--session ses_oc"));
        let dashed = argv("-not-a-flag", None, None, Path::new("/tmp"));
        assert!(dashed.windows(2).any(|w| w[0] == "--" && w[1] == "-not-a-flag"));
        let explicit = argv("hi", Some("anthropic/claude-sonnet-4"), None, Path::new("/tmp")).join(" ");
        assert!(explicit.contains("--model anthropic/claude-sonnet-4"));
    }
}
