//! Session Manager - Connects session multiplexer to Control Plane
//!
//! Manages multiple client sessions attached to the same run,
//! with proper isolation and event routing.

use super::*;
use crate::db::cowork_models::*;
use crate::error::ApiError;
use crate::services::{EventStore, EventStoreImpl};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Session manager - manages client attachments to runs
pub struct SessionManager {
    /// Database pool
    db: sqlx::SqlitePool,
    /// Active sessions (run_id -> SessionState)
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    /// Event store for persisting events
    event_store: EventStoreImpl,
}

/// Session state for a run
#[derive(Debug)]
struct SessionState {
    /// Run ID
    run_id: String,
    /// Attached clients
    clients: HashMap<String, ClientSession>,
    /// Event broadcast channel
    event_tx: tokio::sync::broadcast::Sender<SessionEvent>,
}

/// Client session
#[derive(Debug, Clone)]
struct ClientSession {
    client_id: String,
    client_type: ClientType,
    user_id: Option<String>,
    attached_at: chrono::DateTime<chrono::Utc>,
    cursor_sequence: i64,
}

/// Session event - wrapper around runtime events
#[derive(Debug, Clone)]
pub struct SessionEvent {
    pub event_type: SessionEventType,
    pub payload: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub source_client: Option<String>,
}

/// Session event types
#[derive(Debug, Clone)]
pub enum SessionEventType {
    RuntimeEvent(RuntimeEventType),
    ClientAttached,
    ClientDetached,
    SessionClosed,
    /// Approval request notification
    ApprovalNeeded,
    /// Approval was granted
    ApprovalGranted,
    /// Approval was denied
    ApprovalDenied,
    /// Approval timed out
    ApprovalTimeout,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new(db: sqlx::SqlitePool) -> Self {
        let event_store = EventStoreImpl::new(db.clone());
        Self {
            db,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            event_store,
        }
    }
    
    /// Attach a client to a run
    pub async fn attach(
        &self,
        run_id: &str,
        client_type: ClientType,
        user_id: Option<String>,
    ) -> Result<(String, tokio::sync::broadcast::Receiver<SessionEvent>), ApiError> {
        let client_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        
        // Register attachment in database
        let attachment_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO attachments (id, run_id, client_id, client_type, user_id, cursor_sequence, attached_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&attachment_id)
        .bind(run_id)
        .bind(&client_id)
        .bind(client_type)
        .bind(&user_id)
        .bind(0i64)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Get or create session
        let mut sessions = self.sessions.write().await;
        let session = sessions.entry(run_id.to_string()).or_insert_with(|| {
            let (tx, _) = tokio::sync::broadcast::channel(1000);
            SessionState {
                run_id: run_id.to_string(),
                clients: HashMap::new(),
                event_tx: tx,
            }
        });
        
        // Add client to session
        let client = ClientSession {
            client_id: client_id.clone(),
            client_type,
            user_id: user_id.clone(),
            attached_at: now,
            cursor_sequence: 0,
        };
        session.clients.insert(client_id.clone(), client);
        
        // Subscribe to events
        let rx = session.event_tx.subscribe();
        
        // Emit client attached event
        let _ = session.event_tx.send(SessionEvent {
            event_type: SessionEventType::ClientAttached,
            payload: serde_json::json!({
                "client_id": &client_id,
                "client_type": format!("{:?}", client_type),
                "user_id": user_id.clone(),
                "attached_at": now,
            }),
            timestamp: now,
            source_client: None,
        });
        
        // Emit event to event store
        let _ = self.event_store.append_with_source(
            run_id,
            EventType::Stdout, // Using stdout for session events
            serde_json::json!({
                "message": format!("Client {} attached", client_id),
                "client_type": format!("{:?}", client_type),
            }),
            Some(&client_id),
            Some(client_type),
        ).await;
        
        tracing::info!("Client {} attached to run {}", client_id, run_id);
        
        Ok((client_id, rx))
    }
    
