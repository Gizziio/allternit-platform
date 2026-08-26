//! Agent session routes backed by Gizzi runtime sessions.
//!
//! The frontend session store expects `/api/v1/agent-sessions`, but the actual
//! runtime contract lives on Gizzi under `/v1/session/*` plus `/v1/event`.
//! These handlers translate the frontend contract to the Gizzi contract so the
//! Rust API remains a thin gateway instead of becoming a competing session DB.

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{sse::Sse, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures::Stream;
use reqwest::Client;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, sync::Arc};
use tracing::warn;

use crate::config::{read_gizzi_default_harness, AppConfig};
use crate::db::DbHandle;
use crate::AppState;

pub fn gizzi_base() -> String {
    // Reload from disk each time so runtime URL changes (wizard, settings) take
    // effect without an API restart.
    AppConfig::load()
        .terminal_server_url()
        .trim_end_matches('/')
        .to_string()
}

pub(crate) fn gizzi_client(headers: &HeaderMap) -> Client {
    let mut builder = Client::builder();
    let mut default_headers = reqwest::header::HeaderMap::new();

    // The platform API and Gizzi have separate auth boundaries. A Clerk bearer
    // token authenticates the browser to this API, but a password-protected
    // Gizzi daemon expects Basic auth. Never forward the Clerk token upstream.
    let gizzi_password = std::env::var("GIZZI_PASSWORD")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::var("GIZZI_SERVER_PASSWORD")
                .ok()
                .filter(|value| !value.is_empty())
        });
    if let Some(password) = gizzi_password {
        let username = std::env::var("GIZZI_USERNAME")
            .or_else(|_| std::env::var("GIZZI_SERVER_USERNAME"))
            .unwrap_or_else(|_| "gizzi".to_string());
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        let encoded = STANDARD.encode(format!("{username}:{password}"));
        if let Ok(value) = reqwest::header::HeaderValue::from_str(&format!("Basic {encoded}")) {
            default_headers.insert(reqwest::header::AUTHORIZATION, value);
        }
    } else if let Some(auth) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .filter(|value| value.starts_with("Basic "))
    {
        // Desktop callers may already have the daemon's Basic credentials.
        if let Ok(value) = reqwest::header::HeaderValue::from_str(auth) {
            default_headers.insert(reqwest::header::AUTHORIZATION, value);
        }
    }

    if !default_headers.is_empty() {
        builder = builder.default_headers(default_headers);
    }
    builder.build().unwrap_or_else(|_| Client::new())
}

