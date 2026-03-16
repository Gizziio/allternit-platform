use a2rchitech_sdk_transport::TransportEnvelope;
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Router: Send + Sync {
    async fn route(&self, envelope: &TransportEnvelope) -> Result<String>;
}

pub struct AgentRouter;

impl Default for AgentRouter {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentRouter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Router for AgentRouter {
    async fn route(&self, _envelope: &TransportEnvelope) -> Result<String> {
        // Logic to determine agent ID from envelope
        // For now, default to "default_agent"
        Ok("default_agent".to_string())
    }
}
