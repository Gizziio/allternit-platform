//! Typed dependency graph for Rails tickets.
//!
//! Rails supports several edge types beyond the hard `blocks` relationship:
//!
//! - `blocks` / `blocked_by`: hard blocker used for ready-list derivation
//! - `tracks`: tracks progress of another ticket
//! - `related`: non-blocking context link
//! - `duplicate_of`: marks a ticket as a duplicate of another
//! - `supersedes`: replaces another ticket
//! - `derived_from`: provenance link
//!
//! The graph is stored as a set of directed edges and validated to be
//! acyclic for hard-blocking edges.

use std::collections::{HashMap, HashSet};

use crate::rails_id::TicketId;

/// A directed edge between two tickets.
#[derive(Clone, Debug, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct DependencyEdge {
    pub from: TicketId,
    pub to: TicketId,
    pub kind: DependencyKind,
}

impl DependencyEdge {
    pub fn new(from: TicketId, to: TicketId, kind: DependencyKind) -> Self {
        Self { from, to, kind }
    }
}

/// The semantic kind of a dependency edge.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DependencyKind {
    /// `from` blocks `to`. Used for ready-list computation.
    Blocks,
    /// `from` tracks progress of `to`.
    Tracks,
    /// `from` is related to `to`.
    Related,
    /// `from` is a duplicate of `to`.
    DuplicateOf,
    /// `from` supersedes `to`.
    Supersedes,
    /// `from` was derived from `to`.
    DerivedFrom,
}

impl DependencyKind {
    /// Return true if this edge type participates in hard-block cycle detection.
    pub fn is_blocking(&self) -> bool {
        matches!(self, DependencyKind::Blocks)
    }

    /// Return the natural inverse kind.
    pub fn inverse(&self) -> Self {
        match self {
            DependencyKind::Blocks => DependencyKind::Blocks,
            DependencyKind::Tracks => DependencyKind::Tracks,
            DependencyKind::Related => DependencyKind::Related,
            DependencyKind::DuplicateOf => DependencyKind::DuplicateOf,
            DependencyKind::Supersedes => DependencyKind::Supersedes,
            DependencyKind::DerivedFrom => DependencyKind::DerivedFrom,
        }
    }
}

impl std::fmt::Display for DependencyKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DependencyKind::Blocks => write!(f, "blocks"),
            DependencyKind::Tracks => write!(f, "tracks"),
            DependencyKind::Related => write!(f, "related"),
            DependencyKind::DuplicateOf => write!(f, "duplicate_of"),
            DependencyKind::Supersedes => write!(f, "supersedes"),
            DependencyKind::DerivedFrom => write!(f, "derived_from"),
        }
    }
}

impl std::str::FromStr for DependencyKind {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "blocks" | "blocked_by" => Ok(DependencyKind::Blocks),
            "tracks" => Ok(DependencyKind::Tracks),
            "related" | "relates_to" => Ok(DependencyKind::Related),
            "duplicate_of" | "duplicates" => Ok(DependencyKind::DuplicateOf),
            "supersedes" => Ok(DependencyKind::Supersedes),
            "derived_from" | "discovered_from" => Ok(DependencyKind::DerivedFrom),
            _ => anyhow::bail!("unknown dependency kind: {s}"),
        }
    }
}

/// In-memory dependency graph.
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct DependencyGraph {
    edges: HashSet<DependencyEdge>,
}

impl DependencyGraph {
    pub fn new() -> Self {
        Self::default()
    }

    /// Add an edge. Returns false if the exact edge already existed.
    pub fn add(&mut self, edge: DependencyEdge) -> bool {
        self.edges.insert(edge)
    }

    /// Remove an exact edge. Returns true if it existed.
    pub fn remove(&mut self, from: &TicketId, to: &TicketId, kind: DependencyKind) -> bool {
        self.edges.remove(&DependencyEdge {
            from: from.clone(),
            to: to.clone(),
            kind,
        })
    }

    /// Remove all edges involving a ticket.
    pub fn remove_ticket(&mut self, id: &TicketId) {
        self.edges.retain(|e| e.from != *id && e.to != *id);
    }

    /// Return all edges.
    pub fn edges(&self) -> impl Iterator<Item = &DependencyEdge> {
        self.edges.iter()
    }

    /// Return edges of a specific kind.
    pub fn edges_of_kind(&self, kind: DependencyKind) -> Vec<&DependencyEdge> {
        self.edges.iter().filter(|e| e.kind == kind).collect()
    }

    /// Return edges where `id` is the source.
    pub fn outgoing(&self, id: &TicketId) -> Vec<&DependencyEdge> {
        self.edges.iter().filter(|e| e.from == *id).collect()
    }

    /// Return edges where `id` is the target.
    pub fn incoming(&self, id: &TicketId) -> Vec<&DependencyEdge> {
        self.edges.iter().filter(|e| e.to == *id).collect()
    }

    /// Return the set of tickets that `id` blocks (outgoing blocks edges).
    pub fn blocked_by(&self, id: &TicketId) -> Vec<&TicketId> {
        self.edges
            .iter()
            .filter(|e| e.from == *id && e.kind == DependencyKind::Blocks)
            .map(|e| &e.to)
            .collect()
    }

    /// Return the set of tickets that block `id` (incoming blocks edges).
    pub fn blocks(&self, id: &TicketId) -> Vec<&TicketId> {
        self.edges
            .iter()
            .filter(|e| e.to == *id && e.kind == DependencyKind::Blocks)
            .map(|e| &e.from)
            .collect()
    }

