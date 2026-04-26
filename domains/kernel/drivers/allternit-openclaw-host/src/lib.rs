//! OpenClaw Host Module
//!
//! This module provides the ONLY permitted interface to the OpenClaw vendor code.
//! All interaction must go through OpenClawHost.
//!
//! ARCHITECTURE LOCKS:
//! - LOCK 1: Node is never allowed into kernel directly (subprocess boundary)
//! - LOCK 2: Parity corpus is the authority (all calls captured)

pub mod api;
pub mod completion;
pub mod components;
pub mod config;
pub mod errors;
pub mod feature_flags;
pub mod gateway;
pub mod health;
pub mod launcher;
pub mod native;
pub mod native_bash_executor;
pub mod native_canvas_a2ui;
pub mod native_channel_abstraction;
pub mod native_compaction;
pub mod native_config_system;
pub mod native_cron_system;
pub mod native_gateway_ws_handlers;
pub mod native_log_service;
pub mod native_provider_management;
pub mod native_session_manager;
pub mod native_skill_execution;
pub mod native_tool_executor;
pub mod native_tool_registry;
pub mod native_tool_streaming;
pub mod native_vector_memory;
pub mod pi_agent_bridge;
pub mod provider;
pub mod rpc;
pub mod session;
pub mod session_sync;
pub mod skill_installer_service;
pub mod skills;
// Legacy modules - excluded from tests due to API incompatibilities
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/final_integration_verification.rs"]
pub mod final_integration_verification;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_api_gateway_router.rs"]
pub mod native_api_gateway_router;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_canvas_a2ui_native.rs"]
pub mod native_canvas_a2ui_native;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_channel_abstraction_native.rs"]
pub mod native_channel_abstraction_native;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_final_cleanup.rs"]
pub mod native_final_cleanup;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_imessage_bridge.rs"]
pub mod native_imessage_bridge;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_provider_router.rs"]
pub mod native_provider_router;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_remaining_channels.rs"]
pub mod native_remaining_channels;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_session_manager_native.rs"]
pub mod native_session_manager_native;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_shell_ui_bridge.rs"]
pub mod native_shell_ui_bridge;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_skill_execution_native.rs"]
pub mod native_skill_execution_native;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_subprocess_removal.rs"]
pub mod native_subprocess_removal;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_tui.rs"]
pub mod native_tui;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_ui_integration.rs"]
pub mod native_ui_integration;
#[path = "native_ui_integration_service.rs"]
pub mod native_ui_integration_service;
#[cfg(not(test))]
#[path = "../../../../agent/rust/openclaw-host/src/native_vector_memory_native.rs"]
pub mod native_vector_memory_native;

pub use config::HostConfig;
pub use errors::HostError;
pub use health::HealthStatus;
pub use launcher::OpenClawHost;

// Re-export key parity types for convenience
pub use allternit_parity::{
    capture::{CaptureManager, Receipt, ReceiptMetadata},
    strangler::{ComponentInput, ComponentOutput, MigrationPhase, StranglerComponent},
};

// Re-export skills bridge for easy access
pub use skills::SkillRegistryBridge;

// Re-export session bridge for easy access
pub use session::SessionManagerBridge;

// Re-export gateway bridge for easy access
pub use gateway::GatewayBridge;

// Re-export provider bridge for easy access
pub use provider::ProviderRouterBridge;

// Re-export native compaction for easy access
pub use native_compaction::SessionCompactor;

// Re-export native tool registry for easy access
pub use native_tool_registry::ToolRegistry;

// Re-export native bash executor for easy access
pub use native_bash_executor::BashExecutor;

// Re-export native gateway WebSocket handlers for easy access
pub use native_gateway_ws_handlers::GatewayWsHandlerService;

// Re-export skill installer service for easy access
pub use skill_installer_service::SkillInstallerService;

// Re-export native tool executor for easy access
pub use native_tool_executor::ToolExecutorService;

// Re-export native canvas A2UI for easy access
pub use native_canvas_a2ui::CanvasService;

// Re-export native vector memory for easy access
pub use native_vector_memory::VectorMemoryService;

// Re-export native skill execution for easy access
pub use native_skill_execution::SkillExecutionService;

// Re-export native session manager for easy access
pub use native_session_manager::SessionManagerService;

// Re-export session sync service for easy access
pub use session_sync::SessionSyncService;

// Re-export Pi Agent bridge for easy access
pub use pi_agent_bridge::PiAgentBridge;

// Re-export native tool streaming for easy access
pub use native_tool_streaming::ToolStreamerService;

// Re-export native provider management for easy access
pub use native_provider_management::ProviderManagementService;

// Re-export native cron system for easy access
pub use native_cron_system::CronSystemService;

// Re-export native log service for easy access
pub use native_log_service::LogService;

// Re-export native config system for easy access
pub use native_config_system::ConfigSystemService;

// Test stubs for legacy modules
#[cfg(test)]
pub mod legacy_stubs {
    #[derive(Clone)]
    pub struct TuiService;
    impl TuiService {
        pub fn new() -> Self {
            Self
        }
    }
    #[derive(Clone)]
    pub struct TuiConfig;
    #[derive(Clone)]
    pub struct TuiTheme;

