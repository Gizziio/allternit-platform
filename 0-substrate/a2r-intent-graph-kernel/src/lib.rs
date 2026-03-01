//! # Intent Graph Kernel (IGK)
//!
//! The Intent Graph Kernel is a persistent, queryable graph of intent nodes and edges.
//! It serves as the substrate for all projections (UI, Context, Memory).
//!
//! ## Core Invariants
//! - **Single Reality**: No forking, one node per real-world entity
//! - **Append-Only Provenance**: All changes must be citeable to source objects
//! - **Policy-Gated Mutation**: AI proposes; policy commits
//! - **No Silent State**: Every state change must be citeable

pub mod schema;
pub mod storage;
pub mod query;
pub mod projection;
pub mod mutation;
pub mod error;

#[cfg(test)]
mod tests;

pub use schema::{Node, Edge, Event, SourceRef, NodeType, EdgeType, NodeStatus};
pub use error::{IGKError, Result};
