"""Fail-closed policy decisions for canonical computer-use transactions."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Any, Dict

from contracts.canonical import ActionTransaction


SIDE_EFFECT_ACTIONS = frozenset({
    "setText", "typeText", "keypress", "click", "doubleClick", "rightClick",
    "drag", "drop", "upload", "download", "clipboardWrite", "writeFile",
    "deleteFile", "shell", "launch", "close", "install", "uninstall",
})
IRREVERSIBLE_ACTIONS = frozenset({"deleteFile", "install", "uninstall", "purchase", "submit"})


@dataclass(frozen=True)
class PolicyDecision:
    decision_id: str
    decision: str
    requires_approval: bool
    risk: str
    reasons: tuple[str, ...]
    facts: Dict[str, Any]


class PolicyDeniedError(RuntimeError):
    pass


class CanonicalPolicyEngine:
    def __init__(self, *, max_steps: int = 50, max_argument_bytes: int = 131072) -> None:
        self._max_steps = max_steps
        self._max_argument_bytes = max_argument_bytes

    def evaluate(self, transaction: ActionTransaction) -> PolicyDecision:
        actions = tuple(step.action for step in transaction.steps)
        reasons = []
        if len(actions) > self._max_steps:
            raise PolicyDeniedError(f"Transaction exceeds the {self._max_steps}-step policy limit")
        argument_bytes = len(json.dumps(
            [step.arguments for step in transaction.steps], sort_keys=True, default=str
        ).encode("utf-8"))
        if argument_bytes > self._max_argument_bytes:
            raise PolicyDeniedError("Transaction arguments exceed the policy size limit")
        irreversible = sorted(set(actions) & IRREVERSIBLE_ACTIONS)
        side_effects = sorted(set(actions) & SIDE_EFFECT_ACTIONS)
        if irreversible:
            risk = "critical"
            reasons.append("irreversible_action")
        elif side_effects:
            risk = "elevated"
            reasons.append("side_effect_action")
        else:
            risk = "read_only"
        if transaction.mode == "sandboxed" and transaction.environment_id.startswith("environment_local_"):
            raise PolicyDeniedError("Sandboxed mode cannot target an implicit host environment")
        requires_approval = bool(side_effects)
        digest = hashlib.sha256(json.dumps({
            "transaction": asdict(transaction), "risk": risk, "reasons": reasons,
        }, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        return PolicyDecision(
            decision_id=f"policy_{digest[:24]}",
            decision="require_approval" if requires_approval else "allow",
            requires_approval=requires_approval,
            risk=risk, reasons=tuple(reasons),
            facts={
                "actions": actions, "step_count": len(actions), "argument_bytes": argument_bytes,
                "arguments_redacted": True,
            },
        )
