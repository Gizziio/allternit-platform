pub mod execution;
pub use execution::ExecutionEngine;
// Existing modules
use a2rchitech_history::HistoryLedger;
use a2rchitech_messaging::{EventEnvelope, MessagingSystem, TaskEnvelope};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionMode {
    Live,
    Replay,
    Sim,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Environment {
    Dev,
    Stage,
    Prod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Embodiment {
    None,
    Sim,
    Real,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub session_id: String,
    pub tenant_id: String,
    pub created_by: String, // identity
    pub role: String,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub mode: SessionMode,
    pub environment: Environment,
    pub embodiment: Embodiment,
    pub policy_snapshot_ref: String, // reference to policy state
    pub active_workflows: Vec<String>,
    pub status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionStatus {
    Active,
    Paused,
    Stopped,
    Failed,
}

#[derive(Debug, thiserror::Error)]
pub enum RuntimeError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("History error: {0}")]
    History(#[from] a2rchitech_history::HistoryError),
    #[error("Messaging error: {0}")]
    Messaging(#[from] a2rchitech_messaging::MessagingError),
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Task not found: {0}")]
    TaskNotFound(String),
    #[error("Workflow not found: {0}")]
    WorkflowNotFound(String),
    #[error("Invalid state transition: {0}")]
    InvalidState(String),
    #[error("Mutex poisoned: {0}")]
    MutexPoisoned(String),
    #[error("Time error: {0}")]
    TimeError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub artifact_id: String,
    pub created_by: String,
    pub created_at: u64,
    pub media_type: String,
    pub hash: String,
    pub size: u64,
    pub content: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub checkpoint_id: String,
    pub session_id: String,
    pub workflow_state: serde_json::Value,
    pub artifact_pointers: Vec<String>,
    pub task_queue_offset: Option<String>,
    pub policy_snapshot_ref: String,
    pub created_at: u64,
}

pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
}

impl SessionManager {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        SessionManager {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
            messaging_system,
        }
    }

    pub async fn create_session(
        &self,
        tenant_id: String,
        created_by: String,
        role: String,
        mode: SessionMode,
        environment: Environment,
        embodiment: Embodiment,
        policy_snapshot_ref: String,
    ) -> Result<Session, RuntimeError> {
        let session_id = Uuid::new_v4().to_string();
        let start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| RuntimeError::TimeError(e.to_string()))?
            .as_secs();

        let session = Session {
            session_id: session_id.clone(),
            tenant_id,
            created_by,
            role,
            start_time,
            end_time: None,
            mode,
            environment,
            embodiment,
            policy_snapshot_ref,
            active_workflows: Vec::new(),
            status: SessionStatus::Active,
        };

        // Add to active sessions
        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), session.clone());
        drop(sessions);

        // Log to history ledger first
        let mut history = self
            .history_ledger
            .lock()
            .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
        let content = serde_json::to_value(&session)?;
        history.append(content)?;
        drop(history); // Release the lock before spawning async task

        // Emit session start event
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "SessionStart".to_string(),
            session_id: session_id.clone(),
            tenant_id: session.tenant_id.clone(),
            actor_id: session.created_by.clone(),
            role: session.role.clone(),
            timestamp: start_time,
            trace_id: Some(session_id.clone()),
            payload: serde_json::json!({
                "session": session
            }),
        };

        // Log to history ledger first
        {
            let mut history = self
                .history_ledger
                .lock()
                .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
            let content = serde_json::to_value(&event)?;
            history.append(content)?;
        } // Release the lock immediately

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        Ok(session)
    }

    pub async fn close_session(&self, session_id: String) -> Result<(), RuntimeError> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(&session_id) {
            let end_time = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| RuntimeError::TimeError(e.to_string()))?
                .as_secs();

            session.end_time = Some(end_time);
            session.status = SessionStatus::Stopped;

            // Log to history ledger
            let mut history = self
                .history_ledger
                .lock()
                .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
            let content = serde_json::json!({
                "event": "SessionClose",
                "session_id": session_id,
                "end_time": end_time
            });
            history.append(content)?;

            // Emit session end event
            let event = EventEnvelope {
                event_id: Uuid::new_v4().to_string(),
                event_type: "SessionEnd".to_string(),
                session_id: session_id.clone(),
                tenant_id: session.tenant_id.clone(),
                actor_id: session.created_by.clone(),
                role: session.role.clone(),
                timestamp: end_time,
                trace_id: Some(session_id.clone()),
                payload: serde_json::json!({
                    "session_id": session_id,
                    "end_time": end_time
                }),
            };

            tokio::spawn({
                let event_bus = self.messaging_system.event_bus.clone();
                let event_to_send = event.clone();
                async move {
                    let _ = event_bus.publish(event_to_send).await;
                }
            });

            Ok(())
        } else {
            Err(RuntimeError::SessionNotFound(session_id))
        }
    }

    pub async fn get_session(&self, session_id: String) -> Option<Session> {
        let sessions = self.sessions.read().await;
        sessions.get(&session_id).cloned()
    }

    pub async fn list_sessions(&self) -> Vec<Session> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }
}

