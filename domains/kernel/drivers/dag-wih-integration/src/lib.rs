//! Allternit DAG/WIH Integration
//!
//! Links task graphs (DAGs) with Work Item Headers (WIH) to enable
//! dependency-aware task execution with full context.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use thiserror::Error;
use tracing::{debug, error, info, warn};

pub mod browser;
pub mod checkpoint;
pub mod executor;
pub mod validator;

use executor::{DagExecutor, ExecutionPlan};
use validator::DagValidator;

// ============================================================================
// Core Data Structures
// ============================================================================

/// A task graph (DAG) defining the structure of work
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Graph {
    pub graph_id: String,
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    pub title: String,
    #[serde(default)]
    pub subgraphs: Vec<SubgraphRef>,
    pub nodes: Vec<GraphNode>,
    #[serde(default)]
    pub edges: Vec<GraphEdge>,
    #[serde(default)]
    pub meta_policy: Option<MetaPolicy>,
}

/// Reference to a subgraph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubgraphRef {
    pub graph_id: String,
    pub purpose: String,
}

/// A node in the task graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub task_id: String,
    pub title: String,
    #[serde(default)]
    pub blocked_by: Vec<String>,
    pub wih_path: String,
    #[serde(skip)]
    pub wih: Option<WorkItemHeader>,
}

/// An edge in the task graph (dependency)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
}

/// Meta-policy for the graph
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetaPolicy {
    #[serde(default)]
    pub requires_codebase_regen: bool,
    #[serde(default)]
    pub requires_acceptance_tests: bool,
    #[serde(default)]
    pub requires_adr_for_crosscutting: bool,
}

/// Work Item Header (WIH) - defines the actual work
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkItemHeader {
    pub wih_version: String,
    pub task_id: String,
    pub graph_id: String,
    pub title: String,
    #[serde(default)]
    pub state: TaskState,
    #[serde(default)]
    pub blocked_by: Vec<String>,
    #[serde(default)]
    pub external_refs: ExternalRefs,
    pub preset: Preset,
    #[serde(default)]
    pub resume_cursor: ResumeCursor,
    pub outputs: Outputs,
    pub write_scope: WriteScope,
    pub tools: Tools,
    pub memory: Memory,
    pub acceptance: Acceptance,
    pub beads: BeadsNode,
}

/// Task state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TaskState {
    #[default]
    Planned,
    Ready,
    Running,
    Blocked,
    NeedsInput,
    Failed,
    Complete,
}

impl std::fmt::Display for TaskState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskState::Planned => write!(f, "PLANNED"),
            TaskState::Ready => write!(f, "READY"),
            TaskState::Running => write!(f, "RUNNING"),
            TaskState::Blocked => write!(f, "BLOCKED"),
            TaskState::NeedsInput => write!(f, "NEEDS_INPUT"),
            TaskState::Failed => write!(f, "FAILED"),
            TaskState::Complete => write!(f, "COMPLETE"),
        }
    }
}

/// External references
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExternalRefs {
    #[serde(default)]
    pub claude_task_id: String,
    #[serde(default)]
    pub issue_id: String,
    #[serde(default)]
    pub pr_id: String,
}

/// Preset configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub preset_id: String,
    pub preset_hash: String,
}

/// Resume cursor for interrupted tasks
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResumeCursor {
    #[serde(default)]
    pub last_run_id: String,
    #[serde(default)]
    pub next_step: String,
    #[serde(default)]
    pub pending_checks: Vec<String>,
}

/// Output configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Outputs {
    pub required_artifacts: Vec<String>,
    pub artifact_paths: Vec<String>,
}

/// Write scope for the task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteScope {
    pub root: String,
    pub allowed_globs: Vec<String>,
}

/// Tools configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tools {
    pub allowlist: Vec<String>,
    #[serde(default)]
    pub pretooluse_hooks: Vec<String>,
}

/// Memory configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub packs: Vec<MemoryPack>,
}

/// Memory pack
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryPack {
    pub pack_id: String,
    pub layers: Vec<String>,
    pub access: String,
}

/// Acceptance criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Acceptance {
    pub checks: Vec<String>,
}

/// Beads node configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeadsNode {
    #[serde(flatten)]
    pub config: HashMap<String, serde_json::Value>,
}

// ============================================================================
// DAG/WIH Integration Engine
// ============================================================================

