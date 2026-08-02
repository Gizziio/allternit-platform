//! Allternit API Library
//!
//! Shared state and route handlers for the Allternit API.

pub mod aci_routes;
pub mod agent_execution;
pub mod agent_operations_routes;
pub mod agent_preferences_routes;
pub mod agent_routes;
pub mod agent_runtime_routes;
pub mod agent_session_routes;
pub mod agent_workspace_paths;
pub mod agent_workspace_routes;
pub mod agents_v1_routes;
pub mod alabs_routes;
pub mod analytics_routes;
pub mod artifact_routes;
pub mod audit_log_routes;
pub mod auth;
pub mod automation_routes;
pub mod backend_install_routes;
pub mod billing;
pub mod board_routes;
pub mod board_stream_routes;
pub mod brain_routes;
pub mod canvas_routes;
pub mod chat_routes;
pub mod checkpoints_routes;
pub mod cloud_credentials_routes;
pub mod config;
pub mod connector_routes;
pub mod conversation_routes;
pub mod cowork;
pub mod cowork_routes;
pub mod cowork_team_routes;
pub mod db;
pub mod design_connector_routes;
pub mod error;
pub mod fallback_routes;
pub mod file_routes;
pub mod gizzi_chat_stream;
pub mod gizzi_completion;
pub mod gizzi_provider_auth;
pub mod h5i_routes;
pub mod health;
pub mod inbox_routes;
pub mod internal_auth;
pub mod internal_routes;
pub mod library_routes;
pub mod llm_gateway;
pub mod local_brain_routes;
pub mod mcp_routes;
pub mod mcp_server_routes;
pub mod me_routes;
pub mod memory_routes;
pub mod metrics;
pub mod oauth_routes;
pub mod office_cli_mcp;
pub mod office_cli_routes;
pub mod office_routes;
pub mod onboarding_routes;
pub mod open_connector_proxy;
pub mod orchestrator_routes;
pub mod platform_static;
pub mod playground_routes;
pub mod pricing;
pub mod provider_routes;
pub mod queue_routes;
pub mod rails;
pub mod rails_client_impl;
pub mod rbac;
pub mod runtime_backend_routes;
pub mod runtime_discover_routes;
pub mod sandbox_routes;
pub mod slack_webhook_routes;
pub mod ssh_key_routes;
pub mod ssh_routes;
pub mod status_routes;
pub mod stream;
pub mod swarm_routes;
pub mod task_routes;
pub mod team_skill_routes;
pub mod terminal_routes;
pub mod token_crypto;
pub mod tool_routes;
pub mod upload_routes;
pub mod usage_routes;
pub mod v1_routes;
pub mod viz_routes;
pub mod vm_session_routes;
pub mod web_proxy_routes;
pub mod webhook_routes;
pub mod workflow_routes;
pub mod workspace_routes;

use allternit_cowork_runtime::RunManager;
use allternit_cowork_scheduler::Scheduler;
use auth::{AuthConfig, JwksManager};
use config::AppConfig;
use cowork::background_service::BackgroundServiceHandle;
use db::DbHandle;
use design_connector_routes::DesignSkillCache;
use rails::RailsState;
use std::sync::Arc;
use terminal_routes::TerminalSessionStore;
use tokio::sync::RwLock;
use vm_session_routes::VmSessionStore;

/// Globally accessible application configuration, initialized once at startup.
/// Routes and helpers that do not receive `AppState` can read from here so the
/// entire crate uses the same layered config.
pub static APP_CONFIG: once_cell::sync::OnceCell<AppConfig> = once_cell::sync::OnceCell::new();

/// Initialize the global configuration. Must be called exactly once, from
/// `main`, before any route handler runs.
pub fn init_app_config() -> &'static AppConfig {
    APP_CONFIG.get_or_init(AppConfig::load)
}

/// Office runtime state (bindings + sessions) — kept in memory for concurrency safety
pub type OfficeRuntimeState = Arc<RwLock<crate::office_routes::OfficeRuntimeFile>>;

/// OfficeCLI document registry — in-memory mirror of `<office_cli_dir>/docs.json`.
pub type OfficeCliDocsState =
    Arc<RwLock<std::collections::HashMap<uuid::Uuid, crate::office_cli_routes::OfficeCliDoc>>>;

/// Live `officecli watch` child processes keyed by doc_id (not serialized).
pub type OfficeCliWatchState =
    Arc<RwLock<std::collections::HashMap<uuid::Uuid, tokio::process::Child>>>;

/// OfficeCLI MCP stdio sessions, one per user_id.
pub type OfficeCliMcpState =
    Arc<RwLock<std::collections::HashMap<String, crate::office_cli_mcp::McpSession>>>;

/// Application state shared across all route handlers
pub struct AppState {
    /// Unified app configuration (company + user + env overrides)
    pub config: AppConfig,
    /// SQLite database handle
    pub db: DbHandle,
    /// Clerk JWKS manager for JWT verification
    pub jwks: JwksManager,
    /// Unified auth configuration
    pub auth_config: AuthConfig,
    /// VM execution driver (Firecracker on Linux, Apple VF on macOS)
    pub vm_driver: Option<Arc<dyn allternit_driver_interface::ExecutionDriver>>,
    /// Rails service state (Ledger, Gate, Leases, etc.)
    pub rails: RailsState,
    /// Persistent VM sessions — each gizzi-code session gets one VM that stays
    /// alive for the entire session lifetime (not torn down between exec calls).
    pub vm_sessions: VmSessionStore,
    /// Cowork cron scheduler — runs enabled tasks on their configured intervals.
    pub cowork_scheduler: Option<Arc<RwLock<Scheduler>>>,
    /// Cowork background service — periodic autonomous loop for proactive suggestions.
    pub cowork_background: Option<BackgroundServiceHandle>,
    /// Cowork runtime run manager — persistent, detachable run lifecycle.
    pub cowork_run_manager: Option<Arc<RunManager>>,
    /// Webhook secret for verifying incoming webhooks
    pub webhook_secret: Option<String>,
    /// Office add-in runtime bindings and sessions
    pub office_runtime: OfficeRuntimeState,
    /// OfficeCLI document registry (snapshot docs uploaded by the add-in)
    pub office_cli_docs: OfficeCliDocsState,
    /// Live `officecli watch` preview processes keyed by doc_id
    pub office_cli_watches: OfficeCliWatchState,
    /// OfficeCLI MCP stdio sessions, one per user
    pub office_cli_mcp_sessions: OfficeCliMcpState,
    /// Daemon-side Open Design skill cache with hot-reload semantics.
    pub design_skill_cache: DesignSkillCache,
    /// Local tmux-backed terminal sessions for Code Mode.
    pub terminal_sessions: TerminalSessionStore,
}

/// Return the default LLM provider/model pair used when a request does not
/// specify one. Reads from the unified app config (file + env overrides).
/// Returns empty strings when nothing is configured; callers fall back to the
/// local Ollama brain rather than a hardcoded provider.
pub fn default_model() -> (String, String) {
    APP_CONFIG
        .get()
        .map(|c| c.default_model())
        .unwrap_or_else(|| (String::new(), String::new()))
}
