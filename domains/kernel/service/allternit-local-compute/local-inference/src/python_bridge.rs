use std::sync::Arc;
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{info, error};

pub struct PythonGatewayClient {
    client: Client,
    base_url: String,
}

#[derive(Serialize)]
struct GenRequest {
    prompt: String,
    model_id: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
}

#[derive(Deserialize)]
struct GenResponse {
    text: String,
    status: String,
}

impl PythonGatewayClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
        }
    }

    pub async fn generate(&self, model_id: &str, prompt: &str) -> Result<String> {
        info!("Forwarding to Python Gateway: {} ({})", model_id, prompt);

        let (endpoint, actual_model_id) = match model_id {
            "lfm-3b" => ("/lfm-2b".to_string(), "lfm-3b"),
            "qwen-image-2512" => ("/qwen-image".to_string(), "qwen-image-2512"),
            _ => (format!("/{}", model_id), model_id),
        };

        let url = format!("{}{}", self.base_url, endpoint);
        let req = GenRequest {
            prompt: prompt.to_string(),
            model_id: actual_model_id.to_string(),
            max_tokens: None,
            temperature: None,
        };

        let res = self.client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send request to Python gateway: {}", e))?;

        if !res.status().is_success() {
            let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow::anyhow!("Python gateway returned error: {}", error_text));
        }

        let body: GenResponse = res
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse response from Python gateway: {}", e))?;

        Ok(body.text)
    }
}
