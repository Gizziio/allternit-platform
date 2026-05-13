//! Tool Execution Routes
//!
//! Provides a unified endpoint for executing agent tools.
//! Tools can be local (filesystem, shell, browser) or proxied to MCP servers.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::AppState;

// ─── Request/Response Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ExecuteToolRequest {
    /// Tool identifier (e.g. "shell.exec", "file.read", "browser.navigate", "mcp:<server>:<tool>")
    pub tool: String,
    /// Tool arguments
    pub args: Value,
    /// Optional timeout in seconds (default: 30)
    #[serde(default)]
    pub timeout: Option<u64>,
    /// Optional workspace context
    #[serde(default)]
    pub workspace_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteToolResponse {
    pub success: bool,
    pub result: Option<Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

// ─── Router ─────────────────────────────────────────────────────────────────

pub fn tool_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/tools", get(list_tools))
        .route("/tools/execute", post(execute_tool))
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn execute_tool(
    State(_state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ExecuteToolRequest>,
) -> impl IntoResponse {
    let user = match headers.get("x-allternit-user-id").and_then(|v| v.to_str().ok()) {
        Some(user_id) => AuthUser {
            user_id: user_id.to_string(),
            email: headers.get("x-allternit-user-email").and_then(|v| v.to_str().ok()).map(|s| s.to_string()),
            name: headers.get("x-allternit-user-name").and_then(|v| v.to_str().ok()).map(|s| s.to_string()),
            avatar_url: None,
        },
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            );
        }
    };

    let start = std::time::Instant::now();
    info!(
        "Executing tool '{}' for user '{}'",
        body.tool, user.user_id
    );

    let result = match execute_tool_internal(&body, &user.user_id).await {
        Ok(result) => json!({
            "success": true,
            "result": result,
            "execution_time_ms": start.elapsed().as_millis() as u64,
        }),
        Err(e) => {
            warn!("Tool '{}' failed: {}", body.tool, e);
            json!({
                "success": false,
                "error": e,
                "execution_time_ms": start.elapsed().as_millis() as u64,
            })
        }
    };

    (StatusCode::OK, Json(result))
}

// ─── Tool Implementations ───────────────────────────────────────────────────

async fn execute_tool_internal(
    request: &ExecuteToolRequest,
    _user_id: &str,
) -> Result<Value, String> {
    match request.tool.as_str() {
        // ── Shell Execution ──────────────────────────────────────────────────
        "shell.exec" => shell_exec(request).await,
        "shell.eval" => shell_exec(request).await,

        // ── File System ──────────────────────────────────────────────────────
        "file.read" => file_read(request).await,
        "file.write" => file_write(request).await,
        "file.list" => file_list(request).await,
        "file.exists" => file_exists(request).await,
        "file.remove" => file_remove(request).await,

        // ── System Info ──────────────────────────────────────────────────────
        "system.info" => system_info(request).await,
        "system.env" => system_env(request).await,

        // ── Network ──────────────────────────────────────────────────────────
        "http.get" => http_get(request).await,
        "http.post" => http_post(request).await,

        // ── Time ─────────────────────────────────────────────────────────────
        "time.now" => time_now(request).await,

        // ── Echo / Debug ─────────────────────────────────────────────────────
        "echo" => Ok(request.args.clone()),

        // ── Unknown ──────────────────────────────────────────────────────────
        _ => {
            if request.tool.starts_with("mcp:") {
                Err(format!(
                    "MCP tool execution not yet implemented for '{}'",
                    request.tool
                ))
            } else {
                Err(format!("Unknown tool: '{}'", request.tool))
            }
        }
    }
}

// ── Shell ───────────────────────────────────────────────────────────────────

async fn shell_exec(request: &ExecuteToolRequest) -> Result<Value, String> {
    let command = request
        .args
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'command' argument")?;

    let cwd = request
        .args
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(|s| std::path::PathBuf::from(s))
        .or_else(|| std::env::current_dir().ok());

    let timeout_secs = request.timeout.unwrap_or(30);

    let mut cmd = tokio::process::Command::new("sh");
    cmd.arg("-c").arg(command);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        cmd.output(),
    )
    .await
    .map_err(|_| "Shell command timed out")?
    .map_err(|e| format!("Failed to execute shell command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(json!({
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": output.status.code(),
        "success": output.status.success(),
    }))
}

// ── File System ─────────────────────────────────────────────────────────────

async fn file_read(request: &ExecuteToolRequest) -> Result<Value, String> {
    let path = request
        .args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'path' argument")?;

    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(json!({ "content": content, "path": path }))
}

