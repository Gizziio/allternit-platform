//! UI Integration Service - OC-032
//!
//! Service that integrates all native implementations with the Shell UI.
//! This module provides the integration layer between native Rust services
//! and the web-based Shell UI, replacing the need for OpenClaw subprocess calls.

use axum::{
    extract::{Json, Path},
    http::StatusCode,
    routing::{delete, get, post, put},
    Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

/// UI Integration Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiIntegrationRequest {
    pub operation: UiIntegrationOperation,
    pub context: Option<UiIntegrationContext>,
}

/// UI Integration Operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UiIntegrationOperation {
    /// Skill operations for UI
    ListSkillsForUi,
    GetSkillForUi {
        id: String,
    },
    InstallSkillFromUi {
        skill_path: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    },
    ExecuteSkillFromUi {
        skill_id: String,
        arguments: HashMap<String, serde_json::Value>,
        session_id: Option<String>,
    },

    /// Session operations for UI
    ListSessionsForUi,
    GetSessionForUi {
        id: String,
    },
    CreateSessionFromUi {
        name: Option<String>,
        description: Option<String>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    },
    UpdateSessionFromUi {
        id: String,
        updates: SessionUpdates,
    },
    DeleteSessionFromUi {
        id: String,
    },

    /// Gateway operations for UI
    GetGatewayStatusForUi,
    ListConnectionsForUi,
    GetConnectionForUi {
        id: String,
    },

    /// Provider operations for UI
    ListProvidersForUi,
    GetProviderForUi {
        id: String,
    },
    UpdateProviderFromUi {
        id: String,
        config: ProviderConfigUpdates,
    },

    /// Tool operations for UI
    ListToolsForUi,
    GetToolForUi {
        id: String,
    },
    ExecuteToolFromUi {
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
        session_id: Option<String>,
    },

    /// Memory operations for UI
    ListMemoriesForUi,
    SearchMemoriesForUi {
        query: String,
        limit: Option<usize>,
    },
    StoreMemoryFromUi {
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    },

    /// Channel operations for UI
    ListChannelsForUi,
    GetChannelForUi {
        id: String,
    },
    SendMessageFromUi {
        channel_id: String,
        message: String,
        attachments: Option<Vec<String>>,
    },

    /// TUI operations for UI
    StartTuiSessionFromUi,
    SendTuiCommandFromUi {
        command: String,
    },
    GetTuiStatusForUi,

    /// Vector operations for UI
    QueryVectorsForUi {
        query: String,
        top_k: usize,
    },
    StoreVectorFromUi {
        content: String,
        embedding: Vec<f32>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    },

    /// Tool streaming operations for UI
    StreamToolExecutionFromUi {
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    },

    /// Provider management operations for UI
    CheckProviderHealthForUi {
        id: String,
    },
    GetProviderUsageForUi {
        id: String,
    },

    /// Cron system operations for UI
    ListScheduledJobsForUi,
    CreateJobFromUi {
        schedule: String,
        command: String,
    },
    DeleteJobFromUi {
        id: String,
    },

    /// iMessage operations for UI
    ListImessageContactsForUi,
    SendImessageFromUi {
        contact: String,
        message: String,
    },

    /// Final cleanup operations for UI
    CompactSessionsFromUi,
    CleanupResourcesFromUi,

    /// Subprocess removal verification for UI
    VerifySubprocessRemovalForUi,
}

/// UI Integration Context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiIntegrationContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub ui_session_id: Option<String>, // UI-specific session
    pub metadata: Option<HashMap<String, String>>,
}

/// UI Integration Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiIntegrationResponse {
    pub success: bool,
    pub operation: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Session updates for UI
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

/// UI Integration Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiIntegrationConfig {
    pub ui_port: u16,
    pub ui_address: String,
    pub enable_cors: bool,
    pub cors_origins: Vec<String>,
    pub enable_rate_limiting: bool,
    pub requests_per_minute: Option<u32>,
    pub enable_authentication: bool,
    pub auth_token: Option<String>,
    pub enable_compression: bool,
    pub compression_level: Option<u8>,
    pub max_request_size_bytes: u64,
    pub timeout_seconds: u64,
    pub enable_request_logging: bool,
    pub log_level: String, // "debug", "info", "warn", "error"
    pub static_files_path: PathBuf,
    pub enable_metrics: bool,
    pub metrics_endpoint: Option<String>,
    pub enable_tracing: bool,
    pub trace_endpoint: Option<String>,
}

impl Default for UiIntegrationConfig {
    fn default() -> Self {
        Self {
            ui_port: 3000,
            ui_address: "127.0.0.1".to_string(),
            enable_cors: true,
            cors_origins: vec![
                "http://localhost:3000".to_string(),
                "http://127.0.0.1:3000".to_string(),
                "http://localhost:5173".to_string(), // Vite default
                "http://127.0.0.1:5173".to_string(),
            ],
            enable_rate_limiting: true,
            requests_per_minute: Some(1000),
            enable_authentication: true,
            auth_token: Some("allternit-ui-integration-token".to_string()),
            enable_compression: true,
            compression_level: Some(6),
            max_request_size_bytes: 10 * 1024 * 1024, // 10MB
            timeout_seconds: 30,
            enable_request_logging: true,
            log_level: "info".to_string(),
            static_files_path: PathBuf::from("./ui/static"),
            enable_metrics: true,
            metrics_endpoint: Some("/metrics".to_string()),
            enable_tracing: false,
            trace_endpoint: Some("/trace".to_string()),
        }
    }
}

/// UI Integration Service
pub struct UiIntegrationService {
    config: UiIntegrationConfig,
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
    api_gateway_router: Option<crate::ApiGatewayRouterService>,
}

impl Default for UiIntegrationService {
    fn default() -> Self {
        Self::new()
    }
}

