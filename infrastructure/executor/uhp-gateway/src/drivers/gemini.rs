//! Gemini CLI driver.
//!
//! Oracle: `_build_gemini` (~3333). Load-bearing: `--approval-mode yolo` and
//! `--skip-trust` (fresh workspace hangs on the folder-trust prompt without
//! them). Resume takes only `"latest"` (not an arbitrary id) because HOME is
//! redirected into the workspace — one project history, so latest == this session.

use std::path::Path;

use crate::drivers::{parse_ndjson_line, DriverState, ParsedEvent};

pub fn argv(prompt: &str, model: Option<&str>, resume: Option<&str>, _cwd: &Path) -> Vec<String> {
    let mut args = vec![
        "gemini".to_string(),
        "-p".to_string(),
        prompt.to_string(),
        "-o".to_string(),
        "stream-json".to_string(),
        "--approval-mode".to_string(),
        "yolo".to_string(),
        "--skip-trust".to_string(),
    ];
    if let Some(model) = model {
        args.push("-m".to_string());
        args.push(model.to_string());
    }
    if resume.is_some() {
        args.push("--resume".to_string());
        args.push("latest".to_string());
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
    fn argv_shape_from_build_gemini() {
        let fresh = argv("hi", Some("gemini-2.5-pro"), None, Path::new("/tmp")).join(" ");
        assert!(fresh.starts_with("gemini -p hi"));
        assert!(fresh.contains("-o stream-json"));
        assert!(fresh.contains("--approval-mode yolo"));
        assert!(fresh.contains("--skip-trust"));
        assert!(!fresh.contains("--resume"));
        let resumed = argv("hi", None, Some("ignored-id"), Path::new("/tmp")).join(" ");
        assert!(resumed.contains("--resume latest"));
        assert!(!resumed.contains("ignored-id"));
    }
}
