use crate::brain::{BrainEvent, BrainManager};
use crate::tool_executor::ToolCall;
use crate::types::ToolDefinition;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .expect("failed to build reqwest client for LLM gateway")
}

#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync + std::fmt::Debug {
    async fn complete(
        &self,
        prompt: &str,
        system: Option<&str>,
        tools: Vec<ToolDefinition>,
    ) -> Result<String, anyhow::Error>;
    fn name(&self) -> &str;
}

// --- Brain Runtime Adapter (Bridges Brain Runtimes to LLM Providers) ---

#[derive(Debug)]
pub struct BrainLLMAdapter {
    brain_manager: Arc<BrainManager>,
}

impl BrainLLMAdapter {
    pub fn new(brain_manager: Arc<BrainManager>) -> Self {
        Self { brain_manager }
    }
}

#[async_trait::async_trait]
impl LLMProvider for BrainLLMAdapter {
    async fn complete(
        &self,
        prompt: &str,
        _system: Option<&str>,
        _tools: Vec<ToolDefinition>,
    ) -> Result<String, anyhow::Error> {
        // 1. Find an active session
        let sessions = self.brain_manager.list_sessions().await;
        let active_session = sessions
            .iter()
            .find(|s| matches!(s.status, crate::brain::types::SessionStatus::Running))
            .ok_or_else(|| {
                anyhow::anyhow!("No active brain session found for intelligent execution")
            })?;

        let runtime_lock = self
            .brain_manager
            .get_runtime(&active_session.id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Active session runtime not found"))?;

        let mut rx = {
            let runtime = runtime_lock.read().await;
            runtime.subscribe()
        };

        // 2. Send input
        {
            let mut runtime = runtime_lock.write().await;
            runtime.send_input(prompt).await?;
        }

        // 3. Wait for ChatMessageCompleted or timeout
        let mut full_text = String::new();
        let timeout = tokio::time::sleep(std::time::Duration::from_secs(30));
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                msg = rx.recv() => {
                    match msg {
                        Ok(BrainEvent::ChatDelta { text, event_id: _ }) => {
                            full_text.push_str(&text);
                        }
                        Ok(BrainEvent::ChatMessageCompleted { text, event_id: _ }) => {
                            if !text.is_empty() { return Ok(text); }
                            return Ok(full_text);
                        }
                        Ok(BrainEvent::Error { message, .. }) => {
                            return Err(anyhow::anyhow!("Brain error: {}", message));
                        }
                        Err(_) => break, // Channel closed or lagged
                        _ => {} // Ignore other events
                    }
                }
                _ = &mut timeout => {
                    return Err(anyhow::anyhow!("Brain completion timed out"));
                }
            }
        }

        if !full_text.is_empty() {
            Ok(full_text)
        } else {
            Err(anyhow::anyhow!("Brain failed to provide a response"))
        }
    }

    fn name(&self) -> &str {
        "brain"
    }
}

#[derive(Debug)]
pub struct ProviderManager {
    providers: HashMap<String, Box<dyn LLMProvider>>,
    active_provider: String,
}

impl ProviderManager {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            active_provider: "local".to_string(),
        }
    }

    pub fn register_provider(&mut self, provider: Box<dyn LLMProvider>) {
        self.providers.insert(provider.name().to_string(), provider);
    }

    pub fn set_active(&mut self, name: &str) -> anyhow::Result<()> {
        if self.providers.contains_key(name) {
            self.active_provider = name.to_string();
            Ok(())
        } else {
            Err(anyhow::anyhow!("Provider '{}' not found", name))
        }
    }

    pub fn get_active(&self) -> Option<&Box<dyn LLMProvider>> {
        self.providers.get(&self.active_provider)
    }
}

// --- OpenAI / Generic Adapter (Works for OpenRouter, Local, etc.) ---

#[derive(Debug)]
pub struct OpenAIAdapter {
    client: reqwest::Client,
    endpoint: String,
    model: String,
    api_key: String,
    name: String,
}

impl OpenAIAdapter {
    pub fn new(name: &str, endpoint: String, model: String, api_key: String) -> Self {
        Self {
            client: build_http_client(),
            endpoint,
            model,
            api_key,
            name: name.to_string(),
        }
    }
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<serde_json::Value>>,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[async_trait::async_trait]
impl LLMProvider for OpenAIAdapter {
    async fn complete(
        &self,
        prompt: &str,
        system: Option<&str>,
        tools: Vec<ToolDefinition>,
    ) -> Result<String, anyhow::Error> {
        let mut messages = Vec::new();
        if let Some(sys) = system {
            messages.push(ChatMessage {
                role: "system".to_string(),
                content: sys.to_string(),
            });
        }
        messages.push(ChatMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        });

        let tool_schemas = if tools.is_empty() {
            None
        } else {
            Some(
                tools
                    .iter()
                    .map(|t| {
                        serde_json::json!({
                            "type": "function",
                            "function": {
                                "name": t.name,
                                "description": t.description,
                                "parameters": t.parameters
                            }
                        })
                    })
                    .collect(),
            )
        };

