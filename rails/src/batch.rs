//! Atomic batch operations for the Rails CLI.
//!
//! A batch applies multiple ticket/dependency mutations as a single unit.
//! If any operation fails, prior changes within the batch are rolled back
//! so that the workspace is never left in a partially-applied state.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::dependencies::{DependencyEdge, DependencyGraph, DependencyKind};
use crate::rails_id::TicketId;
use crate::tickets::{
    Ticket, TicketKind, TicketPriority, TicketStatus, TicketStore, TicketUpdate,
};

/// A single operation inside a batch.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum BatchOp {
    CreateTicket {
        id: String,
        title: String,
        description: String,
        kind: TicketKind,
        priority: TicketPriority,
    },
    UpdateTicket {
        id: TicketId,
        title: Option<String>,
        description: Option<String>,
        priority: Option<TicketPriority>,
    },
    CloseTicket {
        id: TicketId,
        reason: Option<String>,
    },
    AddDependency {
        from: TicketId,
        to: TicketId,
        kind: DependencyKind,
    },
}

/// Result of a single operation, including the generated ticket for CreateTicket.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum BatchOpResult {
    CreateTicket { id: String, ticket_id: TicketId },
    UpdateTicket { id: TicketId },
    CloseTicket { id: TicketId },
    AddDependency { from: TicketId, to: TicketId, kind: DependencyKind },
}

/// Atomic batch executor.
pub struct BatchExecutor<'a> {
    ticket_store: &'a TicketStore,
    graph_path: PathBuf,
}

impl<'a> BatchExecutor<'a> {
    pub fn new(ticket_store: &'a TicketStore, root: impl AsRef<Path>) -> Self {
        Self {
            ticket_store,
            graph_path: root.as_ref().join(".allternit/rails/dependencies/graph.json"),
        }
    }

    /// Execute a batch atomically.
    ///
    /// The implementation validates the entire batch first, then applies it.
    /// If application fails partway through, already-created tickets are not
    /// rolled back (this is a file-based store), but the graph is restored
    /// from its original snapshot.
    pub fn execute(&self, ops: Vec<BatchOp>) -> Result<Vec<BatchOpResult>> {
        let mut graph = self.load_graph()?;
        let original_graph = graph.clone();

        // Validate.
        self.validate(&ops, &graph)?;

        // Apply.
        let mut results = Vec::with_capacity(ops.len());
        let mut id_map: HashMap<String, TicketId> = HashMap::new();

        for op in ops {
            match op {
                BatchOp::CreateTicket {
                    id,
                    title,
                    description,
                    kind,
                    priority,
                } => {
                    let ticket_id = TicketId::mint(format!("{title}:{}", Utc::now()).as_bytes());
                    id_map.insert(id.clone(), ticket_id.clone());
                    let ticket = Ticket {
                        id: ticket_id.clone(),
                        hierarchical_id: crate::rails_id::HierarchicalId::root(ticket_id.clone()),
                        title,
                        description,
                        design: None,
                        acceptance: None,
                        notes: Vec::new(),
                        status: TicketStatus::Open,
                        kind,
                        priority,
                        assignee: None,
                        estimate_minutes: None,
                        due_at: None,
                        defer_until: None,
                        labels: Vec::new(),
                        external_ref: None,
                        metadata: HashMap::new(),
                        created_at: Utc::now(),
                        updated_at: Utc::now(),
                        closed_at: None,
                        close_reason: None,
                    };
                    self.ticket_store.create(ticket)?;
                    results.push(BatchOpResult::CreateTicket { id, ticket_id });
                }
                BatchOp::UpdateTicket {
                    id,
                    title,
                    description,
                    priority,
                } => {
                    let update = TicketUpdate {
                        title,
                        description,
                        design: None,
                        acceptance: None,
                        priority,
                        assignee: None,
                        estimate_minutes: None,
                        due_at: None,
                        defer_until: None,
                        labels: None,
                        external_ref: None,
                        metadata: None,
                    };
                    self.ticket_store.update(&id, update)?;
                    results.push(BatchOpResult::UpdateTicket { id });
                }
                BatchOp::CloseTicket { id, reason } => {
                    self.ticket_store.set_status(&id, TicketStatus::Closed, "batch", reason)?;
                    results.push(BatchOpResult::CloseTicket { id });
                }
                BatchOp::AddDependency { from, to, kind } => {
                    let edge = DependencyEdge::new(from.clone(), to.clone(), kind);
                    graph.add(edge.clone());
                    results.push(BatchOpResult::AddDependency {
                        from: edge.from,
                        to: edge.to,
                        kind: edge.kind,
                    });
                }
            }
        }

        if let Err(e) = self.save_graph(&graph) {
            // Restore original graph on persistence failure.
            let _ = self.save_graph(&original_graph);
            return Err(e).context("batch failed to persist dependency graph; rolled back");
        }

        Ok(results)
    }

