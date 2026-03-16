//! Skills registry implementation for WASM backend

use serde::{Serialize, Deserialize};
use crate::wasm::storage::BrowserStorage;
use crate::Result;

/// Skill definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub installed: bool,
    pub capabilities: Vec<String>,
    pub config: Option<serde_json::Value>,
    pub metadata: Option<SkillMetadata>,
}

/// Skill metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub author: Option<String>,
    pub license: Option<String>,
    pub repository: Option<String>,
    pub documentation: Option<String>,
    pub tags: Vec<String>,
    pub categories: Vec<String>,
}

/// Skill installation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInstallRequest {
    pub id: String,
    pub version: Option<String>,
    pub config: Option<serde_json::Value>,
}

/// Skills registry
pub struct SkillsRegistry {
    storage: BrowserStorage,
    workspace_id: String,
}

impl SkillsRegistry {
    /// Create new skills registry
    pub fn new(storage: BrowserStorage, workspace_id: &str) -> Self {
        Self {
            storage,
            workspace_id: workspace_id.to_string(),
        }
    }
    
    fn skill_key(&self, skill_id: &str) -> String {
        format!("{}/skills/{}", self.workspace_id, skill_id)
    }
    
    /// Initialize default skills
    pub fn init_default_skills(&self) -> Result<()> {
        let defaults = vec![
            Skill {
                id: "fs".to_string(),
                name: "File System".to_string(),
                description: "Read and write files in the workspace".to_string(),
                version: "1.0.0".to_string(),
                installed: true,
                capabilities: vec!["read".to_string(), "write".to_string()],
                config: None,
                metadata: Some(SkillMetadata {
                    author: Some("A2R".to_string()),
                    license: Some("MIT".to_string()),
                    repository: None,
                    documentation: Some("https://docs.a2r.dev/skills/fs".to_string()),
                    tags: vec!["core".to_string(), "filesystem".to_string()],
                    categories: vec!["system".to_string()],
                }),
            },
            Skill {
                id: "shell".to_string(),
                name: "Shell Execution".to_string(),
                description: "Execute shell commands".to_string(),
                version: "1.0.0".to_string(),
                installed: true,
                capabilities: vec!["execute".to_string()],
                config: None,
                metadata: Some(SkillMetadata {
                    author: Some("A2R".to_string()),
                    license: Some("MIT".to_string()),
                    repository: None,
                    documentation: Some("https://docs.a2r.dev/skills/shell".to_string()),
                    tags: vec!["core".to_string(), "execution".to_string()],
                    categories: vec!["system".to_string()],
                }),
            },
            Skill {
                id: "search".to_string(),
                name: "Web Search".to_string(),
                description: "Search the web for information".to_string(),
                version: "1.0.0".to_string(),
                installed: false,
                capabilities: vec!["search".to_string()],
                config: None,
                metadata: Some(SkillMetadata {
                    author: Some("A2R".to_string()),
                    license: Some("MIT".to_string()),
                    repository: None,
                    documentation: Some("https://docs.a2r.dev/skills/search".to_string()),
                    tags: vec!["web".to_string(), "search".to_string()],
                    categories: vec!["external".to_string()],
                }),
            },
        ];
        
        for skill in defaults {
            if self.get_skill(&skill.id)?.is_none() {
                self.storage.set(&self.skill_key(&skill.id), &skill)?;
            }
        }
        
        Ok(())
    }
    
    /// List all skills
    pub fn list_skills(&self) -> Result<Vec<Skill>> {
        let prefix = format!("{}/skills/", self.workspace_id);
        self.storage.get_all_with_prefix(&prefix)
    }
    
    /// List installed skills only
    pub fn list_installed(&self) -> Result<Vec<Skill>> {
        let all = self.list_skills()?;
        let installed: Vec<Skill> = all.into_iter().filter(|s| s.installed).collect();
        Ok(installed)
    }
    
    /// Get skill by ID
    pub fn get_skill(&self, skill_id: &str) -> Result<Option<Skill>> {
        self.storage.get(&self.skill_key(skill_id))
    }
    
    /// Install a skill
    pub fn install_skill(&self, skill_id: &str, config: Option<serde_json::Value>) -> Result<Skill> {
        let mut skill = self.get_skill(skill_id)?
            .ok_or_else(|| format!("Skill not found: {}", skill_id))?;
        
        skill.installed = true;
        if let Some(c) = config {
            skill.config = Some(c);
        }
        
        self.storage.set(&self.skill_key(skill_id), &skill)?;
        Ok(skill)
    }
    
    /// Uninstall a skill
    pub fn uninstall_skill(&self, skill_id: &str) -> Result<Skill> {
        let mut skill = self.get_skill(skill_id)?
            .ok_or_else(|| format!("Skill not found: {}", skill_id))?;
        
        skill.installed = false;
        self.storage.set(&self.skill_key(skill_id), &skill)?;
        Ok(skill)
    }
    
    /// Update skill configuration
    pub fn update_config(&self, skill_id: &str, config: serde_json::Value) -> Result<Skill> {
        let mut skill = self.get_skill(skill_id)?
            .ok_or_else(|| format!("Skill not found: {}", skill_id))?;
        
        skill.config = Some(config);
        self.storage.set(&self.skill_key(skill_id), &skill)?;
        Ok(skill)
    }
    
    /// Search skills by name or description
    pub fn search(&self, query: &str) -> Result<Vec<Skill>> {
        let skills = self.list_skills()?;
        let query_lower = query.to_lowercase();
        
        let results: Vec<Skill> = skills
            .into_iter()
            .filter(|s| {
                s.name.to_lowercase().contains(&query_lower) ||
                s.description.to_lowercase().contains(&query_lower) ||
                s.id.to_lowercase().contains(&query_lower)
            })
            .collect();
        
        Ok(results)
    }
    
    /// Get skills by category
    pub fn get_by_category(&self, category: &str) -> Result<Vec<Skill>> {
        let skills = self.list_skills()?;
        let filtered: Vec<Skill> = skills
            .into_iter()
            .filter(|s| {
                s.metadata.as_ref()
                    .map(|m| m.categories.contains(&category.to_string()))
                    .unwrap_or(false)
            })
            .collect();
        Ok(filtered)
    }
    
    /// Check if skill is installed
    pub fn is_installed(&self, skill_id: &str) -> Result<bool> {
        match self.get_skill(skill_id)? {
            Some(skill) => Ok(skill.installed),
            None => Ok(false),
        }
    }
    
    /// Register a new skill (for dynamic skill loading)
    pub fn register_skill(&self, skill: Skill) -> Result<Skill> {
        self.storage.set(&self.skill_key(&skill.id), &skill)?;
        Ok(skill)
    }
}
