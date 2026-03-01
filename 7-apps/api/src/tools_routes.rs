//! API routes for MCP tools integration with tools-gateway
//!
//! This module provides REST API endpoints for:
//! - Connecting to and managing MCP servers
//! - Discovering tools from MCP servers
//! - Executing MCP tools through the A2R tools-gateway
//! - Listing all available tools (native + MCP)
//!
//! # Routes
//!
//! ## MCP Server Management
//! - `POST /api/v1/mcp/servers` - Connect to a new MCP server
//! - `GET /api/v1/mcp/servers` - List connected MCP servers
//! - `DELETE /api/v1/mcp/servers/{id}` - Disconnect an MCP server
//!
//! ## Tool Discovery
//! - `GET /api/v1/tools` - List all tools (native + MCP)
//! - `GET /api/v1/tools/mcp` - List only MCP-discovered tools
//!
//! ## Tool Execution
//! - `POST /api/v1/tools/execute` - Execute a tool (routes to native or MCP)
//! - `POST /api/v1/tools/mcp/execute` - Execute an MCP tool directly

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::AppState;
use crate::{McpServerEntry, McpToolEntry};
use a2r_driver_interface::{CommandSpec, DriverError, DriverRegistry, SpawnSpec};
use a2r_environment_spec::EnvironmentSpecLoader;
use a2rchitech_policy::SafetyTier;
use a2rchitech_sdk_core::ExecuteResponse;
use a2rchitech_tools_gateway::{
    FilesystemAccess, NetworkAccess, ResourceLimits, ToolDefinition, ToolType,
};

// Re-export MCP client types needed
use mcp_client::{
    McpClient, McpTransport, ReconnectConfig, SseConfig, SseTransport, StdioConfig, StdioTransport,
};

// ============================================================================
// Request/Response Types
// ============================================================================

/// Request to connect to an MCP server
#[derive(Debug, Deserialize, ToSchema)]
pub struct ConnectMcpServerRequest {
    /// Human-readable name for the server
    pub name: String,
    /// Transport configuration
    pub transport: McpTransportConfig,
    /// Optional authentication configuration
    #[serde(default)]
    pub auth: Option<McpAuthConfig>,
}

/// MCP transport configuration
#[derive(Debug, Deserialize, ToSchema)]
#[serde(tag = "type")]
pub enum McpTransportConfig {
    /// Stdio transport (spawn a subprocess)
    #[serde(rename = "stdio")]
    Stdio {
        /// Command to execute
        command: String,
        /// Arguments for the command
        #[serde(default)]
        args: Vec<String>,
        /// Environment variables
        #[serde(default)]
        env: HashMap<String, String>,
    },
    /// SSE/HTTP transport
    #[serde(rename = "sse")]
    Sse {
        /// Server URL
        url: String,
        /// Optional headers
        #[serde(default)]
        headers: HashMap<String, String>,
    },
}

/// MCP authentication configuration
#[derive(Debug, Deserialize, ToSchema)]
#[serde(tag = "type")]
pub enum McpAuthConfig {
    /// OAuth 2.1 + PKCE
    #[serde(rename = "oauth")]
    OAuth {
        client_id: String,
        redirect_uri: String,
    },
    /// API key authentication
    #[serde(rename = "api_key")]
    ApiKey {
        key_header: String,
        key_value: String,
    },
}

/// Response from connecting to an MCP server
#[derive(Debug, Serialize, ToSchema)]
pub struct ConnectMcpServerResponse {
    /// Server ID (generated)
    pub server_id: String,
    /// Server name
    pub name: String,
    /// Number of tools discovered
    pub tools_discovered: usize,
    /// Connection status
    pub status: String,
}

/// MCP server information
#[derive(Debug, Serialize)]
pub struct McpServerInfo {
    pub server_id: String,
    pub name: String,
    pub transport_type: String,
    pub connected_at: u64,
    pub tools_count: usize,
    pub status: String,
}

/// List MCP servers response
#[derive(Debug, Serialize, ToSchema)]
pub struct ListMcpServersResponse {
    pub servers: Vec<McpServerInfo>,
    pub total: usize,
}

/// Tool definition from tools-gateway (re-exported for API)
pub type ToolDefinitionType = ToolDefinition;

/// Tool execution request
#[derive(Debug, Deserialize, ToSchema)]
pub struct ToolExecutionRequest {
    /// Full tool name (e.g., "filesystem.read_file")
    pub tool_name: String,
    /// Tool parameters
    #[serde(default)]
    pub parameters: serde_json::Value,
    /// Session ID for tracking
    #[serde(default)]
    pub session_id: Option<String>,
    /// Tenant ID for multi-tenant isolation
    #[serde(default)]
    pub tenant_id: Option<String>,
    /// Environment specification (e.g., "mcr.microsoft.com/devcontainers/rust:1")
    /// If not provided, uses default environment
    #[serde(default)]
    pub environment: Option<String>,
    /// Driver type to use (e.g., "process", "microvm")
    /// If not provided, uses "process" driver
    #[serde(default)]
    pub driver: Option<String>,
    /// Resource limits for execution
    #[serde(default)]
    pub resources: Option<ToolResourceLimits>,
    /// Execution mode: "plan" (dry run), "safe" (require approval), "auto" (execute)
    #[serde(default)]
    pub execution_mode: Option<String>,
}

