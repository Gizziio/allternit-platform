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
    /// `tool_name` alias: the web/desktop surface (`native-agent-api.ts`,
    /// `recording.store.ts`) posts that key.
    #[serde(alias = "tool_name")]
    pub tool: String,
    /// Tool arguments (`parameters` alias, same reason as above).
    #[serde(alias = "parameters")]
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
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ExecuteToolRequest>,
) -> impl IntoResponse {
    let user = match headers
        .get("x-allternit-user-id")
        .and_then(|v| v.to_str().ok())
    {
        Some(user_id) => AuthUser {
            user_id: user_id.to_string(),
            email: headers
                .get("x-allternit-user-email")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
            name: headers
                .get("x-allternit-user-name")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
            avatar_url: None,
            tenant_id: headers
                .get("x-allternit-tenant-id")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
            organization_id: headers
                .get("x-allternit-organization-id")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
            organization_role: headers
                .get("x-allternit-organization-role")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
            organization_slug: headers
                .get("x-allternit-organization-slug")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string()),
        },
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            );
        }
    };

    let start = std::time::Instant::now();
    info!("Executing tool '{}' for user '{}'", body.tool, user.user_id);

    let result = match execute_tool_internal(&state, &body, &user.user_id).await {
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

/// `pub(crate)`: also called by `mcp_server_routes.rs`'s `tools/call` handler,
/// so the same tool set is reachable both as a plain REST call and as an
/// MCP server tool — one registry, two front doors, same auth gate.
pub(crate) async fn execute_tool_internal(
    state: &AppState,
    request: &ExecuteToolRequest,
    user_id: &str,
) -> Result<Value, String> {
    match request.tool.as_str() {
        // ── Shell Execution ──────────────────────────────────────────────────
        "shell.exec" => shell_exec(request).await,
        "shell.eval" => shell_exec(request).await,
        "bash" => bash_exec(request).await,

        // ── Code Execution ───────────────────────────────────────────────────
        "code_execution" => code_execution(request).await,

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

        // ── Markdown Conversion (office engine) ──────────────────────────────
        "document_to_markdown" => document_to_markdown(state, request, user_id).await,
        "url_to_markdown" => url_to_markdown(state, request).await,

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
    run_shell(
        request,
        request.timeout.unwrap_or(30),
        request.args.get("cwd").and_then(|v| v.as_str()),
    )
    .await
}

async fn bash_exec(request: &ExecuteToolRequest) -> Result<Value, String> {
    let timeout = request
        .args
        .get("timeout")
        .and_then(|v| v.as_u64())
        .unwrap_or_else(|| request.timeout.unwrap_or(30));
    let restart = request
        .args
        .get("restart")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    // restart is currently advisory: each API invocation spawns a fresh process,
    // so a new shell is already provided. We include it in the schema for callers
    // trained on the WebVM contract.
    let _ = restart;
    run_shell(request, timeout, None).await
}

async fn run_shell(
    request: &ExecuteToolRequest,
    timeout_secs: u64,
    cwd: Option<&str>,
) -> Result<Value, String> {
    let command = request
        .args
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'command' argument")?;

    let mut cmd = tokio::process::Command::new("sh");
    cmd.arg("-c").arg(command);

    if let Some(dir) = cwd {
        cmd.current_dir(std::path::PathBuf::from(dir));
    } else if let Some(dir) = std::env::current_dir().ok() {
        cmd.current_dir(dir);
    }

    let output = tokio::time::timeout(std::time::Duration::from_secs(timeout_secs), cmd.output())
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

async fn code_execution(request: &ExecuteToolRequest) -> Result<Value, String> {
    let language = request
        .args
        .get("language")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'language' argument")?;
    let code = request
        .args
        .get("code")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'code' argument")?;
    let timeout_secs = request
        .args
        .get("timeout_seconds")
        .and_then(|v| v.as_u64())
        .unwrap_or_else(|| request.timeout.unwrap_or(30));

    let (program, flag) = match language.to_lowercase().as_str() {
        "python" | "python3" => ("python3", "-c"),
        "node" | "javascript" | "js" => ("node", "-e"),
        "bash" | "sh" => ("bash", "-c"),
        "rust" | "rs" => ("rustc", "--"),
        _ => return Err(format!("Unsupported language: {}", language)),
    };

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        tokio::process::Command::new(program).arg(flag).arg(code).output(),
    )
    .await
    .map_err(|_| "Code execution timed out")?
    .map_err(|e| format!("Failed to execute code: {}", e))?;

    Ok(json!({
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "exit_code": output.status.code(),
        "success": output.status.success(),
        "language": language,
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
        let envs: std::collections::HashMap<String, Option<String>> =
            std::env::vars().map(|(k, v)| (k, Some(v))).collect();
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
        .timeout(std::time::Duration::from_secs(
            request.timeout.unwrap_or(30),
        ))
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
        .timeout(std::time::Duration::from_secs(
            request.timeout.unwrap_or(30),
        ))
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

    let resp = req
        .send()
        .await
        .map_err(|e| format!("HTTP POST failed: {}", e))?;

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

// ── Markdown Conversion (office engine) ─────────────────────────────────────

/// Upper bound on markdown returned as a tool result. The office engine can
/// emit book-length GFM; tool results feed an LLM context, so long output is
/// truncated at a char boundary with an explicit note instead of failing.
const MAX_TOOL_MARKDOWN_CHARS: usize = 30_000;

/// Tool descriptors for the built-in markdown conversion tools, shared by the
/// REST tool list (`list_tools`), the MCP server catalog
/// (`mcp_server_routes.rs`), and the agents-v1 deferred-tool listing
/// (`agents_v1_routes.rs`) so every surface advertises the same
/// name/description/schema.
pub(crate) fn markdown_builtin_tools() -> Vec<Value> {
    vec![
        json!({
            "id": "document_to_markdown",
            "label": "Document to Markdown",
            "description": "Convert an uploaded document or artifact (PDF, DOCX, PPTX, XLSX, CSV, and more) into GitHub-flavored Markdown that can be read and quoted in chat.",
            "parameters": {
                "type": "object",
                "properties": {
                    "uploadId": {
                        "type": "string",
                        "description": "ID of a file uploaded through /api/v1/uploads (the composer attachment flow)."
                    },
                    "artifactId": {
                        "type": "string",
                        "description": "ID of an artifact whose text sections should be assembled into a single Markdown document."
                    }
                }
            }
        }),
        json!({
            "id": "url_to_markdown",
            "label": "URL to Markdown",
            "description": "Fetch a web page or a document hosted at a URL and convert it into GitHub-flavored Markdown.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The http(s) URL to fetch and convert."
                    }
                },
                "required": ["url"]
            }
        }),
    ]
}

/// Truncate over-long markdown at a char boundary, appending a note so the
/// caller knows the output is partial. Returns (text, was_truncated).
fn truncate_markdown(markdown: &str) -> (String, bool) {
    let total = markdown.chars().count();
    if total <= MAX_TOOL_MARKDOWN_CHARS {
        return (markdown.to_string(), false);
    }
    let head: String = markdown.chars().take(MAX_TOOL_MARKDOWN_CHARS).collect();
    (
        format!(
            "{head}\n\n_[Output truncated — showing the first {MAX_TOOL_MARKDOWN_CHARS} of {total} characters.]_"
        ),
        true,
    )
}

/// Convert the office engine's artifact-shaped JSON into a compact tool
/// result, truncating the markdown payload when needed.
fn markdown_tool_result(body: &Value) -> Result<Value, String> {
    let markdown = body
        .get("markdown")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Office engine response did not include markdown".to_string())?;
    let (markdown, truncated) = truncate_markdown(markdown);
    Ok(json!({
        "markdown": markdown,
        "truncated": truncated,
        "title": body.get("title").cloned().unwrap_or(Value::Null),
        "format": body.get("format").cloned().unwrap_or(Value::Null),
        "sourceUrl": body.get("sourceUrl").cloned().unwrap_or(Value::Null),
    }))
}

/// Read an office-engine response: success → truncated tool result, failure →
/// the engine's own error detail.
async fn engine_markdown_response(resp: reqwest::Response) -> Result<Value, String> {
    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to read office engine response: {}", e))?;
    if !status.is_success() {
        let detail = body
            .get("detail")
            .or_else(|| body.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        return Err(format!(
            "Office engine conversion failed ({}): {}",
            status, detail
        ));
    }
    markdown_tool_result(&body)
}

fn office_engine_client(request: &ExecuteToolRequest) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(
            request.timeout.unwrap_or(60),
        ))
        .build()
        .map_err(|e| e.to_string())
}

/// Pull an artifact's text sections out of the local store and assemble them
/// as a single GFM document. Scoped to the calling user, same as the artifact
/// REST routes. Returns (document, title).
///
/// Unlike uploads, artifacts are already text, so this path does NOT round-trip
/// through the office engine: anydoc only handles binary document formats
/// (docx/pdf/xlsx/…) and rejects plain-text payloads as 415.
async fn read_artifact_as_document(
    state: &AppState,
    artifact_id: &str,
    user_id: &str,
) -> Result<(String, String), String> {
    let db = state.db.clone();
    let artifact_id = artifact_id.to_string();
    let user_id = user_id.to_string();

    tokio::task::spawn_blocking(move || {
        let conn = db
            .connect()
            .map_err(|e| format!("Failed to open database: {}", e))?;

        let title: Option<String> = conn
            .query_row(
                "SELECT title FROM artifacts WHERE id = ?1 AND user_id = ?2",
                rusqlite::params![&artifact_id, &user_id],
                |row| row.get(0),
            )
            .ok();

        let title = title.ok_or_else(|| format!("Artifact not found: '{}'", artifact_id))?;

        let mut stmt = conn
            .prepare(
                "SELECT heading, body FROM artifact_sections
                 WHERE artifact_id = ?1 ORDER BY position ASC, created_at ASC",
            )
            .map_err(|e| format!("Failed to query artifact sections: {}", e))?;
        let sections: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![&artifact_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| format!("Failed to read artifact sections: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read artifact sections: {}", e))?;

        let mut document = format!("# {}\n", title);
        for (heading, body) in sections {
            document.push_str(&format!("\n## {}\n\n{}\n", heading, body));
        }

        Ok((document, title))
    })
    .await
    .map_err(|e| format!("Artifact read task failed: {}", e))?
}

async fn document_to_markdown(
    state: &AppState,
    request: &ExecuteToolRequest,
    user_id: &str,
) -> Result<Value, String> {
    let upload_id = request.args.get("uploadId").and_then(|v| v.as_str());
    let artifact_id = request.args.get("artifactId").and_then(|v| v.as_str());

    match (upload_id, artifact_id) {
        (Some(id), None) => {
            let (bytes, filename, _media_type) = crate::upload_routes::read_upload(id)
                .ok_or_else(|| format!("Upload not found: '{}'", id))?;

            let target = format!(
                "{}/markdown",
                state.config.office_engine_url().trim_end_matches('/')
            );
            let resp = office_engine_client(request)?
                .post(&target)
                .header("x-office-filename", &filename)
                .body(bytes)
                .send()
                .await
                .map_err(|e| format!("Cannot reach the office engine: {}", e))?;

            engine_markdown_response(resp).await
        }
        (None, Some(id)) => {
            let (document, title) = read_artifact_as_document(state, id, user_id).await?;
            let (markdown, truncated) = truncate_markdown(&document);
            Ok(json!({
                "markdown": markdown,
                "truncated": truncated,
                "title": title,
                "format": "artifact",
                "sourceUrl": Value::Null,
            }))
        }
        _ => Err("Provide exactly one of 'uploadId' or 'artifactId'".to_string()),
    }
}

async fn url_to_markdown(state: &AppState, request: &ExecuteToolRequest) -> Result<Value, String> {
    let url = request
        .args
        .get("url")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .ok_or("Missing 'url' argument")?;

    let target = format!(
        "{}/markdown-url",
        state.config.office_engine_url().trim_end_matches('/')
    );
    let resp = office_engine_client(request)?
        .post(&target)
        .json(&json!({ "url": url }))
        .send()
        .await
        .map_err(|e| format!("Cannot reach the office engine: {}", e))?;

    engine_markdown_response(resp).await
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
    let mut tools = vec![
        json!({ "id": "shell.exec", "name": "Shell Execute", "description": "Execute shell commands" }),
        json!({ "id": "bash", "name": "Bash", "description": "Execute a shell command with optional timeout and restart control" }),
        json!({ "id": "code_execution", "name": "Code Execution", "description": "Execute code in a sandboxed environment" }),
        json!({ "id": "file.read", "name": "File Read", "description": "Read file contents" }),
        json!({ "id": "file.write", "name": "File Write", "description": "Write to a file" }),
        json!({ "id": "file.list", "name": "File List", "description": "List directory contents" }),
        json!({ "id": "http.get", "name": "HTTP GET", "description": "Make HTTP GET requests" }),
        json!({ "id": "http.post", "name": "HTTP POST", "description": "Make HTTP POST requests" }),
        json!({ "id": "system.info", "name": "System Info", "description": "Get system information" }),
        json!({ "id": "echo", "name": "Echo", "description": "Echo back arguments" }),
    ];
    for tool in markdown_builtin_tools() {
        tools.push(json!({
            "id": tool.get("id").cloned().unwrap_or(Value::Null),
            "name": tool.get("label").cloned().unwrap_or(Value::Null),
            "description": tool.get("description").cloned().unwrap_or(Value::Null),
            "parameters": tool.get("parameters").cloned().unwrap_or(json!({})),
        }));
    }
    let total = tools.len();
    Json(json!({
        "tools": tools,
        // The web/desktop tool registry (`tool-registry.store.ts`,
        // `native-agent-api.ts`) reads grouped buckets — mirror the same list
        // under `native` so those consumers actually see the registry
        // (previously they read a missing key and rendered zero tools).
        "native": tools,
        "total": total,
    }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_markdown_leaves_short_output_untouched() {
        let input = "# Hello\n\nSome markdown.";
        let (out, truncated) = truncate_markdown(input);
        assert_eq!(out, input);
        assert!(!truncated);
    }

    #[test]
    fn truncate_markdown_caps_long_output_with_note() {
        let input = "a".repeat(MAX_TOOL_MARKDOWN_CHARS + 500);
        let (out, truncated) = truncate_markdown(&input);
        assert!(truncated);
        assert!(out.starts_with(&"a".repeat(1000)));
        assert!(out.contains("Output truncated"));
        assert!(out.contains(&(MAX_TOOL_MARKDOWN_CHARS + 500).to_string()));
    }

    #[test]
    fn truncate_markdown_respects_char_boundaries() {
        // Multibyte characters must never be split mid-codepoint.
        let input = "é".repeat(MAX_TOOL_MARKDOWN_CHARS + 10);
        let (out, truncated) = truncate_markdown(&input);
        assert!(truncated);
        let head = out.split("\n\n_").next().unwrap();
        assert_eq!(head.chars().count(), MAX_TOOL_MARKDOWN_CHARS);
    }

    #[test]
    fn markdown_tool_result_errors_without_markdown_field() {
        let body = json!({"title": "nope"});
        assert!(markdown_tool_result(&body).is_err());
    }

    #[test]
    fn markdown_tool_result_maps_engine_payload() {
        let body = json!({
            "markdown": "# Title\n\nbody",
            "title": "Title",
            "format": "docx",
            "sourceUrl": "https://example.com",
        });
        let result = markdown_tool_result(&body).unwrap();
        assert_eq!(result["markdown"], "# Title\n\nbody");
        assert_eq!(result["truncated"], false);
        assert_eq!(result["title"], "Title");
        assert_eq!(result["format"], "docx");
        assert_eq!(result["sourceUrl"], "https://example.com");
    }

    #[test]
    fn markdown_tool_result_truncates_engine_payload() {
        let body = json!({ "markdown": "b".repeat(MAX_TOOL_MARKDOWN_CHARS * 2) });
        let result = markdown_tool_result(&body).unwrap();
        assert_eq!(result["truncated"], true);
        assert!(result["markdown"]
            .as_str()
            .unwrap()
            .contains("Output truncated"));
    }

    #[test]
    fn execute_tool_request_accepts_surface_field_names() {
        // The web/desktop surface posts `tool_name`/`parameters`.
        let req: ExecuteToolRequest = serde_json::from_str(
            r#"{"tool_name": "echo", "parameters": {"message": "hi"}, "session_id": "s1"}"#,
        )
        .unwrap();
        assert_eq!(req.tool, "echo");
        assert_eq!(req.args["message"], "hi");

        // And the canonical `tool`/`args` keys keep working.
        let req: ExecuteToolRequest =
            serde_json::from_str(r#"{"tool": "echo", "args": {}}"#).unwrap();
        assert_eq!(req.tool, "echo");
    }

    #[test]
    fn markdown_builtin_tools_advertise_expected_contract() {
        let tools = markdown_builtin_tools();
        assert_eq!(tools.len(), 2);

        let doc = &tools[0];
        assert_eq!(doc["id"], "document_to_markdown");
        assert!(doc["description"].as_str().unwrap().len() > 20);
        let props = doc["parameters"]["properties"].as_object().unwrap();
        assert!(props.contains_key("uploadId"));
        assert!(props.contains_key("artifactId"));

        let url = &tools[1];
        assert_eq!(url["id"], "url_to_markdown");
        assert_eq!(
            url["parameters"]["required"],
            json!(["url"])
        );
    }

    #[tokio::test]
    async fn bash_tool_executes_shell_command() {
        let req = ExecuteToolRequest {
            tool: "bash".to_string(),
            args: json!({ "command": "echo hello" }),
            timeout: Some(5),
            workspace_id: None,
        };
        let result = bash_exec(&req).await.unwrap();
        assert!(result["success"].as_bool().unwrap());
        assert!(result["stdout"].as_str().unwrap().contains("hello"));
        assert_eq!(result["exit_code"], 0);
    }

    #[tokio::test]
    async fn bash_tool_honors_timeout_argument() {
        let req = ExecuteToolRequest {
            tool: "bash".to_string(),
            args: json!({ "command": "sleep 5", "timeout": 1 }),
            timeout: Some(30),
            workspace_id: None,
        };
        let result = bash_exec(&req).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("timed out"));
    }

    #[tokio::test]
    async fn code_execution_runs_python() {
        let req = ExecuteToolRequest {
            tool: "code_execution".to_string(),
            args: json!({ "language": "python", "code": "print(21 + 21)" }),
            timeout: Some(5),
            workspace_id: None,
        };
        let result = code_execution(&req).await.unwrap();
        assert!(result["success"].as_bool().unwrap());
        assert!(result["stdout"].as_str().unwrap().contains("42"));
        assert_eq!(result["language"], "python");
    }

    #[tokio::test]
    async fn code_execution_rejects_missing_language() {
        let req = ExecuteToolRequest {
            tool: "code_execution".to_string(),
            args: json!({ "code": "print(1)" }),
            timeout: Some(5),
            workspace_id: None,
        };
        let result = code_execution(&req).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("language"));
    }
}
