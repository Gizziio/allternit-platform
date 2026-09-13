"""
Allternit Computer Use — Cost Accounting (observability, not billing)

Per-run token/cost accounting. Counts input/output tokens per stage where
the underlying provider reports them, estimates a cost in USD when only
token totals are available, and reports an honest zero when no token data
exists at all.

Scope notes (deliberate):
  * This is observability. It never gates execution, never invoices, and
    never blocks a run — every function here is total and defensive.
  * In this engine the planning loop's plan call IS the vision provider
    call (``PlanningLoop`` → ``VisionProvider.ground_and_reason``), so the
    two are accounted as one stage, ``vision_planning``. The monitor stage
    (``core.monitor``) only consumes tokens when a VLM monitor is wired in;
    the gateway does not wire one today, so no monitor usage is recorded.
  * When a provider reports ``cost_usd`` directly (OpenAI/Anthropic sites
    in ``vision_providers.py``) that number is used ("provider-reported").
    Otherwise cost is estimated from token counts with the table below
    ("estimated"). No token data at all → all zeros, "unavailable".
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# Blended fallback rates (USD per 1M tokens, averaged input/output) used
# only when a provider reports tokens but no cost. Keyed by lowercase
# substring of the model name; first match wins.
BLENDED_RATES_PER_MILLION: List[tuple] = [
    ("gpt-4o", 10.0),          # $5 in / $15 out
    ("gpt-4", 10.0),           # same blended family rate
    ("opus", 45.0),            # $15 in / $75 out
    ("sonnet", 4.5),           # $3 in / $15 out
    ("haiku", 0.7),            # $0.25 in / $1.25 out
    ("gemini", 2.0),           # rough blended Pro rate
    ("qwen", 0.4),             # local/self-hosted, nominal
]
DEFAULT_BLENDED_RATE_PER_MILLION = 10.0

PRICING_PROVIDER_REPORTED = "provider-reported"
PRICING_ESTIMATED = "estimated"
PRICING_UNAVAILABLE = "unavailable"


def estimate_cost_usd(total_tokens: int, model: Optional[str] = None) -> float:
    """Estimate cost from a token total when no per-call cost is reported."""
    tokens = max(0, int(total_tokens or 0))
    if tokens == 0:
        return 0.0
    rate = DEFAULT_BLENDED_RATE_PER_MILLION
    if model:
        lowered = model.lower()
        for needle, candidate in BLENDED_RATES_PER_MILLION:
            if needle in lowered:
                rate = candidate
                break
    return round(tokens * rate / 1_000_000, 8)


def zero_run_cost() -> Dict[str, Any]:
    """The honest-zero cost record: no token data was available."""
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "est_cost_usd": 0.0,
        "pricing": PRICING_UNAVAILABLE,
        "by_stage": {},
        "model": None,
        "provider": None,
    }


@dataclass
class StageUsage:
    """Token/cost usage attributed to one stage of a run."""
    stage: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0  # provider-reported cost, 0.0 when unknown

    def to_dict(self) -> Dict[str, Any]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "cost_usd": round(self.cost_usd or 0.0, 8),
        }


class RunCostTracker:
    """Accumulates per-stage usage for a single run and renders the record."""

    def __init__(self, *, model: Optional[str] = None, provider: Optional[str] = None) -> None:
        self.model = model
        self.provider = provider
        self._stages: Dict[str, StageUsage] = {}

    def record(
        self,
        stage: str,
        *,
        input_tokens: int = 0,
        output_tokens: int = 0,
        total_tokens: Optional[int] = None,
        cost_usd: float = 0.0,
    ) -> None:
        """Add one call's usage to a stage. Unknown splits default to 0."""
        usage = self._stages.setdefault(stage, StageUsage(stage=stage))
        usage.input_tokens += max(0, int(input_tokens or 0))
        usage.output_tokens += max(0, int(output_tokens or 0))
        if total_tokens is None:
            total_tokens = usage.input_tokens + usage.output_tokens
        usage.total_tokens += max(0, int(total_tokens or 0))
        usage.cost_usd += float(cost_usd or 0.0)

    def to_dict(self) -> Dict[str, Any]:
        input_tokens = sum(s.input_tokens for s in self._stages.values())
        output_tokens = sum(s.output_tokens for s in self._stages.values())
        total_tokens = sum(s.total_tokens for s in self._stages.values())
        reported_cost = sum(s.cost_usd for s in self._stages.values())

        if reported_cost > 0:
            est_cost = reported_cost
            pricing = PRICING_PROVIDER_REPORTED
        elif total_tokens > 0:
            est_cost = estimate_cost_usd(total_tokens, self.model)
            pricing = PRICING_ESTIMATED
        else:
            est_cost = 0.0
            pricing = PRICING_UNAVAILABLE

        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "est_cost_usd": round(est_cost, 8),
            "pricing": pricing,
            "by_stage": {name: usage.to_dict() for name, usage in sorted(self._stages.items())},
            "model": self.model,
            "provider": self.provider,
        }


def cost_dict_from_planning_result(result: Any, provider: Any = None) -> Dict[str, Any]:
    """Build a run cost record from a PlanningLoopResult + vision provider.

    Falls back to honest zero when the result carries no token fields
    (older providers, mock provider).
    """
    tracker = RunCostTracker(
        model=getattr(provider, "model", None),
        provider=type(provider).__name__ if provider is not None else None,
    )
    total_tokens = int(getattr(result, "total_tokens", 0) or 0)
    total_cost = float(getattr(result, "total_cost_usd", 0.0) or 0.0)
    if total_tokens > 0 or total_cost > 0:
        tracker.record(
            "vision_planning",
            input_tokens=int(getattr(result, "total_input_tokens", 0) or 0),
            output_tokens=int(getattr(result, "total_output_tokens", 0) or 0),
            total_tokens=total_tokens,
            cost_usd=total_cost,
        )
    return tracker.to_dict()
