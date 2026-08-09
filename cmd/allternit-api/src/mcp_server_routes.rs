//! allternit-api as an MCP *server* — `tools/list` / `tools/call` over the
//! MCP Streamable HTTP transport (single JSON-RPC endpoint, plain JSON
//! responses — no server-initiated push, so no SSE upgrade needed for this
//! tool set).
//!
//! Previously `mcp_routes.rs` only let allternit-api act as an MCP *client*
//! (consuming external MCP servers via the `/mcp/connectors` catalog). This
//! is the inverse direction: an external MCP client (Claude Code, Claude
//! Desktop, etc.) can point at `/mcp/server` with a Clerk bearer token and
//! call the same tool registry `tool_routes.rs` already exposes over REST.
//! Mounted inside the existing `/mcp` nest, so it inherits the same
//! `auth_middleware` Clerk gate as everything else there — no new attack
//! surface beyond what `/api/tools/execute` already grants an authenticated
//! caller.
//!
//! Scope limits, stated rather than silently assumed: single JSON-RPC
//! request objects only (no batch arrays); no `Mcp-Session-Id`
//! issuance/enforcement (stateless — fine for a tool set with no
//! server-initiated messages, but a strict client may expect one).

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::mcp_tunnel_auth::require_tunnel_auth;
use crate::tool_routes::{execute_tool_internal, ExecuteToolRequest};
use crate::AppState;

const PROTOCOL_VERSION: &str = "2025-03-26";
const SERVER_NAME: &str = "allternit-api";
const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn mcp_server_router() -> Router<Arc<AppState>> {
    Router::new().route("/server", post(handle_rpc))
}

#[derive(Debug, Deserialize)]
pub(crate) struct JsonRpcRequest {
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

async fn tool_catalog(state: &AppState) -> Vec<Value> {
    let mut tools = vec![
        json!({
            "name": "shell.exec",
            "description": "Execute a shell command on the allternit-api host.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "command": { "type": "string" },
                    "cwd": { "type": "string" }
                },
                "required": ["command"]
            }
        }),
        json!({
            "name": "file.read",
            "description": "Read a file's contents.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"]
            }
        }),
        json!({
            "name": "file.write",
            "description": "Write content to a file.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string" },
                    "content": { "type": "string" }
                },
                "required": ["path", "content"]
            }
        }),
        json!({
            "name": "file.list",
            "description": "List a directory's entries.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string" } }
            }
        }),
        json!({
            "name": "file.exists",
            "description": "Check whether a path exists.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"]
            }
        }),
        json!({
            "name": "file.remove",
            "description": "Delete a file.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"]
            }
        }),
        json!({
            "name": "system.info",
            "description": "Get host platform/arch/hostname info.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "system.env",
            "description": "Read an environment variable (or list all if no key given).",
            "inputSchema": {
                "type": "object",
                "properties": { "key": { "type": "string" } }
            }
        }),
        json!({
            "name": "http.get",
            "description": "Make an HTTP GET request.",
            "inputSchema": {
                "type": "object",
                "properties": { "url": { "type": "string" } },
                "required": ["url"]
            }
        }),
        json!({
            "name": "http.post",
            "description": "Make an HTTP POST request.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url": { "type": "string" },
                    "body": {},
                    "headers": { "type": "object" }
                },
                "required": ["url"]
            }
        }),
        json!({
            "name": "time.now",
            "description": "Get the current UTC time.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
    ];

    // Office-engine markdown conversion tools — descriptors shared with the
    // REST registry (`tool_routes::list_tools`), so both front doors advertise
    // the same contract.
    for tool in crate::tool_routes::markdown_builtin_tools() {
        tools.push(json!({
            "name": tool.get("id").cloned().unwrap_or(Value::Null),
            "description": tool.get("description").cloned().unwrap_or(Value::Null),
            "inputSchema": tool.get("parameters").cloned().unwrap_or(json!({})),
        }));
    }

    // Attached MCP servers from the dispatcher registry.
    for remote in state.mcp_dispatcher.list_tools().await {
        tools.push(remote);
    }

    tools
}

