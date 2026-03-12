//! Kernel HTTP Client
//!
//! HTTP client for communicating with the A2R kernel/API.
//! Supports standard HTTP requests and SSE (Server-Sent Events) streaming.

use anyhow::{anyhow, Result};
use reqwest::{Client, Response, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::Value;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

/// Kernel API client
pub struct KernelClient {
    http: Client,
    base_url: String,
    auth_token: Option<String>,
    timeout_ms: Option<u64>,
}

/// Brain session information
#[derive(Debug, Clone, serde::Deserialize)]
pub struct BrainSession {
    pub id: String,
    pub brain_id: String,
    pub created_at: i64,
    pub status: String,
    pub workspace_dir: String,
    pub profile_id: Option<String>,
}

/// Health check response
#[derive(Debug, Clone, serde::Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub healthy: bool,
}

/// System presence response
#[derive(Debug, Clone, serde::Deserialize)]
pub struct PresenceResponse {
    pub node_id: String,
    pub connected: bool,
    pub agents: Vec<String>,
}

/// Model information
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
}

/// Models list response
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

/// Skill information
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

/// Skills list response
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SkillsResponse {
    pub skills: Vec<SkillInfo>,
}

/// Session create request
#[derive(Debug, Clone, serde::Serialize)]
pub struct CreateSessionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub agent_id: Option<String>,
}

/// Session create response
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateSessionResponse {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub created_at: i64,
}

/// Intent dispatch request
#[derive(Debug, Clone, serde::Serialize)]
pub struct DispatchIntentRequest {
    pub intent_text: String,
    pub agent_id: Option<String>,
    pub session_id: Option<String>,
    pub model: Option<String>,
    pub deliver: bool,
    pub thinking: Option<String>,
    pub workspace_dir: Option<String>,
}

/// Intent dispatch response
#[derive(Debug, Clone, serde::Deserialize)]
pub struct DispatchIntentResponse {
    pub capsule: Option<Value>,
    pub events: Option<Vec<Value>>,
    pub model: Option<String>,
}

