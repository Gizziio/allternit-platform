
//! Provider API routes — LLM provider discovery and management.

use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;

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
        .route("/providers/auth/status", get(list_provider_auth_status))
        .route("/provider/ollama/models", get(list_ollama_models))
}

// ─── Data models ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
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
    auth_required: bool,
    auth_profile_id: Option<String>,
    chat_profile_ids: Vec<String>,
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

// ─── List providers ───────────────────────────────────────────────────────────

async fn list_providers(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
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

    let providers: Vec<ProviderRow> = match rows.collect::<Result<Vec<_>, _>>() {
        Ok(p) => p,
        Err(e) => return db_error(e),
    };

    Json(json!({ "providers": providers })).into_response()
}

// ─── Get provider ─────────────────────────────────────────────────────────────

async fn get_provider(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };

    let provider: Option<ProviderRow> = match conn.query_row(
        "SELECT id, name, provider_type, base_url, api_key_env_var, models FROM providers WHERE id = ?1",
        rusqlite::params![id],
        row_to_provider,
    ) {
        Ok(p) => Some(p),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return db_error(e),
    };

    match provider {
        Some(p) => Json(json!({ "provider": p })).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response(),
    }
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
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

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
            })).into_response()
        }
    }
}

async fn list_provider_auth_status(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };

    let mut stmt = match conn.prepare(
        "SELECT id, provider_type, api_key_env_var FROM providers ORDER BY name"
    ) {
        Ok(s) => s,
        Err(e) => return db_error(e),
    };

    let rows = match stmt.query_map([], |row| {
        let provider_id: String = row.get(0)?;
        let provider_type: String = row.get(1)?;
        let api_key_env_var: Option<String> = row.get(2)?;
        let api_key_set = api_key_env_var
            .as_deref()
            .map(|var| std::env::var(var).is_ok())
            .unwrap_or(false);
        let is_local = provider_type == "local";
        let status = if is_local || api_key_set {
            "ok"
        } else {
            "missing"
        };

        Ok::<_, rusqlite::Error>(ProviderAuthStatusRow {
            provider_id: provider_id.clone(),
            status: status.to_string(),
            auth_required: !is_local,
            auth_profile_id: (!is_local).then(|| format!("{provider_id}-auth")),
            chat_profile_ids: if is_local || api_key_set {
                vec![format!("{provider_id}-default")]
            } else {
                Vec::new()
            },
        })
    }) {
        Ok(r) => r,
        Err(e) => return db_error(e),
    };

    let providers: Vec<ProviderAuthStatusRow> = match rows.collect::<Result<Vec<_>, _>>() {
        Ok(p) => p,
        Err(e) => return db_error(e),
    };

    Json(json!({ "providers": providers })).into_response()
}
