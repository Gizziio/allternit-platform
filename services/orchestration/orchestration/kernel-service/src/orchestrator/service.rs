use crate::orchestrator::run_store::RunStore;
use crate::orchestrator::task_store::TaskStore;
use crate::types::{OrchestratorEvent, Run, Task};
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::info;
use uuid::Uuid;

#[derive(Debug)]
pub struct OrchestratorService {
    pub task_store: Arc<TaskStore>,
    pub run_store: Arc<RunStore>,
    event_tx: broadcast::Sender<OrchestratorEvent>,
}

impl OrchestratorService {
    pub fn new(
        task_store: Arc<TaskStore>,
        run_store: Arc<RunStore>,
        event_tx: broadcast::Sender<OrchestratorEvent>,
    ) -> Self {
        Self {
            task_store,
            run_store,
            event_tx,
        }
    }

    pub fn event_rx(&self) -> broadcast::Receiver<OrchestratorEvent> {
        self.event_tx.subscribe()
    }

    pub async fn create_task(
        &self,
        title: String,
        workspace_id: String,
        repo_path: String,
        intent: String,
        agent_profile: Option<String>,
    ) -> anyhow::Result<Task> {
        let task = Task {
            id: Uuid::new_v4().to_string(),
            title,
            created_at: Utc::now().timestamp_millis(),
            workspace_id,
            repo_path,
            worktree_path: None,
            intent,
            agent_profile,
            status: "queued".to_string(),
            active_run_id: None,
        };

        self.task_store.create_task(task.clone()).await?;
        let _ = self
            .event_tx
            .send(OrchestratorEvent::TaskCreated { task: task.clone() });

        info!("Task created: {}", task.id);
        Ok(task)
    }

    pub async fn start_run(&self, task_id: String) -> anyhow::Result<Run> {
        let run = Run {
            id: Uuid::new_v4().to_string(),
            task_id: task_id.clone(),
            created_at: Utc::now().timestamp_millis(),
            started_at: Some(Utc::now().timestamp_millis()),
            ended_at: None,
            terminal_session_id: None, // Will be attached later
            status: "running".to_string(),
            tokens: None,
            cost: None,
            duration_ms: None,
            review_ready: false,
            review_summary: None,
            canvas_enabled: false,
            canvas_stream_id: None,
            last_frame_at: None,
        };

        self.run_store.create_run(run.clone()).await?;
        self.task_store.update_status(&task_id, "running").await?;
        self.task_store
            .set_active_run(&task_id, Some(run.id.clone()))
            .await?;

        let _ = self
            .event_tx
            .send(OrchestratorEvent::RunStarted { run: run.clone() });

        info!("Run started: {} for task {}", run.id, task_id);
        Ok(run)
    }

    pub async fn emit_output(&self, run_id: String, data: String) {
        let _ = self.event_tx.send(OrchestratorEvent::RunOutput {
            run_id,
            data,
            ts: Utc::now().timestamp_millis(),
        });
    }

    pub async fn update_run_status(&self, run_id: String, status: String) -> anyhow::Result<()> {
        self.run_store.update_run_status(&run_id, &status).await?;

        let _ = self.event_tx.send(OrchestratorEvent::RunStateChanged {
            run_id: run_id.clone(),
            status: status.clone(),
            ts: Utc::now().timestamp_millis(),
        });

        // If run is done/failed, also update task status if it's the active run
        if let Some(run) = self.run_store.get_run(&run_id).await? {
            if let Some(task) = self.task_store.get_task(&run.task_id).await? {
                if task.active_run_id == Some(run_id) {
                    self.task_store.update_status(&task.id, &status).await?;
                }
            }
        }

        Ok(())
    }
}
