//! Provider Adapter Trait
//!
//! Defines the interface that all provider adapters must implement.
//! This is the boundary where provider-specific types are normalized.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::auth::AuthStatus;
use super::models::{ModelDiscoveryResponse, ValidateModelResponse};

/// Type of authentication method
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethodType {
    /// CLI login wizard (e.g., `opencode auth login`)
    CliWizard,
    /// Environment variable (e.g., OPENAI_API_KEY)
    EnvVar { name: String },
    /// Config file (e.g., ~/.config/gemini/credentials.json)
    ConfigFile { path: String },
    /// No authentication required
    None,
}

/// Provider metadata for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    /// Provider ID (e.g., "openai", "claude")
    pub id: String,
    /// Display name (e.g., "OpenAI", "Anthropic Claude")
    pub name: String,
    /// Description
    pub description: String,
    /// Whether authentication is required
    pub requires_auth: bool,
    /// Whether model discovery is supported
    pub supports_discovery: bool,
    /// Whether this is a local provider
    pub local: bool,
    /// Authentication method
    pub auth_method: AuthMethodType,
}

/// Provider adapter trait - implemented by all provider adapters
///
/// This is the boundary where provider-specific quirks are hidden
/// behind a normalized interface.
#[async_trait]
pub trait ProviderAdapter: Send + Sync {
    /// Provider ID (unique identifier)
    fn provider_id(&self) -> &str;

    /// Provider display name
    fn provider_name(&self) -> &str;

    /// Whether this provider requires authentication
    fn requires_auth(&self) -> bool;

    /// Check current authentication status
    async fn auth_status(&self) -> anyhow::Result<AuthStatus>;

    /// Get login command (if applicable)
    fn login_command(&self) -> Option<Vec<String>>;

    /// Get logout command (if applicable)
    fn logout_command(&self) -> Option<Vec<String>>;

    /// Auth profile ID for this provider
    fn auth_profile_id(&self) -> String;

    /// Chat profile IDs for this provider
    fn chat_profile_ids(&self) -> Vec<String>;

    /// Whether model discovery is supported
    fn supports_model_discovery(&self) -> bool;

    /// Discover available models
    ///
    /// Returns ModelDiscoveryResponse with:
    /// - supported: true if discovery works
    /// - models: list of models (None if not supported)
    /// - allow_freeform: whether to allow manual entry
    /// - freeform_hint: hint text for manual entry
    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse>;

    /// Validate a model ID
    ///
    /// Returns ValidateModelResponse with:
    /// - valid: whether the model is valid
    /// - model: model info if valid
    /// - suggested: alternative suggestions if invalid
    /// - message: error message if invalid
    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse>;

    /// Get provider metadata
    fn metadata(&self) -> ProviderMetadata;
}

/// Registry of provider adapters
pub struct ProviderAdapterRegistry {
    adapters: Vec<Box<dyn ProviderAdapter>>,
}

impl ProviderAdapterRegistry {
    /// Create a new registry with all built-in adapters
    pub fn new() -> Self {
        let mut registry = Self {
            adapters: Vec::new(),
        };
        registry.register_builtin_adapters();
        registry
    }

    fn register_builtin_adapters(&mut self) {
        use super::adapters::*;

        self.register(Box::new(OpenCodeAdapter::new()));
        self.register(Box::new(GeminiAdapter::new()));
        self.register(Box::new(ClaudeAdapter::new()));
        self.register(Box::new(KimiAdapter::new()));
        self.register(Box::new(CodexAdapter::new()));
        self.register(Box::new(OllamaAdapter::new()));
        self.register(Box::new(LmStudioAdapter::new()));
        self.register(Box::new(OpenRouterAdapter::new()));
        self.register(Box::new(GroqAdapter::new()));
        self.register(Box::new(DeepSeekAdapter::new()));
        self.register(Box::new(MistralAdapter::new()));
        self.register(Box::new(OpenAiAdapter::new()));
        self.register(Box::new(CohereAdapter::new()));
        self.register(Box::new(TogetherAdapter::new()));
        self.register(Box::new(FireworksAdapter::new()));
        self.register(Box::new(PerplexityAdapter::new()));
    }

    /// Register a new adapter
    pub fn register(&mut self, adapter: Box<dyn ProviderAdapter>) {
        self.adapters.push(adapter);
    }

    /// Get an adapter by provider ID
    pub fn get(&self, provider_id: &str) -> Option<&dyn ProviderAdapter> {
        self.adapters
            .iter()
            .find(|a| a.provider_id() == provider_id)
            .map(|a| a.as_ref())
    }

    /// List all registered adapters
    pub fn list(&self) -> Vec<&dyn ProviderAdapter> {
        self.adapters.iter().map(|a| a.as_ref()).collect()
    }

    /// Get adapter metadata for all providers
    pub fn list_metadata(&self) -> Vec<ProviderMetadata> {
        self.adapters.iter().map(|a| a.metadata()).collect()
    }
}

impl Default for ProviderAdapterRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_creation() {
        let registry = ProviderAdapterRegistry::new();
        let adapters = registry.list();
        assert_eq!(adapters.len(), 16);
    }

    #[test]
    fn test_registry_get() {
        let registry = ProviderAdapterRegistry::new();
        assert!(registry.get("openai").is_some());
        assert!(registry.get("ollama").is_some());
        assert!(registry.get("unknown").is_none());
    }

    #[test]
    fn test_registry_metadata() {
        let registry = ProviderAdapterRegistry::new();
        let metadata = registry.list_metadata();
        assert_eq!(metadata.len(), 16);

        // Check that all have required fields
        for meta in metadata {
            assert!(!meta.id.is_empty());
            assert!(!meta.name.is_empty());
        }
    }
}
