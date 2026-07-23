use crate::error::SwarmResult;
use crate::modes::closedloop::plan::WorkItem;
use crate::types::{Cost, EntityId, ExecutionResult, ExecutionOutput, Metadata, Status, Task};
use tracing::info;

/// Work Phase - Execute with independent agents
#[derive(Debug, Clone)]
pub struct WorkPhase {
    max_agents: usize,
}

impl WorkPhase {
    pub fn new(max_agents: usize) -> Self {
        Self { max_agents }
    }

    /// Execute work items
    pub async fn execute(
        &self,
        task: &Task,
        work_items: &[WorkItem],
    ) -> SwarmResult<ExecutionResult> {
        info!("Executing {} work items", work_items.len());

        let mut total_cost = Cost::default();
        let mut all_success = true;

        // Execute each work item
        for work_item in work_items {
            info!("Processing: {}", work_item.title);

            // Simulate execution
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

            // Accumulate cost
            total_cost.add(&Cost {
                input_tokens: 500 * work_item.estimated_hours as u64,
                output_tokens: 300 * work_item.estimated_hours as u64,
                estimated_usd: 0.05 * work_item.estimated_hours as f64,
            });
        }

        Ok(ExecutionResult {
            metadata: Metadata::new(),
            task_id: task.id(),
            status: if all_success { Status::Completed } else { Status::Failed },
            output: ExecutionOutput::Success(format!(
                "Completed {} work items",
                work_items.len()
            )),
            cost: total_cost,
            duration_secs: 0.0,
            timestamp: chrono::Utc::now(),
        })
    }
}
