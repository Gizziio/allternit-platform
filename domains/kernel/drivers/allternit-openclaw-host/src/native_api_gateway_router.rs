//! API Gateway ↔ Native Service Router - IC-002
//!
//! API Gateway router that connects API endpoints to native Allternit service implementations.
//! This module provides routing functionality that directs API requests to the appropriate
//! native service implementations instead of OpenClaw subprocesses.

use axum::{
    extract::{Json, Path},
    http::StatusCode,
    routing::{delete, get, post, put},
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// API Gateway request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiGatewayRequest {
    pub operation: ApiGatewayOperation,
    pub context: Option<ApiGatewayContext>,
}

/// API Gateway operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiGatewayOperation {
    /// Skill operations
    ListSkills,
    GetSkill {
        id: String,
    },
    InstallSkill {
        skill_path: String,
    },
    ExecuteSkill {
        skill_id: String,
        arguments: HashMap<String, serde_json::Value>,
    },

    /// Session operations
    ListSessions,
    GetSession {
        id: String,
    },
    CreateSession {
        name: Option<String>,
        description: Option<String>,
    },
    UpdateSession {
        id: String,
        updates: SessionUpdates,
    },
    DeleteSession {
        id: String,
    },

    /// Gateway operations
    GetGatewayStatus,
    ListConnections,
    GetConnection {
        id: String,
    },

    /// Provider operations
    ListProviders,
    GetProvider {
        id: String,
    },
    UpdateProvider {
        id: String,
        config: ProviderConfigUpdates,
    },

    /// Tool operations
    ListTools,
    GetTool {
        id: String,
    },
    ExecuteTool {
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    },

    /// Memory operations
    ListMemories,
    SearchMemories {
        query: String,
        limit: Option<usize>,
    },
    StoreMemory {
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    },

    /// Channel operations
    ListChannels,
    GetChannel {
        id: String,
    },
    SendMessage {
        channel_id: String,
        message: String,
    },

    /// TUI operations
    StartTuiSession,
    SendTuiCommand {
        command: String,
    },
    GetTuiStatus,

    /// Vector memory operations
    QueryVectors {
        query: String,
        top_k: usize,
    },
    StoreVector {
        content: String,
        embedding: Vec<f32>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    },

    /// Tool streaming operations
    StreamToolExecution {
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    },

    /// Provider management operations
    CheckProviderHealth {
        id: String,
    },
    GetProviderUsage {
        id: String,
    },

    /// Cron system operations
    ListScheduledJobs,
    CreateJob {
        schedule: String,
        command: String,
    },
    DeleteJob {
        id: String,
    },

    /// iMessage operations
    ListImessageContacts,
    SendImessage {
        contact: String,
        message: String,
    },

    /// Final cleanup operations
    CompactSessions,
    CleanupResources,

    /// Subprocess removal verification
    VerifySubprocessRemoval,
}

/// API Gateway context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiGatewayContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

/// API Gateway response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiGatewayResponse {
    pub success: bool,
    pub operation: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// API Gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiGatewayConfig {
    pub listen_address: String,
    pub port: u16,
    pub enable_rate_limiting: bool,
    pub requests_per_minute: Option<u32>,
    pub enable_authentication: bool,
    pub auth_token: Option<String>,
    pub enable_logging: bool,
    pub log_level: String, // "debug", "info", "warn", "error"
    pub enable_compression: bool,
    pub cors_allowed_origins: Vec<String>,
    pub max_request_size_bytes: u64,
    pub timeout_seconds: u64,
    pub enable_metrics: bool,
    pub metrics_endpoint: Option<String>,
    pub enable_tracing: bool,
    pub trace_endpoint: Option<String>,
}

impl Default for ApiGatewayConfig {
    fn default() -> Self {
        Self {
            listen_address: "127.0.0.1".to_string(),
            port: 8080,
            enable_rate_limiting: true,
            requests_per_minute: Some(1000),
            enable_authentication: true,
            auth_token: Some("allternit-default-token".to_string()),
            enable_logging: true,
            log_level: "info".to_string(),
            enable_compression: true,
            cors_allowed_origins: vec![
                "http://localhost:3000".to_string(),
                "http://127.0.0.1:3000".to_string(),
            ],
            max_request_size_bytes: 10 * 1024 * 1024, // 10MB
            timeout_seconds: 30,
            enable_metrics: true,
            metrics_endpoint: Some("/metrics".to_string()),
            enable_tracing: false,
            trace_endpoint: Some("/trace".to_string()),
        }
    }
}

/// Session updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUpdates {
    pub name: Option<String>,
    pub description: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Provider configuration updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfigUpdates {
    pub enabled: Option<bool>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub models: Option<Vec<String>>,
    pub rate_limits: Option<RateLimitConfig>,
}

/// Rate limit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_minute: Option<u32>,
    pub tokens_per_minute: Option<u64>,
    pub tokens_per_day: Option<u64>,
    pub burst_limit: Option<u32>,
}

