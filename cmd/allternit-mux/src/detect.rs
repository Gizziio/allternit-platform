//! Agent detection: manifest-based process matching + rendered-screen
//! heuristics. Blocked detection matches manifest rules against the bottom of
//! the pane's *rendered screen* (vt100), not raw byte scrollback.
//!
//! Additive observability only — the ADR-0044 sentinel-file contract remains
//! the authoritative completion signal for orchestrated runs.

use crate::manifest::AgentManifest;
use std::time::{Duration, Instant};

/// Semantic agent state reported by the mux.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentState {
    /// Output observed recently.
    Working,
    /// Known agent alive, no recent output.
    Idle,
    /// Screen bottom matches a manifest approval/question prompt rule.
    Blocked,
    /// Pane process exited.
    Done,
    /// No known agent detected in the pane.
    Unknown,
}

impl std::fmt::Display for AgentState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            AgentState::Working => "working",
            AgentState::Idle => "idle",
            AgentState::Blocked => "blocked",
            AgentState::Done => "done",
            AgentState::Unknown => "unknown",
        };
        f.write_str(s)
    }
}

/// How recent output must be to count as `working`.
const WORKING_WINDOW: Duration = Duration::from_secs(2);

/// Per-pane detection state.
pub struct Detector {
    /// Detected agent label (None = unknown).
    pub agent: Option<String>,
    /// Manifest rules for the detected agent (None when unknown).
    manifest: Option<AgentManifest>,
    last_output: Option<Instant>,
}

impl Detector {
    pub fn new(manifest: Option<AgentManifest>) -> Self {
        Self {
            agent: manifest.as_ref().map(|m| m.agent.clone()),
            manifest,
            last_output: None,
        }
    }

    /// Feed output bytes into the detector (activity timing only; screen text
    /// is owned by the pane's vt100 parser).
    pub fn on_output(&mut self, _data: &[u8]) {
        self.last_output = Some(Instant::now());
    }

    /// Current state for a pane, given the bottom of its rendered screen.
    pub fn state(&self, exited: bool, screen_bottom: &str) -> AgentState {
        if exited {
            return AgentState::Done;
        }
        let Some(manifest) = &self.manifest else {
            return AgentState::Unknown;
        };
        let trimmed = screen_bottom.trim_end();
        for pat in &manifest.blocked_patterns {
            if pat.is_match(trimmed) {
                return AgentState::Blocked;
            }
        }
        match self.last_output {
            Some(t) if t.elapsed() < WORKING_WINDOW => AgentState::Working,
            _ => AgentState::Idle,
        }
    }

    /// Why the state is what it is (for explainability).
    pub fn reason(&self, exited: bool, screen_bottom: &str) -> String {
        if exited {
            return "pane process exited".to_string();
        }
        if self.manifest.is_none() {
            return "no known agent process detected".to_string();
        }
        match self.state(exited, screen_bottom) {
            AgentState::Blocked => {
                "screen bottom matches manifest approval/question rule".to_string()
            }
            AgentState::Working => "output observed within the last 2s".to_string(),
            AgentState::Idle => "known agent alive, no recent output".to_string(),
            other => format!("{other}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::ManifestSet;

    fn detector_for(cmd: &str) -> Detector {
        let set = ManifestSet::load(std::path::Path::new("/nonexistent-mux-state"));
        Detector::new(set.match_command(cmd).cloned())
    }

    #[test]
    fn working_then_idle() {
        let mut d = detector_for("kimi");
        assert_eq!(d.agent.as_deref(), Some("kimi"));
        d.on_output(b"hello");
        assert_eq!(d.state(false, ""), AgentState::Working);
        d.last_output = Some(Instant::now() - Duration::from_secs(10));
        assert_eq!(d.state(false, ""), AgentState::Idle);
    }

    #[test]
    fn blocked_on_screen_prompt() {
        let mut d = detector_for("claude");
        d.on_output(b"noise");
        d.last_output = Some(Instant::now() - Duration::from_secs(10));
        assert_eq!(
            d.state(false, "Do you want to proceed?"),
            AgentState::Blocked
        );
        // Same text must NOT match mid-screen noise rules when not at bottom:
        assert_eq!(d.state(false, "all quiet"), AgentState::Idle);
    }

    #[test]
    fn done_when_exited() {
        let d = detector_for("kimi");
        assert_eq!(d.state(true, "anything"), AgentState::Done);
    }

    #[test]
    fn unknown_without_agent() {
        let d = detector_for("sleep 100");
        assert_eq!(d.state(false, ""), AgentState::Unknown);
    }
}
