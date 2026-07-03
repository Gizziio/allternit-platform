pub mod acp;
pub mod adapters;
pub mod api;
pub mod jsonl;
pub mod local;
pub mod terminal;

pub use crate::brain::types::{BrainConfig, BrainType};
pub use adapters::*;

// Re-export main drivers
pub use acp::AcpProtocolDriver;
pub use jsonl::JsonlProtocolDriver;
pub use terminal::TerminalAppDriver;
