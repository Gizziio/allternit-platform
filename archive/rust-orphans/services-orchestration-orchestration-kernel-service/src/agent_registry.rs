use crate::types::AgentSpec;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct AgentRegistry {
    templates: Arc<RwLock<HashMap<String, AgentSpec>>>,
    storage_path: PathBuf,
}

impl AgentRegistry {
    pub fn new(storage_dir: PathBuf) -> Self {
        let storage_path = storage_dir.join("agents.json");
        let templates = if let Ok(content) = fs::read_to_string(&storage_path) {
            serde_json::from_str(&content).unwrap_or_else(|_| HashMap::new())
        } else {
            HashMap::new()
        };

        Self {
            templates: Arc::new(RwLock::new(templates)),
            storage_path,
        }
    }

    pub async fn register_defaults(&self) -> anyhow::Result<()> {
        let mut templates = self.templates.write().await;

        if !templates.contains_key("researcher") {
            templates.insert(
                "researcher".to_string(),
                AgentSpec {
                    id: "spec_researcher".to_string(),
                    role: "Researcher".to_string(),
                    description: "Researches topics and gathers information.".to_string(),
                    tools: vec!["search".to_string(), "browser".to_string()],
                    policies: vec!["read_only".to_string()],
                    publisher: crate::types::AgentPublisher {
                        publisher_id: "system".to_string(),
                        public_key_id: "system".to_string(),
                    },
                    signature: crate::types::AgentSignature {
                        manifest_sig: String::new(),
                        bundle_hash: String::new(),
                    },
                },
            );
        }

        if !templates.contains_key("builder") {
            templates.insert(
                "builder".to_string(),
                AgentSpec {
                    id: "spec_builder".to_string(),
                    role: "Builder".to_string(),
                    description: "Implements code and modifies files.".to_string(),
                    tools: vec!["fs_write".to_string(), "shell".to_string()],
                    policies: vec!["plan_first".to_string()],
                    publisher: crate::types::AgentPublisher {
                        publisher_id: "system".to_string(),
                        public_key_id: "system".to_string(),
                    },
                    signature: crate::types::AgentSignature {
                        manifest_sig: String::new(),
                        bundle_hash: String::new(),
                    },
                },
            );
        }

        drop(templates);
        self.save().await
    }

    pub async fn register_template(&self, spec: AgentSpec) -> anyhow::Result<()> {
        let mut templates = self.templates.write().await;
        templates.insert(spec.role.to_lowercase(), spec);
        drop(templates);
        self.save().await
    }

    pub async fn get_template(&self, role: &str) -> Option<AgentSpec> {
        self.templates
            .read()
            .await
            .get(&role.to_lowercase())
            .cloned()
    }

    pub async fn list_templates(&self) -> Vec<AgentSpec> {
        self.templates.read().await.values().cloned().collect()
    }

    async fn save(&self) -> anyhow::Result<()> {
        let templates = self.templates.read().await;
        let content = serde_json::to_string_pretty(&*templates)?;
        if let Some(parent) = self.storage_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&self.storage_path, content)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_agent_registry_persistence() {
        let dir = tempdir().unwrap();
        let registry = AgentRegistry::new(dir.path().to_path_buf());

        registry.register_defaults().await.unwrap();
        let templates = registry.list_templates().await;
        assert!(templates.len() >= 2);

        // Check if researcher exists
        let researcher = registry.get_template("researcher").await;
        assert!(researcher.is_some());
        assert_eq!(researcher.unwrap().role, "Researcher");
    }
}
