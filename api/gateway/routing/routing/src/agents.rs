#![allow(dead_code, unused_variables, unused_imports)]
//! Agent Management Endpoints
//!
//! Provides full CRUD for agents with Registry + Rails integration:
//! - Agents are stored in the Registry
//! - Runs are DAGs in Rails
//! - Tasks are WIHs in Rails
//! - Checkpoints use Rails Vault
//! - Execution routes through Kernel

use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Sse},
    routing::{delete, get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    pub voice_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_speak: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speak_on_checkpoint: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default = "default_agent_type")]
    pub agent_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_agent_id: Option<String>,
    pub model: String,
    pub provider: String,
    pub capabilities: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    pub tools: Vec<String>,
    pub max_iterations: i32,
    pub temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<VoiceConfig>,
    pub config: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_documents: Option<WorkspaceDocuments>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<String>,
}

fn default_agent_type() -> String {
    "worker".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDocuments {
    pub identity: String,
    pub role_card: String,
    pub voice: String,
    pub relationships: String,
    pub progression: String,
    pub avatar: String,
    pub compiled: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateAgentRequest {
    pub name: String,
    pub description: String,
    #[serde(default = "default_agent_type")]
    pub agent_type: String,
    #[serde(default)]
    pub parent_agent_id: Option<String>,
    pub model: String,
    pub provider: String,
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub max_iterations: i32,
    #[serde(default)]
    pub temperature: f32,
    #[serde(default)]
    pub voice: Option<VoiceConfig>,
    #[serde(default)]
    pub config: serde_json::Value,
    #[serde(default)]
    pub workspace_documents: Option<WorkspaceDocuments>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InitializeWorkspaceRequest {
    pub documents: WorkspaceDocuments,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateAgentRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub agent_type: Option<String>,
    #[serde(default)]
    pub parent_agent_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub capabilities: Option<Vec<String>>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub tools: Option<Vec<String>>,
    #[serde(default)]
    pub max_iterations: Option<i32>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub voice: Option<VoiceConfig>,
    #[serde(default)]
    pub config: Option<serde_json::Value>,
    #[serde(default)]
    pub workspace_documents: Option<WorkspaceDocuments>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRun {
    pub id: String,
    pub agent_id: String,
    pub status: String,
    pub input: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(default)]
    pub metadata: serde_json::Value,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StartRunRequest {
    pub input: String,
    #[serde(default)]
    pub plan: Option<serde_json::Value>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTask {
    pub id: String,
    pub run_id: String,
    pub agent_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: String,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub run_id: String,
    pub agent_id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub data: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCheckpointRequest {
    pub run_id: String,
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
    pub data: serde_json::Value,
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub id: String,
    pub agent_id: String,
    pub message: String,
    pub timestamp: String,
    pub changes: CommitChanges,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CommitChanges {
    #[serde(default)]
    pub modified: Vec<String>,
    #[serde(default)]
    pub added: Vec<String>,
    #[serde(default)]
    pub deleted: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub id: String,
    pub content: String,
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EnqueueRequest {
    pub content: String,
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentEvent {
    pub event_type: String,
    pub agent_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    pub timestamp: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
struct OpenClawDiscoveryFiles {
    models: bool,
    auth_profiles: bool,
    sessions_store: bool,
}

#[derive(Debug, Clone, Serialize)]
struct OpenClawDiscoveredAgent {
    agent_id: String,
    display_name: String,
    agent_dir: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    workspace_path: Option<String>,
    session_count: usize,
    auth_providers: Vec<String>,
    models: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    primary_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    primary_provider: Option<String>,
    files: OpenClawDiscoveryFiles,
    #[serde(skip_serializing_if = "Option::is_none")]
    registered_agent_id: Option<String>,
}

// ============================================================================
// Rails Service Client
// ============================================================================

const RAILS_URL: &str = "http://127.0.0.1:3011";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RailsPlanResponse {
    dag_id: String,
    prompt_id: String,
    node_id: String,
    #[serde(default)]
    wih_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RailsWih {
    wih_id: String,
    #[serde(default)]
    dag_id: Option<String>,
    #[serde(default)]
    node_id: Option<String>,
    status: String,
    title: String,
    #[serde(default)]
    context_pack: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RailsWihListResponse {
    wihs: Vec<RailsWih>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RailsPickupResponse {
    wih_id: String,
    #[serde(default)]
    dag_id: Option<String>,
    #[serde(default)]
    context_pack: Option<String>,
}

// ============================================================================
// In-Memory Storage (Temporary - Replace with Database)
// ============================================================================

use lazy_static::lazy_static;
use std::sync::Mutex;

lazy_static! {
    static ref AGENTS: Mutex<HashMap<String, Agent>> = Mutex::new(HashMap::new());
    static ref RUNS: Mutex<HashMap<String, AgentRun>> = Mutex::new(HashMap::new());
    static ref TASKS: Mutex<HashMap<String, Vec<AgentTask>>> = Mutex::new(HashMap::new());
    static ref CHECKPOINTS: Mutex<HashMap<String, Vec<Checkpoint>>> = Mutex::new(HashMap::new());
    static ref COMMITS: Mutex<HashMap<String, Vec<Commit>>> = Mutex::new(HashMap::new());
    static ref QUEUE: Mutex<Vec<QueueItem>> = Mutex::new(Vec::new());
    static ref EVENT_CHANNELS: Mutex<HashMap<String, Vec<mpsc::Sender<AgentEvent>>>> =
        Mutex::new(HashMap::new());
}

// ============================================================================
// Event Streaming
// ============================================================================

fn broadcast_event(agent_id: &str, event: AgentEvent) {
    let channels = EVENT_CHANNELS.lock().unwrap();
    if let Some(senders) = channels.get(agent_id) {
        for sender in senders {
            let _ = sender.try_send(event.clone());
        }
    }
}

fn subscribe_to_events(agent_id: &str) -> mpsc::Receiver<AgentEvent> {
    let (tx, rx) = mpsc::channel(100);
    let mut channels = EVENT_CHANNELS.lock().unwrap();
    channels
        .entry(agent_id.to_string())
        .or_insert_with(Vec::new)
        .push(tx);
    rx
}

fn openclaw_state_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from).map(|home| home.join(".openclaw"))
}

fn humanize_agent_id(agent_id: &str) -> String {
    let normalized = agent_id.trim().replace(['-', '_'], " ");
    let words = normalized
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => {
                    let mut label = String::new();
                    label.extend(first.to_uppercase());
                    label.push_str(chars.as_str());
                    label
                }
                None => String::new(),
            }
        })
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();

    if words.is_empty() {
        "OpenClaw Agent".to_string()
    } else {
        words.join(" ")
    }
}

fn count_openclaw_sessions(sessions_dir: &FsPath) -> usize {
    fs::read_dir(sessions_dir)
        .ok()
        .into_iter()
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;
            if name.contains(".deleted.") {
                return None;
            }
            (path.extension().and_then(|ext| ext.to_str()) == Some("jsonl")).then_some(path)
        })
        .count()
}

fn extract_workspace_path(root_config: &serde_json::Value) -> Option<String> {
    root_config
        .pointer("/agents/defaults/workspace")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn extract_primary_model(root_config: &serde_json::Value) -> Option<String> {
    root_config
        .pointer("/agents/defaults/model/primary")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn extract_gateway_port(root_config: &serde_json::Value) -> Option<u16> {
    root_config
        .pointer("/gateway/port")
        .and_then(|value| value.as_u64())
        .and_then(|value| u16::try_from(value).ok())
}

fn extract_auth_providers(auth_profiles: &serde_json::Value) -> Vec<String> {
    let mut providers = auth_profiles
        .get("profiles")
        .and_then(|value| value.as_object())
        .into_iter()
        .flat_map(|profiles| profiles.values())
        .filter_map(|profile| profile.get("provider"))
        .filter_map(|provider| provider.as_str())
        .map(str::trim)
        .filter(|provider| !provider.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    providers.sort();
    providers.dedup();
    providers
}

fn extract_models(models_json: &serde_json::Value) -> Vec<String> {
    let mut discovered = Vec::new();

    if let Some(providers) = models_json.get("providers").and_then(|value| value.as_object()) {
        for (provider_id, provider_value) in providers {
            if let Some(models) = provider_value.get("models").and_then(|value| value.as_array()) {
                for model in models {
                    if let Some(model_id) = model.get("id").and_then(|value| value.as_str()) {
                        let normalized = model_id.trim();
                        if !normalized.is_empty() {
                            discovered.push(format!("{}/{}", provider_id, normalized));
                        }
                    }
                }
            }
        }
    }

    discovered.sort();
    discovered.dedup();
    discovered
}

fn find_registered_agent_id(agent_id: &str, agent_dir: &str) -> Option<String> {
    let agents = AGENTS.lock().ok()?;

    agents.values().find_map(|agent| {
        let config = agent.config.as_object()?;
        let source = config.get("source").and_then(|value| value.as_str());
        let openclaw = config.get("openclaw").and_then(|value| value.as_object())?;
        let config_agent_id = openclaw.get("agentId").and_then(|value| value.as_str());
        let config_agent_dir = openclaw.get("agentDir").and_then(|value| value.as_str());

        let matches_source = source == Some("openclaw");
        let matches_agent_id = config_agent_id == Some(agent_id);
        let matches_agent_dir = config_agent_dir == Some(agent_dir);

        (matches_source && (matches_agent_id || matches_agent_dir)).then(|| agent.id.clone())
    })
}

fn discover_openclaw_agents_from_disk() -> serde_json::Value {
    let Some(state_dir) = openclaw_state_dir() else {
        return serde_json::json!({
            "agents": [],
            "total": 0,
            "unregistered": 0,
        });
    };

    let root_config_path = state_dir.join("openclaw.json");
    let root_config = fs::read_to_string(&root_config_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    let workspace_path = extract_workspace_path(&root_config);
    let primary_model_from_root = extract_primary_model(&root_config);
    let gateway_port = extract_gateway_port(&root_config);

    let agents_dir = state_dir.join("agents");
    let discovered = fs::read_dir(&agents_dir)
        .ok()
        .into_iter()
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter_map(|entry| {
            let agent_dir = entry.path();
            if !agent_dir.is_dir() {
                return None;
            }

            let agent_id = agent_dir.file_name()?.to_str()?.trim().to_string();
            if agent_id.is_empty() {
                return None;
            }

            let agent_metadata_dir = agent_dir.join("agent");
            let sessions_dir = agent_dir.join("sessions");
            let models_path = agent_metadata_dir.join("models.json");
            let auth_profiles_path = agent_metadata_dir.join("auth-profiles.json");
            let sessions_store_path = sessions_dir.join("sessions.json");

            let models_json = fs::read_to_string(&models_path)
                .ok()
                .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
                .unwrap_or_else(|| serde_json::json!({}));
            let auth_profiles_json = fs::read_to_string(&auth_profiles_path)
                .ok()
                .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
                .unwrap_or_else(|| serde_json::json!({}));

            let models = extract_models(&models_json);
            let auth_providers = extract_auth_providers(&auth_profiles_json);
            let primary_model = primary_model_from_root
                .clone()
                .or_else(|| models.first().cloned());
            let primary_provider = primary_model
                .as_ref()
                .and_then(|value| value.split('/').next())
                .map(ToOwned::to_owned);
            let agent_dir_display = agent_dir.to_string_lossy().to_string();
            let registered_agent_id = find_registered_agent_id(&agent_id, &agent_dir_display);

            Some(OpenClawDiscoveredAgent {
                agent_id: agent_id.clone(),
                display_name: humanize_agent_id(&agent_id),
                agent_dir: agent_dir_display,
                workspace_path: workspace_path.clone(),
                session_count: count_openclaw_sessions(&sessions_dir),
                auth_providers,
                models,
                primary_model,
                primary_provider,
                files: OpenClawDiscoveryFiles {
                    models: models_path.exists(),
                    auth_profiles: auth_profiles_path.exists(),
                    sessions_store: sessions_store_path.exists(),
                },
                registered_agent_id,
            })
        })
        .collect::<Vec<_>>();

    let total = discovered.len();
    let unregistered = discovered
        .iter()
        .filter(|agent| agent.registered_agent_id.is_none())
        .count();

    serde_json::json!({
        "agents": discovered,
        "total": total,
        "unregistered": unregistered,
        "state_dir": state_dir.to_string_lossy(),
        "workspace_path": workspace_path,
        "gateway_port": gateway_port,
    })
}

// ============================================================================
// Handlers
// ============================================================================

/// List all agents
async fn list_agents() -> impl IntoResponse {
    let agents = AGENTS.lock().unwrap();
    let agent_list: Vec<Agent> = agents.values().cloned().collect();

    Json(serde_json::json!({
        "agents": agent_list,
        "total": agent_list.len()
    }))
}

/// Discover local OpenClaw agents that are available on disk but not yet registered in Agent Studio.
async fn discover_openclaw_agents() -> impl IntoResponse {
    Json(discover_openclaw_agents_from_disk())
}

/// Get a specific agent
async fn get_agent(Path(agent_id): Path<String>) -> impl IntoResponse {
    let agents = AGENTS.lock().unwrap();

    match agents.get(&agent_id) {
        Some(agent) => (StatusCode::OK, Json(serde_json::json!(agent))).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Agent not found"})),
        )
            .into_response(),
    }
}

/// Create a new agent
async fn create_agent(Json(request): Json<CreateAgentRequest>) -> impl IntoResponse {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let agent = Agent {
        id: id.clone(),
        name: request.name,
        description: request.description,
        agent_type: request.agent_type,
        parent_agent_id: request.parent_agent_id,
        model: request.model,
        provider: request.provider,
        capabilities: request.capabilities,
        system_prompt: request.system_prompt,
        tools: request.tools,
        max_iterations: if request.max_iterations > 0 {
            request.max_iterations
        } else {
            10
        },
        temperature: if request.temperature > 0.0 {
            request.temperature
        } else {
            0.7
        },
        voice: request.voice,
        config: request.config,
        workspace_documents: request.workspace_documents,
        status: "idle".to_string(),
        created_at: now.clone(),
        updated_at: now,
        last_run_at: None,
    };

    let mut agents = AGENTS.lock().unwrap();
    agents.insert(id.clone(), agent.clone());

    (StatusCode::CREATED, Json(serde_json::json!(agent)))
}

/// Update an agent
async fn update_agent(
    Path(agent_id): Path<String>,
    Json(request): Json<UpdateAgentRequest>,
) -> impl IntoResponse {
    let mut agents = AGENTS.lock().unwrap();

    match agents.get_mut(&agent_id) {
        Some(agent) => {
            if let Some(name) = request.name {
                agent.name = name;
            }
            if let Some(description) = request.description {
                agent.description = description;
            }
            if let Some(agent_type) = request.agent_type {
                agent.agent_type = agent_type;
            }
            if request.parent_agent_id.is_some() {
                agent.parent_agent_id = request.parent_agent_id;
            }
            if let Some(model) = request.model {
                agent.model = model;
            }
            if let Some(provider) = request.provider {
                agent.provider = provider;
            }
            if let Some(capabilities) = request.capabilities {
                agent.capabilities = capabilities;
            }
            if request.system_prompt.is_some() {
                agent.system_prompt = request.system_prompt;
            }
            if let Some(tools) = request.tools {
                agent.tools = tools;
            }
            if let Some(max_iterations) = request.max_iterations {
                agent.max_iterations = max_iterations;
            }
            if let Some(temperature) = request.temperature {
                agent.temperature = temperature;
            }
            if request.voice.is_some() {
                agent.voice = request.voice;
            }
            if let Some(config) = request.config {
                agent.config = config;
            }
            if let Some(workspace_documents) = request.workspace_documents {
                agent.workspace_documents = Some(workspace_documents);
            }
            if let Some(status) = request.status {
                agent.status = status;
            }

            agent.updated_at = chrono::Utc::now().to_rfc3339();

            (StatusCode::OK, Json(serde_json::json!(agent)))
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Agent not found"})),
        ),
    }
}

/// Delete an agent
async fn delete_agent(Path(agent_id): Path<String>) -> impl IntoResponse {
    let mut agents = AGENTS.lock().unwrap();

    if agents.remove(&agent_id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct PersonalityRequest {
    pub character_config: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SkillsRequest {
    pub skills: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AvatarRequest {
    pub avatar_config: serde_json::Value,
}

/// Initialize agent workspace with documents
async fn initialize_workspace(
    Path(agent_id): Path<String>,
    Json(request): Json<InitializeWorkspaceRequest>,
) -> impl IntoResponse {
    let agents = AGENTS.lock().unwrap();
    if !agents.contains_key(&agent_id) {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Agent not found"})),
        )
            .into_response();
    }

    // Resolve workspace path (relative to CWD for now, similar to tui_routes)
    let workspace_root = PathBuf::from("agents").join(&agent_id).join("workspace");
    
    if let Err(e) = fs::create_dir_all(&workspace_root) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("Failed to create workspace directory: {}", e)
            })),
        )
            .into_response();
    }

    let docs = &request.documents;
    let files = [
        ("identity.yaml", &docs.identity),
        ("role_card.yaml", &docs.role_card),
        ("voice.yaml", &docs.voice),
        ("relationships.yaml", &docs.relationships),
        ("progression.yaml", &docs.progression),
        ("avatar.json", &docs.avatar),
        ("compiled_config.json", &docs.compiled),
    ];

    for (filename, content) in files {
        let file_path = workspace_root.join(filename);
        if let Err(e) = fs::write(&file_path, content) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": format!("Failed to write file {}: {}", filename, e)
                })),
            )
                .into_response();
        }
    }

    // Update agent status if needed
    drop(agents);
    let mut agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get_mut(&agent_id) {
        agent.status = "initialized".to_string();
        agent.updated_at = chrono::Utc::now().to_rfc3339();
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "message": "Workspace initialized successfully",
            "path": workspace_root.to_string_lossy()
        })),
    )
        .into_response()
}

