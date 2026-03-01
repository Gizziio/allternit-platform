//! Skills Registry
//! 
//! Discovers, indexes, and routes to skills in the skills/ directory.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use anyhow::Result;

/// Skill registry index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsRegistry {
    pub version: String,
    pub generated_at: chrono::DateTime<chrono::Utc>,
    pub skills: HashMap<String, SkillDefinition>,
}

/// Skill definition from SKILL.md + contract.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDefinition {
    pub id: String,
    pub version: String,
    pub intent: String,
    pub routing: SkillRouting,
    pub permissions: SkillPermissions,
    pub inputs_schema: serde_json::Value,
    pub outputs_schema: serde_json::Value,
    pub verification: SkillVerification,
    pub paths: SkillPaths,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRouting {
    pub positive_triggers: Vec<String>,
    pub negative_triggers: Vec<String>,
    pub required_context: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillPermissions {
    pub tool_tiers_allowed: Vec<String>,
    pub destructive_requires_approval: bool,
    pub network_allowed: bool,
    pub allowed_write_paths: Vec<String>,
    pub allowed_read_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillVerification {
    pub required: bool,
    pub preferred_commands: Vec<String>,
    pub fallback_manual: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillPaths {
    pub skill_md: PathBuf,
    pub contract_json: PathBuf,
    pub tests_dir: Option<PathBuf>,
}

impl SkillsRegistry {
    /// Build registry from skills/ directory
    pub fn from_directory(skills_dir: &Path) -> Result<Self> {
        let mut registry = Self {
            version: "1.0.0".to_string(),
            generated_at: chrono::Utc::now(),
            skills: HashMap::new(),
        };
        
        if !skills_dir.exists() {
            return Ok(registry);
        }
        
        // Iterate through skill directories
        for entry in std::fs::read_dir(skills_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() && !path.file_name().unwrap_or_default().to_string_lossy().starts_with('_') {
                if let Ok(skill) = Self::load_skill(&path) {
                    registry.skills.insert(skill.id.clone(), skill);
                }
            }
        }
        
        Ok(registry)
    }
    
    /// Load a single skill from its directory
    fn load_skill(skill_dir: &Path) -> Result<SkillDefinition> {
        let contract_path = skill_dir.join("contract.json");
        let skill_md_path = skill_dir.join("SKILL.md");
        
        // Must have contract.json
        if !contract_path.exists() {
            anyhow::bail!("Skill missing contract.json: {}", skill_dir.display());
        }
        
        // Parse contract
        let contract_content = std::fs::read_to_string(&contract_path)?;
        let contract: serde_json::Value = serde_json::from_str(&contract_content)?;
        
        let id = contract["skill_id"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing skill_id"))?
            .to_string();
        
        let routing = SkillRouting {
            positive_triggers: Self::json_array_to_vec(&contract["routing"]["positive_triggers"]),
            negative_triggers: Self::json_array_to_vec(&contract["routing"]["negative_triggers"]),
            required_context: Self::json_object_to_map(&contract["routing"]["required_context"]),
        };
        
        let permissions = SkillPermissions {
            tool_tiers_allowed: Self::json_array_to_vec(&contract["permissions"]["tool_tiers_allowed"]),
            destructive_requires_approval: contract["permissions"]["destructive_requires_approval"]
                .as_bool()
                .unwrap_or(true),
            network_allowed: contract["permissions"]["network"]["allowed"]
                .as_bool()
                .unwrap_or(false),
            allowed_write_paths: Self::json_array_to_vec(&contract["permissions"]["allowed_write_paths"]),
            allowed_read_paths: Self::json_array_to_vec(&contract["permissions"]["allowed_read_paths"]),
        };
        
        let verification = SkillVerification {
            required: contract["verification"]["required"].as_bool().unwrap_or(true),
            preferred_commands: Self::json_array_to_vec(&contract["verification"]["preferred_commands"]),
            fallback_manual: contract["verification"]["fallback_manual_steps_required_if_no_tests"]
                .as_bool()
                .unwrap_or(true),
        };
        
        let paths = SkillPaths {
            skill_md: skill_md_path.clone(),
            contract_json: contract_path,
            tests_dir: Some(skill_dir.join("tests")),
        };
        
        Ok(SkillDefinition {
            id,
            version: contract["version"].as_str().unwrap_or("1.0.0").to_string(),
            intent: contract["intent"].as_str().unwrap_or("").to_string(),
            routing,
            permissions,
            inputs_schema: contract["inputs_schema"].clone(),
            outputs_schema: contract["outputs_schema"].clone(),
            verification,
            paths,
        })
    }
    
    /// Find skills matching a query
    pub fn find_matching(&self, query: &str, context: &HashMap<String, bool>) -> Vec<&SkillDefinition> {
        let mut matches = Vec::new();
        
        for skill in self.skills.values() {
            let score = Self::calculate_match_score(skill, query, context);
            if score > 0 {
                matches.push(skill);
            }
        }
        
        // Sort by relevance (would need proper scoring)
        matches
    }
    
    /// Calculate how well a skill matches the query
    fn calculate_match_score(skill: &SkillDefinition, query: &str, context: &HashMap<String, bool>) -> i32 {
        let mut score = 0;
        let query_lower = query.to_lowercase();
        
        // Check positive triggers
        for trigger in &skill.routing.positive_triggers {
            if query_lower.contains(&trigger.to_lowercase()) {
                score += 10;
            }
        }
        
        // Check negative triggers (penalty)
        for trigger in &skill.routing.negative_triggers {
            if query_lower.contains(&trigger.to_lowercase()) {
                score -= 20;
            }
        }
        
        // Check required context
        for (key, required) in &skill.routing.required_context {
            if let Some(has_context) = context.get(key) {
                if *has_context == *required {
                    score += 5;
                } else {
                    score -= 10;
                }
            }
        }
        
        // Check intent match
        if query_lower.contains(&skill.intent.to_lowercase()) {
            score += 3;
        }
        
        score
    }
    
    /// Get skill by ID
    pub fn get(&self, id: &str) -> Option<&SkillDefinition> {
        self.skills.get(id)
    }
    
    /// List all skills
    pub fn list(&self) -> Vec<&SkillDefinition> {
        self.skills.values().collect()
    }
    
    /// Save registry to JSON
    pub fn save(&self, path: &Path) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
    
    /// Load registry from JSON
    pub fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let registry: Self = serde_json::from_str(&content)?;
        Ok(registry)
    }
    
    // Helper functions
    fn json_array_to_vec(value: &serde_json::Value) -> Vec<String> {
        value
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    }
    
    fn json_object_to_map(value: &serde_json::Value) -> HashMap<String, bool> {
        value
            .as_object()
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| v.as_bool().map(|b| (k.clone(), b)))
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// Skill router - determines which skill to use
pub struct SkillRouter<'a> {
    registry: &'a SkillsRegistry,
}

impl<'a> SkillRouter<'a> {
    pub fn new(registry: &'a SkillsRegistry) -> Self {
        Self { registry }
    }
    
    /// Route a request to the best skill
    pub fn route(&self, request: &str, context: &HashMap<String, bool>) -> Option<&'a SkillDefinition> {
        let matches = self.registry.find_matching(request, context);
        
        // Return the best match (highest score)
        // In a real implementation, we'd sort by the calculated score
        matches.into_iter().next()
    }
    
    /// Suggest skills for a given task
    pub fn suggest(&self, task: &str, limit: usize) -> Vec<&'a SkillDefinition> {
        let context = HashMap::new();
        let matches = self.registry.find_matching(task, &context);
        matches.into_iter().take(limit).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_empty_registry() {
        let registry = SkillsRegistry {
            version: "1.0.0".to_string(),
            generated_at: chrono::Utc::now(),
            skills: HashMap::new(),
        };
        
        assert!(registry.list().is_empty());
        assert!(registry.get("test").is_none());
    }
    
    #[test]
    fn test_skill_routing() {
        let skill = SkillDefinition {
            id: "code_review".to_string(),
            version: "1.0.0".to_string(),
            intent: "Review code for quality".to_string(),
            routing: SkillRouting {
                positive_triggers: vec!["review".to_string(), "code".to_string()],
                negative_triggers: vec!["quick fix".to_string()],
                required_context: HashMap::new(),
            },
            permissions: SkillPermissions {
                tool_tiers_allowed: vec!["read_only".to_string()],
                destructive_requires_approval: false,
                network_allowed: false,
                allowed_write_paths: vec![],
                allowed_read_paths: vec!["workspace/**".to_string()],
            },
            inputs_schema: serde_json::json!({}),
            outputs_schema: serde_json::json!({}),
            verification: SkillVerification {
                required: true,
                preferred_commands: vec![],
                fallback_manual: true,
            },
            paths: SkillPaths {
                skill_md: PathBuf::from("skills/code_review/SKILL.md"),
                contract_json: PathBuf::from("skills/code_review/contract.json"),
                tests_dir: None,
            },
        };
        
        let mut registry = SkillsRegistry {
            version: "1.0.0".to_string(),
            generated_at: chrono::Utc::now(),
            skills: HashMap::new(),
        };
        
        registry.skills.insert(skill.id.clone(), skill);
        
        let context = HashMap::new();
        let matches = registry.find_matching("review my code", &context);
        assert!(!matches.is_empty());
    }
}
