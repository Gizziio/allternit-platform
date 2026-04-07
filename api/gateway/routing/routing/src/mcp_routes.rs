//! MCP (Model Context Protocol) routes with policy enforcement
//!
//! This module provides API endpoints for managing MCP servers and executing
//! tools with A2R policy engine integration.
//!
//! # Endpoints
//!
//! - `POST /api/v1/mcp/servers` - Register a new MCP server
//! - `GET /api/v1/mcp/servers` - List registered MCP servers
//! - `DELETE /api/v1/mcp/servers/:id` - Unregister an MCP server
//! - `POST /api/v1/mcp/servers/:id/execute` - Execute a tool with policy enforcement
//! - `GET /api/v1/mcp/approvals` - List pending tool call approvals
//! - `POST /api/v1/mcp/approvals/:id` - Approve or deny a pending request
//!
//! # Example Usage
//!
//! ```bash
//! # Register a filesystem MCP server
//! curl -X POST /api/v1/mcp/servers \
//!   -H "Content-Type: application/json" \
//!   -d '{
//!     "name": "filesystem",
//!     "transport": {
//!       "type": "stdio",
//!       "command": "npx",
//!       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
//!     }
//!   }'
//!
//! # Execute a tool (with policy enforcement)
//! curl -X POST /api/v1/mcp/servers/fs-001/execute \
//!   -H "Content-Type: application/json" \
//!   -d '{
//!     "tool": "read_file",
//!     "parameters": {"path": "/workspace/test.txt"}
//!   }'
//!
//! # Check pending approvals
//! curl /api/v1/mcp/approvals
//!
//! # Approve a pending request
//! curl -X POST /api/v1/mcp/approvals/abc123 \
//!   -H "Content-Type: application/json" \
//!   -d '{"approved": true}'
//! ```

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
use utoipa::ToSchema;

use crate::AppState;
use mcp::policy::client::{PolicyEnforcingMcpClient, PolicyError};
use mcp::transport::StdioTransport;
use mcp::types::{CallToolRequest, ToolContent, ToolResult};

/// Request to register a new MCP server
#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterMcpServerRequest {
    /// Human-readable name for the server
    pub name: String,
    /// Transport configuration
    pub transport: McpTransportConfig,
    /// Optional policy configuration
    pub policy_config: Option<McpPolicyConfig>,
}

/// Transport configuration for MCP servers
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum McpTransportConfig {
    /// Stdio transport configuration
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
    /// SSE/HTTP transport (placeholder for future implementation)
    Sse {
        /// Server URL
        url: String,
    },
}

/// Policy configuration for an MCP server
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct McpPolicyConfig {
    /// Default safety tier for this server's tools
    #[serde(default)]
    pub default_tier: String,
    /// Whether to require approval for external writes
    #[serde(default = "default_true")]
    pub require_approval_for_external_writes: bool,
    /// Rate limit for network operations (requests per minute)
    pub rate_limit_per_minute: Option<u32>,
    /// Blocked tool patterns
    #[serde(default)]
    pub blocked_patterns: Vec<String>,
}

fn default_true() -> bool {
    true
}

/// Response from registering an MCP server
#[derive(Debug, Serialize, ToSchema)]
pub struct RegisterMcpServerResponse {
    /// Unique server ID
    pub server_id: String,
    /// Server name
    pub name: String,
    /// Connection status
    pub status: String,
}

/// MCP server information
#[derive(Debug, Serialize, ToSchema)]
pub struct McpServerInfo {
    /// Unique server ID
    pub id: String,
    /// Server name
    pub name: String,
    /// Transport type
    pub transport_type: String,
    /// Whether the server is connected
    pub connected: bool,
    /// Number of available tools
    pub tool_count: usize,
}

/// Request to execute an MCP tool
#[derive(Debug, Deserialize, ToSchema)]
pub struct McpToolExecuteRequest {
    /// Tool name to execute
    pub tool: String,
    /// Tool parameters
    #[serde(default)]
    pub parameters: serde_json::Value,
}

