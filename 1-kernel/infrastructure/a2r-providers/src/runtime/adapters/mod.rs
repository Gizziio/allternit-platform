//! Provider Adapter Implementations
//!
//! Each adapter wraps both authentication and model discovery functionality
//! for a specific provider.

use async_trait::async_trait;

use super::adapter::{AuthMethodType, ProviderAdapter, ProviderMetadata};
use super::auth::{AuthStatus, ProviderAuthRegistry};
use super::models::{ModelAdapterRegistry, ModelDiscoveryResponse, ValidateModelResponse};

// =============================================================================
// OpenCode Adapter
// =============================================================================

pub struct OpenCodeAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for OpenCodeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenCodeAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for OpenCodeAdapter {
    fn provider_id(&self) -> &str {
        "opencode"
    }
    fn provider_name(&self) -> &str {
        "OpenCode"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        self.auth_registry.check_auth_status("opencode").await
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "opencode".to_string(),
            "auth".to_string(),
            "login".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "opencode".to_string(),
            "auth".to_string(),
            "logout".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "opencode-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["opencode-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("opencode").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("opencode", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            description: "OpenCode CLI for AI code assistance".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::CliWizard,
        }
    }
}

// =============================================================================
// Gemini Adapter
// =============================================================================

pub struct GeminiAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for GeminiAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl GeminiAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for GeminiAdapter {
    fn provider_id(&self) -> &str {
        "gemini"
    }
    fn provider_name(&self) -> &str {
        "Google Gemini"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        self.auth_registry.check_auth_status("gemini").await
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "gemini".to_string(),
            "auth".to_string(),
            "login".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "gemini".to_string(),
            "auth".to_string(),
            "logout".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "gemini-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["gemini-acp".to_string(), "gemini-cli".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("gemini").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("gemini", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "gemini".to_string(),
            name: "Google Gemini".to_string(),
            description: "Google Gemini CLI".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::CliWizard,
        }
    }
}

// =============================================================================
// Claude Adapter
// =============================================================================

pub struct ClaudeAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for ClaudeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ClaudeAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for ClaudeAdapter {
    fn provider_id(&self) -> &str {
        "claude"
    }
    fn provider_name(&self) -> &str {
        "Anthropic Claude"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        self.auth_registry.check_auth_status("claude").await
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "claude".to_string(),
            "auth".to_string(),
            "login".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "claude".to_string(),
            "auth".to_string(),
            "logout".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "claude-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["claude-acp".to_string(), "claude-code".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("claude").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("claude", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "claude".to_string(),
            name: "Anthropic Claude".to_string(),
            description: "Claude Code CLI".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::CliWizard,
        }
    }
}

// =============================================================================
// Kimi Adapter
// =============================================================================

pub struct KimiAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for KimiAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl KimiAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for KimiAdapter {
    fn provider_id(&self) -> &str {
        "kimi"
    }
    fn provider_name(&self) -> &str {
        "Kimi"
    }
    fn requires_auth(&self) -> bool {
        false
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        Ok(AuthStatus::NotRequired)
    }

    fn login_command(&self) -> Option<Vec<String>> {
        None
    }
    fn logout_command(&self) -> Option<Vec<String>> {
        None
    }

    fn auth_profile_id(&self) -> String {
        "kimi-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["kimi-acp".to_string(), "kimi-cli".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("kimi").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("kimi", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "kimi".to_string(),
            name: "Kimi".to_string(),
            description: "Kimi CLI".to_string(),
            requires_auth: false,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::None,
        }
    }
}

// =============================================================================
// Codex Adapter
// =============================================================================

