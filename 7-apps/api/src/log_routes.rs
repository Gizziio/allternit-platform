//! Log Routes - Native Log Service HTTP API
//!
//! Provides REST API endpoints for querying and streaming logs using the native
//! Rust implementation in a2r_openclaw_host::native_log_service.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use tokio_stream::wrappers::BroadcastStream;
use utoipa::ToSchema;

use a2r_openclaw_host::native_log_service::{LogOperation, LogQuery};

/// Log entry response
#[derive(Debug, Serialize, ToSchema)]
pub struct LogEntryResponse {
    pub timestamp: String,
    pub level: String,
    pub source: String,
    pub message: String,
    pub metadata: Option<HashMap<String, String>>,
}

/// Log list response
#[derive(Debug, Serialize, ToSchema)]
pub struct LogListResponse {
    pub entries: Vec<LogEntryResponse>,
    pub count: usize,
}

/// Log source info
#[derive(Debug, Serialize, ToSchema)]
pub struct LogSourceInfo {
    pub name: String,
    pub path: String,
    pub size: Option<u64>,
    pub modified_at: Option<u64>,
}

/// Log sources response
#[derive(Debug, Serialize, ToSchema)]
pub struct LogSourcesResponse {
    pub sources: Vec<LogSourceInfo>,
    pub count: usize,
}

/// Log query parameters
#[derive(Debug, Deserialize, ToSchema)]
pub struct LogQueryParams {
    /// Source to query (comma-separated for multiple)
    pub source: Option<String>,
    /// Number of lines to return (for tail)
    pub lines: Option<usize>,
    /// Log level filter (INFO, WARN, ERROR, DEBUG)
    pub level: Option<String>,
    /// Search term to filter messages
    pub search: Option<String>,
    /// ISO 8601 timestamp to filter entries after
    pub since: Option<String>,
    /// ISO 8601 timestamp to filter entries before
    pub until: Option<String>,
    /// Maximum number of entries to return
    pub limit: Option<usize>,
}

/// Log stream query parameters
#[derive(Debug, Deserialize, ToSchema)]
pub struct LogStreamQueryParams {
    /// Source to stream (comma-separated for multiple)
    pub source: Option<String>,
    /// Log level filter
    pub level: Option<String>,
    /// Search term to filter messages
    pub filter: Option<String>,
}

/// Log error response
#[derive(Debug, Serialize, ToSchema)]
pub struct LogErrorResponse {
    pub error: String,
}

/// Log stream event
#[derive(Debug, Serialize)]
struct LogStreamEvent {
    pub timestamp: String,
    pub level: String,
    pub source: String,
    pub message: String,
}

/// Create router for log routes
pub fn create_log_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Log query endpoints
        .route("/api/v1/logs", get(query_logs))
        // Log sources endpoint
        .route("/api/v1/logs/sources", get(list_log_sources))
        // Log streaming endpoint (SSE)
        .route("/api/v1/logs/stream", get(stream_logs))
}

/// Query logs with optional filters
#[utoipa::path(
    get,
    path = "/api/v1/logs",
    params(
        ("source" = Option<String>, Query, description = "Source to query (comma-separated for multiple)"),
        ("lines" = Option<usize>, Query, description = "Number of lines to return (tail mode)"),
        ("level" = Option<String>, Query, description = "Log level filter (INFO, WARN, ERROR, DEBUG)"),
        ("search" = Option<String>, Query, description = "Search term to filter messages"),
        ("since" = Option<String>, Query, description = "ISO 8601 timestamp to filter entries after"),
        ("until" = Option<String>, Query, description = "ISO 8601 timestamp to filter entries before"),
        ("limit" = Option<usize>, Query, description = "Maximum number of entries to return")
    ),
    responses(
        (status = 200, description = "Logs retrieved successfully", body = LogListResponse),
        (status = 400, description = "Invalid query parameters", body = LogErrorResponse),
        (status = 500, description = "Failed to retrieve logs", body = LogErrorResponse)
    )
)]
async fn query_logs(
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<LogQueryParams>,
) -> impl IntoResponse {
    let log_service = match state.log_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Log service not initialized"})),
            )
                .into_response();
        }
    };

    // Parse sources
    let sources = params.source.map(|s| {
        s.split(',')
            .map(|s| s.trim().to_string())
            .collect::<Vec<_>>()
    });

    // Parse timestamps
    let since = match params.since {
        Some(ref ts) => match chrono::DateTime::parse_from_rfc3339(ts) {
            Ok(dt) => Some(dt.with_timezone(&chrono::Utc)),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error": format!("Invalid since timestamp: {}", ts)})),
                )
                    .into_response();
            }
        },
        None => None,
    };

    let until = match params.until {
        Some(ref ts) => match chrono::DateTime::parse_from_rfc3339(ts) {
            Ok(dt) => Some(dt.with_timezone(&chrono::Utc)),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error": format!("Invalid until timestamp: {}", ts)})),
                )
                    .into_response();
            }
        },
        None => None,
    };

    let service = log_service.read().await;

    // If lines parameter is provided, do a tail query
    if let Some(lines) = params.lines {
        let sources_clone = sources.clone().unwrap_or_default();
        let operation = LogOperation::TailLogs {
            sources: sources_clone,
            lines,
        };

        match service.execute(operation).await {
            Ok(result) => {
                let entries = parse_log_entries(&result);
                let response = LogListResponse {
                    count: entries.len(),
                    entries,
                };
                return (StatusCode::OK, Json(response)).into_response();
            }
            Err(e) => {
                tracing::error!("Failed to tail logs: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": format!("Failed to tail logs: {}", e)})),
                )
                    .into_response();
            }
        }
    }

    // Regular query
    let query = LogQuery {
        sources,
        level: params.level,
        since,
        until,
        search: params.search,
        limit: params.limit,
    };

    let operation = LogOperation::QueryLogs { query };

    match service.execute(operation).await {
        Ok(result) => {
            let entries = parse_log_entries(&result);
            let response = LogListResponse {
                count: entries.len(),
                entries,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to query logs: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to query logs: {}", e)})),
            )
                .into_response()
        }
    }
}