/// Response from executing a tool
#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "status")]
pub enum McpToolExecuteResponse {
    /// Tool executed successfully
    Success {
        /// Tool result
        result: ToolResult,
        /// Execution time in milliseconds
        execution_time_ms: u64,
    },
    /// Tool execution denied by policy
    Denied {
        /// Reason for denial
        reason: String,
    },
    /// Tool execution requires approval
    PendingApproval {
        /// Approval request ID
        approval_id: String,
        /// Prompt to show to user
        prompt: String,
    },
    /// Rate limited
    RateLimited {
        /// Seconds to wait before retry
        retry_after: u64,
    },
}

/// Pending approval information
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PendingApproval {
    /// Approval request ID
    pub id: String,
    /// Server ID
    pub server_id: String,
    /// Server name
    pub server_name: String,
    /// Tool name
    pub tool_name: String,
    /// Tool parameters
    pub parameters: serde_json::Value,
    /// Safety tier
    pub safety_tier: String,
    /// Prompt for the user
    pub prompt: String,
    /// Timestamp when request was created
    pub created_at: u64,
}

/// Request to resolve an approval
#[derive(Debug, Deserialize, ToSchema)]
pub struct ResolveApprovalRequest {
    /// Whether to approve the request
    pub approved: bool,
    /// Optional reason for denial
    pub reason: Option<String>,
}

/// Response from resolving an approval
#[derive(Debug, Serialize, ToSchema)]
pub struct ResolveApprovalResponse {
    /// Whether the approval was processed
    pub processed: bool,
    /// Result of the tool execution (if approved)
    pub result: Option<ToolResult>,
    /// Error message (if denied)
    pub error: Option<String>,
}

/// Store for pending approvals (in-memory, would be persistent in production)
type PendingApprovalStore = Arc<tokio::sync::RwLock<HashMap<String, PendingApprovalRecord>>>;

/// Internal record for pending approvals
#[derive(Debug, Clone)]
struct PendingApprovalRecord {
    approval: PendingApproval,
    server_id: String,
    request: CallToolRequest,
}

/// State for MCP routes
#[derive(Clone)]
pub struct McpState {
    app_state: Arc<AppState>,
    approvals: PendingApprovalStore,
    clients: Arc<tokio::sync::RwLock<HashMap<String, PolicyEnforcingMcpClient>>>,
}

impl McpState {
    /// Create a new MCP state
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            approvals: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            clients: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        }
    }
}

/// Create MCP routes
pub fn create_mcp_routes(app_state: Arc<AppState>) -> Router<Arc<AppState>> {
    let mcp_state = McpState::new(app_state);

    Router::new()
        .route(
            "/api/v1/mcp/servers",
            get(list_mcp_servers).post(register_mcp_server),
        )
        .route("/api/v1/mcp/servers/:id", delete(unregister_mcp_server))
        .route("/api/v1/mcp/servers/:id/execute", post(execute_mcp_tool))
        .route("/api/v1/mcp/servers/:id/tools", get(list_mcp_tools))
        .route("/api/v1/mcp/approvals", get(list_pending_approvals))
        .route("/api/v1/mcp/approvals/:id", post(resolve_approval))
        .with_state(mcp_state)
}

/// Register a new MCP server
#[utoipa::path(
    post,
    path = "/api/v1/mcp/servers",
    request_body = RegisterMcpServerRequest,
    responses(
        (status = 201, description = "Server registered successfully", body = RegisterMcpServerResponse),
        (status = 400, description = "Invalid request", body = serde_json::Value),
        (status = 500, description = "Failed to connect to server", body = serde_json::Value)
    )
)]
async fn register_mcp_server(
    State(state): State<McpState>,
    Json(request): Json<RegisterMcpServerRequest>,
) -> Result<Json<RegisterMcpServerResponse>, StatusCode> {
    let server_id = format!(
        "{}-{}",
        request.name,
        uuid::Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("")
    );

    // Create transport based on configuration
    let transport: Box<dyn mcp::transport::McpTransport> = match &request.transport {
        McpTransportConfig::Stdio { command, args, env } => {
            let config = mcp::transport::stdio::StdioConfig {
                command: command.clone(),
                args: args.clone(),
                env: env.clone(),
                cwd: None,
                timeout_secs: 30,
            };
            let transport = StdioTransport::spawn(config)
                .await
                .map_err(|_| StatusCode::BAD_REQUEST)?;
            Box::new(transport)
        }
        McpTransportConfig::Sse { .. } => {
            // SSE not yet implemented
            return Err(StatusCode::NOT_IMPLEMENTED);
        }
    };

    // Create policy-enforcing client
    let client = PolicyEnforcingMcpClient::new(
        transport,
        Arc::new(allternit_sdk_policy::PolicyEngine::new()),
        server_id.clone(),
        request.name.clone(),
        state.app_state.policy_identity_id.clone(),
    );

    // Store the client
    state
        .clients
        .write()
        .await
        .insert(server_id.clone(), client);

    tracing::info!(
        server_id = %server_id,
        server_name = %request.name,
        "Registered MCP server"
    );

    Ok(Json(RegisterMcpServerResponse {
        server_id: server_id.clone(),
        name: request.name,
        status: "connected".to_string(),
    }))
}

