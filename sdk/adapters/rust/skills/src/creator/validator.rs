//! Skill Validator - Validation logic for skill creation
//!
//! Validates skill structure, manifest format, and content requirements
//! before packaging and distribution.

use super::CreatorError;
use std::path::Path;

/// Validator for skills
pub struct SkillValidator {
    /// Maximum size for SKILL.md in bytes (500KB)
    max_skill_md_size: usize,
    /// Required files
    required_files: Vec<String>,
    /// Allowed file extensions in scripts
    allowed_script_extensions: Vec<String>,
}

impl SkillValidator {
    /// Create a new skill validator with default settings
    pub fn new() -> Self {
        Self {
            max_skill_md_size: 500 * 1024, // 500KB
            required_files: vec!["SKILL.md".to_string()],
            allowed_script_extensions: vec![
                "py".to_string(),
                "js".to_string(),
                "ts".to_string(),
                "rs".to_string(),
                "sh".to_string(),
                "bash".to_string(),
            ],
        }
    }

    /// Create a validator with custom settings
    pub fn with_limits(max_skill_md_size: usize) -> Self {
        Self {
            max_skill_md_size,
            required_files: vec!["SKILL.md".to_string()],
            allowed_script_extensions: vec![
                "py".to_string(),
                "js".to_string(),
                "ts".to_string(),
                "rs".to_string(),
                "sh".to_string(),
                "bash".to_string(),
            ],
        }
    }

    /// Validate a skill directory
    pub fn validate_skill_directory(&self, skill_dir: &Path) -> Result<(), CreatorError> {
        // Check required files
        for required in &self.required_files {
            let path = skill_dir.join(required);
            if !path.exists() {
                return Err(CreatorError::Validation(format!(
                    "Required file missing: {}",
                    required
                )));
            }
        }

        // Validate SKILL.md
        self.validate_skill_md(&skill_dir.join("SKILL.md"))?;

        // Validate scripts directory if it exists
        let scripts_dir = skill_dir.join("scripts");
        if scripts_dir.exists() {
            self.validate_scripts_directory(&scripts_dir)?;
        }

        // Validate references directory if it exists
        let references_dir = skill_dir.join("references");
        if references_dir.exists() {
            self.validate_references_directory(&references_dir)?;
        }

        // Validate assets directory if it exists
        let assets_dir = skill_dir.join("assets");
        if assets_dir.exists() {
            self.validate_assets_directory(&assets_dir)?;
        }

        // Check for forbidden files
        self.check_forbidden_files(skill_dir)?;

        Ok(())
    }

    /// Validate SKILL.md file
    fn validate_skill_md(&self, skill_md_path: &Path) -> Result<(), CreatorError> {
        use std::fs;

        // Check file exists
        if !skill_md_path.exists() {
            return Err(CreatorError::Validation("SKILL.md is required".to_string()));
        }

        // Check file size
        let metadata = fs::metadata(skill_md_path).map_err(CreatorError::Io)?;
        if metadata.len() as usize > self.max_skill_md_size {
            return Err(CreatorError::Validation(format!(
                "SKILL.md exceeds maximum size of {} bytes",
                self.max_skill_md_size
            )));
        }

        // Read and validate content
        let content = fs::read_to_string(skill_md_path).map_err(CreatorError::Io)?;

        // Check for YAML frontmatter
        if !content.starts_with("---") {
            return Err(CreatorError::Validation(
                "SKILL.md must start with YAML frontmatter (---)".to_string(),
            ));
        }

        // Parse frontmatter
        let frontmatter_end = content[3..].find("---");
        if frontmatter_end.is_none() {
            return Err(CreatorError::Validation(
                "SKILL.md YAML frontmatter not properly closed".to_string(),
            ));
        }

        let frontmatter = &content[3..frontmatter_end.unwrap() + 3];

        // Validate required frontmatter fields
        if !frontmatter.contains("name:") {
            return Err(CreatorError::Validation(
                "SKILL.md frontmatter must contain 'name' field".to_string(),
            ));
        }

        if !frontmatter.contains("description:") {
            return Err(CreatorError::Validation(
                "SKILL.md frontmatter must contain 'description' field".to_string(),
            ));
        }

        // Validate frontmatter doesn't contain extra fields
        let allowed_fields = ["name", "description"];
        for line in frontmatter.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some(colon_pos) = line.find(':') {
                let key = &line[..colon_pos].trim();
                if !allowed_fields.contains(key) {
                    return Err(CreatorError::Validation(format!(
                        "SKILL.md frontmatter contains invalid field: {}. Only 'name' and 'description' are allowed.",
                        key
                    )));
                }
            }
        }

