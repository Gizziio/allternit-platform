// /services/audit-log/src/main.rs
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tokio;
use tower_http::cors::CorsLayer;
use std::collections::VecDeque;

#[derive(Clone)]
struct AppState {
    log_store: Arc<RwLock<VecDeque<AuditEvent>>>,
    max_log_size: usize,
}

#[derive(Deserialize, Serialize, Clone)]
struct AuditEvent {
    id: String,
    timestamp: u64,
    event_type: String,
    user_id: Option<String>,
    agent_id: Option<String>,
    session_id: Option<String>,
    action: String,
    details: serde_json::Value,
    source: String,
    metadata: serde_json::Value,
}

#[derive(Deserialize)]
struct LogRequest {
    event_type: String,
    user_id: Option<String>,
    agent_id: Option<String>,
    session_id: Option<String>,
    action: String,
    details: serde_json::Value,
    source: String,
    metadata: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct LogResponse {
    success: bool,
    event_id: String,
}

#[derive(Deserialize)]
struct QueryRequest {
    user_id: Option<String>,
    agent_id: Option<String>,
    event_type: Option<String>,
    start_time: Option<u64>,
    end_time: Option<u64>,
    limit: Option<usize>,
}

#[tokio::main]
async fn main() {
    let app_state = Arc::new(AppState {
        log_store: Arc::new(RwLock::new(VecDeque::new())),
        max_log_size: 10000, // Keep last 10,000 events in memory
    });

    let app = Router::new()
        .route("/log", post(handle_log_event))
        .route("/query", post(handle_query_events))
        .route("/events", get(handle_list_events))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3104".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Audit Log Service listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

async fn handle_log_event(
    State(state): State<Arc<AppState>>,
    request: Json<LogRequest>,
) -> Result<Json<LogResponse>, StatusCode> {
    let event_id = format!("audit_{}", uuid::Uuid::new_v4());
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let event = AuditEvent {
        id: event_id.clone(),
        timestamp,
        event_type: request.event_type.clone(),
        user_id: request.user_id.clone(),
        agent_id: request.agent_id.clone(),
        session_id: request.session_id.clone(),
        action: request.action.clone(),
        details: request.details.clone(),
        source: request.source.clone(),
        metadata: request.metadata.clone().unwrap_or(serde_json::json!({})),
    };

    let mut log_store = state.log_store.write().unwrap();
    
    // Add event to log
    log_store.push_back(event);
    
    // Maintain max log size
    while log_store.len() > state.max_log_size {
        log_store.pop_front();
    }

    Ok(Json(LogResponse {
        success: true,
        event_id,
    }))
}

async fn handle_query_events(
    State(state): State<Arc<AppState>>,
    request: Json<QueryRequest>,
) -> Result<Json<Vec<AuditEvent>>, StatusCode> {
    let log_store = state.log_store.read().unwrap();
    
    let filtered_events: Vec<AuditEvent> = log_store
        .iter()
        .filter(|event| {
            // Apply filters
            if let Some(ref user_id) = request.user_id {
                if event.user_id.as_ref() != Some(user_id) {
                    return false;
                }
            }
            
            if let Some(ref agent_id) = request.agent_id {
                if event.agent_id.as_ref() != Some(agent_id) {
                    return false;
                }
            }
            
            if let Some(ref event_type) = request.event_type {
                if event.event_type != *event_type {
                    return false;
                }
            }
            
            if let Some(start_time) = request.start_time {
                if event.timestamp < start_time {
                    return false;
                }
            }
            
            if let Some(end_time) = request.end_time {
                if event.timestamp > end_time {
                    return false;
                }
            }
            
            true
        })
        .cloned()
        .collect();

    // Apply limit if specified
    let result = if let Some(limit) = request.limit {
        filtered_events.into_iter().take(limit).collect()
    } else {
        filtered_events
    };

    Ok(Json(result))
}

async fn handle_list_events(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AuditEvent>>, StatusCode> {
    let log_store = state.log_store.read().unwrap();
    let events: Vec<AuditEvent> = log_store.iter().rev().take(100).cloned().collect(); // Last 100 events
    Ok(Json(events))
}
