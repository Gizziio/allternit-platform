//! Rails System Integration
//!
//! This crate now delegates to the canonical rails HTTP service implementation
//! from `a2r-agent-system-rails` instead of carrying a stale local copy.

use std::sync::Arc;

use axum::Router;

pub type RailsState = allternit_agent_system_rails::service::ServiceState;

pub fn rails_router(state: RailsState) -> Router {
    allternit_agent_system_rails::service::create_router(Arc::new(state))
}
