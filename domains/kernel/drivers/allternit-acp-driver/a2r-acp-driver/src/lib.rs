//! ACP (Agent Client Protocol) Driver
//!
//! Production-grade ACP client implementation using official upstream types:
//! - Crate: agent-client-protocol-schema v0.10.8
//! - Repo: https://github.com/agentclientprotocol/rust-sdk
//! - Docs: https://docs.rs/agent-client-protocol-schema
//!
//! Features:
//! - Schema-compliant message parsing using official ACP types
//! - Tolerant handling of unknown update types (logged, not crashed)
//! - Tool round-trip support
//! - Transcript capture for debugging
//! - Session validation with auth/event mode gating
//! - Normalized event consumption via BrainRuntime trait
//!
//! # Architecture
//! This crate has ZERO dependencies on kernel-service.
//! It is a pure library for ACP communication.

pub mod driver;
pub mod protocol;
pub mod runtime_bridge;

#[cfg(test)]
pub mod testdata;

// Re-export main types
pub use driver::{
    AcpDoctor, AcpDriver, AcpDriverBuilder, AcpEvent, DoctorResult, DoctorStatus, DriverConfig,
    Session, ToolResult, ACP_SCHEMA_VERSION,
};
pub use protocol::{
    EventMode, SessionSource, SessionValidation, TolerantSessionUpdate, METHOD_AUTHENTICATE,
    METHOD_INITIALIZE, METHOD_PROMPT, METHOD_SESSION_NEW, METHOD_SHUTDOWN, METHOD_TOOL_RESULT,
};
pub use runtime_bridge::{AcpBrainRuntime, AcpNormalizer};

// Re-export official ACP schema types
pub use agent_client_protocol_schema::*;

/// Version of this ACP driver
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
