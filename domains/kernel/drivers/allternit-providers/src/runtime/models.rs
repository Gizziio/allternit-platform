//! Provider Model Discovery Adapters
//!
//! Handles model discovery for CLI providers that support listing available models.
//! Each provider can implement a ModelAdapter to return available models.
//!
//! For providers without CLI model discovery, the system falls back to freeform entry
//! where users enter opaque model IDs directly.

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::process::Command;
use tracing::warn;

/// Model information returned by a provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderModel {
    /// Opaque model ID (e.g., "anthropic:claude-3-7-sonnet", "openai:gpt-4o")
    pub id: String,
    /// Human-readable display name
    pub name: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Model capabilities (e.g., "code", "vision", "tools")
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub capabilities: Vec<String>,
    /// Context window size if known
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<usize>,
}

/// Response from model discovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDiscoveryResponse {
    /// Whether the provider supports model discovery
    pub supported: bool,
    /// List of available models (None if not supported or auth required)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Vec<ProviderModel>>,
    /// Default model ID if known
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model_id: Option<String>,
    /// Whether to allow freeform model entry
    pub allow_freeform: bool,
    /// Hint text for freeform entry
    #[serde(skip_serializing_if = "Option::is_none")]
    pub freeform_hint: Option<String>,
    /// Error message if discovery failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Model validation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateModelRequest {
    pub model_id: String,
}

/// Model validation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateModelResponse {
    pub valid: bool,
    /// Validated model info if valid
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<ProviderModel>,
    /// Suggested alternatives if invalid
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested: Option<Vec<String>>,
    /// Error or info message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Trait for provider model adapters
///
/// Each provider that supports model discovery implements this trait.
/// Model IDs are opaque strings - the kernel never parses or validates format.
#[async_trait]
pub trait ProviderModelAdapter: Send + Sync {
    /// Provider ID this adapter handles (e.g., "opencode", "gemini", "claude")
    fn provider_id(&self) -> &str;

    /// Check if this provider supports model discovery
    /// Returns false if the CLI doesn't have a models list command
    fn supports_discovery(&self) -> bool;

    /// Discover available models
    ///
    /// Returns a list of models the provider supports.
    /// Model IDs are opaque and passed directly to the runtime.
    async fn discover_models(&self) -> Result<ModelDiscoveryResponse>;

    /// Validate a model ID
    ///
    /// Checks if the given model ID is valid for this provider.
    /// For most providers, this is a lightweight check that validates
    /// the model exists without doing a full test call.
    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse>;
}

/// Registry of model adapters
pub struct ModelAdapterRegistry {
    adapters: HashMap<String, Box<dyn ProviderModelAdapter>>,
}