/// Verify that the requested agent is allowed to run on the requested surface.
/// Returns `Ok(())` when allowed, or `Err(message)` when blocked.
fn agent_allowed_on_surface(
    db: &DbHandle,
    agent_id: &str,
    surface: Option<&str>,
) -> Result<(), String> {
    let Some(surface) = surface else {
        return Ok(());
    };

    let conn = db.connect().map_err(|e| e.to_string())?;
    let enabled: Option<String> = conn
        .query_row(
            "SELECT enabled_modes FROM agents WHERE id = ?1",
            params![agent_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let Some(enabled) = enabled else {
        return Err(format!("Agent {} not found", agent_id));
    };

    let modes: Vec<String> = serde_json::from_str(&enabled).unwrap_or_default();
    // Normalize surface names: gizzi uses some different names.
    let normalized_surface = match surface {
        "chat" | "cowork" | "code" | "browser" | "design" => surface,
        _ => surface,
    };

    if modes.iter().any(|m| m == normalized_surface || m == "all") {
        Ok(())
    } else {
        Err(format!(
            "Agent {} is not enabled for surface '{}'",
            agent_id, normalized_surface
        ))
    }
}

pub fn agent_session_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agent-sessions", get(list_sessions).post(create_session))
        .route(
            "/agent-sessions/:id",
            get(get_session)
                .patch(update_session)
                .delete(delete_session),
        )
        .route(
            "/agent-sessions/:id/messages",
            get(list_messages).post(send_message),
        )
        .route("/agent-sessions/:id/abort", post(abort_session))
        .route("/agent-sessions/:id/revert", post(revert_session))
        .route("/agent-sessions/:id/unrevert", post(unrevert_session))
        .route("/agent-sessions/:id/compact", post(compact_session))
        .route("/agent-sessions/sync", get(sync_sessions))
}

#[derive(Debug, Deserialize)]
struct CreateSessionBody {
    name: Option<String>,
    agent_id: Option<String>,
    #[allow(dead_code)]
    agent_name: Option<String>,
    origin_surface: Option<String>,
    /// Incognito chat: an ephemeral session excluded from list responses and
    /// purged on abort. Also accepted as `metadata.ephemeral` (bool or the
    /// string "true") for clients that only carry a metadata bag.
    ephemeral: Option<bool>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct UpdateSessionBody {
    name: Option<String>,
    active: Option<bool>,
    origin_surface: Option<String>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct SendMessageBody {
    text: String,
    role: Option<String>,
    thinking: Option<String>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct GizziModelRef {
    #[serde(rename = "providerID")]
    provider_id: String,
    #[serde(rename = "modelID")]
    model_id: String,
}

#[derive(Debug, Deserialize)]
struct GizziSessionInfo {
    id: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(rename = "projectID", default)]
    project_id: Option<String>,
    #[serde(default)]
    directory: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(rename = "agentID", default)]
    agent_id: Option<String>,
    #[serde(default)]
    surface: Option<String>,
    #[serde(default)]
    permission: Option<serde_json::Value>,
    #[serde(default)]
    time: Option<GizziTimeInfo>,
}

#[derive(Debug, Deserialize)]
struct GizziTimeInfo {
    created: Option<i64>,
    updated: Option<i64>,
    archived: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct GizziMessage {
    info: GizziMessageInfo,
    #[serde(default)]
    parts: Vec<GizziMessagePart>,
}

#[derive(Debug, Deserialize)]
struct GizziMessageInfo {
    id: String,
    #[serde(rename = "sessionID")]
    _session_id: String,
    role: String,
    #[serde(default)]
    time: Option<GizziMessageTimeInfo>,
    #[serde(default)]
    agent: Option<String>,
    #[serde(default)]
    model: Option<serde_json::Value>,
    #[serde(default)]
    error: Option<GizziMessageError>,
}

#[derive(Debug, Deserialize)]
struct GizziMessageTimeInfo {
    created: Option<i64>,
    completed: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct GizziMessageError {
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct GizziMessagePart {
    #[serde(rename = "type")]
    part_type: String,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    filename: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    tool: Option<String>,
    #[serde(default)]
    state: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct GizziBusEvent {
    #[serde(rename = "type", default)]
    event_type: Option<String>,
    #[serde(default)]
    properties: Option<serde_json::Value>,
}

fn to_iso(timestamp_ms: Option<i64>) -> String {
    if let Some(ms) = timestamp_ms {
        if let Some(dt) = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms) {
            return dt.to_rfc3339();
        }
    }
    chrono::Utc::now().to_rfc3339()
}

fn transform_session(info: GizziSessionInfo, db: &DbHandle) -> serde_json::Value {
    let created_at = to_iso(info.time.as_ref().and_then(|t| t.created));
    let updated_at = to_iso(info.time.as_ref().and_then(|t| t.updated.or(t.created)));

    // Restore the original frontend surface if the API normalized it before
    // sending to Gizzi (e.g. "design" -> "chat").
    let origin_surface = db
        .get_session_origin_surface(&info.id)
        .ok()
        .flatten()
        .or_else(|| info.surface.clone())
        .unwrap_or_default();

    json!({
        "id": info.id,
        "name": info.title,
        "description": serde_json::Value::Null,
        "created_at": created_at,
        "updated_at": updated_at,
        "last_accessed": updated_at,
        "message_count": 0,
        "active": info.time.as_ref().and_then(|t| t.archived).is_none(),
        "tags": Vec::<String>::new(),
        "metadata": {
            "project_id": info.project_id,
            "directory": info.directory,
            "version": info.version,
            "agent_id": info.agent_id,
            "surface": info.surface,
            "originSurface": origin_surface,
            "permission": info.permission,
            // Incognito chats (Phase 6): surfaced so clients can filter
            // defensively even against list responses that predate the
            // server-side exclusion.
            "ephemeral": db.is_session_ephemeral(&info.id).unwrap_or(false),
        }
    })
}

fn extract_message_content(parts: &[GizziMessagePart]) -> String {
    let mut text_parts = Vec::new();
    for part in parts {
        match part.part_type.as_str() {
            // `reasoning` is deliberately excluded — it ships separately as
            // `thinking` (extract_reasoning); including it here rendered the
            // thought stream twice (once in the bubble, once in the block).
            "text" | "agent" => {
                if let Some(text) = &part.text {
                    text_parts.push(text.clone());
                }
            }
            "file" => text_parts.push(format!(
                "[File {}]",
                part.filename
                    .clone()
                    .or_else(|| part.url.clone())
                    .unwrap_or_else(|| "attachment".to_string())
            )),
            "tool" => {
                if let Some(tool) = &part.tool {
                    text_parts.push(format!("[Tool {}]", tool));
                }
            }
            _ => {}
        }
    }

    if text_parts.is_empty() {
        String::new()
    } else {
        text_parts.join("\n")
    }
}

fn extract_reasoning(parts: &[GizziMessagePart]) -> Option<String> {
    let reasoning = parts
        .iter()
        .filter(|part| part.part_type == "reasoning")
        .filter_map(|part| part.text.clone())
        .collect::<Vec<_>>()
        .join("\n");
    if reasoning.is_empty() {
        None
    } else {
        Some(reasoning)
    }
}

fn transform_message(message: GizziMessage) -> serde_json::Value {
    let content = extract_message_content(&message.parts);
    let content = if content.is_empty() {
        message
            .info
            .error
            .as_ref()
            .and_then(|e| e.message.clone())
            .unwrap_or_else(|| "[No text content]".to_string())
    } else {
        content
    };

    json!({
        "id": message.info.id,
        "role": message.info.role,
        "content": content,
        "thinking": extract_reasoning(&message.parts),
        "timestamp": to_iso(
            message
                .info
                .time
                .as_ref()
                .and_then(|t| t.completed.or(t.created)),
        ),
        "metadata": {
            "agent": message.info.agent,
            "model": message.info.model,
            "parts": message.parts,
            "error": message.info.error.as_ref().and_then(|e| e.data.clone()),
        }
    })
}

/// Gizzi's compiled server currently only accepts a fixed set of surface values.
/// Map unsupported frontend surfaces to a compatible fallback while preserving
/// the original value in API metadata (see `session_origin_surface` table).
fn normalize_surface_for_gizzi(surface: &str) -> &str {
    match surface {
        "design" => "chat",
        other => other,
    }
}

fn select_model(metadata: Option<&serde_json::Value>) -> serde_json::Value {
    if let Some(model) = metadata
        .and_then(|value| value.get("model"))
        .and_then(|value| value.as_object())
    {
        if let (Some(provider_id), Some(model_id)) = (
            model.get("providerID").and_then(|value| value.as_str()),
            model.get("modelID").and_then(|value| value.as_str()),
        ) {
            return json!(GizziModelRef {
                provider_id: provider_id.to_string(),
                model_id: model_id.to_string(),
            });
        }
    }

    if let Some((provider_id, model_id)) = metadata.and_then(|value| {
        Some((
            value.get("providerID")?.as_str()?,
            value.get("modelID")?.as_str()?,
        ))
    }) {
        return json!(GizziModelRef {
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
        });
    }

    let (provider_id, model_id) = AppConfig::load().default_model();
    json!(GizziModelRef {
        provider_id,
        model_id
    })
}

async fn gizzi_json<T: serde::de::DeserializeOwned>(
    client: &Client,
    method: reqwest::Method,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<T, Response> {
    let url = format!("{}{}", gizzi_base(), path);
    let mut request = client.request(method, &url);
    if let Some(payload) = body {
        request = request.json(&payload);
    }
    let response = request.send().await.map_err(|error| {
        warn!("Gizzi request failed: {}", error);
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("Gizzi request failed: {}", error) })),
        )
            .into_response()
    })?;

    if !response.status().is_success() {
        let status =
            StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Upstream error".to_string());
        return Err((status, Json(json!({ "error": body }))).into_response());
    }

    response.json::<T>().await.map_err(|error| {
        warn!("Failed to decode Gizzi response: {}", error);
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("Failed to decode Gizzi response: {}", error) })),
        )
            .into_response()
    })
}

