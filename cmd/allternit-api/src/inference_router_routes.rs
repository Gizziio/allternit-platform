//! Inference Router settings API
//!
//! GET/PUT /api/v1/inference-router — per-user local CLI provider routing
//! preferences. Persisted to `~/.allternit/config.json` under the
//! `inferenceRouter` key so the settings survive backend restarts.

use axum::{
    extract::{Extension, Json, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::cli_provider_detector::detect_all;
use crate::config::{save_user_config, AppConfig, InferenceRouterConfig, UserConfig};
use crate::inference_router_executor::{execute_routed_turn, RoutedTurnResult};
use crate::AppState;

const SUPPORTED_PROVIDERS: [&str; 5] = ["codex", "claude-code", "cursor", "openrouter", "kimi"];

pub fn inference_router_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/inference-router", get(get_inference_router).put(set_inference_router))
        .route("/inference-router/cli-status", get(get_cli_status))
        .route("/inference-router/execute", post(execute_routed_turn_handler))
        .route("/inference-router/usage", get(get_routed_usage))
}

#[derive(Deserialize)]
struct SetInferenceRouterBody {
    provider: Option<String>,
    #[serde(rename = "defaultModel")]
    default_model: Option<String>,
    #[serde(rename = "localSandbox")]
    local_sandbox: Option<bool>,
    options: Option<serde_json::Map<String, serde_json::Value>>,
}

fn default_router() -> InferenceRouterConfig {
    InferenceRouterConfig {
        provider: Some("codex".to_string()),
        default_model: None,
        local_sandbox: Some(false),
        options: Some(serde_json::Map::new()),
    }
}

// ─── GET /inference-router ──────────────────────────────────────────────────

async fn get_inference_router(
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let _ = user.user_id;

    let router = tokio::task::spawn_blocking(|| {
        let config = AppConfig::load();
        config.user.inference_router.unwrap_or_else(default_router)
    })
    .await
    .unwrap_or_else(|_| default_router());

    Json(json!({
        "provider": router.provider,
        "defaultModel": router.default_model,
        "localSandbox": router.local_sandbox.unwrap_or(false),
        "options": router.options.unwrap_or_default(),
    }))
    .into_response()
}

// ─── PUT /inference-router ──────────────────────────────────────────────────

async fn set_inference_router(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<SetInferenceRouterBody>,
) -> impl IntoResponse {
    let _ = user.user_id;

    if let Some(ref provider) = body.provider {
        if !SUPPORTED_PROVIDERS.contains(&provider.as_str()) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "invalid_provider",
                    "supported_providers": SUPPORTED_PROVIDERS,
                })),
            )
                .into_response();
        }
    }

    let mut config = state.config.user.clone();
    let current = config.inference_router.unwrap_or_else(default_router);

    config.inference_router = Some(InferenceRouterConfig {
        provider: body.provider.or(current.provider),
        default_model: body.default_model.or(current.default_model),
        local_sandbox: body.local_sandbox.or(current.local_sandbox),
        options: body.options.or(current.options),
    });

    if let Err(e) = save_user_config(&config) {
        warn!(error = %e, "Failed to save inference router config");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response();
    }

    let updated = tokio::task::spawn_blocking(|| {
        let config = AppConfig::load();
        config.user.inference_router.unwrap_or_else(default_router)
    })
    .await
    .unwrap_or_else(|_| default_router());

    Json(json!({
        "provider": updated.provider,
        "defaultModel": updated.default_model,
        "localSandbox": updated.local_sandbox.unwrap_or(false),
        "options": updated.options.unwrap_or_default(),
    }))
    .into_response()
}

// ─── GET /inference-router/cli-status ───────────────────────────────────────

async fn get_cli_status(
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let _ = user.user_id;

    let statuses = detect_all().await;

    Json(json!({
        "providers": statuses,
    }))
    .into_response()
}

// ─── POST /inference-router/execute ─────────────────────────────────────────

#[derive(Deserialize)]
struct ExecuteRoutedTurnBody {
    provider: String,
    prompt: String,
    #[serde(rename = "systemPrompt")]
    system_prompt: Option<String>,
}

