//! Frontmatter Parser
//!
//! Parses YAML or JSON frontmatter from SKILL.md files.

use super::{ParserError, SkillManifest};

/// Parse YAML or JSON frontmatter into SkillManifest
pub fn parse_frontmatter(content: &str) -> Result<SkillManifest, ParserError> {
    // First try to parse as YAML
    match serde_yaml::from_str::<SkillManifest>(content) {
        Ok(manifest) => Ok(manifest),
        Err(yaml_err) => {
            // If YAML fails, try JSON
            match serde_json::from_str::<SkillManifest>(content) {
                Ok(manifest) => Ok(manifest),
                Err(json_err) => {
                    // Return both errors for better debugging
                    Err(ParserError::InvalidFrontmatter(format!(
                        "Failed to parse as YAML: {}\nFailed to parse as JSON: {}",
                        yaml_err, json_err
                    )))
                }
            }
        }
    }
}

/// Serialize SkillManifest to YAML frontmatter
pub fn to_frontmatter(manifest: &SkillManifest) -> Result<String, ParserError> {
    let yaml = serde_yaml::to_string(manifest)?;
    Ok(format!("---\n{}---\n", yaml))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::parser::schema::{OpenClawMetadata, SkillMetadata};

    #[test]
    fn test_parse_frontmatter() {
        let yaml = r#"
name: github
description: GitHub CLI integration
metadata:
  openclaw:
    emoji: "🐙"
    requires:
      anyBins:
        - gh
"#;

        let manifest = parse_frontmatter(yaml).unwrap();

        assert_eq!(manifest.name, "github");
        assert_eq!(manifest.description, "GitHub CLI integration");
        assert!(manifest.metadata.is_some());
    }

    #[test]
    fn test_to_frontmatter() {
        let manifest = SkillManifest {
            name: "test".to_string(),
            description: "Test skill".to_string(),
            metadata: Some(SkillMetadata {
                openclaw: OpenClawMetadata {
                    emoji: Some("🧪".to_string()),
                    requires: None,
                },
            }),
        };

        let yaml = to_frontmatter(&manifest).unwrap();

        assert!(yaml.contains("name: test"));
        assert!(yaml.contains("description: Test skill"));
        assert!(yaml.contains("---"));
    }
}
