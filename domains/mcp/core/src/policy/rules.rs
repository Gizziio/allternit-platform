//! Default policy rules for MCP tools
//!
//! This module provides pre-built policy rules for common MCP tool
//! security scenarios. These rules can be registered with the A2R
//! policy engine to enforce security constraints on MCP tool calls.
//!
//! # Example
//!
//! ```rust
//! use mcp::policy::rules::default_mcp_rules;
//!
//! let rules = default_mcp_rules();
//! assert!(!rules.is_empty());
//! ```

use serde::{Deserialize, Serialize};

/// A policy rule for MCP tool evaluation
///
/// Rules define conditions that, when met, trigger specific actions.
/// Rules are evaluated in priority order (higher priority first).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    /// Unique identifier for this rule
    pub name: String,
    /// Human-readable description
    pub description: String,
    /// Condition to evaluate
    pub condition: RuleCondition,
    /// Action to take when condition matches
    pub action: RuleAction,
    /// Priority (higher = evaluated first)
    pub priority: i32,
    /// Whether this rule is enabled
    pub enabled: bool,
}

/// Conditions for rule evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuleCondition {
    /// Match if field equals value
    FieldEquals {
        field: String,
        value: serde_json::Value,
    },
    /// Match if field contains substring
    FieldContains { field: String, substring: String },
    /// Match if field starts with prefix
    FieldStartsWith { field: String, prefix: String },
    /// Match if all conditions are true
    And(Vec<RuleCondition>),
    /// Match if any condition is true
    Or(Vec<RuleCondition>),
    /// Match if condition is false
    Not(Box<RuleCondition>),
    /// Match if tool category matches
    ToolCategory { category: String },
    /// Match if safety tier is at least
    MinTier { tier: u8 },
    /// Match if parameter matches pattern
    ParameterMatches { param: String, pattern: String },
    /// Always match
    Always,
    /// Never match
    Never,
}

/// Actions to take when a rule matches
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuleAction {
    /// Allow the tool call
    Allow,
    /// Deny the tool call with reason
    Deny { reason: String },
    /// Require approval with prompt
    RequireApproval { prompt: String },
    /// Apply rate limiting
    RateLimit {
        max_requests: u32,
        window_seconds: u64,
    },
    /// Require audit logging
    Audit,
    /// Modify parameters
    ModifyParameters {
        modifications: Vec<ParameterModification>,
    },
    /// Log and continue
    Log { level: LogLevel, message: String },
}

/// Parameter modification for sanitization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterModification {
    /// Parameter path (e.g., "path", "command", "url")
    pub param: String,
    /// Type of modification
    pub modification: ModificationType,
}

/// Types of parameter modifications
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ModificationType {
    /// Prepend a string
    Prepend { value: String },
    /// Append a string
    Append { value: String },
    /// Replace matching pattern
    Replace {
        pattern: String,
        replacement: String,
    },
    /// Ensure path is within allowed directories
    RestrictPath { allowed_prefixes: Vec<String> },
    /// Block dangerous patterns
    BlockPattern { patterns: Vec<String> },
}

/// Log levels for rule logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

