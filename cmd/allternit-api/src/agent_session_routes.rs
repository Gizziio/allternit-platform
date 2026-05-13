//! Agent session routes backed by Gizzi runtime sessions.
//!
//! The frontend session store expects `/api/v1/agent-sessions`, but the actual
//! runtime contract lives on Gizzi under `/v1/session/*` plus `/v1/event`.
//! These handlers translate the frontend contract to the Gizzi contract so the
//! Rust API remains a thin gateway instead of becoming a competing session DB.

use axum::{
    extract::{Path, Query},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response, sse::Sse},
    routing::{get, post},
    Json, Router,
};
use futures::Stream;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, sync::Arc};
use tracing::warn;

use crate::AppState;

fn gizzi_base() -> String {
    std::env::var("TERMINAL_SERVER_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:4096".to_string())
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

fn transform_session(info: GizziSessionInfo) -> serde_json::Value {
    let created_at = to_iso(info.time.as_ref().and_then(|t| t.created));
    let updated_at = to_iso(
        info.time
            .as_ref()
            .and_then(|t| t.updated.or(t.created)),
    );

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
            "originSurface": info.surface,
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
    let filtered = sessions
        .into_iter()
        .filter(|session| {
            surface_filter
                .as_ref()
                .map(|surface| session.surface.as_deref() == Some(surface.as_str()))
                .unwrap_or(true)
        })
        .map(transform_session)
        .collect::<Vec<_>>();

    Json(json!({
        "sessions": filtered,
        "count": filtered.len()
    }))
    .into_response()
}

async fn create_session(headers: HeaderMap, Json(body): Json<CreateSessionBody>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let mut payload = serde_json::Map::new();
    payload.insert(
        "title".to_string(),
        json!(body.name.unwrap_or_else(|| "New Session".to_string())),
    );
    if let Some(agent_id) = body.agent_id {
        payload.insert("agentID".to_string(), json!(agent_id));
    }
    if let Some(surface) = body.origin_surface.or_else(|| {
        body.metadata
            .as_ref()
            .and_then(|m| m.get("surface"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }) {
        payload.insert("surface".to_string(), json!(surface));
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

    (StatusCode::CREATED, Json(transform_session(session))).into_response()
}

async fn get_session(headers: HeaderMap, Path(session_id): Path<String>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}", urlencoding::encode(&session_id));
    match gizzi_json::<GizziSessionInfo>(&client, reqwest::Method::GET, &path, None).await {
        Ok(session) => Json(transform_session(session)).into_response(),
        Err(response) => response,
    }
}

async fn update_session(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Json(body): Json<UpdateSessionBody>,
) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let path = format!("/v1/session/{}", urlencoding::encode(&session_id));
    let payload = json!({
        "title": body.name,
        "archived": body.active.map(|active| !active),
        "permission": body.metadata.as_ref().and_then(|m| m.get("permission")).cloned(),
        "surface": body.origin_surface.or_else(|| body.metadata.as_ref().and_then(|m| m.get("surface").and_then(|v| v.as_str()).map(|s| s.to_string()))),
    });

    match gizzi_json::<GizziSessionInfo>(&client, reqwest::Method::PATCH, &path, Some(payload)).await
    {
        Ok(session) => Json(transform_session(session)).into_response(),
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
        "noReply": true,
        "parts": [
            {
                "type": "text",
                "text": body.text,
            }
        ],
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
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    get_session(headers, Path(session_id)).await
}

async fn unrevert_session(
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    get_session(headers, Path(session_id)).await
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

async fn transform_bus_event(client: &Client, event: GizziBusEvent) -> Option<serde_json::Value> {
    let event_type = event.event_type?;
    let props = event.properties.unwrap_or(serde_json::Value::Null);

    match event_type.as_str() {
        "session.created" => serde_json::from_value::<GizziSessionInfo>(props)
            .ok()
            .map(|info| {
                let mut payload = transform_session(info);
                if let Some(obj) = payload.as_object_mut() {
                    obj.insert("type".to_string(), json!("created"));
                }
                payload
            }),
        "session.updated" => serde_json::from_value::<GizziSessionInfo>(props)
            .ok()
            .map(|info| {
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
                        "originSurface": info.surface,
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

async fn sync_sessions(headers: HeaderMap) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>>, Response> {
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

                if let Some(payload) = transform_bus_event(&client, parsed).await {
                    yield Ok(axum::response::sse::Event::default().data(payload.to_string()));
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}
