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
use crate::tool_routes::{execute_tool_internal, ExecuteToolRequest};
use crate::AppState;

const PROTOCOL_VERSION: &str = "2025-03-26";
const SERVER_NAME: &str = "allternit-api";
const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn mcp_server_router() -> Router<Arc<AppState>> {
    Router::new().route("/server", post(handle_rpc))
}

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

fn tool_catalog() -> Vec<Value> {
    vec![
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
    ]
}

fn success(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn rpc_error(id: Value, code: i32, message: String) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

#[tracing::instrument(skip_all, name = "mcp_server.handle_rpc", fields(method = %req.method))]
async fn handle_rpc(
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
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

        "tools/list" => Json(success(id, json!({ "tools": tool_catalog() }))).into_response(),

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

            let exec_request = ExecuteToolRequest {
                tool: name,
                args: arguments,
                timeout: None,
                workspace_id: None,
            };

            match execute_tool_internal(&exec_request, &user.user_id).await {
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
