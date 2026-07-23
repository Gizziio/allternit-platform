use crate::controller::SwarmModeImplementation;
use crate::error::SwarmResult;
use crate::types::{ExecutionResult, SwarmMode, Task};
use async_trait::async_trait;
use tracing::info;

/// Hybrid Mode - Combines all three modes
#[derive(Debug, Clone)]
pub struct HybridMode;

impl HybridMode {
    pub fn new() -> Self {
        Self
    }
}

impl Default for HybridMode {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SwarmModeImplementation for HybridMode {
    async fn execute(&self, task: Task) -> SwarmResult<ExecutionResult> {
        info!("Executing in Hybrid mode - delegating to controller");
        
        // Hybrid mode is handled by the controller which sequences the modes
        Ok(ExecutionResult::success(
            task.id(),
            "Hybrid mode executed through controller".to_string(),
        ))
    }

    fn mode(&self) -> SwarmMode {
        SwarmMode::Hybrid
    }

    async fn shutdown(&self) -> SwarmResult<()> {
        Ok(())
    }
}
