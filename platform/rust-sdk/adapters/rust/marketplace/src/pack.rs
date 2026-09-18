use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PackStatus {
    Available,
    Installing,
    Installed,
    Activated,
    Error,
    Upgrading,
}

#[derive(Debug, Clone, Serialize)]
pub struct Pack {
    pub id: Option<String>,
    pub pack_id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub asset_ids: Vec<String>,
    #[serde(default)]
    pub dependency_packs: Vec<String>,
    #[serde(default)]
    pub required_capabilities: Vec<String>,
    pub status: PackStatus,
    pub installation_order: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PackDependencyGraph {
    pub nodes: HashMap<String, Asset>,
    pub edges: HashMap<String, Vec<String>>,
}

impl PackDependencyGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
        }
    }

    pub fn topological_sort(&self) -> crate::Result<Vec<String>> {
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        for dependencies in self.edges.values() {
            for dep in dependencies {
                *in_degree.entry(dep.clone()).or_insert(0) += 1;
            }
        }

        let mut queue: Vec<String> = self.nodes
            .keys()
            .map(|k| k.clone())
            .filter(|node| in_degree.get(node).copied().unwrap_or(0) == 0)
            .collect();
        let mut result: Vec<String> = Vec::new();

        while let Some(node) = queue.pop() {
            result.push(node.clone());

            if let Some(dependencies) = self.edges.get(&node) {
                for dependent in dependencies {
                    if let Some(count) = in_degree.get_mut(dependent) {
                        if *count > 0 {
                            *count -= 1;
                            if *count == 0 {
                                queue.push(dependent.clone());
                            }
                        }
                    }
                }
            }
        }

        if result.len() != self.nodes.len() {
            return Err(MarketplaceError::PackValidation("Circular dependency detected".to_string()));
        }

        Ok(result)
    }

    fn find_cycle(&self) -> Vec<String> {
        let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut rec_stack: std::collections::HashSet<String> = std::collections::HashSet::new();

        for node in self.nodes.keys() {
            if !visited.contains(node) {
                if self.dfs_cycle(node, &mut visited, &mut rec_stack) {
                    return rec_stack.iter().cloned().collect();
                }
            }
        }

        vec![]
    }

    fn dfs_cycle(
        &self,
        node: &str,
        visited: &mut std::collections::HashSet<String>,
        rec_stack: &mut std::collections::HashSet<String>,
    ) -> bool {
        if rec_stack.contains(node) {
            return true;
        }

        if !visited.contains(node) {
            visited.insert(node.to_string());
            rec_stack.insert(node.to_string());

            if let Some(dependencies) = self.edges.get(node) {
                for dependent in dependencies {
                    if self.dfs_cycle(dependent, visited, rec_stack) {
                        return true;
                    }
                }
            }

            rec_stack.remove(node);
        }

        false
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PackInstallationPlan {
    pub pack_id: String,
    #[serde(default)]
    pub assets_to_install: Vec<Asset>,
    pub dependency_graph: PackDependencyGraph,
    #[serde(default)]
    pub activation_order: Vec<String>,
    #[serde(default)]
    pub estimated_size: i64,
}
