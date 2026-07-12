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
use crate::secrets;

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

    /// When true, the packaged app runs in self-hosted mode. Clerk JWT
    /// verification is skipped and the desktop bootstrap headers are trusted
    /// instead. This is for deployments where the app bundle is the authority
    /// and there is no external Clerk tenant.
    #[serde(rename = "selfHosted")]
    pub self_hosted: Option<bool>,
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

    /// First-start wizard tracking (OpenClaw-style versioning).
    #[serde(rename = "wizard")]
    pub wizard: Option<WizardState>,
}

/// Tracks when the first-start / env wizard last ran so the app can prompt
/// again after updates or when the wizard schema changes.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct WizardState {
    #[serde(rename = "lastRunAt")]
    pub last_run_at: Option<String>,
    #[serde(rename = "lastRunVersion")]
    pub last_run_version: Option<String>,
    #[serde(rename = "lastRunCommand")]
    pub last_run_command: Option<String>,
    #[serde(rename = "lastRunMode")]
    pub last_run_mode: Option<String>,
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
        // One-time migration: if a brain was saved to the legacy (wrong) gizzi
        // config path, copy it to the file the gizzi runtime actually reads so
        // a previously configured provider starts taking effect immediately.
        migrate_legacy_gizzi_config();

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
    /// Returns empty strings when nothing is configured so callers can fall back
    /// to the local Ollama brain instead of silently routing to an unconfigured
    /// provider.
    pub fn default_model(&self) -> (String, String) {
        let raw = std::env::var("ALLTERNIT_DEFAULT_MODEL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.default_model.clone())
            .unwrap_or_default();

        if let Some((provider, model)) = raw.split_once('/') {
            (provider.trim().to_string(), model.trim().to_string())
        } else {
            (String::new(), raw.trim().to_string())
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
    ///
    /// Resolution order matches `token_crypto`: env (`ENCRYPTION_KEY`) ->
    /// baked company config (empty by design) -> per-host OS keychain
    /// (`platform:encryption-key`). Nothing secret is baked into the package;
    /// the key is generated per machine on first onboarding.
    pub fn encryption_key(&self) -> Option<String> {
        std::env::var("ENCRYPTION_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.company.encryption_key.clone().filter(|s| !s.is_empty()))
            .or_else(|| crate::secrets::get_secret(crate::token_crypto::PLATFORM_KEY_ACCOUNT))
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

    /// When true, the app is running in self-hosted mode. Clerk is not required
    /// and the desktop bootstrap headers are trusted. Packaged apps can set this
    /// in company.json to avoid distributing Clerk keys.
    pub fn self_hosted(&self) -> bool {
        std::env::var("ALLTERNIT_SELF_HOSTED")
            .ok()
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or_else(|| self.company.self_hosted.unwrap_or(false))
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
    ///
    /// The gizzi-code terminal server exposes the cron API under `/cron`, so the
    /// default points at the local gizzi server (`http://127.0.0.1:4096/cron`).
    pub fn cron_daemon_url(&self) -> String {
        std::env::var("ALLTERNIT_CRON_DAEMON_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| self.user.cron_daemon_url.clone())
            .or_else(|| self.company.cron_daemon_url.clone())
            .unwrap_or_else(|| "http://127.0.0.1:4096/cron".to_string())
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
                    info!(path = %path.display(), ?config, "Loaded company config");
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

    // Packaged app bundle paths.
    // macOS .app: Contents/MacOS/<binary> -> Contents/Resources/company.json
    // Generic layout: <binary_dir>/resources/company.json or <binary_dir>/company.json
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            paths.push(exe_dir.join("resources").join("company.json"));
            paths.push(exe_dir.join("company.json"));
            if let Some(bundle_dir) = exe_dir.parent() {
                paths.push(bundle_dir.join("Resources").join("company.json"));
                paths.push(bundle_dir.join("resources").join("company.json"));
            }
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
    #[serde(rename = "wizard")]
    pub wizard: Option<WizardState>,
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
            wizard: payload.wizard,
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

/// Convenience builder that looks up a provider by id from the Gizzi runtime
/// config and builds its harness (injecting any stored API key for subprocess
/// providers).
pub fn build_gizzi_harness_for_provider(provider_id: &str) -> Option<serde_json::Value> {
    let path = gizzi_user_config_path();
    let text = std::fs::read_to_string(&path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    let provider = value.get("provider")?.as_object()?.get(provider_id)?;
    build_gizzi_harness(provider_id, provider)
}

/// Best-effort build of a Gizzi harness for a provider configured in the Gizzi
/// runtime user config. Injects API keys from the OS keychain for subprocess
/// providers so CLI brains (Claude CLI, etc.) authenticate without writing
/// secrets to disk.
pub fn build_gizzi_harness(provider_id: &str, provider: &serde_json::Value) -> Option<serde_json::Value> {
    let provider = provider.as_object()?;

    // Subprocess provider (e.g. claude-cli, custom local scripts).
    if let Some(cmd) = provider.get("subprocess_cmd").and_then(|v| v.as_str()) {
        let mut harness = serde_json::json!({
            "mode": "subprocess",
            "subprocess": { "command": cmd, "env": {} }
        });
        inject_subprocess_api_key(provider_id, &mut harness);
        return Some(harness);
    }

    // Local/OpenAI-compatible provider (e.g. Ollama).
    if let Some(base_url) = provider
        .get("options")
        .and_then(|o| o.get("baseURL"))
        .and_then(|v| v.as_str())
    {
        return Some(serde_json::json!({
            "mode": "local",
            "local": { "baseURL": base_url }
        }));
    }

    // BYOK cloud-style providers with an explicit baseURL / auth_type.
    if provider.get("auth_type").and_then(|v| v.as_str()) == Some("api_key") {
        let base_url = provider
            .get("baseURL")
            .or_else(|| provider.get("options").and_then(|o| o.get("baseURL")))
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        return Some(serde_json::json!({
            "mode": "byok",
            "byok": {
                "baseURLs": { provider_id: base_url },
                "keys": {}
            }
        }));
    }

    None
}

/// Inject the provider API key (stored in the OS keychain) into a subprocess
/// harness's env. The env variable name is inferred from the provider id:
///   - providers whose id contains "claude" -> ANTHROPIC_API_KEY
/// Everything else falls back to a generic LLM_API_KEY so the subprocess can
/// pick it up if it supports one.
fn inject_subprocess_api_key(provider_id: &str, harness: &mut serde_json::Value) {
    let env_name = if provider_id.to_lowercase().contains("claude") {
        "ANTHROPIC_API_KEY"
    } else {
        "LLM_API_KEY"
    };

    match secrets::get_secret(&secrets::provider_account(provider_id)) {
        Some(key) if !key.is_empty() => {
            if let Some(subprocess) = harness.get_mut("subprocess").and_then(|v| v.as_object_mut()) {
                let env = subprocess
                    .entry("env")
                    .or_insert_with(|| serde_json::json!({}))
                    .as_object_mut()
                    .unwrap();
                env.insert(env_name.to_string(), serde_json::json!(key));
                info!(provider = %provider_id, env = %env_name, "Injected API key into subprocess harness env");
            }
        }
        Some(_) => {
            // Key exists but is empty — nothing to inject.
        }
        None => {
            warn!(provider = %provider_id, "No API key found in keychain for subprocess provider");
        }
    }
}

/// Best-effort build of a Gizzi harness for the default model configured in
/// the Gizzi runtime user config. This lets the Allternit API create sessions
/// that route through the user's chosen brain (subprocess, local, or BYOK)
/// without requiring an agent record in the platform DB.
pub fn read_gizzi_default_harness() -> Option<serde_json::Value> {
    let path = gizzi_user_config_path();
    let text = std::fs::read_to_string(&path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;

    let provider_id = value
        .get("model")
        .and_then(|v| v.as_str())
        .and_then(|m| m.split_once('/').map(|(p, _)| p.to_string()))?;

    let provider = value.get("provider")?.as_object()?.get(&provider_id)?.clone();
    build_gizzi_harness(&provider_id, &provider)
}

/// Path to the gizzi-code global config file that the runtime actually reads.
///
/// This MUST mirror gizzi-code's own resolution:
///   - config dir = `Global.Path.config` = xdg-basedir config + `"gizzi-code"`
///     (`src/runtime/context/global/paths.ts`)
///   - filename   = `config.json` (`src/cli/commands/provider.ts`)
///
/// Previously this resolved to `<dirs::config_dir>/gizzi/gizzi.json`, which on
/// macOS is `~/Library/Application Support/gizzi/gizzi.json` — a file the gizzi
/// runtime never opens. That is why "add a brain instead of kimi" silently did
/// nothing in packaged builds: the wizard wrote the provider to the wrong file
/// and `read_gizzi_default_harness` read it back from the same wrong place, so
/// every session kept falling back to the built-in default.
///
/// Precedence: `GIZZI_CONFIG_HOME` (dir) > `XDG_CONFIG_HOME` > platform default
/// (`~/.config` on macOS/Linux to match xdg-basedir, `%APPDATA%` on Windows).
pub(crate) fn gizzi_user_config_path() -> PathBuf {
    if let Ok(dir) = std::env::var("GIZZI_CONFIG_HOME") {
        if !dir.is_empty() {
            return PathBuf::from(dir).join("config.json");
        }
    }
    let base = std::env::var("XDG_CONFIG_HOME")
        .ok()
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            if cfg!(windows) {
                std::env::var("APPDATA").ok().map(PathBuf::from)
            } else {
                dirs::home_dir().map(|h| h.join(".config"))
            }
        })
        .unwrap_or_else(|| PathBuf::from(".config"));
    base.join("gizzi-code").join("config.json")
}

/// One-time migration from the legacy gizzi config paths the API used to write
/// (`<dirs::config_dir>/gizzi/gizzi.json`, and the xdg-style
/// `~/.config/gizzi/{gizzi,config}.json` leftovers) into the file the gizzi-code
/// runtime actually reads: `<xdg-config>/gizzi-code/config.json`.
///
/// Best-effort and idempotent: if the target already exists, or no legacy file
/// is present, it does nothing. When several legacy files exist, the richest
/// (most configured providers) wins so a thin auto-generated file never shadows
/// the user's real brain set. Legacy files are copied (never deleted) so the
/// operation is reversible.
fn migrate_legacy_gizzi_config() {
    let target = gizzi_user_config_path();
    if target.exists() {
        return;
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    // Where the old API wrote on each platform (macOS: ~/Library/Application Support).
    if let Some(dir) = dirs::config_dir() {
        candidates.push(dir.join("gizzi").join("gizzi.json"));
    }
    // xdg-style leftovers observed in the wild.
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".config").join("gizzi").join("gizzi.json"));
        candidates.push(home.join(".config").join("gizzi").join("config.json"));
    }

    let provider_count = |path: &PathBuf| -> usize {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
            .and_then(|v| v.get("provider").and_then(|p| p.as_object()).map(|o| o.len()))
            .unwrap_or(0)
    };

    let Some(source) = candidates
        .into_iter()
        .filter(|p| p.is_file())
        .max_by_key(|p| provider_count(p))
    else {
        return;
    };

    if provider_count(&source) == 0 {
        return;
    }

    if let Some(parent) = target.parent() {
        if let Err(err) = std::fs::create_dir_all(parent) {
            warn!(error = %err, path = %parent.display(), "Failed to create gizzi config dir for migration");
            return;
        }
    }

    match std::fs::copy(&source, &target) {
        Ok(bytes) => info!(from = %source.display(), to = %target.display(), bytes, "Migrated legacy gizzi brain config"),
        Err(err) => warn!(error = %err, from = %source.display(), to = %target.display(), "Failed to migrate legacy gizzi brain config"),
    }
}
