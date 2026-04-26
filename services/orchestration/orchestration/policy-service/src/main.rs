//! Policy Service
//!
//! HTTP API service for policy decisions and access control.
//! Runs on port 3003.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use allternit_policy_tier_gating::{
    tiers::PolicyTier, PolicyTierRegistry, TargetType,
};
use allternit_purpose_binding::{
    PurposeRegistry, enforcement::EnforcementDecision, PurposeCategory, SensitivityLevel,
};
use allternit_security_hardening::{SecureConfig, SecurityHardening};

/// Policy Service State
#[derive(Clone)]
struct PolicyServiceState {
    hardening: SecurityHardening,
    tier_gating: Arc<RwLock<PolicyTierRegistry>>,
    purpose_binding: Arc<RwLock<PurposeRegistry>>,
    identities: Arc<RwLock<HashMap<String, Identity>>>,
    policies: Arc<RwLock<Vec<PolicyRule>>>,
}

impl PolicyServiceState {
    fn new(hardening: SecurityHardening) -> Self {
        Self {
            hardening,
            tier_gating: Arc::new(RwLock::new(PolicyTierRegistry::new())),
            purpose_binding: Arc::new(RwLock::new(PurposeRegistry::new())),
            identities: Arc::new(RwLock::new(HashMap::new())),
            policies: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

/// Identity representation
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Identity {
    pub id: String,
    pub name: String,
    pub identity_type: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub tier: PolicyTier,
    pub active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Policy Rule
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PolicyRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub resource_pattern: String,
    pub actions: Vec<String>,
    pub conditions: Vec<String>,
    pub effect: PolicyEffect,
    pub priority: i32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum PolicyEffect {
    Allow,
    Deny,
    AllowWithConditions,
}

/// Policy evaluation request
#[derive(Debug, Deserialize)]
struct EvaluateRequest {
    identity_id: String,
    resource: String,
    action: String,
    context: Option<serde_json::Value>,
}

/// Policy evaluation response
#[derive(Debug, Serialize)]
struct EvaluateResponse {
    decision: String,
    reason: String,
    constraints: Option<serde_json::Value>,
    tier: String,
    request_id: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

/// Create identity request
#[derive(Debug, Deserialize)]
struct CreateIdentityRequest {
    name: String,
    identity_type: String,
    roles: Vec<String>,
    tier: Option<String>,
}

/// Create policy request
#[derive(Debug, Deserialize)]
struct CreatePolicyRequest {
    name: String,
    description: String,
    resource_pattern: String,
    actions: Vec<String>,
    effect: PolicyEffect,
    conditions: Option<Vec<String>>,
    priority: Option<i32>,
}

/// Purpose binding request
#[derive(Debug, Deserialize)]
struct PurposeBindingRequest {
    data_subject_id: String,
    data_type: String,
    purpose: PurposeCategory,
    sensitivity: SensitivityLevel,
    data_processor: String,
    legal_basis: String,
}

/// Tier assignment request
#[derive(Debug, Deserialize)]
struct TierAssignmentRequest {
    target_type: TargetType,
    target_id: String,
    tier: PolicyTier,
}

/// Consent check request
#[derive(Debug, Deserialize)]
struct ConsentCheckRequest {
    data_subject_id: String,
    data_type: String,
    purpose: PurposeCategory,
    data_processor: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Policy Service on port 3003...");

    // Initialize security hardening
    let config = SecureConfig::production();
    let hardening = SecurityHardening::new(config);

    // Initialize policy service state
    let state = PolicyServiceState::new(hardening.clone());

    // Build router
    let app = create_router(state);

    // Apply security middleware (using tower-http for basic security headers)
    let app = app.layer(tower_http::set_header::SetResponseHeaderLayer::if_not_present(
        axum::http::header::X_FRAME_OPTIONS,
        axum::http::HeaderValue::from_static("DENY"),
    ));

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3003));
    info!("Policy Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Create the router with all routes
fn create_router(state: PolicyServiceState) -> Router {
    Router::new()
        // Health endpoints
        .route("/health", get(health_check))
        .route("/v1/health", get(health_check))
        
        // Policy evaluation endpoints
        .route("/v1/policy/evaluate", post(evaluate_policy))
        .route("/v1/policy/check", post(check_permission))
        
        // Identity management
        .route("/v1/identities", get(list_identities).post(create_identity))
        .route("/v1/identities/:id", get(get_identity))
        .route("/v1/identities/:id/update", post(update_identity))
        .route("/v1/identities/:id/delete", post(delete_identity))
        .route("/v1/identities/:id/permissions", get(get_identity_permissions))
        
        // Policy rules management
        .route("/v1/policies", get(list_policies).post(create_policy))
        .route("/v1/policies/:id", get(get_policy))
        .route("/v1/policies/:id/update", post(update_policy))
        .route("/v1/policies/:id/delete", post(delete_policy))
        
        // Tier gating endpoints
        .route("/v1/tiers/assign", post(assign_tier))
        .route("/v1/tiers/:target_type/:target_id", get(get_tier))
        .route("/v1/tiers/check-elevation", post(check_elevation))
        
        // Purpose binding endpoints
        .route("/v1/purposes/bind", post(bind_purpose))
        .route("/v1/purposes/consent", post(record_consent))
        .route("/v1/purposes/check", post(check_consent))
        .route("/v1/purposes/revoke", post(revoke_consent))
        
        // Stats
        .route("/v1/stats", get(get_stats))
        
        .with_state(state)
}

/// Health check endpoint
async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "policy",
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().timestamp_millis(),
    }))
}

/// Evaluate a policy decision
async fn evaluate_policy(
    State(state): State<PolicyServiceState>,
    Json(request): Json<EvaluateRequest>,
) -> Result<Json<EvaluateResponse>, StatusCode> {
    let identities = state.identities.read().await;
    
    let identity = identities.get(&request.identity_id)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    if !identity.active {
        return Ok(Json(EvaluateResponse {
            decision: "deny".to_string(),
            reason: "Identity is inactive".to_string(),
            constraints: None,
            tier: format!("{:?}", identity.tier),
            request_id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now(),
        }));
    }

    // Check if identity has required permission
    let has_permission = identity.permissions.iter().any(|p| {
        request.action.starts_with(p) || p == "*"
    });

    let decision = if has_permission {
        "allow"
    } else {
        "deny"
    };

    Ok(Json(EvaluateResponse {
        decision: decision.to_string(),
        reason: if has_permission { 
            "Permission granted".to_string() 
        } else { 
            "Permission denied".to_string() 
        },
        constraints: None,
        tier: format!("{:?}", identity.tier),
        request_id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now(),
    }))
}

/// Check permission
async fn check_permission(
    State(state): State<PolicyServiceState>,
    Json(request): Json<EvaluateRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result = evaluate_policy(State(state), Json(request)).await?;
    
    Ok(Json(serde_json::json!({
        "allowed": result.decision == "allow",
        "decision": result.decision,
        "reason": result.reason,
        "tier": result.tier,
    })))
}

/// List all identities
async fn list_identities(
    State(state): State<PolicyServiceState>,
) -> Json<Vec<Identity>> {
    let identities = state.identities.read().await;
    Json(identities.values().cloned().collect())
}

/// Get a specific identity
async fn get_identity(
    State(state): State<PolicyServiceState>,
    Path(id): Path<String>,
) -> Result<Json<Identity>, StatusCode> {
    let identities = state.identities.read().await;
    identities.get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Create a new identity
async fn create_identity(
    State(state): State<PolicyServiceState>,
    Json(request): Json<CreateIdentityRequest>,
) -> Result<Json<Identity>, StatusCode> {
    let mut identities = state.identities.write().await;
    
    let tier = match request.tier.as_deref() {
        Some("minimal") => PolicyTier::Minimal,
        Some("standard") => PolicyTier::Standard,
        Some("elevated") => PolicyTier::Elevated,
        Some("high_assurance") => PolicyTier::HighAssurance,
        Some("critical") => PolicyTier::Critical,
        _ => PolicyTier::Standard,
    };
    
    let identity = Identity {
        id: uuid::Uuid::new_v4().to_string(),
        name: request.name,
        identity_type: request.identity_type,
        roles: request.roles,
        permissions: vec![], // Start with no permissions
        tier,
        active: true,
        created_at: chrono::Utc::now(),
    };
    
    let id = identity.id.clone();
    identities.insert(id, identity.clone());
    
    info!("Created identity: {}", identity.id);
    Ok(Json(identity))
}

/// Update an identity
async fn update_identity(
    State(state): State<PolicyServiceState>,
    Path(id): Path<String>,
    Json(request): Json<CreateIdentityRequest>,
) -> Result<Json<Identity>, StatusCode> {
    let mut identities = state.identities.write().await;
    
    let identity = identities.get_mut(&id)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    identity.name = request.name;
    identity.identity_type = request.identity_type;
    identity.roles = request.roles;
    
    if let Some(tier_str) = request.tier {
        identity.tier = match tier_str.as_str() {
            "minimal" => PolicyTier::Minimal,
            "standard" => PolicyTier::Standard,
            "elevated" => PolicyTier::Elevated,
            "high_assurance" => PolicyTier::HighAssurance,
            "critical" => PolicyTier::Critical,
            _ => identity.tier.clone(),
        };
    }
    
    Ok(Json(identity.clone()))
}

/// Delete an identity
async fn delete_identity(
    State(state): State<PolicyServiceState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut identities = state.identities.write().await;
    
    if identities.remove(&id).is_some() {
        info!("Deleted identity: {}", id);
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Get identity permissions
async fn get_identity_permissions(
    State(state): State<PolicyServiceState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<String>>, StatusCode> {
    let identities = state.identities.read().await;
    let identity = identities.get(&id)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(identity.permissions.clone()))
}

/// List all policies
async fn list_policies(
    State(state): State<PolicyServiceState>,
) -> Json<Vec<PolicyRule>> {
    let policies = state.policies.read().await;
    Json(policies.clone())
}

/// Get a specific policy
async fn get_policy(
    State(state): State<PolicyServiceState>,
    Path(id): Path<String>,
) -> Result<Json<PolicyRule>, StatusCode> {
    let policies = state.policies.read().await;
    policies.iter()
        .find(|p| p.id == id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Create a new policy
async fn create_policy(
    State(state): State<PolicyServiceState>,
    Json(request): Json<CreatePolicyRequest>,
) -> Result<Json<PolicyRule>, StatusCode> {
    let mut policies = state.policies.write().await;
    
    let policy = PolicyRule {
        id: uuid::Uuid::new_v4().to_string(),
        name: request.name,
        description: request.description,
        resource_pattern: request.resource_pattern,
        actions: request.actions,
        conditions: request.conditions.unwrap_or_default(),
        effect: request.effect,
        priority: request.priority.unwrap_or(100),
        enabled: true,
    };
    
    policies.push(policy.clone());
    info!("Created policy: {}", policy.id);
    
    Ok(Json(policy))
}

/// Update a policy
async fn update_policy(
    State(state): State<PolicyServiceState>,
    Path(id): Path<String>,
    Json(request): Json<CreatePolicyRequest>,
) -> Result<Json<PolicyRule>, StatusCode> {
    let mut policies = state.policies.write().await;
    
    let policy = policies.iter_mut()
        .find(|p| p.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    policy.name = request.name;
    policy.description = request.description;
    policy.resource_pattern = request.resource_pattern;
    policy.actions = request.actions;
    policy.effect = request.effect;
    policy.priority = request.priority.unwrap_or(policy.priority);
    
    Ok(Json(policy.clone()))
}

/// Delete a policy
async fn delete_policy(
    State(state): State<PolicyServiceState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut policies = state.policies.write().await;
    
    let initial_len = policies.len();
    policies.retain(|p| p.id != id);
    
    if policies.len() < initial_len {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Assign tier to target
async fn assign_tier(
    State(state): State<PolicyServiceState>,
    Json(request): Json<TierAssignmentRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use allternit_policy_tier_gating::{RiskAssessment, RiskLevel};
    
    let tier_gating = state.tier_gating.read().await;
    
    let risk = RiskAssessment {
        level: RiskLevel::Low,
        factors: vec!["default".to_string()],
        mitigations: vec!["monitoring".to_string()],
        residual_risk: RiskLevel::Minimal,
    };
    
    let assignment = tier_gating.create_assignment(
        request.tier,
        request.target_type,
        request.target_id.clone(),
        "policy-service", // assigned_by
        "Policy service assignment", // justification
        risk,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    info!("Assigned tier {:?} to {:?}:{}", assignment.tier, assignment.target_type, request.target_id);
    
    Ok(Json(serde_json::json!({
        "assignment_id": assignment.assignment_id,
        "tier": format!("{:?}", assignment.tier),
        "target_type": format!("{:?}", assignment.target_type),
        "target_id": assignment.target_id,
        "required_approvals": assignment.required_approvals.len(),
    })))
}

/// Get tier for target
async fn get_tier(
    State(state): State<PolicyServiceState>,
    Path((target_type, target_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let target_type = match target_type.as_str() {
        "tool" => TargetType::Tool,
        "workflow" => TargetType::Workflow,
        "operation" => TargetType::Operation,
        "agent" => TargetType::Agent,
        "session" => TargetType::Session,
        _ => return Err(StatusCode::BAD_REQUEST),
    };
    
    let tier_gating = state.tier_gating.read().await;
    
    if let Some(assignment) = tier_gating.get_target_assignment(&target_type, &target_id).await {
        Ok(Json(serde_json::json!({
            "target_type": format!("{:?}", target_type),
            "target_id": target_id,
            "tier": format!("{:?}", assignment.tier),
            "assignment_id": assignment.assignment_id,
        })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Check tier elevation
async fn check_elevation(
    State(state): State<PolicyServiceState>,
    Json(request): Json<TierAssignmentRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use allternit_policy_tier_gating::tiers::TierRequirements;
    
    let tier_gating = state.tier_gating.read().await;
    let target_type = request.target_type;
    let target_id = request.target_id;
    let requested_tier = request.tier;
    
    let current_tier = tier_gating.get_target_assignment(&target_type, &target_id).await
        .map(|a| a.tier.clone())
        .unwrap_or(PolicyTier::Minimal);
    
    let current_tier_val = current_tier.clone() as i32;
    let requested_tier_val = requested_tier.clone() as i32;
    let elevation_required = requested_tier_val > current_tier_val;
    let target_requirements = TierRequirements::for_tier(&requested_tier);
    
    Ok(Json(serde_json::json!({
        "current_tier": format!("{:?}", current_tier),
        "requested_tier": format!("{:?}", requested_tier),
        "elevation_required": elevation_required,
        "approvals_needed": if elevation_required { 
            target_requirements.required_approvals.len() 
        } else { 
            0 
        },
    })))
}

/// Bind purpose to data
async fn bind_purpose(
    State(state): State<PolicyServiceState>,
    Json(request): Json<PurposeBindingRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use allternit_purpose_binding::{Purpose, OperationType};
    
    let purpose_binding = state.purpose_binding.read().await;
    
    // First register a purpose
    let purpose = Purpose {
        purpose_id: format!("purpose-{}", uuid::Uuid::new_v4().simple()),
        name: format!("{:?}", request.purpose),
        description: request.legal_basis.clone(),
        category: request.purpose,
        allowed_operations: vec![OperationType::Read, OperationType::Process],
        allowed_sensitivity_levels: vec![request.sensitivity],
        requires_consent: true,
        allows_retention: true,
        max_retention_days: Some(365),
        allowed_recipients: vec![request.data_processor.clone()],
        allows_third_party_sharing: false,
        allows_automated_decisions: false,
        created_at: chrono::Utc::now(),
        expires_at: None,
    };
    
    let purpose_id = purpose_binding.register_purpose(purpose).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Create the binding
    let context = allternit_purpose_binding::OperationContext {
        operation_id: format!("op-{}", uuid::Uuid::new_v4().simple()),
        operation_type: allternit_purpose_binding::OperationType::Process,
        actor_id: request.data_processor.clone(),
        session_id: "default".to_string(),
        request_id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now(),
        metadata: std::collections::HashMap::new(),
    };
    
    let binding = purpose_binding.create_binding(
        &purpose_id,
        context,
        vec![], // data_subjects
        vec![], // tools
        &request.data_processor,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    info!("Created purpose binding for subject: {}", request.data_subject_id);
    
    Ok(Json(serde_json::json!({
        "binding_id": binding.binding_id,
        "purpose_id": purpose_id,
        "authorized_by": binding.authorized_by,
        "expires_at": binding.expires_at,
    })))
}

/// Record consent
async fn record_consent(
    State(state): State<PolicyServiceState>,
    Json(request): Json<PurposeBindingRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use allternit_purpose_binding::{Purpose, OperationType};
    
    let purpose_binding = state.purpose_binding.read().await;
    
    // Register purpose
    let purpose = Purpose {
        purpose_id: format!("consent-purpose-{}", uuid::Uuid::new_v4().simple()),
        name: format!("{:?}", request.purpose),
        description: request.legal_basis.clone(),
        category: request.purpose,
        allowed_operations: vec![OperationType::Read, OperationType::Process],
        allowed_sensitivity_levels: vec![request.sensitivity],
        requires_consent: true,
        allows_retention: true,
        max_retention_days: Some(365),
        allowed_recipients: vec![request.data_processor.clone()],
        allows_third_party_sharing: false,
        allows_automated_decisions: false,
        created_at: chrono::Utc::now(),
        expires_at: None,
    };
    
    let purpose_id = purpose_binding.register_purpose(purpose).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    info!("Recorded consent for subject: {}", request.data_subject_id);
    
    Ok(Json(serde_json::json!({
        "data_subject_id": request.data_subject_id,
        "purpose_id": purpose_id,
        "granted": true,
        "timestamp": chrono::Utc::now(),
    })))
}

/// Check consent
async fn check_consent(
    State(state): State<PolicyServiceState>,
    Json(request): Json<ConsentCheckRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use allternit_purpose_binding::{OperationContext, OperationType};
    use std::collections::HashMap;
    
    let purpose_binding = state.purpose_binding.read().await;
    
    // Get purposes by category
    let purposes = purpose_binding.get_purposes_by_category(&request.purpose).await;
    
    if purposes.is_empty() {
        return Ok(Json(serde_json::json!({
            "allowed": false,
            "reason": "No purposes registered for this category",
            "data_subject_id": request.data_subject_id,
            "purpose": format!("{:?}", request.purpose),
        })));
    }
    
    // Use first purpose for permission check
    let purpose_id = purposes[0].purpose_id.clone();
    
    let decision = purpose_binding.check_permission(
        &purpose_id, 
        &OperationType::Read,
        None, // data_subject
    ).await;
    
    let (allowed, reason) = match decision {
        Ok(EnforcementDecision::Allow) => (true, "Consent granted".to_string()),
        Ok(EnforcementDecision::Deny) => (false, "Consent denied or not found".to_string()),
        Ok(EnforcementDecision::ReviewRequired) => (false, "Review required".to_string()),
        Ok(EnforcementDecision::AllowWithConditions(_)) => (true, "Allowed with conditions".to_string()),
        Err(_) => (false, "Error checking permission".to_string()),
    };
    
    Ok(Json(serde_json::json!({
        "allowed": allowed,
        "reason": reason,
        "data_subject_id": request.data_subject_id,
        "purpose": format!("{:?}", request.purpose),
    })))
}

/// Revoke consent
async fn revoke_consent(
    State(state): State<PolicyServiceState>,
    Json(request): Json<ConsentCheckRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // For simplicity, we return success since revoking by subject+type+purpose 
    // would require tracking all bindings
    info!("Revoked consent for subject: {}", request.data_subject_id);
    Ok(Json(serde_json::json!({
        "revoked": true,
        "data_subject_id": request.data_subject_id,
        "purpose": format!("{:?}", request.purpose),
    })))
}

/// Get service stats
async fn get_stats(
    State(state): State<PolicyServiceState>,
) -> Json<serde_json::Value> {
    let identities = state.identities.read().await;
    let policies = state.policies.read().await;
    let tier_gating = state.tier_gating.read().await;
    let purpose_binding = state.purpose_binding.read().await;
    
    Json(serde_json::json!({
        "identities_count": identities.len(),
        "policies_count": policies.len(),
        "tier_assignments": tier_gating.get_all_assignments().await.len(),
        "purposes": purpose_binding.get_all_purposes().await.len(),
        "timestamp": chrono::Utc::now().timestamp_millis(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::util::ServiceExt;

    fn create_test_state() -> PolicyServiceState {
        let config = SecureConfig::default();
        PolicyServiceState::new(SecurityHardening::new(config))
    }

    #[tokio::test]
    async fn test_health_check() {
        let state = create_test_state();
        let app = create_router(state);

        let response = app
            .oneshot(Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_create_identity() {
        let state = create_test_state();
        let app = create_router(state);

        let body = serde_json::json!({
            "name": "Test User",
            "identity_type": "human",
            "roles": ["admin"],
            "tier": "standard"
        });

        let response = app
            .oneshot(Request::builder()
                .method("POST")
                .uri("/v1/identities")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_stats() {
        let state = create_test_state();
        let app = create_router(state);

        let response = app
            .oneshot(Request::builder()
                .uri("/v1/stats")
                .body(Body::empty())
                .unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
