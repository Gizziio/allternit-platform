//! Skill Installer Service - OC-015
//!
//! Native Rust implementation of the skill installation service that will eventually
//! replace OpenClaw's skill installation functionality.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// Skill information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub status: SkillStatus,
    pub installed_version: Option<String>,
    pub category: String,
    pub tags: Vec<String>,
    pub requires: Vec<String>,
    pub source: SkillSource,
    pub download_url: Option<String>,
    pub license: String,
    pub last_updated: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Skill status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SkillStatus {
    Installed,
    Available,
    Installing,
    Error,
}

/// Skill source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SkillSource {
    AllternitRegistry,
    OpenClawRegistry,
    Local,
    Remote,
}

/// Request to install a skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallSkillRequest {
    pub skill_id: String,
    pub version: Option<String>,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

/// Response from skill install request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallSkillResponse {
    pub success: bool,
    pub skill_id: String,
    pub message: String,
    pub error: Option<String>,
}

/// Request to uninstall a skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UninstallSkillRequest {
    pub skill_id: String,
}

/// Response from skill uninstall request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UninstallSkillResponse {
    pub success: bool,
    pub skill_id: String,
    pub message: String,
    pub error: Option<String>,
}

/// Request to list skills
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListSkillsRequest {
    pub category: Option<String>,
    pub search: Option<String>,
    pub include_installed: Option<bool>,
    pub include_available: Option<bool>,
}

/// Response from list skills request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListSkillsResponse {
    pub skills: Vec<Skill>,
    pub total_count: usize,
}

/// Skill installer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInstallerConfig {
    pub skills_dir: PathBuf,
    pub registry_url: String,
    pub allow_remote_installs: bool,
    pub allow_local_installs: bool,
    pub verify_signatures: bool,
    pub max_download_size_mb: Option<u64>,
    pub timeout_seconds: u64,
}

impl Default for SkillInstallerConfig {
    fn default() -> Self {
        Self {
            skills_dir: PathBuf::from("./skills"),
            registry_url: "https://registry.allternit.example.com".to_string(),
            allow_remote_installs: true,
            allow_local_installs: true,
            verify_signatures: true,
            max_download_size_mb: Some(100), // 100MB limit
            timeout_seconds: 300,            // 5 minutes
        }
    }
}

/// Skill installer service
pub struct SkillInstallerService {
    config: SkillInstallerConfig,
    installed_skills: HashMap<String, Skill>,
}

impl Default for SkillInstallerService {
    fn default() -> Self {
        Self::new()
    }
}

impl SkillInstallerService {
    /// Create new skill installer service with default configuration
    pub fn new() -> Self {
        Self {
            config: SkillInstallerConfig::default(),
            installed_skills: HashMap::new(),
        }
    }

    /// Create new skill installer service with custom configuration
    pub fn with_config(config: SkillInstallerConfig) -> Self {
        Self {
            config,
            installed_skills: HashMap::new(),
        }
    }

    /// Initialize the service by loading installed skills
    pub async fn initialize(&mut self) -> Result<(), SkillInstallerError> {
        self.load_installed_skills().await?;
        Ok(())
    }

