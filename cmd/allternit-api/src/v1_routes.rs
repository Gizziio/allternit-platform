use axum::{
    body::Body,
    extract::{Extension, Query, State},
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{any, get, post},
    Json, Router,
};
use futures::StreamExt;
use once_cell::sync::Lazy;
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::json;
use std::{collections::HashMap, convert::Infallible, sync::Arc, sync::Mutex};
use tracing::{info, warn};
use uuid::Uuid;

use crate::agent_preferences_routes::chat_style_directive;
use crate::agent_session_routes::gizzi_client;
use crate::agent_workspace_paths::workspace_dir_for;
use crate::auth::AuthUser;
use crate::config::build_gizzi_harness_for_provider;
use crate::gizzi_chat_stream::configure_harness_on_gizzi;
use crate::{default_model, AppState};

/// In-memory map from platform chatId → Gizzi session ID. Gizzi generates its
/// own session IDs, so we cache the mapping for the lifetime of the API process.
static GIZZI_CHAT_SESSIONS: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

async fn get_or_create_gizzi_session(
    client: &reqwest::Client,
    gizzi: &str,
    chat_id: &str,
    agent_id: Option<&str>,
    run_id: Option<&str>,
) -> Result<String, String> {
    {
        let lock = GIZZI_CHAT_SESSIONS.lock().map_err(|e| e.to_string())?;
        if let Some(id) = lock.get(chat_id) {
            return Ok(id.clone());
        }
    }

    // Sessions created via /api/v1/agent-sessions already exist in Gizzi (that
    // router proxies creation there). If chat_id is such a session, use it
    // directly — forking a second Gizzi session here made streamed messages land
    // in a different session than the one GET /agent-sessions/:id/messages reads,
    // so threads looked empty and history vanished on reload.
    if chat_id.starts_with("ses") {
        if let Ok(resp) = client
            .get(format!("{}/session/{}", gizzi, chat_id))
            .send()
            .await
        {
            if resp.status().is_success() {
                let mut lock = GIZZI_CHAT_SESSIONS.lock().map_err(|e| e.to_string())?;
                lock.insert(chat_id.to_string(), chat_id.to_string());
                return Ok(chat_id.to_string());
            }
        }
    }

    // The x-allternit-agent-id / x-allternit-run-id headers bind the new gizzi
    // session to its Allternit agent/run so gizzi's agent-event-bridge can
    // attribute permission/question events back to this agent (see
    // cmd/gizzi-code/src/runtime/services/agent-event-bridge.ts).
    let mut req = client
        .post(format!("{}/session", gizzi))
        .json(&json!({ "title": format!("Allternit chat {}", chat_id) }));
    if let Some(agent_id) = agent_id {
        req = req.header("x-allternit-agent-id", agent_id);
    }
    if let Some(run_id) = run_id {
        req = req.header("x-allternit-run-id", run_id);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("failed to create gizzi session: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("gizzi session creation failed: {}", resp.status()));
    }

    let body = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("failed to parse gizzi session response: {}", e))?;
    let session_id = body
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "gizzi session response missing id".to_string())?
        .to_string();

    let mut lock = GIZZI_CHAT_SESSIONS.lock().map_err(|e| e.to_string())?;
    lock.insert(chat_id.to_string(), session_id.clone());
    Ok(session_id)
}

fn gizzi_base() -> String {
    crate::APP_CONFIG
        .get()
        .map(|c| c.terminal_server_url())
        .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
        .trim_end_matches('/')
        .to_string()
}

/// Base URL of the optional off-gateway voice service (services/voice —
/// TTS/STT). Mirrors gizzi_base's pattern; the voice routes degrade
/// gracefully when nothing is listening there.
fn voice_base() -> String {
    crate::APP_CONFIG
        .get()
        .map(|c| c.voice_url())
        .unwrap_or_else(|| "http://127.0.0.1:8001".to_string())
        .trim_end_matches('/')
        .to_string()
}

pub fn v1_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/ai/chat", post(agent_chat_bridge))
        .route("/health", get(health))
        .route("/models", get(list_available_models))
        .route("/models/recommend", get(recommend_models))
        .route("/voice/voices", get(list_voice_presets))
        .route("/voice/tts/stream", post(proxy_voice_tts_stream))
        .route("/voice/stt/stream", post(proxy_voice_stt_stream))
        .route("/cli-tools", get(list_cli_tools_stub))
        .route("/cli-tools/installed", get(list_cli_tools_stub))
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

/// GET /api/v1/models — flattened `{id, name, provider}` catalog for the
/// agent-creation wizard's model picker. Sourced from the same provider specs
/// as the /providers endpoints; previously fell through to the 501 fallback.
///
/// The static catalog only covers compile-time-known providers/models — it
/// can never include user-installed local models (Sidecar's HF-downloaded
/// GGUF pulls), which only exist at runtime, one deployment at a time. This
/// merges in gizzi-code's live `GET /provider` `connected` list on top of
/// the static entries, so newly-installed local models show up without a
/// backend redeploy. Falls back to the static-only list if gizzi is
/// unreachable — this endpoint must never hard-fail just because the
/// harness happens to be down.
async fn list_available_models(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut catalog = crate::provider_routes::available_model_catalog();
    catalog.extend(fetch_live_local_models(&state).await);
    Json(catalog)
}