async fn gizzi_no_content(
    client: &Client,
    method: reqwest::Method,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<(), Response> {
    let url = format!("{}{}", gizzi_base(), path);
    let mut request = client.request(method, &url);
    if let Some(payload) = body {
        request = request.json(&payload);
    }
    let response = request.send().await.map_err(|error| {
        warn!("Gizzi request failed: {}", error);
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("Gizzi request failed: {}", error) })),
        )
            .into_response()
    })?;

    if !response.status().is_success() {
        let status =
            StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Upstream error".to_string());
        return Err((status, Json(json!({ "error": body }))).into_response());
    }

    Ok(())
}

async fn list_sessions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let sessions = match gizzi_json::<Vec<GizziSessionInfo>>(
        &client,
        reqwest::Method::GET,
        "/v1/session/list",
        None,
    )
    .await
    {
        Ok(data) => data,
        Err(response) => return response,
    };

    let surface_filter = query.get("surface").cloned();
    let project_filter = query.get("project_id").cloned();
    // Phase 8 chat search: `q` — case-insensitive substring ("LIKE %q%")
    // over the session title AND message content, mirroring the
    // surface/project filters. Title comes from the list payload; content
    // needs a per-session messages fetch, done lazily and only for sessions
    // whose title didn't already match. Older clients never send `q`.
    let text_filter = query
        .get("q")
        .map(|q| q.trim().to_lowercase())
        .filter(|q| !q.is_empty());
    let mut filtered = Vec::new();
    for session in sessions {
        // Incognito chats never appear in history (Phase 6). The backing
        // record is purged on abort; this filter also covers sessions whose
        // client never aborted. TODO: add a TTL sweep that purges ephemeral
        // sessions older than a threshold (e.g. 24h) so abandoned records
        // don't linger in Gizzi.
        if state.db.is_session_ephemeral(&session.id).unwrap_or(false) {
            continue;
        }
        let session_id = session.id.clone();
        let transformed = transform_session(session, &state.db);
        let surface_matches = surface_filter.as_ref().map_or(true, |sf| {
            transformed
                .get("metadata")
                .and_then(|m| m.get("originSurface"))
                .and_then(|v| v.as_str())
                == Some(sf.as_str())
        });
        let project_matches = project_filter.as_ref().map_or(true, |pf| {
            transformed
                .get("metadata")
                .and_then(|m| m.get("project_id"))
                .and_then(|v| v.as_str())
                == Some(pf.as_str())
        });
        if surface_matches && project_matches {
            if let Some(q) = &text_filter {
                let title_matches = transformed
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map_or(false, |name| name.to_lowercase().contains(q.as_str()));
                if !title_matches {
                    // Content half of the `q` filter: fetch the session's
                    // messages and substring-match their extracted text
                    // (same extraction as transform_message). A failed fetch
                    // excludes the session rather than erroring the search.
                    let path = format!(
                        "/v1/session/{}/messages",
                        urlencoding::encode(&session_id)
                    );
                    let content_matches = match gizzi_json::<Vec<GizziMessage>>(
                        &client,
                        reqwest::Method::GET,
                        &path,
                        None,
                    )
                    .await
                    {
                        Ok(messages) => messages.iter().any(|message| {
                            extract_message_content(&message.parts)
                                .to_lowercase()
                                .contains(q.as_str())
                        }),
                        Err(_) => false,
                    };
                    if !content_matches {
                        continue;
                    }
                }
            }
            filtered.push(transformed);
        }
    }

    Json(json!({
        "sessions": filtered,
        "count": filtered.len()
    }))
    .into_response()
}

