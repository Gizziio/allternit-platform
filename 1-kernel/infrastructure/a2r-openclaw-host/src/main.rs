//! OpenClaw Host Service
//!
//! This service provides native Rust implementations that replace OpenClaw subprocesses.
//! It serves as the bridge between the UI and the native implementations following
//! the strangler fig pattern.

mod gateway_ws_api;

use a2r_openclaw_host::native_bash_executor::BashExecutionParams;
use a2r_openclaw_host::native_channel_abstraction_native::{
    ChannelAbstractionRequest, ChannelConfig, ChannelContext, ChannelId, ChannelMessage,
    ChannelOperation, ChannelType, MessageFormat, MessageType,
};
use a2r_openclaw_host::native_provider_management::{
    ProviderConfig, ProviderId, ProviderManagementRequest, ProviderOperation, ProviderType,
};
use a2r_openclaw_host::native_session_manager::{SessionId, SessionManagerError, SessionMessage};
use a2r_openclaw_host::native_tool_registry::ToolExecutionRequest;
use a2r_openclaw_host::skills::bridge::{GetSkillRequest, ListSkillsRequest};
use a2r_openclaw_host::{
    // Additional types needed
    skills::SkillRegistry,
    ApiGatewayRouterService,
    BashExecutor,
    CanvasService,
    ChannelAbstractionService,
    CronSystemService,
    FinalCleanupService,
    GatewayBridge,
    GatewayWsHandlerService,
    ImessageBridgeService,
    IntegrationVerificationService,
    OpenClawHost,
    ProviderManagementService,
    ProviderRouterBridge,
    // Native services we've implemented
    SessionCompactor,
    SessionManagerBridge,
    SessionManagerService,
    ShellUiBridgeService,
    SkillExecutionService,
    SkillInstallerService,
    SkillRegistryBridge,
    SubprocessRemovalService,
    ToolRegistry,
    ToolStreamerService,
    TuiService,
    VectorMemoryService,
};
use axum::{
    extract::{Path, Query, State},
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
        HeaderValue, Method, StatusCode,
    },
    routing::{get, post},
    Json as AxumJson, Router,
};
use gateway_ws_api::gateway_ws;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::signal;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info, warn, Level};
use tracing_subscriber::FmtSubscriber;
use uuid::Uuid;

// Shared state for the service - using Arc<Mutex<>> for thread safety
pub struct ServiceState {
    pub skill_registry: Option<Arc<Mutex<SkillRegistryBridge>>>,
    pub session_manager: Option<Arc<Mutex<SessionManagerBridge>>>,
    pub gateway: Option<Arc<Mutex<GatewayBridge>>>,
    pub provider_router: Option<Arc<Mutex<ProviderRouterBridge>>>,
    pub session_compactor: Option<Arc<Mutex<SessionCompactor>>>,
    pub tool_registry: Option<Arc<Mutex<ToolRegistry>>>,
    pub bash_executor: Option<Arc<Mutex<BashExecutor>>>,
    pub gateway_ws_handler: Option<Arc<Mutex<GatewayWsHandlerService>>>,
    pub skill_installer: Option<Arc<Mutex<SkillInstallerService>>>,
    pub vector_memory: Option<Arc<Mutex<VectorMemoryService>>>,
    pub skill_execution: Option<Arc<Mutex<SkillExecutionService>>>,
    pub session_manager_native: Option<Arc<Mutex<SessionManagerService>>>,
    pub tui_service: Option<Arc<Mutex<TuiService>>>,
    pub channel_abstraction: Option<Arc<Mutex<ChannelAbstractionService>>>,
    pub canvas_service: Option<Arc<Mutex<CanvasService>>>,
    pub tool_streamer: Option<Arc<Mutex<ToolStreamerService>>>,
    pub provider_management: Option<Arc<Mutex<ProviderManagementService>>>,
    // Note: CronSystemService::new() returns a future, so we'll handle this differently
    pub cron_system: Option<Arc<Mutex<CronSystemService>>>,
    pub imessage_bridge: Option<Arc<Mutex<ImessageBridgeService>>>,
    pub final_cleanup: Option<Arc<Mutex<FinalCleanupService>>>,
    pub subprocess_removal: Option<Arc<Mutex<SubprocessRemovalService>>>,
    pub integration_verification: Option<Arc<Mutex<IntegrationVerificationService>>>,
    pub shell_ui_bridge: Option<Arc<Mutex<ShellUiBridgeService>>>,
    pub api_gateway_router: Option<Arc<Mutex<ApiGatewayRouterService>>>,
}

