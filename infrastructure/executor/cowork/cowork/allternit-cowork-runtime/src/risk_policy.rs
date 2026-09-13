//! Approval risk policy — the single policy-evaluation path for protected
//! actions (A:// §8.14 unification).
//!
//! The rule model mirrors the cowork-engine `ApprovalGate`
//! (`packages/@allternit/cowork-engine/src/approval/gate.ts`): first matching
//! rule on (actionType, riskLevel) decides `approve`/`reject`; the default
//! policy auto-approves low-risk actions. Risk rules decide WHETHER a
//! protected action needs an approval at all; `cowork_approval_bindings`
//! scope the approval when one is required. There are no two parallel
//! approval systems.

use serde::{Deserialize, Serialize};

/// Risk levels, ordered low → critical (same vocabulary as the TS engine).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl RiskLevel {
    /// Parse a risk level from its wire string.
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "low" => Some(Self::Low),
            "medium" => Some(Self::Medium),
            "high" => Some(Self::High),
            "critical" => Some(Self::Critical),
            _ => None,
        }
    }
}

/// One auto-rule, same shape as `ApprovalRule` in the TS gate.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskRule {
    /// Capability prefix to match (`shell.exec` or a namespace like
    /// `connector.bank.`); empty matches everything.
    #[serde(default)]
    pub action_type: Option<String>,
    /// Risk levels this rule applies to; empty matches every level.
    #[serde(default)]
    pub risk_level: Vec<String>,
    /// Auto-decision when the rule matches.
    pub decision: String,
    /// Human-readable reason recorded in the ledger.
    #[serde(default)]
    pub reason: Option<String>,
}

/// Workspace (or global) approval policy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalPolicy {
    /// Capability → risk-level overrides on top of the canonical table.
    #[serde(default)]
    pub capability_risk: std::collections::HashMap<String, String>,
    /// Auto-rules, first match wins.
    #[serde(default)]
    pub rules: Vec<RiskRule>,
}

impl Default for ApprovalPolicy {
    fn default() -> Self {
        Self {
            capability_risk: Default::default(),
            rules: vec![RiskRule {
                action_type: None,
                risk_level: vec!["low".to_string()],
                decision: "approve".to_string(),
                reason: Some("low-risk auto-approve".to_string()),
            }],
        }
    }
}

/// Outcome of evaluating a protected action against the policy.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProtectionDecision {
    /// Risk rules auto-approve; no binding required.
    AutoApprove(String),
    /// A human approval binding is required (scoped to the lease).
    RequiresApproval,
    /// Risk rules auto-deny.
    AutoDeny(String),
}

/// Canonical risk table for the §8.6 capability vocabulary. Workspace policy
/// may override per capability.
pub fn canonical_risk(capability: &str) -> RiskLevel {
    let c = capability;
    if c.starts_with("connector.bank.") || c.ends_with(".submit") || c == "gui.control" {
        RiskLevel::Critical
    } else if c.starts_with("connector.")
        || c.starts_with("files.system.")
        || c == "gui.observe"
        || c == "browser.form.submit"
    {
        RiskLevel::High
    } else if c == "shell.exec"
        || c.starts_with("files.project.write")
        || c == "web.write"
        || c == "git.write"
        || c == "artifact.create"
        || c == "artifact.modify"
        || c == "browser.navigate"
    {
        RiskLevel::Medium
    } else {
        RiskLevel::Low
    }
}

/// Evaluate whether a protected action needs an approval, under the policy.
pub fn evaluate_protection(policy: &ApprovalPolicy, capability: &str) -> ProtectionDecision {
    let risk = policy
        .capability_risk
        .get(capability)
        .and_then(|s| RiskLevel::parse(s))
        .unwrap_or_else(|| canonical_risk(capability));
    let risk_name = match risk {
        RiskLevel::Low => "low",
        RiskLevel::Medium => "medium",
        RiskLevel::High => "high",
        RiskLevel::Critical => "critical",
    };

    for rule in &policy.rules {
        let action_match = match &rule.action_type {
            None => true,
            Some(prefix) => {
                capability == prefix
                    || (prefix.ends_with('.') && capability.starts_with(prefix.as_str()))
            }
        };
        let risk_match =
            rule.risk_level.is_empty() || rule.risk_level.iter().any(|r| r == risk_name);
        if action_match && risk_match {
            let reason = rule.reason.clone().unwrap_or_else(|| "risk-rule".to_string());
            return match rule.decision.as_str() {
                "approve" | "approved" => ProtectionDecision::AutoApprove(reason),
                "reject" | "denied" | "deny" => ProtectionDecision::AutoDeny(reason),
                _ => ProtectionDecision::RequiresApproval,
            };
        }
    }

    match risk {
        RiskLevel::Low => ProtectionDecision::AutoApprove("low-risk auto-approve".to_string()),
        _ => ProtectionDecision::RequiresApproval,
    }
}
