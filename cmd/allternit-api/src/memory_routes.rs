use axum::extract::Extension;
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;

pub fn memory_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/memory", get(list_memory))
        .route("/memory/health", get(memory_health))
        .route("/memory/consolidate", post(memory_consolidate))
        .route("/memory/documents", get(list_documents).post(create_document))
        .route("/memory/events", get(list_events).post(create_event))
        .route("/memory/query", post(query_memory))
        .route("/memory/edges", get(list_edges))
        .route("/memory/entities", get(list_entities).post(create_entity))
        .route("/memory/stats", get(memory_stats))
}

// ── Health ──────────────────────────────────────────────────────────────────

async fn memory_health(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
    let memory_url = std::env::var("ALLTERNIT_MEMORY_URL")
        .unwrap_or_else(|_| "http://localhost:3201".to_string());

    let client = reqwest::Client::new();

    let ollama_connected = client
        .get(format!("{}/api/tags", ollama_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .is_ok();

    let db_connected = state.db.connect().is_ok();

    let watcher_active = client
        .get(format!("{}/health", memory_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .is_ok();

    Json(json!({
        "status": if ollama_connected && db_connected && watcher_active { "healthy" } else { "degraded" },
        "memory": {
            "ollamaConnected": ollama_connected,
            "databaseConnected": db_connected,
            "watcherActive": watcher_active,
        },
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

// ── List memory (stub) ──────────────────────────────────────────────────────

async fn list_memory() -> Json<serde_json::Value> {
    Json(json!({
        "documents": [],
        "events": [],
        "entities": [],
        "edges": [],
        "total": 0,
    }))
}

// ── Consolidate ─────────────────────────────────────────────────────────────

async fn memory_consolidate() -> impl axum::response::IntoResponse {
    let memory_url = std::env::var("ALLTERNIT_MEMORY_URL")
        .unwrap_or_else(|_| "http://localhost:3201".to_string());

    let client = reqwest::Client::new();
    match client
        .post(format!("{}/api/consolidate", memory_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(res) => {
            if let Ok(body) = res.json::<serde_json::Value>().await {
                (StatusCode::OK, Json(body))
            } else {
                (StatusCode::OK, Json(json!({
                    "success": true,
                    "message": "Consolidation triggered",
                })))
            }
        }
        Err(e) => {
            (StatusCode::SERVICE_UNAVAILABLE, Json(json!({
                "success": false,
                "message": format!("Memory service unreachable: {}", e),
            })))
        }
    }
}

// ── Documents ───────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct DocQuery {
    agent_id: Option<String>,
}

#[derive(Serialize)]
struct MemoryDoc {
    id: String,
    agent_id: Option<String>,
    title: String,
    source_type: String,
    source_url: Option<String>,
    chunk_count: i64,
    is_indexed: bool,
    created_at: String,
    updated_at: String,
}

async fn list_documents(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Query(params): Query<DocQuery>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))),
    };

    let mut sql = "SELECT id, agent_id, title, source_type, source_url, chunk_count, is_indexed, created_at, updated_at FROM memory_documents WHERE user_id = ?1".to_string();
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user.user_id)];

    if let Some(ref agent_id) = params.agent_id {
        sql.push_str(" AND agent_id = ?");
        args.push(Box::new(agent_id.clone()));
    }
    sql.push_str(" ORDER BY updated_at DESC");

    let args_refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))),
    };

    let docs: Vec<MemoryDoc> = match stmt.query_map(rusqlite::params_from_iter(args_refs), |row| {
        Ok(MemoryDoc {
            id: row.get(0)?,
            agent_id: row.get(1)?,
            title: row.get(2)?,
            source_type: row.get(3)?,
            source_url: row.get(4)?,
            chunk_count: row.get(5)?,
            is_indexed: row.get::<_, i64>(6)? != 0,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };

    (StatusCode::OK, Json(json!(docs)))
}

#[derive(Deserialize)]
struct CreateDocBody {
    agent_id: Option<String>,
    title: String,
    content: Option<String>,
    source_type: Option<String>,
    source_url: Option<String>,
    chunk_count: Option<i64>,
}

async fn create_document(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<CreateDocBody>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))),
    };

    let id = uuid::Uuid::new_v4().to_string();

    match conn.execute(
        "INSERT INTO memory_documents (id, user_id, agent_id, title, content, source_type, source_url, chunk_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            &id,
            &user.user_id,
            &body.agent_id,
            &body.title,
            &body.content,
            body.source_type.as_deref().unwrap_or("upload"),
            &body.source_url,
            body.chunk_count.unwrap_or(0),
        ],
    ) {
        Ok(_) => (StatusCode::CREATED, Json(json!({"id": id, "title": body.title, "isIndexed": false}))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create document"}))),
    }
}

// ── Events ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct EventQuery {
    agent_id: Option<String>,
    limit: Option<i64>,
    #[serde(rename = "type")]
    event_type: Option<String>,
}

