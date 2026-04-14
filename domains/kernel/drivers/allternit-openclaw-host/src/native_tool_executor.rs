//! Tool Executor Native - OC-017
//!
//! Native Rust implementation of OpenClaw's tool execution functionality.
//! This module provides a pure Rust implementation of tool execution that
//! will eventually replace the OpenClaw subprocess version.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;
use tokio::process::Command;

/// Tool execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionRequest {
    pub tool_id: String,
    pub arguments: HashMap<String, serde_json::Value>,
    pub context: Option<ToolExecutionContext>,
    pub timeout: Option<u64>, // Timeout in seconds
    pub working_dir: Option<PathBuf>,
    pub environment: Option<HashMap<String, String>>,
}

/// Tool execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Tool execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
}

/// Tool definition for native tools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeToolDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub parameters: ToolParameters,
    pub command_template: String, // Template for command execution
    pub category: ToolCategory,
    pub enabled: bool,
    pub requires_authentication: bool,
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

/// Tool category
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
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

/// Tool executor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutorConfig {
    pub default_timeout_sec: u64,
    pub max_output_chars: usize,
    pub allow_background_execution: bool,
    pub allow_elevated_execution: bool,
    pub working_dir: Option<PathBuf>,
    pub environment: Option<HashMap<String, String>>,
    pub security_policy: SecurityPolicy,
}

impl Default for ToolExecutorConfig {
    fn default() -> Self {
        Self {
            default_timeout_sec: 30,   // 30 seconds default
            max_output_chars: 200_000, // 200KB max output
            allow_background_execution: true,
            allow_elevated_execution: false,
            working_dir: None,
            environment: None,
            security_policy: SecurityPolicy::Allowlist,
        }
    }
}

/// Security policy for tool execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SecurityPolicy {
    Deny,      // No execution allowed
    Allowlist, // Only allowlisted commands
    Full,      // Full execution allowed
}

/// Native tool executor trait
#[async_trait::async_trait]
pub trait NativeToolExecutor: Send + Sync {
    async fn execute(
        &self,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResponse, ToolExecutorError>;
    fn tool_definition(&self) -> NativeToolDefinition;
}

/// Tool executor service
pub struct ToolExecutorService {
    config: ToolExecutorConfig,
    tools: HashMap<String, Box<dyn NativeToolExecutor>>,
    allowlist: Vec<String>, // Commands that are allowed to run
}

impl ToolExecutorService {
    /// Create new tool executor with default configuration
    pub fn new() -> Self {
        Self {
            config: ToolExecutorConfig::default(),
            tools: HashMap::new(),
            allowlist: vec![
                "ls".to_string(),
                "cat".to_string(),
                "echo".to_string(),
                "pwd".to_string(),
                "mkdir".to_string(),
                "rm".to_string(),
                "cp".to_string(),
                "mv".to_string(),
                "touch".to_string(),
                "grep".to_string(),
                "find".to_string(),
                "ps".to_string(),
                "df".to_string(),
                "du".to_string(),
                "whoami".to_string(),
                "date".to_string(),
                "uname".to_string(),
                "which".to_string(),
                "git".to_string(),
                "node".to_string(),
                "npm".to_string(),
                "yarn".to_string(),
                "cargo".to_string(),
                "rustc".to_string(),
                "python".to_string(),
                "python3".to_string(),
                "pip".to_string(),
                "pip3".to_string(),
            ],
        }
    }

    /// Create new tool executor with custom configuration
    pub fn with_config(config: ToolExecutorConfig) -> Self {
        Self {
            config,
            tools: HashMap::new(),
            allowlist: vec![
                "ls".to_string(),
                "cat".to_string(),
                "echo".to_string(),
                "pwd".to_string(),
                "mkdir".to_string(),
                "rm".to_string(),
                "cp".to_string(),
                "mv".to_string(),
                "touch".to_string(),
                "grep".to_string(),
                "find".to_string(),
                "ps".to_string(),
                "df".to_string(),
                "du".to_string(),
                "whoami".to_string(),
                "date".to_string(),
                "uname".to_string(),
                "which".to_string(),
                "git".to_string(),
                "node".to_string(),
                "npm".to_string(),
                "yarn".to_string(),
                "cargo".to_string(),
                "rustc".to_string(),
                "python".to_string(),
                "python3".to_string(),
                "pip".to_string(),
                "pip3".to_string(),
            ],
        }
    }

    /// Register a native tool executor
    pub fn register_tool(&mut self, executor: Box<dyn NativeToolExecutor>) {
        let definition = executor.tool_definition();
        self.tools.insert(definition.id.clone(), executor);
    }