async fn file_write(request: &ExecuteToolRequest) -> Result<Value, String> {
    let path = request
        .args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'path' argument")?;
    let content = request
        .args
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'content' argument")?;

    tokio::fs::write(path, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(json!({ "path": path, "written": true }))
}

async fn file_list(request: &ExecuteToolRequest) -> Result<Value, String> {
    let path = request
        .args
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let mut entries = Vec::new();
    let mut dir = tokio::fs::read_dir(path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read directory entry: {}", e))?
    {
        let meta = entry.metadata().await.ok();
        entries.push(json!({
            "name": entry.file_name().to_string_lossy().to_string(),
            "path": entry.path().to_string_lossy().to_string(),
            "is_file": meta.as_ref().map(|m| m.is_file()).unwrap_or(false),
            "is_dir": meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            "size": meta.as_ref().map(|m| m.len()),
        }));
    }

    Ok(json!({ "entries": entries, "path": path }))
}

async fn file_exists(request: &ExecuteToolRequest) -> Result<Value, String> {
    let path = request
        .args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'path' argument")?;

    let exists = tokio::fs::metadata(path).await.is_ok();
    Ok(json!({ "exists": exists, "path": path }))
}

async fn file_remove(request: &ExecuteToolRequest) -> Result<Value, String> {
    let path = request
        .args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'path' argument")?;

    tokio::fs::remove_file(path)
        .await
        .map_err(|e| format!("Failed to remove file: {}", e))?;

    Ok(json!({ "removed": true, "path": path }))
}

// ── System Info ─────────────────────────────────────────────────────────────

async fn system_info(_request: &ExecuteToolRequest) -> Result<Value, String> {
    Ok(json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "hostname": hostname::get().ok().map(|h| h.to_string_lossy().to_string()),
        "cwd": std::env::current_dir().ok().map(|p| p.to_string_lossy().to_string()),
        "pid": std::process::id(),
    }))
}

async fn system_env(request: &ExecuteToolRequest) -> Result<Value, String> {
    if let Some(key) = request.args.get("key").and_then(|v| v.as_str()) {
        let value = std::env::var(key).ok();
        Ok(json!({ "key": key, "value": value }))
    } else {
        let envs: std::collections::HashMap<String, Option<String>> = std::env::vars()
            .map(|(k, v)| (k, Some(v)))
            .collect();
        Ok(json!({ "env": envs }))
    }
}

// ── HTTP ────────────────────────────────────────────────────────────────────

async fn http_get(request: &ExecuteToolRequest) -> Result<Value, String> {
    let url = request
        .args
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'url' argument")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(request.timeout.unwrap_or(30)))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("HTTP GET failed: {}", e))?;

    let status = resp.status().as_u16();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(json!({
        "status": status,
        "body": body,
    }))
}

async fn http_post(request: &ExecuteToolRequest) -> Result<Value, String> {
    let url = request
        .args
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'url' argument")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(request.timeout.unwrap_or(30)))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.post(url);
    if let Some(body) = request.args.get("body") {
        req = req.json(body);
    }
    if let Some(headers) = request.args.get("headers") {
        if let Some(headers) = headers.as_object() {
            for (k, v) in headers {
                if let Some(v) = v.as_str() {
                    req = req.header(k, v);
                }
            }
        }
    }

    let resp = req.send().await.map_err(|e| format!("HTTP POST failed: {}", e))?;

    let status = resp.status().as_u16();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(json!({
        "status": status,
        "body": body,
    }))
}

// ── Time ────────────────────────────────────────────────────────────────────

async fn time_now(_request: &ExecuteToolRequest) -> Result<Value, String> {
    let now = chrono::Utc::now();
    Ok(json!({
        "iso": now.to_rfc3339(),
        "timestamp": now.timestamp(),
        "date": now.format("%Y-%m-%d").to_string(),
        "time": now.format("%H:%M:%S").to_string(),
    }))
}


// ─── List tools (stub) ───────────────────────────────────────────────────────

async fn list_tools() -> impl IntoResponse {
    Json(json!({
        "tools": [
            { "id": "shell.exec", "name": "Shell Execute", "description": "Execute shell commands" },
            { "id": "file.read", "name": "File Read", "description": "Read file contents" },
            { "id": "file.write", "name": "File Write", "description": "Write to a file" },
            { "id": "file.list", "name": "File List", "description": "List directory contents" },
            { "id": "http.get", "name": "HTTP GET", "description": "Make HTTP GET requests" },
            { "id": "http.post", "name": "HTTP POST", "description": "Make HTTP POST requests" },
            { "id": "system.info", "name": "System Info", "description": "Get system information" },
            { "id": "echo", "name": "Echo", "description": "Echo back arguments" },
        ],
        "total": 8,
    }))
}
