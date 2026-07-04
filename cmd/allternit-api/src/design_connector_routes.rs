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
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::AppState;

/// Daemon-side cache for discovered Open Design skills.
/// Refreshes on a polling interval in dev and can be invalidated by SIGHUP in
/// production so skill discovery is fast and hot-reloads without restarting the
/// API.
#[derive(Debug, Clone)]
pub struct DesignSkillCache {
    inner: Arc<RwLock<DesignSkillCacheInner>>,
}

#[derive(Debug, Clone, Default)]
struct DesignSkillCacheInner {
    skills: Vec<DiscoveredSkill>,
    scanned_paths: Vec<String>,
    total: usize,
    refreshed_at: Option<Instant>,
}

impl DesignSkillCache {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(DesignSkillCacheInner::default())),
        }
    }

    pub async fn get(&self, cwd: Option<&str>) -> DiscoverSkillsResponse {
        // Return cached result if fresh (< 5s) to avoid filesystem churn.
        let is_fresh = {
            let guard = self.inner.read().await;
            guard.refreshed_at.map_or(false, |t| t.elapsed() < Duration::from_secs(5))
        };

        if !is_fresh {
            self.refresh(cwd).await;
        }

        let guard = self.inner.read().await;
        DiscoverSkillsResponse {
            skills: guard.skills.clone(),
            scanned_paths: guard.scanned_paths.clone(),
            total: guard.total,
        }
    }

    pub async fn refresh(&self, cwd: Option<&str>) {
        let paths = discover_skills_paths(cwd);
        let mut skills = Vec::new();
        let scanned: Vec<String> = paths.iter().map(|p| p.to_string_lossy().to_string()).collect();

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

        let mut guard = self.inner.write().await;
        guard.skills = skills;
        guard.scanned_paths = scanned;
        guard.total = guard.skills.len();
        guard.refreshed_at = Some(Instant::now());
    }
}

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
    State(state): State<Arc<AppState>>,
    Query(query): Query<DiscoverSkillsQuery>,
) -> impl IntoResponse {
    let response = state.design_skill_cache.get(query.cwd.as_deref()).await;
    Json(response)
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
            id: "cursor-agent".to_string(),
            name: "Cursor Agent".to_string(),
            description: "Cursor agent CLI adapter.".to_string(),
            runtime: "subprocess".to_string(),
            required_env: vec![],
            optional_env: vec!["CURSOR_API_KEY".to_string()],
        },
        AdapterKind {
            id: "kimi-cli".to_string(),
            name: "Kimi CLI".to_string(),
            description: "Moonshot Kimi agent CLI adapter.".to_string(),
            runtime: "subprocess".to_string(),
            required_env: vec![],
            optional_env: vec!["KIMI_API_KEY".to_string()],
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

fn command_on_path(cmd: &str) -> Option<PathBuf> {
    let path_env = std::env::var("PATH").unwrap_or_default();
    for dir in path_env.split(':') {
        let candidate = Path::new(dir).join(cmd);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
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
    if home.join(".claude").is_dir() || command_on_path("claude").is_some() {
        available.push("claude-desktop".to_string());
        env.insert(
            "CLAUDE_CONFIG_PATH".to_string(),
            home.join(".claude").join("claude_desktop_config.json").to_string_lossy().to_string(),
        );
    } else {
        missing.push("claude-desktop".to_string());
    }

    // Codex CLI
    if command_on_path("codex").is_some() {
        available.push("codex-cli".to_string());
        if let Ok(v) = std::env::var("OPENAI_API_KEY") {
            env.insert("OPENAI_API_KEY".to_string(), v);
        }
    } else {
        missing.push("codex-cli".to_string());
    }

    // Cursor agent
    if command_on_path("cursor-agent").is_some() || home.join(".cursor").is_dir() {
        available.push("cursor-agent".to_string());
    } else {
        missing.push("cursor-agent".to_string());
    }

    // Kimi CLI
    if command_on_path("kimi").is_some() {
        available.push("kimi-cli".to_string());
    } else {
        missing.push("kimi-cli".to_string());
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

    let cwd = req.cwd.as_deref().map(PathBuf::from).unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });

    let mut env_vars: HashMap<String, String> = std::env::vars().collect();
    if let Some(extra) = req.env {
        env_vars.extend(extra);
    }

    let (program, args) = match kind.id.as_str() {
        "claude-desktop" => ("open".to_string(), vec!["-a".to_string(), "Claude Desktop".to_string()]),
        "codex-cli" => ("codex".to_string(), vec![]),
        "cursor-agent" => ("cursor-agent".to_string(), vec![]),
        "kimi-cli" => ("kimi".to_string(), vec![]),
        "allternit-local" => ("allternit-local".to_string(), vec![]),
        "generic-mcp" => {
            let cmd = std::env::var("MCP_COMMAND").unwrap_or_default();
            let mut parts = cmd.split_whitespace().map(|s| s.to_string());
            let program = parts.next().unwrap_or_default();
            (program, parts.collect())
        }
        _ => {
            return Json(json!({
                "error": format!("Adapter {} cannot be spawned", kind.id),
            }));
        }
    };

    if program.is_empty() {
        return Json(json!({
            "error": format!("No command configured for adapter {}", kind.id),
        }));
    }

    let mut cmd = tokio::process::Command::new(&program);
    cmd.args(&args)
        .current_dir(&cwd)
        .envs(&env_vars)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    match cmd.spawn() {
        Ok(mut child) => {
            let pid = child.id();
            // Detach the child so it keeps running after this request completes.
            tokio::spawn(async move {
                let _ = child.wait().await;
            });
            Json(json!(SpawnAdapterResponse {
                kind: kind.id.clone(),
                status: "spawned".to_string(),
                command: Some(format!("{} {}", program, args.join(" ")).trim().to_string()),
                pid,
            }))
        }
        Err(err) => Json(json!({
            "error": format!("Failed to spawn adapter {}: {}", kind.id, err),
        })),
    }
}