impl ModelAdapterRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            adapters: HashMap::new(),
        };
        registry.register_builtin_adapters();
        registry
    }

    fn register_builtin_adapters(&mut self) {
        // Register adapters for providers that support model discovery
        // Note: Most CLI tools don't have a models list command yet,
        // so we only register adapters for those that do.

        // OpenCode - currently no models list command, uses freeform
        self.register(Box::new(OpenCodeModelAdapter::new()));

        // Gemini - no official models list command yet
        self.register(Box::new(GeminiModelAdapter::new()));

        // Claude - no models list command
        self.register(Box::new(ClaudeModelAdapter::new()));

        // Kimi - no models list command
        self.register(Box::new(KimiModelAdapter::new()));

        // Codex - no models list command
        self.register(Box::new(CodexModelAdapter::new()));

        // Ollama - supports local model discovery via `ollama list`
        self.register(Box::new(OllamaModelAdapter::new()));

        // LM Studio - supports discovery via API if running
        self.register(Box::new(LmStudioModelAdapter::new()));

        // OpenRouter - provides unified API access to many models
        self.register(Box::new(OpenRouterModelAdapter::new()));

        // Groq - fast inference for open models
        self.register(Box::new(GroqModelAdapter::new()));

        // DeepSeek - Chinese AI models with strong coding capabilities
        self.register(Box::new(DeepSeekModelAdapter::new()));

        // Mistral - European AI models
        self.register(Box::new(MistralModelAdapter::new()));

        // OpenAI - Direct API access
        self.register(Box::new(OpenAiModelAdapter::new()));

        // Cohere - Command models
        self.register(Box::new(CohereModelAdapter::new()));

        // Together AI - Open source models
        self.register(Box::new(TogetherModelAdapter::new()));

        // Fireworks AI - Fast inference
        self.register(Box::new(FireworksModelAdapter::new()));

        // Perplexity - Search-augmented models
        self.register(Box::new(PerplexityModelAdapter::new()));
    }

    pub fn register(&mut self, adapter: Box<dyn ProviderModelAdapter>) {
        let provider_id = adapter.provider_id().to_string();
        self.adapters.insert(provider_id, adapter);
    }

    pub fn get(&self, provider_id: &str) -> Option<&dyn ProviderModelAdapter> {
        self.adapters.get(provider_id).map(|a| a.as_ref())
    }

    /// Discover models for a provider
    pub async fn discover_models(&self, provider_id: &str) -> ModelDiscoveryResponse {
        match self.get(provider_id) {
            Some(adapter) => {
                if !adapter.supports_discovery() {
                    return ModelDiscoveryResponse {
                        supported: false,
                        models: None,
                        default_model_id: None,
                        allow_freeform: true,
                        freeform_hint: Some(format!(
                            "Enter {} model ID (e.g., provider:model-name)",
                            provider_id
                        )),
                        error: None,
                    };
                }

                match adapter.discover_models().await {
                    Ok(response) => response,
                    Err(e) => {
                        warn!("Model discovery failed for {}: {}", provider_id, e);
                        ModelDiscoveryResponse {
                            supported: true,
                            models: None,
                            default_model_id: None,
                            allow_freeform: true,
                            freeform_hint: Some(format!(
                                "Enter {} model ID (discovery failed, using freeform)",
                                provider_id
                            )),
                            error: Some(e.to_string()),
                        }
                    }
                }
            }
            None => {
                // Unknown provider - allow freeform
                ModelDiscoveryResponse {
                    supported: false,
                    models: None,
                    default_model_id: None,
                    allow_freeform: true,
                    freeform_hint: Some(format!(
                        "Enter {} model ID (unknown provider)",
                        provider_id
                    )),
                    error: None,
                }
            }
        }
    }

    /// Validate a model ID
    pub async fn validate_model(&self, provider_id: &str, model_id: &str) -> ValidateModelResponse {
        // Basic validation: non-empty check
        if model_id.trim().is_empty() {
            return ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            };
        }

        match self.get(provider_id) {
            Some(adapter) => {
                match adapter.validate_model(model_id).await {
                    Ok(response) => response,
                    Err(e) => {
                        warn!("Model validation failed for {}: {}", provider_id, e);
                        // If validation fails, accept the model ID anyway
                        // The runtime will reject it if truly invalid
                        ValidateModelResponse {
                            valid: true,
                            model: Some(ProviderModel {
                                id: model_id.to_string(),
                                name: model_id.to_string(),
                                description: None,
                                capabilities: vec![],
                                context_window: None,
                            }),
                            suggested: None,
                            message: Some(format!(
                                "Validation check failed, but model ID accepted: {}",
                                e
                            )),
                        }
                    }
                }
            }
            None => {
                // Unknown provider - accept any non-empty ID
                ValidateModelResponse {
                    valid: true,
                    model: Some(ProviderModel {
                        id: model_id.to_string(),
                        name: model_id.to_string(),
                        description: None,
                        capabilities: vec![],
                        context_window: None,
                    }),
                    suggested: None,
                    message: Some(format!(
                        "Unknown provider '{}', model ID accepted as-is",
                        provider_id
                    )),
                }
            }
        }
    }
}

impl Default for ModelAdapterRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Provider-Specific Adapters
// =============================================================================

/// OpenCode model adapter
/// Note: OpenCode currently doesn't expose a models list command.
/// This adapter exists as a placeholder for when that functionality is added.
pub struct OpenCodeModelAdapter;

impl Default for OpenCodeModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenCodeModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for OpenCodeModelAdapter {
    fn provider_id(&self) -> &str {
        "opencode"
    }

