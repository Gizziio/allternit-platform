//! Skill Registry Bridge - OC-007
//!
//! Implements the adapter pattern to bridge OpenClaw's skill registry
//! with A2R's native skill registry interface.

use crate::skills::{RegistryError, SkillRegistry};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Request to list all skills
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListSkillsRequest {
    pub include_unavailable: bool,
}

/// Response from list skills request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListSkillsResponse {
    pub skills: Vec<SkillSummary>,
    pub total_count: usize,
}

/// Request to get a specific skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetSkillRequest {
    pub skill_id: String,
}

/// Response from get skill request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetSkillResponse {
    pub skill: Option<SkillDetail>,
}

/// Summary of a skill for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub available: bool,
    pub native_implemented: bool,
    pub bridge_active: bool,
}

/// Detailed skill information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDetail {
    pub id: String,
    pub name: String,
    pub description: String,
    pub available: bool,
    pub native_implemented: bool,
    pub bridge_active: bool,
    pub requires: Option<SkillRequirements>,
    pub documentation: Option<String>,
}

/// Skill requirements information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRequirements {
    pub binaries: Option<Vec<String>>,
}

/// Bridge adapter for skill registry
pub struct SkillRegistryBridge {
    registry: SkillRegistry,
}

impl SkillRegistryBridge {
    /// Create new bridge with a skill registry
    pub fn new(registry: SkillRegistry) -> Self {
        Self { registry }
    }

    /// Create new bridge and load OpenClaw skills from vendor directory
    pub fn with_vendor_dir(vendor_dir: &Path) -> Result<Self, RegistryError> {
        let mut registry = SkillRegistry::new();

        // Look for skills in the 'skills' subdirectory
        let skills_dir = vendor_dir.join("skills");
        registry.load_openclaw_skills(&skills_dir)?;

        Ok(Self { registry })
    }

    /// List all skills
    pub fn list_skills(
        &self,
        request: ListSkillsRequest,
    ) -> Result<ListSkillsResponse, RegistryError> {
        let all_skills = self.registry.list_skills();
        let total_count = all_skills.len();

        let skills: Vec<SkillSummary> = all_skills
            .into_iter()
            .filter(|skill| request.include_unavailable || skill.availability.is_available())
            .map(|skill| SkillSummary {
                id: skill.id.clone(),
                name: skill.manifest.name.clone(),
                description: skill.manifest.description.clone(),
                available: skill.availability.is_available(),
                native_implemented: skill.native_implemented,
                bridge_active: skill.bridge_active,
            })
            .collect();

        Ok(ListSkillsResponse {
            skills,
            total_count,
        })
    }

    /// Get a specific skill
    pub fn get_skill(&self, request: GetSkillRequest) -> Result<GetSkillResponse, RegistryError> {
        let skill_info = self.registry.get_skill(&request.skill_id);

        let skill_detail = skill_info.map(|info| {
            let requires = if let Some(ref metadata) = info.manifest.metadata {
                if let Some(ref openclaw_meta) = metadata.openclaw.requires {
                    let mut binaries = Vec::new();

                    if let Some(ref any_bins) = openclaw_meta.any_bins {
                        binaries.extend(any_bins.clone());
                    }
                    if let Some(ref all_bins) = openclaw_meta.all_bins {
                        binaries.extend(all_bins.clone());
                    }

                    if !binaries.is_empty() {
                        Some(SkillRequirements {
                            binaries: Some(binaries),
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            SkillDetail {
                id: info.id,
                name: info.manifest.name,
                description: info.manifest.description,
                available: info.availability.is_available(),
                native_implemented: info.native_implemented,
                bridge_active: info.bridge_active,
                requires,
                documentation: None, // Would come from SKILL.md body
            }
        });

        Ok(GetSkillResponse {
            skill: skill_detail,
        })
    }

    /// Check if a skill is available
    pub fn is_skill_available(&self, skill_id: &str) -> Result<bool, RegistryError> {
        match self.registry.get_skill(skill_id) {
            Some(info) => Ok(info.availability.is_available()),
            None => Err(RegistryError::SkillNotFound(skill_id.to_string())),
        }
    }

    /// Get the underlying registry
    pub fn registry(&self) -> &SkillRegistry {
        &self.registry
    }

    /// Get mutable access to the registry
    pub fn registry_mut(&mut self) -> &mut SkillRegistry {
        &mut self.registry
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_bridge_creation() {
        let registry = SkillRegistry::new();
        let bridge = SkillRegistryBridge::new(registry);

        assert_eq!(bridge.registry().stats().openclaw_count, 0);
    }

    #[test]
    fn test_list_skills_empty() {
        let registry = SkillRegistry::new();
        let bridge = SkillRegistryBridge::new(registry);

        let request = ListSkillsRequest {
            include_unavailable: true,
        };

        let response = bridge.list_skills(request).unwrap();
        assert_eq!(response.skills.len(), 0);
        assert_eq!(response.total_count, 0);
    }

    #[test]
    fn test_get_nonexistent_skill() {
        let registry = SkillRegistry::new();
        let bridge = SkillRegistryBridge::new(registry);

        let request = GetSkillRequest {
            skill_id: "nonexistent".to_string(),
        };

        let response = bridge.get_skill(request).unwrap();
        assert!(response.skill.is_none());
    }
}
