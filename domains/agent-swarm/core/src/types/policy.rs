use super::{Confidence, Cost, EntityId, Metadata, Priority};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Policy check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyCheck {
    pub metadata: Metadata,
    pub entity_id: EntityId,
    pub policy_name: String,
    pub result: PolicyResult,
    pub violations: Vec<PolicyViolation>,
    pub confidence: Confidence,
}

impl PolicyCheck {
    pub fn passed(entity_id: EntityId, policy_name: impl Into<String>) -> Self {
        Self {
            metadata: Metadata::new(),
            entity_id,
            policy_name: policy_name.into(),
            result: PolicyResult::Passed,
            violations: Vec::new(),
            confidence: Confidence::new(1.0).unwrap(),
        }
    }

    pub fn failed(
        entity_id: EntityId,
        policy_name: impl Into<String>,
        violations: Vec<PolicyViolation>,
    ) -> Self {
        Self {
            metadata: Metadata::new(),
            entity_id,
            policy_name: policy_name.into(),
            result: PolicyResult::Failed,
            violations,
            confidence: Confidence::new(1.0).unwrap(),
        }
    }

    pub fn is_passed(&self) -> bool {
        matches!(self.result, PolicyResult::Passed)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PolicyResult {
    Passed,
    Failed,
    NeedsReview,
}

/// Policy violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyViolation {
    pub violation_type: ViolationType,
    pub severity: Priority,
    pub description: String,
    pub location: Option<String>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViolationType {
    Security,
    Performance,
    Style,
    Architecture,
    Dependency,
    Resource,
}

/// Work Item Handling (WIH) integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WIHWorkItem {
    pub id: EntityId,
    pub title: String,
    pub description: String,
    pub status: WIHStatus,
    pub priority: Priority,
    pub assigned_to: Option<EntityId>,
    pub parent_id: Option<EntityId>,
    pub acceptance_criteria: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WIHStatus {
    Draft,
    Ready,
    InProgress,
    InReview,
    Completed,
    Blocked,
    Cancelled,
}

/// WIH Receipt for completed work
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WIHReceipt {
    pub metadata: Metadata,
    pub work_item_id: EntityId,
    pub result_summary: String,
    pub artifacts_produced: Vec<String>,
    pub cost: Cost,
    pub duration_secs: f64,
    pub approved: bool,
    pub approver: Option<String>,
}

/// Governance approval request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub metadata: Metadata,
    pub request_type: ApprovalType,
    pub description: String,
    pub requested_by: EntityId,
    pub status: ApprovalStatus,
    pub responses: Vec<ApprovalResponse>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalType {
    BudgetIncrease,
    PolicyException,
    ProductionDeploy,
    ModeSwitch,
    AgentAddition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Escalated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalResponse {
    pub approver: String,
    pub decision: ApprovalDecision,
    pub timestamp: DateTime<Utc>,
    pub comments: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalDecision {
    Approve,
    Reject,
    RequestChanges,
}
