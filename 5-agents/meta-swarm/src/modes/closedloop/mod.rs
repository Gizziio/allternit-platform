use crate::controller::SwarmModeImplementation;
use crate::error::SwarmResult;
use crate::knowledge::KnowledgeStore;
use crate::types::{
    Cost, EntityId, ExecutionResult, Metadata, ModeConfig, Pattern, PatternContent, PatternType,
    Priority, Status, SwarmMode, Task, TriageItem, TriageResult,
};
use async_trait::async_trait;
use std::sync::Arc;
use tracing::{info, warn};

pub mod brainstorm;
pub mod compound;
pub mod plan;
pub mod review;
pub mod work;

pub use brainstorm::BrainstormPhase;
pub use compound::CompoundPhase;
pub use plan::PlanPhase;
pub use review::ReviewPhase;
pub use work::WorkPhase;

/// ClosedLoop Mode - 5-step methodology with knowledge compounding
#[derive(Debug, Clone)]
pub struct ClosedLoopMode {
    config: ModeConfig,
    knowledge: Arc<dyn KnowledgeStore>,
}

impl ClosedLoopMode {
    pub fn new(
        config: ModeConfig,
        knowledge: Arc<dyn KnowledgeStore>,
    ) -> SwarmResult<Self> {
        Ok(Self { config, knowledge })
    }

    /// Execute full 5-step workflow
    pub async fn execute_full(&self, task: Task) -> SwarmResult<ExecutionResult> {
        info!("Starting ClosedLoop 5-step workflow for task {}", task.id());

        // Step 1: Brainstorm
        let brainstorm = BrainstormPhase::new();
        let approaches = brainstorm.generate_approaches(&task).await?;
        info!("Generated {} approaches", approaches.len());

        // Step 2: Plan
        let plan = PlanPhase::new();
        let work_items = plan.create_plan(&task, &approaches).await?;
        info!("Created plan with {} work items", work_items.len());

        // Step 3: Work
        let work = WorkPhase::new(self.config.max_agents);
        let work_result = work.execute(&task, &work_items).await?;
        info!("Work phase complete");

        // Step 4: Review
        let review = ReviewPhase::new();
        let triage = review.triage(&task, &work_result).await?;
        info!("Review complete: {} P1, {} P2, {} P3", triage.p1_count, triage.p2_count, triage.p3_count);

        // Block if P1 issues found
        if !triage.can_ship {
            return Ok(ExecutionResult {
                metadata: Metadata::new(),
                task_id: task.id(),
                status: Status::Failed,
                output: crate::types::ExecutionOutput::Failure(
                    format!("Review blocked: {} P1 issues found", triage.p1_count)
                ),
                cost: Cost::default(),
                duration_secs: 0.0,
                timestamp: chrono::Utc::now(),
            });
        }

        // Step 5: Compound
        let compound = CompoundPhase::new(self.knowledge.clone());
        compound.extract_and_store(&task, &work_result, &triage).await?;
        info!("Knowledge compounded");

        Ok(work_result)
    }

    /// Review and compound an existing execution result
    pub async fn review_and_compound(
        &self,
        task: Task,
        execution_result: ExecutionResult,
    ) -> SwarmResult<ExecutionResult> {
        // Step 4: Review
        let review = ReviewPhase::new();
        let triage = review.triage(&task, &execution_result).await?;

        // Step 5: Compound
        let compound = CompoundPhase::new(self.knowledge.clone());
        compound.extract_and_store(&task, &execution_result, &triage).await?;

        Ok(execution_result)
    }
}

#[async_trait]
impl SwarmModeImplementation for ClosedLoopMode {
    async fn execute(&self, task: Task) -> SwarmResult<ExecutionResult> {
        self.execute_full(task).await
    }

    fn mode(&self) -> SwarmMode {
        SwarmMode::ClosedLoop
    }

    async fn shutdown(&self) -> SwarmResult<()> {
        info!("ClosedLoopMode shutdown");
        Ok(())
    }
}
