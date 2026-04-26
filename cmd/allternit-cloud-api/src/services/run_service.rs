//! Run orchestration service
//!
//! Manages the lifecycle of runs including creation, state transitions,
//! and coordination with execution runtimes.

use crate::db::cowork_models::*;
use crate::error::ApiError;
use crate::runtime::{ApprovalHook, ApprovalOptions, ApprovalResult};
use crate::services::{EventStore};
use async_trait::async_trait;
use chrono::Utc;
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::time::Duration;
use uuid::Uuid;

/// Run service trait - defines the interface for run lifecycle management
#[async_trait]
pub trait RunService: Send + Sync + ApprovalHook {
    /// Create a new run
    async fn create(&self, request: CreateRunRequest) -> Result<Run, ApiError>;
    
    /// Get a run by ID
    async fn get(&self, run_id: &str) -> Result<Run, ApiError>;
    
    /// List runs with optional filtering
    async fn list(&self, filter: RunListFilter) -> Result<Vec<RunSummary>, ApiError>;
    
    /// Update run metadata
    async fn update(&self, run_id: &str, request: UpdateRunRequest) -> Result<Run, ApiError>;
    
    /// Delete a run
    async fn delete(&self, run_id: &str) -> Result<(), ApiError>;
    
    /// Transition run to a new status
    async fn transition(&self, run_id: &str, new_status: RunStatus) -> Result<Run, ApiError>;
    
    /// Start a run (transition from Pending/Planning to Queued/Running)
    async fn start(&self, run_id: &str) -> Result<Run, ApiError>;
    
    /// Pause a run
    async fn pause(&self, run_id: &str) -> Result<Run, ApiError>;
    
    /// Resume a paused run
    async fn resume(&self, run_id: &str) -> Result<Run, ApiError>;
    
    /// Cancel a run
    async fn cancel(&self, run_id: &str, reason: Option<&str>) -> Result<Run, ApiError>;
    
    /// Complete a run successfully
    async fn complete(&self, run_id: &str) -> Result<Run, ApiError>;
    
    /// Mark a run as failed
    async fn fail(&self, run_id: &str, error: &str, details: Option<serde_json::Value>) -> Result<Run, ApiError>;
    
    /// Update step progress
    async fn update_progress(&self, run_id: &str, cursor: &str, completed: i32, total: Option<i32>) -> Result<Run, ApiError>;
    
    /// Associate a runtime with a run
    async fn assign_runtime(&self, run_id: &str, runtime_id: &str, runtime_type: &str) -> Result<Run, ApiError>;
    
    // ============================================================================
    // Approval Integration Methods
    // ============================================================================
    
    /// Request approval for a run action
    ///
    /// Creates an approval request record, emits an event, and optionally
    /// pauses the run until approval is received.
    async fn request_approval(
        &self,
        run_id: &str,
        action_type: &str,
        action_params: serde_json::Value,
        reasoning: Option<String>,
    ) -> Result<ApprovalResult, ApiError>;
    
    /// Get an approval request by ID
    async fn get_approval(&self, approval_id: &str) -> Result<ApprovalRequest, ApiError>;
    
    /// List approval requests for a run
    async fn list_approvals(&self, run_id: &str, status: Option<ApprovalStatus>) -> Result<Vec<ApprovalRequestSummary>, ApiError>;
    
    /// Respond to an approval request (approve or deny)
    async fn respond_to_approval(
        &self,
        approval_id: &str,
        approved: bool,
        message: Option<String>,
        responded_by: &str,
    ) -> Result<ApprovalRequest, ApiError>;
    
    // ============================================================================
    // Checkpoint Methods
    // ============================================================================
    
    /// Create a checkpoint for a run
    async fn create_checkpoint(
        &self,
        run_id: &str,
        request: CreateCheckpointRequest,
    ) -> Result<Checkpoint, ApiError>;
    
    /// List checkpoints for a run
    async fn list_checkpoints(&self, run_id: &str) -> Result<Vec<CheckpointSummary>, ApiError>;
    
    /// Get checkpoint by ID
    async fn get_checkpoint(&self, checkpoint_id: &str) -> Result<Checkpoint, ApiError>;
    
    /// Restore a run from a checkpoint
    async fn restore_checkpoint(
        &self,
        run_id: &str,
        checkpoint_id: &str,
    ) -> Result<Run, ApiError>;
    
    /// Delete a checkpoint
    async fn delete_checkpoint(&self, checkpoint_id: &str) -> Result<(), ApiError>;
}