    fn supports_discovery(&self) -> bool {
        // OpenCode doesn't currently have a models list command
        // When/if it does, change this to true and implement discover_models
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        // Try to detect if opencode has models command
        // This is a placeholder for when opencode adds models support
        match Command::new("opencode")
            .args(["models", "list", "--json"])
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                match parse_models_json(&stdout) {
                    Ok(models) => {
                        let default_model_id = models.first().map(|m| m.id.clone());
                        Ok(ModelDiscoveryResponse {
                            supported: true,
                            models: Some(models),
                            default_model_id,
                            allow_freeform: true,
                            freeform_hint: None,
                            error: None,
                        })
                    }
                    Err(e) => Err(anyhow!("Failed to parse models: {}", e)),
                }
            }
            _ => {
                // Command failed or doesn't exist - not supported
                Ok(ModelDiscoveryResponse {
                    supported: false,
                    models: None,
                    default_model_id: None,
                    allow_freeform: true,
                    freeform_hint: Some(
                        "Enter OpenCode model ID (e.g., anthropic:claude-3-7-sonnet)".to_string(),
                    ),
                    error: None,
                })
            }
        }
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        // OpenCode model IDs are opaque - we don't parse them
        // Just check non-empty
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        // Try to validate with opencode if possible
        // For now, accept any non-empty ID
        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("OpenCode model: {}", model_id)),
                capabilities: vec!["code".to_string(), "tools".to_string()],
                context_window: None,
            }),
            suggested: None,
            message: None,
        })
    }
}

/// Gemini model adapter
/// Note: Gemini CLI doesn't currently expose models list.
pub struct GeminiModelAdapter;

impl Default for GeminiModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl GeminiModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for GeminiModelAdapter {
    fn provider_id(&self) -> &str {
        "gemini"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some("Enter Gemini model ID (e.g., gemini-2.0-flash)".to_string()),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Gemini model: {}", model_id)),
                capabilities: vec!["code".to_string(), "vision".to_string()],
                context_window: Some(1_000_000), // Gemini has large context
            }),
            suggested: None,
            message: None,
        })
    }
}

/// Claude model adapter
pub struct ClaudeModelAdapter;

impl Default for ClaudeModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ClaudeModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for ClaudeModelAdapter {
    fn provider_id(&self) -> &str {
        "claude"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some(
                "Enter Claude model ID (e.g., claude-3-7-sonnet-20250219)".to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        // Known Claude model families for suggestions
        let known_models = [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-5-haiku-20241022",
            "claude-3-7-sonnet-20250219",
        ];

        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Claude model: {}", model_id)),
                capabilities: vec!["code".to_string(), "tools".to_string()],
                context_window: Some(200_000),
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!(
                    "Model '{}' not in known list, but accepted",
                    model_id
                ))
            },
        })
    }
}

/// Kimi model adapter
pub struct KimiModelAdapter;

impl Default for KimiModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl KimiModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for KimiModelAdapter {
    fn provider_id(&self) -> &str {
        "kimi"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some("Enter Kimi model ID (e.g., kimi-k2)".to_string()),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Kimi model: {}", model_id)),
                capabilities: vec!["code".to_string(), "long_context".to_string()],
                context_window: Some(2_000_000), // Kimi has very large context
            }),
            suggested: None,
            message: None,
        })
    }
}

/// Codex model adapter
pub struct CodexModelAdapter;

impl Default for CodexModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CodexModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for CodexModelAdapter {
    fn provider_id(&self) -> &str {
        "codex"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some("Enter Codex model ID (e.g., codex-mini)".to_string()),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Codex model: {}", model_id)),
                capabilities: vec!["code".to_string(), "terminal".to_string()],
                context_window: None,
            }),
            suggested: None,
            message: None,
        })
    }
}

/// Ollama model adapter
/// Ollama supports model discovery via `ollama list` command
pub struct OllamaModelAdapter;

impl Default for OllamaModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OllamaModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for OllamaModelAdapter {
    fn provider_id(&self) -> &str {
        "ollama"
    }

    fn supports_discovery(&self) -> bool {
        // Ollama has `ollama list` command
        true
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        // Try to list models using ollama CLI
        match Command::new("ollama")
            .args(["list", "--json"])
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);

