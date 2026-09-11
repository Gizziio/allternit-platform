//! Cline CLI driver.
//!
//! Oracle: `_build_cline` (~3430). A prompt with no whitespace is parsed as a
//! subcommand unless a trailing newline is appended (verified on 3.0.60).
//! No resume flag: `--json --id <session>` refuses every way of passing a
//! prompt in that release, so follow-up turns start fresh over the same cwd.

use std::path::Path;

use crate::drivers::{parse_ndjson_line, DriverState, ParsedEvent};

pub fn argv(prompt: &str, model: Option<&str>, _resume: Option<&str>, cwd: &Path) -> Vec<String> {
    let prompt = if prompt.is_empty() || prompt.chars().any(char::is_whitespace) {
        prompt.to_string()
    } else {
        format!("{prompt}\n")
    };
    let mut args = vec![
        "cline".to_string(),
        prompt,
        "--json".to_string(),
        "--auto-approve".to_string(),
        "true".to_string(),
        "-c".to_string(),
        cwd.display().to_string(),
        "-P".to_string(),
        "openai-compatible".to_string(),
    ];
    if let Some(model) = model {
        args.push("-m".to_string());
        args.push(model.to_string());
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
    fn argv_shape_from_build_cline() {
        let fresh = argv("hello world", Some("gpt-4o"), None, Path::new("/tmp/ws"));
        assert_eq!(fresh[0], "cline");
        assert_eq!(fresh[1], "hello world");
        assert!(fresh.windows(2).any(|w| w[0] == "--json"));
        assert!(fresh.windows(2).any(|w| w[0] == "--auto-approve" && w[1] == "true"));
        assert!(fresh.windows(2).any(|w| w[0] == "-c" && w[1] == "/tmp/ws"));
        assert!(fresh.windows(2).any(|w| w[0] == "-P" && w[1] == "openai-compatible"));
        assert!(fresh.windows(2).any(|w| w[0] == "-m" && w[1] == "gpt-4o"));
        assert!(!fresh.iter().any(|a| a == "--id" || a.contains("resume")));
    }

    #[test]
    fn no_whitespace_prompt_gets_trailing_newline() {
        let args = argv("hi", None, None, Path::new("/tmp"));
        assert_eq!(args[1], "hi\n");
    }
}