        let req = ChatRequest {
            model: self.model.clone(),
            messages,
            tools: tool_schemas,
        };

        let response = self
            .client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&req)
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;
        let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_else(|_| {
            serde_json::json!({
                "raw": body
            })
        });

        if !status.is_success() {
            let provider_error = parsed
                .get("error")
                .and_then(|err| {
                    err.get("message")
                        .and_then(|msg| msg.as_str())
                        .or_else(|| err.as_str())
                })
                .or_else(|| parsed.get("message").and_then(|msg| msg.as_str()))
                .or_else(|| parsed.get("raw").and_then(|raw| raw.as_str()))
                .unwrap_or("provider request failed");
            return Err(anyhow::anyhow!(
                "provider request failed ({}): {}",
                status,
                provider_error
            ));
        }

        if let Some(text) = parsed
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
        {
            return Ok(text.to_string());
        }

        if let Some(text) = parsed
            .get("message")
            .and_then(|message| message.as_str())
            .or_else(|| parsed.get("response").and_then(|response| response.as_str()))
        {
            return Ok(text.to_string());
        }

        Err(anyhow::anyhow!(
            "provider response missing expected text fields"
        ))
    }

    fn name(&self) -> &str {
        &self.name
    }
}

// --- MLX Adapter ---

#[derive(Debug)]
pub struct MLXAdapter {
    client: reqwest::Client,
    endpoint: String,
    model: String,
    max_tokens: u32,
    temperature: f32,
}

impl MLXAdapter {
    pub fn new(endpoint: String, model: String, max_tokens: u32, temperature: f32) -> Self {
        Self {
            client: build_http_client(),
            endpoint,
            model,
            max_tokens,
            temperature,
        }
    }
}

#[derive(Serialize)]
struct MlxRequest {
    prompt: String,
    model: String,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Deserialize)]
struct MlxResponse {
    status: Option<String>,
    text: Option<String>,
    error: Option<String>,
    model: Option<String>,
}

#[async_trait::async_trait]
impl LLMProvider for MLXAdapter {
    async fn complete(
        &self,
        prompt: &str,
        system: Option<&str>,
        _tools: Vec<ToolDefinition>,
    ) -> Result<String, anyhow::Error> {
        let combined_prompt = if let Some(sys) = system {
            format!("{}\n\n{}", sys, prompt)
        } else {
            prompt.to_string()
        };

        let req = MlxRequest {
            prompt: combined_prompt,
            model: self.model.clone(),
            max_tokens: self.max_tokens,
            temperature: self.temperature,
        };

        let res = self.client.post(&self.endpoint).json(&req).send().await?;

        if !res.status().is_success() {
            return Err(anyhow::anyhow!(
                "MLX request failed with status {}",
                res.status()
            ));
        }

        let body: MlxResponse = res.json().await?;
        let status = body.status.unwrap_or_else(|| "unknown".to_string());
        if status != "success" {
            let err = body
                .error
                .unwrap_or_else(|| "MLX inference failed".to_string());
            return Err(anyhow::anyhow!(err));
        }

        Ok(body.text.unwrap_or_else(|| "".to_string()))
    }

    fn name(&self) -> &str {
        "mlx"
    }
}

// --- Anthropic Adapter ---

#[derive(Debug)]
pub struct AnthropicAdapter {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl AnthropicAdapter {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            client: build_http_client(),
            api_key,
            model,
        }
    }
}

#[async_trait::async_trait]
impl LLMProvider for AnthropicAdapter {
    async fn complete(
        &self,
        prompt: &str,
        system: Option<&str>,
        _tools: Vec<ToolDefinition>,
    ) -> Result<String, anyhow::Error> {
        // Basic Anthropic implementation (Tools not yet mapped)
        let req = serde_json::json!({
            "model": self.model,
            "system": system.unwrap_or(""),
            "messages": [{ "role": "user", "content": prompt }],
            "max_tokens": 1024
        });

        let res: serde_json::Value = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&req)
            .send()
            .await?
            .json()
            .await?;

        Ok(res["content"][0]["text"].as_str().unwrap_or("").to_string())
    }

    fn name(&self) -> &str {
        "anthropic"
    }
}

// --- Google Gemini Adapter ---

#[derive(Debug)]
pub struct GeminiAdapter {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl GeminiAdapter {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            client: build_http_client(),
            api_key,
            model,
        }
    }
}

#[async_trait::async_trait]
impl LLMProvider for GeminiAdapter {
    async fn complete(
        &self,
        prompt: &str,
        _system: Option<&str>,
        _tools: Vec<ToolDefinition>,
    ) -> Result<String, anyhow::Error> {
        // Basic Gemini implementation
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let req = serde_json::json!({
            "contents": [{
                "parts": [{ "text": prompt }]
            }]
        });

        let res: serde_json::Value = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await?
            .json()
            .await?;

        Ok(res["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string())
    }

    fn name(&self) -> &str {
        "gemini"
    }
}