type ApiError = (StatusCode, AxumJson<Value>);
type ApiResult = Result<AxumJson<Value>, ApiError>;

#[derive(Debug, Deserialize)]
struct CreateSessionPayload {
    name: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AddSessionMessagePayload {
    role: Option<String>,
    content: String,
    metadata: Option<HashMap<String, Value>>,
}

#[derive(Debug, Deserialize)]
struct UpsertProviderPayload {
    id: String,
    provider_type: String,
    enabled: Option<bool>,
    api_key: Option<String>,
    base_url: Option<String>,
    models: Option<Vec<String>>,
    default_model: Option<String>,
    metadata: Option<HashMap<String, Value>>,
}

#[derive(Debug, Deserialize)]
struct ExecuteToolPayload {
    tool_id: String,
    arguments: Option<HashMap<String, Value>>,
}

#[derive(Debug, Deserialize)]
struct ExecuteBashPayload {
    command: String,
    workdir: Option<String>,
    timeout: Option<u64>,
    security: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MemoryQuery {
    q: Option<String>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct StoreMemoryPayload {
    content: String,
    metadata: Option<HashMap<String, Value>>,
}

#[derive(Debug, Deserialize)]
struct CreateChannelPayload {
    id: String,
    name: String,
    channel_type: Option<String>,
    webhook_url: Option<String>,
    api_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SendChannelMessagePayload {
    channel_id: String,
    sender_id: Option<String>,
    sender_name: Option<String>,
    content: String,
    metadata: Option<HashMap<String, Value>>,
}

fn api_error(status: StatusCode, message: impl Into<String>) -> ApiError {
    (
        status,
        AxumJson(json!({
            "success": false,
            "error": message.into(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })),
    )
}

fn parse_provider_type(provider_type: &str) -> Option<ProviderType> {
    match provider_type.trim().to_ascii_lowercase().as_str() {
        "openai" => Some(ProviderType::OpenAi),
        "anthropic" => Some(ProviderType::Anthropic),
        "google" => Some(ProviderType::Google),
        "mistral" => Some(ProviderType::Mistral),
        "groq" => Some(ProviderType::Groq),
        "azure" => Some(ProviderType::Azure),
        "aws-bedrock" | "aws_bedrock" | "bedrock" => Some(ProviderType::AwsBedrock),
        "ollama" => Some(ProviderType::Ollama),
        "custom" => Some(ProviderType::Custom),
        "local" => Some(ProviderType::Local),
        _ => None,
    }
}

fn parse_channel_type(channel_type: Option<&str>) -> ChannelType {
    match channel_type
        .unwrap_or("web")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "discord" => ChannelType::Discord,
        "slack" => ChannelType::Slack,
        "telegram" => ChannelType::Telegram,
        "whatsapp" => ChannelType::WhatsApp,
        "imessage" => ChannelType::IMessage,
        "signal" => ChannelType::Signal,
        "email" => ChannelType::Email,
        "cli" => ChannelType::Cli,
        "custom" => ChannelType::Custom,
        _ => ChannelType::Web,
    }
}

fn map_session_error(error: SessionManagerError) -> ApiError {
    match error {
        SessionManagerError::SessionNotFound(id) => {
            api_error(StatusCode::NOT_FOUND, format!("Session not found: {}", id))
        }
        other => api_error(StatusCode::INTERNAL_SERVER_ERROR, other.to_string()),
    }
}

fn read_env_key_from_file(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let mut parts = trimmed.splitn(2, '=');
        let current_key = parts.next()?.trim();
        let value = parts.next()?.trim();
        if current_key == key {
            return Some(value.trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
}

fn read_openclaw_env_file() -> Option<String> {
    let current_dir = std::env::current_dir().ok()?;
    for dir in current_dir.ancestors() {
        let candidate = dir.join(".openclaw.env");
        if let Ok(content) = std::fs::read_to_string(&candidate) {
            return Some(content);
        }
    }
    None
}

fn resolve_bind_address() -> String {
    let env_file = read_openclaw_env_file();

    let host_from_file = env_file.as_deref().and_then(|content| {
        read_env_key_from_file(content, "A2R_OPENCLAW_HOST_BIND")
            .or_else(|| read_env_key_from_file(content, "OPENCLAW_HOST_BIND"))
            .or_else(|| read_env_key_from_file(content, "OPENCLAW_HOST"))
    });

    let port_from_file = env_file.as_deref().and_then(|content| {
        read_env_key_from_file(content, "A2R_OPENCLAW_HOST_PORT")
            .or_else(|| read_env_key_from_file(content, "A2R_PORT"))
            .or_else(|| read_env_key_from_file(content, "OPENCLAW_PORT"))
    });

    let host = std::env::var("A2R_OPENCLAW_HOST_BIND")
        .ok()
        .or_else(|| std::env::var("OPENCLAW_HOST_BIND").ok())
        .or_else(|| std::env::var("OPENCLAW_HOST").ok())
        .or(host_from_file)
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let raw_port = std::env::var("A2R_OPENCLAW_HOST_PORT")
        .ok()
        .or_else(|| std::env::var("A2R_PORT").ok())
        .or_else(|| std::env::var("OPENCLAW_PORT").ok())
        .or(port_from_file)
        .unwrap_or_else(|| "8080".to_string());

    let port = match raw_port.parse::<u16>() {
        Ok(value) => value,
        Err(_) => {
            warn!(
                "Invalid OpenClaw host port '{}', falling back to 8080",
                raw_port
            );
            8080
        }
    };

    format!("{}:{}", host.trim(), port)
}

// Health check endpoint
async fn health_check(
    State(_state): State<Arc<ServiceState>>,
) -> Result<AxumJson<Value>, StatusCode> {
    Ok(AxumJson(serde_json::json!({
        "status": "healthy",
        "service": "a2r-openclaw-host",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

// Status endpoint
async fn status(State(state): State<Arc<ServiceState>>) -> Result<AxumJson<Value>, StatusCode> {
    let active_services = count_active_services(&state).await;
    Ok(AxumJson(serde_json::json!({
        "active_services": active_services,
        "total_services": 23, // Total number of services we've implemented
        "status": "running",
        "services": {
            "skill_registry": state.skill_registry.is_some(),
            "session_manager": state.session_manager.is_some(),
            "gateway": state.gateway.is_some(),
            "provider_router": state.provider_router.is_some(),
            "session_compactor": state.session_compactor.is_some(),
            "tool_registry": state.tool_registry.is_some(),
            "bash_executor": state.bash_executor.is_some(),
            "gateway_ws_handler": state.gateway_ws_handler.is_some(),
            "skill_installer": state.skill_installer.is_some(),
            "vector_memory": state.vector_memory.is_some(),
            "skill_execution": state.skill_execution.is_some(),
            "session_manager_native": state.session_manager_native.is_some(),
            "tui_service": state.tui_service.is_some(),
            "channel_abstraction": state.channel_abstraction.is_some(),
            "canvas_service": state.canvas_service.is_some(),
            "tool_streamer": state.tool_streamer.is_some(),
            "provider_management": state.provider_management.is_some(),
            "cron_system": state.cron_system.is_some(),
            "imessage_bridge": state.imessage_bridge.is_some(),
            "final_cleanup": state.final_cleanup.is_some(),
            "subprocess_removal": state.subprocess_removal.is_some(),
            "integration_verification": state.integration_verification.is_some(),
            "shell_ui_bridge": state.shell_ui_bridge.is_some(),
            "api_gateway_router": state.api_gateway_router.is_some(),
        }
    })))
}

async fn list_skills(State(state): State<Arc<ServiceState>>) -> ApiResult {
    let skill_registry = state.skill_registry.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Skill registry unavailable",
        )
    })?;

    let registry = skill_registry.lock().await;
    let response = registry
        .list_skills(ListSkillsRequest {
            include_unavailable: true,
        })
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(AxumJson(json!({
        "skills": response.skills,
        "count": response.skills.len(),
        "total_count": response.total_count,
    })))
}

async fn get_skill(
    Path(skill_id): Path<String>,
    State(state): State<Arc<ServiceState>>,
) -> ApiResult {
    let skill_registry = state.skill_registry.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Skill registry unavailable",
        )
    })?;

    let registry = skill_registry.lock().await;
    let response = registry
        .get_skill(GetSkillRequest { skill_id })
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match response.skill {
        Some(skill) => Ok(AxumJson(json!({ "skill": skill }))),
        None => Err(api_error(StatusCode::NOT_FOUND, "Skill not found")),
    }
}

async fn list_sessions(State(state): State<Arc<ServiceState>>) -> ApiResult {
    let session_manager = state.session_manager_native.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Session manager unavailable",
        )
    })?;

    let manager = session_manager.lock().await;
    let sessions = manager.list_sessions().await.map_err(map_session_error)?;

    Ok(AxumJson(json!({
        "sessions": sessions,
        "count": sessions.len(),
    })))
}

async fn create_session(
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<CreateSessionPayload>,
) -> ApiResult {
    let session_manager = state.session_manager_native.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Session manager unavailable",
        )
    })?;

    let mut manager = session_manager.lock().await;
    let session = manager
        .create_session(payload.name, payload.description)
        .await
        .map_err(map_session_error)?;

    Ok(AxumJson(json!({
        "session": session,
    })))
}

