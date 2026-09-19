"""Unit tests for core/self_consistency.py and the mlx --model plumbing."""

from __future__ import annotations

import pytest

from core.decision_head import (
    DEFAULT_MODEL_REPO,
    DEFAULT_REVISION,
    Choice,
    MlxDirectLogitHead,
    Question,
    TypedDecision,
)
from core.self_consistency import SelfConsistencyHead


class _ScriptedHead:
    """Returns one canned decision per call, in order; repeats the last."""

    def __init__(self, decisions, latency_ms=1.0):
        self._decisions = list(decisions)
        self._calls = 0
        self.model_id = "scripted-head"
        self.temperature = 0.0
        self._latency_ms = latency_ms

    def decide(self, state_text, questions):
        self._calls += 1
        spec = self._decisions[min(self._calls - 1, len(self._decisions) - 1)]
        choices = {}
        for question in questions:
            chosen = spec.get(question.name, question.options[0])
            probabilities = {o: 0.0 for o in question.options}
            probabilities[chosen] = 1.0
            choices[question.name] = Choice(
                question=question.name,
                chosen=chosen,
                probabilities=probabilities,
                confidence=1.0,
            )
        return TypedDecision(
            choices=choices,
            latency_ms=self._latency_ms,
            model_id=self.model_id,
        )


_QUESTIONS = [
    Question(name="operation", options=["click", "fill"]),
    Question(name="goal_satisfied", options=["true", "false"]),
]


class TestSelfConsistency:
    def test_majority_vote_and_confidence(self):
        inner = _ScriptedHead([
            {"operation": "click"},
            {"operation": "click"},
            {"operation": "fill"},
        ])
        head = SelfConsistencyHead(inner, samples=3)
        decision = head.decide("state", _QUESTIONS)

        op = decision.choices["operation"]
        assert op.chosen == "click"
        assert op.confidence == pytest.approx(2 / 3)
        # Vote frequencies as probabilities over the full option set.
        assert op.probabilities == {"click": pytest.approx(2 / 3), "fill": pytest.approx(1 / 3)}
        assert decision.model_id == "scripted-head:sc3"
        # Three inner passes per decide.
        assert inner._calls == 3

    def test_vote_margin_math(self):
        inner = _ScriptedHead([
            {"operation": "click"},
            {"operation": "click"},
            {"operation": "fill"},
        ])
        decision = SelfConsistencyHead(inner, samples=3).decide("state", _QUESTIONS)
        assert decision.choices["operation"].vote_margin == pytest.approx(2 / 3 - 1 / 3)

    def test_unanimous_vote_margin_is_full_share(self):
        inner = _ScriptedHead([{"operation": "click"}] * 3)
        decision = SelfConsistencyHead(inner, samples=3).decide("state", _QUESTIONS)
        op = decision.choices["operation"]
        assert op.chosen == "click"
        assert op.confidence == pytest.approx(1.0)
        assert op.vote_margin == pytest.approx(1.0)

    def test_tie_breaks_to_earliest_option(self):
        inner = _ScriptedHead([
            {"operation": "fill"},
            {"operation": "click"},
        ])
        decision = SelfConsistencyHead(inner, samples=2).decide("state", _QUESTIONS)
        op = decision.choices["operation"]
        assert op.chosen == "click"  # "click" precedes "fill" in the option list
        assert op.confidence == pytest.approx(0.5)
        assert op.vote_margin == pytest.approx(0.0)

    def test_votes_apply_per_question_independently(self):
        inner = _ScriptedHead([
            {"operation": "click", "goal_satisfied": "true"},
            {"operation": "click", "goal_satisfied": "false"},
            {"operation": "fill", "goal_satisfied": "false"},
        ])
        decision = SelfConsistencyHead(inner, samples=3).decide("state", _QUESTIONS)
        assert decision.choices["operation"].chosen == "click"
        assert decision.choices["goal_satisfied"].chosen == "false"
        assert decision.choices["goal_satisfied"].confidence == pytest.approx(2 / 3)

    def test_latency_sums_inner_passes(self):
        inner = _ScriptedHead([{"operation": "click"}] * 3, latency_ms=2.5)
        decision = SelfConsistencyHead(inner, samples=3).decide("state", _QUESTIONS)
        assert decision.latency_ms >= 7.5

    def test_samples_must_be_positive(self):
        with pytest.raises(ValueError):
            SelfConsistencyHead(_ScriptedHead([]), samples=0)

    def test_k1_is_transparent(self):
        inner = _ScriptedHead([{"operation": "click"}])
        head = SelfConsistencyHead(inner, samples=1)
        decision = head.decide("state", _QUESTIONS)
        assert decision.choices["operation"].chosen == "click"
        assert decision.model_id == "scripted-head"

    def test_temperature_applied_to_inner_when_supported(self):
        inner = _ScriptedHead([{"operation": "click"}])
        SelfConsistencyHead(inner, samples=5, temperature=0.9)
        assert inner.temperature == 0.9

    def test_dict_carries_vote_margin(self):
        inner = _ScriptedHead([
            {"operation": "click"},
            {"operation": "click"},
            {"operation": "fill"},
        ])
        decision = SelfConsistencyHead(inner, samples=3).decide("state", _QUESTIONS)
        as_dict = decision.to_dict()
        assert as_dict["choices"]["operation"]["vote_margin"] == pytest.approx(1 / 3)

    def test_duck_typed_passthrough(self):
        inner = _ScriptedHead([{"operation": "click"}])
        head = SelfConsistencyHead(inner, samples=2)
        # Attributes the wrapper doesn't define resolve on the inner head.
        assert head.model_id.startswith("scripted-head")
        with pytest.raises(AttributeError):
            head.no_such_attribute_anywhere


class TestModelPlumbing:
    def test_default_repo_keeps_verified_pin(self):
        head = MlxDirectLogitHead()
        assert head.model_repo == DEFAULT_MODEL_REPO
        assert head.revision == DEFAULT_REVISION

    def test_custom_repo_defaults_to_default_branch(self):
        head = MlxDirectLogitHead(model_repo="mlx-community/gemma-3-4b-it-4bit")
        assert head.model_repo == "mlx-community/gemma-3-4b-it-4bit"
        assert head.revision is None  # a pinned qwen3 commit would 404 here

    def test_explicit_revision_wins(self):
        head = MlxDirectLogitHead(
            model_repo="mlx-community/gemma-3-4b-it-4bit", revision="abc123"
        )
        assert head.revision == "abc123"

    def test_sampling_temperature_is_deterministic_with_seed(self):
        """Sampling path: same seed reproduces across fresh heads; near-zero
        temperature collapses to the argmax. No weights loaded — the sampler
        is pure-python over score lists."""
        scores = [1.0, 2.0, 3.0]
        a = MlxDirectLogitHead(temperature=1.0, seed=7)._sample_index(scores)
        b = MlxDirectLogitHead(temperature=1.0, seed=7)._sample_index(scores)
        assert a == b
        # Extreme logit gap: even at high temperature the argmax dominates.
        head_cold = MlxDirectLogitHead(temperature=0.01, seed=1)
        assert head_cold._sample_index([100.0, 0.0]) == 0
