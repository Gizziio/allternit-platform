use crate::error::SwarmResult;
use crate::modes::closedloop::brainstorm::Approach;
use crate::types::{EntityId, Subtask, Task};

/// Plan Phase - Map tasks, dependencies, and acceptance criteria
#[derive(Debug)]
pub struct PlanPhase;

impl PlanPhase {
    pub fn new() -> Self {
        Self
    }

    /// Create a plan with work items
    pub async fn create_plan(
        &self,
        task: &Task,
        approaches: &[Approach],
    ) -> SwarmResult<Vec<WorkItem>> {
        let mut work_items = Vec::new();

        // Create work items based on selected approach (first one for now)
        let selected_approach = approaches.first();

        // Work Item 1: Setup and preparation
        work_items.push(WorkItem {
            id: EntityId::new(),
            title: "Setup and Preparation".to_string(),
            description: "Prepare codebase, dependencies, and structure".to_string(),
            acceptance_criteria: vec![
                "All dependencies installed".to_string(),
                "Project structure ready".to_string(),
            ],
            estimated_hours: 1,
            dependencies: vec![],
        });

        // Work Item 2: Core implementation
        work_items.push(WorkItem {
            id: EntityId::new(),
            title: "Core Implementation".to_string(),
            description: format!(
                "Implement core functionality for: {}",
                task.description
            ),
            acceptance_criteria: vec![
                "Main functionality working".to_string(),
                "Unit tests passing".to_string(),
            ],
            estimated_hours: selected_approach.map(|a| a.estimated_effort_hours).unwrap_or(3),
            dependencies: vec![work_items[0].id],
        });

        // Work Item 3: Testing and validation
        work_items.push(WorkItem {
            id: EntityId::new(),
            title: "Testing and Validation".to_string(),
            description: "Comprehensive testing of implementation".to_string(),
            acceptance_criteria: vec![
                "All tests passing".to_string(),
                "Code coverage > 80%".to_string(),
            ],
            estimated_hours: 2,
            dependencies: vec![work_items[1].id],
        });

        // Work Item 4: Documentation
        work_items.push(WorkItem {
            id: EntityId::new(),
            title: "Documentation".to_string(),
            description: "Write documentation and update README".to_string(),
            acceptance_criteria: vec![
                "API documentation complete".to_string(),
                "README updated".to_string(),
            ],
            estimated_hours: 1,
            dependencies: vec![work_items[1].id],
        });

        Ok(work_items)
    }
}

impl Default for PlanPhase {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct WorkItem {
    pub id: EntityId,
    pub title: String,
    pub description: String,
    pub acceptance_criteria: Vec<String>,
    pub estimated_hours: u32,
    pub dependencies: Vec<EntityId>,
}
