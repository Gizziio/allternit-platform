//! Wizard API Routes
//!
//! Route definitions for the deployment wizard.

use crate::handlers::*;
use crate::WizardAppState;
use axum::{
    Router,
    routing::{get, post},
};
use std::sync::Arc;

/// Create wizard router
pub fn create_wizard_router(state: Arc<WizardAppState>) -> Router {
    Router::new()
        // Provider endpoints
        .route("/api/v1/cloud/providers", get(get_providers))
        .route("/api/v1/cloud/providers/:id/regions", post(get_regions))
        .route("/api/v1/cloud/providers/:id/instances", post(get_instances))
        
        // Credential validation
        .route("/api/v1/cloud/credentials/validate", post(validate_credentials))
        
        // Cost estimation
        .route("/api/v1/cloud/cost/estimate", post(get_cost_estimate))
        
        // Deployment endpoints
        .route("/api/v1/cloud/deployments", post(start_deployment))
        .route("/api/v1/cloud/deployments/:id", get(get_deployment_status))
        
        .with_state(state)
}