#[derive(Serialize)]
struct MemoryEvent {
    id: String,
    timestamp: String,
    #[serde(rename = "type")]
    event_type: String,
    payload: Option<String>,
    agent_id: Option<String>,
    source: String,
}

async fn list_events(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Query(params): Query<EventQuery>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))),
    };

    let limit = params.limit.unwrap_or(100);
    let mut sql = "SELECT id, timestamp, type, payload, agent_id, source FROM memory_events WHERE user_id = ?1".to_string();
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user.user_id)];

    if let Some(ref agent_id) = params.agent_id {
        sql.push_str(" AND agent_id = ?");
        args.push(Box::new(agent_id.clone()));
    }
    if let Some(ref t) = params.event_type {
        sql.push_str(" AND type = ?");
        args.push(Box::new(t.clone()));
    }
    sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
    args.push(Box::new(limit));

    let args_refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))),
    };

    let events: Vec<MemoryEvent> = match stmt.query_map(rusqlite::params_from_iter(args_refs), |row| {
        Ok(MemoryEvent {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            event_type: row.get(2)?,
            payload: row.get(3)?,
            agent_id: row.get(4)?,
            source: row.get(5)?,
        })
    }) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };

    (StatusCode::OK, Json(json!(events)))
}

#[derive(Deserialize)]
struct CreateEventBody {
    agent_id: Option<String>,
    #[serde(rename = "type")]
    event_type: String,
    payload: Option<String>,
    source: Option<String>,
}

async fn create_event(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<CreateEventBody>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))),
    };

    let id = uuid::Uuid::new_v4().to_string();

    match conn.execute(
        "INSERT INTO memory_events (id, user_id, agent_id, type, payload, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &id,
            &user.user_id,
            &body.agent_id,
            &body.event_type,
            &body.payload,
            body.source.as_deref().unwrap_or("user"),
        ],
    ) {
        Ok(_) => (StatusCode::CREATED, Json(json!({
            "id": id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "type": body.event_type,
            "payload": body.payload,
        }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create event"}))),
    }
}

// ── Query ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct QueryBody {
    query: String,
}

async fn query_memory(
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<QueryBody>,
) -> impl axum::response::IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };
    // Proxy to memory agent if available, otherwise return stub
    let memory_url = std::env::var("ALLTERNIT_MEMORY_URL")
        .unwrap_or_else(|_| "http://localhost:3201".to_string());

    let client = reqwest::Client::new();
    match client
        .post(format!("{}/api/query", memory_url))
        .header("Content-Type", "application/json")
        .header("x-allternit-user-id", _user.user_id)
        .body(json!({"query": body.query}).to_string())
        .send()
        .await
    {
        Ok(res) => {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                (StatusCode::OK, Json(json))
            } else {
                (StatusCode::OK, Json(json!({"results": [], "query": body.query})))
            }
        }
        Err(_) => (StatusCode::OK, Json(json!({"results": [], "query": body.query, "note": "Memory agent unavailable"}))),
    }
}


// ── Edges ───────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct EdgeRow {
    id: String,
    source: String,
    relationship: String,
    target: String,
    confidence: f64,
    created_at: String,
}

