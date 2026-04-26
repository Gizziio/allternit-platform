//! Allternit Skill Portability
//!
//! This crate provides skill portability across different LLM tools,
//! including Claude Code, OpenAI Codex, OpenCode, and Kimi.
//!
//! # Features
//!
//! - **Multi-LLM Support**: Sync skills to Claude, Codex, OpenCode, and Kimi
//! - **Unified API**: Single interface for all LLM tools
//! - **Flexible Scoping**: Install skills globally or per-workspace
//! - **Async/Await**: Fully asynchronous for high performance
//!
//! # Quick Start
//!
//! ```rust,no_run
//! use allternit_skill_portability::{SkillEngine, Skill, LLMType, SyncScope};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     // Create the engine
//!     let engine = SkillEngine::new();
//!
//!     // Create a skill
//!     let skill = Skill::new("my-skill", "# My Skill\n\nYou are a helpful assistant.");
//!
//!     // Install to multiple LLMs
//!     engine.install(
//!         &skill,
//!         &[LLMType::Claude, LLMType::Codex],
//!         SyncScope::Global,
//!     ).await?;
//!
//!     Ok(())
//! }
//! ```

pub mod drivers;
pub mod engine;
pub mod types;

// Re-export main types
pub use drivers::{all_drivers, get_driver, get_drivers};
pub use engine::{EngineConfig, SkillEngine};
pub use types::{
    derive_skill_name, global_config_dir, workspace_config_dir, LLMType, PortableSkill, Skill,
    SkillError, SkillId, SkillInstallation, SkillMetadata, SyncConfig, SyncResult, SyncScope,
};

// Re-export trait for custom drivers
pub use types::SkillDriver;

/// Crate version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Default skill file patterns
pub const DEFAULT_SKILL_PATTERNS: &[&str] = &[
    "*.md",
    "skills/*.md",
    "skills/*/SKILL.md",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }

    #[test]
    fn test_default_patterns() {
        assert_eq!(DEFAULT_SKILL_PATTERNS.len(), 3);
    }
}