async fn get_session(
    Path(session_id): Path<String>,
    State(state): State<Arc<ServiceState>>,
) -> ApiResult {
    let session_manager = state.session_manager_native.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Session manager unavailable",
        )
    })?;

    let manager = session_manager.lock().await;
    let session = manager
        .get_session(&SessionId::new(session_id))
        .await
        .map_err(map_session_error)?;

    Ok(AxumJson(json!({ "session": session })))
}

async fn add_session_message(
    Path(session_id): Path<String>,
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<AddSessionMessagePayload>,
) -> ApiResult {
    let session_manager = state.session_manager_native.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Session manager unavailable",
        )
    })?;

    let session_id = SessionId::new(session_id);
    let mut manager = session_manager.lock().await;
    let message = SessionMessage {
        id: Uuid::new_v4().to_string(),
        role: payload.role.unwrap_or_else(|| "user".to_string()),
        content: payload.content,
        timestamp: chrono::Utc::now(),
        metadata: payload.metadata,
    };

    manager
        .add_message(&session_id, message)
        .await
        .map_err(map_session_error)?;

    let session = manager
        .get_session(&session_id)
        .await
        .map_err(map_session_error)?;
    Ok(AxumJson(json!({ "session": session })))
}

async fn list_providers(State(state): State<Arc<ServiceState>>) -> ApiResult {
    let provider_management = state.provider_management.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Provider management unavailable",
        )
    })?;

    let mut providers = provider_management.lock().await;
    let response = providers
        .execute(ProviderManagementRequest {
            operation: ProviderOperation::ListProviders,
            context: None,
        })
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if response.success {
        Ok(AxumJson(response.result.unwrap_or_else(|| {
            json!({
                "providers": [],
                "count": 0,
            })
        })))
    } else {
        Err(api_error(
            StatusCode::BAD_GATEWAY,
            response
                .error
                .unwrap_or_else(|| "Failed to list providers".to_string()),
        ))
    }
}

