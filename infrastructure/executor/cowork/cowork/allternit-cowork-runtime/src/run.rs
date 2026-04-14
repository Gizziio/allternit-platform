//! Run lifecycle management
//!
//! The RunManager coordinates the execution of cowork runs,
//! handling state transitions, job scheduling, and Rails integration.

use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, Duration};
use tracing::{debug, info};

use crate::attachment::AttachmentRegistry;
use crate::checkpoint::CheckpointManager;
use crate::error::{CoworkError, Result};
use crate::types::{Attachment, ClientType, CreateJobSpec, CreateRunSpec, Job, JobId, JobState, PermissionSet, Run, RunId, RunState, CoworkEvent};

/// Handles run lifecycle and coordination
pub struct RunManager {
    /// Active runs indexed by ID
    runs: Arc<RwLock<HashMap<RunId, Arc<RwLock<Run>>>>>,
    /// Jobs within runs
    jobs: Arc<RwLock<HashMap<JobId, Arc<RwLock<Job>>>>>,
    /// Attachment registry
    attachments: Arc<AttachmentRegistry>,
    /// Checkpoint manager
    checkpoints: Arc<CheckpointManager>,
    /// Event broadcast channel
    event_tx: mpsc::Sender<CoworkEvent>,
    /// Rails client for backend communication
    rails_client: Arc<dyn RailsClient>,
    /// Graceful shutdown signal
    shutdown: mpsc::Receiver<()>,
}

/// Trait for Rails client interaction
#[async_trait::async_trait]
pub trait RailsClient: Send + Sync {
    /// Create a DAG in Rails
    async fn create_dag(&self, run_id: RunId, spec: &CreateRunSpec) -> anyhow::Result<String>;
    /// Create a node in the DAG
    async fn create_node(&self, dag_id: &str, job_id: JobId, spec: &CreateJobSpec) -> anyhow::Result<String>;
    /// Update run state
    async fn update_run_state(&self, dag_id: &str, state: RunState) -> anyhow::Result<()>;
    /// Update job state
    async fn update_job_state(&self, node_id: &str, state: JobState) -> anyhow::Result<()>;
    /// Request a lease
    async fn request_lease(&self, resource_id: &str, owner_id: &str) -> anyhow::Result<bool>;
    /// Release a lease
    async fn release_lease(&self, resource_id: &str, owner_id: &str) -> anyhow::Result<()>;
    /// Append event to ledger
    async fn append_event(&self, event: &CoworkEvent) -> anyhow::Result<()>;
}

/// Configuration for the RunManager
#[derive(Debug, Clone)]
pub struct RunManagerConfig {
    pub data_dir: std::path::PathBuf,
    pub rails_base_url: String,
    pub attachment_timeout_secs: u64,
    pub lease_duration_secs: u64,
    pub max_checkpoint_age_hours: u64,
}

impl Default for RunManagerConfig {
    fn default() -> Self {
        Self {
            data_dir: std::path::PathBuf::from("/var/lib/a2r/cowork"),
            rails_base_url: "http://127.0.0.1:3021".to_string(),
            attachment_timeout_secs: 300, // 5 minutes
            lease_duration_secs: 60,      // 1 minute
            max_checkpoint_age_hours: 24,
        }
    }
}

impl RunManager {
    /// Create a new RunManager
    pub async fn new(
        config: RunManagerConfig,
        rails_client: Arc<dyn RailsClient>,
    ) -> Result<(Self, mpsc::Sender<CoworkEvent>)> {
        let runs = Arc::new(RwLock::new(HashMap::new()));
        let jobs = Arc::new(RwLock::new(HashMap::new()));
        
        let attachments = Arc::new(
            AttachmentRegistry::new(config.data_dir.join("attachments"), config.attachment_timeout_secs).await?
        );
        
        let checkpoints = Arc::new(
            CheckpointManager::new(config.data_dir.join("checkpoints"), &config.rails_base_url).await?
        );

        let (event_tx, _event_rx) = mpsc::channel(1000);
        let (_shutdown_tx, shutdown_rx) = mpsc::channel(1);

        let manager = Self {
            runs,
            jobs,
            attachments,
            checkpoints,
            event_tx: event_tx.clone(),
            rails_client,
            shutdown: shutdown_rx,
        };

        // Start background tasks
        manager.start_heartbeat_task().await;
        manager.start_lease_renewal_task().await;

        Ok((manager, event_tx))
    }

