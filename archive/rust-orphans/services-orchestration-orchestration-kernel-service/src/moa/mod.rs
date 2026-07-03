/**
 * MoA (Mixture of Agents) Orchestrator
 * 
 * Routes complex prompts to multiple specialized agents/models concurrently.
 * Aggregates results into unified artifacts.
 */

pub mod types;
pub mod router;
pub mod executor;
pub mod synthesizer;
pub mod service;
pub mod api;

pub use types::*;
pub use router::MoARouter;
pub use executor::MoAExecutor;
pub use synthesizer::MoASynthesizer;
pub use service::{MoAService, MoAJob, JobStatus};
pub use api::create_moa_router;
