//! Registry for MCP-discovered tools
//!
//! This module provides a registry for managing tools discovered from MCP servers.
//! It maintains a mapping between tool names and their originating MCP servers,
//! enabling proper routing of tool execution requests.
//!
//! # Example
//!
//! ```rust,no_run
//! use mcp::tools_registry::McpToolsRegistry;
//! use allternit_sdk_core::ToolGatewayDefinition;
//!
//! # async fn example() {
//! let registry = McpToolsRegistry::new();
//!
//! // Register tools from an MCP server
//! let tools = vec![
//!     ToolGatewayDefinition {
//!         id: "filesystem.read_file".to_string(),
//!         // ... other fields
//!         # name: "read_file".to_string(),
//!         # description: "Read a file".to_string(),
//!         # tool_type: allternit_sdk_core::ToolType::Local,
//!         # command: "read_file".to_string(),
//!         # endpoint: "".to_string(),
//!         # input_schema: serde_json::json!({}),
//!         # output_schema: serde_json::json!({}),
//!         # side_effects: vec![],
//!         # idempotency_behavior: "idempotent".to_string(),
//!         # retryable: true,
//!         # failure_classification: "none".to_string(),
//!         # safety_tier: allternit_sdk_core::SafetyTier::T1,
//!         # resource_limits: allternit_sdk_core::ToolResourceLimits {
//!         #     cpu: None,
//!         #     memory: None,
//!         #     network: allternit_sdk_core::NetworkAccess::None,
//!         #     filesystem: allternit_sdk_core::FilesystemAccess::None,
//!         #     time_limit: 30000,
//!         # },
//!     }
//! ];
//!
//! registry.register_server_tools(
//!     "filesystem".to_string(),
//!     "server-123".to_string(),
//!     tools
//! ).await;
//!
//! // Look up a tool
//! if let Some(registered) = registry.lookup("filesystem.read_file").await {
//!     println!("Tool belongs to server: {}", registered.server_name);
//! }
//! # }
//! ```

use allternit_sdk_core::ToolGatewayDefinition;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Information about a registered tool
#[derive(Debug, Clone)]
pub struct RegisteredTool {
    /// The tool definition
    pub definition: ToolGatewayDefinition,
    /// Name of the MCP server that provides this tool
    pub server_name: String,
    /// Unique ID of the MCP server
    pub server_id: String,
    /// Timestamp when the tool was registered
    pub registered_at: std::time::Instant,
}

/// Registry for MCP-discovered tools
///
/// This registry maintains a thread-safe mapping of all tools discovered
/// from connected MCP servers. It enables:
///
/// - Looking up which server provides a specific tool
/// - Getting all available tool definitions
/// - Registering and unregistering tools when servers connect/disconnect
/// - Thread-safe concurrent access
#[derive(Debug, Clone)]
pub struct McpToolsRegistry {
    tools: Arc<RwLock<HashMap<String, RegisteredTool>>>,
    server_tool_index: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

impl McpToolsRegistry {
    /// Create a new empty tools registry
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            server_tool_index: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register tools from an MCP server
    ///
    /// # Arguments
    ///
    /// * `server_name` - The human-readable name of the MCP server
    /// * `server_id` - Unique identifier for the MCP server connection
    /// * `tools` - Vector of tool definitions to register
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use mcp::tools_registry::McpToolsRegistry;
    /// # use allternit_sdk_core::ToolGatewayDefinition;
    /// # async fn example() {
    /// # let registry = McpToolsRegistry::new();
    /// # let tools = vec![];
    /// registry.register_server_tools(
    ///     "filesystem".to_string(),
    ///     "fs-server-001".to_string(),
    ///     tools
    /// ).await;
    /// # }
    /// ```
    pub async fn register_server_tools(
        &self,
        server_name: String,
        server_id: String,
        tools: Vec<ToolGatewayDefinition>,
    ) {
        let mut tools_guard = self.tools.write().await;
        let mut index_guard = self.server_tool_index.write().await;

        let mut tool_names = Vec::with_capacity(tools.len());

        for tool in tools {
            let tool_name = tool.id.clone();
            tool_names.push(tool_name.clone());

            let registered = RegisteredTool {
                definition: tool,
                server_name: server_name.clone(),
                server_id: server_id.clone(),
                registered_at: std::time::Instant::now(),
            };

            tools_guard.insert(tool_name.clone(), registered);
            debug!(
                tool_name = %tool_name,
                server_name = %server_name,
                server_id = %server_id,
                "Registered MCP tool"
            );
        }

        // Update the index
        index_guard.insert(server_id.clone(), tool_names);

        info!(
            server_name = %server_name,
            server_id = %server_id,
            tool_count = tools_guard.len(),
            "Registered MCP server tools"
        );
    }

