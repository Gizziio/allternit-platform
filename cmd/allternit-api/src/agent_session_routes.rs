//! Agent session routes backed by Gizzi runtime sessions.
//!
//! The frontend session store expects `/api/v1/agent-sessions`, but the actual
//! runtime contract lives on Gizzi under `/v1/session/*` plus `/v1/event`.
//! These handlers translate the frontend contract to the Gizzi contract so the
//! Rust API remains a thin gateway instead of becoming a competing session DB.

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response, sse::Sse},
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

use crate::AppState;
use crate::config::{AppConfig, read_gizzi_default_harness};
use crate::db::DbHandle;
use crate::secrets;

fn gizzi_base() -> String {
    // Reload from disk each time so runtime URL changes (wizard, settings) take
    // effect without an API restart.
    AppConfig::load()
        .terminal_server_url()
        .trim_end_matches('/')
        .to_string()
}

fn gizzi_client(headers: &HeaderMap) -> Client {
    let mut builder = Client::builder();
    if let Some(auth) = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
        let mut default_headers = reqwest::header::HeaderMap::new();
        if let Ok(value) = reqwest::header::HeaderValue::from_str(auth) {
            default_headers.insert(reqwest::header::AUTHORIZATION, value);
            builder = builder.default_headers(default_headers);
        }
    }
    builder.build().unwrap_or_else(|_| Client::new())
}

/// Inject provider API keys from the OS keychain into a Gizzi harness.
///
/// The wizard stores keys in the keychain and writes provider metadata (baseURL,
/// npm, models) to the Gizzi config without secrets. At session creation time
/// we merge the key into `harness.byok.keys.{provider}` so Gizzi can authenticate.
fn inject_provider_keys(
    harness: Option<serde_json::Value>,
    provider_id: &str,
) -> Option<serde_json::Value> {
    // Only inject API keys for BYOK-style harnesses. Subprocess, local, and cloud
    // harnesses carry their own auth (CLI env, base URL tokens, OAuth) and must
    // not be converted into a BYOK shape.
    let mode = harness
        .as_ref()
        .and_then(|h| h.get("mode"))
        .and_then(|v| v.as_str())
        .unwrap_or("byok");
    if mode != "byok" {
        return harness;
    }

    let key = secrets::get_secret(&secrets::provider_account(provider_id))?;

    let mut harness = harness.unwrap_or_else(|| {
        json!({
            "mode": "byok",
            "byok": { "keys": {}, "baseURLs": {} }
        })
    });

    let byok = harness
        .as_object_mut()
        .and_then(|obj| obj.get_mut("byok"))
        .and_then(|v| v.as_object_mut())?;

    let keys = byok.entry("keys").or_insert_with(|| json!({}));
    if let Some(keys_obj) = keys.as_object_mut() {
        keys_obj.insert(provider_id.to_string(), json!(key));
    }

    // Ensure harness mode is set to byok when we are injecting keys.
    if let Some(obj) = harness.as_object_mut() {
        obj.entry("mode").or_insert_with(|| json!("byok"));
    }

    Some(harness)
}

/// Extract the provider id from a Gizzi model reference object or a
/// "provider/model" string.
fn provider_id_from_model(model: &serde_json::Value) -> Option<String> {
    if let Some(provider_id) = model.get("providerID").and_then(|v| v.as_str()) {
        return Some(provider_id.to_string());
    }
    if let Some(s) = model.as_str().and_then(|s| s.split_once('/').map(|(p, _)| p)) {
        return Some(s.to_string());
    }
    None
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
            get(get_session).patch(update_session).delete(delete_session),
        )
        .route("/agent-sessions/:id/messages", get(list_messages).post(send_message))
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
    let updated_at = to_iso(
        info.time
            .as_ref()
            .and_then(|t| t.updated.or(t.created)),
    );

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
        }
    })
}

