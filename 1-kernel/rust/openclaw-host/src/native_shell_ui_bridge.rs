//! Shell UI ↔ Native Service Bridge - IC-001
//!
//! Adapter pattern implementation that bridges between Shell UI requests
//! and native A2R service implementations. This module provides the translation
//! layer between the Shell UI interface and the native Rust implementations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

/// Shell UI request wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellUiRequest {
    pub operation: ShellUiOperation,
    pub context: Option<ShellUiContext>,
}

/// Shell UI operation types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShellUiOperation {
    /// Skill operations
    ListSkills,
    GetSkill {
        id: String,
    },
    InstallSkill {
        skill_path: PathBuf,
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

/// Shell UI context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellUiContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

/// Shell UI response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellUiResponse {
    pub success: bool,
    pub operation: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Shell UI bridge configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellUiBridgeConfig {
    pub enable_request_logging: bool,
    pub log_level: String, // "debug", "info", "warn", "error"
    pub enable_response_caching: bool,
    pub cache_ttl_seconds: Option<u64>,
    pub enable_rate_limiting: bool,
    pub requests_per_minute: Option<u32>,
    pub enable_security_validation: bool,
    pub security_policy: SecurityPolicy,
    pub timeout_seconds: u64,
    pub max_request_size_bytes: u64,
    pub enable_compression: bool,
    pub compression_level: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityPolicy {
    #[serde(rename = "strict")]
    Strict,
    #[serde(rename = "moderate")]
    Moderate,
    #[serde(rename = "relaxed")]
    Relaxed,
}

impl Default for ShellUiBridgeConfig {
    fn default() -> Self {
        Self {
            enable_request_logging: true,
            log_level: "info".to_string(),
            enable_response_caching: true,
            cache_ttl_seconds: Some(300), // 5 minutes
            enable_rate_limiting: true,
            requests_per_minute: Some(100),
            enable_security_validation: true,
            security_policy: SecurityPolicy::Strict,
            timeout_seconds: 30,                      // 30 seconds
            max_request_size_bytes: 10 * 1024 * 1024, // 10MB
            enable_compression: true,
            compression_level: Some(6),
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

/// Shell UI bridge service
pub struct ShellUiBridgeService {
    config: ShellUiBridgeConfig,
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
    request_cache: HashMap<String, (serde_json::Value, DateTime<Utc>)>,
}

impl Default for ShellUiBridgeService {
    fn default() -> Self {
        Self::new()
    }
}

impl ShellUiBridgeService {
    /// Create new shell UI bridge service with default configuration
    pub fn new() -> Self {
        Self {
            config: ShellUiBridgeConfig::default(),
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
            request_cache: HashMap::new(),
        }
    }

    /// Create new shell UI bridge service with custom configuration
    pub fn with_config(config: ShellUiBridgeConfig) -> Self {
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
            request_cache: HashMap::new(),
        }
    }

    /// Initialize the bridge service by connecting to native services
    pub async fn initialize(&mut self) -> Result<(), ShellUiBridgeError> {
        // Initialize all native services
        self.initialize_native_services().await?;
        Ok(())
    }

    /// Initialize native services
    async fn initialize_native_services(&mut self) -> Result<(), ShellUiBridgeError> {
        // Initialize skill registry bridge
        let vendor_dir = std::env::var("OPENCLAW_VENDOR_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("3-adapters/vendor-integration/vendor/openclaw"));
        self.skill_registry = Some(
            crate::SkillRegistryBridge::with_vendor_dir(&vendor_dir).map_err(|e| {
                ShellUiBridgeError::IoError(format!(
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
                ShellUiBridgeError::ValidationError(format!(
                    "Invalid OPENCLAW_PORT '{}': {}",
                    port, e
                ))
            })?);
        }

        let host = crate::OpenClawHost::start(host_config).await.map_err(|e| {
            ShellUiBridgeError::IoError(format!("Failed to start OpenClaw host: {}", e))
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
            ShellUiBridgeError::IoError(format!("Failed to initialize cron system: {}", e))
        })?);
        self.imessage_bridge = Some(crate::ImessageBridgeService::new());
        self.final_cleanup = Some(crate::FinalCleanupService::new());
        self.subprocess_removal = Some(crate::SubprocessRemovalService::new());
        self.integration_verification = Some(crate::IntegrationVerificationService::new());

        Ok(())
    }

    /// Execute a shell UI operation
    pub async fn execute(
        &mut self,
        request: ShellUiRequest,
    ) -> Result<ShellUiResponse, ShellUiBridgeError> {
        let start_time = std::time::Instant::now();

        // Check if request should be cached
        if self.config.enable_response_caching {
            if let Some(cached_result) = self.check_cache(&request).await {
                return Ok(ShellUiResponse {
                    success: true,
                    operation: self.operation_name(&request.operation),
                    result: Some(cached_result),
                    error: None,
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                });
            }
        }

        // Execute the operation
        let operation = request.operation.clone();
        let result = match operation {
            ShellUiOperation::ListSkills => self.handle_list_skills().await,
            ShellUiOperation::GetSkill { id } => self.handle_get_skill(&id).await,
            ShellUiOperation::InstallSkill { skill_path } => {
                self.handle_install_skill(skill_path).await
            }
            ShellUiOperation::ExecuteSkill {
                skill_id,
                arguments,
            } => self.handle_execute_skill(skill_id, arguments).await,
            ShellUiOperation::ListSessions => self.handle_list_sessions().await,
            ShellUiOperation::GetSession { id } => self.handle_get_session(&id).await,
            ShellUiOperation::CreateSession { name, description } => {
                self.handle_create_session(name, description).await
            }
            ShellUiOperation::UpdateSession { id, updates } => {
                self.handle_update_session(id, updates).await
            }
            ShellUiOperation::DeleteSession { id } => self.handle_delete_session(id).await,
            ShellUiOperation::GetGatewayStatus => self.handle_get_gateway_status().await,
            ShellUiOperation::ListConnections => self.handle_list_connections().await,
            ShellUiOperation::GetConnection { id } => self.handle_get_connection(id).await,
            ShellUiOperation::ListProviders => self.handle_list_providers().await,
            ShellUiOperation::GetProvider { id } => self.handle_get_provider(id).await,
            ShellUiOperation::UpdateProvider { id, config } => {
                self.handle_update_provider(id, config).await
            }
            ShellUiOperation::ListTools => self.handle_list_tools().await,
            ShellUiOperation::GetTool { id } => self.handle_get_tool(id).await,
            ShellUiOperation::ExecuteTool { tool_id, arguments } => {
                self.handle_execute_tool(tool_id, arguments).await
            }
            ShellUiOperation::ListMemories => self.handle_list_memories().await,
            ShellUiOperation::SearchMemories { query, limit } => {
                self.handle_search_memories(query, limit).await
            }
            ShellUiOperation::StoreMemory { content, metadata } => {
                self.handle_store_memory(content, metadata).await
            }
            ShellUiOperation::ListChannels => self.handle_list_channels().await,
            ShellUiOperation::GetChannel { id } => self.handle_get_channel(id).await,
            ShellUiOperation::SendMessage {
                channel_id,
                message,
            } => self.handle_send_message(channel_id, message).await,
            ShellUiOperation::StartTuiSession => self.handle_start_tui_session().await,
            ShellUiOperation::SendTuiCommand { command } => {
                self.handle_send_tui_command(command).await
            }
            ShellUiOperation::GetTuiStatus => self.handle_get_tui_status().await,
            ShellUiOperation::QueryVectors { query, top_k } => {
                self.handle_query_vectors(query, top_k).await
            }
            ShellUiOperation::StoreVector {
                content,
                embedding,
                metadata,
            } => self.handle_store_vector(content, embedding, metadata).await,
            ShellUiOperation::StreamToolExecution { tool_id, arguments } => {
                self.handle_stream_tool_execution(tool_id, arguments).await
            }
            ShellUiOperation::CheckProviderHealth { id } => {
                self.handle_check_provider_health(id).await
            }
            ShellUiOperation::GetProviderUsage { id } => self.handle_get_provider_usage(id).await,
            ShellUiOperation::ListScheduledJobs => self.handle_list_scheduled_jobs().await,
            ShellUiOperation::CreateJob { schedule, command } => {
                self.handle_create_job(schedule, command).await
            }
            ShellUiOperation::DeleteJob { id } => self.handle_delete_job(id).await,
            ShellUiOperation::ListImessageContacts => self.handle_list_imessage_contacts().await,
            ShellUiOperation::SendImessage { contact, message } => {
                self.handle_send_imessage(contact, message).await
            }
            ShellUiOperation::CompactSessions => self.handle_compact_sessions().await,
            ShellUiOperation::CleanupResources => self.handle_cleanup_resources().await,
            ShellUiOperation::VerifySubprocessRemoval => {
                self.handle_verify_subprocess_removal().await
            }
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(result_value) => {
                // Cache the result if caching is enabled
                if self.config.enable_response_caching {
                    self.cache_result(&request.operation, &result_value).await;
                }

                Ok(ShellUiResponse {
                    success: true,
                    operation: self.operation_name(&request.operation),
                    result: Some(result_value),
                    error: None,
                    execution_time_ms: execution_time,
                })
            }
            Err(error) => Ok(ShellUiResponse {
                success: false,
                operation: self.operation_name(&request.operation),
                result: None,
                error: Some(error.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// Get operation name for logging
    fn operation_name(&self, operation: &ShellUiOperation) -> String {
        match operation {
            ShellUiOperation::ListSkills => "list_skills".to_string(),
            ShellUiOperation::GetSkill { .. } => "get_skill".to_string(),
            ShellUiOperation::InstallSkill { .. } => "install_skill".to_string(),
            ShellUiOperation::ExecuteSkill { .. } => "execute_skill".to_string(),
            ShellUiOperation::ListSessions => "list_sessions".to_string(),
            ShellUiOperation::GetSession { .. } => "get_session".to_string(),
            ShellUiOperation::CreateSession { .. } => "create_session".to_string(),
            ShellUiOperation::UpdateSession { .. } => "update_session".to_string(),
            ShellUiOperation::DeleteSession { .. } => "delete_session".to_string(),
            ShellUiOperation::GetGatewayStatus => "get_gateway_status".to_string(),
            ShellUiOperation::ListConnections => "list_connections".to_string(),
            ShellUiOperation::GetConnection { .. } => "get_connection".to_string(),
            ShellUiOperation::ListProviders => "list_providers".to_string(),
            ShellUiOperation::GetProvider { .. } => "get_provider".to_string(),
            ShellUiOperation::UpdateProvider { .. } => "update_provider".to_string(),
            ShellUiOperation::ListTools => "list_tools".to_string(),
            ShellUiOperation::GetTool { .. } => "get_tool".to_string(),
            ShellUiOperation::ExecuteTool { .. } => "execute_tool".to_string(),
            ShellUiOperation::ListMemories => "list_memories".to_string(),
            ShellUiOperation::SearchMemories { .. } => "search_memories".to_string(),
            ShellUiOperation::StoreMemory { .. } => "store_memory".to_string(),
            ShellUiOperation::ListChannels => "list_channels".to_string(),
            ShellUiOperation::GetChannel { .. } => "get_channel".to_string(),
            ShellUiOperation::SendMessage { .. } => "send_message".to_string(),
            ShellUiOperation::StartTuiSession => "start_tui_session".to_string(),
            ShellUiOperation::SendTuiCommand { .. } => "send_tui_command".to_string(),
            ShellUiOperation::GetTuiStatus => "get_tui_status".to_string(),
            ShellUiOperation::QueryVectors { .. } => "query_vectors".to_string(),
            ShellUiOperation::StoreVector { .. } => "store_vector".to_string(),
            ShellUiOperation::StreamToolExecution { .. } => "stream_tool_execution".to_string(),
            ShellUiOperation::CheckProviderHealth { .. } => "check_provider_health".to_string(),
            ShellUiOperation::GetProviderUsage { .. } => "get_provider_usage".to_string(),
            ShellUiOperation::ListScheduledJobs => "list_scheduled_jobs".to_string(),
            ShellUiOperation::CreateJob { .. } => "create_job".to_string(),
            ShellUiOperation::DeleteJob { .. } => "delete_job".to_string(),
            ShellUiOperation::ListImessageContacts => "list_imessage_contacts".to_string(),
            ShellUiOperation::SendImessage { .. } => "send_imessage".to_string(),
            ShellUiOperation::CompactSessions => "compact_sessions".to_string(),
            ShellUiOperation::CleanupResources => "cleanup_resources".to_string(),
            ShellUiOperation::VerifySubprocessRemoval => "verify_subprocess_removal".to_string(),
        }
    }

    /// Check if request is cached
    async fn check_cache(&self, request: &ShellUiRequest) -> Option<serde_json::Value> {
        if !self.config.enable_response_caching {
            return None;
        }

        // Create cache key based on operation and parameters
        let cache_key = self.create_cache_key(request);

        if let Some((cached_result, cached_time)) = self.request_cache.get(&cache_key) {
            if let Some(ttl) = self.config.cache_ttl_seconds {
                let now = Utc::now();
                let elapsed = (now - *cached_time).num_seconds() as u64;

                if elapsed < ttl {
                    return Some(cached_result.clone());
                }
            } else {
                return Some(cached_result.clone());
            }
        }

        None
    }

    /// Create cache key for request
    fn create_cache_key(&self, request: &ShellUiRequest) -> String {
        // Create a unique key based on operation type and parameters
        match &request.operation {
            ShellUiOperation::ListSkills => "list_skills".to_string(),
            ShellUiOperation::GetSkill { id } => format!("get_skill_{}", id),
            ShellUiOperation::ListSessions => "list_sessions".to_string(),
            ShellUiOperation::GetSession { id } => format!("get_session_{}", id),
            _ => format!("op_{:?}", Uuid::new_v4()), // For operations with complex parameters, use UUID
        }
    }

    /// Cache result
    async fn cache_result(&mut self, operation: &ShellUiOperation, result: &serde_json::Value) {
        if !self.config.enable_response_caching {
            return;
        }

        let cache_key = self.create_cache_key(&ShellUiRequest {
            operation: operation.clone(),
            context: None,
        });

        self.request_cache
            .insert(cache_key, (result.clone(), Utc::now()));
    }

    /// Handle list skills operation
    async fn handle_list_skills(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref skill_registry) = self.skill_registry {
            // In a real implementation, this would call the actual skill registry
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "skills": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SkillRegistry".to_string(),
            ))
        }
    }

    /// Handle get skill operation
    async fn handle_get_skill(
        &self,
        skill_id: &str,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SkillRegistry".to_string(),
            ))
        }
    }

    /// Handle install skill operation
    async fn handle_install_skill(
        &self,
        skill_path: PathBuf,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref skill_installer) = self.skill_installer {
            // In a real implementation, this would call the actual skill installer
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "skill_installed",
                "path": skill_path.display().to_string(),
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SkillInstaller".to_string(),
            ))
        }
    }

    /// Handle execute skill operation
    async fn handle_execute_skill(
        &self,
        skill_id: String,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SkillExecution".to_string(),
            ))
        }
    }

    /// Handle list sessions operation
    async fn handle_list_sessions(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref session_manager) = self.session_manager {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "sessions": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SessionManager".to_string(),
            ))
        }
    }

    /// Handle get session operation
    async fn handle_get_session(
        &self,
        session_id: &str,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SessionManager".to_string(),
            ))
        }
    }

    /// Handle create session operation
    async fn handle_create_session(
        &self,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle update session operation
    async fn handle_update_session(
        &self,
        session_id: String,
        updates: SessionUpdates,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "session_updated",
                "sessionId": session_id,
                "updates": updates,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle delete session operation
    async fn handle_delete_session(
        &self,
        session_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref session_manager_native) = self.session_manager_native {
            // In a real implementation, this would call the actual session manager
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "session_deleted",
                "sessionId": session_id,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SessionManagerNative".to_string(),
            ))
        }
    }

    /// Handle get gateway status operation
    async fn handle_get_gateway_status(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "healthy",
                "connections": 0,
                "uptime": "0s",
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle list connections operation
    async fn handle_list_connections(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref gateway) = self.gateway {
            // In a real implementation, this would call the actual gateway
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "connections": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle get connection operation
    async fn handle_get_connection(
        &self,
        connection_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "Gateway".to_string(),
            ))
        }
    }

    /// Handle list providers operation
    async fn handle_list_providers(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "providers": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle get provider operation
    async fn handle_get_provider(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle update provider operation
    async fn handle_update_provider(
        &self,
        provider_id: String,
        config: ProviderConfigUpdates,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref provider_management) = self.provider_management {
            // In a real implementation, this would call the actual provider management service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "provider_updated",
                "providerId": provider_id,
                "config": config,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle list tools operation
    async fn handle_list_tools(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref tool_registry) = self.tool_registry {
            // In a real implementation, this would call the actual tool registry
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "tools": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ToolRegistry".to_string(),
            ))
        }
    }

    /// Handle get tool operation
    async fn handle_get_tool(
        &self,
        tool_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ToolRegistry".to_string(),
            ))
        }
    }

    /// Handle execute tool operation
    async fn handle_execute_tool(
        &self,
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "BashExecutor".to_string(),
            ))
        }
    }

    /// Handle list memories operation
    async fn handle_list_memories(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref vector_memory) = self.vector_memory {
            // In a real implementation, this would call the actual vector memory service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "memories": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle search memories operation
    async fn handle_search_memories(
        &self,
        query: String,
        limit: Option<usize>,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle store memory operation
    async fn handle_store_memory(
        &self,
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle list channels operation
    async fn handle_list_channels(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref channel_abstraction) = self.channel_abstraction {
            // In a real implementation, this would call the actual channel abstraction service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "channels": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle get channel operation
    async fn handle_get_channel(
        &self,
        channel_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle send message operation
    async fn handle_send_message(
        &self,
        channel_id: String,
        message: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ChannelAbstraction".to_string(),
            ))
        }
    }

    /// Handle start TUI session operation
    async fn handle_start_tui_session(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            let session_id = Uuid::new_v4().to_string();
            Ok(serde_json::json!({
                "status": "tui_session_started",
                "sessionId": session_id,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle send TUI command operation
    async fn handle_send_tui_command(
        &self,
        command: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "tui_command_processed",
                "command": command,
                "result": "Mock TUI command result",
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle get TUI status operation
    async fn handle_get_tui_status(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref tui_service) = self.tui_service {
            // In a real implementation, this would call the actual TUI service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "ready",
                "activeSessions": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "TuiService".to_string(),
            ))
        }
    }

    /// Handle query vectors operation
    async fn handle_query_vectors(
        &self,
        query: String,
        top_k: usize,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
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
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "VectorMemory".to_string(),
            ))
        }
    }

    /// Handle stream tool execution operation
    async fn handle_stream_tool_execution(
        &self,
        tool_id: String,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ToolStreamer".to_string(),
            ))
        }
    }

    /// Handle check provider health operation
    async fn handle_check_provider_health(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle get provider usage operation
    async fn handle_get_provider_usage(
        &self,
        provider_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ProviderManagement".to_string(),
            ))
        }
    }

    /// Handle list scheduled jobs operation
    async fn handle_list_scheduled_jobs(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "jobs": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle create job operation
    async fn handle_create_job(
        &self,
        schedule: String,
        command: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle delete job operation
    async fn handle_delete_job(
        &self,
        job_id: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref cron_system) = self.cron_system {
            // In a real implementation, this would call the actual cron system
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "job_deleted",
                "jobId": job_id,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "CronSystem".to_string(),
            ))
        }
    }

    /// Handle list iMessage contacts operation
    async fn handle_list_imessage_contacts(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref imessage_bridge) = self.imessage_bridge {
            // In a real implementation, this would call the actual iMessage bridge
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "contacts": [],
                "count": 0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ImessageBridge".to_string(),
            ))
        }
    }

    /// Handle send iMessage operation
    async fn handle_send_imessage(
        &self,
        contact: String,
        message: String,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "ImessageBridge".to_string(),
            ))
        }
    }

    /// Handle compact sessions operation
    async fn handle_compact_sessions(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref session_compactor) = self.session_compactor {
            // In a real implementation, this would call the actual session compactor
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "sessions_compacted",
                "compactedCount": 0,
                "freedSpaceMb": 0.0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SessionCompactor".to_string(),
            ))
        }
    }

    /// Handle cleanup resources operation
    async fn handle_cleanup_resources(&self) -> Result<serde_json::Value, ShellUiBridgeError> {
        if let Some(ref final_cleanup) = self.final_cleanup {
            // In a real implementation, this would call the actual final cleanup service
            // For now, we'll return a mock response
            Ok(serde_json::json!({
                "status": "resources_cleaned",
                "cleanedCount": 0,
                "freedSpaceMb": 0.0,
            }))
        } else {
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "FinalCleanup".to_string(),
            ))
        }
    }

    /// Handle verify subprocess removal operation
    async fn handle_verify_subprocess_removal(
        &self,
    ) -> Result<serde_json::Value, ShellUiBridgeError> {
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
            Err(ShellUiBridgeError::ServiceNotInitialized(
                "SubprocessRemoval".to_string(),
            ))
        }
    }

    /// Get current configuration
    pub fn config(&self) -> &ShellUiBridgeConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut ShellUiBridgeConfig {
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
    }
}