pub struct Scheduler {
    session_manager: Arc<SessionManager>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    concurrency_limits: Arc<RwLock<HashMap<String, usize>>>, // tenant_id -> max_concurrent
}

impl Scheduler {
    pub fn new(
        session_manager: Arc<SessionManager>,
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        Scheduler {
            session_manager,
            history_ledger,
            messaging_system,
            concurrency_limits: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn set_concurrency_limit(&self, tenant_id: String, limit: usize) {
        let mut limits = self.concurrency_limits.write().await;
        limits.insert(tenant_id, limit);
    }

    pub async fn dispatch_task(&self, task: TaskEnvelope) -> Result<(), RuntimeError> {
        // Check concurrency limits
        let limits = self.concurrency_limits.read().await;
        if let Some(&limit) = limits.get(&task.tenant_id) {
            let current_count = self.messaging_system.task_queue.get_pending_count().await?;
            if current_count >= limit {
                return Err(RuntimeError::InvalidState(format!(
                    "Concurrency limit exceeded for tenant {}",
                    task.tenant_id
                )));
            }
        }

        // Add to task queue
        self.messaging_system
            .task_queue
            .enqueue(task.clone())
            .await?;

        // Log to history ledger
        let mut history = self
            .history_ledger
            .lock()
            .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
        let content = serde_json::to_value(&task)?;
        history.append(content)?;

        // Emit task dispatch event
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "TaskDispatch".to_string(),
            session_id: task.session_id.clone(),
            tenant_id: task.tenant_id.clone(),
            actor_id: task.role.clone(), // Using role as actor for this example
            role: task.role.clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| RuntimeError::TimeError(e.to_string()))?
                .as_secs(),
            trace_id: task.trace_id.clone(),
            payload: serde_json::json!({
                "task_id": task.task_id,
                "workflow_id": task.workflow_id,
                "step_id": task.step_id
            }),
        };

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        Ok(())
    }

    pub async fn process_next_task(&self) -> Option<TaskEnvelope> {
        match self.messaging_system.task_queue.dequeue().await {
            Ok(task) => task,
            Err(_) => None, // Return None if there's an error
        }
    }
}

pub struct ArtifactStore {
    artifacts: Arc<RwLock<HashMap<String, Artifact>>>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
}

impl ArtifactStore {
    pub fn new(history_ledger: Arc<Mutex<HistoryLedger>>) -> Self {
        ArtifactStore {
            artifacts: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
        }
    }

    pub async fn store_artifact(&self, mut artifact: Artifact) -> Result<String, RuntimeError> {
        // Calculate hash if not provided
        if artifact.hash.is_empty() {
            let content_str = serde_json::to_string(&artifact.content)?;
            let mut hasher = sha2::Sha256::new();
            hasher.update(content_str.as_bytes());
            let result = hasher.finalize();
            artifact.hash = hex::encode(result);
        }

        let artifact_id = artifact.artifact_id.clone();

        // Store in memory
        let mut artifacts = self.artifacts.write().await;
        artifacts.insert(artifact_id.clone(), artifact.clone());
        drop(artifacts);

        // Log to history ledger
        let mut history = self
            .history_ledger
            .lock()
            .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
        let content = serde_json::to_value(&artifact)?;
        history.append(content)?;

        Ok(artifact_id)
    }

