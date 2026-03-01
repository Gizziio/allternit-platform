//! Core schema definitions for Intent Graph Kernel
//!
//! Defines the data structures for the persistent, queryable graph of intent.

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Unique identifier type
pub type NodeId = Uuid;
pub type EdgeId = Uuid;
pub type EventId = Uuid;

/// Node type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    /// User-provided intent
    Intent,
    /// Task to be executed
    Task,
    /// Goal or objective
    Goal,
    /// Decision point
    Decision,
    /// Execution plan
    Plan,
    /// Produced artifact
    Artifact,
    /// Stored memory
    Memory,
}

/// Edge type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    /// Node depends on another node
    DependsOn,
    /// Node blocks another node
    Blocks,
    /// Node is part of another node
    PartOf,
    /// Node implements another node
    Implements,
    /// Node provides context for another node
    ContextFor,
}

/// Node status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    /// Proposed but not yet committed
    Proposed,
    /// Active and committed
    Active,
    /// Completed
    Completed,
    /// Deprecated or replaced
    Deprecated,
}

/// A node in the intent graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub node_id: NodeId,
    pub node_type: NodeType,
    pub status: NodeStatus,
    pub priority: i32,
    pub owner: String,
    pub source_refs: Vec<SourceRef>,
    pub attributes: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// An edge connecting two nodes in the intent graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub edge_id: EdgeId,
    pub from_node_id: NodeId,
    pub to_node_id: NodeId,
    pub edge_type: EdgeType,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// An event representing a state mutation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub actor: String,
    pub action: String,
    pub target: String,
    pub before_state: Option<serde_json::Value>,
    pub after_state: Option<serde_json::Value>,
    pub policy_decision: Option<String>,
}

/// Provenance reference for source data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceRef {
    pub kind: String,
    pub locator: String,
    pub excerpt: Option<String>,
    pub hash: Option<String>,
}

/// Context slice for query with token budget
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSlice {
    pub root_nodes: Vec<NodeId>,
    pub edges: Vec<EdgeId>,
    pub sources: Vec<SourceRef>,
    pub token_budget: usize,
}
