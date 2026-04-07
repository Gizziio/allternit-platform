use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::pty::{PtyHealth, PtySessionInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarCreateSessionRequest {
    pub session_id: String,
    pub owner_id: String,
    pub shell: Option<String>,
    pub cols: u16,
    pub rows: u16,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub workdir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarWriteRequest {
    pub session_id: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarMarkConnectedRequest {
    pub session_id: String,
    pub client_id: String,
    pub mode: SessionAccessModeSerde,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarMarkDisconnectedRequest {
    pub session_id: String,
    pub client_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarRecordAuditEventRequest {
    pub session_id: String,
    pub event: String,
    pub details: serde_json::Value,
    pub client_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarUpdateSnapshotRequest {
    pub session_id: String,
    pub snapshot: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarBoolResponse {
    pub value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarOptionalI64Response {
    pub value: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarSubscribeResponse {
    pub info: PtySessionInfo,
    pub snapshot: Option<TerminalSnapshotState>,
    pub backlog: String,
    pub log_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarHealthResponse {
    pub health: PtyHealth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSnapshotState {
    pub snapshot: String,
    pub cols: u16,
    pub rows: u16,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionAccessModeSerde {
    ReadOnly,
    ReadWrite,
}

impl From<SessionAccessModeSerde> for crate::pty::SessionAccessMode {
    fn from(value: SessionAccessModeSerde) -> Self {
        match value {
            SessionAccessModeSerde::ReadOnly => crate::pty::SessionAccessMode::ReadOnly,
            SessionAccessModeSerde::ReadWrite => crate::pty::SessionAccessMode::ReadWrite,
        }
    }
}

impl From<crate::pty::SessionAccessMode> for SessionAccessModeSerde {
    fn from(value: crate::pty::SessionAccessMode) -> Self {
        match value {
            crate::pty::SessionAccessMode::ReadOnly => SessionAccessModeSerde::ReadOnly,
            crate::pty::SessionAccessMode::ReadWrite => SessionAccessModeSerde::ReadWrite,
        }
    }
}
