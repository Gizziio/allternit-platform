//! Allternit API Library
//!
//! Shared state and route handlers for the Allternit API.

pub mod agent_routes;
pub mod agent_runtime_routes;
pub mod agent_session_routes;
pub mod agents_v1_routes;
pub mod alabs_routes;
pub mod artifact_routes;
pub mod audit_log_routes;
pub mod auth;
pub mod backend_install_routes;
pub mod board_routes;
pub mod board_stream_routes;
pub mod chat_routes;
pub mod conversation_routes;
pub mod cowork;
pub mod cowork_routes;
pub mod cowork_team_routes;
pub mod db;
pub mod error;
pub mod fallback_routes;
pub mod h5i_routes;
pub mod oauth_routes;
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
pub mod ssh_key_routes;
pub mod ssh_routes;
pub mod status_routes;
pub mod stream;
pub mod swarm_routes;
pub mod task_routes;
pub mod team_skill_routes;
pub mod terminal_routes;
pub mod tool_routes;
pub mod v1_routes;
pub mod viz_routes;
pub mod vm_session_routes;
pub mod webhook_routes;
pub mod workflow_routes;
pub mod workspace_routes;

use auth::JwksManager;
use db::DbHandle;
use rails::RailsState;
use vm_session_routes::VmSessionStore;
use cowork::background_service::BackgroundServiceHandle;
use allternit_cowork_scheduler::Scheduler;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Application state shared across all route handlers
pub struct AppState {
    /// SQLite database handle
    pub db: DbHandle,
    /// Clerk JWKS manager for JWT verification
    pub jwks: JwksManager,
    /// VM execution driver (Firecracker on Linux, Apple VF on macOS)
    pub vm_driver: Option<Box<dyn allternit_driver_interface::ExecutionDriver>>,
    /// Rails service state (Ledger, Gate, Leases, etc.)
    pub rails: RailsState,
    /// Persistent VM sessions — each gizzi-code session gets one VM that stays
    /// alive for the entire session lifetime (not torn down between exec calls).
    pub vm_sessions: VmSessionStore,
    /// Cowork cron scheduler — runs enabled tasks on their configured intervals.
    pub cowork_scheduler: Option<Arc<RwLock<Scheduler>>>,
    /// Cowork background service — periodic autonomous loop for proactive suggestions.
    pub cowork_background: Option<BackgroundServiceHandle>,
    /// Webhook secret for verifying incoming webhooks
    pub webhook_secret: Option<String>,
}
