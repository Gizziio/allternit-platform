//! Native Rails orchestrator for agent executor sessions.
//!
//! Spawns executors as `allternit-mux` panes, registers them as Rails peers,
//! and watches for the ADR-0044 notes-sentinel completion signal.

pub mod review;
pub mod runner;
pub mod session;
pub mod spec;

pub use runner::{DoctorReport, Orchestrator, OrchestratorOptions};
pub use session::{ExecutorSession, ExecutorState};
pub use spec::ExecutorSpec;
