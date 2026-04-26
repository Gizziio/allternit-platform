//! Event store service
//!
//! Provides append-only event ledger with cursor-based pagination
//! and replay capabilities for event streaming.

use crate::db::cowork_models::*;
use crate::error::ApiError;
use async_trait::async_trait;
use chrono::Utc;
use sqlx::SqlitePool;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Event store trait - append-only ledger with streaming support
#[async_trait]
pub trait EventStore: Send + Sync {
    /// Append a new event to the ledger
    async fn append(&self, run_id: &str, event_type: EventType, payload: EventPayload) -> Result<Event, ApiError>;
    
    /// Append an event with source client information
    async fn append_with_source(
        &self,
        run_id: &str,
        event_type: EventType,
        payload: EventPayload,
        client_id: Option<&str>,
        client_type: Option<ClientType>,
    ) -> Result<Event, ApiError>;
    
    /// Get a single event by ID
    async fn get(&self, event_id: &str) -> Result<Event, ApiError>;
    
    /// Get events for a run with optional filtering
    async fn get_for_run(&self, run_id: &str, filter: EventFilter) -> Result<Vec<Event>, ApiError>;
    
    /// Get events starting from a specific sequence number
    async fn get_from_sequence(&self, run_id: &str, sequence: i64, limit: Option<i64>) -> Result<Vec<Event>, ApiError>;
    
    /// Get the latest sequence number for a run
    async fn get_latest_sequence(&self, run_id: &str) -> Result<i64, ApiError>;
    
    /// Subscribe to events for a run (real-time streaming)
    async fn subscribe(&self, run_id: &str) -> Result<broadcast::Receiver<Event>, ApiError>;
    
    /// Get events by type
    async fn get_by_type(&self, run_id: &str, event_type: EventType, limit: Option<i64>) -> Result<Vec<Event>, ApiError>;
}

/// Event store implementation using SQLite
pub struct EventStoreImpl {
    db: SqlitePool,
    /// Broadcast channels for each run (run_id -> sender)
    channels: tokio::sync::RwLock<std::collections::HashMap<String, broadcast::Sender<Event>>>,
}

impl EventStoreImpl {
    /// Create a new EventStoreImpl
    pub fn new(db: SqlitePool) -> Self {
        Self {
            db,
            channels: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        }
    }
    
    /// Get or create a broadcast channel for a run
    async fn get_or_create_channel(&self, run_id: &str) -> broadcast::Sender<Event> {
        let channels = self.channels.read().await;
        if let Some(sender) = channels.get(run_id) {
            return sender.clone();
        }
        drop(channels);
        
        let mut channels = self.channels.write().await;
        // Double-check after acquiring write lock
        if let Some(sender) = channels.get(run_id) {
            return sender.clone();
        }
        
        let (sender, _) = broadcast::channel(1000);
        channels.insert(run_id.to_string(), sender.clone());
        sender
    }
    
    /// Get the next sequence number for a run
    async fn next_sequence(&self, run_id: &str) -> Result<i64, ApiError> {
        let result = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT MAX(sequence) FROM events WHERE run_id = ?"
        )
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        Ok(result.unwrap_or(0) + 1)
    }
}

#[async_trait]
impl EventStore for EventStoreImpl {
    async fn append(&self, run_id: &str, event_type: EventType, payload: EventPayload) -> Result<Event, ApiError> {
        self.append_with_source(run_id, event_type, payload, None, None).await
    }
    