async fn upsert_provider(
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<UpsertProviderPayload>,
) -> ApiResult {
    let provider_type = parse_provider_type(&payload.provider_type)
        .ok_or_else(|| api_error(StatusCode::BAD_REQUEST, "Unsupported provider type"))?;

    let provider_management = state.provider_management.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Provider management unavailable",
        )
    })?;

    let provider_config = ProviderConfig {
        id: ProviderId::new(payload.id),
        provider_type,
        enabled: payload.enabled.unwrap_or(true),
        api_key: payload.api_key,
        base_url: payload.base_url,
        models: payload.models.unwrap_or_default(),
        default_model: payload.default_model,
        rate_limits: None,
        auth_config: None,
        metadata: payload.metadata,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let mut providers = provider_management.lock().await;
    let response = providers
        .execute(ProviderManagementRequest {
            operation: ProviderOperation::UpsertProvider {
                config: provider_config,
            },
            context: None,
        })
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if response.success {
        Ok(AxumJson(
            response.result.unwrap_or_else(|| json!({"success": true})),
        ))
    } else {
        Err(api_error(
            StatusCode::BAD_REQUEST,
            response
                .error
                .unwrap_or_else(|| "Provider upsert failed".to_string()),
        ))
    }
}

async fn list_tools(State(state): State<Arc<ServiceState>>) -> ApiResult {
    let tool_registry = state
        .tool_registry
        .as_ref()
        .ok_or_else(|| api_error(StatusCode::SERVICE_UNAVAILABLE, "Tool registry unavailable"))?;

    let registry = tool_registry.lock().await;
    let tools: Vec<Value> = registry
        .list_all_tools()
        .into_iter()
        .filter_map(|tool| serde_json::to_value(tool).ok())
        .collect();

    Ok(AxumJson(json!({
        "tools": tools,
        "count": tools.len(),
    })))
}