                // Try to parse Ollama's JSON format
                // Format: [{"name": "llama3.2", "model": "llama3.2:latest", ...}]
                match serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
                    Ok(entries) => {
                        let models: Vec<ProviderModel> = entries
                            .into_iter()
                            .filter_map(|entry| {
                                let name = entry.get("name")?.as_str()?;
                                Some(ProviderModel {
                                    id: name.to_string(),
                                    name: name.to_string(),
                                    description: entry
                                        .get("digest")
                                        .and_then(|d| d.as_str())
                                        .map(|d| format!("Digest: {}", &d[..16.min(d.len())])),
                                    capabilities: vec!["local".to_string(), "code".to_string()],
                                    context_window: None,
                                })
                            })
                            .collect();

                        let default_model_id = models.first().map(|m| m.id.clone());
                        Ok(ModelDiscoveryResponse {
                            supported: true,
                            models: Some(models),
                            default_model_id,
                            allow_freeform: true,
                            freeform_hint: Some(
                                "Or enter Ollama model name (e.g., llama3.2)".to_string(),
                            ),
                            error: None,
                        })
                    }
                    Err(e) => Err(anyhow!("Failed to parse Ollama models: {}", e)),
                }
            }
            _ => {
                // Ollama not installed or command failed
                Ok(ModelDiscoveryResponse {
                    supported: true,
                    models: None,
                    default_model_id: None,
                    allow_freeform: true,
                    freeform_hint: Some(
                        "Enter Ollama model name (e.g., llama3.2, codellama, mistral)".to_string(),
                    ),
                    error: Some("Could not list Ollama models. Is Ollama installed?".to_string()),
                })
            }
        }
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        // Common Ollama models for suggestions
        let known_models = vec![
            "llama3.2",
            "llama3.1",
            "codellama",
            "mistral",
            "mixtral",
            "phi4",
            "qwen2.5",
            "deepseek-coder",
            "gemma2",
        ];

        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Ollama model: {}", model_id)),
                capabilities: vec!["local".to_string(), "code".to_string()],
                context_window: None,
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!(
                    "Model '{}' not in common list, but accepted",
                    model_id
                ))
            },
        })
    }
}

/// LM Studio model adapter
/// LM Studio runs local models with an OpenAI-compatible API
pub struct LmStudioModelAdapter;

impl Default for LmStudioModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl LmStudioModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for LmStudioModelAdapter {
    fn provider_id(&self) -> &str {
        "lmstudio"
    }

    fn supports_discovery(&self) -> bool {
        // LM Studio has API endpoint for models if running
        true
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        // Try to query LM Studio API
        // Default LM Studio API runs on http://127.0.0.1:1234/v1/models
        match reqwest::get("http://127.0.0.1:1234/v1/models").await {
            Ok(response) if response.status().is_success() => {
                match response.json::<serde_json::Value>().await {
                    Ok(json) => {
                        if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                            let models: Vec<ProviderModel> = data
                                .iter()
                                .filter_map(|entry| {
                                    let id = entry.get("id")?.as_str()?;
                                    Some(ProviderModel {
                                        id: id.to_string(),
                                        name: entry
                                            .get("object")
                                            .and_then(|o| o.as_str())
                                            .unwrap_or(id)
                                            .to_string(),
                                        description: Some("Local LM Studio model".to_string()),
                                        capabilities: vec!["local".to_string(), "code".to_string()],
                                        context_window: None,
                                    })
                                })
                                .collect();

                            let default_model_id = models.first().map(|m| m.id.clone());
                            return Ok(ModelDiscoveryResponse {
                                supported: true,
                                models: Some(models),
                                default_model_id,
                                allow_freeform: true,
                                freeform_hint: None,
                                error: None,
                            });
                        }
                        Err(anyhow!("Unexpected LM Studio response format"))
                    }
                    Err(e) => Err(anyhow!("Failed to parse LM Studio response: {}", e)),
                }
            }
            _ => {
                // LM Studio not running
                Ok(ModelDiscoveryResponse {
                    supported: true,
                    models: None,
                    default_model_id: None,
                    allow_freeform: true,
                    freeform_hint: Some(
                        "Enter LM Studio model ID (local server not running)".to_string(),
                    ),
                    error: Some("LM Studio API not available. Is LM Studio running?".to_string()),
                })
            }
        }
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("LM Studio model: {}", model_id)),
                capabilities: vec![
                    "local".to_string(),
                    "code".to_string(),
                    "openai-compatible".to_string(),
                ],
                context_window: None,
            }),
            suggested: None,
            message: None,
        })
    }
}

/// OpenRouter model adapter
/// OpenRouter provides unified access to many models via API
pub struct OpenRouterModelAdapter;

