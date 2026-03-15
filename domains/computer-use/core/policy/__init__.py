"""
A2R Computer Use — Policy Engine
G2 policy guarantee: No adapter can bypass domain restrictions,
auth boundaries, destructive action approval gates, artifact/output
rules, or session isolation rules.
"""

from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from datetime import datetime
import uuid
import json
import hashlib


@dataclass
class PolicyRule:
    """A single policy rule that can allow, deny, or constrain execution."""
    rule_id: str
    name: str
    description: str
    rule_type: str  # "domain", "auth", "destructive", "artifact", "session", "adapter"
    condition: Dict[str, Any]  # conditions to match
    decision: str  # "allow", "deny", "require_approval", "force_mode", "force_adapter", "require_headed", "require_user_present"
    overrides: Optional[Dict[str, Any]] = None  # forced_mode, forced_adapter, etc.
    priority: int = 0  # higher = evaluated first


@dataclass
class PolicyEvaluation:
    """Result of a policy evaluation — matches policy.schema.json."""
    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    decision: str = "allow"
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    reason: str = ""
    rules_applied: List[str] = field(default_factory=list)
    overrides: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "decision_id": self.decision_id,
            "decision": self.decision,
            "timestamp": self.timestamp,
            "reason": self.reason,
            "policy_rules_applied": self.rules_applied,
        }
        if self.overrides:
            result["overrides"] = self.overrides
        return result


# Built-in policy rules
DEFAULT_RULES: List[PolicyRule] = [
    PolicyRule(
        rule_id="P-001",
        name="domain-denylist",
        description="Block automation against denied domains",
        rule_type="domain",
        condition={"denied_domains": [
            "*.gov.mil", "*.banking.*", "*.internal.*",
        ]},
        decision="deny",
        priority=100,
    ),
    PolicyRule(
        rule_id="P-002",
        name="destructive-action-gate",
        description="Require approval for destructive actions (delete, submit payment, send message)",
        rule_type="destructive",
        condition={"action_keywords": [
            "delete", "remove", "drop", "payment", "purchase", "send", "submit", "transfer",
            "wire", "confirm order", "place order",
        ]},
        decision="require_approval",
        priority=90,
    ),
    PolicyRule(
        rule_id="P-003",
        name="high-risk-desktop-headed",
        description="Force headed mode for high-risk desktop adapters",
        rule_type="adapter",
        condition={"risk_level": "high", "family": "desktop"},
        decision="require_headed",
        overrides={"forced_headed": True},
        priority=80,
    ),
    PolicyRule(
        rule_id="P-004",
        name="credential-isolation",
        description="Deny if auth_ref is used across sessions",
        rule_type="auth",
        condition={"cross_session_auth": True},
        decision="deny",
        priority=95,
    ),
    PolicyRule(
        rule_id="P-005",
        name="artifact-path-enforcement",
        description="Deny if artifacts written outside declared artifact_root",
        rule_type="artifact",
        condition={"artifact_outside_root": True},
        decision="deny",
        priority=85,
    ),
    PolicyRule(
        rule_id="P-006",
        name="experimental-adapter-block",
        description="Block experimental adapters from production routing unless explicitly opted in",
        rule_type="adapter",
        condition={"conformance_grade": "experimental", "explicit_opt_in": False},
        decision="deny",
        priority=70,
    ),
    PolicyRule(
        rule_id="P-007",
        name="session-isolation",
        description="Deny if session attempts to access another session's data",
        rule_type="session",
        condition={"cross_session_access": True},
        decision="deny",
        priority=100,
    ),
]


