//! Skill Execution Engine Native - OC-032
//!
//! Native Rust implementation of OpenClaw's skill execution engine.
//! This module provides a pure Rust implementation of skill execution that
//! will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tokio::process::Command;

/// Skill execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExecutionRequest {
    pub skill_id: String,
    pub arguments: HashMap<String, serde_json::Value>,
    pub context: Option<SkillExecutionContext>,
    pub timeout_ms: Option<u64>,
}

/// Skill execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExecutionContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub workspace_dir: Option<PathBuf>,
    pub metadata: Option<HashMap<String, String>>,
}

/// Skill execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExecutionResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub logs: Option<Vec<String>>,
}

/// Skill definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub parameters: SkillParameters,
    pub implementation: SkillImplementation,
    pub enabled: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Skill parameters schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillParameters {
    pub properties: HashMap<String, SkillParameter>,
    pub required: Vec<String>,
}

/// Skill parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillParameter {
    #[serde(rename = "type")]
    pub param_type: String, // "string", "number", "integer", "boolean", "array", "object"
    pub description: Option<String>,
    pub default: Option<serde_json::Value>,
    pub enum_values: Option<Vec<String>>, // For restricted values
}

/// Skill implementation type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SkillImplementation {
    /// Native Rust implementation
    Native { executor: String }, // Name of the native executor

    /// Bash script implementation
    Bash { script_path: PathBuf },

    /// Node.js script implementation
    Node { script_path: PathBuf },

    /// Python script implementation
    Python { script_path: PathBuf },

    /// External command implementation
    External { command: String },

    /// OpenClaw subprocess implementation (temporary during migration)
    OpenClaw { method: String },
}

