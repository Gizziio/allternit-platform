//! Wizard API Routes
//!
//! Route definitions for the BYO-VPS deployment wizard. The router is mounted
//! by allternit-cloud-api behind Clerk authentication, which injects an
//! [`handlers::AuthenticatedUser`] request extension for every handler.

use crate::handlers::*;
use crate::WizardAppState;
use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

/// Create wizard router
///
/// Generic over the outer state so the hosting service can merge the router
/// into its own state type (the wizard's state is already attached).
pub fn create_wizard_router<S>(state: Arc<WizardAppState>) -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        // Wizard session lifecycle
        .route("/api/v1/cloud/wizard/deployments", post(start_wizard))
        .route("/api/v1/cloud/wizard/deployments", get(list_wizards))
        .route(
            "/api/v1/cloud/wizard/deployments/:id",
            get(get_wizard_state),
        )
        .route(
            "/api/v1/cloud/wizard/deployments/:id",
            delete(delete_wizard),
        )
        .route(
            "/api/v1/cloud/wizard/deployments/:id/advance",
            post(advance_wizard),
        )
        .route(
            "/api/v1/cloud/wizard/deployments/:id/resume",
            post(resume_wizard),
        )
        .route(
            "/api/v1/cloud/wizard/deployments/:id/cancel",
            post(cancel_wizard),
        )
        // Bootstrap + registry insertion (long-running)
        .route(
            "/api/v1/cloud/wizard/deployments/:id/bootstrap",
            post(bootstrap_wizard),
        )
        .with_state(state)
}