    async fn append_with_source(
        &self,
        run_id: &str,
        event_type: EventType,
        payload: EventPayload,
        client_id: Option<&str>,
        client_type: Option<ClientType>,
    ) -> Result<Event, ApiError> {
        let event_id = Uuid::new_v4().to_string();
        let sequence = self.next_sequence(run_id).await?;
        let now = Utc::now();
        
        let event = sqlx::query_as::<_, Event>(
            r#"
            INSERT INTO events (
                id, run_id, sequence, event_type, payload,
                source_client_id, source_client_type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            "#
        )
        .bind(&event_id)
        .bind(run_id)
        .bind(sequence)
        .bind(event_type)
        .bind(sqlx::types::Json(payload))
        .bind(client_id)
        .bind(client_type)
        .bind(now)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Broadcast to any subscribers
        let sender = self.get_or_create_channel(run_id).await;
        let _ = sender.send(event.clone());
        
        Ok(event)
    }
    
    async fn get(&self, event_id: &str) -> Result<Event, ApiError> {
        let event = sqlx::query_as::<_, Event>(
            "SELECT * FROM events WHERE id = ?"
        )
        .bind(event_id)
        .fetch_optional(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        event.ok_or_else(|| ApiError::NotFound(format!("Event not found: {}", event_id)))
    }
    
    async fn get_for_run(&self, run_id: &str, filter: EventFilter) -> Result<Vec<Event>, ApiError> {
        let mut query = String::from("SELECT * FROM events WHERE run_id = ?");
        
        // Build dynamic query based on filters
        if filter.event_types.is_some() {
            query.push_str(" AND event_type IN (");
            // We'll handle this with a workaround since SQLite doesn't support array params easily
        }
        
        if filter.cursor.is_some() {
            query.push_str(" AND sequence > ?");
        }
        
        if filter.since.is_some() {
            query.push_str(" AND created_at >= ?");
        }
        
        if filter.until.is_some() {
            query.push_str(" AND created_at <= ?");
        }
        
        query.push_str(" ORDER BY sequence ASC");
        
        if let Some(limit) = filter.limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }
        
        // For now, use a simpler approach without complex filtering
        let events = if let Some(cursor) = filter.cursor {
            if let Some(limit) = filter.limit {
                sqlx::query_as::<_, Event>(
                    "SELECT * FROM events WHERE run_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?"
                )
                .bind(run_id)
                .bind(cursor)
                .bind(limit)
                .fetch_all(&self.db)
                .await
                .map_err(|e| ApiError::DatabaseError(e))?
            } else {
                sqlx::query_as::<_, Event>(
                    "SELECT * FROM events WHERE run_id = ? AND sequence > ? ORDER BY sequence ASC"
                )
                .bind(run_id)
                .bind(cursor)
                .fetch_all(&self.db)
                .await
                .map_err(|e| ApiError::DatabaseError(e))?
            }
        } else {
            if let Some(limit) = filter.limit {
                sqlx::query_as::<_, Event>(
                    "SELECT * FROM events WHERE run_id = ? ORDER BY sequence ASC LIMIT ?"
                )
                .bind(run_id)
                .bind(limit)
                .fetch_all(&self.db)
                .await
                .map_err(|e| ApiError::DatabaseError(e))?
            } else {
                sqlx::query_as::<_, Event>(
                    "SELECT * FROM events WHERE run_id = ? ORDER BY sequence ASC"
                )
                .bind(run_id)
                .fetch_all(&self.db)
                .await
                .map_err(|e| ApiError::DatabaseError(e))?
            }
        };
        
        Ok(events)
    }
    
    async fn get_from_sequence(&self, run_id: &str, sequence: i64, limit: Option<i64>) -> Result<Vec<Event>, ApiError> {
        let events = if let Some(limit) = limit {
            sqlx::query_as::<_, Event>(
                "SELECT * FROM events WHERE run_id = ? AND sequence >= ? ORDER BY sequence ASC LIMIT ?"
            )
            .bind(run_id)
            .bind(sequence)
            .bind(limit)
            .fetch_all(&self.db)
            .await
            .map_err(|e| ApiError::DatabaseError(e))?
        } else {
            sqlx::query_as::<_, Event>(
                "SELECT * FROM events WHERE run_id = ? AND sequence >= ? ORDER BY sequence ASC"
            )
            .bind(run_id)
            .bind(sequence)
            .fetch_all(&self.db)
            .await
            .map_err(|e| ApiError::DatabaseError(e))?
        };
        
        Ok(events)
    }
    
    async fn get_latest_sequence(&self, run_id: &str) -> Result<i64, ApiError> {
        let result = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT MAX(sequence) FROM events WHERE run_id = ?"
        )
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        Ok(result.unwrap_or(0))
    }
    
    async fn subscribe(&self, run_id: &str) -> Result<broadcast::Receiver<Event>, ApiError> {
        let sender = self.get_or_create_channel(run_id).await;
        Ok(sender.subscribe())
    }
    
