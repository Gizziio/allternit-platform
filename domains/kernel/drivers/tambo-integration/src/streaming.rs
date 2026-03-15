//! Streaming Generation for Tambo UI Generation
//!
//! Provides streaming generation capabilities with:
//! - Chunked output
//! - Retry logic with exponential backoff
//! - Cancellation support
//! - Progress events

use crate::{GeneratedUI, TamboEngine, TamboError, UISpec, UIType};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

/// Stream chunk for UI generation
#[derive(Debug, Clone)]
pub enum StreamChunk {
    /// Data chunk with UI code fragment
    Data(String),
    /// Progress update
    Progress {
        current: usize,
        total: usize,
        stage: String,
    },
    /// Generation complete
    Complete(GeneratedUI),
    /// Error occurred
    Error(String),
    /// Stream cancelled
    Cancelled,
}

/// Streaming configuration
#[derive(Debug, Clone)]
pub struct StreamConfig {
    /// Maximum retries on error
    pub max_retries: u32,
    /// Delay between retries in milliseconds
    pub retry_delay_ms: u64,
    /// Chunk size for streaming
    pub chunk_size: usize,
    /// Enable progress events
    pub emit_progress: bool,
    /// Cancellation token
    pub cancellation_token: CancellationToken,
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            retry_delay_ms: 1000,
            chunk_size: 100,
            emit_progress: true,
            cancellation_token: CancellationToken::new(),
        }
    }
}

impl StreamConfig {
    /// Create a new stream config
    pub fn new() -> Self {
        Self::default()
    }

    /// Set max retries
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set retry delay
    pub fn with_retry_delay(mut self, delay_ms: u64) -> Self {
        self.retry_delay_ms = delay_ms;
        self
    }

    /// Set chunk size
    pub fn with_chunk_size(mut self, chunk_size: usize) -> Self {
        self.chunk_size = chunk_size;
        self
    }

    /// Enable/disable progress events
    pub fn with_progress(mut self, emit: bool) -> Self {
        self.emit_progress = emit;
        self
    }

    /// Set cancellation token
    pub fn with_cancellation(mut self, token: CancellationToken) -> Self {
        self.cancellation_token = token;
        self
    }
}

/// Streaming generation result
pub struct StreamResult {
    /// Receiver for stream chunks
    pub receiver: mpsc::Receiver<StreamChunk>,
    /// Generation ID (available immediately)
    pub generation_id: String,
}

impl TamboEngine {
    /// Generate UI with streaming output
    pub async fn generate_ui_streaming(
        &self,
        spec: &UISpec,
        ui_type: UIType,
        config: StreamConfig,
    ) -> Result<StreamResult, TamboError> {
        let (tx, rx) = mpsc::channel(100);
        let generation_id = format!("gen_stream_{}", uuid::Uuid::new_v4().simple());

        // Clone engine for streaming task
        let engine = self.clone_for_streaming();
        let spec = spec.clone();
        let cancellation_token = config.cancellation_token.clone();

        // Spawn streaming task
        tokio::spawn(async move {
            let mut retries = 0;

            loop {
                tokio::select! {
                    _ = cancellation_token.cancelled() => {
                        // Handle cancellation
                        let _ = tx.send(StreamChunk::Cancelled).await;
                        break;
                    }
                    result = engine.generate_ui_chunked(&spec, ui_type, &config, &tx) => {
                        match result {
                            Ok(generated_ui) => {
                                // Send complete event
                                let _ = tx.send(StreamChunk::Complete(generated_ui)).await;
                                break;
                            }
                            Err(e) if retries < config.max_retries => {
                                // Retry with exponential backoff
                                retries += 1;
                                let delay = config.retry_delay_ms * (1 << retries);
                                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;

                                // Send retry progress
                                if config.emit_progress {
                                    let _ = tx.send(StreamChunk::Progress {
                                        current: retries as usize,
                                        total: config.max_retries as usize,
                                        stage: format!("Retrying (attempt {}/{})", retries, config.max_retries),
                                    }).await;
                                }
                            }
                            Err(e) => {
                                // Max retries exceeded
                                let _ = tx.send(StreamChunk::Error(e.to_string())).await;
                                break;
                            }
                        }
                    }
                }
            }
        });

        Ok(StreamResult {
            receiver: rx,
            generation_id,
        })
    }

