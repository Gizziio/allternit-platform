// OWNER: T1-A3

//! Environment Standardization
//!
//! Language detection, package manager detection, container runtime support, and lifecycle management.

pub mod types;
pub mod language;
pub mod package_manager;
pub mod runtime;
pub mod determinism;
pub mod lifecycle;

pub use types::*;
pub use language::detect_language;
pub use package_manager::detect_package_manager;
pub use runtime::RuntimeManager;
pub use determinism::compute_env_hash;
pub use lifecycle::LifecycleRunner;
