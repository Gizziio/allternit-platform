"""Unit tests for core/semif_head.py — SemIf head mapping layer + live scoring.

The mapping layer (build_rows / choices_from_results) is pure and always
runs. The live-scoring tests skip when the optional SemIf dependency (or
its pinned Qwen3.5 weights) is not installed, mirroring the mlx head tests.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from core.decision_head import (
    DecisionValidationError,
    Question,
    ShadowHeadDependencyError,
    entropy_confidence,
)
from core.semif_head import (
    DEFAULT_MODEL_SOURCE,
    DEFAULT_REVISION,
    SemIfHead,
    build_rows,
    choices_from_results,
)

SEMIF_AVAILABLE = importlib.util.find_spec("semif_phase1") is not None


def _semif_weights_cached() -> bool:
    """True when the pinned Qwen3.5-4B snapshot is in the local HF cache."""
    cache = Path.home() / ".cache" / "huggingface" / "hub"
    if not cache.exists():
        return False
    return any(
        entry.name.startswith("models--Qwen--Qwen3.5-4B")
        for entry in cache.iterdir()
        if entry.is_dir()
    )


class TestModelPin:
    def test_reference_model_is_qwen35_pinned(self):
        assert DEFAULT_MODEL_SOURCE == "Qwen/Qwen3.5-4B"
        assert DEFAULT_REVISION and len(DEFAULT_REVISION) == 40

    def test_bits_validation(self):
        with pytest.raises(ValueError):
            SemIfHead(bits=6)


class TestBuildRows:
    def test_row_schema_matches_semif_validator(self):
        questions = [
            Question("operation", ["click", "fill"]),
            Question("click_target", ["0", "1"]),
            Question("goal_satisfied", ["true", "false"]),
        ]
        scored, rows = build_rows(questions, "STATE TEXT")
        assert len(rows) == 3
        for row, question in zip(rows, questions):
            assert row["id"] == question.name
            assert row["state"] == "STATE TEXT"
            assert isinstance(row["question"], str) and row["question"]
            assert [option["id"] for option in row["options"]] == question.options
            assert [
                option["description"] for option in row["options"]
            ] == question.options
        # Scored questions parallel the rows (no truncation needed here).
        assert [q.name for q in scored] == [q.name for q in questions]

    def test_target_menu_truncates_at_16(self):
        options = [str(i) for i in range(40)]
        scored, rows = build_rows(
            [Question("click_target", options)], "STATE", max_options=16
        )
        assert len(rows[0]["options"]) == 16
        assert scored[0].options == options[:16]
        # The caller's original Question is untouched (no mutation).
        assert len(options) == 40

    def test_single_option_question_rejected(self):
        with pytest.raises(DecisionValidationError):
            build_rows([Question("operation", ["click"])], "STATE")

    def test_duplicate_option_strings_deduped_like_question(self):
        _, rows = build_rows(
            [Question("operation", ["click", "click", "fill"])], "STATE"
        )
        assert [option["id"] for option in rows[0]["options"]] == ["click", "fill"]


class TestChoicesFromResults:
    def _rows_and_results(self):
        rows = [
            {
                "id": "operation",
                "state": "S",
                "question": "q",
                "options": [
                    {"id": "click", "description": "click"},
                    {"id": "fill", "description": "fill"},
                ],
            },
            {
                "id": "click_target",
                "state": "S",
                "question": "q",
                "options": [
                    {"id": "0", "description": "0"},
                    {"id": "1", "description": "1"},
                ],
            },
        ]
        results = [
            {"id": "click_target", "option_ids": ["0", "1"],
             "probabilities": [0.25, 0.75]},
            {"id": "operation", "option_ids": ["click", "fill"],
             "probabilities": [0.9, 0.1]},
        ]
        return rows, results

    def test_choice_shape_and_mapping(self):
        rows, results = self._rows_and_results()
        choices = choices_from_results(rows, results)
        assert set(choices) == {"operation", "click_target"}

        op = choices["operation"]
        assert op.chosen == "click"
        assert op.probabilities == {"click": pytest.approx(0.9), "fill": pytest.approx(0.1)}
        assert op.confidence == pytest.approx(entropy_confidence([0.9, 0.1]))

        target = choices["click_target"]
        assert target.chosen == "1"
        assert target.question == "click_target"

    def test_results_order_does_not_matter(self):
        rows, results = self._rows_and_results()
        reordered = choices_from_results(rows, list(reversed(results)))
        direct = choices_from_results(rows, results)
        assert reordered == direct

    def test_deterministic_on_identical_inputs(self):
        rows, results = self._rows_and_results()
        assert choices_from_results(rows, results) == choices_from_results(rows, results)

    def test_confidence_is_entropy_convention(self):
        rows, _ = self._rows_and_results()
        uniform = [
            {"id": "operation", "option_ids": ["click", "fill"],
             "probabilities": [0.5, 0.5]},
        ]
        peaked = [
            {"id": "operation", "option_ids": ["click", "fill"],
             "probabilities": [0.999, 0.001]},
        ]
        assert choices_from_results(rows[:1], uniform)["operation"].confidence == pytest.approx(0.0, abs=1e-9)
        assert choices_from_results(rows[:1], peaked)["operation"].confidence > 0.9

    def test_mismatched_lengths_rejected(self):
        rows, _ = self._rows_and_results()
        bad = [{"id": "operation", "option_ids": ["click", "fill"], "probabilities": [0.5]}]
        with pytest.raises(Exception):
            choices_from_results(rows[:1], bad)


class TestSemIfHeadDependency:
    def test_missing_dependency_raises_actionable_error(self):
        if SEMIF_AVAILABLE:
            pytest.skip("semif-phase1 installed — absence path not exercisable")
        head = SemIfHead()
        with pytest.raises(ShadowHeadDependencyError) as excinfo:
            head.decide("state", [Question("operation", ["click", "fill"])])
        assert "semif" in str(excinfo.value)


@pytest.mark.skipif(
    not SEMIF_AVAILABLE or not _semif_weights_cached(),
    reason="semif-phase1 and/or Qwen3.5-4B weights not installed (offline harness runs on MockHead)",
)
class TestSemIfHeadLive:
    def test_real_weights_one_shared_pass(self):
        head = SemIfHead()
        decision = head.decide(
            "[TASK]\nClick the Search button\n\n[SINCE LAST STEP]\n"
            "This is the first observed state; no prior step to compare.\n\n"
            "[OBSERVED ELEMENTS]\n"
            "[0] AXTextField: Search query\n[1] AXButton: Search\n\n"
            "[OPTIONS]\noperation: click, fill\nclick_target: 0, 1\n\n"
            "The next browser operation is:",
            [
                Question("operation", ["click", "fill"]),
                Question("click_target", ["0", "1"]),
                Question("goal_satisfied", ["true", "false"]),
            ],
        )
        decision.validate()
        assert set(decision.choices) == {"operation", "click_target", "goal_satisfied"}
        assert decision.latency_ms > 0
        assert "semif:" in decision.model_id and ":shared" in decision.model_id

    def test_real_weights_choices_stable_across_passes(self):
        # Same state + same questions → same chosen options (argmax stability
        # of SemIf's shared-state pass on this hardware).
        head = SemIfHead()
        questions = [
            Question("operation", ["click", "fill", "scrollTo"]),
            Question("click_target", ["0", "1", "2"]),
        ]
        state = (
            "[TASK]\nOpen the first result\n\n[SINCE LAST STEP]\n"
            "No change\n\n[OBSERVED ELEMENTS]\n"
            "[0] AXLink: First result\n[1] AXButton: Search\n"
            "[2] AXScrollArea: Results\n\n"
            "[OPTIONS]\noperation: click, fill, scrollTo\n"
            "click_target: 0, 1, 2\n\nThe next browser operation is:"
        )
        first = head.decide(state, questions)
        second = head.decide(state, questions)
        for name, choice in first.choices.items():
            assert second.choices[name].chosen == choice.chosen
