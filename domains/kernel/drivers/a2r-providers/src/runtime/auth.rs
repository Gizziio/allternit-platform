//! Provider Authentication Management
//!
//! Handles auth status checking and auth wizard configuration for CLI providers.
//! Each provider has:
//! - Auth commands (status, login, logout)
//! - Credential file locations
//! - Auth-only terminal profile for wizard

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::process::Command;
use tracing::info;

/// Authentication status for a provider
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuthStatus {
    /// Authenticated and ready
    Ok,
    /// No credentials found
    Missing,
    /// Credentials expired
    Expired,
    /// Unknown status (could not determine)
    Unknown,
    /// Auth not required for this provider
    NotRequired,
}

impl AuthStatus {
    pub fn is_authenticated(&self) -> bool {
        matches!(self, AuthStatus::Ok | AuthStatus::NotRequired)
    }
}

/// Authentication configuration for a CLI provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAuthConfig {
    /// Provider ID (e.g., "opencode", "gemini", "claude")
    pub provider_id: String,
    /// Command to check auth status (e.g., ["opencode", "auth", "list"])
    pub status_cmd: Vec<String>,
    /// Command to launch login wizard (e.g., ["opencode", "auth", "login"])
    pub login_cmd: Vec<String>,
    /// Command to logout (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logout_cmd: Option<Vec<String>>,
    /// Known credential file paths to check (optional fast-path)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential_files: Option<Vec<PathBuf>>,
    /// How to interpret status_cmd exit code
    pub status_check: StatusCheckMode,
    /// Auth profile ID (terminal mode for wizard)
    pub auth_profile_id: String,
    /// Chat profile IDs (protocol mode for usage)
    pub chat_profile_ids: Vec<String>,
    /// Command to list available models (optional)
    /// e.g., ["opencode", "models", "list", "--json"]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models_cmd: Option<Vec<String>>,
}

/// How to check if auth is valid
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StatusCheckMode {
    /// Exit code 0 = Ok, non-zero = Missing
    ExitCode,
    /// Parse JSON output for specific field
    JsonField {
        field_path: String,
        expected: String,
    },
    /// Check if stdout contains string (authenticated if contains)
    StdoutContains(String),
    /// Check if stdout contains string (NOT authenticated if contains)
    NotAuthenticatedIfContains(String),
    /// Auth not required (always ok)
    NotRequired,
}

/// Provider registry with auth configs
pub struct ProviderAuthRegistry {
    providers: HashMap<String, ProviderAuthConfig>,
}

