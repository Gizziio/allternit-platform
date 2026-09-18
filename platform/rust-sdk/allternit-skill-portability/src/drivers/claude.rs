//! Claude Code skill driver
//!
//! Installs skills to `.claude/skills/` directory. Each skill becomes available
//! as `/skill-name` in Claude Code.

use std::path::{Path, PathBuf};

use async_trait::async_trait;
use tracing::{debug, info, warn};

use crate::types::{derive_skill_name, Skill, SkillDriver, SkillError, LLMType};

/// Claude Code skill driver
#[derive(Debug, Clone, Copy)]
pub struct ClaudeDriver;

impl ClaudeDriver {
    /// Get the skills subdirectory path
    fn skills_subdir(&self) -> PathBuf {
        PathBuf::from("skills")
    }

    /// Create skill directory structure and install
    async fn install_skill_internal(
        &self,
        skill: &Skill,
        target_dir: &Path,
    ) -> Result<(), SkillError> {
        let skill_name = derive_skill_name(&PathBuf::from(&skill.name));
        let skills_dir = target_dir.join(self.skills_subdir());
        let skill_dir = skills_dir.join(&skill_name);
        let skill_file = skill_dir.join("SKILL.md");

        // Create directories
        tokio::fs::create_dir_all(&skill_dir).await.map_err(|e| {
            SkillError::InstallationFailed {
                llm: self.llm_type(),
                message: format!("Failed to create skill directory: {e}"),
            }
        })?;

        // Write skill content
        tokio::fs::write(&skill_file, &skill.content)
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

    /// Remove skill directory
    async fn remove_skill_internal(
        &self,
        skill_name: &str,
        target_dir: &Path,
    ) -> Result<(), SkillError> {
        let skill_name = derive_skill_name(&PathBuf::from(skill_name));
        let skills_dir = target_dir.join(self.skills_subdir());
        let skill_dir = skills_dir.join(&skill_name);

        if skill_dir.exists() {
            tokio::fs::remove_dir_all(&skill_dir).await.map_err(|e| {
                SkillError::InstallationFailed {
                    llm: self.llm_type(),
                    message: format!("Failed to remove skill directory: {e}"),
                }
            })?;
            info!("Removed skill '{}' from {}", skill_name, skill_dir.display());
        } else {
            warn!("Skill '{}' not found at {}", skill_name, skill_dir.display());
        }

        Ok(())
    }
}

#[async_trait]
impl SkillDriver for ClaudeDriver {
    fn llm_type(&self) -> LLMType {
        LLMType::Claude
    }

    fn target_dir(&self, base_dir: &Path) -> PathBuf {
        base_dir.join(LLMType::Claude.config_dir_name())
    }

    fn skill_patterns(&self) -> Vec<&'static str> {
        vec![".claude/skills/*/SKILL.md", "CLAUDE.md"]
    }

    async fn install_skill(&self, skill: &Skill, base_dir: &Path) -> Result<(), SkillError> {
        let target_dir = self.target_dir(base_dir);
        debug!(
            "Installing skill '{}' to {}",
            skill.name,
            target_dir.display()
        );
        self.install_skill_internal(skill, &target_dir).await
    }

    async fn remove_skill(&self, skill_name: &str, base_dir: &Path) -> Result<(), SkillError> {
        let target_dir = self.target_dir(base_dir);
        debug!(
            "Removing skill '{}' from {}",
            skill_name,
            target_dir.display()
        );
        self.remove_skill_internal(skill_name, &target_dir).await
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
            if path.is_dir() {
                let skill_file = path.join("SKILL.md");
                if skill_file.exists() {
                    let content = tokio::fs::read_to_string(&skill_file).await?;
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    skills.push(Skill::new(name, content));
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
    async fn test_claude_driver_install() {
        let driver = ClaudeDriver;
        let temp_dir = TempDir::new().unwrap();
        let skill = Skill::new("test-skill", "# Test Skill\n\nContent");

        driver.install_skill(&skill, temp_dir.path()).await.unwrap();

        let skill_file = temp_dir
            .path()
            .join(".claude/skills/test-skill/SKILL.md");
        assert!(skill_file.exists());

        let content = tokio::fs::read_to_string(&skill_file).await.unwrap();
        assert_eq!(content, "# Test Skill\n\nContent");
    }

    #[tokio::test]
    async fn test_claude_driver_remove() {
        let driver = ClaudeDriver;
        let temp_dir = TempDir::new().unwrap();
        let skill = Skill::new("test-skill", "# Test Skill");

        driver.install_skill(&skill, temp_dir.path()).await.unwrap();
        driver.remove_skill("test-skill", temp_dir.path()).await.unwrap();

        let skill_dir = temp_dir.path().join(".claude/skills/test-skill");
        assert!(!skill_dir.exists());
    }

    #[tokio::test]
    async fn test_claude_driver_list() {
        let driver = ClaudeDriver;
        let temp_dir = TempDir::new().unwrap();

        // Install two skills
        driver
            .install_skill(&Skill::new("skill-1", "# Skill 1"), temp_dir.path())
            .await
            .unwrap();
        driver
            .install_skill(&Skill::new("skill-2", "# Skill 2"), temp_dir.path())
            .await
            .unwrap();

        let skills = driver.list_skills(temp_dir.path()).await.unwrap();
        assert_eq!(skills.len(), 2);
    }
}
