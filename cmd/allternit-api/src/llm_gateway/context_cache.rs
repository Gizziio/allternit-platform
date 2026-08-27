//! Reusable context caches — long-prompt optimization for the LLM gateway.
//!
//! Users create a cache entry from a list of messages (typically a long
//! system prompt or document context). On subsequent chat-completion
//! requests they reference the cache id via `context_cache_id`; the cached
//! messages are prepended to the request's message list before forwarding
//! to Gizzi.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::AppState;

use super::auth::LlmKeyContext;
use super::translate::{ChatMessage, OpenAiErrorResponse};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/context-caches", post(create_cache).get(list_caches))
        .route("/context-caches/:id", get(get_cache).delete(delete_cache))
}

fn internal(err: impl std::fmt::Display) -> Response {
    OpenAiErrorResponse::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Context cache operation failed: {err}"),
        "server_error",
        None,
        Some(super::translate::error_code::INTERNAL_ERROR),
    )
    .into_response()
}

#[derive(Debug, Deserialize)]
pub struct CreateCacheRequest {
    name: Option<String>,
    messages: Vec<ChatMessage>,
    #[serde(default)]
    ttl_seconds: Option<i64>,
}

#[derive(Debug, Serialize)]
struct ContextCache {
    id: String,
    object: &'static str,
    name: Option<String>,
    message_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_at: Option<i64>,
    created_at: i64,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

pub async fn create_cache(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Json(body): Json<CreateCacheRequest>,
) -> Response {
    if body.messages.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`messages` must contain at least one message.",
            Some("messages"),
        )
        .into_response();
    }
    let id = format!("ctxcache_{}", uuid::Uuid::new_v4().simple());
    let messages_json = match serde_json::to_string(&body.messages) {
        Ok(json) => json,
        Err(err) => return internal(err),
    };
    let ttl = body.ttl_seconds.unwrap_or(3600);
    let expires_at = if ttl > 0 { Some(now_secs() + ttl) } else { None };
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO llm_context_caches
             (id, virtual_key_id, tenant_id, name, messages_json, ttl_seconds, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                key.key_id,
                key.tenant_id,
                body.name,
                messages_json,
                ttl,
                expires_at.map(|ts| chrono::DateTime::from_timestamp(ts, 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                    .unwrap_or_default()),
            ],
        ).map_err(|e| e.to_string())?;
        Ok::<_, String>(ContextCache {
            id,
            object: "context_cache",
            name: body.name,
            message_count: body.messages.len(),
            expires_at,
            created_at: now_secs(),
        })
    }).await;

    match result {
        Ok(Ok(cache)) => (StatusCode::CREATED, Json(cache)).into_response(),
        Ok(Err(err)) => internal(err),
        Err(err) => internal(err),
    }
}

pub async fn list_caches(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, name, messages_json, created_at, expires_at
             FROM llm_context_caches
             WHERE virtual_key_id = ?1
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
             ORDER BY created_at DESC",
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([key.key_id], |row| {
            let messages_json: String = row.get(2)?;
            let message_count = serde_json::from_str::<Vec<Value>>(&messages_json)
                .map(|v| v.len())
                .unwrap_or(0);
            let created_str: String = row.get(3)?;
            let created_at = chrono::NaiveDateTime::parse_from_str(&created_str, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|dt| dt.and_utc().timestamp())
                .unwrap_or(0);
            let expires_str: Option<String> = row.get(4)?;
            let expires_at = expires_str.as_deref().and_then(|s| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                    .ok()
                    .map(|dt| dt.and_utc().timestamp())
            });
            Ok(ContextCache {
                id: row.get(0)?,
                object: "context_cache",
                name: row.get(1)?,
                message_count,
                expires_at,
                created_at,
            })
        }).map_err(|e| e.to_string())?;
        let caches: Vec<ContextCache> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        Ok::<_, String>(caches)
    }).await;

    match result {
        Ok(Ok(caches)) => Json(json!({ "object": "list", "data": caches })).into_response(),
        Ok(Err(err)) => internal(err),
        Err(err) => internal(err),
    }
}

pub async fn get_cache(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(|e| e.to_string())?;
        let row = conn.query_row(
            "SELECT id, name, messages_json, created_at, expires_at
             FROM llm_context_caches
             WHERE id = ?1 AND virtual_key_id = ?2",
            params![id, key.key_id],
            |row| {
                let messages_json: String = row.get(2)?;
                let message_count = serde_json::from_str::<Vec<Value>>(&messages_json)
                    .map(|v| v.len())
                    .unwrap_or(0);
                let created_str: String = row.get(3)?;
                let created_at = chrono::NaiveDateTime::parse_from_str(&created_str, "%Y-%m-%d %H:%M:%S")
                    .ok()
                    .map(|dt| dt.and_utc().timestamp())
                    .unwrap_or(0);
                let expires_str: Option<String> = row.get(4)?;
                let expires_at = expires_str.as_deref().and_then(|s| {
                    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                        .ok()
                        .map(|dt| dt.and_utc().timestamp())
                });
                Ok(ContextCache {
                    id: row.get(0)?,
                    object: "context_cache",
                    name: row.get(1)?,
                    message_count,
                    expires_at,
                    created_at,
                })
            },
        ).optional().map_err(|e| e.to_string())?;
        Ok::<_, String>(row)
    }).await;

    match result {
        Ok(Ok(Some(cache))) => Json(cache).into_response(),
        Ok(Ok(None)) => OpenAiErrorResponse::new(
            StatusCode::NOT_FOUND,
            "Context cache not found.",
            "invalid_request_error",
            Some("id"),
            Some(super::translate::error_code::INVALID_REQUEST),
        ).into_response(),
        Ok(Err(err)) => internal(err),
        Err(err) => internal(err),
    }
}

pub async fn delete_cache(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(|e| e.to_string())?;
        let changed = conn.execute(
            "DELETE FROM llm_context_caches WHERE id = ?1 AND virtual_key_id = ?2",
            params![id, key.key_id],
        ).map_err(|e| e.to_string())?;
        Ok::<_, String>(changed)
    }).await;

    match result {
        Ok(Ok(0)) => OpenAiErrorResponse::new(
            StatusCode::NOT_FOUND,
            "Context cache not found.",
            "invalid_request_error",
            Some("id"),
            Some(super::translate::error_code::INVALID_REQUEST),
        ).into_response(),
        Ok(Ok(_)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(err)) => internal(err),
        Err(err) => internal(err),
    }
}

/// Load cached messages for a given cache id and virtual key. Returns None
/// when the id does not exist or has expired.
pub fn load_cache_messages(
    db: &crate::db::DbHandle,
    key_id: &str,
    cache_id: &str,
) -> Result<Option<Vec<ChatMessage>>, String> {
    let conn = db.connect().map_err(|e| e.to_string())?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT messages_json FROM llm_context_caches
             WHERE id = ?1 AND virtual_key_id = ?2
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
            params![cache_id, key_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    match raw {
        Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()).map(Some),
        None => Ok(None),
    }
}