/// Filter options for listing runs
#[derive(Debug, Clone, Default)]
pub struct RunListFilter {
    pub status: Option<Vec<RunStatus>>,
    pub mode: Option<Vec<RunMode>>,
    pub owner_id: Option<String>,
    pub tenant_id: Option<String>,
    pub schedule_id: Option<String>,
    pub runtime_id: Option<String>,
    pub since: Option<chrono::DateTime<Utc>>,
    pub until: Option<chrono::DateTime<Utc>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Implementation of RunService using SQLite/Postgres
pub struct RunServiceImpl {
    db: SqlitePool,
    event_store: Option<Arc<dyn EventStore>>,
}

impl RunServiceImpl {
    /// Create a new RunServiceImpl
    pub fn new(db: SqlitePool) -> Self {
        Self { 
            db,
            event_store: None,
        }
    }
    
    /// Create from an existing pool reference
    pub fn from_arc(db: Arc<SqlitePool>) -> Self {
        // This is a bit of a workaround - ideally we'd use Arc<SqlitePool> everywhere
        // For now, we clone the pool (which is cheap for sqlx)
        Self { 
            db: (*db).clone(),
            event_store: None,
        }
    }
    
    /// Create with an event store for event emission
    pub fn with_event_store(mut self, event_store: Arc<dyn EventStore>) -> Self {
        self.event_store = Some(event_store);
        self
    }
    
    /// Initialize cost tracking for a run
    async fn init_cost_tracking(&self, run_id: &str) -> Result<(), ApiError> {
        use crate::services::{CostService, CostServiceImpl};
        
        let cost_service = CostServiceImpl::new(self.db.clone());
        
        // Try to get instance info from associated cloud instance
        let instance_info: Option<(String, String, String)> = sqlx::query_as(
            r#"
            SELECT ci.provider, ci.region, ci.instance_type
            FROM cloud_instances ci
            JOIN runs r ON ci.run_id = r.id
            WHERE r.id = ?
            "#
        )
        .bind(run_id)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        // Default to local if no cloud instance found
        let (provider, region, instance_type) = instance_info
            .unwrap_or_else(|| ("local".to_string(), "default".to_string(), "standard".to_string()));
        
        if let Err(e) = cost_service.init_run_cost(run_id, &provider, &region, &instance_type).await {
            tracing::warn!("Failed to initialize cost tracking for run {}: {}", run_id, e);
            // Don't fail the run if cost tracking fails
        } else {
            tracing::info!("Initialized cost tracking for run {} with {}/{} in {}", 
                run_id, provider, instance_type, region);
        }
        
        Ok(())
    }
    
