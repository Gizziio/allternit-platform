//! Unified configuration loader for the packaged Allternit Platform app.
//!
//! Configuration is layered so that company standards are baked in and users
//! only ever touch brain/provider settings:
//!
//!   1. Company config (`resources/company.json` in the app bundle, or
//!      `~/.allternit/company.json` for dev overrides).
//!   2. User config (`~/.allternit/config.json`) — created by the onboarding
//!      wizard and editable in settings.
//!   3. Environment variables — power-user override, kept for CI/dev.
//!
//! Any value present in a higher layer wins.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing::{info, warn};

/// Company-level configuration. These values are part of the packaged app and
/// should not be edited by end users. They standardize auth, endpoints, and
/// encryption across every host computer.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct CompanyConfig {
    /// Clerk publishable key rendered by the frontend.
    #[serde(rename = "clerkPublishableKey")]
    pub clerk_publishable_key: Option<String>,

    /// Clerk JWKS URL used by the API to verify JWT signatures.
    #[serde(rename = "clerkJwksUrl")]
    pub clerk_jwks_url: Option<String>,

    /// Expected Clerk JWT issuer (`iss`).
    #[serde(rename = "clerkIssuer")]
    pub clerk_issuer: Option<String>,

    /// Secret for verifying Clerk webhook signatures.
    #[serde(rename = "clerkWebhookSecret")]
    pub clerk_webhook_secret: Option<String>,

    /// Default URL the frontend should use to reach the API.
    #[serde(rename = "gatewayUrl")]
    pub gateway_url: Option<String>,

    /// Default URL the API should use to reach the Gizzi runtime.
    #[serde(rename = "terminalServerUrl")]
    pub terminal_server_url: Option<String>,

    /// Default encryption key for local-at-rest data.
    #[serde(rename = "encryptionKey")]
    pub encryption_key: Option<String>,

    /// Company branding / tenant marker.
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<String>,

    /// URL of the Rails service (ledger/gate/leases). Baked into packaged apps.
    #[serde(rename = "railsUrl")]
    pub rails_url: Option<String>,

    /// Rails workspace ID for this packaged deployment.
    #[serde(rename = "railsWorkspaceId")]
    pub rails_workspace_id: Option<String>,

    /// Default directory for VM storage. Baked into packaged apps.
    #[serde(rename = "vmDir")]
    pub vm_dir: Option<String>,

    /// URL of the cron daemon. Usually baked in; users can override.
    #[serde(rename = "cronDaemonUrl")]
    pub cron_daemon_url: Option<String>,
}

/// User-level configuration. Written by the onboarding wizard and the settings
/// UI. Contains only things an end user is expected to change: their brain,
/// their provider credentials, and optional local overrides.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct UserConfig {
    /// Default LLM provider/model, e.g. `kimi-for-coding/kimi-k2`.
    #[serde(rename = "defaultModel")]
    pub default_model: Option<String>,

    /// Optional override for the Gizzi runtime URL.
    #[serde(rename = "terminalServerUrl")]
    pub terminal_server_url: Option<String>,

    /// Optional override for the API gateway URL (frontend use).
    #[serde(rename = "gatewayUrl")]
    pub gateway_url: Option<String>,

    /// Provider API keys. In production these should be moved to the OS
    /// keychain; this field is a transitional store.
    #[serde(rename = "providerApiKeys")]
    pub provider_api_keys: Option<serde_json::Map<String, serde_json::Value>>,

    /// Whether onboarding has been completed.
    #[serde(rename = "onboardingComplete")]
    pub onboarding_complete: Option<bool>,

    /// Local Ollama base URL (e.g. http://localhost:11434).
    #[serde(rename = "ollamaUrl")]
    pub ollama_url: Option<String>,

    /// Allternit memory service URL.
    #[serde(rename = "memoryUrl")]
    pub memory_url: Option<String>,

    /// Embedding service URL.
    #[serde(rename = "embeddingUrl")]
    pub embedding_url: Option<String>,

    /// Agent working directory.
    #[serde(rename = "agentWorkdir")]
    pub agent_workdir: Option<String>,

    /// Cron daemon URL.
    #[serde(rename = "cronDaemonUrl")]
    pub cron_daemon_url: Option<String>,
}

