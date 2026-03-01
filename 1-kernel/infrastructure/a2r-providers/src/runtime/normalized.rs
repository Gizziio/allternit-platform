//! Provider Normalization Layer
//!
//! Canonical types for model info, streaming deltas, tool calls, and responses.
//! No provider-specific wire format may cross the adapter boundary.

use serde::{Deserialize, Serialize};

use super::errors::ProviderError;
use super::usage::NormalizedUsage;

/// Normalized model information
///
/// Opaque model ID with display metadata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NormalizedModelInfo {
    /// Opaque model ID (e.g., "claude-3-7-sonnet-20250219")
    pub id: String,
    /// Human-readable display label
    pub label: String,
    /// Optional metadata (capabilities, context window, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<ModelMeta>,
}

/// Model metadata
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ModelMeta {
    /// Context window size
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<usize>,
    /// Maximum output tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<usize>,
    /// Model capabilities
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub capabilities: Vec<String>,
    /// Provider name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    /// Raw metadata from provider
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<serde_json::Value>,
}

impl NormalizedModelInfo {
    /// Create a new normalized model info
    pub fn new(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            meta: None,
        }
    }

    /// Add metadata
    pub fn with_meta(mut self, meta: ModelMeta) -> Self {
        self.meta = Some(meta);
        self
    }
}

/// Normalized streaming delta types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NormalizedDelta {
    /// Text content delta
    Content {
        /// Text content (may be partial)
        text: String,
        /// Whether this is the final delta
        #[serde(skip_serializing_if = "Option::is_none")]
        finish_reason: Option<FinishReason>,
    },
    /// Tool call delta
    ToolCall {
        /// Tool call ID
        id: String,
        /// Function name
        name: String,
        /// Arguments (may be partial for streaming)
        arguments: String,
        /// Whether arguments are complete
        #[serde(skip_serializing_if = "Option::is_none")]
        is_complete: Option<bool>,
    },
    /// Finish delta (stream complete)
    Finish {
        /// Reason for finishing
        reason: FinishReason,
        /// Final usage metrics
        #[serde(skip_serializing_if = "Option::is_none")]
        usage: Option<NormalizedUsage>,
    },
    /// Error during streaming
    Error {
        /// Normalized error
        error: ProviderError,
    },
}

/// Reasons for finishing a response
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    /// Completed naturally
    Stop,
    /// Hit length limit
    Length,
    /// Tool call initiated
    ToolCalls,
    /// Content filtered
    ContentFilter,
    /// Provider-specific reason
    Other,
}

/// Normalized tool call
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NormalizedToolCall {
    /// Unique call ID
    pub id: String,
    /// Tool/function name
    pub name: String,
    /// Arguments as JSON string
    pub arguments: String,
}

impl NormalizedToolCall {
    /// Parse arguments as JSON
    pub fn parse_arguments<T: for<'de> Deserialize<'de>>(&self) -> Result<T, serde_json::Error> {
        serde_json::from_str(&self.arguments)
    }
}

/// Normalized tool result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NormalizedToolResult {
    /// Call ID this result is for
    pub call_id: String,
    /// Result content
    pub content: String,
    /// Whether this is an error result
    #[serde(default)]
    pub is_error: bool,
}

/// Normalized models response
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NormalizedModelsResponse {
    /// Whether discovery is supported
    pub supported: bool,
    /// List of models (None if not supported)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Vec<NormalizedModelInfo>>,
    /// Whether freeform entry is allowed
    pub allow_freeform: bool,
    /// Hint for freeform entry
    #[serde(skip_serializing_if = "Option::is_none")]
    pub freeform_hint: Option<String>,
    /// Default model ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model_id: Option<String>,
    /// Error if discovery failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl NormalizedModelsResponse {
    /// Create a supported response with models
    pub fn supported(models: Vec<NormalizedModelInfo>) -> Self {
        Self {
            supported: true,
            models: Some(models),
            allow_freeform: false,
            freeform_hint: None,
            default_model_id: None,
            error: None,
        }
    }

    /// Create a freeform-only response
    pub fn freeform(hint: impl Into<String>) -> Self {
        Self {
            supported: false,
            models: None,
            allow_freeform: true,
            freeform_hint: Some(hint.into()),
            default_model_id: None,
            error: None,
        }
    }

    /// Create an error response
    pub fn error(message: impl Into<String>) -> Self {
        Self {
            supported: false,
            models: None,
            allow_freeform: false,
            freeform_hint: None,
            default_model_id: None,
            error: Some(message.into()),
        }
    }
}

