//! Local model runtime lifecycle management.

pub mod backends;
pub mod log;
pub mod manager;

pub use manager::{ProcessManager, RuntimeInfo, RuntimeManagerError, RuntimeRecipe, RuntimeStatus};