/// Merged runtime configuration. Code reads from this struct instead of calling
/// `std::env::var` directly.
#[derive(Debug, Clone)]
pub struct AppConfig {
    pub company: CompanyConfig,
    pub user: UserConfig,
}

impl AppConfig {
    /// Load company + user config from disk and apply env overrides.
    /// If the user config has no default model but the Gizzi runtime config
    /// does, mirror it so the UI and API agree on which brain to use.
    pub fn load() -> Self {
        let company = load_company_config();
        let mut user = load_user_config();

        if user.default_model.is_none() {
            if let Some(model) = read_gizzi_default_model() {
                info!(model = %model, "Mirroring Gizzi default model into user config");
                user.default_model = Some(model);
            }
        }

        let mut config = Self { company, user };
        config.apply_env_overrides();
        config
    }

    /// Port the API server listens on.
    pub fn api_port(&self) -> u16 {
        std::env::var("ALLTERNIT_API_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8013)
    }

    /// URL the API uses to reach the Gizzi runtime.
    pub fn terminal_server_url(&self) -> String {
        std::env::var("TERMINAL_SERVER_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.terminal_server_url.clone())
            .or_else(|| self.company.terminal_server_url.clone())
            .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
    }

    /// Default LLM provider/model when a request does not specify one.
    pub fn default_model(&self) -> (String, String) {
        let raw = std::env::var("ALLTERNIT_DEFAULT_MODEL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.default_model.clone())
            .unwrap_or_else(|| "kimi-for-coding/kimi-k2".to_string());

        if let Some((provider, model)) = raw.split_once('/') {
            (provider.trim().to_string(), model.trim().to_string())
        } else {
            ("kimi-for-coding".to_string(), raw.trim().to_string())
        }
    }

    /// Clerk JWKS URL used to verify JWT signatures.
    pub fn clerk_jwks_url(&self) -> Option<String> {
        std::env::var("CLERK_JWKS_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.clerk_jwks_url.clone())
    }

    /// Expected Clerk JWT issuer.
    pub fn clerk_issuer(&self) -> Option<String> {
        std::env::var("CLERK_ISSUER")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.clerk_issuer.clone())
    }

    /// Clerk webhook secret.
    pub fn clerk_webhook_secret(&self) -> Option<String> {
        std::env::var("CLERK_WEBHOOK_SECRET")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.clerk_webhook_secret.clone())
    }

    /// Clerk publishable key rendered by the frontend.
    pub fn clerk_publishable_key(&self) -> Option<String> {
        std::env::var("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.clerk_publishable_key.clone())
    }

    /// Default encryption key for local data.
    pub fn encryption_key(&self) -> Option<String> {
        std::env::var("ENCRYPTION_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.encryption_key.clone())
    }

    /// Tenant identifier for this packaged deployment.
    pub fn tenant_id(&self) -> String {
        self.company
            .tenant_id
            .clone()
            .unwrap_or_else(|| "default".to_string())
    }

    /// URL the frontend should use to reach the API.
    pub fn gateway_url(&self) -> String {
        std::env::var("NEXT_PUBLIC_ALLTERNIT_GATEWAY_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.gateway_url.clone())
            .or_else(|| self.company.gateway_url.clone())
            .unwrap_or_else(|| "http://localhost:8013".to_string())
    }

    /// Whether onboarding has been completed.
    pub fn onboarding_complete(&self) -> bool {
        self.user.onboarding_complete.unwrap_or(false)
    }

    /// When true, requests originating from localhost without a Clerk token are
    /// accepted as a default local user. This is intended only for local
    /// development and packaged-app smoke tests; it is disabled by default.
    pub fn local_dev_bypass(&self) -> bool {
        std::env::var("ALLTERNIT_LOCAL_DEV_BYPASS")
            .ok()
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(false)
    }

    /// URL of the Rails service.
    pub fn rails_url(&self) -> String {
        std::env::var("ALLTERNIT_RAILS_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.rails_url.clone())
            .unwrap_or_else(|| "http://127.0.0.1:8080".to_string())
    }

    /// Rails workspace ID for this deployment.
    pub fn rails_workspace_id(&self) -> String {
        std::env::var("ALLTERNIT_RAILS_WORKSPACE_ID")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.rails_workspace_id.clone())
            .unwrap_or_else(|| "default".to_string())
    }

    /// Directory used for VM storage.
    pub fn vm_dir(&self) -> Option<PathBuf> {
        std::env::var("ALLTERNIT_VM_DIR")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.vm_dir.clone())
            .map(PathBuf::from)
    }

    /// Ollama base URL.
    pub fn ollama_url(&self) -> String {
        std::env::var("OLLAMA_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.ollama_url.clone())
            .unwrap_or_else(|| "http://localhost:11434".to_string())
    }

    /// Memory service URL.
    pub fn memory_url(&self) -> String {
        std::env::var("ALLTERNIT_MEMORY_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.memory_url.clone())
            .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
    }

    /// Embedding service URL.
    pub fn embedding_url(&self) -> String {
        std::env::var("ALLTERNIT_EMBEDDING_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.embedding_url.clone())
            .unwrap_or_else(|| self.ollama_url())
    }

    /// Agent working directory.
    pub fn agent_workdir(&self) -> Option<String> {
        std::env::var("ALLTERNIT_AGENT_WORKDIR")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.agent_workdir.clone())
    }

    /// Cron daemon URL.
    pub fn cron_daemon_url(&self) -> String {
        std::env::var("ALLTERNIT_CRON_DAEMON_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.cron_daemon_url.clone())
            .or_else(|| self.company.cron_daemon_url.clone())
            .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
    }

    /// Gizzi runtime port. Used when a full URL is not supplied.
    pub fn gizzi_port(&self) -> u16 {
        std::env::var("GIZZI_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(4096)
    }

    /// Apply env-variable overrides to the in-memory config. This keeps the
    /// existing dev/CI workflow working while the file-based config becomes
    /// the primary path for packaged users.
    fn apply_env_overrides(&mut self) {
        if let Ok(v) = std::env::var("ALLTERNIT_DEFAULT_MODEL") {
            if !v.is_empty() {
                self.user.default_model = Some(v);
            }
        }
        if let Ok(v) = std::env::var("TERMINAL_SERVER_URL") {
            if !v.is_empty() {
                self.user.terminal_server_url = Some(v);
            }
        }
        if let Ok(v) = std::env::var("OLLAMA_URL") {
            if !v.is_empty() {
                self.user.ollama_url = Some(v);
            }
        }
        if let Ok(v) = std::env::var("ALLTERNIT_MEMORY_URL") {
            if !v.is_empty() {
                self.user.memory_url = Some(v);
            }
        }
        if let Ok(v) = std::env::var("ALLTERNIT_EMBEDDING_URL") {
            if !v.is_empty() {
                self.user.embedding_url = Some(v);
            }
        }
        if let Ok(v) = std::env::var("ALLTERNIT_AGENT_WORKDIR") {
            if !v.is_empty() {
                self.user.agent_workdir = Some(v);
            }
        }
        if let Ok(v) = std::env::var("ALLTERNIT_CRON_DAEMON_URL") {
            if !v.is_empty() {
                self.user.cron_daemon_url = Some(v);
            }
        }
    }
}

fn load_company_config() -> CompanyConfig {
    let paths = company_config_paths();
    for path in &paths {
        if let Ok(text) = std::fs::read_to_string(path) {
            match serde_json::from_str::<CompanyConfig>(&text) {
                Ok(config) => {
                    info!(path = %path.display(), "Loaded company config");
                    return config;
                }
                Err(err) => {
                    warn!(path = %path.display(), error = %err, "Failed to parse company config");
                }
            }
        }
    }
    info!("No company config found; using defaults");
    CompanyConfig::default()
}

fn load_user_config() -> UserConfig {
    let path = user_config_path();
    if let Ok(text) = std::fs::read_to_string(&path) {
        match serde_json::from_str::<UserConfig>(&text) {
            Ok(config) => {
                info!(path = %path.display(), "Loaded user config");
                return config;
            }
            Err(err) => {
                warn!(path = %path.display(), error = %err, "Failed to parse user config");
            }
        }
    }
    info!(path = %path.display(), "No user config found; using defaults");
    UserConfig::default()
}

fn company_config_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // Packaged app bundle path (sibling to the binary).
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            paths.push(exe_dir.join("resources").join("company.json"));
            paths.push(exe_dir.join("company.json"));
        }
    }

    // Dev override in the user's home directory.
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".allternit").join("company.json"));
    }

    paths
}

fn user_config_path() -> PathBuf {
    dirs::data_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.join("allternit"))
        .unwrap_or_else(|| PathBuf::from(".allternit"))
        .join("config.json")
}

/// Persist user config to disk. Called by the onboarding wizard and settings UI.
pub fn save_user_config(config: &UserConfig) -> std::io::Result<()> {
    let path = user_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, text)?;
    info!(path = %path.display(), "Saved user config");
    Ok(())
}

