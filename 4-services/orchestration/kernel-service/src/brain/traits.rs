use crate::brain::types::{BrainConfig, BrainEvent};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::broadcast;

#[async_trait]
pub trait BrainRuntime: Send + Sync {
    /// Initialize the runtime
    async fn start(&mut self) -> Result<()>;

    /// Send input to the brain (text, tool results, etc.)
    async fn send_input(&mut self, input: &str) -> Result<()>;

    /// Stop the runtime
    async fn stop(&mut self) -> Result<()>;

    /// Get the event receiver channel
    fn subscribe(&self) -> broadcast::Receiver<BrainEvent>;

    /// Check if the runtime is healthy/alive
    async fn health_check(&self) -> Result<bool>;

    /// Get the process ID if applicable
    fn pid(&self) -> Option<u32> {
        None
    }

    /// Get current conversation state for persistence
    async fn get_state(&self) -> Result<Option<serde_json::Value>> {
        Ok(None)
    }

    /// Send tool result back to the brain (for ACP tool round-trip bridge)
    /// Default implementation returns error for non-ACP runtimes
    async fn send_tool_result(&self, _tool_call_id: &str, _result: Value) -> Result<()> {
        Err(anyhow::anyhow!("This runtime does not support tool results"))
    }
}

/// Factory trait for creating runtimes
#[async_trait]
pub trait BrainDriver: Send + Sync {
    async fn create_runtime(
        &self,
        config: &BrainConfig,
        session_id: &str,
    ) -> Result<Box<dyn BrainRuntime>>;

    /// Check if driver supports this brain type (legacy, kept for compatibility)
    fn supports(&self, brain_type: &crate::brain::types::BrainType) -> bool;

    /// Check if driver supports this specific brain configuration
    /// Default implementation falls back to brain_type check
    /// Override this to implement event_mode-based selection
    fn supports_with_config(&self, config: &BrainConfig) -> bool {
        self.supports(&config.brain_type)
    }
}
