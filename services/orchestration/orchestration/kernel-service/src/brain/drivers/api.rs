use crate::brain::traits::{BrainDriver, BrainRuntime};
use crate::brain::types::{BrainConfig, BrainEvent, BrainType, SessionStatus};
use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info};

pub struct ApiBrainDriver {
    client: Client,
}

impl ApiBrainDriver {
    pub fn new() -> Self {
        let client = Client::builder()
            .no_proxy()
            .build()
            .expect("failed to build reqwest client for ApiBrainDriver");
        Self {
            client,
        }
    }
}

#[async_trait]
impl BrainDriver for ApiBrainDriver {
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Api)
    }

    async fn create_runtime(
        &self,
        config: &BrainConfig,
        _session_id: &str,
    ) -> Result<Box<dyn BrainRuntime>> {
        let (tx, _) = broadcast::channel(100);

        Ok(Box::new(ApiBrainRuntime {
            config: config.clone(),
            event_tx: tx,
            state: Arc::new(RwLock::new(ApiSessionState {
                messages: Vec::new(),
            })),
            client: self.client.clone(),
        }))
    }
}

struct ApiSessionState {
    messages: Vec<serde_json::Value>,
}

pub struct ApiBrainRuntime {
    config: BrainConfig,
    event_tx: broadcast::Sender<BrainEvent>,
    state: Arc<RwLock<ApiSessionState>>,
    client: Client,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ApiProviderKind {
    Gemini,
    Anthropic,
    OpenAICompatible,
}

fn detect_provider_kind(config: &BrainConfig) -> ApiProviderKind {
    let id = config.id.to_lowercase();
    if id.contains("gemini") {
        ApiProviderKind::Gemini
    } else if id.contains("anthropic") || id.contains("claude") {
        ApiProviderKind::Anthropic
    } else {
        ApiProviderKind::OpenAICompatible
    }
}

fn normalize_openai_endpoint(endpoint: &str) -> String {
    let trimmed = endpoint.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{}/chat/completions", trimmed)
    } else {
        format!("{}/v1/chat/completions", trimmed)
    }
}

#[async_trait]
impl BrainRuntime for ApiBrainRuntime {
    async fn start(&mut self) -> Result<()> {
        info!("Starting API brain session: {}", self.config.name);
        let _ = self.event_tx.send(BrainEvent::SessionStatus {
            status: SessionStatus::Running,
            event_id: None,
        });
        Ok(())
    }