/// API endpoint payload used by the onboarding wizard to save user config.
#[derive(Debug, Deserialize)]
pub struct SaveUserConfigPayload {
    #[serde(rename = "defaultModel")]
    pub default_model: Option<String>,
    #[serde(rename = "terminalServerUrl")]
    pub terminal_server_url: Option<String>,
    #[serde(rename = "gatewayUrl")]
    pub gateway_url: Option<String>,
    #[serde(rename = "providerApiKeys")]
    pub provider_api_keys: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(rename = "onboardingComplete")]
    pub onboarding_complete: Option<bool>,
    #[serde(rename = "ollamaUrl")]
    pub ollama_url: Option<String>,
    #[serde(rename = "memoryUrl")]
    pub memory_url: Option<String>,
    #[serde(rename = "embeddingUrl")]
    pub embedding_url: Option<String>,
    #[serde(rename = "agentWorkdir")]
    pub agent_workdir: Option<String>,
    #[serde(rename = "cronDaemonUrl")]
    pub cron_daemon_url: Option<String>,
}

impl From<SaveUserConfigPayload> for UserConfig {
    fn from(payload: SaveUserConfigPayload) -> Self {
        Self {
            default_model: payload.default_model,
            terminal_server_url: payload.terminal_server_url,
            gateway_url: payload.gateway_url,
            provider_api_keys: payload.provider_api_keys,
            onboarding_complete: payload.onboarding_complete,
            ollama_url: payload.ollama_url,
            memory_url: payload.memory_url,
            embedding_url: payload.embedding_url,
            agent_workdir: payload.agent_workdir,
            cron_daemon_url: payload.cron_daemon_url,
        }
    }
}

/// Best-effort read of the default model from the Gizzi runtime user config.
/// This lets the Allternit UI reflect a brain that was already configured
/// directly in Gizzi without requiring the user to re-run the wizard.
/// Falls back to the first provider/model entry when no explicit default is set.
fn read_gizzi_default_model() -> Option<String> {
    let path = gizzi_user_config_path();
    let text = std::fs::read_to_string(&path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;

    if let Some(model) = value.get("model").and_then(|v| v.as_str()) {
        return Some(model.to_string());
    }

    // Infer default from the first provider's first model.
    value.get("provider")?.as_object()?.iter().next().and_then(|(provider_id, provider)| {
        let model_id = provider
            .get("models")
            .and_then(|m| m.as_object())
            .and_then(|m| m.keys().next())
            .cloned()?;
        Some(format!("{}/{}", provider_id, model_id))
    })
}

fn gizzi_user_config_path() -> PathBuf {
    dirs::config_dir()
        .map(|p| p.join("gizzi").join("gizzi.json"))
        .unwrap_or_else(|| PathBuf::from(".config/gizzi/gizzi.json"))
}