async fn execute_tool(
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<ExecuteToolPayload>,
) -> ApiResult {
    let tool_registry = state
        .tool_registry
        .as_ref()
        .ok_or_else(|| api_error(StatusCode::SERVICE_UNAVAILABLE, "Tool registry unavailable"))?;

    let registry = tool_registry.lock().await;
    let response = registry
        .execute_tool(ToolExecutionRequest {
            tool_id: payload.tool_id,
            arguments: payload.arguments.unwrap_or_default(),
            context: None,
        })
        .await
        .map_err(|e| api_error(StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(AxumJson(json!({ "execution": response })))
}

async fn execute_bash(
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<ExecuteBashPayload>,
) -> ApiResult {
    let bash_executor = state
        .bash_executor
        .as_ref()
        .ok_or_else(|| api_error(StatusCode::SERVICE_UNAVAILABLE, "Bash executor unavailable"))?;

    if payload.command.trim().is_empty() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "Command cannot be empty",
        ));
    }

    let workdir = payload.workdir.map(PathBuf::from);
    let params = BashExecutionParams {
        command: payload.command,
        workdir,
        timeout: payload.timeout,
        security: payload.security.or_else(|| Some("allowlist".to_string())),
        ..Default::default()
    };

    let executor = bash_executor.lock().await;
    let result = executor
        .execute(params)
        .await
        .map_err(|e| api_error(StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(AxumJson(json!({ "result": result })))
}

async fn list_memory(
    Query(query): Query<MemoryQuery>,
    State(state): State<Arc<ServiceState>>,
) -> ApiResult {
    let vector_memory = state
        .vector_memory
        .as_ref()
        .ok_or_else(|| api_error(StatusCode::SERVICE_UNAVAILABLE, "Vector memory unavailable"))?;

    let memory = vector_memory.lock().await;
    let stats = memory.stats();

    let memories = match query.q {
        Some(ref q) if !q.trim().is_empty() => memory
            .search_memories_by_content(q, query.limit)
            .await
            .map_err(|e| api_error(StatusCode::BAD_REQUEST, e.to_string()))?,
        _ => Vec::new(),
    };

    Ok(AxumJson(json!({
        "stats": stats,
        "memories": memories,
        "count": memories.len(),
    })))
}

async fn store_memory(
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<StoreMemoryPayload>,
) -> ApiResult {
    let vector_memory = state
        .vector_memory
        .as_ref()
        .ok_or_else(|| api_error(StatusCode::SERVICE_UNAVAILABLE, "Vector memory unavailable"))?;

    if payload.content.trim().is_empty() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "Memory content cannot be empty",
        ));
    }

    let mut memory = vector_memory.lock().await;
    let memory_id = memory
        .store_memory_with_embedding(payload.content, payload.metadata)
        .await
        .map_err(|e| api_error(StatusCode::BAD_REQUEST, e.to_string()))?;

    let stored = memory
        .get_memory(&memory_id)
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(AxumJson(json!({
        "id": memory_id,
        "memory": stored,
    })))
}

async fn list_channels(State(state): State<Arc<ServiceState>>) -> ApiResult {
    let channel_abstraction = state.channel_abstraction.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Channel abstraction unavailable",
        )
    })?;

    let mut channels = channel_abstraction.lock().await;
    let response = channels
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::ListChannels,
            context: None,
        })
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if response.success {
        Ok(AxumJson(response.result.unwrap_or_else(|| {
            json!({
                "channels": [],
                "count": 0,
            })
        })))
    } else {
        Err(api_error(
            StatusCode::BAD_REQUEST,
            response
                .error
                .unwrap_or_else(|| "Failed to list channels".to_string()),
        ))
    }
}

