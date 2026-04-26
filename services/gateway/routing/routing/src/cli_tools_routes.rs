//! API routes for CLI tool management.
//!
//! This module provides REST API endpoints for:
//! - Discovering CLI tools available on this machine
//! - Returning installed/discovered tool catalogs
//! - Executing tools
//! - Checking install status

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path as FsPath, PathBuf},
    process::Command as ProcessCommand,
    sync::Arc,
    time::Instant,
};
use tracing::{debug, error, info, warn};
use utoipa::ToSchema;

use crate::AppState;

const MAX_DISCOVERED_TOOLS: usize = 3000;
const MAX_PATH_TOOLS: usize = 2600;
const MAX_SCRIPT_TOOLS: usize = 1400;
const MAX_INTERNAL_TOOLS: usize = 600;

// ============================================================================
// Types
// ============================================================================

/// CLI tool category
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum CliToolCategory {
    #[serde(rename = "shell")]
    Shell,
    #[serde(rename = "file")]
    File,
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "network")]
    Network,
    #[serde(rename = "system")]
    System,
    #[serde(rename = "dev")]
    Dev,
}

/// CLI tool information
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CliTool {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Description
    pub description: String,
    /// Command to execute
    pub command: String,
    /// Category
    pub category: CliToolCategory,
    /// Whether the tool is installed
    pub installed: bool,
    /// Version if installed
    pub version: Option<String>,
    /// Installation source (brew, apt, npm, cargo, etc.)
    pub source: Option<String>,
    /// Tags for filtering
    pub tags: Vec<String>,
    /// Arguments schema
    pub arguments: Option<Vec<CliToolArgument>>,
}

/// CLI tool argument definition
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CliToolArgument {
    /// Argument name
    pub name: String,
    /// Argument description
    pub description: String,
    /// Whether the argument is required
    pub required: bool,
    /// Default value
    pub default: Option<String>,
    /// Argument type
    pub arg_type: ArgumentType,
}

/// Argument type
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum ArgumentType {
    #[serde(rename = "string")]
    String,
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "boolean")]
    Boolean,
    #[serde(rename = "file")]
    File,
    #[serde(rename = "directory")]
    Directory,
}

/// Request to install a CLI tool
#[derive(Debug, Deserialize, ToSchema)]
pub struct InstallCliToolRequest {
    /// Installation method (brew, apt, npm, cargo, etc.)
    pub method: Option<String>,
    /// Specific version to install
    pub version: Option<String>,
}

/// Request to execute a CLI tool
#[derive(Debug, Deserialize, ToSchema)]
pub struct ExecuteCliToolRequest {
    /// Arguments to pass to the tool
    pub args: Vec<String>,
    /// Working directory
    pub working_dir: Option<String>,
    /// Environment variables
    pub env: Option<HashMap<String, String>>,
    /// Timeout in seconds
    pub timeout: Option<u64>,
}

/// Request to check if a command exists on this machine.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CheckCliToolRequest {
    pub command: String,
}

/// Response for command existence checks.
#[derive(Debug, Serialize, ToSchema)]
pub struct CheckCliToolResponse {
    pub installed: bool,
    pub version: Option<String>,
}

/// Response from executing a CLI tool
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecuteCliToolResponse {
    /// Exit code
    pub exit_code: i32,
    /// Standard output
    pub stdout: String,
    /// Standard error
    pub stderr: String,
    /// Execution duration in milliseconds
    pub duration_ms: u64,
}

/// List CLI tools response
#[derive(Debug, Serialize, ToSchema)]
pub struct ListCliToolsResponse {
    /// List of CLI tools
    pub tools: Vec<CliTool>,
    /// Total count
    pub total: usize,
}

// ============================================================================
// Discovery Helpers
// ============================================================================

fn normalize_tool_name(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let first = trimmed.chars().next()?;
    if !first.is_ascii_alphanumeric() {
        return None;
    }

    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | ':' | '+' | '@' | '-'))
    {
        return None;
    }

    Some(trimmed.to_string())
}