/// Skill execution configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExecutionConfig {
    pub skills_dir: PathBuf,
    pub enable_native_execution: bool,
    pub enable_bash_execution: bool,
    pub enable_node_execution: bool,
    pub enable_python_execution: bool,
    pub enable_external_execution: bool,
    pub default_timeout_ms: u64,
    pub max_concurrent_executions: Option<usize>,
    pub enable_logging: bool,
    pub log_level: String, // "debug", "info", "warn", "error"
    pub security_policy: SecurityPolicy,
    pub enable_persistence: bool,
    pub enable_history: bool,
    pub history_limit: Option<usize>,
    pub enable_rate_limiting: bool,
    pub enable_auth_rotation: bool,
    pub enable_health_checks: bool,
    pub health_check_interval_minutes: Option<u64>,
    pub enable_usage_tracking: bool,
    pub enable_failover: bool,
    pub failover_strategy: FailoverStrategy,
    pub routing_algorithm: RoutingAlgorithm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FailoverStrategy {
    #[serde(rename = "priority")]
    Priority, // Try providers in priority order
    #[serde(rename = "round-robin")]
    RoundRobin, // Distribute requests evenly
    #[serde(rename = "least-loaded")]
    LeastLoaded, // Send to least loaded provider
    #[serde(rename = "latency-based")]
    LatencyBased, // Send to fastest responding provider
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RoutingAlgorithm {
    #[serde(rename = "simple")]
    Simple, // Basic routing based on availability
    #[serde(rename = "weighted")]
    Weighted, // Weighted routing based on performance metrics
    #[serde(rename = "adaptive")]
    Adaptive, // Adaptive routing that learns from performance
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityPolicy {
    /// Deny all execution (safe mode)
    Deny,

    /// Allow only whitelisted commands
    Allowlist { allowed_commands: Vec<String> },

    /// Allow all execution (unsafe, for development)
    Allow,
}

impl Default for SkillExecutionConfig {
    fn default() -> Self {
        Self {
            skills_dir: PathBuf::from("./skills"),
            enable_native_execution: true,
            enable_bash_execution: true,
            enable_node_execution: true,
            enable_python_execution: true,
            enable_external_execution: true,
            default_timeout_ms: 30_000, // 30 seconds
            max_concurrent_executions: Some(10),
            enable_logging: true,
            log_level: "info".to_string(),
            security_policy: SecurityPolicy::Allowlist {
                allowed_commands: vec![
                    "bash".to_string(),
                    "sh".to_string(),
                    "node".to_string(),
                    "python3".to_string(),
                    "python".to_string(),
                    "ls".to_string(),
                    "cat".to_string(),
                    "echo".to_string(),
                    "grep".to_string(),
                    "find".to_string(),
                    "git".to_string(),
                    "cargo".to_string(),
                    "npm".to_string(),
                    "yarn".to_string(),
                ],
            },
            enable_persistence: true,
            enable_history: true,
            history_limit: Some(1000),
            enable_rate_limiting: true,
            enable_auth_rotation: true,
            enable_health_checks: true,
            health_check_interval_minutes: Some(5),
            enable_usage_tracking: true,
            enable_failover: true,
            failover_strategy: FailoverStrategy::Priority,
            routing_algorithm: RoutingAlgorithm::Weighted,
        }
    }
}

/// Native skill executor trait
#[async_trait::async_trait]
pub trait NativeSkillExecutor: Send + Sync {
    async fn execute(
        &self,
        request: SkillExecutionRequest,
    ) -> Result<SkillExecutionResponse, SkillExecutionError>;
    fn skill_definition(&self) -> SkillDefinition;
}

/// Skill execution service
pub struct SkillExecutionService {
    config: SkillExecutionConfig,
    native_executors: HashMap<String, Box<dyn NativeSkillExecutor>>,
    skill_definitions: HashMap<String, SkillDefinition>,
    active_handles: HashMap<String, tokio::sync::Mutex<()>>, // To prevent concurrent execution of same skill
    execution_semaphore: Option<tokio::sync::Semaphore>,
    skill_history: HashMap<String, Vec<SkillExecutionResult>>,
}

/// Skill execution result (for history)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExecutionResult {
    pub id: String,
    pub skill_id: String,
    pub success: bool,
    pub execution_time_ms: u64,
    pub timestamp: DateTime<Utc>,
    pub error: Option<String>,
}

impl Default for SkillExecutionService {
    fn default() -> Self {
        Self::new()
    }
}

impl SkillExecutionService {
    /// Create new skill execution service with default configuration
    pub fn new() -> Self {
        let config = SkillExecutionConfig::default();
        let semaphore = config
            .max_concurrent_executions
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            native_executors: HashMap::new(),
            skill_definitions: HashMap::new(),
            active_handles: HashMap::new(),
            execution_semaphore: semaphore,
            skill_history: HashMap::new(),
        }
    }

    /// Create new skill execution service with custom configuration
    pub fn with_config(config: SkillExecutionConfig) -> Self {
        let semaphore = config
            .max_concurrent_executions
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            native_executors: HashMap::new(),
            skill_definitions: HashMap::new(),
            active_handles: HashMap::new(),
            execution_semaphore: semaphore,
            skill_history: HashMap::new(),
        }
    }

    /// Initialize the service by loading existing skill definitions
    pub async fn initialize(&mut self) -> Result<(), SkillExecutionError> {
        self.ensure_skills_dir().await?;
        self.load_skill_definitions().await?;
        Ok(())
    }

    /// Ensure the skills directory exists
    async fn ensure_skills_dir(&self) -> Result<(), SkillExecutionError> {
        fs::create_dir_all(&self.config.skills_dir)
            .await
            .map_err(|e| {
                SkillExecutionError::IoError(format!("Failed to create skills directory: {}", e))
            })
    }

    /// Load skill definitions from disk
    async fn load_skill_definitions(&mut self) -> Result<(), SkillExecutionError> {
        if !self.config.skills_dir.exists() {
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.skills_dir).await.map_err(|e| {
            SkillExecutionError::IoError(format!("Failed to read skills directory: {}", e))
        })?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            SkillExecutionError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();

            // Look for SKILL.md files
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if file_stem == "SKILL" {
                        // This is likely in a skill directory, get the parent directory name
                        if let Some(parent_dir) = path.parent() {
                            if let Some(skill_name) =
                                parent_dir.file_name().and_then(|s| s.to_str())
                            {
                                if let Ok(content) = fs::read_to_string(&path).await {
                                    if let Ok(definition) =
                                        self.parse_skill_definition(&content, skill_name)
                                    {
                                        self.skill_definitions
                                            .insert(definition.id.clone(), definition);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Also look for skill directories that contain SKILL.md
            if path.is_dir() {
                let skill_md_path = path.join("SKILL.md");
                if skill_md_path.exists() {
                    if let Ok(content) = fs::read_to_string(&skill_md_path).await {
                        if let Some(skill_name) = path.file_name().and_then(|s| s.to_str()) {
                            if let Ok(definition) =
                                self.parse_skill_definition(&content, skill_name)
                            {
                                self.skill_definitions
                                    .insert(definition.id.clone(), definition);
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Parse skill definition from SKILL.md content
    fn parse_skill_definition(
        &self,
        content: &str,
        skill_name: &str,
    ) -> Result<SkillDefinition, SkillExecutionError> {
        // Split frontmatter from content
        let parts: Vec<&str> = content.split("---").collect();
        if parts.len() < 3 {
            return Err(SkillExecutionError::ParseError(
                "Invalid SKILL.md format: missing frontmatter".to_string(),
            ));
        }

        let frontmatter = parts[1];
        let metadata: serde_json::Value = serde_yaml::from_str(frontmatter).map_err(|e| {
            SkillExecutionError::ParseError(format!("Failed to parse SKILL.md frontmatter: {}", e))
        })?;

        // Extract fields from metadata
        let id = metadata
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(skill_name)
            .to_string();

        let name = metadata
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(skill_name)
            .to_string();

        let description = metadata
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let enabled = metadata
            .get("enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        // Parse parameters
        let parameters = if let Some(params_obj) =
            metadata.get("parameters").and_then(|v| v.as_object())
        {
            let properties =
                if let Some(props_obj) = params_obj.get("properties").and_then(|v| v.as_object()) {
                    let mut prop_map = HashMap::new();
                    for (prop_name, prop_value) in props_obj {
                        let param_type = prop_value
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("string")
                            .to_string();
                        let description = prop_value
                            .get("description")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        let default = prop_value.get("default").cloned();
                        let enum_values =
                            prop_value
                                .get("enum")
                                .and_then(|v| v.as_array())
                                .map(|arr| {
                                    arr.iter()
                                        .filter_map(|item| item.as_str().map(|s| s.to_string()))
                                        .collect()
                                });

                        prop_map.insert(
                            prop_name.clone(),
                            SkillParameter {
                                param_type,
                                description,
                                default,
                                enum_values,
                            },
                        );
                    }
                    prop_map
                } else {
                    HashMap::new()
                };

            let required =
                if let Some(req_array) = params_obj.get("required").and_then(|v| v.as_array()) {
                    req_array
                        .iter()
                        .filter_map(|item| item.as_str().map(|s| s.to_string()))
                        .collect()
                } else {
                    Vec::new()
                };

            SkillParameters {
                properties,
                required,
            }
        } else {
            SkillParameters {
                properties: HashMap::new(),
                required: Vec::new(),
            }
        };

        // Determine implementation type
        let implementation =
            if let Some(impl_obj) = metadata.get("implementation").and_then(|v| v.as_object()) {
                if let Some(impl_type) = impl_obj.get("type").and_then(|v| v.as_str()) {
                    match impl_type {
                        "native" => {
                            let executor = impl_obj
                                .get("executor")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            SkillImplementation::Native { executor }
                        }
                        "bash" => {
                            let script_path = impl_obj
                                .get("scriptPath")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            SkillImplementation::Bash {
                                script_path: PathBuf::from(script_path),
                            }
                        }
                        "node" => {
                            let script_path = impl_obj
                                .get("scriptPath")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            SkillImplementation::Node {
                                script_path: PathBuf::from(script_path),
                            }
                        }
                        "python" => {
                            let script_path = impl_obj
                                .get("scriptPath")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            SkillImplementation::Python {
                                script_path: PathBuf::from(script_path),
                            }
                        }
                        "external" => {
                            let command = impl_obj
                                .get("command")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            SkillImplementation::External { command }
                        }
                        _ => {
                            // Default to OpenClaw implementation for unknown types
                            let method = format!("skills.{}", skill_name);
                            SkillImplementation::OpenClaw { method }
                        }
                    }
                } else {
                    // Default to OpenClaw implementation if no type specified
                    let method = format!("skills.{}", skill_name);
                    SkillImplementation::OpenClaw { method }
                }
            } else {
                // Default to OpenClaw implementation if no implementation specified
                let method = format!("skills.{}", skill_name);
                SkillImplementation::OpenClaw { method }
            };

        // Extract metadata
        let metadata_map = if metadata.is_object() {
            let obj = metadata.as_object().unwrap();
            let mut hash_map = std::collections::HashMap::new();
            for (k, v) in obj {
                hash_map.insert(k.clone(), v.clone());
            }
            Some(hash_map)
        } else {
            None
        };

        Ok(SkillDefinition {
            id,
            name,
            description,
            parameters,
            implementation,
            enabled,
            metadata: metadata_map,
        })
    }

    /// Register a native skill executor
    pub fn register_native_executor(&mut self, executor: Box<dyn NativeSkillExecutor>) {
        let definition = executor.skill_definition();
        self.native_executors
            .insert(definition.id.clone(), executor);
        self.skill_definitions
            .insert(definition.id.clone(), definition);
    }

    /// Execute a skill
    pub async fn execute_skill(
        &self,
        request: SkillExecutionRequest,
    ) -> Result<SkillExecutionResponse, SkillExecutionError> {
        let start_time = std::time::Instant::now();

        // Acquire execution semaphore if configured
        let _permit = if let Some(semaphore) = &self.execution_semaphore {
            Some(semaphore.acquire().await.map_err(|e| {
                SkillExecutionError::ResourceError(format!(
                    "Failed to acquire execution permit: {}",
                    e
                ))
            })?)
        } else {
            None
        };

        // Validate request
        self.validate_skill_request(&request)?;

        // Get skill definition
        let skill_def = self
            .skill_definitions
            .get(&request.skill_id)
            .ok_or_else(|| SkillExecutionError::SkillNotFound(request.skill_id.clone()))?;

        if !skill_def.enabled {
            return Err(SkillExecutionError::PermissionDenied(format!(
                "Skill {} is disabled",
                request.skill_id
            )));
        }

        // Validate arguments against schema
        self.validate_arguments(&request.arguments, &skill_def.parameters)?;

        // Execute based on implementation type
        let response = match &skill_def.implementation {
            SkillImplementation::Native { executor } => {
                // Find and execute the native executor
                if let Some(native_executor) = self.native_executors.get(&request.skill_id) {
                    native_executor.execute(request.clone()).await?
                } else {
                    return Err(SkillExecutionError::ExecutionError(format!(
                        "Native executor '{}' not found for skill '{}'",
                        executor, request.skill_id
                    )));
                }
            }
            SkillImplementation::Bash { script_path } => {
                self.execute_bash_skill(request, script_path).await?
            }
            SkillImplementation::Node { script_path } => {
                self.execute_node_skill(request, script_path).await?
            }
            SkillImplementation::Python { script_path } => {
                self.execute_python_skill(request, script_path).await?
            }
            SkillImplementation::External { command } => {
                self.execute_external_command(request, command).await?
            }
            SkillImplementation::OpenClaw { method } => {
                // This would delegate to OpenClaw subprocess in a real implementation
                // For now, return an error indicating this would be handled by OpenClaw
                return Err(SkillExecutionError::ExecutionError(format!(
                    "OpenClaw skill '{}' would be executed via subprocess delegation (method: {})",
                    request.skill_id, method
                )));
            }
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        Ok(SkillExecutionResponse {
            success: response.success,
            result: response.result,
            error: response.error,
            execution_time_ms: execution_time,
            logs: response.logs,
        })
    }

    /// Validate skill execution request
    fn validate_skill_request(
        &self,
        request: &SkillExecutionRequest,
    ) -> Result<(), SkillExecutionError> {
        if request.skill_id.is_empty() {
            return Err(SkillExecutionError::ValidationError(
                "Skill ID cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate arguments against parameter schema
    fn validate_arguments(
        &self,
        args: &HashMap<String, serde_json::Value>,
        params: &SkillParameters,
    ) -> Result<(), SkillExecutionError> {
        // Check required parameters
        for required_param in &params.required {
            if !args.contains_key(required_param) {
                return Err(SkillExecutionError::ValidationError(format!(
                    "Missing required parameter: {}",
                    required_param
                )));
            }
        }

        // Validate parameter types and values
        for (arg_name, arg_value) in args {
            if let Some(param_def) = params.properties.get(arg_name) {
                // Validate type
                match param_def.param_type.as_str() {
                    "string" => {
                        if !arg_value.is_string() && !arg_value.is_null() {
                            return Err(SkillExecutionError::ValidationError(format!(
                                "Parameter '{}' expected string, got {:?}",
                                arg_name, arg_value
                            )));
                        }
                    }
                    "number" | "integer" => {
                        if !arg_value.is_number() && !arg_value.is_null() {
                            return Err(SkillExecutionError::ValidationError(format!(
                                "Parameter '{}' expected number, got {:?}",
                                arg_name, arg_value
                            )));
                        }
                    }
                    "boolean" => {
                        if !arg_value.is_boolean() && !arg_value.is_null() {
                            return Err(SkillExecutionError::ValidationError(format!(
                                "Parameter '{}' expected boolean, got {:?}",
                                arg_name, arg_value
                            )));
                        }
                    }
                    "array" => {
                        if !arg_value.is_array() && !arg_value.is_null() {
                            return Err(SkillExecutionError::ValidationError(format!(
                                "Parameter '{}' expected array, got {:?}",
                                arg_name, arg_value
                            )));
                        }
                    }
                    "object" => {
                        if !arg_value.is_object() && !arg_value.is_null() {
                            return Err(SkillExecutionError::ValidationError(format!(
                                "Parameter '{}' expected object, got {:?}",
                                arg_name, arg_value
                            )));
                        }
                    }
                    _ => {
                        return Err(SkillExecutionError::ValidationError(format!(
                            "Unknown parameter type for '{}': {}",
                            arg_name, param_def.param_type
                        )));
                    }
                }

                // Validate enum values if specified
                if let Some(enum_values) = &param_def.enum_values {
                    if let Some(arg_str) = arg_value.as_str() {
                        if !enum_values.contains(&arg_str.to_string()) {
                            return Err(SkillExecutionError::ValidationError(format!(
                                "Parameter '{}' value '{}' not in allowed values: {:?}",
                                arg_name, arg_str, enum_values
                            )));
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Execute a bash skill
    async fn execute_bash_skill(
        &self,
        request: SkillExecutionRequest,
        script_path: &PathBuf,
    ) -> Result<SkillExecutionResponse, SkillExecutionError> {
        if !self.config.enable_bash_execution {
            return Err(SkillExecutionError::PermissionDenied(
                "Bash execution is disabled".to_string(),
            ));
        }

        // Security check based on policy
        self.check_security_policy("bash")?;

        let mut cmd = Command::new("bash");
        cmd.arg(script_path);

        // Add arguments as environment variables for security
        for (key, value) in &request.arguments {
            let value_str = if let Some(str_val) = value.as_str() {
                str_val.to_string()
            } else {
                value.to_string()
            };
            cmd.env(format!("SKILL_ARG_{}", key.to_uppercase()), value_str);
        }

        // Set timeout
        let timeout = request.timeout_ms.unwrap_or(self.config.default_timeout_ms);

        // Execute with timeout
        let output = tokio::time::timeout(std::time::Duration::from_millis(timeout), cmd.output())
            .await
            .map_err(|_| SkillExecutionError::Timeout)?;

        let output = output.map_err(|e| {
            SkillExecutionError::IoError(format!("Failed to execute bash script: {}", e))
        })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        let logs = if self.config.enable_logging {
            let mut logs = Vec::new();
            if !stdout.is_empty() {
                logs.push(format!("STDOUT: {}", stdout));
            }
            if !stderr.is_empty() {
                logs.push(format!("STDERR: {}", stderr));
            }
            Some(logs)
        } else {
            None
        };

        Ok(SkillExecutionResponse {
            success: output.status.success(),
            result: Some(serde_json::json!({
                "exit_code": output.status.code(),
                "stdout": stdout.to_string(),
                "stderr": stderr.to_string(),
            })),
            error: if !output.status.success() {
                Some(format!(
                    "Command failed with exit code {:?}: {}",
                    output.status.code(),
                    stderr
                ))
            } else if !stderr.is_empty() {
                Some(stderr.to_string())
            } else {
                None
            },
            execution_time_ms: 0, // Would be calculated in real implementation
            logs,
        })
    }

    /// Execute a Node.js skill
    async fn execute_node_skill(
        &self,
        request: SkillExecutionRequest,
        script_path: &PathBuf,
    ) -> Result<SkillExecutionResponse, SkillExecutionError> {
        if !self.config.enable_node_execution {
            return Err(SkillExecutionError::PermissionDenied(
                "Node.js execution is disabled".to_string(),
            ));
        }

        // Security check based on policy
        self.check_security_policy("node")?;

        let mut cmd = Command::new("node");
        cmd.arg(script_path);

        // Add arguments as environment variables
        for (key, value) in &request.arguments {
            let value_str = if let Some(str_val) = value.as_str() {
                str_val.to_string()
            } else {
                value.to_string()
            };
            cmd.env(format!("SKILL_ARG_{}", key.to_uppercase()), value_str);
        }

        // Set timeout
        let timeout = request.timeout_ms.unwrap_or(self.config.default_timeout_ms);

        // Execute with timeout
        let output = tokio::time::timeout(std::time::Duration::from_millis(timeout), cmd.output())
            .await
            .map_err(|_| SkillExecutionError::Timeout)?;

        let output = output.map_err(|e| {
            SkillExecutionError::IoError(format!("Failed to execute node script: {}", e))
        })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        Ok(SkillExecutionResponse {
            success: output.status.success(),
            result: Some(serde_json::json!({
                "exit_code": output.status.code(),
                "stdout": stdout.to_string(),
                "stderr": stderr.to_string(),
            })),
            error: if !output.status.success() {
                Some(format!(
                    "Node script failed with exit code {:?}: {}",
                    output.status.code(),
                    stderr
                ))
            } else if !stderr.is_empty() {
                Some(stderr.to_string())
            } else {
                None
            },
            execution_time_ms: 0, // Would be calculated in real implementation
            logs: None,
        })
    }

    /// Execute a Python skill
    async fn execute_python_skill(
        &self,
        request: SkillExecutionRequest,
        script_path: &PathBuf,
    ) -> Result<SkillExecutionResponse, SkillExecutionError> {
        if !self.config.enable_python_execution {
            return Err(SkillExecutionError::PermissionDenied(
                "Python execution is disabled".to_string(),
            ));
        }

        // Security check based on policy
        self.check_security_policy("python")?;

        let mut cmd = Command::new("python3");
        cmd.arg(script_path);

        // Add arguments as environment variables
        for (key, value) in &request.arguments {
            let value_str = if let Some(str_val) = value.as_str() {
                str_val.to_string()
            } else {
                value.to_string()
            };
            cmd.env(format!("SKILL_ARG_{}", key.to_uppercase()), value_str);
        }

        // Set timeout
        let timeout = request.timeout_ms.unwrap_or(self.config.default_timeout_ms);

        // Execute with timeout
        let output = tokio::time::timeout(std::time::Duration::from_millis(timeout), cmd.output())
            .await
            .map_err(|_| SkillExecutionError::Timeout)?;

        let output = output.map_err(|e| {
            SkillExecutionError::IoError(format!("Failed to execute python script: {}", e))
        })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        Ok(SkillExecutionResponse {
            success: output.status.success(),
            result: Some(serde_json::json!({
                "exit_code": output.status.code(),
                "stdout": stdout.to_string(),
                "stderr": stderr.to_string(),
            })),
            error: if !output.status.success() {
                Some(format!(
                    "Python script failed with exit code {:?}: {}",
                    output.status.code(),
                    stderr
                ))
            } else if !stderr.is_empty() {
                Some(stderr.to_string())
            } else {
                None
            },
            execution_time_ms: 0, // Would be calculated in real implementation
            logs: None,
        })
    }

    /// Execute an external command
    async fn execute_external_command(
        &self,
        request: SkillExecutionRequest,
        command: &str,
    ) -> Result<SkillExecutionResponse, SkillExecutionError> {
        if !self.config.enable_external_execution {
            return Err(SkillExecutionError::PermissionDenied(
                "External command execution is disabled".to_string(),
            ));
        }

        // Security check based on policy
        self.check_security_policy(command)?;

        // Parse command and arguments
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            return Err(SkillExecutionError::ExecutionError(
                "Empty command".to_string(),
            ));
        }

        let mut cmd = Command::new(parts[0]);

        // Add remaining parts as arguments
        for part in &parts[1..] {
            cmd.arg(part);
        }

        // Add skill arguments as environment variables
        for (key, value) in &request.arguments {
            let value_str = if let Some(str_val) = value.as_str() {
                str_val.to_string()
            } else {
                value.to_string()
            };
            cmd.env(format!("SKILL_ARG_{}", key.to_uppercase()), value_str);
        }

        // Set timeout
        let timeout = request.timeout_ms.unwrap_or(self.config.default_timeout_ms);

        // Execute with timeout
        let output = tokio::time::timeout(std::time::Duration::from_millis(timeout), cmd.output())
            .await
            .map_err(|_| SkillExecutionError::Timeout)?;

        let output = output.map_err(|e| {
            SkillExecutionError::IoError(format!("Failed to execute external command: {}", e))
        })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        Ok(SkillExecutionResponse {
            success: output.status.success(),
            result: Some(serde_json::json!({
                "exit_code": output.status.code(),
                "stdout": stdout.to_string(),
                "stderr": stderr.to_string(),
            })),
            error: if !output.status.success() {
                Some(format!(
                    "External command failed with exit code {:?}: {}",
                    output.status.code(),
                    stderr
                ))
            } else if !stderr.is_empty() {
                Some(stderr.to_string())
            } else {
                None
            },
            execution_time_ms: 0, // Would be calculated in real implementation
            logs: None,
        })
    }

    /// Check security policy for a command
    fn check_security_policy(&self, command: &str) -> Result<(), SkillExecutionError> {
        match &self.config.security_policy {
            SecurityPolicy::Deny => {
                return Err(SkillExecutionError::SecurityViolation(
                    "All execution is denied by security policy".to_string(),
                ));
            }
            SecurityPolicy::Allowlist { allowed_commands } => {
                // Check if the command is in the allowlist
                let cmd_base = command.split_whitespace().next().unwrap_or(command);
                if !allowed_commands.contains(&cmd_base.to_string()) {
                    return Err(SkillExecutionError::SecurityViolation(format!(
                        "Command '{}' not in allowlist",
                        cmd_base
                    )));
                }
            }
            SecurityPolicy::Allow => {
                // No restrictions
            }
        }

        Ok(())
    }

    /// List all available skills
    pub fn list_skills(&self) -> Vec<&SkillDefinition> {
        self.skill_definitions.values().collect()
    }

    /// Get a specific skill definition
    pub fn get_skill_definition(&self, skill_id: &str) -> Option<&SkillDefinition> {
        self.skill_definitions.get(skill_id)
    }

    /// Check if a skill exists
    pub fn has_skill(&self, skill_id: &str) -> bool {
        self.skill_definitions.contains_key(skill_id)
    }

    /// Get current configuration
    pub fn config(&self) -> &SkillExecutionConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut SkillExecutionConfig {
        &mut self.config
    }
}

/// Skill execution error
#[derive(Debug, thiserror::Error)]
pub enum SkillExecutionError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Skill not found: {0}")]
    SkillNotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Security violation: {0}")]
    SecurityViolation(String),

    #[error("Timeout error")]
    Timeout,

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Resource error: {0}")]
    ResourceError(String),

    #[error("Parse error: {0}")]
    ParseError(String),
}

impl From<serde_json::Error> for SkillExecutionError {
    fn from(error: serde_json::Error) -> Self {
        SkillExecutionError::SerializationError(error.to_string())
    }
}

impl From<serde_yaml::Error> for SkillExecutionError {
    fn from(error: serde_yaml::Error) -> Self {
        SkillExecutionError::ParseError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct EchoSkillExecutor;

    #[async_trait::async_trait]
    impl NativeSkillExecutor for EchoSkillExecutor {
        async fn execute(
            &self,
            request: SkillExecutionRequest,
        ) -> Result<SkillExecutionResponse, SkillExecutionError> {
            let input = request
                .arguments
                .get("input")
                .and_then(|v| v.as_str())
                .unwrap_or("default");

            Ok(SkillExecutionResponse {
                success: true,
                result: Some(serde_json::json!({
                    "output": format!("Echo: {}", input)
                })),
                error: None,
                execution_time_ms: 10,
                logs: Some(vec!["Echo skill executed".to_string()]),
            })
        }

        fn skill_definition(&self) -> SkillDefinition {
            let mut properties = HashMap::new();
            properties.insert(
                "input".to_string(),
                SkillParameter {
                    param_type: "string".to_string(),
                    description: Some("Input string to echo".to_string()),
                    default: Some(serde_json::Value::String("hello".to_string())),
                    enum_values: None,
                },
            );

            SkillDefinition {
                id: "echo".to_string(),
                name: "Echo Skill".to_string(),
                description: "Echoes the input string".to_string(),
                parameters: SkillParameters {
                    properties,
                    required: vec!["input".to_string()],
                },
                implementation: SkillImplementation::Native {
                    executor: "echo-executor".to_string(),
                },
                enabled: true,
                metadata: None,
            }
        }
    }

    #[tokio::test]
    async fn test_skill_execution_service_creation() {
        let service = SkillExecutionService::new();
        assert_eq!(service.config.skills_dir, PathBuf::from("./skills"));
        assert!(service.config.enable_native_execution);
        assert_eq!(service.skill_definitions.len(), 0);
    }

    #[tokio::test]
    async fn test_skill_execution_service_with_config() {
        let config = SkillExecutionConfig {
            skills_dir: PathBuf::from("/tmp/test-skills"),
            enable_bash_execution: false,
            enable_node_execution: true,
            default_timeout_ms: 15_000,
            max_concurrent_executions: Some(5),
            enable_logging: false,
            ..Default::default()
        };

        let service = SkillExecutionService::with_config(config);
        assert_eq!(service.config.skills_dir, PathBuf::from("/tmp/test-skills"));
        assert!(!service.config.enable_bash_execution);
        assert!(service.config.enable_node_execution);
    }

    #[tokio::test]
    async fn test_register_and_execute_native_skill() {
        let mut service = SkillExecutionService::new();

        // Register the echo skill
        service.register_native_executor(Box::new(EchoSkillExecutor));

        // Verify skill was registered
        assert!(service.has_skill("echo"));

        let skill_def = service.get_skill_definition("echo").unwrap();
        assert_eq!(skill_def.name, "Echo Skill");
        assert!(skill_def.enabled);

        // Execute the skill
        let mut args = HashMap::new();
        args.insert(
            "input".to_string(),
            serde_json::Value::String("test message".to_string()),
        );

        let request = SkillExecutionRequest {
            skill_id: "echo".to_string(),
            arguments: args,
            context: None,
            timeout_ms: None,
        };

        let response = service.execute_skill(request).await.unwrap();
        assert!(response.success);
        assert!(response.result.is_some());

        if let Some(result) = response.result {
            let output = result.get("output").and_then(|v| v.as_str()).unwrap();
            assert_eq!(output, "Echo: test message");
        }
    }

    #[tokio::test]
    async fn test_list_skills() {
        let mut service = SkillExecutionService::new();

        // Register a few skills
        for i in 1..=3 {
            let skill_def = SkillDefinition {
                id: format!("test-skill-{}", i),
                name: format!("Test Skill {}", i),
                description: format!("A test skill for testing {}", i),
                parameters: SkillParameters {
                    properties: HashMap::new(),
                    required: vec![],
                },
                implementation: SkillImplementation::Native {
                    executor: format!("test-executor-{}", i),
                },
                enabled: true,
                metadata: None,
            };

            service
                .skill_definitions
                .insert(skill_def.id.clone(), skill_def);
        }

        let skills = service.list_skills();
        assert_eq!(skills.len(), 3);

        // Verify skill names
        let skill_names: Vec<String> = skills.iter().map(|s| s.name.clone()).collect();

        assert!(skill_names.contains(&"Test Skill 1".to_string()));
        assert!(skill_names.contains(&"Test Skill 2".to_string()));
        assert!(skill_names.contains(&"Test Skill 3".to_string()));
    }

    #[tokio::test]
    async fn test_argument_validation() {
        let service = SkillExecutionService::new();

        let mut args = HashMap::new();
        args.insert(
            "nonexistent_param".to_string(),
            serde_json::Value::String("value".to_string()),
        );

        let params = SkillParameters {
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "input".to_string(),
                    SkillParameter {
                        param_type: "string".to_string(),
                        description: Some("Input parameter".to_string()),
                        default: None,
                        enum_values: None,
                    },
                );
                props
            },
            required: vec!["input".to_string()], // Required but not provided
        };

        let result = service.validate_arguments(&args, &params);
        assert!(result.is_err());

        match result.unwrap_err() {
            SkillExecutionError::ValidationError(msg) => {
                assert!(msg.contains("Missing required parameter"));
            }
            _ => panic!("Expected validation error"),
        }
    }

    #[tokio::test]
    async fn test_enum_validation() {
        let service = SkillExecutionService::new();

        let mut args = HashMap::new();
        args.insert(
            "mode".to_string(),
            serde_json::Value::String("invalid_mode".to_string()),
        );

        let params = SkillParameters {
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "mode".to_string(),
                    SkillParameter {
                        param_type: "string".to_string(),
                        description: Some("Operation mode".to_string()),
                        default: Some(serde_json::Value::String("normal".to_string())),
                        enum_values: Some(vec![
                            "normal".to_string(),
                            "debug".to_string(),
                            "verbose".to_string(),
                        ]),
                    },
                );
                props
            },
            required: vec!["mode".to_string()],
        };

        let result = service.validate_arguments(&args, &params);
        assert!(result.is_err());

        match result.unwrap_err() {
            SkillExecutionError::ValidationError(msg) => {
                assert!(msg.contains("not in allowed values"));
            }
            _ => panic!("Expected validation error"),
        }
    }

    #[test]
    fn test_security_policy_allowlist() {
        let config = SkillExecutionConfig {
            security_policy: SecurityPolicy::Allowlist {
                allowed_commands: vec![
                    "bash".to_string(),
                    "node".to_string(),
                    "python3".to_string(),
                ],
            },
            ..Default::default()
        };

        let service = SkillExecutionService::with_config(config);

        // Should allow bash
        assert!(service.check_security_policy("bash").is_ok());

        // Should allow node
        assert!(service.check_security_policy("node").is_ok());

        // Should deny unknown command
        let result = service.check_security_policy("rm");
        assert!(matches!(
            result,
            Err(SkillExecutionError::SecurityViolation(_))
        ));
    }

    #[test]
    fn test_security_policy_deny() {
        let config = SkillExecutionConfig {
            security_policy: SecurityPolicy::Deny,
            ..Default::default()
        };

        let service = SkillExecutionService::with_config(config);

        // Should deny all commands
        let result = service.check_security_policy("bash");
        assert!(matches!(
            result,
            Err(SkillExecutionError::SecurityViolation(_))
        ));
    }

    #[test]
    fn test_security_policy_allow() {
        let config = SkillExecutionConfig {
            security_policy: SecurityPolicy::Allow,
            ..Default::default()
        };

        let service = SkillExecutionService::with_config(config);

        // Should allow all commands
        assert!(service.check_security_policy("any-command").is_ok());
    }
}