/// List available log sources
#[utoipa::path(
    get,
    path = "/api/v1/logs/sources",
    responses(
        (status = 200, description = "Log sources retrieved successfully", body = LogSourcesResponse),
        (status = 500, description = "Failed to retrieve sources", body = LogErrorResponse)
    )
)]
async fn list_log_sources(State(state): State<Arc<crate::AppState>>) -> impl IntoResponse {
    let log_service = match state.log_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Log service not initialized"})),
            )
                .into_response();
        }
    };

    let service = log_service.read().await;
    let operation = LogOperation::GetSources;

    match service.execute(operation).await {
        Ok(result) => {
            let sources =
                if let Some(sources_arr) = result.get("sources").and_then(|s| s.as_array()) {
                    sources_arr
                        .iter()
                        .filter_map(|s| {
                            Some(LogSourceInfo {
                                name: s.get("name")?.as_str()?.to_string(),
                                path: s.get("path")?.as_str()?.to_string(),
                                size: s.get("size").and_then(|v| v.as_u64()),
                                modified_at: s.get("modified_at").and_then(|v| v.as_u64()),
                            })
                        })
                        .collect::<Vec<_>>()
                } else {
                    Vec::new()
                };

            let response = LogSourcesResponse {
                count: sources.len(),
                sources,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list log sources: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to list sources: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Stream logs via Server-Sent Events (SSE)
#[utoipa::path(
    get,
    path = "/api/v1/logs/stream",
    params(
        ("source" = Option<String>, Query, description = "Source to stream (comma-separated for multiple)"),
        ("level" = Option<String>, Query, description = "Log level filter"),
        ("filter" = Option<String>, Query, description = "Search term to filter messages")
    ),
    responses(
        (status = 200, description = "Log stream established", body = String),
        (status = 500, description = "Failed to start stream", body = LogErrorResponse)
    )
)]
async fn stream_logs(
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<LogStreamQueryParams>,
) -> impl IntoResponse {
    use axum::response::sse::Event;

    let log_service = match state.log_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Log service not initialized"})),
            )
                .into_response();
        }
    };

    // Parse sources
    let sources = params
        .source
        .map(|s| {
            s.split(',')
                .map(|s| s.trim().to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let level_filter = params.level.map(|s| s.to_lowercase());
    let search_filter = params.filter.map(|s| s.to_lowercase());

    let service = log_service.read().await;
    let rx = service.subscribe();
    drop(service); // Release the read lock

    // Create SSE stream using BroadcastStream
    let stream = BroadcastStream::new(rx).filter_map(move |result| {
        let sources = sources.clone();
        let level_filter = level_filter.clone();
        let search_filter = search_filter.clone();

        async move {
            match result {
                Ok(entry) => {
                    // Apply filters
                    if let Some(ref level) = level_filter {
                        if entry.level.to_lowercase() != *level {
                            return None;
                        }
                    }

                    if let Some(ref filter) = search_filter {
                        if !entry.message.to_lowercase().contains(filter) {
                            return None;
                        }
                    }

                    if !sources.is_empty() && !sources.contains(&entry.source) {
                        return None;
                    }

                    let event = LogStreamEvent {
                        timestamp: entry.timestamp.to_rfc3339(),
                        level: entry.level,
                        source: entry.source,
                        message: entry.message,
                    };

                    match serde_json::to_string(&event) {
                        Ok(json) => Some(Ok::<_, Infallible>(Event::default().data(json))),
                        Err(_) => None,
                    }
                }
                Err(_) => {
                    tracing::debug!("Log stream lagged or closed");
                    None
                }
            }
        }
    });

    axum::response::Sse::new(stream)
        .keep_alive(axum::response::sse::KeepAlive::default())
        .into_response()
}

/// Parse log entries from query result
fn parse_log_entries(result: &serde_json::Value) -> Vec<LogEntryResponse> {
    if let Some(entries) = result.get("entries").and_then(|e| e.as_array()) {
        entries
            .iter()
            .filter_map(|e| {
                let timestamp = e
                    .get("timestamp")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

                let level = e.get("level").and_then(|v| v.as_str())?;
                let source = e.get("source").and_then(|v| v.as_str())?;
                let message = e.get("message").and_then(|v| v.as_str())?;

                let metadata = e.get("metadata").and_then(|m| {
                    m.as_object().map(|obj| {
                        obj.iter()
                            .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                            .collect()
                    })
                });

                Some(LogEntryResponse {
                    timestamp,
                    level: level.to_string(),
                    source: source.to_string(),
                    message: message.to_string(),
                    metadata,
                })
            })
            .collect()
    } else {
        Vec::new()
    }
}
