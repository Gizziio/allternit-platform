//! OpenAI Codex skill driver
//!
//! Installs skills to `.codex/agents.yaml` as merged YAML entries.
//! Codex expects all agents/skills in a single file.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::types::{Skill, SkillDriver, SkillError, LLMType};

/// Codex agents.yaml structure
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct CodexAgents {
    #[serde(default)]
    agents: HashMap<String, CodexAgent>,
}

/// Individual agent in Codex format
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CodexAgent {
    description: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<String>>,
}

/// OpenAI Codex skill driver
#[derive(Debug, Clone, Copy)]
pub struct CodexDriver;

impl CodexDriver {
    /// Get the agents.yaml filename
    fn agents_file(&self) -> &'static str {
        "agents.yaml"
    }

    /// Load existing agents.yaml
    async fn load_agents(&self, target_dir: &Path) -> Result<CodexAgents, SkillError> {
        let agents_file = target_dir.join(self.agents_file());

        if !agents_file.exists() {
            return Ok(CodexAgents::default());
        }

        let content = tokio::fs::read_to_string(&agents_file).await?;
        let agents: CodexAgents = serde_yaml::from_str(&content)
            .map_err(|e| SkillError::InstallationFailed {
                llm: self.llm_type(),
                message: format!("Failed to parse agents.yaml: {e}"),
            })?;

        Ok(agents)
    }

    /// Save agents.yaml
    async fn save_agents(&self, target_dir: &Path, agents: &CodexAgents) -> Result<(), SkillError> {
        let agents_file = target_dir.join(self.agents_file());

        // Ensure directory exists
        tokio::fs::create_dir_all(target_dir).await.map_err(|e| {
            SkillError::InstallationFailed {
                llm: self.llm_type(),
                message: format!("Failed to create directory: {e}"),
            }
        })?;

        let content = serde_yaml::to_string(agents).map_err(|e| {
            SkillError::InstallationFailed {
                llm: self.llm_type(),
                message: format!("Failed to serialize agents: {e}"),
            }
        })?;

        tokio::fs::write(&agents_file, content).await.map_err(|e| {
            SkillError::InstallationFailed {
                llm: self.llm_type(),
                message: format!("Failed to write agents.yaml: {e}"),
            }
        })?;

        Ok(())
    }

    /// Convert skill to Codex agent format
    fn skill_to_agent(&self, skill: &Skill) -> CodexAgent {
        CodexAgent {
            description: skill.description.clone().unwrap_or_default(),
            prompt: skill.content.clone(),
            tools: None,
        }
    }
}

#[async_trait]
impl SkillDriver for CodexDriver {
    fn llm_type(&self) -> LLMType {
        LLMType::Codex
    }

    fn target_dir(&self, base_dir: &Path) -> PathBuf {
        base_dir.join(LLMType::Codex.config_dir_name())
    }

    fn skill_patterns(&self) -> Vec<&'static str> {
        vec![".codex/agents.yaml", "AGENTS.md"]
    }

    async fn install_skill(&self, skill: &Skill, base_dir: &Path) -> Result<(), SkillError> {
        let target_dir = self.target_dir(base_dir);
        debug!(
            "Installing skill '{}' to {}",
            skill.name,
            target_dir.display()
        );

        let mut agents = self.load_agents(&target_dir).await?;
        let agent = self.skill_to_agent(skill);

        agents.agents.insert(skill.name.clone(), agent);
        self.save_agents(&target_dir, &agents).await?;

        info!(
            "Installed skill '{}' to {}/agents.yaml",
            skill.name,
            target_dir.display()
        );
        Ok(())
    }

    async fn remove_skill(&self, skill_name: &str, base_dir: &Path) -> Result<(), SkillError> {
        let target_dir = self.target_dir(base_dir);
        debug!(
            "Removing skill '{}' from {}",
            skill_name,
            target_dir.display()
        );

        let mut agents = self.load_agents(&target_dir).await?;

        if agents.agents.remove(skill_name).is_some() {
            self.save_agents(&target_dir, &agents).await?;
            info!(
                "Removed skill '{}' from {}/agents.yaml",
                skill_name,
                target_dir.display()
            );
        } else {
            warn!(
                "Skill '{}' not found in {}/agents.yaml",
                skill_name,
                target_dir.display()
            );
        }

        Ok(())
    }

    async fn list_skills(&self, base_dir: &Path) -> Result<Vec<Skill>, SkillError> {
        let target_dir = self.target_dir(base_dir);
        let agents = self.load_agents(&target_dir).await?;

        let skills: Vec<Skill> = agents
            .agents
            .into_iter()
            .map(|(name, agent)| {
                Skill::new(name, agent.prompt)
                    .with_description(agent.description)
            })
            .collect();

        Ok(skills)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_codex_driver_install() {
        let driver = CodexDriver;
        let temp_dir = TempDir::new().unwrap();
        let skill = Skill::new("test-agent", "# Test Agent\n\nYou are a helpful assistant.");

        driver.install_skill(&skill, temp_dir.path()).await.unwrap();

        let agents_file = temp_dir.path().join(".codex/agents.yaml");
        assert!(agents_file.exists());

        let content = tokio::fs::read_to_string(&agents_file).await.unwrap();
        assert!(content.contains("test-agent"));
    }

    #[tokio::test]
    async fn test_codex_driver_merge() {
        let driver = CodexDriver;
        let temp_dir = TempDir::new().unwrap();

        // Install first skill
        driver
            .install_skill(&Skill::new("agent-1", "# Agent 1"), temp_dir.path())
            .await
            .unwrap();

        // Install second skill
        driver
            .install_skill(&Skill::new("agent-2", "# Agent 2"), temp_dir.path())
            .await
            .unwrap();

        let skills = driver.list_skills(temp_dir.path()).await.unwrap();
        assert_eq!(skills.len(), 2);
    }

    #[tokio::test]
    async fn test_codex_driver_remove() {
        let driver = CodexDriver;
        let temp_dir = TempDir::new().unwrap();

        driver
            .install_skill(&Skill::new("agent-1", "# Agent 1"), temp_dir.path())
            .await
            .unwrap();
        driver
            .install_skill(&Skill::new("agent-2", "# Agent 2"), temp_dir.path())
            .await
            .unwrap();

        driver.remove_skill("agent-1", temp_dir.path()).await.unwrap();

        let skills = driver.list_skills(temp_dir.path()).await.unwrap();
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].name, "agent-2");
    }
}
