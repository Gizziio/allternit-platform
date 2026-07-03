//! Design / Composio connector routes
//!
//! Also hosts Open Design LTS endpoints:
//! - skill discovery across Claude Desktop, Codex CLI, and Allternit local paths
//! - agent adapter detection and spawn metadata

use axum::{
    extract::{Query, State},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::AppState;

pub fn design_connector_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/design/composio/connections", get(list_composio_connections))
        .route("/design/composio/connect", post(connect_composio))
        .route("/design/connectors/slack", post(slack_connector))
        .route("/design/connectors/notion", post(notion_connector))
        .route("/design/connectors/linear", post(linear_connector))
        .route("/design/connectors/github", post(github_connector))
        .route("/design/skills/discover", get(discover_skills))
        .route("/design/adapters", get(list_adapters))
        .route("/design/adapters/detect", post(detect_adapters))
        .route("/design/adapters/spawn", post(spawn_adapter))
}

async fn list_composio_connections(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "connections": [],
        "total": 0,
        "stub": true,
    }))
}

async fn connect_composio(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "connected",
        "stub": true,
    }))
}

async fn slack_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

async fn notion_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

async fn linear_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

async fn github_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

// ─── Skill Discovery ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredSkill {
    pub id: String,
    pub name: String,
    pub path: String,
    pub source: String,
    pub manifest: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverSkillsResponse {
    pub skills: Vec<DiscoveredSkill>,
    pub scanned_paths: Vec<String>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverSkillsQuery {
    pub cwd: Option<String>,
}

fn discover_skills_paths(cwd: Option<&str>) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(cwd) = cwd {
        let base = Path::new(cwd);
        paths.push(base.join("skills"));
        paths.push(base.join(".claude").join("skills"));
    }

    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".claude").join("skills"));
    }

    paths
}

fn scan_skill_directory(root: &Path, source: &str, out: &mut Vec<DiscoveredSkill>) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let id = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let mut name = id.clone();
        let mut manifest_value: Option<serde_json::Value> = None;

        for filename in ["open-design.json", "manifest.json", "claude.json"] {
            let manifest_path = path.join(filename);
            if manifest_path.is_file() {
                if let Ok(raw) = std::fs::read_to_string(&manifest_path) {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) {
                        if let Some(n) = parsed.get("name").and_then(|v| v.as_str()) {
                            name = n.to_string();
                        }
                        manifest_value = Some(parsed);
                    }
                }
                break;
            }
        }

        // Fallback: parse SKILL.md frontmatter / first heading
        if manifest_value.is_none() {
            let skill_md = path.join("SKILL.md");
            if let Ok(raw) = std::fs::read_to_string(&skill_md) {
                let in_frontmatter = raw.starts_with("---");
                let mut passed_frontmatter = false;
                for line in raw.lines() {
                    if in_frontmatter && !passed_frontmatter {
                        if line == "---" {
                            passed_frontmatter = true;
                        }
                        continue;
                    }
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if trimmed.starts_with('#') {
                        name = trimmed.trim_start_matches('#').trim().to_string();
                        break;
                    }
                }
            }
        }

        out.push(DiscoveredSkill {
            id,
            name,
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            manifest: manifest_value,
        });
    }
}

async fn discover_skills(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<DiscoverSkillsQuery>,
) -> impl IntoResponse {
    let paths = discover_skills_paths(query.cwd.as_deref());
    let mut skills = Vec::new();
    let scanned: Vec<String> = paths
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    for path in &paths {
        let source = if path.starts_with(dirs::home_dir().unwrap_or_default().join(".claude")) {
            "claude-desktop"
        } else if path.ends_with("skills") && path.components().count() <= 3 {
            "codex-cli"
        } else {
            "allternit-local"
        };
        scan_skill_directory(path, source, &mut skills);
    }

    Json(DiscoverSkillsResponse {
        total: skills.len(),
        scanned_paths: scanned,
        skills,
    })
}