    /// Unregister all tools from a specific MCP server
    ///
    /// This should be called when an MCP server disconnects.
    ///
    /// # Arguments
    ///
    /// * `server_id` - The unique ID of the MCP server to unregister
    pub async fn unregister_server_tools(&self, server_id: &str) {
        let mut tools_guard = self.tools.write().await;
        let mut index_guard = self.server_tool_index.write().await;

        // Get the list of tools for this server
        if let Some(tool_names) = index_guard.remove(server_id) {
            for tool_name in &tool_names {
                tools_guard.remove(tool_name);
                debug!(
                    tool_name = %tool_name,
                    server_id = %server_id,
                    "Unregistered MCP tool"
                );
            }

            info!(
                server_id = %server_id,
                tool_count = tool_names.len(),
                "Unregistered MCP server tools"
            );
        } else {
            warn!(
                server_id = %server_id,
                "No tools found for server during unregister"
            );
        }
    }

    /// Get all tool definitions from all registered MCP servers
    ///
    /// # Returns
    ///
    /// Vector of all tool definitions
    pub async fn get_all_definitions(&self) -> Vec<ToolGatewayDefinition> {
        let guard = self.tools.read().await;
        guard.values().map(|t| t.definition.clone()).collect()
    }

    /// Look up a tool by its full name
    ///
    /// # Arguments
    ///
    /// * `tool_name` - The full prefixed tool name (e.g., "filesystem.read_file")
    ///
    /// # Returns
    ///
    /// `Some(RegisteredTool)` if found, `None` otherwise
    pub async fn lookup(&self, tool_name: &str) -> Option<RegisteredTool> {
        self.tools.read().await.get(tool_name).cloned()
    }

    /// Check if a tool is registered
    ///
    /// # Arguments
    ///
    /// * `tool_name` - The full prefixed tool name
    ///
    /// # Returns
    ///
    /// `true` if the tool is registered
    pub async fn is_registered(&self, tool_name: &str) -> bool {
        self.tools.read().await.contains_key(tool_name)
    }

    /// Get the number of registered tools
    pub async fn tool_count(&self) -> usize {
        self.tools.read().await.len()
    }

    /// Get the number of registered servers
    pub async fn server_count(&self) -> usize {
        self.server_tool_index.read().await.len()
    }

