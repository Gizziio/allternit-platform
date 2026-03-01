//! Tool Registry Native - OC-012
//!
//! Native Rust implementation of OpenClaw's tool registry system.
//! This module provides the native implementation that will eventually replace
//! the OpenClaw subprocess version.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Debug;

/// Tool definition structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub parameters: ToolParameters,
    pub category: ToolCategory,
    pub enabled: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Tool parameters schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameters {
    pub properties: HashMap<String, ToolParameter>,
    pub required: Vec<String>,
}

/// Tool parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameter {
    #[serde(rename = "type")]
    pub param_type: String, // "string", "number", "integer", "boolean", "array", "object"
    pub description: Option<String>,
    pub default: Option<serde_json::Value>,
    pub enum_values: Option<Vec<String>>, // For restricted values
}

/// Tool category enumeration
#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum ToolCategory {
    System,
    File,
    Shell,
    Network,
    Browser,
    Coding,
    Database,
    AiProvider,
    Custom,
}

/// Tool execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionRequest {
    pub tool_id: String,
    pub arguments: HashMap<String, serde_json::Value>,
    pub context: Option<ToolExecutionContext>,
}

/// Tool execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionContext {
    pub session_id: Option<String>,
    pub user_id: Option<String>,
    pub agent_id: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

/// Tool execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: Option<u64>,
}

/// Tool registry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRegistryConfig {
    pub enable_native_tools: bool,
    pub enable_openclaw_tools: bool,
    pub allow_tool_chaining: bool,
    pub max_concurrent_executions: Option<usize>,
    pub execution_timeout_ms: Option<u64>,
}

impl Default for ToolRegistryConfig {
    fn default() -> Self {
        Self {
            enable_native_tools: true,
            enable_openclaw_tools: true,
            allow_tool_chaining: true,
            max_concurrent_executions: Some(10),
            execution_timeout_ms: Some(30000), // 30 seconds
        }
    }
}

/// Native tool executor trait
#[async_trait::async_trait]
pub trait NativeToolExecutor: Send + Sync {
    async fn execute(
        &self,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResponse, ToolExecutionError>;
    fn tool_definition(&self) -> ToolDefinition;
}

/// Tool execution error
#[derive(Debug, thiserror::Error)]
pub enum ToolExecutionError {
    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Timeout error")]
    TimeoutError,

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

/// Wrapper for native tool executor that also holds its definition
pub struct NativeToolWrapper {
    executor: Box<dyn NativeToolExecutor>,
    definition: ToolDefinition,
}

impl NativeToolWrapper {
    pub fn new(executor: Box<dyn NativeToolExecutor>) -> Self {
        let definition = executor.tool_definition();
        Self {
            executor,
            definition,
        }
    }

    pub fn executor(&self) -> &dyn NativeToolExecutor {
        self.executor.as_ref()
    }

    pub fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
}

/// Tool registry service
pub struct ToolRegistry {
    config: ToolRegistryConfig,
    native_tools: HashMap<String, NativeToolWrapper>,
    openclaw_tools: HashMap<String, ToolDefinition>,
    tool_categories: HashMap<ToolCategory, Vec<String>>,
}

impl ToolRegistry {
    /// Create new tool registry with default configuration
    pub fn new() -> Self {
        Self {
            config: ToolRegistryConfig::default(),
            native_tools: HashMap::new(),
            openclaw_tools: HashMap::new(),
            tool_categories: HashMap::new(),
        }
    }

    /// Create new tool registry with custom configuration
    pub fn with_config(config: ToolRegistryConfig) -> Self {
        Self {
            config,
            native_tools: HashMap::new(),
            openclaw_tools: HashMap::new(),
            tool_categories: HashMap::new(),
        }
    }

    /// Register a native tool executor
    pub fn register_native_tool(&mut self, executor: Box<dyn NativeToolExecutor>) {
        let wrapper = NativeToolWrapper::new(executor);
        let tool_id = wrapper.definition().id.clone();
        let category = wrapper.definition().category.clone();

        // Add to native tools
        self.native_tools.insert(tool_id.clone(), wrapper);

        // Add to category index
        self.tool_categories
            .entry(category)
            .or_default()
            .push(tool_id);
    }

