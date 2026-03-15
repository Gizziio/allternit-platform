//! Policy Tiers Module
//!
//! Defines policy tiers and their requirements.

use crate::{ApprovalRequirement, RiskLevel};
use serde::{Deserialize, Serialize};

/// Policy tiers (ordered from lowest to highest)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PolicyTier {
    /// Minimal restrictions - for public data, safe operations
    Minimal,
    /// Standard restrictions - for internal data
    Standard,
    /// Elevated restrictions - for sensitive data
    Elevated,
    /// High assurance - for critical operations
    HighAssurance,
    /// Maximum restrictions - for highest risk
    Critical,
}

impl PolicyTier {
    /// Get display name for the tier
    pub fn display_name(&self) -> &'static str {
        match self {
            PolicyTier::Minimal => "Minimal",
            PolicyTier::Standard => "Standard",
            PolicyTier::Elevated => "Elevated",
            PolicyTier::HighAssurance => "High Assurance",
            PolicyTier::Critical => "Critical",
        }
    }

    /// Get description of the tier
    pub fn description(&self) -> &'static str {
        match self {
            PolicyTier::Minimal => "Minimal restrictions for public data and safe operations",
            PolicyTier::Standard => "Standard restrictions for internal data and common operations",
            PolicyTier::Elevated => "Elevated restrictions for sensitive data",
            PolicyTier::HighAssurance => "High assurance for critical operations",
            PolicyTier::Critical => "Maximum restrictions for highest risk operations",
        }
    }
}

/// Requirements for a policy tier
#[derive(Debug, Clone)]
pub struct TierRequirements {
    /// Required approvals
    pub required_approvals: Vec<ApprovalRequirement>,
    /// Maximum allowed risk level
    pub max_risk_level: RiskLevel,
    /// Whether human oversight is required
    pub requires_human_oversight: bool,
    /// Whether detailed audit logging is required
    pub requires_detailed_audit: bool,
    /// Whether data encryption is required
    pub requires_encryption: bool,
    /// Whether operation requires justification
    pub requires_justification: bool,
    /// Maximum operation duration (seconds)
    pub max_operation_duration_secs: u64,
}

impl TierRequirements {
    /// Get requirements for a specific tier
    pub fn for_tier(tier: &PolicyTier) -> Self {
        match tier {
            PolicyTier::Minimal => Self {
                required_approvals: vec![],
                max_risk_level: RiskLevel::Low,
                requires_human_oversight: false,
                requires_detailed_audit: false,
                requires_encryption: false,
                requires_justification: false,
                max_operation_duration_secs: 3600,
            },
            PolicyTier::Standard => Self {
                required_approvals: vec![ApprovalRequirement {
                    required_role: "operator".to_string(),
                    count: 1,
                }],
                max_risk_level: RiskLevel::Moderate,
                requires_human_oversight: false,
                requires_detailed_audit: true,
                requires_encryption: true,
                requires_justification: false,
                max_operation_duration_secs: 1800,
            },
            PolicyTier::Elevated => Self {
                required_approvals: vec![ApprovalRequirement {
                    required_role: "senior_operator".to_string(),
                    count: 1,
                }],
                max_risk_level: RiskLevel::High,
                requires_human_oversight: true,
                requires_detailed_audit: true,
                requires_encryption: true,
                requires_justification: true,
                max_operation_duration_secs: 900,
            },
            PolicyTier::HighAssurance => Self {
                required_approvals: vec![
                    ApprovalRequirement {
                        required_role: "senior_operator".to_string(),
                        count: 1,
                    },
                    ApprovalRequirement {
                        required_role: "security_officer".to_string(),
                        count: 1,
                    },
                ],
                max_risk_level: RiskLevel::Critical,
                requires_human_oversight: true,
                requires_detailed_audit: true,
                requires_encryption: true,
                requires_justification: true,
                max_operation_duration_secs: 300,
            },
            PolicyTier::Critical => Self {
                required_approvals: vec![
                    ApprovalRequirement {
                        required_role: "senior_operator".to_string(),
                        count: 2,
                    },
                    ApprovalRequirement {
                        required_role: "security_officer".to_string(),
                        count: 1,
                    },
                    ApprovalRequirement {
                        required_role: "chief_officer".to_string(),
                        count: 1,
                    },
                ],
                max_risk_level: RiskLevel::Critical,
                requires_human_oversight: true,
                requires_detailed_audit: true,
                requires_encryption: true,
                requires_justification: true,
                max_operation_duration_secs: 60,
            },
        }
    }
}