async fn create_channel(
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<CreateChannelPayload>,
) -> ApiResult {
    let channel_abstraction = state.channel_abstraction.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Channel abstraction unavailable",
        )
    })?;

    if payload.id.trim().is_empty() || payload.name.trim().is_empty() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "Channel id and name are required",
        ));
    }

    let mut channels = channel_abstraction.lock().await;
    let channel_config = ChannelConfig {
        id: ChannelId::new(payload.id.clone()),
        channel_type: parse_channel_type(payload.channel_type.as_deref()),
        name: payload.name,
        enabled: true,
        allow_from: Vec::new(),
        block_from: Vec::new(),
        webhook_url: payload.webhook_url,
        api_token: payload.api_token,
        connection_settings: None,
        message_format: MessageFormat {
            enable_markdown: true,
            enable_mentions: true,
            enable_attachments: true,
            max_message_length: Some(10_000),
            max_attachment_size_mb: Some(25),
        },
        rate_limits: None,
        metadata: None,
    };

    let channels_dir = channels.config().channels_dir.clone();
    tokio::fs::create_dir_all(&channels_dir)
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let config_path = channels_dir.join(format!("{}.json", payload.id));
    let config_json = serde_json::to_string_pretty(&channel_config)
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    tokio::fs::write(config_path, config_json)
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    channels
        .initialize()
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(AxumJson(json!({
        "success": true,
        "channel_id": payload.id,
    })))
}

async fn send_channel_message(
    State(state): State<Arc<ServiceState>>,
    AxumJson(payload): AxumJson<SendChannelMessagePayload>,
) -> ApiResult {
    let channel_abstraction = state.channel_abstraction.as_ref().ok_or_else(|| {
        api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Channel abstraction unavailable",
        )
    })?;

    if payload.channel_id.trim().is_empty() || payload.content.trim().is_empty() {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "channel_id and content are required",
        ));
    }

    let channel_id = ChannelId::new(payload.channel_id.clone());
    let message = ChannelMessage {
        id: Uuid::new_v4().to_string(),
        channel_id: ChannelId::new(payload.channel_id),
        sender_id: payload.sender_id.unwrap_or_else(|| "a2r-ui".to_string()),
        sender_name: payload.sender_name,
        content: payload.content,
        message_type: MessageType::Text,
        timestamp: chrono::Utc::now(),
        attachments: None,
        metadata: payload.metadata,
        reply_to: None,
    };

    let mut channels = channel_abstraction.lock().await;
    let response = channels
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::SendMessage {
                channel_id,
                message,
            },
            context: Some(ChannelContext {
                session_id: None,
                agent_id: None,
                user_id: Some("a2r-ui".to_string()),
                metadata: None,
            }),
        })
        .await
        .map_err(|e| api_error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if response.success {
        Ok(AxumJson(
            response.result.unwrap_or_else(|| json!({"status": "sent"})),
        ))
    } else {
        Err(api_error(
            StatusCode::BAD_REQUEST,
            response
                .error
                .unwrap_or_else(|| "Failed to send message".to_string()),
        ))
    }
}

async fn gateway_status(State(state): State<Arc<ServiceState>>) -> ApiResult {
    let mut gateway_health = json!({
        "connected": false,
        "status": "unavailable",
    });

    if let Some(gateway) = state.gateway.as_ref() {
        let mut bridge = gateway.lock().await;
        match bridge.health_check().await {
            Ok(health) => {
                gateway_health = json!({
                    "connected": health.healthy,
                    "status": health.status,
                    "uptime": health.uptime,
                    "version": health.version,
                });
            }
            Err(err) => {
                gateway_health = json!({
                    "connected": false,
                    "status": "error",
                    "error": err.to_string(),
                });
            }
        }
    }

    let active_services = count_active_services(&state).await;
    Ok(AxumJson(json!({
        "gateway": gateway_health,
        "service_status": {
            "active_services": active_services,
            "total_services": 23,
        },
    })))
}

// Count active services
async fn count_active_services(state: &ServiceState) -> usize {
    let mut count = 0;
    if state.skill_registry.is_some() {
        count += 1;
    }
    if state.session_manager.is_some() {
        count += 1;
    }
    if state.gateway.is_some() {
        count += 1;
    }
    if state.provider_router.is_some() {
        count += 1;
    }
    if state.session_compactor.is_some() {
        count += 1;
    }
    if state.tool_registry.is_some() {
        count += 1;
    }
    if state.bash_executor.is_some() {
        count += 1;
    }
    if state.gateway_ws_handler.is_some() {
        count += 1;
    }
    if state.skill_installer.is_some() {
        count += 1;
    }
    if state.vector_memory.is_some() {
        count += 1;
    }
    if state.skill_execution.is_some() {
        count += 1;
    }
    if state.session_manager_native.is_some() {
        count += 1;
    }
    if state.tui_service.is_some() {
        count += 1;
    }
    if state.channel_abstraction.is_some() {
        count += 1;
    }
    if state.canvas_service.is_some() {
        count += 1;
    }
    if state.tool_streamer.is_some() {
        count += 1;
    }
    if state.provider_management.is_some() {
        count += 1;
    }
    if state.cron_system.is_some() {
        count += 1;
    }
    if state.imessage_bridge.is_some() {
        count += 1;
    }
    if state.final_cleanup.is_some() {
        count += 1;
    }
    if state.subprocess_removal.is_some() {
        count += 1;
    }
    if state.integration_verification.is_some() {
        count += 1;
    }
    if state.shell_ui_bridge.is_some() {
        count += 1;
    }
    if state.api_gateway_router.is_some() {
        count += 1;
    }
    count
}