async fn resolve_agent_harness(db: &DbHandle, agent_id: &str) -> Option<serde_json::Value> {
    let db = db.clone();
    let agent_id = agent_id.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect().ok()?;
        let harness: String = conn
            .query_row(
                "SELECT harness_config FROM agents WHERE id = ?1",
                params![agent_id],
                |row| row.get(0),
            )
            .ok()?;
        serde_json::from_str::<serde_json::Value>(&harness).ok()
    })
    .await
    .ok()
    .flatten()
}

async fn create_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CreateSessionBody>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let mut payload = serde_json::Map::new();
    payload.insert(
        "title".to_string(),
        json!(body.name.unwrap_or_else(|| "New Session".to_string())),
    );
    let surface = body.origin_surface.or_else(|| {
        body.metadata
            .as_ref()
            .and_then(|m| m.get("surface"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    if let Some(ref s) = surface {
        payload.insert("surface".to_string(), json!(normalize_surface_for_gizzi(s)));
    }

    // Stamp the composer-selected cowork project onto the gizzi session so
    // list/get responses (`metadata.project_id`) can group chats by project.
    // Clients send it as `metadata.projectId`; accept snake_case too.
    if let Some(project_id) = body
        .metadata
        .as_ref()
        .and_then(|m| m.get("projectId").or_else(|| m.get("project_id")))
        .and_then(|v| v.as_str())
    {
        payload.insert("project_id".to_string(), json!(project_id));
    }

    // Incognito chat (Phase 6): `ephemeral: true` top-level or in metadata
    // (bool or "true"). Ephemeral sessions are excluded from list responses,
    // purged on abort, and MUST be skipped by any memory-consolidation hook
    // (none exists in this create path today — keep it that way).
    let ephemeral = body.ephemeral.unwrap_or(false)
        || body
            .metadata
            .as_ref()
            .and_then(|m| m.get("ephemeral"))
            .map_or(false, |v| {
                v.as_bool().unwrap_or(false) || v.as_str() == Some("true")
            });

    // Always set the platform default model so Gizzi sessions know which brain
    // to use, even when the frontend doesn't send an explicit model.
    let (default_provider, default_model_id) = AppConfig::load().default_model();
    payload.insert(
        "model".to_string(),
        json!(GizziModelRef {
            provider_id: default_provider,
            model_id: default_model_id,
        }),
    );

    // Resolve platform agent harness config and forward it into the gizzi session.
    if let Some(ref agent_id) = body.agent_id {
        if let Err(err) = agent_allowed_on_surface(&state.db, agent_id, surface.as_deref()) {
            return (StatusCode::FORBIDDEN, Json(json!({"error": err}))).into_response();
        }
        payload.insert("agentID".to_string(), json!(agent_id));
    }
    let agent_harness = if let Some(ref agent_id) = body.agent_id {
        resolve_agent_harness(&state.db, agent_id).await
    } else {
        // Fall back to the brain configured in the Gizzi runtime so regular
        // (non-agent) sessions still route through the user's chosen provider.
        read_gizzi_default_harness()
    };

    // Provider credentials remain inside Gizzi. Only non-secret harness
    // configuration crosses this gateway boundary.
    if let Some(harness) = agent_harness {
        payload.insert("harness".to_string(), harness);
    }
    let session = match gizzi_json::<GizziSessionInfo>(
        &client,
        reqwest::Method::POST,
        "/v1/session",
        Some(serde_json::Value::Object(payload)),
    )
    .await
    {
        Ok(data) => data,
        Err(response) => return response,
    };

    // Remember the original surface so list/get responses can restore it.
    if let Some(ref s) = surface {
        let _ = state.db.set_session_origin_surface(&session.id, s);
    }
    if ephemeral {
        let _ = state.db.set_session_ephemeral(&session.id);
    }

    (
        StatusCode::CREATED,
        Json(transform_session(session, &state.db)),
    )
        .into_response()
}

async fn get_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}", urlencoding::encode(&session_id));
    match gizzi_json::<GizziSessionInfo>(&client, reqwest::Method::GET, &path, None).await {
        Ok(session) => Json(transform_session(session, &state.db)).into_response(),
        Err(response) => response,
    }
}

async fn update_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Json(body): Json<UpdateSessionBody>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}", urlencoding::encode(&session_id));
    let surface = body.origin_surface.or_else(|| {
        body.metadata
            .as_ref()
            .and_then(|m| m.get("surface"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    let mut payload = serde_json::Map::new();
    if let Some(name) = body.name {
        payload.insert("title".to_string(), json!(name));
    }
    if let Some(active) = body.active {
        payload.insert("archived".to_string(), json!(!active));
    }
    if let Some(ref permission) = body
        .metadata
        .as_ref()
        .and_then(|m| m.get("permission"))
        .cloned()
    {
        payload.insert("permission".to_string(), permission.clone());
    }
    if let Some(ref s) = surface {
        payload.insert("surface".to_string(), json!(normalize_surface_for_gizzi(s)));
    }

    match gizzi_json::<GizziSessionInfo>(
        &client,
        reqwest::Method::PATCH,
        &path,
        Some(serde_json::Value::Object(payload)),
    )
    .await
    {
        Ok(session) => {
            if let Some(ref s) = surface {
                let _ = state.db.set_session_origin_surface(&session.id, s);
            }
            Json(transform_session(session, &state.db)).into_response()
        }
        Err(response) => response,
    }
}

async fn delete_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}", urlencoding::encode(&session_id));
    match gizzi_no_content(&client, reqwest::Method::DELETE, &path, None).await {
        Ok(()) => {
            let _ = state.db.clear_session_ephemeral(&session_id);
            StatusCode::NO_CONTENT.into_response()
        }
        Err(response) => response,
    }
}

async fn list_messages(headers: HeaderMap, Path(session_id): Path<String>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}/messages", urlencoding::encode(&session_id));
    match gizzi_json::<Vec<GizziMessage>>(&client, reqwest::Method::GET, &path, None).await {
        Ok(messages) => Json(
            messages
                .into_iter()
                .map(transform_message)
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(response) => response,
    }
}

async fn send_message(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Json(body): Json<SendMessageBody>,
) -> impl IntoResponse {
    let role = body.role.unwrap_or_else(|| "user".to_string());
    if role != "user" {
        return Json(json!({
            "id": format!("local-{}", uuid::Uuid::new_v4()),
            "role": role,
            "content": body.text,
            "thinking": body.thinking,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "metadata": body.metadata,
        }))
        .into_response();
    }

    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}/message", urlencoding::encode(&session_id));
    let payload = json!({
        "parts": [
            {
                "type": "text",
                "text": body.text,
            }
        ],
        "model": select_model(body.metadata.as_ref()),
    });

    match gizzi_json::<GizziMessage>(&client, reqwest::Method::POST, &path, Some(payload)).await {
        Ok(message) => Json(transform_message(message)).into_response(),
        Err(response) => response,
    }
}