/// Resource limits for tool execution
#[derive(Debug, Deserialize, ToSchema)]
pub struct ToolResourceLimits {
    /// CPU limit in millicores (e.g., 1000 = 1 CPU)
    #[serde(default)]
    pub cpu_millicores: Option<u32>,
    /// Memory limit in MiB
    #[serde(default)]
    pub memory_mib: Option<u32>,
    /// Budget credits per hour
    #[serde(default)]
    pub budget_credits_per_hour: Option<f64>,
}

/// Tool execution response
#[derive(Debug, Serialize, ToSchema)]
pub struct ToolExecutionResponse {
    /// Whether execution was successful
    pub success: bool,
    /// Tool output (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
    /// Error message (if failed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
}

/// List all tools response
#[derive(Debug, Serialize)]
pub struct ListToolsResponse {
    /// Native A2R tools
    pub native: Vec<ToolDefinitionType>,
    /// MCP-discovered tools
    pub mcp: Vec<ToolDefinitionType>,
    /// Total count
    pub total: usize,
}

// ============================================================================
// Routes
// ============================================================================

use utoipa::ToSchema;

/// Create the tools routes router
pub fn create_tools_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Tool discovery
        .route("/api/v1/tools", get(list_all_tools))
        .route("/api/v1/tools/mcp", get(list_mcp_tools))
        // Tool execution
        .route("/api/v1/tools/execute", post(execute_tool))
        .route("/api/v1/tools/mcp/execute", post(execute_mcp_tool))
        .route("/api/v1/tools/:id/execute", post(execute_tool))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// Connect to an MCP server
