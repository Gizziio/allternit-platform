//! Command Hooks System
//!
//! Provides pre/post command hook execution for the TUI.
//! Hooks are defined in a configuration file and executed automatically.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tokio::process::Command;
use tracing::{debug, error, info, warn};

/// Hook execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

/// Hook type (when to execute)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookType {
    /// Execute before command
    PreCommand,
    /// Execute after command
    PostCommand,
}

impl HookType {
    /// Parse hook type from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "pre_command" | "precommand" | "pre" => Some(HookType::PreCommand),
            "post_command" | "postcommand" | "post" => Some(HookType::PostCommand),
            _ => None,
        }
    }
}

/// Hook configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookConfig {
    /// Hook name/identifier
    pub name: String,
    /// Hook type
    pub r#type: HookType,
    /// Command to execute
    pub command: String,
    /// Command arguments
    #[serde(default)]
    pub args: Vec<String>,
    /// Working directory
    #[serde(default)]
    pub cwd: Option<String>,
    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Whether hook is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Continue on error (for pre-command hooks)
    #[serde(default)]
    pub continue_on_error: bool,
}

fn default_true() -> bool {
    true
}

/// Hooks configuration file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HooksConfig {
    /// List of hooks
    #[serde(default)]
    pub hooks: Vec<HookConfig>,
    /// Global settings
    #[serde(default)]
    pub settings: HookSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HookSettings {
    /// Enable/disable all hooks
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Timeout for hook execution (seconds)
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

fn default_timeout() -> u64 {
    30
}

impl Default for HooksConfig {
    fn default() -> Self {
        Self {
            hooks: Vec::new(),
            settings: HookSettings {
                enabled: true,
                timeout_secs: 30,
            },
        }
    }
}

/// Hook execution context
#[derive(Debug, Clone)]
pub struct HookContext {
    /// Command being executed
    pub command: String,
    /// Current working directory
    pub cwd: PathBuf,
    /// Additional context data
    pub data: HashMap<String, String>,
}

impl HookContext {
    /// Create context for a command
    pub fn for_command(command: &str) -> Self {
        Self {
            command: command.to_string(),
            cwd: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            data: HashMap::new(),
        }
    }

    /// Create context with additional data
    pub fn with_data(mut self, key: &str, value: &str) -> Self {
        self.data.insert(key.to_string(), value.to_string());
        self
    }
}

/// Hook manager - loads and executes hooks
pub struct HookManager {
    config_path: PathBuf,
    config: HooksConfig,
    last_reload: std::time::Instant,
}

impl HookManager {
    /// Create a new hook manager
    pub fn new(config_path: &Path) -> Self {
        let config = Self::load_config(config_path).unwrap_or_default();
        Self {
            config_path: config_path.to_path_buf(),
            config,
            last_reload: std::time::Instant::now(),
        }
    }

    /// Load configuration from file
    fn load_config(path: &Path) -> Result<HooksConfig, anyhow::Error> {
        if !path.exists() {
            debug!("Hooks config file does not exist: {:?}", path);
            return Ok(HooksConfig::default());
        }

        let content = fs::read_to_string(path)?;
        let config: HooksConfig = serde_yaml::from_str(&content)?;
        Ok(config)
    }

    /// Create default configuration file
    pub fn create_default_config(path: &Path) -> Result<(), anyhow::Error> {
        let config = HooksConfig {
            hooks: vec![
                HookConfig {
                    name: "git status".to_string(),
                    r#type: HookType::PreCommand,
                    command: "git".to_string(),
                    args: vec!["status".to_string(), "--short".to_string()],
                    cwd: None,
                    env: HashMap::new(),
                    enabled: true,
                    continue_on_error: true,
                },
                HookConfig {
                    name: "log command".to_string(),
                    r#type: HookType::PostCommand,
                    command: "echo".to_string(),
                    args: vec!["Command executed:".to_string(), "$COMMAND".to_string()],
                    cwd: None,
                    env: HashMap::new(),
                    enabled: false,
                    continue_on_error: true,
                },
            ],
            settings: HookSettings {
                enabled: true,
                timeout_secs: 30,
            },
        };

        let content = serde_yaml::to_string(&config)?;
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        fs::write(path, content)?;
        Ok(())
    }

    /// Reload configuration from file
    pub fn reload(&mut self) {
        match Self::load_config(&self.config_path) {
            Ok(config) => {
                self.config = config;
                self.last_reload = std::time::Instant::now();
                info!("Hooks configuration reloaded");
            }
            Err(e) => {
                error!("Failed to reload hooks config: {}", e);
            }
        }
    }

    /// Check if hooks are enabled
    pub fn is_enabled(&self) -> bool {
        self.config.settings.enabled
    }

    /// Get hooks of a specific type
    pub fn get_hooks(&self, hook_type: HookType) -> Vec<&HookConfig> {
        self.config
            .hooks
            .iter()
            .filter(|h| h.r#type == hook_type && h.enabled)
            .collect()
    }

    /// Execute hooks of a specific type
    pub async fn execute_hooks(
        &self,
        hook_type: HookType,
        context: &HookContext,
    ) -> Vec<(String, HookResult)> {
        if !self.config.settings.enabled {
            debug!("Hooks are disabled");
            return Vec::new();
        }

        let hooks = self.get_hooks(hook_type);
        if hooks.is_empty() {
            return Vec::new();
        }

        let mut results = Vec::new();

        for hook in hooks {
            debug!("Executing hook: {}", hook.name);
            
            let result = self.execute_hook(hook, context).await;
            
            results.push((hook.name.clone(), result.clone()));
            
            if !result.success && !hook.continue_on_error {
                warn!("Hook '{}' failed, stopping hook chain", hook.name);
                break;
            }
        }

        results
    }

    /// Execute a single hook
    async fn execute_hook(&self, hook: &HookConfig, context: &HookContext) -> HookResult {
        let timeout = std::time::Duration::from_secs(self.config.settings.timeout_secs);

        // Build command
        let mut cmd = Command::new(&hook.command);
        cmd.args(&hook.args);

        // Set working directory
        if let Some(cwd) = &hook.cwd {
            cmd.current_dir(cwd);
        } else {
            cmd.current_dir(&context.cwd);
        }

        // Set environment variables
        cmd.env("COMMAND", &context.command);
        cmd.env("CWD", context.cwd.display().to_string());
        for (key, value) in &hook.env {
            cmd.env(key, value);
        }
        for (key, value) in &context.data {
            cmd.env(key, value);
        }

        // Execute with timeout
        match tokio::time::timeout(timeout, cmd.output()).await {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let success = output.status.success();
                let exit_code = output.status.code();

                if success {
                    debug!("Hook '{}' completed successfully", hook.name);
                } else {
                    warn!("Hook '{}' failed with exit code: {:?}", hook.name, exit_code);
                }

                HookResult {
                    success,
                    stdout,
                    stderr,
                    exit_code,
                }
            }
            Ok(Err(e)) => {
                error!("Hook '{}' execution failed: {}", hook.name, e);
                HookResult {
                    success: false,
                    stdout: String::new(),
                    stderr: e.to_string(),
                    exit_code: None,
                }
            }
            Err(_) => {
                error!("Hook '{}' timed out after {}s", hook.name, timeout.as_secs());
                HookResult {
                    success: false,
                    stdout: String::new(),
                    stderr: format!("Timeout after {}s", timeout.as_secs()),
                    exit_code: None,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_type_from_str() {
        assert_eq!(HookType::from_str("pre"), Some(HookType::PreCommand));
        assert_eq!(HookType::from_str("pre_command"), Some(HookType::PreCommand));
        assert_eq!(HookType::from_str("post"), Some(HookType::PostCommand));
        assert_eq!(HookType::from_str("post_command"), Some(HookType::PostCommand));
        assert_eq!(HookType::from_str("invalid"), None);
    }

    #[test]
    fn test_hook_context() {
        let ctx = HookContext::for_command("test command");
        assert_eq!(ctx.command, "test command");
    }

    #[tokio::test]
    async fn test_execute_hook_success() {
        let config = HooksConfig {
            hooks: vec![HookConfig {
                name: "test".to_string(),
                r#type: HookType::PreCommand,
                command: "echo".to_string(),
                args: vec!["hello".to_string()],
                cwd: None,
                env: HashMap::new(),
                enabled: true,
                continue_on_error: true,
            }],
            settings: HookSettings {
                enabled: true,
                timeout_secs: 30,
            },
        };

        let manager = HookManager {
            config_path: PathBuf::from("test.yml"),
            config,
            last_reload: std::time::Instant::now(),
        };

        let ctx = HookContext::for_command("test");
        let results = manager
            .execute_hooks(HookType::PreCommand, &ctx)
            .await;

        assert_eq!(results.len(), 1);
        assert!(results[0].1.success);
        assert!(results[0].1.stdout.contains("hello"));
    }
}