fn to_tool_id(raw: &str) -> String {
    let mut id = String::with_capacity(raw.len());
    let mut last_dash = false;

    for ch in raw.chars() {
        let mapped = if ch.is_ascii_alphanumeric() {
            ch.to_ascii_lowercase()
        } else {
            '-'
        };
        if mapped == '-' {
            if last_dash {
                continue;
            }
            last_dash = true;
        } else {
            last_dash = false;
        }
        id.push(mapped);
    }

    let id = id.trim_matches('-').to_string();
    if id.is_empty() {
        "cli-tool".to_string()
    } else {
        id
    }
}

fn infer_category(name: &str) -> CliToolCategory {
    let lower = name.to_ascii_lowercase();

    if [
        "curl", "wget", "http", "nmap", "dig", "ping", "ssh", "scp", "netcat", "nc",
    ]
    .iter()
    .any(|token| lower.contains(token))
    {
        return CliToolCategory::Network;
    }

    if [
        "cat", "less", "more", "grep", "rg", "awk", "sed", "jq", "yq", "tr", "cut", "sort",
    ]
    .iter()
    .any(|token| lower.contains(token))
    {
        return CliToolCategory::Text;
    }

    if [
        "ls", "cp", "mv", "rm", "find", "fd", "tree", "tar", "zip", "unzip", "rsync",
    ]
    .iter()
    .any(|token| lower.contains(token))
    {
        return CliToolCategory::File;
    }

    if [
        "top",
        "htop",
        "ps",
        "kill",
        "launchctl",
        "systemctl",
        "brew",
        "apt",
        "dnf",
    ]
    .iter()
    .any(|token| lower.contains(token))
    {
        return CliToolCategory::System;
    }

    if [
        "git",
        "node",
        "npm",
        "pnpm",
        "yarn",
        "python",
        "cargo",
        "rustc",
        "go",
        "java",
        "docker",
        "kubectl",
        "terraform",
        "allternit",
        "gizzi",
    ]
    .iter()
    .any(|token| lower.contains(token))
    {
        return CliToolCategory::Dev;
    }

    CliToolCategory::Shell
}

fn tags_for_category(category: &CliToolCategory) -> Vec<String> {
    match category {
        CliToolCategory::Shell => vec!["shell".to_string()],
        CliToolCategory::File => vec!["file".to_string()],
        CliToolCategory::Text => vec!["text".to_string()],
        CliToolCategory::Network => vec!["network".to_string()],
        CliToolCategory::System => vec!["system".to_string()],
        CliToolCategory::Dev => vec!["dev".to_string()],
    }
}

fn shell_escape(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }
    let escaped = value.replace('\'', "'\\''");
    format!("'{}'", escaped)
}

#[cfg(unix)]
fn is_executable_file(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.is_file() && metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable_file(metadata: &fs::Metadata) -> bool {
    metadata.is_file()
}

fn insert_tool(registry: &mut HashMap<String, CliTool>, tool: CliTool, limit: usize) {
    if registry.len() >= limit {
        return;
    }
    let key = tool.name.to_ascii_lowercase();
    registry.entry(key).or_insert(tool);
}

fn ancestor_candidates(relative_path: &str, max_depth: usize) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let cwd = match env::current_dir() {
        Ok(dir) => dir,
        Err(_) => return out,
    };

    for depth in 0..=max_depth {
        let mut base = cwd.clone();
        for _ in 0..depth {
            if !base.pop() {
                break;
            }
        }
        let candidate = base.join(relative_path);
        let key = candidate.to_string_lossy().to_string();
        if seen.insert(key) {
            out.push(candidate);
        }
    }

    out
}

fn discover_path_tools(registry: &mut HashMap<String, CliTool>) {
    let path_var = match env::var_os("PATH") {
        Some(value) => value,
        None => return,
    };

    for dir in env::split_paths(&path_var) {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let name = match entry.file_name().into_string() {
                Ok(name) => name,
                Err(_) => continue,
            };
            if name.starts_with('.') {
                continue;
            }

            let normalized = match normalize_tool_name(&name) {
                Some(value) => value,
                None => continue,
            };

            let metadata = match entry.metadata() {
                Ok(meta) => meta,
                Err(_) => continue,
            };
            if !is_executable_file(&metadata) {
                continue;
            }

            let category = infer_category(&normalized);
            let mut tags = tags_for_category(&category);
            tags.push("path".to_string());

            let command_path = entry.path().to_string_lossy().to_string();
            let tool = CliTool {
                id: to_tool_id(&normalized),
                name: normalized.clone(),
                description: format!("Discovered executable from {}", dir.to_string_lossy()),
                command: command_path,
                category,
                installed: true,
                version: None,
                source: Some("system-path".to_string()),
                tags,
                arguments: None,
            };

            insert_tool(registry, tool, MAX_PATH_TOOLS);
            if registry.len() >= MAX_PATH_TOOLS {
                return;
            }
        }
    }
}

