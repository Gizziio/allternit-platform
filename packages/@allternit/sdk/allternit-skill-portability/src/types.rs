//! Core types for skill portability
//!
//! This module defines the types and traits used for managing skills
//! across different LLM tools (Claude Code, Codex, OpenCode, Kimi).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Unique identifier for a skill
pub type SkillId = uuid::Uuid;

/// Supported LLM types for skill installation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LLMType {
    /// Anthropic Claude Code
    Claude,
    /// OpenAI Codex
    Codex,
    /// OpenCode (open source)
    OpenCode,
    /// Kimi CLI
    Kimi,
    /// Google Antigravity
    Antigravity,
}

impl LLMType {
    /// Get the display name for this LLM type
    pub fn display_name(&self) -> &'static str {
        match self {
            LLMType::Claude => "Claude Code",
            LLMType::Codex => "OpenAI Codex",
            LLMType::OpenCode => "OpenCode",
            LLMType::Kimi => "Kimi",
            LLMType::Antigravity => "Antigravity",
        }
    }

    /// Get the configuration directory name for this LLM
    pub fn config_dir_name(&self) -> &'static str {
        match self {
            LLMType::Claude => ".claude",
            LLMType::Codex => ".codex",
            LLMType::OpenCode => ".opencode",
            LLMType::Kimi => ".kimi",
            LLMType::Antigravity => ".antigravity",
        }
    }

    /// Get all supported LLM types
    pub fn all() -> Vec<LLMType> {
        vec![
            LLMType::Claude,
            LLMType::Codex,
            LLMType::OpenCode,
            LLMType::Kimi,
            LLMType::Antigravity,
        ]
    }
}

impl std::fmt::Display for LLMType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

/// A portable skill definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    /// Unique identifier
    pub id: SkillId,
    /// Skill name (used as command/trigger)
    pub name: String,
    /// Human-readable description
    pub description: Option<String>,
    /// Skill content (markdown)
    pub content: String,
    /// Skill metadata
    pub metadata: SkillMetadata,
    /// When the skill was created
    pub created_at: DateTime<Utc>,
    /// When the skill was last modified
    pub updated_at: DateTime<Utc>,
}

impl Skill {
    /// Create a new skill
    pub fn new(name: impl Into<String>, content: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: SkillId::new_v4(),
            name: name.into(),
            description: None,
            content: content.into(),
            metadata: SkillMetadata::default(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Set the description
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    /// Set the metadata
    pub fn with_metadata(mut self, metadata: SkillMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    /// Update the content and modification time
    pub fn update_content(&mut self, content: impl Into<String>) {
        self.content = content.into();
        self.updated_at = Utc::now();
    }
}

/// Skill metadata
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SkillMetadata {
    /// Tags for categorization
    #[serde(default)]
    pub tags: Vec<String>,
    /// Author information
    pub author: Option<String>,
    /// Version (semver)
    pub version: Option<String>,
    /// Required tools/capabilities
    #[serde(default)]
    pub requires: Vec<String>,
    /// Additional custom metadata
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Installation status of a skill for a specific LLM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInstallation {
    /// The LLM type
    pub llm: LLMType,
    /// Whether the skill is installed
    pub installed: bool,
    /// Installation path (if installed)
    pub path: Option<PathBuf>,
    /// When it was installed
    pub installed_at: Option<DateTime<Utc>>,
    /// Installation version (if different from skill version)
    pub installed_version: Option<String>,
}

/// Complete skill info with installation status across LLMs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortableSkill {
    /// The skill definition
    pub skill: Skill,
    /// Installation status per LLM
    pub installations: Vec<SkillInstallation>,
}

impl PortableSkill {
    /// Check if the skill is installed for a specific LLM
    pub fn is_installed_for(&self, llm: LLMType) -> bool {
        self.installations
            .iter()
            .any(|i| i.llm == llm && i.installed)
    }

    /// Get installation for a specific LLM
    pub fn installation_for(&self, llm: LLMType) -> Option<&SkillInstallation> {
        self.installations.iter().find(|i| i.llm == llm)
    }
}

/// Configuration for skill synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    /// Target LLMs to sync to
    pub targets: Vec<LLMType>,
    /// Whether to sync to global (user home) or local (workspace) directories
    pub scope: SyncScope,
    /// Whether to remove skills not present in source
    pub delete_missing: bool,
    /// Whether to overwrite existing skills
    pub overwrite: bool,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            targets: LLMType::all(),
            scope: SyncScope::Global,
            delete_missing: false,
            overwrite: true,
        }
    }
}

