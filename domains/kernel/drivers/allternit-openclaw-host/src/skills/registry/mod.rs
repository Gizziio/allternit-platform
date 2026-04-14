//! Skill Registry - OC-006
//!
//! Bridge between OpenClaw skills and A2R native skills.
//!
//! Responsibilities:
//! - Load OpenClaw SKILL.md metadata
//! - Map OpenClaw skills to A2R skills
//! - Track skill availability (OpenClaw vs Native vs Bridge)
//! - Provide unified skill lookup

use crate::skills::parser::{load_skills_dir, ParsedSkill, SkillManifest};
use std::collections::HashMap;
use std::path::Path;
use thiserror::Error;

pub mod availability;
pub mod mapping;

pub use availability::{AvailabilityChecker, SkillAvailability};
pub use mapping::{SkillMapper, SkillMapping};

/// Registry errors
#[derive(Error, Debug)]
pub enum RegistryError {
    #[error("Skill not found: {0}")]
    SkillNotFound(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Unified skill information
#[derive(Debug, Clone)]
pub struct SkillInfo {
    pub id: String,
    pub manifest: SkillManifest,
    pub availability: SkillAvailability,
    pub native_implemented: bool,
    pub bridge_active: bool,
}

/// Skill registry - central hub for skill management
#[derive(Debug)]
pub struct SkillRegistry {
    /// Skills loaded from OpenClaw SKILL.md files
    openclaw_skills: HashMap<String, ParsedSkill>,
    /// Skills natively implemented in A2R
    native_skills: HashMap<String, SkillManifest>,
    /// Availability checker
    availability_checker: AvailabilityChecker,
    /// Skill mapper
    mapper: SkillMapper,
}

impl SkillRegistry {
    /// Create new empty registry
    pub fn new() -> Self {
        Self {
            openclaw_skills: HashMap::new(),
            native_skills: HashMap::new(),
            availability_checker: AvailabilityChecker::new(),
            mapper: SkillMapper::new(),
        }
    }

    /// Load skills from OpenClaw vendor directory
    pub fn load_openclaw_skills(&mut self, vendor_dir: &Path) -> Result<usize, RegistryError> {
        let results = load_skills_dir(vendor_dir);
        let mut count = 0;

        for result in results {
            match result {
                Ok(skill) => {
                    self.openclaw_skills
                        .insert(skill.manifest.name.clone(), skill);
                    count += 1;
                }
                Err(e) => {
                    eprintln!("Warning: Failed to parse skill: {}", e);
                }
            }
        }

        Ok(count)
    }

    /// Register a native A2R skill
    pub fn register_native_skill(&mut self, manifest: SkillManifest) {
        self.native_skills.insert(manifest.name.clone(), manifest);
    }

    /// Get skill info by ID
    pub fn get_skill(&self, id: &str) -> Option<SkillInfo> {
        let openclaw = self.openclaw_skills.get(id);
        let native = self.native_skills.get(id);

        if openclaw.is_none() && native.is_none() {
            return None;
        }

        // Determine manifest and availability
        let manifest = native
            .cloned()
            .or_else(|| openclaw.map(|s| s.manifest.clone()))?;

        let availability = self.availability_checker.check(id, &manifest);
        let native_implemented = native.is_some();
        let bridge_active = openclaw.is_some() && native.is_some();

        Some(SkillInfo {
            id: id.to_string(),
            manifest,
            availability,
            native_implemented,
            bridge_active,
        })
    }

    /// List all available skills
    pub fn list_skills(&self) -> Vec<SkillInfo> {
        let all_ids: std::collections::HashSet<_> = self
            .openclaw_skills
            .keys()
            .chain(self.native_skills.keys())
            .cloned()
            .collect();

        all_ids.iter().filter_map(|id| self.get_skill(id)).collect()
    }

    /// Get skills by availability
    pub fn get_skills_by_availability(&self, availability: SkillAvailability) -> Vec<SkillInfo> {
        self.list_skills()
            .into_iter()
            .filter(|s| s.availability == availability)
            .collect()
    }

    /// Check if skill is in bridge mode
    pub fn is_bridge_active(&self, id: &str) -> bool {
        self.openclaw_skills.contains_key(id) && self.native_skills.contains_key(id)
    }

    /// Get OpenClaw skill manifest
    pub fn get_openclaw_skill(&self, id: &str) -> Option<&ParsedSkill> {
        self.openclaw_skills.get(id)
    }

    /// Get native skill manifest
    pub fn get_native_skill(&self, id: &str) -> Option<&SkillManifest> {
        self.native_skills.get(id)
    }

    /// Get stats about the registry
    pub fn stats(&self) -> RegistryStats {
        RegistryStats {
            openclaw_count: self.openclaw_skills.len(),
            native_count: self.native_skills.len(),
            bridge_count: self
                .openclaw_skills
                .keys()
                .filter(|k| self.native_skills.contains_key(*k))
                .count(),
        }
    }
}

impl Default for SkillRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Registry statistics
#[derive(Debug, Clone, Copy)]
pub struct RegistryStats {
    pub openclaw_count: usize,
    pub native_count: usize,
    pub bridge_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_registry() {
        let registry = SkillRegistry::new();

        assert_eq!(registry.stats().openclaw_count, 0);
        assert_eq!(registry.stats().native_count, 0);
        assert!(registry.get_skill("nonexistent").is_none());
    }

    #[test]
    fn test_register_native_skill() {
        let mut registry = SkillRegistry::new();

        let manifest = SkillManifest {
            name: "test".to_string(),
            description: "Test skill".to_string(),
            metadata: None,
        };

        registry.register_native_skill(manifest.clone());

        assert_eq!(registry.stats().native_count, 1);
        assert!(registry.get_skill("test").is_some());
        assert!(registry.get_skill("test").unwrap().native_implemented);
    }
}
