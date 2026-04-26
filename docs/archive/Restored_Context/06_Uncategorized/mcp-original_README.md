# MCP Tool Bridge for Allternit

This crate provides an MCP (Model Context Protocol) client implementation with full integration to the Allternit tools-gateway, allowing MCP servers to appear as native Allternit tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MCP Tool Bridge Architecture                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   MCP Server (stdio/SSE)                                                     │
│        ↓                                                                     │
│   McpTransport ──→ McpClientPool                                            │
│        ↓                              ↓                                     │
│   McpToolBridge ←───────────────→ McpToolsRegistry                          │
│        ↓                              ↓                                     │
│   ToolGatewayDefinition          RegisteredTool                             │
│        ↓                              ↓                                     │
│        └──────────┬──────────────────┘                                      │
│                   ↓                                                         │
│           McpToolProvider                                                   │
│                   ↓                                                         │
│           ToolProvider trait                                                │
│                   ↓                                                         │
│           tools-gateway                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Modules

### `tool_bridge.rs` (550 lines)

Core bridging functionality between MCP and Allternit tool formats:

- **`McpToolBridge`** - Converts MCP tool definitions to Allternit `ToolGatewayDefinition`
  - `convert_tool_definition()` - Transform single MCP tool to Allternit format
  - `convert_tool_definitions()` - Batch conversion
  - `to_mcp_request()` - Convert Allternit execution request to MCP format
  - `to_allternit_result()` - Transform MCP results to Allternit response format
  - `to_text_output()` - Extract text content from MCP results
  - `handles_tool()` - Check if bridge handles a given tool name
  - `extract_mcp_tool_name()` - Strip prefix from tool name

- **`ToolParameter`** - Allternit tool parameter definition
- **`ParameterType`** - Parameter type enumeration (String, Number, Boolean, etc.)
- **Helper functions**:
  - `json_schema_to_param_type()` - Convert JSON Schema to parameter type
  - `extract_required_fields()` - Extract required fields from JSON Schema

### `tools_registry.rs` (613 lines)

Registry for managing MCP-discovered tools:

- **`McpToolsRegistry`** - Thread-safe tool registry
  - `register_server_tools()` - Register tools from an MCP server
  - `unregister_server_tools()` - Remove tools when server disconnects
  - `get_all_definitions()` - Get all tool definitions
  - `lookup()` - Find tool by name
  - `is_registered()` - Check if tool exists
  - `get_server_tools()` - Get tools for a specific server
  - `get_stats()` - Get registry statistics

- **`TrackedMcpRegistry`** - Extended registry with connection tracking
  - `register_server()` - Register server with connection info
  - `get_connection()` - Get server connection details
  - `get_connections()` - List all active connections

- **`RegisteredTool`** - Information about a registered tool
- **`ServerConnection`** - MCP server connection metadata
- **`TransportType`** - Transport type enumeration (Stdio, Sse)
- **`RegistryStats`** / **`TrackedRegistryStats`** - Statistics structures

### `gateway_integration.rs` (577 lines)

Integration with Allternit tools-gateway:

- **`McpToolProvider`** - Implements `ToolProvider` trait for tools-gateway
  - `discover_tools()` - Return all available MCP tools
  - `execute_tool()` - Execute an MCP tool through the gateway
  - `handles_tool()` - Check if provider handles a tool

- **`McpClientPool`** - Connection pool for MCP servers
  - `register_client()` - Register an MCP client
  - `unregister_client()` - Remove a client
  - `get_client()` - Get client for a server
  - `call_tool()` - Execute tool call on a specific server

- **`ToolRouter`** - Routes tool calls to appropriate provider
  - `register_provider()` - Add a tool provider
  - `set_fallback_provider()` - Set fallback for unmatched tools
  - `execute_tool()` - Route and execute a tool
  - `discover_all_tools()` - Get tools from all providers

- **`ToolProvider` trait** - Interface for tool providers
- **`McpToolProviderBuilder`** - Builder for creating providers
- **`McpToolProviderError`** - Error types for provider operations

