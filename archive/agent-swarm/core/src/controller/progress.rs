use crate::types::{Cost, EntityId, Progress, Status};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::broadcast;

/// Progress update event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressUpdate {
    pub timestamp: DateTime<Utc>,
    pub task_id: EntityId,
    pub session_id: EntityId,
    pub update_type: ProgressUpdateType,
    pub progress: Progress,
    pub cost: Cost,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProgressUpdateType {
    Started,
    ModeSelected,
    PhaseStarted,
    PhaseCompleted,
    AgentStarted,
    AgentCompleted,
    AgentFailed,
    ProgressUpdate,
    QualityGate,
    ReviewComplete,
    KnowledgeStored,
    Completed,
    Failed,
}

/// Tracks progress for a task
#[derive(Debug)]
pub struct ProgressTracker {
    task_id: EntityId,
    session_id: EntityId,
    tx: broadcast::Sender<ProgressUpdate>,
    current_progress: Progress,
    total_cost: Cost,
}

impl ProgressTracker {
    pub fn new(task_id: EntityId, session_id: EntityId) -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            task_id,
            session_id,
            tx,
            current_progress: Progress::new(0),
            total_cost: Cost::default(),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ProgressUpdate> {
        self.tx.subscribe()
    }

    pub fn set_total(&mut self, total: u32) {
        self.current_progress = Progress::new(total);
    }

    pub fn report_started(&self, mode: &str) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::Started,
            progress: self.current_progress.clone(),
            cost: self.total_cost,
            message: format!("Task started with mode: {}", mode),
        });
    }

    pub fn report_phase_started(&self, phase: &str) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::PhaseStarted,
            progress: self.current_progress.clone(),
            cost: self.total_cost,
            message: format!("Phase started: {}", phase),
        });
    }

    pub fn report_phase_completed(&self, phase: &str) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::PhaseCompleted,
            progress: self.current_progress.clone(),
            cost: self.total_cost,
            message: format!("Phase completed: {}", phase),
        });
    }

    pub fn report_agent_started(&self, agent_id: EntityId) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::AgentStarted,
            progress: self.current_progress.clone(),
            cost: self.total_cost,
            message: format!("Agent started: {}", agent_id),
        });
    }

    pub fn report_agent_completed(&self, agent_id: EntityId, cost: Cost) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::AgentCompleted,
            progress: self.current_progress.clone(),
            cost,
            message: format!("Agent completed: {}", agent_id),
        });
    }

    pub fn report_progress(&self, completed: u32, message: impl Into<String>) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::ProgressUpdate,
            progress: Progress {
                total: self.current_progress.total,
                completed,
                failed: self.current_progress.failed,
                in_progress: self.current_progress.in_progress,
            },
            cost: self.total_cost,
            message: message.into(),
        });
    }

    pub fn report_completed(&self) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::Completed,
            progress: Progress {
                total: self.current_progress.total,
                completed: self.current_progress.total,
                failed: self.current_progress.failed,
                in_progress: 0,
            },
            cost: self.total_cost,
            message: "Task completed".to_string(),
        });
    }

    pub fn report_failed(&self, error: impl Into<String>) {
        let _ = self.tx.send(ProgressUpdate {
            timestamp: Utc::now(),
            task_id: self.task_id,
            session_id: self.session_id,
            update_type: ProgressUpdateType::Failed,
            progress: self.current_progress.clone(),
            cost: self.total_cost,
            message: error.into(),
        });
    }

    pub fn add_cost(&mut self, cost: Cost) {
        self.total_cost.add(&cost);
    }
}