async fn abort_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}/abort", urlencoding::encode(&session_id));
    match gizzi_no_content(&client, reqwest::Method::POST, &path, Some(json!({}))).await {
        Ok(()) => {
            // Incognito chats are purged the moment the session ends/aborts:
            // hard-delete the backing Gizzi record and forget the flag.
            if state.db.is_session_ephemeral(&session_id).unwrap_or(false) {
                let delete_path =
                    format!("/v1/session/{}", urlencoding::encode(&session_id));
                let _ = gizzi_no_content(&client, reqwest::Method::DELETE, &delete_path, None).await;
                let _ = state.db.clear_session_ephemeral(&session_id);
            }
            Json(json!({ "success": true })).into_response()
        }
        Err(response) => response,
    }
}

#[derive(Debug, Deserialize)]
struct RevertSessionBody {
    #[serde(rename = "messageId")]
    message_id: String,
}

/// Reverts file changes made during a session back to a given message, via
/// Gizzi's real `/session/:id/revert` (`SessionRevert.revert`). Previously
/// this just called `get_session` and did nothing. The frontend
/// (`mode-session-store.ts`) feeds the response through `mapBackendSession`,
/// so — like `get_session`/`update_session` — we re-fetch and transform the
/// session afterward rather than passing through Gizzi's revert-result shape.
async fn revert_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Json(body): Json<RevertSessionBody>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let revert_path = format!("/v1/session/{}/revert", urlencoding::encode(&session_id));
    let payload = json!({ "messageID": body.message_id });
    if let Err(response) =
        gizzi_json::<serde_json::Value>(&client, reqwest::Method::POST, &revert_path, Some(payload))
            .await
    {
        return response;
    }
    get_session(State(state), headers, Path(session_id)).await.into_response()
}

