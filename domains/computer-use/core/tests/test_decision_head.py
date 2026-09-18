"""Unit tests for core/decision_head.py — typed decisions, MockHead, mlx head."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import pytest

from core.decision_head import (
    CANONICAL_OPERATIONS,
    DEFAULT_MODEL_REPO,
    Choice,
    DecisionHead,
    DecisionValidationError,
    KimiCliHead,
    MockHead,
    MlxDirectLogitHead,
    Question,
    ShadowHeadDependencyError,
    TypedDecision,
    canonical_operation,
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


class TestCanonicalVocabulary:
    def test_whitelist_is_the_eleven_names(self):
        assert set(CANONICAL_OPERATIONS) == {
            "click", "fill", "type", "press", "scrollTo", "nextChunk",
            "prevChunk", "selectOptionFromDropdown", "hover", "doubleClick",
            "dragAndDrop",
        }

    def test_canonical_identities(self):
        for op in CANONICAL_OPERATIONS:
            assert canonical_operation(op) == op

    @pytest.mark.parametrize("alias,expected", [
        ("input", "type"), ("enter", "press"), ("key", "press"),
        ("scroll", "scrollTo"), ("select", "selectOptionFromDropdown"),
        ("double_click", "doubleClick"), ("drag", "dragAndDrop"),
    ])
    def test_legacy_aliases_fold_to_canonical(self, alias, expected):
        assert canonical_operation(alias) == expected

    def test_unknown_names_pass_through(self):
        assert canonical_operation("navigate") == "navigate"


class TestKimiCliHead:
    """KimiCliHead unit tests — the subprocess is always stubbed; no real
    CLI call happens anywhere in the test path."""

    def _head(self, monkeypatch, **kwargs) -> KimiCliHead:
        monkeypatch.setattr("shutil.which", lambda _bin: "/fake/bin/kimi")
        return KimiCliHead(**kwargs)

    def _stub_cli(self, head: KimiCliHead, outputs):
        calls: list[str] = []

        def fake_call(prompt: str):
            calls.append(prompt)
            out = outputs[min(len(calls) - 1, len(outputs) - 1)]
            if isinstance(out, Exception):
                raise out
            return out, 25_000.0

        head._call_cli = fake_call  # type: ignore[method-assign]
        return calls

    def test_missing_binary_raises_actionable_error(self, monkeypatch):
        monkeypatch.setattr("shutil.which", lambda _bin: None)
        with pytest.raises(ShadowHeadDependencyError) as excinfo:
            KimiCliHead()
        assert "kimi" in str(excinfo.value)

    def test_implements_protocol(self, monkeypatch):
        assert isinstance(self._head(monkeypatch), DecisionHead)

    def test_batched_decide_parses_banner_wrapped_json(self, monkeypatch):
        head = self._head(monkeypatch)
        self._stub_cli(head, [
            'kimi version 2.0.0\n• thinking\n'
            '• {"operation": {"answer": "click", "confidence": 0.8},'
            ' "click_target": {"answer": "3", "confidence": 0.6},'
            ' "goal_satisfied": {"answer": "false", "confidence": 0.9},'
            ' "stuck": {"answer": "no", "confidence": 0.7}}\n'
            'To resume this session: kimi -r deadbeef\n',
        ])
        decision = head.decide("state", [
            Question("operation", ["click", "fill"]),
            Question("click_target", ["1", "3"]),
            Question("goal_satisfied", ["true", "false"]),
            Question("stuck", ["true", "false"]),
        ])
        decision.validate()
        op = decision.choices["operation"]
        assert op.chosen == "click"
        assert op.confidence == pytest.approx(0.8)
        assert op.probabilities["click"] == pytest.approx(0.8)
        assert op.probabilities["fill"] == pytest.approx(0.2)
        assert decision.choices["click_target"].chosen == "3"
        # Gate alias "no" folds to canonical "false" (and is logged).
        assert decision.choices["stuck"].chosen == "false"
        assert head.vocab_misses == [
            {"question": "stuck", "raw": "no", "kind": "alias"}
        ]

    def test_probabilities_sum_to_one(self, monkeypatch):
        head = self._head(monkeypatch)
        self._stub_cli(head, [
            '{"operation": {"answer": "fill", "confidence": 0.5}}',
        ])
        decision = head.decide("state", [
            Question("operation", ["click", "fill", "type"]),
        ])
        probs = decision.choices["operation"].probabilities
        assert sum(probs.values()) == pytest.approx(1.0)
        assert probs["fill"] == pytest.approx(0.5)
        assert probs["click"] == pytest.approx(0.25)

    def test_alias_answer_is_folded_and_logged_as_vocab_miss(self, monkeypatch):
        head = self._head(monkeypatch)
        self._stub_cli(head, [
            '{"operation": {"answer": "input", "confidence": 0.7}}',
        ])
        decision = head.decide("state", [
            Question("operation", ["click", "type", "fill"]),
        ])
        assert decision.choices["operation"].chosen == "type"
        assert head.vocab_misses == [
            {"question": "operation", "raw": "input", "kind": "alias"}
        ]

    def test_out_of_vocab_answer_falls_back_uniform(self, monkeypatch):
        head = self._head(monkeypatch)
        self._stub_cli(head, [
            '{"operation": {"answer": "navigate", "confidence": 0.9}}',
        ])
        decision = head.decide("state", [
            Question("operation", ["click", "fill"]),
        ])
        decision.validate()  # uniform fallback still validates
        choice = decision.choices["operation"]
        assert choice.chosen == "click"  # first-option fallback
        assert choice.confidence == 0.0
        assert choice.probabilities == {"click": 0.5, "fill": 0.5}
        assert head.vocab_misses[0]["kind"] == "out_of_vocab"

    def test_parse_failure_retries_once_with_repair_prompt(self, monkeypatch):
        head = self._head(monkeypatch)
        calls = self._stub_cli(head, [
            "not json at all",
            '{"operation": {"answer": "click", "confidence": 0.6}}',
        ])
        decision = head.decide("state", [Question("operation", ["click", "fill"])])
        assert decision.choices["operation"].chosen == "click"
        assert len(calls) == 2
        assert "failed to parse" in calls[1]

    def test_unreparable_answer_records_parse_miss_never_crashes(self, monkeypatch):
        head = self._head(monkeypatch)
        calls = self._stub_cli(head, ["garbage", "still garbage"])
        decision = head.decide("state", [Question("operation", ["click", "fill"])])
        decision.validate()
        assert decision.choices["operation"].probabilities == {"click": 0.5, "fill": 0.5}
        assert len(calls) == 2  # one original + one repair attempt
        assert head.vocab_misses == [
            {"question": "operation", "raw": None, "kind": "parse_miss"}
        ]

    def test_sequential_asks_operation_first_then_chosen_target(self, monkeypatch):
        head = self._head(monkeypatch, questioning="sequential")
        calls = self._stub_cli(head, [
            '{"operation": {"answer": "click", "confidence": 0.8},'
            ' "goal_satisfied": {"answer": "false", "confidence": 0.9},'
            ' "stuck": {"answer": "false", "confidence": 0.9}}',
            '{"click_target": {"answer": "3", "confidence": 0.6}}',
        ])
        decision = head.decide("state", [
            Question("operation", ["click", "fill"]),
            Question("click_target", ["1", "3"]),
            Question("fill_target", ["0", "2"]),
            Question("goal_satisfied", ["true", "false"]),
            Question("stuck", ["true", "false"]),
        ])
        decision.validate()
        assert decision.choices["operation"].chosen == "click"
        assert decision.choices["click_target"].chosen == "3"
        assert "goal_satisfied" in decision.choices
        # The non-chosen operation's target is NOT asked (not fabricated).
        assert "fill_target" not in decision.choices
        assert len(calls) == 2
        assert "operation:" in calls[0] and "goal_satisfied:" in calls[0]
        assert "click_target:" in calls[1]

    def test_sequential_without_operation_question_degrades_to_one_pass(self, monkeypatch):
        head = self._head(monkeypatch, questioning="sequential")
        calls = self._stub_cli(head, ['{"stuck": {"answer": "false", "confidence": 0.9}}'])
        decision = head.decide("state", [Question("stuck", ["true", "false"])])
        assert decision.choices["stuck"].chosen == "false"
        assert len(calls) == 1

    def test_cli_failure_raises_shadow_head_error(self, monkeypatch):
        from core.decision_head import ShadowHeadError

        head = self._head(monkeypatch)
        # _call_cli raises ShadowHeadError in production (nonzero exit,
        # timeout); the stub reproduces that contract directly.
        self._stub_cli(head, [ShadowHeadError("kimi CLI exited 1: auth expired")])
        with pytest.raises(ShadowHeadError):
            head.decide("state", [Question("operation", ["click", "fill"])])

    def test_model_id_marks_questioning_mode(self, monkeypatch):
        assert self._head(monkeypatch).model_id == "kimi-cli"
        assert self._head(monkeypatch, questioning="sequential").model_id == \
            "kimi-cli:sequential"