    /// Detach a client from a run
    pub async fn detach(&self, run_id: &str, client_id: &str) -> Result<(), ApiError> {
        let now = chrono::Utc::now();
        
        // Update database
        sqlx::query(
            "UPDATE attachments SET detached_at = ? WHERE run_id = ? AND client_id = ?"
        )
        .bind(now)
        .bind(run_id)
        .bind(client_id)
        .execute(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Update session state
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(run_id) {
            session.clients.remove(client_id);
            
            // Emit client detached event
            let _ = session.event_tx.send(SessionEvent {
                event_type: SessionEventType::ClientDetached,
                payload: serde_json::json!({
                    "client_id": client_id,
                    "detached_at": now,
                }),
                timestamp: now,
                source_client: None,
            });
            
            // Clean up empty sessions
            if session.clients.is_empty() {
                sessions.remove(run_id);
            }
        }
        
        tracing::info!("Client {} detached from run {}", client_id, run_id);
        
        Ok(())
    }
    
    /// Send input to a run (from a client)
    pub async fn send_input(
        &self,
        run_id: &str,
        client_id: &str,
        input: &str,
    ) -> Result<(), ApiError> {
        // Verify client is attached
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(run_id)
            .ok_or_else(|| ApiError::NotFound(format!("No active session for run: {}", run_id)))?;
        
        if !session.clients.contains_key(client_id) {
            return Err(ApiError::NotFound(format!("Client not attached: {}", client_id)));
        }
        
        // Emit input event to all clients (echo back to sender for confirmation)
        let _ = session.event_tx.send(SessionEvent {
            event_type: SessionEventType::RuntimeEvent(RuntimeEventType::Output),
            payload: serde_json::json!({
                "stream": "stdin",
                "content": input,
                "client_id": client_id,
            }),
            timestamp: chrono::Utc::now(),
            source_client: Some(client_id.to_string()),
        });
        
        // Store in event ledger
        self.event_store.append_with_source(
            run_id,
            EventType::Stdout,
            serde_json::json!({
                "stream": "stdin",
                "content": input,
            }),
            Some(client_id),
            Some(ClientType::Terminal),
        ).await?;
        
        Ok(())
    }
    
    /// Broadcast output from runtime to all attached clients
    pub async fn broadcast_output(
        &self,
        run_id: &str,
        stream: &str,
        content: &str,
    ) -> Result<(), ApiError> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(run_id) {
            // Send to all attached clients
            let _ = session.event_tx.send(SessionEvent {
                event_type: SessionEventType::RuntimeEvent(RuntimeEventType::Output),
                payload: serde_json::json!({
                    "stream": stream,
                    "content": content,
                }),
                timestamp: chrono::Utc::now(),
                source_client: None,
            });
        }
        
        // Store in event ledger
        let event_type = match stream {
            "stderr" => EventType::Stderr,
            _ => EventType::Stdout,
        };
        
        self.event_store.append(
            run_id,
            event_type,
            serde_json::json!({
                "content": content,
            }),
        ).await?;
        
        Ok(())
    }
    
