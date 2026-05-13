
//! Local Brain API routes — memory query and vector search.
//!
//! Provides `/api/local-brain` for semantic search across memory documents,
//! events, and conversations. Falls back to keyword search if no embedding
//! service is available.

use axum::body::Body;
use axum::extract::Extension;
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use bytes::Bytes;
use futures::StreamExt;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;

fn unauthorized() -> axum::response::Response {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))).into_response()
}

pub fn local_brain_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/local-brain", get(local_brain_entry).post(pull_local_brain))
        .route("/local-brain/status", get(brain_status))
}

// ─── Data models ──────────────────────────────────────────────────────────────

#[derive(Default, Deserialize)]
#[serde(default)]
struct BrainQuery {
    q: Option<String>,
    limit: Option<usize>,
    #[serde(rename = "type")]
    result_type: Option<String>, // documents | events | conversations | all
}

#[derive(Serialize)]
struct BrainResult {
    id: String,
    #[serde(rename = "type")]
    result_type: String,
    title: String,
    snippet: String,
    score: f64,
    source_url: Option<String>,
    created_at: String,
}

const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";
const LOCAL_BRAIN_MODEL: &str = "llama3.2:3b";

// ─── Combined local-brain entrypoint ─────────────────────────────────────────

async fn local_brain_entry(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<BrainQuery>,
) -> impl IntoResponse {
    match q.q.clone().as_deref().map(str::trim) {
        Some(query) if !query.is_empty() => query_brain_impl(state, user, q, query.to_string()).await,
        _ => local_brain_probe(headers).await,
    }
}

// ─── Probe Ollama / Local Brain status ───────────────────────────────────────

