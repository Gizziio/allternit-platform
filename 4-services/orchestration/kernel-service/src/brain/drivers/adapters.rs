// Placeholder module for brain driver adapters

pub mod api_adapter;
pub mod cli_adapter;
pub mod local_adapter;

pub use api_adapter::*;
pub use cli_adapter::*;
pub use local_adapter::*;
