// 4-services/io-service/src/browser_recording_tools.rs
//! Browser Recording Tools Registration
//!
//! Registers browser recording tools (start_recording, stop_recording, recording_status)
//! with the tool gateway - similar to gui_tools.rs

use crate::kernel::tools_gateway::{ToolGateway, ToolDefinition, ToolType};
use a2rchitech_policy::SafetyTier;
use a2rchitech_tools_gateway::{NetworkAccess, FilesystemAccess, ResourceLimits};

/// Register all browser recording tools with the tool gateway
pub async fn register_browser_recording_tools(gateway: &ToolGateway) -> anyhow::Result<()> {
    let tools = vec![
        ToolDefinition {
            id: "browser.start_recording".to_string(),
            name: "Browser Start Recording".to_string(),
            description: "Start recording browser session as GIF/video for review".to_string(),
            tool_type: ToolType::Local,
            command: "browser_start_recording".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "Browser session ID"},
                    "format": {"type": "string", "enum": ["gif", "webm", "mp4"], "default": "gif", "description": "Output format"},
                    "fps": {"type": "integer", "default": 10, "description": "Frames per second"},
                    "quality": {"type": "integer", "default": 80, "description": "Quality 1-100"},
                    "max_duration_secs": {"type": "integer", "description": "Maximum recording duration"}
                }
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string"},
                    "session_id": {"type": "string"},
                    "status": {"type": "string"},
                    "format": {"type": "string"}
                },
                "required": ["recording_id", "session_id", "status"]
            }),
            side_effects: vec!["screen_capture".to_string(), "filesystem".to_string()],
            idempotency_behavior: "not_idempotent".to_string(),
            retryable: false,
            failure_classification: "permanent".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ResourceLimits {
                cpu: Some("1000m".to_string()),
                memory: Some("1Gi".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::Allowlist(vec!["./recordings".to_string()]),
                time_limit: 300,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "browser.stop_recording".to_string(),
            name: "Browser Stop Recording".to_string(),
            description: "Stop recording and save GIF/video output".to_string(),
            tool_type: ToolType::Local,
            command: "browser_stop_recording".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string", "description": "Recording session ID"},
                    "save": {"type": "boolean", "default": true, "description": "Save to file"}
                },
                "required": ["recording_id"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string"},
                    "success": {"type": "boolean"},
                    "file_path": {"type": "string"},
                    "file_size_bytes": {"type": "integer"},
                    "duration_secs": {"type": "number"},
                    "frames_captured": {"type": "integer"}
                },
                "required": ["recording_id", "success"]
            }),
            side_effects: vec!["filesystem".to_string()],
            idempotency_behavior: "not_idempotent".to_string(),
            retryable: false,
            failure_classification: "permanent".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ResourceLimits {
                cpu: Some("2000m".to_string()),
                memory: Some("2Gi".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::Allowlist(vec!["./recordings".to_string()]),
                time_limit: 120,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "browser.recording_status".to_string(),
            name: "Browser Recording Status".to_string(),
            description: "Get status of active recording".to_string(),
            tool_type: ToolType::Local,
            command: "browser_recording_status".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string", "description": "Recording session ID"}
                },
                "required": ["recording_id"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string"},
                    "is_recording": {"type": "boolean"},
                    "frames_captured": {"type": "integer"},
                    "duration_secs": {"type": "number"},
                    "format": {"type": "string"}
                }
            }),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: Some("100m".to_string()),
                memory: Some("128Mi".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 5,
            },
            subprocess: None,
        },
    ];

    for tool in tools {
        match gateway.register_tool(tool.clone()).await {
            Ok(_) => {
                tracing::info!("✓ Registered browser recording tool: {}", tool.name);
            }
            Err(e) => {
                tracing::error!("✗ Failed to register browser recording tool {}: {}", tool.id, e);
            }
        }
    }

    Ok(())
}