    /// Register an OpenClaw tool definition
    pub fn register_openclaw_tool(&mut self, definition: ToolDefinition) {
        let tool_id = definition.id.clone();
        let category = definition.category.clone();

        // Add to OpenClaw tools
        self.openclaw_tools.insert(tool_id.clone(), definition);

        // Add to category index
        self.tool_categories
            .entry(category)
            .or_default()
            .push(tool_id);
    }

    /// Execute a tool by ID
    pub async fn execute_tool(
        &self,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResponse, ToolExecutionError> {
        let tool_id = &request.tool_id;

        // Check if it's a native tool
        if self.config.enable_native_tools {
            if let Some(wrapper) = self.native_tools.get(tool_id) {
                return wrapper.executor().execute(request).await;
            }
        }

        // Check if it's an OpenClaw tool
        if self.config.enable_openclaw_tools {
            if let Some(definition) = self.openclaw_tools.get(tool_id) {
                // For now, return an error indicating this would delegate to OpenClaw
                // In a real implementation, this would call the OpenClaw subprocess
                return Err(ToolExecutionError::ExecutionError(format!(
                    "OpenClaw tool {} would be executed via subprocess delegation",
                    definition.name
                )));
            }
        }

        Err(ToolExecutionError::ToolNotFound(tool_id.clone()))
    }

    /// Get tool definition by ID
    pub fn get_tool_definition(&self, tool_id: &str) -> Option<&ToolDefinition> {
        if let Some(wrapper) = self.native_tools.get(tool_id) {
            Some(wrapper.definition())
        } else {
            self.openclaw_tools.get(tool_id)
        }
    }

    /// List tools by category
    pub fn list_tools_by_category(&self, category: &ToolCategory) -> Vec<&ToolDefinition> {
        self.tool_categories
            .get(category)
            .map(|tool_ids| {
                tool_ids
                    .iter()
                    .filter_map(|id| self.get_tool_definition(id))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// List all tools
    pub fn list_all_tools(&self) -> Vec<&ToolDefinition> {
        let mut all_tools = Vec::new();

        // Add native tools
        for wrapper in self.native_tools.values() {
            all_tools.push(wrapper.definition());
        }

        // Add OpenClaw tools
        all_tools.extend(self.openclaw_tools.values());

        all_tools
    }

    /// Check if a tool exists
    pub fn has_tool(&self, tool_id: &str) -> bool {
        self.native_tools.contains_key(tool_id) || self.openclaw_tools.contains_key(tool_id)
    }

    /// Validate tool arguments against schema
    pub fn validate_arguments(
        &self,
        tool_id: &str,
        args: &HashMap<String, serde_json::Value>,
    ) -> Result<(), String> {
        let definition = self
            .get_tool_definition(tool_id)
            .ok_or_else(|| format!("Tool not found: {}", tool_id))?;

        // Check required parameters
        for required_param in &definition.parameters.required {
            if !args.contains_key(required_param) {
                return Err(format!("Missing required parameter: {}", required_param));
            }
        }

        // Validate parameter types and values
        for (param_name, param_def) in &definition.parameters.properties {
            if let Some(arg_value) = args.get(param_name) {
                self.validate_parameter(param_def, arg_value)?;
            }
        }

        Ok(())
    }

    /// Validate a single parameter
    fn validate_parameter(
        &self,
        param_def: &ToolParameter,
        value: &serde_json::Value,
    ) -> Result<(), String> {
        // Type validation
        match param_def.param_type.as_str() {
            "string" => {
                if !value.is_string() {
                    return Err(format!("Expected string, got {:?}", value));
                }
            }
            "number" | "integer" => {
                if !value.is_number() {
                    return Err(format!("Expected number, got {:?}", value));
                }
            }
            "boolean" => {
                if !value.is_boolean() {
                    return Err(format!("Expected boolean, got {:?}", value));
                }
            }
            "array" => {
                if !value.is_array() {
                    return Err(format!("Expected array, got {:?}", value));
                }
            }
            "object" => {
                if !value.is_object() {
                    return Err(format!("Expected object, got {:?}", value));
                }
            }
            _ => {
                return Err(format!("Unknown parameter type: {}", param_def.param_type));
            }
        }

        // Enum validation
        if let Some(enum_values) = &param_def.enum_values {
            let value_str = value.as_str().unwrap_or("");
            if !enum_values.contains(&value_str.to_string()) {
                return Err(format!(
                    "Value '{}' not in allowed enum values: {:?}",
                    value_str, enum_values
                ));
            }
        }

        Ok(())
    }

    /// Update the registry configuration
    pub fn set_config(&mut self, config: ToolRegistryConfig) {
        self.config = config;
    }

    /// Get current configuration
    pub fn config(&self) -> &ToolRegistryConfig {
        &self.config
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    struct MockToolExecutor {
        definition: ToolDefinition,
    }

    impl MockToolExecutor {
        fn new() -> Self {
            Self {
                definition: ToolDefinition {
                    id: "mock-tool".to_string(),
                    name: "Mock Tool".to_string(),
                    description: "A mock tool for testing".to_string(),
                    parameters: ToolParameters {
                        properties: {
                            let mut props = HashMap::new();
                            props.insert(
                                "test_param".to_string(),
                                ToolParameter {
                                    param_type: "string".to_string(),
                                    description: Some("A test parameter".to_string()),
                                    default: None,
                                    enum_values: Some(vec![
                                        "option1".to_string(),
                                        "option2".to_string(),
                                    ]),
                                },
                            );
                            props
                        },
                        required: vec!["test_param".to_string()],
                    },
                    category: ToolCategory::System,
                    enabled: true,
                    metadata: None,
                },
            }
        }
    }

    #[async_trait]
    impl NativeToolExecutor for MockToolExecutor {
        async fn execute(
            &self,
            request: ToolExecutionRequest,
        ) -> Result<ToolExecutionResponse, ToolExecutionError> {
            Ok(ToolExecutionResponse {
                success: true,
                result: Some(
                    serde_json::json!({"message": "Executed successfully", "input": request.arguments}),
                ),
                error: None,
                execution_time_ms: Some(10),
            })
        }

        fn tool_definition(&self) -> ToolDefinition {
            self.definition.clone()
        }
    }

    #[test]
    fn test_tool_registry_creation() {
        let registry = ToolRegistry::new();
        assert_eq!(registry.config.max_concurrent_executions, Some(10));
        assert_eq!(registry.config.execution_timeout_ms, Some(30000));
    }

    #[tokio::test]
    async fn test_register_and_execute_native_tool() {
        let mut registry = ToolRegistry::new();

        let mock_tool = Box::new(MockToolExecutor::new());
        registry.register_native_tool(mock_tool);

        assert!(registry.has_tool("mock-tool"));

        let request = ToolExecutionRequest {
            tool_id: "mock-tool".to_string(),
            arguments: {
                let mut args = HashMap::new();
                args.insert("test_param".to_string(), serde_json::json!("option1"));
                args
            },
            context: None,
        };

        let response = registry.execute_tool(request).await.unwrap();
        assert!(response.success);
        assert!(response.result.is_some());
    }

    #[test]
    fn test_tool_validation() {
        let mut registry = ToolRegistry::new();

        let mock_tool = Box::new(MockToolExecutor::new());
        registry.register_native_tool(mock_tool);

        // Valid arguments
        let mut valid_args = HashMap::new();
        valid_args.insert("test_param".to_string(), serde_json::json!("option1"));
        assert!(registry
            .validate_arguments("mock-tool", &valid_args)
            .is_ok());

        // Invalid enum value
        let mut invalid_args = HashMap::new();
        invalid_args.insert(
            "test_param".to_string(),
            serde_json::json!("invalid_option"),
        );
        assert!(registry
            .validate_arguments("mock-tool", &invalid_args)
            .is_err());

        // Missing required parameter
        let empty_args = HashMap::new();
        assert!(registry
            .validate_arguments("mock-tool", &empty_args)
            .is_err());
    }
}
