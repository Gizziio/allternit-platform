"""Unit tests for core/decision_head.py — typed decisions, MockHead, mlx head."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import pytest

from core.decision_head import (
    DEFAULT_MODEL_REPO,
    Choice,
    DecisionHead,
    DecisionValidationError,
    MockHead,
    MlxDirectLogitHead,
    Question,
    ShadowHeadDependencyError,
    TypedDecision,
    choice_from_scores,
    entropy_confidence,
    softmax,
)

MLX_AVAILABLE = importlib.util.find_spec("mlx_lm") is not None


def _weights_cached() -> bool:
    """True when the pinned repo has a local HF cache snapshot (offline check)."""
    cache = Path.home() / ".cache" / "huggingface" / "hub"
    if not cache.exists():
        return False
    return any(
        "Qwen3-4B-Instruct-2507" in entry.name
        for entry in cache.iterdir()
        if entry.name.startswith("models--")
    )


class TestMath:
    def test_softmax_sums_to_one(self):
        probs = softmax([1.0, 2.0, 3.0])
        assert math.isclose(sum(probs), 1.0, rel_tol=1e-9)
        assert probs[2] > probs[1] > probs[0]

    def test_softmax_empty(self):
        assert softmax([]) == []

    def test_entropy_confidence_bounds(self):
        assert entropy_confidence([1.0, 0.0, 0.0]) == pytest.approx(1.0)
        assert entropy_confidence([1 / 3, 1 / 3, 1 / 3]) == pytest.approx(0.0)
        # Two-option near-uniform sits near the middle of [0, 1].
        mid = entropy_confidence([0.6, 0.4])
        assert 0.0 < mid < 1.0

    def test_choice_from_scores_picks_argmax(self):
        choice = choice_from_scores("operation", ["click", "fill"], [0.5, 3.0])
        assert choice.chosen == "fill"
        assert choice.probabilities["fill"] > choice.probabilities["click"]
        choice.validate()


class TestValidation:
    def test_probabilities_must_sum_to_one(self):
        choice = Choice("q", "a", {"a": 0.7, "b": 0.1}, 0.5)
        with pytest.raises(DecisionValidationError):
            choice.validate()

    def test_confidence_bounds_enforced(self):
        choice = Choice("q", "a", {"a": 1.0}, 1.5)
        with pytest.raises(DecisionValidationError):
            choice.validate()

    def test_chosen_must_be_an_option(self):
        choice = Choice("q", "zzz", {"a": 1.0}, 0.5)
        with pytest.raises(DecisionValidationError):
            choice.validate()

    def test_empty_decision_rejected(self):
        with pytest.raises(DecisionValidationError):
            TypedDecision(choices={}).validate()


class TestMockHead:
    def test_implements_protocol(self):
        assert isinstance(MockHead(), DecisionHead)

    def test_scripted_decisions(self):
        head = MockHead(decisions={"operation": "fill"}, latency_ms=5.0)
        decision = head.decide("state", [
            Question("operation", ["click", "fill"]),
            Question("fill_target", ["0", "1"]),
        ])
        decision.validate()
        assert decision.choices["operation"].chosen == "fill"
        # Unscripted question falls back to the first option.
        assert decision.choices["fill_target"].chosen == "0"
        assert decision.choices["operation"].probabilities["fill"] == 1.0
        assert decision.latency_ms >= 5.0
        assert decision.model_id == "mock-head"

    def test_chooser_callback(self):
        head = MockHead(chooser=lambda q, s: q.options[-1], confidence=0.7)
        decision = head.decide("state", [Question("operation", ["click", "fill"])])
        assert decision.choices["operation"].chosen == "fill"
        assert decision.choices["operation"].confidence == 0.7

    def test_deterministic(self):
        head = MockHead(decisions={"operation": "click"})
        questions = [Question("operation", ["click", "fill"])]
        d1 = head.decide("same state", questions)
        d2 = head.decide("same state", questions)
        # Choices are byte-identical; only wall-clock latency may differ.
        assert d1.to_dict()["choices"] == d2.to_dict()["choices"]
        assert d1.model_id == d2.model_id

    def test_choice_outside_options_rejected(self):
        head = MockHead(decisions={"operation": "navigate"})
        with pytest.raises(DecisionValidationError):
            head.decide("state", [Question("operation", ["click", "fill"])])


class TestMlxDirectLogitHead:
    def test_repo_is_public_ungated_class(self):
        assert "Qwen3-4B-Instruct-2507" in DEFAULT_MODEL_REPO
        assert "mlx-community" in DEFAULT_MODEL_REPO

    def test_missing_dependency_raises_actionable_error(self):
        if MLX_AVAILABLE:
            pytest.skip("mlx-lm installed — absence path not exercisable")
        head = MlxDirectLogitHead()
        with pytest.raises(ShadowHeadDependencyError) as excinfo:
            head.decide("state", [Question("operation", ["click", "fill"])])
        assert "shadow-head" in str(excinfo.value)

    @pytest.mark.skipif(
        not MLX_AVAILABLE or not _weights_cached(),
        reason="mlx-lm and/or head weights not installed (offline harness runs on MockHead)",
    )
    def test_real_weights_one_pass(self):
        head = MlxDirectLogitHead()
        decision = head.decide(
            "[TASK]\nClick the Search button\n\n[OBSERVED ELEMENTS]\n"
            "[0] AXTextField: Search query\n[1] AXButton: Search\n",
            [
                Question("operation", ["click", "fill"]),
                Question("click_target", ["0", "1"]),
            ],
        )
        decision.validate()
        assert set(decision.choices) == {"operation", "click_target"}
        assert decision.latency_ms > 0
