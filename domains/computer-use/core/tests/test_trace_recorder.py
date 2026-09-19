"""Tests for the live shadow-head trace recorder (core/trace_recorder.py)
and its planning-loop wiring (PlanningLoopConfig.shadow_trace_path).

Covers: write-time redaction (on/off, nasty password case), JSONL record
shape readable by tier_a_traces.validate_trace + kimi_fewshot.exemplar_from_trace,
split labeling (held-out task ids never become train exemplars), gold
operation/target mapping from the executed LLM step, recorder-off
byte-identical behavior (no file), and failure degradation.
"""

from __future__ import annotations

import json

import pytest

from core import shadow_eval
from core.decision_head import MockHead
from core.element_refs import get_refmap
from core.element_table import build_element_table
from core.kimi_fewshot import HELD_OUT_TASK_IDS, exemplar_from_trace
from core.planning_loop import PlanningLoop, PlanningLoopConfig
from core.tier_a_traces import validate_trace
from core.trace_recorder import REDACTED, TraceRecorder, redact_state_text

PASSWORD = "hunter2"
EMAIL = "operator@eval.local"

# A state text in the canonical shadow format with a CHANGED row carrying a
# password value (the PII-sensitive nasty case) and element rows whose names
# must survive redaction.
_STATE_WITH_SECRET = (
    "[TASK]\nLog in with the saved operator credentials\n\n"
    "[SINCE LAST STEP]\n"
    "CHANGED (1):\n"
    f'~ [e2] AXTextField: Password = "{PASSWORD}" (was "")\n\n'
    "[OBSERVED ELEMENTS]\n"
    "[e1] AXTextField: Email\n"
    "[e2] AXTextField: Password\n"
    "[e3] AXButton: Submit\n\n"
    "[OPTIONS]\noperation: click, fill\n\n"
    "[INSTRUCTIONS]\nChoose.\n\n"
    "The next browser operation is:"
)

_QUESTIONS = [
    {"name": "operation", "options": ["click", "fill"]},
    {"name": "fill_target", "options": ["1", "2"]},
    {"name": "goal_satisfied", "options": ["true", "false"]},
    {"name": "stuck", "options": ["true", "false"]},
]

_DECISION = {
    "model_id": "mock-head",
    "latency_ms": 1.5,
    "choices": {
        "operation": {
            "question": "operation",
            "chosen": "fill",
            "probabilities": {"fill": 1.0, "click": 0.0},
            "confidence": 0.9,
        },
        "fill_target": {
            "question": "fill_target",
            "chosen": "1",
            "probabilities": {"1": 1.0, "2": 0.0},
            "confidence": 0.8,
        },
    },
}


def _form_table():
    task = shadow_eval.default_tasks(4)[1]  # form-fill
    return build_element_table(shadow_eval._step_trees(task)[0])


def _event(**overrides):
    event = {
        "task_id": "live-session-1",
        "run_id": "cu-run1",
        "step": 2,
        "state_text": _STATE_WITH_SECRET,
        "questions": [dict(q) for q in _QUESTIONS],
        "decision": json.loads(json.dumps(_DECISION)),
        "latency_ms": 1.5,
        "table": _form_table(),
        "prior_step": {
            "action_type": "fill",
            "action_target": "Email",
            "text": EMAIL,
            "action_succeeded": True,
        },
        "ts": "2026-09-18T00:00:00+00:00",
    }
    event.update(overrides)
    return event