/// Fetches gizzi-code's live provider list and flattens any `connected`
/// (i.e. actually-available-right-now) provider's models into the same
/// `{id, name, provider, description, tier, supports_effort}` shape the
/// static catalog uses. Currently only `sidecar` is a locally-hosted
/// provider in practice, but this isn't sidecar-specific — any connected
/// provider the static list doesn't already know about gets included.
async fn fetch_live_local_models(state: &AppState) -> Vec<serde_json::Value> {
    let base = state.config.terminal_server_url();
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
    {
        Ok(client) => client,
        Err(_) => return Vec::new(),
    };

    let resp = match client.get(format!("{}/provider", base.trim_end_matches('/'))).send().await {
        Ok(resp) if resp.status().is_success() => resp,
        _ => return Vec::new(),
    };

    let body: serde_json::Value = match resp.json().await {
        Ok(body) => body,
        Err(_) => return Vec::new(),
    };

    let connected: std::collections::HashSet<String> = body
        .get("connected")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let all = body.get("all").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    let mut out = Vec::new();
    for provider in all {
        let provider_id = match provider.get("id").and_then(|v| v.as_str()) {
            Some(id) if connected.contains(id) => id.to_string(),
            _ => continue,
        };
        let provider_name = provider.get("name").and_then(|v| v.as_str()).unwrap_or(&provider_id).to_string();
        let Some(models) = provider.get("models").and_then(|v| v.as_object()) else { continue };
        for (model_id, model) in models {
            let model_name = model.get("name").and_then(|v| v.as_str()).unwrap_or(model_id);
            out.push(json!({
                "id": format!("{}/{}", provider_id, model_id),
                "name": format!("{} ({})", model_name, provider_name),
                "provider": provider_id,
                "description": serde_json::Value::Null,
                "tier": "local",
                "supports_effort": false,
            }));
        }
    }
    out
}

/// GET /api/v1/models/recommend — ranks available models for a task + priority.
///
/// Query params:
/// - `task`: code | reasoning | knowledge | chat | balanced (default balanced)
/// - `priority`: quality | cost | latency (default quality)
///
/// Returns a ranked list of `{id, name, provider, tier, score, reason}`.
/// Scoring is heuristic: tier weight is adjusted by priority (quality keeps
/// flagship on top; cost/latency boost fast/local), and task keyword affinity
/// is pulled from the model id and description.
#[derive(Deserialize)]
struct RecommendQuery {
    task: Option<String>,
    priority: Option<String>,
}

async fn recommend_models(
    State(state): State<Arc<AppState>>,
    Query(query): Query<RecommendQuery>,
) -> impl IntoResponse {
    let task = query.task.as_deref().unwrap_or("balanced").to_lowercase();
    let priority = query.priority.as_deref().unwrap_or("quality").to_lowercase();

    let mut catalog = crate::provider_routes::available_model_catalog();
    catalog.extend(fetch_live_local_models(&state).await);

    let mut recommendations: Vec<serde_json::Value> = catalog
        .into_iter()
        .map(|model| {
            let (score, reason) = score_model_for_task(&model, &task, &priority);
            let mut rec = model.clone();
            rec["score"] = json!(score);
            rec["reason"] = json!(reason);
            rec
        })
        .collect();

    recommendations.sort_by(|a, b| {
        let a_score = a.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let b_score = b.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);
        b_score.partial_cmp(&a_score).unwrap_or(std::cmp::Ordering::Equal)
    });

    Json(json!({ "task": task, "priority": priority, "recommendations": recommendations }))
}

fn tier_base_weight(tier: &str) -> f64 {
    match tier {
        "flagship" => 1.0,
        "premium" => 0.9,
        "standard" => 0.75,
        "fast" => 0.55,
        "local" => 0.6,
        "legacy" => 0.4,
        _ => 0.65,
    }
}

fn priority_multiplier(tier: &str, priority: &str) -> f64 {
    match priority {
        "latency" => match tier {
            "fast" => 1.45,
            "local" => 1.25,
            "standard" => 0.95,
            "premium" => 0.85,
            "flagship" => 0.7,
            "legacy" => 0.5,
            _ => 0.9,
        },
        "cost" => match tier {
            "fast" => 1.35,
            "local" => 1.25,
            "standard" => 0.95,
            "premium" => 0.8,
            "flagship" => 0.65,
            "legacy" => 0.5,
            _ => 0.9,
        },
        _ => match tier {
            "flagship" => 1.05,
            "premium" => 1.0,
            "standard" => 0.95,
            "fast" => 0.85,
            "local" => 0.8,
            "legacy" => 0.7,
            _ => 0.9,
        },
    }
}

fn task_keyword_sets() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        ("code", vec!["code", "coding", "codex", "dev", "program", "software", "engineer", "git", "debug", "qwen"]),
        ("reasoning", vec!["reasoning", "logic", "math", "science", "complex", "challenge", "opus", "pro"]),
        ("knowledge", vec!["knowledge", "facts", "answer", "research", "web", "grounded", "sonar"]),
        ("chat", vec!["chat", "conversation", "everyday", "writing", "assistant", "haiku", "nano"]),
    ]
}

