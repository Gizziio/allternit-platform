//! Tool Executor
//!
//! Tool execution with timeout and retry logic.

use super::{ToolCall, ToolExecError, ToolResult};
use async_trait::async_trait;
use std::time::Duration;

/// Tool executor trait
#[async_trait]
pub trait ToolExecutor: Send + Sync {
    /// Execute a tool call
    async fn execute(&self, call: &ToolCall) -> Result<ToolResult, ToolExecError>;

    /// Check if tool is available
    fn is_available(&self, tool_name: &str) -> bool;

    /// List available tools
    fn list_tools(&self) -> Vec<String>;
}

/// Echo tool for testing - returns input as output
pub struct EchoToolExecutor;

impl Default for EchoToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl EchoToolExecutor {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ToolExecutor for EchoToolExecutor {
    async fn execute(&self, call: &ToolCall) -> Result<ToolResult, ToolExecError> {
        let result = serde_json::json!({
            "echo": call.arguments,
            "tool_name": call.name,
        });

        Ok(ToolResult {
            tool_call_id: call.id.clone(),
            result,
            error: None,
            execution_time_ms: Some(0),
        })
    }

    fn is_available(&self, _tool_name: &str) -> bool {
        true
    }

    fn list_tools(&self) -> Vec<String> {
        vec!["echo".to_string()]
    }
}

/// Execute tool with timeout
pub async fn execute_with_timeout<T: ToolExecutor>(
    executor: &T,
    call: &ToolCall,
    timeout_ms: u64,
) -> Result<ToolResult, ToolExecError> {
    tokio::time::timeout(Duration::from_millis(timeout_ms), executor.execute(call))
        .await
        .map_err(|_| ToolExecError::Timeout(timeout_ms))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_echo_tool() {
        let executor = EchoToolExecutor;
        let call = ToolCall {
            id: "1".to_string(),
            name: "echo".to_string(),
            arguments: serde_json::json!({"message": "hello"}),
        };

        let result = executor.execute(&call).await.unwrap();
        assert_eq!(result.tool_call_id, "1");
        assert!(result.error.is_none());
        assert_eq!(result.result["echo"]["message"], "hello");
    }
}