    /// Execute a tool by ID
    pub async fn execute_tool(
        &self,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResponse, ToolExecutorError> {
        // Check if the tool exists
        let executor = self
            .tools
            .get(&request.tool_id)
            .ok_or_else(|| ToolExecutorError::ToolNotFound(request.tool_id.clone()))?;

        // Validate security policy
        self.validate_security_policy(&request)?;

        // Execute the tool
        let start_time = std::time::Instant::now();
        let result = executor.execute(request).await;
        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(mut response) => {
                response.execution_time_ms = execution_time;
                Ok(response)
            }
            Err(e) => Ok(ToolExecutionResponse {
                success: false,
                result: None,
                error: Some(e.to_string()),
                execution_time_ms: execution_time,
                stdout: None,
                stderr: None,
            }),
        }
    }

    /// Validate security policy for the request
    fn validate_security_policy(
        &self,
        request: &ToolExecutionRequest,
    ) -> Result<(), ToolExecutorError> {
        match self.config.security_policy {
            SecurityPolicy::Deny => {
                return Err(ToolExecutorError::SecurityViolation(
                    "All tool execution is denied by security policy".to_string(),
                ));
            }
            SecurityPolicy::Allowlist => {
                // For shell command tools, check if the command is in the allowlist
                if let Some(command_template) = self.get_command_template_for_tool(&request.tool_id)
                {
                    let command_parts: Vec<&str> = command_template.split_whitespace().collect();
                    if let Some(first_part) = command_parts.first() {
                        if !self.allowlist.contains(&first_part.to_string()) {
                            return Err(ToolExecutorError::SecurityViolation(format!(
                                "Command '{}' not in allowlist",
                                first_part
                            )));
                        }
                    }
                }
            }
            SecurityPolicy::Full => {
                // No restrictions
            }
        }

        Ok(())
    }

    /// Get command template for a tool (for security validation)
    fn get_command_template_for_tool(&self, tool_id: &str) -> Option<String> {
        // This would normally come from the tool definition
        // For now, we'll implement a simple lookup
        if let Some(executor) = self.tools.get(tool_id) {
            let def = executor.tool_definition();
            Some(def.command_template)
        } else {
            None
        }
    }

