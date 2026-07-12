
//! Provider API routes — LLM provider discovery and management.

use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;
use crate::config::gizzi_user_config_path;
use crate::secrets;

fn unauthorized() -> axum::response::Response {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))).into_response()
}

fn db_error(e: impl std::fmt::Display) -> axum::response::Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "Database error", "details": e.to_string()})),
    )
        .into_response()
}

pub fn provider_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/providers", get(list_providers))
        .route("/providers/:id", get(get_provider))
        .route("/providers/:id/auth/status", get(get_provider_auth_status))
        .route("/providers/:id/models", get(discover_provider_models))
        .route("/providers/:id/connect", post(connect_provider))
        .route("/providers/:id/connect/status", get(connect_provider_status))
        .route("/providers/:id/connect/confirm", post(confirm_provider_connect))
        .route("/providers/auth/status", get(list_provider_auth_status))
        .route("/provider/ollama/status", get(ollama_live_status))
        .route("/provider/ollama/models", get(list_ollama_models))
}

/// Probe Ollama live on the blocking thread pool and return the live status.
async fn ollama_live_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let url = state.config.ollama_url();
    let probe = tokio::task::spawn_blocking(move || {
        let client = match reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(4))
            .build()
        {
            Ok(c) => c,
            Err(_) => return (false, Vec::<String>::new()),
        };
        let probe = client
            .get(format!("{}/api/tags", url.trim_end_matches('/')))
            .send();
        match probe {
            Ok(res) if res.status().is_success() => {
                let models = res
                    .json::<serde_json::Value>()
                    .ok()
                    .and_then(|b| b.get("models").and_then(|m| m.as_array()).cloned())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| m.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                (true, models)
            }
            _ => (false, vec![]),
        }
    })
    .await;

    match probe {
        Ok((running, models)) => Json(json!({
            "running": running,
            "models": models,
        }))
        .into_response(),
        Err(_) => Json(json!({ "running": false, "models": Vec::<String>::new() })).into_response(),
    }
}

/// Probe a local OpenAI-compatible brain (Ollama/LM Studio) for reachability and
/// its installed models. Cheap local GET with a short timeout; never throws.
async fn probe_local_brain(url: &str) -> (bool, Vec<String>) {
    let url = url.trim_end_matches('/').to_string();
    tokio::task::spawn_blocking(move || {
        let client = match reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(4))
            .build()
        {
            Ok(c) => c,
            Err(_) => return (false, Vec::<String>::new()),
        };
        match client.get(format!("{}/api/tags", url)).send() {
            Ok(res) if res.status().is_success() => {
                let models = res
                    .json::<serde_json::Value>()
                    .ok()
                    .and_then(|b| b.get("models").and_then(|m| m.as_array()).cloned())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| m.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                (true, models)
            }
            _ => (false, vec![]),
        }
    })
    .await
    .unwrap_or((false, vec![]))
}

// ─── Data models ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct ProviderRow {
    id: String,
    name: String,
    provider_type: String,
    base_url: Option<String>,
    api_key_set: bool,
    models: Vec<String>,
    status: String,
}

#[derive(Serialize)]
struct ProviderAuthStatusRow {
    provider_id: String,
    status: String,
    authenticated: bool,
    auth_required: bool,
    auth_profile_id: Option<String>,
    chat_profile_ids: Vec<String>,
    details: Option<serde_json::Value>,
}

fn compute_provider_status(provider_type: &str, api_key_env_var: Option<&str>) -> String {
    let key_set = api_key_env_var.map_or(false, |var| std::env::var(var).is_ok());
    if key_set {
        "active".to_string()
    } else if provider_type == "local" {
        "unknown".to_string()
    } else {
        "unconfigured".to_string()
    }
}