/// Scope for skill installation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncScope {
    /// User home directory (~/.claude, ~/.codex, etc.)
    Global,
    /// Current workspace (.claude, .codex, etc.)
    Workspace,
}

/// Result of a sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    /// Skills that were installed
    pub installed: Vec<(SkillId, LLMType)>,
    /// Skills that were updated
    pub updated: Vec<(SkillId, LLMType)>,
    /// Skills that were removed
    pub removed: Vec<(SkillId, LLMType)>,
    /// Skills that failed to sync
    pub failed: Vec<(SkillId, LLMType, String)>,
}

impl SyncResult {
    /// Check if the sync was completely successful
    pub fn is_success(&self) -> bool {
        self.failed.is_empty()
    }

    /// Get total number of changes
    pub fn total_changes(&self) -> usize {
        self.installed.len() + self.updated.len() + self.removed.len()
    }
}

/// Error types for skill portability operations
#[derive(thiserror::Error, Debug)]
pub enum SkillError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Invalid skill name: {0}")]
    InvalidName(String),

    #[error("Skill not found: {0}")]
    NotFound(SkillId),

    #[error("LLM not supported: {0}")]
    UnsupportedLLM(String),

    #[error("Installation failed for {llm}: {message}")]
    InstallationFailed { llm: LLMType, message: String },

    #[error("Sync failed: {0}")]
    SyncFailed(String),

    #[error("Path traversal attempt detected: {0}")]
    PathTraversal(PathBuf),
}

/// Trait for skill drivers
///
/// Each driver knows how to install skills for a specific LLM tool.
#[async_trait::async_trait]
pub trait SkillDriver: Send + Sync {
    /// Get the LLM type this driver handles
    fn llm_type(&self) -> LLMType;

    /// Get the display name for this driver
    fn name(&self) -> &'static str {
        self.llm_type().display_name()
    }

    /// Get the target directory for skill installation
    ///
    /// # Arguments
    /// * `base_dir` - The base directory (home or workspace)
    fn target_dir(&self, base_dir: &Path) -> PathBuf;

    /// Install a skill
    ///
    /// # Arguments
    /// * `skill` - The skill to install
    /// * `base_dir` - The base directory for installation
    async fn install_skill(&self, skill: &Skill, base_dir: &Path) -> Result<(), SkillError>;

    /// Remove a skill
    ///
    /// # Arguments
    /// * `skill_name` - The name of the skill to remove
    /// * `base_dir` - The base directory
    async fn remove_skill(&self, skill_name: &str, base_dir: &Path) -> Result<(), SkillError>;

    /// List installed skills
    ///
    /// # Arguments
    /// * `base_dir` - The base directory
    async fn list_skills(&self, base_dir: &Path) -> Result<Vec<Skill>, SkillError>;

    /// Check if a skill is installed
    ///
    /// # Arguments
    /// * `skill_name` - The skill name
    /// * `base_dir` - The base directory
    async fn is_installed(&self, skill_name: &str, base_dir: &Path) -> Result<bool, SkillError> {
        let skills = self.list_skills(base_dir).await?;
        Ok(skills.iter().any(|s| s.name == skill_name))
    }

    /// Get the file patterns this driver recognizes
    fn skill_patterns(&self) -> Vec<&'static str>;
}

/// Helper function to derive a skill name from a file path
pub fn derive_skill_name(path: &Path) -> String {
    // For SKILL.md files, use parent directory name
    if path.file_name().map(|n| n == "SKILL.md").unwrap_or(false) {
        path.parent()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "skill".to_string())
    } else {
        // For other .md files, use filename without extension
        path.file_stem()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "skill".to_string())
    }
}

/// Helper function to get the global config directory for an LLM
pub fn global_config_dir(llm: LLMType) -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(llm.config_dir_name()))
}

/// Helper function to get the workspace config directory for an LLM
pub fn workspace_config_dir(llm: LLMType, workspace: &Path) -> PathBuf {
    workspace.join(llm.config_dir_name())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_type_display() {
        assert_eq!(LLMType::Claude.to_string(), "Claude Code");
        assert_eq!(LLMType::Codex.to_string(), "OpenAI Codex");
    }

    #[test]
    fn test_skill_creation() {
        let skill = Skill::new("test-skill", "# Test Skill\n\nContent here.");
        assert_eq!(skill.name, "test-skill");
        assert!(skill.description.is_none());
    }

    #[test]
    fn test_derive_skill_name() {
        let path = Path::new("/skills/my-skill/SKILL.md");
        assert_eq!(derive_skill_name(path), "my-skill");

        let path = Path::new("/skills/my-skill.md");
        assert_eq!(derive_skill_name(path), "my-skill");
    }
}