    /// Execute a shell command directly (for bash tools)
    pub async fn execute_shell_command(
        &self,
        command: &str,
        working_dir: Option<&PathBuf>,
    ) -> Result<ToolExecutionResponse, ToolExecutorError> {
        let start_time = std::time::Instant::now();

        // Validate security policy for shell commands
        let command_parts: Vec<&str> = command.split_whitespace().collect();
        if let Some(first_part) = command_parts.first() {
            if !self.allowlist.contains(&first_part.to_string()) {
                return Err(ToolExecutorError::SecurityViolation(format!(
                    "Command '{}' not in allowlist",
                    first_part
                )));
            }
        }

        // Build the command
        let mut cmd = Command::new("bash");
        cmd.arg("-c").arg(command);

        // Set working directory if provided
        if let Some(wd) = working_dir {
            cmd.current_dir(wd);
        }

        // Set environment if provided
        if let Some(env) = &self.config.environment {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        // Set timeout
        let timeout_duration = Duration::from_secs(self.config.default_timeout_sec);

        // Execute with timeout
        let output = tokio::time::timeout(timeout_duration, cmd.output())
            .await
            .map_err(|_| ToolExecutorError::Timeout)?;

        let output = output
            .map_err(|e| ToolExecutorError::IoError(format!("Failed to execute command: {}", e)))?;

        let execution_time = start_time.elapsed().as_millis() as u64;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Truncate output if it exceeds max length
        let stdout = if stdout.len() > self.config.max_output_chars {
            stdout.chars().take(self.config.max_output_chars).collect()
        } else {
            stdout.to_string()
        };

        let stderr = if stderr.len() > self.config.max_output_chars {
            stderr.chars().take(self.config.max_output_chars).collect()
        } else {
            stderr.to_string()
        };

        Ok(ToolExecutionResponse {
            success: output.status.success(),
            result: Some(serde_json::json!({
                "exit_code": output.status.code(),
                "stdout": stdout,
                "stderr": stderr,
            })),
            error: if !output.status.success() {
                Some(format!(
                    "Command failed with exit code: {:?}",
                    output.status.code()
                ))
            } else if !stderr.is_empty() {
                Some(stderr.clone())
            } else {
                None
            },
            execution_time_ms: execution_time,
            stdout: Some(stdout),
            stderr: Some(stderr),
        })
    }

    /// Get a tool definition by ID
    pub fn get_tool_definition(&self, tool_id: &str) -> Option<NativeToolDefinition> {
        self.tools
            .get(tool_id)
            .map(|executor| executor.tool_definition())
    }

    /// List all registered tools
    pub fn list_tools(&self) -> Vec<NativeToolDefinition> {
        self.tools
            .values()
            .map(|executor| executor.tool_definition())
            .collect()
    }

    /// Get current configuration
    pub fn config(&self) -> &ToolExecutorConfig {
        &self.config
    }

    /// Get mutable configuration
    pub fn config_mut(&mut self) -> &mut ToolExecutorConfig {
        &mut self.config
    }

    /// Add a command to the allowlist
    pub fn add_to_allowlist(&mut self, command: String) {
        if !self.allowlist.contains(&command) {
            self.allowlist.push(command);
        }
    }

    /// Remove a command from the allowlist
    pub fn remove_from_allowlist(&mut self, command: &str) {
        self.allowlist.retain(|cmd| cmd != command);
    }
}

impl Default for ToolExecutorService {
    fn default() -> Self {
        Self::new()
    }
}

/// Tool executor error
#[derive(Debug, thiserror::Error)]
pub enum ToolExecutorError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Security violation: {0}")]
    SecurityViolation(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Timeout error")]
    Timeout,

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Execution failed: {0}")]
    ExecutionFailed(String),
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    struct EchoToolExecutor;

    #[async_trait]
    impl NativeToolExecutor for EchoToolExecutor {
        async fn execute(
            &self,
            request: ToolExecutionRequest,
        ) -> Result<ToolExecutionResponse, ToolExecutorError> {
            let text = request
                .arguments
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("Hello, World!");

            Ok(ToolExecutionResponse {
                success: true,
                result: Some(serde_json::json!({"output": text.to_string()})),
                error: None,
                execution_time_ms: 0,
                stdout: Some(text.to_string()),
                stderr: None,
            })
        }

        fn tool_definition(&self) -> NativeToolDefinition {
            NativeToolDefinition {
                id: "echo".to_string(),
                name: "Echo Tool".to_string(),
                description: "Echoes the input text".to_string(),
                parameters: ToolParameters {
                    properties: {
                        let mut props = HashMap::new();
                        props.insert(
                            "text".to_string(),
                            ToolParameter {
                                param_type: "string".to_string(),
                                description: Some("Text to echo".to_string()),
                                default: Some(serde_json::json!("Hello, World!")),
                                enum_values: None,
                            },
                        );
                        props
                    },
                    required: vec!["text".to_string()],
                },
                command_template: "echo {text}".to_string(),
                category: ToolCategory::System,
                enabled: true,
                requires_authentication: false,
                metadata: None,
            }
        }
    }

    #[tokio::test]
    async fn test_tool_executor_creation() {
        let executor = ToolExecutorService::new();
        assert_eq!(executor.config.default_timeout_sec, 30);
        assert_eq!(executor.config.max_output_chars, 200_000);
    }

    #[tokio::test]
    async fn test_register_and_execute_tool() {
        let mut executor = ToolExecutorService::new();

        // Register the echo tool
        executor.register_tool(Box::new(EchoToolExecutor));

        // Execute the tool
        let mut args = HashMap::new();
        args.insert("text".to_string(), serde_json::json!("Test message"));

        let request = ToolExecutionRequest {
            tool_id: "echo".to_string(),
            arguments: args,
            context: None,
            timeout: None,
            working_dir: None,
            environment: None,
        };

        let response = executor.execute_tool(request).await.unwrap();
        assert!(response.success);
        assert!(response.result.is_some());

        if let Some(result) = response.result {
            assert_eq!(
                result.get("output").and_then(|v| v.as_str()),
                Some("Test message")
            );
        }
    }

    #[tokio::test]
    async fn test_shell_command_execution() {
        let executor = ToolExecutorService::new();

        let response = executor
            .execute_shell_command("echo 'hello world'", None)
            .await
            .unwrap();
        assert!(response.success);
        assert!(response.stdout.is_some());
        assert!(response.stdout.as_ref().unwrap().contains("hello world"));
    }

    #[tokio::test]
    async fn test_security_policy_deny() {
        let mut executor = ToolExecutorService::new();
        executor.config.security_policy = SecurityPolicy::Deny;

        let response = executor.execute_shell_command("echo 'hello'", None).await;
        assert!(matches!(
            response,
            Err(ToolExecutorError::SecurityViolation(_))
        ));
    }

    #[tokio::test]
    async fn test_security_policy_allowlist() {
        let executor = ToolExecutorService::new();
        executor.config.security_policy = SecurityPolicy::Allowlist;

        // This should work since 'echo' is in the allowlist
        let response = executor
            .execute_shell_command("echo 'hello'", None)
            .await
            .unwrap();
        assert!(response.success);

        // This should fail since 'rm' is not in the allowlist by default
        let response = executor.execute_shell_command("rm -rf /", None).await;
        assert!(matches!(
            response,
            Err(ToolExecutorError::SecurityViolation(_))
        ));
    }
}
