//! DAG Checkpointing and Recovery
//!
//! Provides checkpoint creation, resume, and retry capabilities for DAG execution.
//! Integrates with Memory Kernel for persistence.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn, error};

use crate::{Graph, GraphNode, TaskState, WorkItemHeader};

/// Checkpoint identifier
pub type CheckpointId = String;

/// DAG checkpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagCheckpoint {
    pub checkpoint_id: CheckpointId,
    pub dag_id: String,
    pub wih_id: String,
    pub created_at: DateTime<Utc>,
    /// DAG state at checkpoint
    pub dag_state: DagState,
    /// Node execution states
    pub node_states: HashMap<String, NodeCheckpointState>,
    /// Partial results from completed nodes
    pub partial_results: HashMap<String, NodeResult>,
    /// Execution context
    pub context: CheckpointContext,
    /// Metadata
    pub metadata: CheckpointMetadata,
}

/// DAG state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagState {
    pub status: DagExecutionStatus,
    pub current_node_id: Option<String>,
    pub completed_nodes: Vec<String>,
    pub failed_nodes: Vec<String>,
    pub pending_nodes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DagExecutionStatus {
    Running,
    Paused,
    Failed,
    Completed,
}

/// Node checkpoint state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeCheckpointState {
    pub node_id: String,
    pub status: TaskState,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub attempt_count: u32,
    pub last_error: Option<String>,
}

/// Node execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeResult {
    pub node_id: String,
    pub success: bool,
    pub output: Option<serde_json::Value>,
    pub artifacts: Vec<String>,
    pub execution_time_ms: u64,
}

/// Checkpoint context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointContext {
    pub execution_id: String,
    pub retry_count: u32,
    pub max_retries: u32,
    pub environment: HashMap<String, String>,
}

/// Checkpoint metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointMetadata {
    pub created_by: String,
    pub reason: CheckpointReason,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CheckpointReason {
    Scheduled,
    Manual,
    PreFailure,
    PostFailure,
    PreMigration,
}

/// Checkpoint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointConfig {
    /// Auto-checkpoint interval (seconds)
    pub auto_checkpoint_interval_secs: Option<u64>,
    /// Checkpoint on node completion
    pub checkpoint_on_node_complete: bool,
    /// Maximum checkpoints to retain
    pub max_checkpoints: usize,
    /// Retention period (days)
    pub retention_days: i64,
}

impl Default for CheckpointConfig {
    fn default() -> Self {
        Self {
            auto_checkpoint_interval_secs: Some(300), // 5 minutes
            checkpoint_on_node_complete: true,
            max_checkpoints: 10,
            retention_days: 7,
        }
    }
}

/// Checkpoint manager
pub struct CheckpointManager {
    config: CheckpointConfig,
    checkpoints: HashMap<CheckpointId, DagCheckpoint>,
    dag_checkpoints: HashMap<String, Vec<CheckpointId>>, // dag_id -> checkpoint_ids
}

impl CheckpointManager {
    /// Create a new checkpoint manager
    pub fn new(config: CheckpointConfig) -> Self {
        Self {
            config,
            checkpoints: HashMap::new(),
            dag_checkpoints: HashMap::new(),
        }
    }

