//! Bash Tool Execution Native - OC-013
//!
//! Native Rust implementation of OpenClaw's bash tool execution functionality.
//! This module provides the native implementation that will eventually replace
//! the OpenClaw subprocess version.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::process::Command;

/// Bash execution parameters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BashExecutionParams {
    /// The shell command to execute
    pub command: String,

    /// Working directory (defaults to current directory)
    #[serde(default)]
    pub workdir: Option<PathBuf>,

    /// Environment variables to set
    #[serde(default)]
    pub env: HashMap<String, String>,

    /// Milliseconds to wait before backgrounding (default 10000)
    #[serde(default)]
    pub yield_ms: Option<u64>,

    /// Run in background immediately
    #[serde(default)]
    pub background: bool,

    /// Timeout in seconds (optional, kills process on expiry)
    #[serde(default)]
    pub timeout: Option<u64>,

    /// Run in a pseudo-terminal (PTY) when available
    #[serde(default)]
    pub pty: Option<bool>,

    /// Run on the host with elevated permissions (if allowed)
    #[serde(default)]
    pub elevated: Option<bool>,

    /// Execution host (sandbox|gateway|node)
    #[serde(default)]
    pub host: Option<String>,

    /// Execution security mode (deny|allowlist|full)
    #[serde(default)]
    pub security: Option<String>,

    /// Execution ask mode (off|on-miss|always)
    #[serde(default)]
    pub ask: Option<String>,

    /// Maximum output characters to capture
    #[serde(default = "default_max_output")]
    pub max_output: u32,
}

fn default_max_output() -> u32 {
    200_000 // Default from OpenClaw
}

/// Bash execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BashExecutionResult {
    /// Exit code of the process
    pub exit_code: Option<i32>,

    /// Standard output
    pub stdout: String,

    /// Standard error
    pub stderr: String,

    /// Execution duration in milliseconds
    pub duration_ms: u64,

    /// Whether the process timed out
    pub timed_out: bool,

    /// Process ID (if available)
    pub pid: Option<u32>,

    /// Error message if execution failed
    pub error: Option<String>,
}

/// Bash execution error
#[derive(Debug, thiserror::Error)]
pub enum BashExecutionError {
    #[error("Command execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Timeout error")]
    Timeout,

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid command: {0}")]
    InvalidCommand(String),

    #[error("Security violation: {0}")]
    SecurityViolation(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

/// Security mode for bash execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SecurityMode {
    #[serde(rename = "deny")]
    Deny,
    #[serde(rename = "allowlist")]
    Allowlist,
    #[serde(rename = "full")]
    Full,
}

/// Ask mode for bash execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AskMode {
    #[serde(rename = "off")]
    Off,
    #[serde(rename = "on-miss")]
    OnMiss,
    #[serde(rename = "always")]
    Always,
}

/// Bash execution configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BashExecutionConfig {
    /// Default maximum output characters
    pub default_max_output: u32,

    /// Default timeout in seconds
    pub default_timeout_sec: u64,

    /// Allowed commands (for security)
    pub allowed_commands: Vec<String>,

    /// Blocked commands (for security)
    pub blocked_commands: Vec<String>,

    /// Whether to allow elevated execution
    pub allow_elevated: bool,

    /// Base working directory
    pub base_workdir: Option<PathBuf>,

    /// Environment variables to always include
    pub default_env: HashMap<String, String>,
}

