use crate::error::SwarmResult;
use crate::types::{ExecutionResult, Priority, Task, TriageItem, TriageResult};

/// Review Phase - Multi-agent triage as P1/P2/P3
#[derive(Debug)]
pub struct ReviewPhase;

impl ReviewPhase {
    pub fn new() -> Self {
        Self
    }

    /// Triage execution results
    pub async fn triage(
        &self,
        _task: &Task,
        execution_result: &ExecutionResult,
    ) -> SwarmResult<TriageResult> {
        let mut triage = TriageResult::new(execution_result.task_id);

        // Simulate triage based on execution result
        if !execution_result.is_success() {
            // P1: Critical - execution failed
            triage.add_item(
                TriageItem::p1("Execution failed - requires immediate attention")
                    .with_category("Execution".to_string()),
            );
        }

        // Simulate finding some issues
        if rand::random::<f64>() < 0.3 {
            triage.add_item(
                TriageItem::p2("Code could be more efficient")
                    .with_category("Performance".to_string()),
            );
        }

        if rand::random::<f64>() < 0.5 {
            triage.add_item(
                TriageItem::p3("Documentation could be improved")
                    .with_category("Documentation".to_string()),
            );
        }

        Ok(triage)
    }
}

impl Default for ReviewPhase {
    fn default() -> Self {
        Self::new()
    }
}

trait TriageItemExt {
    fn with_category(self, category: String) -> Self;
}

impl TriageItemExt for TriageItem {
    fn with_category(mut self, category: String) -> Self {
        self.category = category;
        self
    }
}