    /// Finalize cost tracking for a run
    async fn finalize_cost_tracking(&self, run_id: &str) -> Result<(), ApiError> {
        use crate::services::{CostService, CostServiceImpl};
        
        let cost_service = CostServiceImpl::new(self.db.clone());
        
        // Get storage and transfer usage from run config (if available)
        let run = self.get(run_id).await?;
        let config = run.config.0;
        
        // Extract resource usage from config
        let storage_gb = config
            .resource_limits
            .as_ref()
            .and_then(|r| r.disk_gb)
            .map(|d| d as f64);
        
        let transfer_gb = config
            .extra
            .get("transfer_gb")
            .and_then(|t| t.as_f64());
        
        if let Err(e) = cost_service.finalize_run_cost(run_id, storage_gb, transfer_gb).await {
            tracing::warn!("Failed to finalize cost tracking for run {}: {}", run_id, e);
            // Don't fail the run if cost tracking fails
        } else {
            tracing::info!("Finalized cost tracking for run {}", run_id);
            
            // Check budget alerts for the run owner
            if let Some(owner_id) = &run.owner_id {
                if let Err(e) = cost_service.check_budget_alerts(owner_id).await {
                    tracing::warn!("Failed to check budget alerts for user {}: {}", owner_id, e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Emit a run event if event store is configured
    async fn emit_event(
        &self,
        run_id: &str,
        event_type: EventType,
        payload: serde_json::Value,
    ) -> Result<(), ApiError> {
        if let Some(ref store) = self.event_store {
            store.append(run_id, event_type, payload).await?;
        }
        Ok(())
    }
    
    /// Wait for an approval response with timeout
    async fn wait_for_approval_response(
        &self,
        approval_id: &str,
        timeout_seconds: Option<u32>,
    ) -> Result<ApprovalResult, ApiError> {
        let poll_interval = Duration::from_millis(500);
        let max_wait = timeout_seconds.map(|s| Duration::from_secs(s as u64));
        
        let start = std::time::Instant::now();
        
        loop {
            // Check if we've exceeded timeout
            if let Some(max) = max_wait {
                if start.elapsed() >= max {
                    // Update approval status to timed out
                    sqlx::query(
                        "UPDATE approval_requests SET status = ? WHERE id = ? AND status = ?"
                    )
                    .bind(ApprovalStatus::TimedOut)
                    .bind(approval_id)
                    .bind(ApprovalStatus::Pending)
                    .execute(&self.db)
                    .await
                    .map_err(ApiError::DatabaseError)?;
                    
                    // Emit timeout event
                    if let Some(ref store) = self.event_store {
                        let _ = store.append(
                            "", // Will be updated below
                            EventType::ApprovalTimeout,
                            serde_json::json!({
                                "approval_id": approval_id,
                                "timed_out_at": Utc::now().to_rfc3339(),
                            })
                        ).await;
                    }
                    
                    return Ok(ApprovalResult::TimedOut);
                }
            }
            
            // Check approval status
            let status: Option<(ApprovalStatus, Option<String>, Option<sqlx::types::Json<serde_json::Value>>)> = sqlx::query_as(
                "SELECT status, response_message, action_params FROM approval_requests WHERE id = ?"
            )
            .bind(approval_id)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
            
            if let Some((status, message, action_params)) = status {
                match status {
                    ApprovalStatus::Approved => {
                        return Ok(ApprovalResult::Approved {
                            modified_params: action_params.map(|j| j.0),
                        });
                    }
                    ApprovalStatus::Denied => {
                        return Ok(ApprovalResult::Denied { reason: message });
                    }
                    ApprovalStatus::Cancelled => {
                        return Ok(ApprovalResult::Cancelled);
                    }
                    ApprovalStatus::TimedOut => {
                        return Ok(ApprovalResult::TimedOut);
                    }
                    ApprovalStatus::Pending => {
                        // Continue waiting
                    }
                }
            } else {
                return Err(ApiError::NotFound(format!("Approval request not found: {}", approval_id)));
            }
            
            // Wait before polling again
            tokio::time::sleep(poll_interval).await;
        }
    }
}

#[async_trait]
impl RunService for RunServiceImpl {
    async fn create(&self, request: CreateRunRequest) -> Result<Run, ApiError> {
        let run_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        let _config_json = serde_json::to_value(&request.config)
            .map_err(|e| ApiError::Internal(format!("Failed to serialize config: {}", e)))?;
        
        let run = sqlx::query_as::<_, Run>(
            r#"
            INSERT INTO runs (
                id, name, description, mode, status, step_cursor, total_steps, completed_steps,
                config, owner_id, tenant_id, runtime_id, runtime_type, schedule_id, region_id,
                created_at, updated_at, started_at, completed_at, error_message, error_details
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            "#
        )
        .bind(&run_id)
        .bind(&request.name)
        .bind(&request.description)
        .bind(request.mode)
        .bind(RunStatus::Pending)
        .bind(None::<String>)
        .bind(None::<i32>)
        .bind(0i32)
        .bind(sqlx::types::Json(request.config))
        .bind(None::<String>) // owner_id
        .bind(None::<String>) // tenant_id
        .bind(None::<String>) // runtime_id
        .bind(None::<String>) // runtime_type
        .bind(None::<String>) // schedule_id
        .bind(request.region_id) // region_id from request
        .bind(now)
        .bind(now)
        .bind(None::<chrono::DateTime<Utc>>) // started_at
        .bind(None::<chrono::DateTime<Utc>>) // completed_at
        .bind(None::<String>) // error_message
        .bind(None::<sqlx::types::Json<serde_json::Value>>) // error_details
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Emit run created event
        self.emit_event(
            &run_id,
            EventType::RunCreated,
            crate::services::event_store::event_utils::run_created(&request.name, request.mode)
        ).await?;
        
        Ok(run)
    }
    
    async fn get(&self, run_id: &str) -> Result<Run, ApiError> {
        let run = sqlx::query_as::<_, Run>(
            "SELECT * FROM runs WHERE id = ?"
        )
        .bind(run_id)
        .fetch_optional(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        run.ok_or_else(|| ApiError::NotFound(format!("Run not found: {}", run_id)))
    }
    
    async fn list(&self, filter: RunListFilter) -> Result<Vec<RunSummary>, ApiError> {
        let mut query = String::from(
            "SELECT id, name, mode, status, completed_steps, total_steps, created_at, updated_at FROM runs"
        );
        let mut conditions = Vec::new();

        if let Some(statuses) = &filter.status {
            if !statuses.is_empty() {
                let placeholders: Vec<String> = (0..statuses.len()).map(|_| "?".to_string()).collect();
                conditions.push(format!("status IN ({})", placeholders.join(", ")));
            }
        }

        if let Some(modes) = &filter.mode {
            if !modes.is_empty() {
                let placeholders: Vec<String> = (0..modes.len()).map(|_| "?".to_string()).collect();
                conditions.push(format!("mode IN ({})", placeholders.join(", ")));
            }
        }

        if filter.owner_id.is_some() {
            conditions.push("owner_id = ?".to_string());
        }

        if filter.tenant_id.is_some() {
            conditions.push("tenant_id = ?".to_string());
        }

        if filter.schedule_id.is_some() {
            conditions.push("schedule_id = ?".to_string());
        }

        if filter.runtime_id.is_some() {
            conditions.push("runtime_id = ?".to_string());
        }

        if filter.since.is_some() {
            conditions.push("created_at >= ?".to_string());
        }

        if filter.until.is_some() {
            conditions.push("created_at <= ?".to_string());
        }

        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }

        query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

        let mut sql_query = sqlx::query_as::<_, RunSummary>(&query);

        // Bind arguments in the same order as they appear in the query
        if let Some(statuses) = filter.status {
            for status in statuses {
                sql_query = sql_query.bind(status);
            }
        }

        if let Some(modes) = filter.mode {
            for mode in modes {
                sql_query = sql_query.bind(mode);
            }
        }

        if let Some(owner_id) = filter.owner_id {
            sql_query = sql_query.bind(owner_id);
        }

        if let Some(tenant_id) = filter.tenant_id {
            sql_query = sql_query.bind(tenant_id);
        }

        if let Some(schedule_id) = filter.schedule_id {
            sql_query = sql_query.bind(schedule_id);
        }

        if let Some(runtime_id) = filter.runtime_id {
            sql_query = sql_query.bind(runtime_id);
        }

        if let Some(since) = filter.since {
            sql_query = sql_query.bind(since);
        }

        if let Some(until) = filter.until {
            sql_query = sql_query.bind(until);
        }

        sql_query = sql_query.bind(filter.limit.unwrap_or(100));
        sql_query = sql_query.bind(filter.offset.unwrap_or(0));

        let runs = sql_query
            .fetch_all(&self.db)
            .await
            .map_err(|e| ApiError::DatabaseError(e))?;

        Ok(runs)
    }    
    async fn update(&self, run_id: &str, request: UpdateRunRequest) -> Result<Run, ApiError> {
        let run = self.get(run_id).await?;
        
        let name = request.name.unwrap_or_else(|| run.name.clone());
        let description = request.description.or(run.description.clone());
        
        let updated = sqlx::query_as::<_, Run>(
            r#"
            UPDATE runs 
            SET name = ?, description = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
            "#
        )
        .bind(&name)
        .bind(&description)
        .bind(Utc::now())
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        Ok(updated)
    }
    
    async fn delete(&self, run_id: &str) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM runs WHERE id = ?")
            .bind(run_id)
            .execute(&self.db)
            .await
            .map_err(|e| ApiError::DatabaseError(e))?;
        
        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!("Run not found: {}", run_id)));
        }
        
        Ok(())
    }
    
    async fn transition(&self, run_id: &str, new_status: RunStatus) -> Result<Run, ApiError> {
        let run = self.get(run_id).await?;
        
        // Validate state transition
        if !run.status.can_transition_to(new_status) {
            return Err(ApiError::BadRequest(format!(
                "Cannot transition run from {:?} to {:?}",
                run.status, new_status
            )));
        }
        
        let now = Utc::now();
        
        // Handle special transitions
        let started_at = if matches!(new_status, RunStatus::Running) && run.started_at.is_none() {
            Some(now)
        } else {
            run.started_at
        };
        
        let completed_at = if new_status.is_terminal() {
            Some(now)
        } else {
            None
        };
        
        let updated = sqlx::query_as::<_, Run>(
            r#"
            UPDATE runs 
            SET status = ?, updated_at = ?, started_at = ?, completed_at = ?
            WHERE id = ?
            RETURNING *
            "#
        )
        .bind(new_status)
        .bind(now)
        .bind(started_at)
        .bind(completed_at)
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Emit status change event
        let event_payload = match new_status {
            RunStatus::Running => crate::services::event_store::event_utils::run_started(run.runtime_id.as_deref()),
            RunStatus::Completed => {
                let duration = started_at.map(|s| Utc::now().signed_duration_since(s).num_milliseconds()).unwrap_or(0);
                crate::services::event_store::event_utils::run_completed(duration)
            },
            RunStatus::Failed => crate::services::event_store::event_utils::run_failed(
                run.error_message.as_deref().unwrap_or("Unknown error"),
                run.error_details.as_ref().map(|d| d.0.clone())
            ),
            RunStatus::Cancelled => serde_json::json!({
                "reason": run.error_message.as_deref().unwrap_or("Cancelled"),
                "cancelled_at": Utc::now().to_rfc3339(),
            }),
            RunStatus::Paused => serde_json::json!({
                "paused_at": Utc::now().to_rfc3339(),
            }),
            _ => serde_json::json!({
                "previous_status": run.status,
                "new_status": new_status,
                "transitioned_at": now.to_rfc3339(),
            }),
        };
        
        let event_type = match new_status {
            RunStatus::Running => EventType::RunStarted,
            RunStatus::Completed => EventType::RunCompleted,
            RunStatus::Failed => EventType::RunFailed,
            RunStatus::Cancelled => EventType::RunCancelled,
            RunStatus::Paused => EventType::RunPaused,
            _ => EventType::Heartbeat, 
        };
        
        self.emit_event(run_id, event_type, event_payload).await?;
        
        // Initialize cost tracking when run starts
        if new_status == RunStatus::Running && run.started_at.is_none() {
            if let Err(e) = self.init_cost_tracking(run_id).await {
                tracing::warn!("Failed to initialize cost tracking for run {}: {}", run_id, e);
            }
        }
        
        // Finalize cost tracking when run ends
        if new_status.is_terminal() {
            if let Err(e) = self.finalize_cost_tracking(run_id).await {
                tracing::warn!("Failed to finalize cost tracking for run {}: {}", run_id, e);
            }
        }
        
        Ok(updated)
    }
    
    async fn start(&self, run_id: &str) -> Result<Run, ApiError> {
        let run = self.get(run_id).await?;
        
        // Determine target state based on current state
        let target = match run.status {
            RunStatus::Pending | RunStatus::Planning => RunStatus::Queued,
            RunStatus::Paused => RunStatus::Running,
            _ => return Err(ApiError::BadRequest(format!(
                "Cannot start run in {:?} state", run.status
            ))),
        };
        
        self.transition(run_id, target).await
    }
    
    async fn pause(&self, run_id: &str) -> Result<Run, ApiError> {
        self.transition(run_id, RunStatus::Paused).await
    }
    
    async fn resume(&self, run_id: &str) -> Result<Run, ApiError> {
        let run = self.get(run_id).await?;
        
        if run.status != RunStatus::Paused {
            return Err(ApiError::BadRequest(format!(
                "Cannot resume run in {:?} state", run.status
            )));
        }
        
        self.transition(run_id, RunStatus::Running).await
    }
    
    async fn cancel(&self, run_id: &str, reason: Option<&str>) -> Result<Run, ApiError> {
        let run = self.get(run_id).await?;
        
        if run.status.is_terminal() {
            return Err(ApiError::BadRequest(format!(
                "Cannot cancel run in {:?} state", run.status
            )));
        }
        
        // Cancel any pending approvals for this run
        sqlx::query(
            r#"
            UPDATE approval_requests 
            SET status = ?, responded_at = ?
            WHERE run_id = ? AND status = ?
            "#
        )
        .bind(ApprovalStatus::Cancelled)
        .bind(Utc::now())
        .bind(run_id)
        .bind(ApprovalStatus::Pending)
        .execute(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        let now = Utc::now();
        let error_msg = reason.unwrap_or("Cancelled by user");
        
        let updated = sqlx::query_as::<_, Run>(
            r#"
            UPDATE runs 
            SET status = ?, updated_at = ?, completed_at = ?, error_message = ?
            WHERE id = ?
            RETURNING *
            "#
        )
        .bind(RunStatus::Cancelled)
        .bind(now)
        .bind(now)
        .bind(error_msg)
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Finalize cost tracking
        if let Err(e) = self.finalize_cost_tracking(run_id).await {
            tracing::warn!("Failed to finalize cost tracking for run {}: {}", run_id, e);
        }
        
        Ok(updated)
    }
    
    async fn complete(&self, run_id: &str) -> Result<Run, ApiError> {
        self.transition(run_id, RunStatus::Completed).await
    }
    
    async fn fail(&self, run_id: &str, error: &str, details: Option<serde_json::Value>) -> Result<Run, ApiError> {
        let run = self.get(run_id).await?;
        
        if run.status.is_terminal() {
            return Err(ApiError::BadRequest(format!(
                "Cannot fail run in {:?} state", run.status
            )));
        }
        
        let now = Utc::now();
        let error_details = details.as_ref().map(|d| sqlx::types::Json(d.clone()));
        
        let updated = sqlx::query_as::<_, Run>(
            r#"
            UPDATE runs 
            SET status = ?, updated_at = ?, completed_at = ?, error_message = ?, error_details = ?
            WHERE id = ?
            RETURNING *
            "#
        )
        .bind(RunStatus::Failed)
        .bind(now)
        .bind(now)
        .bind(error)
        .bind(error_details)
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        // Finalize cost tracking
        if let Err(e) = self.finalize_cost_tracking(run_id).await {
            tracing::warn!("Failed to finalize cost tracking for run {}: {}", run_id, e);
        }
        
        Ok(updated)
    }
    
    async fn update_progress(&self, run_id: &str, cursor: &str, completed: i32, total: Option<i32>) -> Result<Run, ApiError> {
        let updated = sqlx::query_as::<_, Run>(
            r#"
            UPDATE runs 
            SET step_cursor = ?, completed_steps = ?, total_steps = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
            "#
        )
        .bind(cursor)
        .bind(completed)
        .bind(total)
        .bind(Utc::now())
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        Ok(updated)
    }
    
    async fn assign_runtime(&self, run_id: &str, runtime_id: &str, runtime_type: &str) -> Result<Run, ApiError> {
        let updated = sqlx::query_as::<_, Run>(
            r#"
            UPDATE runs 
            SET runtime_id = ?, runtime_type = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
            "#
        )
        .bind(runtime_id)
        .bind(runtime_type)
        .bind(Utc::now())
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;
        
        Ok(updated)
    }
    
    // ============================================================================
    // Approval Integration Implementation
    // ============================================================================
    
    async fn request_approval(
        &self,
        run_id: &str,
        action_type: &str,
        action_params: serde_json::Value,
        reasoning: Option<String>,
    ) -> Result<ApprovalResult, ApiError> {
        // Use default options
        let options = ApprovalOptions::default();
        self.request_approval_with_options(run_id, action_type, action_params, reasoning, options).await
    }
    
    async fn get_approval(&self, approval_id: &str) -> Result<ApprovalRequest, ApiError> {
        let approval = sqlx::query_as::<_, ApprovalRequest>(
            r#"
            SELECT 
                id, run_id, step_cursor, status, priority,
                title, description, action_type, action_params,
                reasoning, requested_by, responded_by, response_message,
                timeout_seconds, created_at, responded_at
            FROM approval_requests
            WHERE id = ?
            "#
        )
        .bind(approval_id)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?
        .ok_or_else(|| ApiError::NotFound(format!("Approval request '{}' not found", approval_id)))?;
        
        Ok(approval)
    }
    
    async fn list_approvals(&self, run_id: &str, status: Option<ApprovalStatus>) -> Result<Vec<ApprovalRequestSummary>, ApiError> {
        let approvals = if let Some(status_filter) = status {
            sqlx::query_as::<_, ApprovalRequestSummary>(
                r#"
                SELECT id, run_id, status, priority, title, action_type, created_at, responded_at
                FROM approval_requests
                WHERE run_id = ? AND status = ?
                ORDER BY 
                    CASE priority
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'normal' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    created_at DESC
                "#
            )
            .bind(run_id)
            .bind(status_filter)
            .fetch_all(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?
        } else {
            sqlx::query_as::<_, ApprovalRequestSummary>(
                r#"
                SELECT id, run_id, status, priority, title, action_type, created_at, responded_at
                FROM approval_requests
                WHERE run_id = ?
                ORDER BY 
                    CASE priority
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'normal' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    created_at DESC
                "#
            )
            .bind(run_id)
            .fetch_all(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?
        };
        
        Ok(approvals)
    }
    
    async fn respond_to_approval(
        &self,
        approval_id: &str,
        approved: bool,
        message: Option<String>,
        responded_by: &str,
    ) -> Result<ApprovalRequest, ApiError> {
        let now = Utc::now();
        let new_status = if approved { ApprovalStatus::Approved } else { ApprovalStatus::Denied };
        
        // Update the approval
        sqlx::query(
            r#"
            UPDATE approval_requests
            SET status = ?, responded_by = ?, response_message = ?, responded_at = ?
            WHERE id = ? AND status = ?
            "#
        )
        .bind(new_status)
        .bind(responded_by)
        .bind(&message)
        .bind(now)
        .bind(approval_id)
        .bind(ApprovalStatus::Pending)
        .execute(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        // Fetch the updated approval
        let approval = self.get_approval(approval_id).await?;
        
        // Emit appropriate event
        let event_type = if approved {
            EventType::ApprovalGiven
        } else {
            EventType::ApprovalDenied
        };
        
        self.emit_event(
            &approval.run_id,
            event_type,
            serde_json::json!({
                "approval_id": approval_id,
                "action_type": approval.action_type,
                "responded_by": responded_by,
                "message": message,
                "responded_at": now.to_rfc3339(),
            })
        ).await?;
        
        Ok(approval)
    }
    
    // ============================================================================
    // Checkpoint Methods
    // ============================================================================
    
    async fn create_checkpoint(
        &self,
        run_id: &str,
        request: CreateCheckpointRequest,
    ) -> Result<Checkpoint, ApiError> {
        // Verify run exists
        let run: Option<Run> = sqlx::query_as("SELECT * FROM runs WHERE id = ?")
            .bind(run_id)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
        
        if run.is_none() {
            return Err(ApiError::NotFound(format!("Run not found: {}", run_id)));
        }
        
        let checkpoint_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        sqlx::query(
            r#"
            INSERT INTO checkpoints (
                id, run_id, name, description, step_cursor,
                workspace_state, approval_state, context, resumable, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&checkpoint_id)
        .bind(run_id)
        .bind(&request.name)
        .bind(&request.description)
        .bind(&request.step_cursor)
        .bind(request.workspace_state.map(sqlx::types::Json))
        .bind(request.approval_state.map(sqlx::types::Json))
        .bind(request.context.map(sqlx::types::Json))
        .bind(true)
        .bind(now)
        .execute(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        // Fetch and return the created checkpoint
        let checkpoint: Checkpoint = sqlx::query_as("SELECT * FROM checkpoints WHERE id = ?")
            .bind(&checkpoint_id)
            .fetch_one(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
        
        // Emit checkpoint created event
        let _ = self.emit_event(
            run_id,
            EventType::CheckpointCreated,
            serde_json::json!({
                "checkpoint_id": checkpoint_id,
                "name": request.name,
                "step_cursor": request.step_cursor,
                "created_at": now,
            })
        ).await;
        
        Ok(checkpoint)
    }
    
    async fn list_checkpoints(&self, run_id: &str) -> Result<Vec<CheckpointSummary>, ApiError> {
        let checkpoints = sqlx::query_as::<_, CheckpointSummary>(
            r#"
            SELECT id, name, step_cursor, resumable, created_at
            FROM checkpoints
            WHERE run_id = ?
            ORDER BY created_at DESC
            "#
        )
        .bind(run_id)
        .fetch_all(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        Ok(checkpoints)
    }
    
    async fn get_checkpoint(&self, checkpoint_id: &str) -> Result<Checkpoint, ApiError> {
        let checkpoint: Option<Checkpoint> = sqlx::query_as("SELECT * FROM checkpoints WHERE id = ?")
            .bind(checkpoint_id)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
        
        checkpoint.ok_or_else(|| ApiError::NotFound(format!("Checkpoint not found: {}", checkpoint_id)))
    }
    
    async fn restore_checkpoint(
        &self,
        run_id: &str,
        checkpoint_id: &str,
    ) -> Result<Run, ApiError> {
        // Get checkpoint
        let checkpoint: Checkpoint = sqlx::query_as("SELECT * FROM checkpoints WHERE id = ?")
            .bind(checkpoint_id)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?
            .ok_or_else(|| ApiError::NotFound(format!("Checkpoint not found: {}", checkpoint_id)))?;
        
        // Verify checkpoint belongs to this run
        if checkpoint.run_id != run_id {
            return Err(ApiError::BadRequest("Checkpoint does not belong to this run".to_string()));
        }
        
        if !checkpoint.resumable {
            return Err(ApiError::BadRequest("Checkpoint is not resumable".to_string()));
        }
        
        // Update run to restore state
        let now = Utc::now();
        let run: Run = sqlx::query_as(
            r#"
            UPDATE runs
            SET status = ?, step_cursor = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
            "#
        )
        .bind(RunStatus::Pending)
        .bind(&checkpoint.step_cursor)
        .bind(now)
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        // Update checkpoint restored_at
        sqlx::query("UPDATE checkpoints SET restored_at = ? WHERE id = ?")
            .bind(now)
            .bind(checkpoint_id)
            .execute(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
        
        // Emit checkpoint restored event
        let _ = self.emit_event(
            run_id,
            EventType::CheckpointRestored,
            serde_json::json!({
                "checkpoint_id": checkpoint_id,
                "step_cursor": checkpoint.step_cursor,
                "restored_at": now,
            })
        ).await;
        
        Ok(run)
    }
    
    async fn delete_checkpoint(&self, checkpoint_id: &str) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM checkpoints WHERE id = ?")
            .bind(checkpoint_id)
            .execute(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
        
        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!("Checkpoint not found: {}", checkpoint_id)));
        }
        
        Ok(())
    }
}

/// Implementation of ApprovalHook trait for RunServiceImpl
#[async_trait]
impl ApprovalHook for RunServiceImpl {
    async fn request_approval(
        &self,
        run_id: &str,
        action_type: &str,
        action_params: serde_json::Value,
        reasoning: Option<String>,
    ) -> Result<ApprovalResult, ApiError> {
        let options = ApprovalOptions::default();
        self.request_approval_with_options(run_id, action_type, action_params, reasoning, options).await
    }
    
    async fn request_approval_with_options(
        &self,
        run_id: &str,
        action_type: &str,
        action_params: serde_json::Value,
        reasoning: Option<String>,
        options: ApprovalOptions,
    ) -> Result<ApprovalResult, ApiError> {
        // Verify the run exists
        let run = self.get(run_id).await?;
        
        // Generate approval ID
        let approval_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        // Build title and description
        let title = options.title.unwrap_or_else(|| {
            format!("Approval required: {}", action_type)
        });
        let description = options.description.or_else(|| {
            reasoning.clone()
        });
        
        // Insert approval request
        sqlx::query(
            r#"
            INSERT INTO approval_requests (
                id, run_id, step_cursor, status, priority,
                title, description, action_type, action_params,
                reasoning, requested_by, timeout_seconds, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&approval_id)
        .bind(run_id)
        .bind(&options.step_cursor)
        .bind(ApprovalStatus::Pending)
        .bind(options.priority)
        .bind(&title)
        .bind(&description)
        .bind(action_type)
        .bind(sqlx::types::Json(action_params.clone()))
        .bind(&reasoning)
        .bind(options.requested_by.as_ref())
        .bind(options.timeout_seconds.map(|s| s as i32))
        .bind(now)
        .execute(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        // Emit ApprovalNeeded event
        self.emit_event(
            run_id,
            EventType::ApprovalNeeded,
            serde_json::json!({
                "approval_id": &approval_id,
                "action_type": action_type,
                "action_params": action_params,
                "reasoning": reasoning,
                "priority": options.priority,
                "timeout_seconds": options.timeout_seconds,
                "requested_at": now.to_rfc3339(),
            })
        ).await?;
        
        // Optionally pause the run while waiting for approval
        if run.status == RunStatus::Running {
            let _ = self.pause(run_id).await;
        }
        
        // Wait for response
        let result = self.wait_for_approval_response(&approval_id, options.timeout_seconds).await?;
        
        // Resume the run if it was paused for approval
        let run = self.get(run_id).await?;
        if run.status == RunStatus::Paused {
            let _ = self.resume(run_id).await;
        }
        
        Ok(result)
    }
    
    async fn check_approval_status(
        &self,
        approval_id: &str,
    ) -> Result<Option<ApprovalResult>, ApiError> {
        let status: Option<(ApprovalStatus, Option<String>, Option<sqlx::types::Json<serde_json::Value>>)> = sqlx::query_as(
            "SELECT status, response_message, action_params FROM approval_requests WHERE id = ?"
        )
        .bind(approval_id)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        match status {
            Some((ApprovalStatus::Approved, _, action_params)) => {
                Ok(Some(ApprovalResult::Approved {
                    modified_params: action_params.map(|j| j.0),
                }))
            }
            Some((ApprovalStatus::Denied, message, _)) => {
                Ok(Some(ApprovalResult::Denied { reason: message }))
            }
            Some((ApprovalStatus::Cancelled, _, _)) => {
                Ok(Some(ApprovalResult::Cancelled))
            }
            Some((ApprovalStatus::TimedOut, _, _)) => {
                Ok(Some(ApprovalResult::TimedOut))
            }
            Some((ApprovalStatus::Pending, _, _)) => {
                Ok(None) // Still pending
            }
            None => Err(ApiError::NotFound(format!("Approval request not found: {}", approval_id))),
        }
    }
    
    async fn cancel_approval(
        &self,
        approval_id: &str,
    ) -> Result<(), ApiError> {
        let result = sqlx::query(
            r#"
            UPDATE approval_requests
            SET status = ?, responded_at = ?
            WHERE id = ? AND status = ?
            "#
        )
        .bind(ApprovalStatus::Cancelled)
        .bind(Utc::now())
        .bind(approval_id)
        .bind(ApprovalStatus::Pending)
        .execute(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;
        
        if result.rows_affected() == 0 {
            // Check if it exists but was already resolved
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM approval_requests WHERE id = ?)"
            )
            .bind(approval_id)
            .fetch_one(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
            
            if !exists {
                return Err(ApiError::NotFound(format!("Approval request not found: {}", approval_id)));
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_run_status_transitions() {
        // Valid transitions
        assert!(RunStatus::Pending.can_transition_to(RunStatus::Planning));
        assert!(RunStatus::Pending.can_transition_to(RunStatus::Queued));
        assert!(RunStatus::Running.can_transition_to(RunStatus::Completed));
        assert!(RunStatus::Running.can_transition_to(RunStatus::Failed));
        assert!(RunStatus::Running.can_transition_to(RunStatus::Paused));
        assert!(RunStatus::Paused.can_transition_to(RunStatus::Running));
        
        // Invalid transitions
        assert!(!RunStatus::Completed.can_transition_to(RunStatus::Running));
        assert!(!RunStatus::Failed.can_transition_to(RunStatus::Running));
        assert!(!RunStatus::Running.can_transition_to(RunStatus::Pending));
    }
    
    #[test]
    fn test_run_status_terminal() {
        assert!(RunStatus::Completed.is_terminal());
        assert!(RunStatus::Failed.is_terminal());
        assert!(RunStatus::Cancelled.is_terminal());
        
        assert!(!RunStatus::Pending.is_terminal());
        assert!(!RunStatus::Running.is_terminal());
        assert!(!RunStatus::Paused.is_terminal());
    }
}