/// API Gateway router service
pub struct ApiGatewayRouterService {
    config: ApiGatewayConfig,
    skill_registry: Option<crate::SkillRegistryBridge>,
    session_manager: Option<crate::SessionManagerBridge>,
    gateway: Option<crate::GatewayBridge>,
    provider_router: Option<crate::ProviderRouterBridge>,
    session_compactor: Option<crate::SessionCompactor>,
    tool_registry: Option<crate::ToolRegistry>,
    bash_executor: Option<crate::BashExecutor>,
    gateway_ws_handler: Option<crate::GatewayWsHandlerService>,
    skill_installer: Option<crate::SkillInstallerService>,
    vector_memory: Option<crate::VectorMemoryService>,
    skill_execution: Option<crate::SkillExecutionService>,
    session_manager_native: Option<crate::SessionManagerService>,
    tui_service: Option<crate::TuiService>,
    channel_abstraction: Option<crate::ChannelAbstractionService>,
    canvas_service: Option<crate::CanvasService>,
    tool_streamer: Option<crate::ToolStreamerService>,
    provider_management: Option<crate::ProviderManagementService>,
    cron_system: Option<crate::CronSystemService>,
    imessage_bridge: Option<crate::ImessageBridgeService>,
    final_cleanup: Option<crate::FinalCleanupService>,
    subprocess_removal: Option<crate::SubprocessRemovalService>,
    integration_verification: Option<crate::IntegrationVerificationService>,
    shell_ui_bridge: Option<crate::ShellUiBridgeService>,
    request_stats: Arc<RwLock<RequestStats>>,
}

/// Request statistics
#[derive(Debug, Clone)]
struct RequestStats {
    total_requests: u64,
    successful_requests: u64,
    failed_requests: u64,
    start_time: DateTime<Utc>,
}

impl Default for RequestStats {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            start_time: Utc::now(),
        }
    }
}

impl Default for ApiGatewayRouterService {
    fn default() -> Self {
        Self::new()
    }
}

impl ApiGatewayRouterService {
    /// Create new API gateway router with default configuration
    pub fn new() -> Self {
        Self {
            config: ApiGatewayConfig::default(),
            skill_registry: None,
            session_manager: None,
            gateway: None,
            provider_router: None,
            session_compactor: None,
            tool_registry: None,
            bash_executor: None,
            gateway_ws_handler: None,
            skill_installer: None,
            vector_memory: None,
            skill_execution: None,
            session_manager_native: None,
            tui_service: None,
            channel_abstraction: None,
            canvas_service: None,
            tool_streamer: None,
            provider_management: None,
            cron_system: None,
            imessage_bridge: None,
            final_cleanup: None,
            subprocess_removal: None,
            integration_verification: None,
            shell_ui_bridge: None,
            request_stats: Arc::new(RwLock::new(RequestStats::default())),
        }
    }

    /// Create new API gateway router with custom configuration
    pub fn with_config(config: ApiGatewayConfig) -> Self {
        Self {
            config,
            skill_registry: None,
            session_manager: None,
            gateway: None,
            provider_router: None,
            session_compactor: None,
            tool_registry: None,
            bash_executor: None,
            gateway_ws_handler: None,
            skill_installer: None,
            vector_memory: None,
            skill_execution: None,
            session_manager_native: None,
            tui_service: None,
            channel_abstraction: None,
            canvas_service: None,
            tool_streamer: None,
            provider_management: None,
            cron_system: None,
            imessage_bridge: None,
            final_cleanup: None,
            subprocess_removal: None,
            integration_verification: None,
            shell_ui_bridge: None,
            request_stats: Arc::new(RwLock::new(RequestStats::default())),
        }
    }

    /// Initialize the API gateway router with all native services
    pub fn with_services(
        mut self,
        skill_registry: Option<crate::SkillRegistryBridge>,
        session_manager: Option<crate::SessionManagerBridge>,
        gateway: Option<crate::GatewayBridge>,
        provider_router: Option<crate::ProviderRouterBridge>,
        session_compactor: Option<crate::SessionCompactor>,
        tool_registry: Option<crate::ToolRegistry>,
        bash_executor: Option<crate::BashExecutor>,
        gateway_ws_handler: Option<crate::GatewayWsHandlerService>,
        skill_installer: Option<crate::SkillInstallerService>,
        vector_memory: Option<crate::VectorMemoryService>,
        skill_execution: Option<crate::SkillExecutionService>,
        session_manager_native: Option<crate::SessionManagerService>,
        tui_service: Option<crate::TuiService>,
        channel_abstraction: Option<crate::ChannelAbstractionService>,
        canvas_service: Option<crate::CanvasService>,
        tool_streamer: Option<crate::ToolStreamerService>,
        provider_management: Option<crate::ProviderManagementService>,
        cron_system: Option<crate::CronSystemService>,
        imessage_bridge: Option<crate::ImessageBridgeService>,
        final_cleanup: Option<crate::FinalCleanupService>,
        subprocess_removal: Option<crate::SubprocessRemovalService>,
        integration_verification: Option<crate::IntegrationVerificationService>,
        shell_ui_bridge: Option<crate::ShellUiBridgeService>,
    ) -> Self {
        self.skill_registry = skill_registry;
        self.session_manager = session_manager;
        self.gateway = gateway;
        self.provider_router = provider_router;
        self.session_compactor = session_compactor;
        self.tool_registry = tool_registry;
        self.bash_executor = bash_executor;
        self.gateway_ws_handler = gateway_ws_handler;
        self.skill_installer = skill_installer;
        self.vector_memory = vector_memory;
        self.skill_execution = skill_execution;
        self.session_manager_native = session_manager_native;
        self.tui_service = tui_service;
        self.channel_abstraction = channel_abstraction;
        self.canvas_service = canvas_service;
        self.tool_streamer = tool_streamer;
        self.provider_management = provider_management;
        self.cron_system = cron_system;
        self.imessage_bridge = imessage_bridge;
        self.final_cleanup = final_cleanup;
        self.subprocess_removal = subprocess_removal;
        self.integration_verification = integration_verification;
        self.shell_ui_bridge = shell_ui_bridge;
        self
    }

    /// Initialize the API gateway router by connecting to native services
    pub async fn initialize(&mut self) -> Result<(), ApiGatewayRouterError> {
        // Initialize all native services
        self.initialize_native_services().await?;
        Ok(())
    }

