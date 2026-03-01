pub mod schema;
pub mod sandbox;
pub mod lifecycle;
pub mod registry;
pub mod error;
pub mod marketplace_routes;
pub mod service;

pub use schema::{CapsuleSpec, CapsuleId, SandboxPolicy, ToolScope, Lifecycle, Provenance};
pub use error::{CapsuleError, Result};
pub use service::CapsuleService;