fn discover_package_script_tools(registry: &mut HashMap<String, CliTool>) {
    let mut package_paths = Vec::new();
    package_paths.extend(ancestor_candidates("package.json", 6));
    package_paths.extend(ancestor_candidates("cmd/gizzi-code/package.json", 6));
    package_paths.extend(ancestor_candidates("7-apps/ts/cli/package.json", 6));

    let mut seen_paths = HashSet::new();
    for package_path in package_paths {
        let path_key = package_path.to_string_lossy().to_string();
        if !seen_paths.insert(path_key) {
            continue;
        }

        let raw = match fs::read_to_string(&package_path) {
            Ok(raw) => raw,
            Err(_) => continue,
        };
        let json: Value = match serde_json::from_str(&raw) {
            Ok(json) => json,
            Err(_) => continue,
        };

        let package_dir = package_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));

        let package_name = json
            .get("name")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .unwrap_or_else(|| {
                package_dir
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("workspace")
                    .to_string()
            });
        let package_label =
            normalize_tool_name(package_name.split('/').next_back().unwrap_or(&package_name))
                .unwrap_or_else(|| "workspace".to_string());

        if let Some(scripts) = json.get("scripts").and_then(|value| value.as_object()) {
            for (script_name, script_command) in scripts {
                if registry.len() >= MAX_SCRIPT_TOOLS {
                    break;
                }
                if !script_command.is_string() {
                    continue;
                }

                let tool_name = format!("{}:{}", package_label, script_name);
                let normalized_name = match normalize_tool_name(&tool_name) {
                    Some(name) => name,
                    None => continue,
                };

                let category = infer_category(script_name);
                let mut tags = tags_for_category(&category);
                tags.extend(["internal".to_string(), "script".to_string()]);

                let tool = CliTool {
                    id: to_tool_id(&normalized_name),
                    name: normalized_name.clone(),
                    description: format!("Package script from {}", package_name),
                    command: format!(
                        "pnpm --dir {} run {}",
                        shell_escape(&package_dir.to_string_lossy()),
                        shell_escape(script_name)
                    ),
                    category,
                    installed: true,
                    version: None,
                    source: Some("package-script".to_string()),
                    tags,
                    arguments: None,
                };
                insert_tool(registry, tool, MAX_SCRIPT_TOOLS);
            }
        }

        if let Some(bin_value) = json.get("bin") {
            match bin_value {
                Value::String(bin_path) => {
                    let bin_name = package_name
                        .split('/')
                        .next_back()
                        .unwrap_or(&package_name)
                        .to_string();
                    if let Some(normalized_name) = normalize_tool_name(&bin_name) {
                        let absolute = package_dir.join(bin_path);
                        let category = CliToolCategory::Dev;
                        let mut tags = tags_for_category(&category);
                        tags.extend(["internal".to_string(), "bin".to_string()]);
                        let tool = CliTool {
                            id: to_tool_id(&normalized_name),
                            name: normalized_name.clone(),
                            description: format!("CLI binary from {}", package_name),
                            command: absolute.to_string_lossy().to_string(),
                            category,
                            installed: true,
                            version: None,
                            source: Some("package-bin".to_string()),
                            tags,
                            arguments: None,
                        };
                        insert_tool(registry, tool, MAX_SCRIPT_TOOLS);
                    }
                }
                Value::Object(bin_map) => {
                    for (bin_name, bin_path_value) in bin_map {
                        let bin_path = match bin_path_value.as_str() {
                            Some(path) => path,
                            None => continue,
                        };
                        let normalized_name = match normalize_tool_name(bin_name) {
                            Some(name) => name,
                            None => continue,
                        };
                        let absolute = package_dir.join(bin_path);
                        let category = CliToolCategory::Dev;
                        let mut tags = tags_for_category(&category);
                        tags.extend(["internal".to_string(), "bin".to_string()]);
                        let tool = CliTool {
                            id: to_tool_id(&normalized_name),
                            name: normalized_name.clone(),
                            description: format!("CLI binary from {}", package_name),
                            command: absolute.to_string_lossy().to_string(),
                            category,
                            installed: true,
                            version: None,
                            source: Some("package-bin".to_string()),
                            tags,
                            arguments: None,
                        };
                        insert_tool(registry, tool, MAX_SCRIPT_TOOLS);
                    }
                }
                _ => {}
            }
        }
    }
}