    #[derive(Clone)]
    pub struct ChannelAbstractionService;
    impl ChannelAbstractionService {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Clone)]
    pub struct ProviderRouterBridge;

    #[derive(Clone)]
    pub struct SessionManagerService;

    #[derive(Clone)]
    pub struct SkillExecutionService;

    #[derive(Clone)]
    pub struct CanvasService;

    #[derive(Clone)]
    pub struct VectorMemoryService;

    #[derive(Clone)]
    pub struct ChannelService;
    impl ChannelService {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Clone)]
    pub struct ImessageBridgeService;
    impl ImessageBridgeService {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Clone)]
    pub struct FinalCleanupService;
    impl FinalCleanupService {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Clone)]
    pub struct SubprocessRemovalService;
    impl SubprocessRemovalService {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Clone)]
    pub struct IntegrationVerificationService;
    impl IntegrationVerificationService {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Clone)]
    pub struct ShellUiBridgeService;
    impl ShellUiBridgeService {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Clone)]
    pub struct ApiGatewayRouterService;
    impl ApiGatewayRouterService {
        pub fn new() -> Self {
            Self
        }
    }
}

#[cfg(test)]
pub use legacy_stubs::*;

// Re-export native TUI for easy access
#[cfg(test)]
pub use legacy_stubs::{TuiConfig, TuiService, TuiTheme};
#[cfg(not(test))]
pub use native_tui::{TuiConfig, TuiService, TuiTheme};

// Re-export native channel abstraction native for easy access
#[cfg(test)]
pub use legacy_stubs::ChannelAbstractionService;
#[cfg(test)]
pub use legacy_stubs::ChannelAbstractionService as NativeChannelAbstractionService;
#[cfg(not(test))]
pub use native_channel_abstraction_native::ChannelAbstractionService;
#[cfg(not(test))]
pub use native_channel_abstraction_native::ChannelAbstractionService as NativeChannelAbstractionService;

// Re-export native provider router for easy access
#[cfg(test)]
pub use legacy_stubs::ProviderRouterBridge as NativeProviderRouterBridge;
#[cfg(not(test))]
pub use native_provider_router::ProviderRouterBridge as NativeProviderRouterBridge;

// Re-export native session manager native for easy access
#[cfg(test)]
pub use legacy_stubs::SessionManagerService as NativeSessionManagerService;
#[cfg(not(test))]
pub use native_session_manager_native::SessionManagerService as NativeSessionManagerService;

// Re-export native skill execution native for easy access
#[cfg(test)]
pub use legacy_stubs::SkillExecutionService as NativeSkillExecutionService;
#[cfg(not(test))]
pub use native_skill_execution_native::SkillExecutionService as NativeSkillExecutionService;

// Re-export native canvas A2UI native for easy access
#[cfg(test)]
pub use legacy_stubs::CanvasService as NativeCanvasService;
#[cfg(not(test))]
pub use native_canvas_a2ui_native::CanvasService as NativeCanvasService;

// Re-export native vector memory native for easy access
#[cfg(test)]
pub use legacy_stubs::VectorMemoryService as NativeVectorMemoryService;
#[cfg(not(test))]
pub use native_vector_memory_native::VectorMemoryService as NativeVectorMemoryService;

// Re-export native remaining channels for easy access
#[cfg(test)]
pub use legacy_stubs::ChannelService;
#[cfg(not(test))]
pub use native_remaining_channels::ChannelService;

// Re-export native iMessage bridge for easy access
#[cfg(test)]
pub use legacy_stubs::ImessageBridgeService;
#[cfg(not(test))]
pub use native_imessage_bridge::ImessageBridgeService;

// Re-export native final cleanup for easy access
#[cfg(test)]
pub use legacy_stubs::FinalCleanupService;
#[cfg(not(test))]
pub use native_final_cleanup::FinalCleanupService;

// Re-export native subprocess removal for easy access
#[cfg(test)]
pub use legacy_stubs::SubprocessRemovalService;
#[cfg(not(test))]
pub use native_subprocess_removal::SubprocessRemovalService;

// Re-export final integration verification for easy access
#[cfg(not(test))]
pub use final_integration_verification::IntegrationVerificationService;
#[cfg(test)]
pub use legacy_stubs::IntegrationVerificationService;

// Re-export native shell UI bridge for easy access
#[cfg(test)]
pub use legacy_stubs::ShellUiBridgeService;
#[cfg(not(test))]
pub use native_shell_ui_bridge::ShellUiBridgeService;

// Re-export native API gateway router for easy access
#[cfg(test)]
pub use legacy_stubs::ApiGatewayRouterService;
#[cfg(not(test))]
pub use native_api_gateway_router::ApiGatewayRouterService;

// Re-export native UI integration service for easy access
pub use native_ui_integration_service::UiIntegrationService as NativeUiIntegrationService;

// Re-export API types for ShellUI integration
pub use api::canvas::{
    CanvasOperationBody, CanvasOperationResponse, CanvasResponse, CreateCanvasRequest,
};
pub use api::chat::{ChatRequest, Delta, InjectRequest};
pub use api::sessions::{CreateSessionRequest, PatchSessionRequest, SessionResponse};
pub use api::tools::{ToolDefinitionResponse, ToolExecuteRequest, ToolExecuteResponse};
pub use api::{create_agent_router, AgentApiState};