pub struct CodexAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for CodexAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CodexAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for CodexAdapter {
    fn provider_id(&self) -> &str {
        "codex"
    }
    fn provider_name(&self) -> &str {
        "OpenAI Codex"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("OPENAI_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set OPENAI_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset OPENAI_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "codex-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["codex-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("codex").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("codex", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "codex".to_string(),
            name: "OpenAI Codex".to_string(),
            description: "OpenAI Codex CLI".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "OPENAI_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// Ollama Adapter
// =============================================================================

pub struct OllamaAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for OllamaAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OllamaAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for OllamaAdapter {
    fn provider_id(&self) -> &str {
        "ollama"
    }
    fn provider_name(&self) -> &str {
        "Ollama"
    }
    fn requires_auth(&self) -> bool {
        false
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        Ok(AuthStatus::NotRequired)
    }

    fn login_command(&self) -> Option<Vec<String>> {
        None
    }
    fn logout_command(&self) -> Option<Vec<String>> {
        None
    }

    fn auth_profile_id(&self) -> String {
        "ollama-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["ollama-acp".to_string(), "ollama-local".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        true
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("ollama").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("ollama", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "ollama".to_string(),
            name: "Ollama".to_string(),
            description: "Local LLM runner".to_string(),
            requires_auth: false,
            supports_discovery: true,
            local: true,
            auth_method: AuthMethodType::None,
        }
    }
}

// =============================================================================
// LM Studio Adapter
// =============================================================================

pub struct LmStudioAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for LmStudioAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl LmStudioAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for LmStudioAdapter {
    fn provider_id(&self) -> &str {
        "lmstudio"
    }
    fn provider_name(&self) -> &str {
        "LM Studio"
    }
    fn requires_auth(&self) -> bool {
        false
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        Ok(AuthStatus::NotRequired)
    }

    fn login_command(&self) -> Option<Vec<String>> {
        None
    }
    fn logout_command(&self) -> Option<Vec<String>> {
        None
    }

    fn auth_profile_id(&self) -> String {
        "lmstudio-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["lmstudio-acp".to_string(), "lmstudio-local".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("lmstudio").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("lmstudio", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "lmstudio".to_string(),
            name: "LM Studio".to_string(),
            description: "Local LLM GUI and API".to_string(),
            requires_auth: false,
            supports_discovery: false,
            local: true,
            auth_method: AuthMethodType::None,
        }
    }
}

// =============================================================================
// OpenRouter Adapter
// =============================================================================

pub struct OpenRouterAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for OpenRouterAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenRouterAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for OpenRouterAdapter {
    fn provider_id(&self) -> &str {
        "openrouter"
    }
    fn provider_name(&self) -> &str {
        "OpenRouter"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("OPENROUTER_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set OPENROUTER_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset OPENROUTER_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "openrouter-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["openrouter-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("openrouter").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("openrouter", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "openrouter".to_string(),
            name: "OpenRouter".to_string(),
            description: "Unified API for many models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "OPENROUTER_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// Groq Adapter
// =============================================================================

pub struct GroqAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for GroqAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl GroqAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for GroqAdapter {
    fn provider_id(&self) -> &str {
        "groq"
    }
    fn provider_name(&self) -> &str {
        "Groq"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("GROQ_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set GROQ_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset GROQ_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "groq-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["groq-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("groq").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("groq", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "groq".to_string(),
            name: "Groq".to_string(),
            description: "Fast inference for open source models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "GROQ_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// DeepSeek Adapter
// =============================================================================

pub struct DeepSeekAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for DeepSeekAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl DeepSeekAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for DeepSeekAdapter {
    fn provider_id(&self) -> &str {
        "deepseek"
    }
    fn provider_name(&self) -> &str {
        "DeepSeek"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("DEEPSEEK_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set DEEPSEEK_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset DEEPSEEK_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "deepseek-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["deepseek-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("deepseek").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("deepseek", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            description: "DeepSeek AI models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "DEEPSEEK_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// Mistral Adapter
// =============================================================================

pub struct MistralAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for MistralAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl MistralAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for MistralAdapter {
    fn provider_id(&self) -> &str {
        "mistral"
    }
    fn provider_name(&self) -> &str {
        "Mistral"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("MISTRAL_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set MISTRAL_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset MISTRAL_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "mistral-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["mistral-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("mistral").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("mistral", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "mistral".to_string(),
            name: "Mistral".to_string(),
            description: "European AI models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "MISTRAL_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// OpenAI Adapter (Direct API)
// =============================================================================

pub struct OpenAiAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for OpenAiAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenAiAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for OpenAiAdapter {
    fn provider_id(&self) -> &str {
        "openai"
    }
    fn provider_name(&self) -> &str {
        "OpenAI"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("OPENAI_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set OPENAI_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset OPENAI_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "openai-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["openai-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("openai").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("openai", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            description: "OpenAI API for GPT models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "OPENAI_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// Cohere Adapter
// =============================================================================

pub struct CohereAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for CohereAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CohereAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for CohereAdapter {
    fn provider_id(&self) -> &str {
        "cohere"
    }
    fn provider_name(&self) -> &str {
        "Cohere"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("COHERE_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set COHERE_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset COHERE_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "cohere-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["cohere-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("cohere").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self.model_registry.validate_model("cohere", model_id).await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "cohere".to_string(),
            name: "Cohere".to_string(),
            description: "Cohere Command models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "COHERE_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// Together Adapter
// =============================================================================

pub struct TogetherAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for TogetherAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl TogetherAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for TogetherAdapter {
    fn provider_id(&self) -> &str {
        "together"
    }
    fn provider_name(&self) -> &str {
        "Together AI"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("TOGETHER_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set TOGETHER_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset TOGETHER_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "together-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["together-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("together").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("together", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "together".to_string(),
            name: "Together AI".to_string(),
            description: "Together AI for open source models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "TOGETHER_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// Fireworks Adapter
// =============================================================================

pub struct FireworksAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for FireworksAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl FireworksAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for FireworksAdapter {
    fn provider_id(&self) -> &str {
        "fireworks"
    }
    fn provider_name(&self) -> &str {
        "Fireworks AI"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("FIREWORKS_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set FIREWORKS_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset FIREWORKS_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "fireworks-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["fireworks-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("fireworks").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("fireworks", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "fireworks".to_string(),
            name: "Fireworks AI".to_string(),
            description: "Fireworks AI for fast inference".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "FIREWORKS_API_KEY".to_string(),
            },
        }
    }
}

// =============================================================================
// Perplexity Adapter
// =============================================================================

pub struct PerplexityAdapter {
    auth_registry: ProviderAuthRegistry,
    model_registry: ModelAdapterRegistry,
}

impl Default for PerplexityAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl PerplexityAdapter {
    pub fn new() -> Self {
        Self {
            auth_registry: ProviderAuthRegistry::new(),
            model_registry: ModelAdapterRegistry::new(),
        }
    }
}

#[async_trait]
impl ProviderAdapter for PerplexityAdapter {
    fn provider_id(&self) -> &str {
        "perplexity"
    }
    fn provider_name(&self) -> &str {
        "Perplexity"
    }
    fn requires_auth(&self) -> bool {
        true
    }

    async fn auth_status(&self) -> anyhow::Result<AuthStatus> {
        match std::env::var("PERPLEXITY_API_KEY") {
            Ok(_) => Ok(AuthStatus::Ok),
            Err(_) => Ok(AuthStatus::Missing),
        }
    }

    fn login_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "echo".to_string(),
            "Set PERPLEXITY_API_KEY environment variable".to_string(),
        ])
    }

    fn logout_command(&self) -> Option<Vec<String>> {
        Some(vec![
            "sh".to_string(),
            "-c".to_string(),
            "unset PERPLEXITY_API_KEY".to_string(),
        ])
    }

    fn auth_profile_id(&self) -> String {
        "perplexity-auth".to_string()
    }
    fn chat_profile_ids(&self) -> Vec<String> {
        vec!["perplexity-acp".to_string()]
    }
    fn supports_model_discovery(&self) -> bool {
        false
    }

    async fn discover_models(&self) -> anyhow::Result<ModelDiscoveryResponse> {
        Ok(self.model_registry.discover_models("perplexity").await)
    }

    async fn validate_model(&self, model_id: &str) -> anyhow::Result<ValidateModelResponse> {
        Ok(self
            .model_registry
            .validate_model("perplexity", model_id)
            .await)
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "perplexity".to_string(),
            name: "Perplexity".to_string(),
            description: "Perplexity search-augmented models".to_string(),
            requires_auth: true,
            supports_discovery: false,
            local: false,
            auth_method: AuthMethodType::EnvVar {
                name: "PERPLEXITY_API_KEY".to_string(),
            },
        }
    }
}
