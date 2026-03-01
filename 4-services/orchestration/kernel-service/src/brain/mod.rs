pub mod a2r_runtime_adapter;
// pub mod acp_client;
// pub mod acp_runtime;
pub mod drivers;
pub mod gateway;
pub mod manager;
pub mod providers;
pub mod router;
pub mod runtime_management;
pub mod runtime_registry;
pub mod setup;
pub mod store;
pub mod traits;
pub mod types;

pub use drivers::acp::AcpProtocolDriver;
pub use drivers::jsonl::JsonlProtocolDriver;
pub use drivers::terminal::TerminalAppDriver;
pub use manager::BrainManager;
pub use router::ModelRouter;
pub use runtime_registry::RuntimeRegistry;
pub use store::BrainStore;
pub use traits::*;
pub use types::*;

// Re-export for backward compatibility
pub use drivers::terminal::TerminalAppDriver as CliBrainDriver;

use a2rchitech_providers::runtime::{ModelAdapterRegistry, ProviderAuthRegistry};
use std::sync::Arc;

pub trait BrainProvider {
    fn brain_manager(&self) -> Arc<BrainManager>;
    fn model_router(&self) -> Arc<ModelRouter>;
    fn terminal_manager(&self) -> Arc<crate::terminal_manager::TerminalManager>;
    fn runtime_registry(&self) -> RuntimeRegistry;
    fn provider_auth_registry(&self) -> Arc<ProviderAuthRegistry>;
    fn model_adapter_registry(&self) -> Arc<ModelAdapterRegistry>;
}
