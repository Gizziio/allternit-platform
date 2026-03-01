//! Capability grants for WASM tool execution.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A capability that can be granted to a WASM tool.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "config")]
pub enum WasmCapability {
    FilesystemRead {
        paths: Vec<String>,
    },
    FilesystemWrite {
        paths: Vec<String>,
    },
    Network {
        allowed_hosts: Vec<String>,
        allowed_ports: Vec<u16>,
    },
    Environment {
        allowed_vars: Vec<String>,
    },
    Clock,
    Random,
    Stdio,
    HttpClient {
        allowed_hosts: Vec<String>,
        max_requests_per_minute: u32,
    },
}

/// A grant of capabilities to a capsule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmCapabilityGrant {
    pub grant_id: Uuid,
    pub capsule_id: String,
    pub tenant_id: String,
    pub granted_capabilities: Vec<WasmCapability>,
    pub expires_at: Option<DateTime<Utc>>,
    pub granted_by: String,
    pub granted_at: DateTime<Utc>,
}

/// Request to load a capsule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleLoadRequest {
    pub capsule_id: String,
    pub requested_capabilities: Vec<WasmCapability>,
    pub requester_identity_id: String,
    pub tenant_id: String,
}

/// Decision on capsule load request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleLoadDecision {
    pub allowed: bool,
    pub grant: Option<WasmCapabilityGrant>,
    pub denied_capabilities: Vec<WasmCapability>,
    pub reason: String,
}
