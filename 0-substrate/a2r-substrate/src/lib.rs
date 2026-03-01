use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub signal: Option<String>,
    pub killed: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolRequest {
    pub tool: String,
    pub arguments: serde_json::Value,
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolResponse {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PolicyContext {
    pub agent_id: String,
    pub tool: String,
    pub arguments: serde_json::Value,
    pub security_level: String,
}
