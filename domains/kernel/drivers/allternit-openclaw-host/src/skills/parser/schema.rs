//! Skill Schema Definitions
//!
//! Defines the structure of SKILL.md files.

use serde::{Deserialize, Serialize};

/// Skill manifest from SKILL.md frontmatter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillManifest {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<SkillMetadata>,
}

/// Skill metadata (OpenClaw-specific)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    #[serde(rename = "openclaw")]
    pub openclaw: OpenClawMetadata,
}

/// OpenClaw-specific metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emoji: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires: Option<SkillRequirements>,
}

/// Skill requirements (binaries, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRequirements {
    #[serde(rename = "anyBins", skip_serializing_if = "Option::is_none")]
    pub any_bins: Option<Vec<String>>,
    #[serde(rename = "allBins", skip_serializing_if = "Option::is_none")]
    pub all_bins: Option<Vec<String>>,
}

/// Native skill manifest for Allternit skills
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeSkillManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: Option<String>,
    pub category: SkillCategory,
    pub capabilities: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_schema: Option<serde_json::Value>,
}

/// Skill categories
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum SkillCategory {
    System,
    Git,
    Build,
    Deploy,
    Monitor,
    Test,
    #[default]
    Other,
}

/// Conversion from OpenClaw manifest to Native manifest
pub fn to_native_manifest(
    openclaw: &SkillManifest,
    category: SkillCategory,
) -> NativeSkillManifest {
    NativeSkillManifest {
        id: openclaw.name.clone(),
        name: openclaw.name.clone(),
        description: openclaw.description.clone(),
        version: "0.1.0".to_string(),
        author: None,
        category,
        capabilities: Vec::new(),
        config_schema: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_manifest() {
        let yaml = r#"
name: github
description: GitHub integration
metadata:
  openclaw:
    emoji: "🐙"
    requires:
      anyBins:
        - gh
"#;

        let manifest: SkillManifest = serde_yaml::from_str(yaml).unwrap();

        assert_eq!(manifest.name, "github");
        assert_eq!(manifest.description, "GitHub integration");

        let metadata = manifest.metadata.unwrap();
        assert_eq!(metadata.openclaw.emoji, Some("🐙".to_string()));

        let requires = metadata.openclaw.requires.unwrap();
        assert_eq!(requires.any_bins, Some(vec!["gh".to_string()]));
    }

    #[test]
    fn test_to_native_manifest() {
        let openclaw = SkillManifest {
            name: "github".to_string(),
            description: "GitHub CLI".to_string(),
            metadata: None,
        };

        let native = to_native_manifest(&openclaw, SkillCategory::Git);

        assert_eq!(native.id, "github");
        assert_eq!(native.name, "github");
        assert_eq!(native.category, SkillCategory::Git);
        assert_eq!(native.version, "0.1.0");
    }

    #[test]
    fn test_skill_category_serialization() {
        assert_eq!(
            serde_json::to_string(&SkillCategory::System).unwrap(),
            "\"system\""
        );
        assert_eq!(
            serde_json::to_string(&SkillCategory::Git).unwrap(),
            "\"git\""
        );
    }
}