    pub async fn get_artifact(&self, artifact_id: String) -> Option<Artifact> {
        let artifacts = self.artifacts.read().await;
        artifacts.get(&artifact_id).cloned()
    }

    pub async fn list_artifacts(&self) -> Vec<Artifact> {
        let artifacts = self.artifacts.read().await;
        artifacts.values().cloned().collect()
    }
}

pub struct CheckpointManager {
    checkpoints: Arc<RwLock<HashMap<String, Checkpoint>>>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
}

impl CheckpointManager {
    pub fn new(history_ledger: Arc<Mutex<HistoryLedger>>) -> Self {
        CheckpointManager {
            checkpoints: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
        }
    }

    pub async fn create_checkpoint(&self, checkpoint: Checkpoint) -> Result<String, RuntimeError> {
        let checkpoint_id = checkpoint.checkpoint_id.clone();

        // Store in memory
        let mut checkpoints = self.checkpoints.write().await;
        checkpoints.insert(checkpoint_id.clone(), checkpoint.clone());
        drop(checkpoints);

        // Log to history ledger
        let mut history = self
            .history_ledger
            .lock()
            .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
        let content = serde_json::to_value(&checkpoint)?;
        history.append(content)?;

        Ok(checkpoint_id)
    }

    pub async fn get_checkpoint(&self, checkpoint_id: String) -> Option<Checkpoint> {
        let checkpoints = self.checkpoints.read().await;
        checkpoints.get(&checkpoint_id).cloned()
    }

    pub async fn rollback_to_checkpoint(&self, checkpoint_id: String) -> Result<(), RuntimeError> {
        // This would typically restore state from the checkpoint
        // For now, we'll just log the rollback attempt
        let mut history = self
            .history_ledger
            .lock()
            .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
        let content = serde_json::json!({
            "event": "Rollback",
            "checkpoint_id": checkpoint_id,
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| RuntimeError::TimeError(e.to_string()))?
                .as_secs()
        });
        history.append(content)?;

        Ok(())
    }
}

pub struct ReplayDriver {
    history_ledger: Arc<Mutex<HistoryLedger>>,
    session_manager: Arc<SessionManager>,
    scheduler: Arc<Scheduler>,
    artifact_store: Arc<ArtifactStore>,
}

impl ReplayDriver {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        session_manager: Arc<SessionManager>,
        scheduler: Arc<Scheduler>,
        artifact_store: Arc<ArtifactStore>,
    ) -> Self {
        ReplayDriver {
            history_ledger,
            session_manager,
            scheduler,
            artifact_store,
        }
    }

    pub async fn replay_session(&self, session_id: String) -> Result<(), RuntimeError> {
        // Get all entries for this session from history ledger
        let history = self
            .history_ledger
            .lock()
            .map_err(|e| RuntimeError::MutexPoisoned(e.to_string()))?;
        let entries = history.get_entries()?;

        // Filter entries for this session
        let session_entries: Vec<_> = entries
            .into_iter()
            .filter(|entry| {
                // Try to parse as different types of entries
                if let Ok(task) = serde_json::from_value::<TaskEnvelope>(entry.content.clone()) {
                    task.session_id == session_id
                } else if let Ok(event) =
                    serde_json::from_value::<EventEnvelope>(entry.content.clone())
                {
                    event.session_id == session_id
                } else if let Ok(session) = serde_json::from_value::<Session>(entry.content.clone())
                {
                    session.session_id == session_id
                } else {
                    false
                }
            })
            .collect();

        // Replay in chronological order
        for entry in session_entries {
            // Process each entry based on its content
            if let Ok(task) = serde_json::from_value::<TaskEnvelope>(entry.content.clone()) {
                // In replay mode, we don't actually execute tasks, just verify they would be valid
                tracing::info!("Replaying task: {}", task.task_id);
            } else if let Ok(event) = serde_json::from_value::<EventEnvelope>(entry.content.clone())
            {
                tracing::info!("Replaying event: {} - {}", event.event_type, event.event_id);
            } else if let Ok(session) = serde_json::from_value::<Session>(entry.content.clone()) {
                tracing::info!("Replaying session: {}", session.session_id);
            }
        }

        Ok(())
    }
}