impl Default for OpenRouterModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenRouterModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for OpenRouterModelAdapter {
    fn provider_id(&self) -> &str {
        "openrouter"
    }

    fn supports_discovery(&self) -> bool {
        // OpenRouter has API for listing models
        true
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        // OpenRouter API requires auth, so we return known models
        // In production, this would query https://openrouter.ai/api/v1/models
        Ok(ModelDiscoveryResponse {
            supported: true,
            models: Some(vec![
                ProviderModel {
                    id: "anthropic/claude-3.7-sonnet".to_string(),
                    name: "Claude 3.7 Sonnet".to_string(),
                    description: Some("Via OpenRouter".to_string()),
                    capabilities: vec!["code".to_string(), "tools".to_string()],
                    context_window: Some(200_000),
                },
                ProviderModel {
                    id: "openai/gpt-4o".to_string(),
                    name: "GPT-4o".to_string(),
                    description: Some("Via OpenRouter".to_string()),
                    capabilities: vec!["code".to_string(), "vision".to_string()],
                    context_window: Some(128_000),
                },
                ProviderModel {
                    id: "google/gemini-2.0-flash-exp".to_string(),
                    name: "Gemini 2.0 Flash".to_string(),
                    description: Some("Via OpenRouter".to_string()),
                    capabilities: vec!["code".to_string(), "vision".to_string()],
                    context_window: Some(1_000_000),
                },
                ProviderModel {
                    id: "deepseek/deepseek-chat".to_string(),
                    name: "DeepSeek V3".to_string(),
                    description: Some("Via OpenRouter".to_string()),
                    capabilities: vec!["code".to_string()],
                    context_window: Some(64_000),
                },
            ]),
            default_model_id: Some("anthropic/claude-3.7-sonnet".to_string()),
            allow_freeform: true,
            freeform_hint: Some(
                "Enter any OpenRouter model ID (format: provider/model)".to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        // OpenRouter format is provider/model
        if !model_id.contains('/') {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: Some(vec![
                    "anthropic/claude-3.7-sonnet".to_string(),
                    "openai/gpt-4o".to_string(),
                ]),
                message: Some(
                    "OpenRouter model IDs should be in format: provider/model".to_string(),
                ),
            });
        }

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("OpenRouter model: {}", model_id)),
                capabilities: vec!["api".to_string(), "code".to_string()],
                context_window: None,
            }),
            suggested: None,
            message: None,
        })
    }
}

/// Groq model adapter
/// Groq provides fast inference for open models
pub struct GroqModelAdapter;

impl Default for GroqModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl GroqModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for GroqModelAdapter {
    fn provider_id(&self) -> &str {
        "groq"
    }

    fn supports_discovery(&self) -> bool {
        // Groq has API for models but requires auth
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        // Groq is API-only, no CLI model discovery
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some(
                "Enter Groq model ID (e.g., llama-3.3-70b-versatile, mixtral-8x7b-32768)"
                    .to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        // Known Groq models for suggestions
        let known_models = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
            "deepseek-r1-distill-llama-70b",
        ];

        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Groq model: {}", model_id)),
                capabilities: vec!["fast".to_string(), "api".to_string(), "code".to_string()],
                context_window: Some(128_000),
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!("Model '{}' not in known Groq list", model_id))
            },
        })
    }
}

/// DeepSeek model adapter
/// DeepSeek provides open-source coding models
pub struct DeepSeekModelAdapter;

impl Default for DeepSeekModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl DeepSeekModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for DeepSeekModelAdapter {
    fn provider_id(&self) -> &str {
        "deepseek"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some(
                "Enter DeepSeek model ID (e.g., deepseek-chat, deepseek-coder)".to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        let known_models = ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"];
        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("DeepSeek model: {}", model_id)),
                capabilities: vec!["code".to_string(), "chinese".to_string()],
                context_window: Some(64_000),
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!("Model '{}' not in known DeepSeek list", model_id))
            },
        })
    }
}

/// Mistral model adapter
/// Mistral provides European AI models
pub struct MistralModelAdapter;

