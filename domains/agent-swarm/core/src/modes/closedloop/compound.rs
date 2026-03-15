use crate::error::SwarmResult;
use crate::knowledge::KnowledgeStore;
use crate::types::{
    EffectivenessMetrics, EntityId, ExecutionResult, Pattern, PatternContent, PatternType,
    Task, TriageResult,
};
use std::sync::Arc;
use tracing::info;

/// Compound Phase - Extract and store knowledge
#[derive(Debug, Clone)]
pub struct CompoundPhase {
    knowledge: Arc<dyn KnowledgeStore>,
}

impl CompoundPhase {
    pub fn new(knowledge: Arc<dyn KnowledgeStore>) -> Self {
        Self { knowledge }
    }

    /// Extract patterns and store in knowledge base
    pub async fn extract_and_store(
        &self,
        task: &Task,
        execution_result: &ExecutionResult,
        triage: &TriageResult,
    ) -> SwarmResult<()> {
        info!("Extracting knowledge from completed task");

        // Extract root cause patterns
        if !execution_result.is_success() {
            let root_cause = Pattern::new(
                format!("root_cause_{}", task.id()),
                PatternType::RootCause,
            )
            .with_description(format!(
                "Root cause pattern for failed task: {}",
                task.description
            ))
            .with_domain(format!("{:?}", task.classification.domain));

            self.knowledge.store_pattern(root_cause).await?;
        }

        // Extract fix patterns
        let fix_pattern = Pattern::new(
            format!("fix_{}", task.id()),
            PatternType::Fix,
        )
        .with_description(format!(
            "Fix pattern for: {}",
            task.description
        ));

        self.knowledge.store_pattern(fix_pattern).await?;

        // Extract prevention patterns
        if triage.p1_count > 0 {
            let prevention = Pattern::new(
                format!("prevention_{}", task.id()),
                PatternType::Prevention,
            )
            .with_description(format!(
                "Prevention pattern to avoid P1 issues like: {}",
                task.description
            ));

            self.knowledge.store_pattern(prevention).await?;
        }

        info!("Knowledge extraction complete");
        Ok(())
    }
}