async fn execute_routed_turn_handler(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<ExecuteRoutedTurnBody>,
) -> impl IntoResponse {
    let _ = user.user_id;

    if !SUPPORTED_PROVIDERS.contains(&body.provider.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "invalid_provider",
                "supported_providers": SUPPORTED_PROVIDERS,
            })),
        )
            .into_response();
    }

    let start = std::time::Instant::now();
    let result = execute_routed_turn(&body.provider, &body.prompt, body.system_prompt.as_deref(), None).await;
    let latency_ms = start.elapsed().as_millis() as i64;

    if result.error.is_none() {
        if let Err(e) = record_routed_usage(&state.db, &user, &result, latency_ms) {
            warn!(error = %e, "Failed to record routed turn usage");
        }
    }

    Json(json!({
        "provider": result.provider,
        "output": result.output,
        "exitCode": result.exit_code,
        "error": result.error,
        "usage": result.usage,
    }))
    .into_response()
}

// ─── Usage recording and query ──────────────────────────────────────────────

fn record_routed_usage(
    db: &crate::db::DbHandle,
    user: &AuthUser,
    result: &RoutedTurnResult,
    latency_ms: i64,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    let usage = result.usage.as_ref();
    let row_id = uuid::Uuid::new_v4().to_string();
    let status = if result.error.is_some() { "error" } else { "ok" };
    let model_id = match result.provider.as_str() {
        "codex" => Some("openai/codex"),
        "claude-code" => Some("anthropic/claude-code"),
        "kimi" => Some("moonshot/kimi-code-cli"),
        _ => None,
    };
    conn.execute(
        "INSERT INTO llm_usage_events
            (id, user_id, tenant_id, provider_id, model_id, prompt_tokens,
             completion_tokens, reasoning_tokens, cached_tokens, cost_microdollars,
             latency_ms, status, error_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, CURRENT_TIMESTAMP)",
        rusqlite::params![
            row_id,
            user.user_id,
            user.tenant_id.as_ref().unwrap_or(&String::new()),
            result.provider,
            model_id,
            usage.map(|u| u.input_tokens).unwrap_or(0),
            usage.map(|u| u.output_tokens).unwrap_or(0),
            usage.map(|u| u.reasoning_tokens).unwrap_or(0),
            usage.map(|u| u.cached_input_tokens).unwrap_or(0),
            0i64,
            latency_ms,
            status,
            result.error.as_ref().map(|_| "routed_cli_error"),
        ],
    )?;
    Ok(())
}

#[derive(Deserialize)]
struct RoutedUsageQuery {
    #[serde(default = "default_usage_limit")]
    limit: u32,
}

fn default_usage_limit() -> u32 {
    50
}

pub fn query_routed_usage(db: &crate::db::DbHandle, user_id: &str, limit: i64) -> Result<Vec<Value>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, provider_id, model_id, prompt_tokens, completion_tokens,
                reasoning_tokens, cached_tokens, latency_ms, status, created_at
         FROM llm_usage_events
         WHERE user_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![user_id, limit], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "provider": row.get::<_, String>(1)?,
            "model": row.get::<_, Option<String>>(2)?,
            "promptTokens": row.get::<_, i64>(3)?,
            "completionTokens": row.get::<_, i64>(4)?,
            "reasoningTokens": row.get::<_, i64>(5)?,
            "cachedTokens": row.get::<_, i64>(6)?,
            "latencyMs": row.get::<_, i64>(7)?,
            "status": row.get::<_, String>(8)?,
            "createdAt": row.get::<_, String>(9)?,
        }))
    })?;
    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}

async fn get_routed_usage(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<RoutedUsageQuery>,
) -> impl IntoResponse {
    let limit = query.limit.min(1000) as i64;
    match tokio::task::spawn_blocking(move || query_routed_usage(&state.db, &user.user_id, limit)).await
    {
        Ok(Ok(events)) => Json(json!({ "events": events })).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "Failed to query routed usage");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "database_error", "message": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "Failed to run routed usage query");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal_error", "message": e.to_string()})),
            )
                .into_response()
        }
    }
}
