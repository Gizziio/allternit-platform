use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagNode {
    pub node_id: String,
    pub dag_id: String,
    pub parent_node_id: Option<String>,
    pub node_kind: String,
    pub title: String,
    pub description: Option<String>,
    pub execution_mode: String,
    pub owner_role: Option<String>,
    pub priority: Option<i64>,
    pub labels: Vec<String>,
    pub status: String,
    pub current_wih_id: Option<String>,
    pub assignee: Option<String>,
    pub spec_id: Option<String>,
    pub notes: Option<String>,
    pub acceptance: Option<String>,
    pub design: Option<String>,
    pub state: HashMap<String, String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    /// Worktree configuration for this node
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worktree: Option<WorktreeConfig>,
}

/// Worktree configuration for DAG nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeConfig {
    /// Whether to auto-create a worktree
    #[serde(default = "default_true")]
    pub auto_create: bool,
    /// Branch name prefix
    #[serde(default = "default_worktree_prefix")]
    pub branch_prefix: String,
    /// Cleanup policy when node is done
    #[serde(default)]
    pub cleanup_on_done: CleanupPolicy,
}

fn default_true() -> bool {
    true
}

fn default_worktree_prefix() -> String {
    "agent/".to_string()
}

/// Cleanup policy for worktrees
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum CleanupPolicy {
    /// Cleanup when node is done
    #[default]
    OnDone,
    /// Cleanup when entire DAG is complete
    OnDagComplete,
    /// Never cleanup automatically
    Never,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagEdge {
    pub from_node_id: String,
    pub to_node_id: String,
    pub edge_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagRelation {
    pub a: String,
    pub b: String,
    pub note: Option<String>,
    pub context_share: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagState {
    pub dag_id: String,
    pub nodes: HashMap<String, DagNode>,
    pub edges: Vec<DagEdge>,
    pub relations: Vec<DagRelation>,
}
