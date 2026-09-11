//! DeepSeek Harness (`dsh`) driver.
//!
//! Oracle: `_build_dsh` (~1630) returns `[python, dsh_driver.py, json.dumps(job)]`
//! with job `{prompt, model, cwd, session_id, ...}`. ao does not ship that
//! Python driver; the local binary is `dsh` and the same job object rides as
//! the last argv element so resume/cwd/model round-trip in one place.

use std::path::Path;

use crate::drivers::{parse_ndjson_line, DriverState, ParsedEvent};

pub fn argv(prompt: &str, model: Option<&str>, resume: Option<&str>, cwd: &Path) -> Vec<String> {
    let job = serde_json::json!({
        "prompt": prompt,
        "model": model.unwrap_or(""),
        "cwd": cwd.display().to_string(),
        "session_id": resume.unwrap_or(""),
    });
    vec!["dsh".to_string(), job.to_string()]
}

pub fn parse_line(line: &str, state: &mut DriverState) -> Vec<ParsedEvent> {
    parse_ndjson_line(line, state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argv_job_shape_from_build_dsh() {
        let args = argv("hi", Some("deepseek-chat"), Some("s1"), Path::new("/tmp/ws"));
        assert_eq!(args[0], "dsh");
        let job: serde_json::Value = serde_json::from_str(&args[1]).expect("job json");
        assert_eq!(job["prompt"], "hi");
        assert_eq!(job["model"], "deepseek-chat");
        assert_eq!(job["cwd"], "/tmp/ws");
        assert_eq!(job["session_id"], "s1");
    }

    #[test]
    fn fresh_session_id_is_empty() {
        let args = argv("hi", None, None, Path::new("/tmp"));
        let job: serde_json::Value = serde_json::from_str(&args[1]).unwrap();
        assert_eq!(job["session_id"], "");
        assert_eq!(job["model"], "");
    }
}
