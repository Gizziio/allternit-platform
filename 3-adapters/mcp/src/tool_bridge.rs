//! MCP Tool Bridge - Converts MCP tools to A2R ToolRequest format
//!
//! This module provides the core bridging functionality between MCP (Model Context Protocol)
//! tools and the A2R tools-gateway. It handles:
//!
//! - Converting MCP tool definitions to A2R ToolGatewayDefinition format
//! - Transforming A2R tool execution requests to MCP CallToolRequest format
//! - Converting MCP tool execution results back to A2R ToolResponse format
//! - JSON Schema to A2R parameter type conversion
//!
//! # Example
//!
//! ```rust,no_run
//! use mcp::tool_bridge::McpToolBridge;
//! use mcp::types::Tool;
//!
//! let bridge = McpToolBridge::new("filesystem".to_string());
//!
//! // Convert MCP tool definition to A2R format
//! let mcp_tool = Tool {
//!     name: "read_file".to_string(),
//!     description: Some("Read a file".to_string()),
//!     input_schema: serde_json::json!({
//!         "type": "object",
//!         "properties": {
//!             "path": {"type": "string"}
//!         },
//!         "required": ["path"]
//!     }),
//! };
//!
//! let a2r_definition = bridge.convert_tool_definition(&mcp_tool);
//! ```

use crate::types::{CallToolRequest, Tool, ToolContent, ToolResult};
use a2rchitech_sdk_core::{SafetyTier, ToolGatewayDefinition, ToolResourceLimits, ToolType};
use serde_json::Value;

/// Bridge for converting between MCP and A2R tool formats
#[derive(Debug, Clone)]
pub struct McpToolBridge {
    /// Prefix for tool names (typically the server name)
    tool_prefix: String,
    /// Default safety tier for MCP tools
    default_safety_tier: SafetyTier,
}

/// Parameter type enumeration for A2R tool schemas
#[derive(Debug, Clone, PartialEq)]
pub enum ParameterType {
    String,
    Number,
    Integer,
    Boolean,
    Array,
    Object,
    /// Multiple types allowed
    Any,
}

impl std::fmt::Display for ParameterType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParameterType::String => write!(f, "string"),
            ParameterType::Number => write!(f, "number"),
            ParameterType::Integer => write!(f, "integer"),
            ParameterType::Boolean => write!(f, "boolean"),
            ParameterType::Array => write!(f, "array"),
            ParameterType::Object => write!(f, "object"),
            ParameterType::Any => write!(f, "any"),
        }
    }
}

/// Tool parameter definition for A2R
#[derive(Debug, Clone)]
pub struct ToolParameter {
    pub name: String,
    pub param_type: ParameterType,
    pub description: Option<String>,
    pub required: bool,
    pub default: Option<Value>,
}

impl McpToolBridge {
    /// Create a new MCP tool bridge with the given prefix
    ///
    /// # Arguments
    ///
    /// * `prefix` - The prefix to use for tool names (typically the MCP server name)
    ///
    /// # Example
    ///
    /// ```
    /// use mcp::tool_bridge::McpToolBridge;
    ///
    /// let bridge = McpToolBridge::new("filesystem".to_string());
    /// ```
    pub fn new(prefix: String) -> Self {
        Self {
            tool_prefix: prefix,
            default_safety_tier: SafetyTier::T1, // Default to T1 for MCP tools
        }
    }

    /// Create a new MCP tool bridge with a specific safety tier
    ///
    /// # Arguments
    ///
    /// * `prefix` - The prefix to use for tool names
    /// * `safety_tier` - The default safety tier for tools from this server
    pub fn with_safety_tier(prefix: String, safety_tier: SafetyTier) -> Self {
        Self {
            tool_prefix: prefix,
            default_safety_tier: safety_tier,
        }
    }

    /// Get the tool prefix
    pub fn prefix(&self) -> &str {
        &self.tool_prefix
    }

