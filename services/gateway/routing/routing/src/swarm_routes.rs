//! Swarm Advanced API Routes
//!
//! Provides HTTP endpoints for swarm advanced features:
//! - Message bus monitoring
//! - Circuit breaker control
//! - Quarantine management

use allternit_swarm_advanced::{CircuitBreakerStatus, MessageStats, QuarantinedAgentStatus};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Request to reset a circuit breaker
#[derive(Debug, Deserialize)]
pub struct ResetCircuitBreakerRequest {
    pub agent_id: String,
}

/// Request to release from quarantine
#[derive(Debug, Deserialize)]
pub struct ReleaseFromQuarantineRequest {
    pub agent_id: String,
    pub reason: Option<String>,
}

/// Response for bulk operations
#[derive(Debug, Serialize)]
pub struct BulkOperationResponse {
    pub success: bool,
    pub affected_count: usize,
    pub message: String,
}

/// Create swarm advanced router from engine
pub fn swarm_advanced_router_from_engine() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Circuit Breaker endpoints
        .route(
            "/api/v1/swarm/circuit-breakers",
            get(list_circuit_breakers_from_engine),
        )
        .route(
            "/api/v1/swarm/circuit-breakers/:agent_id",
            get(get_circuit_breaker_from_engine),
        )
        .route(
            "/api/v1/swarm/circuit-breakers/:agent_id/reset",
            post(reset_circuit_breaker_from_engine),
        )
        // Quarantine endpoints
        .route(
            "/api/v1/swarm/quarantine",
            get(list_quarantined_from_engine),
        )
        .route(
            "/api/v1/swarm/quarantine/:agent_id",
            get(get_quarantined_agent_from_engine),
        )
        .route(
            "/api/v1/swarm/quarantine/:agent_id/release",
            post(release_from_quarantine_from_engine),
        )
        // Message stats endpoints
        .route(
            "/api/v1/swarm/messages/stats",
            get(get_message_stats_from_engine),
        )
        .route(
            "/api/v1/swarm/messages/stats/reset",
            post(reset_message_stats_from_engine),
        )
        // Health check
        .route("/api/v1/swarm/health", get(swarm_health_check))
}

// ============================================================================
// Engine-based Handlers (using actual crate engine)
// ============================================================================

/// List all circuit breakers from engine
async fn list_circuit_breakers_from_engine(
    State(state): State<Arc<crate::AppState>>,
) -> Json<Vec<CircuitBreakerStatus>> {
    let breakers = state.swarm_engine.get_all_circuit_breakers().await;
    Json(breakers)
}

/// Get a specific circuit breaker from engine
async fn get_circuit_breaker_from_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<CircuitBreakerStatus>, StatusCode> {
    state
        .swarm_engine
        .get_circuit_breaker(&agent_id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Reset a circuit breaker from engine
async fn reset_circuit_breaker_from_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(agent_id): Path<String>,
) -> StatusCode {
    state.swarm_engine.reset_circuit_breaker(&agent_id).await;
    StatusCode::OK
}

/// List quarantined agents from engine
async fn list_quarantined_from_engine(
    State(state): State<Arc<crate::AppState>>,
) -> Json<Vec<QuarantinedAgentStatus>> {
    let agents = state.swarm_engine.get_quarantined_agents_status().await;
    Json(agents)
}

/// Get a specific quarantined agent from engine
async fn get_quarantined_agent_from_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<QuarantinedAgentStatus>, StatusCode> {
    state
        .swarm_engine
        .get_quarantined_agent_status(&agent_id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Release from quarantine from engine
async fn release_from_quarantine_from_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(agent_id): Path<String>,
    Json(_payload): Json<ReleaseFromQuarantineRequest>,
) -> StatusCode {
    state.swarm_engine.release_from_quarantine(&agent_id).await;
    StatusCode::OK
}

/// Get message stats from engine
async fn get_message_stats_from_engine(
    State(state): State<Arc<crate::AppState>>,
) -> Json<MessageStats> {
    let stats = state.swarm_engine.get_message_stats().await;
    Json(stats)
}

/// Reset message stats from engine
async fn reset_message_stats_from_engine(
    State(_state): State<Arc<crate::AppState>>,
) -> Json<MessageStats> {
    // Reset would be implemented in engine if needed
    Json(MessageStats {
        messages_sent: 0,
        messages_received: 0,
        messages_failed: 0,
        avg_latency_ms: 0.0,
    })
}

// ============================================================================
// Health Check
// ============================================================================

/// Health check endpoint
///
/// GET /api/v1/swarm/health
pub async fn swarm_health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "swarm-advanced"
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let response = swarm_health_check().await;
        assert_eq!(response.0["status"], "healthy");
    }
}