/// Shell UI bridge error
#[derive(Debug, thiserror::Error)]
pub enum ShellUiBridgeError {
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

impl From<serde_json::Error> for ShellUiBridgeError {
    fn from(error: serde_json::Error) -> Self {
        ShellUiBridgeError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shell_ui_bridge_creation() {
        let bridge = ShellUiBridgeService::new();
        assert!(bridge.config.enable_request_logging);
        assert!(bridge.config.enable_response_caching);
        assert_eq!(bridge.config.log_level, "info");
        assert!(!bridge.is_initialized()); // Services not initialized yet
    }

    #[tokio::test]
    async fn test_shell_ui_bridge_with_config() {
        let config = ShellUiBridgeConfig {
            enable_request_logging: false,
            log_level: "debug".to_string(),
            enable_response_caching: false,
            cache_ttl_seconds: None,
            enable_rate_limiting: true,
            requests_per_minute: Some(50),
            enable_security_validation: true,
            security_policy: SecurityPolicy::Moderate,
            timeout_seconds: 60,
            max_request_size_bytes: 5 * 1024 * 1024, // 5MB
            enable_compression: false,
            compression_level: None,
        };

        let bridge = ShellUiBridgeService::with_config(config);
        assert!(!bridge.config.enable_request_logging);
        assert_eq!(bridge.config.log_level, "debug");
        assert!(!bridge.config.enable_response_caching);
        assert_eq!(bridge.config.requests_per_minute, Some(50));
        assert_eq!(bridge.config.security_policy, SecurityPolicy::Moderate);
    }

    #[tokio::test]
    async fn test_operation_name() {
        let bridge = ShellUiBridgeService::new();

        let list_skills_op = ShellUiOperation::ListSkills;
        assert_eq!(bridge.operation_name(&list_skills_op), "list_skills");

        let get_skill_op = ShellUiOperation::GetSkill {
            id: "test".to_string(),
        };
        assert_eq!(bridge.operation_name(&get_skill_op), "get_skill");

        let execute_tool_op = ShellUiOperation::ExecuteTool {
            tool_id: "bash".to_string(),
            arguments: HashMap::new(),
        };
        assert_eq!(bridge.operation_name(&execute_tool_op), "execute_tool");
    }

    #[tokio::test]
    async fn test_cache_functionality() {
        let mut bridge = ShellUiBridgeService::with_config(ShellUiBridgeConfig {
            enable_response_caching: true,
            cache_ttl_seconds: Some(300), // 5 minutes
            ..Default::default()
        });

        let request = ShellUiRequest {
            operation: ShellUiOperation::ListSkills,
            context: None,
        };

        let result = serde_json::json!({"skills": [], "count": 0});

        // Cache a result
        bridge.cache_result(&request.operation, &result).await;

        // Check if it's cached
        let cached = bridge.check_cache(&request).await;
        assert!(cached.is_some());

        // Verify the cached result matches
        assert_eq!(cached.unwrap(), result);
    }

    #[test]
    fn test_security_policy_serialization() {
        let strict_policy = SecurityPolicy::Strict;
        let serialized = serde_json::to_string(&strict_policy).unwrap();
        let deserialized: SecurityPolicy = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, SecurityPolicy::Strict);

        let moderate_policy = SecurityPolicy::Moderate;
        let serialized = serde_json::to_string(&moderate_policy).unwrap();
        let deserialized: SecurityPolicy = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, SecurityPolicy::Moderate);
    }

