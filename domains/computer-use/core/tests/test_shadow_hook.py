"""Tests for the planning-loop shadow hook: off-is-identical, on-logs-only."""

from __future__ import annotations

import pytest

from core import shadow_eval
from core.decision_head import MockHead
from core.element_refs import get_refmap
from core.planning_loop import PlanningLoop, PlanningLoopConfig


def _task(steps: int = 6):
    return shadow_eval.default_tasks(steps)[1]  # form-fill


async def _run(task, config_kwargs=None, head=None):
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
        result = await loop.run(task.task, session_id="shadow-hook-test")
    finally:
        restore()
    return result, events, adapter


class TestShadowOffIsIdentical:
    async def test_off_by_default_emits_no_shadow_events(self):
        task = _task()
        result, events, adapter = await _run(task)
        assert result.stop_reason.value == "done"
        assert len(adapter.executed) == len(task.turns)
        assert not [e for e in events if e["type"].startswith("shadow.")]

    async def test_explicit_off_matches_default_run(self):
        task = _task()
        _, _, adapter_default = await _run(task)
        _, _, adapter_off = await _run(task, {"shadow_head_enabled": False})
        assert adapter_default.executed == adapter_off.executed
        assert len(adapter_off.executed) == len(task.turns)

    async def test_injected_head_never_called_when_off(self):
        task = _task()

        def _boom(question, state_text):  # pragma: no cover - must never run
            raise AssertionError("head must not be consulted when shadow is off")

        await _run(task, {"shadow_head": MockHead(chooser=_boom)})
        # Reaching here without the AssertionError is the assertion.


class TestShadowOnLogsOnly:
    async def test_emits_one_shadow_decision_per_step(self):
        task = _task()
        _, events, adapter = await _run(
            task, {"shadow_head_enabled": True, "shadow_head": MockHead(latency_ms=3.0)}
        )
        shadow_events = [e for e in events if e["type"] == "shadow.decision"]
        assert len(shadow_events) == len(task.turns)
        for event in shadow_events:
            assert event["latency_ms"] >= 3.0
            assert event["element_count"] > 0
            op = event["decision"]["choices"]["operation"]
            assert op["chosen"] in op["probabilities"]

    async def test_shadow_never_changes_executed_actions(self):
        task = _task()
        _, _, adapter_off = await _run(task)
        result, _, adapter_on = await _run(
            task, {"shadow_head_enabled": True, "shadow_head": MockHead()}
        )
        assert adapter_on.executed == adapter_off.executed
        # The plan step fields are the LLM's recorded answers, untouched.
        for step, turn in zip(result.steps, task.turns):
            assert step.action_type == turn.action_type
            assert step.action_target == turn.target

    async def test_failing_head_does_not_break_the_loop(self):
        task = _task()

        class _BrokenHead:
            model_id = "broken"

            def decide(self, state_text, questions):  # noqa: ARG002
                raise RuntimeError("head exploded")

        result, events, adapter = await _run(
            task, {"shadow_head_enabled": True, "shadow_head": _BrokenHead()}
        )
        assert result.stop_reason.value == "done"
        assert len(adapter.executed) == len(task.turns)
        assert not [e for e in events if e["type"] == "shadow.decision"]

    async def test_shadow_event_in_loop_vocabulary(self):
        from core.planning_loop import LOOP_EVENTS

        assert "shadow.decision" in LOOP_EVENTS