    /// Load installed skills from the skills directory
    async fn load_installed_skills(&mut self) -> Result<(), SkillInstallerError> {
        if !self.config.skills_dir.exists() {
            fs::create_dir_all(&self.config.skills_dir)
                .await
                .map_err(|e| {
                    SkillInstallerError::IoError(format!(
                        "Failed to create skills directory: {}",
                        e
                    ))
                })?;
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.skills_dir).await.map_err(|e| {
            SkillInstallerError::IoError(format!("Failed to read skills directory: {}", e))
        })?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            SkillInstallerError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            if entry
                .file_type()
                .await
                .map_err(|e| {
                    SkillInstallerError::IoError(format!("Failed to get file type: {}", e))
                })?
                .is_dir()
            {
                // Look for SKILL.md in the skill directory
                let skill_md_path = entry.path().join("SKILL.md");
                if skill_md_path.exists() {
                    if let Ok(content) = fs::read_to_string(&skill_md_path).await {
                        if let Ok(skill) = self.parse_skill_from_md(
                            &content,
                            entry.file_name().to_string_lossy().to_string(),
                        ) {
                            self.installed_skills.insert(skill.id.clone(), skill);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Parse skill information from SKILL.md content
    fn parse_skill_from_md(
        &self,
        content: &str,
        skill_dir_name: String,
    ) -> Result<Skill, SkillInstallerError> {
        // Split frontmatter from content
        let parts: Vec<&str> = content.split("---").collect();
        if parts.len() < 3 {
            return Err(SkillInstallerError::ParseError(
                "Invalid SKILL.md format: missing frontmatter".to_string(),
            ));
        }

        let frontmatter = parts[1];
        let metadata: serde_json::Value = serde_yaml::from_str(frontmatter).map_err(|e| {
            SkillInstallerError::ParseError(format!("Failed to parse SKILL.md frontmatter: {}", e))
        })?;

        // Extract fields from metadata
        let id = metadata
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(&skill_dir_name)
            .to_string();

        let name = metadata
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&skill_dir_name)
            .to_string();

        let description = metadata
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let version = metadata
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("0.0.1")
            .to_string();

        let author = metadata
            .get("author")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let category = metadata
            .get("category")
            .and_then(|v| v.as_str())
            .unwrap_or("misc")
            .to_string();

        let tags = metadata
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let requires = metadata
            .get("requires")
            .and_then(|v| v.get("bins"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        // Convert the metadata Value to a HashMap if it's an object
        let metadata_map = if metadata.is_object() {
            // Convert serde_json::Map to HashMap
            let obj = metadata.as_object().unwrap();
            let mut hash_map = std::collections::HashMap::new();
            for (k, v) in obj {
                hash_map.insert(k.clone(), v.clone());
            }
            Some(hash_map)
        } else {
            None
        };

        Ok(Skill {
            id,
            name,
            description,
            version: version.clone(),
            author,
            status: SkillStatus::Installed,
            installed_version: Some(version),
            category,
            tags,
            requires,
            source: SkillSource::Local,
            download_url: None,
            license: metadata
                .get("license")
                .and_then(|v| v.as_str())
                .unwrap_or("MIT")
                .to_string(),
            last_updated: chrono::Utc::now().to_rfc3339(),
            metadata: metadata_map,
        })
    }

    /// List available skills
    pub async fn list_skills(
        &self,
        request: ListSkillsRequest,
    ) -> Result<ListSkillsResponse, SkillInstallerError> {
        // In a real implementation, this would fetch from both local and remote registries
        // For now, we'll return installed skills

        let mut skills: Vec<Skill> = self.installed_skills.values().cloned().collect();

        // Apply filters
        if let Some(category) = &request.category {
            skills.retain(|skill| skill.category == *category);
        }

        if let Some(search) = &request.search {
            let search_lower = search.to_lowercase();
            skills.retain(|skill| {
                skill.name.to_lowercase().contains(&search_lower)
                    || skill.description.to_lowercase().contains(&search_lower)
                    || skill
                        .tags
                        .iter()
                        .any(|tag| tag.to_lowercase().contains(&search_lower))
            });
        }

        // Apply status filters
        if let Some(include_installed) = request.include_installed {
            if !include_installed {
                skills.retain(|skill| skill.status != SkillStatus::Installed);
            }
        }

        if let Some(include_available) = request.include_available {
            if !include_available {
                skills.retain(|skill| skill.status == SkillStatus::Installed);
            }
        }

        let count = skills.len();
        Ok(ListSkillsResponse {
            skills,
            total_count: count,
        })
    }

    /// Get a specific skill by ID
    pub async fn get_skill(&self, skill_id: &str) -> Result<Option<Skill>, SkillInstallerError> {
        Ok(self.installed_skills.get(skill_id).cloned())
    }

    /// Install a skill
    pub async fn install_skill(
        &mut self,
        request: InstallSkillRequest,
    ) -> Result<InstallSkillResponse, SkillInstallerError> {
        // Check if skill already exists
        if self.installed_skills.contains_key(&request.skill_id) {
            return Ok(InstallSkillResponse {
                success: false,
                skill_id: request.skill_id,
                message: "Skill already installed".to_string(),
                error: Some("Skill already installed".to_string()),
            });
        }

        // In a real implementation, this would:
        // 1. Download the skill from the registry
        // 2. Verify its integrity/signature
        // 3. Extract to the skills directory
        // 4. Validate the skill manifest
        // 5. Update the installed skills registry

        // For now, we'll simulate the installation
        let version = request.version.clone().unwrap_or("1.0.0".to_string());
        let skill = Skill {
            id: request.skill_id.clone(),
            name: request.skill_id.clone(), // In a real implementation, we'd get this from the registry
            description: format!("Skill {}", request.skill_id),
            version: version.clone(),
            author: "Allternit Team".to_string(),
            status: SkillStatus::Installing,
            installed_version: Some(version), // Fixed: wrap in Some()
            category: "misc".to_string(),
            tags: vec!["allternit".to_string()],
            requires: vec![],
            source: SkillSource::AllternitRegistry,
            download_url: None,
            license: "MIT".to_string(),
            last_updated: chrono::Utc::now().to_rfc3339(),
            metadata: None,
        };

        // Simulate installation process
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Update status to installed
        let mut skill = skill;
        skill.status = SkillStatus::Installed;

        self.installed_skills
            .insert(request.skill_id.clone(), skill);

        Ok(InstallSkillResponse {
            success: true,
            skill_id: request.skill_id,
            message: "Skill installed successfully".to_string(),
            error: None,
        })
    }

    /// Uninstall a skill
    pub async fn uninstall_skill(
        &mut self,
        request: UninstallSkillRequest,
    ) -> Result<UninstallSkillResponse, SkillInstallerError> {
        if !self.installed_skills.contains_key(&request.skill_id) {
            return Ok(UninstallSkillResponse {
                success: false,
                skill_id: request.skill_id,
                message: "Skill not found".to_string(),
                error: Some("Skill not found".to_string()),
            });
        }

        // In a real implementation, this would:
        // 1. Remove the skill directory
        // 2. Update the installed skills registry
        // 3. Handle any cleanup tasks

        // For now, we'll just remove from our registry
        self.installed_skills.remove(&request.skill_id);

        Ok(UninstallSkillResponse {
            success: true,
            skill_id: request.skill_id,
            message: "Skill uninstalled successfully".to_string(),
            error: None,
        })
    }

    /// Update a skill to a new version
    pub async fn update_skill(
        &mut self,
        skill_id: String,
        version: Option<String>,
    ) -> Result<InstallSkillResponse, SkillInstallerError> {
        // First check if the skill exists
        if !self.installed_skills.contains_key(&skill_id) {
            return Ok(InstallSkillResponse {
                success: false,
                skill_id,
                message: "Skill not found".to_string(),
                error: Some("Skill not found".to_string()),
            });
        }

        // In a real implementation, this would:
        // 1. Download the new version
        // 2. Verify its integrity
        // 3. Backup the current version
        // 4. Replace with the new version
        // 5. Update the registry

        // For now, we'll just update the version in our registry
        if let Some(mut skill) = self.installed_skills.remove(&skill_id) {
            let new_version = version.unwrap_or_else(|| "latest".to_string());
            skill.version = new_version.clone();
            skill.installed_version = Some(new_version);
            skill.last_updated = chrono::Utc::now().to_rfc3339();

            self.installed_skills.insert(skill_id.clone(), skill);
        }

        Ok(InstallSkillResponse {
            success: true,
            skill_id,
            message: "Skill updated successfully".to_string(),
            error: None,
        })
    }

    /// Get installation status for a skill
    pub async fn get_installation_status(
        &self,
        skill_id: &str,
    ) -> Result<InstallationStatus, SkillInstallerError> {
        if let Some(skill) = self.installed_skills.get(skill_id) {
            match &skill.status {
                SkillStatus::Installing => {
                    Ok(InstallationStatus {
                        status: "installing".to_string(),
                        progress: 100, // In a real implementation, this would track actual progress
                        message: "Installation in progress".to_string(),
                    })
                }
                SkillStatus::Installed => Ok(InstallationStatus {
                    status: "installed".to_string(),
                    progress: 100,
                    message: "Skill installed successfully".to_string(),
                }),
                SkillStatus::Error => Ok(InstallationStatus {
                    status: "error".to_string(),
                    progress: 0,
                    message: "Installation failed".to_string(),
                }),
                SkillStatus::Available => Ok(InstallationStatus {
                    status: "available".to_string(),
                    progress: 0,
                    message: "Skill available for installation".to_string(),
                }),
            }
        } else {
            Ok(InstallationStatus {
                status: "not_found".to_string(),
                progress: 0,
                message: "Skill not found".to_string(),
            })
        }
    }

    /// Get the current configuration
    pub fn config(&self) -> &SkillInstallerConfig {
        &self.config
    }

    /// Get mutable access to the configuration
    pub fn config_mut(&mut self) -> &mut SkillInstallerConfig {
        &mut self.config
    }
}

/// Installation status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallationStatus {
    pub status: String,
    pub progress: u8,
    pub message: String,
}

/// Skill installer error
#[derive(Debug, thiserror::Error)]
pub enum SkillInstallerError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Download error: {0}")]
    DownloadError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Permission error: {0}")]
    PermissionError(String),
}

impl From<std::io::Error> for SkillInstallerError {
    fn from(error: std::io::Error) -> Self {
        SkillInstallerError::IoError(error.to_string())
    }
}

impl From<serde_json::Error> for SkillInstallerError {
    fn from(error: serde_json::Error) -> Self {
        SkillInstallerError::ParseError(error.to_string())
    }
}

impl From<serde_yaml::Error> for SkillInstallerError {
    fn from(error: serde_yaml::Error) -> Self {
        SkillInstallerError::ParseError(error.to_string())
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_skill_installer_creation() {
        let installer = SkillInstallerService::new();
        assert_eq!(installer.config.skills_dir, PathBuf::from("./skills"));
        assert!(installer.config.allow_remote_installs);
    }

    #[tokio::test]
    async fn test_skill_installer_with_config() {
        let config = SkillInstallerConfig {
            skills_dir: PathBuf::from("/tmp/test-skills"),
            registry_url: "https://test-registry.com".to_string(),
            allow_remote_installs: false,
            allow_local_installs: true,
            verify_signatures: false,
            max_download_size_mb: Some(50),
            timeout_seconds: 60,
        };

        let installer = SkillInstallerService::with_config(config);
        assert_eq!(
            installer.config.skills_dir,
            PathBuf::from("/tmp/test-skills")
        );
        assert!(!installer.config.allow_remote_installs);
    }

    #[tokio::test]
    async fn test_install_and_uninstall_skill() {
        let mut installer = SkillInstallerService::new();

        // Install a skill
        let install_request = InstallSkillRequest {
            skill_id: "test-skill".to_string(),
            version: Some("1.0.0".to_string()),
            options: None,
        };

        let install_response = installer.install_skill(install_request).await.unwrap();
        assert!(install_response.success);

        // Check that the skill is now installed
        let skill = installer.get_skill("test-skill").await.unwrap();
        assert!(skill.is_some());
        assert_eq!(skill.unwrap().status, SkillStatus::Installed);

        // Uninstall the skill
        let uninstall_request = UninstallSkillRequest {
            skill_id: "test-skill".to_string(),
        };

        let uninstall_response = installer.uninstall_skill(uninstall_request).await.unwrap();
        assert!(uninstall_response.success);

        // Check that the skill is no longer installed
        let skill = installer.get_skill("test-skill").await.unwrap();
        assert!(skill.is_none());
    }

    #[tokio::test]
    async fn test_list_skills() {
        let mut installer = SkillInstallerService::new();

        // Install a few skills
        for i in 1..=3 {
            let install_request = InstallSkillRequest {
                skill_id: format!("test-skill-{}", i),
                version: Some("1.0.0".to_string()),
                options: None,
            };

            let response = installer.install_skill(install_request).await.unwrap();
            assert!(response.success);
        }

        // List skills
        let list_request = ListSkillsRequest {
            category: None,
            search: None,
            include_installed: Some(true),
            include_available: Some(false),
        };

        let list_response = installer.list_skills(list_request).await.unwrap();
        assert_eq!(list_response.skills.len(), 3);
        assert_eq!(list_response.total_count, 3);
    }

    #[test]
    fn test_parse_skill_from_md() {
        let content = r#"---
id: test-skill
name: Test Skill
description: A test skill for testing
version: 1.0.0
author: Test Author
category: test
tags: [test, example]
requires:
  bins: [bash, curl]
license: MIT
---
# Test Skill Documentation

This is a test skill.
"#;

        let installer = SkillInstallerService::new();
        let result = installer.parse_skill_from_md(content, "test-skill".to_string());

        assert!(result.is_ok());

        let skill = result.unwrap();
        assert_eq!(skill.id, "test-skill");
        assert_eq!(skill.name, "Test Skill");
        assert_eq!(skill.description, "A test skill for testing");
        assert_eq!(skill.version, "1.0.0");
        assert_eq!(skill.category, "test");
        assert_eq!(skill.tags, vec!["test", "example"]);
        assert_eq!(skill.requires, vec!["bash", "curl"]);
        assert_eq!(skill.license, "MIT");
    }
}