    /// Detect cycles in the blocking subgraph.
    pub fn has_cycle(&self) -> bool {
        let mut adj: HashMap<&TicketId, Vec<&TicketId>> = HashMap::new();
        for edge in self.edges.iter().filter(|e| e.kind.is_blocking()) {
            adj.entry(&edge.from).or_default().push(&edge.to);
        }

        let mut visited: HashSet<&TicketId> = HashSet::new();
        let mut stack: HashSet<&TicketId> = HashSet::new();

        fn dfs<'a>(
            node: &'a TicketId,
            adj: &HashMap<&'a TicketId, Vec<&'a TicketId>>,
            visited: &mut HashSet<&'a TicketId>,
            stack: &mut HashSet<&'a TicketId>,
        ) -> bool {
            if stack.contains(node) {
                return true;
            }
            if visited.contains(node) {
                return false;
            }
            visited.insert(node);
            stack.insert(node);
            for next in adj.get(node).into_iter().flatten() {
                if dfs(next, adj, visited, stack) {
                    return true;
                }
            }
            stack.remove(node);
            false
        }

        for node in adj.keys().copied().collect::<Vec<_>>() {
            if dfs(node, &adj, &mut visited, &mut stack) {
                return true;
            }
        }
        false
    }

    /// Return a concrete cycle if one exists in the blocking subgraph.
    pub fn find_cycle(&self) -> Option<Vec<TicketId>> {
        let mut adj: HashMap<&TicketId, Vec<&TicketId>> = HashMap::new();
        for edge in self.edges.iter().filter(|e| e.kind.is_blocking()) {
            adj.entry(&edge.from).or_default().push(&edge.to);
        }

        let mut visited: HashSet<&TicketId> = HashSet::new();
        let mut stack: Vec<&TicketId> = Vec::new();
        let mut on_stack: HashSet<&TicketId> = HashSet::new();

        fn dfs<'a>(
            node: &'a TicketId,
            adj: &HashMap<&'a TicketId, Vec<&'a TicketId>>,
            visited: &mut HashSet<&'a TicketId>,
            stack: &mut Vec<&'a TicketId>,
            on_stack: &mut HashSet<&'a TicketId>,
        ) -> Option<Vec<TicketId>> {
            if on_stack.contains(node) {
                let start = stack.iter().position(|&n| n == node).unwrap_or(0);
                let cycle = stack[start..]
                    .iter()
                    .map(|&n| n.clone())
                    .chain(std::iter::once(node.clone()))
                    .collect();
                return Some(cycle);
            }
            if visited.contains(node) {
                return None;
            }
            visited.insert(node);
            stack.push(node);
            on_stack.insert(node);
            for next in adj.get(node).into_iter().flatten() {
                if let Some(cycle) = dfs(next, adj, visited, stack, on_stack) {
                    return Some(cycle);
                }
            }
            stack.pop();
            on_stack.remove(node);
            None
        }

        for node in adj.keys().copied().collect::<Vec<_>>() {
            if let Some(cycle) = dfs(node, &adj, &mut visited, &mut stack, &mut on_stack) {
                return Some(cycle);
            }
        }
        None
    }

    /// Check whether adding `edge` would introduce a blocking cycle.
    pub fn would_cycle(&self, edge: &DependencyEdge) -> bool {
        if !edge.kind.is_blocking() {
            return false;
        }
        let mut g = self.clone();
        g.add(edge.clone());
        g.has_cycle()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(name: &str) -> TicketId {
        TicketId::mint(name)
    }

    #[test]
    fn blocks_relationship() {
        let mut g = DependencyGraph::new();
        let a = id("a");
        let b = id("b");
        g.add(DependencyEdge::new(a.clone(), b.clone(), DependencyKind::Blocks));

        assert_eq!(g.blocked_by(&a), vec![&b]);
        assert_eq!(g.blocks(&b), vec![&a]);
    }

    #[test]
    fn detects_cycle() {
        let mut g = DependencyGraph::new();
        let a = id("a");
        let b = id("b");
        let c = id("c");
        g.add(DependencyEdge::new(a.clone(), b.clone(), DependencyKind::Blocks));
        g.add(DependencyEdge::new(b.clone(), c.clone(), DependencyKind::Blocks));
        g.add(DependencyEdge::new(c.clone(), a.clone(), DependencyKind::Blocks));

        assert!(g.has_cycle());
        let cycle = g.find_cycle().unwrap();
        assert!(cycle.len() >= 3);
    }

    #[test]
    fn non_blocking_edges_do_not_cycle() {
        let mut g = DependencyGraph::new();
        let a = id("a");
        let b = id("b");
        g.add(DependencyEdge::new(a.clone(), b.clone(), DependencyKind::Related));
        g.add(DependencyEdge::new(b.clone(), a.clone(), DependencyKind::Related));

        assert!(!g.has_cycle());
    }

    #[test]
    fn would_cycle_predicts() {
        let mut g = DependencyGraph::new();
        let a = id("a");
        let b = id("b");
        g.add(DependencyEdge::new(a.clone(), b.clone(), DependencyKind::Blocks));

        let closing = DependencyEdge::new(b.clone(), a.clone(), DependencyKind::Blocks);
        assert!(g.would_cycle(&closing));
    }
}
