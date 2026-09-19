"""
Self-consistency voting wrapper for decision heads (accuracy-push lane).

Composition over modification: wraps any ``DecisionHead`` and, per decide
call, samples the inner head K times (the inner head must be constructed
with ``temperature > 0`` for the samples to vary), then majority-votes each
question independently:

- ``chosen``     — the option with the most votes (ties break to the
                   earliest option in the question's option list, so the
                   result is deterministic given the samples);
- ``confidence`` — winner vote share (vote share of the winner);
- ``probabilities`` — vote frequencies over the option set;
- ``vote_margin``   — winner share minus runner-up share (0 when K == 1 or
                   the vote is unanimous).

The wrapper exposes the same ``decide(state_text, questions)`` surface as
every other head, so the planning loop and eval harness consume it
unchanged. Latency is the SUM of the K inner latencies (K forward passes
per decide step).
"""

from __future__ import annotations

import time
from collections import Counter
from typing import Any, Dict, Optional, Sequence

from .decision_head import Choice, DecisionHead, Question, TypedDecision


class SelfConsistencyHead:
    """Majority-vote ensemble over K samples of an inner decision head."""

    def __init__(
        self,
        inner: DecisionHead,
        samples: int = 1,
        temperature: Optional[float] = None,
    ) -> None:
        if samples < 1:
            raise ValueError(f"samples must be >= 1, got {samples}")
        self.inner = inner
        self.samples = int(samples)
        # Apply sampling temperature onto the inner head when it exposes the
        # knob (MlxDirectLogitHead does); silently ignored otherwise.
        if temperature is not None and hasattr(inner, "temperature"):
            inner.temperature = float(temperature)  # type: ignore[attr-defined]
        self.temperature = temperature

    @property
    def model_id(self) -> str:
        base = getattr(self.inner, "model_id", None) or getattr(
            self.inner, "model_repo", "head"
        )
        return f"{base}:sc{self.samples}" if self.samples > 1 else base

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        started = time.time()
        sampled = [self.inner.decide(state_text, questions) for _ in range(self.samples)]

        choices: Dict[str, Choice] = {}
        for question in questions:
            votes = Counter(
                decision.choices[question.name].chosen for decision in sampled
            )
            # Rank by vote count; break ties by option-list order (earliest
            # option wins) so the outcome is deterministic given the samples.
            order = {option: i for i, option in enumerate(question.options)}
            ranked = sorted(
                votes.items(),
                key=lambda kv: (-kv[1], order.get(kv[0], len(order))),
            )
            winner, winner_votes = ranked[0]
            runner_up_votes = ranked[1][1] if len(ranked) > 1 else 0
            k = max(len(sampled), 1)
            winner_share = winner_votes / k
            runner_up_share = runner_up_votes / k
            probabilities = {
                option: votes.get(option, 0) / k for option in question.options
            }
            choices[question.name] = Choice(
                question=question.name,
                chosen=winner,
                probabilities=probabilities,
                confidence=winner_share,
                vote_margin=winner_share - runner_up_share,
            )

        inner_latency = sum(d.latency_ms for d in sampled)
        decision = TypedDecision(
            choices=choices,
            latency_ms=max((time.time() - started) * 1000.0, inner_latency),
            model_id=self.model_id,
        )
        decision.validate()
        return decision

    def __getattr__(self, name: str) -> Any:
        # Duck-typed pass-through (vocab_misses, begin_run, note_prior_step…)
        # so harness probes see the inner head's capabilities. Only called
        # when normal attribute lookup fails; the recursion guard keeps a
        # lookup of `inner` itself (e.g. raised before __init__ assigns it)
        # an ordinary AttributeError instead of infinite recursion.
        if name == "inner":
            raise AttributeError(name)
        return getattr(self.inner, name)
