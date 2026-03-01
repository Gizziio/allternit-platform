//! Provider Runtime Interface
//!
//! Abstraction over LLM providers.

use async_trait::async_trait;
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

use crate::events::{FinishReason, ProviderError, ProviderStreamItem, ToolResult};

/// Configuration for a provider session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderSessionConfig {
    pub provider_id: String,
    pub model_id: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

/// Opaque handle to a provider session
#[derive(Debug, Clone)]
pub struct ProviderSessionHandle {
    pub session_id: String,
    pub config: ProviderSessionConfig,
}

/// Trait for provider runtime implementations
#[async_trait]
pub trait ProviderRuntime: Send + Sync {
    /// Start a new session with the provider
    async fn start_session(
        &self,
        cfg: ProviderSessionConfig,
    ) -> Result<ProviderSessionHandle, ProviderError>;

    /// Stream a prompt through the provider
    /// Returns a stream of provider items (deltas, tool calls, done)
    async fn stream_prompt(
        &self,
        handle: &mut ProviderSessionHandle,
        prompt: String,
    ) -> Result<Pin<Box<dyn Stream<Item = ProviderStreamItem> + Send>>, ProviderError>;

    /// Send a tool result back to the provider
    async fn send_tool_result(
        &self,
        handle: &mut ProviderSessionHandle,
        tool_result: &ToolResult,
    ) -> Result<(), ProviderError>;
}

/// Fake provider runtime for testing and demos
///
/// Can be scripted with a sequence of stream items to return.
#[derive(Clone)]
pub struct FakeProviderRuntime {
    scripted_streams: std::collections::HashMap<String, Vec<ProviderStreamItem>>,
}

impl FakeProviderRuntime {
    pub fn new() -> Self {
        Self {
            scripted_streams: std::collections::HashMap::new(),
        }
    }

    /// Script a stream for a specific prompt
    pub fn script_stream(&mut self, prompt_substring: &str, items: Vec<ProviderStreamItem>) {
        self.scripted_streams
            .insert(prompt_substring.to_string(), items);
    }
}

impl Default for FakeProviderRuntime {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ProviderRuntime for FakeProviderRuntime {
    async fn start_session(
        &self,
        cfg: ProviderSessionConfig,
    ) -> Result<ProviderSessionHandle, ProviderError> {
        Ok(ProviderSessionHandle {
            session_id: format!("fake_session_{}", uuid::Uuid::new_v4()),
            config: cfg,
        })
    }

    async fn stream_prompt(
        &self,
        _handle: &mut ProviderSessionHandle,
        prompt: String,
    ) -> Result<Pin<Box<dyn Stream<Item = ProviderStreamItem> + Send>>, ProviderError> {
        // Find a matching scripted stream
        let items = self
            .scripted_streams
            .iter()
            .find(|(key, _)| prompt.contains(key.as_str()))
            .map(|(_, items)| items.clone())
            .unwrap_or_else(|| {
                // Default: simple echo response
                vec![
                    ProviderStreamItem::Delta(format!("Echo: {}", prompt)),
                    ProviderStreamItem::Done(FinishReason::Stop),
                ]
            });

        let stream = futures::stream::iter(items);
        Ok(Box::pin(stream))
    }

    async fn send_tool_result(
        &self,
        _handle: &mut ProviderSessionHandle,
        _tool_result: &ToolResult,
    ) -> Result<(), ProviderError> {
        // Fake provider accepts tool results without error
        Ok(())
    }
}

// Use uuid for fake session IDs
use uuid;

#[cfg(test)]
mod provider_tests {
    use super::*;
    use futures::StreamExt;

    #[tokio::test]
    async fn test_fake_provider_start_session() {
        let provider = FakeProviderRuntime::new();
        let cfg = ProviderSessionConfig {
            provider_id: "fake".to_string(),
            model_id: "fake-model".to_string(),
            api_key: None,
            base_url: None,
        };

        let handle = provider.start_session(cfg.clone()).await.unwrap();

        assert!(handle.session_id.starts_with("fake_session_"));
        assert_eq!(handle.config.provider_id, "fake");
    }

    #[tokio::test]
    async fn test_fake_provider_stream_prompt() {
        let mut provider = FakeProviderRuntime::new();
        provider.script_stream(
            "hello",
            vec![
                ProviderStreamItem::Delta("Hello".to_string()),
                ProviderStreamItem::Delta(" World".to_string()),
                ProviderStreamItem::Done(FinishReason::Stop),
            ],
        );

        let cfg = ProviderSessionConfig {
            provider_id: "fake".to_string(),
            model_id: "fake-model".to_string(),
            api_key: None,
            base_url: None,
        };

        let mut handle = provider.start_session(cfg).await.unwrap();
        let stream = provider
            .stream_prompt(&mut handle, "hello there".to_string())
            .await
            .unwrap();

        let items: Vec<_> = stream.collect().await;

        assert_eq!(items.len(), 3);
        assert_eq!(items[0], ProviderStreamItem::Delta("Hello".to_string()));
        assert_eq!(items[1], ProviderStreamItem::Delta(" World".to_string()));
        assert_eq!(items[2], ProviderStreamItem::Done(FinishReason::Stop));
    }
}