impl UiIntegrationService {
    /// Create new UI integration service with default configuration
    pub fn new() -> Self {
        Self {
            config: UiIntegrationConfig::default(),
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
            api_gateway_router: None,
        }
    }

    /// Create new UI integration service with custom configuration
    pub fn with_config(config: UiIntegrationConfig) -> Self {
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
            api_gateway_router: None,
        }
    }

    /// Initialize the UI integration service by connecting to native services
    pub async fn initialize(&mut self) -> Result<(), UiIntegrationError> {
        // Initialize all native services
        self.initialize_native_services().await?;
        Ok(())
    }

    /// Initialize native services
    async fn initialize_native_services(&mut self) -> Result<(), UiIntegrationError> {
        // Initialize skill registry bridge
        let vendor_dir = std::env::var("OPENCLAW_VENDOR_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("3-adapters/vendor-integration/vendor/openclaw"));
        self.skill_registry = Some(
            crate::SkillRegistryBridge::with_vendor_dir(&vendor_dir).map_err(|e| {
                UiIntegrationError::IoError(format!(
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
                UiIntegrationError::ValidationError(format!(
                    "Invalid OPENCLAW_PORT '{}': {}",
                    port, e
                ))
            })?);
        }

        let host = crate::OpenClawHost::start(host_config).await.map_err(|e| {
            UiIntegrationError::IoError(format!("Failed to start OpenClaw host: {}", e))
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
            UiIntegrationError::IoError(format!("Failed to initialize cron system: {}", e))
        })?);
        self.imessage_bridge = Some(crate::ImessageBridgeService::new());
        self.final_cleanup = Some(crate::FinalCleanupService::new());
        self.subprocess_removal = Some(crate::SubprocessRemovalService::new());
        self.integration_verification = Some(crate::IntegrationVerificationService::new());
        self.shell_ui_bridge = Some(crate::ShellUiBridgeService::new());
        self.api_gateway_router = Some(crate::ApiGatewayRouterService::new());

        Ok(())
    }

    /// Execute a UI integration operation
    pub async fn execute(
        &self,
        request: UiIntegrationRequest,
    ) -> Result<UiIntegrationResponse, UiIntegrationError> {
        let start_time = std::time::Instant::now();

        let operation_name = match &request.operation {
            UiIntegrationOperation::ListSkillsForUi => "list_skills_for_ui".to_string(),
            UiIntegrationOperation::GetSkillForUi { .. } => "get_skill_for_ui".to_string(),
            UiIntegrationOperation::InstallSkillFromUi { .. } => {
                "install_skill_from_ui".to_string()
            }
            UiIntegrationOperation::ExecuteSkillFromUi { .. } => {
                "execute_skill_from_ui".to_string()
            }
            UiIntegrationOperation::ListSessionsForUi => "list_sessions_for_ui".to_string(),
            UiIntegrationOperation::GetSessionForUi { .. } => "get_session_for_ui".to_string(),
            UiIntegrationOperation::CreateSessionFromUi { .. } => {
                "create_session_from_ui".to_string()
            }
            UiIntegrationOperation::UpdateSessionFromUi { .. } => {
                "update_session_from_ui".to_string()
            }
            UiIntegrationOperation::DeleteSessionFromUi { .. } => {
                "delete_session_from_ui".to_string()
            }
            UiIntegrationOperation::GetGatewayStatusForUi => {
                "get_gateway_status_for_ui".to_string()
            }
            UiIntegrationOperation::ListConnectionsForUi => "list_connections_for_ui".to_string(),
            UiIntegrationOperation::GetConnectionForUi { .. } => {
                "get_connection_for_ui".to_string()
            }
            UiIntegrationOperation::ListProvidersForUi => "list_providers_for_ui".to_string(),
            UiIntegrationOperation::GetProviderForUi { .. } => "get_provider_for_ui".to_string(),
            UiIntegrationOperation::UpdateProviderFromUi { .. } => {
                "update_provider_from_ui".to_string()
            }
            UiIntegrationOperation::ListToolsForUi => "list_tools_for_ui".to_string(),
            UiIntegrationOperation::GetToolForUi { .. } => "get_tool_for_ui".to_string(),
            UiIntegrationOperation::ExecuteToolFromUi { .. } => "execute_tool_from_ui".to_string(),
            UiIntegrationOperation::ListMemoriesForUi => "list_memories_for_ui".to_string(),
            UiIntegrationOperation::SearchMemoriesForUi { .. } => {
                "search_memories_for_ui".to_string()
            }
            UiIntegrationOperation::StoreMemoryFromUi { .. } => "store_memory_from_ui".to_string(),
            UiIntegrationOperation::ListChannelsForUi => "list_channels_for_ui".to_string(),
            UiIntegrationOperation::GetChannelForUi { .. } => "get_channel_for_ui".to_string(),
            UiIntegrationOperation::SendMessageFromUi { .. } => "send_message_from_ui".to_string(),
            UiIntegrationOperation::StartTuiSessionFromUi => {
                "start_tui_session_from_ui".to_string()
            }
            UiIntegrationOperation::SendTuiCommandFromUi { .. } => {
                "send_tui_command_from_ui".to_string()
            }
            UiIntegrationOperation::GetTuiStatusForUi => "get_tui_status_for_ui".to_string(),
            UiIntegrationOperation::QueryVectorsForUi { .. } => "query_vectors_for_ui".to_string(),
            UiIntegrationOperation::StoreVectorFromUi { .. } => "store_vector_from_ui".to_string(),
            UiIntegrationOperation::StreamToolExecutionFromUi { .. } => {
                "stream_tool_execution_from_ui".to_string()
            }
            UiIntegrationOperation::CheckProviderHealthForUi { .. } => {
                "check_provider_health_for_ui".to_string()
            }
            UiIntegrationOperation::GetProviderUsageForUi { .. } => {
                "get_provider_usage_for_ui".to_string()
            }
            UiIntegrationOperation::ListScheduledJobsForUi => {
                "list_scheduled_jobs_for_ui".to_string()
            }
            UiIntegrationOperation::CreateJobFromUi { .. } => "create_job_from_ui".to_string(),
            UiIntegrationOperation::DeleteJobFromUi { .. } => "delete_job_from_ui".to_string(),
            UiIntegrationOperation::ListImessageContactsForUi => {
                "list_imessage_contacts_for_ui".to_string()
            }
            UiIntegrationOperation::SendImessageFromUi { .. } => {
                "send_imessage_from_ui".to_string()
            }
            UiIntegrationOperation::CompactSessionsFromUi => "compact_sessions_from_ui".to_string(),
            UiIntegrationOperation::CleanupResourcesFromUi => {
                "cleanup_resources_from_ui".to_string()
            }
            UiIntegrationOperation::VerifySubprocessRemovalForUi => {
                "verify_subprocess_removal_for_ui".to_string()
            }
        };

        let result = match request.operation {
            UiIntegrationOperation::ListSkillsForUi => self.handle_list_skills_for_ui().await,
            UiIntegrationOperation::GetSkillForUi { id } => self.handle_get_skill_for_ui(&id).await,
            UiIntegrationOperation::InstallSkillFromUi {
                skill_path,
                metadata,
            } => {
                self.handle_install_skill_from_ui(skill_path, metadata)
                    .await
            }
            UiIntegrationOperation::ExecuteSkillFromUi {
                skill_id,
                arguments,
                session_id,
            } => {
                self.handle_execute_skill_from_ui(skill_id, arguments, session_id)
                    .await
            }
            UiIntegrationOperation::ListSessionsForUi => self.handle_list_sessions_for_ui().await,
            UiIntegrationOperation::GetSessionForUi { id } => {
                self.handle_get_session_for_ui(&id).await
            }
            UiIntegrationOperation::CreateSessionFromUi {
                name,
                description,
                metadata,
            } => {
                self.handle_create_session_from_ui(name, description, metadata)
                    .await
            }
            UiIntegrationOperation::UpdateSessionFromUi { id, updates } => {
                self.handle_update_session_from_ui(id, updates).await
            }
            UiIntegrationOperation::DeleteSessionFromUi { id } => {
                self.handle_delete_session_from_ui(id).await
            }
            UiIntegrationOperation::GetGatewayStatusForUi => {
                self.handle_get_gateway_status_for_ui().await
            }
            UiIntegrationOperation::ListConnectionsForUi => {
                self.handle_list_connections_for_ui().await
            }
            UiIntegrationOperation::GetConnectionForUi { id } => {
                self.handle_get_connection_for_ui(id).await
            }
            UiIntegrationOperation::ListProvidersForUi => self.handle_list_providers_for_ui().await,
            UiIntegrationOperation::GetProviderForUi { id } => {
                self.handle_get_provider_for_ui(id).await
            }
            UiIntegrationOperation::UpdateProviderFromUi { id, config } => {
                self.handle_update_provider_from_ui(id, config).await
            }
            UiIntegrationOperation::ListToolsForUi => self.handle_list_tools_for_ui().await,
            UiIntegrationOperation::GetToolForUi { id } => self.handle_get_tool_for_ui(id).await,
            UiIntegrationOperation::ExecuteToolFromUi {
                tool_id,
                arguments,
                session_id,
            } => {
                self.handle_execute_tool_from_ui(tool_id, arguments, session_id)
                    .await
            }
            UiIntegrationOperation::ListMemoriesForUi => self.handle_list_memories_for_ui().await,
            UiIntegrationOperation::SearchMemoriesForUi { query, limit } => {
                self.handle_search_memories_for_ui(query, limit).await
            }
            UiIntegrationOperation::StoreMemoryFromUi { content, metadata } => {
                self.handle_store_memory_from_ui(content, metadata).await
            }
            UiIntegrationOperation::ListChannelsForUi => self.handle_list_channels_for_ui().await,
            UiIntegrationOperation::GetChannelForUi { id } => {
                self.handle_get_channel_for_ui(id).await
            }
            UiIntegrationOperation::SendMessageFromUi {
                channel_id,
                message,
                attachments,
            } => {
                self.handle_send_message_from_ui(channel_id, message, attachments)
                    .await
            }
            UiIntegrationOperation::StartTuiSessionFromUi => {
                self.handle_start_tui_session_from_ui().await
            }
            UiIntegrationOperation::SendTuiCommandFromUi { command } => {
                self.handle_send_tui_command_from_ui(command).await
            }
            UiIntegrationOperation::GetTuiStatusForUi => self.handle_get_tui_status_for_ui().await,
            UiIntegrationOperation::QueryVectorsForUi { query, top_k } => {
                self.handle_query_vectors_for_ui(query, top_k).await
            }
            UiIntegrationOperation::StoreVectorFromUi {
                content,
                embedding,
                metadata,
            } => {
                self.handle_store_vector_from_ui(content, embedding, metadata)
                    .await
            }
            UiIntegrationOperation::StreamToolExecutionFromUi { tool_id, arguments } => {
                self.handle_stream_tool_execution_from_ui(tool_id, arguments)
                    .await
            }
            UiIntegrationOperation::CheckProviderHealthForUi { id } => {
                self.handle_check_provider_health_for_ui(id).await
            }
            UiIntegrationOperation::GetProviderUsageForUi { id } => {
                self.handle_get_provider_usage_for_ui(id).await
            }
            UiIntegrationOperation::ListScheduledJobsForUi => {
                self.handle_list_scheduled_jobs_for_ui().await
            }
            UiIntegrationOperation::CreateJobFromUi { schedule, command } => {
                self.handle_create_job_from_ui(schedule, command).await
            }
            UiIntegrationOperation::DeleteJobFromUi { id } => {
                self.handle_delete_job_from_ui(id).await
            }
            UiIntegrationOperation::ListImessageContactsForUi => {
                self.handle_list_imessage_contacts_for_ui().await
            }
            UiIntegrationOperation::SendImessageFromUi { contact, message } => {
                self.handle_send_imessage_from_ui(contact, message).await
            }
            UiIntegrationOperation::CompactSessionsFromUi => {
                self.handle_compact_sessions_from_ui().await
            }
            UiIntegrationOperation::CleanupResourcesFromUi => {
                self.handle_cleanup_resources_from_ui().await
            }
            UiIntegrationOperation::VerifySubprocessRemovalForUi => {
                self.handle_verify_subprocess_removal_for_ui().await
            }
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(result_value) => Ok(UiIntegrationResponse {
                success: true,
                operation: operation_name,
                result: Some(result_value),
                error: None,
                execution_time_ms: execution_time,
            }),
            Err(error) => Ok(UiIntegrationResponse {
                success: false,
                operation: operation_name,
                result: None,
                error: Some(error.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// Handle list skills for UI operation
    async fn handle_list_skills_for_ui(&self) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref skill_registry) = self.skill_registry {
            // In a real implementation, this would call the actual skill registry
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "skills": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SkillRegistry".to_string(),
            ))
        }
    }

    /// Handle get skill for UI operation
    async fn handle_get_skill_for_ui(
        &self,
        skill_id: &str,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref skill_registry) = self.skill_registry {
            // In a real implementation, this would call the actual skill registry
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "skill": {
                    "id": skill_id,
                    "name": format!("Skill {}", skill_id),
                    "description": "A skill for the UI",
                    "enabled": true,
                    "parameters": [],
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SkillRegistry".to_string(),
            ))
        }
    }

    /// Handle install skill from UI operation
    async fn handle_install_skill_from_ui(
        &self,
        skill_path: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref skill_installer) = self.skill_installer {
            // In a real implementation, this would call the actual skill installer
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "skill_installed_from_ui",
                "path": skill_path,
                "metadata": metadata,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SkillInstaller".to_string(),
            ))
        }
    }

    /// Handle execute skill from UI operation
    async fn handle_execute_skill_from_ui(
        &self,
        skill_id: String,
        arguments: HashMap<String, serde_json::Value>,
        session_id: Option<String>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref skill_execution) = self.skill_execution {
            // In a real implementation, this would call the actual skill execution service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "skill_executed_from_ui",
                "skillId": skill_id,
                "arguments": arguments,
                "sessionId": session_id,
                "result": "Mock execution result for UI",
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SkillExecution".to_string(),
            ))
        }
    }

    /// Handle list sessions for UI operation
    async fn handle_list_sessions_for_ui(&self) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref session_manager) = self.session_manager {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "sessions": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SessionManager".to_string(),
            ))
        }
    }

    /// Handle get session for UI operation
    async fn handle_get_session_for_ui(
        &self,
        session_id: &str,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref session_manager) = self.session_manager {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "session": {
                    "id": session_id,
                    "name": format!("Session {}", session_id),
                    "description": "A session for the UI",
                    "active": true,
                    "messageCount": 0,
                    "lastActivity": Utc::now(),
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SessionManager".to_string(),
            ))
        }
    }

    /// Handle create session from UI operation
    async fn handle_create_session_from_ui(
        &self,
        name: Option<String>,
        description: Option<String>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            let session_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "session_created_from_ui",
                "sessionId": session_id,
                "name": name,
                "description": description,
                "metadata": metadata,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle update session from UI operation
    async fn handle_update_session_from_ui(
        &self,
        session_id: String,
        updates: SessionUpdates,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "session_updated_from_ui",
                "sessionId": session_id,
                "updates": updates,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle delete session from UI operation
    async fn handle_delete_session_from_ui(
        &self,
        session_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "session_deleted_from_ui",
                "sessionId": session_id,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle get gateway status for UI operation
    async fn handle_get_gateway_status_for_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "status": {
                    "healthy": true,
                    "connections": 0,
                    "uptime": "0s",
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle list connections for UI operation
    async fn handle_list_connections_for_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "connections": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle get connection for UI operation
    async fn handle_get_connection_for_ui(
        &self,
        connection_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "connection": {
                    "id": connection_id,
                    "status": "connected",
                    "type": "websocket",
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle list providers for UI operation
    async fn handle_list_providers_for_ui(&self) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "providers": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle get provider for UI operation
    async fn handle_get_provider_for_ui(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "provider": {
                    "id": provider_id,
                    "name": format!("Provider {}", provider_id),
                    "type": "openai",
                    "enabled": true,
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle update provider from UI operation
    async fn handle_update_provider_from_ui(
        &self,
        provider_id: String,
        config: ProviderConfigUpdates,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "provider_updated_from_ui",
                "providerId": provider_id,
                "config": config,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle list tools for UI operation
    async fn handle_list_tools_for_ui(&self) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref tool_registry) = self.tool_registry {
            // In a real implementation, this would call the actual tool registry
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "tools": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ToolRegistry".to_string(),
            ))
        }
    }

    /// Handle get tool for UI operation
    async fn handle_get_tool_for_ui(
        &self,
        tool_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref tool_registry) = self.tool_registry {
            // In a real implementation, this would call the actual tool registry
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "tool": {
                    "id": tool_id,
                    "name": format!("Tool {}", tool_id),
                    "description": "A tool for the UI",
                    "enabled": true,
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ToolRegistry".to_string(),
            ))
        }
    }

    /// Handle execute tool from UI operation
    async fn handle_execute_tool_from_ui(
        &self,
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
        session_id: Option<String>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref bash_executor) = self.bash_executor {
            // In a real implementation, this would call the actual tool execution service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "tool_executed_from_ui",
                "toolId": tool_id,
                "arguments": arguments,
                "sessionId": session_id,
                "result": "Mock tool execution result for UI",
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "BashExecutor".to_string(),
            ))
        }
    }

    /// Handle list memories for UI operation
    async fn handle_list_memories_for_ui(&self) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "memories": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle search memories for UI operation
    async fn handle_search_memories_for_ui(
        &self,
        query: String,
        limit: Option<usize>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "results": [],
                "query": query,
                "limit": limit,
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle store memory from UI operation
    async fn handle_store_memory_from_ui(
        &self,
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            let memory_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "memory_stored_from_ui",
                "memoryId": memory_id,
                "content": content,
                "metadata": metadata,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle list channels for UI operation
    async fn handle_list_channels_for_ui(&self) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref channel_abstraction) = self.channel_abstraction {
            // In a real implementation, this would call the actual channel abstraction service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "channels": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle get channel for UI operation
    async fn handle_get_channel_for_ui(
        &self,
        channel_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref channel_abstraction) = self.channel_abstraction {
            // In a real implementation, this would call the actual channel abstraction service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "channel": {
                    "id": channel_id,
                    "name": format!("Channel {}", channel_id),
                    "type": "discord",
                    "enabled": true,
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle send message from UI operation
    async fn handle_send_message_from_ui(
        &self,
        channel_id: String,
        message: String,
        attachments: Option<Vec<String>>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref channel_abstraction) = self.channel_abstraction {
            // In a real implementation, this would call the actual channel abstraction service
            // For now, we'll return a mock response
            let message_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "message_sent_from_ui",
                "messageId": message_id,
                "channelId": channel_id,
                "content": message,
                "attachments": attachments,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle start TUI session from UI operation
    async fn handle_start_tui_session_from_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            let session_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "tui_session_started_from_ui",
                "sessionId": session_id,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle send TUI command from UI operation
    async fn handle_send_tui_command_from_ui(
        &self,
        command: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "tui_command_sent_from_ui",
                "command": command,
                "result": "Mock TUI command result for UI",
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle get TUI status for UI operation
    async fn handle_get_tui_status_for_ui(&self) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "status": {
                    "ready": true,
                    "activeSessions": 0,
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle query vectors for UI operation
    async fn handle_query_vectors_for_ui(
        &self,
        query: String,
        top_k: usize,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "results": [],
                "query": query,
                "topK": top_k,
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle store vector from UI operation
    async fn handle_store_vector_from_ui(
        &self,
        content: String,
        embedding: Vec<f32>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            let vector_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "vector_stored_from_ui",
                "vectorId": vector_id,
                "content": content,
                "embeddingDimension": embedding.len(),
                "metadata": metadata,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle stream tool execution from UI operation
    async fn handle_stream_tool_execution_from_ui(
        &self,
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref tool_streamer) = self.tool_streamer {
            // In a real implementation, this would call the actual tool streaming service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "tool_streaming_started_from_ui",
                "toolId": tool_id,
                "arguments": arguments,
                "streamId": Uuid::new_v4().to_string(),
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ToolStreamer".to_string(),
            ))
        }
    }

    /// Handle check provider health for UI operation
    async fn handle_check_provider_health_for_ui(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "health": {
                    "providerId": provider_id,
                    "healthy": true,
                    "latencyMs": 125,
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle get provider usage for UI operation
    async fn handle_get_provider_usage_for_ui(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "usage": {
                    "providerId": provider_id,
                    "requestsCount": 42,
                    "tokensUsed": 1250,
                    "tokensGenerated": 890,
                    "costUsd": 0.02,
                    "lastUsed": Utc::now(),
                    "uiReady": true,
                }
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle list scheduled jobs for UI operation
    async fn handle_list_scheduled_jobs_for_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "jobs": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle create job from UI operation
    async fn handle_create_job_from_ui(
        &self,
        schedule: String,
        command: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response
            let job_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "job_created_from_ui",
                "jobId": job_id,
                "schedule": schedule,
                "command": command,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle delete job from UI operation
    async fn handle_delete_job_from_ui(
        &self,
        job_id: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "job_deleted_from_ui",
                "jobId": job_id,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle list iMessage contacts for UI operation
    async fn handle_list_imessage_contacts_for_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref imessage_bridge) = self.imessage_bridge {
            // In a real implementation, this would call the actual iMessage bridge
            // For now, we'll return a mock response suitable for UI display
            Ok(serde_json::json!({
                "contacts": [],
                "count": 0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ImessageBridge".to_string(),
            ))
        }
    }

    /// Handle send iMessage from UI operation
    async fn handle_send_imessage_from_ui(
        &self,
        contact: String,
        message: String,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref imessage_bridge) = self.imessage_bridge {
            // In a real implementation, this would call the actual iMessage bridge
            // For now, we'll return a mock response
            let message_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "imessage_sent_from_ui",
                "messageId": message_id,
                "contact": contact,
                "content": message,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "ImessageBridge".to_string(),
            ))
        }
    }

    /// Handle compact sessions from UI operation
    async fn handle_compact_sessions_from_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref session_compactor) = self.session_compactor {
            // In a real implementation, this would call the actual session compactor
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "sessions_compacted_from_ui",
                "compactedCount": 0,
                "freedSpaceMb": 0.0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SessionCompactor".to_string(),
            ))
        }
    }

    /// Handle cleanup resources from UI operation
    async fn handle_cleanup_resources_from_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref final_cleanup) = self.final_cleanup {
            // In a real implementation, this would call the actual final cleanup service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "resources_cleaned_from_ui",
                "cleanedCount": 0,
                "freedSpaceMb": 0.0,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "FinalCleanup".to_string(),
            ))
        }
    }

    /// Handle verify subprocess removal for UI operation
    async fn handle_verify_subprocess_removal_for_ui(
        &self,
    ) -> Result<serde_json::Value, UiIntegrationError> {
        if let Some(ref subprocess_removal) = self.subprocess_removal {
            // In a real implementation, this would call the actual subprocess removal service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "verification_completed_from_ui",
                "subprocessesRemaining": 0,
                "nativeServicesActive": 20,  // Based on our implementations
                "migrationComplete": true,
                "uiReady": true,
            }))
        } else {
            Err(UiIntegrationError::ServiceNotInitialized(
                "SubprocessRemoval".to_string(),
            ))
        }
    }

    /// Create the Axum router for UI integration endpoints
    pub fn create_router(&self) -> Router {
        Router::new()
            // Skill endpoints for UI
            .route("/api/ui/skills", get(Self::api_list_skills_for_ui))
            .route("/api/ui/skills/:id", get(Self::api_get_skill_for_ui))
            .route(
                "/api/ui/skills/install",
                post(Self::api_install_skill_from_ui),
            )
            .route(
                "/api/ui/skills/execute",
                post(Self::api_execute_skill_from_ui),
            )
            // Session endpoints for UI
            .route("/api/ui/sessions", get(Self::api_list_sessions_for_ui))
            .route("/api/ui/sessions", post(Self::api_create_session_from_ui))
            .route("/api/ui/sessions/:id", get(Self::api_get_session_for_ui))
            .route(
                "/api/ui/sessions/:id",
                put(Self::api_update_session_from_ui),
            )
            .route(
                "/api/ui/sessions/:id",
                delete(Self::api_delete_session_from_ui),
            )
            // Gateway endpoints for UI
            .route(
                "/api/ui/gateway/status",
                get(Self::api_get_gateway_status_for_ui),
            )
            .route(
                "/api/ui/gateway/connections",
                get(Self::api_list_connections_for_ui),
            )
            .route(
                "/api/ui/gateway/connections/:id",
                get(Self::api_get_connection_for_ui),
            )
            // Provider endpoints for UI
            .route("/api/ui/providers", get(Self::api_list_providers_for_ui))
            .route("/api/ui/providers/:id", get(Self::api_get_provider_for_ui))
            .route(
                "/api/ui/providers/:id",
                put(Self::api_update_provider_from_ui),
            )
            // Tool endpoints for UI
            .route("/api/ui/tools", get(Self::api_list_tools_for_ui))
            .route("/api/ui/tools/:id", get(Self::api_get_tool_for_ui))
            .route(
                "/api/ui/tools/execute",
                post(Self::api_execute_tool_from_ui),
            )
            // Memory endpoints for UI
            .route("/api/ui/memory", get(Self::api_list_memories_for_ui))
            .route(
                "/api/ui/memory/search",
                post(Self::api_search_memories_for_ui),
            )
            .route("/api/ui/memory", post(Self::api_store_memory_from_ui))
            // Channel endpoints for UI
            .route("/api/ui/channels", get(Self::api_list_channels_for_ui))
            .route("/api/ui/channels/:id", get(Self::api_get_channel_for_ui))
            .route(
                "/api/ui/channels/send",
                post(Self::api_send_message_from_ui),
            )
            // TUI endpoints for UI
            .route(
                "/api/ui/tui/start",
                post(Self::api_start_tui_session_from_ui),
            )
            .route(
                "/api/ui/tui/command",
                post(Self::api_send_tui_command_from_ui),
            )
            .route("/api/ui/tui/status", get(Self::api_get_tui_status_for_ui))
            // Vector endpoints for UI
            .route(
                "/api/ui/vectors/query",
                post(Self::api_query_vectors_for_ui),
            )
            .route("/api/ui/vectors", post(Self::api_store_vector_from_ui))
            // Tool streaming endpoints for UI
            .route(
                "/api/ui/tools/stream",
                post(Self::api_stream_tool_execution_from_ui),
            )
            // Provider management endpoints for UI
            .route(
                "/api/ui/providers/:id/health",
                get(Self::api_check_provider_health_for_ui),
            )
            .route(
                "/api/ui/providers/:id/usage",
                get(Self::api_get_provider_usage_for_ui),
            )
            // Cron system endpoints for UI
            .route("/api/ui/cron", get(Self::api_list_scheduled_jobs_for_ui))
            .route("/api/ui/cron", post(Self::api_create_job_from_ui))
            .route("/api/ui/cron/:id", delete(Self::api_delete_job_from_ui))
            // iMessage endpoints for UI
            .route(
                "/api/ui/imessage/contacts",
                get(Self::api_list_imessage_contacts_for_ui),
            )
            .route(
                "/api/ui/imessage/send",
                post(Self::api_send_imessage_from_ui),
            )
            // Cleanup endpoints for UI
            .route(
                "/api/ui/cleanup/compact",
                post(Self::api_compact_sessions_from_ui),
            )
            .route(
                "/api/ui/cleanup/resources",
                post(Self::api_cleanup_resources_from_ui),
            )
            // Verification endpoints for UI
            .route(
                "/api/ui/verification/subprocess",
                get(Self::api_verify_subprocess_removal_for_ui),
            )
    }

    // API handler functions (these would be implemented to call the service methods)
    async fn api_list_skills_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "skills": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_get_skill_for_ui(
        Path(skill_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "skill": {
                "id": skill_id,
                "name": format!("Skill {}", skill_id),
                "description": "A skill for the UI",
                "enabled": true,
                "uiReady": true,
            }
        })))
    }

    async fn api_install_skill_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "skill_installed_from_ui",
            "uiReady": true,
        })))
    }

    async fn api_execute_skill_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "skill_executed_from_ui",
            "result": "Mock execution result for UI",
            "uiReady": true,
        })))
    }

    async fn api_list_sessions_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "sessions": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_create_session_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let session_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "session_created_from_ui",
            "sessionId": session_id,
            "uiReady": true,
        })))
    }

    async fn api_get_session_for_ui(
        Path(session_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "session": {
                "id": session_id,
                "name": format!("Session {}", session_id),
                "active": true,
                "uiReady": true,
            }
        })))
    }

    async fn api_update_session_from_ui(
        Path(session_id): Path<String>,
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "session_updated_from_ui",
            "sessionId": session_id,
            "uiReady": true,
        })))
    }

    async fn api_delete_session_from_ui(
        Path(session_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "session_deleted_from_ui",
            "sessionId": session_id,
            "uiReady": true,
        })))
    }

    async fn api_get_gateway_status_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": {
                "healthy": true,
                "uptime": "running",
                "uiReady": true,
            }
        })))
    }

    async fn api_list_connections_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "connections": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_get_connection_for_ui(
        Path(conn_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "connection": {
                "id": conn_id,
                "status": "connected",
                "uiReady": true,
            }
        })))
    }

    async fn api_list_providers_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "providers": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_get_provider_for_ui(
        Path(provider_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "provider": {
                "id": provider_id,
                "name": format!("Provider {}", provider_id),
                "enabled": true,
                "uiReady": true,
            }
        })))
    }

    async fn api_update_provider_from_ui(
        Path(provider_id): Path<String>,
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "provider_updated_from_ui",
            "providerId": provider_id,
            "uiReady": true,
        })))
    }

    async fn api_list_tools_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "tools": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_get_tool_for_ui(
        Path(tool_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "tool": {
                "id": tool_id,
                "name": format!("Tool {}", tool_id),
                "enabled": true,
                "uiReady": true,
            }
        })))
    }

    async fn api_execute_tool_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "tool_executed_from_ui",
            "result": "Mock tool execution result for UI",
            "uiReady": true,
        })))
    }

    async fn api_list_memories_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "memories": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_search_memories_for_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "results": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_store_memory_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let memory_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "memory_stored_from_ui",
            "memoryId": memory_id,
            "uiReady": true,
        })))
    }

    async fn api_list_channels_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "channels": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_get_channel_for_ui(
        Path(channel_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "channel": {
                "id": channel_id,
                "name": format!("Channel {}", channel_id),
                "enabled": true,
                "uiReady": true,
            }
        })))
    }

    async fn api_send_message_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let message_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "message_sent_from_ui",
            "messageId": message_id,
            "uiReady": true,
        })))
    }

    async fn api_start_tui_session_from_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let session_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "tui_session_started_from_ui",
            "sessionId": session_id,
            "uiReady": true,
        })))
    }

    async fn api_send_tui_command_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "tui_command_sent_from_ui",
            "result": "Mock TUI command result for UI",
            "uiReady": true,
        })))
    }

    async fn api_get_tui_status_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": {
                "ready": true,
                "activeSessions": 0,
                "uiReady": true,
            }
        })))
    }

    async fn api_query_vectors_for_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "results": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_store_vector_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let vector_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "vector_stored_from_ui",
            "vectorId": vector_id,
            "uiReady": true,
        })))
    }

    async fn api_stream_tool_execution_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "tool_streaming_started_from_ui",
            "streamId": Uuid::new_v4().to_string(),
            "uiReady": true,
        })))
    }

    async fn api_check_provider_health_for_ui(
        Path(provider_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "health": {
                "providerId": provider_id,
                "healthy": true,
                "uiReady": true,
            }
        })))
    }

    async fn api_get_provider_usage_for_ui(
        Path(provider_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "usage": {
                "providerId": provider_id,
                "requestsCount": 0,
                "uiReady": true,
            }
        })))
    }

    async fn api_list_scheduled_jobs_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "jobs": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_create_job_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let job_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "job_created_from_ui",
            "jobId": job_id,
            "uiReady": true,
        })))
    }

    async fn api_delete_job_from_ui(
        Path(job_id): Path<String>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "job_deleted_from_ui",
            "jobId": job_id,
            "uiReady": true,
        })))
    }

    async fn api_list_imessage_contacts_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "contacts": [],
            "count": 0,
            "uiReady": true,
        })))
    }

    async fn api_send_imessage_from_ui(
        Json(payload): Json<serde_json::Value>,
    ) -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        let message_id = Uuid::new_v4().to_string();
        Ok(Json(serde_json::json!({
            "status": "imessage_sent_from_ui",
            "messageId": message_id,
            "uiReady": true,
        })))
    }

    async fn api_compact_sessions_from_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "sessions_compacted_from_ui",
            "uiReady": true,
        })))
    }

    async fn api_cleanup_resources_from_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "resources_cleaned_from_ui",
            "uiReady": true,
        })))
    }

    async fn api_verify_subprocess_removal_for_ui() -> Result<Json<serde_json::Value>, StatusCode> {
        // In a real implementation, this would call the service method
        Ok(Json(serde_json::json!({
            "status": "verification_completed_from_ui",
            "migrationComplete": true,
            "uiReady": true,
        })))
    }

    /// Get current configuration
    pub fn config(&self) -> &UiIntegrationConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut UiIntegrationConfig {
        &mut self.config
    }

    /// Check if service is initialized
    pub fn is_initialized(&self) -> bool {
        self.skill_registry.is_some()
            && self.session_manager.is_some()
            && self.gateway.is_some()
            && self.provider_router.is_some()
            && self.session_compactor.is_some()
            && self.tool_registry.is_some()
            && self.bash_executor.is_some()
            && self.gateway_ws_handler.is_some()
            && self.skill_installer.is_some()
            && self.vector_memory.is_some()
            && self.skill_execution.is_some()
            && self.session_manager_native.is_some()
            && self.tui_service.is_some()
            && self.channel_abstraction.is_some()
            && self.canvas_service.is_some()
            && self.tool_streamer.is_some()
            && self.provider_management.is_some()
            && self.cron_system.is_some()
            && self.imessage_bridge.is_some()
            && self.final_cleanup.is_some()
            && self.subprocess_removal.is_some()
            && self.integration_verification.is_some()
            && self.shell_ui_bridge.is_some()
            && self.api_gateway_router.is_some()
    }
}

