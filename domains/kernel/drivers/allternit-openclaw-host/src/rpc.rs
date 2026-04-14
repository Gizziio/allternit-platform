//! OpenClaw RPC Client
//!
//! HTTP client for OpenClaw REST API (alternative to stdio RPC)

use serde_json::Value;
use std::time::Duration;
use tracing::debug;

use crate::errors::HostError;

/// HTTP client for OpenClaw REST API
#[derive(Debug, Clone)]
pub struct OpenClawHttpClient {
    base_url: String,
    client: reqwest::Client,
    auth_token: Option<String>,
}

impl OpenClawHttpClient {
    /// Create a new HTTP client
    pub fn new(base_url: impl Into<String>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            base_url: base_url.into(),
            client,
            auth_token: None,
        }
    }

    /// Create with authentication token
    pub fn with_auth(mut self, token: impl Into<String>) -> Self {
        self.auth_token = Some(token.into());
        self
    }

    /// Call OpenClaw method via HTTP POST
    pub async fn call(&self, method: &str, params: Value) -> Result<Value, HostError> {
        let url = format!("{}/api/{}", self.base_url, method);

        debug!("OpenClaw HTTP call: {} with params: {}", url, params);

        let mut request = self.client.post(&url).json(&params);

        if let Some(token) = &self.auth_token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request
            .send()
            .await
            .map_err(|e| HostError::IoError(format!("HTTP request failed: {}", e)))?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(HostError::RpcError {
                code: status.as_u16() as i64,
                message: error_text,
            });
        }

        let result: Value = response
            .json()
            .await
            .map_err(|e| HostError::Deserialization(e.to_string()))?;

        Ok(result)
    }

    /// Health check via HTTP
    pub async fn health_check(&self) -> Result<(), HostError> {
        let url = format!("{}/health", self.base_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| HostError::IoError(format!("Health check failed: {}", e)))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(HostError::HealthCheckFailed(format!(
                "Health check returned status: {}",
                response.status()
            )))
        }
    }

    /// Get OpenClaw info
    pub async fn get_info(&self) -> Result<Value, HostError> {
        let url = format!("{}/api/info", self.base_url);

        let mut request = self.client.get(&url);

        if let Some(token) = &self.auth_token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request
            .send()
            .await
            .map_err(|e| HostError::IoError(format!("Info request failed: {}", e)))?;

        response
            .json()
            .await
            .map_err(|e| HostError::Deserialization(e.to_string()))
    }
}

/// RPC method types for OpenClaw
pub mod methods {
    /// Skills namespace
    pub const SKILLS_LIST: &str = "skills.list";
    pub const SKILLS_GET: &str = "skills.get";
    pub const SKILLS_EXECUTE: &str = "skills.execute";
    pub const SKILLS_INSTALL: &str = "skills.install";
    pub const SKILLS_UNINSTALL: &str = "skills.uninstall";

    /// Sessions namespace
    pub const SESSIONS_LIST: &str = "sessions.list";
    pub const SESSIONS_GET: &str = "sessions.get";
    pub const SESSIONS_CREATE: &str = "sessions.create";
    pub const SESSIONS_DELETE: &str = "sessions.delete";
    pub const SESSIONS_EXPORT: &str = "sessions.export";
    pub const SESSIONS_IMPORT: &str = "sessions.import";

    /// Gateway namespace
    pub const GATEWAY_STATUS: &str = "gateway.status";
    pub const GATEWAY_CONNECT: &str = "gateway.connect";
    pub const GATEWAY_DISCONNECT: &str = "gateway.disconnect";

    /// System namespace
    pub const SYSTEM_INFO: &str = "system.info";
    pub const SYSTEM_SHUTDOWN: &str = "system.shutdown";
    pub const HEALTH_PING: &str = "health.ping";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = OpenClawHttpClient::new("http://localhost:18789");
        assert_eq!(client.base_url, "http://localhost:18789");
    }

    #[test]
    fn test_client_with_auth() {
        let client = OpenClawHttpClient::new("http://localhost:18789").with_auth("test-token");
        assert_eq!(client.auth_token, Some("test-token".to_string()));
    }
}