fn success(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn rpc_error(id: Value, code: i32, message: String) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

const TUNNEL_ID_HEADER: &str = "x-allternit-tunnel-id";
const TUNNEL_CERT_THUMBPRINT_HEADER: &str = "x-allternit-client-cert-thumbprint";
const TUNNEL_OAUTH_ISSUER_HEADER: &str = "x-allternit-oauth-issuer";
const TUNNEL_OAUTH_AUDIENCE_HEADER: &str = "x-allternit-oauth-audience";

#[tracing::instrument(skip_all, name = "mcp_server.handle_rpc", fields(method = %req.method))]
async fn handle_rpc(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    let tunnel_id = headers
        .get(TUNNEL_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let thumbprint = headers
        .get(TUNNEL_CERT_THUMBPRINT_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let issuer = headers
        .get(TUNNEL_OAUTH_ISSUER_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let audience = headers
        .get(TUNNEL_OAUTH_AUDIENCE_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty());

    match require_tunnel_auth(
        &state.db,
        tunnel_id,
        thumbprint.as_deref(),
        issuer.as_deref(),
        audience.as_deref(),
    ) {
        Ok(_) => handle_rpc_inner(&state, &user.user_id, req).await,
        Err(result) => (
            StatusCode::UNAUTHORIZED,
            Json(rpc_error(
                serde_json::Value::Null,
                -32001,
                format!("MCP tunnel auth failed: {}", result.reason()),
            )),
        )
            .into_response(),
    }
}

/// Internal sibling of `/mcp/server` for the local gizzi runtime's MCP client
/// (the `allternit-tools` bundled server in cmd/gizzi-code): same tool
/// registry, but gated by `internal_auth::require_internal_token` (shared
/// secret) instead of Clerk, with the user named explicitly via
/// `x-allternit-user-id` — the same trust model as
/// `connector_routes::mcp_proxy_internal`. Mounted by `internal_routes.rs` at
/// `/internal/tools/mcp`, outside the Clerk-protected router.
pub async fn mcp_tools_internal(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    if let Err(status) = crate::internal_auth::require_internal_token(&headers, &state) {
        return (status, Json(json!({"error": "unauthorized"}))).into_response();
    }
    let user_id = headers
        .get("x-allternit-user-id")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    match user_id {
        Some(user_id) => handle_rpc_inner(&state, &user_id, req).await,
        None => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "x-allternit-user-id header is required"})),
        )
            .into_response(),
    }
}

/// Shared JSON-RPC core behind both the Clerk-gated `/mcp/server` route and
/// the internal-token-gated `/internal/tools/mcp` route.
async fn handle_rpc_inner(
    state: &AppState,
    user_id: &str,
    req: JsonRpcRequest,
) -> axum::response::Response {
    // JSON-RPC notifications (no `id`) get no response body — the caller
    // isn't waiting on one. `notifications/initialized` is the only one this
    // server expects.
    let Some(id) = req.id.clone() else {
        return StatusCode::ACCEPTED.into_response();
    };

    match req.method.as_str() {
        "initialize" => Json(success(
            id,
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": { "tools": {} },
                "serverInfo": { "name": SERVER_NAME, "version": SERVER_VERSION }
            }),
        ))
        .into_response(),

        "ping" => Json(success(id, json!({}))).into_response(),

        "tools/list" => Json(success(id, json!({ "tools": tool_catalog(state).await }))).into_response(),

        "tools/call" => {
            let name = req
                .params
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let arguments = req
                .params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));

            // First, see if the requested tool belongs to an attached MCP server.
            let remote_result = if name.contains('.') {
                state.mcp_dispatcher.dispatch_call(&name, arguments.clone()).await.ok()
            } else {
                None
            };

            let result = match remote_result {
                Some(result) => Ok(result),
                None => {
                    let exec_request = ExecuteToolRequest {
                        tool: name,
                        args: arguments,
                        timeout: None,
                        workspace_id: None,
                        ..Default::default()
                    };
                    execute_tool_internal(state, &exec_request, user_id).await
                }
            };

            match result {
                Ok(result) => Json(success(
                    id,
                    json!({
                        "content": [{ "type": "text", "text": result.to_string() }],
                        "isError": false
                    }),
                ))
                .into_response(),
                Err(err) => Json(success(
                    id,
                    json!({
                        "content": [{ "type": "text", "text": err }],
                        "isError": true
                    }),
                ))
                .into_response(),
            }
        }

        other => Json(rpc_error(id, -32601, format!("Method not found: {other}")))
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn success_response_has_jsonrpc_shape() {
        let id = json!("req-1");
        let result = json!({"tools": []});
        let resp = success(id.clone(), result.clone());
        assert_eq!(resp["jsonrpc"], "2.0");
        assert_eq!(resp["id"], id);
        assert_eq!(resp["result"], result);
        assert!(resp.get("error").is_none());
    }

    #[test]
    fn rpc_error_response_has_jsonrpc_shape() {
        let id = json!(42);
        let resp = rpc_error(id.clone(), -32601, "Method not found".into());
        assert_eq!(resp["jsonrpc"], "2.0");
        assert_eq!(resp["id"], id);
        assert_eq!(resp["error"]["code"], -32601);
        assert_eq!(resp["error"]["message"], "Method not found");
    }

    #[test]
    fn tunnel_auth_header_constants_are_set() {
        // These headers are read by handle_rpc and passed to mcp_tunnel_auth.
        assert!(!TUNNEL_ID_HEADER.is_empty());
        assert!(!TUNNEL_CERT_THUMBPRINT_HEADER.is_empty());
        assert!(!TUNNEL_OAUTH_ISSUER_HEADER.is_empty());
        assert!(!TUNNEL_OAUTH_AUDIENCE_HEADER.is_empty());
        assert!(TUNNEL_ID_HEADER.starts_with("x-allternit-"));
    }
}
