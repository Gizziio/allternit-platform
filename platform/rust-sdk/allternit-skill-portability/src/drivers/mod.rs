//! Skill driver implementations
//!
//! This module provides the `SkillDriver` trait and implementations for various
//! AI coding tools (Claude Code, Codex, Kimi, Antigravity, Grok, Cursor, Gizzi Code).

mod antigravity;
mod claude;
mod codex;
mod cursor;
mod gizzi;
mod grok;
mod kimi;

pub use antigravity::AntigravityDriver;
pub use claude::ClaudeDriver;
pub use codex::CodexDriver;
pub use cursor::CursorDriver;
pub use gizzi::GizziDriver;
pub use grok::GrokDriver;
pub use kimi::KimiDriver;

use crate::types::{LLMType, SkillDriver};

/// Get a driver by LLM type
pub fn get_driver(llm: LLMType) -> Box<dyn SkillDriver> {
    match llm {
        LLMType::Claude => Box::new(ClaudeDriver),
        LLMType::Codex => Box::new(CodexDriver),
        LLMType::Kimi => Box::new(KimiDriver),
        LLMType::Antigravity => Box::new(AntigravityDriver),
        LLMType::Grok => Box::new(GrokDriver),
        LLMType::Cursor => Box::new(CursorDriver),
        LLMType::Gizzi => Box::new(GizziDriver),
    }
}

/// Get all available drivers
pub fn all_drivers() -> Vec<Box<dyn SkillDriver>> {
    vec![
        Box::new(ClaudeDriver),
        Box::new(CodexDriver),
        Box::new(KimiDriver),
        Box::new(AntigravityDriver),
        Box::new(GrokDriver),
        Box::new(CursorDriver),
        Box::new(GizziDriver),
    ]
}

/// Get drivers for specific LLM types
pub fn get_drivers(llms: &[LLMType]) -> Vec<Box<dyn SkillDriver>> {
    llms.iter().map(|&llm| get_driver(llm)).collect()
}