    /// Update client cursor position
    pub async fn update_cursor(
        &self,
        run_id: &str,
        client_id: &str,
        sequence: i64,
    ) -> Result<(), ApiError> {
        let now = chrono::Utc::now();
        
        // Update database
        sqlx::query(
            "UPDATE attachments SET cursor_sequence = ?, last_seen_at = ? WHERE run_id = ? AND client_id = ?"
        )
        .bind(sequence)
        .bind(now)
        .bind(run_id)
        .bind(client_id)
        .execute(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Update session state
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(run_id) {
            if let Some(client) = session.clients.get_mut(client_id) {
                client.cursor_sequence = sequence;
            }
        }
        
        Ok(())
    }
    
    /// Get list of attached clients for a run
    pub async fn get_attachments(&self, run_id: &str) -> Result<Vec<Attachment>, ApiError> {
        let attachments = sqlx::query_as::<_, Attachment>(
            "SELECT * FROM attachments WHERE run_id = ? AND detached_at IS NULL ORDER BY attached_at DESC"
        )
        .bind(run_id)
        .fetch_all(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        Ok(attachments)
    }
    
    /// Close all sessions for a run
    pub async fn close_session(&self, run_id: &str) -> Result<(), ApiError> {
        let now = chrono::Utc::now();
        
        // Update all attachments in database
        sqlx::query(
            "UPDATE attachments SET detached_at = ? WHERE run_id = ? AND detached_at IS NULL"
        )
        .bind(now)
        .bind(run_id)
        .execute(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Remove session
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.remove(run_id) {
            // Notify remaining clients
            let _ = session.event_tx.send(SessionEvent {
                event_type: SessionEventType::SessionClosed,
                payload: serde_json::json!({
                    "run_id": run_id,
                    "reason": "Run completed or cancelled",
                }),
                timestamp: now,
                source_client: None,
            });
        }
        
        tracing::info!("Session closed for run {}", run_id);
        
        Ok(())
    }
    
    // ============================================================================
    // Approval Notification Methods
    // ============================================================================
    
    /// Notify all connected clients that an approval is needed
    ///
    /// This sends a real-time notification to all attached clients (web, desktop, mobile)
    /// when an autonomous agent requires human approval before proceeding.
    pub async fn notify_approval_needed(
        &self,
        run_id: &str,
        approval_id: &str,
        action_type: &str,
        action_params: &serde_json::Value,
        reasoning: Option<&str>,
        priority: ApprovalPriority,
        timeout_seconds: Option<u32>,
    ) -> Result<(), ApiError> {
        let sessions = self.sessions.read().await;
        let now = chrono::Utc::now();
        
        if let Some(session) = sessions.get(run_id) {
            let payload = serde_json::json!({
                "approval_id": approval_id,
                "action_type": action_type,
                "action_params": action_params,
                "reasoning": reasoning,
                "priority": priority,
                "timeout_seconds": timeout_seconds,
                "requested_at": now.to_rfc3339(),
                "attached_clients": session.clients.len(),
            });
            
            // Send to all attached clients
            let _ = session.event_tx.send(SessionEvent {
                event_type: SessionEventType::ApprovalNeeded,
                payload,
                timestamp: now,
                source_client: None,
            });
            
            tracing::info!(
                "Approval notification sent for run {} (approval_id: {}, action: {}, {} clients)",
                run_id,
                approval_id,
                action_type,
                session.clients.len()
            );
        }
        
        Ok(())
    }
    
    /// Notify that an approval request has been resolved (approved/denied)
    pub async fn notify_approval_resolved(
        &self,
        run_id: &str,
        approval_id: &str,
        approved: bool,
        responded_by: &str,
        message: Option<&str>,
    ) -> Result<(), ApiError> {
        let sessions = self.sessions.read().await;
        let now = chrono::Utc::now();
        
        if let Some(session) = sessions.get(run_id) {
            let event_type = if approved {
                SessionEventType::ApprovalGranted
            } else {
                SessionEventType::ApprovalDenied
            };
            
            let payload = serde_json::json!({
                "approval_id": approval_id,
                "approved": approved,
                "responded_by": responded_by,
                "message": message,
                "resolved_at": now.to_rfc3339(),
            });
            
            // Send to all attached clients
            let _ = session.event_tx.send(SessionEvent {
                event_type,
                payload,
                timestamp: now,
                source_client: None,
            });
            
            tracing::info!(
                "Approval resolution notification sent for run {} (approval_id: {}, approved: {})",
                run_id,
                approval_id,
                approved
            );
        }
        
        Ok(())
    }
    
    /// Notify that an approval request has timed out
    pub async fn notify_approval_timeout(
        &self,
        run_id: &str,
        approval_id: &str,
    ) -> Result<(), ApiError> {
        let sessions = self.sessions.read().await;
        let now = chrono::Utc::now();
        
        if let Some(session) = sessions.get(run_id) {
            let payload = serde_json::json!({
                "approval_id": approval_id,
                "timed_out_at": now.to_rfc3339(),
            });
            
            // Send to all attached clients
            let _ = session.event_tx.send(SessionEvent {
                event_type: SessionEventType::ApprovalTimeout,
                payload,
                timestamp: now,
                source_client: None,
            });
            
            tracing::info!(
                "Approval timeout notification sent for run {} (approval_id: {})",
                run_id,
                approval_id
            );
        }
        
        Ok(())
    }
    
    /// Get the number of attached clients for a run
    pub async fn get_attached_client_count(&self, run_id: &str) -> usize {
        let sessions = self.sessions.read().await;
        sessions
            .get(run_id)
            .map(|s| s.clients.len())
            .unwrap_or(0)
    }
}

/// Convert SessionEvent to RuntimeEvent
impl From<SessionEvent> for RuntimeEvent {
    fn from(session_event: SessionEvent) -> Self {
        RuntimeEvent {
            event_type: match session_event.event_type {
                SessionEventType::RuntimeEvent(rt) => rt,
                _ => RuntimeEventType::Heartbeat,
            },
            payload: session_event.payload,
            timestamp: session_event.timestamp,
        }
    }
}