fn task_affinity(model: &serde_json::Value, task: &str) -> f64 {
    if task == "balanced" {
        return 0.05;
    }
    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let desc = model.get("description").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let name = model.get("name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let haystack = format!("{} {} {}", id, name, desc);

    let sets = task_keyword_sets();
    let keywords: Vec<&str> = sets
        .iter()
        .find(|(t, _)| *t == task)
        .map(|(_, kws)| kws.clone())
        .unwrap_or_default();
    if keywords.is_empty() {
        return 0.0;
    }

    let hits = keywords.iter().filter(|kw| haystack.contains(*kw)).count();
    (hits as f64 / keywords.len() as f64).min(1.0) * 0.35
}

fn score_model_for_task(model: &serde_json::Value, task: &str, priority: &str) -> (f64, String) {
    let tier = model.get("tier").and_then(|v| v.as_str()).unwrap_or("standard");
    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
    let provider = model.get("provider").and_then(|v| v.as_str()).unwrap_or("unknown");

    let base = tier_base_weight(tier);
    let mult = priority_multiplier(tier, priority);
    let affinity = task_affinity(model, task);
    let score = ((base * mult) + affinity).min(1.0);

    let reason = match priority {
        "latency" => format!("{} is tuned for low-latency {} responses via {}.", id, task, provider),
        "cost" => format!("{} is a cost-efficient {} choice on {}.", id, task, provider),
        _ => format!("{} is the highest-quality {} option available on {}.", id, task, provider),
    };
    (score, reason)
}

/// GET /api/v1/voice/voices — proxies the voice list from the optional
/// off-gateway voice service (services/voice GET /v1/voices → a bare array).
/// The service is optional: when it's unreachable the route keeps answering
/// the old empty-list stub so voice pickers degrade to on-device options
/// instead of erroring.
async fn list_voice_presets() -> Response {
    let stub = || Json(json!({ "voices": [] })).into_response();

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
    {
        Ok(client) => client,
        Err(_) => return stub(),
    };

    let resp = match client
        .get(format!("{}/v1/voices", voice_base()))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => resp,
        _ => return stub(),
    };

    match resp.json::<serde_json::Value>().await {
        // services/voice answers a bare array; wrap it in the {voices: []}
        // shape this route has always served.
        Ok(serde_json::Value::Array(voices)) => Json(json!({ "voices": voices })).into_response(),
        Ok(_) => {
            warn!("voice service returned an unexpected /v1/voices shape; serving stub");
            stub()
        }
        Err(_) => stub(),
    }
}

/// POST /api/v1/voice/tts/stream — byte pass-through to the voice service's
/// streaming TTS endpoint (services/voice POST /v1/tts/stream).
async fn proxy_voice_tts_stream(body: Body) -> Response {
    proxy_voice_stream("tts/stream", body).await
}

/// POST /api/v1/voice/stt/stream — byte pass-through to the voice service's
/// streaming STT endpoint (services/voice POST /v1/stt/stream).
async fn proxy_voice_stt_stream(body: Body) -> Response {
    proxy_voice_stream("stt/stream", body).await
}

/// Shared streaming pass-through: forwards the request body verbatim and
/// streams the upstream response back with its status and content-type.
/// Answers 503 with a JSON error when the voice service is down so clients
/// can fall back to on-device speech instead of hanging.
async fn proxy_voice_stream(service_path: &str, body: Body) -> Response {
    let body_bytes = match body_to_bytes(body).await {
        Ok(b) => b,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "bad request body"})),
            )
                .into_response();
        }
    };

    // No overall timeout on purpose — these streams are long-lived (same
    // reasoning as the gizzi event-stream client above).
    let upstream = match reqwest::Client::new()
        .post(format!("{}/v1/{}", voice_base(), service_path))
        .header("Content-Type", "application/json")
        .body(body_bytes)
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            warn!(error = %e, path = %service_path, "voice service unavailable");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("voice service unavailable: {}", e)})),
            )
                .into_response();
        }
    };

    let status = StatusCode::from_u16(upstream.status().as_u16())
        .unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = upstream
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    match Response::builder()
        .status(status)
        .header("content-type", content_type)
        .body(Body::from_stream(upstream.bytes_stream()))
    {
        Ok(response) => response,
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "failed to build voice proxy response"})),
        )
            .into_response(),
    }
}

/// GET /api/v1/cli-tools (+ /cli-tools/installed) — the unified backend does
/// not manage CLI tools yet; the desktop UI's filesystem scanner is the real
/// source and its client already falls back to it on 501. Answer 200 with the
/// same empty-list shape the fallback produces so the console stays quiet,
/// mirroring /voice/voices.
async fn list_cli_tools_stub() -> impl IntoResponse {
    Json(json!({ "tools": [], "total": 0 }))
}

pub fn agent_chat_router() -> Router<Arc<AppState>> {
    Router::new().route("/agent-chat", any(agent_chat_bridge))
}

/// Per-agent context loaded for server-side system-instruction composition in
/// the agent-chat bridge.
#[derive(Default)]
struct AgentChatContext {
    system_prompt: Option<String>,
    provider: String,
    model: String,
    soul_md: Option<String>,
    style_md: Option<String>,
    instructions_md: Option<String>,
}

/// Read a workspace markdown file for composition. Missing files are normal
/// (agents are not required to have persona files); other read failures are
/// logged and skipped so they never fail the chat request. MEMORY.md is
/// deliberately never read this way — too large for every send.
fn read_workspace_md(dir: &std::path::Path, name: &str) -> Option<String> {
    match std::fs::read_to_string(dir.join(name)) {
        Ok(text) => Some(text),
        Err(e) => {
            if e.kind() != std::io::ErrorKind::NotFound {
                warn!(
                    "agent-chat: failed to read {}: {}",
                    dir.join(name).display(),
                    e
                );
            }
            None
        }
    }
}

