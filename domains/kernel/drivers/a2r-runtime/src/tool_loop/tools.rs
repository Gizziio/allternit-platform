//! Tool Execution Interface
//!
//! Traits and implementations for tool execution.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// A tool call request from the provider
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Result of a tool execution
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolResult {
    pub call_id: String,
    pub output: serde_json::Value,
    pub is_error: bool,
}

/// Errors that can occur during tool execution
#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum ToolExecError {
    #[error("Tool not found: {0}")]
    ToolNotFound(String),
    
    #[error("Invalid arguments: {0}")]
    InvalidArguments(String),
    
    #[error("Execution failed: {0}")]
    ExecutionFailed(String),
    
    #[error("Timeout")]
    Timeout,
}

/// Trait for tool executors
#[async_trait]
pub trait ToolExecutor: Send + Sync {
    /// Execute a tool call
    async fn execute(&self, call: &ToolCall) -> Result<ToolResult, ToolExecError>;
}

/// Echo tool executor - returns input as output (for testing)
#[derive(Clone)]
pub struct EchoToolExecutor;

impl EchoToolExecutor {
    pub fn new() -> Self {
        Self
    }
}

impl Default for EchoToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolExecutor for EchoToolExecutor {
    async fn execute(&self, call: &ToolCall) -> Result<ToolResult, ToolExecError> {
        if call.name != "echo" {
            return Err(ToolExecError::ToolNotFound(call.name.clone()));
        }
        
        // Extract the input from arguments
        let input = call.arguments
            .get("input")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        
        Ok(ToolResult {
            call_id: call.id.clone(),
            output: serde_json::json!({
                "echo": input,
                "original_args": call.arguments
            }),
            is_error: false,
        })
    }
}

/// Fake tool executor for tests - can be scripted with responses
pub struct FakeToolExecutor {
    scripted_responses: std::collections::HashMap<String, Result<ToolResult, ToolExecError>>,
}

impl FakeToolExecutor {
    pub fn new() -> Self {
        Self {
            scripted_responses: std::collections::HashMap::new(),
        }
    }
    
    /// Script a response for a specific tool call ID
    pub fn script_response(
        &mut self,
        call_id: String,
        response: Result<ToolResult, ToolExecError>,
    ) {
        self.scripted_responses.insert(call_id, response);
    }
}

#[async_trait]
impl ToolExecutor for FakeToolExecutor {
    async fn execute(&self, call: &ToolCall) -> Result<ToolResult, ToolExecError> {
        // Check for scripted response
        if let Some(response) = self.scripted_responses.get(&call.id) {
            return response.clone();
        }
        
        // Default behavior: echo the tool name
        Ok(ToolResult {
            call_id: call.id.clone(),
            output: serde_json::json!({
                "executed": call.name,
                "args": call.arguments,
                "note": "This is a fake tool executor response"
            }),
            is_error: false,
        })
    }
}

#[cfg(test)]
mod tool_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_echo_tool() {
        let executor = EchoToolExecutor::new();
        let call = ToolCall {
            id: "call_1".to_string(),
            name: "echo".to_string(),
            arguments: serde_json::json!({"input": "hello world"}),
        };
        
        let result = executor.execute(&call).await.unwrap();
        
        assert_eq!(result.call_id, "call_1");
        assert_eq!(result.output["echo"], "hello world");
        assert!(!result.is_error);
    }
    
    #[tokio::test]
    async fn test_echo_tool_not_found() {
        let executor = EchoToolExecutor::new();
        let call = ToolCall {
            id: "call_1".to_string(),
            name: "unknown_tool".to_string(),
            arguments: serde_json::json!({}),
        };
        
        let result = executor.execute(&call).await;
        
        assert!(matches!(result, Err(ToolExecError::ToolNotFound(_))));
    }
    
    #[tokio::test]
    async fn test_fake_tool_executor() {
        let executor = FakeToolExecutor::new();
        let call = ToolCall {
            id: "call_1".to_string(),
            name: "test_tool".to_string(),
            arguments: serde_json::json!({"arg1": "value1"}),
        };
        
        let result = executor.execute(&call).await.unwrap();
        
        assert_eq!(result.call_id, "call_1");
        assert_eq!(result.output["executed"], "test_tool");
    }
}
