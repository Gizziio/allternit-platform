use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCreateRequest {
    pub disk_image: Option<String>,
    pub memory_mb: Option<u32>,
    pub cpu_cores: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCreateResponse {
    pub session_id: String,
    pub status: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub status: String,
    pub created_at: i64,
    pub url: String,
    pub memory_mb: u32,
    pub cpu_cores: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInput {
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub output: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub status: String,
    pub version: String,
    pub active_sessions: usize,
    pub uptime_seconds: u64,
}
