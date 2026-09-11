use std::collections::{HashMap, HashSet};

use crate::work::types::{DagEdge, DagState};

pub fn would_create_cycle(edges: &[DagEdge], from: &str, to: &str) -> bool {
    let mut graph: HashMap<String, Vec<String>> = HashMap::new();
    for edge in edges.iter().filter(|e| e.edge_type == "blocked_by") {
        graph
            .entry(edge.from_node_id.clone())
            .or_default()
            .push(edge.to_node_id.clone());
    }
    graph
        .entry(from.to_string())
        .or_default()
        .push(to.to_string());
    has_cycle(&graph)
}

pub fn has_cycle_edges(edges: &[DagEdge]) -> bool {
    let mut graph: HashMap<String, Vec<String>> = HashMap::new();
    for edge in edges.iter().filter(|e| e.edge_type == "blocked_by") {
        graph
            .entry(edge.from_node_id.clone())
            .or_default()
            .push(edge.to_node_id.clone());
    }
    has_cycle(&graph)
}

pub fn ready_nodes(dag: &DagState) -> Vec<String> {
    let mut ready = Vec::new();
    for (node_id, node) in dag.nodes.iter() {
        if node.status != "READY" && node.status != "NEW" {
            continue;
        }
        let blockers: Vec<&DagEdge> = dag
            .edges
            .iter()
            .filter(|edge| edge.edge_type == "blocked_by" && edge.to_node_id == *node_id)
            .collect();
        let deps_satisfied = blockers.iter().all(|edge| {
            dag.nodes
                .get(&edge.from_node_id)
                .map(|n| n.status == "DONE")
                .unwrap_or(false)
        });
        if deps_satisfied {
            ready.push(node_id.clone());
        }
    }
    ready
}

fn has_cycle(graph: &HashMap<String, Vec<String>>) -> bool {
    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();

    for node in graph.keys() {
        if dfs(node, graph, &mut visiting, &mut visited) {
            return true;
        }
    }
    false
}

fn dfs(
    node: &str,
    graph: &HashMap<String, Vec<String>>,
    visiting: &mut HashSet<String>,
    visited: &mut HashSet<String>,
) -> bool {
    if visiting.contains(node) {
        return true;
    }
    if visited.contains(node) {
        return false;
    }
    visiting.insert(node.to_string());
    if let Some(children) = graph.get(node) {
        for child in children {
            if dfs(child, graph, visiting, visited) {
                return true;
            }
        }
    }
    visiting.remove(node);
    visited.insert(node.to_string());
    false
}