fn build_cors_layer() -> CorsLayer {
    let configured_origins = std::env::var("A2R_CORS_ORIGINS").unwrap_or_else(|_| {
        "http://localhost:5177,http://127.0.0.1:5177,http://localhost:3000,http://127.0.0.1:3000"
            .to_string()
    });

    let origins: Vec<HeaderValue> = configured_origins
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([ACCEPT, CONTENT_TYPE, AUTHORIZATION]);

    if origins.is_empty() {
        cors.allow_origin(Any)
    } else {
        cors.allow_origin(origins)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("Setting default subscriber failed");

    info!("Starting A2R OpenClaw Absorption Host Service...");

    // Create a mock OpenClawHost instance for the bridge services
    // Since we're transitioning away from OpenClaw subprocesses, we'll create a minimal mock
    let mock_host = Arc::new(Mutex::new(OpenClawHost::create_mock().await));

    // Create all native services with proper initialization.
    // For bridge services that require OpenClawHost, we'll use the mock host.
    let mut native_skill_registry = SkillRegistry::new();
    let skill_dirs = [
        PathBuf::from("3-adapters/vendor/openclaw/skills"),
        PathBuf::from("vendor/openclaw/skills"),
        PathBuf::from(".codex/skills"),
    ];
    for dir in skill_dirs {
        if dir.exists() {
            match native_skill_registry.load_openclaw_skills(&dir) {
                Ok(count) => {
                    info!("Loaded {} skills from {}", count, dir.display());
                }
                Err(err) => {
                    warn!("Failed to load skills from {}: {}", dir.display(), err);
                }
            }
            break;
        }
    }
    let skill_registry = Arc::new(Mutex::new(SkillRegistryBridge::new(native_skill_registry)));
    let session_manager = Arc::new(Mutex::new(SessionManagerBridge::new(mock_host.clone())));
    let gateway = Arc::new(Mutex::new(GatewayBridge::new(mock_host.clone())));
    let provider_router = Arc::new(Mutex::new(ProviderRouterBridge::new(mock_host.clone())));
    let session_compactor = Arc::new(Mutex::new(SessionCompactor::new()));
    let tool_registry = Arc::new(Mutex::new(ToolRegistry::new()));
    let bash_executor = Arc::new(Mutex::new(BashExecutor::new()));
    let gateway_ws_handler = Arc::new(Mutex::new(GatewayWsHandlerService::new()));
    let skill_installer = Arc::new(Mutex::new(SkillInstallerService::new()));
    let mut vector_memory_service = VectorMemoryService::new();
    if let Err(err) = vector_memory_service.initialize().await {
        warn!("Vector memory initialization warning: {}", err);
    }
    let vector_memory = Arc::new(Mutex::new(vector_memory_service));
    let skill_execution = Arc::new(Mutex::new(SkillExecutionService::new()));
    let mut session_manager_native_service = SessionManagerService::new();
    if let Err(err) = session_manager_native_service.initialize().await {
        warn!("Session manager initialization warning: {}", err);
    }
    let session_manager_native = Arc::new(Mutex::new(session_manager_native_service));
    let tui_service = Arc::new(Mutex::new(TuiService::new()));
    let mut channel_abstraction_service = ChannelAbstractionService::new();
    if let Err(err) = channel_abstraction_service.initialize().await {
        warn!("Channel abstraction initialization warning: {}", err);
    }
    let channel_abstraction = Arc::new(Mutex::new(channel_abstraction_service));
    let canvas_service = Arc::new(Mutex::new(CanvasService::new()));
    let tool_streamer = Arc::new(Mutex::new(ToolStreamerService::new()));
    let mut provider_management_service = ProviderManagementService::new();
    if let Err(err) = provider_management_service.initialize().await {
        warn!("Provider management initialization warning: {}", err);
    }
    let provider_management = Arc::new(Mutex::new(provider_management_service));
    let imessage_bridge = Arc::new(Mutex::new(ImessageBridgeService::new()));
    let final_cleanup = Arc::new(Mutex::new(FinalCleanupService::new()));
    let subprocess_removal = Arc::new(Mutex::new(SubprocessRemovalService::new()));
    let integration_verification = Arc::new(Mutex::new(IntegrationVerificationService::new()));
    let shell_ui_bridge = Arc::new(Mutex::new(ShellUiBridgeService::new()));

    // Initialize the cron system (this returns a future)
    let cron_system = Arc::new(Mutex::new(CronSystemService::new().await?));

    // Create API gateway router service instance
    let api_gateway_router_service = ApiGatewayRouterService::new();

    let api_gateway_router = Arc::new(Mutex::new(api_gateway_router_service));

    info!("All native services initialized successfully");

    // Create shared state
    let state = Arc::new(ServiceState {
        skill_registry: Some(skill_registry),
        session_manager: Some(session_manager),
        gateway: Some(gateway),
        provider_router: Some(provider_router),
        session_compactor: Some(session_compactor),
        tool_registry: Some(tool_registry),
        bash_executor: Some(bash_executor),
        gateway_ws_handler: Some(gateway_ws_handler),
        skill_installer: Some(skill_installer),
        vector_memory: Some(vector_memory),
        skill_execution: Some(skill_execution),
        session_manager_native: Some(session_manager_native),
        tui_service: Some(tui_service),
        channel_abstraction: Some(channel_abstraction),
        canvas_service: Some(canvas_service),
        tool_streamer: Some(tool_streamer),
        provider_management: Some(provider_management),
        cron_system: Some(cron_system),
        imessage_bridge: Some(imessage_bridge),
        final_cleanup: Some(final_cleanup),
        subprocess_removal: Some(subprocess_removal),
        integration_verification: Some(integration_verification),
        shell_ui_bridge: Some(shell_ui_bridge),
        api_gateway_router: Some(api_gateway_router.clone()),
    });

    // Create API routes
    let app = Router::new()
        .route("/ws", get(gateway_ws))
        .route("/api/v1/ws", get(gateway_ws))
        .route("/health", get(health_check))
        .route("/api/v1/health", get(health_check))
        .route("/status", get(status))
        .route("/api/v1/status", get(status))
        .route("/api/v1/skills", get(list_skills))
        .route("/api/v1/skills/:skill_id", get(get_skill))
        .route("/api/v1/sessions", get(list_sessions).post(create_session))
        .route("/api/v1/sessions/:session_id", get(get_session))
        .route(
            "/api/v1/sessions/:session_id/messages",
            post(add_session_message),
        )
        .route(
            "/api/v1/providers",
            get(list_providers).post(upsert_provider),
        )
        .route("/api/v1/gateway/status", get(gateway_status))
        .route("/api/v1/tools", get(list_tools))
        .route("/api/v1/tools/execute", post(execute_tool))
        .route("/api/v1/tools/bash", post(execute_bash))
        .route("/api/v1/memory", get(list_memory).post(store_memory))
        .route("/api/v1/channels", get(list_channels).post(create_channel))
        .route("/api/v1/channels/send", post(send_channel_message))
        .layer(build_cors_layer())
        .with_state(state);

    // Bind address is configurable to keep UI and host aligned across environments.
    let bind_addr = resolve_bind_address();
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    info!("A2R OpenClaw Host Service listening on {}", bind_addr);

    info!("A2R OpenClaw Absorption Host Service started successfully");

    // Run the server
    let server_task = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown_signal())
            .await
            .map_err(|e| {
                error!("Server error: {}", e);
                e
            })
    });

    // Wait for shutdown signal
    let _ = signal::ctrl_c().await;
    info!("Shutdown signal received, stopping services...");

    // Shutdown services gracefully
    let shutdown_result = tokio::try_join!(server_task);

    match shutdown_result {
        Ok(_) => info!("All services shut down gracefully"),
        Err(e) => error!("Error during shutdown: {}", e),
    }

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Received shutdown signal");
}