    /// Clone engine for streaming (creates a shallow clone)
    fn clone_for_streaming(&self) -> Self {
        Self {
            generator: self.generator.clone(),
            layout_engine: self.layout_engine.clone(),
            style_engine: self.style_engine.clone(),
            component_library: self.component_library.clone(),
            component_registry: self.component_registry.clone(),
            schema_validator: self.schema_validator.clone(),
            hash_engine: self.hash_engine.clone(),
            a11y_engine: self.a11y_engine.clone(),
            spec_diff_engine: self.spec_diff_engine.clone(),
            specs: self.specs.clone(),
            generations: self.generations.clone(),
            generation_states: self.generation_states.clone(),
        }
    }

    /// Generate UI in chunks (internal implementation)
    async fn generate_ui_chunked(
        &self,
        spec: &UISpec,
        ui_type: UIType,
        config: &StreamConfig,
        tx: &mpsc::Sender<StreamChunk>,
    ) -> Result<GeneratedUI, TamboError> {
        // Send progress: starting
        if config.emit_progress {
            let _ = tx
                .send(StreamChunk::Progress {
                    current: 0,
                    total: 4,
                    stage: "Starting generation".to_string(),
                })
                .await;
        }

        // Validate spec
        if config.emit_progress {
            let _ = tx
                .send(StreamChunk::Progress {
                    current: 1,
                    total: 4,
                    stage: "Validating specification".to_string(),
                })
                .await;
        }
        self.schema_validator
            .validate_spec(spec)
            .map_err(|e| TamboError::ValidationFailed(e.message))?;

        // Generate layout
        if config.emit_progress {
            let _ = tx
                .send(StreamChunk::Progress {
                    current: 2,
                    total: 4,
                    stage: "Generating layout".to_string(),
                })
                .await;
        }
        let layout = self.layout_engine.generate(&spec.layout)?;

        // Generate styles
        if config.emit_progress {
            let _ = tx
                .send(StreamChunk::Progress {
                    current: 3,
                    total: 4,
                    stage: "Generating styles".to_string(),
                })
                .await;
        }
        let styles = self.style_engine.generate(&spec.style)?;

        // Generate components in chunks
        if config.emit_progress {
            let _ = tx
                .send(StreamChunk::Progress {
                    current: 4,
                    total: 4,
                    stage: "Generating components".to_string(),
                })
                .await;
        }

        let mut components_code = Vec::new();
        for (i, component_spec) in spec.components.iter().enumerate() {
            // Check cancellation
            if config.cancellation_token.is_cancelled() {
                return Err(TamboError::InvalidSpec("Generation cancelled".to_string()));
            }

            let code =
                self.component_library
                    .generate_component(component_spec, &layout, &styles)?;
            components_code.push(code.clone());

            // Send component chunk
            if config.emit_progress {
                let _ = tx
                    .send(StreamChunk::Data(format!(
                        "// Component {}/{}\n",
                        i + 1,
                        spec.components.len()
                    )))
                    .await;

                // Send code in chunks
                for chunk in code.chars().collect::<Vec<_>>().chunks(config.chunk_size) {
                    let chunk_str: String = chunk.iter().collect();
                    let _ = tx.send(StreamChunk::Data(chunk_str)).await;
                }
            }
        }

        // Assemble final UI
        let ui_code = self
            .generator
            .assemble(&components_code, &layout, &styles, ui_type)?;

        // Send final code
        if config.emit_progress {
            let _ = tx
                .send(StreamChunk::Data(format!(
                    "\n// Final assembled UI ({} chars)\n",
                    ui_code.len()
                )))
                .await;
        }

        Ok(GeneratedUI {
            generation_id: format!("gen_{}", uuid::Uuid::new_v4().simple()),
            spec_id: spec.spec_id.clone(),
            ui_code,
            ui_type,
            components_generated: spec.components.len(),
            confidence: 0.9,
            created_at: chrono::Utc::now(),
            generation_hash: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ComponentSpec, DataBinding, LayoutConstraints, LayoutSpec, SpacingSpec, StyleSpec,
        TypographySpec,
    };
    use std::collections::HashMap;
    use tokio::time::{timeout, Duration};

    fn create_test_spec() -> UISpec {
        UISpec {
            spec_id: "test-stream".to_string(),
            title: "Test Stream UI".to_string(),
            description: "A test UI for streaming".to_string(),
            components: vec![ComponentSpec {
                component_id: "comp-1".to_string(),
                component_type: "button".to_string(),
                properties: HashMap::new(),
                children: vec![],
                bindings: vec![],
            }],
            layout: LayoutSpec {
                layout_type: "flex".to_string(),
                constraints: LayoutConstraints::default(),
                regions: vec![],
            },
            style: StyleSpec {
                theme: "default".to_string(),
                colors: HashMap::new(),
                typography: TypographySpec {
                    font_family: "Arial".to_string(),
                    font_sizes: HashMap::new(),
                    line_heights: HashMap::new(),
                },
                spacing: SpacingSpec {
                    scale: vec![4, 8, 16, 32],
                    unit: "px".to_string(),
                },
            },
            interactions: vec![],
            created_at: chrono::Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_streaming_generation() {
        let engine = TamboEngine::new();
        let spec = create_test_spec();
        let config = StreamConfig::new().with_progress(true).with_chunk_size(50);

        let result = engine
            .generate_ui_streaming(&spec, UIType::React, config)
            .await;
        assert!(result.is_ok());

        let stream_result = result.unwrap();

        // Collect all chunks
        let mut chunks = Vec::new();
        let mut receiver = stream_result.receiver;

        while let Some(chunk) = receiver.recv().await {
            chunks.push(chunk);
        }

        // Verify we got some chunks
        assert!(!chunks.is_empty());

        // Verify we got a complete event
        let has_complete = chunks.iter().any(|c| matches!(c, StreamChunk::Complete(_)));
        assert!(has_complete);
    }

    #[tokio::test]
    async fn test_streaming_cancellation() {
        let engine = TamboEngine::new();
        let spec = create_test_spec();

        let cancellation_token = CancellationToken::new();
        let config = StreamConfig::new().with_cancellation(cancellation_token.clone());

        let result = engine
            .generate_ui_streaming(&spec, UIType::React, config)
            .await;
        assert!(result.is_ok());

        // Cancel immediately
        cancellation_token.cancel();

        let stream_result = result.unwrap();
        let mut receiver = stream_result.receiver;

        // Should receive cancelled chunk
        let mut found_cancelled = false;
        while let Some(chunk) = timeout(Duration::from_secs(5), receiver.recv())
            .await
            .unwrap()
        {
            if matches!(chunk, StreamChunk::Cancelled) {
                found_cancelled = true;
                break;
            }
        }

        assert!(found_cancelled);
    }

    #[tokio::test]
    async fn test_streaming_progress() {
        let engine = TamboEngine::new();
        let spec = create_test_spec();
        let config = StreamConfig::new().with_progress(true).with_chunk_size(50);

        let result = engine
            .generate_ui_streaming(&spec, UIType::React, config)
            .await;
        assert!(result.is_ok());

        let stream_result = result.unwrap();
        let mut receiver = stream_result.receiver;

        // Collect progress events
        let mut progress_count = 0;
        while let Some(chunk) = receiver.recv().await {
            if matches!(chunk, StreamChunk::Progress { .. }) {
                progress_count += 1;
            }
            if matches!(chunk, StreamChunk::Complete(_)) {
                break;
            }
        }

        // Should have received progress events
        assert!(progress_count > 0);
    }

    #[tokio::test]
    async fn test_stream_config_builder() {
        let config = StreamConfig::new()
            .with_max_retries(5)
            .with_retry_delay(2000)
            .with_chunk_size(200)
            .with_progress(false);

        assert_eq!(config.max_retries, 5);
        assert_eq!(config.retry_delay_ms, 2000);
        assert_eq!(config.chunk_size, 200);
        assert!(!config.emit_progress);
    }
}