/// Get the default set of MCP policy rules
///
/// These rules provide a secure baseline for MCP tool execution:
///
/// 1. Block dangerous system commands (rm -rf, etc.)
/// 2. Require approval for file writes outside workspace
/// 3. Rate limit network requests
/// 4. Audit all system command execution
/// 5. Block access to sensitive files
///
/// # Returns
///
/// A vector of `Rule` objects ready to be registered with the policy engine
///
/// # Example
///
/// ```rust
/// use mcp::policy::rules::default_mcp_rules;
///
/// let rules = default_mcp_rules();
/// assert!(rules.iter().any(|r| r.name == "mcp.block_dangerous_commands"));
/// assert!(rules.iter().any(|r| r.name == "mcp.approve_external_writes"));
/// ```
pub fn default_mcp_rules() -> Vec<Rule> {
    vec![
        // Rule 1: Block dangerous system commands
        Rule {
            name: "mcp.block_dangerous_commands".to_string(),
            description: "Block MCP tools that execute dangerous system commands".to_string(),
            condition: RuleCondition::And(vec![
                RuleCondition::ToolCategory {
                    category: "System".to_string(),
                },
                RuleCondition::Or(vec![
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: "rm -rf".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: "rm -fr".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: "mkfs".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: "dd if=".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: "> /dev/sda".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: ":(){ :|:& };:".to_string(),
                    },
                ]),
            ]),
            action: RuleAction::Deny {
                reason: "Dangerous command pattern detected".to_string(),
            },
            priority: 100,
            enabled: true,
        },
        // Rule 2: Require approval for file writes outside workspace
        Rule {
            name: "mcp.approve_external_writes".to_string(),
            description: "Require approval for file writes outside the workspace".to_string(),
            condition: RuleCondition::And(vec![
                RuleCondition::ToolCategory {
                    category: "FileSystem".to_string(),
                },
                RuleCondition::Or(vec![
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "write".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "create".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "delete".to_string(),
                    },
                ]),
                RuleCondition::Not(Box::new(RuleCondition::Or(vec![
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: "/workspace".to_string(),
                    },
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: "./".to_string(),
                    },
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: ".".to_string(),
                    },
                ]))),
            ]),
            action: RuleAction::RequireApproval {
                prompt: "This tool will modify files outside the workspace. Approve?".to_string(),
            },
            priority: 90,
            enabled: true,
        },
        // Rule 3: Block access to sensitive system files
        Rule {
            name: "mcp.block_sensitive_files".to_string(),
            description: "Block access to sensitive system files".to_string(),
            condition: RuleCondition::And(vec![
                RuleCondition::ToolCategory {
                    category: "FileSystem".to_string(),
                },
                RuleCondition::Or(vec![
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: "/etc/passwd".to_string(),
                    },
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: "/etc/shadow".to_string(),
                    },
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: "/etc/ssh".to_string(),
                    },
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: "/root".to_string(),
                    },
                    RuleCondition::FieldStartsWith {
                        field: "parameters.path".to_string(),
                        prefix: "/home".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.path".to_string(),
                        substring: ".ssh".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.path".to_string(),
                        substring: ".aws".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.path".to_string(),
                        substring: ".env".to_string(),
                    },
                ]),
            ]),
            action: RuleAction::Deny {
                reason: "Access to sensitive system files is not permitted".to_string(),
            },
            priority: 95,
            enabled: true,
        },
        // Rule 4: Rate limit network requests
        Rule {
            name: "mcp.rate_limit_network".to_string(),
            description: "Rate limit MCP network tools".to_string(),
            condition: RuleCondition::ToolCategory {
                category: "Network".to_string(),
            },
            action: RuleAction::RateLimit {
                max_requests: 100,
                window_seconds: 60,
            },
            priority: 10,
            enabled: true,
        },
        // Rule 5: Audit all system command execution
        Rule {
            name: "mcp.audit_system_commands".to_string(),
            description: "Audit all system command executions".to_string(),
            condition: RuleCondition::ToolCategory {
                category: "System".to_string(),
            },
            action: RuleAction::Audit,
            priority: 50,
            enabled: true,
        },
        // Rule 6: Require approval for database write operations
        Rule {
            name: "mcp.approve_database_writes".to_string(),
            description: "Require approval for destructive database operations".to_string(),
            condition: RuleCondition::And(vec![
                RuleCondition::ToolCategory {
                    category: "Database".to_string(),
                },
                RuleCondition::Or(vec![
                    RuleCondition::FieldContains {
                        field: "parameters.query".to_string(),
                        substring: "DROP".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.query".to_string(),
                        substring: "DELETE".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.query".to_string(),
                        substring: "TRUNCATE".to_string(),
                    },
                ]),
            ]),
            action: RuleAction::RequireApproval {
                prompt: "This database operation is destructive. Approve?".to_string(),
            },
            priority: 80,
            enabled: true,
        },
        // Rule 7: Block requests to internal/private IPs
        Rule {
            name: "mcp.block_internal_ips".to_string(),
            description: "Block network requests to internal/private IP addresses".to_string(),
            condition: RuleCondition::And(vec![
                RuleCondition::ToolCategory {
                    category: "Network".to_string(),
                },
                RuleCondition::Or(vec![
                    RuleCondition::FieldContains {
                        field: "parameters.url".to_string(),
                        substring: "localhost".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.url".to_string(),
                        substring: "127.0.0.1".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.url".to_string(),
                        substring: "192.168.".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.url".to_string(),
                        substring: "10.0.".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.url".to_string(),
                        substring: "172.16.".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.url".to_string(),
                        substring: "0.0.0.0".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.url".to_string(),
                        substring: "::1".to_string(),
                    },
                ]),
            ]),
            action: RuleAction::Deny {
                reason: "Requests to internal/private addresses are not permitted".to_string(),
            },
            priority: 85,
            enabled: true,
        },
        // Rule 8: Log all file system modifications
        Rule {
            name: "mcp.log_filesystem_changes".to_string(),
            description: "Log all file system modification operations".to_string(),
            condition: RuleCondition::And(vec![
                RuleCondition::ToolCategory {
                    category: "FileSystem".to_string(),
                },
                RuleCondition::Or(vec![
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "write".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "create".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "delete".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "move".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "tool_name".to_string(),
                        substring: "copy".to_string(),
                    },
                ]),
            ]),
            action: RuleAction::Log {
                level: LogLevel::Info,
                message: "File system modification attempted".to_string(),
            },
            priority: 20,
            enabled: true,
        },
        // Rule 9: Restrict high-tier operations to business hours
        Rule {
            name: "mcp.warn_high_tier".to_string(),
            description: "Log warnings for high-tier (T3+) operations".to_string(),
            condition: RuleCondition::MinTier { tier: 3 },
            action: RuleAction::Log {
                level: LogLevel::Warn,
                message: "High-tier (T3+) operation attempted".to_string(),
            },
            priority: 30,
            enabled: true,
        },
        // Rule 10: Allow all T0-T1 operations by default
        Rule {
            name: "mcp.allow_low_tier".to_string(),
            description: "Allow all low-tier (T0-T1) operations".to_string(),
            condition: RuleCondition::Or(vec![
                RuleCondition::MinTier { tier: 0 },
                RuleCondition::MinTier { tier: 1 },
            ]),
            action: RuleAction::Allow,
            priority: 1,
            enabled: true,
        },
    ]
}