    /// Create a checkpoint
    pub fn create_checkpoint(
        &mut self,
        dag_id: impl Into<String>,
        wih_id: impl Into<String>,
        dag: &Graph,
        node_states: HashMap<String, NodeCheckpointState>,
        partial_results: HashMap<String, NodeResult>,
        context: CheckpointContext,
        metadata: CheckpointMetadata,
    ) -> DagCheckpoint {
        let dag_id = dag_id.into();
        let wih_id = wih_id.into();
        let checkpoint_id = format!("cp_{}_{}", dag_id.replace("-", "_"), Utc::now().timestamp_millis());

        let dag_state = DagState {
            status: DagExecutionStatus::Paused,
            current_node_id: Self::find_current_node(&node_states),
            completed_nodes: Self::find_nodes_by_status(&node_states, TaskState::Complete),
            failed_nodes: Self::find_nodes_by_status(&node_states, TaskState::Failed),
            pending_nodes: Self::find_nodes_by_status(&node_states, TaskState::Planned),
        };

        let checkpoint = DagCheckpoint {
            checkpoint_id: checkpoint_id.clone(),
            dag_id: dag_id.clone(),
            wih_id,
            created_at: Utc::now(),
            dag_state,
            node_states,
            partial_results,
            context,
            metadata,
        };

        let cp_id_for_log = checkpoint_id.clone();
        
        // Store checkpoint
        self.checkpoints.insert(checkpoint_id.clone(), checkpoint.clone());
        
        // Index by DAG
        self.dag_checkpoints
            .entry(dag_id)
            .or_insert_with(Vec::new)
            .push(checkpoint_id);

        // Cleanup old checkpoints
        self.cleanup_old_checkpoints(&checkpoint.dag_id);

        info!("Created checkpoint {} for DAG {}", cp_id_for_log, checkpoint.dag_id);
        
        checkpoint
    }

    /// Find current node (first in-progress or pending)
    fn find_current_node(node_states: &HashMap<String, NodeCheckpointState>) -> Option<String> {
        node_states
            .values()
            .find(|ns| ns.status == TaskState::Running)
            .map(|ns| ns.node_id.clone())
            .or_else(|| {
                node_states
                    .values()
                    .find(|ns| ns.status == TaskState::Planned)
                    .map(|ns| ns.node_id.clone())
            })
    }

    /// Find nodes by status
    fn find_nodes_by_status(
        node_states: &HashMap<String, NodeCheckpointState>,
        status: TaskState,
    ) -> Vec<String> {
        node_states
            .values()
            .filter(|ns| ns.status == status)
            .map(|ns| ns.node_id.clone())
            .collect()
    }

    /// Get checkpoint by ID
    pub fn get_checkpoint(&self, checkpoint_id: &str) -> Option<&DagCheckpoint> {
        self.checkpoints.get(checkpoint_id)
    }

    /// Get latest checkpoint for DAG
    pub fn get_latest_checkpoint(&self, dag_id: &str) -> Option<&DagCheckpoint> {
        self.dag_checkpoints
            .get(dag_id)
            .and_then(|ids| ids.last())
            .and_then(|id| self.checkpoints.get(id))
    }