///
/// This endpoint establishes a connection to an MCP server, discovers
/// its available tools, and registers them with the tools-gateway.
#[utoipa::path(
    post,
    path = "/api/v1/mcp/servers",
    request_body = ConnectMcpServerRequest,
    responses(
        (status = 200, description = "Server connected successfully", body = ConnectMcpServerResponse),
        (status = 400, description = "Invalid request", body = serde_json::Value),
        (status = 500, description = "Failed to connect to server", body = serde_json::Value)
    )
)]
async fn connect_mcp_server(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ConnectMcpServerRequest>,
) -> Result<Json<ConnectMcpServerResponse>, StatusCode> {
    info!(name = %request.name, "Connecting to MCP server");

    // Generate a unique server ID
    let server_id = format!("mcp-{}", Uuid::new_v4());

    // Create transport based on configuration
    let transport_result: Arc<dyn mcp_client::McpTransport> = match &request.transport {
        McpTransportConfig::Stdio { command, args, env } => {
            info!(command = %command, args = ?args, "Creating stdio transport");
            let config = StdioConfig {
                command: command.clone(),
                args: args.clone(),
                env: env.clone(),
                cwd: None,
                timeout_secs: 30,
            };
            let transport = StdioTransport::spawn(config).await.map_err(|e| {
                error!(error = %e, "Failed to spawn stdio transport");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
            transport as Arc<dyn mcp_client::McpTransport>
        }
        McpTransportConfig::Sse { url, headers } => {
            info!(url = %url, "Creating SSE transport");
            let config = SseConfig {
                url: url.clone(),
                sse_path: None,
                post_path: None,
                auth_token: headers.get("Authorization").cloned(),
                timeout_secs: 60,
                reconnect: ReconnectConfig::default(),
            };
            let transport = SseTransport::new(config).map_err(|e| {
                error!(error = %e, "Failed to create SSE transport");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
            transport as Arc<dyn mcp_client::McpTransport>
        }
    };

    // Create and initialize the MCP client
    let mut client = McpClient::new(transport_result);

    // Initialize the connection
    let init_result = client.initialize().await.map_err(|e| {
        error!(error = %e, "Failed to initialize MCP connection");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!(
        server_name = %init_result.server_info.name,
        server_version = %init_result.server_info.version,
        "MCP server initialized successfully"
    );

    // Discover tools from the server
    let tools = match client.list_tools().await {
        Ok(tools) => {
            info!(count = tools.len(), "Discovered tools from MCP server");
            tools
        }
        Err(e) => {
            error!(error = %e, "Failed to list tools from MCP server");
            // Continue with empty tools list - server is connected but has no tools
            vec![]
        }
    };

    let tools_discovered = tools.len();

    // Register tools in the MCP tools registry
    {
        let mut mcp_tools = state.mcp_tools.write().await;
        for tool in &tools {
            // Create a unique tool name with server prefix
            let tool_name = format!("{}.{}", request.name, tool.name);

            // Convert MCP tool to ToolDefinition
            let tool_def = ToolDefinition {
                id: tool_name.clone(),
                name: tool_name.clone(),
                description: tool.description.clone().unwrap_or_default(),
                tool_type: ToolType::Mcp,
                command: String::new(),
                endpoint: String::new(),
                input_schema: tool.input_schema.clone(),
                output_schema: serde_json::json!({
                    "type": "object",
                    "description": "Tool execution result"
                }),
                side_effects: vec![],
                idempotency_behavior: "idempotent".to_string(),
                retryable: true,
                failure_classification: "retryable".to_string(),
                safety_tier: SafetyTier::T1, // Compute tier - MCP tools are generally computation
                resource_limits: ResourceLimits {
                    cpu: None,
                    memory: None,
                    network: NetworkAccess::None,
                    filesystem: FilesystemAccess::None,
                    time_limit: 60,
                },
                subprocess: None,
            };

            mcp_tools.insert(
                tool_name.clone(),
                McpToolEntry {
                    tool: tool_def,
                    server_id: server_id.clone(),
                    mcp_tool_name: tool.name.clone(),
                },
            );

            debug!(tool_name = %tool_name, "Registered MCP tool");
        }
    }

    // Store the client in the manager
    state
        .mcp_client_manager
        .add_client(server_id.clone(), client)
        .await;

    // Store server metadata
    {
        let transport_type = match &request.transport {
            McpTransportConfig::Stdio { .. } => "stdio",
            McpTransportConfig::Sse { .. } => "sse",
        };

        let mut mcp_servers = state.mcp_servers.write().await;
        mcp_servers.insert(
            server_id.clone(),
            McpServerEntry {
                server_id: server_id.clone(),
                name: request.name.clone(),
                transport_type: transport_type.to_string(),
                connected_at: chrono::Utc::now(),
                tool_count: tools_discovered,
                status: "connected".to_string(),
            },
        );
    }

    info!(
        server_id = %server_id,
        name = %request.name,
        tools_discovered = tools_discovered,
        "MCP server connected successfully"
    );

    Ok(Json(ConnectMcpServerResponse {
        server_id,
        name: request.name,
        tools_discovered,
        status: "connected".to_string(),
    }))
}

/// List connected MCP servers
#[utoipa::path(
    get,
    path = "/api/v1/mcp/servers",
    responses(
        (status = 200, description = "List of connected MCP servers", body = ListMcpServersResponse)
    )
)]
async fn list_mcp_servers(State(state): State<Arc<AppState>>) -> Json<ListMcpServersResponse> {
    let mcp_servers = state.mcp_servers.read().await;

    let servers: Vec<McpServerInfo> = mcp_servers
        .values()
        .map(|entry| McpServerInfo {
            server_id: entry.server_id.clone(),
            name: entry.name.clone(),
            transport_type: entry.transport_type.clone(),
            connected_at: entry.connected_at.timestamp() as u64,
            tools_count: entry.tool_count,
            status: entry.status.clone(),
        })
        .collect();

    let total = servers.len();

    debug!(total_servers = total, "Listed MCP servers");

    Json(ListMcpServersResponse { servers, total })
}

/// Disconnect an MCP server
#[utoipa::path(
    delete,
    path = "/api/v1/mcp/servers/{server_id}",
    params(
        ("server_id" = String, Path, description = "Server ID to disconnect")
    ),
    responses(
        (status = 200, description = "Server disconnected successfully"),
        (status = 404, description = "Server not found")
    )
)]
async fn disconnect_mcp_server(
    State(state): State<Arc<AppState>>,
    Path(server_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!(server_id = %server_id, "Disconnecting MCP server");

    // Check if server exists
    let server_exists = {
        let mcp_servers = state.mcp_servers.read().await;
        mcp_servers.contains_key(&server_id)
    };

    if !server_exists {
        warn!(server_id = %server_id, "MCP server not found for disconnection");
        return Err(StatusCode::NOT_FOUND);
    }

    // Remove and shutdown the client
    if let Some(mut client) = state.mcp_client_manager.remove_client(&server_id).await {
        if let Err(e) = client.shutdown().await {
            warn!(error = %e, "Error shutting down MCP client");
        }
        info!("MCP client shutdown successfully");
    }

    // Remove all tools associated with this server
    {
        let mut mcp_tools = state.mcp_tools.write().await;
        let tools_to_remove: Vec<String> = mcp_tools
            .iter()
            .filter(|(_, entry)| entry.server_id == server_id)
            .map(|(name, _)| name.clone())
            .collect();

        for tool_name in tools_to_remove {
            mcp_tools.remove(&tool_name);
            debug!(tool_name = %tool_name, "Removed MCP tool");
        }
    }

    // Remove server metadata
    {
        let mut mcp_servers = state.mcp_servers.write().await;
        mcp_servers.remove(&server_id);
    }

    info!(server_id = %server_id, "MCP server disconnected successfully");

    Ok(Json(serde_json::json!({
        "status": "disconnected",
        "server_id": server_id
    })))
}

/// List tools from a specific MCP server
async fn list_server_tools(
    State(state): State<Arc<AppState>>,
    Path(server_id): Path<String>,
) -> Result<Json<Vec<ToolDefinitionType>>, StatusCode> {
    // Check if server exists
    let server_exists = {
        let mcp_servers = state.mcp_servers.read().await;
        mcp_servers.contains_key(&server_id)
    };

    if !server_exists {
        return Err(StatusCode::NOT_FOUND);
    }

    // Get tools for this server
    let mcp_tools = state.mcp_tools.read().await;
    let tools: Vec<ToolDefinition> = mcp_tools
        .values()
        .filter(|entry| entry.server_id == server_id)
        .map(|entry| entry.tool.clone())
        .collect();

    debug!(server_id = %server_id, tool_count = tools.len(), "Listed server tools");

    Ok(Json(tools))
}

/// List all tools including MCP-discovered tools
#[utoipa::path(
    get,
    path = "/api/v1/tools",
    responses(
        (status = 200, description = "List of all tools", body = ListToolsResponse)
    )
)]
async fn list_all_tools(State(state): State<Arc<AppState>>) -> Json<ListToolsResponse> {
    // Get native tools from tools-gateway
    let native_tools = state.tool_gateway.list_tools().await;

    // Get MCP tools from registry
    let mcp_tools: Vec<ToolDefinition> = {
        let mcp_tools = state.mcp_tools.read().await;
        mcp_tools.values().map(|entry| entry.tool.clone()).collect()
    };

    let total = native_tools.len() + mcp_tools.len();

    debug!(
        native_count = native_tools.len(),
        mcp_count = mcp_tools.len(),
        "Listed all tools"
    );

    Json(ListToolsResponse {
        native: native_tools,
        mcp: mcp_tools,
        total,
    })
}

/// List only MCP-discovered tools
async fn list_mcp_tools(State(state): State<Arc<AppState>>) -> Json<Vec<ToolDefinitionType>> {
    let mcp_tools: Vec<ToolDefinition> = {
        let mcp_tools = state.mcp_tools.read().await;
        mcp_tools.values().map(|entry| entry.tool.clone()).collect()
    };

    debug!(count = mcp_tools.len(), "Listed MCP tools");

    Json(mcp_tools)
}

/// Execute a tool (routes to native or MCP based on prefix)
#[utoipa::path(
    post,
    path = "/api/v1/tools/execute",
    request_body = ToolExecutionRequest,
    responses(
        (status = 200, description = "Tool executed successfully", body = ToolExecutionResponse),
        (status = 404, description = "Tool not found"),
        (status = 500, description = "Execution failed")
    )
)]
async fn execute_tool(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ToolExecutionRequest>,
) -> Result<Json<ToolExecutionResponse>, StatusCode> {
    debug!(tool_name = %request.tool_name, "Executing tool");

    let start = std::time::Instant::now();

    // Route based on tool name format
    let result = if request.tool_name.contains('.') {
        // Likely an MCP tool (has server prefix like "filesystem.read_file")
        execute_mcp_tool_internal(&state, &request).await
    } else {
        // Native A2R tool
        execute_native_tool(&state, &request).await
    };

    let execution_time_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(response) => Ok(Json(ToolExecutionResponse {
            success: response.success,
            output: response.result,
            error: response.error,
            execution_time_ms,
        })),
        Err(e) => {
            error!(tool_name = %request.tool_name, error = %e, "Tool execution failed");
            Ok(Json(ToolExecutionResponse {
                success: false,
                output: None,
                error: Some(e),
                execution_time_ms,
            }))
        }
    }
}