/// Get rules suitable for development environments
///
/// These rules are less strict than the default rules, allowing
/// more flexibility for development while still blocking obviously
/// dangerous operations.
///
/// # Returns
///
/// A vector of `Rule` objects with development-friendly settings
pub fn development_mcp_rules() -> Vec<Rule> {
    let mut rules = default_mcp_rules();

    // Disable external write approval in development
    for rule in &mut rules {
        if rule.name == "mcp.approve_external_writes" {
            rule.enabled = false;
        }
        if rule.name == "mcp.block_internal_ips" {
            rule.enabled = false;
        }
    }

    rules
}

/// Get rules for CI/CD environments
///
/// These rules are optimized for automated CI/CD pipelines,
/// emphasizing audit logging and allowing common build operations.
///
/// # Returns
///
/// A vector of `Rule` objects suitable for CI/CD environments
pub fn cicd_mcp_rules() -> Vec<Rule> {
    vec![
        Rule {
            name: "mcp.cicd.block_dangerous".to_string(),
            description: "Block obviously dangerous commands in CI".to_string(),
            condition: RuleCondition::And(vec![
                RuleCondition::ToolCategory {
                    category: "System".to_string(),
                },
                RuleCondition::Or(vec![
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: "rm -rf /".to_string(),
                    },
                    RuleCondition::FieldContains {
                        field: "parameters.command".to_string(),
                        substring: "mkfs".to_string(),
                    },
                ]),
            ]),
            action: RuleAction::Deny {
                reason: "Dangerous command blocked in CI environment".to_string(),
            },
            priority: 100,
            enabled: true,
        },
        Rule {
            name: "mcp.cicd.audit_all".to_string(),
            description: "Audit all tool executions in CI".to_string(),
            condition: RuleCondition::Always,
            action: RuleAction::Audit,
            priority: 1,
            enabled: true,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_rules_not_empty() {
        let rules = default_mcp_rules();
        assert!(!rules.is_empty());
    }

    #[test]
    fn test_dangerous_commands_rule_exists() {
        let rules = default_mcp_rules();
        assert!(rules
            .iter()
            .any(|r| r.name == "mcp.block_dangerous_commands"));
    }

    #[test]
    fn test_external_writes_rule_exists() {
        let rules = default_mcp_rules();
        assert!(rules
            .iter()
            .any(|r| r.name == "mcp.approve_external_writes"));
    }

    #[test]
    fn test_development_rules() {
        let rules = development_mcp_rules();
        let external_writes = rules
            .iter()
            .find(|r| r.name == "mcp.approve_external_writes");
        assert!(external_writes.is_some());
        assert!(!external_writes.unwrap().enabled);
    }

    #[test]
    fn test_cicd_rules() {
        let rules = cicd_mcp_rules();
        assert!(rules.iter().any(|r| r.name == "mcp.cicd.audit_all"));
    }

    #[test]
    fn test_rule_priority_ordering() {
        let rules = default_mcp_rules();
        // Higher priority rules should come first in default set
        let priorities: Vec<i32> = rules.iter().map(|r| r.priority).collect();
        assert!(priorities[0] >= priorities[priorities.len() - 1]);
    }
}
