//! Context Caching API (A15).
//!
//! Provides explicit cache management for prompt prefixes, enabling repeated
//! use of large system prompts or reference documents across requests without
//! re-tokenization. Mounted under `/v1` by the LLM gateway router.
//!
//! Endpoints:
//! - `POST /v1/cache/prompts` — create a cached prompt
//! - `GET /v1/cache/prompts` — list cached prompts
//! - `GET /v1/cache/prompts/:id` — get a cached prompt
//! - `DELETE /v1/cache/prompts/:id` — delete a cached prompt
//!
//! The cache is keyed by content hash so identical prompts are deduplicated.
//! Cached prompts can be referenced in chat completion requests via
//! `{"role": "system", "cache_id": "cache_abc123"}`.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Arc;

use crate::AppState;

use super::{
    auth::LlmKeyContext,
    translate::{error_code, OpenAiErrorResponse},
};

// ─── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCacheRequest {
    /// The prompt text to cache.
    pub content: String,
    /// Optional human-readable label.
    #[serde(default)]
    pub name: Option<String>,
    /// Time-to-live in seconds. Default: 1 hour.
    #[serde(default = "default_ttl")]
    pub ttl_seconds: u64,
    /// Optional metadata.
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

fn default_ttl() -> u64 {
    3600
}

// ─── Response types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CacheObject {
    pub id: String,
    pub object: &'static str,
    pub content_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub status: &'static str,
    pub tokens: u64,
    pub created_at: i64,
    pub expires_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

fn ensure_tables(db: &crate::db::DbHandle) -> rusqlite::Result<()> {
    let conn = db.connect()?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS prompt_cache (
            id TEXT PRIMARY KEY,
            content_hash TEXT NOT NULL,
            content TEXT NOT NULL,
            name TEXT,
            tokens INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            metadata_json TEXT,
            tenant_id TEXT
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_prompt_cache_hash ON prompt_cache(content_hash)",
        [],
    )?;
    Ok(())
}

fn content_hash(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn estimate_tokens(text: &str) -> u64 {
    ((text.len() as u64) + 3) / 4
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// `POST /v1/cache/prompts` — create a cached prompt.
pub async fn create_cache(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Json(body): Json<CreateCacheRequest>,
) -> Response {
    if body.content.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`content` must not be empty.",
            Some("content"),
        )
        .into_response();
    }

    if body.ttl_seconds < 60 || body.ttl_seconds > 86400 * 30 {
        return OpenAiErrorResponse::invalid_request(
            "`ttl_seconds` must be between 60 and 2592000 (30 days).",
            Some("ttl_seconds"),
        )
        .into_response();
    }

    if let Err(e) = ensure_tables(&state.db) {
        return OpenAiErrorResponse::upstream(
            format!("Database error: {e}"),
            "internal_error",
        )
        .into_response();
    }

    let hash = content_hash(&body.content);
    let tokens = estimate_tokens(&body.content);
    let created_at = chrono::Utc::now().timestamp();
    let expires_at = created_at + body.ttl_seconds as i64;
    let metadata_json = body
        .metadata
        .as_ref()
        .map(|m| serde_json::to_string(m).unwrap_or_default());

    // Check for existing cache entry with same hash (dedup).
    let db = state.db.clone();
    let hash_c = hash.clone();
    let existing = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, created_at, expires_at FROM prompt_cache
             WHERE content_hash = ?1 AND expires_at > ?2",
            params![hash_c, created_at],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .optional()
    })
    .await;

    match existing {
        Ok(Ok(Some((id, created, expires)))) => {
            let obj = CacheObject {
                id,
                object: "prompt_cache",
                content_hash: hash,
                name: body.name,
                status: "active",
                tokens,
                created_at: created,
                expires_at: expires,
                metadata: body.metadata,
            };
            return (StatusCode::OK, Json(serde_json::to_value(obj).unwrap())).into_response();
        }
        _ => {}
    }

    // Create new cache entry.
    let id = format!("cache_{}", uuid::Uuid::new_v4().simple());
    let db = state.db.clone();
    let id_c = id.clone();
    let hash_c = hash.clone();
    let content = body.content.clone();
    let name = body.name.clone();
    let tenant_id = key.tenant_id.clone();

    let result = tokio::task::spawn_blocking(move || -> rusqlite::Result<()> {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO prompt_cache (id, content_hash, content, name, tokens, created_at, expires_at, metadata_json, tenant_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id_c, hash_c, content, name, tokens as i64, created_at, expires_at, metadata_json, tenant_id],
        )?;
        Ok(())
    })
    .await;

    match result {
        Ok(Ok(())) => {
            let obj = CacheObject {
                id,
                object: "prompt_cache",
                content_hash: hash,
                name: body.name,
                status: "active",
                tokens,
                created_at,
                expires_at,
                metadata: body.metadata,
            };
            (StatusCode::CREATED, Json(serde_json::to_value(obj).unwrap())).into_response()
        }
        _ => OpenAiErrorResponse::upstream("Failed to create cache entry.", "internal_error")
            .into_response(),
    }
}