impl ProviderAuthRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            providers: HashMap::new(),
        };
        registry.register_builtin_providers();
        registry
    }

    /// Register built-in provider auth configs
    fn register_builtin_providers(&mut self) {
        // OpenCode
        // Note: opencode auth list returns exit 0 even with 0 credentials,
        // so we check for "0 credentials" in stdout
        self.register(ProviderAuthConfig {
            provider_id: "opencode".to_string(),
            status_cmd: vec![
                "opencode".to_string(),
                "auth".to_string(),
                "list".to_string(),
            ],
            login_cmd: vec![
                "opencode".to_string(),
                "auth".to_string(),
                "login".to_string(),
            ],
            logout_cmd: Some(vec![
                "opencode".to_string(),
                "auth".to_string(),
                "logout".to_string(),
            ]),
            credential_files: Some(vec![PathBuf::from("~/.local/share/opencode/auth.json")]),
            status_check: StatusCheckMode::NotAuthenticatedIfContains("0 credentials".to_string()),
            auth_profile_id: "opencode-auth".to_string(),
            chat_profile_ids: vec!["opencode-acp".to_string()],
            models_cmd: None, // OpenCode doesn't have a headless models list command
                              // Models are discovered via ACP or freeform entry
        });

        // Gemini CLI
        self.register(ProviderAuthConfig {
            provider_id: "gemini".to_string(),
            status_cmd: vec!["gemini".to_string(), "auth".to_string()],
            login_cmd: vec![
                "gemini".to_string(),
                "auth".to_string(),
                "login".to_string(),
            ],
            logout_cmd: Some(vec![
                "gemini".to_string(),
                "auth".to_string(),
                "logout".to_string(),
            ]),
            credential_files: Some(vec![PathBuf::from("~/.config/gemini/credentials.json")]),
            status_check: StatusCheckMode::ExitCode,
            auth_profile_id: "gemini-auth".to_string(),
            chat_profile_ids: vec!["gemini-acp".to_string(), "gemini-cli".to_string()],
            models_cmd: None,
        });

        // Claude Code (if supported)
        self.register(ProviderAuthConfig {
            provider_id: "claude".to_string(),
            status_cmd: vec![
                "claude".to_string(),
                "auth".to_string(),
                "status".to_string(),
            ],
            login_cmd: vec![
                "claude".to_string(),
                "auth".to_string(),
                "login".to_string(),
            ],
            logout_cmd: Some(vec![
                "claude".to_string(),
                "auth".to_string(),
                "logout".to_string(),
            ]),
            credential_files: None, // Claude stores auth differently
            status_check: StatusCheckMode::ExitCode,
            auth_profile_id: "claude-auth".to_string(),
            chat_profile_ids: vec!["claude-acp".to_string(), "claude-code".to_string()],
            models_cmd: None,
        });

        // Kimi (no auth required usually)
        self.register(ProviderAuthConfig {
            provider_id: "kimi".to_string(),
            status_cmd: vec!["kimi".to_string(), "--version".to_string()],
            login_cmd: vec!["kimi".to_string(), "auth".to_string()],
            logout_cmd: None,
            credential_files: None,
            status_check: StatusCheckMode::NotRequired,
            auth_profile_id: "kimi-auth".to_string(),
            chat_profile_ids: vec!["kimi-acp".to_string(), "kimi-cli".to_string()],
            models_cmd: None,
        });

        // Ollama (local - no auth required)
        self.register(ProviderAuthConfig {
            provider_id: "ollama".to_string(),
            status_cmd: vec!["ollama".to_string(), "--version".to_string()],
            login_cmd: vec![], // No login needed
            logout_cmd: None,
            credential_files: None,
            status_check: StatusCheckMode::NotRequired,
            auth_profile_id: "ollama-auth".to_string(),
            chat_profile_ids: vec!["ollama-acp".to_string(), "ollama-local".to_string()],
            models_cmd: Some(vec![
                "ollama".to_string(),
                "list".to_string(),
                "--json".to_string(),
            ]),
        });

        // LM Studio (local - no auth required)
        self.register(ProviderAuthConfig {
            provider_id: "lmstudio".to_string(),
            status_cmd: vec![
                "curl".to_string(),
                "-s".to_string(),
                "http://127.0.0.1:1234/v1/models".to_string(),
            ],
            login_cmd: vec![], // No login needed, just start LM Studio
            logout_cmd: None,
            credential_files: None,
            status_check: StatusCheckMode::ExitCode, // Will fail if server not running
            auth_profile_id: "lmstudio-auth".to_string(),
            chat_profile_ids: vec!["lmstudio-acp".to_string(), "lmstudio-local".to_string()],
            models_cmd: None, // Uses API directly
        });

        // DISABLED: OpenRouter - no working ACP implementation yet
        // Groq, DeepSeek, Mistral also disabled for same reason

        // OpenAI (requires API key)
        self.register(ProviderAuthConfig {
            provider_id: "openai".to_string(),
            status_cmd: vec![
                "sh".to_string(),
                "-c".to_string(),
                "test -n \"$OPENAI_API_KEY\"".to_string(),
            ],
            login_cmd: vec![
                "echo".to_string(),
                "Set OPENAI_API_KEY environment variable".to_string(),
            ],
            logout_cmd: Some(vec![
                "sh".to_string(),
                "-c".to_string(),
                "unset OPENAI_API_KEY".to_string(),
            ]),
            credential_files: None,
            status_check: StatusCheckMode::ExitCode,
            auth_profile_id: "openai-auth".to_string(),
            chat_profile_ids: vec!["openai-acp".to_string()],
            models_cmd: None,
        });

        // DISABLED: Cohere - no working ACP implementation yet
        // self.register(ProviderAuthConfig {
        //     provider_id: "cohere".to_string(),
        //     ...
        // });

        // DISABLED: Together AI - no working ACP implementation yet
        // self.register(ProviderAuthConfig {
        //     provider_id: "together".to_string(),
        //     ...
        // });

        // DISABLED: Fireworks AI - no working ACP implementation yet
        // self.register(ProviderAuthConfig {
        //     provider_id: "fireworks".to_string(),
        //     ...
        // });

        // DISABLED: Perplexity - no working ACP implementation yet
        // self.register(ProviderAuthConfig {
        //     provider_id: "perplexity".to_string(),
        //     ...
        // });
        self.register(ProviderAuthConfig {
            provider_id: "perplexity".to_string(),
            status_cmd: vec![
                "sh".to_string(),
                "-c".to_string(),
                "test -n \"$PERPLEXITY_API_KEY\"".to_string(),
            ],
            login_cmd: vec![
                "echo".to_string(),
                "Set PERPLEXITY_API_KEY environment variable".to_string(),
            ],
            logout_cmd: Some(vec![
                "sh".to_string(),
                "-c".to_string(),
                "unset PERPLEXITY_API_KEY".to_string(),
            ]),
            credential_files: None,
            status_check: StatusCheckMode::ExitCode,
            auth_profile_id: "perplexity-auth".to_string(),
            chat_profile_ids: vec!["perplexity-acp".to_string()],
            models_cmd: None,
        });
    }

    pub fn register(&mut self, config: ProviderAuthConfig) {
        self.providers.insert(config.provider_id.clone(), config);
    }

    pub fn get(&self, provider_id: &str) -> Option<&ProviderAuthConfig> {
        self.providers.get(provider_id)
    }

    pub fn list_providers(&self) -> Vec<&ProviderAuthConfig> {
        self.providers.values().collect()
    }

    /// Check auth status for a provider
    pub async fn check_auth_status(&self, provider_id: &str) -> Result<AuthStatus> {
        let config = self
            .get(provider_id)
            .ok_or_else(|| anyhow!("Unknown provider: {}", provider_id))?;

        // Fast path: check credential files
        if let Some(files) = &config.credential_files {
            let mut any_exists = false;
            for path in files {
                let expanded = expand_tilde(path);
                if expanded.exists() {
                    any_exists = true;
                    break;
                }
            }
            if !any_exists {
                info!("[ProviderAuth] {}: No credential files found", provider_id);
                return Ok(AuthStatus::Missing);
            }
        }

        // Check if auth is not required
        if matches!(config.status_check, StatusCheckMode::NotRequired) {
            return Ok(AuthStatus::NotRequired);
        }

        // Run status command
        let status = run_status_check(&config.status_cmd, &config.status_check).await?;

        info!("[ProviderAuth] {}: Status = {:?}", provider_id, status);

        Ok(status)
    }

    /// Get auth profile ID for a provider
    pub fn get_auth_profile(&self, provider_id: &str) -> Option<String> {
        self.get(provider_id).map(|c| c.auth_profile_id.clone())
    }

    /// Get chat profile IDs for a provider
    pub fn get_chat_profiles(&self, provider_id: &str) -> Option<Vec<String>> {
        self.get(provider_id).map(|c| c.chat_profile_ids.clone())
    }
}