    #[test]
    fn test_shell_ui_bridge_config_defaults() {
        let config = ShellUiBridgeConfig::default();
        assert!(config.enable_request_logging);
        assert!(config.enable_response_caching);
        assert_eq!(config.log_level, "info");
        assert_eq!(config.cache_ttl_seconds, Some(300));
        assert!(config.enable_rate_limiting);
        assert_eq!(config.requests_per_minute, Some(100));
        assert!(config.enable_security_validation);
        assert_eq!(config.security_policy, SecurityPolicy::Strict);
        assert_eq!(config.timeout_seconds, 30);
        assert_eq!(config.max_request_size_bytes, 10 * 1024 * 1024); // 10MB
        assert!(config.enable_compression);
        assert_eq!(config.compression_level, Some(6));
    }

    #[test]
    fn test_shell_ui_operation_serialization() {
        let op = ShellUiOperation::ListSkills;
        let serialized = serde_json::to_string(&op).unwrap();
        let deserialized: ShellUiOperation = serde_json::from_str(&serialized).unwrap();
        assert!(matches!(deserialized, ShellUiOperation::ListSkills));

        let op = ShellUiOperation::GetSkill {
            id: "test-skill".to_string(),
        };
        let serialized = serde_json::to_string(&op).unwrap();
        let deserialized: ShellUiOperation = serde_json::from_str(&serialized).unwrap();
        match deserialized {
            ShellUiOperation::GetSkill { id } => assert_eq!(id, "test-skill"),
            _ => panic!("Expected GetSkill operation"),
        }
    }
}