impl Default for MistralModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl MistralModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for MistralModelAdapter {
    fn provider_id(&self) -> &str {
        "mistral"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some(
                "Enter Mistral model ID (e.g., mistral-large, codestral)".to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        let known_models = [
            "mistral-large",
            "mistral-medium",
            "codestral",
            "mistral-small",
        ];
        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Mistral model: {}", model_id)),
                capabilities: vec!["code".to_string(), "european".to_string()],
                context_window: Some(32_000),
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!("Model '{}' not in known Mistral list", model_id))
            },
        })
    }
}

/// OpenAI API adapter (for direct API access, not OpenCode)
/// Provides access to GPT models via OpenAI API
pub struct OpenAiModelAdapter;

impl Default for OpenAiModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenAiModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for OpenAiModelAdapter {
    fn provider_id(&self) -> &str {
        "openai"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: Some("gpt-4o".to_string()),
            allow_freeform: true,
            freeform_hint: Some(
                "Enter OpenAI model ID (e.g., gpt-4o, gpt-4o-mini, o1, o3-mini)".to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        let known_models = [
            "gpt-4o",
            "gpt-4o-mini",
            "o1",
            "o1-mini",
            "o3-mini",
            "gpt-4-turbo",
        ];
        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("OpenAI model: {}", model_id)),
                capabilities: vec!["chat".to_string(), "vision".to_string()],
                context_window: Some(128_000),
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!("Model '{}' not in known OpenAI list", model_id))
            },
        })
    }
}

/// Cohere API adapter
/// Provides access to Command models
pub struct CohereModelAdapter;

impl Default for CohereModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CohereModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for CohereModelAdapter {
    fn provider_id(&self) -> &str {
        "cohere"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: Some("command-r-plus".to_string()),
            allow_freeform: true,
            freeform_hint: Some(
                "Enter Cohere model ID (e.g., command-r-plus, command-r, command)".to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        let known_models = ["command-r-plus", "command-r", "command", "command-light"];
        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Cohere model: {}", model_id)),
                capabilities: vec!["chat".to_string(), "enterprise".to_string()],
                context_window: Some(128_000),
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!("Model '{}' not in known Cohere list", model_id))
            },
        })
    }
}

/// Together AI API adapter
/// Provides access to open source models
pub struct TogetherModelAdapter;

impl Default for TogetherModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl TogetherModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for TogetherModelAdapter {
    fn provider_id(&self) -> &str {
        "together"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some(
                "Enter Together AI model ID (e.g., meta-llama/Llama-3.3-70B-Instruct-Turbo)"
                    .to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        // Together uses HuggingFace-style model IDs with slashes
        let is_valid_format = model_id.contains('/');

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id
                    .split('/')
                    .next_back()
                    .unwrap_or(model_id)
                    .to_string(),
                description: Some(format!("Together AI model: {}", model_id)),
                capabilities: vec!["chat".to_string(), "open-source".to_string()],
                context_window: Some(128_000),
            }),
            suggested: if is_valid_format {
                None
            } else {
                Some(vec!["meta-llama/Llama-3.3-70B-Instruct-Turbo".to_string()])
            },
            message: if is_valid_format {
                None
            } else {
                Some("Together model IDs typically use format 'org/model-name'".to_string())
            },
        })
    }
}

/// Fireworks AI API adapter
/// Provides fast inference for open source models
pub struct FireworksModelAdapter;

impl Default for FireworksModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl FireworksModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for FireworksModelAdapter {
    fn provider_id(&self) -> &str {
        "fireworks"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some("Enter Fireworks model ID (e.g., accounts/fireworks/models/llama-v3p3-70b-instruct)".to_string()),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id
                    .split('/')
                    .next_back()
                    .unwrap_or(model_id)
                    .to_string(),
                description: Some(format!("Fireworks model: {}", model_id)),
                capabilities: vec!["chat".to_string(), "fast".to_string()],
                context_window: Some(128_000),
            }),
            suggested: None,
            message: None,
        })
    }
}

/// Perplexity API adapter
/// Provides search-augmented models
pub struct PerplexityModelAdapter;

impl Default for PerplexityModelAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl PerplexityModelAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ProviderModelAdapter for PerplexityModelAdapter {
    fn provider_id(&self) -> &str {
        "perplexity"
    }

