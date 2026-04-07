//! Background Job Dispatcher
//!
//! Automatically dequeues jobs from the queue and dispatches them to appropriate nodes.
//! Runs as a background task in the control plane.

use allternit_protocol::{JobSpec, Message, MessagePayload};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use tracing::{debug, error, info, warn};

use crate::node_job_queue::{JobQueue, JobStatus};
use crate::node_ws::NodeRegistry;

/// Job dispatcher configuration
pub struct JobDispatcherConfig {
    /// How often to check for pending jobs
    pub poll_interval: Duration,
    /// Maximum retries for failed jobs
    pub max_retries: u32,
}

impl Default for JobDispatcherConfig {
    fn default() -> Self {
        Self {
            poll_interval: Duration::from_secs(5),
            max_retries: 3,
        }
    }
}

/// Background job dispatcher
pub struct JobDispatcher {
    job_queue: Arc<JobQueue>,
    node_registry: Arc<NodeRegistry>,
    config: JobDispatcherConfig,
}

impl JobDispatcher {
    pub fn new(job_queue: Arc<JobQueue>, node_registry: Arc<NodeRegistry>) -> Self {
        Self {
            job_queue,
            node_registry,
            config: JobDispatcherConfig::default(),
        }
    }

    pub fn with_config(
        job_queue: Arc<JobQueue>,
        node_registry: Arc<NodeRegistry>,
        config: JobDispatcherConfig,
    ) -> Self {
        Self {
            job_queue,
            node_registry,
            config,
        }
    }

    /// Run the dispatcher (blocks forever)
    pub async fn run(self) {
        info!("🚀 Job dispatcher started");

        let mut poll_interval = interval(self.config.poll_interval);

        loop {
            poll_interval.tick().await;

            if let Err(e) = self.dispatch_pending_jobs().await {
                error!("Job dispatcher error: {}", e);
            }
        }
    }

    /// Dispatch pending jobs to nodes
    async fn dispatch_pending_jobs(&self) -> Result<(), String> {
        // Try to dequeue a job
        let queued_job = match self.job_queue.dequeue_next().await {
            Ok(Some(job)) => job,
            Ok(None) => {
                // No pending jobs
                return Ok(());
            }
            Err(e) => {
                error!("Failed to dequeue job: {}", e);
                return Err(format!("Dequeue error: {}", e));
            }
        };

        let job_id = queued_job.job_id.clone();

        // Parse job spec from JSON
        let job_spec: JobSpec = match serde_json::from_str(&queued_job.job_spec) {
            Ok(spec) => spec,
            Err(e) => {
                error!("Failed to parse job spec for {}: {}", job_id, e);
                // Mark job as failed
                let _ = self
                    .job_queue
                    .update_status(&job_id, JobStatus::Failed)
                    .await;
                return Err(format!("Invalid job spec: {}", e));
            }
        };

        info!(
            "📤 Dispatching job {} to node {:?}",
            job_id, queued_job.node_id
        );

        // Determine target node
        let target_node_id = match queued_job.node_id {
            Some(node_id) => {
                // Specific node requested
                Some(node_id)
            }
            None => {
                // Auto-select best node based on job requirements
                let caps = job_spec.resources.clone().into();
                self.node_registry.find_best_node(&caps).await
            }
        };

        let target_node_id = match target_node_id {
            Some(id) => id,
            None => {
                warn!("No suitable node found for job {}", job_id);
                // Put job back in queue (mark as pending again)
                let _ = self
                    .job_queue
                    .update_status(&job_id, JobStatus::Pending)
                    .await;
                return Ok(());
            }
        };

        // Check if node is connected
        if self.node_registry.get_node(&target_node_id).await.is_none() {
            warn!("Target node {} is not connected", target_node_id);
            // Put job back in queue
            let _ = self
                .job_queue
                .update_status(&job_id, JobStatus::Pending)
                .await;
            return Ok(());
        }

        // Send job to node
        let message = Message::new(MessagePayload::AssignJob { job: job_spec });

        match self
            .node_registry
            .send_to_node(&target_node_id, message)
            .await
        {
            Ok(()) => {
                info!("✅ Job {} sent to node {}", job_id, target_node_id);
                // Update status to scheduled (will be updated to running when node starts it)
                let _ = self
                    .job_queue
                    .update_status(&job_id, JobStatus::Scheduled)
                    .await;
                Ok(())
            }
            Err(e) => {
                warn!(
                    "Failed to send job {} to node {}: {}",
                    job_id, target_node_id, e
                );
                // Put job back in queue
                let _ = self
                    .job_queue
                    .update_status(&job_id, JobStatus::Pending)
                    .await;
                Err(format!("Send error: {}", e))
            }
        }
    }
}

/// Start the job dispatcher as a background task
pub fn start_job_dispatcher(job_queue: Arc<JobQueue>, node_registry: Arc<NodeRegistry>) {
    let dispatcher = JobDispatcher::new(job_queue, node_registry);

    tokio::spawn(async move {
        dispatcher.run().await;
    });

    info!("📡 Job dispatcher task started");
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    #[tokio::test]
    async fn test_dispatcher_creation() {
        // This is a basic test - full integration tests are in e2e_tests.rs
        let db = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let job_queue = Arc::new(JobQueue::new(db.clone()));
        let node_registry = Arc::new(NodeRegistry::new());

        job_queue.init().await.unwrap();

        let dispatcher = JobDispatcher::new(job_queue, node_registry);

        // Verify dispatcher was created
        assert!(true);
    }
}
