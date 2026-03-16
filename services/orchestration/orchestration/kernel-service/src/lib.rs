pub mod action_handler;
pub mod agent_registry;
pub mod assistant;
pub mod brain;
pub mod config_manager;
pub mod context_manager;
pub mod contract_verifier;
pub mod directive_compiler;
pub mod embodiment;
pub mod frameworks;
pub mod gateway_runtime;
pub mod governance;
pub mod gui_tools;
pub mod intent_dispatcher;
pub mod intent_graph;
pub mod journal_ledger;
pub mod llm;
pub mod memory_maintenance_daemon;
// pub mod moa;  // Mixture of Agents Orchestrator
pub mod orchestrator;
pub mod orchestrator_v0;
pub mod patterns;
pub mod protection;
pub mod pty_session;
pub mod rate_limiter;
pub mod scheduler;
pub mod session_manager;
pub mod situation_resolver;
pub mod skill_manager;
pub mod state_engine;
pub mod taskgraph;
pub mod terminal_manager;
pub mod tool_executor;
pub mod tool_gateway_adapter;
pub mod types;
pub mod verification_checker;
pub mod violation;
pub mod vision_config;

pub use context_manager::*;
pub use contract_verifier::*;
pub use directive_compiler::*;
pub use intent_dispatcher::*;
// pub use moa::*;  // Export MoA types

// Minimal AppState for library-only handlers (bin provides full AppState).
pub struct AppState;
