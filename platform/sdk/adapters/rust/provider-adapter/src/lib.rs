use async_trait::async_trait;
use allternit_providers::adapters::openai::LLMProvider as BaseLLMProvider;
use anyhow::Result;

#[async_trait]
pub trait ModelProvider: Send + Sync {
    async fn chat_complete(&self, system: &str, user: &str) -> Result<String>;
}

pub struct LLMAdapter {
    inner: Box<dyn BaseLLMProvider>,
}

impl LLMAdapter {
    pub fn new(inner: Box<dyn BaseLLMProvider>) -> Self {
        Self { inner }
    }
}

#[async_trait]
impl ModelProvider for LLMAdapter {
    async fn chat_complete(&self, system: &str, user: &str) -> Result<String> {
        // Map any stable logic or metrics here
        self.inner.complete(system, user).await
    }
}
