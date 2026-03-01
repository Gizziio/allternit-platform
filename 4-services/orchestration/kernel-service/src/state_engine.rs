use crate::intent_graph::{IntentGraphKernel, NodeType};
use crate::journal_ledger::JournalLedger;
use crate::types::Suggestion;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug)]
pub struct StateEngine {}

impl StateEngine {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn check_deltas(
        &self,
        _ledger: &Arc<JournalLedger>,
        graph: &Arc<RwLock<IntentGraphKernel>>,
    ) -> Vec<Suggestion> {
        let mut suggestions = Vec::new();
        let graph_read = graph.read().await;

        // Simple Heuristic: If there is a Goal, suggest a task.
        for (id, node) in &graph_read.nodes {
            if let NodeType::Goal = node.node_type {
                suggestions.push(Suggestion {
                    id: format!("sug_{}", Uuid::new_v4().to_string().get(0..8).unwrap()),
                    title: format!("Progress on {}", node.title),
                    description: "This goal has been idle. Consider breaking it down.".to_string(),
                    action_payload: serde_json::json!({ "goal_id": id }),
                    priority: "normal".to_string(),
                });
            }
        }

        suggestions
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intent_graph::IntentGraphKernel;
    use crate::journal_ledger::JournalLedger;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[tokio::test]
    async fn test_state_engine_goal_detection() {
        let engine = StateEngine::new();
        let ledger = Arc::new(JournalLedger::new());
        let graph = Arc::new(RwLock::new(IntentGraphKernel::new()));

        // Initially no suggestions
        let suggestions = engine.check_deltas(&ledger, &graph).await;
        assert_eq!(suggestions.len(), 0);

        // Add a goal
        {
            let mut g = graph.write().await;
            g.add_goal("Build Kernel".to_string(), "Implement Phase 4".to_string());
        }

        let suggestions = engine.check_deltas(&ledger, &graph).await;
        assert_eq!(suggestions.len(), 1);
        assert!(suggestions[0].title.contains("Build Kernel"));
    }
}