    /// Create a new run
    pub async fn create_run(&self, spec: CreateRunSpec) -> Result<Run> {
        let run_id = RunId::new();
        let now = Utc::now();

        // Create DAG in Rails
        let dag_id = self.rails_client.create_dag(run_id, &spec).await
            .map_err(|e| CoworkError::Rails(e))?;

        let run = Run {
            id: run_id,
            tenant_id: spec.tenant_id,
            workspace_id: spec.workspace_id,
            initiator: spec.initiator,
            mode: spec.mode,
            state: RunState::Created,
            entrypoint: spec.entrypoint.clone(),
            dag_id,
            current_job_id: None,
            current_checkpoint_id: None,
            policy_profile: spec.policy_profile.unwrap_or_else(|| "default".to_string()),
            created_at: now,
            updated_at: now,
            completed_at: None,
        };

        let run_arc = Arc::new(RwLock::new(run.clone()));
        {
            let mut runs = self.runs.write().await;
            runs.insert(run_id, run_arc);
        }

        // Emit event
        let _ = self.event_tx.send(CoworkEvent::RunCreated {
            run_id,
            mode: spec.mode,
        }).await;

        info!(run_id = %run_id, dag_id = %run.dag_id, mode = %spec.mode, "Created run");

        Ok(run)
    }

    /// Get a run by ID
    pub async fn get_run(&self, run_id: RunId) -> Result<Run> {
        let runs = self.runs.read().await;
        match runs.get(&run_id) {
            Some(run) => Ok(run.read().await.clone()),
            None => Err(CoworkError::RunNotFound(run_id.to_string())),
        }
    }

    /// List all runs (with optional filter)
    pub async fn list_runs(&self, state: Option<RunState>) -> Vec<Run> {
        let runs = self.runs.read().await;
        let mut result = Vec::new();

        for run_arc in runs.values() {
            let run = run_arc.read().await;
            if state.map(|s| s == run.state).unwrap_or(true) {
                result.push(run.clone());
            }
        }

        // Sort by creation time, most recent first
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        result
    }

    /// Transition a run to a new state
    pub async fn transition_run_state(&self, run_id: RunId, to: RunState) -> Result<()> {
        let runs = self.runs.read().await;
        let run_arc = runs.get(&run_id)
            .ok_or_else(|| CoworkError::RunNotFound(run_id.to_string()))?
            .clone();
        drop(runs);

        let mut run = run_arc.write().await;
        let from = run.state;

        // Validate transition
        if !Self::is_valid_run_transition(from, to) {
            return Err(CoworkError::InvalidStateTransition {
                from: from.to_string(),
                to: to.to_string(),
            });
        }

        run.state = to;
        run.updated_at = Utc::now();

        if to.is_terminal() {
            run.completed_at = Some(Utc::now());
        }

        // Update Rails
        self.rails_client.update_run_state(&run.dag_id, to).await
            .map_err(|e| CoworkError::Rails(e))?;

        drop(run);

        // Emit event
        let _ = self.event_tx.send(CoworkEvent::RunStateChanged {
            run_id,
            from,
            to,
        }).await;

        if to.is_terminal() {
            let success = to == RunState::Completed;
            let _ = self.event_tx.send(CoworkEvent::RunCompleted {
                run_id,
                success,
            }).await;
        }

        info!(run_id = %run_id, from = %from, to = %to, "Run state transition");

        Ok(())
    }

    /// Create a job within a run
    pub async fn create_job(&self, spec: CreateJobSpec) -> Result<Job> {
        let job_id = JobId::new();
        let now = Utc::now();

        // Verify run exists
        let runs = self.runs.read().await;
        let run_arc = runs.get(&spec.run_id)
            .ok_or_else(|| CoworkError::RunNotFound(spec.run_id.to_string()))?
            .clone();
        drop(runs);

        let run = run_arc.read().await;
        let dag_id = run.dag_id.clone();
        drop(run);

        // Create node in Rails DAG
        let node_id = self.rails_client.create_node(&dag_id, job_id, &spec).await
            .map_err(|e| CoworkError::Rails(e))?;

        let job = Job {
            id: job_id,
            run_id: spec.run_id,
            dag_node_id: node_id,
            job_type: spec.job_type,
            priority: spec.priority,
            state: JobState::Scheduled,
            lease_owner: None,
            lease_expires_at: None,
            retry_count: 0,
            max_retries: spec.max_retries,
            timeout_sec: spec.timeout_sec,
            payload: spec.payload,
            created_at: now,
            updated_at: now,
            started_at: None,
            completed_at: None,
        };

        let job_arc = Arc::new(RwLock::new(job.clone()));
        {
            let mut jobs = self.jobs.write().await;
            jobs.insert(job_id, job_arc);
        }

        // Emit event
        let _ = self.event_tx.send(CoworkEvent::JobCreated {
            run_id: spec.run_id,
            job_id,
        }).await;

        info!(job_id = %job_id, run_id = %spec.run_id, "Created job");

        Ok(job)
    }

    /// Attach a client to a run
    pub async fn attach(
        &self,
        run_id: RunId,
        client_type: ClientType,
        session_id: String,
        permissions: PermissionSet,
    ) -> Result<Attachment> {
        // Verify run is attachable
        let run = self.get_run(run_id).await?;

        if !run.state.is_attachable() {
            return Err(CoworkError::NotAttachable(format!(
                "Run is in {} state",
                run.state
            )));
        }

        let attachment = self.attachments.attach(
            run_id,
            client_type,
            session_id,
            permissions,
        ).await?;

        // Emit event
        let _ = self.event_tx.send(CoworkEvent::Attached {
            run_id,
            attachment_id: attachment.id,
            client_type,
        }).await;

        Ok(attachment)
    }