/// Normalized validation response
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NormalizedValidateResponse {
    /// Whether the model is valid
    pub valid: bool,
    /// Model info if valid
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<NormalizedModelInfo>,
    /// Error message if invalid
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl NormalizedValidateResponse {
    /// Create a valid response
    pub fn valid(model: NormalizedModelInfo) -> Self {
        Self {
            valid: true,
            model: Some(model),
            error: None,
        }
    }

    /// Create an invalid response
    pub fn invalid(error: impl Into<String>) -> Self {
        Self {
            valid: false,
            model: None,
            error: Some(error.into()),
        }
    }
}

/// Normalized prompt/completion response (non-streaming)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedResponse {
    /// Response ID
    pub id: String,
    /// Text content
    pub content: String,
    /// Tool calls if any
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tool_calls: Vec<NormalizedToolCall>,
    /// Finish reason
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<FinishReason>,
    /// Usage metrics
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<NormalizedUsage>,
    /// Model used
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

/// Trait for mapping provider-specific formats to normalized types
#[async_trait::async_trait]
pub trait Normalizer: Send + Sync {
    /// Map raw model discovery to normalized response
    fn normalize_models(&self, raw: &str) -> Result<NormalizedModelsResponse, ProviderError>;

    /// Map raw validation to normalized response
    fn normalize_validation(&self, raw: &str) -> Result<NormalizedValidateResponse, ProviderError>;

    /// Map raw stream chunk to normalized delta
    fn normalize_stream_chunk(&self, chunk: &str) -> Result<NormalizedDelta, ProviderError>;

    /// Map raw response to normalized response
    fn normalize_response(&self, raw: &str) -> Result<NormalizedResponse, ProviderError>;

    /// Map error to normalized error
    fn normalize_error(&self, status: u16, body: &str) -> ProviderError;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_info_creation() {
        let model = NormalizedModelInfo::new("gpt-4", "GPT-4").with_meta(ModelMeta {
            context_window: Some(8192),
            max_tokens: Some(4096),
            capabilities: vec!["vision".to_string()],
            provider: Some("openai".to_string()),
            raw: None,
        });
        assert_eq!(model.id, "gpt-4");
        assert_eq!(model.meta.as_ref().unwrap().context_window, Some(8192));
    }

    #[test]
    fn test_delta_serialization() {
        let delta = NormalizedDelta::Content {
            text: "Hello".to_string(),
            finish_reason: None,
        };
        let json = serde_json::to_string(&delta).unwrap();
        assert!(json.contains("\"type\":\"content\""));
    }

    #[test]
    fn test_tool_call_parsing() {
        let call = NormalizedToolCall {
            id: "call_123".to_string(),
            name: "get_weather".to_string(),
            arguments: r#"{"location": "NYC"}"#.to_string(),
        };
        let parsed: serde_json::Value = call.parse_arguments().unwrap();
        assert_eq!(parsed["location"], "NYC");
    }

    #[test]
    fn test_models_response_variants() {
        let supported = NormalizedModelsResponse::supported(vec![NormalizedModelInfo::new(
            "model1", "Model 1",
        )]);
        assert!(supported.supported);

        let freeform = NormalizedModelsResponse::freeform("Enter any model ID");
        assert!(freeform.allow_freeform);

        let error = NormalizedModelsResponse::error("Discovery failed");
        assert!(error.error.is_some());
    }
}