    /// List checkpoints for DAG
    pub fn list_checkpoints(&self, dag_id: &str) -> Vec<&DagCheckpoint> {
        self.dag_checkpoints
            .get(dag_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| self.checkpoints.get(id))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Resume from checkpoint
    pub fn resume_from_checkpoint(&self, checkpoint_id: &str) -> Option<ResumePlan> {
        let checkpoint = self.checkpoints.get(checkpoint_id)?;

        info!("Resuming DAG {} from checkpoint {}", checkpoint.dag_id, checkpoint_id);

        // Determine which nodes need to be re-executed
        let nodes_to_retry: Vec<String> = checkpoint
            .node_states
            .values()
            .filter(|ns| {
                ns.status == TaskState::Failed
                    || (ns.status == TaskState::Running && ns.attempt_count > 0)
            })
            .map(|ns| ns.node_id.clone())
            .collect();

        let nodes_to_skip: Vec<String> = checkpoint
            .node_states
            .values()
            .filter(|ns| {
                ns.status == TaskState::Complete
                    && !nodes_to_retry.contains(&ns.node_id)
            })
            .map(|ns| ns.node_id.clone())
            .collect();

        Some(ResumePlan {
            checkpoint_id: checkpoint_id.to_string(),
            dag_id: checkpoint.dag_id.clone(),
            wih_id: checkpoint.wih_id.clone(),
            resume_from_node: checkpoint.dag_state.current_node_id.clone(),
            nodes_to_retry,
            nodes_to_skip,
            partial_results: checkpoint.partial_results.clone(),
            context: checkpoint.context.clone(),
        })
    }

    /// Retry failed nodes from checkpoint
    pub fn retry_from_checkpoint(&self, checkpoint_id: &str) -> Option<RetryPlan> {
        let checkpoint = self.checkpoints.get(checkpoint_id)?;

        let failed_nodes: Vec<String> = checkpoint
            .dag_state
            .failed_nodes
            .clone();

        if failed_nodes.is_empty() {
            info!("No failed nodes to retry in checkpoint {}", checkpoint_id);
            return None;
        }

        info!("Retrying {} failed nodes from checkpoint {}", failed_nodes.len(), checkpoint_id);

        Some(RetryPlan {
            checkpoint_id: checkpoint_id.to_string(),
            dag_id: checkpoint.dag_id.clone(),
            failed_nodes,
            partial_results: checkpoint.partial_results.clone(),
            retry_count: checkpoint.context.retry_count + 1,
            max_retries: checkpoint.context.max_retries,
        })
    }

    /// Cleanup old checkpoints
    fn cleanup_old_checkpoints(&mut self, dag_id: &str) {
        if let Some(checkpoint_ids) = self.dag_checkpoints.get(dag_id) {
            if checkpoint_ids.len() > self.config.max_checkpoints {
                let to_remove: Vec<_> = checkpoint_ids
                    .iter()
                    .take(checkpoint_ids.len() - self.config.max_checkpoints)
                    .cloned()
                    .collect();

                for id in to_remove {
                    self.checkpoints.remove(&id);
                    if let Some(ids) = self.dag_checkpoints.get_mut(dag_id) {
                        ids.retain(|i| i != &id);
                    }
                }
            }
        }

        // Remove expired checkpoints
        let cutoff = Utc::now() - chrono::Duration::days(self.config.retention_days);
        let to_remove: Vec<_> = self
            .checkpoints
            .iter()
            .filter(|(_, cp)| cp.created_at < cutoff)
            .map(|(id, _)| id.clone())
            .collect();

        for id in to_remove {
            if let Some(cp) = self.checkpoints.remove(&id) {
                if let Some(ids) = self.dag_checkpoints.get_mut(&cp.dag_id) {
                    ids.retain(|i| i != &id);
                }
            }
        }
    }

    /// Create postmortem report
    pub fn create_postmortem(&self, checkpoint_id: &str) -> Option<PostmortemReport> {
        let checkpoint = self.checkpoints.get(checkpoint_id)?;

        let execution_trace: Vec<ExecutionTraceEntry> = checkpoint
            .node_states
            .values()
            .map(|ns| ExecutionTraceEntry {
                node_id: ns.node_id.clone(),
                status: ns.status.clone(),
                started_at: ns.started_at,
                completed_at: ns.completed_at,
                attempt_count: ns.attempt_count,
                error: ns.last_error.clone(),
            })
            .collect();

        Some(PostmortemReport {
            checkpoint_id: checkpoint_id.to_string(),
            dag_id: checkpoint.dag_id.clone(),
            wih_id: checkpoint.wih_id.clone(),
            created_at: checkpoint.created_at,
            final_status: checkpoint.dag_state.status.clone(),
            execution_trace,
            summary: PostmortemSummary {
                total_nodes: checkpoint.node_states.len(),
                completed_nodes: checkpoint.dag_state.completed_nodes.len(),
                failed_nodes: checkpoint.dag_state.failed_nodes.len(),
                pending_nodes: checkpoint.dag_state.pending_nodes.len(),
            },
        })
    }
}

/// Resume plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumePlan {
    pub checkpoint_id: String,
    pub dag_id: String,
    pub wih_id: String,
    pub resume_from_node: Option<String>,
    pub nodes_to_retry: Vec<String>,
    pub nodes_to_skip: Vec<String>,
    pub partial_results: HashMap<String, NodeResult>,
    pub context: CheckpointContext,
}

/// Retry plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPlan {
    pub checkpoint_id: String,
    pub dag_id: String,
    pub failed_nodes: Vec<String>,
    pub partial_results: HashMap<String, NodeResult>,
    pub retry_count: u32,
    pub max_retries: u32,
}