/// Integration engine that links DAGs with WIH files
pub struct DagWihIntegration {
    graphs: HashMap<String, Graph>,
    wih_files: HashMap<String, WorkItemHeader>,
    validator: DagValidator,
    executor: DagExecutor,
    root_path: PathBuf,
}

impl DagWihIntegration {
    /// Create a new integration engine
    pub fn new(root_path: impl AsRef<Path>) -> Self {
        Self {
            graphs: HashMap::new(),
            wih_files: HashMap::new(),
            validator: DagValidator::new(),
            executor: DagExecutor::new(),
            root_path: root_path.as_ref().to_path_buf(),
        }
    }

    /// Load a graph from file
    pub fn load_graph(&mut self, path: impl AsRef<Path>) -> Result<String, DagWihError> {
        let path = path.as_ref();
        let content = std::fs::read_to_string(path)
            .map_err(|e| DagWihError::IoError(format!("Failed to read graph {}: {}", path.display(), e)))?;
        
        let graph: Graph = serde_json::from_str(&content)
            .map_err(|e| DagWihError::ParseError(format!("Failed to parse graph {}: {}", path.display(), e)))?;
        
        let graph_id = graph.graph_id.clone();
        
        // Load associated WIH files
        for node in &graph.nodes {
            if let Err(e) = self.load_wih(&node.wih_path) {
                warn!("Failed to load WIH for node {}: {}", node.task_id, e);
            }
        }
        
        self.graphs.insert(graph_id.clone(), graph);
        info!("Loaded graph: {} from {}", graph_id, path.display());
        
        Ok(graph_id)
    }

    /// Load a WIH file
    fn load_wih(&mut self, wih_path: impl AsRef<str>) -> Result<(), DagWihError> {
        let path = self.root_path.join(wih_path.as_ref().trim_start_matches('/'));
        
        let content = std::fs::read_to_string(&path)
            .map_err(|e| DagWihError::IoError(format!("Failed to read WIH {}: {}", path.display(), e)))?;
        
        let wih: WorkItemHeader = serde_json::from_str(&content)
            .map_err(|e| DagWihError::ParseError(format!("Failed to parse WIH {}: {}", path.display(), e)))?;
        
        let task_id = wih.task_id.clone();
        self.wih_files.insert(task_id, wih);
        
        Ok(())
    }

    /// Link a graph node to its WIH
    pub fn link_node_to_wih(&mut self, graph_id: &str, task_id: &str) -> Result<(), DagWihError> {
        let graph = self.graphs.get_mut(graph_id)
            .ok_or_else(|| DagWihError::GraphNotFound(graph_id.to_string()))?;
        
        let node = graph.nodes.iter_mut()
            .find(|n| n.task_id == task_id)
            .ok_or_else(|| DagWihError::NodeNotFound(task_id.to_string()))?;
        
        if let Some(wih) = self.wih_files.get(&node.task_id) {
            if wih.graph_id != graph_id {
                return Err(DagWihError::GraphMismatch {
                    task_id: task_id.to_string(),
                    expected: graph_id.to_string(),
                    actual: wih.graph_id.clone(),
                });
            }
            node.wih = Some(wih.clone());
            debug!("Linked node {} to WIH in graph {}", task_id, graph_id);
            Ok(())
        } else {
            Err(DagWihError::WihNotFound(node.wih_path.clone()))
        }
    }

    /// Link all nodes in a graph to their WIH files
    pub fn link_all_nodes(&mut self, graph_id: &str) -> Result<LinkResult, DagWihError> {
        // First, collect all task IDs to avoid borrow issues
        let task_ids: Vec<String> = {
            let graph = self.graphs.get(graph_id)
                .ok_or_else(|| DagWihError::GraphNotFound(graph_id.to_string()))?;
            graph.nodes.iter().map(|n| n.task_id.clone()).collect()
        };
        
        let mut linked = Vec::new();
        let mut failed = Vec::new();
        
        for task_id in task_ids {
            match self.link_node_to_wih(graph_id, &task_id) {
                Ok(()) => linked.push(task_id),
                Err(e) => {
                    warn!("Failed to link node {}: {}", task_id, e);
                    failed.push((task_id, e.to_string()));
                }
            }
        }
        
        info!("Linked {}/{} nodes in graph {}", linked.len(), linked.len() + failed.len(), graph_id);
        
        Ok(LinkResult { linked, failed })
    }

    /// Validate the entire graph structure
    pub fn validate_graph(&self, graph_id: &str) -> Result<ValidationReport, DagWihError> {
        let graph = self.graphs.get(graph_id)
            .ok_or_else(|| DagWihError::GraphNotFound(graph_id.to_string()))?;
        
        self.validator.validate(graph, &self.wih_files)
    }