/// Canonical instruction files gizzi-code's context packer injects into
/// every agent prompt (cmd/gizzi-code/src/runtime/context/pack.ts), in its
/// exact order. The platform composer mirrors the list so a workspace's
/// AGENTS.md/CLAUDE.md is honored on the agent-chat path too.
const INSTRUCTION_FILES: [&str; 4] = ["AGENTS.md", "GIZZI.md", ".claude/CLAUDE.md", "SYSTEM_LAW.md"];

/// Read the canonical instruction files from a workspace root and compose
/// them into one layer, each wrapped in the same `--- <path> ---` header
/// pack.ts emits. Blank/missing files are skipped; returns None when no
/// file carries content.
fn read_instruction_files(dir: &std::path::Path) -> Option<String> {
    let parts: Vec<String> = INSTRUCTION_FILES
        .iter()
        .filter_map(|name| {
            read_workspace_md(dir, name)
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty())
                .map(|text| format!("--- {} ---\n{}", name, text))
        })
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n\n"))
    }
}

/// Compose the final system-instructions block for an agent-chat request.
/// Layer order: SOUL.md → STYLE.md (only when no prefs row exists — it is
/// generated from that row, so including both would state the style
/// twice) → canonical instruction files (AGENTS.md → GIZZI.md →
/// .claude/CLAUDE.md → SYSTEM_LAW.md, mirroring pack.ts) → agent
/// system_prompt → response-style directive → custom
/// instructions → client-sent systemPrompt. Blank layers
/// are skipped and layers are joined with "\n\n"; returns None when every
/// layer is empty so the caller preserves the old no-block behavior exactly.
fn compose_system_instructions(
    soul_md: Option<&str>,
    style_md: Option<&str>,
    instructions_md: Option<&str>,
    agent_prompt: Option<&str>,
    response_style: &str,
    custom_instructions: &str,
    client_prompt: Option<&str>,
) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    for layer in [soul_md, style_md, instructions_md, agent_prompt] {
        if let Some(text) = layer.map(str::trim).filter(|t| !t.is_empty()) {
            parts.push(text.to_string());
        }
    }
    if let Some(directive) = chat_style_directive(response_style) {
        parts.push(directive.to_string());
    }
    if !custom_instructions.trim().is_empty() {
        parts.push(format!(
            "Custom instructions from the user:\n{}",
            custom_instructions
        ));
    }
    if let Some(text) = client_prompt.map(str::trim).filter(|t| !t.is_empty()) {
        parts.push(text.to_string());
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n\n"))
    }
}

/// Agent-runs row for a bridge chat carrying an agent_id. Settled exactly
/// once when the stream reaches a terminal finish (or the pre-stream session
/// setup fails).
struct ChatRunRecord {
    agent_id: String,
    db: crate::db::DbHandle,
    run_id: String,
    started: std::time::Instant,
}

/// Settle a bridge chat's agent_runs row. No-op for chats without an
/// agent_id; best-effort, like all run recording.
async fn settle_chat_run(record: &Option<ChatRunRecord>, success: bool, error: Option<&str>) {
    let Some(record) = record else { return };
    crate::agent_routes::record_run_finish(
        &record.db,
        &record.run_id,
        if success { "completed" } else { "failed" },
        None,
        error,
        record.started.elapsed().as_millis() as i64,
    )
    .await;
}