/// `GET /v1/cache/prompts` — list cached prompts.
pub async fn list_caches(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
) -> Response {
    if let Err(e) = ensure_tables(&state.db) {
        return OpenAiErrorResponse::upstream(
            format!("Database error: {e}"),
            "internal_error",
        )
        .into_response();
    }

    let db = state.db.clone();
    let tenant_id = key.tenant_id.clone();
    let now = chrono::Utc::now().timestamp();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, content_hash, name, tokens, created_at, expires_at, metadata_json
             FROM prompt_cache WHERE expires_at > ?1 AND (tenant_id = ?2 OR tenant_id IS NULL)
             ORDER BY created_at DESC LIMIT 100",
        )?;
        let caches: Vec<CacheObject> = stmt
            .query_map(params![now, tenant_id], |row| {
                let metadata_str: Option<String> = row.get(6)?;
                let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());
                Ok(CacheObject {
                    id: row.get(0)?,
                    object: "prompt_cache",
                    content_hash: row.get(1)?,
                    name: row.get(2)?,
                    status: "active",
                    tokens: row.get::<_, i64>(3)? as u64,
                    created_at: row.get(4)?,
                    expires_at: row.get(5)?,
                    metadata,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok::<_, rusqlite::Error>(caches)
    })
    .await;

    match result {
        Ok(Ok(caches)) => (
            StatusCode::OK,
            Json(json!({ "object": "list", "data": caches })),
        )
            .into_response(),
        _ => OpenAiErrorResponse::upstream("Failed to list cache entries.", "internal_error")
            .into_response(),
    }
}

/// `GET /v1/cache/prompts/:id` — get a cached prompt.
pub async fn get_cache(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    if let Err(e) = ensure_tables(&state.db) {
        return OpenAiErrorResponse::upstream(
            format!("Database error: {e}"),
            "internal_error",
        )
        .into_response();
    }

    let db = state.db.clone();
    let id_c = id.clone();
    let now = chrono::Utc::now().timestamp();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, content_hash, name, tokens, created_at, expires_at, metadata_json
             FROM prompt_cache WHERE id = ?1 AND expires_at > ?2",
            params![id_c, now],
            |row| {
                let metadata_str: Option<String> = row.get(6)?;
                let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());
                Ok(CacheObject {
                    id: row.get(0)?,
                    object: "prompt_cache",
                    content_hash: row.get(1)?,
                    name: row.get(2)?,
                    status: "active",
                    tokens: row.get::<_, i64>(3)? as u64,
                    created_at: row.get(4)?,
                    expires_at: row.get(5)?,
                    metadata,
                })
            },
        )
        .optional()
    })
    .await;

    match result {
        Ok(Ok(Some(obj))) => {
            (StatusCode::OK, Json(serde_json::to_value(obj).unwrap())).into_response()
        }
        Ok(Ok(None)) => OpenAiErrorResponse::new(
            StatusCode::NOT_FOUND,
            format!("No active cache entry with id '{id}'."),
            "invalid_request_error",
            Some("cache_id"),
            Some(error_code::INVALID_REQUEST),
        )
        .into_response(),
        _ => OpenAiErrorResponse::upstream("Failed to get cache entry.", "internal_error")
            .into_response(),
    }
}

/// `DELETE /v1/cache/prompts/:id` — delete a cached prompt.
pub async fn delete_cache(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    if let Err(e) = ensure_tables(&state.db) {
        return OpenAiErrorResponse::upstream(
            format!("Database error: {e}"),
            "internal_error",
        )
        .into_response();
    }

    let db = state.db.clone();
    let id_c = id.clone();

    let result = tokio::task::spawn_blocking(move || -> rusqlite::Result<bool> {
        let conn = db.connect()?;
        let deleted = conn.execute(
            "DELETE FROM prompt_cache WHERE id = ?1",
            params![id_c],
        )?;
        Ok(deleted > 0)
    })
    .await;

    match result {
        Ok(Ok(true)) => (
            StatusCode::OK,
            Json(json!({ "id": id, "object": "prompt_cache.deleted", "deleted": true })),
        )
            .into_response(),
        Ok(Ok(false)) => OpenAiErrorResponse::new(
            StatusCode::NOT_FOUND,
            format!("No cache entry with id '{id}'."),
            "invalid_request_error",
            Some("cache_id"),
            Some(error_code::INVALID_REQUEST),
        )
        .into_response(),
        _ => OpenAiErrorResponse::upstream("Failed to delete cache entry.", "internal_error")
            .into_response(),
    }
}

// ─── Cache lookup for chat completions ──────────────────────────────────────

/// Look up a cached prompt by ID. Returns the cached content if found and
/// not expired. Used by proxy.rs to resolve `cache_id` references in messages.
pub async fn resolve_cache_entry(db: &crate::db::DbHandle, cache_id: &str) -> Option<String> {
    let db = db.clone();
    let id = cache_id.to_string();
    let now = chrono::Utc::now().timestamp();

    tokio::task::spawn_blocking(move || {
        let conn = db.connect().ok()?;
        conn.query_row(
            "SELECT content FROM prompt_cache WHERE id = ?1 AND expires_at > ?2",
            params![id, now],
            |row| row.get::<_, String>(0),
        )
        .ok()
    })
    .await
    .ok()
    .flatten()
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_hash_is_deterministic() {
        assert_eq!(content_hash("hello"), content_hash("hello"));
        assert_ne!(content_hash("hello"), content_hash("world"));
    }

    #[test]
    fn token_estimate_reasonable() {
        let tokens = estimate_tokens("Hello, world! This is a test.");
        assert!(tokens >= 5 && tokens <= 10);
    }
}
