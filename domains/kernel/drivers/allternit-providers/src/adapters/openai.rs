use anyhow::{Context, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[async_trait]
pub trait LLMProvider: Send + Sync {
    async fn complete(&self, system: &str, user: &str) -> Result<String>;
}

pub struct OpenAIProvider {
    api_key: String,
    model: String,
    client: Client,
}

impl OpenAIProvider {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            client: Client::new(),
        }
    }
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct CompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Deserialize)]
struct CompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: MessageContent,
}

#[derive(Deserialize)]
struct MessageContent {
    content: String,
}

#[async_trait]
impl LLMProvider for OpenAIProvider {
    async fn complete(&self, system: &str, user: &str) -> Result<String> {
        let request = CompletionRequest {
            model: self.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user.to_string(),
                },
            ],
            temperature: 0.0, // Deterministic-ish
        };

        let res = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await
            .context("Failed to send request to OpenAI")?;

        if !res.status().is_success() {
            let error_text = res.text().await?;
            anyhow::bail!("OpenAI API error: {}", error_text);
        }

        let body: CompletionResponse = res
            .json()
            .await
            .context("Failed to parse OpenAI response")?;

        body.choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| anyhow::anyhow!("No choices in response"))
    }
}

// Mock Provider for testing without API Key
pub struct MockProvider;

#[async_trait]
impl LLMProvider for MockProvider {
    async fn complete(&self, _system: &str, user: &str) -> Result<String> {
        // Simple heuristic mock
        if user.contains("search") {
            Ok("Thought: User wants to search.\nAction: web.search(\"rust lang\")".to_string())
        } else if user.contains("note") {
            Ok("Thought: User wants to create a note.\nAction: note.create(\"test.md\", \"content\")".to_string())
        } else {
            Ok("Final Answer: I am a mock agent.".to_string())
        }
    }
}
