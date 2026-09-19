"""Tests for the planning-loop shadow hook: off-is-identical, on-logs-only."""

from __future__ import annotations

import pytest

from core import shadow_eval
from core.decision_head import Choice, MockHead, TypedDecision
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


class TestShadowStateDeltas:
    """[SINCE LAST STEP] delta block + duck-typed head lifecycle hooks."""

    class _RecordingHead:
        """Minimal head capturing state text and hook calls."""

        model_id = "recording-head"

        def __init__(self):
            self.state_texts: list[str] = []
            self.begin_calls: list[str] = []
            self.notes: list[tuple[int, dict]] = []

        def begin_run(self, task_id):
            self.begin_calls.append(task_id)

        def note_prior_step(self, step_num, summary):
            self.notes.append((step_num, summary))

        def decide(self, state_text, questions):
            self.state_texts.append(state_text)
            choices = {}
            for question in questions:
                choices[question.name] = Choice(
                    question=question.name,
                    chosen=question.options[0],
                    probabilities={option: (1.0 if option == question.options[0] else 0.0)
                                   for option in question.options},
                    confidence=0.5,
                )
            return TypedDecision(
                choices=choices, latency_ms=1.0, model_id=self.model_id
            )

    async def _run_with_head(self, head, steps: int = 6):
        task = _task(steps)
        result, events, adapter = await _run(
            task,
            {"shadow_head_enabled": True, "shadow_head": head},
        )
        return task, result, events, adapter

    async def test_delta_block_present_on_every_step(self):
        head = self._RecordingHead()
        task, _, _, _ = await self._run_with_head(head)
        assert len(head.state_texts) == len(task.turns)
        for state_text in head.state_texts:
            assert "[SINCE LAST STEP]" in state_text
            # Between [TASK] and [OBSERVED ELEMENTS].
            assert state_text.index("[TASK]") < state_text.index("[SINCE LAST STEP]")
            assert state_text.index("[SINCE LAST STEP]") < state_text.index("[OBSERVED ELEMENTS]")

    async def test_first_step_says_no_prior_state(self):
        head = self._RecordingHead()
        await self._run_with_head(head)
        assert "This is the first observed state; no prior step to compare." \
            in head.state_texts[0]

    async def test_delta_non_empty_on_value_change_steps(self):
        # form-fill: step 1 fills Email, step 2 fills Password — the scripted
        # trees carry the filled value one step later, so a CHANGED row must
        # appear (this is the load-bearing non-vacuousness check).
        head = self._RecordingHead()
        await self._run_with_head(head)
        later = head.state_texts[1:]
        assert any("CHANGED" in state_text for state_text in later), later
        changed = next(s for s in later if "CHANGED" in s)
        assert 'Email = "operator@eval.local"' in changed

    async def test_begin_run_called_once_per_run(self):
        head = self._RecordingHead()
        await self._run_with_head(head)
        assert head.begin_calls == ["shadow-hook-test"]

    async def test_note_prior_step_called_per_decision_with_summary(self):
        head = self._RecordingHead()
        task, _, _, _ = await self._run_with_head(head)
        assert [step for step, _ in head.notes] == list(range(1, len(task.turns) + 1))
        first = head.notes[0][1]
        assert first["operation"] == "click"  # first sorted closed-set option
        assert "first observed state" in first["delta"]["text"]
        later = head.notes[1][1]
        assert later["delta"]["changed"] >= 1
        assert later["stuck"] in ("true", "false")
        assert later["goal_satisfied"] in ("true", "false")

    async def test_run_reset_on_second_run_same_instance(self):
        # Two runs on ONE loop instance: the delta baseline must reset at
        # the second run() boundary, not compare against run 1's last table.
        task = _task(4)
        head = self._RecordingHead()
        get_refmap().clear()
        provider = shadow_eval.ScriptedVisionProvider(task.turns)
        adapter = shadow_eval.ScriptedAdapter(fail_targets=task.fail_targets)
        _, restore = shadow_eval._patch_inspector(shadow_eval._step_trees(task))
        try:
            loop = PlanningLoop(
                vision_provider=provider,
                adapter=adapter,
                config=PlanningLoopConfig(
                    max_steps=len(task.turns) + 2,
                    approval_policy="never",
                    reflect_after_each_step=False,
                    batch_enabled=False,
                    shadow_head_enabled=True,
                    shadow_head=head,
                ),
                event_callback=lambda _e: None,
            )
            await loop.run(task.task, session_id="shadow-run-one")
            first_run_opens = len(head.begin_calls)
            # Fresh recorded transcript for run 2 (run 1 exhausted this one —
            # its first plan would be `done`, which never reaches the hook).
            loop.vision_provider = shadow_eval.ScriptedVisionProvider(task.turns)
            await loop.run(task.task, session_id="shadow-run-two")
        finally:
            restore()
        assert first_run_opens == 1
        assert head.begin_calls == ["shadow-run-one", "shadow-run-two"]
        # Second run's step 1 is a first-observed-state step again.
        second_run_first_state = head.state_texts[len(task.turns)]
        assert "This is the first observed state; no prior step to compare." \
            in second_run_first_state