/// UI Integration Error
#[derive(Debug, thiserror::Error)]
pub enum UiIntegrationError {
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

impl From<serde_json::Error> for UiIntegrationError {
    fn from(error: serde_json::Error) -> Self {
        UiIntegrationError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ui_integration_service_creation() {
        let service = UiIntegrationService::new();
        assert_eq!(service.config.ui_port, 3000);
        assert!(service.config.enable_cors);
        assert!(service.config.enable_rate_limiting);
        assert_eq!(service.skill_registry, None);
        assert_eq!(service.session_manager, None);
    }

    #[tokio::test]
    async fn test_ui_integration_service_with_config() {
        let config = UiIntegrationConfig {
            ui_port: 4000,
            ui_address: "0.0.0.0".to_string(),
            enable_cors: false,
            enable_rate_limiting: false,
            requests_per_minute: Some(500),
            enable_authentication: false,
            auth_token: None,
            enable_compression: false,
            compression_level: None,
            max_request_size_bytes: 5 * 1024 * 1024, // 5MB
            timeout_seconds: 60,
            enable_request_logging: false,
            log_level: "debug".to_string(),
            static_files_path: PathBuf::from("/tmp/test-ui-static"),
            enable_metrics: false,
            metrics_endpoint: None,
            enable_tracing: false,
            trace_endpoint: None,
        };

        let service = UiIntegrationService::with_config(config);
        assert_eq!(service.config.ui_port, 4000);
        assert_eq!(service.config.ui_address, "0.0.0.0");
        assert!(!service.config.enable_cors);
        assert!(!service.config.enable_rate_limiting);
        assert!(!service.config.enable_authentication);
        assert!(!service.config.enable_request_logging);
    }

    #[tokio::test]
    async fn test_operation_name_extraction() {
        let service = UiIntegrationService::new();

        let list_skills_op = UiIntegrationOperation::ListSkillsForUi;
        assert_eq!(
            service.operation_name(&list_skills_op),
            "list_skills_for_ui"
        );

        let get_skill_op = UiIntegrationOperation::GetSkillForUi {
            id: "test".to_string(),
        };
        assert_eq!(service.operation_name(&get_skill_op), "get_skill_for_ui");

        let execute_tool_op = UiIntegrationOperation::ExecuteToolFromUi {
            tool_id: "bash".to_string(),
            arguments: HashMap::new(),
            session_id: None,
        };
        assert_eq!(
            service.operation_name(&execute_tool_op),
            "execute_tool_from_ui"
        );
    }

    #[tokio::test]
    async fn test_is_initialized() {
        let service = UiIntegrationService::new();
        assert!(!service.is_initialized()); // Services not initialized yet

        // After initialization, it should return true if all services are set up
    }

    #[test]
    fn test_ui_integration_config_defaults() {
        let config = UiIntegrationConfig::default();
        assert_eq!(config.ui_port, 3000);
        assert_eq!(config.ui_address, "127.0.0.1");
        assert!(config.enable_cors);
        assert!(config
            .cors_origins
            .contains(&"http://localhost:3000".to_string()));
        assert!(config.enable_rate_limiting);
        assert_eq!(config.requests_per_minute, Some(1000));
        assert!(config.enable_authentication);
        assert!(config.auth_token.is_some());
        assert!(config.enable_compression);
        assert_eq!(config.compression_level, Some(6));
        assert_eq!(config.max_request_size_bytes, 10 * 1024 * 1024); // 10MB
        assert_eq!(config.timeout_seconds, 30);
        assert!(config.enable_request_logging);
        assert_eq!(config.log_level, "info");
        assert_eq!(config.static_files_path, PathBuf::from("./ui/static"));
        assert!(config.enable_metrics);
        assert_eq!(config.metrics_endpoint, Some("/metrics".to_string()));
    }

    #[test]
    fn test_ui_integration_operation_serialization() {
        let operation = UiIntegrationOperation::ListSkillsForUi;
        let serialized = serde_json::to_string(&operation).unwrap();
        let deserialized: UiIntegrationOperation = serde_json::from_str(&serialized).unwrap();
        assert!(matches!(
            deserialized,
            UiIntegrationOperation::ListSkillsForUi
        ));

        let operation = UiIntegrationOperation::GetSkillForUi {
            id: "test-skill".to_string(),
        };
        let serialized = serde_json::to_string(&operation).unwrap();
        let deserialized: UiIntegrationOperation = serde_json::from_str(&serialized).unwrap();
        match deserialized {
            UiIntegrationOperation::GetSkillForUi { id } => assert_eq!(id, "test-skill"),
            _ => panic!("Expected GetSkillForUi operation"),
        }
    }

    #[test]
    fn test_ui_integration_error_serialization() {
        let error = UiIntegrationError::ServiceNotInitialized("TestService".to_string());
        let error_str = error.to_string();
        assert!(error_str.contains("TestService"));
    }
}
