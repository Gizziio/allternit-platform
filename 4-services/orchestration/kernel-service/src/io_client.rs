//! IO Service HTTP Client
//!
//! HTTP client for calling the IO Service (LAW-ONT-002 compliant)
//! All tool execution flows through IO Service, not direct ToolGateway

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteToolRequest {
    pub tool_id: String,
    pub input: Value,
    pub correlation_id: String,
    pub run_id: String,
    pub wih_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteToolResponse {
    pub success: bool,
    pub output: Option<Value>,
    pub error: Option<ToolError>,
    pub io_captured: bool,
    pub policy_enforced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolError {
    pub code: String,
    pub message: String,
    pub details: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct IoServiceClient {
    client: Client,
    base_url: String,
}

impl IoServiceClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
        }
    }

    /// Execute a tool through the IO Service
    ///
    /// LAW-ONT-002: Only IO can execute side effects
    /// This client is the ONLY permitted path for tool execution
    pub async fn execute_tool(
        &self,
        tool_id: &str,
        input: Value,
        correlation_id: &str,
        run_id: &str,
        wih_id: &str,
    ) -> Result<ExecuteToolResponse, IoServiceError> {
        let request = ExecuteToolRequest {
            tool_id: tool_id.to_string(),
            input,
            correlation_id: correlation_id.to_string(),
            run_id: run_id.to_string(),
            wih_id: wih_id.to_string(),
        };

        let url = format!("{}/v1/tools/execute", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| IoServiceError::Connection(e.to_string()))?;

        if !response.status().is_success() {
            return Err(IoServiceError::Http(format!(
                "IO Service returned status {}",
                response.status()
            )));
        }

        let result: ExecuteToolResponse = response
            .json()
            .await
            .map_err(|e| IoServiceError::Parse(e.to_string()))?;

        Ok(result)
    }

    /// Health check
    pub async fn health(&self) -> Result<bool, IoServiceError> {
        let url = format!("{}/health", self.base_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| IoServiceError::Connection(e.to_string()))?;

        Ok(response.status().is_success())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum IoServiceError {
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Tool execution failed: {0}")]
    ToolExecution(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_io_service_client_creation() {
        let client = IoServiceClient::new("http://127.0.0.1:3510".to_string());
        assert_eq!(client.base_url, "http://127.0.0.1:3510");
    }
}