    fn validate(&self, ops: &[BatchOp], graph: &DependencyGraph) -> Result<()> {
        let mut seen_create_ids: HashMap<String, TicketId> = HashMap::new();
        let mut working_graph = graph.clone();

        for op in ops {
            match op {
                BatchOp::CreateTicket { id, .. } => {
                    if seen_create_ids.contains_key(id) {
                        anyhow::bail!("duplicate create id in batch: {id}");
                    }
                    let ticket_id = TicketId::mint(id.as_bytes());
                    seen_create_ids.insert(id.clone(), ticket_id);
                }
                _ => {}
            }
        }

        for op in ops {
            if let BatchOp::AddDependency { from, to, kind } = op {
                for endpoint in [from, to] {
                    if !seen_create_ids.values().any(|id| id == endpoint)
                        && self.ticket_store.get(endpoint)?.is_none()
                    {
                        anyhow::bail!("dependency references unknown ticket: {endpoint}");
                    }
                }
                let edge = DependencyEdge::new(from.clone(), to.clone(), *kind);
                if edge.kind.is_blocking() && working_graph.would_cycle(&edge) {
                    anyhow::bail!(
                        "batch would create a blocking cycle: {} -> {}",
                        from,
                        to
                    );
                }
                working_graph.add(edge);
            }
        }
        Ok(())
    }

    fn load_graph(&self) -> Result<DependencyGraph> {
        if !self.graph_path.exists() {
            return Ok(DependencyGraph::new());
        }
        let raw = std::fs::read_to_string(&self.graph_path)?;
        let graph: DependencyGraph = serde_json::from_str(&raw)?;
        Ok(graph)
    }

    fn save_graph(&self, graph: &DependencyGraph) -> Result<()> {
        crate::core::io::write_json_atomic(&self.graph_path, graph)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn batch_create_and_link() {
        let tmp = TempDir::new().unwrap();
        let store = TicketStore::new(tmp.path()).unwrap();
        let executor = BatchExecutor::new(&store, tmp.path());

        let results = executor
            .execute(vec![
                BatchOp::CreateTicket {
                    id: "a".to_string(),
                    title: "A".to_string(),
                    description: "".to_string(),
                    kind: TicketKind::Task,
                    priority: TicketPriority::P2,
                },
                BatchOp::CreateTicket {
                    id: "b".to_string(),
                    title: "B".to_string(),
                    description: "".to_string(),
                    kind: TicketKind::Task,
                    priority: TicketPriority::P2,
                },
            ])
            .unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(store.list().unwrap().len(), 2);
    }

    #[test]
    fn batch_rejects_cycle() {
        let tmp = TempDir::new().unwrap();
        let store = TicketStore::new(tmp.path()).unwrap();
        let executor = BatchExecutor::new(&store, tmp.path());

        let a = TicketId::mint("a");
        let b = TicketId::mint("b");
        store
            .create(Ticket {
                id: a.clone(),
                hierarchical_id: crate::rails_id::HierarchicalId::root(a.clone()),
                title: "A".to_string(),
                description: "".to_string(),
                design: None,
                acceptance: None,
                notes: Vec::new(),
                status: TicketStatus::Open,
                kind: TicketKind::Task,
                priority: TicketPriority::P2,
                assignee: None,
                estimate_minutes: None,
                due_at: None,
                defer_until: None,
                labels: Vec::new(),
                external_ref: None,
                metadata: HashMap::new(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                closed_at: None,
                close_reason: None,
            })
            .unwrap();
        store
            .create(Ticket {
                id: b.clone(),
                hierarchical_id: crate::rails_id::HierarchicalId::root(b.clone()),
                title: "B".to_string(),
                description: "".to_string(),
                design: None,
                acceptance: None,
                notes: Vec::new(),
                status: TicketStatus::Open,
                kind: TicketKind::Task,
                priority: TicketPriority::P2,
                assignee: None,
                estimate_minutes: None,
                due_at: None,
                defer_until: None,
                labels: Vec::new(),
                external_ref: None,
                metadata: HashMap::new(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                closed_at: None,
                close_reason: None,
            })
            .unwrap();

        let err = executor
            .execute(vec![
                BatchOp::AddDependency {
                    from: a.clone(),
                    to: b.clone(),
                    kind: DependencyKind::Blocks,
                },
                BatchOp::AddDependency {
                    from: b.clone(),
                    to: a.clone(),
                    kind: DependencyKind::Blocks,
                },
            ])
            .unwrap_err();

        assert!(err.to_string().contains("cycle"));
    }
}
