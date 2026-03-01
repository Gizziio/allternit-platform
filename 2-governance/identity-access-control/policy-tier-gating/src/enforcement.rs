//! Policy Enforcement Module
//!
//! Enforces policy tier constraints and makes enforcement decisions.

use crate::{EscalationRequirement, GateCheckRequest, PolicyTier, TierRequirements, TierViolation};

/// Policy enforcer
pub struct PolicyEnforcer;

impl PolicyEnforcer {
    /// Create a new enforcer
    pub fn new() -> Self {
        Self
    }

    /// Check an operation against tier constraints
    pub fn check_operation(
        &self,
        request: &GateCheckRequest,
        assigned_tier: &PolicyTier,
        violations: &[TierViolation],
    ) -> TierEnforcementResult {
        let requirements = TierRequirements::for_tier(assigned_tier);

        // Determine effective tier based on violations
        let effective_tier = if violations.iter().any(|v| {
            matches!(
                v.violation_type,
                crate::ViolationType::TierMismatch | crate::ViolationType::RiskLevelTooHigh
            )
        }) {
            // Need to escalate
            self.next_tier(assigned_tier)
        } else {
            assigned_tier.clone()
        };

        // Check if allowed
        let allowed = violations.iter().all(|v| {
            // Only block on critical errors
            !matches!(v.severity, crate::ViolationSeverity::Critical)
        });

        // Determine required escalations
        let mut required_escalations = Vec::new();

        if request.requested_tier > *assigned_tier {
            required_escalations.push(EscalationRequirement {
                to_tier: request.requested_tier.clone(),
                reason: "Requested tier exceeds assigned tier".to_string(),
                required_approvals: TierRequirements::for_tier(&request.requested_tier)
                    .required_approvals,
            });
        }

        if requirements.requires_human_oversight && request.context.actor_id.starts_with("auto-") {
            required_escalations.push(EscalationRequirement {
                to_tier: assigned_tier.clone(),
                reason: "Human oversight required".to_string(),
                required_approvals: vec![crate::ApprovalRequirement {
                    required_role: "human_operator".to_string(),
                    count: 1,
                }],
            });
        }

        TierEnforcementResult {
            allowed,
            effective_tier,
            required_escalations,
        }
    }

    /// Get the next higher tier
    fn next_tier(&self, tier: &PolicyTier) -> PolicyTier {
        match tier {
            PolicyTier::Minimal => PolicyTier::Standard,
            PolicyTier::Standard => PolicyTier::Elevated,
            PolicyTier::Elevated => PolicyTier::HighAssurance,
            PolicyTier::HighAssurance => PolicyTier::Critical,
            PolicyTier::Critical => PolicyTier::Critical, // Already at max
        }
    }
}

impl Default for PolicyEnforcer {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of tier enforcement check
#[derive(Debug, Clone)]
pub struct TierEnforcementResult {
    pub allowed: bool,
    pub effective_tier: PolicyTier,
    pub required_escalations: Vec<EscalationRequirement>,
}
