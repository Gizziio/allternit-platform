use async_trait::async_trait;
use anyhow::Result;
use a2rchitech_skills::SkillRegistry;
use std::sync::Arc;

#[async_trait]
pub trait ExtensionRegistry: Send + Sync {
    async fn list_available_tools(&self) -> Result<Vec<ToolMetadata>>;
}

pub struct ToolMetadata {
    pub name: String,
    pub description: String,
    pub schema: serde_json::Value,
}

pub struct SkillAdapter {
    inner: Arc<SkillRegistry>,
}

impl SkillAdapter {
    pub fn new(inner: Arc<SkillRegistry>) -> Self {
        Self { inner }
    }
}

#[async_trait]
impl ExtensionRegistry for SkillAdapter {
    async fn list_available_tools(&self) -> Result<Vec<ToolMetadata>> {
        let tools = self.inner.create_jit_skill_menu().await?;
        Ok(tools.into_iter().map(|t| ToolMetadata {
            name: t.id,
            description: t.description,
            schema: t.input_schema,
        }).collect())
    }
}