/// Bridge /api/agent-chat → gizzi session/event architecture.
///
/// 1. Parse chatId and message from the request body.
/// 2. Compose the system instructions server-side: agent persona (SOUL.md,
///    STYLE.md), canonical workspace instruction files (AGENTS.md → GIZZI.md →
///    .claude/CLAUDE.md → SYSTEM_LAW.md), system_prompt, plus the caller's
///    response-style preferences, sent to gizzi via the message's "system"
///    field (kept separate from the user's message text).
/// 3. Subscribe to gizzi's SSE event stream.
/// 4. POST the message to gizzi /v1/session/:id/message.
/// 5. Filter message.part.delta events for this session and convert to
///    the content_block_delta SSE format the frontend expects.
/// 6. Close the stream when session.status becomes idle.
async fn agent_chat_bridge(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    headers: HeaderMap,
    body: Body,
) -> Response {
    let body_bytes = match body_to_bytes(body).await {
        Ok(b) => b,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "bad request body"})),
            )
                .into_response();
        }
    };

    let body_json: serde_json::Value =
        serde_json::from_slice(&body_bytes).unwrap_or(serde_json::Value::Null);

    let chat_id = body_json
        .get("chatId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let message = body_json
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let client_system_prompt = body_json
        .get("systemPrompt")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let agent_id = body_json
        .get("agent_id")
        .or_else(|| body_json.get("agentId"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    if chat_id.is_empty() || message.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "chatId and message are required"})),
        )
            .into_response();
    }

    // ── Server-side system-instruction context ─────────────────────────────
    // Load the caller's response-style preferences (every request) and, when
    // an agent_id is given, the agent row plus its workspace persona files.
    let db = state.db.clone();
    let user_id = user.user_id;
    let user_id_for_record = user_id.clone();
    let agent_id_for_task = agent_id.clone();
    let gathered = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let prefs_row: Option<(String, String)> = conn
            .query_row(
                "SELECT response_style, custom_instructions
                 FROM user_agent_preferences WHERE user_id = ?1",
                params![user_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let (response_style, custom_instructions) = prefs_row
            .clone()
            .unwrap_or(("balanced".to_string(), String::new()));

        let agent = match agent_id_for_task {
            Some(ref agent_id) => {
                let row = conn
                    .query_row(
                        "SELECT system_prompt, provider, model FROM agents
                         WHERE id = ?1 AND user_id = ?2",
                        params![agent_id, user_id],
                        |row| {
                            Ok((
                                row.get::<_, Option<String>>(0)?,
                                row.get::<_, String>(1)?,
                                row.get::<_, String>(2)?,
                            ))
                        },
                    )
                    .optional()?;
                row.map(|(system_prompt, provider, model)| {
                    let dir = workspace_dir_for(agent_id);
                    AgentChatContext {
                        system_prompt,
                        provider,
                        model,
                        soul_md: read_workspace_md(&dir, "SOUL.md"),
                        // STYLE.md is GENERATED from the prefs row — reading
                        // it on top of the row's own directive/instruction
                        // layers would state the style twice. The row wins;
                        // STYLE.md is only a fallback for workspaces synced
                        // before this rule (no prefs row on record).
                        style_md: if prefs_row.is_some() {
                            None
                        } else {
                            read_workspace_md(&dir, "STYLE.md")
                        },
                        instructions_md: read_instruction_files(&dir),
                    }
                })
            }
            None => None,
        };

        Ok::<_, rusqlite::Error>((response_style, custom_instructions, agent))
    })
    .await;

    let (response_style, custom_instructions, agent) = match gathered {
        Ok(Ok(v)) => v,
        Ok(Err(e)) => {
            warn!("DB error composing agent-chat context: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response();
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response();
        }
    };

    if agent_id.is_some() && agent.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Agent not found"})),
        )
            .into_response();
    }
    let agent = agent.unwrap_or_default();

    // Record the chat as an agent_runs row when it runs under an agent. Rows
    // only — no Rails ledger events (a ledger event per chat message would
    // flood the agent events feed) and no agent_metrics samples (chat sends
    // would skew the per-run counters; discrete run_agent executions remain
    // the unit there). Best-effort like all run recording: a recording
    // failure must never affect the chat.
    let chat_run = agent_id.as_ref().map(|aid| ChatRunRecord {
        agent_id: aid.clone(),
        db: state.db.clone(),
        run_id: Uuid::new_v4().to_string(),
        started: std::time::Instant::now(),
    });
    if let Some(record) = &chat_run {
        crate::agent_routes::record_run_start(
            &record.db,
            &record.run_id,
            &record.agent_id,
            &user_id_for_record,
        )
        .await;
    }

    // Composition order: SOUL.md → STYLE.md → canonical instruction files
    // (AGENTS.md → GIZZI.md → .claude/CLAUDE.md → SYSTEM_LAW.md) → agent
    // system_prompt → style directive → custom instructions → client-sent
    // systemPrompt.
    let system_prompt = compose_system_instructions(
        agent.soul_md.as_deref(),
        agent.style_md.as_deref(),
        agent.instructions_md.as_deref(),
        agent.system_prompt.as_deref(),
        &response_style,
        &custom_instructions,
        client_system_prompt.as_deref(),
    )
    .unwrap_or_default();

    // Parse model from runtimeModelId or modelId — strip provider prefix if present.
    // Client-sent model ids always win; without one, fall back to the agent's
    // provider/model, then to the environment-configurable default so the
    // packaged app can target any Gizzi provider/model without recompiling.
    let (default_provider, default_model_id) = default_model();
    let default_label = format!("{}/{}", default_provider, default_model_id);
    let agent_model_label = if agent.provider.trim().is_empty() || agent.model.trim().is_empty() {
        None
    } else {
        Some(format!("{}/{}", agent.provider, agent.model))
    };
    let raw_model = body_json
        .get("runtimeModelId")
        .or_else(|| body_json.get("modelId"))
        .and_then(|v| v.as_str())
        .or(agent_model_label.as_deref())
        .unwrap_or(&default_label)
        // Frontend model ids use the `provider::model` convention; the runtime
        // expects `provider/model`. Normalize so both forms route.
        .replace("::", "/");

    let (provider_id, model_id) = if let Some((p, m)) = raw_model.split_once('/') {
        (p.to_string(), m.to_string())
    } else {
        (default_provider, raw_model.clone())
    };

    let gizzi = gizzi_base();
    let assistant_message_id = format!("msg_{}", Uuid::new_v4().simple());
    let model_label = format!("{}/{}", provider_id, model_id);

    // Auth-aware client: password-protected Gizzi daemons expect Basic auth
    // (GIZZI_PASSWORD/GIZZI_SERVER_PASSWORD env, or a Basic header forwarded by
    // the desktop shell). Sharing agent_session_routes::gizzi_client keeps the
    // auth boundary rules in one place. Note it carries no overall timeout on
    // purpose — the /event SSE stream below is long-lived.
    let client = gizzi_client(&headers);

    // For non-cloud harness modes (subprocess, local, BYOK), push credentials
    // and config to Gizzi before creating the session so the chosen brain is
    // authenticated. This is what makes Claude CLI / local brains work through
    // the /api/agent-chat bridge.
    let harness = build_gizzi_harness_for_provider(&provider_id);
    let model_ref = json!({ "providerID": provider_id, "modelID": model_id });
    configure_harness_on_gizzi(&client, &gizzi, harness.as_ref(), &model_ref).await;

    let gizzi_session_id = match get_or_create_gizzi_session(
        &client,
        &gizzi,
        &chat_id,
        agent_id.as_deref(),
        chat_run.as_ref().map(|r| r.run_id.as_str()),
    )
    .await
    {
        Ok(id) => id,
        Err(err) => {
            warn!(error = %err, "Failed to get or create Gizzi session");
            settle_chat_run(&chat_run, false, Some(&err)).await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": err })),
            )
                .into_response();
        }
    };

    info!(session_id = %chat_id, gizzi_session_id = %gizzi_session_id, model = %model_label, "agent-chat bridge → gizzi");

    // Re-sent on every message POST: the session-create above only runs once
    // per chatId (cached in GIZZI_CHAT_SESSIONS), while the agent-event-bridge
    // binding in gizzi needs the current run id each turn.
    let agent_id_for_messages = agent_id.clone();
    let run_id_for_messages = chat_run.as_ref().map(|r| r.run_id.clone());

    let stream = async_stream::stream! {
        let msg_id = assistant_message_id.clone();
        let session_id = gizzi_session_id.clone();

        yield Ok::<Event, Infallible>(Event::default().data(
            json!({
                "type": "message_start",
                "messageId": msg_id,
                "modelId": model_label,
                "runtimeModelId": model_label,
            }).to_string()
        ));

        // Subscribe to the gizzi event stream BEFORE sending the message so we
        // don't miss any events that fire immediately after the POST.
        let event_resp = match client
            .get(format!("{}/event", gizzi))
            .header("Accept", "text/event-stream")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to connect to gizzi event stream: {}", e);
                settle_chat_run(&chat_run, false, Some(&format!("gizzi event stream unavailable: {}", e))).await;
                yield Ok(Event::default().data(json!({
                    "type": "finish",
                    "messageId": msg_id,
                    "status": "error",
                    "metadata": { "status": "error", "error": format!("gizzi event stream unavailable: {}", e) },
                }).to_string()));
                return;
            }
        };

        // POST message to gizzi. `effort` (low|medium|high, from the mobile
        // model picker) is forwarded verbatim — runtimes ignore it for
        // models without reasoning support.
        let effort = body_json
            .get("effort")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty());

        // Composer attachments (mobile "+" sheet): the client uploads each
        // file via POST /api/v1/uploads first and sends the returned refs as
        // `attachments: [{url?, dataBase64?, mediaType, name?}]`. Each one
        // becomes a gizzi file part alongside the text part. A raw
        // `dataBase64` payload (no upload round-trip) is forwarded as a data
        // URL so small inline images still work.
        let mut parts = vec![json!({ "type": "text", "text": message })];
        if let Some(attachments) = body_json.get("attachments").and_then(|v| v.as_array()) {
            for attachment in attachments {
                let media_type = attachment
                    .get("mediaType")
                    .and_then(|v| v.as_str())
                    .unwrap_or("application/octet-stream");
                let url = attachment
                    .get("url")
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
                    .or_else(|| {
                        attachment
                            .get("dataBase64")
                            .and_then(|v| v.as_str())
                            .map(|data| format!("data:{};base64,{}", media_type, data))
                    });
                let Some(url) = url else { continue };
                let mut part = json!({
                    "type": "file",
                    "url": url,
                    "mime": media_type,
                });
                if let Some(name) = attachment.get("name").and_then(|v| v.as_str()) {
                    part["filename"] = json!(name);
                }
                parts.push(part);
            }
        }

        let mut gizzi_payload = json!({
            "parts": parts,
            "model": { "providerID": provider_id, "modelID": model_id },
        });
        if let Some(effort) = effort {
            gizzi_payload["effort"] = json!(effort);
        }
        // "+" prefix: APPEND to gizzi's default assembled system prompt
        // rather than replace it.
        if !system_prompt.trim().is_empty() {
            gizzi_payload["system"] = json!(format!("+{}", system_prompt.trim()));
        }

        // Composer tool options (mobile "+" sheet): `metadata.tools` carries
        // {webSearch, research, toolAccess: "auto"|"on_demand"|"always"}.
        // Stashed into the gizzi payload metadata so the runtime can see the
        // user's choices.
        // TODO(runtime): gizzi currently ignores `metadata.tools` — wire the
        // web-search/research tool gating and tool-access mode into the
        // runtime once it supports per-request tool configuration.
        if let Some(tools) = body_json
            .get("metadata")
            .and_then(|m| m.get("tools"))
            .filter(|t| t.is_object())
        {
            gizzi_payload["metadata"] = json!({ "tools": tools.clone() });
        }

        let mut message_req = client
            .post(format!("{}/session/{}/message", gizzi, session_id))
            .json(&gizzi_payload);
        if let Some(agent_id) = agent_id_for_messages.as_deref() {
            message_req = message_req.header("x-allternit-agent-id", agent_id);
        }
        if let Some(run_id) = run_id_for_messages.as_deref() {
            message_req = message_req.header("x-allternit-run-id", run_id);
        }
        let _message_resp = match message_req
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => r,
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                warn!(status = %status, body = %body, "Gizzi message endpoint failed");
                // Pass the runtime's structured error through so clients can
                // render targeted UI (e.g. a model picker on
                // ProviderModelNotFoundError) instead of parsing a string.
                let details = serde_json::from_str::<serde_json::Value>(&body).ok();
                settle_chat_run(&chat_run, false, Some(&format!("gizzi message failed ({}): {}", status, body))).await;
                yield Ok(Event::default().data(json!({
                    "type": "finish",
                    "messageId": msg_id,
                    "status": "error",
                    "metadata": { "status": "error", "error": format!("gizzi message failed ({}): {}", status, body), "errorDetails": details },
                }).to_string()));
                return;
            }
            Err(e) => {
                warn!("Failed to send message to gizzi session: {}", e);
                settle_chat_run(&chat_run, false, Some(&format!("gizzi unavailable: {}", e))).await;
                yield Ok(Event::default().data(json!({
                    "type": "finish",
                    "messageId": msg_id,
                    "status": "error",
                    "metadata": { "status": "error", "error": format!("gizzi unavailable: {}", e) },
                }).to_string()));
                return;
            }
        };

        // If the message endpoint returned a body with an agent response, ignore
        // it; we rely on the event stream for streaming replies.

        // Stream events from gizzi, forwarding text deltas for our session
        let mut buf = String::new();
        let mut byte_stream = event_resp.bytes_stream();
        let mut was_busy = false;
        // partID → type tracking: `message.part.updated` carries the part's
        // type ("text" | "reasoning" | "tool" | …) while the deltas don't,
        // so reasoning streams can be forwarded as thinking deltas instead
        // of being flattened into the visible reply text.
        let mut reasoning_parts = std::collections::HashSet::<String>::new();

        'event_loop: while let Some(chunk_result) = byte_stream.next().await {
            let chunk = match chunk_result {
                Ok(b) => b,
                Err(e) => { warn!("Gizzi stream read error: {}", e); break; }
            };

            buf.push_str(&String::from_utf8_lossy(&chunk));

            // SSE blocks are separated by double newlines
            loop {
                let Some(block_end) = buf.find("\n\n") else { break };
                let block = buf[..block_end].to_string();
                buf = buf[block_end + 2..].to_string();

                // Extract the data line from the SSE block
                let data = block.lines()
                    .find(|l| l.starts_with("data:"))
                    .and_then(|l| l.strip_prefix("data:"))
                    .map(str::trim)
                    .unwrap_or("");

                if data.is_empty() { continue; }

                let Ok(event) = serde_json::from_str::<serde_json::Value>(data) else { continue };
                let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
                let props = &event["properties"];

                let evt_session = props.get("sessionID").and_then(|v| v.as_str()).unwrap_or("");
                if !evt_session.is_empty() && evt_session != session_id {
                    continue; // different session — ignore
                }

                match event_type {
                    "message.part.updated" => {
                        let part = &props["part"];
                        let part_type = part.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        let part_id = part.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        if part_type == "reasoning" && !part_id.is_empty() {
                            reasoning_parts.insert(part_id.to_string());
                        }
                    }
                    "message.part.delta" => {
                        let delta_text = props.get("delta").and_then(|v| v.as_str()).unwrap_or("");
                        let part_id = props.get("partID").and_then(|v| v.as_str()).unwrap_or("text-1");

                        if reasoning_parts.contains(part_id) {
                            // Reasoning part → thinking delta (the frontend's
                            // thought stream), not visible reply text.
                            yield Ok(Event::default().data(json!({
                                "type": "content_block_delta",
                                "messageId": msg_id,
                                "partId": part_id,
                                "delta": { "type": "thinking_delta", "thinking": delta_text },
                            }).to_string()));
                        } else {
                            yield Ok(Event::default().data(json!({
                                "type": "content_block_delta",
                                "messageId": msg_id,
                                "partId": part_id,
                                "delta": { "type": "text_delta", "text": delta_text },
                            }).to_string()));
                        }
                    }
                    "session.status" => {
                        let status_type = props.get("status")
                            .and_then(|s| s.get("type"))
                            .and_then(|t| t.as_str())
                            .unwrap_or("");

                        if status_type == "busy" {
                            was_busy = true;
                        } else if status_type == "idle" && was_busy {
                            break 'event_loop;
                        }
                    }
                    _ => {}
                }
            }
        }

        settle_chat_run(&chat_run, true, None).await;
        yield Ok(Event::default().data(json!({
            "type": "finish",
            "messageId": msg_id,
            "status": "complete",
            "metadata": { "status": "complete" },
        }).to_string()));
    };

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

