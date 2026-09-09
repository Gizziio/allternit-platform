"""
Allternit Computer Use — Pluggable Run Monitor

A monitor observes the planning loop after each OBSERVE phase and can
pause the run for human review. Interface (swap-in point for a VLM
classifier later):

    class MyMonitor:
        async def evaluate(self, *, screenshot_b64: str, extracted_text: str,
                           action_type: str, action_target: str,
                           step: int, run_id: str, session_id: str,
                           history: list) -> Optional[MonitorDecision]: ...

Return None (or a continue decision) to let the run proceed; return
``MonitorDecision.pause(reason=...)`` to pause the run with an
``approval.required`` event (kind ``monitor_flag``). The planning loop
then consults its approval callback: approve resumes, deny stops the run
with stop_reason MONITOR_FLAG (status ``needs_approval``).

The default ``HeuristicMonitor`` implements two cheap checks:
  * Prompt-injection keyword scan over extracted page/text content.
  * Rapid identical-action loop detection (same action+target repeated
    N consecutive times — a sign the model is stuck).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, Sequence, runtime_checkable

DEFAULT_INJECTION_PATTERNS: Sequence[str] = (
    "ignore previous instructions",
    "ignore all previous instructions",
    "disregard previous instructions",
    "forget your instructions",
    "system prompt",
    "you are now",
    "new instructions:",
    "override your",
    "jailbreak",
    "do anything now",
    "developer mode",
    "reveal your instructions",
    "print your instructions",
)

DEFAULT_REPEAT_THRESHOLD = 5


@dataclass
class MonitorDecision:
    """Outcome of a monitor evaluation."""
    action: str  # "continue" | "pause"
    reason: str = ""
    flag: str = ""  # machine-readable flag type, e.g. "prompt_injection"

    @classmethod
    def pause(cls, reason: str, flag: str = "monitor_flag") -> "MonitorDecision":
        return cls(action="pause", reason=reason, flag=flag)

    @classmethod
    def continue_(cls) -> "MonitorDecision":
        return cls(action="continue")


@runtime_checkable
class Monitor(Protocol):
    """Monitor interface — implement and pass to PlanningLoop(monitor=...)."""

    async def evaluate(
        self,
        *,
        screenshot_b64: str,
        extracted_text: str,
        action_type: str,
        action_target: str,
        step: int,
        run_id: str,
        session_id: str,
        history: List[Dict[str, Any]],
    ) -> Optional[MonitorDecision]: ...


class HeuristicMonitor:
    """Default monitor: injection keyword scan + identical-action loop detection."""

    def __init__(
        self,
        injection_patterns: Sequence[str] = DEFAULT_INJECTION_PATTERNS,
        repeat_threshold: int = DEFAULT_REPEAT_THRESHOLD,
    ) -> None:
        self._patterns = tuple(p.lower() for p in injection_patterns)
        self._repeat_threshold = repeat_threshold

    async def evaluate(
        self,
        *,
        screenshot_b64: str,
        extracted_text: str,
        action_type: str,
        action_target: str,
        step: int,
        run_id: str,
        session_id: str,
        history: List[Dict[str, Any]],
    ) -> Optional[MonitorDecision]:
        # 1. Prompt-injection keyword scan on extracted text.
        if extracted_text:
            lowered = extracted_text.lower()
            for pattern in self._patterns:
                if pattern in lowered:
                    return MonitorDecision.pause(
                        reason=f"page content matched prompt-injection pattern {pattern!r}",
                        flag="prompt_injection",
                    )

        # 2. Rapid identical-action loop: same action+target across recent history.
        recent = [h for h in history if isinstance(h, dict)][-self._repeat_threshold:]
        if len(recent) >= self._repeat_threshold:
            signatures = {
                (h.get("action_type", ""), h.get("action_target", "")) for h in recent
            }
            if len(signatures) == 1 and action_type == recent[-1].get("action_type", ""):
                return MonitorDecision.pause(
                    reason=(
                        f"identical action {action_type!r} on {action_target!r} repeated "
                        f"{self._repeat_threshold}+ times — loop detected"
                    ),
                    flag="action_loop",
                )
        return None