/// Run status check command and interpret result
async fn run_status_check(cmd: &[String], mode: &StatusCheckMode) -> Result<AuthStatus> {
    if cmd.is_empty() {
        return Ok(AuthStatus::Unknown);
    }

    let output = Command::new(&cmd[0]).args(&cmd[1..]).output().await?;

    match mode {
        StatusCheckMode::ExitCode => {
            if output.status.success() {
                Ok(AuthStatus::Ok)
            } else {
                Ok(AuthStatus::Missing)
            }
        }
        StatusCheckMode::StdoutContains(needle) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains(needle) {
                Ok(AuthStatus::Ok)
            } else {
                Ok(AuthStatus::Missing)
            }
        }
        StatusCheckMode::NotAuthenticatedIfContains(needle) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains(needle) {
                Ok(AuthStatus::Missing)
            } else {
                Ok(AuthStatus::Ok)
            }
        }
        StatusCheckMode::JsonField {
            field_path,
            expected,
        } => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            match serde_json::from_str::<serde_json::Value>(&stdout) {
                Ok(json) => {
                    let parts: Vec<&str> = field_path.split('.').collect();
                    let mut current = &json;
                    for part in parts {
                        current = match current.get(part) {
                            Some(v) => v,
                            None => return Ok(AuthStatus::Unknown),
                        };
                    }
                    if current.as_str() == Some(expected) {
                        Ok(AuthStatus::Ok)
                    } else {
                        Ok(AuthStatus::Missing)
                    }
                }
                Err(_) => Ok(AuthStatus::Unknown),
            }
        }
        StatusCheckMode::NotRequired => Ok(AuthStatus::NotRequired),
    }
}

/// Expand ~ to home directory
fn expand_tilde(path: &PathBuf) -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        let s = path.to_string_lossy();
        if s.starts_with("~/") {
            return PathBuf::from(home).join(&s[2..]);
        }
    }
    path.clone()
}

impl Default for ProviderAuthRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Model information for a runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeModel {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub capabilities: Vec<String>,
}

/// Response for model discovery endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub profile_id: String,
    pub authenticated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Vec<RuntimeModel>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model_id: Option<String>,
    /// If true, UI should allow freeform model ID entry
    pub allow_freeform: bool,
    /// Help text for freeform entry
    #[serde(skip_serializing_if = "Option::is_none")]
    pub freeform_hint: Option<String>,
}