### `tools_routes.rs` (503 lines, in cmd/api)

API routes for tool discovery and execution:

- **MCP Server Management**
  - `POST /api/v1/mcp/servers` - Connect to MCP server
  - `GET /api/v1/mcp/servers` - List connected servers
  - `DELETE /api/v1/mcp/servers/{id}` - Disconnect server
  - `GET /api/v1/mcp/servers/{id}/tools` - List server tools

- **Tool Discovery**
  - `GET /api/v1/tools` - List all tools (native + MCP)
  - `GET /api/v1/tools/mcp` - List only MCP tools

- **Tool Execution**
  - `POST /api/v1/tools/execute` - Execute tool (routes to native or MCP)
  - `POST /api/v1/tools/mcp/execute` - Execute MCP tool directly

## Usage

### Basic Tool Bridge

```rust
use mcp::tool_bridge::McpToolBridge;
use mcp::types::Tool;

let bridge = McpToolBridge::new("filesystem".to_string());

// Convert MCP tool to Allternit format
let mcp_tool = Tool {
    name: "read_file".to_string(),
    description: Some("Read a file".to_string()),
    input_schema: serde_json::json!({
        "type": "object",
        "properties": {
            "path": {"type": "string"}
        },
        "required": ["path"]
    }),
};

let allternit_definition = bridge.convert_tool_definition(&mcp_tool);
// Result: ToolGatewayDefinition with id="filesystem.read_file"
```

### Tool Registry

```rust
use mcp::tools_registry::McpToolsRegistry;
use allternit_sdk_core::ToolGatewayDefinition;

let registry = Arc::new(McpToolsRegistry::new());

// Register tools from an MCP server
let tools = vec![tool_definition];
registry.register_server_tools(
    "filesystem".to_string(),
    "server-123".to_string(),
    tools
).await;

// Look up a tool
if let Some(registered) = registry.lookup("filesystem.read_file").await {
    println!("Server: {}", registered.server_name);
}
```

### Gateway Integration

```rust
use mcp::gateway_integration::{McpToolProvider, McpClientPool};
use std::sync::Arc;

let registry = Arc::new(McpToolsRegistry::new());
let client_pool = Arc::new(McpClientPool::new());

let provider = McpToolProvider::new(registry, client_pool);

// Discover tools
let tools = provider.discover_tools().await;

// Execute a tool
let result = provider.execute_tool(
    "filesystem.read_file",
    serde_json::json!({"path": "/tmp/test.txt"})
).await;
```

## Testing

Run the test suite:

```bash
# Run all library tests
cargo test -p mcp --lib

# Run with output
cargo test -p mcp --lib -- --nocapture
```

## Integration with tools-gateway

The MCP tool bridge integrates seamlessly with the Allternit tools-gateway:

1. **Tool Discovery**: MCP tools appear alongside native Allternit tools
2. **Tool Namespacing**: Tools are prefixed with server name (e.g., `filesystem.read_file`)
3. **Execution Routing**: Automatic routing based on tool name prefix
4. **Error Handling**: Proper error propagation from MCP servers
5. **Schema Conversion**: JSON Schema to Allternit format conversion

## API Endpoints

Once integrated with the API (cmd/api), the following endpoints are available:

```bash
# Connect to an MCP server
curl -X POST /api/v1/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "filesystem",
    "transport": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }'

# List all tools (native + MCP)
curl /api/v1/tools

# Execute an MCP tool
curl -X POST /api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "filesystem.read_file",
    "parameters": {"path": "/tmp/test.txt"}
  }'
```

## Dependencies

- `tokio` - Async runtime
- `serde` / `serde_json` - Serialization
- `allternit-sdk-core` - Allternit SDK types
- `async-trait` - Async trait support
- `thiserror` - Error handling
- `tracing` - Logging
- `uuid` - Unique identifiers

## License

MIT - See repository for details.