/// Undoes a prior revert, via Gizzi's real `/session/:id/unrevert`
/// (`SessionRevert.unrevert`). Previously this just called `get_session` and
/// did nothing. Same re-fetch rationale as `revert_session` above.
async fn unrevert_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let unrevert_path = format!("/v1/session/{}/unrevert", urlencoding::encode(&session_id));
    if let Err(response) =
        gizzi_json::<serde_json::Value>(&client, reqwest::Method::POST, &unrevert_path, None).await
    {
        return response;
    }
    get_session(State(state), headers, Path(session_id)).await.into_response()
}

/// Condenses a session's context, via Gizzi's real `/session/:id/summarize`
/// (`SessionSummary.summarize`). Previously this was a pure no-op (`204`,
/// no work). Note: this is Gizzi's exposed on-demand summarize endpoint, not
/// the same code path as the agent loop's own automatic mid-turn compaction
/// (`SessionCompaction.process`), which is driven by an internal task queue
/// rather than a standalone REST primitive — wiring that would mean
/// synthesizing a compaction task into the session's turn loop, not just
/// proxying a request.
async fn compact_session(headers: HeaderMap, Path(session_id): Path<String>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}/summarize", urlencoding::encode(&session_id));
    match gizzi_json::<serde_json::Value>(&client, reqwest::Method::POST, &path, None).await {
        Ok(result) => Json(result).into_response(),
        Err(response) => response,
    }
}