fn normalize_cli_literal(literal: &str) -> Option<String> {
    let trimmed = literal.trim();
    if trimmed.is_empty() {
        return None;
    }
    let first_token = trimmed.split_whitespace().next()?;
    if first_token.starts_with('<') || first_token.starts_with('[') {
        return None;
    }
    normalize_tool_name(first_token)
}

fn extract_quoted_after_marker(content: &str, marker: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut cursor = 0usize;
    let bytes = content.as_bytes();

    while cursor < bytes.len() {
        let Some(offset) = content[cursor..].find(marker) else {
            break;
        };
        let mut idx = cursor + offset + marker.len();

        while idx < bytes.len() && bytes[idx].is_ascii_whitespace() {
            idx += 1;
        }
        if idx >= bytes.len() {
            break;
        }

        let quote = bytes[idx] as char;
        if quote != '\'' && quote != '"' {
            cursor = idx.saturating_add(1);
            continue;
        }
        idx += 1;

        let mut value = String::new();
        while idx < bytes.len() {
            let ch = bytes[idx] as char;
            if ch == '\\' && idx + 1 < bytes.len() {
                value.push(bytes[idx + 1] as char);
                idx += 2;
                continue;
            }
            if ch == quote {
                break;
            }
            value.push(ch);
            idx += 1;
        }

        let trimmed = value.trim();
        if !trimmed.is_empty() {
            values.push(trimmed.to_string());
        }

        cursor = idx.saturating_add(1);
    }

    values
}

