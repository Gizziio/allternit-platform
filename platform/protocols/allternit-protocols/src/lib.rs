//! Umbrella crate for all Allternit protocol implementations.
//!
//! Import this crate with the features you need:
//!
//! ```toml
//! [dependencies]
//! allternit-protocols = { workspace = true, features = ["messaging", "canvas"] }
//! ```
//!
//! Available features:
//! - `messaging` (default) — task queue, event bus, agent mail
//! - `history` (default) — audit ledger
//! - `node-control` — node/control-plane WebSocket protocol
//! - `canvas` — declarative task surface protocol
//! - `guest-agent` — VM host↔guest communication protocol
//! - `mcp` — Model Context Protocol client
//! - `sms` — SMS transport adapter
//! - `full` — all of the above

#[cfg(feature = "messaging")]
pub use allternit_messaging as messaging;

#[cfg(feature = "history")]
pub use allternit_history as history;

#[cfg(feature = "node-control")]
pub use allternit_node_protocol as node_control;

#[cfg(feature = "canvas")]
pub use allternit_canvas_protocol as canvas;

#[cfg(feature = "guest-agent")]
pub use allternit_guest_agent_protocol as guest_agent;

#[cfg(feature = "mcp")]
pub use mcp;

#[cfg(feature = "mcp")]
pub use allternit_mcp_client as mcp_client;

#[cfg(feature = "sms")]
pub use allternit_transport_sms as sms;
