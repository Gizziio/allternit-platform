//! Skill driver implementations
//!
//! This module provides the `SkillDriver` trait and implementations for various
//! AI coding tools (Claude Code, Codex, Kimi, Antigravity).

mod claude;
mod codex;
mod kimi;

pub use claude::ClaudeDriver;
pub use codex::CodexDriver;
pub use kimi::KimiDriver;

use crate::types::{LLMType, SkillDriver};

/// Get a driver by LLM type
pub fn get_driver(llm: LLMType) -> Box<dyn SkillDriver> {
    match llm {
        LLMType::Claude => Box::new(ClaudeDriver),
        LLMType::Codex => Box::new(CodexDriver),
        LLMType::Kimi => Box::new(KimiDriver),
        LLMType::Antigravity => {
            // For now, Antigravity uses similar structure to Claude
            Box::new(ClaudeDriver)
        }
    }
}

/// Get all available drivers
pub fn all_drivers() -> Vec<Box<dyn SkillDriver>> {
    vec![
        Box::new(ClaudeDriver),
        Box::new(CodexDriver),
        Box::new(KimiDriver),
    ]
}

/// Get drivers for specific LLM types
pub fn get_drivers(llms: &[LLMType]) -> Vec<Box<dyn SkillDriver>> {
    llms.iter().map(|&llm| get_driver(llm)).collect()
}
