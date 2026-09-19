"""System One graft tests — reserved reobserve/abstain slots (graft A) and
the [LAST ACTION] effect/escalation block (graft B), both grafted from cua's
jev-use recipe (trycua/cua PR #3916) onto the shadow decision head."""

from __future__ import annotations

from core import shadow_eval
from core.decision_head import (
    KimiCliHead,
    MockHead,
    Question,
    _canonicalize_answer,
    canonical_operation,
)
from core.element_table import RESERVED_SLOTS_INSTRUCTION

# The search task's adapter fails the "First result" click (step 3 of the
# 3-turn pattern) — the only scripted failure in the first few steps.
_SEARCH_TASK = shadow_eval._search_task(6)


class _RecordingHead:
    """Scripted MockHead that captures every question + state_text seen."""

    def __init__(self, task) -> None:
        self.operation_states: list[str] = []  # state_text per operation question, in order
        scripted = shadow_eval.scripted_head(task)
        inner_chooser = scripted._chooser

        def capturing_chooser(question: Question, state_text: str) -> str:
            if question.name == "operation":
                self.operation_states.append(state_text)
            return inner_chooser(question, state_text)

        self._head = MockHead(
            chooser=capturing_chooser,
            latency_ms=1.0,
            confidence=0.8,
            model_id="recording-mock",
        )

    def decide(self, state_text, questions):
        return self._head.decide(state_text, questions)


def _run(reserved_slots: bool = False, last_action: bool = False):
    head = _RecordingHead(_SEARCH_TASK)
    report = shadow_eval.run_task_sync(
        _SEARCH_TASK,
        head=head,
        reserved_slots=reserved_slots,
        last_action=last_action,
    )
    return head, report


# ── Graft A: reserved slots ────────────────────────────────────────────────

def test_reserved_slots_absent_by_default():
    head, _ = _run()
    assert head.operation_states, "the head must have been asked the operation question"
    for _, state_text in [(None, s) for s in head.operation_states]:
        assert "reobserve" not in state_text.split("[INSTRUCTIONS]")[-1]
        assert "abstain" not in state_text.split("[INSTRUCTIONS]")[-1]
        assert "Reserved slots:" not in state_text


def test_reserved_slots_appended_after_whitelist_when_on():
    head, _ = _run(reserved_slots=True)
    assert head.operation_states
    for state_text in head.operation_states:
        # The [OPTIONS] rendering lists the reserved slots after the
        # whitelist operations...
        options_line = next(
            line for line in state_text.splitlines()
            if line.startswith("operation:")
        )
        ops = [o.strip() for o in options_line.split(":", 1)[1].split(",")]
        assert ops[-2:] == ["reobserve", "abstain"]
        assert "abstain" not in ops[:-2]
        # ...and [INSTRUCTIONS] explains them.
        instructions = state_text.split("[INSTRUCTIONS]")[-1]
        assert f"Reserved slots: {RESERVED_SLOTS_INSTRUCTION}" in instructions
    # Reserved slots get NO target menus.
    target_lines = [
        line for line in head.operation_states[0].splitlines()
        if line.endswith("_target:")
    ]
    assert not any(t.startswith(("reobserve_target:", "abstain_target:"))
                   for t in target_lines)


def test_reserved_slot_names_pass_canonicalization():
    options = ["click", "reobserve", "abstain"]
    question = Question(name="operation", options=options)
    for slot in ("reobserve", "abstain"):
        assert canonical_operation(slot) == slot
        answer, miss = _canonicalize_answer(question, slot)
        assert answer == slot
        assert miss is None  # exact option — no alias folding, no vocab miss


def test_agreement_unchanged_when_slots_present_but_unused():
    """Scripted head never picks a reserved slot, so agreement must equal the
    graft-off plumbing number (reserved slots are inert until chosen)."""
    _, report_off = _run()
    _, report_on = _run(reserved_slots=True)
    assert report_off["agreement_rate"] == report_on["agreement_rate"]
    assert report_on["reobserve_picks"] == 0
    assert report_on["abstain_picks"] == 0


# ── Graft B: [LAST ACTION] block ───────────────────────────────────────────

def test_last_action_absent_by_default_and_on_step_one():
    head, _ = _run(last_action=False)
    for state_text in head.operation_states:
        assert "[LAST ACTION]" not in state_text

    head, _ = _run(last_action=True)
    # Step 1: nothing executed yet — no block even with the flag on.
    assert "[LAST ACTION]" not in head.operation_states[0]


def test_last_action_block_position_and_confirmed_effect():
    head, _ = _run(last_action=True)
    # Step 2's state carries the block between [SINCE LAST STEP] and
    # [OBSERVED ELEMENTS]; step 1's action (fill) succeeded → confirmed,
    # no escalation line.
    state_text = head.operation_states[1]
    assert "[LAST ACTION]" in state_text
    assert state_text.index("[SINCE LAST STEP]") < state_text.index("[LAST ACTION]")
    assert state_text.index("[LAST ACTION]") < state_text.index("[OBSERVED ELEMENTS]")
    assert "effect: confirmed" in state_text
    assert "escalation:" not in state_text


def test_last_action_suspected_noop_and_escalation_on_failure():
    head, report = _run(last_action=True)
    # The scripted adapter fails the "First result" click at step 3, so the
    # step-4 shadow state must report the failure honestly.
    failed_steps = [s["step"] for s in report["steps"] if not s["llm_success"]]
    assert failed_steps, "search task must script at least one failed step"
    state_text = head.operation_states[failed_steps[0]]  # index = step - 1
    assert "effect: suspected_noop" in state_text
    assert "escalation:" in state_text
    assert "consider reobserve or a different target." in state_text


# ── KimiCliHead prompt ──────────────────────────────────────────────────────

def test_kimi_prompt_explains_reserved_slots_only_when_present():
    head = KimiCliHead(binary="kimi")
    state = "[TASK]\nt\n\n[SINCE LAST STEP]\nNo change.\n\n[OBSERVED ELEMENTS]\n[0] AXButton: Go"
    with_slots = [Question(name="operation",
                           options=["click", "reobserve", "abstain"])]
    without_slots = [Question(name="operation", options=["click", "fill"])]

    prompt_on = head._prompt(state, with_slots)
    assert "Reserved slots in the operation list:" in prompt_on
    assert RESERVED_SLOTS_INSTRUCTION in prompt_on

    prompt_off = head._prompt(state, without_slots)
    assert "Reserved slots in the operation list:" not in prompt_off


def test_report_counts_reserved_slot_picks():
    task = shadow_eval._search_task(4)
    abstaining = MockHead(decisions={"operation": "abstain"}, model_id="abstainer")
    report = shadow_eval.run_task_sync(task, head=abstaining, reserved_slots=True)
    # Every reserved-slot pick is a disagreement (reference policy never
    # abstains) — honest metric, no special-casing as correct.
    assert report["abstain_picks"] == report["decide_steps"]
    assert report["reobserve_picks"] == 0
    assert report["agreement_rate"] == 0.0


def test_markdown_renders_graft_usage_when_on():
    report = shadow_eval.run_eval(steps_per_task=20, reserved_slots=True)
    md = shadow_eval.render_markdown(report)
    assert "Reserved-slot usage (graft A)" in md
    assert "reobserve picks" in md

    off_md = shadow_eval.render_markdown(shadow_eval.run_eval(steps_per_task=20))
    assert "Reserved-slot usage (graft A)" not in off_md