async fn body_to_bytes(
    body: Body,
) -> Result<axum::body::Bytes, Box<dyn std::error::Error + Send + Sync>> {
    use http_body_util::BodyExt;
    let collected = body.collect().await?;
    Ok(collected.to_bytes())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compose_empty_returns_none() {
        assert_eq!(
            compose_system_instructions(None, None, None, None, "balanced", "", None),
            None
        );
    }

    #[test]
    fn compose_skips_blank_layers() {
        assert_eq!(
            compose_system_instructions(
                Some("  "),
                Some(""),
                Some(""),
                Some("\n"),
                "balanced",
                "   ",
                Some("\t")
            ),
            None
        );
    }

    #[test]
    fn compose_each_layer_alone() {
        assert_eq!(
            compose_system_instructions(Some("soul"), None, None, None, "balanced", "", None)
                .as_deref(),
            Some("soul")
        );
        assert_eq!(
            compose_system_instructions(None, Some("style md"), None, None, "balanced", "", None)
                .as_deref(),
            Some("style md")
        );
        assert_eq!(
            compose_system_instructions(None, None, Some("--- AGENTS.md ---\nrules"), None, "balanced", "", None)
                .as_deref(),
            Some("--- AGENTS.md ---\nrules")
        );
        assert_eq!(
            compose_system_instructions(None, None, None, Some("agent prompt"), "balanced", "", None)
                .as_deref(),
            Some("agent prompt")
        );
        assert_eq!(
            compose_system_instructions(None, None, None, None, "concise", "", None).as_deref(),
            Some(chat_style_directive("concise").unwrap())
        );
        assert_eq!(
            compose_system_instructions(None, None, None, None, "balanced", "do x", None).as_deref(),
            Some("Custom instructions from the user:\ndo x")
        );
        assert_eq!(
            compose_system_instructions(None, None, None, None, "balanced", "", Some("client"))
                .as_deref(),
            Some("client")
        );
    }

    #[test]
    fn compose_full_ordering() {
        let out = compose_system_instructions(
            Some("SOUL"),
            Some("STYLE"),
            Some("INSTRUCTIONS"),
            Some("AGENT"),
            "detailed",
            "CUSTOM",
            Some("CLIENT"),
        )
        .unwrap();
        let expected = [
            "SOUL",
            "STYLE",
            "INSTRUCTIONS",
            "AGENT",
            chat_style_directive("detailed").unwrap(),
            "Custom instructions from the user:\nCUSTOM",
            "CLIENT",
        ]
        .join("\n\n");
        assert_eq!(out, expected);
    }

    #[test]
    fn compose_no_directive_for_balanced_or_custom() {
        assert_eq!(
            compose_system_instructions(None, None, None, None, "balanced", "", None),
            None
        );
        assert_eq!(
            compose_system_instructions(None, None, None, None, "custom", "", None),
            None
        );
    }

    #[test]
    fn instruction_files_compose_in_pack_order_with_headers() {
        let dir = std::env::temp_dir().join(format!("allternit-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(dir.join(".claude")).unwrap();
        // GIZZI.md deliberately absent — missing files are skipped.
        std::fs::write(dir.join("AGENTS.md"), "agents rules").unwrap();
        std::fs::write(dir.join(".claude/CLAUDE.md"), "claude rules\n").unwrap();
        std::fs::write(dir.join("SYSTEM_LAW.md"), "  \n").unwrap(); // blank → skipped
        let out = read_instruction_files(&dir).unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(
            out,
            "--- AGENTS.md ---\nagents rules\n\n--- .claude/CLAUDE.md ---\nclaude rules"
        );
    }

    #[test]
    fn instruction_files_none_when_no_file_has_content() {
        let dir = std::env::temp_dir().join(format!("allternit-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(read_instruction_files(&dir), None);
        std::fs::write(dir.join("GIZZI.md"), "\n").unwrap();
        assert_eq!(read_instruction_files(&dir), None);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn compose_directive_strings_match_ios_client() {
        assert_eq!(
            chat_style_directive("concise"),
            Some("Response style: keep responses brief and to the point — no preamble, no recap, no filler.")
        );
        assert_eq!(
            chat_style_directive("detailed"),
            Some("Response style: give thorough, detailed responses — full context, reasoning, and examples where they help.")
        );
    }

    #[test]
    fn recommend_quality_prefers_flagship_for_reasoning() {
        let flagship = json!({"id": "anthropic/claude-opus-4-6", "name": "Claude Opus 4.6", "provider": "anthropic", "description": "For your toughest challenges", "tier": "flagship", "supports_effort": true });
        let fast = json!({"id": "anthropic/claude-haiku-4-5", "name": "Claude Haiku 4.5", "provider": "anthropic", "description": "Fastest for quick answers", "tier": "fast", "supports_effort": true });

        let (flagship_score, _) = score_model_for_task(&flagship, "reasoning", "quality");
        let (fast_score, _) = score_model_for_task(&fast, "reasoning", "quality");
        assert!(flagship_score > fast_score, "flagship should outrank fast for quality/reasoning");
    }

    #[test]
    fn recommend_latency_prefers_fast_for_code() {
        let flagship = json!({"id": "openai/gpt-5-mini", "name": "GPT-5 Mini", "provider": "openai", "description": "Everyday reasoning and writing", "tier": "standard", "supports_effort": true });
        let fast = json!({"id": "openai/gpt-5-nano", "name": "GPT-5 Nano", "provider": "openai", "description": "Fastest for quick answers", "tier": "fast", "supports_effort": false });

        let (standard_score, _) = score_model_for_task(&flagship, "code", "latency");
        let (fast_score, _) = score_model_for_task(&fast, "code", "latency");
        assert!(fast_score > standard_score, "fast tier should outrank standard for latency/code");
    }

    #[test]
    fn recommend_code_boosts_coding_models() {
        let code_model = json!({"id": "codex-cli/codex-mini-latest", "name": "Codex Mini", "provider": "codex-cli", "description": "Coding-focused brain", "tier": "standard", "supports_effort": false });
        let chat_model = json!({"id": "anthropic/claude-haiku-4-5", "name": "Claude Haiku 4.5", "provider": "anthropic", "description": "Fastest for quick answers", "tier": "fast", "supports_effort": true });

        let (code_score, _) = score_model_for_task(&code_model, "code", "quality");
        let (chat_score, _) = score_model_for_task(&chat_model, "code", "quality");
        assert!(code_score > chat_score, "codex should outrank a chat-fast model for code");
    }
}
