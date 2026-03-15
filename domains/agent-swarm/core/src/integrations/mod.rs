//! A2R Integration modules
//!
//! These modules provide integration with A2R's core services:
//! - Intent Graph: Store and query swarm execution data
//! - WIH: Work Item Handling for task tracking
//! - Rails: Execution sandbox
//! - Governance: Policy enforcement

pub mod intent_graph;
pub mod wih;
pub mod rails;
pub mod governance;