/// Execute an MCP tool directly
#[utoipa::path(
    post,
    path = "/api/v1/tools/mcp/execute",
    request_body = ToolExecutionRequest,
    responses(
        (status = 200, description = "Tool executed successfully", body = ToolExecutionResponse),
        (status = 404, description = "Tool not found"),
        (status = 500, description = "Execution failed")
    )
)]
async fn execute_mcp_tool(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ToolExecutionRequest>,
) -> Result<Json<ToolExecutionResponse>, StatusCode> {
    debug!(tool_name = %request.tool_name, "Executing MCP tool");

    let start = std::time::Instant::now();

    match execute_mcp_tool_internal(&state, &request).await {
        Ok(response) => Ok(Json(ToolExecutionResponse {
            success: response.success,
            output: response.result,
            error: response.error,
            execution_time_ms: start.elapsed().as_millis() as u64,
        })),
        Err(e) => Ok(Json(ToolExecutionResponse {
            success: false,
            output: None,
            error: Some(e),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })),
    }
}

// ============================================================================
// Browser Tool Execution (Native Browser Engine)
// ============================================================================

/// Execute browser tools via native browser engine
async fn execute_browser_tool(
    state: &AppState,
    request: &ToolExecutionRequest,
) -> Result<ExecuteResponse, String> {
    let tool_id = request.tool_name.clone();
    
    // Get browser tool executor
    let browser_executor = state
        .browser_tool_executor
        .clone()
        .ok_or_else(|| "Browser tool executor not initialized".to_string())?;

    // Handle recording tools
    if tool_id.starts_with("browser.start_recording") || 
       tool_id.starts_with("browser.stop_recording") ||
       tool_id.starts_with("browser.recording_status") {
        return execute_browser_recording_tool(state, request).await;
    }

    // Handle other browser tools via native engine
    match tool_id.as_str() {
        "browser.click" => {
            let selector = request.parameters.get("selector")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "selector is required".to_string())?;
            
            match browser_executor.click(selector).await {
                Ok(result) => Ok(ExecuteResponse {
                    success: true,
                    result: Some(serde_json::to_value(result).unwrap()),
                    error: None,
                    execution_time_ms: 0,
                    ui_card: None,
                }),
                Err(e) => Err(format!("Click failed: {}", e)),
            }
        }
        "browser.type" => {
            let selector = request.parameters.get("selector")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "selector is required".to_string())?;
            let text = request.parameters.get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            
            match browser_executor.type_text(selector, text).await {
                Ok(result) => Ok(ExecuteResponse {
                    success: true,
                    result: Some(serde_json::to_value(result).unwrap()),
                    error: None,
                    execution_time_ms: 0,
                    ui_card: None,
                }),
                Err(e) => Err(format!("Type failed: {}", e)),
            }
        }
        "browser.screenshot" => {
            let full_page = request.parameters.get("full_page")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            
            match browser_executor.screenshot(full_page).await {
                Ok(image) => Ok(ExecuteResponse {
                    success: true,
                    result: Some(serde_json::json!({
                        "success": true,
                        "image": image,
                    })),
                    error: None,
                    execution_time_ms: 0,
                    ui_card: None,
                }),
                Err(e) => Err(format!("Screenshot failed: {}", e)),
            }
        }
        "browser.navigate" => {
            let url = request.parameters.get("url")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "url is required".to_string())?;
            
            match browser_executor.navigate(url).await {
                Ok(_) => Ok(ExecuteResponse {
                    success: true,
                    result: Some(serde_json::json!({
                        "success": true,
                        "url": url,
                    })),
                    error: None,
                    execution_time_ms: 0,
                    ui_card: None,
                }),
                Err(e) => Err(format!("Navigate failed: {}", e)),
            }
        }
        _ => Err(format!("Unknown browser tool: {}", tool_id)),
    }
}

