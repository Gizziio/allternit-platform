use crate::types::SkillPackage;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct SkillManager {
    skills: Arc<RwLock<HashMap<String, SkillPackage>>>,
    storage_path: PathBuf,
}

impl SkillManager {
    pub fn new(storage_dir: PathBuf) -> Self {
        let storage_path = storage_dir.join("skills.json");
        let skills = if let Ok(content) = fs::read_to_string(&storage_path) {
            serde_json::from_str(&content).unwrap_or_else(|_| Self::default_skills())
        } else {
            Self::default_skills()
        };

        Self {
            skills: Arc::new(RwLock::new(skills)),
            storage_path,
        }
    }

    fn default_skills() -> HashMap<String, SkillPackage> {
        let mut map = HashMap::new();
        map.insert(
            "skill_web_research".to_string(),
            SkillPackage {
                id: "skill_web_research".to_string(),
                name: "Web Research".to_string(),
                version: "1.0.0".to_string(),
                description: "Deep research using web search and browser simulation.".to_string(),
                author: "A2rchitech Team".to_string(),
                installed: true,
            },
        );
        map.insert(
            "skill_code_analysis".to_string(),
            SkillPackage {
                id: "skill_code_analysis".to_string(),
                name: "Code Analysis".to_string(),
                version: "0.5.0".to_string(),
                description: "Advanced semantic analysis of codebases.".to_string(),
                author: "A2rchitech Team".to_string(),
                installed: false,
            },
        );
        map
    }

    pub async fn list_skills(&self) -> Vec<SkillPackage> {
        self.skills.read().await.values().cloned().collect()
    }

    pub async fn install_skill(&self, id: &str) -> anyhow::Result<()> {
        let mut skills = self.skills.write().await;
        if let Some(skill) = skills.get_mut(id) {
            skill.installed = true;
            drop(skills);
            self.save().await?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Skill not found: {}", id))
        }
    }

    async fn save(&self) -> anyhow::Result<()> {
        let skills = self.skills.read().await;
        let content = serde_json::to_string_pretty(&*skills)?;
        fs::write(&self.storage_path, content)?;
        Ok(())
    }
}