async fn local_brain_probe(headers: HeaderMap) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let ollama_url = std::env::var("OLLAMA_URL").unwrap_or_else(|_| DEFAULT_OLLAMA_URL.to_string());
    let client = reqwest::Client::new();

    let tags_response = match client
        .get(format!("{}/api/tags", ollama_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => {
            return Json(json!({
                "ollamaRunning": false,
                "modelReady": false,
                "modelId": LOCAL_BRAIN_MODEL,
                "pulledModels": [],
            }))
            .into_response();
        }
    };

    let payload = match tags_response.json::<serde_json::Value>().await {
        Ok(value) => value,
        Err(_) => {
            return Json(json!({
                "ollamaRunning": false,
                "modelReady": false,
                "modelId": LOCAL_BRAIN_MODEL,
                "pulledModels": [],
            }))
            .into_response();
        }
    };

    let pulled_models = payload
        .get("models")
        .and_then(|models| models.as_array())
        .map(|models| {
            models
                .iter()
                .filter_map(|model| model.get("name").and_then(|name| name.as_str()))
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let model_ready = pulled_models
        .iter()
        .any(|name| name == LOCAL_BRAIN_MODEL || name == &format!("{LOCAL_BRAIN_MODEL}:latest"));

    Json(json!({
        "ollamaRunning": true,
        "modelReady": model_ready,
        "modelId": LOCAL_BRAIN_MODEL,
        "pulledModels": pulled_models,
    }))
    .into_response()
}

// ─── Query brain ──────────────────────────────────────────────────────────────

async fn query_brain_impl(
    state: Arc<AppState>,
    user: AuthUser,
    q: BrainQuery,
    query: String,
) -> Response {
    let db = state.db.clone();
    let user_id = user.user_id;
    let limit = q.limit.unwrap_or(10);
    let result_type = q.result_type.unwrap_or_else(|| "all".to_string());
    let pattern = format!("%{}%", query);

    let results = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut all_results: Vec<BrainResult> = vec![];

        // Search memory_documents
        if result_type == "all" || result_type == "documents" {
            let mut stmt = conn.prepare(
                "SELECT id, title, content, source_url, created_at
                 FROM memory_documents
                 WHERE user_id = ?1 AND (title LIKE ?2 OR content LIKE ?2)
                 ORDER BY created_at DESC LIMIT ?3"
            )?;
            let docs = stmt.query_map(params![&user_id, &pattern, limit as i64], |row| {
                Ok(BrainResult {
                    id: row.get(0)?,
                    result_type: "document".to_string(),
                    title: row.get(1)?,
                    snippet: row.get::<_, Option<String>>(2)?.unwrap_or_default().chars().take(200).collect(),
                    score: 0.85,
                    source_url: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?;
            for doc in docs {
                if let Ok(d) = doc {
                    all_results.push(d);
                }
            }
        }

        // Search memory_events
        if result_type == "all" || result_type == "events" {
            let mut stmt = conn.prepare(
                "SELECT id, type, payload, source, timestamp
                 FROM memory_events
                 WHERE user_id = ?1 AND (type LIKE ?2 OR payload LIKE ?2 OR source LIKE ?2)
                 ORDER BY timestamp DESC LIMIT ?3"
            )?;
            let events = stmt.query_map(params![&user_id, &pattern, limit as i64], |row| {
                Ok(BrainResult {
                    id: row.get(0)?,
                    result_type: "event".to_string(),
                    title: row.get(1)?,
                    snippet: row.get::<_, Option<String>>(2)?.unwrap_or_default().chars().take(200).collect(),
                    score: 0.75,
                    source_url: None,
                    created_at: row.get(4)?,
                })
            })?;
            for evt in events {
                if let Ok(e) = evt {
                    all_results.push(e);
                }
            }
        }

        // Search conversations
        if result_type == "all" || result_type == "conversations" {
            let mut stmt = conn.prepare(
                "SELECT c.id, c.title, m.content, c.created_at
                 FROM conversations c
                 LEFT JOIN conversation_messages m ON m.conversation_id = c.id
                 WHERE c.user_id = ?1 AND (c.title LIKE ?2 OR m.content LIKE ?2)
                 GROUP BY c.id
                 ORDER BY c.created_at DESC LIMIT ?3"
            )?;
            let convs = stmt.query_map(params![&user_id, &pattern, limit as i64], |row| {
                Ok(BrainResult {
                    id: row.get(0)?,
                    result_type: "conversation".to_string(),
                    title: row.get::<_, Option<String>>(1)?.unwrap_or_else(|| "Untitled".to_string()),
                    snippet: row.get::<_, Option<String>>(2)?.unwrap_or_default().chars().take(200).collect(),
                    score: 0.8,
                    source_url: None,
                    created_at: row.get(3)?,
                })
            })?;
            for conv in convs {
                if let Ok(c) = conv {
                    all_results.push(c);
                }
            }
        }

        // Sort by score descending and limit
        all_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        all_results.truncate(limit);

        Ok::<_, rusqlite::Error>(all_results)
    })
    .await;

    match results {
        Ok(Ok(data)) => Json(json!({
            "query": query,
            "results": data,
            "count": data.len(),
            "note": "Keyword search (semantic search unavailable — no embedding service configured)"
        })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error querying brain: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Pull Local Brain model over SSE ─────────────────────────────────────────

async fn pull_local_brain(headers: HeaderMap) -> Response {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let ollama_url = std::env::var("OLLAMA_URL").unwrap_or_else(|_| DEFAULT_OLLAMA_URL.to_string());
    let client = reqwest::Client::new();
    let tags_url = format!("{}/api/tags", ollama_url.trim_end_matches('/'));
    let pull_url = format!("{}/api/pull", ollama_url.trim_end_matches('/'));

    match client
        .get(&tags_url)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {}
        _ => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "error": "Ollama is not running. Install it at ollama.com then try again."
                })),
            )
                .into_response();
        }
    }

    let stream = async_stream::stream! {
        let send = |payload: serde_json::Value| {
            Ok::<Bytes, std::convert::Infallible>(Bytes::from(format!("data: {}\n\n", payload)))
        };

        let pull_response = match client
            .post(&pull_url)
            .json(&json!({
                "name": LOCAL_BRAIN_MODEL,
                "stream": true,
            }))
            .send()
            .await
        {
            Ok(response) => response,
            Err(err) => {
                yield send(json!({
                    "status": "error",
                    "error": err.to_string(),
                }));
                return;
            }
        };

        if !pull_response.status().is_success() {
            let error_body = pull_response.text().await.unwrap_or_else(|_| "Pull request failed".to_string());
            yield send(json!({
                "status": "error",
                "error": error_body,
            }));
            return;
        }

        let mut line_buffer = String::new();
        let mut byte_stream = pull_response.bytes_stream();

        while let Some(next_chunk) = byte_stream.next().await {
            let chunk = match next_chunk {
                Ok(bytes) => bytes,
                Err(err) => {
                    yield send(json!({
                        "status": "error",
                        "error": err.to_string(),
                    }));
                    return;
                }
            };

            line_buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_index) = line_buffer.find('\n') {
                let line = line_buffer[..newline_index].trim().to_string();
                line_buffer.drain(..=newline_index);

                if line.is_empty() {
                    continue;
                }

                match serde_json::from_str::<serde_json::Value>(&line) {
                    Ok(value) => yield send(value),
                    Err(_) => {}
                }
            }
        }

        let trailing = line_buffer.trim();
        if !trailing.is_empty() {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(trailing) {
                yield send(value);
            }
        }

        yield send(json!({ "status": "success" }));
    };

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

// ─── Brain status ─────────────────────────────────────────────────────────────

async fn brain_status(
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

    let embedding_url = std::env::var("ALLTERNIT_EMBEDDING_URL")
        .unwrap_or_else(|_| "http://localhost:3201".to_string());

    let client = reqwest::Client::new();

    let ollama_available = client
        .get(format!("{}/api/tags", ollama_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .is_ok();

    let embedding_available = client
        .get(format!("{}/health", embedding_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .is_ok();

    let semantic_search = ollama_available || embedding_available;
    let vector_store = embedding_available;

    Json(json!({
        "status": if ollama_available || embedding_available { "healthy" } else { "degraded" },
        "services": {
            "ollama": {
                "url": ollama_url,
                "available": ollama_available,
            },
            "embedding": {
                "url": embedding_url,
                "available": embedding_available,
            },
        },
        "capabilities": {
            "keyword_search": true,
            "semantic_search": semantic_search,
            "vector_store": vector_store,
        },
        "note": if semantic_search {
            "Semantic search available"
        } else {
            "Semantic search requires an embedding service (OLLAMA_URL or ALLTERNIT_EMBEDDING_URL)"
        }
    })).into_response()
}