impl Default for BashExecutionConfig {
    fn default() -> Self {
        Self {
            default_max_output: 200_000,
            default_timeout_sec: 30, // 30 seconds default
            allowed_commands: vec![
                "ls".to_string(),
                "cat".to_string(),
                "echo".to_string(),
                "pwd".to_string(),
                "cd".to_string(),
                "mkdir".to_string(),
                "rm".to_string(),
                "cp".to_string(),
                "mv".to_string(),
                "touch".to_string(),
                "grep".to_string(),
                "find".to_string(),
                "ps".to_string(),
                "top".to_string(),
                "htop".to_string(),
                "df".to_string(),
                "du".to_string(),
                "free".to_string(),
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
            blocked_commands: vec![
                "rm -rf /".to_string(),
                "mkfs".to_string(),
                "dd".to_string(),
                "shutdown".to_string(),
                "halt".to_string(),
                "reboot".to_string(),
                "poweroff".to_string(),
                "passwd".to_string(),
                "su".to_string(),
                "sudo".to_string(), // Unless explicitly allowed
            ],
            allow_elevated: false,
            base_workdir: None,
            default_env: {
                let mut env = HashMap::new();
                env.insert(
                    "PATH".to_string(),
                    "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin".to_string(),
                );
                env.insert("TERM".to_string(), "xterm-256color".to_string());
                env
            },
        }
    }
}

/// Bash execution service
pub struct BashExecutor {
    config: BashExecutionConfig,
}

impl BashExecutor {
    /// Create new bash executor with default configuration
    pub fn new() -> Self {
        Self {
            config: BashExecutionConfig::default(),
        }
    }

    /// Create new bash executor with custom configuration
    pub fn with_config(config: BashExecutionConfig) -> Self {
        Self { config }
    }

    /// Execute a bash command with the given parameters
    pub async fn execute(
        &self,
        params: BashExecutionParams,
    ) -> Result<BashExecutionResult, BashExecutionError> {
        // Validate command security
        self.validate_command_security(&params)?;

        // Prepare the command
        let mut cmd = Command::new("bash");
        cmd.arg("-c").arg(&params.command);

        // Set working directory
        if let Some(workdir) = &params.workdir {
            cmd.current_dir(workdir);
        } else if let Some(base_workdir) = &self.config.base_workdir {
            cmd.current_dir(base_workdir);
        }

        // Set environment variables
        for (key, value) in &self.config.default_env {
            cmd.env(key, value);
        }
        for (key, value) in &params.env {
            cmd.env(key, value);
        }

        // Add timeout logic
        let timeout_duration = std::time::Duration::from_secs(
            params.timeout.unwrap_or(self.config.default_timeout_sec),
        );

        let start_time = std::time::Instant::now();

        // Execute the command with timeout
        let output = match tokio::time::timeout(timeout_duration, cmd.output()).await {
            Ok(Ok(output)) => {
                let duration = start_time.elapsed().as_millis() as u64;
                self.process_output(output, duration, false)
            }
            Ok(Err(io_err)) => {
                return Err(BashExecutionError::ExecutionFailed(io_err.to_string()));
            }
            Err(_) => {
                // Timed out
                let duration = start_time.elapsed().as_millis() as u64;
                return Ok(BashExecutionResult {
                    exit_code: None,
                    stdout: String::new(),
                    stderr: "Command timed out".to_string(),
                    duration_ms: duration,
                    timed_out: true,
                    pid: None, // We don't have PID for timed out processes
                    error: Some("Command timed out".to_string()),
                });
            }
        };

        Ok(output)
    }

    /// Validate command against security policies
    fn validate_command_security(
        &self,
        params: &BashExecutionParams,
    ) -> Result<(), BashExecutionError> {
        // Check if elevated execution is allowed
        if params.elevated.unwrap_or(false) && !self.config.allow_elevated {
            return Err(BashExecutionError::PermissionDenied(
                "Elevated execution not allowed".to_string(),
            ));
        }

        // Check blocked commands
        for blocked in &self.config.blocked_commands {
            if params.command.contains(blocked) {
                return Err(BashExecutionError::SecurityViolation(format!(
                    "Command contains blocked pattern: {}",
                    blocked
                )));
            }
        }

        // Check allowed commands if in allowlist mode
        if params.security.as_deref() == Some("allowlist") {
            let first_word = params.command.split_whitespace().next().unwrap_or("");
            if !self
                .config
                .allowed_commands
                .contains(&first_word.to_string())
            {
                return Err(BashExecutionError::SecurityViolation(format!(
                    "Command '{}' not in allowed list",
                    first_word
                )));
            }
        }

        // Basic validation - check for dangerous patterns
        if params.command.contains("&&") || params.command.contains("||") {
            // These are often legitimate, but could be restricted based on security level
            // For now, we'll allow them but could add more sophisticated validation
        }

        Ok(())
    }