impl KernelClient {
    /// Create a new kernel client from config
    pub fn new(config_manager: &crate::config::ConfigManager) -> Self {
        let config = config_manager.get();
        
        // First check for credentials from 'a2r auth login'
        let (creds_url, creds_token) = crate::commands::auth::get_credentials()
            .map(|c: crate::commands::auth::Credentials| (Some(c.url), Some(c.token)))
            .unwrap_or((None, None));
        
        let base_url = creds_url
            .or_else(|| config.get("kernel_url").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .or_else(|| std::env::var("A2R_CLOUD_URL").ok())
            .unwrap_or_else(|| "http://127.0.0.1:3000".to_string());

        let auth_token = creds_token
            .or_else(|| config.get("auth_token").and_then(|v| v.as_str()).map(|s| s.to_string()));

        let timeout_ms = config
            .get("timeout_ms")
            .and_then(|v| v.as_u64());

        Self {
            http: Client::new(),
            base_url,
            auth_token,
            timeout_ms,
        }
    }

    /// Create a client with runtime overrides
    pub fn with_runtime_overrides(
        &self,
        url: Option<&str>,
        auth: Option<&str>,
        timeout_ms: Option<u64>,
    ) -> Self {
        Self {
            http: Client::new(),
            base_url: url.unwrap_or(&self.base_url).to_string(),
            auth_token: auth.map(|s| s.to_string()).or_else(|| self.auth_token.clone()),
            timeout_ms: timeout_ms.or(self.timeout_ms),
        }
    }

    /// Get the base URL
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Build a URL with path
    fn build_url(&self, path: &str) -> String {
        let base = self.base_url.trim_end_matches('/');
        let path = path.trim_start_matches('/');
        format!("{}/{}", base, path)
    }

    /// Add authentication header to request
    fn add_auth(&self, mut req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(ref token) = self.auth_token {
            req = req.bearer_auth(token);
        }
        req
    }

    /// Apply timeout to request
    fn apply_timeout(&self, mut req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(timeout_ms) = self.timeout_ms {
            req = req.timeout(std::time::Duration::from_millis(timeout_ms));
        }
        req
    }

    // ========================================================================
    // HTTP Methods
    // ========================================================================

    /// GET request
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        let url = self.build_url(path);
        debug!("GET {}", url);

        let req = self.http.get(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        response
            .json::<T>()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    /// POST request
    pub async fn post<T: serde::Serialize, U: DeserializeOwned>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<U, String> {
        let url = self.build_url(path);
        debug!("POST {}", url);

        let req = self.http.post(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);
        let req = req.json(body);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        response
            .json::<U>()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    /// POST request returning raw response
    pub async fn post_raw<T: serde::Serialize>(&self, path: &str, body: &T) -> Result<Response, String> {
        let url = self.build_url(path);
        debug!("POST {}", url);

        let req = self.http.post(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);
        let req = req.json(body);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        Ok(response)
    }

    /// DELETE request
    pub async fn delete(&self, path: &str) -> Result<(), String> {
        let url = self.build_url(path);
        debug!("DELETE {}", url);

        let req = self.http.delete(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        Ok(())
    }

    /// GET request returning raw response for streaming
    pub async fn get_raw(&self, path: &str) -> Result<Response, String> {
        let url = self.build_url(path);
        debug!("GET {}", url);

        let req = self.http.get(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        Ok(response)
    }

    // ========================================================================
    // Health & Status
    // ========================================================================

    /// Health check
    pub async fn health(&self) -> Result<HealthResponse, String> {
        self.get("/v1/system/health").await
    }

    /// System presence
    pub async fn presence(&self) -> Result<PresenceResponse, String> {
        self.get("/v1/system/presence").await
    }

    // ========================================================================
    // Models
    // ========================================================================

    /// List available models
    pub async fn list_models(&self) -> Result<ModelsResponse, String> {
        self.get("/v1/models").await
    }

    /// Set current model
    pub async fn set_model(&self, provider: &str, model: &str) -> Result<(), String> {
        let body = serde_json::json!({
            "provider": provider,
            "model": model,
        });
        let _: Value = self.post("/v1/config/model", &body).await?;
        Ok(())
    }

    // ========================================================================
    // Sessions
    // ========================================================================

    /// List brain sessions
    pub async fn list_brain_sessions(&self) -> Result<Vec<BrainSession>, String> {
        self.get("/v1/sessions").await
    }

    /// Create a new brain session
    pub async fn create_brain_session(
        &self,
        workspace: String,
    ) -> Result<CreateSessionResponse, String> {
        let req = CreateSessionRequest {
            name: None,
            description: None,
            agent_id: None,
        };
        self.post("/v1/sessions", &req).await
    }

    /// Create a new brain session with agent
    pub async fn create_brain_session_with_agent(
        &self,
        agent_id: String,
        workspace: String,
    ) -> Result<CreateSessionResponse, String> {
        let req = CreateSessionRequest {
            name: None,
            description: None,
            agent_id: Some(agent_id),
        };
        self.post("/v1/sessions", &req).await
    }

    /// Terminate a brain session
    pub async fn terminate_brain_session(&self, session_id: &str) -> Result<(), String> {
        self.delete(&format!("/v1/sessions/{}", session_id))
            .await
    }

    // ========================================================================
    /// Stream brain events via SSE
    ///
    /// Connects to the SSE endpoint and returns a channel for receiving events.
    /// Events are parsed from SSE format and sent as JSON values.
    pub async fn stream_brain_events(
        &self,
        session_id: &str,
    ) -> Result<mpsc::Receiver<Value>, String> {
        let url = self.build_url(&format!("/v1/sessions/{}/events", session_id));
        info!("Connecting to SSE stream: {}", url);

        let req = self.http.get(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Failed to connect to SSE stream: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("SSE connection failed: HTTP {} - {}", status, body));
        }

        // Check content type
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if !content_type.contains("text/event-stream") {
            warn!(
                "SSE endpoint returned unexpected content type: {}",
                content_type
            );
        }

        let (tx, rx) = mpsc::channel(1000);

        // Spawn task to read SSE stream
        tokio::spawn(async move {
            use futures_util::StreamExt;
            use tokio::time::{Duration, Instant};

            let mut stream = response.bytes_stream();
            let mut buffer = String::new();
            let mut last_event_time = Instant::now();
            let reconnect_delay = Duration::from_secs(5);

            // Process SSE stream
            'stream: loop {
                match stream.next().await {
                    Some(Ok(chunk)) => {
                        last_event_time = Instant::now();
                        let text = String::from_utf8_lossy(&chunk);
                        buffer.push_str(&text);

                        // Process complete SSE events (separated by double newline)
                        while let Some(pos) = buffer.find("\n\n") {
                            let event = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            // Parse SSE event
                            if let Some(data) = parse_sse_event(&event) {
                                if tx.send(data).await.is_err() {
                                    debug!("SSE receiver dropped, stopping stream");
                                    break 'stream;
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        error!("SSE stream error: {}", e);
                        // Send error event
                        let error_data = serde_json::json!({
                            "type": "stream.error",
                            "error": e.to_string(),
                        });
                        if tx.send(error_data).await.is_err() {
                            break 'stream;
                        }

                        // Wait and try to continue reading
                        tokio::time::sleep(reconnect_delay).await;
                    }
                    None => {
                        // Stream ended
                        debug!("SSE stream ended");
                        let end_data = serde_json::json!({
                            "type": "stream.end",
                        });
                        let _ = tx.send(end_data).await;
                        break 'stream;
                    }
                }

                // Check for timeout (no events for 30 seconds)
                if last_event_time.elapsed() > Duration::from_secs(30) {
                    warn!("SSE stream timeout, no events for 30s");
                    let timeout_data = serde_json::json!({
                        "type": "stream.timeout",
                    });
                    let _ = tx.send(timeout_data).await;
                    break 'stream;
                }
            }

            info!("SSE stream task completed");
        });

        Ok(rx)
    }

    // ========================================================================
    // Skills
    // ========================================================================

    /// List marketplace skills
    pub async fn list_marketplace_skills(&self) -> Result<Vec<Value>, String> {
        let url = self.build_url("/v1/marketplace/skills");
        debug!("GET {}", url);

        let req = self.http.get(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        // Parse response - skills may be in different formats
        let value: Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Extract skills array from various response formats
        let skills = if let Some(arr) = value.as_array() {
            arr.clone()
        } else if let Some(skills) = value.get("skills").and_then(|v| v.as_array()) {
            skills.clone()
        } else if let Some(data) = value.get("data").and_then(|v| v.as_array()) {
            data.clone()
        } else {
            vec![value]
        };

        Ok(skills)
    }

    // ========================================================================
    // Intent Dispatch
    // ========================================================================

    /// Dispatch an intent to the kernel
    pub async fn dispatch_intent(
        &self,
        req: &DispatchIntentRequest,
    ) -> Result<DispatchIntentResponse, String> {
        self.post("/v1/intent/dispatch", req).await
    }

    // ========================================================================
    // Agent Session Methods
    // ========================================================================

    /// List agent sessions
    pub async fn list_agent_sessions(&self) -> Result<Vec<Value>, String> {
        let url = self.build_url("/api/v1/agent-sessions");
        debug!("GET {}", url);

        let req = self.http.get(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        let value: Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Extract sessions array
        let sessions = if let Some(arr) = value.get("sessions").and_then(|v| v.as_array()) {
            arr.clone()
        } else if let Some(arr) = value.as_array() {
            arr.clone()
        } else {
            vec![value]
        };

        Ok(sessions)
    }

    /// Create an agent session
    pub async fn create_agent_session(
        &self,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Value, String> {
        let body = serde_json::json!({
            "name": name,
            "description": description,
        });
        self.post("/api/v1/agent-sessions", &body).await
    }

    /// Get agent session details
    pub async fn get_agent_session(&self, session_id: &str) -> Result<Value, String> {
        self.get(&format!("/api/v1/agent-sessions/{}", session_id)).await
    }

    /// Delete an agent session
    pub async fn delete_agent_session(&self, session_id: &str) -> Result<(), String> {
        self.delete(&format!("/api/v1/agent-sessions/{}", session_id)).await
    }

    /// Send message to agent session
    pub async fn send_agent_message(
        &self,
        session_id: &str,
        text: &str,
        role: Option<&str>,
    ) -> Result<Value, String> {
        let body = serde_json::json!({
            "text": text,
            "role": role.unwrap_or("user"),
        });
        self.post(&format!("/api/v1/agent-sessions/{}/messages", session_id), &body).await
    }

    /// List messages in agent session
    pub async fn list_agent_messages(&self, session_id: &str) -> Result<Vec<Value>, String> {
        let url = self.build_url(&format!("/api/v1/agent-sessions/{}/messages", session_id));
        debug!("GET {}", url);

        let req = self.http.get(&url);
        let req = self.add_auth(req);
        let req = self.apply_timeout(req);

        let response = req
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(format!("HTTP {}: {}", status, body));
        }

        let value: Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Extract messages array
        let messages = if let Some(arr) = value.as_array() {
            arr.clone()
        } else {
            vec![value]
        };

        Ok(messages)
    }

    /// Abort an agent session
    pub async fn abort_agent_session(
        &self,
        session_id: &str,
        reason: Option<&str>,
    ) -> Result<(), String> {
        let body = serde_json::json!({
            "reason": reason,
        });
        let _: Value = self.post(&format!("/api/v1/agent-sessions/{}/abort", session_id), &body).await?;
        Ok(())
    }
}

/// Parse an SSE event and extract the data field as JSON
fn parse_sse_event(event: &str) -> Option<Value> {
    let mut data = String::new();
    let mut event_type = String::from("message");

    for line in event.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with(':') {
            continue;
        }

        if let Some(rest) = line.strip_prefix("event:") {
            event_type = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("data:") {
            data.push_str(rest.trim());
        } else if let Some(rest) = line.strip_prefix("id:") {
            // Ignore id for now
            let _ = rest;
        } else if let Some(rest) = line.strip_prefix("retry:") {
            // Ignore retry for now
            let _ = rest;
        }
    }

    if data.is_empty() {
        return None;
    }

    // Try to parse as JSON
    match serde_json::from_str::<Value>(&data) {
        Ok(mut json) => {
            // Add event type if not present
            if let Some(obj) = json.as_object_mut() {
                if !obj.contains_key("type") {
                    obj.insert("type".to_string(), Value::String(event_type));
                }
            }
            Some(json)
        }
        Err(_) => {
            // Not JSON, wrap as text event
            Some(serde_json::json!({
                "type": event_type,
                "text": data,
            }))
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Extract assistant text from a dispatch response
pub fn extract_assistant_text(payload: &Value) -> Option<String> {
    // Try various response formats
    if let Some(text) = payload.get("text").and_then(|v| v.as_str()) {
        return Some(text.to_string());
    }

    if let Some(response) = payload.get("response").and_then(|v| v.as_str()) {
        return Some(response.to_string());
    }

    if let Some(content) = payload.get("content").and_then(|v| v.as_str()) {
        return Some(content.to_string());
    }

    // Try capsule.outputs format
    if let Some(outputs) = payload
        .get("capsule")
        .and_then(|c| c.get("outputs"))
        .and_then(|o| o.as_array())
    {
        if let Some(first) = outputs.first() {
            if let Some(content) = first.get("content").and_then(|c| c.as_str()) {
                return Some(content.to_string());
            }
        }
    }

    // Try events format
    if let Some(events) = payload.get("events").and_then(|e| e.as_array()) {
        let mut texts = Vec::new();
        for event in events {
            if let Some(kind) = event.get("kind").and_then(|k| k.as_str()) {
                if kind == "directive_compiled" {
                    if let Some(payload) = event.get("payload") {
                        if let Some(directive) = payload.get("directive").and_then(|d| d.as_str()) {
                            texts.push(directive.to_string());
                        }
                    }
                }
            }
        }
        if !texts.is_empty() {
            return Some(texts.join("\n"));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sse_event_json() {
        let event = "event: chat.delta\ndata: {\"text\":\"Hello\",\"event_id\":\"evt-123\"}";
        let result = parse_sse_event(event).unwrap();
        assert_eq!(result["type"], "chat.delta");
        assert_eq!(result["text"], "Hello");
    }

    #[test]
    fn test_parse_sse_event_text() {
        let event = "data: Plain text message";
        let result = parse_sse_event(event).unwrap();
        assert_eq!(result["type"], "message");
        assert_eq!(result["text"], "Plain text message");
    }

    #[test]
    fn test_parse_sse_event_empty() {
        let event = ": comment only\n\n";
        assert!(parse_sse_event(event).is_none());
    }

    #[test]
    fn test_extract_assistant_text() {
        // Test direct text field
        let payload = serde_json::json!({"text": "Hello"});
        assert_eq!(extract_assistant_text(&payload), Some("Hello".to_string()));

        // Test capsule.outputs format
        let payload = serde_json::json!({
            "capsule": {
                "outputs": [{
                    "content": "From capsule"
                }]
            }
        });
        assert_eq!(
            extract_assistant_text(&payload),
            Some("From capsule".to_string())
        );

        // Test no text
        let payload = serde_json::json!({"other": "field"});
        assert_eq!(extract_assistant_text(&payload), None);
    }
}
