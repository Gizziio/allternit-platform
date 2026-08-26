//! Executor specification: what to run, where, and how completion is signalled.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Description of an executor session to be spawned by the orchestrator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorSpec {
    /// Human- and machine-readable identifier for this executor run.
    pub slug: String,
    /// Vendor of the agent runtime (e.g. `allternit`, `anthropic`, `openai`).
    pub vendor: String,
    /// Execution mode: `fresh`, `shared`, or vendor-specific values.
    pub mode: String,
    /// Launch command as an argv vector.
    pub command: Vec<String>,
    /// Working directory for the executor process.
    pub workdir: PathBuf,
    /// Isolation policy: `workspace`, `container`, `none`, etc.
    #[serde(default)]
    pub isolation: String,
    /// Optional task-file path passed to the executor.
    #[serde(default)]
    pub task_file: Option<PathBuf>,
    /// ADR-0044 completion sentinel. The executor creates this file when it
    /// has finished and emitted its notes.
    pub notes_sentinel: PathBuf,
}

impl ExecutorSpec {
    /// Resolve a possibly-relative sentinel against the executor workdir.
    pub fn resolved_notes_sentinel(&self) -> PathBuf {
        if self.notes_sentinel.is_absolute() {
            self.notes_sentinel.clone()
        } else {
            self.workdir.join(&self.notes_sentinel)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_absolute_sentinel_unchanged() {
        let spec = ExecutorSpec {
            slug: "test".to_string(),
            vendor: "allternit".to_string(),
            mode: "shared".to_string(),
            command: vec!["echo".to_string()],
            workdir: PathBuf::from("/tmp/wd"),
            isolation: "none".to_string(),
            task_file: None,
            notes_sentinel: PathBuf::from("/tmp/done.sentinel"),
        };
        assert_eq!(spec.resolved_notes_sentinel(), PathBuf::from("/tmp/done.sentinel"));
    }

    #[test]
    fn resolves_relative_sentinel_against_workdir() {
        let spec = ExecutorSpec {
            slug: "test".to_string(),
            vendor: "allternit".to_string(),
            mode: "shared".to_string(),
            command: vec!["echo".to_string()],
            workdir: PathBuf::from("/tmp/wd"),
            isolation: "none".to_string(),
            task_file: None,
            notes_sentinel: PathBuf::from("done.sentinel"),
        };
        assert_eq!(
            spec.resolved_notes_sentinel(),
            PathBuf::from("/tmp/wd/done.sentinel")
        );
    }
}