    /// Get ready tasks (all dependencies satisfied)
    pub fn get_ready_tasks(&self, graph_id: &str) -> Result<Vec<&GraphNode>, DagWihError> {
        let graph = self.graphs.get(graph_id)
            .ok_or_else(|| DagWihError::GraphNotFound(graph_id.to_string()))?;
        
        let mut ready = Vec::new();
        
        for node in &graph.nodes {
            let all_deps_satisfied = node.blocked_by.iter().all(|dep_id| {
                if let Some(dep_wih) = self.wih_files.get(dep_id) {
                    dep_wih.state == TaskState::Complete
                } else {
                    // If we don't have the WIH, assume it's an external dependency
                    true
                }
            });
            
            if all_deps_satisfied {
                if let Some(wih) = &node.wih {
                    if wih.state == TaskState::Planned || wih.state == TaskState::Ready {
                        ready.push(node);
                    }
                } else {
                    // Node without WIH is considered ready if dependencies are satisfied
                    ready.push(node);
                }
            }
        }
        
        Ok(ready)
    }

    /// Create execution plan for a graph
    pub fn create_execution_plan(&self, graph_id: &str) -> Result<ExecutionPlan, DagWihError> {
        let graph = self.graphs.get(graph_id)
            .ok_or_else(|| DagWihError::GraphNotFound(graph_id.to_string()))?;
        
        self.executor.create_plan(graph, &self.wih_files)
    }

    /// Update task state
    pub fn update_task_state(&mut self, task_id: &str, new_state: TaskState) -> Result<(), DagWihError> {
        if let Some(wih) = self.wih_files.get_mut(task_id) {
            let old_state = wih.state.clone();
            wih.state = new_state.clone();
            info!("Task {} state: {} -> {}", task_id, old_state, new_state);
            
            // Update the linked node as well
            for graph in self.graphs.values_mut() {
                if let Some(node) = graph.nodes.iter_mut().find(|n| n.task_id == task_id) {
                    if let Some(node_wih) = &mut node.wih {
                        node_wih.state = new_state.clone();
                    }
                }
            }
            
            Ok(())
        } else {
            Err(DagWihError::WihNotFoundForTask(task_id.to_string()))
        }
    }

    /// Get graph by ID
    pub fn get_graph(&self, graph_id: &str) -> Option<&Graph> {
        self.graphs.get(graph_id)
    }

    /// Get WIH by task ID
    pub fn get_wih(&self, task_id: &str) -> Option<&WorkItemHeader> {
        self.wih_files.get(task_id)
    }

    /// Get all loaded graph IDs
    pub fn get_graph_ids(&self) -> Vec<&String> {
        self.graphs.keys().collect()
    }

    /// Check for cycles in the graph
    pub fn detect_cycles(&self, graph_id: &str) -> Result<Option<Vec<String>>, DagWihError> {
        let graph = self.graphs.get(graph_id)
            .ok_or_else(|| DagWihError::GraphNotFound(graph_id.to_string()))?;
        
        self.validator.detect_cycles(graph)
    }
}

/// Result of linking nodes to WIH files
#[derive(Debug, Clone)]
pub struct LinkResult {
    pub linked: Vec<String>,
    pub failed: Vec<(String, String)>,
}

/// Validation report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub graph_id: String,
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub stats: ValidationStats,
}