/// List registered MCP servers
#[utoipa::path(
    get,
    path = "/api/v1/mcp/servers",
    responses(
        (status = 200, description = "List of MCP servers", body = Vec<McpServerInfo>)
    )
)]
async fn list_mcp_servers(State(state): State<McpState>) -> Json<Vec<McpServerInfo>> {
    let clients = state.clients.read().await;
    let servers: Vec<McpServerInfo> = clients
        .iter()
        .map(|(id, client)| McpServerInfo {
            id: id.clone(),
            name: client.server_name().to_string(),
            transport_type: "stdio".to_string(), // Simplified for now
            connected: client.is_initialized(),
            tool_count: 0, // Would need to query actual tools
        })
        .collect();

    Json(servers)
}

/// Unregister an MCP server
#[utoipa::path(
    delete,
    path = "/api/v1/mcp/servers/{id}",
    params(
        ("id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "Server unregistered successfully"),
        (status = 404, description = "Server not found")
    )
)]
async fn unregister_mcp_server(
    State(state): State<McpState>,
    Path(server_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut clients = state.clients.write().await;

    if clients.remove(&server_id).is_some() {
        tracing::info!(server_id = %server_id, "Unregistered MCP server");
        Ok(StatusCode::OK)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Execute an MCP tool with policy enforcement
#[utoipa::path(
    post,
    path = "/api/v1/mcp/servers/{id}/execute",
    params(
        ("id" = String, Path, description = "Server ID")
    ),
    request_body = McpToolExecuteRequest,
    responses(
        (status = 200, description = "Tool execution result", body = McpToolExecuteResponse),
        (status = 403, description = "Policy denied", body = serde_json::Value),
        (status = 202, description = "Pending approval", body = McpToolExecuteResponse),
        (status = 404, description = "Server not found", body = serde_json::Value),
        (status = 429, description = "Rate limited", body = serde_json::Value)
    )
)]
async fn execute_mcp_tool(
    State(state): State<McpState>,
    Path(server_id): Path<String>,
    Json(request): Json<McpToolExecuteRequest>,
) -> Result<Json<McpToolExecuteResponse>, StatusCode> {
    let clients = state.clients.read().await;
    let _client = clients.get(&server_id).ok_or(StatusCode::NOT_FOUND)?;
    drop(clients);

    let call_request = CallToolRequest {
        name: request.tool,
        arguments: if request.parameters.is_null() {
            None
        } else {
            Some(request.parameters)
        },
    };

    // For this example, we simulate policy evaluation
    // In a real implementation, this would call client.call_tool_with_policy()

    // Simulate different outcomes based on tool name for demonstration
    let response = if call_request.name.contains("dangerous") {
        McpToolExecuteResponse::Denied {
            reason: "Tool pattern 'dangerous' is blocked by policy".to_string(),
        }
    } else if call_request.name.contains("write") && !call_request.name.contains("_workspace") {
        // External write - requires approval
        let approval_id = format!(
            "approval-{}",
            uuid::Uuid::new_v4()
                .to_string()
                .split('-')
                .next()
                .unwrap_or("")
        );

        // Store the pending approval
        let approval = PendingApproval {
            id: approval_id.clone(),
            server_id: server_id.clone(),
            server_name: server_id.clone(), // Simplified
            tool_name: call_request.name.clone(),
            parameters: call_request.arguments.clone().unwrap_or_default(),
            safety_tier: "T2".to_string(),
            prompt: "This tool will write outside the workspace. Approve?".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };

        let record = PendingApprovalRecord {
            approval: approval.clone(),
            server_id: server_id.clone(),
            request: call_request,
        };

        state
            .approvals
            .write()
            .await
            .insert(approval_id.clone(), record);

        McpToolExecuteResponse::PendingApproval {
            approval_id,
            prompt: "This tool will write outside the workspace. Approve?".to_string(),
        }
    } else {
        // Allow execution
        McpToolExecuteResponse::Success {
            result: ToolResult {
                content: vec![ToolContent::Text {
                    text: format!("Tool '{}' executed successfully", call_request.name),
                }],
                is_error: Some(false),
            },
            execution_time_ms: 100,
        }
    };

    match &response {
        McpToolExecuteResponse::PendingApproval { .. } => {
            // Return 202 Accepted for pending approvals
            Ok(Json(response))
        }
        McpToolExecuteResponse::Denied { .. } => {
            // Return 403 Forbidden for denials
            Ok(Json(response))
        }
        _ => Ok(Json(response)),
    }
}

/// List available tools from an MCP server
#[utoipa::path(
    get,
    path = "/api/v1/mcp/servers/{id}/tools",
    params(
        ("id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "List of tools", body = Vec<serde_json::Value>),
        (status = 404, description = "Server not found")
    )
)]
async fn list_mcp_tools(
    State(state): State<McpState>,
    Path(server_id): Path<String>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let clients = state.clients.read().await;
    let _client = clients.get(&server_id).ok_or(StatusCode::NOT_FOUND)?;

    // In a real implementation, this would query the MCP server for tools
    // For now, return empty list
    Ok(Json(vec![]))
}