struct ParsedSseBlock {
    id: Option<String>,
    data: String,
}

fn parse_sse_block(block: &str) -> Option<ParsedSseBlock> {
    let mut id = None;
    let mut data_lines = Vec::new();

    for line in block.lines() {
        if let Some(value) = line.strip_prefix("id:") {
            id = Some(value.trim_start().to_string());
        } else if let Some(value) = line.strip_prefix("data:") {
            data_lines.push(value.trim_start().to_string());
        }
    }

    if data_lines.is_empty() {
        None
    } else {
        Some(ParsedSseBlock {
            id,
            data: data_lines.join("\n"),
        })
    }
}

async fn fetch_latest_message(client: &Client, session_id: &str) -> Option<serde_json::Value> {
    let path = format!("/v1/session/{}/messages", urlencoding::encode(session_id));
    let messages = gizzi_json::<Vec<GizziMessage>>(client, reqwest::Method::GET, &path, None)
        .await
        .ok()?;
    messages.into_iter().last().map(transform_message)
}

async fn transform_bus_event(
    client: &Client,
    db: &DbHandle,
    event: GizziBusEvent,
) -> Option<serde_json::Value> {
    let event_type = event.event_type?;
    let props = event.properties.unwrap_or(serde_json::Value::Null);

    match event_type.as_str() {
        "session.created" => serde_json::from_value::<GizziSessionInfo>(props)
            .ok()
            .map(|info| {
                let mut payload = transform_session(info, db);
                if let Some(obj) = payload.as_object_mut() {
                    obj.insert("type".to_string(), json!("created"));
                }
                payload
            }),
        "session.updated" => serde_json::from_value::<GizziSessionInfo>(props)
            .ok()
            .map(|info| {
                let origin_surface = db
                    .get_session_origin_surface(&info.id)
                    .ok()
                    .flatten()
                    .or_else(|| info.surface.clone())
                    .unwrap_or_default();
                json!({
                    "type": "updated",
                    "session_id": info.id,
                    "name": info.title,
                    "description": serde_json::Value::Null,
                    "active": info.time.as_ref().and_then(|t| t.archived).is_none(),
                    "tags": Vec::<String>::new(),
                    "metadata": {
                        "project_id": info.project_id,
                        "directory": info.directory,
                        "version": info.version,
                        "agent_id": info.agent_id,
                        "surface": info.surface,
                        "originSurface": origin_surface,
                        "permission": info.permission,
                    }
                })
            }),
        "session.deleted" => serde_json::from_value::<GizziSessionInfo>(props)
            .ok()
            .map(|info| json!({ "type": "deleted", "session_id": info.id })),
        "message.updated" => {
            let session_id = props
                .get("info")
                .and_then(|info| info.get("sessionID"))
                .and_then(|value| value.as_str())?;
            let latest = fetch_latest_message(client, session_id).await?;
            let mut payload = latest;
            if let Some(obj) = payload.as_object_mut() {
                obj.insert("type".to_string(), json!("message_added"));
                obj.insert("session_id".to_string(), json!(session_id));
            }
            Some(payload)
        }
        "permission.asked" => Some(json!({
            "type": "permission_asked",
            "request_id": props.get("id"),
            "session_id": props.get("sessionID"),
            "permission": props.get("permission"),
            "patterns": props.get("patterns"),
            "metadata": props.get("metadata"),
            "always": props.get("always"),
            "tool": props.get("tool"),
        })),
        "permission.replied" => Some(json!({
            "type": "permission_replied",
            "request_id": props.get("requestID"),
            "session_id": props.get("sessionID"),
            "reply": props.get("reply"),
        })),
        "question.asked" => Some(json!({
            "type": "question_asked",
            "request_id": props.get("id"),
            "session_id": props.get("sessionID"),
            "questions": props.get("questions"),
        })),
        "message.part.updated" => Some(json!({
            "type": "part_updated",
            "session_id": props.get("sessionID"),
            "message_id": props.get("messageID"),
            "part": props.get("part"),
        })),
        "message.part.delta" => Some(json!({
            "type": "part_delta",
            "session_id": props.get("sessionID"),
            "message_id": props.get("messageID"),
            "part_id": props.get("partID"),
            "field": props.get("field"),
            "delta": props.get("delta"),
        })),
        "message.part.removed" => Some(json!({
            "type": "part_removed",
            "session_id": props.get("sessionID"),
            "message_id": props.get("messageID"),
            "part_id": props.get("partID"),
        })),
        _ => None,
    }
}