    async fn get_by_type(&self, run_id: &str, event_type: EventType, limit: Option<i64>) -> Result<Vec<Event>, ApiError> {
        let events = if let Some(limit) = limit {
            sqlx::query_as::<_, Event>(
                "SELECT * FROM events WHERE run_id = ? AND event_type = ? ORDER BY sequence DESC LIMIT ?"
            )
            .bind(run_id)
            .bind(event_type)
            .bind(limit)
            .fetch_all(&self.db)
            .await
            .map_err(|e| ApiError::DatabaseError(e))?
        } else {
            sqlx::query_as::<_, Event>(
                "SELECT * FROM events WHERE run_id = ? AND event_type = ? ORDER BY sequence DESC"
            )
            .bind(run_id)
            .bind(event_type)
            .fetch_all(&self.db)
            .await
            .map_err(|e| ApiError::DatabaseError(e))?
        };
        
        Ok(events)
    }
}

/// Utility functions for event creation
pub mod event_utils {
    use super::*;
    use serde_json::json;
    
    /// Create a run created event
    pub fn run_created(run_name: &str, mode: RunMode) -> EventPayload {
        json!({
            "run_name": run_name,
            "mode": mode,
        })
    }
    
    /// Create a run started event
    pub fn run_started(runtime_id: Option<&str>) -> EventPayload {
        json!({
            "runtime_id": runtime_id,
            "started_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create a run completed event
    pub fn run_completed(duration_ms: i64) -> EventPayload {
        json!({
            "duration_ms": duration_ms,
            "completed_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create a run failed event
    pub fn run_failed(error: &str, details: Option<serde_json::Value>) -> EventPayload {
        json!({
            "error": error,
            "details": details,
            "failed_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create a step started event
    pub fn step_started(step_id: &str, step_name: &str, step_number: i32) -> EventPayload {
        json!({
            "step_id": step_id,
            "step_name": step_name,
            "step_number": step_number,
        })
    }
    
    /// Create a step completed event
    pub fn step_completed(step_id: &str, result: Option<serde_json::Value>) -> EventPayload {
        json!({
            "step_id": step_id,
            "result": result,
        })
    }
    
    /// Create an output event
    pub fn output(stream: &str, content: &str) -> EventPayload {
        json!({
            "stream": stream, // "stdout" or "stderr"
            "content": content,
        })
    }
    
    /// Create a tool call event
    pub fn tool_call(tool_name: &str, args: serde_json::Value) -> EventPayload {
        json!({
            "tool_name": tool_name,
            "args": args,
        })
    }
    
    /// Create a tool result event
    pub fn tool_result(tool_name: &str, success: bool, result: serde_json::Value) -> EventPayload {
        json!({
            "tool_name": tool_name,
            "success": success,
            "result": result,
        })
    }
    
    /// Create an approval needed event
    pub fn approval_needed(tool_name: &str, action: &str, details: Option<serde_json::Value>) -> EventPayload {
        json!({
            "tool_name": tool_name,
            "action": action,
            "details": details,
            "requested_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create an approval given event
    pub fn approval_given(tool_name: &str, approved_by: &str) -> EventPayload {
        json!({
            "tool_name": tool_name,
            "approved_by": approved_by,
            "approved_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create an approval denied event
    pub fn approval_denied(tool_name: &str, denied_by: &str, reason: Option<&str>) -> EventPayload {
        json!({
            "tool_name": tool_name,
            "denied_by": denied_by,
            "reason": reason,
            "denied_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create a job queued event
    pub fn job_queued(job_id: &str, job_name: &str, priority: i32) -> EventPayload {
        json!({
            "job_id": job_id,
            "job_name": job_name,
            "priority": priority,
        })
    }
    
    /// Create a job started event
    pub fn job_started(job_id: &str, executor_id: Option<&str>) -> EventPayload {
        json!({
            "job_id": job_id,
            "executor_id": executor_id,
            "started_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create a job completed event
    pub fn job_completed(job_id: &str, exit_code: i32) -> EventPayload {
        json!({
            "job_id": job_id,
            "exit_code": exit_code,
            "completed_at": Utc::now().to_rfc3339(),
        })
    }
    
    /// Create a heartbeat event
    pub fn heartbeat(step_cursor: Option<&str>) -> EventPayload {
        json!({
            "step_cursor": step_cursor,
            "timestamp": Utc::now().to_rfc3339(),
        })
    }
}
