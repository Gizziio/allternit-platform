use crate::brain::traits::{BrainDriver, BrainRuntime};
use crate::brain::types::{BrainConfig, BrainEvent, BrainType, SessionStatus};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use futures::StreamExt;
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info};

pub struct LocalBrainDriver {
    client: Client,
}

impl LocalBrainDriver {
    pub fn new() -> Self {
        let client = Client::builder()
            .no_proxy()
            .build()
            .expect("failed to build reqwest client for LocalBrainDriver");
        Self {
            client,
        }
    }
}

#[async_trait]
impl BrainDriver for LocalBrainDriver {
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Local)
    }

    async fn create_runtime(
        &self,
        config: &BrainConfig,
        _session_id: &str,
    ) -> Result<Box<dyn BrainRuntime>> {
        let (tx, _) = broadcast::channel(100);

        Ok(Box::new(LocalBrainRuntime {
            config: config.clone(),
            event_tx: tx,
            state: Arc::new(RwLock::new(LocalSessionState {
                messages: Vec::new(),
            })),
            client: self.client.clone(),
        }))
    }
}

struct LocalSessionState {
    messages: Vec<serde_json::Value>,
}

pub struct LocalBrainRuntime {
    config: BrainConfig,
    event_tx: broadcast::Sender<BrainEvent>,
    state: Arc<RwLock<LocalSessionState>>,
    client: Client,
}

#[async_trait]
impl BrainRuntime for LocalBrainRuntime {
    async fn start(&mut self) -> Result<()> {
        info!("Starting Local brain session: {}", self.config.name);
        let _ = self.event_tx.send(BrainEvent::SessionStatus {
            status: SessionStatus::Running,
            event_id: None,
        });
        Ok(())
    }

    async fn send_input(&mut self, input: &str) -> Result<()> {
        // Clone everything before spawn
        let event_tx = self.event_tx.clone();
        let client = self.client.clone();
        let config = self.config.clone();

        // Get messages with read lock
        let messages = {
            let state = self.state.read().await;
            state.messages.clone()
        };

        // Add user message with write lock
        {
            let mut state = self.state.write().await;
            state.messages.push(json!({
                "role": "user",
                "content": input
            }));
        }

        tokio::spawn(async move {
            let tx = event_tx;
            let endpoint = config
                .endpoint
                .unwrap_or_else(|| format!("{}://ollama-service", "http"));
            let model = config.model.unwrap_or_else(|| "llama3".to_string());

            info!("Local Request to {} with model {}", endpoint, model);

            let res = client
                .post(format!("{}/api/chat", endpoint))
                .json(&json!({
                    "model": model,
                    "messages": messages,
                    "stream": true
                }))
                .send()
                .await;

            match res {
                Ok(response) => {
                    let mut stream = response.bytes_stream();
                    let mut full_response = String::new();

                    while let Some(item) = stream.next().await {
                        match item {
                            Ok(chunk) => {
                                if let Ok(json) =
                                    serde_json::from_slice::<serde_json::Value>(&chunk)
                                {
                                    if let Some(content) = json
                                        .get("message")
                                        .and_then(|m| m.get("content"))
                                        .and_then(|c| c.as_str())
                                    {
                                        full_response.push_str(content);
                                        let _ = tx.send(BrainEvent::ChatDelta {
                                            text: content.to_string(),
                                            event_id: None,
                                        });
                                    }
                                    if let Some(done) = json.get("done").and_then(|d| d.as_bool()) {
                                        if done {
                                            break;
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                let _ = tx.send(BrainEvent::Error {
                                    message: format!("Local stream error: {}", e),
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
                        message: format!("Local model request failed: {}", e),
                        code: Some("LOCAL_ERROR".to_string()),
                        event_id: None,
                    });
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