/// Update agent personality
async fn update_personality(
    Path(agent_id): Path<String>,
    Json(request): Json<PersonalityRequest>,
) -> impl IntoResponse {
    let mut agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get_mut(&agent_id) {
        // Update characterLayer in config
        let mut config_obj = agent.config.as_object().cloned().unwrap_or_default();
        config_obj.insert("characterLayer".to_string(), request.character_config);
        agent.config = serde_json::Value::Object(config_obj);
        
        agent.updated_at = chrono::Utc::now().to_rfc3339();
        (StatusCode::OK, Json(serde_json::json!(agent))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

/// Update agent skills
async fn update_skills(
    Path(agent_id): Path<String>,
    Json(request): Json<SkillsRequest>,
) -> impl IntoResponse {
    let mut agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get_mut(&agent_id) {
        agent.capabilities = request.skills;
        agent.updated_at = chrono::Utc::now().to_rfc3339();
        (StatusCode::OK, Json(serde_json::json!(agent))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

/// Update agent avatar
async fn update_avatar(
    Path(agent_id): Path<String>,
    Json(request): Json<AvatarRequest>,
) -> impl IntoResponse {
    let mut agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get_mut(&agent_id) {
        // Update avatar in config
        let mut config_obj = agent.config.as_object().cloned().unwrap_or_default();
        config_obj.insert("avatar".to_string(), request.avatar_config);
        agent.config = serde_json::Value::Object(config_obj);
        
        agent.updated_at = chrono::Utc::now().to_rfc3339();
        (StatusCode::OK, Json(serde_json::json!(agent))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

/// Get agent personality
async fn get_personality(Path(agent_id): Path<String>) -> impl IntoResponse {
    let agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get(&agent_id) {
        let personality = agent.config.get("characterLayer").and_then(|c| c.get("personality")).cloned();
        (StatusCode::OK, Json(personality.unwrap_or(serde_json::json!({})))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

/// Get agent skills
async fn get_skills(Path(agent_id): Path<String>) -> impl IntoResponse {
    let agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get(&agent_id) {
        (StatusCode::OK, Json(serde_json::json!({ "skills": agent.capabilities }))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

/// Get agent avatar
async fn get_avatar(Path(agent_id): Path<String>) -> impl IntoResponse {
    let agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get(&agent_id) {
        let avatar = agent.config.get("avatar").cloned();
        (StatusCode::OK, Json(avatar.unwrap_or(serde_json::json!({})))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

/// Get agent prompt
async fn get_prompt(Path(agent_id): Path<String>) -> impl IntoResponse {
    let agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get(&agent_id) {
        (StatusCode::OK, Json(serde_json::json!({ "prompt": agent.system_prompt }))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

/// Update agent prompt
async fn update_prompt(
    Path(agent_id): Path<String>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let mut agents = AGENTS.lock().unwrap();
    if let Some(agent) = agents.get_mut(&agent_id) {
        if let Some(prompt) = request.get("prompt").and_then(|p| p.as_str()) {
            agent.system_prompt = Some(prompt.to_string());
            agent.updated_at = chrono::Utc::now().to_rfc3339();
            (StatusCode::OK, Json(serde_json::json!(agent))).into_response()
        } else {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Missing prompt field"}))).into_response()
        }
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Agent not found"}))).into_response()
    }
}

// ============================================================================
// Run Management with Rails + Kernel Integration
// ============================================================================

/// List runs for an agent
async fn list_runs(Path(agent_id): Path<String>) -> impl IntoResponse {
    let runs = RUNS.lock().unwrap();
    let agent_runs: Vec<AgentRun> = runs
        .values()
        .filter(|r| r.agent_id == agent_id)
        .cloned()
        .collect();

    Json(serde_json::json!({
        "runs": agent_runs,
        "total": agent_runs.len()
    }))
}

/// Get a specific run
async fn get_run(Path((agent_id, run_id)): Path<(String, String)>) -> impl IntoResponse {
    let runs = RUNS.lock().unwrap();

    match runs.get(&run_id) {
        Some(run) if run.agent_id == agent_id => (StatusCode::OK, Json(serde_json::json!(run))),
        _ => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Run not found"})),
        ),
    }
}

/// Start a new run with Rails + Kernel execution
async fn start_run(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
    Json(request): Json<StartRunRequest>,
) -> impl IntoResponse {
    // Get agent details
    let agent = {
        let agents = AGENTS.lock().unwrap();
        match agents.get(&agent_id).cloned() {
            Some(a) => a,
            None => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error": "Agent not found"})),
                )
                    .into_response();
            }
        }
    };

    // Update agent status
    {
        let mut agents = AGENTS.lock().unwrap();
        if let Some(a) = agents.get_mut(&agent_id) {
            a.status = "running".to_string();
            a.last_run_at = Some(chrono::Utc::now().to_rfc3339());
        }
    }

    let run_id = Uuid::new_v4().to_string();
    let run = AgentRun {
        id: run_id.clone(),
        agent_id: agent_id.clone(),
        status: "running".to_string(),
        input: request.input.clone(),
        output: None,
        metadata: serde_json::json!({
            "plan": request.plan,
            "agent_config": {
                "model": agent.model,
                "temperature": agent.temperature,
                "system_prompt": agent.system_prompt,
                "voice": agent.voice,
            }
        }),
        started_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
    };

    // Store run
    {
        let mut runs = RUNS.lock().unwrap();
        runs.insert(run_id.clone(), run.clone());
    }

    // Broadcast run started event
    broadcast_event(
        &agent_id,
        AgentEvent {
            event_type: "run.started".to_string(),
            agent_id: agent_id.clone(),
            run_id: Some(run_id.clone()),
            task_id: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
            data: serde_json::json!({"input": request.input}),
        },
    );

    // Spawn async execution task (Rails → Kernel)
    let kernel_client = state.kernel_client.clone();
    let kernel_url = state.kernel_url.clone();
    let run_id_clone = run_id.clone();
    let agent_id_clone = agent_id.clone();
    let input = request.input;
    let agent_model = agent.model;
    let agent_system_prompt = agent.system_prompt.clone();
    let kernel_auth_token = std::env::var("ALLTERNIT_KERNEL_AUTH_TOKEN")
        .or_else(|_| std::env::var("ALLTERNIT_KERNEL_TOKEN"))
        .or_else(|_| std::env::var("ALLTERNIT_GATEWAY_TOKEN"))
        .or_else(|_| std::env::var("OPENCLAW_GATEWAY_TOKEN"))
        .unwrap_or_else(|_| "api-internal-service-token".to_string());

    tokio::spawn(async move {
        // Step 1: Create plan in Rails
        let plan_result = create_rails_plan(&input).await;

        match plan_result {
            Ok(plan) => {
                tracing::info!("Rails plan created: dag_id={}", plan.dag_id);

                // Step 2: Execute via Kernel
                let execution_result = execute_via_kernel(
                    &kernel_client,
                    &kernel_url,
                    &kernel_auth_token,
                    &input,
                    &agent_model,
                    agent_system_prompt.as_deref(),
                    None, // Gate not available in this context
                )
                .await;

                // Step 3: Update run with results
                let mut runs = RUNS.lock().unwrap();
                if let Some(run) = runs.get_mut(&run_id_clone) {
                    match execution_result {
                        Ok(output) => {
                            run.status = "completed".to_string();
                            run.output = Some(output.clone());
                            run.completed_at = Some(chrono::Utc::now().to_rfc3339());

                            // Broadcast completion
                            broadcast_event(
                                &agent_id_clone,
                                AgentEvent {
                                    event_type: "run.completed".to_string(),
                                    agent_id: agent_id_clone.clone(),
                                    run_id: Some(run_id_clone.clone()),
                                    task_id: None,
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                    data: serde_json::json!({"output": output}),
                                },
                            );
                        }
                        Err(e) => {
                            run.status = "failed".to_string();
                            run.output = Some(format!("Error: {}", e));
                            run.completed_at = Some(chrono::Utc::now().to_rfc3339());

                            // Broadcast failure
                            broadcast_event(
                                &agent_id_clone,
                                AgentEvent {
                                    event_type: "run.failed".to_string(),
                                    agent_id: agent_id_clone.clone(),
                                    run_id: Some(run_id_clone.clone()),
                                    task_id: None,
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                    data: serde_json::json!({"error": e.to_string()}),
                                },
                            );
                        }
                    }
                }

                // Reset agent status
                let mut agents = AGENTS.lock().unwrap();
                if let Some(a) = agents.get_mut(&agent_id_clone) {
                    a.status = "idle".to_string();
                }
            }
            Err(e) => {
                tracing::error!("Failed to create Rails plan: {}", e);

                // Update run with error
                let mut runs = RUNS.lock().unwrap();
                if let Some(run) = runs.get_mut(&run_id_clone) {
                    run.status = "failed".to_string();
                    run.output = Some(format!("Plan creation failed: {}", e));
                    run.completed_at = Some(chrono::Utc::now().to_rfc3339());
                }

                // Reset agent status
                let mut agents = AGENTS.lock().unwrap();
                if let Some(a) = agents.get_mut(&agent_id_clone) {
                    a.status = "idle".to_string();
                }
            }
        }
    });

    (StatusCode::CREATED, Json(serde_json::json!(run))).into_response()
}

/// Create a plan in Rails
async fn create_rails_plan(input: &str) -> Result<RailsPlanResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/v1/plan", RAILS_URL);

    let body = serde_json::json!({
        "text": input,
    });

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Rails: {}", e))?;

    if response.status().is_success() {
        response
            .json::<RailsPlanResponse>()
            .await
            .map_err(|e| format!("Failed to parse Rails response: {}", e))
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(format!("Rails error ({}): {}", status, text))
    }
}

/// Execute via Kernel
async fn execute_via_kernel(
    client: &reqwest::Client,
    kernel_url: &str,
    kernel_auth_token: &str,
    input: &str,
    model: &str,
    system_prompt: Option<&str>,
    gate: Option<&std::sync::Arc<allternit_agent_system_rails::Gate>>,
) -> Result<String, String> {
    // === N0: Gate Plan Generation (if Gate available) ===
    if let Some(gate) = gate {
        match gate.plan_new(input, None).await {
            Ok((prompt_id, dag_id, node_id)) => {
                tracing::info!(
                    prompt_id = %prompt_id,
                    dag_id = %dag_id,
                    node_id = %node_id,
                    "Gate plan generated for intent"
                );
            }
            Err(e) => {
                tracing::warn!("Gate plan_new failed: {}", e);
                // Continue without plan - Gate is optional enhancement
            }
        }
    }

    let url = format!("{}/v1/intent/dispatch", kernel_url);

    let mut dispatch_body = serde_json::json!({
        "intent_text": input,
        "execution_mode": "auto",
        "model_config": {
            "model": model,
            "temperature": 0.7,
        },
        "user_message": input,
    });

    // Add system prompt if present
    if let Some(prompt) = system_prompt {
        dispatch_body["system_prompt"] = serde_json::json!(prompt);
    }

    let response = client
        .post(&url)
        .bearer_auth(kernel_auth_token)
        .json(&dispatch_body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Kernel: {}", e))?;

    if response.status().is_success() {
        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Kernel response: {}", e))?;

        // Try to extract response text from result
        // First, try the expected outputs format
        let output = result
            .get("capsule")
            .and_then(|c| c.get("outputs"))
            .and_then(|o| o.as_array())
            .and_then(|arr| arr.first())
            .and_then(|first| first.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string());

        if let Some(text) = output {
            return Ok(text);
        }

        // If no outputs, try to extract from events
        if let Some(events) = result.get("events").and_then(|e| e.as_array()) {
            let mut text_parts: Vec<String> = Vec::new();
            for event in events {
                if let Some(kind) = event.get("kind").and_then(|k| k.as_str()) {
                    if kind == "directive_compiled" {
                        if let Some(payload) = event.get("payload") {
                            if let Some(directive) =
                                payload.get("directive").and_then(|d| d.as_str())
                            {
                                text_parts.push(format!("Directive: {}", directive));
                            }
                        }
                    }
                }
            }
            if !text_parts.is_empty() {
                return Ok(text_parts.join("\n"));
            }
        }

        // If we have a capsule, return a success message with the capsule ID
        if let Some(capsule_id) = result
            .get("capsule")
            .and_then(|c| c.get("capsule_id"))
            .and_then(|id| id.as_str())
        {
            return Ok(format!(
                "Intent dispatched successfully. Capsule ID: {}",
                capsule_id
            ));
        }

        // Fallback: return the raw response for debugging
        Ok(format!(
            "Kernel response received (no extractable output). Capsule created."
        ))
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(format!("Kernel error ({}): {}", status, text))
    }
}

/// Cancel a run
async fn cancel_run(Path((agent_id, run_id)): Path<(String, String)>) -> impl IntoResponse {
    let mut runs = RUNS.lock().unwrap();

    match runs.get_mut(&run_id) {
        Some(run) if run.agent_id == agent_id => {
            run.status = "cancelled".to_string();
            run.completed_at = Some(chrono::Utc::now().to_rfc3339());

            // Update agent status
            let mut agents = AGENTS.lock().unwrap();
            if let Some(agent) = agents.get_mut(&agent_id) {
                agent.status = "idle".to_string();
            }

            StatusCode::OK
        }
        _ => StatusCode::NOT_FOUND,
    }
}

/// Pause a run
async fn pause_run(Path((agent_id, run_id)): Path<(String, String)>) -> impl IntoResponse {
    let mut runs = RUNS.lock().unwrap();

    match runs.get_mut(&run_id) {
        Some(run) if run.agent_id == agent_id => {
            run.status = "paused".to_string();

            let mut agents = AGENTS.lock().unwrap();
            if let Some(agent) = agents.get_mut(&agent_id) {
                agent.status = "paused".to_string();
            }

            StatusCode::OK
        }
        _ => StatusCode::NOT_FOUND,
    }
}

/// Resume a run
async fn resume_run(Path((agent_id, run_id)): Path<(String, String)>) -> impl IntoResponse {
    let mut runs = RUNS.lock().unwrap();

    match runs.get_mut(&run_id) {
        Some(run) if run.agent_id == agent_id => {
            run.status = "running".to_string();

            let mut agents = AGENTS.lock().unwrap();
            if let Some(agent) = agents.get_mut(&agent_id) {
                agent.status = "running".to_string();
            }

            StatusCode::OK
        }
        _ => StatusCode::NOT_FOUND,
    }
}

/// Event stream for agent updates
async fn agent_events(
    Path(agent_id): Path<String>,
) -> Sse<
    impl tokio_stream::Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>,
> {
    use axum::response::sse::Event;
    use futures_util::stream::StreamExt;
    use tokio_stream::wrappers::ReceiverStream;

    let rx = subscribe_to_events(&agent_id);

    let stream = ReceiverStream::new(rx).map(|event| {
        let data = serde_json::to_string(&event).unwrap_or_default();
        Ok(Event::default().data(data))
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

// ============================================================================
// Task Management
// ============================================================================

/// List tasks for an agent
async fn list_tasks(
    Path(agent_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let tasks = TASKS.lock().unwrap();
    let mut agent_tasks: Vec<AgentTask> = tasks.get(&agent_id).cloned().unwrap_or_default();

    // Filter by run_id if provided
    if let Some(run_id) = params.get("runId") {
        agent_tasks.retain(|t| &t.run_id == run_id);
    }

    Json(serde_json::json!({
        "tasks": agent_tasks,
        "total": agent_tasks.len()
    }))
}

/// Get a specific task
async fn get_task(Path((agent_id, task_id)): Path<(String, String)>) -> impl IntoResponse {
    let tasks = TASKS.lock().unwrap();

    let agent_tasks = tasks.get(&agent_id);
    match agent_tasks {
        Some(tasks) => match tasks.iter().find(|t| t.id == task_id) {
            Some(task) => (StatusCode::OK, Json(serde_json::json!(task))),
            None => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Task not found"})),
            ),
        },
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Agent not found"})),
        ),
    }
}

/// Update task status
async fn update_task(
    Path((agent_id, task_id)): Path<(String, String)>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let mut tasks = TASKS.lock().unwrap();

    if let Some(agent_tasks) = tasks.get_mut(&agent_id) {
        if let Some(task) = agent_tasks.iter_mut().find(|t| t.id == task_id) {
            if let Some(status) = request.get("status").and_then(|s| s.as_str()) {
                task.status = status.to_string();

                if status == "completed" || status == "failed" {
                    task.completed_at = Some(chrono::Utc::now().to_rfc3339());
                }
            }
            if let Some(result) = request.get("result").and_then(|r| r.as_str()) {
                task.result = Some(result.to_string());
            }
            if let Some(error) = request.get("error").and_then(|e| e.as_str()) {
                task.error = Some(error.to_string());
            }

            return (StatusCode::OK, Json(serde_json::json!(task)));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({"error": "Task not found"})),
    )
}

// ============================================================================
// Checkpoint Management
// ============================================================================

/// List checkpoints for an agent
async fn list_checkpoints(
    Path(agent_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let checkpoints = CHECKPOINTS.lock().unwrap();
    let mut agent_checkpoints: Vec<Checkpoint> =
        checkpoints.get(&agent_id).cloned().unwrap_or_default();

    // Filter by run_id if provided
    if let Some(run_id) = params.get("runId") {
        agent_checkpoints.retain(|c| &c.run_id == run_id);
    }

    Json(serde_json::json!({
        "checkpoints": agent_checkpoints,
        "total": agent_checkpoints.len()
    }))
}

/// Create a checkpoint
async fn create_checkpoint(
    Path(agent_id): Path<String>,
    Json(request): Json<CreateCheckpointRequest>,
) -> impl IntoResponse {
    let checkpoint = Checkpoint {
        id: Uuid::new_v4().to_string(),
        run_id: request.run_id,
        agent_id: agent_id.clone(),
        label: request.label,
        description: request.description,
        data: request.data,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let mut checkpoints = CHECKPOINTS.lock().unwrap();
    checkpoints
        .entry(agent_id)
        .or_insert_with(Vec::new)
        .push(checkpoint.clone());

    (StatusCode::CREATED, Json(serde_json::json!(checkpoint)))
}

/// Restore a checkpoint
async fn restore_checkpoint(
    Path((agent_id, checkpoint_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let checkpoints = CHECKPOINTS.lock().unwrap();

    if let Some(agent_checkpoints) = checkpoints.get(&agent_id) {
        if let Some(checkpoint) = agent_checkpoints.iter().find(|c| c.id == checkpoint_id) {
            // Create a new run from the checkpoint
            let run_id = Uuid::new_v4().to_string();
            let run = AgentRun {
                id: run_id.clone(),
                agent_id: agent_id.clone(),
                status: "running".to_string(),
                input: format!("Restored from checkpoint: {}", checkpoint.label),
                output: None,
                metadata: serde_json::json!({
                    "restored_from": checkpoint_id,
                    "checkpoint_data": checkpoint.data
                }),
                started_at: chrono::Utc::now().to_rfc3339(),
                completed_at: None,
            };

            let mut runs = RUNS.lock().unwrap();
            runs.insert(run_id, run.clone());

            return (StatusCode::OK, Json(serde_json::json!(run)));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({"error": "Checkpoint not found"})),
    )
}

// ============================================================================
// Commit Management
// ============================================================================

/// List commits for an agent
async fn list_commits(Path(agent_id): Path<String>) -> impl IntoResponse {
    let commits = COMMITS.lock().unwrap();
    let agent_commits: Vec<Commit> = commits.get(&agent_id).cloned().unwrap_or_default();

    Json(serde_json::json!({
        "commits": agent_commits,
        "total": agent_commits.len()
    }))
}

/// Create a commit
async fn create_commit(
    Path(agent_id): Path<String>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let commit = Commit {
        id: Uuid::new_v4().to_string(),
        agent_id: agent_id.clone(),
        message: request
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("")
            .to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        changes: serde_json::from_value(
            request
                .get("changes")
                .cloned()
                .unwrap_or(serde_json::json!({})),
        )
        .unwrap_or_default(),
        parent_id: request
            .get("parentId")
            .and_then(|p| p.as_str())
            .map(|s| s.to_string()),
    };

    let mut commits = COMMITS.lock().unwrap();
    commits
        .entry(agent_id)
        .or_insert_with(Vec::new)
        .push(commit.clone());

    (StatusCode::CREATED, Json(serde_json::json!(commit)))
}

// ============================================================================
// Queue Management
// ============================================================================

/// List queue items
async fn list_queue(Query(params): Query<HashMap<String, String>>) -> impl IntoResponse {
    let queue = QUEUE.lock().unwrap();
    let mut items = queue.clone();

    // Filter by agent_id if provided
    if let Some(agent_id) = params.get("agentId") {
        items.retain(|i| i.agent_id.as_ref() == Some(agent_id));
    }

    Json(serde_json::json!({
        "items": items,
        "total": items.len()
    }))
}

/// Enqueue a task
async fn enqueue(Json(request): Json<EnqueueRequest>) -> impl IntoResponse {
    let item = QueueItem {
        id: Uuid::new_v4().to_string(),
        content: request.content,
        priority: request.priority,
        agent_id: request.agent_id,
        status: "pending".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let mut queue = QUEUE.lock().unwrap();
    queue.push(item.clone());
    queue.sort_by(|a, b| b.priority.cmp(&a.priority));

    (StatusCode::CREATED, Json(serde_json::json!(item)))
}

/// Dequeue a task
async fn dequeue(Path(item_id): Path<String>) -> impl IntoResponse {
    let mut queue = QUEUE.lock().unwrap();

    if let Some(pos) = queue.iter().position(|i| i.id == item_id) {
        queue.remove(pos);
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

/// List available capabilities
async fn list_capabilities() -> impl IntoResponse {
    let capabilities = serde_json::json!({
        "capabilities": [
            { "id": "code_exec", "name": "Code Execution", "category": "technical", "description": "Execute code in a sandbox", "enabled": true, "icon": "code", "level": "advanced" },
            { "id": "web_search", "name": "Web Search", "category": "general", "description": "Search the internet for real-time info", "enabled": true, "icon": "globe", "level": "intermediate" },
            { "id": "file_access", "name": "File Access", "category": "system", "description": "Read and write files in workspace", "enabled": true, "icon": "file", "level": "basic" },
            { "id": "db_query", "name": "Database Query", "category": "technical", "description": "Query structured databases", "enabled": true, "icon": "database", "level": "advanced" },
            { "id": "image_gen", "name": "Image Generation", "category": "creative", "description": "Generate visual assets", "enabled": true, "icon": "image", "level": "intermediate" }
        ]
    });
    Json(capabilities)
}

/// List available plugins
async fn list_plugins() -> impl IntoResponse {
    let plugins = serde_json::json!({
        "items": [
            { "id": "github", "name": "GitHub Connector", "description": "Access repositories and issues", "version": "1.2.0", "author": "A2R" },
            { "id": "slack", "name": "Slack Bridge", "description": "Send and receive messages", "version": "0.9.5", "author": "A2R" },
            { "id": "docker", "name": "Docker Manager", "description": "Manage containers", "version": "2.1.0", "author": "System" }
        ]
    });
    Json(plugins)
}

/// List marketplace items
async fn list_marketplace() -> impl IntoResponse {
    let items = serde_json::json!({
        "items": [
            { "id": "mkt-1", "name": "SEO Specialist Skill", "description": "Advanced SEO optimization", "price": "free", "category": "marketing" },
            { "id": "mkt-2", "name": "Pytest Expert", "description": "Professional python testing", "price": "free", "category": "technical" }
        ]
    });
    Json(items)
}

/// List skills taxonomy
async fn list_skills_taxonomy() -> impl IntoResponse {
    let taxonomy = serde_json::json!({
        "categories": [
            { "id": "technical", "name": "Technical", "subcategories": ["Programming", "Infrastructure", "Data"] },
            { "id": "creative", "name": "Creative", "subcategories": ["Writing", "Design", "Music"] },
            { "id": "business", "name": "Business", "subcategories": ["Management", "Marketing", "Sales"] }
        ],
        "skills": [
            { "id": "rust", "name": "Rust", "categoryId": "technical", "description": "Systems programming in Rust", "proficiencyLevels": [1, 5, 10], "relatedTools": ["cargo", "rustc"] },
            { "id": "python", "name": "Python", "categoryId": "technical", "description": "General purpose Python", "proficiencyLevels": [1, 5, 10], "relatedTools": ["pip", "pytest"] },
            { "id": "copywriting", "name": "Copywriting", "categoryId": "creative", "description": "Persuasive writing", "proficiencyLevels": [1, 5, 10], "relatedTools": [] }
        ]
    });
    Json(taxonomy)
}

/// List avatar templates
async fn list_avatar_templates() -> impl IntoResponse {
    let templates = serde_json::json!({
        "templates": [
            { "id": "gizzi", "name": "Gizzi", "thumbnail": "/avatars/gizzi.png" },
            { "id": "bot-a", "name": "Standard Bot", "thumbnail": "/avatars/bot-a.png" },
            { "id": "cyber", "name": "Cyber Unit", "thumbnail": "/avatars/cyber.png" }
        ]
    });
    Json(templates)
}

/// List available voices
async fn list_voices() -> impl IntoResponse {
    let voices = serde_json::json!({
        "voices": [
            { "id": "v1", "name": "Echo", "provider": "elevenlabs", "description": "Clear and articulate" },
            { "id": "v2", "name": "Serena", "provider": "openai", "description": "Friendly and helpful" },
            { "id": "v3", "name": "Nova", "provider": "openai", "description": "Professional and direct" }
        ]
    });
    Json(voices)
}

/// Preview a voice
async fn preview_voice(Path(voice_id): Path<String>) -> impl IntoResponse {
    // Return a dummy audio path or base64
    Json(serde_json::json!({ "preview_url": format!("/api/v1/voices/{}/preview.mp3", voice_id) }))
}

/// List prompts library
async fn list_prompts_library() -> impl IntoResponse {
    let library = serde_json::json!({
        "categories": ["Coding", "Writing", "Analysis", "Business"],
        "prompts": [
            { "id": "p1", "title": "Code Reviewer", "category": "Coding", "content": "You are an expert code reviewer...", "variables": [], "version": "1.0.0", "author": "System", "tags": ["technical"], "usageCount": 150, "rating": 4.8 },
            { "id": "p2", "title": "Technical Writer", "category": "Writing", "content": "You are a senior technical writer...", "variables": [], "version": "1.1.0", "author": "System", "tags": ["documentation"], "usageCount": 200, "rating": 4.9 }
        ]
    });
    Json(library)
}

/// Test a prompt
async fn test_prompt(Json(request): Json<serde_json::Value>) -> impl IntoResponse {
    // In a real system, this would call an LLM
    Json(serde_json::json!({ "output": "This is a simulated prompt test output." }))
}

/// List workspace files for an agent
async fn list_workspace_files(Path(agent_id): Path<String>) -> impl IntoResponse {
    let workspace_root = PathBuf::from("agents").join(&agent_id).join("workspace");
    
    if !workspace_root.exists() {
        return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Workspace not found"}))).into_response();
    }

    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(&workspace_root) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let content = fs::read_to_string(entry.path()).unwrap_or_default();
                    files.push(serde_json::json!({
                        "name": name,
                        "path": format!("/workspace/{}", name),
                        "content": content,
                        "language": if name.ends_with(".yaml") { "yaml" } else if name.ends_with(".json") { "json" } else { "text" },
                        "isEditable": true,
                        "isGenerated": true
                    }));
                }
            }
        }
    }

    Json(serde_json::json!({ "files": files })).into_response()
}

/// Update a workspace file
async fn update_workspace_file(
    Path((agent_id, filename)): Path<(String, String)>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let workspace_root = PathBuf::from("agents").join(&agent_id).join("workspace");
    let file_path = workspace_root.join(filename);

    if let Some(content) = request.get("content").and_then(|c| c.as_str()) {
        if let Err(e) = fs::write(&file_path, content) {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response();
        }
        (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
    } else {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Missing content field"}))).into_response()
    }
}

/// Create a new workspace file
async fn create_workspace_file(
    Path(agent_id): Path<String>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let workspace_root = PathBuf::from("agents").join(&agent_id).join("workspace");
    
    if let (Some(name), Some(content)) = (
        request.get("name").and_then(|n| n.as_str()),
        request.get("content").and_then(|c| c.as_str())
    ) {
        let file_path = workspace_root.join(name);
        if let Err(e) = fs::write(&file_path, content) {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response();
        }
        (StatusCode::CREATED, Json(serde_json::json!({"ok": true}))).into_response()
    } else {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Missing name or content field"}))).into_response()
    }
}

// ============================================================================
// Router
// ============================================================================

pub fn create_agent_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/v1/openclaw/agents/discovery",
            get(discover_openclaw_agents),
        )
        // Agent CRUD
        .route("/api/v1/agents", get(list_agents).post(create_agent))
        .route("/api/v1/capabilities", get(list_capabilities))
        .route("/api/v1/skills/taxonomy", get(list_skills_taxonomy))
        .route("/api/v1/plugins", get(list_plugins))
        .route("/api/v1/marketplace", get(list_marketplace))
        .route("/api/v1/avatars/templates", get(list_avatar_templates))
        .route("/api/v1/voices", get(list_voices))
        .route("/api/v1/voices/:voice_id/preview", get(preview_voice))
        .route("/api/v1/prompts/library", get(list_prompts_library))
        .route("/api/v1/prompts/test", post(test_prompt))
        .route(
            "/api/v1/agents/:agent_id",
            get(get_agent).put(update_agent).delete(delete_agent),
        )
        // Specific agent properties
        .route("/api/v1/agents/:agent_id/personality", get(get_personality).post(update_personality))
        .route("/api/v1/agents/:agent_id/skills", get(get_skills).post(update_skills))
        .route("/api/v1/agents/:agent_id/avatar", get(get_avatar).post(update_avatar))
        .route("/api/v1/agents/:agent_id/prompt", get(get_prompt).post(update_prompt))
        // Workspace initialization
        .route(
            "/api/v1/agents/:agent_id/workspace/initialize",
            post(initialize_workspace),
        )
        // Workspace file management
        .route("/api/v1/agents/:agent_id/workspace/files", get(list_workspace_files).post(create_workspace_file))
        .route("/api/v1/agents/:agent_id/workspace/files/:filename", put(update_workspace_file))
        // Event stream
        .route("/api/v1/agents/:agent_id/events", get(agent_events))
        // Run management
        .route(
            "/api/v1/agents/:agent_id/runs",
            get(list_runs).post(start_run),
        )
        .route("/api/v1/agents/:agent_id/runs/:run_id", get(get_run))
        .route(
            "/api/v1/agents/:agent_id/runs/:run_id/cancel",
            post(cancel_run),
        )
        .route(
            "/api/v1/agents/:agent_id/runs/:run_id/pause",
            post(pause_run),
        )
        .route(
            "/api/v1/agents/:agent_id/runs/:run_id/resume",
            post(resume_run),
        )
        // Task management
        .route("/api/v1/agents/:agent_id/tasks", get(list_tasks))
        .route(
            "/api/v1/agents/:agent_id/tasks/:task_id",
            get(get_task).patch(update_task),
        )
        // Checkpoint management
        .route(
            "/api/v1/agents/:agent_id/checkpoints",
            get(list_checkpoints).post(create_checkpoint),
        )
        .route(
            "/api/v1/agents/:agent_id/checkpoints/:checkpoint_id/restore",
            post(restore_checkpoint),
        )
        // Commit management
        .route(
            "/api/v1/agents/:agent_id/commits",
            get(list_commits).post(create_commit),
        )
        // Queue management
        .route("/api/v1/agents/queue", get(list_queue).post(enqueue))
        .route("/api/v1/agents/queue/:item_id", delete(dequeue))
}
