//! Kimi skill driver
//!
//! Installs skills to `.kimi/skills/` directory as individual files.

use std::path::{Path, PathBuf};

use async_trait::async_trait;
use tracing::{debug, info, warn};

use crate::types::{derive_skill_name, Skill, SkillDriver, SkillError, LLMType};

/// Kimi skill driver
#[derive(Debug, Clone, Copy)]
pub struct KimiDriver;

impl KimiDriver {
    /// Get the skills subdirectory path
    fn skills_subdir(&self) -> PathBuf {
        PathBuf::from("skills")
    }

    /// Get the skill filename
    fn skill_filename(&self, skill_name: &str) -> String {
        format!("{}.md", skill_name)
    }
}

#[async_trait]
impl SkillDriver for KimiDriver {
    fn llm_type(&self) -> LLMType {
        LLMType::Kimi
    }

    fn target_dir(&self, base_dir: &Path) -> PathBuf {
        base_dir.join(LLMType::Kimi.config_dir_name())
    }

    fn skill_patterns(&self) -> Vec<&'static str> {
        vec![".kimi/skills/*.md", "KIMI.md"]
    }

    async fn install_skill(&self, skill: &Skill, base_dir: &Path) -> Result<(), SkillError> {
        let target_dir = self.target_dir(base_dir);
        let skills_dir = target_dir.join(self.skills_subdir());
        let skill_file = skills_dir.join(self.skill_filename(&skill.name));

        debug!(
            "Installing skill '{}' to {}",
            skill.name,
            skill_file.display()
        );

        // Create directory
        tokio::fs::create_dir_all(&skills_dir).await.map_err(|e| {
            SkillError::InstallationFailed {
                llm: self.llm_type(),
                message: format!("Failed to create skills directory: {e}"),
            }
        })?;

        // Write skill file with Kimi-specific header
        let content = format!(
            "# {}\n\n{}\n",
            skill.name,
            skill.content.trim_start_matches(&format!("# {}\n\n", skill.name))
        );

        tokio::fs::write(&skill_file, content)
            .await
            .map_err(|e| SkillError::InstallationFailed {
                llm: self.llm_type(),
                message: format!("Failed to write skill file: {e}"),
            })?;

        info!(
            "Installed skill '{}' to {}",
            skill.name,
            skill_file.display()
        );
        Ok(())
    }

    async fn remove_skill(&self, skill_name: &str, base_dir: &Path) -> Result<(), SkillError> {
        let target_dir = self.target_dir(base_dir);
        let skills_dir = target_dir.join(self.skills_subdir());
        let skill_file = skills_dir.join(self.skill_filename(skill_name));

        debug!(
            "Removing skill '{}' from {}",
            skill_name,
            skill_file.display()
        );

        if skill_file.exists() {
            tokio::fs::remove_file(&skill_file).await.map_err(|e| {
                SkillError::InstallationFailed {
                    llm: self.llm_type(),
                    message: format!("Failed to remove skill file: {e}"),
                }
            })?;
            info!(
                "Removed skill '{}' from {}",
                skill_name,
                skill_file.display()
            );
        } else {
            warn!(
                "Skill '{}' not found at {}",
                skill_name,
                skill_file.display()
            );
        }

        Ok(())
    }

    async fn list_skills(&self, base_dir: &Path) -> Result<Vec<Skill>, SkillError> {
        let skills_dir = self.target_dir(base_dir).join(self.skills_subdir());
        let mut skills = Vec::new();

        if !skills_dir.exists() {
            return Ok(skills);
        }

        let mut entries = tokio::fs::read_dir(&skills_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "md" {
                        let content = tokio::fs::read_to_string(&path).await?;
                        let name = derive_skill_name(&path);
                        skills.push(Skill::new(name, content));
                    }
                }
            }
        }

        Ok(skills)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_kimi_driver_install() {
        let driver = KimiDriver;
        let temp_dir = TempDir::new().unwrap();
        let skill = Skill::new("test-skill", "# Test Skill\n\nContent");

        driver.install_skill(&skill, temp_dir.path()).await.unwrap();

        let skill_file = temp_dir.path().join(".kimi/skills/test-skill.md");
        assert!(skill_file.exists());
    }

    #[tokio::test]
    async fn test_kimi_driver_remove() {
        let driver = KimiDriver;
        let temp_dir = TempDir::new().unwrap();
        let skill = Skill::new("test-skill", "# Test Skill");

        driver.install_skill(&skill, temp_dir.path()).await.unwrap();
        driver.remove_skill("test-skill", temp_dir.path()).await.unwrap();

        let skill_file = temp_dir.path().join(".kimi/skills/test-skill.md");
        assert!(!skill_file.exists());
    }
}
