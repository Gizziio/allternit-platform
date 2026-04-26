use crate::tool_executor::{ToolCall, ToolExecutor};
use allternit_tools_gateway::{SdkToolExecutor, ToolExecutionRequest, ToolGatewayError};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct ToolExecutorAdapter {
    tool_executor: Arc<RwLock<ToolExecutor>>,
}

impl ToolExecutorAdapter {
    pub fn new(tool_executor: Arc<RwLock<ToolExecutor>>) -> Self {
        Self { tool_executor }
    }
}

#[async_trait::async_trait]
impl SdkToolExecutor for ToolExecutorAdapter {
    async fn execute(
        &self,
        request: &ToolExecutionRequest,
    ) -> Result<serde_json::Value, ToolGatewayError> {
        let executor = self.tool_executor.read().await;
        let call = ToolCall {
            tool_id: request.tool_id.clone(),
            parameters: request.input.clone(),
        };
        let result = executor.execute(&call).await;
        if result.success {
            Ok(result.result.unwrap_or(serde_json::Value::Null))
        } else {
            Err(ToolGatewayError::ExecutionFailed(
                result.error.unwrap_or_else(|| "Unknown error".to_string()),
            ))
        }
    }
}