// ─── Agent Adapter Detection / Spawning ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterKind {
    pub id: String,
    pub name: String,
    pub description: String,
    pub runtime: String,
    pub required_env: Vec<String>,
    pub optional_env: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterDetectionResult {
    pub available: Vec<String>,
    pub missing: Vec<String>,
    pub env: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectAdaptersRequest {
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnAdapterRequest {
    pub kind: String,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnAdapterResponse {
    pub kind: String,
    pub status: String,
    pub command: Option<String>,
    pub pid: Option<u32>,
}

fn adapter_kinds() -> Vec<AdapterKind> {
    vec![
        AdapterKind {
            id: "claude-desktop".to_string(),
            name: "Claude Desktop".to_string(),
            description: "Local Claude Desktop MCP / skills adapter.".to_string(),
            runtime: "mcp".to_string(),
            required_env: vec![],
            optional_env: vec!["CLAUDE_CONFIG_PATH".to_string()],
        },
        AdapterKind {
            id: "codex-cli".to_string(),
            name: "Codex CLI".to_string(),
            description: "OpenAI Codex CLI skill adapter.".to_string(),
            runtime: "subprocess".to_string(),
            required_env: vec!["OPENAI_API_KEY".to_string()],
            optional_env: vec!["CODEX_SKILLS_PATH".to_string()],
        },
        AdapterKind {
            id: "allternit-local".to_string(),
            name: "Allternit Local".to_string(),
            description: "In-process Allternit design runtime adapter.".to_string(),
            runtime: "local".to_string(),
            required_env: vec![],
            optional_env: vec!["ALLTERNIT_LOCAL_URL".to_string()],
        },
        AdapterKind {
            id: "generic-mcp".to_string(),
            name: "Generic MCP".to_string(),
            description: "Stdio/SSE Model Context Protocol server.".to_string(),
            runtime: "subprocess".to_string(),
            required_env: vec!["MCP_COMMAND".to_string()],
            optional_env: vec!["MCP_CWD".to_string()],
        },
    ]
}

async fn list_adapters(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "adapters": adapter_kinds(),
        "total": adapter_kinds().len(),
    }))
}

async fn detect_adapters(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<DetectAdaptersRequest>,
) -> impl IntoResponse {
    let mut available = Vec::new();
    let mut missing = Vec::new();
    let mut env = HashMap::new();

    let home = dirs::home_dir().unwrap_or_default();
    let cwd = req.cwd.as_deref().map(Path::new);

    // Claude Desktop
    if home.join(".claude").is_dir() {
        available.push("claude-desktop".to_string());
        env.insert(
            "CLAUDE_CONFIG_PATH".to_string(),
            home.join(".claude").join("claude_desktop_config.json").to_string_lossy().to_string(),
        );
    } else {
        missing.push("claude-desktop".to_string());
    }

    // Codex CLI
    let has_codex_skills = cwd.map(|p| p.join("skills").is_dir()).unwrap_or(false)
        || home.join(".codex").is_dir();
    if has_codex_skills || std::env::var("OPENAI_API_KEY").is_ok() {
        available.push("codex-cli".to_string());
        if let Ok(v) = std::env::var("OPENAI_API_KEY") {
            env.insert("OPENAI_API_KEY".to_string(), v);
        }
    } else {
        missing.push("codex-cli".to_string());
    }

    // Allternit local
    if cwd.map(|p| p.join(".allternit").is_dir()).unwrap_or(false) {
        available.push("allternit-local".to_string());
    } else {
        missing.push("allternit-local".to_string());
    }

    // Generic MCP
    if std::env::var("MCP_COMMAND").is_ok() {
        available.push("generic-mcp".to_string());
        if let Ok(v) = std::env::var("MCP_COMMAND") {
            env.insert("MCP_COMMAND".to_string(), v);
        }
    } else {
        missing.push("generic-mcp".to_string());
    }

    Json(AdapterDetectionResult {
        available,
        missing,
        env,
    })
}

async fn spawn_adapter(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SpawnAdapterRequest>,
) -> impl IntoResponse {
    let kinds: HashMap<String, AdapterKind> = adapter_kinds()
        .into_iter()
        .map(|k| (k.id.clone(), k))
        .collect();

    let Some(kind) = kinds.get(&req.kind) else {
        return Json(json!({
            "error": format!("Unknown adapter kind: {}", req.kind),
        }));
    };

    let command = match kind.id.as_str() {
        "claude-desktop" => Some("open -a 'Claude Desktop'".to_string()),
        "codex-cli" => Some("codex".to_string()),
        "allternit-local" => Some("allternit-local".to_string()),
        "generic-mcp" => std::env::var("MCP_COMMAND").ok(),
        _ => None,
    };

    Json(json!(SpawnAdapterResponse {
        kind: kind.id.clone(),
        status: "spawned".to_string(),
        command,
        pid: None,
    }))
}