pub struct RuntimeCore {
    pub session_manager: Arc<SessionManager>,
    pub scheduler: Arc<Scheduler>,
    pub artifact_store: Arc<ArtifactStore>,
    pub checkpoint_manager: Arc<CheckpointManager>,
    pub replay_driver: Arc<ReplayDriver>,
}

impl RuntimeCore {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        let session_manager = Arc::new(SessionManager::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let scheduler = Arc::new(Scheduler::new(
            session_manager.clone(),
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let artifact_store = Arc::new(ArtifactStore::new(history_ledger.clone()));

        let checkpoint_manager = Arc::new(CheckpointManager::new(history_ledger.clone()));

        let replay_driver = Arc::new(ReplayDriver::new(
            history_ledger,
            session_manager.clone(),
            scheduler.clone(),
            artifact_store.clone(),
        ));

        RuntimeCore {
            session_manager,
            scheduler,
            artifact_store,
            checkpoint_manager,
            replay_driver,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use a2rchitech_messaging::MessagingSystem;
    use sqlx::SqlitePool;
    use std::time::Duration;
    use tempfile::NamedTempFile;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_session_management() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_runtime_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            a2rchitech_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let runtime_core = RuntimeCore::new(history_ledger, messaging_system);

        // Create a session
        let session = runtime_core
            .session_manager
            .create_session(
                "tenant1".to_string(),
                "user1".to_string(),
                "test_role".to_string(),
                SessionMode::Live,
                Environment::Dev,
                Embodiment::None,
                "policy_snapshot_1".to_string(),
            )
            .await
            .unwrap();

        assert_eq!(session.tenant_id, "tenant1");
        assert_eq!(session.status, SessionStatus::Active);

        // Get the session
        let retrieved_session = runtime_core
            .session_manager
            .get_session(session.session_id.clone())
            .await
            .unwrap();
        assert_eq!(retrieved_session.session_id, session.session_id);

        // Close the session
        runtime_core
            .session_manager
            .close_session(session.session_id.clone())
            .await
            .unwrap();

        // Verify session is closed
        let closed_session = runtime_core
            .session_manager
            .get_session(session.session_id.clone())
            .await
            .unwrap();
        assert_eq!(closed_session.status, SessionStatus::Stopped);

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[tokio::test]
    async fn test_artifact_store() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_artifact_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            a2rchitech_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let runtime_core = RuntimeCore::new(history_ledger, messaging_system);

        let artifact = Artifact {
            artifact_id: Uuid::new_v4().to_string(),
            created_by: "test".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            media_type: "application/json".to_string(),
            hash: "".to_string(), // Will be calculated
            size: 0,
            content: serde_json::json!({"data": "test_artifact"}),
        };

        let artifact_id = runtime_core
            .artifact_store
            .store_artifact(artifact.clone())
            .await
            .unwrap();

        let retrieved_artifact = runtime_core
            .artifact_store
            .get_artifact(artifact_id)
            .await
            .unwrap();

        assert_eq!(retrieved_artifact.content["data"], "test_artifact");

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[tokio::test]
    async fn test_checkpoint_manager() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_checkpoint_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            a2rchitech_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let runtime_core = RuntimeCore::new(history_ledger, messaging_system);

        let checkpoint = Checkpoint {
            checkpoint_id: Uuid::new_v4().to_string(),
            session_id: "session1".to_string(),
            workflow_state: serde_json::json!({"phase": "observe", "status": "completed"}),
            artifact_pointers: vec!["artifact1".to_string()],
            task_queue_offset: Some("task1".to_string()),
            policy_snapshot_ref: "policy1".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let checkpoint_id = runtime_core
            .checkpoint_manager
            .create_checkpoint(checkpoint.clone())
            .await
            .unwrap();

        let retrieved_checkpoint = runtime_core
            .checkpoint_manager
            .get_checkpoint(checkpoint_id)
            .await
            .unwrap();

        assert_eq!(retrieved_checkpoint.session_id, "session1");

        // Test rollback
        runtime_core
            .checkpoint_manager
            .rollback_to_checkpoint(retrieved_checkpoint.checkpoint_id)
            .await
            .unwrap();

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }
}
