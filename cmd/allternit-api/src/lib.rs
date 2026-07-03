//! Allternit API Library
//!
//! Shared state and route handlers for the Allternit API.

pub mod agent_execution;
pub mod agent_routes;
pub mod agent_runtime_routes;
pub mod agent_session_routes;
pub mod agents_v1_routes;
pub mod alabs_routes;
pub mod automation_routes;
pub mod artifact_routes;
pub mod audit_log_routes;
pub mod auth;
pub mod backend_install_routes;
pub mod board_routes;
pub mod board_stream_routes;
pub mod chat_routes;
pub mod config;
pub mod conversation_routes;
pub mod cowork;
pub mod cowork_routes;
pub mod cowork_team_routes;
pub mod db;
pub mod error;
pub mod fallback_routes;
pub mod gizzi_chat_stream;
pub mod gizzi_completion;
pub mod h5i_routes;
pub mod health;
pub mod oauth_routes;
pub mod office_routes;
pub mod onboarding_routes;
pub mod aci_routes;
pub mod analytics_routes;
pub mod playground_routes;
pub mod checkpoints_routes;
pub mod design_connector_routes;
pub mod file_routes;
pub mod inbox_routes;
pub mod local_brain_routes;
pub mod me_routes;
pub mod memory_routes;
pub mod metrics;
pub mod mcp_routes;
pub mod platform_static;
pub mod provider_routes;
pub mod rails;
pub mod rails_client_impl;
pub mod runtime_backend_routes;
pub mod runtime_discover_routes;
pub mod sandbox_routes;
pub mod secrets;
pub mod ssh_key_routes;
pub mod ssh_routes;
pub mod status_routes;
pub mod stream;
pub mod swarm_routes;
pub mod task_routes;
pub mod queue_routes;
pub mod team_skill_routes;
pub mod terminal_routes;
pub mod tool_routes;
pub mod v1_routes;
pub mod viz_routes;
pub mod vm_session_routes;
pub mod webhook_routes;
pub mod web_proxy_routes;
pub mod workflow_routes;
pub mod workspace_routes;

use auth::{AuthConfig, JwksManager};
use config::AppConfig;
use db::DbHandle;
use rails::RailsState;
use vm_session_routes::VmSessionStore;
use cowork::background_service::BackgroundServiceHandle;
use allternit_cowork_scheduler::Scheduler;
use allternit_cowork_runtime::RunManager;
use std::sync::Arc;
use tokio::sync::RwLock;

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
}

/// Return the default LLM provider/model pair used when a request does not
/// specify one. Reads from the unified app config (file + env overrides).
/// Falls back to `kimi-for-coding/kimi-k2`.
pub fn default_model() -> (String, String) {
    APP_CONFIG
        .get()
        .map(|c| c.default_model())
        .unwrap_or_else(|| ("kimi-for-coding".to_string(), "kimi-k2".to_string()))
}