impl ProviderAuthRegistry {
    /// Discover available models for a profile
    pub async fn discover_models(&self, profile_id: &str) -> anyhow::Result<ModelsResponse> {
        // Find which provider owns this profile
        let provider_config = self
            .providers
            .values()
            .find(|p| p.chat_profile_ids.contains(&profile_id.to_string()))
            .or_else(|| {
                self.providers
                    .values()
                    .find(|p| p.auth_profile_id == profile_id)
            });

        let provider_config = match provider_config {
            Some(c) => c,
            None => {
                return Ok(ModelsResponse {
                    profile_id: profile_id.to_string(),
                    authenticated: false,
                    models: None,
                    default_model_id: None,
                    allow_freeform: true,
                    freeform_hint: Some("Enter model ID (e.g., provider:model-name)".to_string()),
                });
            }
        };

        // Check auth status
        let auth_status = self.check_auth_status(&provider_config.provider_id).await?;
        let authenticated = auth_status.is_authenticated();

        // Try to list models if we have a models_cmd and are authenticated
        if authenticated {
            if let Some(models_cmd) = &provider_config.models_cmd {
                match self.execute_models_cmd(models_cmd).await {
                    Ok(models) => {
                        let default_model_id = models.first().map(|m| m.id.clone());
                        return Ok(ModelsResponse {
                            profile_id: profile_id.to_string(),
                            authenticated: true,
                            models: Some(models),
                            default_model_id,
                            allow_freeform: true,
                            freeform_hint: None,
                        });
                    }
                    Err(e) => {
                        tracing::warn!("Failed to list models for {}: {}", profile_id, e);
                    }
                }
            }
        }

        // Fallback: allow freeform with opaque model IDs
        // The runtime (OpenCode, Gemini, etc.) owns the model list, not the kernel
        Ok(ModelsResponse {
            profile_id: profile_id.to_string(),
            authenticated,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some(format!(
                "Enter {} model ID (opaque string from runtime)",
                provider_config.provider_id
            )),
        })
    }

    async fn execute_models_cmd(&self, cmd: &[String]) -> anyhow::Result<Vec<RuntimeModel>> {
        if cmd.is_empty() {
            return Err(anyhow!("Empty models command"));
        }

        let output = Command::new(&cmd[0]).args(&cmd[1..]).output().await?;

        if !output.status.success() {
            return Err(anyhow!(
                "Models command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        // Try to parse as JSON array of models
        match serde_json::from_str::<Vec<RuntimeModel>>(&stdout) {
            Ok(models) => Ok(models),
            Err(_) => {
                // Try to parse as simple array of strings
                match serde_json::from_str::<Vec<String>>(&stdout) {
                    Ok(ids) => Ok(ids
                        .into_iter()
                        .map(|id| RuntimeModel {
                            id: id.clone(),
                            label: id,
                            description: None,
                            capabilities: vec![],
                        })
                        .collect()),
                    Err(e) => Err(anyhow!("Failed to parse models output: {}", e)),
                }
            }
        }
    }
}

/// Model validation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateModelRequest {
    pub profile_id: String,
    pub model_id: String,
}

// ValidateModelResponse is defined in models.rs to avoid duplication
pub use super::models::ValidateModelResponse;

impl ProviderAuthRegistry {
    /// Validate a model ID with the runtime
    /// For now, this is a placeholder that does basic format validation
    /// In the future, this will query the runtime
    pub async fn validate_model(
        &self,
        provider_id: &str,
        _model_id: &str,
    ) -> anyhow::Result<ValidateModelResponse> {
        let config = self
            .get(provider_id)
            .ok_or_else(|| anyhow!("Unknown provider: {}", provider_id))?;

        // Check auth first
        let auth_status = self.check_auth_status(provider_id).await?;
        if !auth_status.is_authenticated() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some(format!(
                    "Provider {} is not authenticated. Run auth wizard first.",
                    provider_id
                )),
            });
        }

        // For now: accept any non-empty string as valid
        // Future: query runtime via ACP or CLI command
        if _model_id.trim().is_empty() {
            return Ok(ValidateModelResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some("Model ID cannot be empty".to_string()),
            });
        }

        // Model IDs are opaque - we don't parse them
        // The runtime will reject invalid IDs during session/prompt
        Ok(ValidateModelResponse {
            valid: true,
            model: None,
            suggested: None,
            message: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_status_is_authenticated() {
        assert!(AuthStatus::Ok.is_authenticated());
        assert!(AuthStatus::NotRequired.is_authenticated());
        assert!(!AuthStatus::Missing.is_authenticated());
        assert!(!AuthStatus::Expired.is_authenticated());
        assert!(!AuthStatus::Unknown.is_authenticated());
    }
}
