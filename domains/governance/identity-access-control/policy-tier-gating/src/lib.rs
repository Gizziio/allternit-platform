//! Allternit Policy Tier Gating
//!
//! Provides tiered policy enforcement for different safety levels.
//! Ensures that operations are appropriate for their assigned policy tier.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

pub mod enforcement;
pub mod tiers;

pub use tiers::PolicyTier;

use enforcement::PolicyEnforcer;
use tiers::TierRequirements;

// ============================================================================
// Core Types
// ============================================================================

/// A policy tier assignment for an operation or workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierAssignment {
    /// Assignment ID
    pub assignment_id: String,
    /// The assigned tier
    pub tier: PolicyTier,
    /// What is being assigned (tool, workflow, operation)
    pub target_type: TargetType,
    /// ID of the target
    pub target_id: String,
    /// Who assigned this tier
    pub assigned_by: String,
    /// When it was assigned
    pub assigned_at: DateTime<Utc>,
    /// Expiration (if temporary)
    pub expires_at: Option<DateTime<Utc>>,
    /// Justification for the tier
    pub justification: String,
    /// Risk assessment
    pub risk_assessment: RiskAssessment,
    /// Required approvals
    pub required_approvals: Vec<ApprovalRequirement>,
    /// Approved by
    pub approvals: Vec<Approval>,
}

/// Target type for tier assignment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TargetType {
    Tool,
    Workflow,
    Operation,
    Agent,
    Session,
}

/// Risk assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    /// Risk level
    pub level: RiskLevel,
    /// Risk factors identified
    pub factors: Vec<String>,
    /// Mitigation strategies
    pub mitigations: Vec<String>,
    /// Residual risk after mitigation
    pub residual_risk: RiskLevel,
}

/// Risk levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Minimal,
    Low,
    Moderate,
    High,
    Critical,
}

/// Approval requirement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequirement {
    /// Role required to approve
    pub required_role: String,
    /// Minimum number of approvers with this role
    pub count: usize,
}

/// Approval record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Approval {
    /// Approver ID
    pub approver_id: String,
    /// Approver role
    pub role: String,
    /// Approval timestamp
    pub approved_at: DateTime<Utc>,
    /// Comments
    pub comments: String,
}

/// Tier gate check request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateCheckRequest {
    /// Request ID
    pub request_id: String,
    /// Target being checked
    pub target_type: TargetType,
    pub target_id: String,
    /// Operation being performed
    pub operation: String,
    /// Context for the operation
    pub context: OperationContext,
    /// Requested tier
    pub requested_tier: PolicyTier,
}

/// Operation context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationContext {
    /// User/agent performing the operation
    pub actor_id: String,
    /// Session ID
    pub session_id: String,
    /// Data sensitivity involved
    pub data_sensitivity: Vec<String>,
    /// Environment (production, staging, etc.)
    pub environment: String,
    /// Additional context
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Gate check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateCheckResult {
    pub request_id: String,
    pub allowed: bool,
    pub assigned_tier: PolicyTier,
    pub effective_tier: PolicyTier,
    pub violations: Vec<TierViolation>,
    pub required_escalations: Vec<EscalationRequirement>,
    pub audit_log_ref: String,
}

/// Tier violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierViolation {
    pub violation_type: ViolationType,
    pub message: String,
    pub severity: ViolationSeverity,
    pub suggestion: String,
}

/// Types of violations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ViolationType {
    TierMismatch,
    MissingApproval,
    RiskLevelTooHigh,
    EnvironmentMismatch,
    SensitivityMismatch,
    ExpiredAssignment,
}

/// Violation severity
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum ViolationSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Escalation requirement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscalationRequirement {
    pub to_tier: PolicyTier,
    pub reason: String,
    pub required_approvals: Vec<ApprovalRequirement>,
}

// ============================================================================
// Policy Tier Registry
// ============================================================================

