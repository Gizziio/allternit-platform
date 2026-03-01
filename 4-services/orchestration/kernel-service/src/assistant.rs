use crate::types::AssistantIdentity;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct AssistantManager {
    identity: Arc<RwLock<AssistantIdentity>>,
    storage_path: PathBuf,
}

impl AssistantManager {
    pub fn new(storage_dir: PathBuf) -> Self {
        let storage_path = storage_dir.join("assistant.json");
        let identity = if let Ok(content) = fs::read_to_string(&storage_path) {
            serde_json::from_str(&content).unwrap_or_else(|_| Self::default_identity())
        } else {
            Self::default_identity()
        };

        Self {
            identity: Arc::new(RwLock::new(identity)),
            storage_path,
        }
    }

    fn default_identity() -> AssistantIdentity {
        AssistantIdentity {
            id: "asst_default".to_string(),
            name: "A2rchitech".to_string(),
            persona: "You are a sovereign agentic operating system.".to_string(),
            preferences: serde_json::json!({}),
        }
    }

    pub async fn get_identity(&self) -> AssistantIdentity {
        self.identity.read().await.clone()
    }

    pub async fn update_identity(&self, new_identity: AssistantIdentity) -> anyhow::Result<()> {
        *self.identity.write().await = new_identity.clone();
        self.save().await
    }

    async fn save(&self) -> anyhow::Result<()> {
        let identity = self.identity.read().await;
        let content = serde_json::to_string_pretty(&*identity)?;
        if let Some(parent) = self.storage_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&self.storage_path, content)?;
        Ok(())
    }
}