fn extract_message_content(parts: &[GizziMessagePart]) -> String {
    let mut text_parts = Vec::new();
    for part in parts {
        match part.part_type.as_str() {
            "text" | "reasoning" | "agent" => {
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
    json!(GizziModelRef { provider_id, model_id })
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
        let body = response.text().await.unwrap_or_else(|_| "Upstream error".to_string());
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
        let body = response.text().await.unwrap_or_else(|_| "Upstream error".to_string());
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
    let mut filtered = Vec::new();
    for session in sessions {
        let transformed = transform_session(session, &state.db);
        let should_include = surface_filter.as_ref().map_or(true, |sf| {
            transformed
                .get("metadata")
                .and_then(|m| m.get("originSurface"))
                .and_then(|v| v.as_str())
                == Some(sf.as_str())
        });
        if should_include {
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
        payload.insert(
            "surface".to_string(),
            json!(normalize_surface_for_gizzi(s)),
        );
    }

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

    // Determine which provider this session will use so we can inject the
    // user's API key from the OS keychain into the harness.
    let provider_id = agent_harness
        .as_ref()
        .and_then(|h| h.get("model"))
        .and_then(provider_id_from_model)
        .or_else(|| {
            payload
                .get("model")
                .and_then(provider_id_from_model)
        })
        .unwrap_or_else(|| {
            let (provider, _) = AppConfig::load().default_model();
            provider
        });

    let harness = inject_provider_keys(agent_harness, &provider_id);
    if let Some(harness) = harness {
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

    (StatusCode::CREATED, Json(transform_session(session, &state.db))).into_response()
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
    if let Some(ref permission) = body.metadata.as_ref().and_then(|m| m.get("permission")).cloned() {
        payload.insert("permission".to_string(), permission.clone());
    }
    if let Some(ref s) = surface {
        payload.insert("surface".to_string(), json!(normalize_surface_for_gizzi(s)));
    }

    match gizzi_json::<GizziSessionInfo>(&client, reqwest::Method::PATCH, &path, Some(serde_json::Value::Object(payload))).await
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

async fn delete_session(headers: HeaderMap, Path(session_id): Path<String>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}", urlencoding::encode(&session_id));
    match gizzi_no_content(&client, reqwest::Method::DELETE, &path, None).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(response) => response,
    }
}

async fn list_messages(headers: HeaderMap, Path(session_id): Path<String>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}/messages", urlencoding::encode(&session_id));
    match gizzi_json::<Vec<GizziMessage>>(&client, reqwest::Method::GET, &path, None).await {
        Ok(messages) => Json(messages.into_iter().map(transform_message).collect::<Vec<_>>()).into_response(),
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

async fn abort_session(headers: HeaderMap, Path(session_id): Path<String>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}/abort", urlencoding::encode(&session_id));
    match gizzi_no_content(&client, reqwest::Method::POST, &path, Some(json!({}))).await {
        Ok(()) => Json(json!({ "success": true })).into_response(),
        Err(response) => response,
    }
}

async fn revert_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    get_session(State(state), headers, Path(session_id)).await
}

async fn unrevert_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    get_session(State(state), headers, Path(session_id)).await
}

async fn compact_session() -> impl IntoResponse {
    StatusCode::NO_CONTENT
}

fn parse_sse_data_block(block: &str) -> Option<String> {
    let data_lines = block
        .lines()
        .filter_map(|line| line.strip_prefix("data:").map(|value| value.trim_start().to_string()))
        .collect::<Vec<_>>();

    if data_lines.is_empty() {
        None
    } else {
        Some(data_lines.join("\n"))
    }
}

async fn fetch_latest_message(client: &Client, session_id: &str) -> Option<serde_json::Value> {
    let path = format!("/v1/session/{}/messages", urlencoding::encode(session_id));
    let messages =
        gizzi_json::<Vec<GizziMessage>>(client, reqwest::Method::GET, &path, None)
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
) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>>, Response> {
    let client = gizzi_client(&headers);
    let response = client
        .get(format!("{}/v1/event", gizzi_base()))
        .header("Accept", "text/event-stream")
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
        let body = response.text().await.unwrap_or_else(|_| "Upstream error".to_string());
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
                let Some(data) = parse_sse_data_block(&block) else {
                    continue;
                };

                let Ok(parsed) = serde_json::from_str::<GizziBusEvent>(&data) else {
                    continue;
                };

                if parsed.event_type.as_deref() == Some("server.heartbeat") {
                    yield Ok(axum::response::sse::Event::default().comment("heartbeat"));
                    continue;
                }

                if let Some(payload) = transform_bus_event(&client, &state.db, parsed).await {
                    yield Ok(axum::response::sse::Event::default().data(payload.to_string()));
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}
