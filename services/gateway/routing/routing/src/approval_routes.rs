//! Approval Workflow Routes
//!
//! API endpoints for managing policy tier approvals.

use a2r_policy_tier_gating::{
    Approval, ApprovalRequirement, GateCheckRequest, GateCheckResult, PolicyTier,
    PolicyTierRegistry, TargetType, TierAssignment,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::AppState;

/// Approval workflow state
#[derive(Clone)]
pub struct ApprovalWorkflowState {
    pub registry: Arc<PolicyTierRegistry>,
}

impl ApprovalWorkflowState {
    pub fn new() -> Self {
        Self {
            registry: Arc::new(PolicyTierRegistry::new()),
        }
    }
}

impl Default for ApprovalWorkflowState {
    fn default() -> Self {
        Self::new()
    }
}

/// Create router for approval workflow routes
pub fn create_approval_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let approval_state = Arc::new(ApprovalWorkflowState::new());

    Router::new()
        // List all tier assignments
        .route("/api/v1/policy/assignments", get(list_assignments))
        // Get assignment by ID
        .route("/api/v1/policy/assignments/:id", get(get_assignment))
        // Create tier assignment
        .route("/api/v1/policy/assignments", post(create_assignment))
        // Add approval to assignment
        .route(
            "/api/v1/policy/assignments/:id/approvals",
            post(add_approval),
        )
        // Get approvals for assignment
        .route(
            "/api/v1/policy/assignments/:id/approvals",
            get(get_approvals),
        )
        // Perform gate check
        .route("/api/v1/policy/gate-check", post(gate_check))
        // Get pending approvals
        .route(
            "/api/v1/policy/pending-approvals",
            get(get_pending_approvals),
        )
        // Elevate tier
        .route("/api/v1/policy/assignments/:id/elevate", post(elevate_tier))
        // Revoke assignment
        .route("/api/v1/policy/assignments/:id", delete(delete_assignment))
        .with_state(approval_state)
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateAssignmentRequest {
    pub tier: String,
    pub target_type: String,
    pub target_id: String,
    pub justification: String,
    pub risk_level: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssignmentResponse {
    pub assignment_id: String,
    pub tier: String,
    pub target_type: String,
    pub target_id: String,
    pub assigned_by: String,
    pub assigned_at: String,
    pub justification: String,
    pub required_approvals: Vec<ApprovalRequirementResponse>,
    pub approvals: Vec<ApprovalResponse>,
    pub has_required_approvals: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApprovalRequirementResponse {
    pub required_role: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApprovalResponse {
    pub approver_id: String,
    pub role: String,
    pub approved_at: String,
    pub comments: String,
}

#[derive(Debug, Deserialize)]
pub struct AddApprovalRequest {
    pub approver_id: String,
    pub role: String,
    pub comments: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GateCheckRequestQuery {
    pub target_type: String,
    pub target_id: String,
    pub requested_tier: Option<String>,
    pub actor_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GateCheckResponse {
    pub allowed: bool,
    pub assigned_tier: String,
    pub effective_tier: String,
    pub violations: Vec<ViolationResponse>,
    pub required_escalations: Vec<EscalationResponse>,
    pub audit_log_ref: String,
}

#[derive(Debug, Serialize)]
pub struct ViolationResponse {
    pub violation_type: String,
    pub message: String,
    pub severity: String,
    pub suggestion: String,
}

#[derive(Debug, Serialize)]
pub struct EscalationResponse {
    pub to_tier: String,
    pub reason: String,
    pub required_approvals: Vec<ApprovalRequirementResponse>,
}

#[derive(Debug, Serialize)]
pub struct PendingApprovalResponse {
    pub assignment_id: String,
    pub target_type: String,
    pub target_id: String,
    pub tier: String,
    pub justification: String,
    pub required_approvals: Vec<ApprovalRequirementResponse>,
    pub current_approvals: Vec<ApprovalResponse>,
    pub missing_approvals: Vec<ApprovalRequirementResponse>,
}

#[derive(Debug, Deserialize)]
pub struct ElevateTierRequest {
    pub new_tier: String,
    pub elevated_by: String,
    pub justification: String,
}

// ============================================================================
// Handler Functions
// ============================================================================

/// List all tier assignments
async fn list_assignments(
    State(state): State<Arc<ApprovalWorkflowState>>,
) -> Json<Vec<AssignmentResponse>> {
    let assignments = state.registry.get_all_assignments().await;
    let mut responses = Vec::new();

    for assignment in assignments {
        let has_approvals = state
            .registry
            .has_required_approvals(&assignment.assignment_id)
            .await
            .unwrap_or(false);
        responses.push(assignment_to_response(assignment, has_approvals));
    }

    Json(responses)
}

/// Get assignment by ID
async fn get_assignment(
    State(state): State<Arc<ApprovalWorkflowState>>,
    Path(id): Path<String>,
) -> Result<Json<AssignmentResponse>, StatusCode> {
    let assignment = state
        .registry
        .get_assignment(&id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let has_approvals = state
        .registry
        .has_required_approvals(&id)
        .await
        .unwrap_or(false);
    Ok(Json(assignment_to_response(assignment, has_approvals)))
}

/// Create tier assignment
async fn create_assignment(
    State(state): State<Arc<ApprovalWorkflowState>>,
    Json(request): Json<CreateAssignmentRequest>,
) -> Result<Json<AssignmentResponse>, (StatusCode, String)> {
    let tier = parse_tier(&request.tier)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid tier".to_string()))?;
    let tier_str = format!("{:?}", tier);

    let target_type = parse_target_type(&request.target_type)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid target type".to_string()))?;

    let risk_level = request.risk_level.as_deref().unwrap_or("moderate");
    let risk_assessment = a2r_policy_tier_gating::RiskAssessment {
        level: parse_risk_level(risk_level),
        factors: vec![format!("Auto-assigned: {}", request.justification)],
        mitigations: vec![],
        residual_risk: parse_risk_level(risk_level),
    };

    let assignment = state
        .registry
        .create_assignment(
            tier,
            target_type,
            &request.target_id,
            "api-service",
            &request.justification,
            risk_assessment,
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_approvals = state
        .registry
        .has_required_approvals(&assignment.assignment_id)
        .await
        .unwrap_or(false);

    info!(
        "Created tier assignment: {} -> {}",
        assignment.assignment_id, tier_str
    );
    Ok(Json(assignment_to_response(assignment, has_approvals)))
}

/// Add approval to assignment
async fn add_approval(
    State(state): State<Arc<ApprovalWorkflowState>>,
    Path(id): Path<String>,
    Json(request): Json<AddApprovalRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let approval = Approval {
        approver_id: request.approver_id.clone(),
        role: request.role.clone(),
        approved_at: Utc::now(),
        comments: request.comments.unwrap_or_default(),
    };

    state
        .registry
        .add_approval(&id, approval)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    info!(
        "Added approval to assignment: {} by {}",
        id, request.approver_id
    );
    Ok(StatusCode::OK)
}

/// Get approvals for assignment
async fn get_approvals(
    State(state): State<Arc<ApprovalWorkflowState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ApprovalResponse>>, StatusCode> {
    let assignment = state
        .registry
        .get_assignment(&id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let approvals: Vec<ApprovalResponse> = assignment
        .approvals
        .into_iter()
        .map(|a| ApprovalResponse {
            approver_id: a.approver_id,
            role: a.role,
            approved_at: a.approved_at.to_rfc3339(),
            comments: a.comments,
        })
        .collect();

    Ok(Json(approvals))
}

/// Perform gate check
async fn gate_check(
    State(state): State<Arc<ApprovalWorkflowState>>,
    Query(query): Query<GateCheckRequestQuery>,
) -> Result<Json<GateCheckResponse>, (StatusCode, String)> {
    let target_type = parse_target_type(&query.target_type)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid target type".to_string()))?;

    let requested_tier = query
        .requested_tier
        .as_deref()
        .and_then(parse_tier)
        .unwrap_or(PolicyTier::Standard);

    let request = GateCheckRequest {
        request_id: format!("gate-{}", uuid::Uuid::new_v4().simple()),
        target_type,
        target_id: query.target_id.clone(),
        operation: "execute".to_string(),
        context: a2r_policy_tier_gating::OperationContext {
            actor_id: query
                .actor_id
                .clone()
                .unwrap_or_else(|| "api-service".to_string()),
            session_id: "api-session".to_string(),
            data_sensitivity: vec![],
            environment: "production".to_string(),
            metadata: HashMap::new(),
        },
        requested_tier,
    };

    let result = state
        .registry
        .gate_check(request)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(gate_check_to_response(result)))
}

/// Get pending approvals
async fn get_pending_approvals(
    State(state): State<Arc<ApprovalWorkflowState>>,
) -> Json<Vec<PendingApprovalResponse>> {
    let assignments = state.registry.get_all_assignments().await;
    let mut responses = Vec::new();

    for assignment in assignments {
        let has_approvals = state
            .registry
            .has_required_approvals(&assignment.assignment_id)
            .await
            .unwrap_or(false);
        if !has_approvals {
            responses.push(assignment_to_pending_response(assignment));
        }
    }

    Json(responses)
}

/// Elevate tier
async fn elevate_tier(
    State(state): State<Arc<ApprovalWorkflowState>>,
    Path(id): Path<String>,
    Json(request): Json<ElevateTierRequest>,
) -> Result<Json<AssignmentResponse>, (StatusCode, String)> {
    let new_tier = parse_tier(&request.new_tier)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid tier".to_string()))?;

    let assignment = state
        .registry
        .elevate_tier(
            &id,
            new_tier.clone(),
            &request.elevated_by,
            &request.justification,
        )
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let has_approvals = state
        .registry
        .has_required_approvals(&id)
        .await
        .unwrap_or(false);
    let tier_str = format!("{:?}", new_tier);

    info!("Elevated tier for assignment: {} -> {}", id, tier_str);
    Ok(Json(assignment_to_response(assignment, has_approvals)))
}

/// Delete assignment
async fn delete_assignment(
    State(state): State<Arc<ApprovalWorkflowState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    state
        .registry
        .revoke_assignment(&id, "api-service")
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    info!("Revoked assignment: {}", id);
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_tier(tier_str: &str) -> Option<PolicyTier> {
    match tier_str.to_lowercase().as_str() {
        "minimal" => Some(PolicyTier::Minimal),
        "standard" => Some(PolicyTier::Standard),
        "elevated" => Some(PolicyTier::Elevated),
        "highassurance" | "high_assurance" | "high" => Some(PolicyTier::HighAssurance),
        "critical" => Some(PolicyTier::Critical),
        _ => None,
    }
}

fn parse_target_type(type_str: &str) -> Option<TargetType> {
    match type_str.to_lowercase().as_str() {
        "tool" => Some(TargetType::Tool),
        "workflow" => Some(TargetType::Workflow),
        "operation" => Some(TargetType::Operation),
        "agent" => Some(TargetType::Agent),
        "session" => Some(TargetType::Session),
        _ => None,
    }
}

fn parse_risk_level(level_str: &str) -> a2r_policy_tier_gating::RiskLevel {
    match level_str.to_lowercase().as_str() {
        "minimal" => a2r_policy_tier_gating::RiskLevel::Minimal,
        "low" => a2r_policy_tier_gating::RiskLevel::Low,
        "moderate" => a2r_policy_tier_gating::RiskLevel::Moderate,
        "high" => a2r_policy_tier_gating::RiskLevel::High,
        "critical" => a2r_policy_tier_gating::RiskLevel::Critical,
        _ => a2r_policy_tier_gating::RiskLevel::Moderate,
    }
}

fn assignment_to_response(assignment: TierAssignment, has_approvals: bool) -> AssignmentResponse {
    AssignmentResponse {
        assignment_id: assignment.assignment_id,
        tier: format!("{:?}", assignment.tier),
        target_type: format!("{:?}", assignment.target_type),
        target_id: assignment.target_id,
        assigned_by: assignment.assigned_by,
        assigned_at: assignment.assigned_at.to_rfc3339(),
        justification: assignment.justification,
        required_approvals: assignment
            .required_approvals
            .into_iter()
            .map(|r| ApprovalRequirementResponse {
                required_role: r.required_role,
                count: r.count,
            })
            .collect(),
        approvals: assignment
            .approvals
            .into_iter()
            .map(|a| ApprovalResponse {
                approver_id: a.approver_id,
                role: a.role,
                approved_at: a.approved_at.to_rfc3339(),
                comments: a.comments,
            })
            .collect(),
        has_required_approvals: has_approvals,
    }
}

fn assignment_to_pending_response(assignment: TierAssignment) -> PendingApprovalResponse {
    let required: Vec<_> = assignment
        .required_approvals
        .iter()
        .map(|r| ApprovalRequirementResponse {
            required_role: r.required_role.clone(),
            count: r.count,
        })
        .collect();

    let current: Vec<_> = assignment
        .approvals
        .iter()
        .map(|a| ApprovalResponse {
            approver_id: a.approver_id.clone(),
            role: a.role.clone(),
            approved_at: a.approved_at.to_rfc3339(),
            comments: a.comments.clone(),
        })
        .collect();

    // Calculate missing approvals
    let mut missing = Vec::new();
    for req in &assignment.required_approvals {
        let count = assignment
            .approvals
            .iter()
            .filter(|a| a.role == req.required_role)
            .count();
        if count < req.count {
            missing.push(ApprovalRequirementResponse {
                required_role: req.required_role.clone(),
                count: req.count - count,
            });
        }
    }

    PendingApprovalResponse {
        assignment_id: assignment.assignment_id,
        target_type: format!("{:?}", assignment.target_type),
        target_id: assignment.target_id,
        tier: format!("{:?}", assignment.tier),
        justification: assignment.justification,
        required_approvals: required,
        current_approvals: current,
        missing_approvals: missing,
    }
}

fn gate_check_to_response(result: GateCheckResult) -> GateCheckResponse {
    GateCheckResponse {
        allowed: result.allowed,
        assigned_tier: format!("{:?}", result.assigned_tier),
        effective_tier: format!("{:?}", result.effective_tier),
        violations: result
            .violations
            .into_iter()
            .map(|v| ViolationResponse {
                violation_type: format!("{:?}", v.violation_type),
                message: v.message,
                severity: format!("{:?}", v.severity),
                suggestion: v.suggestion,
            })
            .collect(),
        required_escalations: result
            .required_escalations
            .into_iter()
            .map(|e| EscalationResponse {
                to_tier: format!("{:?}", e.to_tier),
                reason: e.reason,
                required_approvals: e
                    .required_approvals
                    .into_iter()
                    .map(|r| ApprovalRequirementResponse {
                        required_role: r.required_role,
                        count: r.count,
                    })
                    .collect(),
            })
            .collect(),
        audit_log_ref: result.audit_log_ref,
    }
}
