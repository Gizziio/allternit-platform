// OWNER: T1-A4

//! Allternit Executor
//!
//! Docker container orchestration for job execution.
//! Provides container lifecycle management, resource allocation,
//! and job queuing for the Allternit platform.

pub mod docker;
pub mod executor;
pub mod job_queue;
pub mod resource_manager;
pub mod runtime;
pub mod types;

#[cfg(test)]
mod executor_test;
#[cfg(test)]
mod job_queue_test;
#[cfg(test)]
mod types_test;

pub use docker::DockerOrchestrator;
pub use executor::ExecutorService;
pub use job_queue::JobQueueService;
pub use resource_manager::ResourceManagerService;
pub use runtime::RuntimeManager;
pub use types::*;