    /// Process command output into result
    fn process_output(
        &self,
        output: std::process::Output,
        duration_ms: u64,
        timed_out: bool,
    ) -> BashExecutionResult {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Truncate output if it exceeds max length
        let stdout = if stdout.len() > self.config.default_max_output as usize {
            stdout
                .chars()
                .take(self.config.default_max_output as usize)
                .collect()
        } else {
            stdout.to_string()
        };

        let stderr = if stderr.len() > self.config.default_max_output as usize {
            stderr
                .chars()
                .take(self.config.default_max_output as usize)
                .collect()
        } else {
            stderr.to_string()
        };

        // Create error message before moving stderr
        let error_msg = if !output.status.success() && output.status.code() != Some(0) {
            Some(format!(
                "Command failed with exit code: {:?}",
                output.status.code()
            ))
        } else if !stderr.is_empty() {
            Some(stderr.clone())
        } else {
            None
        };

        BashExecutionResult {
            exit_code: output.status.code(),
            stdout,
            stderr,
            duration_ms,
            timed_out,
            pid: None, // We don't have PID after execution completes
            error: error_msg,
        }
    }

    /// Update the executor configuration
    pub fn set_config(&mut self, config: BashExecutionConfig) {
        self.config = config;
    }

    /// Get current configuration
    pub fn config(&self) -> &BashExecutionConfig {
        &self.config
    }
}

impl Default for BashExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[test]
    fn test_bash_executor_creation() {
        let executor = BashExecutor::new();
        assert_eq!(executor.config.default_max_output, 200_000);
        assert_eq!(executor.config.default_timeout_sec, 30);
    }

    #[test]
    fn test_bash_execution_params() {
        let params = BashExecutionParams {
            command: "echo hello".to_string(),
            workdir: Some(PathBuf::from("/tmp")),
            env: {
                let mut env = HashMap::new();
                env.insert("TEST_VAR".to_string(), "test_value".to_string());
                env
            },
            yield_ms: Some(1000),
            background: false,
            timeout: Some(10),
            pty: Some(false),
            elevated: Some(false),
            host: Some("local".to_string()),
            security: Some("allowlist".to_string()),
            ask: Some("off".to_string()),
            max_output: 1000,
        };

        assert_eq!(params.command, "echo hello");
        assert_eq!(params.workdir, Some(PathBuf::from("/tmp")));
    }

    #[tokio::test]
    async fn test_simple_command_execution() {
        let executor = BashExecutor::new();
        let params = BashExecutionParams {
            command: "echo 'hello world'".to_string(),
            workdir: None,
            env: HashMap::new(),
            yield_ms: None,
            background: false,
            timeout: Some(5), // 5 second timeout
            pty: None,
            elevated: None,
            host: None,
            security: Some("allowlist".to_string()),
            ask: None,
            max_output: 1000,
        };

        let result = executor.execute(params).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(output.stdout.contains("hello world"));
        assert_eq!(output.exit_code, Some(0));
    }

    #[test]
    fn test_security_validation() {
        let config = BashExecutionConfig {
            allowed_commands: vec!["echo".to_string(), "ls".to_string()],
            blocked_commands: vec!["rm -rf /".to_string()],
            allow_elevated: false,
            ..Default::default()
        };

        let executor = BashExecutor::with_config(config);

        // Test allowed command
        let allowed_params = BashExecutionParams {
            command: "echo hello".to_string(),
            security: Some("allowlist".to_string()),
            elevated: Some(false),
            ..Default::default()
        };
        assert!(executor.validate_command_security(&allowed_params).is_ok());

        // Test blocked command
        let blocked_params = BashExecutionParams {
            command: "rm -rf /".to_string(),
            security: None,
            elevated: Some(false),
            ..Default::default()
        };
        assert!(executor.validate_command_security(&blocked_params).is_err());
    }
}
