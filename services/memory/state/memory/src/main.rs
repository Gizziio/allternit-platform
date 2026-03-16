use a2rchitech_memory::{MemoryEntry, MemoryQuery, MemoryService};
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{error, info};

#[derive(Clone)]
struct AppState {
    memory_service: Arc<MemoryService>,
}

#[derive(Deserialize)]
struct StoreMemoryRequest {
    id: String,
    content: String,
    metadata: serde_json::Value,
    embedding: Option<Vec<f32>>,
}

#[derive(Serialize)]
struct StoreMemoryResponse {
    success: bool,
    message: String,
}

#[derive(Deserialize)]
struct RetrieveMemoryRequest {
    query: String,
    top_k: Option<usize>,
    filter: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct RetrieveMemoryResponse {
    entries: Vec<MemoryEntry>,
    success: bool,
}

#[derive(Deserialize)]
struct DeleteMemoryRequest {
    id: String,
}

#[derive(Serialize)]
struct DeleteMemoryResponse {
    success: bool,
    message: String,
}

async fn handle_store_memory(
    State(state): State<AppState>,
    Json(req): Json<StoreMemoryRequest>,
) -> std::result::Result<Json<StoreMemoryResponse>, StatusCode> {
    info!("Storing memory entry: {}", req.id);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let entry = MemoryEntry {
        id: req.id.clone(),
        memory_id: req.id,
        tenant_id: "default".to_string(),
        session_id: None,
        agent_id: None,
        memory_type: a2rchitech_memory::MemoryType::Semantic,
        content: serde_json::Value::String(req.content),
        metadata: req.metadata,
        embedding: req.embedding,
        created_at: now,
        last_accessed: now,
        access_count: 0,
        sensitivity_tier: 0,
        tags: vec![],
        provenance: a2rchitech_memory::MemoryProvenance {
            source_session: None,
            source_agent: "system".to_string(),
            derivation_chain: vec![],
            integrity_hash: "".to_string(),
            signature: None,
        },
        retention_policy: a2rchitech_memory::MemoryRetentionPolicy {
            time_to_live: None,
            max_accesses: None,
            decay_function: a2rchitech_memory::MemoryDecayFunction::Linear { rate: 0.0 },
            consolidation_trigger: a2rchitech_memory::ConsolidationTrigger::Manual,
            deletion_policy: a2rchitech_memory::DeletionPolicy::Archival,
        },
        consolidation_state: a2rchitech_memory::ConsolidationState::Raw,
        status: "active".to_string(),
        valid_from: Some(now),
        valid_to: None,
        confidence: 0.75,
        authority: "agent".to_string(),
        supersedes_memory_id: None,
    };

    match state.memory_service.store_memory(entry).await {
        Ok(_) => Ok(Json(StoreMemoryResponse {
            success: true,
            message: "Memory stored successfully".to_string(),
        })),
        Err(e) => {
            error!("Failed to store memory: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn handle_retrieve_memory(
    State(state): State<AppState>,
    Json(req): Json<RetrieveMemoryRequest>,
) -> std::result::Result<Json<RetrieveMemoryResponse>, StatusCode> {
    info!("Retrieving memories for query: {}", req.query);

    let query = MemoryQuery {
        query: req.query,
        top_k: req.top_k.unwrap_or(5),
        filter: req.filter,
        tenant_id: "default".to_string(),
        session_id: None,
        agent_id: None,
        memory_types: vec![],
        max_sensitivity_tier: None,
        required_tags: vec![],
        time_range: None,
        content_search: None,
        limit: None,
        sort_by: None,
        status_filter: None,
    };

    match state.memory_service.retrieve_memories(query).await {
        Ok(entries) => Ok(Json(RetrieveMemoryResponse {
            entries,
            success: true,
        })),
        Err(e) => {
            error!("Failed to retrieve memories: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn handle_delete_memory(
    State(state): State<AppState>,
    Json(req): Json<DeleteMemoryRequest>,
) -> std::result::Result<Json<DeleteMemoryResponse>, StatusCode> {
    info!("Deleting memory entry: {}", req.id);

    match state.memory_service.delete_memory(&req.id).await {
        Ok(_) => Ok(Json(DeleteMemoryResponse {
            success: true,
            message: "Memory deleted successfully".to_string(),
        })),
        Err(e) => {
            error!("Failed to delete memory: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "memory-service",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    })))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    // Initialize memory backend
    let backend = if std::env::var("USE_REDIS").is_ok() {
        let redis_url = std::env::var("REDIS_URL").unwrap_or("redis://127.0.0.1/".to_string());
        let redis_store =
            a2rchitech_memory::RedisMemoryStore::new(&redis_url, "a2rchitech".to_string())?;
        a2rchitech_memory::MemoryBackend::Redis(redis_store)
    } else if std::env::var("USE_QDRANT").is_ok() {
        let qdrant_url = std::env::var("QDRANT_URL").unwrap_or("http://localhost:6334".to_string());
        let qdrant_store = a2rchitech_memory::QdrantMemoryStore::new(
            &qdrant_url,
            "a2rchitech_memories".to_string(),
        )?;
        a2rchitech_memory::MemoryBackend::Qdrant(qdrant_store)
    } else {
        // Default to Fabric if no specific backend requested, using mock components for now
        // In a real environment, these would be properly initialized
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await?;
        sqlx::query("CREATE TABLE dummy (id INTEGER)")
            .execute(&pool)
            .await?; // Just to ensure pool is usable

        // We'll use Redis as a fallback for the mock since it's easier to initialize in this context
        let redis_url = "redis://127.0.0.1/";
        let redis_store =
            a2rchitech_memory::RedisMemoryStore::new(redis_url, "a2rchitech".to_string())?;
        a2rchitech_memory::MemoryBackend::Redis(redis_store)
    };

    let memory_service = Arc::new(a2rchitech_memory::MemoryService::new(backend));

    let state = AppState { memory_service };

    let app = Router::new()
        .route("/v1/memory/store", post(handle_store_memory))
        .route("/v1/memory/retrieve", post(handle_retrieve_memory))
        .route("/v1/memory/delete", post(handle_delete_memory))
        .route("/health", get(health_check))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3009".to_string());
    let addr = format!("{}:{}", host, port);
    info!("Memory Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
