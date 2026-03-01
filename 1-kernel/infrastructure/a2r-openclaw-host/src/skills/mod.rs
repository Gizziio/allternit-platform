//! Skills Module - OC-006/OC-007
//!
//! SKILL.md parser, skill registry, and registry bridge for OpenClaw skill metadata bridge.
//!
//! ## Components
//!
//! - `parser`: SKILL.md YAML frontmatter parser
//! - `registry`: Skill registry for managing OpenClaw and A2R skills
//! - `bridge`: Adapter pattern bridge between OpenClaw and A2R skill registries
//!
//! ## Usage
//!
//! ```rust,ignore
//! use a2r_openclaw_host::skills::{SkillRegistry, parse_skill_md, SkillRegistryBridge};
//! use std::path::Path;
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! // Parse a single SKILL.md
//! let content = std::fs::read_to_string("SKILL.md")?;
//! let skill = parse_skill_md(&content)?;
//!
//! // Or load all skills from a directory
//! let mut registry = SkillRegistry::new();
//! registry.load_openclaw_skills(Path::new("3-adapters/vendor/openclaw/skills"))?;
//!
//! // Create bridge for interfacing with A2R
//! let bridge = SkillRegistryBridge::with_vendor_dir(Path::new("3-adapters/vendor/openclaw"))?;
//! # Ok(())
//! # }
//! ```

pub mod bridge;
pub mod parser;
pub mod registry;

pub use bridge::{
    GetSkillRequest, ListSkillsRequest, SkillDetail, SkillRegistryBridge, SkillSummary,
};
pub use parser::{load_skills_dir, parse_skill_md, ParsedSkill};
pub use registry::{RegistryError, RegistryStats, SkillInfo, SkillRegistry};