def _read_lines(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


class TestRedaction:
    def test_password_value_never_reaches_the_file(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event())
        raw = path.read_text()
        assert PASSWORD not in raw
        assert EMAIL not in raw  # the executed step's typed text, redacted
        assert f'= "{REDACTED}" (was "{REDACTED}")' in record["state_text"]
        # Names are the decision vocabulary — they survive.
        assert "Password" in raw
        assert "Email" in raw
        assert record["redacted"] is True
        assert record["llm"]["text"] == REDACTED
        assert record["llm"]["target"] == "Email"  # element name, kept

    def test_redaction_off_preserves_values(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path, redact_values=False) as recorder:
            record = recorder.record(_event())
        raw = path.read_text()
        assert PASSWORD in raw
        assert EMAIL in raw
        assert record["redacted"] is False
        assert record["llm"]["text"] == EMAIL

    def test_redact_state_text_keeps_names_and_structure(self):
        redacted = redact_state_text(_STATE_WITH_SECRET)
        assert PASSWORD not in redacted
        assert '[e2] AXTextField: Password' in redacted
        # Non-CHANGED lines are untouched.
        assert 'CHANGED (1):' in redacted
        assert '[OBSERVED ELEMENTS]' in redacted


class TestRecordShape:
    def test_record_validates_against_tier_a_schema(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event())
        validate_trace(record)  # raises on schema drift

    def test_live_record_is_a_fewshot_exemplar(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event())
        exemplar = exemplar_from_trace(record)
        assert exemplar is not None
        assert exemplar["operation"] == "fill"
        assert exemplar["target"]["answer"] == "1"  # Email is table row 1
        assert exemplar["target"]["element"] == "Email"

    def test_trace_id_shape(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event(task_id="t1", run_id="r1", step=7))
        assert record["trace_id"] == "t1:r1:7"

    def test_head_choices_recorded_with_confidence(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event())
        op = record["head"]["choices"]["operation"]
        assert op["chosen"] == "fill"
        assert op["confidence"] == 0.9
        assert record["head"]["model_id"] == "mock-head"
        assert record["effect"] == "confirmed"
        assert record["template"] == "live"


class TestSplitLabeling:
    def test_held_out_task_ids_label_heldout(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event(task_id="form-fill"))
        assert record["split"] == "heldout"
        # And therefore can never serve as a few-shot exemplar.
        assert exemplar_from_trace(record) is None

    def test_live_task_ids_default_to_train(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event(task_id="real-client-session-9"))
        assert record["split"] == "train"
        assert exemplar_from_trace(record) is not None

    def test_held_out_set_matches_kimi_fewshot(self):
        assert HELD_OUT_TASK_IDS == frozenset(
            {"search-flow", "form-fill", "settings-toggle"}
        )


class TestGoldLabeling:
    def test_operation_folded_through_eval_op_map(self, tmp_path):
        # "type" is the LLM transcript vocabulary for a value entry; the
        # head menu says "fill" (shadow_eval._LLM_OP_MAP).
        path = tmp_path / "live-traces.jsonl"
        prior = {
            "action_type": "type",
            "action_target": "Password",
            "text": PASSWORD,
            "action_succeeded": True,
        }
        with TraceRecorder(path, redact_values=False) as recorder:
            record = recorder.record(_event(prior_step=prior))
        assert record["gold"]["operation"] == "fill"
        assert record["gold"]["fill_target"] == "2"  # Password is table row 2
        assert record["llm"]["op"] == "fill"

    def test_target_resolved_via_table_match(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        prior = {
            "action_type": "click",
            "action_target": "Submit",
            "text": None,
            "action_succeeded": False,
        }
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event(prior_step=prior))
        # click is in this event's operation menu; there is no click_target
        # question, so gold carries the operation only.
        assert record["gold"] == {"operation": "click"}
        assert record["effect"] == "suspected_noop"
        assert record["llm"]["success"] is False

    def test_step_one_has_no_prior_label(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event(step=1, prior_step=None))
        assert record["gold"] == {}
        assert record["llm"] == {}
        assert record["effect"] is None

    def test_unresolvable_target_omitted_from_gold(self, tmp_path):
        path = tmp_path / "live-traces.jsonl"
        prior = {
            "action_type": "fill",
            "action_target": "No such element anywhere",
            "text": None,
            "action_succeeded": True,
        }
        with TraceRecorder(path) as recorder:
            record = recorder.record(_event(prior_step=prior))
        assert record["gold"] == {"operation": "fill"}


class TestPlanningLoopWiring:
    async def _run(self, tmp_path, task, config_kwargs=None, session_id="shadow-hook-test"):
        get_refmap().clear()
        provider = shadow_eval.ScriptedVisionProvider(task.turns)
        adapter = shadow_eval.ScriptedAdapter(fail_targets=task.fail_targets)
        events = []
        _, restore = shadow_eval._patch_inspector(shadow_eval._step_trees(task))
        try:
            config = PlanningLoopConfig(
                max_steps=len(task.turns) + 2,
                approval_policy="never",
                reflect_after_each_step=False,
                batch_enabled=False,
                **(config_kwargs or {}),
            )
            loop = PlanningLoop(
                vision_provider=provider,
                adapter=adapter,
                config=config,
                event_callback=events.append,
            )
            result = await loop.run(task.task, session_id=session_id)
        finally:
            restore()
        return result, events, adapter

    def _task(self, steps: int = 6):
        return shadow_eval.default_tasks(steps)[1]  # form-fill

    async def test_recorder_off_writes_no_file_and_keeps_events(self, tmp_path):
        task = self._task()
        result, events, adapter = await self._run(
            tmp_path, task,
            {"shadow_head_enabled": True, "shadow_head": MockHead(latency_ms=2.0)},
        )
        assert result.stop_reason.value == "done"
        assert [e for e in events if e["type"] == "shadow.decision"]
        assert list(tmp_path.iterdir()) == []  # nothing written anywhere

    async def test_recorder_on_appends_one_redacted_record_per_step(self, tmp_path):
        task = self._task()
        trace_path = tmp_path / "live-traces.jsonl"
        result, _, adapter = await self._run(
            tmp_path, task,
            {
                "shadow_head_enabled": True,
                "shadow_head": MockHead(latency_ms=2.0),
                "shadow_trace_path": str(trace_path),
            },
            session_id="shadow-form-fill",
        )
        assert result.stop_reason.value == "done"
        records = _read_lines(trace_path)
        assert len(records) == len(task.turns)
        for record in records:
            validate_trace(record)
            assert record["redacted"] is True
            assert record["split"] == "heldout"  # session_id was shadow-form-fill
            assert record["task_id"] == "form-fill"
            assert record["run_id"]  # the loop's run id is recorded
        # Step 2's reference label is the step-1 executed LLM turn:
        # fill on Email (transcript "fill" -> head-menu "fill", row 1 —
        # row 0 is the window).
        step2 = next(r for r in records if r["step"] == 2)
        assert step2["gold"] == {"operation": "fill", "fill_target": "1"}
        assert step2["llm"]["target"] == "Email"
        assert step2["effect"] == "confirmed"
        # Redaction proof at the loop level: neither the CHANGED-row values
        # nor the executed step's typed text reach the file.
        raw = trace_path.read_text()
        assert "operator@eval.local" not in raw
        assert PASSWORD not in raw
        # The loop itself still executed every recorded turn untouched.
        assert len(adapter.executed) == len(task.turns)

    async def test_live_session_labels_records_train(self, tmp_path):
        task = self._task(4)
        trace_path = tmp_path / "live-traces.jsonl"
        await self._run(
            tmp_path, task,
            {
                "shadow_head_enabled": True,
                "shadow_head": MockHead(),
                "shadow_trace_path": str(trace_path),
            },
            session_id="real-operator-session",
        )
        records = _read_lines(trace_path)
        assert {r["split"] for r in records} == {"train"}
        assert {r["task_id"] for r in records} == {"real-operator-session"}
        # With gold present they are valid few-shot exemplars.
        labeled = [r for r in records if r["gold"]]
        assert labeled and all(exemplar_from_trace(r) for r in labeled)

    async def test_recording_failure_degrades_to_warning_never_step_failure(
        self, tmp_path,
    ):
        task = self._task()
        # A directory path makes the recorder's open() fail.
        bad_path = tmp_path / "a-directory"
        bad_path.mkdir()
        result, events, adapter = await self._run(
            tmp_path, task,
            {
                "shadow_head_enabled": True,
                "shadow_head": MockHead(),
                "shadow_trace_path": str(bad_path),
            },
        )
        assert result.stop_reason.value == "done"
        assert len(adapter.executed) == len(task.turns)
        shadow_events = [e for e in events if e["type"] == "shadow.decision"]
        assert len(shadow_events) == len(task.turns)

    async def test_recorder_closed_at_run_end(self, tmp_path):
        task = self._task(4)
        trace_path = tmp_path / "live-traces.jsonl"
        await self._run(
            tmp_path, task,
            {
                "shadow_head_enabled": True,
                "shadow_head": MockHead(),
                "shadow_trace_path": str(trace_path),
            },
        )
        # Appending by hand after close is the operator's business; the
        # recorder must have flushed everything it wrote.
        records = _read_lines(trace_path)
        assert len(records) == len(task.turns)
