use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LLMConfig {
    pub providers: HashMap<String, ProviderAuth>,
    pub active_provider: String,
    pub active_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAuth {
    pub api_key: String,
    pub endpoint: Option<String>, // Optional override
}

#[derive(Debug)]
pub struct ConfigManager {
    config: Arc<RwLock<LLMConfig>>,
    storage_path: PathBuf,
}

impl ConfigManager {
    pub fn new(storage_dir: PathBuf) -> Self {
        let storage_path = storage_dir.join("config").join("llm_config.json");
        let config = if let Ok(content) = fs::read_to_string(&storage_path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            LLMConfig::default()
        };

        Self {
            config: Arc::new(RwLock::new(config)),
            storage_path,
        }
    }

    pub async fn set_auth(
        &self,
        provider: &str,
        key: &str,
        endpoint: Option<String>,
    ) -> anyhow::Result<()> {
        let mut config = self.config.write().await;
        config.providers.insert(
            provider.to_string(),
            ProviderAuth {
                api_key: key.to_string(),
                endpoint,
            },
        );
        drop(config);
        self.save().await
    }

    pub async fn get_auth(&self, provider: &str) -> Option<ProviderAuth> {
        self.config.read().await.providers.get(provider).cloned()
    }

    pub async fn set_active_model(&self, provider: &str, model: &str) -> anyhow::Result<()> {
        let mut config = self.config.write().await;
        config.active_provider = provider.to_string();
        config.active_model = model.to_string();
        drop(config);
        self.save().await
    }

    pub async fn get_active_config(&self) -> (String, String) {
        let config = self.config.read().await;
        (config.active_provider.clone(), config.active_model.clone())
    }

    pub async fn set_mode(&self, mode: &str) -> anyhow::Result<()> {
        let mut config = self.config.write().await;
        // In a real impl, you might have a 'mode' field in LLMConfig
        // For now, let's assume we store it in a generic way or just log it.
        info!("Setting system mode to: {}", mode);
        Ok(())
    }

    pub async fn get_mode(&self) -> anyhow::Result<Option<String>> {
        Ok(Some("standard".to_string()))
    }

    async fn save(&self) -> anyhow::Result<()> {
        let config = self.config.read().await;
        if let Some(parent) = self.storage_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(&*config)?;
        fs::write(&self.storage_path, content)?;
        Ok(())
    }
}