/// Execution trace entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTraceEntry {
    pub node_id: String,
    pub status: TaskState,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub attempt_count: u32,
    pub error: Option<String>,
}

/// Postmortem report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmortemReport {
    pub checkpoint_id: String,
    pub dag_id: String,
    pub wih_id: String,
    pub created_at: DateTime<Utc>,
    pub final_status: DagExecutionStatus,
    pub execution_trace: Vec<ExecutionTraceEntry>,
    pub summary: PostmortemSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmortemSummary {
    pub total_nodes: usize,
    pub completed_nodes: usize,
    pub failed_nodes: usize,
    pub pending_nodes: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_node_state(node_id: &str, status: TaskState) -> NodeCheckpointState {
        NodeCheckpointState {
            node_id: node_id.to_string(),
            status,
            started_at: Some(Utc::now()),
            completed_at: None,
            attempt_count: 1,
            last_error: None,
        }
    }

    #[test]
    fn test_checkpoint_creation() {
        let config = CheckpointConfig::default();
        let mut manager = CheckpointManager::new(config);

        let mut node_states = HashMap::new();
        node_states.insert("node1".to_string(), create_test_node_state("node1", TaskState::Complete));
        node_states.insert("node2".to_string(), create_test_node_state("node2", TaskState::Failed));

        let checkpoint = manager.create_checkpoint(
            "dag-1",
            "wih-1",
            &Graph::default(),
            node_states,
            HashMap::new(),
            CheckpointContext {
                execution_id: "exec-1".to_string(),
                retry_count: 0,
                max_retries: 3,
                environment: HashMap::new(),
            },
            CheckpointMetadata {
                created_by: "test".to_string(),
                reason: CheckpointReason::Manual,
                tags: vec!["test".to_string()],
            },
        );

        assert!(checkpoint.checkpoint_id.starts_with("cp_"));
        assert_eq!(checkpoint.dag_state.completed_nodes.len(), 1);
        assert_eq!(checkpoint.dag_state.failed_nodes.len(), 1);
    }

    #[test]
    fn test_resume_plan() {
        let config = CheckpointConfig::default();
        let mut manager = CheckpointManager::new(config);

        let mut node_states = HashMap::new();
        node_states.insert("node1".to_string(), create_test_node_state("node1", TaskState::Complete));
        node_states.insert("node2".to_string(), create_test_node_state("node2", TaskState::Failed));

        let checkpoint = manager.create_checkpoint(
            "dag-1",
            "wih-1",
            &Graph::default(),
            node_states,
            HashMap::new(),
            CheckpointContext {
                execution_id: "exec-1".to_string(),
                retry_count: 0,
                max_retries: 3,
                environment: HashMap::new(),
            },
            CheckpointMetadata {
                created_by: "test".to_string(),
                reason: CheckpointReason::Manual,
                tags: vec![],
            },
        );

        let plan = manager.resume_from_checkpoint(&checkpoint.checkpoint_id).unwrap();
        assert_eq!(plan.nodes_to_retry.len(), 1);
        assert_eq!(plan.nodes_to_skip.len(), 1);
    }

    #[test]
    fn test_postmortem() {
        let config = CheckpointConfig::default();
        let mut manager = CheckpointManager::new(config);

        let mut node_states = HashMap::new();
        node_states.insert("node1".to_string(), create_test_node_state("node1", TaskState::Complete));

        let checkpoint = manager.create_checkpoint(
            "dag-1",
            "wih-1",
            &Graph::default(),
            node_states,
            HashMap::new(),
            CheckpointContext {
                execution_id: "exec-1".to_string(),
                retry_count: 0,
                max_retries: 3,
                environment: HashMap::new(),
            },
            CheckpointMetadata {
                created_by: "test".to_string(),
                reason: CheckpointReason::Manual,
                tags: vec![],
            },
        );

        let postmortem = manager.create_postmortem(&checkpoint.checkpoint_id).unwrap();
        assert_eq!(postmortem.summary.total_nodes, 1);
        assert_eq!(postmortem.summary.completed_nodes, 1);
    }
}