        // Check markdown body is not empty
        let body = &content[frontmatter_end.unwrap() + 6..];
        if body.trim().is_empty() {
            return Err(CreatorError::Validation(
                "SKILL.md body cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate scripts directory
    fn validate_scripts_directory(&self, scripts_dir: &Path) -> Result<(), CreatorError> {
        use std::fs;

        let entries = fs::read_dir(scripts_dir).map_err(CreatorError::Io)?;

        for entry in entries {
            let entry = entry.map_err(CreatorError::Io)?;
            let path = entry.path();

            if path.is_file() {
                // Check extension
                if let Some(ext) = path.extension() {
                    let ext = ext.to_string_lossy().to_string();
                    if !self.allowed_script_extensions.contains(&ext) {
                        return Err(CreatorError::Validation(format!(
                            "Script file with unsupported extension: {:?}",
                            path.file_name().unwrap_or_default()
                        )));
                    }
                }

                // Check file is not empty
                let metadata = fs::metadata(&path).map_err(CreatorError::Io)?;
                if metadata.len() == 0 {
                    return Err(CreatorError::Validation(format!(
                        "Script file is empty: {:?}",
                        path.file_name().unwrap_or_default()
                    )));
                }
            }
        }

        Ok(())
    }

    /// Validate references directory
    fn validate_references_directory(&self, references_dir: &Path) -> Result<(), CreatorError> {
        use std::fs;

        let entries = fs::read_dir(references_dir).map_err(CreatorError::Io)?;

        for entry in entries {
            let entry = entry.map_err(CreatorError::Io)?;
            let path = entry.path();

            if path.is_file() {
                // References should be markdown files
                if let Some(ext) = path.extension() {
                    let ext = ext.to_string_lossy().to_lowercase();
                    if ext != "md" && ext != "txt" && ext != "json" && ext != "yaml" && ext != "yml"
                    {
                        return Err(CreatorError::Validation(format!(
                            "Reference file should be markdown, text, JSON, or YAML: {:?}",
                            path.file_name().unwrap_or_default()
                        )));
                    }
                }
            }
        }

        Ok(())
    }

    /// Validate assets directory
    fn validate_assets_directory(&self, assets_dir: &Path) -> Result<(), CreatorError> {
        use std::fs;

        // Assets can be any file type, just ensure no nested directories too deep
        fn check_depth(
            dir: &Path,
            current_depth: usize,
            max_depth: usize,
        ) -> Result<(), CreatorError> {
            if current_depth > max_depth {
                return Err(CreatorError::Validation(
                    "Assets directory nesting too deep (max 3 levels)".to_string(),
                ));
            }

            let entries = fs::read_dir(dir).map_err(CreatorError::Io)?;

            for entry in entries {
                let entry = entry.map_err(CreatorError::Io)?;
                let path = entry.path();

                if path.is_dir() {
                    check_depth(&path, current_depth + 1, max_depth)?;
                }
            }

            Ok(())
        }

        check_depth(assets_dir, 0, 3)?;

        Ok(())
    }

    /// Check for forbidden files
    fn check_forbidden_files(&self, skill_dir: &Path) -> Result<(), CreatorError> {
        use std::fs;

        let forbidden_files = [
            "README.md",
            "INSTALLATION_GUIDE.md",
            "QUICK_REFERENCE.md",
            "CHANGELOG.md",
            ".git",
            "node_modules",
            "target",
            "__pycache__",
            ".venv",
            "venv",
        ];

        let entries = fs::read_dir(skill_dir).map_err(CreatorError::Io)?;

        for entry in entries {
            let entry = entry.map_err(CreatorError::Io)?;
            let path = entry.path();
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if forbidden_files.contains(&name.as_str()) {
                return Err(CreatorError::Validation(format!(
                    "Forbidden file/directory found in skill: {}. Skills should not contain auxiliary documentation or cache directories.",
                    name
                )));
            }
        }

        Ok(())
    }

    /// Validate a skill name
    pub fn validate_skill_name(&self, name: &str) -> Result<(), CreatorError> {
        // Check length
        if name.is_empty() {
            return Err(CreatorError::Validation(
                "Skill name cannot be empty".to_string(),
            ));
        }

        if name.len() > 64 {
            return Err(CreatorError::Validation(
                "Skill name must be under 64 characters".to_string(),
            ));
        }

        // Check characters - only lowercase letters, digits, and hyphens
        for ch in name.chars() {
            if !ch.is_ascii_lowercase() && !ch.is_ascii_digit() && ch != '-' {
                return Err(CreatorError::Validation(format!(
                    "Skill name contains invalid character: '{}'. Use only lowercase letters, digits, and hyphens.",
                    ch
                )));
            }
        }

        // Check doesn't start or end with hyphen
        if name.starts_with('-') || name.ends_with('-') {
            return Err(CreatorError::Validation(
                "Skill name cannot start or end with a hyphen".to_string(),
            ));
        }

        // Check no consecutive hyphens
        if name.contains("--") {
            return Err(CreatorError::Validation(
                "Skill name cannot contain consecutive hyphens".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate a skill manifest JSON string
    pub fn validate_manifest_json(&self, manifest: &str) -> Result<(), CreatorError> {
        // Parse JSON
        let json: serde_json::Value = serde_json::from_str(manifest)
            .map_err(|e| CreatorError::Validation(format!("Invalid JSON: {}", e)))?;

        // Check required fields
        let required_fields = ["id", "name", "version", "description"];
        for field in &required_fields {
            if json.get(field).is_none() {
                return Err(CreatorError::Validation(format!(
                    "Manifest missing required field: {}",
                    field
                )));
            }
        }

        // Validate version format (semver)
        if let Some(version) = json.get("version").and_then(|v| v.as_str()) {
            let parts: Vec<&str> = version.split('.').collect();
            if parts.len() != 3 {
                return Err(CreatorError::Validation(
                    "Version must be in semver format (x.y.z)".to_string(),
                ));
            }
            for part in parts {
                if part.parse::<u64>().is_err() {
                    return Err(CreatorError::Validation(format!(
                        "Version component must be a number: {}",
                        part
                    )));
                }
            }
        }

        Ok(())
    }
}

impl Default for SkillValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_validate_skill_name() {
        let validator = SkillValidator::new();

        // Valid names
        assert!(validator.validate_skill_name("my-skill").is_ok());
        assert!(validator.validate_skill_name("skill123").is_ok());
        assert!(validator.validate_skill_name("a-b-c").is_ok());

        // Invalid names
        assert!(validator.validate_skill_name("").is_err());
        assert!(validator.validate_skill_name("MySkill").is_err()); // uppercase
        assert!(validator.validate_skill_name("my_skill").is_err()); // underscore
        assert!(validator.validate_skill_name("-skill").is_err()); // starts with hyphen
        assert!(validator.validate_skill_name("skill-").is_err()); // ends with hyphen
        assert!(validator.validate_skill_name("my--skill").is_err()); // consecutive hyphens
    }

    #[test]
    fn test_validate_skill_md() {
        let validator = SkillValidator::new();
        let temp_dir = TempDir::new().unwrap();
        let skill_md = temp_dir.path().join("SKILL.md");

        // Valid SKILL.md
        fs::write(
            &skill_md,
            r#"---
name: test-skill
description: A test skill
---

# Test Skill

This is a test skill.
"#,
        )
        .unwrap();
        assert!(validator.validate_skill_md(&skill_md).is_ok());

        // Missing frontmatter
        fs::write(&skill_md, "# Test Skill\n").unwrap();
        assert!(validator.validate_skill_md(&skill_md).is_err());

        // Missing name field
        fs::write(
            &skill_md,
            r#"---
description: A test skill
---

# Test Skill
"#,
        )
        .unwrap();
        assert!(validator.validate_skill_md(&skill_md).is_err());

        // Invalid extra field
        fs::write(
            &skill_md,
            r#"---
name: test-skill
description: A test skill
version: 1.0.0
---

# Test Skill
"#,
        )
        .unwrap();
        assert!(validator.validate_skill_md(&skill_md).is_err());
    }

    #[test]
    fn test_validate_manifest_json() {
        let validator = SkillValidator::new();

        // Valid manifest
        let manifest = r#"{
            "id": "test.skill",
            "name": "test-skill",
            "version": "1.0.0",
            "description": "A test skill"
        }"#;
        assert!(validator.validate_manifest_json(manifest).is_ok());

        // Missing required field
        let manifest = r#"{
            "name": "test-skill",
            "version": "1.0.0"
        }"#;
        assert!(validator.validate_manifest_json(manifest).is_err());

        // Invalid version format
        let manifest = r#"{
            "id": "test.skill",
            "name": "test-skill",
            "version": "1.0",
            "description": "A test skill"
        }"#;
        assert!(validator.validate_manifest_json(manifest).is_err());
    }

    #[test]
    fn test_forbidden_files() {
        let validator = SkillValidator::new();
        let temp_dir = TempDir::new().unwrap();

        // Create SKILL.md
        fs::write(
            temp_dir.path().join("SKILL.md"),
            r#"---
name: test
description: test
---

# Test
"#,
        )
        .unwrap();

        // Should pass without forbidden files
        assert!(validator.validate_skill_directory(temp_dir.path()).is_ok());

        // Add forbidden file
        fs::write(temp_dir.path().join("README.md"), "# README").unwrap();
        assert!(validator.validate_skill_directory(temp_dir.path()).is_err());
    }
}
