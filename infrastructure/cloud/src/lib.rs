//! A2R Cloud Core
//!
//! Core traits, types, and registry for cloud provider integration.
//! Implements BYOC (Bring Your Own Cloud) deployment model.

pub mod provider;
pub mod registry;
pub mod types;
pub mod config;
pub mod credentials;
pub mod preflight;
pub mod error;

pub use provider::*;
pub use registry::*;
pub use types::*;
pub use config::*;
pub use credentials::*;
pub use preflight::*;
pub use error::*;

