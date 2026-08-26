//! Peer identity and addressing types for cross-session messaging.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// How to reach a peer.  UDS is the same-machine default; `Bridge` is a
/// network/cloud relay; `Mail` falls back to the existing Rails Mail agent
/// thread system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase", tag = "type")]
pub enum PeerAddress {
    Uds { socket_path: PathBuf },
    Bridge { endpoint: String },
    Mail { agent_id: String },
}

/// What kind of runtime the peer represents.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum PeerKind {
    #[default]
    Other,
    Gizzi,
    Claude,
    Codex,
    Kimi,
    Mux,
    Human,
    Executor,
}

/// A discovered or explicitly registered peer session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub peer_id: String,
    pub session_id: String,
    pub display_name: String,
    pub address: PeerAddress,
    pub cwd: String,
    pub vendor: String,
    pub kind: PeerKind,
}

/// Inbound message accepted by a peer's UDS inbox.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerMessage {
    pub from_peer: String,
    pub to_peer: String,
    pub correlation_id: String,
    pub kind: String,
    pub payload: serde_json::Value,
}