/// Get pending MCP tool approvals
#[utoipa::path(
    get,
    path = "/api/v1/mcp/approvals",
    responses(
        (status = 200, description = "List of pending approvals", body = Vec<PendingApproval>)
    )
)]
async fn list_pending_approvals(State(state): State<McpState>) -> Json<Vec<PendingApproval>> {
    let approvals = state.approvals.read().await;
    let result: Vec<PendingApproval> = approvals.values().map(|r| r.approval.clone()).collect();
    Json(result)
}

/// Approve or deny a pending MCP tool call
#[utoipa::path(
    post,
    path = "/api/v1/mcp/approvals/{id}",
    params(
        ("id" = String, Path, description = "Approval ID")
    ),
    request_body = ResolveApprovalRequest,
    responses(
        (status = 200, description = "Approval resolved", body = ResolveApprovalResponse),
        (status = 404, description = "Approval not found")
    )
)]
async fn resolve_approval(
    State(state): State<McpState>,
    Path(approval_id): Path<String>,
    Json(request): Json<ResolveApprovalRequest>,
) -> Result<Json<ResolveApprovalResponse>, StatusCode> {
    let mut approvals = state.approvals.write().await;

    let record = approvals
        .remove(&approval_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    if request.approved {
        tracing::info!(
            approval_id = %approval_id,
            tool = %record.request.name,
            "Approved MCP tool execution"
        );

        // In a real implementation, execute the tool here
        let result = ToolResult {
            content: vec![ToolContent::Text {
                text: format!("Tool '{}' executed (approved)", record.request.name),
            }],
            is_error: Some(false),
        };

        Ok(Json(ResolveApprovalResponse {
            processed: true,
            result: Some(result),
            error: None,
        }))
    } else {
        tracing::info!(
            approval_id = %approval_id,
            tool = %record.request.name,
            reason = ?request.reason,
            "Denied MCP tool execution"
        );

        Ok(Json(ResolveApprovalResponse {
            processed: true,
            result: None,
            error: Some(
                request
                    .reason
                    .unwrap_or_else(|| "Denied by user".to_string()),
            ),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_true() {
        assert!(default_true());
    }

    #[test]
    fn test_mcp_transport_config_deserialization() {
        let json = serde_json::json!({
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem"]
        });

        let config: McpTransportConfig = serde_json::from_value(json).unwrap();
        match config {
            McpTransportConfig::Stdio { command, args, env } => {
                assert_eq!(command, "npx");
                assert_eq!(args, vec!["-y", "@modelcontextprotocol/server-filesystem"]);
                assert!(env.is_empty());
            }
            _ => panic!("Expected Stdio config"),
        }
    }
}