async fn sync_sessions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<
    Sse<impl Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>>,
    Response,
> {
    let client = gizzi_client(&headers);

    // A browser EventSource that dropped and auto-reconnected sends back the
    // last `id:` it saw via Last-Event-ID. Forward it upstream so Gizzi can
    // replay the events published during the gap instead of the client
    // silently missing them (see Bus.historySince in gizzi-code).
    let last_event_id = headers
        .get("last-event-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let mut request = client
        .get(format!("{}/v1/event", gizzi_base()))
        .header("Accept", "text/event-stream");
    if let Some(ref id) = last_event_id {
        request = request.header("Last-Event-ID", id.as_str());
    }

    let response = request
        .send()
        .await
        .map_err(|error| {
            warn!("Failed to open Gizzi event stream: {}", error);
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Failed to open Gizzi event stream: {}", error) })),
            )
                .into_response()
        })?;

    if !response.status().is_success() {
        let status =
            StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Upstream error".to_string());
        return Err((status, Json(json!({ "error": body }))).into_response());
    }

    let stream = async_stream::stream! {
        yield Ok(axum::response::sse::Event::default().comment("connected"));

        let mut buffer = String::new();
        let mut upstream = response.bytes_stream();

        while let Some(chunk) = futures::StreamExt::next(&mut upstream).await {
            let chunk = match chunk {
                Ok(bytes) => bytes,
                Err(error) => {
                    warn!("Gizzi event stream read failed: {}", error);
                    break;
                }
            };

            buffer.push_str(&String::from_utf8_lossy(&chunk));
            let mut blocks = buffer
                .split("\n\n")
                .map(str::to_string)
                .collect::<Vec<_>>();
            buffer = blocks.pop().unwrap_or_default();

            for block in blocks {
                let Some(parsed_block) = parse_sse_block(&block) else {
                    continue;
                };
                let block_id = parsed_block.id;

                let Ok(parsed) = serde_json::from_str::<GizziBusEvent>(&parsed_block.data) else {
                    continue;
                };

                if parsed.event_type.as_deref() == Some("server.heartbeat") {
                    yield Ok(axum::response::sse::Event::default().comment("heartbeat"));
                    continue;
                }

                if let Some(payload) = transform_bus_event(&client, &state.db, parsed).await {
                    let mut event = axum::response::sse::Event::default().data(payload.to_string());
                    if let Some(id) = block_id {
                        event = event.id(id);
                    }
                    yield Ok(event);
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}