/// Validation statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValidationStats {
    pub total_nodes: usize,
    pub linked_nodes: usize,
    pub orphan_nodes: usize,
    pub total_edges: usize,
    pub circular_dependencies: usize,
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, Error)]
pub enum DagWihError {
    #[error("IO error: {0}")]
    IoError(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Graph not found: {0}")]
    GraphNotFound(String),
    
    #[error("Node not found: {0}")]
    NodeNotFound(String),
    
    #[error("WIH not found: {0}")]
    WihNotFound(String),
    
    #[error("WIH not found for task: {0}")]
    WihNotFoundForTask(String),
    
    #[error("Graph mismatch for task {task_id}: expected {expected}, found {actual}")]
    GraphMismatch {
        task_id: String,
        expected: String,
        actual: String,
    },
    
    #[error("Validation error: {0}")]
    ValidationError(String),
    
    #[error("Execution error: {0}")]
    ExecutionError(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_graph() -> Graph {
        Graph {
            graph_id: "test-graph".to_string(),
            created_at: Some(Utc::now()),
            title: "Test Graph".to_string(),
            subgraphs: vec![],
            nodes: vec![
                GraphNode {
                    task_id: "T001".to_string(),
                    title: "Task 1".to_string(),
                    blocked_by: vec![],
                    wih_path: "/.allternit/wih/T001.wih.json".to_string(),
                    wih: None,
                },
                GraphNode {
                    task_id: "T002".to_string(),
                    title: "Task 2".to_string(),
                    blocked_by: vec!["T001".to_string()],
                    wih_path: "/.allternit/wih/T002.wih.json".to_string(),
                    wih: None,
                },
            ],
            edges: vec![
                GraphEdge { from: "T001".to_string(), to: "T002".to_string() },
            ],
            meta_policy: None,
        }
    }

    fn create_test_wih(task_id: &str, graph_id: &str, state: TaskState) -> WorkItemHeader {
        WorkItemHeader {
            wih_version: "v0.1".to_string(),
            task_id: task_id.to_string(),
            graph_id: graph_id.to_string(),
            title: format!("Task {}", task_id),
            state,
            blocked_by: vec![],
            external_refs: ExternalRefs::default(),
            preset: Preset {
                preset_id: "test".to_string(),
                preset_hash: "test".to_string(),
            },
            resume_cursor: ResumeCursor::default(),
            outputs: Outputs {
                required_artifacts: vec![],
                artifact_paths: vec![],
            },
            write_scope: WriteScope {
                root: "/.allternit/".to_string(),
                allowed_globs: vec![],
            },
            tools: Tools {
                allowlist: vec![],
                pretooluse_hooks: vec![],
            },
            memory: Memory { packs: vec![] },
            acceptance: Acceptance { checks: vec![] },
            beads: BeadsNode { config: HashMap::new() },
        }
    }

    #[test]
    fn test_graph_loading() {
        let temp_dir = TempDir::new().unwrap();
        let graph_path = temp_dir.path().join("test-graph.json");
        
        let graph = create_test_graph();
        let graph_json = serde_json::to_string_pretty(&graph).unwrap();
        std::fs::write(&graph_path, graph_json).unwrap();
        
        // Create WIH files
        let wih_dir = temp_dir.path().join(".allternit/wih");
        std::fs::create_dir_all(&wih_dir).unwrap();
        
        let wih1 = create_test_wih("T001", "test-graph", TaskState::Complete);
        let wih2 = create_test_wih("T002", "test-graph", TaskState::Planned);
        
        std::fs::write(wih_dir.join("T001.wih.json"), serde_json::to_string_pretty(&wih1).unwrap()).unwrap();
        std::fs::write(wih_dir.join("T002.wih.json"), serde_json::to_string_pretty(&wih2).unwrap()).unwrap();
        
        // Load graph
        let mut integration = DagWihIntegration::new(temp_dir.path());
        let graph_id = integration.load_graph(&graph_path).unwrap();
        
        assert_eq!(graph_id, "test-graph");
        assert!(integration.get_graph(&graph_id).is_some());
    }

    #[test]
    fn test_ready_tasks() {
        let temp_dir = TempDir::new().unwrap();
        let graph_path = temp_dir.path().join("test-graph.json");
        
        let graph = create_test_graph();
        let graph_json = serde_json::to_string_pretty(&graph).unwrap();
        std::fs::write(&graph_path, graph_json).unwrap();
        
        // Create WIH files
        let wih_dir = temp_dir.path().join(".allternit/wih");
        std::fs::create_dir_all(&wih_dir).unwrap();
        
        let wih1 = create_test_wih("T001", "test-graph", TaskState::Complete);
        let wih2 = create_test_wih("T002", "test-graph", TaskState::Planned);
        
        std::fs::write(wih_dir.join("T001.wih.json"), serde_json::to_string_pretty(&wih1).unwrap()).unwrap();
        std::fs::write(wih_dir.join("T002.wih.json"), serde_json::to_string_pretty(&wih2).unwrap()).unwrap();
        
        // Load and link
        let mut integration = DagWihIntegration::new(temp_dir.path());
        let graph_id = integration.load_graph(&graph_path).unwrap();
        integration.link_all_nodes(&graph_id).unwrap();
        
        // Check ready tasks
        let ready = integration.get_ready_tasks(&graph_id).unwrap();
        assert_eq!(ready.len(), 1);
        assert_eq!(ready[0].task_id, "T002");
    }
}
