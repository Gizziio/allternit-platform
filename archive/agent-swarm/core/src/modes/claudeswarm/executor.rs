use crate::error::{SwarmError, SwarmResult};
use crate::modes::claudeswarm::file_lock::FileLockManager;
use crate::types::{
    Cost, EntityId, ExecutionResult, Metadata, Status, Subtask,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

/// Executes subtasks in parallel waves
#[derive(Debug, Clone)]
pub struct ParallelExecutor {
    max_concurrent: usize,
    file_locks: Arc<RwLock<FileLockManager>>,
}

impl ParallelExecutor {
    pub fn new(max_concurrent: usize, file_locks: Arc<RwLock<FileLockManager>>) -> Self {
        Self {
            max_concurrent,
            file_locks,
        }
    }

    /// Execute subtasks in dependency-ordered waves
    pub async fn execute_waves(
        &self,
        subtasks: Vec<Subtask>,
    ) -> SwarmResult<Vec<ExecutionResult>> {
        // Build dependency graph and get waves
        let decomposer = super::decomposer::TaskDecomposer::new();
        let waves = decomposer.topological_sort(&subtasks)?;

        let mut results = Vec::new();
        let mut completed_ids: Vec<EntityId> = Vec::new();

        for (wave_idx, wave) in waves.iter().enumerate() {
            info!("Executing wave {} with {} subtasks", wave_idx + 1, wave.len());

            // Execute subtasks in this wave in parallel
            let wave_results = self.execute_wave(wave, &subtasks).await?;
            
            for result in wave_results {
                completed_ids.push(result.task_id);
                results.push(result);
            }
        }

        Ok(results)
    }

    /// Execute a wave of subtasks in parallel
    async fn execute_wave(
        &self,
        wave: &[EntityId],
        all_subtasks: &[Subtask],
    ) -> SwarmResult<Vec<ExecutionResult>> {
        let mut handles = Vec::new();

        for subtask_id in wave {
            if let Some(subtask) = all_subtasks.iter().find(|s| s.id() == *subtask_id) {
                let subtask = subtask.clone();
                let file_locks = self.file_locks.clone();

                let handle = tokio::spawn(async move {
                    execute_subtask(subtask, file_locks).await
                });

                handles.push(handle);
            }
        }

        // Collect results
        let mut results = Vec::new();
        for handle in handles {
            match handle.await {
                Ok(result) => results.push(result?),
                Err(e) => {
                    error!("Task join error: {}", e);
                    return Err(SwarmError::Unknown(format!("Task join failed: {}", e)));
                }
            }
        }

        Ok(results)
    }
}

/// Execute a single subtask
async fn execute_subtask(
    subtask: Subtask,
    _file_locks: Arc<RwLock<FileLockManager>>,
) -> SwarmResult<ExecutionResult> {
    info!("Executing subtask: {}", subtask.description);

    // Simulate execution time
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Simulate execution (would be actual agent execution in production)
    let success = rand::random::<f64>() > 0.1; // 90% success rate

    if success {
        Ok(ExecutionResult {
            metadata: Metadata::new(),
            task_id: subtask.id(),
            status: Status::Completed,
            output: crate::types::ExecutionOutput::Success(format!(
                "Completed: {}",
                subtask.description
            )),
            cost: Cost {
                input_tokens: 1000,
                output_tokens: 500,
                estimated_usd: 0.05,
            },
            duration_secs: 1.0,
            timestamp: chrono::Utc::now(),
        })
    } else {
        Ok(ExecutionResult {
            metadata: Metadata::new(),
            task_id: subtask.id(),
            status: Status::Failed,
            output: crate::types::ExecutionOutput::Failure(format!(
                "Failed: {}",
                subtask.description
            )),
            cost: Cost {
                input_tokens: 500,
                output_tokens: 200,
                estimated_usd: 0.02,
            },
            duration_secs: 0.5,
            timestamp: chrono::Utc::now(),
        })
    }
}