/// Execute browser recording tools (start_recording, stop_recording, recording_status)
async fn execute_browser_recording_tool(
    state: &AppState,
    request: &ToolExecutionRequest,
) -> Result<ExecuteResponse, String> {
    let tool_id = request.tool_name.clone();
    
    let recording_service = state
        .browser_recording_service
        .clone()
        .ok_or_else(|| "Browser recording service not initialized".to_string())?;

    match tool_id.as_str() {
        "browser.start_recording" => {
            let session_id = request.parameters.get("session_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            
            let format = request.parameters.get("format")
                .and_then(|v| v.as_str())
                .unwrap_or("gif")
                .to_string();
            
            let fps = request.parameters.get("fps")
                .and_then(|v| v.as_u64())
                .unwrap_or(10) as u32;
            
            let quality = request.parameters.get("quality")
                .and_then(|v| v.as_u64())
                .unwrap_or(80) as u32;
            
            let max_duration_secs = request.parameters.get("max_duration_secs")
                .and_then(|v| v.as_u64());
            
            let config = crate::browser_recording::RecordingConfig {
                format,
                fps,
                quality,
                max_duration_secs,
                output_path: None,
            };
            
            match recording_service.write().await.start_recording(session_id, config).await {
                Ok(recording_id) => Ok(ExecuteResponse {
                    success: true,
                    result: Some(serde_json::json!({
                        "recording_id": recording_id,
                        "status": "recording",
                    })),
                    error: None,
                    execution_time_ms: 0,
                    ui_card: None,
                }),
                Err(e) => Err(format!("Failed to start recording: {}", e)),
            }
        }
        "browser.stop_recording" => {
            let recording_id = request.parameters.get("recording_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "recording_id is required".to_string())?
                .to_string();
            
            let save = request.parameters.get("save")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            
            match recording_service.write().await.stop_recording(&recording_id, save).await {
                Ok(result) => Ok(ExecuteResponse {
                    success: true,
                    result: Some(serde_json::json!({
                        "recording_id": recording_id,
                        "success": true,
                        "file_path": result.file_path.map(|p| p.to_string_lossy().to_string()),
                        "file_size_bytes": result.file_size_bytes,
                        "duration_secs": result.duration_secs,
                        "frames_captured": result.frames_captured,
                    })),
                    error: None,
                    execution_time_ms: 0,
                    ui_card: None,
                }),
                Err(e) => Err(format!("Failed to stop recording: {}", e)),
            }
        }
        "browser.recording_status" => {
            let recording_id = request.parameters.get("recording_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "recording_id is required".to_string())?
                .to_string();
            
            match recording_service.read().await.get_status(&recording_id).await {
                Some(status) => Ok(ExecuteResponse {
                    success: true,
                    result: Some(serde_json::json!({
                        "recording_id": recording_id,
                        "is_recording": status.is_recording,
                        "frames_captured": status.frames_captured,
                        "duration_secs": status.duration_secs,
                        "format": status.format,
                    })),
                    error: None,
                    execution_time_ms: 0,
                    ui_card: None,
                }),
                None => Err(format!("Recording not found: {}", recording_id)),
            }
        }
        _ => Err(format!("Unknown browser recording tool: {}", tool_id)),
    }
}

// ============================================================================
// Internal Functions
// ============================================================================

/// Execute a native A2R tool with full execution stack integration
///
/// This function integrates:
/// - N5: Environment Specification
/// - N3/N4: Driver Interface/Process Driver
/// - N11: Budget Metering (quota check + consumption recording)
/// - N12: Replay Capture (deterministic execution recording)
/// - N16: Prewarm Pools (fast instance acquisition)
async fn execute_native_tool(
    state: &AppState,
    request: &ToolExecutionRequest,
) -> Result<ExecuteResponse, String> {
    let tool_id = request.tool_name.clone();
    let start_time = std::time::Instant::now();

    // Handle browser tools via native browser engine
    if tool_id.starts_with("browser.") {
        return execute_browser_tool(state, request).await;
    }

    // Get the tool definition
    let _tool_def = state
        .tool_gateway
        .get_tool(tool_id.clone())
        .await
        .ok_or_else(|| format!("Tool not found: {}", tool_id))?;

    let tenant_id = request
        .tenant_id
        .clone()
        .unwrap_or_else(|| "default".to_string());
    let run_id = a2r_driver_interface::ExecutionId::new();

    // === Check Execution Mode ===
    // In SAFE mode, require approval for destructive operations
    // In PLAN mode, only generate plan without execution
    // In AUTO mode, execute without approval (default)
    let runtime_execution_mode = {
        let execution_mode = state.runtime_execution_mode.read().await;
        execution_mode.mode.to_string()
    };
    let execution_mode = request
        .execution_mode
        .clone()
        .unwrap_or(runtime_execution_mode);

    // Resolve environment specification before plan-mode response so the preview
    // matches what execution would actually use.
    let env_spec = if let Some(env_source) = &request.environment {
        info!(tool = %tool_id, environment = %env_source, "Resolving environment for tool execution");
        match state.environment_loader.load(env_source, false).await {
            Ok((spec, _was_cached)) => spec,
            Err(e) => {
                error!(tool = %tool_id, error = %e, "Failed to resolve environment");
                return Err(format!("Environment resolution failed: {}", e));
            }
        }
    } else {
        info!(tool = %tool_id, "Using default environment");
        a2r_environment_spec::EnvironmentSpec {
            source: a2r_environment_spec::EnvironmentSource::Oci,
            source_uri: "docker.io/library/alpine:latest".to_string(),
            image: "docker.io/library/alpine:latest".to_string(),
            image_digest: None,
            workspace_folder: "/workspace".to_string(),
            env_vars: std::collections::HashMap::new(),
            packages: vec![],
            features: vec![],
            mounts: vec![],
            post_create_commands: vec![],
            resources: a2r_environment_spec::ResourceRequirements::default(),
            a2r_config: Default::default(),
        }
    };

    if execution_mode == "plan" {
        // PLAN mode: Return what would be executed without actually executing
        info!(tool = %tool_id, "PLAN mode - returning execution plan without executing");
        return Ok(ExecuteResponse {
            success: true,
            result: Some(serde_json::json!({
                "mode": "plan",
                "tool": tool_id,
                "parameters": request.parameters,
                "environment": env_spec.image,
                "would_execute": true,
            })),
            error: None,
            execution_time_ms: 0,
            ui_card: None,
        });
    }

    // === N11: Budget Check BEFORE Execution ===
    info!(tool = %tool_id, tenant = %tenant_id, "Checking budget quota");
    match state
        .budget_engine
        .check_budget(&tenant_id, Some(&run_id.0.to_string()))
        .await
    {
        Ok(result) => match &result.admission {
            a2rchitech_budget_metering::AdmissionDecision::Deny { reason } => {
                warn!(tool = %tool_id, tenant = %tenant_id, reason = %reason, "Budget check failed");
                return Ok(ExecuteResponse {
                    success: false,
                    result: None,
                    error: Some(format!("Budget check failed: {}", reason)),
                    execution_time_ms: 0,
                    ui_card: None,
                });
            }
            a2rchitech_budget_metering::AdmissionDecision::AllowWithWarning { warning } => {
                warn!(tool = %tool_id, tenant = %tenant_id, warning = %warning, "Budget check passed with warning");
            }
            a2rchitech_budget_metering::AdmissionDecision::Allow => {
                info!(tool = %tool_id, "Budget check passed");
            }
        },
        Err(e) => {
            error!(tool = %tool_id, error = %e, "Budget check error");
            return Err(format!("Budget check failed: {}", e));
        }
    }

    // Determine driver type
    let driver_type = request.driver.as_deref().unwrap_or("process");

    // Get driver from registry
    let registry = state.driver_registry.read().await;
    let driver = registry
        .get_driver(
            driver_type
                .parse()
                .unwrap_or(a2r_driver_interface::DriverType::Process),
        )
        .ok_or_else(|| format!("Driver not found: {}", driver_type))?;

    info!(tool = %tool_id, driver = %driver_type, environment = %env_spec.image, "Spawning execution environment");

    // === N12: Start Replay Capture ===
    let envelope = a2r_driver_interface::DeterminismEnvelope {
        env_spec_hash: format!("{:x}", md5::compute(&env_spec.image)),
        tool_versions: std::collections::HashMap::new(),
        policy_hash: "default".to_string(),
        inputs_hash: format!("{:x}", md5::compute(request.parameters.to_string())),
        time_frozen: false,
        seed: Some(12345),
    };

    {
        let mut replay = state.replay_engine.write().await;
        replay.start_capture(run_id, envelope);
        info!(tool = %tool_id, run_id = %run_id.0, "Replay capture started");
    }

    // === N16: Try Prewarm Pool First ===
    let pool_name = format!("pool-{}", env_spec.image.replace(['/', ':'], "-"));
    let prewarmed_instance = state.pool_manager.acquire(&pool_name).await;

    if prewarmed_instance.is_some() {
        info!(tool = %tool_id, pool = %pool_name, "Using prewarmed instance from pool");
    } else {
        debug!(tool = %tool_id, pool = %pool_name, "No prewarmed instance available, will fresh spawn");
    }

    // Spawn driver with environment
    let spawn_spec = SpawnSpec {
        tenant: a2r_driver_interface::TenantId(tenant_id.clone()),
        project: None,
        workspace: None,
        run_id: Some(run_id),
        env: a2r_driver_interface::EnvironmentSpec {
            spec_type: a2r_driver_interface::EnvSpecType::Oci,
            image: env_spec.image.clone(),
            version: env_spec.image_digest.clone(),
            packages: env_spec.packages.clone(),
            env_vars: env_spec.env_vars.clone(),
            working_dir: Some(env_spec.workspace_folder.clone()),
            mounts: vec![],
        },
        policy: a2r_driver_interface::PolicySpec::default_permissive(),
        resources: a2r_driver_interface::ResourceSpec {
            cpu_millis: request
                .resources
                .as_ref()
                .and_then(|r| r.cpu_millicores)
                .unwrap_or(100),
            memory_mib: request
                .resources
                .as_ref()
                .and_then(|r| r.memory_mib)
                .unwrap_or(256),
            disk_mib: Some(1024),
            gpu_count: Some(0),
            network_egress_kib: Some(1024),
        },
        envelope: None,
        prewarm_pool: prewarmed_instance.as_ref().map(|_| pool_name.clone()),
    };

    let handle = match driver.spawn(spawn_spec).await {
        Ok(h) => h,
        Err(e) => {
            error!(tool = %tool_id, error = %e, "Failed to spawn driver");
            // Return prewarmed instance to pool on spawn failure
            if let Some(instance) = prewarmed_instance {
                let _ = state.pool_manager.release(&pool_name, instance).await;
            }
            return Err(format!("Driver spawn failed: {}", e));
        }
    };

    info!(tool = %tool_id, run_id = %handle.id.0, "Driver spawned successfully");

    // Convert tool parameters to command
    let tool_cmd = format!("a2r-tool {} {}", tool_id, request.parameters.to_string());

    let cmd_spec = CommandSpec {
        command: vec!["sh".to_string(), "-c".to_string(), tool_cmd],
        env_vars: std::collections::HashMap::new(),
        working_dir: Some(env_spec.workspace_folder.clone()),
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    // Execute command in spawned environment
    let exec_result = match driver.exec(&handle, cmd_spec).await {
        Ok(result) => {
            info!(tool = %tool_id, exit_code = result.exit_code, "Tool execution completed");

            // === N12: Record execution in replay capture ===
            {
                let mut replay = state.replay_engine.write().await;
                if let Some(stdout) = result.stdout.as_ref() {
                    replay.capture_output(
                        run_id,
                        "stdout",
                        String::from_utf8_lossy(stdout),
                        format!("{:x}", md5::compute(stdout)),
                    );
                }
                if let Some(stderr) = result.stderr.as_ref() {
                    replay.capture_output(
                        run_id,
                        "stderr",
                        String::from_utf8_lossy(stderr),
                        format!("{:x}", md5::compute(stderr)),
                    );
                }
                replay.record_timestamp(run_id, "execution_complete");
            }

            let stdout_str = result
                .stdout
                .as_ref()
                .map(|s| String::from_utf8_lossy(s).to_string())
                .unwrap_or_default();
            let stderr_str = result
                .stderr
                .as_ref()
                .map(|s| String::from_utf8_lossy(s).to_string())
                .unwrap_or_default();

            ExecuteResponse {
                success: result.exit_code == 0,
                result: if result.exit_code == 0 {
                    Some(serde_json::json!({
                        "stdout": stdout_str,
                        "stderr": stderr_str,
                    }))
                } else {
                    None
                },
                error: if result.exit_code != 0 {
                    Some(format!(
                        "Exit code: {}\nStdout: {}\nStderr: {}",
                        result.exit_code, stdout_str, stderr_str
                    ))
                } else {
                    None
                },
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                ui_card: None,
            }
        }
        Err(e) => {
            error!(tool = %tool_id, error = %e, "Tool execution failed");
            ExecuteResponse {
                success: false,
                result: None,
                error: Some(format!("Execution error: {}", e)),
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                ui_card: None,
            }
        }
    };

    // Cleanup: destroy the execution handle
    if let Err(e) = driver.destroy(&handle).await {
        warn!(tool = %tool_id, run_id = %handle.id.0, error = %e, "Failed to destroy execution handle");
    }

    // === N16: Return instance to prewarm pool ===
    if let Some(instance) = prewarmed_instance {
        if let Err(e) = state.pool_manager.release(&pool_name, instance).await {
            warn!(tool = %tool_id, pool = %pool_name, error = %e, "Failed to release instance to pool");
        } else {
            info!(tool = %tool_id, pool = %pool_name, "Instance returned to pool");
        }
    }

    // === N12: Complete replay capture ===
    {
        let mut replay = state.replay_engine.write().await;
        if let Some(manifest) = replay.complete_capture(run_id) {
            info!(tool = %tool_id, run_id = %run_id.0, outputs = manifest.captured_outputs.len(),
                "Replay capture completed");
        }
    }

    // === N11: Record budget consumption ===
    let execution_time_ms = start_time.elapsed().as_millis() as u64;
    let cpu_seconds = ((execution_time_ms as f64 / 1000.0)
        * (request
            .resources
            .as_ref()
            .and_then(|r| r.cpu_millicores)
            .unwrap_or(100) as f64
            / 1000.0)) as u64;
    let memory_mb = request
        .resources
        .as_ref()
        .and_then(|r| r.memory_mib)
        .unwrap_or(256) as u64;

    let measurement = a2rchitech_budget_metering::ResourceMeasurement {
        measurement_id: format!("meas-{}", run_id.0),
        run_id: run_id.0.to_string(),
        worker_id: format!("worker-{}", run_id.0),
        timestamp: chrono::Utc::now(),
        cpu_seconds_delta: cpu_seconds,
        memory_mb_current: memory_mb,
        memory_mb_peak: memory_mb,
        network_bytes_sent: 0,
        network_bytes_received: 0,
    };

    if let Err(e) = state.budget_engine.record_measurement(measurement).await {
        warn!(tool = %tool_id, error = %e, "Failed to record budget measurement");
    } else {
        info!(tool = %tool_id, "Budget consumption recorded");
    }

    // === N2: Emit Receipt to Rails (Audit Trail) ===
    // Generate cryptographic receipt for this execution
    let receipt_id = format!("rcpt-{}", uuid::Uuid::new_v4().simple());
    let tool_hash = format!("{:x}", md5::compute(&tool_id));
    let input_hash = format!("{:x}", md5::compute(request.parameters.to_string()));

    let receipt_record = crate::rails_client::RailsReceiptRecord {
        receipt_id: receipt_id.clone(),
        run_id: run_id.0.to_string(),
        step: Some(1),
        tool: tool_id.clone(),
        tool_version: None,
        inputs_ref: Some(input_hash.clone()),
        outputs_ref: exec_result
            .result
            .as_ref()
            .map(|r| format!("{:x}", md5::compute(r.to_string()))),
        exit: Some(crate::rails_client::RailsReceiptExit {
            code: if exec_result.success {
                Some(0)
            } else {
                Some(1)
            },
            summary: exec_result.error.clone(),
        }),
    };

    // Store receipt in Rails ledger
    if let Some(ref rails_client) = state.rails_client {
        match rails_client.append_receipt(&receipt_record).await {
            Ok(_) => info!(tool = %tool_id, receipt_id = %receipt_id, "Receipt emitted to Rails"),
            Err(e) => warn!(tool = %tool_id, error = %e, "Failed to emit receipt to Rails"),
        }
    } else {
        info!(tool = %tool_id, receipt_id = %receipt_id, "Receipt generated (Rails not connected)");
    }

    Ok(exec_result)
}

/// Execute an MCP tool (internal implementation)
async fn execute_mcp_tool_internal(
    state: &AppState,
    request: &ToolExecutionRequest,
) -> Result<ExecuteResponse, String> {
    let full_tool_name = &request.tool_name;

    // Look up the tool in the MCP tools registry
    let mcp_tool_entry = {
        let mcp_tools = state.mcp_tools.read().await;
        mcp_tools.get(full_tool_name).cloned()
    };

    let mcp_tool_entry = match mcp_tool_entry {
        Some(entry) => entry,
        None => {
            return Err(format!("MCP tool not found: {}", full_tool_name));
        }
    };

    let server_id = &mcp_tool_entry.server_id;
    let mcp_tool_name = &mcp_tool_entry.mcp_tool_name;

    info!(
        tool_name = %full_tool_name,
        mcp_tool_name = %mcp_tool_name,
        server_id = %server_id,
        "Executing MCP tool"
    );

    // Get the client from the manager
    let client = state
        .mcp_client_manager
        .get_client(server_id)
        .await
        .ok_or_else(|| format!("MCP server not connected: {}", server_id))?;

    // Execute the tool
    let tool_result = client
        .call_tool(mcp_tool_name, request.parameters.clone())
        .await
        .map_err(|e| format!("MCP tool execution failed: {}", e))?;

    // Convert the result to A2R format
    let output = if let Some(content) = tool_result.content {
        let text_content: Vec<String> = content.into_iter().filter_map(|c| c.text).collect();
        Some(serde_json::json!({
            "content": text_content
        }))
    } else {
        Some(serde_json::json!({ "content": [] }))
    };

    let is_error = tool_result.is_error.unwrap_or(false);

    info!(
        tool_name = %full_tool_name,
        success = !is_error,
        "MCP tool execution completed"
    );

    Ok(ExecuteResponse {
        success: !is_error,
        result: output,
        error: if is_error {
            Some("MCP tool returned an error".to_string())
        } else {
            None
        },
        execution_time_ms: 0, // Would need to track actual execution time
        ui_card: None,
    })
}