/// Best-effort check of whether a command exists on PATH.
pub(crate) fn command_on_path(cmd: &str) -> Option<std::path::PathBuf> {
    let path_env = std::env::var("PATH").unwrap_or_default();
    for dir in path_env.split(':') {
        let candidate = std::path::Path::new(dir).join(cmd);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// Read providers that the user has configured through the Gizzi runtime config
/// (the same file the chat harness reads). This keeps the UI in sync with
/// whatever brain the runtime will actually use.
fn read_gizzi_providers() -> Vec<ProviderRow> {
    let path = gizzi_user_config_path();
    let text = match std::fs::read_to_string(&path) {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };
    let value: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let providers = match value.get("provider").and_then(|v| v.as_object()) {
        Some(p) => p,
        None => return Vec::new(),
    };

    providers
        .iter()
        .map(|(id, config)| {
            let name = config
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(id)
                .to_string();
            let auth_type = config
                .get("auth_type")
                .and_then(|v| v.as_str())
                .unwrap_or("api_key");
            let provider_type = if config.get("subprocess_cmd").is_some() || auth_type == "subprocess" {
                "subprocess"
            } else if config.get("options").and_then(|o| o.get("baseURL")).is_some()
                || auth_type == "local"
            {
                "local"
            } else {
                "api"
            }
            .to_string();

            let base_url = config
                .get("options")
                .and_then(|o| o.get("baseURL"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let models: Vec<String> = config
                .get("models")
                .and_then(|m| m.as_object())
                .map(|m| m.keys().map(|k| k.to_string()).collect())
                .unwrap_or_default();

            let api_key_set = if provider_type == "subprocess" {
                // Subprocess brains authenticate via a key stored in the keychain.
                secrets::get_secret(&secrets::provider_account(id))
                    .map(|k| !k.is_empty())
                    .unwrap_or(false)
            } else {
                // BYOK / API providers typically use an env var or keychain secret.
                let env_var = format!("{}_API_KEY", id.to_uppercase().replace('-', "_"));
                std::env::var(&env_var).is_ok()
                    || secrets::get_secret(&secrets::provider_account(id))
                        .map(|k| !k.is_empty())
                        .unwrap_or(false)
            };

            let status = if provider_type == "subprocess" {
                if let Some(cmd) = config.get("subprocess_cmd").and_then(|v| v.as_str()) {
                    let program = cmd.split_whitespace().next().unwrap_or(cmd);
                    if command_on_path(program).is_some() {
                        if api_key_set { "active".to_string() } else { "missing_key".to_string() }
                    } else {
                        "offline".to_string()
                    }
                } else {
                    "unconfigured".to_string()
                }
            } else if provider_type == "local" {
                "unknown".to_string()
            } else if api_key_set {
                "active".to_string()
            } else {
                "unconfigured".to_string()
            };

            ProviderRow {
                id: id.clone(),
                name,
                provider_type,
                base_url,
                api_key_set,
                models,
                status,
            }
        })
        .collect()
}

/// Providers that are automatically registered when their API key env var is
/// present. This lets users add a brain by setting a single env var and having
/// it route through the Gizzi harness without touching a database.
fn env_provider_rows() -> Vec<ProviderRow> {
    const ENV_PROVIDERS: &[(&str, &str, &str, &[&str])] = &[
        ("openai", "OpenAI", "OPENAI_API_KEY", &["gpt-5-mini", "gpt-5-nano", "gpt-4o", "dall-e-3"]),
        ("anthropic", "Anthropic", "ANTHROPIC_API_KEY", &["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-6"]),
        ("google", "Google AI", "GOOGLE_GENERATIVE_AI_API_KEY", &["gemini-2.5-flash-lite", "gemini-2.5-pro"]),
        ("alibaba", "Alibaba", "ALIBABA_API_KEY", &["qwen-3"]),
        ("amazon-bedrock", "Amazon Bedrock", "AWS_SECRET_ACCESS_KEY", &["nova-pro"]),
        ("groq", "Groq", "GROQ_API_KEY", &["llama-3-70b"]),
        ("mistral", "Mistral", "MISTRAL_API_KEY", &["mistral-large"]),
        ("cohere", "Cohere", "COHERE_API_KEY", &["command-r-plus"]),
        ("deepseek", "DeepSeek", "DEEPSEEK_API_KEY", &["deepseek-chat"]),
        ("xai", "xAI", "XAI_API_KEY", &["grok-3"]),
        ("togetherai", "Together AI", "TOGETHER_API_KEY", &["llama-3-70b"]),
        ("perplexity", "Perplexity", "PERPLEXITY_API_KEY", &["sonar-pro"]),
    ];

    ENV_PROVIDERS
        .iter()
        .map(|(id, name, env_var, models)| {
            let key_set = std::env::var(env_var).is_ok();
            ProviderRow {
                id: id.to_string(),
                name: name.to_string(),
                provider_type: "api".to_string(),
                base_url: None,
                api_key_set: key_set,
                models: models.iter().map(|m| m.to_string()).collect(),
                status: if key_set { "active".to_string() } else { "unconfigured".to_string() },
            }
        })
        .collect()
}

/// A virtual provider entry for Ollama. The frontend probes Ollama's actual
/// availability via the dedicated `/api/local-brain` endpoint, so this entry is
/// just a static marker that the local brain exists in the provider list.
fn ollama_provider_row(ollama_url: String) -> ProviderRow {
    ProviderRow {
        id: "ollama".to_string(),
        name: "Ollama".to_string(),
        provider_type: "local".to_string(),
        base_url: Some(ollama_url),
        api_key_set: false,
        models: vec![],
        status: "ready".to_string(),
    }
}

/// Virtual providers for common CLI subprocess brains. Status reflects whether
/// the binary is present on PATH; key state is checked from the keychain.
fn subprocess_provider_rows() -> Vec<ProviderRow> {
    let mut rows = Vec::new();

    // CLI/subprocess brains authenticated via subscription OAuth (the CLI holds
    // the token itself) or, for Claude/Codex, a stored API key. We reuse the same
    // detection as the one-click connect flow so the merged status never reports a
    // signed-in CLI as "missing key" (root-cause correctness, not a fallback).
    // IDs and default models must match what the gizzi runtime actually registers
    // (cmd/gizzi-code src/runtime/providers/discovery/subprocess.ts), otherwise a
    // platform-created agent with the default model fails to resolve in gizzi.
    let cli = [
        ("claude-cli", "Claude CLI", "claude", "claude-sonnet-4-6"),
        ("codex-cli", "Codex CLI", "codex", "codex-mini-latest"),
        ("qwen-cli", "Qwen CLI", "qwen", "qwen-plus"),
        ("kimi-cli", "Kimi CLI", "kimi", "kimi-k2"),
        ("antigravity", "Antigravity", "agy", "antigravity"),
    ];
    for (id, name, binary, model) in cli {
        let available = command_on_path(binary).is_some();
        let authed = subscription_auth_check(id, binary)
            || secrets::get_secret(&secrets::provider_account(id))
                .map(|k| !k.is_empty())
                .unwrap_or(false)
            || (id == "codex-cli" && std::env::var("OPENAI_API_KEY").is_ok());
        rows.push(ProviderRow {
            id: id.to_string(),
            name: name.to_string(),
            provider_type: "subprocess".to_string(),
            base_url: None,
            api_key_set: authed,
            models: vec![model.to_string()],
            status: if available {
                if authed { "active" } else { "missing_key" }
            } else {
                "offline"
            }
            .to_string(),
        });
    }

    // Z.ai (GLM Coding Plan) is API-key based — no public OAuth yet.
    let zai_authed = subscription_auth_check("zai", "zai");
    rows.push(ProviderRow {
        id: "zai".to_string(),
        name: "Z.ai".to_string(),
        provider_type: "api".to_string(),
        base_url: Some("https://api.z.ai/api/coding/paas/v4".to_string()),
        api_key_set: zai_authed,
        models: vec!["glm-4.6".to_string()],
        status: if zai_authed { "active" } else { "missing_key" }.to_string(),
    });

    rows
}

fn row_to_provider(row: &rusqlite::Row) -> Result<ProviderRow, rusqlite::Error> {
    let id: String = row.get(0)?;
    let name: String = row.get(1)?;
    let provider_type: String = row.get(2)?;
    let base_url: Option<String> = row.get(3)?;
    let api_key_env_var: Option<String> = row.get(4)?;
    let models_json: Option<String> = row.get(5)?;

    let models: Vec<String> = models_json
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let api_key_set = api_key_env_var.as_deref().map_or(false, |var| std::env::var(var).is_ok());
    let status = compute_provider_status(&provider_type, api_key_env_var.as_deref());

    Ok(ProviderRow {
        id,
        name,
        provider_type,
        base_url,
        api_key_set,
        models,
        status,
    })
}

/// Merge multiple provider sources. Later sources override earlier ones by ID.
fn merge_provider_sources(sources: Vec<Vec<ProviderRow>>) -> Vec<ProviderRow> {
    let mut map = std::collections::HashMap::new();
    for source in sources {
        for row in source {
            // Merge model lists when overriding so we don't drop statically-known models.
            map.entry(row.id.clone())
                .and_modify(|existing: &mut ProviderRow| {
                    existing.name = row.name.clone();
                    existing.provider_type = row.provider_type.clone();
                    if row.base_url.is_some() {
                        existing.base_url = row.base_url.clone();
                    }
                    if row.api_key_set {
                        existing.api_key_set = true;
                    }
                    let mut merged_models: std::collections::HashSet<String> =
                        existing.models.iter().cloned().collect();
                    merged_models.extend(row.models.iter().cloned());
                    existing.models = merged_models.into_iter().collect();
                    // Keep the most optimistic status.
                    if row.status == "active" || existing.status == "unconfigured" {
                        existing.status = row.status.clone();
                    }
                })
                .or_insert(row);
        }
    }
    map.into_values().collect()
}

// ─── List providers ───────────────────────────────────────────────────────────

async fn list_providers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    // Scoped so the !Send rusqlite handles drop before any `.await` below.
    let db_providers: Vec<ProviderRow> = {
        let conn = match state.db.connect() {
            Ok(c) => c,
            Err(e) => return db_error(e),
        };
        let mut stmt = match conn.prepare(
            "SELECT id, name, provider_type, base_url, api_key_env_var, models FROM providers ORDER BY name"
        ) {
            Ok(s) => s,
            Err(e) => return db_error(e),
        };
        let rows = match stmt.query_map([], row_to_provider) {
            Ok(r) => r,
            Err(e) => return db_error(e),
        };
        match rows.collect::<Result<Vec<_>, _>>() {
            Ok(p) => p,
            Err(e) => return db_error(e),
        }
    };

    let ollama_row = ollama_provider_row(state.config.ollama_url());

    let mut providers = merge_provider_sources(vec![
        db_providers,
        env_provider_rows(),
        read_gizzi_providers(),
        subprocess_provider_rows(),
        vec![ollama_row],
    ]);

    // Tell the truth about local brains: probe reachability instead of reporting
    // the static "unknown" marker. Only hits local providers (Ollama/LM Studio).
    for p in providers.iter_mut() {
        if p.provider_type == "local" {
            if let Some(url) = p.base_url.clone() {
                let (running, models) = probe_local_brain(&url).await;
                p.status = if running { "active".to_string() } else { "offline".to_string() };
                if running && p.models.is_empty() {
                    p.models = models;
                }
            }
        }
    }

    Json(json!({ "providers": providers, "all": providers })).into_response()
}

// ─── Get provider ─────────────────────────────────────────────────────────────

async fn get_provider(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    // Try DB first, then fall back to merged virtual providers.
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };

    let db_provider: Option<ProviderRow> = match conn.query_row(
        "SELECT id, name, provider_type, base_url, api_key_env_var, models FROM providers WHERE id = ?1",
        rusqlite::params![id],
        row_to_provider,
    ) {
        Ok(p) => Some(p),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return db_error(e),
    };

    let provider = if let Some(p) = db_provider {
        p
    } else {
        let ollama_row = ollama_provider_row(state.config.ollama_url());
        let all = merge_provider_sources(vec![
            env_provider_rows(),
            read_gizzi_providers(),
            subprocess_provider_rows(),
            vec![ollama_row],
        ]);
        match all.into_iter().find(|p| p.id == id) {
            Some(p) => p,
            None => return (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response(),
        }
    };

    Json(json!({ "provider": provider })).into_response()
}

// ─── List Ollama models ───────────────────────────────────────────────────────

#[derive(Serialize)]
struct OllamaModel {
    name: String,
    size: Option<u64>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
    digest: Option<String>,
    modified_at: Option<String>,
}

async fn list_ollama_models(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let ollama_url = state.config.ollama_url();

    let client = reqwest::Client::new();
    match client
        .get(format!("{}/api/tags", ollama_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(res) => {
            if let Ok(body) = res.json::<serde_json::Value>().await {
                // Ollama returns { models: [...] }
                let models: Vec<OllamaModel> = body
                    .get("models")
                    .and_then(|m| m.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| {
                                Some(OllamaModel {
                                    name: m.get("name")?.as_str()?.to_string(),
                                    size: m.get("size").and_then(|v| v.as_u64()),
                                    parameter_size: m.get("details")
                                        .and_then(|d| d.get("parameter_size"))
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    quantization_level: m.get("details")
                                        .and_then(|d| d.get("quantization_level"))
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    digest: m.get("digest").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                    modified_at: m.get("modified_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                Json(json!({ "models": models })).into_response()
            } else {
                Json(json!({"models": [], "note": "Failed to parse Ollama response"})).into_response()
            }
        }
        Err(e) => {
            warn!("Ollama discovery failed: {}", e);
            Json(json!({
                "models": [],
                "note": "Ollama not reachable",
                "url": ollama_url,
            }))
            .into_response()
        }
    }
}

// ─── Provider authentication status ───────────────────────────────────────────

// Single API-side source of truth for provider capabilities + limits.
// The Gizzi runtime keeps its own models.dev registry for actual routing; this
// is what the platform UI consumes via /api/v1/providers/* so the frontend and
// any future fallback logic read from one place instead of scattered constants.
fn provider_capabilities(id: &str) -> serde_json::Value {
    let (tool_call, vision, context, output, default_model): (bool, bool, u64, u64, &str) = match id {
        "anthropic" => (true, true, 200_000, 32_000, "claude-sonnet-4-5"),
        "openai" => (true, true, 128_000, 16_384, "gpt-4o"),
        "google" => (true, true, 1_000_000, 65_536, "gemini-2.5-pro"),
        "ollama" | "lmstudio" => (true, false, 128_000, 16_384, "llama3.2:3b"),
        "claude-cli" => (true, true, 200_000, 32_000, "claude-sonnet-4"),
        "codex-cli" => (true, false, 128_000, 16_384, "gpt-4o"),
        "qwen" => (true, false, 128_000, 16_384, "qwen3-coder-plus"),
        "kimi" => (true, false, 128_000, 16_384, "kimi-k2"),
        "antigravity" | "agy" => (true, true, 1_000_000, 65_536, "gemini-2.5-pro"),
        "zai" | "z.ai" | "glm" => (true, false, 200_000, 16_384, "glm-4.6"),
        _ => (true, false, 128_000, 16_384, ""),
    };
    json!({
        "tool_call": tool_call,
        "vision": vision,
        "limits": { "context": context, "output": output },
        "default_model": default_model,
    })
}

fn auth_status_from_row(row: &ProviderRow) -> ProviderAuthStatusRow {
    let is_local = row.provider_type == "local";
    let is_subprocess = row.provider_type == "subprocess";
    let auth_required = !is_local;

    let status = match row.status.as_str() {
        "active" => "ok",
        "missing_key" => "missing",
        "offline" => "unknown",
        "ready_no_models" => "not_required",
        _ if is_local => "not_required",
        _ if row.api_key_set => "ok",
        _ => "missing",
    }
    .to_string();

    let authenticated = status == "ok" || status == "not_required";

    ProviderAuthStatusRow {
        provider_id: row.id.clone(),
        status,
        authenticated,
        auth_required,
        auth_profile_id: auth_required.then(|| format!("{}-auth", row.id)),
        chat_profile_ids: if is_local || is_subprocess || row.api_key_set {
            vec![format!("{}-default", row.id)]
        } else {
            Vec::new()
        },
        details: Some(json!({
            "provider_type": row.provider_type,
            "base_url": row.base_url,
            "api_key_set": row.api_key_set,
            "model_count": row.models.len(),
            "capabilities": provider_capabilities(&row.id),
        })),
    }
}

async fn list_provider_auth_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };

    let mut stmt = match conn.prepare(
        "SELECT id, name, provider_type, base_url, api_key_env_var, models FROM providers ORDER BY name"
    ) {
        Ok(s) => s,
        Err(e) => return db_error(e),
    };

    let rows = match stmt.query_map([], row_to_provider) {
        Ok(r) => r,
        Err(e) => return db_error(e),
    };

    let db_providers: Vec<ProviderRow> = match rows.collect::<Result<Vec<_>, _>>() {
        Ok(p) => p,
        Err(e) => return db_error(e),
    };

    let all = merge_provider_sources(vec![
        db_providers,
        env_provider_rows(),
        read_gizzi_providers(),
        subprocess_provider_rows(),
        vec![ollama_provider_row(state.config.ollama_url())],
    ]);

    let providers: Vec<ProviderAuthStatusRow> = all.iter().map(auth_status_from_row).collect();

    Json(json!({ "providers": providers })).into_response()
}

async fn get_provider_auth_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };

    let db_provider: Option<ProviderRow> = match conn.query_row(
        "SELECT id, name, provider_type, base_url, api_key_env_var, models FROM providers WHERE id = ?1",
        rusqlite::params![id],
        row_to_provider,
    ) {
        Ok(p) => Some(p),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return db_error(e),
    };

    let provider = if let Some(p) = db_provider {
        p
    } else {
        let ollama_row = ollama_provider_row(state.config.ollama_url());
        let all = merge_provider_sources(vec![
            env_provider_rows(),
            read_gizzi_providers(),
            subprocess_provider_rows(),
            vec![ollama_row],
        ]);
        match all.into_iter().find(|p| p.id == id) {
            Some(p) => p,
            None => return (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response(),
        }
    };

    Json(json!({ "provider": auth_status_from_row(&provider) })).into_response()
}

// ─── Discover provider models ─────────────────────────────────────────────────

async fn discover_provider_models(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    if id == "ollama" {
        return list_ollama_models(State(state), Extension(_user), headers).await.into_response();
    }

    // For env-driven API providers, return the static model list.
    let env = env_provider_rows();
    if let Some(row) = env.into_iter().find(|p| p.id == id) {
        return Json(json!({
            "supported": true,
            "models": row.models.iter().map(|m| json!({ "id": m, "name": m })).collect::<Vec<_>>(),
            "default_model_id": row.models.first(),
            "allow_freeform": true,
        }))
        .into_response();
    }

    // For Gizzi-configured providers, return the configured models.
    let gizzi = read_gizzi_providers();
    if let Some(row) = gizzi.into_iter().find(|p| p.id == id) {
        return Json(json!({
            "supported": true,
            "models": row.models.iter().map(|m| json!({ "id": m, "name": m })).collect::<Vec<_>>(),
            "default_model_id": row.models.first(),
            "allow_freeform": true,
        }))
        .into_response();
    }

    // For subprocess providers, the runtime owns model discovery.
    let subprocess = subprocess_provider_rows();
    if let Some(row) = subprocess.into_iter().find(|p| p.id == id) {
        return Json(json!({
            "supported": false,
            "models": row.models.iter().map(|m| json!({ "id": m, "name": m })).collect::<Vec<_>>(),
            "allow_freeform": true,
            "freeform_hint": "Subprocess brains choose models internally; pass any model string the CLI supports.",
        }))
        .into_response();
    }

    Json(json!({
        "supported": false,
        "models": [],
        "allow_freeform": true,
        "freeform_hint": "Provider not recognized.",
    }))
    .into_response()
}

// ─── Subscription (OAuth) connect ─────────────────────────────────────────────
//
// One-click "Connect" for subscription-based CLI providers (Claude, Codex, Qwen,
// Kimi, Antigravity) plus API-key-only Z.ai. The connect endpoint triggers the
// provider's own sign-in flow (browser OAuth or a console page); the status
// endpoint reports whether sign-in completed. We never fabricate a successful
// sign-in: auto-detection is conservative, and the user can confirm explicitly.

struct SubscriptionProvider {
    /// Canonical gizzi provider id (must match the gizzi runtime registry).
    id: &'static str,
    label: &'static str,
    /// Default model id the gizzi runtime registers for this brain.
    model: &'static str,
    /// argv passed to the binary to start sign-in (empty => no CLI flow).
    login: &'static [&'static str],
    /// Fallback page the frontend opens when there is no automatic browser flow.
    page: &'static str,
    /// true => API-key only (no OAuth); false => OAuth/subscription CLI.
    api_key_only: bool,
}

fn subscription_provider(id: &str) -> Option<(&'static str, SubscriptionProvider)> {
    match id {
        "claude" | "claude-cli" => Some((
            "claude",
            SubscriptionProvider {
                id: "claude-cli",
                label: "Claude",
                model: "claude-sonnet-4-6",
                login: &["auth", "login"],
                page: "https://claude.ai/login",
                api_key_only: false,
            },
        )),
        "codex" | "codex-cli" => Some((
            "codex",
            SubscriptionProvider {
                id: "codex-cli",
                label: "Codex",
                model: "codex-mini-latest",
                login: &["login"],
                page: "https://chatgpt.com/",
                api_key_only: false,
            },
        )),
        "qwen" | "qwen-cli" => Some((
            "qwen",
            SubscriptionProvider {
                id: "qwen-cli",
                label: "Qwen",
                model: "qwen-plus",
                login: &["auth"],
                page: "https://qwen.ai/",
                api_key_only: false,
            },
        )),
        "kimi" | "kimi-cli" => Some((
            "kimi",
            SubscriptionProvider {
                id: "kimi-cli",
                label: "Kimi",
                model: "kimi-k2",
                login: &["login"],
                page: "https://www.kimi.com/",
                api_key_only: false,
            },
        )),
        "antigravity" | "agy" => Some((
            "agy",
            SubscriptionProvider {
                id: "antigravity",
                label: "Antigravity",
                model: "antigravity",
                login: &[],
                page: "https://antigravity.google/",
                api_key_only: false,
            },
        )),
        // Z.ai sells the GLM Coding Plan subscription, but today it has no public
        // OAuth/device-flow for third parties (Z.ai/ZCode OAuth is in progress).
        // The standard path is a console-created API key, so we treat it as key-based.
        "zai" | "z.ai" | "glm" => Some((
            "zai",
            SubscriptionProvider {
                id: "zai",
                label: "Z.ai",
                model: "glm-4.6",
                login: &[],
                page: "https://z.ai/subscribe",
                api_key_only: true,
            },
        )),
        _ => None,
    }
}

fn home_file(parts: &[&str]) -> std::path::PathBuf {
    let mut p =
        std::path::PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".to_string()));
    for part in parts {
        p.push(part);
    }
    p
}

/// Conservative, read-only check for whether a subscription provider is already
/// signed in. Never returns a false positive — when we cannot tell, it returns
/// false and the frontend falls back to an explicit user confirm.
///
/// For CLI providers we now require BOTH (a) the binary actually runs
/// (`--version` exit 0, mirroring gizzi's own liveness probe in
/// cmd/gizzi-code/.../subprocess.ts) AND (b) the provider's auth artifact is
/// present. This kills the stale-cred / removed-binary false positives that the
/// old file-exists-only check produced. Claude keeps its real `auth status`.
fn cli_alive(binary: &str, args: &[&str], expect: Option<&str>) -> bool {
    let out = std::process::Command::new(binary)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output();
    match out {
        Ok(o) if o.status.success() => match expect {
            Some(exp) => String::from_utf8_lossy(&o.stdout)
                .to_lowercase()
                .contains(exp),
            None => true,
        },
        _ => false,
    }
}

fn subscription_auth_check(id: &str, binary: &str) -> bool {
    match id {
        "claude" | "claude-cli" => std::process::Command::new(binary)
            .args(["auth", "status"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false),
        "codex" | "codex-cli" => {
            cli_alive(binary, &["--version"], Some("codex"))
                && home_file(&[".codex", "auth.json"]).exists()
        }
        "qwen" | "qwen-cli" => {
            cli_alive(binary, &["--version"], None)
                && (home_file(&[".qwen", "oauth_creds.json"]).exists()
                    || home_file(&[".config", "qwen", "oauth_creds.json"]).exists())
        }
        "kimi" | "kimi-cli" => {
            cli_alive(binary, &["--version"], Some("kimi"))
                && (home_file(&[".kimi-code", "auth.json"]).exists()
                    || home_file(&[".kimi-code", "config.json"]).exists())
        }
        "antigravity" | "agy" => {
            // agy (Antigravity CLI) stores its Google OAuth token at
            // ~/.gemini/oauth_creds.json (shared gemini-cli lineage). The
            // antigravity-cli dir holds per-install metadata, not the token.
            cli_alive(binary, &["--version"], None)
                && (home_file(&[".gemini", "oauth_creds.json"]).exists()
                    || home_file(&[".gemini", "antigravity-cli", "credentials.enc"]).exists()
                    || home_file(&[".config", "antigravity", "auth.json"]).exists())
        }
        "zai" | "z.ai" | "glm" => {
            std::env::var("ZAI_API_KEY").is_ok()
                || std::env::var("ZHIPU_API_KEY").is_ok()
                || secrets::get_secret(&secrets::provider_account("zai"))
                    .map(|k| !k.is_empty())
                    .unwrap_or(false)
        }
        _ => false,
    }
}

async fn connect_provider(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }

    let (binary, meta) = match subscription_provider(&id) {
        Some(v) => v,
        None => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "unknown_provider"})))
                .into_response()
        }
    };

    if meta.api_key_only {
        // Z.ai (GLM) is key-based but routes through gizzi as an OpenAI-compatible
        // provider (gizzi handles providerID "zai" in adapters/transform.ts). If a
        // key is already available, persist a real routing entry + make it the
        // default; otherwise return an actionable setup hint (not a dead stub).
        let key = std::env::var("ZAI_API_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| std::env::var("ZHIPU_API_KEY").ok().filter(|s| !s.is_empty()))
            .or_else(|| secrets::get_secret(&secrets::provider_account("zai")).filter(|s| !s.is_empty()));
        match key {
            Some(k) => {
                crate::onboarding_routes::persist_apikey_default(
                    &state,
                    meta.id,
                    meta.label,
                    meta.model,
                    "@ai-sdk/openai-compatible",
                    "https://api.z.ai/api/paas/v4",
                    &k,
                    "GLM-4.6",
                    200_000,
                    131_072,
                    true,
                );
                return Json(json!({
                    "status": "connected",
                    "provider": id,
                    "label": meta.label,
                    "routable": true,
                }))
                .into_response();
            }
            None => {
                return Json(json!({
                    "status": "needs_api_key",
                    "provider": id,
                    "label": meta.label,
                    "page": meta.page,
                    "routable": false,
                    "key_setup": {
                        "env": "ZAI_API_KEY",
                        "keychain_account": secrets::provider_account("zai"),
                        "hint": "Create a GLM API key at z.ai, then set ZAI_API_KEY (or store it in the OS keychain at the shown account) and reconnect.",
                    },
                }))
                .into_response();
            }
        }
    }

    if subscription_auth_check(&id, binary) {
        // Already authenticated: make it the default brain immediately so a click
        // in Settings is enough to route agents through it.
        crate::onboarding_routes::persist_cli_default(&state, meta.id, meta.label, binary, meta.model);
        return Json(json!({
            "status": "already_connected",
            "provider": id,
            "label": meta.label,
        }))
        .into_response();
    }

    if command_on_path(binary).is_none() {
        return Json(json!({
            "status": "not_installed",
            "provider": id,
            "label": meta.label,
            "binary": binary,
            "page": meta.page,
        }))
        .into_response();
    }

    // Fire-and-forget: the CLI opens the user's browser / sign-in flow itself.
    let spawned = std::process::Command::new(binary)
        .args(meta.login)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();

    match spawned {
        Ok(_) => Json(json!({
            "status": "started",
            "provider": id,
            "label": meta.label,
            "page": meta.page,
        }))
        .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "spawn_failed", "details": e.to_string(), "page": meta.page})),
        )
            .into_response(),
    }
}

async fn connect_provider_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    let (binary, meta) = match subscription_provider(&id) {
        Some(v) => v,
        None => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "unknown_provider"})))
                .into_response()
        }
    };
    let connected = subscription_auth_check(&id, binary);
    if connected {
        // Auto-detected completion of an interactive sign-in: promote to default.
        crate::onboarding_routes::persist_cli_default(&state, meta.id, meta.label, binary, meta.model);
    }
    Json(json!({
        "status": if connected { "success" } else { "pending" },
        "provider": id,
        "label": meta.label,
    }))
    .into_response()
}

async fn confirm_provider_connect(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    let (binary, meta) = match subscription_provider(&id) {
        Some(v) => v,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "unknown_provider"}))).into_response(),
    };
    // User-attested completion of an interactive sign-in we could not auto-detect.
    // Promote to default so the one-click flow actually routes agents to it.
    crate::onboarding_routes::persist_cli_default(&state, meta.id, meta.label, binary, meta.model);
    Json(json!({ "status": "success", "provider": id, "confirmed": true })).into_response()
}
