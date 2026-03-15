use crate::controller::SwarmModeImplementation;
use crate::error::{SwarmError, SwarmResult};
use crate::knowledge::KnowledgeStore;
use crate::types::{
    Cost, EntityId, ExecutionOutput, ExecutionResult, Metadata, ModeConfig, Status, Subtask,
    SwarmMode, Task,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

pub mod decomposer;
pub mod executor;
pub mod file_lock;
pub mod quality_gate;

pub use decomposer::TaskDecomposer;
pub use executor::ParallelExecutor;
pub use file_lock::FileLockManager;
pub use quality_gate::QualityGate;

/// Claude Swarm Mode - Parallel execution with dependency graphs
#[derive(Debug, Clone)]
pub struct ClaudeSwarmMode {
    config: ModeConfig,
    knowledge: Arc<dyn KnowledgeStore>,
    file_locks: Arc<RwLock<FileLockManager>>,
}

impl ClaudeSwarmMode {
    pub fn new(
        config: ModeConfig,
        knowledge: Arc<dyn KnowledgeStore>,
    ) -> SwarmResult<Self> {
        Ok(Self {
            config,
            knowledge,
            file_locks: Arc::new(RwLock::new(FileLockManager::new())),
        })
    }

    /// Execute task using parallel agent swarm
    pub async fn execute_parallel(&self, task: Task) -> SwarmResult<ExecutionResult> {
        info!("Executing task {} with Claude Swarm", task.id());

        // Step 1: Decompose task into subtasks
        let decomposer = TaskDecomposer::new();
        let subtasks = decomposer.decompose(&task).await?;

        info!("Task {} decomposed into {} subtasks", task.id(), subtasks.len());

        // Step 2: Execute subtasks in parallel waves
        let executor = ParallelExecutor::new(
            self.config.max_agents,
            self.file_locks.clone(),
        );

        let execution_results = executor.execute_waves(subtasks).await?;

        // Step 3: Quality gate (if enabled)
        let quality_enabled = match self.config.options {
            crate::types::ModeOptions::ClaudeSwarm { enable_quality_gate, .. } => {
                enable_quality_gate
            }
            _ => true,
        };

        if quality_enabled {
            let gate = QualityGate::new("claude-opus".to_string());
            let gate_result = gate.review(&execution_results).await?;

            if !gate_result.passed {
                return Ok(ExecutionResult {
                    metadata: Metadata::new(),
                    task_id: task.id(),
                    status: Status::Failed,
                    output: ExecutionOutput::Failure(format!(
                        "Quality gate failed: {}",
                        gate_result.verdict.summary
                    )),
                    cost: execution_results.iter().map(|r| r.cost).fold(Cost::new(), |mut acc, c| {
                        acc.add(&c);
                        acc
                    }),
                    duration_secs: 0.0,
                    timestamp: chrono::Utc::now(),
                });
            }
        }

        // Aggregate results
        let total_cost = execution_results.iter().map(|r| r.cost).fold(Cost::new(), |mut acc, c| {
            acc.add(&c);
            acc
        });

        let all_success = execution_results.iter().all(|r| r.is_success());

        Ok(ExecutionResult {
            metadata: Metadata::new(),
            task_id: task.id(),
            status: if all_success { Status::Completed } else { Status::Failed },
            output: ExecutionOutput::Success(format!(
                "Executed {} subtasks",
                execution_results.len()
            )),
            cost: total_cost,
            duration_secs: 0.0,
            timestamp: chrono::Utc::now(),
        })
    }
}

#[async_trait]
impl SwarmModeImplementation for ClaudeSwarmMode {
    async fn execute(&self, task: Task) -> SwarmResult<ExecutionResult> {
        self.execute_parallel(task).await
    }

    fn mode(&self) -> SwarmMode {
        SwarmMode::ClaudeSwarm
    }

    async fn shutdown(&self) -> SwarmResult<()> {
        info!("ClaudeSwarmMode shutdown");
        Ok(())
    }
}
