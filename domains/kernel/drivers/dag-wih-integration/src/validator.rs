//! DAG/WIH Validator
//!
//! Validates the integrity and consistency of DAG/WIH integrations.

use crate::*;
use std::collections::{HashMap, HashSet};
use tracing::{debug, warn};

/// Validator for DAG/WIH structures
pub struct DagValidator;

impl DagValidator {
    /// Create a new validator
    pub fn new() -> Self {
        Self
    }

    /// Validate a graph against WIH files
    pub fn validate(
        &self,
        graph: &Graph,
        wih_files: &HashMap<String, WorkItemHeader>,
    ) -> Result<ValidationReport, DagWihError> {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut stats = ValidationStats::default();
        
        stats.total_nodes = graph.nodes.len();
        stats.total_edges = graph.edges.len();
        
        // Build node lookup
        let node_ids: HashSet<&str> = graph.nodes.iter().map(|n| n.task_id.as_str()).collect();
        
        // Validate each node
        for node in &graph.nodes {
            // Check WIH exists
            if let Some(wih) = wih_files.get(&node.task_id) {
                stats.linked_nodes += 1;
                
                // Validate graph_id matches
                if wih.graph_id != graph.graph_id {
                    errors.push(format!(
                        "Node {} WIH graph_id mismatch: expected {}, found {}",
                        node.task_id, graph.graph_id, wih.graph_id
                    ));
                }
                
                // Validate task_id matches
                if wih.task_id != node.task_id {
                    errors.push(format!(
                        "Node {} WIH task_id mismatch: expected {}, found {}",
                        node.task_id, node.task_id, wih.task_id
                    ));
                }
                
                // Validate blocked_by references exist
                for dep_id in &node.blocked_by {
                    if !node_ids.contains(dep_id.as_str()) && !wih_files.contains_key(dep_id) {
                        warnings.push(format!(
                            "Node {} has external dependency: {}",
                            node.task_id, dep_id
                        ));
                    }
                }
            } else {
                stats.orphan_nodes += 1;
                warnings.push(format!(
                    "Node {} has no associated WIH file at {}",
                    node.task_id, node.wih_path
                ));
            }
            
            // Validate wih_path format
            if !node.wih_path.starts_with("/.allternit/wih/") || !node.wih_path.ends_with(".json") {
                errors.push(format!(
                    "Node {} has invalid wih_path: {}",
                    node.task_id, node.wih_path
                ));
            }
        }
        
        // Validate edges
        for edge in &graph.edges {
            if !node_ids.contains(edge.from.as_str()) {
                errors.push(format!("Edge from non-existent node: {}", edge.from));
            }
            if !node_ids.contains(edge.to.as_str()) {
                errors.push(format!("Edge to non-existent node: {}", edge.to));
            }
        }
        
        // Check for cycles
        if let Some(cycle) = self.detect_cycles(graph)? {
            stats.circular_dependencies = 1;
            errors.push(format!("Cycle detected: {}", cycle.join(" -> ")));
        }
        
        // Check for duplicate task IDs
        let mut seen_ids = HashSet::new();
        for node in &graph.nodes {
            if !seen_ids.insert(&node.task_id) {
                errors.push(format!("Duplicate task_id: {}", node.task_id));
            }
        }
        
        // Check subgraph references
        for subgraph in &graph.subgraphs {
            if subgraph.graph_id == graph.graph_id {
                errors.push(format!(
                    "Graph {} references itself as a subgraph",
                    graph.graph_id
                ));
            }
        }
        
        let valid = errors.is_empty();
        
        if valid {
            debug!("Graph {} validation passed", graph.graph_id);
        } else {
            warn!("Graph {} validation failed with {} errors", graph.graph_id, errors.len());
        }
        
        Ok(ValidationReport {
            graph_id: graph.graph_id.clone(),
            valid,
            errors,
            warnings,
            stats,
        })
    }

    /// Detect cycles in the graph using DFS
    pub fn detect_cycles(&self, graph: &Graph) -> Result<Option<Vec<String>>, DagWihError> {
        let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();
        
        // Build adjacency list from edges
        for edge in &graph.edges {
            adjacency.entry(&edge.from).or_default().push(&edge.to);
        }
        
        // Also add blocked_by as edges
        for node in &graph.nodes {
            for dep in &node.blocked_by {
                adjacency.entry(dep.as_str()).or_default().push(&node.task_id);
            }
        }
        
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();
        let mut path = Vec::new();
        
        for node in &graph.nodes {
            if !visited.contains(node.task_id.as_str()) {
                if let Some(cycle) = self.dfs_detect_cycle(
                    &node.task_id,
                    &adjacency,
                    &mut visited,
                    &mut rec_stack,
                    &mut path,
                ) {
                    return Ok(Some(cycle));
                }
            }
        }
        
        Ok(None)
    }