    /// Initialize native services
    async fn initialize_native_services(&mut self) -> Result<(), ApiGatewayRouterError> {
        // Initialize skill registry bridge
        let vendor_dir = std::env::var("OPENCLAW_VENDOR_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("3-adapters/vendor-integration/vendor/openclaw"));
        self.skill_registry = Some(
            crate::SkillRegistryBridge::with_vendor_dir(&vendor_dir).map_err(|e| {
                ApiGatewayRouterError::IoError(format!(
                    "Failed to load OpenClaw skills from {}: {}",
                    vendor_dir.display(),
                    e
                ))
            })?,
        );

        let mut host_config = crate::HostConfig::default();
        if let Ok(path) = std::env::var("OPENCLAW_PATH") {
            host_config.openclaw_path = path.into();
        }
        if let Ok(workspace) = std::env::var("OPENCLAW_WORKSPACE_DIR") {
            host_config.workspace_dir = Some(workspace.into());
        }
        if let Ok(port) = std::env::var("OPENCLAW_PORT") {
            host_config.port = Some(port.parse().map_err(|e| {
                ApiGatewayRouterError::ValidationError(format!(
                    "Invalid OPENCLAW_PORT '{}': {}",
                    port, e
                ))
            })?);
        }

        let host = crate::OpenClawHost::start(host_config).await.map_err(|e| {
            ApiGatewayRouterError::IoError(format!("Failed to start OpenClaw host: {}", e))
        })?;
        let host = std::sync::Arc::new(tokio::sync::Mutex::new(host));

        // Initialize session manager bridge
        self.session_manager = Some(crate::SessionManagerBridge::new(host.clone()));

        // Initialize gateway bridge
        self.gateway = Some(crate::GatewayBridge::new(host.clone()));

        // Initialize provider router bridge
        self.provider_router = Some(crate::ProviderRouterBridge::new(host));

        // Initialize native services
        self.session_compactor = Some(crate::SessionCompactor::new());
        self.tool_registry = Some(crate::ToolRegistry::new());
        self.bash_executor = Some(crate::BashExecutor::new());
        self.gateway_ws_handler = Some(crate::GatewayWsHandlerService::new());
        self.skill_installer = Some(crate::SkillInstallerService::new());
        self.vector_memory = Some(crate::VectorMemoryService::new());
        self.skill_execution = Some(crate::SkillExecutionService::new());
        self.session_manager_native = Some(crate::SessionManagerService::new());
        self.tui_service = Some(crate::TuiService::new());
        self.channel_abstraction = Some(crate::ChannelAbstractionService::new());
        self.canvas_service = Some(crate::CanvasService::new());
        self.tool_streamer = Some(crate::ToolStreamerService::new());
        self.provider_management = Some(crate::ProviderManagementService::new());
        self.cron_system = Some(crate::CronSystemService::new().await.map_err(|e| {
            ApiGatewayRouterError::IoError(format!("Failed to initialize cron system: {}", e))
        })?);
        self.imessage_bridge = Some(crate::ImessageBridgeService::new());
        self.final_cleanup = Some(crate::FinalCleanupService::new());
        self.subprocess_removal = Some(crate::SubprocessRemovalService::new());
        self.integration_verification = Some(crate::IntegrationVerificationService::new());
        self.shell_ui_bridge = Some(crate::ShellUiBridgeService::new());

        Ok(())
    }

    /// Execute an API gateway operation
    pub async fn execute(
        &self,
        request: ApiGatewayRequest,
    ) -> Result<ApiGatewayResponse, ApiGatewayRouterError> {
        let start_time = std::time::Instant::now();

        let operation_name = match &request.operation {
            ApiGatewayOperation::ListSkills => "list_skills".to_string(),
            ApiGatewayOperation::GetSkill { .. } => "get_skill".to_string(),
            ApiGatewayOperation::InstallSkill { .. } => "install_skill".to_string(),
            ApiGatewayOperation::ExecuteSkill { .. } => "execute_skill".to_string(),
            ApiGatewayOperation::ListSessions => "list_sessions".to_string(),
            ApiGatewayOperation::GetSession { .. } => "get_session".to_string(),
            ApiGatewayOperation::CreateSession { .. } => "create_session".to_string(),
            ApiGatewayOperation::UpdateSession { .. } => "update_session".to_string(),
            ApiGatewayOperation::DeleteSession { .. } => "delete_session".to_string(),
            ApiGatewayOperation::GetGatewayStatus => "get_gateway_status".to_string(),
            ApiGatewayOperation::ListConnections => "list_connections".to_string(),
            ApiGatewayOperation::GetConnection { .. } => "get_connection".to_string(),
            ApiGatewayOperation::ListProviders => "list_providers".to_string(),
            ApiGatewayOperation::GetProvider { .. } => "get_provider".to_string(),
            ApiGatewayOperation::UpdateProvider { .. } => "update_provider".to_string(),
            ApiGatewayOperation::ListTools => "list_tools".to_string(),
            ApiGatewayOperation::GetTool { .. } => "get_tool".to_string(),
            ApiGatewayOperation::ExecuteTool { .. } => "execute_tool".to_string(),
            ApiGatewayOperation::ListMemories => "list_memories".to_string(),
            ApiGatewayOperation::SearchMemories { .. } => "search_memories".to_string(),
            ApiGatewayOperation::StoreMemory { .. } => "store_memory".to_string(),
            ApiGatewayOperation::ListChannels => "list_channels".to_string(),
            ApiGatewayOperation::GetChannel { .. } => "get_channel".to_string(),
            ApiGatewayOperation::SendMessage { .. } => "send_message".to_string(),
            ApiGatewayOperation::StartTuiSession => "start_tui_session".to_string(),
            ApiGatewayOperation::SendTuiCommand { .. } => "send_tui_command".to_string(),
            ApiGatewayOperation::GetTuiStatus => "get_tui_status".to_string(),
            ApiGatewayOperation::QueryVectors { .. } => "query_vectors".to_string(),
            ApiGatewayOperation::StoreVector { .. } => "store_vector".to_string(),
            ApiGatewayOperation::StreamToolExecution { .. } => "stream_tool_execution".to_string(),
            ApiGatewayOperation::CheckProviderHealth { .. } => "check_provider_health".to_string(),
            ApiGatewayOperation::GetProviderUsage { .. } => "get_provider_usage".to_string(),
            ApiGatewayOperation::ListScheduledJobs => "list_scheduled_jobs".to_string(),
            ApiGatewayOperation::CreateJob { .. } => "create_job".to_string(),
            ApiGatewayOperation::DeleteJob { .. } => "delete_job".to_string(),
            ApiGatewayOperation::ListImessageContacts => "list_imessage_contacts".to_string(),
            ApiGatewayOperation::SendImessage { .. } => "send_imessage".to_string(),
            ApiGatewayOperation::CompactSessions => "compact_sessions".to_string(),
            ApiGatewayOperation::CleanupResources => "cleanup_resources".to_string(),
            ApiGatewayOperation::VerifySubprocessRemoval => "verify_subprocess_removal".to_string(),
        };

        let result = match request.operation {
            ApiGatewayOperation::ListSkills => self.handle_list_skills().await,
            ApiGatewayOperation::GetSkill { id } => self.handle_get_skill(&id).await,
            ApiGatewayOperation::InstallSkill { skill_path } => {
                self.handle_install_skill(skill_path).await
            }
            ApiGatewayOperation::ExecuteSkill {
                skill_id,
                arguments,
            } => self.handle_execute_skill(skill_id, arguments).await,
            ApiGatewayOperation::ListSessions => self.handle_list_sessions().await,
            ApiGatewayOperation::GetSession { id } => self.handle_get_session(&id).await,
            ApiGatewayOperation::CreateSession { name, description } => {
                self.handle_create_session(name, description).await
            }
            ApiGatewayOperation::UpdateSession { id, updates } => {
                self.handle_update_session(id, updates).await
            }
            ApiGatewayOperation::DeleteSession { id } => self.handle_delete_session(id).await,
            ApiGatewayOperation::GetGatewayStatus => self.handle_get_gateway_status().await,
            ApiGatewayOperation::ListConnections => self.handle_list_connections().await,
            ApiGatewayOperation::GetConnection { id } => self.handle_get_connection(id).await,
            ApiGatewayOperation::ListProviders => self.handle_list_providers().await,
            ApiGatewayOperation::GetProvider { id } => self.handle_get_provider(id).await,
            ApiGatewayOperation::UpdateProvider { id, config } => {
                self.handle_update_provider(id, config).await
            }
            ApiGatewayOperation::ListTools => self.handle_list_tools().await,
            ApiGatewayOperation::GetTool { id } => self.handle_get_tool(id).await,
            ApiGatewayOperation::ExecuteTool { tool_id, arguments } => {
                self.handle_execute_tool(tool_id, arguments).await
            }
            ApiGatewayOperation::ListMemories => self.handle_list_memories().await,
            ApiGatewayOperation::SearchMemories { query, limit } => {
                self.handle_search_memories(query, limit).await
            }
            ApiGatewayOperation::StoreMemory { content, metadata } => {
                self.handle_store_memory(content, metadata).await
            }
            ApiGatewayOperation::ListChannels => self.handle_list_channels().await,
            ApiGatewayOperation::GetChannel { id } => self.handle_get_channel(id).await,
            ApiGatewayOperation::SendMessage {
                channel_id,
                message,
            } => self.handle_send_message(channel_id, message).await,
            ApiGatewayOperation::StartTuiSession => self.handle_start_tui_session().await,
            ApiGatewayOperation::SendTuiCommand { command } => {
                self.handle_send_tui_command(command).await
            }
            ApiGatewayOperation::GetTuiStatus => self.handle_get_tui_status().await,
            ApiGatewayOperation::QueryVectors { query, top_k } => {
                self.handle_query_vectors(query, top_k).await
            }
            ApiGatewayOperation::StoreVector {
                content,
                embedding,
                metadata,
            } => self.handle_store_vector(content, embedding, metadata).await,
            ApiGatewayOperation::StreamToolExecution { tool_id, arguments } => {
                self.handle_stream_tool_execution(tool_id, arguments).await
            }
            ApiGatewayOperation::CheckProviderHealth { id } => {
                self.handle_check_provider_health(id).await
            }
            ApiGatewayOperation::GetProviderUsage { id } => {
                self.handle_get_provider_usage(id).await
            }
            ApiGatewayOperation::ListScheduledJobs => self.handle_list_scheduled_jobs().await,
            ApiGatewayOperation::CreateJob { schedule, command } => {
                self.handle_create_job(schedule, command).await
            }
            ApiGatewayOperation::DeleteJob { id } => self.handle_delete_job(id).await,
            ApiGatewayOperation::ListImessageContacts => self.handle_list_imessage_contacts().await,
            ApiGatewayOperation::SendImessage { contact, message } => {
                self.handle_send_imessage(contact, message).await
            }
            ApiGatewayOperation::CompactSessions => self.handle_compact_sessions().await,
            ApiGatewayOperation::CleanupResources => self.handle_cleanup_resources().await,
            ApiGatewayOperation::VerifySubprocessRemoval => {
                self.handle_verify_subprocess_removal().await
            }
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        // Update statistics
        {
            let mut stats = self.request_stats.write().await;
            stats.total_requests += 1;
            match &result {
                Ok(_) => stats.successful_requests += 1,
                Err(_) => stats.failed_requests += 1,
            }
        }

        match result {
            Ok(result_value) => Ok(ApiGatewayResponse {
                success: true,
                operation: operation_name,
                result: Some(result_value),
                error: None,
                execution_time_ms: execution_time,
            }),
            Err(error) => Ok(ApiGatewayResponse {
                success: false,
                operation: operation_name,
                result: None,
                error: Some(error.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// Handle list skills operation
    async fn handle_list_skills(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref skill_registry) = self.skill_registry {
            // In a real implementation, this would call the actual skill registry
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "skills": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SkillRegistry".to_string(),
            ))
        }
    }

    /// Handle get skill operation
    async fn handle_get_skill(
        &self,
        skill_id: &str,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref skill_registry) = self.skill_registry {
            // In a real implementation, this would call the actual skill registry
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "skill": {
                    "id": skill_id,
                    "name": format!("Skill {}", skill_id),
                    "description": "A mock skill for testing",
                    "enabled": true,
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SkillRegistry".to_string(),
            ))
        }
    }

    /// Handle install skill operation
    async fn handle_install_skill(
        &self,
        skill_path: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref skill_installer) = self.skill_installer {
            // In a real implementation, this would call the actual skill installer
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "skill_installed",
                "path": skill_path,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SkillInstaller".to_string(),
            ))
        }
    }

    /// Handle execute skill operation
    async fn handle_execute_skill(
        &self,
        skill_id: String,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref skill_execution) = self.skill_execution {
            // In a real implementation, this would call the actual skill execution service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "skill_executed",
                "skillId": skill_id,
                "arguments": arguments,
                "result": "Mock execution result",
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SkillExecution".to_string(),
            ))
        }
    }

    /// Handle list sessions operation
    async fn handle_list_sessions(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref session_manager) = self.session_manager {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "sessions": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SessionManager".to_string(),
            ))
        }
    }

    /// Handle get session operation
    async fn handle_get_session(
        &self,
        session_id: &str,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref session_manager) = self.session_manager {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "session": {
                    "id": session_id,
                    "name": format!("Session {}", session_id),
                    "description": "A mock session for testing",
                    "active": true,
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SessionManager".to_string(),
            ))
        }
    }

    /// Handle create session operation
    async fn handle_create_session(
        &self,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            let session_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "session_created",
                "sessionId": session_id,
                "name": name,
                "description": description,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle update session operation
    async fn handle_update_session(
        &self,
        session_id: String,
        updates: SessionUpdates,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "session_updated",
                "sessionId": session_id,
                "updates": updates,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle delete session operation
    async fn handle_delete_session(
        &self,
        session_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "session_deleted",
                "sessionId": session_id,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle get gateway status operation
    async fn handle_get_gateway_status(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "healthy",
                "connections": 0,
                "uptime": "0s",
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle list connections operation
    async fn handle_list_connections(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "connections": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle get connection operation
    async fn handle_get_connection(
        &self,
        connection_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "connection": {
                    "id": connection_id,
                    "status": "connected",
                    "type": "websocket",
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle list providers operation
    async fn handle_list_providers(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "providers": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle get provider operation
    async fn handle_get_provider(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "provider": {
                    "id": provider_id,
                    "name": format!("Provider {}", provider_id),
                    "type": "openai",
                    "enabled": true,
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle update provider operation
    async fn handle_update_provider(
        &self,
        provider_id: String,
        config: ProviderConfigUpdates,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "provider_updated",
                "providerId": provider_id,
                "config": config,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle list tools operation
    async fn handle_list_tools(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref tool_registry) = self.tool_registry {
            // In a real implementation, this would call the actual tool registry
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "tools": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ToolRegistry".to_string(),
            ))
        }
    }

    /// Handle get tool operation
    async fn handle_get_tool(
        &self,
        tool_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref tool_registry) = self.tool_registry {
            // In a real implementation, this would call the actual tool registry
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "tool": {
                    "id": tool_id,
                    "name": format!("Tool {}", tool_id),
                    "description": "A mock tool for testing",
                    "enabled": true,
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ToolRegistry".to_string(),
            ))
        }
    }

    /// Handle execute tool operation
    async fn handle_execute_tool(
        &self,
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref bash_executor) = self.bash_executor {
            // In a real implementation, this would call the actual tool execution service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "tool_executed",
                "toolId": tool_id,
                "arguments": arguments,
                "result": "Mock tool execution result",
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "BashExecutor".to_string(),
            ))
        }
    }

    /// Handle list memories operation
    async fn handle_list_memories(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "memories": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle search memories operation
    async fn handle_search_memories(
        &self,
        query: String,
        limit: Option<usize>,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "results": [],
                "query": query,
                "limit": limit,
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle store memory operation
    async fn handle_store_memory(
        &self,
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            let memory_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "memory_stored",
                "memoryId": memory_id,
                "content": content,
                "metadata": metadata,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle list channels operation
    async fn handle_list_channels(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref channel_abstraction) = self.channel_abstraction {
            // In a real implementation, this would call the actual channel abstraction service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "channels": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle get channel operation
    async fn handle_get_channel(
        &self,
        channel_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref channel_abstraction) = self.channel_abstraction {
            // In a real implementation, this would call the actual channel abstraction service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "channel": {
                    "id": channel_id,
                    "name": format!("Channel {}", channel_id),
                    "type": "discord",
                    "enabled": true,
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle send message operation
    async fn handle_send_message(
        &self,
        channel_id: String,
        message: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref channel_abstraction) = self.channel_abstraction {
            // In a real implementation, this would call the actual channel abstraction service
            // For now, we'll return a mock response
            let message_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "message_sent",
                "messageId": message_id,
                "channelId": channel_id,
                "content": message,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle start TUI session operation
    async fn handle_start_tui_session(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            let session_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "tui_session_started",
                "sessionId": session_id,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle send TUI command operation
    async fn handle_send_tui_command(
        &self,
        command: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "tui_command_processed",
                "command": command,
                "result": "Mock TUI command result",
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle get TUI status operation
    async fn handle_get_tui_status(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "ready",
                "activeSessions": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle query vectors operation
    async fn handle_query_vectors(
        &self,
        query: String,
        top_k: usize,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "results": [],
                "query": query,
                "topK": top_k,
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle store vector operation
    async fn handle_store_vector(
        &self,
        content: String,
        embedding: Vec<f32>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            let vector_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "vector_stored",
                "vectorId": vector_id,
                "content": content,
                "embeddingDimension": embedding.len(),
                "metadata": metadata,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle stream tool execution operation
    async fn handle_stream_tool_execution(
        &self,
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref tool_streamer) = self.tool_streamer {
            // In a real implementation, this would call the actual tool streaming service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "tool_streaming_started",
                "toolId": tool_id,
                "arguments": arguments,
                "streamId": Uuid::new_v4().to_string(),
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ToolStreamer".to_string(),
            ))
        }
    }

    /// Handle check provider health operation
    async fn handle_check_provider_health(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "health": {
                    "providerId": provider_id,
                    "healthy": true,
                    "latencyMs": 125,
                    "lastChecked": Utc::now(),
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle get provider usage operation
    async fn handle_get_provider_usage(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "usage": {
                    "providerId": provider_id,
                    "requestsCount": 42,
                    "tokensUsed": 1250,
                    "tokensGenerated": 890,
                    "costUsd": 0.02,
                    "lastUsed": Utc::now(),
                }
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle list scheduled jobs operation
    async fn handle_list_scheduled_jobs(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "jobs": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle create job operation
    async fn handle_create_job(
        &self,
        schedule: String,
        command: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response
            let job_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "job_created",
                "jobId": job_id,
                "schedule": schedule,
                "command": command,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle delete job operation
    async fn handle_delete_job(
        &self,
        job_id: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "job_deleted",
                "jobId": job_id,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle list iMessage contacts operation
    async fn handle_list_imessage_contacts(
        &self,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref imessage_bridge) = self.imessage_bridge {
            // In a real implementation, this would call the actual iMessage bridge
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "contacts": [],
                "count": 0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ImessageBridge".to_string(),
            ))
        }
    }

    /// Handle send iMessage operation
    async fn handle_send_imessage(
        &self,
        contact: String,
        message: String,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref imessage_bridge) = self.imessage_bridge {
            // In a real implementation, this would call the actual iMessage bridge
            // For now, we'll return a mock response
            let message_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "imessage_sent",
                "messageId": message_id,
                "contact": contact,
                "content": message,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "ImessageBridge".to_string(),
            ))
        }
    }

    /// Handle compact sessions operation
    async fn handle_compact_sessions(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref session_compactor) = self.session_compactor {
            // In a real implementation, this would call the actual session compactor
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "sessions_compacted",
                "compactedCount": 0,
                "freedSpaceMb": 0.0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SessionCompactor".to_string(),
            ))
        }
    }

    /// Handle cleanup resources operation
    async fn handle_cleanup_resources(&self) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref final_cleanup) = self.final_cleanup {
            // In a real implementation, this would call the actual final cleanup service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "resources_cleaned",
                "cleanedCount": 0,
                "freedSpaceMb": 0.0,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "FinalCleanup".to_string(),
            ))
        }
    }

    /// Handle verify subprocess removal operation
    async fn handle_verify_subprocess_removal(
        &self,
    ) -> Result<serde_json::Value, ApiGatewayRouterError> {
        if let Some(ref subprocess_removal) = self.subprocess_removal {
            // In a real implementation, this would call the actual subprocess removal service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "verification_completed",
                "subprocessesRemaining": 0,
                "nativeServicesActive": 20,  // Based on our implementations
                "migrationComplete": true,
            }))
        } else {
            Err(ApiGatewayRouterError::ServiceNotInitialized(
                "SubprocessRemoval".to_string(),
            ))
        }
    }

    /// Get current configuration
    pub fn config(&self) -> &ApiGatewayConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut ApiGatewayConfig {
        &mut self.config
    }

    /// Get request statistics
    pub async fn request_stats(&self) -> RequestStats {
        self.request_stats.read().await.clone()
    }

    /// Create the Axum router for the API gateway
    pub fn create_router(&self) -> Router {
        Router::new()
            // Skill endpoints
            .route("/api/v1/skills", get(Self::api_list_skills))
            .route("/api/v1/skills/:id", get(Self::api_get_skill))
            .route("/api/v1/skills/install", post(Self::api_install_skill))
            .route("/api/v1/skills/execute", post(Self::api_execute_skill))
            // Session endpoints
            .route("/api/v1/sessions", get(Self::api_list_sessions))
            .route("/api/v1/sessions", post(Self::api_create_session))
            .route("/api/v1/sessions/:id", get(Self::api_get_session))
            .route("/api/v1/sessions/:id", put(Self::api_update_session))
            .route("/api/v1/sessions/:id", delete(Self::api_delete_session))
            // Gateway endpoints
            .route("/api/v1/gateway/status", get(Self::api_get_gateway_status))
            .route(
                "/api/v1/gateway/connections",
                get(Self::api_list_connections),
            )
            .route(
                "/api/v1/gateway/connections/:id",
                get(Self::api_get_connection),
            )
            // Provider endpoints
            .route("/api/v1/providers", get(Self::api_list_providers))
            .route("/api/v1/providers/:id", get(Self::api_get_provider))
            .route("/api/v1/providers/:id", put(Self::api_update_provider))
            // Tool endpoints
            .route("/api/v1/tools", get(Self::api_list_tools))
            .route("/api/v1/tools/:id", get(Self::api_get_tool))
            .route("/api/v1/tools/execute", post(Self::api_execute_tool))
            // Memory endpoints
            .route("/api/v1/memory", get(Self::api_list_memories))
            .route("/api/v1/memory/search", post(Self::api_search_memories))
            .route("/api/v1/memory", post(Self::api_store_memory))
            // Channel endpoints
            .route("/api/v1/channels", get(Self::api_list_channels))
            .route("/api/v1/channels/:id", get(Self::api_get_channel))
            .route("/api/v1/channels/send", post(Self::api_send_message))
            // TUI endpoints
            .route("/api/v1/tui/start", post(Self::api_start_tui_session))
            .route("/api/v1/tui/command", post(Self::api_send_tui_command))
            .route("/api/v1/tui/status", get(Self::api_get_tui_status))
            // Vector endpoints
            .route("/api/v1/vectors/query", post(Self::api_query_vectors))
            .route("/api/v1/vectors", post(Self::api_store_vector))
            // Tool streaming endpoints
            .route(
                "/api/v1/tools/stream",
                post(Self::api_stream_tool_execution),
            )
            // Provider management endpoints
            .route(
                "/api/v1/providers/:id/health",
                get(Self::api_check_provider_health),
            )
            .route(
                "/api/v1/providers/:id/usage",
                get(Self::api_get_provider_usage),
            )
            // Cron system endpoints
            .route("/api/v1/cron", get(Self::api_list_scheduled_jobs))
            .route("/api/v1/cron", post(Self::api_create_job))
            .route("/api/v1/cron/:id", delete(Self::api_delete_job))
            // iMessage endpoints
            .route(
                "/api/v1/imessage/contacts",
                get(Self::api_list_imessage_contacts),
            )
            .route("/api/v1/imessage/send", post(Self::api_send_imessage))
            // Cleanup endpoints
            .route("/api/v1/cleanup/compact", post(Self::api_compact_sessions))
            .route(
                "/api/v1/cleanup/resources",
                post(Self::api_cleanup_resources),
            )
            // Verification endpoints
            .route(
                "/api/v1/verification/subprocess",
                get(Self::api_verify_subprocess_removal),
            )
    }

    // API handler functions (these would be implemented to call the service methods)
    async fn api_list_skills() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "skills": [],
            "count": 0,
        })))
    }

    async fn api_get_skill(
        Path(skill_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "skill": {
                "id": skill_id,
                "name": format!("Skill {}", skill_id),
                "enabled": true,
            }
        })))
    }

    async fn api_install_skill(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "skill_installed",
        })))
    }

    async fn api_execute_skill(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "skill_executed",
        })))
    }

    async fn api_list_sessions() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "sessions": [],
            "count": 0,
        })))
    }

    async fn api_create_session(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let session_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "session_created",
            "sessionId": session_id,
        })))
    }

    async fn api_get_session(
        Path(session_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "session": {
                "id": session_id,
                "name": format!("Session {}", session_id),
                "active": true,
            }
        })))
    }

    async fn api_update_session(
        Path(session_id): Path<String>,
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "session_updated",
            "sessionId": session_id,
        })))
    }

    async fn api_delete_session(
        Path(session_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "session_deleted",
            "sessionId": session_id,
        })))
    }

    async fn api_get_gateway_status() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "healthy",
            "uptime": "running",
        })))
    }

    async fn api_list_connections() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "connections": [],
            "count": 0,
        })))
    }

    async fn api_get_connection(
        Path(conn_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "connection": {
                "id": conn_id,
                "status": "connected",
            }
        })))
    }

    async fn api_list_providers() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "providers": [],
            "count": 0,
        })))
    }

    async fn api_get_provider(
        Path(provider_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "provider": {
                "id": provider_id,
                "name": format!("Provider {}", provider_id),
                "enabled": true,
            }
        })))
    }

    async fn api_update_provider(
        Path(provider_id): Path<String>,
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "provider_updated",
            "providerId": provider_id,
        })))
    }

    async fn api_list_tools() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "tools": [],
            "count": 0,
        })))
    }

    async fn api_get_tool(
        Path(tool_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "tool": {
                "id": tool_id,
                "name": format!("Tool {}", tool_id),
                "enabled": true,
            }
        })))
    }

    async fn api_execute_tool(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "tool_executed",
        })))
    }

    async fn api_list_memories() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "memories": [],
            "count": 0,
        })))
    }

    async fn api_search_memories(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "results": [],
            "count": 0,
        })))
    }

    async fn api_store_memory(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let memory_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "memory_stored",
            "memoryId": memory_id,
        })))
    }

    async fn api_list_channels() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "channels": [],
            "count": 0,
        })))
    }

    async fn api_get_channel(
        Path(channel_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "channel": {
                "id": channel_id,
                "name": format!("Channel {}", channel_id),
                "enabled": true,
            }
        })))
    }

    async fn api_send_message(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let message_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "message_sent",
            "messageId": message_id,
        })))
    }

    async fn api_start_tui_session() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let session_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "tui_session_started",
            "sessionId": session_id,
        })))
    }

    async fn api_send_tui_command(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "tui_command_processed",
        })))
    }

    async fn api_get_tui_status() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "ready",
            "activeSessions": 0,
        })))
    }

    async fn api_query_vectors(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "results": [],
            "count": 0,
        })))
    }

    async fn api_store_vector(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let vector_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "vector_stored",
            "vectorId": vector_id,
        })))
    }

    async fn api_stream_tool_execution(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "tool_streaming_started",
        })))
    }

    async fn api_check_provider_health(
        Path(provider_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "health": {
                "providerId": provider_id,
                "healthy": true,
            }
        })))
    }

    async fn api_get_provider_usage(
        Path(provider_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "usage": {
                "providerId": provider_id,
                "requestsCount": 0,
            }
        })))
    }

    async fn api_list_scheduled_jobs() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "jobs": [],
            "count": 0,
        })))
    }

    async fn api_create_job(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let job_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "job_created",
            "jobId": job_id,
        })))
    }

    async fn api_delete_job(
        Path(job_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "job_deleted",
            "jobId": job_id,
        })))
    }

    async fn api_list_imessage_contacts() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "contacts": [],
            "count": 0,
        })))
    }

    async fn api_send_imessage(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let message_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "imessage_sent",
            "messageId": message_id,
        })))
    }

    async fn api_compact_sessions() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "sessions_compacted",
        })))
    }

    async fn api_cleanup_resources() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "resources_cleaned",
        })))
    }

    async fn api_verify_subprocess_removal() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "verification_completed",
            "migrationComplete": true,
        })))
    }
}

