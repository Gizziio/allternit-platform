//! Policy context extraction for MCP tool calls
//!
//! This module provides functionality to extract policy context from MCP tool
//! requests, enabling the A2R policy engine to make informed decisions about
//! tool execution.
//!
//! # Example
//!
//! ```rust
//! use mcp::policy::context::{McpPolicyContext, McpToolCategory};
//! use mcp::types::CallToolRequest;
//!
//! let request = CallToolRequest {
//!     name: "read_file".to_string(),
//!     arguments: Some(serde_json::json!({"path": "/tmp/test.txt"})),
//! };
//!
//! let context = McpPolicyContext::from_request(
//!     "server-1".to_string(),
//!     "filesystem".to_string(),
//!     &request,
//! );
//!
//! assert_eq!(context.tool_category, McpToolCategory::FileSystem);
//! ```

use a2rchitech_sdk_policy::SafetyTier;
use serde::{Deserialize, Serialize};

use crate::types::CallToolRequest;

/// Policy context for MCP tool calls
///
/// This struct contains all the information needed to evaluate a policy
/// decision for an MCP tool execution request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPolicyContext {
    /// Unique identifier for the MCP server
    pub server_id: String,
    /// Human-readable name of the MCP server
    pub server_name: String,
    /// Name of the tool being called
    pub tool_name: String,
    /// Category of the tool (determines safety tier)
    pub tool_category: McpToolCategory,
    /// Tool parameters/arguments
    pub parameters: serde_json::Value,
}

/// Categories of MCP tools based on their risk profile
///
/// Each category maps to a default safety tier that determines
/// the level of scrutiny applied by the policy engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum McpToolCategory {
    /// File system operations (read/write files)
    /// Maps to SafetyTier::T2 (Controlled)
    FileSystem,
    /// Network operations (HTTP, fetch)
    /// Maps to SafetyTier::T2 (Controlled)
    Network,
    /// System operations (execute commands)
    /// Maps to SafetyTier::T3 (High risk)
    System,
    /// Database operations (SQL queries)
    /// Maps to SafetyTier::T2 (Controlled)
    Database,
    /// External API operations
    /// Maps to SafetyTier::T1 (Standard)
    Api,
    /// Uncategorized tools
    /// Maps to SafetyTier::T1 (Standard)
    Generic,
}

impl McpPolicyContext {
    /// Create a policy context from an MCP tool request
    ///
    /// # Arguments
    ///
    /// * `server_id` - Unique identifier for the MCP server
    /// * `server_name` - Human-readable name of the server
    /// * `request` - The tool call request
    ///
    /// # Returns
    ///
    /// A new `McpPolicyContext` with the tool automatically categorized
    ///
    /// # Example
    ///
    /// ```rust
    /// use mcp::policy::context::McpPolicyContext;
    /// use mcp::types::CallToolRequest;
    ///
    /// let request = CallToolRequest {
    ///     name: "write_file".to_string(),
    ///     arguments: None,
    /// };
    ///
    /// let context = McpPolicyContext::from_request(
    ///     "fs-server".to_string(),
    ///     "filesystem".to_string(),
    ///     &request,
    /// );
    ///
    /// assert_eq!(context.tool_name, "write_file");
    /// ```
    pub fn from_request(server_id: String, server_name: String, request: &CallToolRequest) -> Self {
        let category = categorize_tool(&request.name);

        Self {
            server_id,
            server_name,
            tool_name: request.name.clone(),
            tool_category: category,
            parameters: request.arguments.clone().unwrap_or_default(),
        }
    }

    /// Map MCP tool category to A2R SafetyTier
    ///
    /// # Returns
    ///
    /// The `SafetyTier` corresponding to this tool's category:
    /// - FileSystem, Network, Database → T2 (Controlled)
    /// - System → T3 (High risk)
    /// - Api, Generic → T1 (Standard)
    ///
    /// # Example
    ///
    /// ```rust
    /// use mcp::policy::context::{McpPolicyContext, McpToolCategory};
    /// use a2rchitech_sdk_policy::SafetyTier;
    ///
    /// let context = McpPolicyContext {
    ///     server_id: "test".to_string(),
    ///     server_name: "test".to_string(),
    ///     tool_name: "exec".to_string(),
    ///     tool_category: McpToolCategory::System,
    ///     parameters: serde_json::Value::Null,
    /// };
    ///
    /// assert!(matches!(context.to_safety_tier(), SafetyTier::T3));
    /// ```
    pub fn to_safety_tier(&self) -> SafetyTier {
        match self.tool_category {
            McpToolCategory::FileSystem => SafetyTier::T2, // Controlled
            McpToolCategory::Network => SafetyTier::T2,    // Controlled
            McpToolCategory::System => SafetyTier::T3,     // High risk
            McpToolCategory::Database => SafetyTier::T2,   // Controlled
            McpToolCategory::Api => SafetyTier::T1,        // Standard
            McpToolCategory::Generic => SafetyTier::T1,    // Standard
        }
    }