    fn dfs_detect_cycle<'a>(
        &self,
        node: &'a str,
        adjacency: &HashMap<&str, Vec<&'a str>>,
        visited: &mut HashSet<&'a str>,
        rec_stack: &mut HashSet<&'a str>,
        path: &mut Vec<String>,
    ) -> Option<Vec<String>> {
        visited.insert(node);
        rec_stack.insert(node);
        path.push(node.to_string());
        
        if let Some(neighbors) = adjacency.get(node) {
            for &neighbor in neighbors {
                if !visited.contains(neighbor) {
                    if let Some(cycle) = self.dfs_detect_cycle(
                        neighbor,
                        adjacency,
                        visited,
                        rec_stack,
                        path,
                    ) {
                        return Some(cycle);
                    }
                } else if rec_stack.contains(neighbor) {
                    // Found a cycle - construct the cycle path
                    let cycle_start = path.iter().position(|n| n == neighbor).unwrap();
                    let mut cycle = path[cycle_start..].to_vec();
                    cycle.push(neighbor.to_string());
                    return Some(cycle);
                }
            }
        }
        
        path.pop();
        rec_stack.remove(node);
        None
    }

    /// Validate that a task can transition to a new state
    pub fn validate_state_transition(
        &self,
        current: &TaskState,
        new: &TaskState,
    ) -> Result<(), String> {
        let allowed_transitions: HashMap<TaskState, Vec<TaskState>> = [
            (TaskState::Planned, vec![TaskState::Ready, TaskState::Blocked]),
            (TaskState::Ready, vec![TaskState::Running, TaskState::Blocked]),
            (TaskState::Running, vec![TaskState::Complete, TaskState::Failed, TaskState::NeedsInput]),
            (TaskState::Blocked, vec![TaskState::Ready]),
            (TaskState::NeedsInput, vec![TaskState::Running]),
            (TaskState::Failed, vec![TaskState::Ready, TaskState::Running]),
            (TaskState::Complete, vec![]), // Terminal state
        ]
        .into_iter()
        .collect();
        
        if let Some(allowed) = allowed_transitions.get(current) {
            if allowed.contains(new) || allowed.is_empty() && current == new {
                Ok(())
            } else {
                Err(format!(
                    "Invalid state transition: {} -> {}. Allowed: {:?}",
                    current, new, allowed
                ))
            }
        } else {
            Err(format!("Unknown current state: {}", current))
        }
    }
}

impl Default for DagValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cycle_detection() {
        let graph = Graph {
            graph_id: "cycle-test".to_string(),
            created_at: None,
            title: "Cycle Test".to_string(),
            subgraphs: vec![],
            nodes: vec![
                GraphNode {
                    task_id: "A".to_string(),
                    title: "A".to_string(),
                    blocked_by: vec![],
                    wih_path: "/.allternit/wih/A.wih.json".to_string(),
                    wih: None,
                },
                GraphNode {
                    task_id: "B".to_string(),
                    title: "B".to_string(),
                    blocked_by: vec!["A".to_string()],
                    wih_path: "/.allternit/wih/B.wih.json".to_string(),
                    wih: None,
                },
                GraphNode {
                    task_id: "C".to_string(),
                    title: "C".to_string(),
                    blocked_by: vec!["B".to_string()],
                    wih_path: "/.allternit/wih/C.wih.json".to_string(),
                    wih: None,
                },
            ],
            edges: vec![
                GraphEdge { from: "A".to_string(), to: "B".to_string() },
                GraphEdge { from: "B".to_string(), to: "C".to_string() },
                GraphEdge { from: "C".to_string(), to: "A".to_string() }, // Creates cycle
            ],
            meta_policy: None,
        };
        
        let validator = DagValidator::new();
        let cycle = validator.detect_cycles(&graph).unwrap();
        
        assert!(cycle.is_some());
        let cycle_path = cycle.unwrap();
        assert!(cycle_path.contains(&"A".to_string()));
        assert!(cycle_path.contains(&"B".to_string()));
        assert!(cycle_path.contains(&"C".to_string()));
    }

    #[test]
    fn test_state_transitions() {
        let validator = DagValidator::new();
        
        // Valid transitions
        assert!(validator.validate_state_transition(&TaskState::Planned, &TaskState::Ready).is_ok());
        assert!(validator.validate_state_transition(&TaskState::Ready, &TaskState::Running).is_ok());
        assert!(validator.validate_state_transition(&TaskState::Running, &TaskState::Complete).is_ok());
        
        // Invalid transitions
        assert!(validator.validate_state_transition(&TaskState::Complete, &TaskState::Running).is_err());
        assert!(validator.validate_state_transition(&TaskState::Planned, &TaskState::Complete).is_err());
    }
}