    fn supports_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> Result<ModelDiscoveryResponse> {
        Ok(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: Some("sonar-pro".to_string()),
            allow_freeform: true,
            freeform_hint: Some(
                "Enter Perplexity model ID (e.g., sonar-pro, sonar, sonar-reasoning)".to_string(),
            ),
            error: None,
        })
    }

    async fn validate_model(&self, model_id: &str) -> Result<ValidateModelResponse> {
        if model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        let known_models = [
            "sonar-pro",
            "sonar",
            "sonar-reasoning",
            "sonar-deep-research",
        ];
        let is_known = known_models.iter().any(|m| m == &model_id);

        Ok(ValidateModelResponse {
            valid: true,
            model: Some(ProviderModel {
                id: model_id.to_string(),
                name: model_id.to_string(),
                description: Some(format!("Perplexity search model: {}", model_id)),
                capabilities: vec![
                    "chat".to_string(),
                    "search".to_string(),
                    "citations".to_string(),
                ],
                context_window: Some(128_000),
            }),
            suggested: if is_known {
                None
            } else {
                Some(known_models.iter().map(|s| s.to_string()).collect())
            },
            message: if is_known {
                None
            } else {
                Some(format!("Model '{}' not in known Perplexity list", model_id))
            },
        })
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Parse models JSON from CLI output
/// Supports both array of objects and array of strings
fn parse_models_json(json_str: &str) -> Result<Vec<ProviderModel>> {
    // Try to parse as array of ProviderModel first
    if let Ok(models) = serde_json::from_str::<Vec<ProviderModel>>(json_str) {
        return Ok(models);
    }

    // Try to parse as array of strings
    if let Ok(ids) = serde_json::from_str::<Vec<String>>(json_str) {
        return Ok(ids
            .into_iter()
            .map(|id| ProviderModel {
                id: id.clone(),
                name: id.clone(),
                description: None,
                capabilities: vec![],
                context_window: None,
            })
            .collect());
    }

    // Try to parse as object with "models" field
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
        if let Some(models_array) = value.get("models").and_then(|m| m.as_array()) {
            let models: Vec<ProviderModel> = models_array
                .iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect();
            if !models.is_empty() {
                return Ok(models);
            }
        }
    }

    Err(anyhow!("Unable to parse models JSON"))
}

/// Convert provider ID to profile ID for a chat profile
pub fn provider_to_profile_id(provider_id: &str) -> String {
    format!("{}-acp", provider_id)
}

/// Extract provider ID from profile ID
/// Returns None if not a recognized pattern
pub fn profile_to_provider_id(profile_id: &str) -> Option<String> {
    if profile_id.ends_with("-acp") {
        Some(profile_id.trim_end_matches("-acp").to_string())
    } else if profile_id.ends_with("-auth") {
        Some(profile_id.trim_end_matches("-auth").to_string())
    } else if profile_id.ends_with("-cli") {
        Some(profile_id.trim_end_matches("-cli").to_string())
    } else if profile_id == "claude-code" {
        Some("claude".to_string())
    } else if profile_id == "codex" {
        Some("codex".to_string())
    } else if profile_id == "gemini-cli" {
        Some("gemini".to_string())
    } else if profile_id == "kimi-cli" {
        Some("kimi".to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profile_to_provider_id() {
        assert_eq!(
            profile_to_provider_id("opencode-acp"),
            Some("opencode".to_string())
        );
        assert_eq!(
            profile_to_provider_id("gemini-auth"),
            Some("gemini".to_string())
        );
        assert_eq!(
            profile_to_provider_id("claude-code"),
            Some("claude".to_string())
        );
        assert_eq!(profile_to_provider_id("unknown"), None);
    }

    #[test]
    fn test_provider_to_profile_id() {
        assert_eq!(provider_to_profile_id("opencode"), "opencode-acp");
        assert_eq!(provider_to_profile_id("gemini"), "gemini-acp");
    }

    #[test]
    fn test_parse_models_json_objects() {
        let json = r#"[
            {"id": "model-1", "name": "Model One"},
            {"id": "model-2", "name": "Model Two", "capabilities": ["code"]}
        ]"#;
        let models = parse_models_json(json).unwrap();
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "model-1");
        assert_eq!(models[1].capabilities, vec!["code"]);
    }

    #[test]
    fn test_parse_models_json_strings() {
        let json = r#"["model-a", "model-b", "model-c"]"#;
        let models = parse_models_json(json).unwrap();
        assert_eq!(models.len(), 3);
        assert_eq!(models[0].id, "model-a");
    }
}
