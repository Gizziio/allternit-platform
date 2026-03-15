//! SKILL.md Parser - OC-006
//!
//! Parses OpenClaw SKILL.md files with YAML frontmatter.
//!
//! SKILL.md Format:
//! ```markdown
//! ---
//! name: github
//! description: GitHub CLI integration
//! metadata:
//!   openclaw:
//!     emoji: "🐙"
//!     requires:
//!       anyBins: ["gh"]
//! ---
//!
//! # Skill documentation...
//! ```

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod frontmatter;
pub mod schema;

pub use frontmatter::parse_frontmatter;
pub use schema::{OpenClawMetadata, SkillManifest, SkillMetadata};

/// Parser errors
#[derive(Error, Debug)]
pub enum ParserError {
    #[error("Invalid frontmatter: {0}")]
    InvalidFrontmatter(String),

    #[error("YAML parse error: {0}")]
    YamlError(#[from] serde_yaml::Error),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid skill ID: {0}")]
    InvalidSkillId(String),
}

/// Parse a SKILL.md file
pub fn parse_skill_md(content: &str) -> Result<ParsedSkill, ParserError> {
    // Split frontmatter from content
    let (frontmatter, body) = split_frontmatter(content)?;

    // Parse YAML frontmatter
    let manifest: SkillManifest = parse_frontmatter(&frontmatter)?;

    // Validate required fields
    validate_manifest(&manifest)?;

    Ok(ParsedSkill {
        manifest,
        documentation: body.trim().to_string(),
    })
}

/// Split frontmatter from markdown body
fn split_frontmatter(content: &str) -> Result<(String, String), ParserError> {
    // Look for --- at start
    if !content.starts_with("---") {
        return Err(ParserError::InvalidFrontmatter(
            "SKILL.md must start with ---".to_string(),
        ));
    }

    // Find closing ---
    let rest = &content[3..];
    match rest.find("---") {
        Some(end) => {
            let frontmatter = rest[..end].trim().to_string();
            let body = rest[end + 3..].trim().to_string();
            Ok((frontmatter, body))
        }
        None => Err(ParserError::InvalidFrontmatter(
            "Frontmatter must end with ---".to_string(),
        )),
    }
}

/// Validate skill manifest
fn validate_manifest(manifest: &SkillManifest) -> Result<(), ParserError> {
    if manifest.name.is_empty() {
        return Err(ParserError::MissingField("name".to_string()));
    }

    if manifest.description.is_empty() {
        return Err(ParserError::MissingField("description".to_string()));
    }

    // Validate skill ID format (lowercase, alphanumeric, hyphens)
    if !manifest
        .name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(ParserError::InvalidSkillId(format!(
            "Skill name '{}' must be lowercase alphanumeric with hyphens",
            manifest.name
        )));
    }

    Ok(())
}

/// Parsed skill from SKILL.md
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedSkill {
    pub manifest: SkillManifest,
    pub documentation: String,
}

/// Load all skills from a directory
pub fn load_skills_dir(dir: &std::path::Path) -> Vec<Result<ParsedSkill, ParserError>> {
    let mut results = Vec::new();

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // Check if it's a directory containing SKILL.md
            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    match std::fs::read_to_string(&skill_md) {
                        Ok(content) => {
                            results.push(parse_skill_md(&content));
                        }
                        Err(e) => {
                            results.push(Err(ParserError::InvalidFrontmatter(format!(
                                "Failed to read {}: {}",
                                skill_md.display(),
                                e
                            ))));
                        }
                    }
                }
            }

            // Or a direct SKILL.md file
            if path.is_file() && path.file_name() == Some(std::ffi::OsStr::new("SKILL.md")) {
                match std::fs::read_to_string(&path) {
                    Ok(content) => {
                        results.push(parse_skill_md(&content));
                    }
                    Err(e) => {
                        results.push(Err(ParserError::InvalidFrontmatter(format!(
                            "Failed to read {}: {}",
                            path.display(),
                            e
                        ))));
                    }
                }
            }
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_skill_md() {
        let content = r#"---
name: github
description: GitHub CLI integration
metadata:
  openclaw:
    emoji: "🐙"
    requires:
      anyBins: ["gh"]
---

# GitHub Skill

This skill provides GitHub integration.
"#;

        let parsed = parse_skill_md(content).unwrap();

        assert_eq!(parsed.manifest.name, "github");
        assert_eq!(parsed.manifest.description, "GitHub CLI integration");
        assert!(parsed.documentation.contains("# GitHub Skill"));
    }

    #[test]
    fn test_missing_frontmatter() {
        let content = "Just markdown without frontmatter";

        let result = parse_skill_md(content);
        assert!(matches!(result, Err(ParserError::InvalidFrontmatter(_))));
    }

    #[test]
    fn test_invalid_skill_name() {
        let content = r#"---
name: GitHub
description: Invalid name with uppercase
---

# Content
"#;

        let result = parse_skill_md(content);
        assert!(matches!(result, Err(ParserError::InvalidSkillId(_))));
    }

    #[test]
    fn test_validate_manifest() {
        let valid = SkillManifest {
            name: "valid-skill".to_string(),
            description: "A valid skill".to_string(),
            metadata: None,
        };

        assert!(validate_manifest(&valid).is_ok());

        let invalid = SkillManifest {
            name: "".to_string(),
            description: "No name".to_string(),
            metadata: None,
        };

        assert!(validate_manifest(&invalid).is_err());
    }
}
