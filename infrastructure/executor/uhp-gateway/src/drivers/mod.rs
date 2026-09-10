//! CLI-agent drivers: argv construction and incremental NDJSON line parsing
//! for the three supported backends. Logic ported from
//! `vendor/harnessrouter-ce/runner/server.py` (_build_claude, _build_codex,
//! _norm_token_usage) and `docs/UHP_VENDOR_INVENTORY.md` driver notes.

use std::path::Path;

use crate::protocol::Usage;

pub mod claude;
pub mod codex;
pub mod kimi;

/// Engine the harness `base` maps to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DriverKind {
    Kimi,
    Claude,
    Codex,
}

impl DriverKind {
    pub fn from_base(base: &str) -> Option<Self> {
        match base {
            "kimi" | "kimi-code" => Some(Self::Kimi),
            "claude" | "claude-code" => Some(Self::Claude),
            "codex" => Some(Self::Codex),
            _ => None,
        }
    }

    pub fn binary(&self) -> &'static str {
        match self {
            Self::Kimi => "kimi",
            Self::Claude => "claude",
            Self::Codex => "codex",
        }
    }

    /// One-shot headless argv; the prompt rides a flag, never typed input.
    /// `resume` is the driver-native session ref captured from turn N-1.
    /// `model` is the final (already substituted) model, if any.
    pub fn argv(
        &self,
        prompt: &str,
        model: Option<&str>,
        resume: Option<&str>,
        cwd: &Path,
    ) -> Vec<String> {
        match self {
            Self::Kimi => kimi::argv(prompt, model, resume, cwd),
            Self::Claude => claude::argv(prompt, model, resume, cwd),
            Self::Codex => codex::argv(prompt, model, resume, cwd),
        }
    }

    /// Parse one complete output line; tolerant of noise. `state` accumulates
    /// text and the driver-native session ref across the turn.
    pub fn parse_line(&self, line: &str, state: &mut DriverState) -> Vec<ParsedEvent> {
        match self {
            Self::Kimi => kimi::parse_line(line, state),
            Self::Claude => claude::parse_line(line, state),
            Self::Codex => codex::parse_line(line, state),
        }
    }
}

/// Per-turn accumulation shared by all drivers.
#[derive(Debug, Default)]
pub struct DriverState {
    /// Final assistant text assembled so far.
    pub text: String,
    /// Driver-native session id (claude session_id, kimi session, ...) for resume.
    pub session_ref: Option<String>,
    /// Set once the driver's terminal event has been seen.
    pub finished: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ParsedEvent {
    TextDelta(String),
    Usage(Usage),
    Error(String),
    SessionRef(String),
    /// The driver's own terminal marker (claude `result`, codex
    /// `turn.completed`). The turn watcher still waits for the workspace to
    /// disappear before reporting terminal status.
    Done,
}

/// Normalize usage to UHP shape: `input_tokens` is fresh input only
/// (cache-read subtracted — upstream `_norm_token_usage` semantics),
/// `total_tokens = input + output`.
pub fn norm_usage(input: u64, output: u64, cache_read: u64, cache_write: u64) -> Usage {
    let fresh_input = input.saturating_sub(cache_read);
    Usage {
        input_tokens: fresh_input,
        output_tokens: output,
        total_tokens: fresh_input + output,
        cache_read_tokens: cache_read,
        cache_write_tokens: cache_write,
    }
}