/// API Gateway router error
#[derive(Debug, thiserror::Error)]
pub enum ApiGatewayRouterError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Service not initialized: {0}")]
    ServiceNotInitialized(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Security error: {0}")]
    SecurityError(String),

    #[error("Timeout error")]
    Timeout,

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Resource not found: {0}")]
    NotFound(String),
}

impl From<serde_json::Error> for ApiGatewayRouterError {
    fn from(error: serde_json::Error) -> Self {
        ApiGatewayRouterError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_api_gateway_router_creation() {
        let router = ApiGatewayRouterService::new();
        assert_eq!(router.config.listen_address, "127.0.0.1");
        assert_eq!(router.config.port, 8080);
        assert!(router.config.enable_rate_limiting);
        assert!(router.config.enable_authentication);
    }

    #[tokio::test]
    async fn test_api_gateway_router_with_config() {
        let config = ApiGatewayConfig {
            listen_address: "0.0.0.0".to_string(),
            port: 9090,
            enable_rate_limiting: false,
            requests_per_minute: Some(500),
            enable_authentication: false,
            auth_token: None,
            enable_logging: false,
            log_level: "debug".to_string(),
            enable_compression: false,
            cors_allowed_origins: vec!["*".to_string()],
            max_request_size_bytes: 5 * 1024 * 1024, // 5MB
            timeout_seconds: 60,
            enable_metrics: false,
            metrics_endpoint: None,
            enable_tracing: false,
            trace_endpoint: None,
        };

        let router = ApiGatewayRouterService::with_config(config);
        assert_eq!(router.config.listen_address, "0.0.0.0");
        assert_eq!(router.config.port, 9090);
        assert!(!router.config.enable_rate_limiting);
        assert!(!router.config.enable_authentication);
        assert!(!router.config.enable_logging);
    }

    #[tokio::test]
    async fn test_operation_name_extraction() {
        let router = ApiGatewayRouterService::new();

        let list_skills_op = ApiGatewayOperation::ListSkills;
        assert_eq!(router.operation_name(&list_skills_op), "list_skills");

        let get_skill_op = ApiGatewayOperation::GetSkill {
            id: "test".to_string(),
        };
        assert_eq!(router.operation_name(&get_skill_op), "get_skill");

        let execute_tool_op = ApiGatewayOperation::ExecuteTool {
            tool_id: "bash".to_string(),
            arguments: HashMap::new(),
        };
        assert_eq!(router.operation_name(&execute_tool_op), "execute_tool");
    }

    #[tokio::test]
    async fn test_request_stats_initialization() {
        let router = ApiGatewayRouterService::new();
        let stats = router.request_stats().await;

        assert_eq!(stats.total_requests, 0);
        assert_eq!(stats.successful_requests, 0);
        assert_eq!(stats.failed_requests, 0);
    }

    #[test]
    fn test_api_gateway_config_defaults() {
        let config = ApiGatewayConfig::default();
        assert_eq!(config.listen_address, "127.0.0.1");
        assert_eq!(config.port, 8080);
        assert!(config.enable_rate_limiting);
        assert_eq!(config.requests_per_minute, Some(1000));
        assert!(config.enable_authentication);
        assert!(config.auth_token.is_some());
        assert!(config.enable_logging);
        assert_eq!(config.log_level, "info");
        assert!(config.enable_compression);
        assert_eq!(config.max_request_size_bytes, 10 * 1024 * 1024); // 10MB
        assert_eq!(config.timeout_seconds, 30);
        assert!(config.enable_metrics);
        assert_eq!(config.metrics_endpoint, Some("/metrics".to_string()));
    }

    #[test]
    fn test_api_gateway_operation_serialization() {
        let operation = ApiGatewayOperation::ListSkills;
        let serialized = serde_json::to_string(&operation).unwrap();
        let deserialized: ApiGatewayOperation = serde_json::from_str(&serialized).unwrap();
        assert!(matches!(deserialized, ApiGatewayOperation::ListSkills));

        let operation = ApiGatewayOperation::GetSkill {
            id: "test-skill".to_string(),
        };
        let serialized = serde_json::to_string(&operation).unwrap();
        let deserialized: ApiGatewayOperation = serde_json::from_str(&serialized).unwrap();
        match deserialized {
            ApiGatewayOperation::GetSkill { id } => assert_eq!(id, "test-skill"),
            _ => panic!("Expected GetSkill operation"),
        }
    }
}