    /// Check if this tool operates on a specific path
    ///
    /// # Arguments
    ///
    /// * `path` - The path to check for
    ///
    /// # Returns
    ///
    /// `true` if the tool parameters contain the given path
    pub fn has_path(&self, path: &str) -> bool {
        self.parameters
            .get("path")
            .and_then(|p| p.as_str())
            .map(|p| p.starts_with(path))
            .unwrap_or(false)
    }

    /// Check if this tool contains a command pattern
    ///
    /// # Arguments
    ///
    /// * `pattern` - The command pattern to search for
    ///
    /// # Returns
    ///
    /// `true` if the tool parameters contain the given pattern
    pub fn has_command_pattern(&self, pattern: &str) -> bool {
        self.parameters
            .get("command")
            .and_then(|c| c.as_str())
            .map(|c| c.contains(pattern))
            .unwrap_or(false)
    }
}

/// Categorize a tool based on its name
///
/// This function uses heuristics to determine the category of a tool
/// based on its name. The categorization is used to assign safety tiers.
///
/// Order of checks matters:
/// 1. System (highest risk) - checked first
/// 2. Network (includes download/upload which may contain "file")
/// 3. FileSystem
/// 4. Database
/// 5. API
///
/// # Arguments
///
/// * `name` - The tool name to categorize
///
/// # Returns
///
/// The `McpToolCategory` that best matches the tool name
///
/// # Examples
///
/// ```rust
/// use mcp::policy::context::{categorize_tool, McpToolCategory};
///
/// assert_eq!(categorize_tool("read_file"), McpToolCategory::FileSystem);
/// assert_eq!(categorize_tool("http_request"), McpToolCategory::Network);
/// assert_eq!(categorize_tool("exec_shell"), McpToolCategory::System);
/// assert_eq!(categorize_tool("sql_query"), McpToolCategory::Database);
/// ```
pub fn categorize_tool(name: &str) -> McpToolCategory {
    let lower = name.to_lowercase();

    // System commands (highest risk) - check first
    if lower.contains("exec")
        || lower.contains("run")
        || lower.contains("shell")
        || lower.contains("spawn")
        || lower.contains("system")
        || lower.contains("command")
        || lower.contains("bash")
        || lower.contains("sh ")
        || lower.contains("cmd")
        || lower.contains("process")
    {
        return McpToolCategory::System;
    }

    // Network operations - check before FileSystem because "download_file"
    // and "upload_file" should be Network, not FileSystem
    if lower.contains("http")
        || lower.contains("fetch")
        || lower.contains("request")
        || lower.contains("download")
        || lower.contains("upload")
        || lower.contains("curl")
        || lower.contains("wget")
        || lower.contains("network")
        || lower.contains("webhook")
        || lower.contains("sse")
        || lower.contains("websocket")
        || lower.contains("socket")
    {
        return McpToolCategory::Network;
    }

    // File system operations
    if lower.contains("file")
        || lower.contains("read")
        || lower.contains("write")
        || lower.contains("fs_")
        || lower.contains("path")
        || lower.contains("directory")
        || lower.contains("dir_")
        || lower.contains("folder")
    {
        return McpToolCategory::FileSystem;
    }

    // Database operations
    if lower.contains("sql")
        || lower.contains("query")
        || lower.contains("db_")
        || lower.contains("database")
        || lower.contains("select")
        || lower.contains("insert")
        || lower.contains("update")
        || lower.contains("delete")
    {
        return McpToolCategory::Database;
    }

    // API operations
    if lower.contains("api_")
        || lower.contains("_api")
        || lower.contains("rest")
        || lower.contains("graphql")
        || lower.contains("endpoint")
    {
        return McpToolCategory::Api;
    }

    McpToolCategory::Generic
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_categorize_tool_system() {
        assert_eq!(categorize_tool("exec"), McpToolCategory::System);
        assert_eq!(categorize_tool("execute_shell"), McpToolCategory::System);
        assert_eq!(categorize_tool("run_command"), McpToolCategory::System);
        assert_eq!(categorize_tool("spawn_process"), McpToolCategory::System);
        assert_eq!(categorize_tool("bash_script"), McpToolCategory::System);
    }

    #[test]
    fn test_categorize_tool_filesystem() {
        assert_eq!(categorize_tool("read_file"), McpToolCategory::FileSystem);
        assert_eq!(categorize_tool("writeFile"), McpToolCategory::FileSystem);
        assert_eq!(categorize_tool("fs_copy"), McpToolCategory::FileSystem);
        assert_eq!(
            categorize_tool("directory_list"),
            McpToolCategory::FileSystem
        );
    }

    #[test]
    fn test_categorize_tool_network() {
        assert_eq!(categorize_tool("http_get"), McpToolCategory::Network);
        assert_eq!(categorize_tool("fetch_url"), McpToolCategory::Network);
        assert_eq!(categorize_tool("webhook_send"), McpToolCategory::Network);
        assert_eq!(categorize_tool("download_file"), McpToolCategory::Network);
    }

    #[test]
    fn test_categorize_tool_database() {
        assert_eq!(categorize_tool("sql_query"), McpToolCategory::Database);
        assert_eq!(categorize_tool("db_select"), McpToolCategory::Database);
        assert_eq!(categorize_tool("insert_record"), McpToolCategory::Database);
    }

    #[test]
    fn test_categorize_tool_api() {
        assert_eq!(categorize_tool("api_call"), McpToolCategory::Api);
        assert_eq!(categorize_tool("rest_get"), McpToolCategory::Api);
    }

    #[test]
    fn test_categorize_tool_generic() {
        assert_eq!(categorize_tool("echo"), McpToolCategory::Generic);
        assert_eq!(categorize_tool("calculate"), McpToolCategory::Generic);
    }

    #[test]
    fn test_safety_tier_mapping() {
        let context = McpPolicyContext {
            server_id: "test".to_string(),
            server_name: "test".to_string(),
            tool_name: "test".to_string(),
            tool_category: McpToolCategory::System,
            parameters: serde_json::Value::Null,
        };
        assert!(matches!(context.to_safety_tier(), SafetyTier::T3));

        let context = McpPolicyContext {
            tool_category: McpToolCategory::FileSystem,
            ..context
        };
        assert!(matches!(context.to_safety_tier(), SafetyTier::T2));

        let context = McpPolicyContext {
            tool_category: McpToolCategory::Network,
            ..context
        };
        assert!(matches!(context.to_safety_tier(), SafetyTier::T2));

        let context = McpPolicyContext {
            tool_category: McpToolCategory::Api,
            ..context
        };
        assert!(matches!(context.to_safety_tier(), SafetyTier::T1));
    }

    #[test]
    fn test_from_request() {
        let request = CallToolRequest {
            name: "read_file".to_string(),
            arguments: Some(serde_json::json!({"path": "/tmp/test.txt"})),
        };

        let context = McpPolicyContext::from_request(
            "server-1".to_string(),
            "filesystem".to_string(),
            &request,
        );

        assert_eq!(context.server_id, "server-1");
        assert_eq!(context.server_name, "filesystem");
        assert_eq!(context.tool_name, "read_file");
        assert_eq!(context.tool_category, McpToolCategory::FileSystem);
        assert_eq!(context.parameters["path"], "/tmp/test.txt");
    }

    #[test]
    fn test_has_path() {
        let context = McpPolicyContext {
            server_id: "test".to_string(),
            server_name: "test".to_string(),
            tool_name: "read_file".to_string(),
            tool_category: McpToolCategory::FileSystem,
            parameters: serde_json::json!({"path": "/etc/passwd"}),
        };

        assert!(context.has_path("/etc"));
        assert!(!context.has_path("/home"));
    }

    #[test]
    fn test_has_command_pattern() {
        let context = McpPolicyContext {
            server_id: "test".to_string(),
            server_name: "test".to_string(),
            tool_name: "exec".to_string(),
            tool_category: McpToolCategory::System,
            parameters: serde_json::json!({"command": "rm -rf /"}),
        };

        assert!(context.has_command_pattern("rm -rf"));
        assert!(!context.has_command_pattern("mkdir"));
    }
}
