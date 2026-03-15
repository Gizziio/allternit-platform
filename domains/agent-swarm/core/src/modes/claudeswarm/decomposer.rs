use crate::error::SwarmResult;
use crate::types::{EntityId, Priority, Subtask, Task};
use petgraph::algo::toposort;
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

/// Decomposes tasks into subtasks with dependencies
#[derive(Debug)]
pub struct TaskDecomposer;

impl TaskDecomposer {
    pub fn new() -> Self {
        Self
    }

    /// Decompose a task into subtasks
    pub async fn decompose(&self, task: &Task) -> SwarmResult<Vec<Subtask>> {
        // Analyze task description to identify components
        let components = self.identify_components(&task.description);
        
        let mut subtasks = Vec::new();
        let mut prev_subtask_id: Option<EntityId> = None;

        for (i, component) in components.iter().enumerate() {
            let mut subtask = Subtask::new(
                task.id(),
                format!("{} - Step {}", component, i + 1),
            );

            // Set priority based on task classification
            subtask.priority = match task.classification.complexity {
                crate::types::Complexity::Trivial | crate::types::Complexity::Low => Priority::P3,
                crate::types::Complexity::Medium => Priority::P2,
                _ => Priority::P1,
            };

            // Add dependency on previous subtask for sequential execution
            if let Some(prev_id) = prev_subtask_id {
                subtask.dependencies.push(prev_id);
            }

            prev_subtask_id = Some(subtask.id());
            subtasks.push(subtask);
        }

        // If no components identified, create a single subtask
        if subtasks.is_empty() {
            subtasks.push(Subtask::new(task.id(), task.description.clone()));
        }

        Ok(subtasks)
    }

    /// Identify components from task description
    fn identify_components(&self, description: &str) -> Vec<String> {
        let mut components = Vec::new();
        let desc_lower = description.to_lowercase();

        // Check for common development patterns
        if desc_lower.contains("implement") || desc_lower.contains("create") {
            components.push("Implementation".to_string());
        }
        if desc_lower.contains("test") {
            components.push("Testing".to_string());
        }
        if desc_lower.contains("refactor") {
            components.push("Refactoring".to_string());
        }
        if desc_lower.contains("review") {
            components.push("Review".to_string());
        }
        if desc_lower.contains("document") {
            components.push("Documentation".to_string());
        }

        // If still empty, split by sentences
        if components.is_empty() {
            components = description
                .split(|c| c == '.' || c == ';')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }

        components
    }

    /// Perform topological sort on subtasks
    pub fn topological_sort(&self, subtasks: &[Subtask]) -> SwarmResult<Vec<Vec<EntityId>>> {
        let mut graph: DiGraph<EntityId, ()> = DiGraph::new();
        let mut node_map: HashMap<EntityId, NodeIndex> = HashMap::new();

        // Add all nodes
        for subtask in subtasks {
            let node = graph.add_node(subtask.id());
            node_map.insert(subtask.id(), node);
        }

        // Add edges for dependencies
        for subtask in subtasks {
            for dep_id in &subtask.dependencies {
                if let (Some(&from), Some(&to)) = 
                    (node_map.get(dep_id), node_map.get(&subtask.id())) {
                    graph.add_edge(from, to, ());
                }
            }
        }

        // Perform topological sort
        let sorted = toposort(&graph, None)
            .map_err(|_| crate::error::SwarmError::Task(
                crate::error::TaskError::CircularDependency
            ))?;

        // Group into waves (parallelizable)
        let mut waves: Vec<Vec<EntityId>> = Vec::new();
        let mut completed: Vec<EntityId> = Vec::new();

        for node in sorted {
            let subtask_id = graph[node];
            
            // Find which wave this should go in
            let wave_index = subtasks
                .iter()
                .find(|s| s.id() == subtask_id)
                .map(|s| {
                    s.dependencies
                        .iter()
                        .filter_map(|dep| {
                            waves.iter().position(|w| w.contains(dep))
                        })
                        .max()
                        .map(|max_idx| max_idx + 1)
                        .unwrap_or(0)
                })
                .unwrap_or(0);

            while waves.len() <= wave_index {
                waves.push(Vec::new());
            }
            waves[wave_index].push(subtask_id);
            completed.push(subtask_id);
        }

        Ok(waves.into_iter().filter(|w| !w.is_empty()).collect())
    }
}

impl Default for TaskDecomposer {
    fn default() -> Self {
        Self::new()
    }
}
