//! GUI Tools Registration
//!
//! Registers GUI automation tools (screenshot, click, type, scroll) with the tool gateway

use crate::kernel::tools_gateway::{ToolGateway, ToolDefinition, ToolType};

/// Register all GUI tools with the tool gateway
pub async fn register_gui_tools(gateway: &ToolGateway) -> anyhow::Result<()> {
    let tools = vec![
        ToolDefinition {
            id: "gui.screenshot".to_string(),
            name: "GUI Screenshot".to_string(),
            description: "Capture screenshot of main display".to_string(),
            tool_type: ToolType::Local,
            command: "gui_screenshot".to_string(),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({}),
            side_effects: vec!["screen-access".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: false,
            failure_classification: "transient".to_string(),
            safety_tier: a2rchitech_policy::SafetyTier::Read,
            resource_limits: a2rchitech_tools_gateway::ResourceLimits {
                cpu: Some("100ms".to_string()),
                memory: Some("100MB".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::Readonly(vec!["/tmp".to_string()]),
                time_limit: 10,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "gui.click".to_string(),
            name: "GUI Click".to_string(),
            description: "Click on screen at specified coordinates".to_string(),
            tool_type: ToolType::Local,
            command: "gui_click".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "X coordinate"},
                    "y": {"type": "integer", "description": "Y coordinate"},
                    "button": {"type": "string", "description": "Mouse button to click"},
                    "count": {"type": "integer", "description": "Number of times to click"},
                }
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "success": {"type": "boolean", "description": "Whether click succeeded"},
                    "error": {"type": "string", "description": "Error message if failed"},
                }
            }),
            side_effects: vec!["mouse-control".to_string()],
            idempotency_behavior: "non-idempotent".to_string(),
            retryable: false,
            failure_classification: "transient".to_string(),
            safety_tier: a2rchitech_policy::SafetyTier::Write,
            resource_limits: a2rchitech_tools_gateway::ResourceLimits {
                cpu: Some("50ms".to_string()),
                memory: Some("10MB".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
                time_limit: 5,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "gui.type".to_string(),
            name: "GUI Type".to_string(),
            description: "Type text into focused application".to_string(),
            tool_type: ToolType::Local,
            command: "gui_type".to_string(),
            input_schema: serde_json::json!({
                "type": "string",
                "properties": {
                    "text": {"type": "string", "description": "Text to type"},
                    "delay_ms": {"type": "integer", "description": "Delay in milliseconds before typing"},
                }
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "success": {"type": "boolean", "description": "Whether typing succeeded"},
                    "error": {"type": "string", "description": "Error message if failed"},
                }
            }),
            side_effects: vec!["keyboard-input".to_string()],
            idempotency_behavior: "non-idempotent".to_string(),
            retryable: false,
            failure_classification: "transient".to_string(),
            safety_tier: a2rchitech_policy::SafetyTier::Write,
            resource_limits: a2rchitech_tools_gateway::ResourceLimits {
                cpu: Some("50ms".to_string()),
                memory: Some("10MB".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "gui.scroll".to_string(),
            name: "GUI Scroll".to_string(),
            description: "Scroll viewport by specified amount".to_string(),
            tool_type: ToolType::Local,
            command: "gui_scroll".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "dx": {"type": "integer", "description": "Horizontal scroll amount"},
                    "dy": {"type": "integer", "description": "Vertical scroll amount"},
                    "amount": {"type": "integer", "description": "Number of scroll events"},
                }
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "success": {"type": "boolean", "description": "Whether scroll succeeded"},
                    "error": {"type": "string", "description": "Error message if failed"},
                }
            }),
            side_effects: vec!["mouse-control".to_string()],
            idempotency_behavior: "non-idempotent".to_string(),
            retryable: false,
            failure_classification: "transient".to_string(),
            safety_tier: a2rchitech_policy::SafetyTier::Write,
            resource_limits: a2rchitech_tools_gateway::ResourceLimits {
                cpu: Some("50ms".to_string()),
                memory: Some("10MB".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        },
    ];

    for tool in tools {
        match gateway.register_tool(tool.clone()).await {
            Ok(_) => {
                println!("{} Registered GUI tool: {}", "✓".green(), tool.name);
            }
            Err(e) => {
                eprintln!("{} Failed to register GUI tool {}: {}", "✗".red(), tool.id, e);
            }
        }
    }

    Ok(())
}