    /// Get all tool names registered by a specific server
    ///
    /// # Arguments
    ///
    /// * `server_id` - The unique ID of the MCP server
    ///
    /// # Returns
    ///
    /// Vector of tool names, or empty vector if server not found
    pub async fn get_server_tools(&self, server_id: &str) -> Vec<String> {
        self.server_tool_index
            .read()
            .await
            .get(server_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Get all registered server IDs
    pub async fn get_server_ids(&self) -> Vec<String> {
        self.server_tool_index
            .read()
            .await
            .keys()
            .cloned()
            .collect()
    }

    /// Get registry statistics
    pub async fn get_stats(&self) -> RegistryStats {
        RegistryStats {
            tool_count: self.tool_count().await,
            server_count: self.server_count().await,
        }
    }

    /// Clear all registered tools (useful for testing)
    pub async fn clear(&self) {
        let mut tools_guard = self.tools.write().await;
        let mut index_guard = self.server_tool_index.write().await;
        tools_guard.clear();
        index_guard.clear();
        info!("Cleared all MCP tools from registry");
    }
}

impl Default for McpToolsRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics about the registry
#[derive(Debug, Clone, Copy)]
pub struct RegistryStats {
    pub tool_count: usize,
    pub server_count: usize,
}

/// Server connection info for tracking
#[derive(Debug, Clone)]
pub struct ServerConnection {
    pub server_id: String,
    pub server_name: String,
    pub connected_at: std::time::Instant,
    pub transport_type: TransportType,
}

/// Transport type for MCP server connections
#[derive(Debug, Clone)]
pub enum TransportType {
    Stdio,
    Sse { url: String },
}

/// Extended registry with connection tracking
#[derive(Debug, Clone)]
pub struct TrackedMcpRegistry {
    registry: McpToolsRegistry,
    connections: Arc<RwLock<HashMap<String, ServerConnection>>>,
}

impl TrackedMcpRegistry {
    /// Create a new tracked registry
    pub fn new() -> Self {
        Self {
            registry: McpToolsRegistry::new(),
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a server connection
    pub async fn register_connection(
        &self,
        server_id: String,
        server_name: String,
        transport_type: TransportType,
    ) {
        let connection = ServerConnection {
            server_id: server_id.clone(),
            server_name: server_name.clone(),
            connected_at: std::time::Instant::now(),
            transport_type,
        };

        self.connections
            .write()
            .await
            .insert(server_id.clone(), connection);

        info!(
            server_id = %server_id,
            server_name = %server_name,
            "Registered MCP server connection"
        );
    }

    /// Register tools and track the connection
    pub async fn register_server(
        &self,
        server_name: String,
        server_id: String,
        transport_type: TransportType,
        tools: Vec<ToolGatewayDefinition>,
    ) {
        // Register connection first
        self.register_connection(server_id.clone(), server_name.clone(), transport_type)
            .await;

        // Then register tools
        self.registry
            .register_server_tools(server_name, server_id, tools)
            .await;
    }

    /// Unregister a server and all its tools
    pub async fn unregister_server(&self, server_id: &str) {
        self.registry.unregister_server_tools(server_id).await;
        self.connections.write().await.remove(server_id);
        info!(server_id = %server_id, "Unregistered MCP server connection");
    }

    /// Get all registered tools
    pub async fn get_all_definitions(&self) -> Vec<ToolGatewayDefinition> {
        self.registry.get_all_definitions().await
    }

    /// Look up a tool
    pub async fn lookup(&self, tool_name: &str) -> Option<RegisteredTool> {
        self.registry.lookup(tool_name).await
    }

    /// Get server connection info
    pub async fn get_connection(&self, server_id: &str) -> Option<ServerConnection> {
        self.connections.read().await.get(server_id).cloned()
    }

    /// Get all active connections
    pub async fn get_connections(&self) -> Vec<ServerConnection> {
        self.connections.read().await.values().cloned().collect()
    }

    /// Get registry statistics
    pub async fn get_stats(&self) -> TrackedRegistryStats {
        TrackedRegistryStats {
            tool_count: self.registry.tool_count().await,
            server_count: self.registry.server_count().await,
            active_connections: self.connections.read().await.len(),
        }
    }

    /// Access the underlying registry
    pub fn registry(&self) -> &McpToolsRegistry {
        &self.registry
    }
}

impl Default for TrackedMcpRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics for tracked registry
#[derive(Debug, Clone, Copy)]
pub struct TrackedRegistryStats {
    pub tool_count: usize,
    pub server_count: usize,
    pub active_connections: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_sdk_core::{
        FilesystemAccess, NetworkAccess, SafetyTier, ToolResourceLimits, ToolType,
    };

    fn create_test_tool(id: &str, name: &str) -> ToolGatewayDefinition {
        ToolGatewayDefinition {
            id: id.to_string(),
            name: name.to_string(),
            description: format!("Test tool: {}", name),
            tool_type: ToolType::Local,
            command: name.to_string(),
            endpoint: String::new(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
            side_effects: vec!["test".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "none".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ToolResourceLimits {
                cpu: None,
                memory: Some("64MB".to_string()),
                network: NetworkAccess::None,
                filesystem: FilesystemAccess::None,
                time_limit: 30000,
            },
        }
    }

    #[tokio::test]
    async fn test_register_and_lookup() {
        let registry = McpToolsRegistry::new();
        let tool = create_test_tool("filesystem.read_file", "read_file");

        registry
            .register_server_tools(
                "filesystem".to_string(),
                "fs-001".to_string(),
                vec![tool.clone()],
            )
            .await;

        let found = registry.lookup("filesystem.read_file").await;
        assert!(found.is_some());
        let registered = found.unwrap();
        assert_eq!(registered.server_name, "filesystem");
        assert_eq!(registered.server_id, "fs-001");
    }

    #[tokio::test]
    async fn test_unregister_server() {
        let registry = McpToolsRegistry::new();
        let tool = create_test_tool("filesystem.read_file", "read_file");

        registry
            .register_server_tools("filesystem".to_string(), "fs-001".to_string(), vec![tool])
            .await;

        assert_eq!(registry.tool_count().await, 1);

        registry.unregister_server_tools("fs-001").await;

        assert_eq!(registry.tool_count().await, 0);
        assert!(registry.lookup("filesystem.read_file").await.is_none());
    }

    #[tokio::test]
    async fn test_get_all_definitions() {
        let registry = McpToolsRegistry::new();
        let tool1 = create_test_tool("filesystem.read_file", "read_file");
        let tool2 = create_test_tool("filesystem.write_file", "write_file");

        registry
            .register_server_tools(
                "filesystem".to_string(),
                "fs-001".to_string(),
                vec![tool1, tool2],
            )
            .await;

        let all = registry.get_all_definitions().await;
        assert_eq!(all.len(), 2);
    }

    #[tokio::test]
    async fn test_is_registered() {
        let registry = McpToolsRegistry::new();
        let tool = create_test_tool("filesystem.read_file", "read_file");

        registry
            .register_server_tools("filesystem".to_string(), "fs-001".to_string(), vec![tool])
            .await;

        assert!(registry.is_registered("filesystem.read_file").await);
        assert!(!registry.is_registered("other.tool").await);
    }

    #[tokio::test]
    async fn test_tracked_registry() {
        let tracked = TrackedMcpRegistry::new();
        let tool = create_test_tool("filesystem.read_file", "read_file");

        tracked
            .register_server(
                "filesystem".to_string(),
                "fs-001".to_string(),
                TransportType::Stdio,
                vec![tool],
            )
            .await;

        let stats = tracked.get_stats().await;
        assert_eq!(stats.tool_count, 1);
        assert_eq!(stats.server_count, 1);
        assert_eq!(stats.active_connections, 1);

        let connections = tracked.get_connections().await;
        assert_eq!(connections.len(), 1);
        assert!(matches!(
            connections[0].transport_type,
            TransportType::Stdio
        ));
    }

    #[tokio::test]
    async fn test_multiple_servers() {
        let registry = McpToolsRegistry::new();

        let fs_tool = create_test_tool("filesystem.read_file", "read_file");
        let git_tool = create_test_tool("git.status", "status");

        registry
            .register_server_tools(
                "filesystem".to_string(),
                "fs-001".to_string(),
                vec![fs_tool],
            )
            .await;

        registry
            .register_server_tools("git".to_string(), "git-001".to_string(), vec![git_tool])
            .await;

        assert_eq!(registry.tool_count().await, 2);
        assert_eq!(registry.server_count().await, 2);

        // Unregister only filesystem
        registry.unregister_server_tools("fs-001").await;

        assert_eq!(registry.tool_count().await, 1);
        assert!(registry.lookup("git.status").await.is_some());
    }
}