fn discover_internal_cli_tools(registry: &mut HashMap<String, CliTool>) {
    let command_dirs = ancestor_candidates("cmd/gizzi-code/src/cli/commands", 6);
    let mut seen_dirs = HashSet::new();
    for command_dir in command_dirs {
        if registry.len() >= MAX_INTERNAL_TOOLS {
            break;
        }
        let dir_key = command_dir.to_string_lossy().to_string();
        if !seen_dirs.insert(dir_key) {
            continue;
        }

        let entries = match fs::read_dir(&command_dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            if registry.len() >= MAX_INTERNAL_TOOLS {
                break;
            }
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("ts") {
                continue;
            }
            let module_name = match path.file_stem().and_then(|stem| stem.to_str()) {
                Some(name) if name != "cmd" => name.to_string(),
                _ => continue,
            };
            let module_literal = match normalize_cli_literal(&module_name) {
                Some(literal) => literal,
                None => continue,
            };

            let top_name = format!("gizzi:{}", module_literal);
            if let Some(normalized_name) = normalize_tool_name(&top_name) {
                let category = CliToolCategory::Dev;
                let mut tags = tags_for_category(&category);
                tags.extend(["internal".to_string(), "gizzi".to_string()]);
                let tool = CliTool {
                    id: to_tool_id(&normalized_name),
                    name: normalized_name.clone(),
                    description: format!("Internal Gizzi command from {}", module_name),
                    command: format!("gizzi {}", module_literal),
                    category,
                    installed: true,
                    version: None,
                    source: Some("internal-cli".to_string()),
                    tags,
                    arguments: None,
                };
                insert_tool(registry, tool, MAX_INTERNAL_TOOLS);
            }

            let source = match fs::read_to_string(&path) {
                Ok(source) => source,
                Err(_) => continue,
            };
            for raw_literal in extract_quoted_after_marker(&source, "command:") {
                if registry.len() >= MAX_INTERNAL_TOOLS {
                    break;
                }
                let Some(subcommand_literal) = normalize_cli_literal(&raw_literal) else {
                    continue;
                };
                if subcommand_literal == module_literal {
                    continue;
                }
                let nested_name = format!("gizzi:{}:{}", module_literal, subcommand_literal);
                let Some(normalized_name) = normalize_tool_name(&nested_name) else {
                    continue;
                };
                let category = CliToolCategory::Dev;
                let mut tags = tags_for_category(&category);
                tags.extend([
                    "internal".to_string(),
                    "gizzi".to_string(),
                    "subcommand".to_string(),
                ]);
                let tool = CliTool {
                    id: to_tool_id(&normalized_name),
                    name: normalized_name.clone(),
                    description: format!("Internal Gizzi subcommand from {}", module_name),
                    command: format!("gizzi {} {}", module_literal, subcommand_literal),
                    category,
                    installed: true,
                    version: None,
                    source: Some("internal-cli".to_string()),
                    tags,
                    arguments: None,
                };
                insert_tool(registry, tool, MAX_INTERNAL_TOOLS);
            }
        }
    }

    let allternit_switch_files = ancestor_candidates("cmd/gizzi-code/src/cli/allternit.ts", 6);
    let mut seen_files = HashSet::new();
    for switch_file in allternit_switch_files {
        if registry.len() >= MAX_INTERNAL_TOOLS {
            break;
        }
        let file_key = switch_file.to_string_lossy().to_string();
        if !seen_files.insert(file_key) {
            continue;
        }
        let source = match fs::read_to_string(&switch_file) {
            Ok(source) => source,
            Err(_) => continue,
        };

        for raw_subcommand in extract_quoted_after_marker(&source, "case") {
            if registry.len() >= MAX_INTERNAL_TOOLS {
                break;
            }
            if raw_subcommand.is_empty()
                || raw_subcommand == "help"
                || raw_subcommand.starts_with('-')
            {
                continue;
            }
            let Some(normalized_subcommand) = normalize_cli_literal(&raw_subcommand) else {
                continue;
            };
            let allternit_name = format!("allternit:{}", normalized_subcommand);
            let Some(normalized_name) = normalize_tool_name(&allternit_name) else {
                continue;
            };
            let category = CliToolCategory::Dev;
            let mut tags = tags_for_category(&category);
            tags.extend(["internal".to_string(), "allternit".to_string()]);
            let tool = CliTool {
                id: to_tool_id(&normalized_name),
                name: normalized_name.clone(),
                description: format!(
                    "Internal allternit subcommand from {}",
                    switch_file.to_string_lossy()
                ),
                command: format!("allternit {}", normalized_subcommand),
                category,
                installed: true,
                version: None,
                source: Some("internal-cli".to_string()),
                tags,
                arguments: None,
            };
            insert_tool(registry, tool, MAX_INTERNAL_TOOLS);
        }
    }
}

fn discover_cli_tools_catalog() -> Vec<CliTool> {
    let mut registry = HashMap::new();

    discover_path_tools(&mut registry);
    discover_package_script_tools(&mut registry);
    discover_internal_cli_tools(&mut registry);

    let mut tools = registry.into_values().collect::<Vec<_>>();
    tools.sort_by(|a, b| a.name.cmp(&b.name));
    if tools.len() > MAX_DISCOVERED_TOOLS {
        tools.truncate(MAX_DISCOVERED_TOOLS);
    }
    tools
}

fn first_non_empty_line(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(120).collect())
}