async fn list_edges(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))) as (StatusCode, Json<serde_json::Value>),
    };

    let db = state.db.clone();
    let user_id = user.user_id;
    let source_filter = params.get("source").cloned();

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let query = if let Some(ref src) = source_filter {
            let mut stmt = conn.prepare(
                "SELECT id, source, relationship, target, confidence, created_at
                 FROM memory_edges WHERE user_id = ?1 AND source = ?2 ORDER BY created_at DESC LIMIT 500"
            )?;
            let rows = stmt.query_map(params![user_id, src], |row| {
                Ok(EdgeRow {
                    id: row.get(0)?,
                    source: row.get(1)?,
                    relationship: row.get(2)?,
                    target: row.get(3)?,
                    confidence: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?.collect::<Result<Vec<_>, _>>()?;
            Ok::<_, rusqlite::Error>(rows)
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, source, relationship, target, confidence, created_at
                 FROM memory_edges WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 500"
            )?;
            let rows = stmt.query_map(params![user_id], |row| {
                Ok(EdgeRow {
                    id: row.get(0)?,
                    source: row.get(1)?,
                    relationship: row.get(2)?,
                    target: row.get(3)?,
                    confidence: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?.collect::<Result<Vec<_>, _>>()?;
            Ok::<_, rusqlite::Error>(rows)
        };
        query
    }).await;

    match rows {
        Ok(Ok(data)) => (StatusCode::OK, Json(json!({"edges": data}))),
        Ok(Err(e)) => {
            tracing::warn!("DB error listing edges: {}", e);
            (StatusCode::OK, Json(json!({"edges": []})))
        }
        Err(e) => {
            tracing::warn!("DB task panicked: {}", e);
            (StatusCode::OK, Json(json!({"edges": []})))
        }
    }
}

// ── Entities ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct EntityRow {
    id: String,
    entity_id: String,
    name: String,
    entity_type: String,
    content: Option<String>,
    vector_id: Option<String>,
    last_updated: String,
}

async fn list_entities(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))) as (StatusCode, Json<serde_json::Value>),
    };

    let db = state.db.clone();
    let user_id = user.user_id;
    let agent_id = params.get("agentId").cloned();
    let entity_type = params.get("type").cloned();
    let q = params.get("q").cloned();

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql = String::from(
            "SELECT id, entity_id, name, type, content, vector_id, last_updated
             FROM memory_entities WHERE user_id = ?1"
        );
        if agent_id.is_some() { sql.push_str(" AND agent_id = ?2"); }
        if entity_type.is_some() { sql.push_str(" AND type = ?3"); }
        if q.is_some() { sql.push_str(" AND (name LIKE ?4 OR content LIKE ?4)"); }
        sql.push_str(" ORDER BY last_updated DESC LIMIT 200");

        let mut stmt = conn.prepare(&sql)?;
        let like = q.map(|s| format!("%{}%", s));
        let rows = match (&agent_id, &entity_type, &like) {
            (Some(a), Some(t), Some(l)) => stmt.query_map(params![user_id, a, t, l], row_to_entity)?,
            (Some(a), Some(t), None) => stmt.query_map(params![user_id, a, t], row_to_entity)?,
            (Some(a), None, Some(l)) => stmt.query_map(params![user_id, a, l], row_to_entity)?,
            (Some(a), None, None) => stmt.query_map(params![user_id, a], row_to_entity)?,
            (None, Some(t), Some(l)) => stmt.query_map(params![user_id, t, l], row_to_entity)?,
            (None, Some(t), None) => stmt.query_map(params![user_id, t], row_to_entity)?,
            (None, None, Some(l)) => stmt.query_map(params![user_id, l], row_to_entity)?,
            (None, None, None) => stmt.query_map(params![user_id], row_to_entity)?,
        }.collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => (StatusCode::OK, Json(json!({"entities": data}))),
        Ok(Err(e)) => {
            tracing::warn!("DB error listing entities: {}", e);
            (StatusCode::OK, Json(json!({"entities": []})))
        }
        Err(e) => {
            tracing::warn!("DB task panicked: {}", e);
            (StatusCode::OK, Json(json!({"entities": []})))
        }
    }
}

fn row_to_entity(row: &rusqlite::Row) -> Result<EntityRow, rusqlite::Error> {
    Ok(EntityRow {
        id: row.get(0)?,
        entity_id: row.get(1)?,
        name: row.get(2)?,
        entity_type: row.get(3)?,
        content: row.get(4)?,
        vector_id: row.get(5)?,
        last_updated: row.get(6)?,
    })
}

#[derive(Deserialize)]
struct CreateEntityBody {
    #[serde(alias = "agentId")]
    agent_id: Option<String>,
    #[serde(alias = "entityId")]
    entity_id: Option<String>,
    name: String,
    #[serde(alias = "type")]
    entity_type: Option<String>,
    content: Option<String>,
    #[serde(alias = "vectorId")]
    vector_id: Option<String>,
}

async fn create_entity(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<CreateEntityBody>,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let id3 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO memory_entities (id, user_id, agent_id, entity_id, name, type, content, vector_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id2,
                user_id,
                body.agent_id,
                body.entity_id.unwrap_or_else(|| id3.clone()),
                body.name,
                body.entity_type.unwrap_or_else(|| "General".to_string()),
                body.content,
                body.vector_id,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"success": true, "entity": {"id": id}}))),
        Ok(Err(e)) => {
            tracing::warn!("DB error creating entity: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            tracing::warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async fn memory_stats(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl axum::response::IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };

    let db = state.db.clone();
    let user_id = user.user_id;

    let stats = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let total_events: i64 = conn.query_row(
            "SELECT COUNT(*) FROM memory_events WHERE user_id = ?1",
            params![user_id],
            |row| row.get(0),
        ).unwrap_or(0);
        let total_entities: i64 = conn.query_row(
            "SELECT COUNT(*) FROM memory_entities WHERE user_id = ?1",
            params![user_id],
            |row| row.get(0),
        ).unwrap_or(0);
        let total_edges: i64 = conn.query_row(
            "SELECT COUNT(*) FROM memory_edges WHERE user_id = ?1",
            params![user_id],
            |row| row.get(0),
        ).unwrap_or(0);
        let total_vectors: i64 = conn.query_row(
            "SELECT COUNT(*) FROM memory_entities WHERE user_id = ?1 AND vector_id IS NOT NULL",
            params![user_id],
            |row| row.get(0),
        ).unwrap_or(0);
        Ok::<_, rusqlite::Error>((total_events, total_entities, total_edges, total_vectors))
    }).await;

    match stats {
        Ok(Ok((events, entities, edges, vectors))) => {
            (StatusCode::OK, Json(json!({
                "memories": { "total": events },
                "insights": entities,
                "connections": edges,
                "vectors": vectors,
            })))
        }
        _ => (StatusCode::OK, Json(json!({
            "memories": { "total": 0 },
            "insights": 0,
            "connections": 0,
            "vectors": 0,
        }))),
    }
}
