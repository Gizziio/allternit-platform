//! Skill portability engine
//!
//! This module provides the main `SkillEngine` for managing skill portability
//! across multiple LLM tools.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tracing::{debug, error, info, instrument};

use crate::drivers::{get_driver, get_drivers};
use crate::types::{
    LLMType, PortableSkill, Skill, SkillError,
    SkillInstallation, SyncConfig, SyncResult, SyncScope,
};

/// Main engine for skill portability operations
#[derive(Debug, Clone)]
pub struct SkillEngine {
    /// Configuration for the engine
    config: EngineConfig,
}

/// Engine configuration
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// Default sync scope
    pub default_scope: SyncScope,
    /// Whether to auto-detect workspace
    pub auto_detect_workspace: bool,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            default_scope: SyncScope::Global,
            auto_detect_workspace: true,
        }
    }
}

impl SkillEngine {
    /// Create a new skill engine with default configuration
    pub fn new() -> Self {
        Self {
            config: EngineConfig::default(),
        }
    }

    /// Create a new skill engine with custom configuration
    pub fn with_config(config: EngineConfig) -> Self {
        Self { config }
    }

    /// Get the base directory for a sync scope
    fn get_base_dir(&self, scope: SyncScope) -> Option<PathBuf> {
        match scope {
            SyncScope::Global => dirs::home_dir(),
            SyncScope::Workspace => {
                // Try to detect workspace from current directory
                if self.config.auto_detect_workspace {
                    std::env::current_dir().ok()
                } else {
                    None
                }
            }
        }
    }

    /// Get the effective base directory for a scope
    fn effective_base_dir(&self, scope: SyncScope, explicit_workspace: Option<&Path>) -> Option<PathBuf> {
        match scope {
            SyncScope::Global => dirs::home_dir(),
            SyncScope::Workspace => explicit_workspace
                .map(Path::to_path_buf)
                .or_else(|| std::env::current_dir().ok()),
        }
    }

    /// Install a skill to specific LLM targets
    #[instrument(skip(self, skill))]
    pub async fn install(
        &self,
        skill: &Skill,
        targets: &[LLMType],
        scope: SyncScope,
    ) -> Result<HashMap<LLMType, Result<(), SkillError>>, SkillError> {
        let base_dir = self.get_base_dir(scope).ok_or_else(|| {
            SkillError::SyncFailed("Could not determine base directory".to_string())
        })?;

        let mut results = HashMap::new();

        for &target in targets {
            let driver = get_driver(target);
            let result = driver.install_skill(skill, &base_dir).await;
            
            match &result {
                Ok(_) => info!("Installed skill '{}' to {}", skill.name, target),
                Err(e) => error!("Failed to install skill '{}' to {}: {}", skill.name, target, e),
            }
            
            results.insert(target, result);
        }

        Ok(results)
    }

    /// Remove a skill from specific LLM targets
    #[instrument(skip(self))]
    pub async fn remove(
        &self,
        skill_name: &str,
        targets: &[LLMType],
        scope: SyncScope,
    ) -> Result<HashMap<LLMType, Result<(), SkillError>>, SkillError> {
        let base_dir = self.get_base_dir(scope).ok_or_else(|| {
            SkillError::SyncFailed("Could not determine base directory".to_string())
        })?;

        let mut results = HashMap::new();

        for &target in targets {
            let driver = get_driver(target);
            let result = driver.remove_skill(skill_name, &base_dir).await;
            results.insert(target, result);
        }

        Ok(results)
    }

    /// List skills installed for specific LLM targets
    #[instrument(skip(self))]
    pub async fn list(
        &self,
        targets: &[LLMType],
        scope: SyncScope,
    ) -> Result<HashMap<LLMType, Vec<Skill>>, SkillError> {
        let base_dir = self.get_base_dir(scope).ok_or_else(|| {
            SkillError::SyncFailed("Could not determine base directory".to_string())
        })?;

        let mut results = HashMap::new();

        for &target in targets {
            let driver = get_driver(target);
            let skills = driver.list_skills(&base_dir).await?;
            results.insert(target, skills);
        }

        Ok(results)
    }

    /// Get portable skill info with installation status
    #[instrument(skip(self))]
    pub async fn get_portable_skill(
        &self,
        skill_name: &str,
        targets: &[LLMType],
        scope: SyncScope,
    ) -> Result<Option<PortableSkill>, SkillError> {
        let base_dir = self.get_base_dir(scope).ok_or_else(|| {
            SkillError::SyncFailed("Could not determine base directory".to_string())
        })?;

        // Find the skill in one of the targets
        let mut skill: Option<Skill> = None;
        let mut installations = Vec::new();

        for &target in targets {
            let driver = get_driver(target);
            let skills = driver.list_skills(&base_dir).await?;
            
            let installed = skills.iter().any(|s| s.name == skill_name);
            let installed_skill = skills.into_iter().find(|s| s.name == skill_name);
            
            if skill.is_none() {
                skill = installed_skill;
            }

            installations.push(SkillInstallation {
                llm: target,
                installed,
                path: if installed {
                    Some(driver.target_dir(&base_dir))
                } else {
                    None
                },
                installed_at: None, // Could track this with metadata
                installed_version: None,
            });
        }

        Ok(skill.map(|s| PortableSkill {
            skill: s,
            installations,
        }))
    }