fn detect_command_version(command: &str) -> Option<String> {
    let flags = ["--version", "-V", "-v"];
    for flag in flags {
        let output = ProcessCommand::new(command).arg(flag).output();
        let Ok(output) = output else {
            continue;
        };
        if !output.status.success() {
            continue;
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(line) = first_non_empty_line(&stdout) {
            return Some(line);
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        if let Some(line) = first_non_empty_line(&stderr) {
            return Some(line);
        }
    }
    None
}

fn check_command_installed(command: &str) -> (bool, Option<String>) {
    let normalized = match normalize_tool_name(command) {
        Some(normalized) => normalized,
        None => return (false, None),
    };

    let status = ProcessCommand::new("sh")
        .arg("-lc")
        .arg(format!("command -v {}", shell_escape(&normalized)))
        .output();

    let Ok(output) = status else {
        return (false, None);
    };
    if !output.status.success() {
        return (false, None);
    }

    let version = detect_command_version(&normalized);
    (true, version)
}

fn run_tool_command(
    command: &str,
    args: &[String],
    working_dir: Option<&str>,
    env_vars: Option<&HashMap<String, String>>,
) -> std::io::Result<std::process::Output> {
    let mut child = if command.contains(' ')
        || command.contains('|')
        || command.contains('&')
        || command.contains(';')
    {
        let mut cmd = ProcessCommand::new("sh");
        let escaped_args = args
            .iter()
            .map(|arg| shell_escape(arg))
            .collect::<Vec<_>>()
            .join(" ");
        let command_line = if escaped_args.is_empty() {
            command.to_string()
        } else {
            format!("{} {}", command, escaped_args)
        };
        cmd.arg("-lc").arg(command_line);
        cmd
    } else {
        let mut cmd = ProcessCommand::new(command);
        cmd.args(args);
        cmd
    };

    if let Some(dir) = working_dir {
        child.current_dir(FsPath::new(dir));
    }

    if let Some(env_map) = env_vars {
        for (key, value) in env_map {
            child.env(key, value);
        }
    }

    child.output()
}

// ============================================================================
// Route Handlers
// ============================================================================

/// List all available CLI tools
#[utoipa::path(
    get,
    path = "/api/v1/cli-tools",
    responses(
        (status = 200, description = "List of CLI tools", body = ListCliToolsResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_cli_tools(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<ListCliToolsResponse>, StatusCode> {
    debug!("Listing CLI tools");

    let tools = tokio::task::spawn_blocking(discover_cli_tools_catalog)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let total = tools.len();

    Ok(Json(ListCliToolsResponse { tools, total }))
}

/// List installed CLI tools.
#[utoipa::path(
    get,
    path = "/api/v1/cli-tools/installed",
    responses(
        (status = 200, description = "List of installed CLI tools", body = ListCliToolsResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_installed_cli_tools(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<ListCliToolsResponse>, StatusCode> {
    debug!("Listing installed CLI tools");
    let mut tools = tokio::task::spawn_blocking(discover_cli_tools_catalog)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    tools.retain(|tool| tool.installed);
    let total = tools.len();
    Ok(Json(ListCliToolsResponse { tools, total }))
}

/// Discover CLI tools from system/runtime sources.
#[utoipa::path(
    post,
    path = "/api/v1/cli-tools/discover",
    responses(
        (status = 200, description = "Discovered CLI tools", body = ListCliToolsResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn discover_cli_tools(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<ListCliToolsResponse>, StatusCode> {
    debug!("Discovering CLI tools");
    let tools = tokio::task::spawn_blocking(discover_cli_tools_catalog)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let total = tools.len();
    Ok(Json(ListCliToolsResponse { tools, total }))
}

/// Get details about a specific CLI tool
#[utoipa::path(
    get,
    path = "/api/v1/cli-tools/{id}",
    params(
        ("id" = String, Path, description = "CLI tool ID")
    ),
    responses(
        (status = 200, description = "CLI tool details", body = CliTool),
        (status = 404, description = "Tool not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_cli_tool(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<CliTool>, StatusCode> {
    debug!("Getting CLI tool: {}", id);

    let requested_id = id.to_ascii_lowercase();
    let tools = tokio::task::spawn_blocking(discover_cli_tools_catalog)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let tool = tools.into_iter().find(|tool| {
        tool.id.eq_ignore_ascii_case(&requested_id) || tool.name.eq_ignore_ascii_case(&requested_id)
    });

    match tool {
        Some(tool) => Ok(Json(tool)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Install a CLI tool
#[utoipa::path(
    post,
    path = "/api/v1/cli-tools/{id}/install",
    params(
        ("id" = String, Path, description = "CLI tool ID")
    ),
    request_body = InstallCliToolRequest,
    responses(
        (status = 501, description = "Install not implemented")
    )
)]
pub async fn install_cli_tool(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<InstallCliToolRequest>,
) -> Result<StatusCode, StatusCode> {
    warn!(
        "Install requested for {} (method {:?}, version {:?}) but install flow is not implemented yet",
        id, request.method, request.version
    );
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Uninstall a CLI tool
#[utoipa::path(
    delete,
    path = "/api/v1/cli-tools/{id}/uninstall",
    params(
        ("id" = String, Path, description = "CLI tool ID")
    ),
    responses(
        (status = 501, description = "Uninstall not implemented")
    )
)]
pub async fn uninstall_cli_tool(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    warn!(
        "Uninstall requested for {} but uninstall flow is not implemented yet",
        id
    );
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Execute a CLI tool
#[utoipa::path(
    post,
    path = "/api/v1/cli-tools/{id}/execute",
    params(
        ("id" = String, Path, description = "CLI tool ID")
    ),
    request_body = ExecuteCliToolRequest,
    responses(
        (status = 200, description = "Tool executed successfully", body = ExecuteCliToolResponse),
        (status = 404, description = "Tool not found"),
        (status = 500, description = "Execution failed")
    )
)]
pub async fn execute_cli_tool(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<ExecuteCliToolRequest>,
) -> Result<Json<ExecuteCliToolResponse>, StatusCode> {
    info!("Executing CLI tool: {} with args: {:?}", id, request.args);

    let requested_id = id.to_ascii_lowercase();
    let tools = tokio::task::spawn_blocking(discover_cli_tools_catalog)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let tool = tools.into_iter().find(|tool| {
        tool.id.eq_ignore_ascii_case(&requested_id) || tool.name.eq_ignore_ascii_case(&requested_id)
    });
    let Some(tool) = tool else {
        return Err(StatusCode::NOT_FOUND);
    };

    let command = tool.command.clone();
    let args = request.args.clone();
    let working_dir = request.working_dir.clone();
    let env_vars = request.env.clone();
    let start = Instant::now();

    let output = tokio::task::spawn_blocking(move || {
        run_tool_command(&command, &args, working_dir.as_deref(), env_vars.as_ref())
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|err| {
        error!("CLI execution failed: {}", err);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let duration_ms = start.elapsed().as_millis() as u64;
    let response = ExecuteCliToolResponse {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        duration_ms,
    };

    Ok(Json(response))
}

/// Check if a command is installed.
#[utoipa::path(
    post,
    path = "/api/v1/cli-tools/check",
    request_body = CheckCliToolRequest,
    responses(
        (status = 200, description = "Install status for command", body = CheckCliToolResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn check_cli_tool(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<CheckCliToolRequest>,
) -> Result<Json<CheckCliToolResponse>, StatusCode> {
    let command = request.command.trim().to_string();
    if command.is_empty() {
        return Ok(Json(CheckCliToolResponse {
            installed: false,
            version: None,
        }));
    }

    let (installed, version) =
        tokio::task::spawn_blocking(move || check_command_installed(&command))
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CheckCliToolResponse { installed, version }))
}

/// List CLI tool categories
#[utoipa::path(
    get,
    path = "/api/v1/cli-tools/categories",
    responses(
        (status = 200, description = "List of categories")
    )
)]
pub async fn list_cli_tool_categories(
    State(_state): State<Arc<AppState>>,
) -> Json<HashMap<String, String>> {
    let mut categories = HashMap::new();
    categories.insert("shell".to_string(), "Shell & Terminal".to_string());
    categories.insert("file".to_string(), "File Operations".to_string());
    categories.insert("text".to_string(), "Text Processing".to_string());
    categories.insert("network".to_string(), "Network & HTTP".to_string());
    categories.insert("system".to_string(), "System & Monitoring".to_string());
    categories.insert("dev".to_string(), "Development".to_string());

    Json(categories)
}

// ============================================================================
// Router
// ============================================================================

/// Create CLI tools router
pub fn cli_tools_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/cli-tools", get(list_cli_tools))
        .route("/cli-tools/installed", get(list_installed_cli_tools))
        .route("/cli-tools/discover", post(discover_cli_tools))
        .route("/cli-tools/check", post(check_cli_tool))
        .route("/cli-tools/categories", get(list_cli_tool_categories))
        .route("/cli-tools/:id", get(get_cli_tool))
        .route("/cli-tools/:id/install", post(install_cli_tool))
        .route("/cli-tools/:id/uninstall", delete(uninstall_cli_tool))
        .route("/cli-tools/:id/execute", post(execute_cli_tool))
}