    /// Convert MCP tool definition to A2R ToolGatewayDefinition
    ///
    /// This transforms an MCP Tool into the A2R ToolGatewayDefinition format,
    /// prefixing the tool name with the server name for namespacing.
    ///
    /// # Arguments
    ///
    /// * `mcp_tool` - The MCP tool definition
    ///
    /// # Returns
    ///
    /// A `ToolGatewayDefinition` compatible with the A2R tools-gateway
    pub fn convert_tool_definition(&self, mcp_tool: &Tool) -> ToolGatewayDefinition {
        let prefixed_name = format!("{}.{}", self.tool_prefix, mcp_tool.name);

        ToolGatewayDefinition {
            id: prefixed_name.clone(),
            name: mcp_tool.name.clone(),
            description: mcp_tool.description.clone().unwrap_or_default(),
            tool_type: ToolType::Local,     // MCP tools run locally
            command: mcp_tool.name.clone(), // Tool name is used as command
            endpoint: String::new(),        // Local tools don't have endpoints
            input_schema: mcp_tool.input_schema.clone(),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "content": {
                        "type": "array",
                        "items": {
                            "type": "object"
                        }
                    },
                    "is_error": {"type": "boolean"}
                }
            }),
            side_effects: vec!["mcp_tool".to_string()],
            idempotency_behavior: "unknown".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: self.default_safety_tier.clone(),
            resource_limits: ToolResourceLimits {
                cpu: None,
                memory: Some("128MB".to_string()),
                network: a2rchitech_sdk_core::NetworkAccess::Unrestricted,
                filesystem: a2rchitech_sdk_core::FilesystemAccess::None,
                time_limit: 30000, // 30 seconds default timeout
            },
        }
    }

    /// Convert multiple MCP tools to A2R definitions
    ///
    /// # Arguments
    ///
    /// * `mcp_tools` - Slice of MCP tool definitions
    ///
    /// # Returns
    ///
    /// Vector of `ToolGatewayDefinition`
    pub fn convert_tool_definitions(&self, mcp_tools: &[Tool]) -> Vec<ToolGatewayDefinition> {
        mcp_tools
            .iter()
            .map(|tool| self.convert_tool_definition(tool))
            .collect()
    }

    /// Convert A2R tool execution request to MCP CallToolRequest
    ///
    /// This strips the server prefix from the tool name to get the
    /// original MCP tool name.
    ///
    /// # Arguments
    ///
    /// * `tool_name` - The full tool name (with prefix)
    /// * `parameters` - The tool parameters as JSON
    ///
    /// # Returns
    ///
    /// A `CallToolRequest` ready to send to the MCP server
    pub fn to_mcp_request(&self, tool_name: &str, parameters: Value) -> CallToolRequest {
        // Strip prefix from tool name
        let name = tool_name
            .strip_prefix(&format!("{}.", self.tool_prefix))
            .unwrap_or(tool_name)
            .to_string();

        CallToolRequest {
            name,
            arguments: if parameters.is_null() {
                None
            } else {
                Some(parameters)
            },
        }
    }

    /// Convert MCP CallToolResult to A2R execution result format
    ///
    /// # Arguments
    ///
    /// * `result` - The MCP tool execution result
    ///
    /// # Returns
    ///
    /// A tuple of (output_json, error_message, execution_time_ms)
    pub fn to_a2r_result(
        &self,
        result: ToolResult,
        execution_time_ms: u64,
    ) -> (Value, Option<String>, u64) {
        let content = result
            .content
            .iter()
            .map(|item| match item {
                ToolContent::Text { text } => {
                    serde_json::json!({
                        "type": "text",
                        "text": text
                    })
                }
                ToolContent::Image { data, mime_type } => {
                    serde_json::json!({
                        "type": "image",
                        "data": data,
                        "mime_type": mime_type
                    })
                }
            })
            .collect::<Vec<_>>();

        let output = serde_json::json!({
            "content": content,
            "is_error": result.is_error.unwrap_or(false)
        });

        let error = if result.is_error.unwrap_or(false) {
            // Extract error message from content if available
            result
                .content
                .iter()
                .find_map(|item| match item {
                    ToolContent::Text { text } => Some(text.clone()),
                    _ => None,
                })
                .or_else(|| Some("Tool execution error".to_string()))
        } else {
            None
        };

        (output, error, execution_time_ms)
    }

    /// Convert MCP tool result to a simple string output
    ///
    /// This is useful for simple tool execution responses where only
    /// text content is needed.
    ///
    /// # Arguments
    ///
    /// * `result` - The MCP tool execution result
    ///
    /// # Returns
    ///
    /// Concatenated text content from all text items
    pub fn to_text_output(&self, result: &ToolResult) -> String {
        result
            .content
            .iter()
            .filter_map(|item| match item {
                ToolContent::Text { text } => Some(text.clone()),
                ToolContent::Image { data, mime_type } => {
                    Some(format!("![image](data:{};base64,{})", mime_type, data))
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Check if a tool name belongs to this bridge (has the correct prefix)
    ///
    /// # Arguments
    ///
    /// * `tool_name` - The full tool name to check
    ///
    /// # Returns
    ///
    /// `true` if the tool name starts with this bridge's prefix
    pub fn handles_tool(&self, tool_name: &str) -> bool {
        tool_name.starts_with(&format!("{}.", self.tool_prefix)) || tool_name == self.tool_prefix
    }

    /// Extract the original MCP tool name from a prefixed tool name
    ///
    /// # Arguments
    ///
    /// * `tool_name` - The full tool name (with prefix)
    ///
    /// # Returns
    ///
    /// The tool name without the prefix, or the original name if no prefix match
    pub fn extract_mcp_tool_name(&self, tool_name: &str) -> String {
        tool_name
            .strip_prefix(&format!("{}.", self.tool_prefix))
            .unwrap_or(tool_name)
            .to_string()
    }
}

/// Convert JSON Schema type to ParameterType
///
/// # Arguments
///
/// * `schema` - A JSON Schema property value
///
/// # Returns
///
/// The corresponding `ParameterType`
pub fn json_schema_to_param_type(schema: &Value) -> ParameterType {
    match schema.get("type") {
        Some(Value::String(t)) => match t.as_str() {
            "string" => ParameterType::String,
            "number" => ParameterType::Number,
            "integer" => ParameterType::Integer,
            "boolean" => ParameterType::Boolean,
            "array" => ParameterType::Array,
            "object" => ParameterType::Object,
            _ => ParameterType::Any,
        },
        Some(Value::Array(types)) => {
            // Handle union types (e.g., ["string", "null"])
            if types.len() == 1 {
                json_schema_to_param_type(&serde_json::json!({"type": types[0]}))
            } else {
                ParameterType::Any
            }
        }
        _ => {
            // Check for enum which implies string type
            if schema.get("enum").is_some() {
                ParameterType::String
            } else {
                ParameterType::Any
            }
        }
    }
}

/// Extract required fields from a JSON Schema
///
/// # Arguments
///
/// * `schema` - The JSON Schema object
///
/// # Returns
///
/// Set of required field names
pub fn extract_required_fields(schema: &Value) -> std::collections::HashSet<String> {
    schema
        .get("required")
        .and_then(|r| r.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_tool() -> Tool {
        Tool {
            name: "read_file".to_string(),
            description: Some("Read a file's contents".to_string()),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to the file"
                    },
                    "encoding": {
                        "type": "string",
                        "description": "File encoding",
                        "default": "utf-8"
                    }
                },
                "required": ["path"]
            }),
        }
    }

    #[test]
    fn test_convert_tool_definition() {
        let bridge = McpToolBridge::new("filesystem".to_string());
        let tool = create_test_tool();

        let definition = bridge.convert_tool_definition(&tool);

        assert_eq!(definition.id, "filesystem.read_file");
        assert_eq!(definition.name, "read_file");
        assert_eq!(definition.description, "Read a file's contents");
        assert!(matches!(definition.tool_type, ToolType::Local));
    }

    #[test]
    fn test_to_mcp_request() {
        let bridge = McpToolBridge::new("filesystem".to_string());
        let parameters = serde_json::json!({"path": "/tmp/test.txt"});

        let request = bridge.to_mcp_request("filesystem.read_file", parameters.clone());

        assert_eq!(request.name, "read_file");
        assert_eq!(request.arguments, Some(parameters));
    }

    #[test]
    fn test_to_mcp_request_without_prefix() {
        let bridge = McpToolBridge::new("filesystem".to_string());
        let parameters = serde_json::json!({"path": "/tmp/test.txt"});

        // Tool name without prefix should still work
        let request = bridge.to_mcp_request("read_file", parameters.clone());

        assert_eq!(request.name, "read_file");
    }

    #[test]
    fn test_to_a2r_result() {
        let bridge = McpToolBridge::new("filesystem".to_string());
        let result = ToolResult {
            content: vec![ToolContent::Text {
                text: "Hello, world!".to_string(),
            }],
            is_error: Some(false),
        };

        let (output, error, time_ms) = bridge.to_a2r_result(result, 100);

        assert!(error.is_none());
        assert_eq!(time_ms, 100);
        assert!(output.get("content").is_some());
    }

    #[test]
    fn test_to_a2r_result_with_error() {
        let bridge = McpToolBridge::new("filesystem".to_string());
        let result = ToolResult {
            content: vec![ToolContent::Text {
                text: "File not found".to_string(),
            }],
            is_error: Some(true),
        };

        let (output, error, _) = bridge.to_a2r_result(result, 50);

        assert!(error.is_some());
        assert_eq!(error.unwrap(), "File not found");
        assert_eq!(output["is_error"], true);
    }

    #[test]
    fn test_handles_tool() {
        let bridge = McpToolBridge::new("filesystem".to_string());

        assert!(bridge.handles_tool("filesystem.read_file"));
        assert!(!bridge.handles_tool("other.read_file"));
        assert!(!bridge.handles_tool("read_file"));
    }

    #[test]
    fn test_extract_mcp_tool_name() {
        let bridge = McpToolBridge::new("filesystem".to_string());

        assert_eq!(
            bridge.extract_mcp_tool_name("filesystem.read_file"),
            "read_file"
        );
        assert_eq!(bridge.extract_mcp_tool_name("read_file"), "read_file");
    }

    #[test]
    fn test_json_schema_to_param_type() {
        let string_schema = serde_json::json!({"type": "string"});
        assert_eq!(
            json_schema_to_param_type(&string_schema),
            ParameterType::String
        );

        let number_schema = serde_json::json!({"type": "number"});
        assert_eq!(
            json_schema_to_param_type(&number_schema),
            ParameterType::Number
        );

        let bool_schema = serde_json::json!({"type": "boolean"});
        assert_eq!(
            json_schema_to_param_type(&bool_schema),
            ParameterType::Boolean
        );
    }

    #[test]
    fn test_to_text_output() {
        let bridge = McpToolBridge::new("filesystem".to_string());
        let result = ToolResult {
            content: vec![
                ToolContent::Text {
                    text: "Line 1".to_string(),
                },
                ToolContent::Text {
                    text: "Line 2".to_string(),
                },
            ],
            is_error: Some(false),
        };

        let output = bridge.to_text_output(&result);
        assert_eq!(output, "Line 1\nLine 2");
    }
}