class PolicyEngine:
    """
    Evaluates policy rules against execution requests.
    Must be consulted before any adapter invocation (G2 guarantee).
    """

    def __init__(self, custom_rules: Optional[List[PolicyRule]] = None):
        self._rules = sorted(
            DEFAULT_RULES + (custom_rules or []),
            key=lambda r: r.priority,
            reverse=True,
        )
        self._evaluations: List[PolicyEvaluation] = []

    def add_rule(self, rule: PolicyRule) -> None:
        """Add a custom policy rule."""
        self._rules.append(rule)
        self._rules.sort(key=lambda r: r.priority, reverse=True)

    def evaluate(
        self,
        *,
        target: str = "",
        target_domains: Optional[List[str]] = None,
        target_apps: Optional[List[str]] = None,
        action_type: str = "",
        action_description: str = "",
        adapter_id: str = "",
        adapter_risk_level: str = "medium",
        adapter_conformance_grade: str = "beta",
        family: str = "",
        mode: str = "",
        session_id: str = "",
        auth_ref: Optional[str] = None,
        artifact_paths: Optional[List[str]] = None,
        artifact_root: Optional[str] = None,
        explicit_opt_in: bool = False,
        cross_session_auth: bool = False,
        cross_session_access: bool = False,
    ) -> PolicyEvaluation:
        """
        Evaluate all policy rules against the given execution context.
        Returns the most restrictive applicable decision.
        """
        evaluation = PolicyEvaluation(reason="No policy rules triggered — default allow")
        rules_applied = []

        for rule in self._rules:
            triggered = False

            # Domain denylist check
            if rule.rule_type == "domain" and target_domains:
                denied = rule.condition.get("denied_domains", [])
                for domain in target_domains:
                    for pattern in denied:
                        if self._domain_matches(domain, pattern):
                            triggered = True
                            break

            # Destructive action check
            elif rule.rule_type == "destructive":
                keywords = rule.condition.get("action_keywords", [])
                check_text = f"{action_type} {action_description} {target}".lower()
                if any(kw in check_text for kw in keywords):
                    triggered = True

            # Adapter risk/conformance check
            elif rule.rule_type == "adapter":
                cond = rule.condition
                if "risk_level" in cond and adapter_risk_level == cond["risk_level"]:
                    if "family" in cond and family == cond["family"]:
                        triggered = True
                if "conformance_grade" in cond and adapter_conformance_grade == cond["conformance_grade"]:
                    if not cond.get("explicit_opt_in", True) and not explicit_opt_in:
                        triggered = True

            # Auth isolation check
            elif rule.rule_type == "auth":
                if cond_val := rule.condition.get("cross_session_auth"):
                    if cross_session_auth == cond_val:
                        triggered = True

            # Artifact path check
            elif rule.rule_type == "artifact":
                if rule.condition.get("artifact_outside_root") and artifact_paths and artifact_root:
                    for path in artifact_paths:
                        if not path.startswith(artifact_root):
                            triggered = True
                            break

            # Session isolation check
            elif rule.rule_type == "session":
                if rule.condition.get("cross_session_access") and cross_session_access:
                    triggered = True

            if triggered:
                rules_applied.append(rule.rule_id)
                # Apply most restrictive decision
                if self._is_more_restrictive(rule.decision, evaluation.decision):
                    evaluation.decision = rule.decision
                    evaluation.reason = f"{rule.name}: {rule.description}"
                    if rule.overrides:
                        evaluation.overrides = rule.overrides

        evaluation.rules_applied = rules_applied
        self._evaluations.append(evaluation)
        return evaluation

    def get_evaluations(self) -> List[PolicyEvaluation]:
        """Return all evaluations for audit."""
        return list(self._evaluations)

    @staticmethod
    def _domain_matches(domain: str, pattern: str) -> bool:
        """Simple wildcard domain matching."""
        if pattern.startswith("*."):
            return domain.endswith(pattern[1:]) or domain == pattern[2:]
        return domain == pattern

    @staticmethod
    def _is_more_restrictive(new: str, current: str) -> bool:
        """Compare restriction levels."""
        levels = {
            "allow": 0,
            "require_headed": 1,
            "require_user_present": 2,
            "force_mode": 3,
            "force_adapter": 3,
            "require_approval": 4,
            "deny": 5,
        }
        return levels.get(new, 0) > levels.get(current, 0)