    /// Detach a client from a run
    pub async fn detach(&self, attachment_id: uuid::Uuid) -> Result<()> {
        let attachment = self.attachments.get(attachment_id).await?;
        
        self.attachments.detach(attachment_id).await?;

        // Emit event
        let _ = self.event_tx.send(CoworkEvent::Detached {
            run_id: attachment.run_id,
            attachment_id,
        }).await;

        Ok(())
    }

    /// Reattach using a reconnect token
    pub async fn reattach(&self, token: &str, cursor: Option<String>) -> Result<Attachment> {
        self.attachments.reattach(token, cursor).await
    }

    /// List active attachments for a run
    pub async fn list_attachments(&self, run_id: RunId) -> Result<Vec<Attachment>> {
        self.attachments.list_active(run_id).await
    }

    /// Create a checkpoint for a run
    pub async fn checkpoint(
        &self,
        run_id: RunId,
        job_id: Option<JobId>,
        step_index: i32,
        cursor_state: serde_json::Value,
    ) -> Result<crate::types::Checkpoint> {
        let checkpoint = self.checkpoints.create(
            run_id,
            job_id,
            step_index,
            cursor_state,
            vec![], // TODO: pending approvals
            vec![], // TODO: artifact refs
        ).await?;

        // Update run's current checkpoint
        let runs = self.runs.read().await;
        if let Some(run_arc) = runs.get(&run_id) {
            let mut run = run_arc.write().await;
            run.current_checkpoint_id = Some(checkpoint.id.clone());
        }

        // Emit event
        let _ = self.event_tx.send(CoworkEvent::CheckpointCreated {
            run_id,
            checkpoint_id: checkpoint.id.clone(),
        }).await;

        Ok(checkpoint)
    }

    /// Recover a run from its latest checkpoint
    pub async fn recover(&self, run_id: RunId) -> Result<Option<(crate::types::Checkpoint, String)>> {
        let result = self.checkpoints.recover(run_id).await?;

        if let Some((ref cp, _)) = result {
            // Transition run to recovering state
            self.transition_run_state(run_id, RunState::Recovering).await?;

            info!(
                run_id = %run_id,
                checkpoint_id = %cp.id,
                "Started recovery from checkpoint"
            );
        }

        Ok(result)
    }

    /// Cancel a run
    pub async fn cancel(&self, run_id: RunId) -> Result<()> {
        self.transition_run_state(run_id, RunState::Cancelled).await
    }

    /// Check if a run state transition is valid
    fn is_valid_run_transition(from: RunState, to: RunState) -> bool {
        use RunState::*;

        match (from, to) {
            // Created can transition to planned or cancelled
            (Created, Planned) => true,
            (Created, Cancelled) => true,

            // Planned can transition to queued or cancelled
            (Planned, Queued) => true,
            (Planned, Cancelled) => true,

            // Queued can transition to running, cancelled, or recovering
            (Queued, Running) => true,
            (Queued, Cancelled) => true,
            (Queued, Recovering) => true,

            // Running can transition to paused, awaiting_approval, completed, failed, or cancelled
            (Running, Paused) => true,
            (Running, AwaitingApproval) => true,
            (Running, Completed) => true,
            (Running, Failed) => true,
            (Running, Cancelled) => true,

            // Paused can transition to running or cancelled
            (Paused, Running) => true,
            (Paused, Cancelled) => true,

            // AwaitingApproval can transition to running or cancelled
            (AwaitingApproval, Running) => true,
            (AwaitingApproval, Cancelled) => true,

            // Recovering can transition to running or failed
            (Recovering, Running) => true,
            (Recovering, Failed) => true,

            // Terminal states cannot transition
            (Completed, _) => false,
            (Failed, _) => false,
            (Cancelled, _) => false,

            // Any other transition is invalid
            _ => false,
        }
    }

    /// Start the heartbeat task for detecting stale attachments
    async fn start_heartbeat_task(&self) {
        let _attachments = self.attachments.clone();
        let interval_secs = 60u64;

        tokio::spawn(async move {
            let mut intv = interval(Duration::from_secs(interval_secs));

            loop {
                intv.tick().await;

                // Cleanup is handled by AttachmentRegistry internally
                debug!("Heartbeat task tick");
            }
        });
    }

    /// Start the lease renewal task
    async fn start_lease_renewal_task(&self) {
        let _jobs = self.jobs.clone();
        let interval_secs = 30u64;

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(interval_secs));

            loop {
                interval.tick().await;

                // Lease renewal is handled by individual job workers
                debug!("Lease renewal task tick");
            }
        });
    }

    /// Shutdown the RunManager gracefully
    pub async fn shutdown(mut self) {
        info!("Shutting down RunManager");

        // Signal shutdown
        let _ = self.shutdown.recv().await;

        // Stop attachment cleanup
        self.attachments.stop_cleanup().await;

        info!("RunManager shutdown complete");
    }
}