/// Registry for managing policy tiers and assignments
pub struct PolicyTierRegistry {
    assignments: Arc<RwLock<HashMap<String, TierAssignment>>>,
    target_assignments: Arc<RwLock<HashMap<(TargetType, String), String>>>,
    enforcer: PolicyEnforcer,
    audit_log: Arc<RwLock<Vec<TierAuditEntry>>>,
}

/// Audit entry for tier-related actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierAuditEntry {
    pub entry_id: String,
    pub timestamp: DateTime<Utc>,
    pub action: TierAction,
    pub assignment_id: Option<String>,
    pub target_type: Option<TargetType>,
    pub target_id: Option<String>,
    pub actor_id: String,
    pub details: String,
}

/// Tier-related actions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TierAction {
    AssignmentCreated,
    AssignmentUpdated,
    AssignmentRevoked,
    GateCheckPassed,
    GateCheckFailed,
    EscalationRequired,
    ApprovalAdded,
    TierElevated,
    TierLowered,
}

impl PolicyTierRegistry {
    /// Create a new policy tier registry
    pub fn new() -> Self {
        Self {
            assignments: Arc::new(RwLock::new(HashMap::new())),
            target_assignments: Arc::new(RwLock::new(HashMap::new())),
            enforcer: PolicyEnforcer::new(),
            audit_log: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Create a tier assignment
    pub async fn create_assignment(
        &self,
        tier: PolicyTier,
        target_type: TargetType,
        target_id: impl Into<String>,
        assigned_by: impl Into<String>,
        justification: impl Into<String>,
        risk_assessment: RiskAssessment,
    ) -> Result<TierAssignment, TierError> {
        let target_id = target_id.into();
        let assignment_id = format!("tier-{}", uuid::Uuid::new_v4().simple());

        // Get tier requirements
        let requirements = TierRequirements::for_tier(&tier);

        let assignment = TierAssignment {
            assignment_id: assignment_id.clone(),
            tier: tier.clone(),
            target_type: target_type.clone(),
            target_id: target_id.clone(),
            assigned_by: assigned_by.into(),
            assigned_at: Utc::now(),
            expires_at: None,
            justification: justification.into(),
            risk_assessment,
            required_approvals: requirements.required_approvals,
            approvals: Vec::new(),
        };

        // Store assignment
        {
            let mut assignments = self.assignments.write().await;
            assignments.insert(assignment_id.clone(), assignment.clone());
        }

        // Map target to assignment
        {
            let mut target_assignments = self.target_assignments.write().await;
            target_assignments.insert(
                (target_type.clone(), target_id.clone()),
                assignment_id.clone(),
            );
        }

        self.audit(
            TierAction::AssignmentCreated,
            Some(&assignment_id),
            Some(&target_type),
            Some(&target_id),
            &assignment.assigned_by,
            "Tier assignment created",
        )
        .await;

        info!("Created tier assignment: {} -> {:?}", assignment_id, tier);
        Ok(assignment)
    }

    /// Get assignment by ID
    pub async fn get_assignment(&self, assignment_id: &str) -> Option<TierAssignment> {
        let assignments = self.assignments.read().await;
        assignments.get(assignment_id).cloned()
    }

    /// Get assignment for a target
    pub async fn get_target_assignment(
        &self,
        target_type: &TargetType,
        target_id: &str,
    ) -> Option<TierAssignment> {
        let target_assignments = self.target_assignments.read().await;
        let assignment_id = target_assignments
            .get(&(target_type.clone(), target_id.to_string()))
            .cloned();

        if let Some(id) = assignment_id {
            drop(target_assignments);
            self.get_assignment(&id).await
        } else {
            None
        }
    }

    /// Add approval to an assignment
    pub async fn add_approval(
        &self,
        assignment_id: &str,
        approval: Approval,
    ) -> Result<(), TierError> {
        let mut assignments = self.assignments.write().await;

        let assignment = assignments
            .get_mut(assignment_id)
            .ok_or_else(|| TierError::AssignmentNotFound(assignment_id.to_string()))?;

        // Check if approver has required role
        let has_required_role = assignment
            .required_approvals
            .iter()
            .any(|req| req.required_role == approval.role);

        if !has_required_role {
            return Err(TierError::InvalidApprover(
                approval.approver_id.clone(),
                approval.role.clone(),
            ));
        }

        assignment.approvals.push(approval.clone());

        self.audit(
            TierAction::ApprovalAdded,
            Some(assignment_id),
            Some(&assignment.target_type),
            Some(&assignment.target_id),
            &approval.approver_id,
            &format!(
                "Approval added by {} with role {}",
                approval.approver_id, approval.role
            ),
        )
        .await;

        info!(
            "Added approval to assignment: {} from {}",
            assignment_id, approval.approver_id
        );
        Ok(())
    }

    /// Check if assignment has all required approvals
    pub async fn has_required_approvals(&self, assignment_id: &str) -> Result<bool, TierError> {
        let assignments = self.assignments.read().await;

        let assignment = assignments
            .get(assignment_id)
            .ok_or_else(|| TierError::AssignmentNotFound(assignment_id.to_string()))?;

        // Count approvals by role
        let mut approval_counts: HashMap<String, usize> = HashMap::new();
        for approval in &assignment.approvals {
            *approval_counts.entry(approval.role.clone()).or_default() += 1;
        }

        // Check if all required approvals are met
        for requirement in &assignment.required_approvals {
            let count = approval_counts
                .get(&requirement.required_role)
                .copied()
                .unwrap_or(0);
            if count < requirement.count {
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Perform a gate check
    pub async fn gate_check(
        &self,
        request: GateCheckRequest,
    ) -> Result<GateCheckResult, TierError> {
        info!(
            "Performing gate check for {:?}: {}",
            request.target_type, request.target_id
        );

        // Get current assignment for target
        let assignment = self
            .get_target_assignment(&request.target_type, &request.target_id)
            .await;

        let assigned_tier = assignment
            .as_ref()
            .map(|a| a.tier.clone())
            .unwrap_or(PolicyTier::Standard);

        // Check for tier mismatch
        let mut violations = Vec::new();
        if request.requested_tier > assigned_tier {
            violations.push(TierViolation {
                violation_type: ViolationType::TierMismatch,
                message: format!(
                    "Requested tier {:?} exceeds assigned tier {:?}",
                    request.requested_tier, assigned_tier
                ),
                severity: ViolationSeverity::Error,
                suggestion: format!("Request escalation to {:?} tier", request.requested_tier),
            });
        }

        // Check for required approvals
        if let Some(ref assignment) = assignment {
            if !self
                .has_required_approvals(&assignment.assignment_id)
                .await?
            {
                violations.push(TierViolation {
                    violation_type: ViolationType::MissingApproval,
                    message: "Required approvals not obtained".to_string(),
                    severity: ViolationSeverity::Error,
                    suggestion: "Obtain required approvals before proceeding".to_string(),
                });
            }
        }

        // Use enforcer to determine effective tier
        let enforcement_result =
            self.enforcer
                .check_operation(&request, &assigned_tier, &violations);

        let allowed = enforcement_result.allowed
            && violations
                .iter()
                .all(|v| v.severity != ViolationSeverity::Error);

        let audit_ref = format!("audit-{}", uuid::Uuid::new_v4().simple());

        self.audit(
            if allowed {
                TierAction::GateCheckPassed
            } else {
                TierAction::GateCheckFailed
            },
            assignment.as_ref().map(|a| &a.assignment_id[..]),
            Some(&request.target_type),
            Some(&request.target_id),
            &request.context.actor_id,
            &format!(
                "Gate check {}: {} violations",
                if allowed { "passed" } else { "failed" },
                violations.len()
            ),
        )
        .await;

        Ok(GateCheckResult {
            request_id: request.request_id,
            allowed,
            assigned_tier,
            effective_tier: enforcement_result.effective_tier,
            violations,
            required_escalations: enforcement_result.required_escalations,
            audit_log_ref: audit_ref,
        })
    }

    /// Elevate tier for a target
    pub async fn elevate_tier(
        &self,
        assignment_id: &str,
        new_tier: PolicyTier,
        elevated_by: &str,
        justification: &str,
    ) -> Result<TierAssignment, TierError> {
        let mut assignments = self.assignments.write().await;

        let assignment = assignments
            .get_mut(assignment_id)
            .ok_or_else(|| TierError::AssignmentNotFound(assignment_id.to_string()))?;

        if new_tier <= assignment.tier {
            return Err(TierError::InvalidElevation(format!(
                "New tier {:?} must be higher than current {:?}",
                new_tier, assignment.tier
            )));
        }

        let old_tier = assignment.tier.clone();
        assignment.tier = new_tier.clone();

        // Update required approvals for new tier
        let requirements = TierRequirements::for_tier(&new_tier);
        assignment.required_approvals = requirements.required_approvals;

        self.audit(
            TierAction::TierElevated,
            Some(assignment_id),
            Some(&assignment.target_type),
            Some(&assignment.target_id),
            elevated_by,
            &format!(
                "Elevated from {:?} to {:?}: {}",
                old_tier, new_tier, justification
            ),
        )
        .await;

        info!(
            "Elevated tier for {}: {:?} -> {:?}",
            assignment_id, old_tier, new_tier
        );

        // Return a clone of the updated assignment
        Ok(assignment.clone())
    }

    /// Revoke a tier assignment
    pub async fn revoke_assignment(
        &self,
        assignment_id: &str,
        revoked_by: &str,
    ) -> Result<(), TierError> {
        let mut assignments = self.assignments.write().await;

        let assignment = assignments
            .remove(assignment_id)
            .ok_or_else(|| TierError::AssignmentNotFound(assignment_id.to_string()))?;

        // Remove target mapping
        {
            let mut target_assignments = self.target_assignments.write().await;
            target_assignments
                .remove(&(assignment.target_type.clone(), assignment.target_id.clone()));
        }

        self.audit(
            TierAction::AssignmentRevoked,
            Some(assignment_id),
            Some(&assignment.target_type),
            Some(&assignment.target_id),
            revoked_by,
            "Tier assignment revoked",
        )
        .await;

        info!("Revoked tier assignment: {}", assignment_id);
        Ok(())
    }

    /// Add audit entry
    async fn audit(
        &self,
        action: TierAction,
        assignment_id: Option<&str>,
        target_type: Option<&TargetType>,
        target_id: Option<&str>,
        actor_id: &str,
        details: &str,
    ) {
        let entry = TierAuditEntry {
            entry_id: format!("audit-{}", uuid::Uuid::new_v4().simple()),
            timestamp: Utc::now(),
            action,
            assignment_id: assignment_id.map(|s| s.to_string()),
            target_type: target_type.cloned(),
            target_id: target_id.map(|s| s.to_string()),
            actor_id: actor_id.to_string(),
            details: details.to_string(),
        };

        let mut audit_log = self.audit_log.write().await;
        audit_log.push(entry);
    }

    /// Get audit log
    pub async fn get_audit_log(&self) -> Vec<TierAuditEntry> {
        let audit_log = self.audit_log.read().await;
        audit_log.clone()
    }

    /// Get all assignments
    pub async fn get_all_assignments(&self) -> Vec<TierAssignment> {
        let assignments = self.assignments.read().await;
        assignments.values().cloned().collect()
    }

    /// Get assignments by tier
    pub async fn get_assignments_by_tier(&self, tier: &PolicyTier) -> Vec<TierAssignment> {
        let assignments = self.assignments.read().await;
        assignments
            .values()
            .filter(|a| &a.tier == tier)
            .cloned()
            .collect()
    }
}

impl Default for PolicyTierRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum TierError {
    #[error("Assignment not found: {0}")]
    AssignmentNotFound(String),

    #[error("Invalid approver: {0} with role {1}")]
    InvalidApprover(String, String),

    #[error("Invalid elevation: {0}")]
    InvalidElevation(String),

    #[error("Tier not available: {0}")]
    TierNotAvailable(String),

    #[error("Required approvals not met")]
    RequiredApprovalsNotMet,

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_risk_assessment() -> RiskAssessment {
        RiskAssessment {
            level: RiskLevel::Low,
            factors: vec!["test factor".to_string()],
            mitigations: vec!["test mitigation".to_string()],
            residual_risk: RiskLevel::Minimal,
        }
    }

    #[tokio::test]
    async fn test_assignment_creation() {
        let registry = PolicyTierRegistry::new();

        let assignment = registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        assert_eq!(assignment.tier, PolicyTier::Standard);
        assert_eq!(assignment.target_type, TargetType::Tool);
        assert_eq!(assignment.target_id, "tool-1");
    }

    #[tokio::test]
    async fn test_gate_check_pass() {
        let registry = PolicyTierRegistry::new();

        // Create assignment
        registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        // Add required approval for Standard tier
        let assignment = registry
            .get_target_assignment(&TargetType::Tool, "tool-1")
            .await
            .unwrap();

        if !assignment.required_approvals.is_empty() {
            registry
                .add_approval(
                    &assignment.assignment_id,
                    Approval {
                        approver_id: "approver-1".to_string(),
                        role: assignment.required_approvals[0].required_role.clone(),
                        approved_at: Utc::now(),
                        comments: "Approved".to_string(),
                    },
                )
                .await
                .unwrap();
        }

        // Gate check at same tier should pass
        let request = GateCheckRequest {
            request_id: "req-1".to_string(),
            target_type: TargetType::Tool,
            target_id: "tool-1".to_string(),
            operation: "execute".to_string(),
            context: OperationContext {
                actor_id: "user-1".to_string(),
                session_id: "session-1".to_string(),
                data_sensitivity: vec![],
                environment: "production".to_string(),
                metadata: HashMap::new(),
            },
            requested_tier: PolicyTier::Standard,
        };

        let result = registry.gate_check(request).await.unwrap();
        assert!(result.allowed);
    }

    #[tokio::test]
    async fn test_gate_check_tier_mismatch() {
        let registry = PolicyTierRegistry::new();

        // Create Standard assignment
        registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        // Gate check at higher tier should fail
        let request = GateCheckRequest {
            request_id: "req-1".to_string(),
            target_type: TargetType::Tool,
            target_id: "tool-1".to_string(),
            operation: "execute".to_string(),
            context: OperationContext {
                actor_id: "user-1".to_string(),
                session_id: "session-1".to_string(),
                data_sensitivity: vec![],
                environment: "production".to_string(),
                metadata: HashMap::new(),
            },
            requested_tier: PolicyTier::HighAssurance,
        };

        let result = registry.gate_check(request).await.unwrap();
        assert!(!result.allowed);
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::TierMismatch));
    }

    #[tokio::test]
    async fn test_tier_elevation() {
        let registry = PolicyTierRegistry::new();

        let assignment = registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        let elevated = registry
            .elevate_tier(
                &assignment.assignment_id,
                PolicyTier::HighAssurance,
                "admin",
                "Needs higher tier",
            )
            .await
            .unwrap();

        assert_eq!(elevated.tier, PolicyTier::HighAssurance);
    }

    #[tokio::test]
    async fn test_assignment_revocation() {
        let registry = PolicyTierRegistry::new();

        let assignment = registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        registry
            .revoke_assignment(&assignment.assignment_id, "admin")
            .await
            .unwrap();

        assert!(registry
            .get_assignment(&assignment.assignment_id)
            .await
            .is_none());
        assert!(registry
            .get_target_assignment(&TargetType::Tool, "tool-1")
            .await
            .is_none());
    }

    #[tokio::test]
    async fn test_approval_workflow() {
        let registry = PolicyTierRegistry::new();

        // Create assignment with Standard tier (requires operator approval)
        let assignment = registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Workflow,
                "workflow-1",
                "admin",
                "Test workflow",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        // Initially should not have required approvals
        let has_approvals = registry
            .has_required_approvals(&assignment.assignment_id)
            .await
            .unwrap();
        assert!(!has_approvals);

        // Add approval
        registry
            .add_approval(
                &assignment.assignment_id,
                Approval {
                    approver_id: "operator-1".to_string(),
                    role: "operator".to_string(),
                    approved_at: Utc::now(),
                    comments: "Looks good".to_string(),
                },
            )
            .await
            .unwrap();

        // Now should have required approvals
        let has_approvals = registry
            .has_required_approvals(&assignment.assignment_id)
            .await
            .unwrap();
        assert!(has_approvals);
    }

    #[tokio::test]
    async fn test_invalid_approver_role() {
        let registry = PolicyTierRegistry::new();

        let assignment = registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        // Try to add approval with wrong role
        let result = registry
            .add_approval(
                &assignment.assignment_id,
                Approval {
                    approver_id: "random-user".to_string(),
                    role: "invalid_role".to_string(),
                    approved_at: Utc::now(),
                    comments: "Approved".to_string(),
                },
            )
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_assignments_by_tier() {
        let registry = PolicyTierRegistry::new();

        // Create assignments at different tiers
        registry
            .create_assignment(
                PolicyTier::Minimal,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Minimal tier",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-2",
                "admin",
                "Standard tier",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Workflow,
                "workflow-1",
                "admin",
                "Standard tier",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        // Get Standard tier assignments
        let standard_assignments = registry
            .get_assignments_by_tier(&PolicyTier::Standard)
            .await;
        assert_eq!(standard_assignments.len(), 2);

        // Get Minimal tier assignments
        let minimal_assignments = registry.get_assignments_by_tier(&PolicyTier::Minimal).await;
        assert_eq!(minimal_assignments.len(), 1);
    }

    #[tokio::test]
    async fn test_audit_log() {
        let registry = PolicyTierRegistry::new();

        // Create assignment
        let assignment = registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        // Add approval
        registry
            .add_approval(
                &assignment.assignment_id,
                Approval {
                    approver_id: "operator-1".to_string(),
                    role: "operator".to_string(),
                    approved_at: Utc::now(),
                    comments: "Approved".to_string(),
                },
            )
            .await
            .unwrap();

        // Get audit log
        let audit_log = registry.get_audit_log().await;
        assert!(audit_log.len() >= 2); // At least creation and approval entries
    }

    #[tokio::test]
    async fn test_gate_check_with_missing_approvals() {
        let registry = PolicyTierRegistry::new();

        // Create assignment but don't add approvals
        registry
            .create_assignment(
                PolicyTier::Standard,
                TargetType::Tool,
                "tool-1",
                "admin",
                "Test assignment",
                create_test_risk_assessment(),
            )
            .await
            .unwrap();

        // Gate check should fail due to missing approvals
        let request = GateCheckRequest {
            request_id: "req-1".to_string(),
            target_type: TargetType::Tool,
            target_id: "tool-1".to_string(),
            operation: "execute".to_string(),
            context: OperationContext {
                actor_id: "user-1".to_string(),
                session_id: "session-1".to_string(),
                data_sensitivity: vec![],
                environment: "production".to_string(),
                metadata: HashMap::new(),
            },
            requested_tier: PolicyTier::Standard,
        };

        let result = registry.gate_check(request).await.unwrap();
        assert!(!result.allowed);
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::MissingApproval));
    }

    #[tokio::test]
    async fn test_tier_requirements() {
        // Test all tiers have appropriate requirements
        let minimal_reqs = TierRequirements::for_tier(&PolicyTier::Minimal);
        assert!(minimal_reqs.required_approvals.is_empty());
        assert!(!minimal_reqs.requires_human_oversight);

        let standard_reqs = TierRequirements::for_tier(&PolicyTier::Standard);
        assert!(!standard_reqs.required_approvals.is_empty());
        assert!(standard_reqs.requires_detailed_audit);

        let critical_reqs = TierRequirements::for_tier(&PolicyTier::Critical);
        assert!(critical_reqs.required_approvals.len() >= 3);
        assert!(critical_reqs.requires_human_oversight);
        assert_eq!(critical_reqs.max_operation_duration_secs, 60);
    }
}
