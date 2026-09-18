"""
Few-shot exemplar selection + prompt assembly tests for the KimiCliHead.

The hard invariant under test: held-out eval tasks (search-flow, form-fill,
settings-toggle) must NEVER appear in a few-shot prompt — selection must
exclude them even when they are present in the trace list, and must raise if
one slips through filtering. The subprocess is always stubbed (no real CLI).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from core.decision_head import KimiCliHead, Question
from core.kimi_fewshot import (
    HELD_OUT_TASK_IDS,
    exemplar_from_trace,
    render_few_shot_block,
    select_few_shot_examples,
)
from core.tier_a_traces import load_traces

TRACE_PATH = (
    Path(__file__).resolve().parents[1] / "evaluation" / "tier-a" / "traces.jsonl"
)


def _record(
    trace_id: str = "search-v01:s1",
    split: str = "train",
    operation: str = "click",
    with_target: bool = True,
):
    target_question = f"{operation}_target"
    questions = [
        {"name": "operation", "options": ["click", "fill", "scrollTo"]},
    ]
    gold = {"operation": operation}
    if with_target:
        questions.append({"name": target_question, "options": ["1", "3"]})
        gold[target_question] = "3"
    return {
        "schema_version": 1,
        "trace_id": trace_id,
        "task_id": trace_id.split(":")[0],
        "template": trace_id.split("-")[0],
        "split": split,
        "step": 1,
        "state_text": (
            "[TASK]\nFind things\n\n[OBSERVED ELEMENTS]\n"
            "[0] AXWindow: EvalBrowser\n[@e1] AXButton: Go\n\n"
            "[OPTIONS]\noperation: click, fill, scrollTo\n"
        ),
        "questions": questions,
        "gold": gold,
        "llm": {"op": operation, "target": "Go", "text": None, "success": True},
    }


class TestExemplarFromTrace:
    def test_builds_exemplar_with_operation_and_target(self):
        exemplar = exemplar_from_trace(_record())
        assert exemplar is not None
        assert exemplar["operation"] == "click"
        assert exemplar["target"] == {
            "question": "click_target", "answer": "3", "element": "Go",
        }
        assert "Observed" in exemplar["state_excerpt"] or "[0] AXWindow" in exemplar["state_excerpt"]

    def test_heldout_split_is_rejected(self):
        for task_id in HELD_OUT_TASK_IDS:
            assert exemplar_from_trace(
                _record(trace_id=f"{task_id}:s1", split="heldout")
            ) is None

    def test_heldout_task_id_rejected_even_on_train_split(self):
        # Defense in depth: the task_id check fires regardless of the split
        # string — a mislabelled record must never become an exemplar.
        assert exemplar_from_trace(
            _record(trace_id="search-flow:s1", split="train")
        ) is None

    def test_val_split_is_rejected(self):
        assert exemplar_from_trace(_record(split="val")) is None

    def test_non_canonical_operation_is_rejected(self):
        assert exemplar_from_trace(_record(operation="navigate")) is None

    def test_missing_state_block_is_rejected(self):
        record = _record()
        record["state_text"] = "no elements here"
        assert exemplar_from_trace(record) is None

    def test_target_dropped_when_not_in_menu_options(self):
        record = _record()
        record["gold"]["click_target"] = "99"
        exemplar = exemplar_from_trace(record)
        assert exemplar is not None
        assert exemplar["target"] is None


class TestSelectFewShotExamples:
    def test_hard_invariant_no_heldout_task_ids_anywhere(self):
        traces = [
            _record(trace_id=f"search-v0{i}:s1") for i in range(4)
        ] + [
            _record(trace_id="search-flow:s1", split="heldout"),
            _record(trace_id="form-fill:s2", split="heldout"),
            _record(trace_id="settings-toggle:s3", split="heldout"),
            _record(trace_id="search-v99:s1", split="val"),
        ]
        selected = select_few_shot_examples(traces, n=4, seed=1)
        assert len(selected) == 4
        for exemplar in selected:
            task_id = exemplar["trace_id"].split(":")[0]
            assert task_id not in HELD_OUT_TASK_IDS
            assert not task_id.endswith("v99")

    def test_rejects_unknown_order(self):
        with pytest.raises(ValueError):
            select_few_shot_examples([_record()], n=1, order="bogus")

    def test_n_zero_returns_empty(self):
        assert select_few_shot_examples([_record()], n=0) == []

    def test_random_order_is_seeded_and_deterministic(self):
        pool = [_record(trace_id=f"search-v{i:02d}:s1") for i in range(20)]
        a = select_few_shot_examples(pool, n=8, seed=42)
        b = select_few_shot_examples(pool, n=8, seed=42)
        assert [e["trace_id"] for e in a] == [e["trace_id"] for e in b]
        c = select_few_shot_examples(pool, n=8, seed=7)
        assert [e["trace_id"] for e in a] != [e["trace_id"] for e in c]

    def test_interleaved_order_never_places_same_template_adjacently(self):
        pool = [
            _record(trace_id=f"{tpl}-v{i:02d}:s1")
            for tpl in ("search", "form", "settings") for i in range(6)
        ]
        selected = select_few_shot_examples(pool, n=9, seed=3, order="interleaved")
        assert len(selected) == 9
        templates = [e["template"] for e in selected]
        assert all(
            templates[i] != templates[i + 1] for i in range(len(templates) - 1)
        ), f"adjacent same-template exemplars: {templates}"

    def test_real_traces_produce_exemplars_without_heldout(self):
        traces = load_traces(TRACE_PATH)
        selected = select_few_shot_examples(traces, n=8, seed=42)
        assert len(selected) == 8
        assert all(
            e["trace_id"].split(":")[0] not in HELD_OUT_TASK_IDS
            for e in selected
        )
        assert {e["template"] for e in selected}  # templates always present


class TestRenderFewShotBlock:
    def test_block_carries_examples_and_decisions(self):
        exemplars = select_few_shot_examples(
            [_record(trace_id=f"search-v0{i}:s1") for i in range(3)],
            n=3, seed=1,
        )
        block = render_few_shot_block(exemplars)
        assert "[EXAMPLES" in block
        assert "Example 1:" in block and "Example 3:" in block
        assert 'operation = "click"' in block
        assert "[END OF EXAMPLES" in block

    def test_task_neutral_framing_states_current_state_only(self):
        block = render_few_shot_block(
            select_few_shot_examples([_record()], n=1, seed=1),
            framing="task-neutral",
        )
        assert "CURRENT state" in block
        assert "NO fixed per-site policy" in block

    def test_rejects_unknown_framing(self):
        with pytest.raises(ValueError):
            render_few_shot_block(
                select_few_shot_examples([_record()], n=1, seed=1),
                framing="bogus",
            )

    def test_empty_examples_render_empty_block(self):
        assert render_few_shot_block([]) == ""


class TestKimiCliHeadFewShotPrompt:
    """Prompt assembly: the exemplar block lands in the subprocess prompt,
    before [STATE], and the strict JSON contract is unchanged."""

    def _head(self, monkeypatch, block):
        monkeypatch.setattr("shutil.which", lambda _bin: "/fake/bin/kimi")
        return KimiCliHead(few_shot_block=block)

    def _stub_cli(self, head):
        calls: list[str] = []

        def fake_call(prompt: str):
            calls.append(prompt)
            return '{"operation": {"answer": "click", "confidence": 0.8}}', 25_000.0

        head._call_cli = fake_call  # type: ignore[method-assignment]
        return calls

    def test_block_injected_before_state(self, monkeypatch):
        block = render_few_shot_block(
            select_few_shot_examples([_record()], n=1, seed=1)
        )
        head = self._head(monkeypatch, block)
        calls = self._stub_cli(head)
        head.decide("the live state", [Question("operation", ["click", "fill"])])
        prompt = calls[0]
        assert "[EXAMPLES" in prompt
        assert prompt.index("[EXAMPLES") < prompt.index("[STATE]")
        assert "the live state" in prompt

    def test_zero_shot_prompt_has_no_block(self, monkeypatch):
        monkeypatch.setattr("shutil.which", lambda _bin: "/fake/bin/kimi")
        head = KimiCliHead()
        calls = self._stub_cli(head)
        head.decide("state", [Question("operation", ["click", "fill"])])
        assert "[EXAMPLES" not in calls[0]

    def test_model_id_flags_fewshot(self, monkeypatch):
        head = self._head(monkeypatch, "block")
        assert ":fewshot" in head.model_id

    def test_repair_prompt_preserves_block(self, monkeypatch):
        block = render_few_shot_block(
            select_few_shot_examples([_record()], n=1, seed=1)
        )
        head = self._head(monkeypatch, block)
        calls: list[str] = []

        def fake_call(prompt: str):
            calls.append(prompt)
            if len(calls) == 1:
                return "not json", 25_000.0
            return '{"operation": {"answer": "fill", "confidence": 0.7}}', 25_000.0

        head._call_cli = fake_call  # type: ignore[method-assignment]
        decision = head.decide("state", [Question("operation", ["click", "fill"])])
        assert decision.choices["operation"].chosen == "fill"
        assert len(calls) == 2
        assert "[EXAMPLES" in calls[1]
        assert "failed to parse" in calls[1]