    async fn send_input(&mut self, input: &str) -> Result<()> {
        // Clone everything we need before the spawn block
        let event_tx = self.event_tx.clone();
        let client = self.client.clone();
        let config = self.config.clone();

        // Get messages from state before the spawn
        let messages = {
            let state = self.state.read().await;
            state.messages.clone()
        };

        // Add user message to state
        {
            let mut state = self.state.write().await;
            state.messages.push(json!({
                "role": "user",
                "content": input
            }));
        }

        tokio::spawn(async move {
            use futures::StreamExt;

            let tx = event_tx;
            let provider_kind = detect_provider_kind(&config);

            let api_key_env = config.api_key_env.clone().unwrap_or_else(|| match provider_kind {
                ApiProviderKind::Gemini => "GEMINI_API_KEY".to_string(),
                ApiProviderKind::Anthropic => "ANTHROPIC_API_KEY".to_string(),
                ApiProviderKind::OpenAICompatible => {
                    let id = config.id.to_lowercase();
                    if id.contains("deepseek") {
                        "DEEPSEEK_API_KEY".to_string()
                    } else if id.contains("moonshot") || id.contains("kimi") {
                        "MOONSHOT_API_KEY".to_string()
                    } else {
                        "OPENAI_API_KEY".to_string()
                    }
                }
            });
            let api_key = std::env::var(&api_key_env).unwrap_or_default();

            if api_key.is_empty() {
                let _ = tx.send(BrainEvent::Error {
                    message: format!("API key not found in {}", api_key_env),
                    code: Some("AUTH_ERROR".to_string()),
                    event_id: None,
                });
                return;
            }

            match provider_kind {
                ApiProviderKind::Gemini => {
                    let model = config
                        .model
                        .clone()
                        .unwrap_or_else(|| "gemini-1.5-pro".to_string());
                    let url = format!(
                        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
                        model, api_key
                    );

                    let res = client
                        .post(&url)
                        .json(&json!({
                            "contents": messages.iter().map(|m| {
                                json!({
                                    "role": if m["role"] == "assistant" { "model" } else { "user" },
                                    "parts": [{"text": m["content"]}]
                                })
                            }).collect::<Vec<_>>()
                        }))
                        .send()
                        .await;

                    match res {
                        Ok(response) => {
                            if !response.status().is_success() {
                                let status = response.status();
                                let body = response.text().await.unwrap_or_default();
                                let _ = tx.send(BrainEvent::Error {
                                    message: format!("Gemini request failed ({}): {}", status, body),
                                    code: Some("HTTP_ERROR".to_string()),
                                    event_id: None,
                                });
                                return;
                            }

                            let mut stream = response.bytes_stream();
                            let mut full_response = String::new();
                            while let Some(item) = stream.next().await {
                                match item {
                                    Ok(chunk) => {
                                        let text = String::from_utf8_lossy(&chunk);
                                        for line in text.lines() {
                                            if let Some(data) = line.strip_prefix("data: ") {
                                                if let Ok(json) =
                                                    serde_json::from_str::<serde_json::Value>(data)
                                                {
                                                    if let Some(text) = json["candidates"][0]
                                                        ["content"][0]["parts"][0]["text"]
                                                        .as_str()
                                                        .or_else(|| {
                                                            json["candidates"][0]["content"]["parts"][0]["text"]
                                                                .as_str()
                                                        })
                                                    {
                                                        full_response.push_str(text);
                                                        let _ = tx.send(BrainEvent::ChatDelta {
                                                            text: text.to_string(),
                                                            event_id: None,
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        let _ = tx.send(BrainEvent::Error {
                                            message: format!("Gemini stream error: {}", e),
                                            code: Some("STREAM_ERROR".to_string()),
                                            event_id: None,
                                        });
                                        break;
                                    }
                                }
                            }
                            let _ = tx.send(BrainEvent::ChatMessageCompleted {
                                text: full_response,
                                event_id: None,
                            });
                        }
                        Err(e) => {
                            let _ = tx.send(BrainEvent::Error {
                                message: format!("Gemini API request failed: {}", e),
                                code: Some("NETWORK_ERROR".to_string()),
                                event_id: None,
                            });
                        }
                    }
                }
                ApiProviderKind::Anthropic => {
                    let res = client
                        .post("https://api.anthropic.com/v1/messages")
                        .header("x-api-key", api_key)
                        .header("anthropic-version", "2023-06-01")
                        .header("content-type", "application/json")
                        .json(&json!({
                            "model": config.model.unwrap_or_else(|| "claude-3-5-sonnet-20240620".to_string()),
                            "max_tokens": 1024,
                            "messages": messages,
                            "stream": true
                        }))
                        .send()
                        .await;

                    match res {
                        Ok(response) => {
                            if !response.status().is_success() {
                                let status = response.status();
                                let body = response.text().await.unwrap_or_default();
                                let _ = tx.send(BrainEvent::Error {
                                    message: format!("Anthropic request failed ({}): {}", status, body),
                                    code: Some("HTTP_ERROR".to_string()),
                                    event_id: None,
                                });
                                return;
                            }

                            let mut stream = response.bytes_stream();
                            let mut full_response = String::new();
                            while let Some(item) = stream.next().await {
                                match item {
                                    Ok(chunk) => {
                                        let text = String::from_utf8_lossy(&chunk);
                                        for line in text.lines() {
                                            if let Some(data) = line.strip_prefix("data: ") {
                                                if let Ok(json) =
                                                    serde_json::from_str::<serde_json::Value>(data)
                                                {
                                                    if let Some(delta) = json
                                                        .get("delta")
                                                        .and_then(|d| d.get("text"))
                                                        .and_then(|t| t.as_str())
                                                    {
                                                        full_response.push_str(delta);
                                                        let _ = tx.send(BrainEvent::ChatDelta {
                                                            text: delta.to_string(),
                                                            event_id: None,
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        let _ = tx.send(BrainEvent::Error {
                                            message: format!("Anthropic stream error: {}", e),
                                            code: Some("STREAM_ERROR".to_string()),
                                            event_id: None,
                                        });
                                        break;
                                    }
                                }
                            }
                            let _ = tx.send(BrainEvent::ChatMessageCompleted {
                                text: full_response,
                                event_id: None,
                            });
                        }
                        Err(e) => {
                            let _ = tx.send(BrainEvent::Error {
                                message: format!("Anthropic API request failed: {}", e),
                                code: Some("NETWORK_ERROR".to_string()),
                                event_id: None,
                            });
                        }
                    }
                }
                ApiProviderKind::OpenAICompatible => {
                    let endpoint = if let Some(endpoint) = config.endpoint.clone() {
                        normalize_openai_endpoint(&endpoint)
                    } else if let Ok(endpoint) = std::env::var("OPENAI_API_ENDPOINT") {
                        normalize_openai_endpoint(&endpoint)
                    } else if let Ok(endpoint) = std::env::var("OPENAI_API_BASE") {
                        normalize_openai_endpoint(&endpoint)
                    } else {
                        "https://api.openai.com/v1/chat/completions".to_string()
                    };

                    let model = config
                        .model
                        .clone()
                        .unwrap_or_else(|| "gpt-4o-mini".to_string());

                    let res = client
                        .post(&endpoint)
                        .header("Authorization", format!("Bearer {}", api_key))
                        .header("content-type", "application/json")
                        .json(&json!({
                            "model": model,
                            "messages": messages,
                            "stream": true
                        }))
                        .send()
                        .await;

                    match res {
                        Ok(response) => {
                            if !response.status().is_success() {
                                let status = response.status();
                                let body = response.text().await.unwrap_or_default();
                                let _ = tx.send(BrainEvent::Error {
                                    message: format!("OpenAI-compatible request failed ({}): {}", status, body),
                                    code: Some("HTTP_ERROR".to_string()),
                                    event_id: None,
                                });
                                return;
                            }

                            let mut stream = response.bytes_stream();
                            let mut full_response = String::new();
                            let mut buffer = String::new();
                            let mut done = false;

                            while let Some(item) = stream.next().await {
                                match item {
                                    Ok(chunk) => {
                                        buffer.push_str(&String::from_utf8_lossy(&chunk));
                                        let mut lines: Vec<String> =
                                            buffer.split('\n').map(|s| s.to_string()).collect();
                                        buffer = lines.pop().unwrap_or_default();

                                        for raw_line in lines {
                                            let line = raw_line.trim();
                                            if line.is_empty() {
                                                continue;
                                            }
                                            if let Some(data) = line.strip_prefix("data: ") {
                                                if data.trim() == "[DONE]" {
                                                    done = true;
                                                    break;
                                                }

                                                if let Ok(json) =
                                                    serde_json::from_str::<serde_json::Value>(data)
                                                {
                                                    if let Some(content) = json
                                                        .get("choices")
                                                        .and_then(|c| c.get(0))
                                                        .and_then(|c| c.get("delta"))
                                                        .and_then(|d| d.get("content"))
                                                        .and_then(|c| c.as_str())
                                                    {
                                                        full_response.push_str(content);
                                                        let _ = tx.send(BrainEvent::ChatDelta {
                                                            text: content.to_string(),
                                                            event_id: None,
                                                        });
                                                        continue;
                                                    }

                                                    if let Some(content) = json
                                                        .get("choices")
                                                        .and_then(|c| c.get(0))
                                                        .and_then(|c| c.get("message"))
                                                        .and_then(|m| m.get("content"))
                                                        .and_then(|c| c.as_str())
                                                    {
                                                        full_response.push_str(content);
                                                        let _ = tx.send(BrainEvent::ChatDelta {
                                                            text: content.to_string(),
                                                            event_id: None,
                                                        });
                                                        done = true;
                                                        break;
                                                    }
                                                }
                                            }
                                        }

                                        if done {
                                            break;
                                        }
                                    }
                                    Err(e) => {
                                        let _ = tx.send(BrainEvent::Error {
                                            message: format!("OpenAI-compatible stream error: {}", e),
                                            code: Some("STREAM_ERROR".to_string()),
                                            event_id: None,
                                        });
                                        break;
                                    }
                                }
                            }

                            if !buffer.trim().is_empty() {
                                let trimmed = buffer.trim();
                                if let Some(data) = trimmed.strip_prefix("data: ") {
                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                        if let Some(content) = json
                                            .get("choices")
                                            .and_then(|c| c.get(0))
                                            .and_then(|c| c.get("message"))
                                            .and_then(|m| m.get("content"))
                                            .and_then(|c| c.as_str())
                                        {
                                            full_response.push_str(content);
                                            let _ = tx.send(BrainEvent::ChatDelta {
                                                text: content.to_string(),
                                                event_id: None,
                                            });
                                        }
                                    }
                                }
                            }

                            let _ = tx.send(BrainEvent::ChatMessageCompleted {
                                text: full_response,
                                event_id: None,
                            });
                        }
                        Err(e) => {
                            error!("OpenAI-compatible request failed: {}", e);
                            let _ = tx.send(BrainEvent::Error {
                                message: format!("OpenAI-compatible request failed: {}", e),
                                code: Some("NETWORK_ERROR".to_string()),
                                event_id: None,
                            });
                        }
                    }
                }
            }
        });

        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        let _ = self.event_tx.send(BrainEvent::SessionStatus {
            status: SessionStatus::Exited,
            event_id: None,
        });
        Ok(())
    }

    fn subscribe(&self) -> broadcast::Receiver<BrainEvent> {
        self.event_tx.subscribe()
    }

    async fn health_check(&self) -> Result<bool> {
        Ok(true)
    }

    async fn get_state(&self) -> Result<Option<serde_json::Value>> {
        let state = self.state.read().await;
        Ok(Some(json!({
            "messages": state.messages
        })))
    }
}