    /// Sync skills from a source directory to targets
    #[instrument(skip(self))]
    pub async fn sync_from_directory(
        &self,
        source_dir: &Path,
        config: &SyncConfig,
        workspace: Option<&Path>,
    ) -> Result<SyncResult, SkillError> {
        debug!("Scanning source directory: {}", source_dir.display());

        // Scan source directory for skills
        let skills = self.scan_directory(source_dir).await?;
        info!("Found {} skills in {}", skills.len(), source_dir.display());

        self.sync_skills(&skills, config, workspace).await
    }

    /// Sync a list of skills to targets
    #[instrument(skip(self, skills))]
    pub async fn sync_skills(
        &self,
        skills: &[Skill],
        config: &SyncConfig,
        workspace: Option<&Path>,
    ) -> Result<SyncResult, SkillError> {
        let base_dir = self.effective_base_dir(config.scope, workspace).ok_or_else(|| {
            SkillError::SyncFailed("Could not determine base directory".to_string())
        })?;

        let mut result = SyncResult {
            installed: Vec::new(),
            updated: Vec::new(),
            removed: Vec::new(),
            failed: Vec::new(),
        };

        // Get drivers for targets
        let drivers = get_drivers(&config.targets);

        for skill in skills {
            for driver in &drivers {
                let llm = driver.llm_type();
                
                // Check if skill is already installed
                let is_installed = driver.is_installed(&skill.name, &base_dir).await?;

                if is_installed {
                    if config.overwrite {
                        match driver.install_skill(skill, &base_dir).await {
                            Ok(_) => {
                                result.updated.push((skill.id, llm));
                                info!("Updated skill '{}' on {}", skill.name, llm);
                            }
                            Err(e) => {
                                result.failed.push((skill.id, llm, e.to_string()));
                                error!("Failed to update skill '{}' on {}: {}", skill.name, llm, e);
                            }
                        }
                    } else {
                        debug!("Skill '{}' already installed on {}, skipping", skill.name, llm);
                    }
                } else {
                    match driver.install_skill(skill, &base_dir).await {
                        Ok(_) => {
                            result.installed.push((skill.id, llm));
                            info!("Installed skill '{}' on {}", skill.name, llm);
                        }
                        Err(e) => {
                            result.failed.push((skill.id, llm, e.to_string()));
                            error!("Failed to install skill '{}' on {}: {}", skill.name, llm, e);
                        }
                    }
                }
            }
        }

        // Handle deletion if configured
        if config.delete_missing {
            // TODO: Implement deletion of skills not in source
            debug!("Delete missing not yet implemented");
        }

        info!(
            "Sync complete: {} installed, {} updated, {} failed",
            result.installed.len(),
            result.updated.len(),
            result.failed.len()
        );

        Ok(result)
    }

    /// Scan a directory for skill files
    #[instrument(skip(self))]
    async fn scan_directory(&self, dir: &Path) -> Result<Vec<Skill>, SkillError> {
        let mut skills = Vec::new();

        if !dir.exists() {
            return Ok(skills);
        }

        let mut entries = tokio::fs::read_dir(dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            if path.is_file() && path.extension().map(|e| e == "md").unwrap_or(false) {
                let content = tokio::fs::read_to_string(&path).await?;
                let name = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                skills.push(Skill::new(name, content));
            } else if path.is_dir() {
                // Check for SKILL.md inside directory
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    let content = tokio::fs::read_to_string(&skill_md).await?;
                    let name = path
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    skills.push(Skill::new(name, content));
                }
            }
        }

        Ok(skills)
    }

    /// Get installation status for all targets
    #[instrument(skip(self))]
    pub async fn status(
        &self,
        targets: &[LLMType],
        scope: SyncScope,
    ) -> Result<HashMap<LLMType, Vec<Skill>>, SkillError> {
        self.list(targets, scope).await
    }
}

impl Default for SkillEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_engine_install() {
        let engine = SkillEngine::new();
        let temp_dir = TempDir::new().unwrap();
        let skill = Skill::new("test-skill", "# Test");

        let results = engine
            .install(&skill, &[LLMType::Claude, LLMType::OpenCode], SyncScope::Workspace)
            .await
            .unwrap();

        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn test_engine_list() {
        let engine = SkillEngine::new();
        let temp_dir = TempDir::new().unwrap();

        // Install a skill first
        let skill = Skill::new("test-skill", "# Test");
        engine
            .install(&skill, &[LLMType::Claude], SyncScope::Workspace)
            .await
            .unwrap();

        let results = engine.list(&[LLMType::Claude], SyncScope::Workspace).await.unwrap();
        assert!(results.contains_key(&LLMType::Claude));
    }

    #[tokio::test]
    async fn test_scan_directory() {
        let engine = SkillEngine::new();
        let temp_dir = TempDir::new().unwrap();

        // Create skill files
        tokio::fs::write(temp_dir.path().join("skill1.md"), "# Skill 1")
            .await
            .unwrap();
        tokio::fs::write(temp_dir.path().join("skill2.md"), "# Skill 2")
            .await
            .unwrap();

        let skills = engine.scan_directory(temp_dir.path()).await.unwrap();
        assert_eq!(skills.len(), 2);
    }
}
